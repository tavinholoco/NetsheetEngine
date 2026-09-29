/**
 * Fase D (D.1) — DO DANO AO FERIMENTO, CONTRA A TABELA DO LIVRO
 * =============================================================
 * Os casos derivam de `src/rules/tables.ts` (BTM, trilha, local de impacto) e
 * da ordem decidida pelo dono (decisão 6: armadura → BTM mín. 1 → ×2 na
 * cabeça). Nenhum número daqui foi copiado da implementação.
 */
import { describe, it, expect } from 'vitest';
import {
  applyHit,
  pointsFromWoundLevel,
  resolveHit,
  woundLevelFromPoints,
  woundStateOf
} from '../rules/damage';
import {
  BODY_TYPE_TABLE,
  DAMAGE_POINTS_PER_WOUND_LEVEL,
  HIT_LOCATIONS,
  SEVERE_HIT_THRESHOLD,
  WOUND_TRACK,
  WOUND_TRACK_POINTS
} from '../rules/tables';

const ILESO = { damagePoints: 0, woundLevel: 0, isDead: false };

describe('D.1 — armadura, depois BTM (mínimo 1), depois ×2 na cabeça', () => {
  for (const row of BODY_TYPE_TABLE) {
    it(`tronco, BTM ${row.btm} (${row.bodyType}): 20 contra SP 10 → ${Math.max(1, 10 + row.btm)}`, () => {
      const s = resolveHit({ raw: 20, sp: 10, btm: row.btm, location: 'Torso' });
      expect(s.afterArmor).toBe(10);
      expect(s.penetrated).toBe(true);
      expect(s.final).toBe(Math.max(1, 10 + row.btm));
    });
  }

  it('não furou a armadura: nenhum dano, e o BTM não entra', () => {
    const s = resolveHit({ raw: 10, sp: 10, btm: -3, location: 'Torso' });
    expect(s.penetrated).toBe(false);
    expect(s.final).toBe(0);
  });

  it('furou por 1 contra BTM −5: o BTM nunca zera o dano (fica 1)', () => {
    expect(resolveHit({ raw: 11, sp: 10, btm: -5, location: 'Torso' }).final).toBe(1);
  });

  it('cabeça, o exemplo da decisão 6: 10 passam, BTM −3 → (10 − 3) × 2 = 14', () => {
    const s = resolveHit({ raw: 20, sp: 10, btm: -3, location: 'Head' });
    expect(s.afterBtm).toBe(7);
    expect(s.multiplier).toBe(2);
    expect(s.final).toBe(14);
  });

  it('cabeça: o mínimo depois do ×2 é 2', () => {
    expect(resolveHit({ raw: 11, sp: 10, btm: -5, location: 'Head' }).final).toBe(2);
  });

  it('o multiplicador de cada local vem da tabela de local de impacto', () => {
    for (const loc of HIT_LOCATIONS) {
      expect(resolveHit({ raw: 5, sp: 0, btm: 0, location: loc.location }).final).toBe(5 * loc.damageMultiplier);
    }
  });
});

describe('D.1 — a trilha conta pontos, o nível é derivado', () => {
  it(`a trilha tem ${WOUND_TRACK_POINTS} pontos: ${WOUND_TRACK.length - 1} níveis × ${DAMAGE_POINTS_PER_WOUND_LEVEL}`, () => {
    expect(WOUND_TRACK_POINTS).toBe(40);
  });

  it('cada ponto de 0 a 40 cai no nível da sua caixa', () => {
    for (let p = 0; p <= WOUND_TRACK_POINTS; p++) {
      const expected = p === 0 ? 0 : Math.ceil(p / DAMAGE_POINTS_PER_WOUND_LEVEL);
      expect(woundLevelFromPoints(p)).toBe(expected);
      expect(WOUND_TRACK[expected]).toBeDefined();
    }
  });

  it('ficha antiga (só nível) converte para o mínimo da caixa, e volta para o mesmo nível', () => {
    for (const row of WOUND_TRACK) {
      const points = pointsFromWoundLevel(row.level);
      expect(points).toBe(row.level === 0 ? 0 : DAMAGE_POINTS_PER_WOUND_LEVEL * (row.level - 1) + 1);
      expect(woundLevelFromPoints(points)).toBe(row.level);
    }
  });

  it('os pontos mandam: um woundLevel velho ao lado deles é ignorado', () => {
    expect(woundStateOf({ damagePoints: 6, woundLevel: 0 })).toEqual({ damagePoints: 6, woundLevel: 2, isDead: false });
  });

  it('sem pontos, deriva do nível (ficha de antes da Fase D)', () => {
    expect(woundStateOf({ woundLevel: 3 })).toEqual({ damagePoints: 9, woundLevel: 3, isDead: false });
  });
});

