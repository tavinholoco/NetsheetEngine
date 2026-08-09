/**
 * Fase 9 (T9.2) — UNIT TESTS DO MOTOR DE DADOS (src/utils/diceEngine.ts) VIA VITEST
 * ==============================================================================
 * Portado de `scripts/test-dice-engine.ts` (T6.4) para o runner Vitest.
 *
 * RNG DETERMINÍSTICO: o engine global da lib (@dice-roller/rpg-dice-roller)
 * é substituído por uma FILA de valores controlada, o que permite asserts
 * EXATOS de explosão, fumble, faixas de dano e death save.
 *
 * Mapeamento comprovado empiricamente (downscale do lib):
 *   d10 = (engineValue % 10) + 1   (valor 0 → 1, valor 9 → 10)
 *   d6  = (engineValue % 6) + 1
 * Valores ≥ 4294967290 são rejeitados pelo lib (loop de downscale) — não usar.
 *
 * Rodar: `npm run test` (vitest run — faz parte da suíte Fase 9).
 */
import { describe, it, expect } from 'vitest';
import { DiceRoll, NumberGenerator } from '@dice-roller/rpg-dice-roller';
import { rollSkill, rollDamage, rollDeathSave, rollLocation } from '../utils/diceEngine';

/** Substitui o RNG global por uma fila de valores; restaura nativeMath ao final. */
function withEngine(values: number[], fn: () => void): void {
  const queue = [...values];
  NumberGenerator.generator.engine = {
    next: () => (queue.length > 0 ? (queue.shift() as number) : 0x80000000)
  };
  try {
    fn();
  } finally {
    NumberGenerator.generator.engine = NumberGenerator.engines.nativeMath;
  }
}

/** Conveniência: engine de um só valor (dado único). */
function withEngineOne(value: number, fn: () => void): void {
  withEngine([value], fn);
}

/**
 * Semeia o engine MersenneTwister (factory `seed` é privada no tipo — cast
 * necessário; comportamento idêntico ao script legado da T6.4).
 */
function seedEngine(seed: number): { next(): number } {
  const mt = NumberGenerator.engines.MersenneTwister19937 as unknown as {
    seed(s: number): { next(): number };
  };
  return mt.seed(seed);
}

/** Engine seedado (MersenneTwister) para testes estatísticos em massa. */
function withSeededEngine(seed: number, fn: () => void): void {
  NumberGenerator.generator.engine = seedEngine(seed);
  try {
    fn();
  } finally {
    NumberGenerator.generator.engine = NumberGenerator.engines.nativeMath;
  }
}

