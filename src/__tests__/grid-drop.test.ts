/**
 * L.3c (G.21) — O ARRASTO NO GRID TÁTICO, SEM A TELA
 * ===================================================
 * O `gridDrop` é a conta que o TacticalGrid fazia dentro do handler: qual setor
 * está sob o ponteiro, e como fica o grid depois de soltar. O GM move qualquer
 * token e põe a ficha da barra lateral no grid; o jogador só move o próprio
 * token (o servidor confere de novo, T5.3). O que o drop não entende não muda nada.
 */
import { describe, it, expect } from 'vitest';
import { gridAfterDrop, sectorFromPoint } from '../features/multiplayer/gridDrop';
import type { TacticalGridState } from '../types/multiplayer';

const RECT = { left: 100, top: 50, width: 500, height: 400 };

function grid(): TacticalGridState {
  return {
    rows: 8,
    cols: 10,
    theme: 'alley',
    tokens: [
      { id: 'token_vex', name: 'Vex', type: 'player', x: 0, y: 0, peerId: 'vex' },
      { id: 'token_rook', name: 'Rook', type: 'player', x: 1, y: 1, peerId: 'rook' },
      { id: 'cover_1', name: 'Barricada', type: 'cover', x: 5, y: 5, spCover: 15 }
    ]
  };
}

const tokenDrag = (tokenId: string) => JSON.stringify({ type: 'token_drag', tokenId });
const characterDrag = (data: Record<string, unknown>) => JSON.stringify({ type: 'character_drag', ...data });

describe('sectorFromPoint — o setor sob o ponteiro', () => {
  it('divide o canvas em colunas e linhas iguais', () => {
    // 10 colunas de 50 px e 8 linhas de 50 px, a partir de (100, 50).
    expect(sectorFromPoint(RECT, 100, 50, 10, 8)).toEqual({ x: 0, y: 0 });
    expect(sectorFromPoint(RECT, 149, 99, 10, 8)).toEqual({ x: 0, y: 0 });
    expect(sectorFromPoint(RECT, 150, 100, 10, 8)).toEqual({ x: 1, y: 1 });
    expect(sectorFromPoint(RECT, 375, 275, 10, 8)).toEqual({ x: 5, y: 4 });
  });

  it('fora do canvas, prende no setor da borda', () => {
    expect(sectorFromPoint(RECT, 0, 0, 10, 8)).toEqual({ x: 0, y: 0 });
    expect(sectorFromPoint(RECT, 2000, 2000, 10, 8)).toEqual({ x: 9, y: 7 });
    // A borda direita e a de baixo são do último setor, não de um setor a mais.
    expect(sectorFromPoint(RECT, 600, 450, 10, 8)).toEqual({ x: 9, y: 7 });
  });

  it('canvas sem tamanho (escondido) não tem setor', () => {
    expect(sectorFromPoint({ ...RECT, width: 0 }, 150, 100, 10, 8)).toBeNull();
    expect(sectorFromPoint({ ...RECT, height: 0 }, 150, 100, 10, 8)).toBeNull();
  });
});

describe('gridAfterDrop — o token que já está no grid', () => {
  it('o GM move qualquer token', () => {
    const next = gridAfterDrop(grid(), tokenDrag('token_rook'), { x: 7, y: 3 }, 'gm', 'gm-peer');
    expect(next?.tokens.find((t) => t.id === 'token_rook')).toMatchObject({ x: 7, y: 3 });
    expect(next?.tokens.find((t) => t.id === 'token_vex')).toMatchObject({ x: 0, y: 0 });
  });

  it('o jogador move o próprio token', () => {
    const next = gridAfterDrop(grid(), tokenDrag('token_vex'), { x: 2, y: 6 }, 'player', 'vex');
    expect(next?.tokens.find((t) => t.id === 'token_vex')).toMatchObject({ x: 2, y: 6 });
  });

  it('o jogador não move o token de outro, nem a cobertura', () => {
    expect(gridAfterDrop(grid(), tokenDrag('token_rook'), { x: 2, y: 6 }, 'player', 'vex')).toBeNull();
    expect(gridAfterDrop(grid(), tokenDrag('cover_1'), { x: 2, y: 6 }, 'player', 'vex')).toBeNull();
  });

  it('token que não está no grid não muda nada', () => {
    expect(gridAfterDrop(grid(), tokenDrag('sumiu'), { x: 2, y: 6 }, 'gm', 'gm-peer')).toBeNull();
  });

  it('não mexe no grid de entrada', () => {
    const before = grid();
    gridAfterDrop(before, tokenDrag('token_vex'), { x: 9, y: 7 }, 'gm', 'gm-peer');
    expect(before).toEqual(grid());
  });
});

describe('gridAfterDrop — a ficha da barra lateral', () => {
  it('só o GM põe ficha no grid', () => {
    const drag = characterDrag({ peerId: 'nova', handle: 'Nova', role: 'Netrunner', isNpc: false, hp: 2 });
    expect(gridAfterDrop(grid(), drag, { x: 4, y: 4 }, 'player', 'nova')).toBeNull();
  });

  it('o jogador vira token de jogador, com a função e o ferimento da ficha', () => {
    const drag = characterDrag({ peerId: 'nova', handle: 'Nova', role: 'Netrunner', isNpc: false, hp: 2 });
    const next = gridAfterDrop(grid(), drag, { x: 4, y: 4 }, 'gm', 'gm-peer');
    expect(next?.tokens).toHaveLength(4);
    expect(next?.tokens[3]).toEqual({
      id: 'token_nova',
      name: 'Nova',
      type: 'player',
      x: 4,
      y: 4,
      peerId: 'nova',
      role: 'Netrunner',
      hp: 2,
      color: '#06b6d4'
    });
  });

  it('o NPC vira token de NPC; sem função, Solo; sem ferimento, 0', () => {
    const drag = characterDrag({ peerId: 'ganger', handle: 'Ganger', isNpc: true });
    const next = gridAfterDrop(grid(), drag, { x: 8, y: 2 }, 'gm', 'gm-peer');
    expect(next?.tokens[3]).toMatchObject({
      id: 'npc_token_ganger',
      type: 'npc',
      role: 'Solo',
      hp: 0,
      color: '#ef4444'
    });
  });

  it('a ficha que já tem token move o token, sem duplicar', () => {
    const drag = characterDrag({ peerId: 'rook', handle: 'Rook', role: 'Solo', isNpc: false, hp: 0 });
    const next = gridAfterDrop(grid(), drag, { x: 9, y: 0 }, 'gm', 'gm-peer');
    expect(next?.tokens).toHaveLength(3);
    expect(next?.tokens.find((t) => t.id === 'token_rook')).toMatchObject({ x: 9, y: 0 });
  });
});

describe('gridAfterDrop — o que não veio deste grid', () => {
  it.each([
    ['vazio', ''],
    ['texto solto', 'um arquivo qualquer'],
    ['JSON nulo', 'null'],
    ['um número', '5'],
    ['outro tipo', JSON.stringify({ type: 'file_drop' })]
  ])('%s não muda nada', (_nome, dataStr) => {
    expect(gridAfterDrop(grid(), dataStr, { x: 1, y: 1 }, 'gm', 'gm-peer')).toBeNull();
  });
});
