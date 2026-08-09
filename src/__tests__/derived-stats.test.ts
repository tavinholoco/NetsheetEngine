/**
 * Fase 9 (T9.2) — UNIT TESTS DE ESTATÍSTICAS DERIVADAS
 * (src/utils/derivedStats.ts)
 * =====================================================
 * Regras puras extraídas do StatBlock, CyberwareManager e WeaponsArmor:
 * BTM (BODY + REF), Humanidade (EMP × 10), perda de humanidade (Σ actualHL),
 * Run/Walk (MA × 3) e SP de armadura por localização.
 */
import { describe, it, expect } from 'vitest';
import {
  btmFromStats,
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

describe('btmFromStats — tabela CP2020 sobre BODY + REF', () => {
  const cases: Array<[number, number, number]> = [
    // [body, ref, BTM esperado] — limites exatos da tabela
    [10, 2, -2], // 12 → −2 (abaixo de 14)
    [8, 6, -1], //  14 → −1
    [10, 5, -1], // 15 → −1
    [8, 8, 0], //   16 → 0
    [10, 7, 0], //  17 → 0
    [10, 8, 1], //  18 → +1
    [10, 9, 1], //  19 → +1
    [10, 10, 2], // 20 → +2
    [11, 10, 2], // 21 → +2
    [12, 10, 3], // 22 → +3
    [14, 10, 4], // 24 → +4
    [15, 11, 5], // 26 → +5
    [15, 15, 5] //  30 → +5 (teto)
  ];
  it.each(cases)('BODY %i + REF %i → BTM %i', (body, ref, expected) => {
    expect(btmFromStats(body, ref)).toBe(expected);
  });

  it('é simétrico em BODY/REF (soma é o que importa)', () => {
    expect(btmFromStats(6, 10)).toBe(btmFromStats(10, 6)); // 16 → 0
    expect(btmFromStats(2, 12)).toBe(btmFromStats(12, 2)); // 14 → −1
  });

  it('valores mínimos (2+2=4) ficam no piso −2', () => {
    expect(btmFromStats(2, 2)).toBe(-2);
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
