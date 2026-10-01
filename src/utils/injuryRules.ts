/**
 * Fase 9 (T9.2) — REGRAS DE FERIMENTO (Bio-Monitor CP2020)
 * ========================================================
 * Regras puras extraídas do HealthTracker.tsx para serem testáveis em unit.
 *
 * `woundLevel` 0..10 (WOUND_MAX):
 *   0   Saudável (OK)
 *   1–3 Leve → Sério → Crítico
 *   4–9 Mortal (0..5) — cada nível mortal exige death save (1d10 ≤ BODY)
 *   10  Morte iminente
 * O EFEITO de cada nível nos atributos saiu daqui na Fase C (C.5): a tabela
 * antiga (−2 a −6 em REF e MA, com notas inventadas) era regra de casa. O
 * efeito do livro mora em src/rules/tables.ts (WOUND_TRACK) e é aplicado por
 * src/rules/character.ts — o mesmo código que o servidor usa nas rolagens.
 */

// ---------------------------------------------------------------------------
// Níveis de ferimento (índice = woundLevel 0..10)
// ---------------------------------------------------------------------------

export const WOUND_MAX = 10;

/**
 * Nomes dos níveis de ferimento (índice = woundLevel 0..10).
 * Exportado porque o TacticalGrid.tsx também consome este símbolo.
 * A cor de cada nível é o token `wound-N` do @theme (src/index.css, F.2.7):
 * a escala e o contraste dela moram lá, num lugar só.
 */
export const WOUND_LEVEL_NAMES: { name: string; color: string }[] = [
  { name: 'Saudável (OK)', color: 'text-wound-0' },
  { name: 'Ferimento Leve (Light)', color: 'text-wound-1' },
  { name: 'Ferimento Sério (Serious)', color: 'text-wound-2' },
  { name: 'Ferimento Crítico (Critical)', color: 'text-wound-3' },
  { name: 'Mortal 0', color: 'text-wound-4' },
  { name: 'Mortal 1', color: 'text-wound-5' },
  { name: 'Mortal 2', color: 'text-wound-6' },
  { name: 'Mortal 3', color: 'text-wound-7' },
  { name: 'Mortal 4', color: 'text-wound-8' },
  { name: 'Mortal 5', color: 'text-wound-9' },
  { name: 'Mortal 6 (Morte Iminente)', color: 'text-wound-10' }
];

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
