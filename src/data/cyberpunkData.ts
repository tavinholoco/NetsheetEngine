/**
 * ============================================================
 * NETSHEET ENGINE — DADOS CYBERPUNK 2020
 * Roles oficiais (OFFICIAL_ROLES), arsenal padrão (DEFAULT_WEAPONS),
 * armaduras padrão (DEFAULT_ARMOR) e tabelas CP2020 (perícias,
 * lifepath). Reconstruído a partir dos consumidores existentes:
 * CharacterHeader.tsx, WeaponsArmor.tsx, utils/npcGenerator.ts.
 * ============================================================
 */

import type { ArmorPiece, StatName, WeaponItem } from '../types/cyberpunk';

/** Role oficial CP2020 com sua Special Ability. */
export interface OfficialRole {
  name: string;
  specialAbility: string;
  description: string;
}

/** Os 10 roles oficiais do CP2020 (2ª edição) com habilidades especiais. */
export const OFFICIAL_ROLES: OfficialRole[] = [
  {
    name: 'Solo',
    specialAbility: 'Combat Sense',
    description: 'Mestre do combate e da sobrevivência. Especialista em armas, táticas de guerrilha e reflexos letais — o mercenário definitivo de Night City.'
  },
  {
    name: 'Netrunner',
    specialAbility: 'Interface',
    description: 'Hacker de elite que invade a Net para roubar dados e controlar sistemas. Conecta seu deck neural diretamente ao ciberespaço.'
  },
  {
    name: 'Tech',
    specialAbility: 'Jury Rig',
    description: 'Gênio da engenharia capaz de consertar e improvisar qualquer máquina. Mestre da manutenção de veículos, eletrônicos e cromos.'
  },
  {
    name: 'Medtechie',
    specialAbility: 'Medical Tech',
    description: 'Médico de combate treinado em socorro de emergência e cirurgia de cromo. Pode estabilizar ferimentos graves e instalar implantes.'
  },
  {
    name: 'Media',
    specialAbility: 'Credibility',
    description: 'Jornalista investigativo com poder de expor a verdade e derrubar corporações. Sua palavra tem peso — e seus contatos valem ouro.'
  },
  {
    name: 'Cop',
    specialAbility: 'Authority',
    description: 'Policial ou vigilante com autoridade legal. Usa seu distintivo, a rede policial e métodos próprios para impor a lei nas ruas.'
  },
  {
    name: 'Corp',
    specialAbility: 'Resources',
    description: 'Executivo corporativo com acesso a recursos ilimitados da megacorporação. Especialista em negócios, espionagem industrial e poder.'
  },
  {
    name: 'Fixer',
    specialAbility: 'Streetdeal',
    description: 'Intermediário do mercado negro que conhece todos os contatos e fornecedores. Arma negócios, consegue qualquer mercadoria e move Night City.'
  },
  {
    name: 'Rockerboy',
    specialAbility: 'Charismatic Leadership',
    description: 'Estrela do rock e agitador cultural. Seu carisma inflama multidões e sua música pode derrubar corporações ou iniciar revoluções.'
  },
  {
    name: 'Nomad',
    specialAbility: 'Family',
    description: 'Membro de uma família nômade das estradas. Mestre de veículos e da logística de comboios, leal acima de tudo aos seus.'
  }
];

