/**
 * K.6b — O ASSISTENTE DE CRIAÇÃO NA FICHA
 * ======================================
 * Rola o 9D10 ou recebe o bolo do Mestre, distribui os atributos, os 40 pontos
 * de carreira e o pickup de REF + INT, rola a verba (salário × 1D6/3) e grava o
 * que foi gasto. Passar de um orçamento trava o "Aplicar"; sobrar, não. Os
 * números saem da tabela (src/rules/tables.ts).
 */
import React, { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreationSection } from '../features/sheet/CharacterSheet/CreationSection';
import { createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import { salaryFor, startingFunds } from '../rules/creation';
import { CAREER_SKILL_POINTS, STARTING_SALARY } from '../rules/tables';
import { scriptedRng } from '../test/scriptedRng';
import type { CharacterSheet } from '../types/cyberpunk';

afterEach(cleanup);

// A ficha em branco tem os nove atributos em 5: um 9D10 que some 45 já os cobre.
const DADOS_45 = [5, 5, 5, 5, 5, 5, 5, 5, 5];

function montar(patch: Partial<CharacterSheet> = {}, faces: number[] = []) {
  let atual: CharacterSheet = { ...createBlankCharacterSheet(), ...patch };
  const rng = scriptedRng(faces);
  const Ficha = () => {
    const [sheet, setSheet] = useState(atual);
    atual = sheet;
    return <CreationSection sheet={sheet} onChange={(u) => setSheet((s) => ({ ...s, ...u }))} rng={rng} />;
  };
  render(<Ficha />);
  return { user: userEvent.setup(), ficha: () => atual };
}

async function digitar(user: ReturnType<typeof userEvent.setup>, nome: RegExp, valor: string) {
  const campo = screen.getByRole('textbox', { name: nome });
  await user.clear(campo);
  await user.type(campo, valor);
  await user.tab();
}

const aplicar = () => screen.getByRole('button', { name: /aplicar à ficha/i });
const eb = (n: number) => `${n.toLocaleString('pt-BR')} eb`;

describe('K.6b — o assistente de criação', () => {
  it('sem registro, a ficha oferece montar pelo livro', async () => {
    const f = montar();
    expect(screen.getByText(/sem registro de criação/i)).toBeInTheDocument();
    await f.user.click(screen.getByRole('button', { name: /montar pelo livro/i }));
    expect(screen.getByRole('button', { name: /rolar 9d10/i })).toBeInTheDocument();
  });

  it('do 9D10 à ficha: rola, distribui, confere cada orçamento e grava o que foi gasto', async () => {
    const f = montar({}, [...DADOS_45, 3]);
    await f.user.click(screen.getByRole('button', { name: /montar pelo livro/i }));
    await f.user.click(screen.getByRole('button', { name: /rolar 9d10/i }));
    expect(screen.getByTestId('creation-dice')).toHaveTextContent('5 5 5 5 5 5 5 5 5');
    expect(screen.getByTestId('budget-stats')).toHaveTextContent('45/45');

    // o pacote do Solo pede uma escolha: Brawling ou Martial Art
    expect(aplicar()).toBeDisabled();
    await f.user.click(screen.getByRole('checkbox', { name: 'Brawling' }));

    for (const pericia of [/^rifle/i, /^handgun/i, /^melee/i, /^athletics/i]) await digitar(f.user, pericia, '10');
    expect(screen.getByTestId('budget-career')).toHaveTextContent(`${CAREER_SKILL_POINTS}/${CAREER_SKILL_POINTS}`);

    // um ponto a mais na habilidade passa dos 40: trava, e diz por quê
    await digitar(f.user, /combat sense/i, '1');
    expect(screen.getByTestId('budget-career')).toHaveTextContent(`${CAREER_SKILL_POINTS + 1}/${CAREER_SKILL_POINTS}`);
    expect(aplicar()).toBeDisabled();
    expect(screen.getByTestId('creation-blockers')).toHaveTextContent(/carreira/i);
    await digitar(f.user, /combat sense/i, '0');

    // a verba: o salário do Solo no nível 0 (a coluna 1–5) × 3/3
    await f.user.click(screen.getByRole('button', { name: /rolar 1d6/i }));
    const verba = startingFunds(salaryFor('Solo', 0)!, 3);
    expect(screen.getByTestId('creation-funds')).toHaveTextContent(eb(verba));

    expect(aplicar()).toBeEnabled();
    await f.user.click(aplicar());
    const ficha = f.ficha();
    expect(ficha.skills.find((s) => s.name === 'Rifle')?.level).toBe(10);
    expect(ficha.skills.find((s) => s.name === 'Brawling')?.level).toBe(0);
    expect(ficha.eurodollars).toBe(verba);
    expect(ficha.creation).toMatchObject({ method: 'roll9d10', dice: DADOS_45, pool: 45, careerPoints: 40, pickupPoints: 0, fundsDie: 3, funds: verba });
    // gravado, a seção mostra o resumo
    expect(screen.getByTestId('creation-summary')).toHaveTextContent(/9D10/);
  });

  it('o bolo do Mestre: o GM diz o número, e sobrar só avisa', async () => {
    const f = montar({}, [4]);
    await f.user.click(screen.getByRole('button', { name: /montar pelo livro/i }));
    await f.user.click(screen.getByRole('radio', { name: /bolo do mestre/i }));
    await digitar(f.user, /bolo de atributos/i, '50');
    expect(screen.getByTestId('budget-stats')).toHaveTextContent('45/50');
    expect(screen.getByText(/sobram 5/i)).toBeInTheDocument();
    await f.user.click(screen.getByRole('checkbox', { name: 'Martial Art' }));
    await f.user.click(screen.getByRole('button', { name: /rolar 1d6/i }));
    expect(aplicar()).toBeEnabled();
    await f.user.click(aplicar());
    expect(f.ficha().creation).toMatchObject({ method: 'gmPool', dice: [], pool: 50 });
  });

  it('o pickup é REF + INT, fora do pacote: a perícia de carreira nem aparece na lista', async () => {
    const f = montar();
    await f.user.click(screen.getByRole('button', { name: /montar pelo livro/i }));
    expect(screen.getByTestId('budget-pickup')).toHaveTextContent('0/10');
    const lista = screen.getByRole('combobox', { name: /perícia de pickup/i });
    expect(within(lista).queryByRole('option', { name: /^rifle/i })).toBeNull();
    await f.user.selectOptions(lista, 'Dance');
    await f.user.click(screen.getByRole('button', { name: /adicionar ao pickup/i }));
    await digitar(f.user, /^dance/i, '10');
    expect(screen.getByTestId('budget-pickup')).toHaveTextContent('10/10');
    await digitar(f.user, /^ref na criação/i, '6');
    expect(screen.getByTestId('budget-pickup')).toHaveTextContent('10/11');
  });

  it('o role sem linha de salário (o Fixer): a verba é do Mestre, digitada', async () => {
    expect(STARTING_SALARY.some((r) => r.role === 'Fixer')).toBe(false);
    const f = montar({ role: 'Fixer', specialAbilityName: 'Streetdeal' });
    await f.user.click(screen.getByRole('button', { name: /montar pelo livro/i }));
    expect(screen.queryByRole('button', { name: /rolar 1d6/i })).toBeNull();
    await digitar(f.user, /verba do mestre/i, '3000');
    expect(screen.getByTestId('creation-funds')).toHaveTextContent(eb(3000));
  });
});