describe('diceEngine — perícia (1d10!): explosão', () => {
  it('10 explode e soma os dados extras (15 + 8 + 3 = 26)', () => {
    withEngine([9, 4], () => {
      // valores 9→10 e 4→5 → 1d10!: [10!, 5] = 15
      const r = rollSkill(8, 3, { characterName: 'Vex', label: 'Rolagem: Handgun', statName: 'REF' });
      expect(r.isCriticalSuccess).toBe(true);
      expect(r.total).toBe(26); // 15 + 8 + 3
      expect(r.baseRoll).toBe(10);
      expect(r.bonus).toBe(11); // stat 8 + skill 3
      expect(r.diceFormula).toBe('1d10! (Explodiu!)');
      expect(r.details).toContain('[10!, 5]'); // audit trail
      expect(r.isCriticalFailure).toBe(false);
    });
  });

  it('explosão encadeada: 10 → 10 → 5 (25 + 11 = 36)', () => {
    withEngine([9, 9, 4], () => {
      const r = rollSkill(8, 3);
      expect(r.total).toBe(36);
      expect(r.details.match(/10!/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('diceEngine — perícia: fumble', () => {
  it('1 rola 1d10 e SUBTRAI do total (1 − 4 + 8 + 3 = 8)', () => {
    withEngine([0, 3], () => {
      // valores 0→1 (dado) e 3→4 (penalidade)
      const r = rollSkill(8, 3, { characterName: 'Vex', label: 'Rolagem: Handgun', statName: 'REF' });
      expect(r.isCriticalFailure).toBe(true);
      expect(r.total).toBe(8);
      expect(r.baseRoll).toBe(1);
      expect(r.diceFormula).toBe('1d10! (Fumble!)');
      expect(r.details).toContain('Falha Crítica (1!): -4');
      expect(r.isCriticalSuccess).toBe(false);
    });
  });
});

describe('diceEngine — perícia: rolagem normal', () => {
  it('sem crítico: total = dado + atributo + perícia', () => {
    withEngine([4], () => {
      // valor 4→5 → total = 5 + 8 + 3 = 16
      const r = rollSkill(8, 3, { statName: 'TECH' });
      expect(r.total).toBe(16);
      expect(r.isCriticalSuccess).toBe(false);
      expect(r.isCriticalFailure).toBe(false);
      expect(r.diceFormula).toBe('1d10');
      expect(r.details).toContain('TECH (8)');
    });
  });
});

describe('diceEngine — dano (fórmula NdM±X + local de impacto)', () => {
  it('2d6+2: [4,5]+2 = 11 com local Cabeça (1) ×2', () => {
    withEngine([3, 4, 0], () => {
      // 3→4, 4→5 (2d6) +2 = 11; local 0→1 = Cabeça
      const r = rollDamage('2d6+2', { characterName: 'Vex', label: 'Dano da Arma: 9mm' });
      expect(r.total).toBe(11);
      expect(r.baseRoll).toBe(11);
      expect(r.rollType).toBe('DAMAGE');
      expect(r.details).toContain('2d6+2: [4, 5]+2 = 11');
      expect(r.details).toContain('Cabeça (1) [DANO DOBRADO X2!]');
      expect(r.isCriticalSuccess).toBe(false);
      expect(r.isCriticalFailure).toBe(false);
    });
  });

  it('1d6: total 6 com local Braço Direito (5)', () => {
    withEngine([5, 4], () => {
      const r = rollDamage('1d6', { label: 'Dano' });
      expect(r.total).toBe(6);
      expect(r.details).toContain('Braço Direito (5)');
    });
  });

  it('fórmula inválida lança erro (contrato do motor)', () => {
    expect(() => rollDamage('abc')).toThrow();
  });
});

describe('diceEngine — death save (1d10 ≤ BODY)', () => {
  it('PASSOU: 4 ≤ 8', () => {
    withEngineOne(3, () => {
      // valor 3→4 ≤ 8
      const r = rollDeathSave(8, { characterName: 'Vex' });
      expect(r.isCriticalSuccess).toBe(true);
      expect(r.isCriticalFailure).toBe(false);
      expect(r.total).toBe(4);
      expect(r.details).toContain('PASSOU! Resultado 4 ≤ Corpo 8');
    });
  });

  it('FALHOU: 10 > 8', () => {
    withEngineOne(9, () => {
      // valor 9→10 > 8
      const r = rollDeathSave(8);
      expect(r.isCriticalSuccess).toBe(false);
      expect(r.isCriticalFailure).toBe(true);
      expect(r.details).toContain('FALHOU! Resultado 10 > Corpo 8');
    });
  });
});

describe('diceEngine — local de impacto (mapeamento exato)', () => {
  it('1 = Cabeça (dano ×2)', () => {
    withEngineOne(0, () => {
      const loc = rollLocation();
      expect(loc.roll).toBe(1);
      expect(loc.name).toBe('Cabeça (1) [DANO DOBRADO X2!]');
    });
  });

  it('5 = Braço Direito', () => {
    withEngineOne(4, () => {
      const loc = rollLocation();
      expect(loc.roll).toBe(5);
      expect(loc.name).toBe('Braço Direito (5)');
    });
  });

  it('9 = Perna Esquerda (9-0)', () => {
    withEngineOne(8, () => {
      const loc = rollLocation();
      expect(loc.roll).toBe(9);
      expect(loc.name).toBe('Perna Esquerda (9-0)');
    });
  });
});

describe('diceEngine — contrato do RollResult', () => {
  it('campos obrigatórios presentes e coerentes', () => {
    withEngineOne(4, () => {
      const r = rollSkill(5, 2, { characterName: 'Choom' });
      expect(r.id.startsWith('roll_')).toBe(true);
      expect(r.timestamp.length).toBeGreaterThan(0);
      expect(r.characterName).toBe('Choom');
      expect(r.label).toBeTruthy();
      expect(r.diceFormula).toBeTruthy();
      expect(r.details).toBeTruthy();
      expect(typeof r.total).toBe('number');
    });
  });

  it('characterName default = Edgerunner', () => {
    withEngineOne(4, () => {
      expect(rollSkill(1, 1).characterName).toBe('Edgerunner');
    });
  });
});

describe('diceEngine — distribuição (RNG seedado, 2000 rolagens)', () => {
  it('dano 2d6+2 fica na faixa 4..14 (min/max observados)', () => {
    withSeededEngine(1234, () => {
      let minDmg = Infinity;
      let maxDmg = -Infinity;
      for (let i = 0; i < 2000; i++) {
        const r = rollDamage('2d6+2');
        minDmg = Math.min(minDmg, r.total);
        maxDmg = Math.max(maxDmg, r.total);
        expect(r.total).toBeGreaterThanOrEqual(4);
        expect(r.total).toBeLessThanOrEqual(14);
      }
      expect(minDmg).toBe(4);
      expect(maxDmg).toBe(14);
    });
  });

  it('local de impacto: todas as 10 faces aparecem', () => {
    withSeededEngine(1234, () => {
      const facesSeen = new Set<number>();
      for (let i = 0; i < 2000; i++) {
        const loc = rollLocation();
        expect(loc.roll).toBeGreaterThanOrEqual(1);
        expect(loc.roll).toBeLessThanOrEqual(10);
        expect(loc.name.length).toBeGreaterThan(0);
        facesSeen.add(loc.roll);
      }
      expect(facesSeen.size).toBe(10);
    });
  });

  it('perícia: 10 faces, fumble < 0 e explosão > 10 observados', () => {
    withSeededEngine(1234, () => {
      const facesSeen = new Set<number>();
      let skillMin = Infinity;
      let skillMax = -Infinity;
      for (let i = 0; i < 2000; i++) {
        const r = rollSkill(0, 0); // só o dado
        facesSeen.add(r.baseRoll);
        skillMin = Math.min(skillMin, r.total);
        skillMax = Math.max(skillMax, r.total);
      }
      expect(facesSeen.size).toBe(10);
      expect(skillMin).toBeLessThan(0); // fumble reduz abaixo do mínimo normal
      expect(skillMax).toBeGreaterThan(10); // explosão ultrapassa 10
    });
  });
});

describe('diceEngine — determinismo (mesma seed → mesma sequência)', () => {
  it('repete exatamente a mesma sequência de dados', () => {
    withSeededEngine(77, () => {
      const seqA = [new DiceRoll('1d10').total, new DiceRoll('1d10').total, new DiceRoll('1d10').total];
      NumberGenerator.generator.engine = seedEngine(77);
      const seqB = [new DiceRoll('1d10').total, new DiceRoll('1d10').total, new DiceRoll('1d10').total];
      expect(seqA).toEqual(seqB);
    });
  });
});
