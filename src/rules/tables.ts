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

/** Pontos de dano por nível da trilha: cada nível tem 4 caixas de 1 ponto. */
export const DAMAGE_POINTS_PER_WOUND_LEVEL = 4;

/**
 * A trilha inteira: 10 níveis × 4 = 40 pontos. Dano além disso mata (D.1).
 * Os pontos 1–4 são Leve, 5–8 Sério, e assim por diante: 6 pontos é Sério com
 * 2 das 4 caixas marcadas — o que o `woundLevel` sozinho não guardava.
 */
export const WOUND_TRACK_POINTS = (WOUND_TRACK.length - 1) * DAMAGE_POINTS_PER_WOUND_LEVEL;

/**
 * Ferimento grave num acerto só (D.1): MAIS de 8 pontos, depois de todos os
 * modificadores (armadura, BTM e o ×2 da cabeça). Num membro, decepa ou
 * inutiliza; na cabeça, morte instantânea. Fontes S5 e S9 na conferência.
 */
export const SEVERE_HIT_THRESHOLD = 8;

/** Dano mínimo que passa do BTM quando o acerto furou a armadura (S5, S9). */
export const MIN_DAMAGE_AFTER_BTM = 1;

// ------------------------------------------------------------
// Humanidade
// ------------------------------------------------------------

/** Humanidade = EMP × este fator. */
export const HUMANITY_PER_EMP = 10;

/** A cada tantos pontos de Humanidade perdidos, −1 EMP. */
export const HUMANITY_LOSS_PER_EMP_POINT = 10;

// ------------------------------------------------------------
// Carga (K.2) — o que o corpo leva e levanta
// ------------------------------------------------------------

/** Carry: quanto o personagem carrega, em kg, por ponto de BODY (S1, S6, S8). */
export const CARRY_KG_PER_BODY = 10;

/**
 * Lift: o peso morto que levanta, em kg, por ponto de BODY (S1, S6, S8). Nenhuma
 * fonte penaliza o peso carregado — o S6 diz que o livro em geral não o conta
 * (decisão 13: sem pena por peso).
 */
export const LIFT_KG_PER_BODY = 40;

// ------------------------------------------------------------
// Camadas de armadura (K.2) — a tabela proporcional
// ------------------------------------------------------------

export interface ArmorLayerRow {
  /** Diferença entre os dois SP, a partir da qual a linha vale. */
  minDiff: number;
  /** Bônus somado ao MAIOR dos dois SP. */
  bonus: number;
}

/**
 * Duas camadas no mesmo local não somam: vale o maior SP, mais um bônus pela
 * diferença entre eles — camadas parecidas protegem mais. Da maior diferença
 * para a menor. Três ou mais camadas combinam em pares, de dentro para fora.
 * p. 99 pelo S9; o karridian dá os mesmos degraus (errata do livro, entrada na
 * 2.01); o S6 confirma o mecanismo e o teto de +5.
 */
export const ARMOR_LAYER_BONUS: readonly ArmorLayerRow[] = [
  { minDiff: 27, bonus: 0 },
  { minDiff: 21, bonus: 1 },
  { minDiff: 15, bonus: 2 },
  { minDiff: 9, bonus: 3 },
  { minDiff: 5, bonus: 4 },
  { minDiff: 0, bonus: 5 }
];

// ------------------------------------------------------------
// Netrunner (K.5, decisão 9) — o deck e os programas, sem a Net
// ------------------------------------------------------------

/**
 * O deck como sai da loja: um módulo de 10 MU, Speed 0 e Data Wall 2 (S6, S12,
 * S13). O Code Gate 0 só o S13 dá — é o "não tem", e o campo existe no S1.
 */
export const DECK_BASE = { mu: 10, speed: 0, dataWall: 2, codeGate: 0 } as const;

/**
 * O preço de cada melhoria, em eb (S12, S13): o segundo módulo de memória (mais
 * 10 MU), cada ponto de Speed acima de 0 e cada ponto de Data Wall acima do
 * padrão. O teto das melhorias diverge — Speed até 5 e Data Wall até 10 no S12,
 * nenhum no S6 —, e fica aberto na conferência.
 */
export const DECK_UPGRADE_EB = { extraMemory: 5000, speedPerPoint: 2000, dataWallPerPoint: 1000 } as const;

/** O que o segundo módulo de memória soma (S12, S13). */
export const DECK_EXTRA_MEMORY_MU = 10;

export type DeckChassisId = 'standard' | 'standard_used' | 'portable' | 'cellular' | 'cyberlimb' | 'cyberlimb_cellular' | 'combat';

export interface DeckChassisRow {
  id: DeckChassisId;
  name: string;
  /** O preço do deck padrão daquele tipo, antes das melhorias. */
  costEb: number;
}

/**
 * Os tipos de deck e o preço de cada um (S8, que cita o livro básico, p. 133–134
 * e p. 90–91; S13). O S1 tem os mesmos tipos, sem preço; o S6 confirma o celular.
 * O embutido no cyberlimb custa 1 de Humanidade e exige o cyberlimb (S8) — é um
 * implante a lançar no cromo, como qualquer outro.
 */
