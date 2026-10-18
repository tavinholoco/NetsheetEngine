/**
 * K.2d — o inventário com peso, contra o Carry
 * ============================================
 * Carry e Lift saem do BODY corrente (o cromo da K.2e entra por ele); o peso do
 * inventário aparece contra o Carry, sem pena nenhuma (decisão 13). E o
 * `gearNotes`, que existia na ficha desde a Fase 0 sem tela nenhuma, ganha um
 * campo — outro "construído e nunca ligado".
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GearSection } from '../features/sheet/CharacterSheet/GearSection';
import { createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import { CARRY_KG_PER_BODY, LIFT_KG_PER_BODY } from '../rules/tables';
import type { CharacterSheet, GearItem } from '../types/cyberpunk';

afterEach(cleanup);

function montar(patch: Partial<CharacterSheet> = {}) {
  let atual: CharacterSheet = { ...createBlankCharacterSheet(), ...patch };
  const Ficha = () => {
    const [sheet, setSheet] = useState(atual);
    atual = sheet;
    return <GearSection sheet={sheet} onChange={(u) => setSheet((s) => ({ ...s, ...u }))} />;
  };
  render(<Ficha />);
  return { user: userEvent.setup(), ficha: () => atual };
}

describe('K.2d — inventário e carga na ficha', () => {
  it('Carry e Lift pelo BODY', () => {
    const blank = createBlankCharacterSheet();
    montar({ stats: { ...blank.stats, BODY: 8 } });
    expect(screen.getByTestId('carry')).toHaveTextContent(`${8 * CARRY_KG_PER_BODY} kg`);
    expect(screen.getByTestId('lift')).toHaveTextContent(`${8 * LIFT_KG_PER_BODY} kg`);
  });

  it('adicionar um item e pesar soma no total', async () => {
    const f = montar();
    await f.user.click(screen.getByRole('button', { name: /adicionar item/i }));
    const peso = screen.getByRole('textbox', { name: /peso de novo item/i });
    await f.user.clear(peso);
    await f.user.type(peso, '2.5');
    const qtd = screen.getByRole('textbox', { name: /quantidade de novo item/i });
    await f.user.clear(qtd);
    await f.user.type(qtd, '2');
    expect(f.ficha().gear).toEqual([expect.objectContaining({ name: 'Novo item', weightKg: 2.5, qty: 2 })]);
    expect(screen.getByTestId('gear-weight')).toHaveTextContent('5 kg');
  });

  it('acima do Carry, a ficha avisa — e não penaliza nada', () => {
    const blank = createBlankCharacterSheet();
    const gear: GearItem[] = [{ id: 'b', name: 'Bigorna', weightKg: 100, qty: 1 }];
    montar({ stats: { ...blank.stats, BODY: 5 }, gear });
    expect(screen.getByTestId('gear-weight')).toHaveTextContent(/acima do carry/i);
  });

  it('a ficha antiga, sem inventário, abre com a lista vazia', () => {
    const antiga = createBlankCharacterSheet() as Partial<CharacterSheet>;
    delete antiga.gear;
    montar(antiga);
    expect(screen.getByText(/nenhum item/i)).toBeInTheDocument();
  });

  it('as notas de equipamento, sem tela desde a Fase 0, agora se escrevem', async () => {
    const f = montar();
    await f.user.type(screen.getByRole('textbox', { name: /notas de equipamento/i }), 'Dois carregadores');
    expect(f.ficha().gearNotes).toBe('Dois carregadores');
  });
});
