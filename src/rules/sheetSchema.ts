/**
 * ============================================================
 * NETSHEET ENGINE — VALIDAÇÃO DE FICHA NO LIMITE DO SERVIDOR
 * (Fase B, B.2 — SEC-05)
 * ============================================================
 * Antes desta fase o servidor gravava a ficha **verbatim**: qualquer objeto
 * que passasse por `typeof === "object"` virava estado da mesa, era
 * persistido no Supabase e transmitido a todos os jogadores.
 *
 * Isso anulava por outro caminho a garantia da T5.4 (rolagem autoritativa no
 * servidor): não adianta o servidor rolar `1d10 + REF` com `crypto.randomInt`
 * se o REF que ele soma veio do navegador sem conferência. O jogador não
 * precisa forjar a rolagem — basta forjar a ficha.
 *
 * PRIMEIRO ARQUIVO DE `src/rules/`
 * A Fase C transforma este diretório na fonte única de regras: funções puras,
 * RNG injetado, sem DOM e sem rede. Este módulo já nasce nesse contrato, e a
 * Fase K o reaproveita no import de ficha (K.1) — um arquivo JSON vindo de
 * disco é tão não confiável quanto um corpo de requisição.
 *
 * POR QUE SANEAR EM VEZ DE REJEITAR
 * Rejeitar a ficha inteira por causa de um campo estranho quebraria a mesa por
 * um detalhe: o jogador perderia a sincronia sem saber por quê. Então:
 *  - número fora da faixa é **grampeado** (o trapaceiro chega no teto, não no
 *    infinito, e o valor continua jogável);
 *  - campo desconhecido é **descartado** (não vira estado nem payload);
 *  - item estruturalmente inválido é **removido** (uma perícia com atributo
 *    inexistente quebraria o motor de regras adiante);
 *  - só entrada impossível de interpretar é rejeitada de fato.
 *
 * Toda alteração é registrada em `changed`, para o servidor poder logar. Ficha
 * que precisa de correção a cada sync é sinal — de bug no cliente ou de alguém
 * testando os limites.
 */

import type {
  ArmorLocation,
  ArmorPiece,
  CharacterCreation,
  CharacterSheet,
  CharacterStats,
  Cyberdeck,
  CyberwareItem,
  GearItem,
  NetProgram,
  Lifepath,
  SkillItem,
  StatName,
  WeaponItem
} from '../types/cyberpunk';
import { STAT_NAMES, deriveCurrentStats } from './character';
import { woundStateFromPoints, woundStateOf, type WoundState } from './damage';
import {
  DECK_BASE,
  DECK_CHASSIS,
  PROGRAM_CLASSES,
  STARTING_FUNDS_DIE,
  STAT_POOL_DICE,
  STAT_POOL_MAX,
  WOUND_TRACK_POINTS
} from './tables';

// --- Limites -----------------------------------------------------------------
// Atributo: 2–10 na criação, até 15 com cromo (ver CharacterStats). O teto é
// permissivo de propósito — cabe ao motor de regras decidir o que é legal na
// criação; aqui só barramos o absurdo.
export const STAT_MIN = 2;
export const STAT_MAX = 15;
export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 10;
export const WOUND_LEVEL_MIN = 0;
export const WOUND_LEVEL_MAX = 10;

// Tetos de coleção. Generosos para jogo real, e o suficiente para impedir que
// um array de 100 mil itens seja persistido e transmitido a todos da mesa —
// que é o mesmo vetor de negação de serviço do SEC-04, por outra porta.
export const MAX_SKILLS = 200;
export const MAX_CYBERWARE = 100;
export const MAX_WEAPONS = 100;
export const MAX_ARMOR = 50;
export const MAX_LIFE_EVENTS = 100;
export const MAX_GEAR = 200;
/**
 * Teto do bônus de atributo de UM implante (K.2e). Não é regra do livro — o
 * Lace dá +2, e os suplementos chegam a +3 —; é o grampo do absurdo, como o
 * STAT_MAX.
 */
export const CYBER_STAT_BONUS_MAX = 5;
/** Peso de uma unidade de item, em kg (K.2d). */
export const GEAR_WEIGHT_MAX_KG = 1000;
export const GEAR_QTY_MAX = 999;
/**
 * O deck e os programas (K.5b). O teto das melhorias não é regra — a wiki dá
 * Speed até 5 e Data Wall até 10, o S6 diz que o livro não tem teto (aberto na
 * conferência) —; são os grampos do absurdo, folgados acima dos dois.
 */
