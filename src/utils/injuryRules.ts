/**
 * Fase 9 (T9.2) — REGRAS DE FERIMENTO (Bio-Monitor CP2020)
 * ========================================================
 * Regras puras extraídas do HealthTracker.tsx para serem testáveis em unit.
 *
 * `woundLevel` 0..10 (WOUND_MAX): Ileso; Leve → Sério → Crítico; Mortal 0..6
 * — cada nível Mortal exige death save (1d10 ≤ BODY − o nível).
 * O NOME e o EFEITO de cada nível são do livro e moram em src/rules/tables.ts
 * (WOUND_TRACK), lidos por `woundRow` (src/rules/character.ts) — o mesmo código
 * que o servidor usa nas rolagens e no chat. O efeito saiu daqui na Fase C
 * (C.5): a tabela antiga era regra de casa. O nome, na K.3a (o G.05): a lista
 * própria ("Ferimento Sério (Serious)", "Mortal 6 (Morte Iminente)") dava ao
 * mesmo ferimento dois nomes, às vezes no mesmo cartão.
 */
import { woundRow } from '../rules/character';

// ---------------------------------------------------------------------------
// Níveis de ferimento (índice = woundLevel 0..10)
// ---------------------------------------------------------------------------

export const WOUND_MAX = 10;

/**
 * A cor de cada nível (índice = woundLevel 0..10): o token `wound-N` do @theme
 * (src/index.css, F.2.7), onde moram a escala e o contraste dela. As classes
 * ficam escritas por extenso para o Tailwind achá-las no código.
 */
export const WOUND_LEVEL_COLORS: readonly string[] = [
  'text-wound-0',
  'text-wound-1',
  'text-wound-2',
  'text-wound-3',
  'text-wound-4',
  'text-wound-5',
  'text-wound-6',
  'text-wound-7',
  'text-wound-8',
  'text-wound-9',
  'text-wound-10'
];

/** A cor de um `woundLevel` qualquer, grampeado como o nome (`woundRow`). */
export function woundLevelColor(woundLevel: number): string {
  return WOUND_LEVEL_COLORS[woundRow(woundLevel).level];
}

// O `clampWoundLevel` saiu na Fase D: a ficha passou a marcar PONTOS (D.1),
// e o grampo mora em `woundStateFromPoints` (src/rules/damage.ts).

/**
 * true na última caixa da trilha (Mortal 6). O personagem ainda está VIVO:
 * morre ao falhar um death save ou ao sofrer dano além dela. Até a Fase C
 * isto se chamava `isDead` e desligava o death save justo neste nível.
 */
export function isLastWoundBox(level: number): boolean {
  return level >= WOUND_MAX;
}
