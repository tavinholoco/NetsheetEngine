/**
 * ============================================================
 * NETSHEET ENGINE — TIPOS CYBERPUNK 2020
 * Tipos centrais da ficha de personagem (CharacterSheet) e dos
 * resultados de rolagem (RollResult), reconstruídos a partir dos
 * consumidores existentes: App.tsx, server/roomManager.ts,
 * utils/npcGenerator.ts, src/features/multiplayer/TacticalGrid.tsx e
 * types/multiplayer.ts.
 * ============================================================
 */

/** Atributos primários do sistema CP2020. */
export type StatName = 'INT' | 'REF' | 'TECH' | 'COOL' | 'ATTR' | 'LUCK' | 'MA' | 'BODY' | 'EMP';

/** Mapa de valores dos atributos primários (2–10 na criação, até 15 com cromo). */
export interface CharacterStats {
  INT: number;
  REF: number;
  TECH: number;
  COOL: number;
  ATTR: number;
  LUCK: number;
  MA: number;
  BODY: number;
  EMP: number;
}

/** Localizações de armadura/impacto do grid corporal CP2020. */
export type ArmorLocation = 'Head' | 'Torso' | 'Right Arm' | 'Left Arm' | 'Right Leg' | 'Left Leg';

/** Item de perícia (skill) da ficha. */
export interface SkillItem {
  id: string;
  name: string;
  stat: StatName;
  level: number;
  isSpecialAbility?: boolean;
}

/** Item de cyberware instalado. */
export interface CyberwareItem {
  id: string;
  name: string;
  category: string;
  costEb: number;
  humanityLoss: string;
  actualHL: number;
  installed: boolean;
  notes?: string;
}

/** Arma da ficha / arsenal. */
export interface WeaponItem {
  id: string;
  name: string;
  type: string;
  wa: number;
  con: string;
  avail: string;
  damage: string;
  shots: number;
  currentShots: number;
  rof: number;
  rel: string;
  rangeMeters: number;
  equipped: boolean;
}

/** Peça de armadura com SP (Stopping Power) por localização. */
export interface ArmorPiece {
  id: string;
  name: string;
  location: ArmorLocation;
  sp: number;
  ev: number;
  equipped: boolean;
}

/** Lifepath narrativo gerado / editado pelo jogador. */
export interface Lifepath {
  familyBackground: string;
  parentStatus: string;
  familyTragedy: string;
  childhoodEnvironment: string;
  motivationStyle: string;
  valuedPerson: string;
  valuedPossession: string;
  lifeEvents: string[];
}

/** Ficha completa de personagem edgerunner. */
export interface CharacterSheet {
  id: string;
  handle: string;
  realName: string;
  role: string;
  specialAbilityName: string;
  specialAbilityRank: number;
  avatarUrl: string;
  age: number;
  sex: string;
  eurodollars: number;
  stats: CharacterStats;
  /**
   * Derivado — não leia este campo: chame `deriveCurrentStats(sheet)`
   * (src/rules/character.ts). Continua no tipo porque fichas salvas o têm; o
   * servidor o recalcula a cada sync e descarta o que o cliente mandou.
   */
  currentStats: CharacterStats;
  /**
   * Nível de ferimento (0–10). Desde a Fase D é DERIVADO de `damagePoints` —
   * continua gravado porque todo leitor antigo o usa. Leia com `woundStateOf`.
   */
  woundLevel: number;
  /**
   * Pontos de dano na trilha (0–40), como o livro conta. Opcional: ficha de
   * antes da Fase D não tem, e `woundStateOf` converte do `woundLevel`.
   */
  damagePoints?: number;
  /** Morto: dano além da trilha, cabeça com mais de 8, ou death save falho. */
  isDead?: boolean;
  /**
   * Estabilizado (D.5): em Mortal, para de rolar o death save a cada turno.
   * Na mesa, só o GM marca; dano que entra desfaz (p. 105, via S9).
   */
  isStabilized?: boolean;
  skills: SkillItem[];
  cyberware: CyberwareItem[];
  weapons: WeaponItem[];
  armor: ArmorPiece[];
  lifepath: Lifepath;
  gearNotes: string;
  createdAt: string;
  updatedAt: string;
}

/** Tipos de rolagem suportados pelo rolador FNFF. */
export type RollType = 'SKILL' | 'DAMAGE' | 'SAVE';

/** Resultado de uma rolagem de dados (banner, histórico e chat da mesa). */
export interface RollResult {
  id: string;
  timestamp: string;
  characterName: string;
  rollType: RollType;
  label: string;
  diceFormula: string;
  baseRoll: number;
  bonus: number;
  total: number;
  isCriticalSuccess: boolean;
  isCriticalFailure: boolean;
  details: string;
  /**
   * Só em rolagem de dano (D.3): o local de impacto sorteado, estruturado.
   * Antes existia só no texto do `details`; o GM aplica o dano a partir dele.
   */
  hitLocation?: ArmorLocation;
}
