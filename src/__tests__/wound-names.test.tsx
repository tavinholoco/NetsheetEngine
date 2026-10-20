/**
 * K.3a (o G.05) — UM NOME POR NÍVEL DE FERIMENTO
 * ==============================================
 * Até a K.3 havia duas listas para o mesmo ferimento: a trilha do livro
 * (`WOUND_TRACK`, "Sério") e a `WOUND_LEVEL_NAMES` da Fase 9 ("Ferimento Sério
 * (Serious)", e um "Mortal 6 (Morte Iminente)" que não é nome do livro). A
 * ficha e o cartão do token diziam uma coisa; o painel de combate, logo
 * abaixo, outra. O nome esperado sai da tabela, nunca da tela.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HealthTracker } from '../features/sheet/CharacterSheet/HealthTracker';
import { TacticalGrid } from '../features/multiplayer/TacticalGrid';
import { createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import { DAMAGE_POINTS_PER_WOUND_LEVEL, WOUND_TRACK } from '../rules/tables';
import type { TacticalGridState } from '../types/multiplayer';

afterEach(cleanup);

const LEVELS = WOUND_TRACK.map((row) => [row.level, row.name] as const);

describe('K.3a — a ficha diz o nome da trilha do livro', () => {
  it.each(LEVELS)('nível %i: a pílula e o cartão "Estado" dizem "%s", na cor wound-N', (level, name) => {
    const sheet = { ...createBlankCharacterSheet(), damagePoints: level * DAMAGE_POINTS_PER_WOUND_LEVEL };
    render(<HealthTracker sheet={sheet} onChange={vi.fn()} onRollDeathSave={vi.fn()} onRollStunSave={vi.fn()} />);

    const header = screen.getByRole('heading', { name: /Bio-Monitor/ }).parentElement!.parentElement!;
    expect(within(header).getByText(name)).toBeInTheDocument();

    const estado = screen.getByText('Estado').parentElement!.parentElement!;
    const value = within(estado).getByText(name);
    expect(value).toHaveClass(`text-wound-${level}`);
  });
});

describe('K.3a — o cartão do token no grid diz o mesmo nome', () => {
  const grid = (hp: number): TacticalGridState => ({
    rows: 8,
    cols: 10,
    theme: 'alley',
    tokens: [{ id: 'tok_vex', name: 'Vex', type: 'player', x: 2, y: 2, hp }]
  });

  it.each(LEVELS)('nível %i: o Bio-Monitor do cartão diz "%s", na cor wound-N', async (level, name) => {
    render(<TacticalGrid gridState={grid(level)} roleMode="player" peerId="p1" players={{}} onUpdateGrid={vi.fn()} />);
    await userEvent.setup().click(screen.getByTitle('Abrir status de Vex'));

    const row = screen.getByText('Bio-Monitor:').parentElement!;
    const value = within(row).getByText(name);
    expect(value).toHaveClass(`text-wound-${level}`);
  });
});
