/**
 * G.3g (G.23 do ledger da G) — a perda de Humanidade sai da fórmula do implante
 * ============================================================================
 * Ao instalar, a perda era `2 + round(random × 6)` — de 2 a 8, qualquer que fosse
 * a fórmula do item: com `1d6`, 7 ou 8 em ~1 de cada 4 instalações; com `3d6`,
 * nunca mais de 8; com `0`, perdia 2. Duas fontes (S8, S1 — ver a conferência,
 * "Atributos correntes"): o custo é o do implante, rolado uma vez.
 */
import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { humanityCostIsReadable, rollHumanityLoss } from '../rules/character';
import { CyberwareManager } from '../features/sheet/CharacterSheet/CyberwareManager';
import { scriptedRng } from '../test/scriptedRng';
import type { CharacterSheet } from '../types/cyberpunk';

describe('G.23 — rollHumanityLoss (src/rules)', () => {
  it('"2d6" soma os dois dados', () => {
    expect(rollHumanityLoss(scriptedRng([3, 5]), '2d6')).toBe(8);
  });

  it('"1d6+1" soma o bônus', () => {
    expect(rollHumanityLoss(scriptedRng([6]), '1d6+1')).toBe(7);
  });

  it('um número vale o número, sem rolar', () => {
    const rng = vi.fn(() => 1);
    expect(rollHumanityLoss(rng, '3')).toBe(3);
    expect(rollHumanityLoss(rng, '0')).toBe(0);
    expect(rng).not.toHaveBeenCalled();
  });

  it('a perda nunca é negativa', () => {
    expect(rollHumanityLoss(scriptedRng([1]), '1d6-3')).toBe(0);
  });

  it('o que o parser não lê fica para o jogador digitar', () => {
    for (const cost of ['1d6/2', '0.5', '', 'muito']) {
      expect(rollHumanityLoss(() => 1, cost), cost).toBeNull();
      expect(humanityCostIsReadable(cost), cost).toBe(false);
    }
    expect(humanityCostIsReadable('2d6')).toBe(true);
    expect(humanityCostIsReadable('3')).toBe(true);
  });

  it('nunca um valor fora do que a fórmula permite', () => {
    let face = 0;
    const ciclo = (sides: number) => (face++ % sides) + 1;
    for (let i = 0; i < 60; i++) {
      const loss = rollHumanityLoss(ciclo, '3d6')!;
      expect(loss).toBeGreaterThanOrEqual(3);
      expect(loss).toBeLessThanOrEqual(18);
    }
  });
});

describe('G.23 — instalar um implante na ficha', () => {
  const SHEET = {
    stats: { INT: 6, REF: 8, TECH: 5, COOL: 6, ATTR: 5, LUCK: 5, MA: 6, BODY: 8, EMP: 8 },
    cyberware: []
  } as unknown as CharacterSheet;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** O Web Crypto devolvendo sempre 0: todo dado do `clientRng` sai 1. */
  function dadosEmUm() {
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(buf: T) => {
      if (buf) new Uint32Array(buf.buffer).fill(0);
      return buf;
    });
  }

  function ficha() {
    let atual = SHEET;
    const Ficha = () => {
      const [sheet, setSheet] = useState(SHEET);
      atual = sheet;
      return <CyberwareManager sheet={sheet} onChange={(u) => setSheet((s) => ({ ...s, ...u }))} />;
    };
    render(<Ficha />);
    return { implantes: () => atual.cyberware, user: userEvent.setup() };
  }

  async function instalar(f: ReturnType<typeof ficha>, nome: string, custo: string, digitado?: string) {
    await f.user.click(screen.getByRole('button', { name: /adicionar ciberimplante/i }));
    await f.user.type(screen.getByPlaceholderText(/Kerenzikov/), nome);
    const campo = screen.getByLabelText('Perda HL:');
    await f.user.clear(campo);
    await f.user.type(campo, custo);
    if (digitado !== undefined) await f.user.type(screen.getByLabelText(/perda que você rolou/i), digitado);
    await f.user.click(screen.getByRole('button', { name: 'Instalar' }));
  }

  it('"1d6" com o dado em 1 perde 1 — o código antigo nunca dava menos de 2', async () => {
    dadosEmUm();
    const f = ficha();
    await instalar(f, 'Olho cibernético', '1d6');
    expect(f.implantes().map((c) => [c.humanityLoss, c.actualHL])).toEqual([['1d6', 1]]);
  });

  it('"3d6" com os dados em 1 perde 3; "0" perde 0', async () => {
    dadosEmUm();
    const f = ficha();
    await instalar(f, 'Reflexos', '3d6');
    await instalar(f, 'Tatuagem luminosa', '0');
    expect(f.implantes().map((c) => c.actualHL)).toEqual([3, 0]);
  });

  it('"1d6/2" pede a perda ao jogador, e o botão espera o número', async () => {
    const f = ficha();
    await f.user.click(screen.getByRole('button', { name: /adicionar ciberimplante/i }));
    await f.user.type(screen.getByPlaceholderText(/Kerenzikov/), 'Interface');
    const campo = screen.getByLabelText('Perda HL:');
    await f.user.clear(campo);
    await f.user.type(campo, '1d6/2');
    expect((screen.getByRole('button', { name: 'Instalar' }) as HTMLButtonElement).disabled).toBe(true);

    await f.user.type(screen.getByLabelText(/perda que você rolou/i), '2');
    await f.user.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(f.implantes().map((c) => [c.humanityLoss, c.actualHL])).toEqual([['1d6/2', 2]]);
  });

  // Revisão da G.3: `1d6/2` pode dar 2,5 (a S8 não arredonda), mas a ficha guarda
  // a perda inteira. Com "2.5" o botão ficava desligado sem dizer por quê.
  it('o campo diz que a perda é inteira, e "2.5" não instala', async () => {
    const f = ficha();
    await f.user.click(screen.getByRole('button', { name: /adicionar ciberimplante/i }));
    await f.user.type(screen.getByPlaceholderText(/Kerenzikov/), 'Interface');
    const campo = screen.getByLabelText('Perda HL:');
    await f.user.clear(campo);
    await f.user.type(campo, '1d6/2');
    const digitada = screen.getByLabelText(/perda que você rolou/i);
    expect(digitada.closest('div')?.textContent).toMatch(/inteira/);

    await f.user.type(digitada, '2.5');
    expect((screen.getByRole('button', { name: 'Instalar' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
