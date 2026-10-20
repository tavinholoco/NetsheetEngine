/**
 * K.5b — O DECK E OS PROGRAMAS DO NETRUNNER (decisão 9: a ficha, sem a Net)
 * =========================================================================
 * As expectativas saem da tabela (src/rules/tables.ts), nunca da implementação:
 * o deck padrão (10 MU, Speed 0, Data Wall 2 — S6, S12, S13), o preço de cada
 * tipo (S8, S13) e de cada melhoria (S12, S13), e a iniciativa na Net,
 * 1d10 + REF + Speed (S1, S6). Os programas carregados ocupam a MU do deck.
 *
 * O validador: a ficha de antes da K.5 não tem deck nem programas, e abre como
 * abria (campo vazio, sem correção). O que vem do cliente é grampeado como o
 * resto da ficha — o teto das melhorias não é regra (o S12 e o S6 divergem), só
 * o grampo do absurdo.
 */
import { describe, it, expect } from 'vitest';
import {
  createDefaultDeck,
  deckCostEb,
  deckTotalMu,
  loadedProgramsMu,
  netInitiativeBonus
} from '../rules/netrun';
import { DECK_BASE, DECK_CHASSIS, DECK_EXTRA_MEMORY_MU, DECK_UPGRADE_EB, PROGRAM_CLASSES } from '../rules/tables';
import {
  DECK_CODE_GATE_MAX,
  DECK_DATA_WALL_MAX,
  DECK_SPEED_MAX,
  MAX_PROGRAMS,
  PROGRAM_MU_MAX,
  PROGRAM_STRENGTH_MAX,
  sanitizeCharacterSheet
} from '../rules/sheetSchema';
import type { Cyberdeck, NetProgram } from '../types/cyberpunk';

const BASE = {
  handle: 'Spider',
  role: 'Netrunner',
  stats: { INT: 9, REF: 7, TECH: 6, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 5, EMP: 6 },
  damagePoints: 0
};

function prog(mu: number, loaded = true, patch: Partial<NetProgram> = {}): NetProgram {
  return { id: `p${mu}${loaded}`, name: `MU ${mu}`, programClass: 'intrusion', strength: 4, mu, costEb: 400, loaded, ...patch };
}

describe('K.5b — o deck como sai da loja', () => {
  it('o deck novo é o padrão do livro', () => {
    const deck = createDefaultDeck();
    expect(deck).toMatchObject({ chassis: 'standard', speed: DECK_BASE.speed, dataWall: DECK_BASE.dataWall, codeGate: DECK_BASE.codeGate, extraMemory: false });
    expect(deckTotalMu(deck)).toBe(DECK_BASE.mu);
  });

  it('o segundo módulo de memória soma a MU dele', () => {
    expect(deckTotalMu({ ...createDefaultDeck(), extraMemory: true })).toBe(DECK_BASE.mu + DECK_EXTRA_MEMORY_MU);
  });
});

describe('K.5b — o preço do deck pela tabela', () => {
  it.each(DECK_CHASSIS.map((c) => [c.name, c] as const))('%s, sem melhoria, custa o preço do tipo', (_name, chassis) => {
    expect(deckCostEb({ ...createDefaultDeck(), chassis: chassis.id })).toBe(chassis.costEb);
  });

  it('cada melhoria soma o seu preço: Speed 2, Data Wall 5 e o segundo módulo', () => {
    const deck: Cyberdeck = { ...createDefaultDeck(), chassis: 'cellular', speed: 2, dataWall: 5, extraMemory: true };
    const cellular = DECK_CHASSIS.find((c) => c.id === 'cellular')!.costEb;
    expect(deckCostEb(deck)).toBe(
      cellular +
        2 * DECK_UPGRADE_EB.speedPerPoint +
        (5 - DECK_BASE.dataWall) * DECK_UPGRADE_EB.dataWallPerPoint +
        DECK_UPGRADE_EB.extraMemory
    );
  });

  it('Data Wall abaixo do padrão não desconta do preço', () => {
    expect(deckCostEb({ ...createDefaultDeck(), dataWall: 0 })).toBe(DECK_CHASSIS[0].costEb);
  });
});

