// ============================================================
// NETSHEET ENGINE — DO DANO AO FERIMENTO (Fase D, D.1)
// ============================================================
// O pipeline de dano do livro, na ordem da decisão 6:
//   dano bruto − SP da localização → BTM (mínimo 1) → ×2 na cabeça
// e a trilha de ferimento em PONTOS (decisão 7b): 40 caixas de 1 ponto, o
// nível (0–10) derivado delas. Antes da Fase D a ficha guardava só o nível, e
// o resto de uma caixa parcialmente marcada se perdia.
//
// Sem estado e sem rede: o servidor aplica (roomManager.applyDamage), o
// cliente só mostra. O desenho está em docs/ARQUITETURA.md (pipeline de dano).
// ============================================================

import type { ArmorLocation, ArmorPiece, CharacterSheet } from '../types/cyberpunk';
import {
  DAMAGE_POINTS_PER_WOUND_LEVEL,
  HIT_LOCATIONS,
  MIN_DAMAGE_AFTER_BTM,
  SEVERE_HIT_THRESHOLD,
  WOUND_TRACK,
  WOUND_TRACK_POINTS,
  type HitLocationRow
} from './tables';

const MAX_LEVEL = WOUND_TRACK.length - 1;

/** Linha da tabela de local de impacto para uma localização. */
export function hitLocationRow(location: ArmorLocation): HitLocationRow {
  return HIT_LOCATIONS.find((row) => row.location === location) ?? HIT_LOCATIONS[1];
}

/** Localização válida? (entrada de rede passa por aqui antes de virar `ArmorLocation`). */
export function isArmorLocation(value: unknown): value is ArmorLocation {
  return HIT_LOCATIONS.some((row) => row.location === value);
}

/**
 * SP da peça EQUIPADA que cobre a localização; 0 sem proteção. A armadura é
 * modelada uma peça por localização (o empilhamento é da Fase K).
 */
export function armorSpAt(armor: readonly ArmorPiece[] | undefined, location: ArmorLocation): number {
  return (armor ?? []).find((a) => a.location === location && a.equipped)?.sp ?? 0;
}

// ------------------------------------------------------------
// O acerto: bruto → armadura → BTM → multiplicador do local
// ------------------------------------------------------------

export interface HitInput {
  /** Dano bruto da arma. */
  raw: number;
  /** SP na localização atingida. */
  sp: number;
  /** BTM do alvo (0 a −5, como na tabela). */
  btm: number;
  location: ArmorLocation;
}

/** Cada etapa do pipeline, para o chat mostrar a conta inteira. */
export interface HitSteps extends HitInput {
  afterArmor: number;
  penetrated: boolean;
  afterBtm: number;
  multiplier: number;
  /** Pontos que entram na trilha. */
  final: number;
}

export function resolveHit({ raw, sp, btm, location }: HitInput): HitSteps {
  const afterArmor = Math.max(0, raw - sp);
  const penetrated = afterArmor > 0;
  // O BTM só entra no que passou da armadura, e nunca zera o dano (S5, S9).
  const afterBtm = penetrated ? Math.max(MIN_DAMAGE_AFTER_BTM, afterArmor + btm) : 0;
  const multiplier = hitLocationRow(location).damageMultiplier;
  return { raw, sp, btm, location, afterArmor, penetrated, afterBtm, multiplier, final: afterBtm * multiplier };
}

// ------------------------------------------------------------
// A trilha em pontos
// ------------------------------------------------------------

/** Nível (0–10) da caixa em que o último ponto caiu. */
export function woundLevelFromPoints(points: number): number {
  const p = Math.max(0, Math.min(WOUND_TRACK_POINTS, Math.floor(Number(points) || 0)));
  return Math.ceil(p / DAMAGE_POINTS_PER_WOUND_LEVEL);
}

/**
 * Ficha de antes da Fase D só tem o nível: converte para o MÍNIMO da caixa
 * (primeiro ponto dela). Não inventa dano que o jogador não marcou.
 */
export function pointsFromWoundLevel(level: number): number {
  const l = Math.max(0, Math.min(MAX_LEVEL, Math.round(Number(level) || 0)));
  return l === 0 ? 0 : DAMAGE_POINTS_PER_WOUND_LEVEL * (l - 1) + 1;
}

export interface WoundState {
  damagePoints: number;
  woundLevel: number;
  isDead: boolean;
}

/** Estado de ferimento da ficha: os pontos mandam; sem eles, deriva do nível. */
export function woundStateOf(sheet: Partial<Pick<CharacterSheet, 'damagePoints' | 'woundLevel' | 'isDead'>>): WoundState {
  const raw = Number(sheet.damagePoints);
  const damagePoints = Number.isFinite(raw) && sheet.damagePoints !== undefined && sheet.damagePoints !== null
    ? Math.max(0, Math.min(WOUND_TRACK_POINTS, Math.floor(raw)))
    : pointsFromWoundLevel(Number(sheet.woundLevel) || 0);
  return { damagePoints, woundLevel: woundLevelFromPoints(damagePoints), isDead: sheet.isDead === true };
}

/** Estado a partir de um total de pontos (o que o GM ou o jogador marca na trilha). */
export function woundStateFromPoints(points: number, isDead = false): WoundState {
  const damagePoints = Math.max(0, Math.min(WOUND_TRACK_POINTS, Math.floor(Number(points) || 0)));
  return { damagePoints, woundLevel: woundLevelFromPoints(damagePoints), isDead };
}

export interface HitOutcome {
  steps: HitSteps;
  before: WoundState;
  after: WoundState;
  /** Membro com mais de 8 pontos num acerto: decepado ou inutilizado. */
  limbLost: boolean;
  /** O que matou NESTE acerto: a cabeça (> 8) ou a trilha estourada. */
  killed: 'head' | 'track' | null;
}

/** Aplica um acerto já resolvido na trilha. Morto continua morto. */
export function applyHit(before: WoundState, steps: HitSteps, location: ArmorLocation): HitOutcome {
  const row = hitLocationRow(location);
  const severe = steps.final > SEVERE_HIT_THRESHOLD;
  const total = before.damagePoints + steps.final;
  const killed = before.isDead ? null : severe && location === 'Head' ? 'head' : total > WOUND_TRACK_POINTS ? 'track' : null;
  return {
    steps,
    before,
    after: woundStateFromPoints(total, before.isDead || killed !== null),
    limbLost: severe && row.limb,
    killed
  };
}
