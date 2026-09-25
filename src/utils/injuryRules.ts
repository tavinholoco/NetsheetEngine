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
 */
export const WOUND_LEVEL_NAMES: { name: string; color: string }[] = [
  { name: 'Saudável (OK)', color: 'text-emerald-400' },
  { name: 'Ferimento Leve (Light)', color: 'text-yellow-400' },
  { name: 'Ferimento Sério (Serious)', color: 'text-orange-400' },
  { name: 'Ferimento Crítico (Critical)', color: 'text-red-400' },
  { name: 'Mortal 0', color: 'text-red-500' },
  { name: 'Mortal 1', color: 'text-red-500' },
  { name: 'Mortal 2', color: 'text-red-600' },
  { name: 'Mortal 3', color: 'text-red-600' },
  { name: 'Mortal 4', color: 'text-rose-600' },
  { name: 'Mortal 5', color: 'text-rose-700' },
  { name: 'Mortal 6 (Morte Iminente)', color: 'text-rose-700' }
];

/** Limita o nível de ferimento ao intervalo válido 0..10. */
export function clampWoundLevel(level: number): number {
  return Math.max(0, Math.min(WOUND_MAX, level));
}

/** true quando o personagem atingiu a morte iminente (nível 10). */
export function isDead(level: number): boolean {
  return level >= WOUND_MAX;
}
