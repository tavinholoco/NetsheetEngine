/**
 * G.3f (G.12 do ledger da G) — o atributo digitado entra como digitado
 * ===================================================================
 * Reproduzido em 10/10: selecionar o INT e digitar 12 deixava 15. O grampo
 * (2 a 15) rodava a cada tecla: o "1" virava 2, e o "2" seguinte fazia "22",
 * que virava 15. Nenhum valor de 10 a 14 entrava pelo teclado.
 */
import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatBlock } from '../features/sheet/CharacterSheet/StatBlock';
import type { CharacterSheet } from '../types/cyberpunk';

const STATS = { INT: 6, REF: 8, TECH: 5, COOL: 6, ATTR: 5, LUCK: 5, MA: 6, BODY: 8, EMP: 5 };
const SHEET = {
  id: 's', handle: 'Vex', realName: '', role: 'Solo', specialAbilityName: 'Combat Sense', specialAbilityRank: 2,
  avatarUrl: '', age: 20, sex: '', eurodollars: 0, stats: STATS, currentStats: { ...STATS }, woundLevel: 0, damagePoints: 0,
  skills: [], cyberware: [], armor: [], weapons: [], gearNotes: '', createdAt: '', updatedAt: '',
  lifepath: { style: '', motivation: '', valuedPerson: '', valuedPossession: '', lifeEvents: [] }
} as unknown as CharacterSheet;

/** A ficha de verdade: o valor gravado volta para o campo, como no app. */
function ficha() {
  const onChange = vi.fn();
  let atual = SHEET;
  const Ficha = () => {
    const [sheet, setSheet] = useState(SHEET);
    atual = sheet;
    return (
      <StatBlock
        sheet={sheet}
        onChange={(u) => {
          onChange(u);
          setSheet((s) => ({ ...s, ...u }));
        }}
      />
    );
  };
  render(<Ficha />);
  return {
    onChange,
    int: () => screen.getByRole('spinbutton', { name: /^INT/ }) as HTMLInputElement,
    gravado: () => atual.stats.INT,
    user: userEvent.setup()
  };
}

describe('G.12 — o atributo digitado entra como digitado', () => {
  it('digitar "12" grava 12', async () => {
    const f = ficha();
    await f.user.clear(f.int());
    await f.user.type(f.int(), '12');
    expect(f.int().value).toBe('12');
    expect(f.gravado()).toBe(12);
  });

  it('o "1" sozinho não vira 2 enquanto se digita', async () => {
    const f = ficha();
    await f.user.clear(f.int());
    await f.user.type(f.int(), '1');
    expect(f.int().value).toBe('1');
    expect(f.onChange.mock.calls.map(([u]) => u.stats?.INT)).not.toContain(2);
  });

  it('sair do campo com 40 grava 15', async () => {
    const f = ficha();
    await f.user.clear(f.int());
    await f.user.type(f.int(), '40');
    await f.user.tab();
    expect(f.gravado()).toBe(15);
    expect(f.int().value).toBe('15');
  });

  it('sair do campo com 1 grava 2', async () => {
    const f = ficha();
    await f.user.clear(f.int());
    await f.user.type(f.int(), '1');
    await f.user.tab();
    expect(f.gravado()).toBe(2);
  });

  it('sair do campo vazio mantém o valor que estava', async () => {
    const f = ficha();
    await f.user.clear(f.int());
    await f.user.tab();
    expect(f.gravado()).toBe(6);
    expect(f.int().value).toBe('6');
  });

  it('os botões − e + continuam grampeados', async () => {
    const f = ficha();
    const mais = screen.getAllByRole('button', { name: '+' })[0];
    for (let i = 0; i < 12; i++) await f.user.click(mais);
    expect(f.gravado()).toBe(15);
  });
});