export const MAX_PROGRAMS = 100;
export const DECK_SPEED_MAX = 10;
export const DECK_DATA_WALL_MAX = 40;
export const DECK_CODE_GATE_MAX = 40;
export const PROGRAM_STRENGTH_MAX = 20;
/** A MU de um programa vai de 1 a 6 no livro (S6); o grampo deixa o suplemento passar. */
export const PROGRAM_MU_MAX = 20;
/**
 * O registro da criação (K.6b): as nove perícias do pacote, e os pontos gastos
 * com folga — dez perícias de 10 dão 100. Grampos do absurdo, não o orçamento:
 * passar do orçamento fica à vista do GM (K.6c), não barrado aqui.
 */
export const MAX_CAREER_SKILLS = 10;
export const CREATION_POINTS_MAX = 100;
const CREATION_METHODS: readonly CharacterCreation['method'][] = ['roll9d10', 'gmPool'];
const DECK_CHASSIS_IDS = DECK_CHASSIS.map((c) => c.id);
const PROGRAM_CLASS_IDS = PROGRAM_CLASSES.map((c) => c.id);

// Tetos de texto. Um `handle` de 10 MB seria transmitido para todos a cada
// broadcast. O texto longo legítimo é o `gearNotes`.
const MAX_NAME_CHARS = 120;
const MAX_URL_CHARS = 2048;
const MAX_NOTES_CHARS = 5000;

const ARMOR_LOCATIONS: readonly ArmorLocation[] = ['Head', 'Torso', 'Right Arm', 'Left Arm', 'Right Leg', 'Left Leg'];

export interface SheetValidationResult {
  /** Ficha saneada — segura para virar estado, persistir e transmitir. */
  sheet: CharacterSheet;
  /** Caminhos alterados (`stats.BODY`, `skills[3].level`, `skills` …). */
  changed: string[];
}

// --- Primitivos --------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Inteiro grampeado. Não-número vira `fallback` (nunca NaN adiante). */
function clampInt(value: unknown, min: number, max: number, fallback: number, path: string, changed: string[]): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    if (value !== undefined) changed.push(path);
    return fallback;
  }
  const rounded = Math.round(n);
  const clamped = Math.min(max, Math.max(min, rounded));
  if (clamped !== n) changed.push(path);
  return clamped;
}

/** Número com até duas casas, grampeado — o peso aceita fração (0,5 kg). */
function clampDecimal(value: unknown, min: number, max: number, fallback: number, path: string, changed: string[]): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    if (value !== undefined) changed.push(path);
    return fallback;
  }
  const rounded = Math.round(n * 100) / 100;
  const clamped = Math.min(max, Math.max(min, rounded));
  if (clamped !== n) changed.push(path);
  return clamped;
}

function safeString(value: unknown, maxChars: number, path: string, changed: string[], fallback = ''): string {
  if (typeof value !== 'string') {
    if (value !== undefined) changed.push(path);
    return fallback;
  }
  if (value.length > maxChars) {
    changed.push(path);
    return value.slice(0, maxChars);
  }
  return value;
}

function safeBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** Array com teto. Não-array vira `[]`; excedente é cortado. */
function safeArray(value: unknown, max: number, path: string, changed: string[]): unknown[] {
  if (!Array.isArray(value)) {
    if (value !== undefined) changed.push(path);
    return [];
  }
  if (value.length > max) {
    changed.push(path);
    return value.slice(0, max);
  }
  return value;
}

// --- Blocos ------------------------------------------------------------------

function sanitizeStats(value: unknown, path: string, changed: string[]): CharacterStats {
  const src = isPlainObject(value) ? value : {};
  if (!isPlainObject(value) && value !== undefined) changed.push(path);
  const out = {} as CharacterStats;
  for (const name of STAT_NAMES) {
    out[name] = clampInt(src[name], STAT_MIN, STAT_MAX, STAT_MIN, `${path}.${name}`, changed);
  }
  return out;
}

