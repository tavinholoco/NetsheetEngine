/**
 * ============================================================
 * NETSHEET ENGINE — HOOK DE FICHA DE PERSONAGEM (T0.11)
 * Roster + ficha ativa + persistência local/cloud + autosave.
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

  // Sessão Firebase + assinatura do roster
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setRoster([]);
      return;
    }
    const unsub = subscribeToCharacterSheets(user.uid, (r) => setRoster(r));
    return () => unsub();
  }, [user]);

  // Autosave local (persistência offline sempre ativa)
  useEffect(() => {
    writeActiveToStorage(sheet);
  }, [sheet]);

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
      try {
        const local: CharacterSheet[] = JSON.parse(localStorage.getItem(LS_ROSTER_KEY) || '[]');
        const found = local.find((s) => s.id === id);
        if (found) setSheet(found);
      } catch {
        /* ignore */
      }
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
    try {
      const local: CharacterSheet[] = JSON.parse(localStorage.getItem(LS_ROSTER_KEY) || '[]');
      const idx = local.findIndex((s) => s.id === current.id);
      if (idx >= 0) local[idx] = current;
      else local.push(current);
      localStorage.setItem(LS_ROSTER_KEY, JSON.stringify(local));
    } catch {
      /* ignore */
    }

    if (user) {
      try {
        await saveCharacterSheet(user.uid, current);
      } catch (e: any) {
        throw new Error(e?.message || 'Falha de conexão com a nuvem');
      }
    }
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
      try {
        const local: CharacterSheet[] = JSON.parse(localStorage.getItem(LS_ROSTER_KEY) || '[]');
        localStorage.setItem(
          LS_ROSTER_KEY,
          JSON.stringify(local.filter((s) => s.id !== id))
        );
      } catch {
        /* ignore */
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
