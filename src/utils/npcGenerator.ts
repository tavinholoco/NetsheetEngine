import { CharacterSheet, SkillItem, CyberwareItem, WeaponItem, ArmorPiece } from '../types/cyberpunk';

export interface NpcArchetypeOption {
  id: string;
  name: string;
  role: string;
  specialAbility: string;
  description: string;
  threatLevel: 'Iniciante' | 'Rua' | 'Veterano' | 'Corporativo' | 'Chefe de Gangue';
}

export const NPC_ARCHETYPES: NpcArchetypeOption[] = [
  {
    id: 'boostergang',
    name: 'Boostergang Maelstrom',
    role: 'Solo',
    specialAbility: 'Combat Sense',
    description: 'Ciborgue psicótico de rua com cromo pesado e atitude agressiva.',
    threatLevel: 'Rua'
  },
  {
    id: 'corpo_sec',
    name: 'Guarda Corporativo Arasaka/Militech',
    role: 'Cop',
    specialAbility: 'Authority',
    description: 'Segurança treinado com equipamento tático e armadura balística.',
    threatLevel: 'Veterano'
  },
  {
    id: 'solo_merc',
    name: 'Solo Mercenário de Elite',
    role: 'Solo',
    specialAbility: 'Combat Sense',
    description: 'Assassino profissional altamente qualificado com reflexos acelerados.',
    threatLevel: 'Veterano'
  },
  {
    id: 'netrunner_hostile',
    name: 'Netrunner Hostil de Sombra',
    role: 'Netrunner',
    specialAbility: 'Interface',
    description: 'Hacker de combate capaz de fritar decks neurais e invadir sistemas.',
    threatLevel: 'Rua'
  },
  {
    id: 'sniper_roof',
    name: 'Sniper de Teto / Emboscador',
    role: 'Solo',
    specialAbility: 'Combat Sense',
    description: 'Atirador de elite com fuzil de alta precisão e óptica térmica.',
    threatLevel: 'Veterano'
  },
  {
    id: 'gang_boss',
    name: 'Líder / Chefe de Facção',
    role: 'Solo',
    specialAbility: 'Combat Sense',
    description: 'Líder brutal de gangue cibernética com armadura pesada e seguidores.',
    threatLevel: 'Chefe de Gangue'
  },
  {
    id: 'street_fixer',
    name: 'Fixer de Mercado Negro',
    role: 'Fixer',
    specialAbility: 'Streetdeal',
    description: 'Negociador de beco acompanhado de guarda-costas e contatos.',
    threatLevel: 'Iniciante'
  }
];

const HANDLE_PREFIXES = ['Kix', 'Null', 'Razor', 'Ghost', 'Viper', 'Cinder', 'Hex', 'Blitz', 'Stitch', 'Fang', 'Onyx', 'Spike', 'Glitch', 'Chrono', 'Bane', 'Zero', 'Volt', 'Slash', 'Cyber', 'Iron'];
const HANDLE_SUFFIXES = ['Smasher', 'Vane', 'Rogue', 'Cruz', 'Mantis', 'Talon', 'Vektor', 'Rostov', 'Chen', 'Voss', 'Blade', 'Spark', 'Jack', 'Chrome', 'Pulp', 'Reaper'];

