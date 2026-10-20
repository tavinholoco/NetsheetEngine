/**
 * K.2e — o cromo que soma atributo, na ficha
 * ==========================================
 * O formulário de implante ganha "soma em atributo" (o Lace: BODY +2), a lista
 * mostra o bônus, e o BTM da ficha sai do BODY corrente — o mesmo que o dano da
 * mesa já lia. Antes o BTM da ficha lia o BODY base: com o Lace, a ficha e a
 * mesa dariam BTM diferentes.
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CyberwareManager } from '../features/sheet/CharacterSheet/CyberwareManager';
import { StatBlock } from '../features/sheet/CharacterSheet/StatBlock';
import { createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import { btmFromBody } from '../rules/character';
import { formatEb } from '../lib/format';
import type { CharacterSheet, CyberwareItem } from '../types/cyberpunk';

afterEach(cleanup);

const lace: CyberwareItem = {
  id: 'lace', name: 'Muscle and Bone Lace', category: 'Bioware', costEb: 1500, humanityLoss: '2',
  actualHL: 2, installed: true, statBonus: { stat: 'BODY', amount: 2 }
};

function montarCromo() {
  let atual: CharacterSheet = createBlankCharacterSheet();
  const Ficha = () => {
    const [sheet, setSheet] = useState(atual);
    atual = sheet;
    return <CyberwareManager sheet={sheet} onChange={(u) => setSheet((s) => ({ ...s, ...u }))} />;
  };
  render(<Ficha />);
  return { user: userEvent.setup(), ficha: () => atual };
}

describe('K.2e — o cromo que soma atributo na ficha', () => {
  it('instalar com "soma em atributo" grava o bônus, e a lista o mostra', async () => {
    const f = montarCromo();
    await f.user.click(screen.getByRole('button', { name: /adicionar ciberimplante/i }));
    await f.user.type(screen.getByRole('textbox', { name: /nome do implante/i }), 'Muscle and Bone Lace');
    await f.user.selectOptions(screen.getByLabelText(/soma em atributo/i), 'BODY');
    await f.user.click(screen.getByRole('button', { name: /instalar/i }));

    expect(f.ficha().cyberware[0].statBonus).toEqual({ stat: 'BODY', amount: 2 });
    expect(screen.getByText('+2 BODY')).toBeInTheDocument();
  });

  it('sem atributo escolhido, o implante não ganha bônus', async () => {
    const f = montarCromo();
    await f.user.click(screen.getByRole('button', { name: /adicionar ciberimplante/i }));
    await f.user.type(screen.getByRole('textbox', { name: /nome do implante/i }), 'Neural Processor');
    await f.user.click(screen.getByRole('button', { name: /instalar/i }));
    expect(f.ficha().cyberware[0].statBonus).toBeUndefined();
  });

  it('o BTM da ficha sai do BODY com o cromo — BODY 10 com o Lace é o BTM do 12', () => {
    const blank = createBlankCharacterSheet();
    const sheet = { ...blank, stats: { ...blank.stats, BODY: 10 }, cyberware: [lace] };
    render(<StatBlock sheet={sheet} onChange={() => {}} />);
    expect(screen.getByText(new RegExp(`BTM: ${btmFromBody(12)} `))).toBeInTheDocument();
  });
});

// Revisão da K — o custo do implante saía sem locale (no navegador em inglês,
// "1,500"), e a ficha e a mesa escrevem eurodólar pelo `formatEb`: "1.500 eb".
describe('Revisão da K — o custo do cromo em eb', () => {
  it('a lista mostra o custo pelo formatEb', () => {
    render(<CyberwareManager sheet={{ ...createBlankCharacterSheet(), cyberware: [lace] }} onChange={() => {}} />);
    expect(screen.getByText(formatEb(lace.costEb))).toBeInTheDocument();
    expect(screen.queryByText(/€\$/)).toBeNull();
  });
});
