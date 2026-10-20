/**
 * K.1c — a ficha impressa
 * =======================
 * O PDF da ficha é o "Salvar como PDF" do navegador, com a folha `@media print`
 * do index.css. A prova visual é o `scripts/visual/impressao.mjs` (o PDF de
 * verdade, sem gráficos de fundo); aqui fica a trava do que a folha precisa
 * achar no DOM — sem isso, a impressão perde dado em silêncio:
 *  - a armadura por local morava numa aba que só existia no DOM quando aberta:
 *    a ficha impressa saía sem SP nenhum;
 *  - a trilha de ferimento é feita de botões, e a folha esconde os botões da
 *    ficha: as caixas precisam estar marcadas para ficar, e as cheias, para
 *    imprimir o preenchimento.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { WeaponsArmor } from '../features/sheet/CharacterSheet/WeaponsArmor';
import { HealthTracker } from '../features/sheet/CharacterSheet/HealthTracker';
import { createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import { WOUND_TRACK_POINTS } from '../rules/tables';

const css = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf8');
const print = css.match(/@media print\s*\{([\s\S]*)\}\s*$/)?.[1] ?? '';

afterEach(cleanup);

describe('K.1c — o que a folha de impressão precisa achar', () => {
  it('a armadura por local está no DOM com a aba de armas aberta', () => {
    render(
      <WeaponsArmor
        sheet={createBlankCharacterSheet()}
        onChange={vi.fn()}
        onRollWeaponAttack={vi.fn()}
        onRollDamageOnly={vi.fn()}
      />
    );
    // A aba fechada fica no DOM, escondida na tela e à vista na impressão.
    const armas = screen.getByText(/adicionar armas padrão/i).closest('.space-y-4');
    const armadura = screen.getByText(/pontos de parada/i).closest('.hidden');
    expect(armas).not.toHaveClass('hidden');
    expect(armadura).toHaveClass('print:block');
  });

  it('as 40 caixas da trilha ficam na impressão, e as marcadas imprimem cheias', () => {
    const sheet = { ...createBlankCharacterSheet(), damagePoints: 9, woundLevel: 3 };
    render(<HealthTracker sheet={sheet} onChange={vi.fn()} onRollDeathSave={vi.fn()} onRollStunSave={vi.fn()} />);
    const caixas = screen.getAllByRole('button', { name: /^Ponto \d+/ });
    expect(caixas).toHaveLength(WOUND_TRACK_POINTS);
    expect(caixas.every((c) => c.getAttribute('data-print') === 'keep')).toBe(true);
    expect(caixas.filter((c) => c.getAttribute('data-print-fill') === 'true')).toHaveLength(9);
    expect(screen.getByRole('button', { name: /stun/i })).toHaveAttribute('data-print', 'keep');
    expect(screen.getByRole('button', { name: /death/i })).toHaveAttribute('data-print', 'keep');
  });

  it('a folha esconde só os botões da ficha, e poupa os marcados', () => {
    expect(print).toMatch(/\[data-print="sheet"\] button:not\(\[data-print="keep"\]\)/);
    expect(print).toMatch(/\[data-print-fill="true"\][^}]*print-color-adjust: exact/);
    // K.2 — bloco alto que se parte (a lista de peças), com cada filho inteiro.
    expect(print).toMatch(/\[data-print-flow\] > \*\s*\{\s*break-inside: avoid/);
    // Sem escopo, a regra esconderia os botões de qualquer página impressa.
    expect(print).not.toMatch(/(^|[\s,])button\s*[,{]/);
  });
});