const RANDOM_AVATARS = [
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&q=80'
];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomNumber(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateRandomNpc(archetypeId?: string): CharacterSheet {
  const archetype = NPC_ARCHETYPES.find(a => a.id === archetypeId) || getRandomItem(NPC_ARCHETYPES);

  const prefix = getRandomItem(HANDLE_PREFIXES);
  const suffix = getRandomItem(HANDLE_SUFFIXES);
  const handle = `${prefix} "${suffix}"`;
  const realName = `Sujeito ${getRandomNumber(100, 999)} - ${archetype.name}`;

  // Stat scaling based on threat level
  let baseStatMin = 4;
  let baseStatMax = 7;
  let rankMin = 3;
  let rankMax = 5;

  if (archetype.threatLevel === 'Rua') {
    baseStatMin = 5;
    baseStatMax = 8;
    rankMin = 4;
    rankMax = 6;
  } else if (archetype.threatLevel === 'Veterano') {
    baseStatMin = 6;
    baseStatMax = 9;
    rankMin = 6;
    rankMax = 8;
  } else if (archetype.threatLevel === 'Chefe de Gangue') {
    baseStatMin = 7;
    baseStatMax = 10;
    rankMin = 8;
    rankMax = 10;
  }

  const stats = {
    INT: getRandomNumber(baseStatMin, baseStatMax),
    REF: getRandomNumber(baseStatMin + 1, Math.min(10, baseStatMax + 2)),
    TECH: getRandomNumber(baseStatMin, baseStatMax),
    COOL: getRandomNumber(baseStatMin, baseStatMax),
    ATTR: getRandomNumber(baseStatMin - 1, baseStatMax),
    LUCK: getRandomNumber(3, 8),
    MA: getRandomNumber(5, 8),
    BODY: getRandomNumber(baseStatMin, baseStatMax),
    EMP: getRandomNumber(2, 6) // Lower EMP due to cyberware
  };

  const specialRank = getRandomNumber(rankMin, rankMax);

  // Skills
  const skills: SkillItem[] = [
    {
      id: 'spec_abil_' + Date.now(),
      name: archetype.specialAbility,
      stat: archetype.role === 'Solo' ? 'REF' : archetype.role === 'Netrunner' ? 'INT' : 'EMP',
      level: specialRank,
      isSpecialAbility: true
    },
    { id: 'sk_awareness', name: 'Awareness / Notice', stat: 'INT', level: getRandomNumber(specialRank - 2, specialRank) },
    { id: 'sk_handgun', name: 'Handgun', stat: 'REF', level: getRandomNumber(specialRank - 2, specialRank) },
    { id: 'sk_rifle', name: 'Rifle / SMG', stat: 'REF', level: getRandomNumber(specialRank - 2, specialRank) },
    { id: 'sk_brawling', name: 'Brawling', stat: 'REF', level: getRandomNumber(3, specialRank) },
    { id: 'sk_streetwise', name: 'Streetwise', stat: 'COOL', level: getRandomNumber(3, 7) }
  ];

  // Cyberware
  const cyberware: CyberwareItem[] = [
    {
      id: 'cw_keren_' + Date.now(),
      name: 'Kerenzikov Speedware (+2 REF)',
      category: 'Neuralware',
      costEb: 3000,
      humanityLoss: '2d6',
      actualHL: 8,
      installed: true,
      notes: '+2 em testes de iniciativa'
    },
    {
      id: 'cw_armor_' + Date.now(),
      name: 'Subdermal Armor Kevlar (SP 14)',
      category: 'Subdermal Armor',
      costEb: 1200,
      humanityLoss: '2d6',
      actualHL: 6,
      installed: true,
      notes: 'Proteção sob a pele'
    }
  ];

  if (archetype.id === 'boostergang' || archetype.id === 'gang_boss') {
    cyberware.push({
      id: 'cw_blade_' + Date.now(),
      name: 'Lâminas Mantis de Monomassa (3d6 corte)',
      category: 'Weapons',
      costEb: 2000,
      humanityLoss: '3d6',
      actualHL: 12,
      installed: true,
      notes: 'Lâminas retráteis nos antebraços'
    });
  }

  // Weapons
  const weapons: WeaponItem[] = [];

  if (archetype.id === 'sniper_roof') {
    weapons.push({
      id: 'wp_sniper_' + Date.now(),
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
      equipped: true
    });
  } else if (archetype.id === 'boostergang' || archetype.id === 'gang_boss') {
    weapons.push({
      id: 'wp_smg_' + Date.now(),
      name: 'Sternmeyer M-9 SMG',
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
    });
  } else {
    weapons.push({
      id: 'wp_pistol_' + Date.now(),
      name: 'Militech Arms 9mm (Pistola Heavy)',
      type: 'Pistol',
      wa: 0,
      con: 'J',
      avail: 'C',
      damage: '2d6+1',
      shots: 12,
      currentShots: 12,
      rof: 2,
      rel: 'VR',
      rangeMeters: 50,
      equipped: true
    });
  }

  // Armor
  const armorSp = archetype.threatLevel === 'Chefe de Gangue' ? 18 : archetype.threatLevel === 'Veterano' ? 14 : 10;
  const armor: ArmorPiece[] = [
    { id: 'arm_head_' + Date.now(), name: 'Capacete Tático', location: 'Head', sp: armorSp, ev: 0, equipped: true },
    { id: 'arm_torso_' + Date.now(), name: 'Colete Kevlar Reforçado', location: 'Torso', sp: armorSp, ev: 0, equipped: true },
    { id: 'arm_arms_' + Date.now(), name: 'Proteção de Braços', location: 'Right Arm', sp: armorSp - 2, ev: 0, equipped: true },
    { id: 'arm_legs_' + Date.now(), name: 'Calças Balísticas', location: 'Right Leg', sp: armorSp - 2, ev: 0, equipped: true }
  ];

  return {
    id: 'npc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    handle,
    realName,
    role: archetype.role,
    specialAbilityName: archetype.specialAbility,
    specialAbilityRank: specialRank,
    avatarUrl: getRandomItem(RANDOM_AVATARS),
    age: getRandomNumber(20, 48),
    sex: getRandomItem(['Masculino', 'Feminino', 'Andrógeno']),
    eurodollars: getRandomNumber(100, 2500),
    stats,
    currentStats: { ...stats },
    woundLevel: 0,
    skills,
    cyberware,
    weapons,
    armor,
    lifepath: {
      familyBackground: `NPC Hostil // Ameaça: ${archetype.threatLevel}`,
      parentStatus: archetype.description,
      familyTragedy: 'Nenhum histórico registrado no banco de dados do NCPD.',
      childhoodEnvironment: 'Zona de Combate das sombras de Night City.',
      motivationStyle: 'Atitude violenta e territorial.',
      valuedPerson: 'Seu bando / corporação.',
      valuedPossession: 'Sua arma primária e cromo cibernético.',
      lifeEvents: [`Gerado como NPC em combate na mesa pelo Mestre. Ameaça nível ${archetype.threatLevel}.`]
    },
    gearNotes: 'Munição padrão, pílulas de Dope, cabo de dados cibernético.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}