export const DECK_CHASSIS: readonly DeckChassisRow[] = [
  { id: 'standard', name: 'Padrão (cybermodem)', costEb: 1000 },
  { id: 'standard_used', name: 'Padrão, usado', costEb: 500 },
  { id: 'portable', name: 'Portátil', costEb: 2000 },
  { id: 'cellular', name: 'Celular', costEb: 4000 },
  { id: 'cyberlimb', name: 'Embutido no cyberlimb', costEb: 3000 },
  { id: 'cyberlimb_cellular', name: 'Embutido no cyberlimb, celular', costEb: 5000 },
  { id: 'combat', name: 'De combate', costEb: 3000 }
];

export type ProgramClassId =
  | 'intrusion'
  | 'decryption'
  | 'detection'
  | 'antiSystem'
  | 'evasion'
  | 'protection'
  | 'antiIc'
  | 'antiPersonnel'
  | 'controller'
  | 'utility'
  | 'demon'
  | 'other';

export interface ProgramClassRow {
  id: ProgramClassId;
  /** O nome do livro, em inglês, como o das perícias. */
  name: string;
}

/**
 * As onze classes de programa do livro básico (S6, S14) e "Outra", para o
 * programa de suplemento (o S1 também tem a sua). O S14 e o Brainware Blowout
 * chamam a Anti-IC de "Anti-Program"; o S6 dá a Demon dentro de "Compiler".
 */
export const PROGRAM_CLASSES: readonly ProgramClassRow[] = [
  { id: 'intrusion', name: 'Intrusion' },
  { id: 'decryption', name: 'Decryption' },
  { id: 'detection', name: 'Detection/Alarm' },
  { id: 'antiSystem', name: 'Anti-System' },
  { id: 'evasion', name: 'Evasion/Stealth' },
  { id: 'protection', name: 'Protection' },
  { id: 'antiIc', name: 'Anti-IC' },
  { id: 'antiPersonnel', name: 'Anti-Personnel' },
  { id: 'controller', name: 'Controller' },
  { id: 'utility', name: 'Utility' },
  { id: 'demon', name: 'Demon' },
  { id: 'other', name: 'Outra' }
];

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
  /** Membro: acerto grave decepa (D.1). A cabeça tem regra própria (morte). */
  limb: boolean;
}

export const HIT_LOCATIONS: readonly HitLocationRow[] = [
  { faces: [1], location: 'Head', name: 'Cabeça', facesLabel: '1', damageMultiplier: 2, limb: false },
  { faces: [2, 3, 4], location: 'Torso', name: 'Tronco', facesLabel: '2-4', damageMultiplier: 1, limb: false },
  { faces: [5], location: 'Right Arm', name: 'Braço Direito', facesLabel: '5', damageMultiplier: 1, limb: true },
  { faces: [6], location: 'Left Arm', name: 'Braço Esquerdo', facesLabel: '6', damageMultiplier: 1, limb: true },
  { faces: [7, 8], location: 'Right Leg', name: 'Perna Direita', facesLabel: '7-8', damageMultiplier: 1, limb: true },
  { faces: [9, 10], location: 'Left Leg', name: 'Perna Esquerda', facesLabel: '9-0', damageMultiplier: 1, limb: true }
];

// ------------------------------------------------------------
// Dificuldade por alcance (D.3) — p. 99
// ------------------------------------------------------------

export type RangeBandKey = 'pointBlank' | 'close' | 'medium' | 'long' | 'extreme';

export interface RangeBandRow {
  key: RangeBandKey;
  name: string;
  /** Número que o ataque precisa igualar ou superar (S8, S9). */
  difficulty: number;
  /** Até que fração do alcance da arma vai a faixa; `null` = até 1 m. */
  ofWeaponRange: number | null;
}

/** Fontes S1, S8 e S9 (esta cita a p. 99); o queima-roupa, S8 e S9. */
export const RANGE_BANDS: readonly RangeBandRow[] = [
  { key: 'pointBlank', name: 'Queima-roupa', difficulty: 10, ofWeaponRange: null },
  { key: 'close', name: 'Curta', difficulty: 15, ofWeaponRange: 1 / 4 },
  { key: 'medium', name: 'Média', difficulty: 20, ofWeaponRange: 1 / 2 },
  { key: 'long', name: 'Longa', difficulty: 25, ofWeaponRange: 1 },
  { key: 'extreme', name: 'Extrema', difficulty: 30, ofWeaponRange: 2 }
];

// ------------------------------------------------------------
// Perícia de arma por tipo
// ------------------------------------------------------------

export interface WeaponSkillRow {
  /** Palavras que identificam o tipo (comparadas sem caixa nem pontuação). */
  keywords: readonly string[];
  skill: string;
}

/**
 * Ordem importa: a primeira linha que casar vence. "Submachinegun" vem antes
 * de qualquer coisa com "gun", e "Shotgun" antes de "Rifle".
 *
 * Escopeta usa Rifle: não existe perícia de escopeta no 2020, e o capítulo de
 * armas manda usar Rifle (confirmado em 26/09/2026 — ver a conferência).
 */
export const WEAPON_SKILL_BY_TYPE: readonly WeaponSkillRow[] = [
  { keywords: ['submachinegun', 'smg'], skill: 'Submachinegun' },
  { keywords: ['pistol', 'handgun', 'autopistol', 'revolver'], skill: 'Handgun' },
  { keywords: ['shotgun', 'shg', 'sht'], skill: 'Rifle' },
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
