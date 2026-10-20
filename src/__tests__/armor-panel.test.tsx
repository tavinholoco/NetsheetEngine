/**
 * K.2b — a tela da armadura por peça
 * ==================================
 * O SP de cada local é o resultado das peças vestidas (a regra, não um número
 * digitado), e a peça editada sai no formato da K.2 — a ficha antiga, com um
 * `location` por peça, é convertida na primeira edição.
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ArmorPanel } from '../features/sheet/CharacterSheet/ArmorPanel';
import { createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import { armorLayerBonus } from '../rules/damage';
import type { ArmorPiece, CharacterSheet } from '../types/cyberpunk';

afterEach(cleanup);

function montar(armor: ArmorPiece[]) {
  let atual: CharacterSheet = { ...createBlankCharacterSheet(), armor };
  const Ficha = () => {
    const [sheet, setSheet] = useState(atual);
    atual = sheet;
    return <ArmorPanel sheet={sheet} onChange={(u) => setSheet((s) => ({ ...s, ...u }))} />;
  };
  render(<Ficha />);
  return { user: userEvent.setup(), armadura: () => atual.armor, sp: (loc: string) => screen.getByTestId(`sp-${loc}`).textContent };
}

const jaqueta: ArmorPiece = { id: 'j', name: 'Jaqueta', locations: ['Torso', 'Right Arm', 'Left Arm'], sp: 14, ev: 0, equipped: true };

describe('K.2b — a armadura por peça na ficha', () => {
  it('o SP de cada local sai das peças: a jaqueta cobre o tronco e os braços', () => {
    const f = montar([jaqueta]);
    expect(f.sp('Torso')).toBe('SP 14');
    expect(f.sp('Left Arm')).toBe('SP 14');
    expect(f.sp('Head')).toBe('SP 0');
  });

  it('cobrir mais um local muda o SP dele', async () => {
    const f = montar([jaqueta]);
    const grupo = screen.getByRole('group', { name: /jaqueta cobre/i });
    await f.user.click(within(grupo).getByRole('button', { name: 'Cab' }));
    expect(f.armadura()[0].locations).toEqual(['Head', 'Torso', 'Right Arm', 'Left Arm']);
    expect(f.sp('Head')).toBe('SP 14');
  });

  it('a última cobertura da peça não sai — sem local, o validador a apagaria', async () => {
    const f = montar([{ ...jaqueta, locations: ['Torso'] }]);
    const grupo = screen.getByRole('group', { name: /jaqueta cobre/i });
    await f.user.click(within(grupo).getByRole('button', { name: 'Tron' }));
    expect(f.armadura()[0].locations).toEqual(['Torso']);
  });

  it('uma segunda peça no mesmo local combina pela tabela', async () => {
    const f = montar([{ ...jaqueta, sp: 10, locations: ['Torso'] }]);
    await f.user.click(screen.getByRole('button', { name: /adicionar peça/i }));
    // A peça nova entra no tronco com SP 10: diferença 0.
    expect(f.sp('Torso')).toBe(`SP ${10 + armorLayerBonus(0)}`);
  });

  it('despir a peça tira a proteção', async () => {
    const f = montar([jaqueta]);
    await f.user.click(screen.getByRole('checkbox', { name: /jaqueta vestida/i }));
    expect(f.sp('Torso')).toBe('SP 0');
  });

  it('K.2c — o EV das peças vestidas aparece, e sai quando a peça sai', async () => {
    const f = montar([{ ...jaqueta, ev: 1 }, { ...jaqueta, id: 'p', name: 'Calça flak', locations: ['Right Leg', 'Left Leg'], ev: 1 }]);
    expect(screen.getByTestId('armor-ev')).toHaveTextContent('REF rola com −2');
    await f.user.click(screen.getByRole('checkbox', { name: /calça flak vestida/i }));
    expect(screen.getByTestId('armor-ev')).toHaveTextContent('REF rola com −1');
  });

  it('a peça da ficha antiga é convertida na primeira edição', async () => {
    const antiga = { id: 'c', name: 'Colete', location: 'Torso', sp: 18, ev: 0, equipped: true } as unknown as ArmorPiece;
    const f = montar([antiga]);
    expect(f.sp('Torso')).toBe('SP 18');
    await f.user.click(screen.getByRole('checkbox', { name: /colete vestida/i }));
    expect(f.armadura()[0]).toEqual({ id: 'c', name: 'Colete', locations: ['Torso'], sp: 18, ev: 0, equipped: false });
  });
});
