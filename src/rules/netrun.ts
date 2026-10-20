/**
 * ============================================================
 * NETSHEET ENGINE — O DECK E OS PROGRAMAS DO NETRUNNER (K.5b)
 * ============================================================
 * Decisão 9: o netrunner na ficha, sem a Net jogável. O deck guarda o tipo e as
 * melhorias; a MU e o preço saem da tabela (src/rules/tables.ts, com as fontes
 * na conferência). Funções puras, como o resto de src/rules/.
 */
import type { Cyberdeck, NetProgram } from '../types/cyberpunk';
import { DECK_BASE, DECK_CHASSIS, DECK_EXTRA_MEMORY_MU, DECK_UPGRADE_EB } from './tables';

/** O deck como sai da loja: o padrão, sem melhoria (S6, S12, S13). */
export function createDefaultDeck(): Cyberdeck {
  return {
    model: '',
    chassis: 'standard',
    speed: DECK_BASE.speed,
    dataWall: DECK_BASE.dataWall,
    codeGate: DECK_BASE.codeGate,
    extraMemory: false
  };
}

/** A MU do deck: o módulo padrão, mais o segundo, se houver. */
export function deckTotalMu(deck: Pick<Cyberdeck, 'extraMemory'>): number {
  return DECK_BASE.mu + (deck.extraMemory ? DECK_EXTRA_MEMORY_MU : 0);
}

/**
 * O preço do deck pela tabela: o do tipo, mais cada melhoria. A Data Wall abaixo
 * do padrão não desconta — o livro só vende para cima.
 */
export function deckCostEb(deck: Cyberdeck): number {
  const chassis = DECK_CHASSIS.find((c) => c.id === deck.chassis) ?? DECK_CHASSIS[0];
  return (
    chassis.costEb +
    Math.max(0, deck.speed) * DECK_UPGRADE_EB.speedPerPoint +
    Math.max(0, deck.dataWall - DECK_BASE.dataWall) * DECK_UPGRADE_EB.dataWallPerPoint +
    (deck.extraMemory ? DECK_UPGRADE_EB.extraMemory : 0)
  );
}

/** A MU que os programas carregados ocupam no deck. */
export function loadedProgramsMu(programs: readonly NetProgram[] | undefined): number {
  return (programs ?? []).reduce((total, p) => (p.loaded ? total + p.mu : total), 0);
}

/** O que soma ao 1d10 da iniciativa na Net: REF + Speed do deck (S1, S6). */
export function netInitiativeBonus(ref: number, deck: Cyberdeck | null | undefined): number {
  return ref + (deck?.speed ?? 0);
}
