/**
 * K.7b — A TELA SUGERE TODAS AS PERÍCIAS DO ATRIBUTO
 * =================================================
 * O formulário de perícia nova sugeria só as 8 primeiras de cada atributo
 * (`slice(0, 8)` no estado inicial e na troca de atributo): das 25 de INT, 17
 * nunca apareciam — entre elas as cinco que a K.7a pôs. As sugestões (os botões e
 * o `datalist`) saem do `SKILL_TABLES` inteiro.
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillsSection } from '../features/sheet/CharacterSheet/SkillsSection';
import { createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import { SKILL_TABLES } from '../data/cyberpunkData';
import type { StatName } from '../types/cyberpunk';

afterEach(cleanup);

async function abrirFormulario() {
  const user = userEvent.setup();
  const view = render(
    <SkillsSection sheet={createBlankCharacterSheet()} onChange={() => {}} onRollSkill={() => {}} onRollCheck={() => {}} />
  );
  await user.click(screen.getByRole('button', { name: /adicionar perícia/i }));
  return { user, view };
}

const sugestoes = (container: HTMLElement) =>
  [...container.querySelectorAll('datalist#skill-suggestions option')].map((o) => o.getAttribute('value'));

describe('K.7b — as sugestões de perícia', () => {
  it('o REF, que abre o formulário, sugere todas as perícias de REF', async () => {
    const { view } = await abrirFormulario();
    expect(sugestoes(view.container)).toEqual(SKILL_TABLES.REF);
  });

  it.each(['INT', 'TECH', 'EMP'] as StatName[])('trocar para %s sugere todas as dele, nos botões e na lista', async (stat) => {
    const { user, view } = await abrirFormulario();
    await user.selectOptions(view.container.querySelector('select')!, stat);
    expect(sugestoes(view.container)).toEqual(SKILL_TABLES[stat]);
    const ultima = SKILL_TABLES[stat][SKILL_TABLES[stat].length - 1];
    expect(within(view.container).getByRole('button', { name: ultima })).toBeInTheDocument();
  });
});