describe('K.5b — a MU dos programas e a iniciativa na Net', () => {
  it('só o programa carregado ocupa a MU do deck', () => {
    expect(loadedProgramsMu([prog(2), prog(3), prog(4, false)])).toBe(5);
    expect(loadedProgramsMu(undefined)).toBe(0);
  });

  it('a iniciativa na Net soma o REF e a Speed do deck (o 1d10 é a rolagem)', () => {
    expect(netInitiativeBonus(7, { ...createDefaultDeck(), speed: 2 })).toBe(9);
    expect(netInitiativeBonus(7, null)).toBe(7);
  });

  it('as onze classes do livro, e uma para o programa de suplemento', () => {
    expect(PROGRAM_CLASSES).toHaveLength(12);
    expect(PROGRAM_CLASSES.at(-1)!.id).toBe('other');
  });
});

describe('K.5b — o deck e os programas pelo validador', () => {
  it('a ficha de antes da K.5 abre sem deck e sem programas, e sem correção', () => {
    const r = sanitizeCharacterSheet(BASE)!;
    expect(r.sheet.deck).toBeUndefined();
    expect(r.sheet.programs).toEqual([]);
    expect(r.changed).toEqual([]);
  });

  it('um deck válido passa como veio', () => {
    const deck: Cyberdeck = { model: 'Zetatech Paraline', chassis: 'portable', speed: 1, dataWall: 4, codeGate: 2, extraMemory: true };
    const programs = [prog(2, true, { name: 'Hammer' }), prog(1, false, { name: 'Shield', programClass: 'protection' })];
    const r = sanitizeCharacterSheet({ ...BASE, deck, programs })!;
    expect(r.sheet.deck).toEqual(deck);
    expect(r.sheet.programs).toEqual(programs);
    expect(r.changed).toEqual([]);
  });

  it('grampeia o deck forjado: Speed, Data Wall e Code Gate no grampo, tipo que não existe vira o padrão', () => {
    const r = sanitizeCharacterSheet({
      ...BASE,
      deck: { model: 'X', chassis: 'quantum', speed: 99, dataWall: -3, codeGate: 999, extraMemory: 'sim', lixo: 1 }
    })!;
    expect(r.sheet.deck).toEqual({ model: 'X', chassis: 'standard', speed: DECK_SPEED_MAX, dataWall: 0, codeGate: DECK_CODE_GATE_MAX, extraMemory: false });
    expect(r.changed).toEqual(expect.arrayContaining(['deck.chassis', 'deck.speed', 'deck.dataWall', 'deck.codeGate']));
    expect(DECK_DATA_WALL_MAX).toBeGreaterThanOrEqual(10);
  });

  it('deck que não é objeto some, e o validador diz', () => {
    const r = sanitizeCharacterSheet({ ...BASE, deck: 'deck' })!;
    expect(r.sheet.deck).toBeUndefined();
    expect(r.changed).toContain('deck');
  });

  it('programa forjado é grampeado; classe que não existe vira "Outra"; o que não é objeto some', () => {
    const r = sanitizeCharacterSheet({
      ...BASE,
      programs: [{ id: 'a', name: 'Hellhound', programClass: 'nuke', strength: 500, mu: 99, costEb: -1, loaded: true }, 'x']
    })!;
    expect(r.sheet.programs).toEqual([
      { id: 'a', name: 'Hellhound', programClass: 'other', strength: PROGRAM_STRENGTH_MAX, mu: PROGRAM_MU_MAX, costEb: 0, loaded: true }
    ]);
    expect(r.changed).toEqual(expect.arrayContaining(['programs[0].programClass', 'programs[0].strength', 'programs[0].mu', 'programs[0].costEb', 'programs[1]']));
  });

  it(`corta a lista de programas acima de ${MAX_PROGRAMS}`, () => {
    const r = sanitizeCharacterSheet({ ...BASE, programs: Array.from({ length: MAX_PROGRAMS + 5 }, (_, i) => prog(1, true, { id: `p${i}` })) })!;
    expect(r.sheet.programs).toHaveLength(MAX_PROGRAMS);
    expect(r.changed).toContain('programs');
  });
});
