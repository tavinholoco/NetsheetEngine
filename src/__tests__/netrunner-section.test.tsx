/**
 * K.5c — O DECK E OS PROGRAMAS NA FICHA
 * =====================================
 * A ficha monta o deck pelo padrão do livro, mostra a MU dele, o preço pela
 * tabela e a iniciativa na Net (1d10 + REF + Speed), e lista os programas com a
 * MU dos carregados contra a do deck — passar dela só avisa, como o Carry da
 * K.2d. Os números esperados saem da tabela (src/rules/tables.ts).
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NetrunnerSection } from '../features/sheet/CharacterSheet/NetrunnerSection';
import { createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import { createDefaultDeck } from '../rules/netrun';
import { DECK_BASE, DECK_CHASSIS, DECK_EXTRA_MEMORY_MU, DECK_UPGRADE_EB } from '../rules/tables';
import type { CharacterSheet, NetProgram } from '../types/cyberpunk';

afterEach(cleanup);

function montar(patch: Partial<CharacterSheet> = {}) {
  let atual: CharacterSheet = { ...createBlankCharacterSheet(), ...patch };
  const Ficha = () => {
    const [sheet, setSheet] = useState(atual);
    atual = sheet;
    return <NetrunnerSection sheet={sheet} onChange={(u) => setSheet((s) => ({ ...s, ...u }))} />;
  };
  render(<Ficha />);
  return { user: userEvent.setup(), ficha: () => atual };
}

const eb = (n: number) => `${n.toLocaleString('pt-BR')} eb`;

function prog(name: string, mu: number, loaded = true): NetProgram {
  return { id: `p_${name}`, name, programClass: 'intrusion', strength: 4, mu, costEb: 400, loaded };
}

describe('K.5c — o deck na ficha', () => {
  it('sem deck, a ficha diz, e "Montar cyberdeck" põe o padrão do livro', async () => {
    const f = montar();
    expect(screen.getByText(/sem cyberdeck/i)).toBeInTheDocument();
    await f.user.click(screen.getByRole('button', { name: /montar cyberdeck/i }));
    expect(f.ficha().deck).toEqual(createDefaultDeck());
    expect(screen.getByTestId('deck-mu')).toHaveTextContent(`0/${DECK_BASE.mu} MU`);
    expect(screen.getByTestId('deck-cost')).toHaveTextContent(eb(DECK_CHASSIS[0].costEb));
  });

  it('o segundo módulo de memória soma 10 MU e o preço dele', async () => {
    const f = montar({ deck: createDefaultDeck() });
    await f.user.click(screen.getByRole('checkbox', { name: /segundo módulo de memória/i }));
    expect(f.ficha().deck!.extraMemory).toBe(true);
    expect(screen.getByTestId('deck-mu')).toHaveTextContent(`0/${DECK_BASE.mu + DECK_EXTRA_MEMORY_MU} MU`);
    expect(screen.getByTestId('deck-cost')).toHaveTextContent(eb(DECK_CHASSIS[0].costEb + DECK_UPGRADE_EB.extraMemory));
  });

  it('o tipo e a Speed mudam o preço; a Speed entra na iniciativa na Net', async () => {
    const blank = createBlankCharacterSheet();
    const f = montar({ stats: { ...blank.stats, REF: 7 }, deck: createDefaultDeck() });
    await f.user.selectOptions(screen.getByRole('combobox', { name: /tipo do deck/i }), 'cellular');
    const speed = screen.getByRole('textbox', { name: /speed do deck/i });
    await f.user.clear(speed);
    await f.user.type(speed, '2');
    expect(f.ficha().deck).toMatchObject({ chassis: 'cellular', speed: 2 });
    const cellular = DECK_CHASSIS.find((c) => c.id === 'cellular')!.costEb;
    expect(screen.getByTestId('deck-cost')).toHaveTextContent(eb(cellular + 2 * DECK_UPGRADE_EB.speedPerPoint));
    expect(screen.getByTestId('net-initiative')).toHaveTextContent('1d10 + 9');
  });

  it('"Remover deck" tira o deck e deixa os programas', async () => {
    const f = montar({ deck: createDefaultDeck(), programs: [prog('Hammer', 1)] });
    await f.user.click(screen.getByRole('button', { name: /remover deck/i }));
    expect(f.ficha().deck).toBeUndefined();
    expect(f.ficha().programs).toHaveLength(1);
  });
});

describe('K.5c — os programas contra a MU do deck', () => {
  it('adicionar um programa põe um carregado, de 1 MU', async () => {
    const f = montar({ deck: createDefaultDeck() });
    await f.user.click(screen.getByRole('button', { name: /adicionar programa/i }));
    expect(f.ficha().programs).toEqual([expect.objectContaining({ name: 'Novo programa', mu: 1, loaded: true })]);
    expect(screen.getByTestId('deck-mu')).toHaveTextContent(`1/${DECK_BASE.mu} MU`);
  });

  it('só o carregado ocupa a MU; tirar do deck libera', async () => {
    const f = montar({ deck: createDefaultDeck(), programs: [prog('Hammer', 4), prog('Killer', 5), prog('Shield', 3, false)] });
    expect(screen.getByTestId('deck-mu')).toHaveTextContent(`9/${DECK_BASE.mu} MU`);
    await f.user.click(screen.getByRole('checkbox', { name: /killer no deck/i }));
    expect(f.ficha().programs!.find((p) => p.name === 'Killer')!.loaded).toBe(false);
    expect(screen.getByTestId('deck-mu')).toHaveTextContent(`4/${DECK_BASE.mu} MU`);
  });

  it('acima da MU do deck, a ficha só avisa', () => {
    montar({ deck: createDefaultDeck(), programs: [prog('Hammer', 6), prog('Killer', 5)] });
    expect(screen.getByTestId('deck-mu')).toHaveTextContent(`11/${DECK_BASE.mu} MU`);
    expect(screen.getByText(/acima da MU do deck/i)).toBeInTheDocument();
  });

  it('a força e a MU do programa entram como digitadas', async () => {
    const f = montar({ deck: createDefaultDeck(), programs: [prog('Hammer', 1)] });
    const forca = screen.getByRole('textbox', { name: /força de hammer/i });
    await f.user.clear(forca);
    await f.user.type(forca, '6');
    await f.user.selectOptions(screen.getByRole('combobox', { name: /classe de hammer/i }), 'antiIc');
    expect(f.ficha().programs![0]).toMatchObject({ strength: 6, programClass: 'antiIc' });
  });
});
