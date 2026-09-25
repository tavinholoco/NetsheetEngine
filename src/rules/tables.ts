// ============================================================
// NETSHEET ENGINE — TABELAS DO LIVRO (Fase C)
// ============================================================
// As regras do Cyberpunk 2020 como DADO, sem lógica. É o oráculo da Fase C:
// os testes de regra derivam destas tabelas, não da implementação — assim um
// teste nunca é reescrito para concordar com um código errado (foi o que
// aconteceu com os 32 testes de `derived-stats`, que codificavam o BTM errado).
//
// A fonte de cada linha, e o quanto confiar nela, está em
// docs/CONFERENCIA_CP2020.md. Mudou uma tabela aqui, muda lá no mesmo commit.
// ============================================================

import type { ArmorLocation, StatName } from '../types/cyberpunk';

// ------------------------------------------------------------
// Dados (resolução de ações)
// ------------------------------------------------------------

/** Face que explode: rola de novo e soma, encadeando. */
export const CRITICAL_FACE = 10;

/** Face de fumble no PRIMEIRO dado: falha automática + 1d10 na tabela de fumble. */
export const FUMBLE_FACE = 1;

/**
 * Teto de dados extras numa explosão encadeada. O livro não tem teto; este é
 * de segurança, contra um RNG defeituoso (ou um RNG de teste) que devolva 10
 * para sempre. Onze 10 seguidos têm probabilidade 10⁻¹¹ — o teto nunca muda
 * uma rolagem real.
 */
export const MAX_EXPLOSION_DICE = 10;

// ------------------------------------------------------------
// Tipo corporal (BTM) — só BODY, sinal negativo
// ------------------------------------------------------------

export interface BodyTypeRow {
  minBody: number;
  maxBody: number;
  bodyType: string;
  btm: number;
}

export const BODY_TYPE_TABLE: readonly BodyTypeRow[] = [
  { minBody: 2, maxBody: 2, bodyType: 'Muito fraco', btm: 0 },
  { minBody: 3, maxBody: 4, bodyType: 'Fraco', btm: -1 },
  { minBody: 5, maxBody: 7, bodyType: 'Médio', btm: -2 },
  { minBody: 8, maxBody: 9, bodyType: 'Forte', btm: -3 },
  { minBody: 10, maxBody: 10, bodyType: 'Muito forte', btm: -4 },
  { minBody: 11, maxBody: Number.POSITIVE_INFINITY, bodyType: 'Sobre-humano', btm: -5 }
];

// ------------------------------------------------------------
// Trilha de ferimento — woundLevel 0 (ileso) e 1..10 (as 10 caixas)
// ------------------------------------------------------------

/** Efeito de um nível de ferimento nos atributos. Não acumula entre níveis. */
export type WoundEffect =
  | { kind: 'none' }
  /** Sério: subtrai um valor fixo. */
  | { kind: 'subtract'; stats: readonly StatName[]; amount: number }
  /** Crítico e Mortal: divide, arredondando para cima. */
  | { kind: 'divide'; stats: readonly StatName[]; divisor: number };

export interface WoundLevelRow {
  level: number;
  name: string;
  /** Somado ao BODY no stun save (0 a −9). */
  stunModifier: number;
  /** Nível Mortal (0–6) — o death save é BODY menos ele. `null` fora do Mortal. */
  mortalLevel: number | null;
  effect: WoundEffect;
}

const NONE: WoundEffect = { kind: 'none' };
const SERIOUS: WoundEffect = { kind: 'subtract', stats: ['REF'], amount: 2 };
const CRITICAL: WoundEffect = { kind: 'divide', stats: ['REF', 'INT', 'COOL'], divisor: 2 };
const MORTAL: WoundEffect = { kind: 'divide', stats: ['REF', 'INT', 'COOL'], divisor: 3 };