/** Armas padrão de Night City para adição rápida na ficha. */
export const DEFAULT_WEAPONS: WeaponItem[] = [
  {
    id: 'wp_militech_dynamite',
    name: 'Militech Arms "Dynamite" (Pistola Pesada 7mm)',
    type: 'Pistol',
    wa: 0,
    con: 'J',
    avail: 'C',
    damage: '2d6+2',
    shots: 10,
    currentShots: 10,
    rof: 2,
    rel: 'VR',
    rangeMeters: 50,
    equipped: true
  },
  {
    id: 'wp_sternmeyer_m9',
    name: 'Sternmeyer M-9 (SMG)',
    type: 'Submachinegun',
    wa: 1,
    con: 'J',
    avail: 'C',
    damage: '2d6+2',
    shots: 30,
    currentShots: 30,
    rof: 15,
    rel: 'VR',
    rangeMeters: 150,
    equipped: true
  },
  {
    id: 'wp_fedtech_rifle',
    name: 'Federated Arms Tech Rifle',
    type: 'Assault Rifle',
    wa: 1,
    con: 'J',
    avail: 'C',
    damage: '5d6',
    shots: 30,
    currentShots: 30,
    rof: 15,
    rel: 'ST',
    rangeMeters: 400,
    equipped: false
  },
  {
    id: 'wp_militech_ronin',
    name: 'Militech Ronin Light Assault',
    type: 'Assault Rifle',
    wa: 1,
    con: 'N',
    avail: 'C',
    damage: '5d6',
    shots: 35,
    currentShots: 35,
    rof: 25,
    rel: 'ST',
    rangeMeters: 400,
    equipped: false
  },
  {
    id: 'wp_arasaka_rapid',
    name: 'Arasaka Rapid Assault (SMG)',
    type: 'Submachinegun',
    wa: 1,
    con: 'N',
    avail: 'P',
    damage: '2d6+1',
    shots: 40,
    currentShots: 40,
    rof: 20,
    rel: 'ST',
    rangeMeters: 150,
    equipped: false
  },
  {
    id: 'wp_militech_sniper',
    name: 'Militech Sniper Rifle 7.62mm',
    type: 'Sniper Rifle',
    wa: 2,
    con: 'N',
    avail: 'R',
    damage: '6d6+2',
    shots: 6,
    currentShots: 6,
    rof: 1,
    rel: 'VR',
    rangeMeters: 800,
    equipped: false
  },
  {
    id: 'wp_combat_shotgun',
    name: 'Combat Shotgun 12G',
    type: 'Shotgun',
    wa: 1,
    con: 'N',
    avail: 'C',
    damage: '4d6',
    shots: 8,
    currentShots: 8,
    rof: 2,
    rel: 'VR',
    rangeMeters: 50,
    equipped: false
  },
  {
    id: 'wp_combat_knife',
    name: 'Faca de Combate',
    type: 'Melee',
    wa: 0,
    con: 'P',
    avail: 'C',
    damage: '1d6',
    shots: 0,
    currentShots: 0,
    rof: 2,
    rel: 'VR',
    rangeMeters: 1,
    equipped: false
  }
];

/** Conjunto padrão de armadura leve (SP 14) cobrindo as 6 localizações. */
export const DEFAULT_ARMOR: ArmorPiece[] = [
  { id: 'arm_light_head', name: 'Armadura Leve — Cabeça', location: 'Head', sp: 14, ev: 0, equipped: true },
  { id: 'arm_light_torso', name: 'Armadura Leve — Tronco', location: 'Torso', sp: 14, ev: 0, equipped: true },
  { id: 'arm_light_rarm', name: 'Armadura Leve — Braço Direito', location: 'Right Arm', sp: 14, ev: 0, equipped: true },
  { id: 'arm_light_larm', name: 'Armadura Leve — Braço Esquerdo', location: 'Left Arm', sp: 14, ev: 0, equipped: true },
  { id: 'arm_light_rleg', name: 'Armadura Leve — Perna Direita', location: 'Right Leg', sp: 14, ev: 0, equipped: true },
  { id: 'arm_light_lleg', name: 'Armadura Leve — Perna Esquerda', location: 'Left Leg', sp: 14, ev: 0, equipped: true }
];