function sanitizeSkills(value: unknown, changed: string[]): SkillItem[] {
  const raw = safeArray(value, MAX_SKILLS, 'skills', changed);
  const out: SkillItem[] = [];
  raw.forEach((item, i) => {
    if (!isPlainObject(item)) {
      changed.push(`skills[${i}]`);
      return;
    }
    // Perícia sem atributo válido quebraria a rolagem adiante — some.
    if (!STAT_NAMES.includes(item.stat as StatName)) {
      changed.push(`skills[${i}].stat`);
      return;
    }
    out.push({
      id: safeString(item.id, MAX_NAME_CHARS, `skills[${i}].id`, changed),
      name: safeString(item.name, MAX_NAME_CHARS, `skills[${i}].name`, changed),
      stat: item.stat as StatName,
      level: clampInt(item.level, SKILL_LEVEL_MIN, SKILL_LEVEL_MAX, 0, `skills[${i}].level`, changed),
      ...(item.isSpecialAbility !== undefined ? { isSpecialAbility: safeBool(item.isSpecialAbility) } : {})
    });
  });
  return out;
}

/** K.2e — o bônus de atributo do implante: atributo que existe, valor grampeado. */
function sanitizeStatBonus(value: unknown, path: string, changed: string[]): CyberwareItem['statBonus'] {
  if (value === undefined) return undefined;
  if (!isPlainObject(value) || !STAT_NAMES.includes(value.stat as StatName)) {
    changed.push(path);
    return undefined;
  }
  const amount = clampInt(value.amount, -CYBER_STAT_BONUS_MAX, CYBER_STAT_BONUS_MAX, 0, `${path}.amount`, changed);
  return { stat: value.stat as StatName, amount };
}

function sanitizeCyberware(value: unknown, changed: string[]): CyberwareItem[] {
  const raw = safeArray(value, MAX_CYBERWARE, 'cyberware', changed);
  const out: CyberwareItem[] = [];
  raw.forEach((item, i) => {
    if (!isPlainObject(item)) {
      changed.push(`cyberware[${i}]`);
      return;
    }
    out.push({
      id: safeString(item.id, MAX_NAME_CHARS, `cyberware[${i}].id`, changed),
      name: safeString(item.name, MAX_NAME_CHARS, `cyberware[${i}].name`, changed),
      category: safeString(item.category, MAX_NAME_CHARS, `cyberware[${i}].category`, changed),
      costEb: clampInt(item.costEb, 0, 10_000_000, 0, `cyberware[${i}].costEb`, changed),
      humanityLoss: safeString(item.humanityLoss, MAX_NAME_CHARS, `cyberware[${i}].humanityLoss`, changed),
      actualHL: clampInt(item.actualHL, 0, 100, 0, `cyberware[${i}].actualHL`, changed),
      installed: safeBool(item.installed),
      ...(item.notes !== undefined ? { notes: safeString(item.notes, MAX_NOTES_CHARS, `cyberware[${i}].notes`, changed) } : {})
    });
    const statBonus = sanitizeStatBonus(item.statBonus, `cyberware[${i}].statBonus`, changed);
    if (statBonus) out[out.length - 1].statBonus = statBonus;
  });
  return out;
}

function sanitizeWeapons(value: unknown, changed: string[]): WeaponItem[] {
  const raw = safeArray(value, MAX_WEAPONS, 'weapons', changed);
  const out: WeaponItem[] = [];
  raw.forEach((item, i) => {
    if (!isPlainObject(item)) {
      changed.push(`weapons[${i}]`);
      return;
    }
    out.push({
      id: safeString(item.id, MAX_NAME_CHARS, `weapons[${i}].id`, changed),
      name: safeString(item.name, MAX_NAME_CHARS, `weapons[${i}].name`, changed),
      type: safeString(item.type, MAX_NAME_CHARS, `weapons[${i}].type`, changed),
      // WA vai de -5 a +5 no livro; a faixa aqui é folgada de propósito.
      wa: clampInt(item.wa, -10, 10, 0, `weapons[${i}].wa`, changed),
      con: safeString(item.con, MAX_NAME_CHARS, `weapons[${i}].con`, changed),
      avail: safeString(item.avail, MAX_NAME_CHARS, `weapons[${i}].avail`, changed),
      // `damage` é fórmula ("2d6+2") e vira entrada do motor de dados —
      // por isso o teto curto: fórmula legítima é sempre breve.
      damage: safeString(item.damage, 40, `weapons[${i}].damage`, changed),
      shots: clampInt(item.shots, 0, 10_000, 0, `weapons[${i}].shots`, changed),
      currentShots: clampInt(item.currentShots, 0, 10_000, 0, `weapons[${i}].currentShots`, changed),
      rof: clampInt(item.rof, 0, 100, 1, `weapons[${i}].rof`, changed),
      rel: safeString(item.rel, MAX_NAME_CHARS, `weapons[${i}].rel`, changed),
      rangeMeters: clampInt(item.rangeMeters, 0, 100_000, 0, `weapons[${i}].rangeMeters`, changed),
      equipped: safeBool(item.equipped)
    });
  });
  return out;
}

