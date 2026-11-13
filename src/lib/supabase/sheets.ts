/**
 * L.4 — fichas na nuvem: o roster em tempo real e o upsert por
 * (user_id, sheet_id).
 */
import type { CharacterSheet } from '../../types/cyberpunk';
import { supabase, subscribeShared, type Unsubscribe } from './client';
import type { CharacterSheetRow, SheetMeta } from './types';

/** Assina o roster de fichas do usuário em tempo real. */
export function subscribeToCharacterSheets(
  uid: string,
  cb: (roster: SheetMeta[]) => void
): Unsubscribe {
  let active = true;

  const load = async () => {
    const { data, error } = await supabase
      .from('character_sheets')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false });
    if (error || !data || !active) return;
    cb(
      (data as CharacterSheetRow[]).map((s) => ({
        id: s.sheet_id,
        handle: s.handle || 'Sem nome',
        role: s.role || 'Solo',
        updatedAt: s.updated_at
      }))
    );
  };

  // Canal primeiro, load depois: evita perder eventos entre o load e a subscrição.
  // SEM filter por coluna: eventos DELETE (deleteCharacterSheet) não são
  // avaliados com filtro de coluna não-PK no Realtime (bug T2.18). A RLS
  // owner-only já limita às fichas do próprio usuário.
  const unsub = subscribeShared(
    `sheets_${uid}`,
    (onEvent) =>
      supabase.channel(`sheets_${uid}`).on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'character_sheets' },
        onEvent
      ),
    () => {
      void load();
    }
  );
  void load();

  return () => {
    active = false;
    unsub();
  };
}

/** Salva (ou atualiza) uma ficha na nuvem (upsert por user_id + sheet_id). */
export async function saveCharacterSheet(uid: string, sheet: CharacterSheet): Promise<void> {
  const { error } = await supabase.from('character_sheets').upsert(
    {
      user_id: uid,
      sheet_id: sheet.id,
      handle: sheet.handle || '',
      role: sheet.role || '',
      data: sheet,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'user_id,sheet_id' }
  );
  if (error) throw error;
}

/** Carrega uma ficha completa da nuvem. */
export async function loadCharacterSheet(
  uid: string,
  sheetId: string
): Promise<CharacterSheet | null> {
  const { data, error } = await supabase
    .from('character_sheets')
    .select('data')
    .eq('user_id', uid)
    .eq('sheet_id', sheetId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data as CharacterSheetRow).data : null;
}

/** Deleta uma ficha da nuvem. */
export async function deleteCharacterSheet(uid: string, sheetId: string): Promise<void> {
  const { error } = await supabase
    .from('character_sheets')
    .delete()
    .eq('user_id', uid)
    .eq('sheet_id', sheetId);
  if (error) throw error;
}
