/**
 * ROLADOR DO CLIENTE (src/utils/diceEngine.ts)
 * ============================================
 * Desde a Fase C (C.1) o rolador é uma casca sobre o motor único de
 * src/rules/ — as regras em si estão em rules-dice.test.ts. Aqui fica o
 * contrato do RollResult que a ficha e o histórico consomem, e a checagem
 * estatística do RNG real do cliente (Web Crypto).
 *
 * RNG determinístico: `scriptedRng`, injetado por parâmetro. Antes da Fase C
 * os testes trocavam o gerador GLOBAL da biblioteca @dice-roller — que saiu.
 */
import { describe, it, expect } from 'vitest';
import { clientRng, rollDamage, rollDeathSave, rollLocation, rollSkill } from '../utils/diceEngine';
import { scriptedRng } from '../test/scriptedRng';

describe('rollSkill — perícia/ataque', () => {
  it('10 explode e encadeia: [10, 5] + REF 8 + perícia 3 = 26', () => {
    const r = rollSkill(8, 3, { characterName: 'Vex', label: 'Rolagem: Handgun', statName: 'REF', skillName: 'Handgun' }, scriptedRng([10, 5]));
    expect(r.isCriticalSuccess).toBe(true);
    expect(r.isCriticalFailure).toBe(false);
    expect(r.total).toBe(26);
    expect(r.baseRoll).toBe(10);
    expect(r.bonus).toBe(11);
    expect(r.diceFormula).toBe('1d10! (Explodiu!)');
    expect(r.details).toBe('1d10: 10 → 5 = 15 🔥 explodiu + REF (8) + Handgun (3) = 26');
  });

  it('fumble: 1 é falha automática, o total NÃO perde 1d10 (1 + 8 + 3 = 12)', () => {
    const r = rollSkill(8, 3, {}, scriptedRng([1, 4]));
    expect(r.isCriticalFailure).toBe(true);
    expect(r.total).toBe(12);
    expect(r.diceFormula).toBe('1d10! (Fumble!)');
    expect(r.details).toContain('tabela de fumble: 4');
  });

  it('sem crítico: total = dado + atributo + perícia, com os nomes no detalhe', () => {
    const r = rollSkill(8, 3, { statName: 'TECH' }, scriptedRng([5]));
    expect(r.total).toBe(16);
    expect(r.diceFormula).toBe('1d10');
    expect(r.details).toBe('1d10: 5 + TECH (8) + Perícia (3) = 16');
  });

  it('parcelas extras entram com nome (é por aqui que o Combat Sense soma Awareness)', () => {
    const r = rollSkill(7, 5, { statName: 'INT', skillName: 'Combat Sense', modifiers: [{ label: 'Awareness/Notice', value: 3 }] }, scriptedRng([2]));
    expect(r.total).toBe(17);
    expect(r.details).toContain('Awareness/Notice (3)');
  });
});

describe('rollDamage — fórmula + local de impacto', () => {
  it('2d6+2: [4, 5] + 2 = 11, na cabeça', () => {
    const r = rollDamage('2d6+2', { characterName: 'Vex', label: 'Dano da Arma: 9mm' }, scriptedRng([4, 5, 1]));
    expect(r.total).toBe(11);
    expect(r.baseRoll).toBe(11);
    expect(r.rollType).toBe('DAMAGE');
    expect(r.details).toBe('Dados: [4, 5] • Local de Impacto: Cabeça (1) [DANO DOBRADO X2!]');
  });

  it('acerto no tronco aparece como tronco', () => {
    expect(rollDamage('1d6', {}, scriptedRng([6, 3])).details).toContain('Tronco (2-4)');
  });

  it('fórmula inválida lança erro (contrato do rolador)', () => {
    expect(() => rollDamage('abc')).toThrow(/inválida/);
  });
});

describe('rollDeathSave — 1d10 ≤ BODY', () => {
  it('PASSOU: 4 ≤ 8', () => {
    const r = rollDeathSave(8, { characterName: 'Vex' }, scriptedRng([4]));
    expect(r.isCriticalSuccess).toBe(true);
    expect(r.total).toBe(4);
    expect(r.details).toContain('PASSOU! Resultado 4 ≤ 8');
  });

  it('FALHOU: 10 > 8', () => {
    const r = rollDeathSave(8, {}, scriptedRng([10]));
    expect(r.isCriticalFailure).toBe(true);
    expect(r.details).toContain('FALHOU! Resultado 10 > 8');
  });
});

describe('contrato do RollResult', () => {
  it('campos obrigatórios presentes e coerentes', () => {
    const r = rollSkill(5, 2, { characterName: 'Choom' }, scriptedRng([5]));
    expect(r.id.startsWith('roll_')).toBe(true);
    expect(r.timestamp.length).toBeGreaterThan(0);
    expect(r.characterName).toBe('Choom');
    expect(r.label).toBeTruthy();
  });

  it('characterName default = Edgerunner', () => {
    expect(rollSkill(1, 1, {}, scriptedRng([5])).characterName).toBe('Edgerunner');
  });

  it('ids não se repetem na mesma sessão', () => {
    const a = rollSkill(1, 1, {}, scriptedRng([5]));
    const b = rollSkill(1, 1, {}, scriptedRng([5]));
    expect(a.id).not.toBe(b.id);
  });
});

describe('RNG real do cliente (Web Crypto), 3000 rolagens', () => {
  it('d10 cobre 1..10 e nada fora disso', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 3000; i++) {
      const v = clientRng(10);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(10);
      seen.add(v);
    }
    expect(seen.size).toBe(10);
  });

  it('dano 2d6+2 fica em 4..14 e atinge os dois extremos', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 3000; i++) {
      const t = rollDamage('2d6+2').total;
      min = Math.min(min, t);
      max = Math.max(max, t);
    }
    expect([min, max]).toEqual([4, 14]);
  });

  it('local de impacto: as 10 faces aparecem', () => {
    const faces = new Set<number>();
    for (let i = 0; i < 3000; i++) faces.add(rollLocation().roll);
    expect(faces.size).toBe(10);
  });

  it('perícia: explosão (> 10) e fumble aparecem, e fumble nunca deixa o total abaixo do dado', () => {
    let exploded = false;
    let fumbled = false;
    for (let i = 0; i < 3000; i++) {
      const r = rollSkill(0, 0);
      if (r.total > 10) exploded = true;
      if (r.isCriticalFailure) {
        fumbled = true;
        expect(r.total).toBe(1);
      }
    }
    expect(exploded).toBe(true);
    expect(fumbled).toBe(true);
  });
});