/**
 * K.2b — os locais que a peça cobre, sem repetir e sem local que não existe.
 * A ficha de antes da K.2 trazia um `location` por peça: vira `locations`,
 * sem marcar `changed` — é conversão, não correção (como o `woundLevel` da D).
 */
function sanitizeArmorLocations(item: Record<string, unknown>, path: string, changed: string[]): ArmorLocation[] {
  if (item.locations === undefined && typeof item.location === 'string') {
    if (ARMOR_LOCATIONS.includes(item.location as ArmorLocation)) return [item.location as ArmorLocation];
    changed.push(`${path}.location`);
    return [];
  }
  const raw = Array.isArray(item.locations) ? item.locations : [];
  const out = ARMOR_LOCATIONS.filter((loc) => raw.includes(loc));
  if (!Array.isArray(item.locations) || out.length !== raw.length) changed.push(`${path}.locations`);
  return out;
}

function sanitizeArmor(value: unknown, changed: string[]): ArmorPiece[] {
  const raw = safeArray(value, MAX_ARMOR, 'armor', changed);
  const out: ArmorPiece[] = [];
  raw.forEach((item, i) => {
    if (!isPlainObject(item)) {
      changed.push(`armor[${i}]`);
      return;
    }
    // Peça sem local válido quebraria o pipeline de dano da Fase D — some.
    const locations = sanitizeArmorLocations(item, `armor[${i}]`, changed);
    if (locations.length === 0) {
      if (!changed.some((c) => c.startsWith(`armor[${i}].location`))) changed.push(`armor[${i}].locations`);
      return;
    }
    out.push({
      id: safeString(item.id, MAX_NAME_CHARS, `armor[${i}].id`, changed),
      name: safeString(item.name, MAX_NAME_CHARS, `armor[${i}].name`, changed),
      locations,
      sp: clampInt(item.sp, 0, 100, 0, `armor[${i}].sp`, changed),
      ev: clampInt(item.ev, 0, 20, 0, `armor[${i}].ev`, changed),
      equipped: safeBool(item.equipped)
    });
  });
  return out;
}

/** K.2d — o inventário. Ficha de antes da K.2 não tem: vira lista vazia, sem correção. */
function sanitizeGear(value: unknown, changed: string[]): GearItem[] {
  const raw = safeArray(value, MAX_GEAR, 'gear', changed);
  const out: GearItem[] = [];
  raw.forEach((item, i) => {
    if (!isPlainObject(item)) {
      changed.push(`gear[${i}]`);
      return;
    }
    out.push({
      id: safeString(item.id, MAX_NAME_CHARS, `gear[${i}].id`, changed),
      name: safeString(item.name, MAX_NAME_CHARS, `gear[${i}].name`, changed),
      weightKg: clampDecimal(item.weightKg, 0, GEAR_WEIGHT_MAX_KG, 0, `gear[${i}].weightKg`, changed),
      qty: clampInt(item.qty, 1, GEAR_QTY_MAX, 1, `gear[${i}].qty`, changed)
    });
  });
  return out;
}

/**
 * K.5b — o deck. Ficha sem deck (de antes da K.5, ou de quem não é netrunner)
 * fica sem o campo, sem correção. Tipo que não existe vira o padrão.
 */
function sanitizeDeck(value: unknown, changed: string[]): Cyberdeck | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isPlainObject(value)) {
    changed.push('deck');
    return undefined;
  }
  let chassis = value.chassis as Cyberdeck['chassis'];
  if (!DECK_CHASSIS_IDS.includes(chassis)) {
    changed.push('deck.chassis');
    chassis = 'standard';
  }
  return {
    model: safeString(value.model, MAX_NAME_CHARS, 'deck.model', changed),
    chassis,
    speed: clampInt(value.speed, 0, DECK_SPEED_MAX, DECK_BASE.speed, 'deck.speed', changed),
    dataWall: clampInt(value.dataWall, 0, DECK_DATA_WALL_MAX, DECK_BASE.dataWall, 'deck.dataWall', changed),
    codeGate: clampInt(value.codeGate, 0, DECK_CODE_GATE_MAX, DECK_BASE.codeGate, 'deck.codeGate', changed),
    extraMemory: safeBool(value.extraMemory)
  };
}

