/**
 * ============================================================
 * NETSHEET ENGINE — useSheetStore (Fase 4 · T4.1/T4.2)
 * Estado global da ficha: sheet ativa, roster, sessão (user) e
 * ações. Elimina o prop drilling de sheet/roster/user no App.tsx.
 *
 * Estratégia (bridge, sem reescrever a persistência testada):
 * o `useCharacterSheet` continua sendo a fonte de verdade da
 * persistência (cloud + localStorage + autosave + merge local→cloud).
 * O App chama `syncSheetStore` a cada render (estado do hook espelhado
 * na store), e os componentes leem daqui — sem cascata de props.
 * ============================================================
 */
import { create } from 'zustand';
import { useCharacterSheet, UseCharacterSheetResult, createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import type { CharacterSheet } from '../types/cyberpunk';

type SheetActions = Pick<
  UseCharacterSheetResult,
  | 'updateSheet'
  | 'loadSheet'
  | 'loadPresetAsNewSheet'
  | 'createNewCharacter'
  | 'saveCurrentSheet'
  | 'saveCurrentSheetAndReset'
  | 'deleteCharacter'
  | 'resetToBlankSheet'
>;

type SheetState = {
  user: UseCharacterSheetResult['user'];
  authLoading: boolean;
  sheet: CharacterSheet;
  roster: UseCharacterSheetResult['roster'];
} & SheetActions

export const useSheetStore = create<SheetState>((set) => ({
  user: null,
  authLoading: true,
  // Ficha em branco como estado inicial válido (evita crash de `sheet.stats`
  // antes do primeiro sync — o App conecta o hook via syncSheetStore)
  sheet: createBlankCharacterSheet(),
  roster: [],
  updateSheet: () => {},
  loadSheet: async () => {},
  loadPresetAsNewSheet: () => {},
  createNewCharacter: () => {},
  saveCurrentSheet: async () => '',
  saveCurrentSheetAndReset: async () => '',
  deleteCharacter: () => {},
  resetToBlankSheet: () => {}
}));

/** Espelha o estado/ações do useCharacterSheet para a store. */
export function syncSheetStore(result: UseCharacterSheetResult): void {
  useSheetStore.setState({
    user: result.user,
    authLoading: result.authLoading,
    sheet: result.sheet,
    roster: result.roster,
    updateSheet: result.updateSheet,
    loadSheet: result.loadSheet,
    loadPresetAsNewSheet: result.loadPresetAsNewSheet,
    createNewCharacter: result.createNewCharacter,
    saveCurrentSheet: result.saveCurrentSheet,
    saveCurrentSheetAndReset: result.saveCurrentSheetAndReset,
    deleteCharacter: result.deleteCharacter,
    resetToBlankSheet: result.resetToBlankSheet
  });
}