export const WOUND_TRACK: readonly WoundLevelRow[] = [
  { level: 0, name: 'Ileso', stunModifier: 0, mortalLevel: null, effect: NONE },
  { level: 1, name: 'Leve', stunModifier: 0, mortalLevel: null, effect: NONE },
  { level: 2, name: 'Sério', stunModifier: -1, mortalLevel: null, effect: SERIOUS },
  { level: 3, name: 'Crítico', stunModifier: -2, mortalLevel: null, effect: CRITICAL },
  { level: 4, name: 'Mortal 0', stunModifier: -3, mortalLevel: 0, effect: MORTAL },
  { level: 5, name: 'Mortal 1', stunModifier: -4, mortalLevel: 1, effect: MORTAL },
  { level: 6, name: 'Mortal 2', stunModifier: -5, mortalLevel: 2, effect: MORTAL },
  { level: 7, name: 'Mortal 3', stunModifier: -6, mortalLevel: 3, effect: MORTAL },
  { level: 8, name: 'Mortal 4', stunModifier: -7, mortalLevel: 4, effect: MORTAL },
  { level: 9, name: 'Mortal 5', stunModifier: -8, mortalLevel: 5, effect: MORTAL },
  { level: 10, name: 'Mortal 6', stunModifier: -9, mortalLevel: 6, effect: MORTAL }
];

/** Pontos de dano por caixa da trilha (para a Fase D: 4 pontos = 1 nível). */
export const DAMAGE_POINTS_PER_WOUND_LEVEL = 4;

// ------------------------------------------------------------
// Humanidade
// ------------------------------------------------------------

/** Humanidade = EMP × este fator. */
export const HUMANITY_PER_EMP = 10;

/** A cada tantos pontos de Humanidade perdidos, −1 EMP. */
export const HUMANITY_LOSS_PER_EMP_POINT = 10;

// ------------------------------------------------------------
// Local de impacto (1d10)
// ------------------------------------------------------------

export interface HitLocationRow {
  faces: readonly number[];
  location: ArmorLocation;
  name: string;
  /** Rótulo das faces como o livro imprime (o 10 aparece como 0). */
  facesLabel: string;
  damageMultiplier: number;
}

export const HIT_LOCATIONS: readonly HitLocationRow[] = [
  { faces: [1], location: 'Head', name: 'Cabeça', facesLabel: '1', damageMultiplier: 2 },
  { faces: [2, 3, 4], location: 'Torso', name: 'Tronco', facesLabel: '2-4', damageMultiplier: 1 },
  { faces: [5], location: 'Right Arm', name: 'Braço Direito', facesLabel: '5', damageMultiplier: 1 },
  { faces: [6], location: 'Left Arm', name: 'Braço Esquerdo', facesLabel: '6', damageMultiplier: 1 },
  { faces: [7, 8], location: 'Right Leg', name: 'Perna Direita', facesLabel: '7-8', damageMultiplier: 1 },
  { faces: [9, 10], location: 'Left Leg', name: 'Perna Esquerda', facesLabel: '9-0', damageMultiplier: 1 }
];

// ------------------------------------------------------------
// Perícia de arma por tipo
// ------------------------------------------------------------

export interface WeaponSkillRow {
  /** Palavras que identificam o tipo (comparadas sem caixa nem pontuação). */
  keywords: readonly string[];
  skill: string;
  /** true quando o livro não diz e a linha é inferência (ver a conferência). */
  inferred?: boolean;
}

/**
 * Ordem importa: a primeira linha que casar vence. "Submachinegun" vem antes
 * de qualquer coisa com "gun", e "Shotgun" antes de "Rifle".
 */
export const WEAPON_SKILL_BY_TYPE: readonly WeaponSkillRow[] = [
  { keywords: ['submachinegun', 'smg'], skill: 'Submachinegun' },
  { keywords: ['pistol', 'handgun', 'autopistol', 'revolver'], skill: 'Handgun' },
  { keywords: ['shotgun', 'shg', 'sht'], skill: 'Rifle', inferred: true },
  { keywords: ['rifle', 'rif'], skill: 'Rifle' },
  { keywords: ['heavy', 'hvy'], skill: 'Heavy Weapons' },
  { keywords: ['bow', 'archery'], skill: 'Archery' },
  { keywords: ['melee', 'mel', 'knife', 'sword', 'blade'], skill: 'Melee' }
];

// ------------------------------------------------------------
// Habilidades especiais
// ------------------------------------------------------------

/**
 * Combat Sense não se rola sozinha: soma nesta perícia (e na iniciativa, que
 * é da Fase D). Rolar "Combat Sense" é rolar Awareness/Notice com o bônus.
 */
export const COMBAT_SENSE_ADDS_TO_SKILL = 'Awareness/Notice';