describe('D.1 — aplicar o acerto na trilha', () => {
  /** Acerto no tronco, sem armadura nem BTM: o dano final é o próprio `final`. */
  const hit = (final: number) => resolveHit({ raw: final, sp: 0, btm: 0, location: 'Torso' });

  it('o resto da caixa conta: 6 e depois 3 são 9 pontos — Crítico', () => {
    const first = applyHit(ILESO, hit(6), 'Torso').after;
    expect(first).toEqual({ damagePoints: 6, woundLevel: 2, isDead: false });
    // Só com o nível, o 6 virava "Sério" (5 pontos, o mínimo da caixa) e o 3
    // seguinte deixava em 8 — ainda Sério.
    expect(applyHit(first, hit(3), 'Torso').after.woundLevel).toBe(3);
  });

  it(`exatamente ${WOUND_TRACK_POINTS} pontos: Mortal 6, ainda vivo`, () => {
    const out = applyHit(ILESO, hit(WOUND_TRACK_POINTS), 'Torso');
    expect(out.after).toEqual({ damagePoints: 40, woundLevel: 10, isDead: false });
    expect(out.killed).toBeNull();
  });

  it('um ponto além da trilha mata, e os pontos param em 40', () => {
    const out = applyHit({ damagePoints: 38, woundLevel: 10, isDead: false }, hit(3), 'Torso');
    expect(out.after).toEqual({ damagePoints: 40, woundLevel: 10, isDead: true });
    expect(out.killed).toBe('track');
  });

  it(`cabeça com mais de ${SEVERE_HIT_THRESHOLD} (já dobrado): morte instantânea`, () => {
    const steps = resolveHit({ raw: 5, sp: 0, btm: 0, location: 'Head' }); // 5 × 2 = 10
    const out = applyHit(ILESO, steps, 'Head');
    expect(out.killed).toBe('head');
    expect(out.after.isDead).toBe(true);
  });

  it(`cabeça com exatamente ${SEVERE_HIT_THRESHOLD}: vivo`, () => {
    const steps = resolveHit({ raw: 4, sp: 0, btm: 0, location: 'Head' }); // 4 × 2 = 8
    expect(applyHit(ILESO, steps, 'Head').killed).toBeNull();
  });

  it(`membro com mais de ${SEVERE_HIT_THRESHOLD}: perda do membro, não morte`, () => {
    for (const loc of HIT_LOCATIONS.filter((l) => l.limb)) {
      const out = applyHit(ILESO, resolveHit({ raw: 9, sp: 0, btm: 0, location: loc.location }), loc.location);
      expect(out.limbLost).toBe(true);
      expect(out.killed).toBeNull();
    }
  });

  it(`tronco com mais de ${SEVERE_HIT_THRESHOLD}: sem perda de membro`, () => {
    expect(applyHit(ILESO, hit(9), 'Torso').limbLost).toBe(false);
  });

  it('acerto que não furou não muda a trilha', () => {
    const steps = resolveHit({ raw: 10, sp: 12, btm: -2, location: 'Torso' });
    expect(applyHit(ILESO, steps, 'Torso').after).toEqual(ILESO);
  });

  it('morto continua morto', () => {
    const dead = { damagePoints: 12, woundLevel: 3, isDead: true };
    expect(applyHit(dead, hit(1), 'Torso').after.isDead).toBe(true);
  });
});