/** K.5b — os programas. Classe que não existe vira "Outra": o programa ainda serve. */
function sanitizePrograms(value: unknown, changed: string[]): NetProgram[] {
  const raw = safeArray(value, MAX_PROGRAMS, 'programs', changed);
  const out: NetProgram[] = [];
  raw.forEach((item, i) => {
    if (!isPlainObject(item)) {
      changed.push(`programs[${i}]`);
      return;
    }
    let programClass = item.programClass as NetProgram['programClass'];
    if (!PROGRAM_CLASS_IDS.includes(programClass)) {
      changed.push(`programs[${i}].programClass`);
      programClass = 'other';
    }
    out.push({
      id: safeString(item.id, MAX_NAME_CHARS, `programs[${i}].id`, changed),
      name: safeString(item.name, MAX_NAME_CHARS, `programs[${i}].name`, changed),
      programClass,
      strength: clampInt(item.strength, 0, PROGRAM_STRENGTH_MAX, 0, `programs[${i}].strength`, changed),
      mu: clampInt(item.mu, 0, PROGRAM_MU_MAX, 1, `programs[${i}].mu`, changed),
      costEb: clampInt(item.costEb, 0, 10_000_000, 0, `programs[${i}].costEb`, changed),
      loaded: safeBool(item.loaded, true)
    });
  });
  return out;
}

/**
 * K.6b — o que a criação gastou. Ficha sem registro (de antes da K.6, ou feita à
 * mão) fica sem o campo, sem correção; método que não existe descarta o registro.
 */
function sanitizeCreation(value: unknown, changed: string[]): CharacterCreation | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isPlainObject(value) || !CREATION_METHODS.includes(value.method as CharacterCreation['method'])) {
    changed.push('creation');
    return undefined;
  }
  const dice = safeArray(value.dice, STAT_POOL_DICE, 'creation.dice', changed);
  const careerSkills = safeArray(value.careerSkills, MAX_CAREER_SKILLS, 'creation.careerSkills', changed);
  return {
    method: value.method as CharacterCreation['method'],
    dice: dice.map((d, i) => clampInt(d, 1, 10, 1, `creation.dice[${i}]`, changed)),
    pool: clampInt(value.pool, 0, STAT_POOL_MAX, 0, 'creation.pool', changed),
    stats: sanitizeStats(value.stats, 'creation.stats', changed),
    careerSkills: careerSkills.map((s, i) => safeString(s, MAX_NAME_CHARS, `creation.careerSkills[${i}]`, changed)),
    careerPoints: clampInt(value.careerPoints, 0, CREATION_POINTS_MAX, 0, 'creation.careerPoints', changed),
    pickupPoints: clampInt(value.pickupPoints, 0, CREATION_POINTS_MAX, 0, 'creation.pickupPoints', changed),
    fundsDie:
      value.fundsDie === null || value.fundsDie === undefined
        ? null
        : clampInt(value.fundsDie, 1, STARTING_FUNDS_DIE.sides, 1, 'creation.fundsDie', changed),
    funds: clampInt(value.funds, 0, 100_000_000, 0, 'creation.funds', changed)
  };
}

function sanitizeLifepath(value: unknown, changed: string[]): Lifepath {
  const src = isPlainObject(value) ? value : {};
  if (!isPlainObject(value) && value !== undefined) changed.push('lifepath');
  const events = safeArray(src.lifeEvents, MAX_LIFE_EVENTS, 'lifepath.lifeEvents', changed);
  return {
    familyBackground: safeString(src.familyBackground, MAX_NAME_CHARS, 'lifepath.familyBackground', changed),
    parentStatus: safeString(src.parentStatus, MAX_NAME_CHARS, 'lifepath.parentStatus', changed),
    familyTragedy: safeString(src.familyTragedy, MAX_NAME_CHARS, 'lifepath.familyTragedy', changed),
    childhoodEnvironment: safeString(src.childhoodEnvironment, MAX_NAME_CHARS, 'lifepath.childhoodEnvironment', changed),
    motivationStyle: safeString(src.motivationStyle, MAX_NAME_CHARS, 'lifepath.motivationStyle', changed),
    valuedPerson: safeString(src.valuedPerson, MAX_NAME_CHARS, 'lifepath.valuedPerson', changed),
    valuedPossession: safeString(src.valuedPossession, MAX_NAME_CHARS, 'lifepath.valuedPossession', changed),
    lifeEvents: events.map((e, i) => safeString(e, MAX_NOTES_CHARS, `lifepath.lifeEvents[${i}]`, changed))
  };
}

