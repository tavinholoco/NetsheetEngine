/**
 * Fase 9 (T9.2) — UNIT TESTS DE ESTATÍSTICAS DERIVADAS
 * (src/utils/derivedStats.ts)
 * =====================================================
 * Regras puras extraídas do StatBlock, CyberwareManager e WeaponsArmor:
 * Humanidade (EMP × 10), perda de humanidade (Σ actualHL),
 * Run/Walk (MA × 3) e SP de armadura por localização.
 */
import { describe, it, expect } from 'vitest';
import { BODY_TYPE_TABLE } from '../rules/tables';
import { bodyTypeFor, btmFromBody } from '../rules/character';
import {
  humanityFromEmp,
  humanityLossTotal,
  humanityRemaining,
  runFromMa,
  walkFromMa,
  armorSpAt
} from '../utils/derivedStats';
import type { ArmorPiece, CyberwareItem } from '../types/cyberpunk';

const cw = (actualHL: number): Pick<CyberwareItem, 'actualHL'> => ({ actualHL });

const armorPiece = (location: ArmorPiece['location'], sp: number, equipped = true): ArmorPiece => ({
  id: `arm_${location}_${sp}`,
  name: `Armadura ${location}`,
  location,
  sp,
  ev: 0,
  equipped
});

describe('BTM — tabela do livro (BODY_TYPE_TABLE), só BODY', () => {
  // Derivado da tabela, não da implementação. Os 15 casos antigos codificavam
  // a tabela errada (BODY + REF, de +5 a −2) e passavam contra ela.
  const cases = BODY_TYPE_TABLE.flatMap((row) =>
    [row.minBody, Math.min(row.maxBody, 15)].map((body) => [body, row.bodyType, row.btm] as const)
  );
  it.each(cases)('BODY %i (%s) → BTM %i', (body, _tipo, btm) => {
    expect(btmFromBody(body)).toBe(btm);
    expect(bodyTypeFor(body).btm).toBe(btm);
  });

  it('as faixas cobrem 2..15 sem buraco nem sobreposição', () => {
    for (let body = 2; body <= 15; body++) {
      expect(BODY_TYPE_TABLE.filter((r) => body >= r.minBody && body <= r.maxBody)).toHaveLength(1);
    }
  });

  it('o BTM nunca é positivo e nunca passa de −5', () => {
    for (let body = 0; body <= 20; body++) {
      expect(btmFromBody(body)).toBeLessThanOrEqual(0);
      expect(btmFromBody(body)).toBeGreaterThanOrEqual(-5);
    }
  });

  it('BODY abaixo de 2 ou inválido cai na primeira linha', () => {
    expect(btmFromBody(1)).toBe(0);
    expect(btmFromBody(Number.NaN)).toBe(0);
  });
});

describe('humanidade — EMP × 10', () => {
  it('EMP 2 → 20', () => expect(humanityFromEmp(2)).toBe(20));
  it('EMP 5 → 50', () => expect(humanityFromEmp(5)).toBe(50));
  it('EMP 10 → 100 (máximo na criação)', () => expect(humanityFromEmp(10)).toBe(100));
});

describe('perda de humanidade — Σ actualHL dos ciberimplantes', () => {
  it('sem cromo → perda 0', () => {
    expect(humanityLossTotal([])).toBe(0);
  });

  it('soma os actualHL (8 + 6 = 14)', () => {
    expect(humanityLossTotal([cw(8), cw(6)])).toBe(14);
  });

  it('actualHL ausente é tratado como 0 (defensivo)', () => {
    const items = [{ actualHL: undefined }, cw(4)] as unknown as Pick<CyberwareItem, 'actualHL'>[];
    expect(humanityLossTotal(items)).toBe(4);
  });
});

describe('humanityRemaining — EMP × 10 − Σ actualHL (nunca negativo)', () => {
  it('sem cromo → EMP × 10', () => {
    expect(humanityRemaining(5, [])).toBe(50);
  });

  it('desconta a perda real (50 − 14 = 36)', () => {
    expect(humanityRemaining(5, [cw(8), cw(6)])).toBe(36);
  });

  it('nunca fica negativa (clamp em 0 = cyberpsychose)', () => {
    expect(humanityRemaining(5, [cw(60)])).toBe(0);
    expect(humanityRemaining(2, [cw(8), cw(6), cw(20)])).toBe(0);
  });
});

describe('movimento — Run/Walk derivados de MA', () => {
  it('MA 8 → Run 24 m, Walk 12 m', () => {
    expect(runFromMa(8)).toBe(24);
    expect(walkFromMa(8)).toBe(12);
  });

  it('MA 10 → Run 30 m, Walk 15 m', () => {
    expect(runFromMa(10)).toBe(30);
    expect(walkFromMa(10)).toBe(15);
  });

  it('Walk arredonda para baixo (MA 3 → Run 9 → Walk 4)', () => {
    expect(walkFromMa(3)).toBe(4);
  });
});

describe('armorSpAt — SP da peça equipada por localização', () => {
  it('sem armadura → SP 0', () => {
    expect(armorSpAt([], 'Torso')).toBe(0);
  });

  it('retorna o SP da peça equipada na localização', () => {
    const armor = [
      armorPiece('Head', 14),
      armorPiece('Torso', 18),
      armorPiece('Right Arm', 12),
      armorPiece('Right Leg', 10)
    ];
    expect(armorSpAt(armor, 'Head')).toBe(14);
    expect(armorSpAt(armor, 'Torso')).toBe(18);
    expect(armorSpAt(armor, 'Right Arm')).toBe(12);
    expect(armorSpAt(armor, 'Right Leg')).toBe(10);
  });

  it('localização sem cobertura → SP 0', () => {
    const armor = [armorPiece('Head', 14)];
    expect(armorSpAt(armor, 'Left Leg')).toBe(0);
  });

  it('peça DESEQUIPADA não protege (SP 0)', () => {
    const armor = [armorPiece('Head', 14, false)];
    expect(armorSpAt(armor, 'Head')).toBe(0);
  });

  it('com múltiplas peças na mesma localização, a equipada vence', () => {
    const armor = [armorPiece('Torso', 4, false), armorPiece('Torso', 18, true)];
    expect(armorSpAt(armor, 'Torso')).toBe(18);
  });
});
