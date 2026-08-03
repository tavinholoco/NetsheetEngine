/**
 * ============================================================
 * NETSHEET ENGINE — TIPOS CYBERPUNK 2020
 * Tipos centrais da ficha de personagem (CharacterSheet) e dos
 * resultados de rolagem (RollResult), reconstruídos a partir dos
 * consumidores existentes: App.tsx, server/roomManager.ts,
 * utils/npcGenerator.ts, components/TacticalGrid.tsx e
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
  currentStats: CharacterStats;
  woundLevel: number;
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
}
