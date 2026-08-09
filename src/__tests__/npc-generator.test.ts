/**
 * Fase 9 (T9.2) — UNIT TESTS DO GERADOR DE NPC (src/utils/npcGenerator.ts)
 * ========================================================================
 * Invariantes estruturais (o gerador usa Math.random — não testamos valores
 * exatos, e sim a validade do que ele produz em qualquer execução):
 * atributos na faixa CP2020, ficha saudável, armadura cobrindo as 4
 * localizações equipadas com SP ≥ 8, arsenal com fórmula de dano válida,
 * perícia de habilidade especial marcada e cyberware com perda de HL.
 */
import { describe, it, expect } from 'vitest';
import { generateRandomNpc, NPC_ARCHETYPES } from '../utils/npcGenerator';

const STAT_NAMES = ['INT', 'REF', 'TECH', 'COOL', 'ATTR', 'LUCK', 'MA', 'BODY', 'EMP'] as const;
const DAMAGE_FORMULA = /^\d+d\d+(\+\d+)?$/;
const HL_FORMULA = /^\d+d\d+$/;

describe('generateRandomNpc — invariantes para todos os arquétipos', () => {
  it.each(NPC_ARCHETYPES.map((a) => [a.id, a.name] as [string, string]))(
    'arquétipo "%s" gera ficha válida',
    (archetypeId) => {
      const npc = generateRandomNpc(archetypeId);

      // Identidade
      expect(npc.handle).toMatch(/^.+ ".+"$/); // "Prefixo \"Sufixo\""
      expect(npc.role.length).toBeGreaterThan(0);
      expect(npc.id.startsWith('npc_')).toBe(true);

      // Atributos dentro da faixa CP2020 (2..10 na criação)
      for (const stat of STAT_NAMES) {
        expect(npc.stats[stat]).toBeGreaterThanOrEqual(2);
        expect(npc.stats[stat]).toBeLessThanOrEqual(10);
        // currentStats espelha stats no spawn
        expect(npc.currentStats[stat]).toBe(npc.stats[stat]);
      }

      // Saudável ao nascer
      expect(npc.woundLevel).toBe(0);

      // Armadura cobre as 4 localizações equipadas com SP >= 8
      const locations = npc.armor.map((a) => a.location);
      expect(locations).toEqual(expect.arrayContaining(['Head', 'Torso', 'Right Arm', 'Right Leg']));
      expect(npc.armor.every((a) => a.equipped)).toBe(true);
      expect(npc.armor.every((a) => a.sp >= 8)).toBe(true);

      // Arsenal com fórmula de dano válida
      expect(npc.weapons.length).toBeGreaterThan(0);
      expect(npc.weapons.every((w) => DAMAGE_FORMULA.test(w.damage))).toBe(true);
      expect(npc.weapons.every((w) => w.currentShots === w.shots)).toBe(true);

      // Perícia de habilidade especial presente e marcada
      const special = npc.skills.find((s) => s.isSpecialAbility);
      expect(special).toBeDefined();
      expect(special?.name).toBe(npc.specialAbilityName);
      expect(special?.level).toBe(npc.specialAbilityRank);

      // Cyberware com perda de humanidade em notação válida
      expect(npc.cyberware.length).toBeGreaterThan(0);
      expect(npc.cyberware.every((cwItem) => HL_FORMULA.test(cwItem.humanityLoss))).toBe(true);
      expect(npc.cyberware.every((cwItem) => cwItem.actualHL > 0)).toBe(true);
    }
  );

  it('sem arquétipo escolhe um dos arquétipos disponíveis', () => {
    const npc = generateRandomNpc();
    expect(NPC_ARCHETYPES.some((a) => a.name === npc.realName.split(' - ')[1])).toBe(true);
  });

  it('arquétipo desconhecido cai no fallback aleatório (não quebra)', () => {
    expect(() => generateRandomNpc('nao_existe')).not.toThrow();
  });
});
