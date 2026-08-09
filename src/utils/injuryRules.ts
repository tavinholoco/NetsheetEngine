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
 * Penalidades de REF/MA acumuladas por nível de ferimento (tabela atual do
 * HealthTracker: −2 a −6, com notas de consciência/morte provável).
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

// ---------------------------------------------------------------------------
// Penalidades de REF/MA por nível de ferimento
// ---------------------------------------------------------------------------

/** Penalidade estruturada (numérica) de um nível de ferimento. */
export interface WoundPenalty {
  /** Penalidade de REF (negativa; 0 = sem penalidade). */
  ref: number;
  /** Penalidade de MA (negativa; 0 = sem penalidade). */
  ma: number;
  /** Nota narrativa extra (ex.: "consciência 50%"). */
  note?: string;
}

/**
 * Tabela estruturada das penalidades (fonte da verdade das regras).
 * A string exibida no UI é derivada por `woundPenaltyText`.
 */
export const WOUND_PENALTY_DATA: Record<number, WoundPenalty> = {
  0: { ref: 0, ma: 0 },
  1: { ref: 0, ma: 0 },
  2: { ref: -2, ma: -2 },
  3: { ref: -2, ma: -2 },
  4: { ref: -4, ma: -4, note: 'consciência 50%' },
  5: { ref: -4, ma: -4 },
  6: { ref: -5, ma: -5 },
  7: { ref: -5, ma: -5 },
  8: { ref: -6, ma: -6, note: 'morte provável' },
  9: { ref: -6, ma: -6 },
  10: { ref: -6, ma: -6, note: 'Morte iminente' }
};

/** Penalidade estruturada de um nível (fora do intervalo → sem penalidade). */
export function woundPenalties(level: number): WoundPenalty {
  return WOUND_PENALTY_DATA[clampWoundLevel(level)] ?? { ref: 0, ma: 0 };
}

/**
 * Texto de penalidade exibido no Bio-Monitor (mesma saída da tabela legada
 * do HealthTracker): "REF −2, MA −2" (+ nota quando existir); "—" para os
 * níveis sem penalidade; "Morte iminente" no nível 10.
 */
export function woundPenaltyText(level: number): string {
  if (level >= WOUND_MAX) return 'Morte iminente';
  const p = woundPenalties(level);
  if (p.ref === 0 && p.ma === 0) return '—';
  const fmt = (n: number): string => (n < 0 ? `−${Math.abs(n)}` : String(n));
  const parts = [`REF ${fmt(p.ref)}`, `MA ${fmt(p.ma)}`];
  if (p.note) parts.push(p.note);
  return parts.join(', ');
}
