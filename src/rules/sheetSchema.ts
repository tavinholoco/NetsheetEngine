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
  CharacterSheet,
  CharacterStats,
  CyberwareItem,
  Lifepath,
  SkillItem,
  StatName,
  WeaponItem
} from '../types/cyberpunk';

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

// Tetos de texto. Um `handle` de 10 MB seria transmitido para todos a cada
// broadcast. O texto longo legítimo é o `gearNotes`.
const MAX_NAME_CHARS = 120;
const MAX_URL_CHARS = 2048;
const MAX_NOTES_CHARS = 5000;

const STAT_NAMES: readonly StatName[] = ['INT', 'REF', 'TECH', 'COOL', 'ATTR', 'LUCK', 'MA', 'BODY', 'EMP'];
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

function sanitizeArmor(value: unknown, changed: string[]): ArmorPiece[] {
  const raw = safeArray(value, MAX_ARMOR, 'armor', changed);
  const out: ArmorPiece[] = [];
  raw.forEach((item, i) => {
    if (!isPlainObject(item)) {
      changed.push(`armor[${i}]`);
      return;
    }
    // Localização inválida quebraria o pipeline de dano da Fase D — some.
    if (!ARMOR_LOCATIONS.includes(item.location as ArmorLocation)) {
      changed.push(`armor[${i}].location`);
      return;
    }
    out.push({
      id: safeString(item.id, MAX_NAME_CHARS, `armor[${i}].id`, changed),
      name: safeString(item.name, MAX_NAME_CHARS, `armor[${i}].name`, changed),
      location: item.location as ArmorLocation,
      sp: clampInt(item.sp, 0, 100, 0, `armor[${i}].sp`, changed),
      ev: clampInt(item.ev, 0, 20, 0, `armor[${i}].ev`, changed),
      equipped: safeBool(item.equipped)
    });
  });
  return out;
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
    // `currentStats` é derivado (base + cyberware + penalidade de ferimento) e
    // hoje não tem leitor — a C.6 vai transformá-lo em seletor. Até lá ele é
    // saneado como os demais, e o padrão é espelhar `stats`.
    currentStats: input.currentStats === undefined ? { ...stats } : sanitizeStats(input.currentStats, 'currentStats', changed),
    woundLevel: clampInt(input.woundLevel, WOUND_LEVEL_MIN, WOUND_LEVEL_MAX, 0, 'woundLevel', changed),
    skills: sanitizeSkills(input.skills, changed),
    cyberware: sanitizeCyberware(input.cyberware, changed),
    weapons: sanitizeWeapons(input.weapons, changed),
    armor: sanitizeArmor(input.armor, changed),
    lifepath: sanitizeLifepath(input.lifepath, changed),
    gearNotes: safeString(input.gearNotes, MAX_NOTES_CHARS, 'gearNotes', changed),
    createdAt: safeString(input.createdAt, 64, 'createdAt', changed),
    updatedAt: safeString(input.updatedAt, 64, 'updatedAt', changed)
  };

  return { sheet, changed };
}