/**
 * D.1 (decisão 7b) — a trilha em pontos. Com `damagePoints`, o nível sai
 * deles e o `woundLevel` que veio junto é descartado (e registrado, se
 * divergia). Sem pontos — ficha de antes da Fase D —, o nível vira o mínimo
 * da caixa, sem marcar `changed`: é conversão, não correção.
 */
function sanitizeWound(input: Record<string, unknown>, changed: string[]): WoundState {
  const isDead = input.isDead === true;
  if (input.damagePoints === undefined || input.damagePoints === null) {
    const level = clampInt(input.woundLevel, WOUND_LEVEL_MIN, WOUND_LEVEL_MAX, 0, 'woundLevel', changed);
    return { ...woundStateOf({ woundLevel: level }), isDead };
  }
  const points = clampInt(input.damagePoints, 0, WOUND_TRACK_POINTS, 0, 'damagePoints', changed);
  const state = woundStateFromPoints(points, isDead);
  if (input.woundLevel !== undefined && input.woundLevel !== state.woundLevel) changed.push('woundLevel');
  return state;
}

// --- Entrada pública ---------------------------------------------------------

/**
 * Saneia uma ficha vinda de fonte não confiável (corpo de requisição, mensagem
 * de WebSocket, arquivo importado).
 *
 * Devolve `null` só quando a entrada é impossível de interpretar como ficha
 * (não é objeto). Em todo outro caso devolve uma ficha utilizável, com as
 * correções listadas em `changed`.
 *
 * Função pura: não lê ambiente, não faz rede, não altera a entrada. Campos
 * desconhecidos não sobrevivem — a saída é construída campo a campo, nunca
 * espalhando a entrada.
 */
export function sanitizeCharacterSheet(input: unknown): SheetValidationResult | null {
  if (!isPlainObject(input)) return null;

  const changed: string[] = [];
  const stats = sanitizeStats(input.stats, 'stats', changed);
  const wound = sanitizeWound(input, changed);
  const woundLevel = wound.woundLevel;
  const cyberware = sanitizeCyberware(input.cyberware, changed);
  const armor = sanitizeArmor(input.armor, changed);
  const deck = sanitizeDeck(input.deck, changed);
  const creation = sanitizeCreation(input.creation, changed);

  const sheet: CharacterSheet = {
    id: safeString(input.id, MAX_NAME_CHARS, 'id', changed),
    handle: safeString(input.handle, MAX_NAME_CHARS, 'handle', changed),
    realName: safeString(input.realName, MAX_NAME_CHARS, 'realName', changed),
    role: safeString(input.role, MAX_NAME_CHARS, 'role', changed),
    specialAbilityName: safeString(input.specialAbilityName, MAX_NAME_CHARS, 'specialAbilityName', changed),
    specialAbilityRank: clampInt(input.specialAbilityRank, SKILL_LEVEL_MIN, SKILL_LEVEL_MAX, 0, 'specialAbilityRank', changed),
    avatarUrl: safeString(input.avatarUrl, MAX_URL_CHARS, 'avatarUrl', changed),
    age: clampInt(input.age, 0, 200, 0, 'age', changed),
    sex: safeString(input.sex, MAX_NAME_CHARS, 'sex', changed),
    eurodollars: clampInt(input.eurodollars, 0, 100_000_000, 0, 'eurodollars', changed),
    stats,
    // C.6 — `currentStats` é DERIVADO (base → humanidade → ferimento) e o
    // servidor o recalcula, descartando o que o cliente mandou. Não entra em
    // `changed`: o cliente não tem obrigação de mandá-lo certo, e marcar
    // divergência aqui encheria o log a cada sync.
    currentStats: deriveCurrentStats({ stats, woundLevel, cyberware, armor }),
    woundLevel,
    damagePoints: wound.damagePoints,
    isDead: wound.isDead,
    isStabilized: input.isStabilized === true,
    skills: sanitizeSkills(input.skills, changed),
    cyberware,
    weapons: sanitizeWeapons(input.weapons, changed),
    armor,
    lifepath: sanitizeLifepath(input.lifepath, changed),
    gear: sanitizeGear(input.gear, changed),
    gearNotes: safeString(input.gearNotes, MAX_NOTES_CHARS, 'gearNotes', changed),
    ...(deck ? { deck } : {}),
    programs: sanitizePrograms(input.programs, changed),
    ...(creation ? { creation } : {}),
    createdAt: safeString(input.createdAt, 64, 'createdAt', changed),
    updatedAt: safeString(input.updatedAt, 64, 'updatedAt', changed)
  };

  return { sheet, changed };
}
