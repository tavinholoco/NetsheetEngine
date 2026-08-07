/**
 * ============================================================
 * NETSHEET ENGINE — HOOK DE FICHA DE PERSONAGEM (T0.11 / T2.13)
 * Roster + ficha ativa + persistência local/cloud + autosave.
 *
 * T2.13 (Fase 2 — migração Supabase):
 *   - Persistência na nuvem em `character_sheets` (jsonb) via camada
 *     `src/lib/supabase.ts` (upsert por user_id + sheet_id).
 *   - Fallback localStorage offline: a ficha ativa e o roster local
 *     são sempre gravados localmente (LS_ACTIVE_KEY / LS_ROSTER_KEY).
 *   - Modo visitante: o roster local é exibido (não mais vazio).
 *   - Merge one-way local→cloud: no primeiro login, fichas criadas no
 *     modo visitante são enviadas à nuvem (uma vez por uid).
 *   - Autosave cloud com debounce (1.5s) quando logado e a ficha tem
 *     handle preenchido; autosave local é imediato em qualquer edição.
 *
 * Interface consumida pelo App.tsx:
 *   { user, authLoading, sheet, roster, updateSheet, loadSheet,
 *     loadPresetAsNewSheet, createNewCharacter, saveCurrentSheet,
 *     saveCurrentSheetAndReset, deleteCharacter, resetToBlankSheet }
 * ============================================================
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  auth,
  onAuthStateChanged,
  subscribeToCharacterSheets,
  saveCharacterSheet,
  loadCharacterSheet,
  deleteCharacterSheet,
  type User,
  type SheetMeta
} from '../lib/supabase';
import type { CharacterSheet } from '../types/cyberpunk';
import { DEFAULT_ARMOR } from '../data/cyberpunkData';

const LS_ACTIVE_KEY = 'cyberpunk_active_sheet_v1';
const LS_ROSTER_KEY = 'cyberpunk_local_roster_v1';
/** Marca o merge local→cloud já feito para um uid (evita re-envio). */
const LS_MERGED_PREFIX = 'cyberpunk_merged_v1_';
/** Dono atual do roster local (uid que o gerou) — evita vazar fichas entre contas. */
const LS_ROSTER_OWNER_KEY = 'cyberpunk_local_roster_owner_v1';

/** Cria uma ficha em branco com valores padrão de CP2020. */
export function createBlankCharacterSheet(): CharacterSheet {
  const now = new Date().toISOString();
  return {
    id: 'sheet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
    handle: '',
    realName: '',
    role: 'Solo',
    specialAbilityName: 'Combat Sense',
    specialAbilityRank: 0,
    avatarUrl: '',
    age: 24,
    sex: '',
    eurodollars: 1000,
    stats: { INT: 5, REF: 5, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 5, EMP: 5 },
    currentStats: { INT: 5, REF: 5, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 5, EMP: 5 },
    woundLevel: 0,
    skills: [],
    cyberware: [],
    weapons: [],
    armor: DEFAULT_ARMOR.map((a) => ({
      ...a,
      id: 'arm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)
    })),
    lifepath: {
      familyBackground: '',
      parentStatus: '',
      familyTragedy: '',
      childhoodEnvironment: '',
      motivationStyle: '',
      valuedPerson: '',
      valuedPossession: '',
      lifeEvents: []
    },
    gearNotes: '',
    createdAt: now,
    updatedAt: now
  };
}

/* ------------------------------------------------------------
   STORAGE LOCAL (fallback offline universal)
   ------------------------------------------------------------ */

function readActiveFromStorage(): CharacterSheet {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CharacterSheet;
      if (parsed && typeof parsed === 'object' && parsed.id && parsed.stats) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return createBlankCharacterSheet();
}

function writeActiveToStorage(sheet: CharacterSheet): void {
  try {
    localStorage.setItem(LS_ACTIVE_KEY, JSON.stringify(sheet));
  } catch {
    /* ignore */
  }
}