/** Perícias de atributo do CP2020 agrupadas por atributo primário. */
export const SKILL_TABLES: Record<StatName, string[]> = {
  INT: ['Awareness / Notice', 'Biology', 'Botany', 'Chemistry', 'Composition', 'Diagnose Illness', 'Education & Gen. Know.', 'Expert: (escolha)', 'Geology', 'Hide / Evade', 'History', 'Language (escolha)', 'Library Search', 'Mathematics', 'Physics', 'Programming', 'Psychology', 'Social', 'Stock Market', 'System Knowledge', 'Teaching', 'Zoology'],
  REF: ['Archery', 'Athletics', 'Brawling', 'Dance', 'Dodge & Escape', 'Driving', 'Fencing', 'Handgun', 'Heavy Weapons', 'Martial Art (escolha)', 'Melee', 'Motorcycle', 'Operate Hvy. Machinery', 'Pilot (escolha)', 'Rifle', 'Stealth', 'Submachinegun'],
  TECH: ['Aero Tech', 'AV Tech', 'Basic Tech', 'Cryotank Operation', 'CyberTech', 'Demolitions', 'Disguise', 'Electronic Security', 'Electronics', 'First Aid', 'Forgery', 'Gyro Tech', 'Paint / Draw / Sculpt', 'Photo & Film', 'Pick Lock', 'Pick Pocket', 'Play Instrument', 'Weaponsmith'],
  COOL: ['Intimidate', 'Oratory', 'Resist Torture / Drugs', 'Streetwise'],
  ATTR: ['Personal Grooming', 'Wardrobe & Style'],
  LUCK: [],
  MA: [],
  BODY: ['Endurance', 'Strength Feat', 'Swimming'],
  EMP: ['Human Perception', 'Interview', 'Leadership', 'Perform', 'Persuasion & Fast Talk', 'Seduction', 'Social']
};

/** Habilidades especiais (Special Abilities) de cada role oficial. */
export const SPECIAL_ABILITIES: Record<string, string> = {
  Solo: 'Combat Sense',
  Netrunner: 'Interface',
  Tech: 'Jury Rig',
  Medtechie: 'Medical Tech',
  Media: 'Credibility',
  Cop: 'Authority',
  Corp: 'Resources',
  Fixer: 'Streetdeal',
  Rockerboy: 'Charismatic Leadership',
  Nomad: 'Family'
};

/** Tabelas de Lifepath CP2020 para geração narrativa rápida. */
export const LIFEPATH_TABLES = {
  familyBackground: [
    'Corporação (executivo)',
    'Classe média alta (executivo/médico)',
    'Classe média (trabalhador especializado)',
    'Classe média baixa (trabalhador braçal)',
    'Classe baixa (desempregado)',
    'Favela / Zona de Combate',
    'Nômade (família de estrada)',
    'Militar (quartel / base)',
    'Rua / órfão',
    'Criminosa (contrabando / gangue)'
  ],
  parentStatus: [
    'Vivos e saudáveis, trabalhando',
    'Vivos, mas doentes ou feridos',
    'Vivos, mas viciados',
    'Vivos, mas com dívidas gigantes',
    'Um vivo, um morto',
    'Ambos mortos (acidente)',
    'Ambos mortos (assassinato / guerra)',
    'Um vivo, um sumido',
    'Ambos sumidos (ninguém sabe onde estão)',
    'Ambos mortos (doença / vício)'
  ],
  familyTragedy: [
    'Nenhuma — família unida',
    'Família desintegrada (separação)',
    'Família vendida para corporações',
    'Família destruída por guerra',
    'Família vítima de crime',
    'Família arruinada por vício',
    'Família morta em acidente',
    'Família desaparecida misteriosamente',
    'Família traiu você (delação)',
    'Você abandonou sua família'
  ],
  childhoodEnvironment: [
    'Ganhou na loteria genética (vida fácil)',
    'Crescimento normal na cidade',
    'Subúrbio pacato',
    'Zona de Combate violenta',
    'Na estrada com nômades',
    'Viveu nas ruas (abandonado)',
    'Educação rígida corporativa',
    'Internato militar',
    'Crescimento rural isolado',
    'Crescimento em meio ao crime'
  ],
  motivations: [
    'Dinheiro (ganância)',
    'Poder (controle)',
    'Sobrevivência (medo)',
    'Vingança (ódio)',
    'Reconhecimento (fama)',
    'Honra (código pessoal)',
    'Proteção (dos seus)',
    'Curiosidade (conhecimento)',
    'Liberdade (escapar do sistema)',
    'Prazer (hedonismo)'
  ],
  lifeEvents: [
    'Perdeu alguém querido',
    'Ganhou uma fortuna inesperada',
    'Traiu alguém importante',
    'Foi traído por alguém importante',
    'Envolveu-se em crime organizado',
    'Conseguiu um contato poderoso',
    'Sobreviveu a uma tentativa de assassinato',
    'Descobriu um segredo perigoso',
    'Ficou gravemente ferido (cicatriz)',
    'Feito prisioneiro e escapou'
  ]
} as const;
