/**
 * G.3a (G.22 do ledger da G) — o NPC gerado cobre os seis locais de impacto.
 * =========================================================================
 * O gerador vestia "Proteção de Braços" e "Calças Balísticas" num local só cada
 * (o direito): o braço esquerdo (face 6) e a perna esquerda (9 e 0) ficavam com
 * SP 0, e 3 em cada 10 acertos num NPC ignoravam a armadura. O teste deriva da
 * tabela de locais do livro (`HIT_LOCATIONS`), não da lista do gerador.
 */
import { describe, it, expect } from 'vitest';
import { generateRandomNpc, NPC_ARCHETYPES } from '../utils/npcGenerator';
import { HIT_LOCATIONS } from '../rules/tables';
import { armorSpAt } from '../rules/damage';

describe('npc-armor — a armadura do NPC gerado', () => {
  it.each(NPC_ARCHETYPES.map((a) => [a.id] as [string]))('"%s" protege todo local de impacto', (archetypeId) => {
    const npc = generateRandomNpc(archetypeId);
    for (const row of HIT_LOCATIONS) {
      expect(armorSpAt(npc.armor, row.location), row.name).toBeGreaterThan(0);
    }
  });

  it.each(NPC_ARCHETYPES.map((a) => [a.id] as [string]))('"%s" tem os dois lados com o mesmo SP', (archetypeId) => {
    const npc = generateRandomNpc(archetypeId);
    expect(armorSpAt(npc.armor, 'Left Arm')).toBe(armorSpAt(npc.armor, 'Right Arm'));
    expect(armorSpAt(npc.armor, 'Left Leg')).toBe(armorSpAt(npc.armor, 'Right Leg'));
  });
});