/** Lê o roster local (fichas completas). */
function readLocalRoster(): CharacterSheet[] {
  try {
    const list = JSON.parse(localStorage.getItem(LS_ROSTER_KEY) || '[]') as CharacterSheet[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeLocalRoster(list: CharacterSheet[]): void {
  try {
    localStorage.setItem(LS_ROSTER_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Define o dono do roster local (uid que o gerou). */
function setLocalRosterOwner(uid: string | null): void {
  try {
    if (uid) localStorage.setItem(LS_ROSTER_OWNER_KEY, uid);
    else localStorage.removeItem(LS_ROSTER_OWNER_KEY);
  } catch {
    /* ignore */
  }
}

function getLocalRosterOwner(): string | null {
  try {
    return localStorage.getItem(LS_ROSTER_OWNER_KEY);
  } catch {
    return null;
  }
}

/** Converte fichas locais em metadados (mesmo formato do roster da nuvem). */
function localRosterToMeta(): SheetMeta[] {
  return readLocalRoster().map((s) => ({
    id: s.id,
    handle: s.handle || 'Sem nome',
    role: s.role || 'Solo',
    updatedAt: s.updatedAt || s.createdAt || new Date().toISOString()
  }));
}

/**
 * Merge one-way local→cloud: envia fichas locais que ainda não existem
 * na nuvem (por id). Executa uma única vez por uid (flag em localStorage)
 * para não reenviar a cada montagem/reload.
 */
async function mergeLocalToCloud(uid: string, cloudMetas: SheetMeta[]): Promise<void> {
  try {
    const flagKey = LS_MERGED_PREFIX + uid;
    if (localStorage.getItem(flagKey)) return;

    // Segurança: só mescla fichas locais geradas pelo próprio uid (ou órfãs
    // de visitante). Se outro usuário logar no mesmo navegador, não vaza.
    const owner = getLocalRosterOwner();
    if (owner && owner !== uid) return;

    const local = readLocalRoster();
    if (local.length === 0) {
      localStorage.setItem(flagKey, '1');
      return;
    }

    const cloudIds = new Set(cloudMetas.map((m) => m.id));
    let anyFailed = false;
    for (const sheet of local) {
      if (cloudIds.has(sheet.id)) continue;
      try {
        await saveCharacterSheet(uid, sheet);
      } catch {
        anyFailed = true; // falha individual não aborta, mas impede marcar como feito
      }
    }
    // Só marca como concluído se nenhum upload falhou (senão, re-tenta no próximo login)
    if (!anyFailed) localStorage.setItem(flagKey, '1');
    setLocalRosterOwner(uid);
  } catch {
    /* ignore */
  }
}

export interface UseCharacterSheetResult {
  user: User | null;
  authLoading: boolean;
  sheet: CharacterSheet;
  roster: SheetMeta[];
  updateSheet: (updated: Partial<CharacterSheet>) => void;
  loadSheet: (id: string) => void;
  loadPresetAsNewSheet: (preset: CharacterSheet) => void;
  createNewCharacter: () => void;
  saveCurrentSheet: () => Promise<string>;
  saveCurrentSheetAndReset: () => Promise<string>;
  deleteCharacter: (id: string) => void;
  resetToBlankSheet: () => void;
}

export function useCharacterSheet(): UseCharacterSheetResult {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sheet, setSheet] = useState<CharacterSheet>(readActiveFromStorage);
  const [roster, setRoster] = useState<SheetMeta[]>([]);
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  // Sessão + assinatura do roster
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      // Modo visitante: mostra as fichas locais (fallback offline)
      setRoster(localRosterToMeta());
      return;
    }
    const unsub = subscribeToCharacterSheets(user.uid, (r) => {
      setRoster(r);
      // Primeira carga da nuvem → mescla fichas locais que faltam (uma vez por uid)
      void mergeLocalToCloud(user.uid, r);
    });
    return () => unsub();
  }, [user]);

  // Autosave local (persistência offline sempre ativa)
  useEffect(() => {
    writeActiveToStorage(sheet);
  }, [sheet]);

  // Autosave cloud com debounce: salva na nuvem após 1.5s sem edições,
  // apenas se logado e a ficha tiver handle (evita linhas de "Sem nome").
  const lastCloudSaveRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user || !sheet.handle || !sheet.handle.trim()) return;
    // O saveCurrentSheet já gravou esta versão na nuvem — evita re-upsert redundante
    if (lastCloudSaveRef.current === sheet.updatedAt) return;
    const timer = setTimeout(() => {
      const current = { ...sheetRef.current, updatedAt: new Date().toISOString() };
      saveCharacterSheet(user.uid, current).catch(() => {
        /* autosave silencioso; o botão Salvar reporta erros */
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [sheet, user]);

  /** Atualiza parcialmente a ficha ativa. */
  const updateSheet = useCallback((updated: Partial<CharacterSheet>) => {
    setSheet((prev) => ({ ...prev, ...updated, updatedAt: new Date().toISOString() }));
  }, []);

  /** Carrega uma ficha pelo id (nuvem se logado, senão roster local). */
  const loadSheet = useCallback(
    async (id: string) => {
      if (user) {
        const loaded = await loadCharacterSheet(user.uid, id);
        if (loaded) {
          setSheet(loaded);
          return;
        }
      }
      const found = readLocalRoster().find((s) => s.id === id);
      if (found) setSheet(found);
    },
    [user]
  );

  /** Clona um preset como uma ficha nova (novo id). */
  const loadPresetAsNewSheet = useCallback((preset: CharacterSheet) => {
    const fresh = createBlankCharacterSheet();
    setSheet({
      ...preset,
      id: fresh.id,
      handle: preset.handle || fresh.handle,
      createdAt: fresh.createdAt,
      updatedAt: fresh.updatedAt
    });
  }, []);

  const createNewCharacter = useCallback(() => {
    setSheet(createBlankCharacterSheet());
  }, []);

  /** Salva a ficha ativa (nuvem se logado; sempre no roster local). */
  const saveCurrentSheet = useCallback(async (): Promise<string> => {
    const current = { ...sheetRef.current, updatedAt: new Date().toISOString() };

    // Roster local (fallback universal)
    const local = readLocalRoster();
    const idx = local.findIndex((s) => s.id === current.id);
    if (idx >= 0) local[idx] = current;
    else local.push(current);
    writeLocalRoster(local);

    if (user) {
      try {
        await saveCharacterSheet(user.uid, current);
        lastCloudSaveRef.current = current.updatedAt;
      } catch (e: any) {
        throw new Error(e?.message || 'Falha de conexão com a nuvem');
      }
    }
    setLocalRosterOwner(user?.uid ?? null);
    setSheet(current);
    return current.handle || 'Edgerunner';
  }, [user]);

  /** Salva a ficha atual e inicia uma nova em branco. */
  const saveCurrentSheetAndReset = useCallback(async (): Promise<string> => {
    const savedHandle = await saveCurrentSheet();
    setSheet(createBlankCharacterSheet());
    return savedHandle;
  }, [saveCurrentSheet]);

  /** Deleta uma ficha do roster (cloud + local). */
  const deleteCharacter = useCallback(
    (id: string) => {
      if (user) {
        deleteCharacterSheet(user.uid, id).catch((e) => console.error('Erro ao deletar ficha:', e));
      }
      writeLocalRoster(readLocalRoster().filter((s) => s.id !== id));
      if (!user) {
        // Atualiza o roster exibido no modo visitante
        setRoster(localRosterToMeta());
      }
      setSheet((prev) => (prev.id === id ? createBlankCharacterSheet() : prev));
    },
    [user]
  );

  const resetToBlankSheet = useCallback(() => {
    setSheet(createBlankCharacterSheet());
  }, []);

  return {
    user,
    authLoading,
    sheet,
    roster,
    updateSheet,
    loadSheet,
    loadPresetAsNewSheet,
    createNewCharacter,
    saveCurrentSheet,
    saveCurrentSheetAndReset,
    deleteCharacter,
    resetToBlankSheet
  };
}
