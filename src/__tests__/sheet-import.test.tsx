/**
 * K.1a e K.1b — o import de ficha passa pelo validador, e abre sem conta
 * =====================================================================
 * Medido na K.0 (18/10/2026): o "Importar" punha o arquivo nos presets
 * conferindo só `id` e `stats` — atributo 99 e coleção que não é lista
 * entravam crus, e a ficha quebrava ao abrir. O `sanitizeCharacterSheet`
 * nasceu na B prevendo o import (um arquivo de disco é tão pouco confiável
 * quanto um corpo de requisição) e nunca foi ligado aqui.
 *
 * E virar ficha exigia login, mas a ficha de quem não tem conta vive no
 * `localStorage` desde a T2.13 (modo visitante): a trava, da restauração da
 * Fase 0, não protegia nada, e travava o backup de quem não tem conta.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresetsManager } from '../components/PresetsManager';
import { useSheetStore } from '../stores/useSheetStore';
import { createBlankCharacterSheet } from '../hooks/useCharacterSheet';
import type { CharacterSheet } from '../types/cyberpunk';

const PRESETS_STORE = 'cyberpunk_presets_v1';

function presetsGravados(): CharacterSheet[] {
  return JSON.parse(localStorage.getItem(PRESETS_STORE) || '[]');
}

function arquivo(conteudo: unknown, nome = 'ficha.json'): File {
  const texto = typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo);
  return new File([texto], nome, { type: 'application/json' });
}

function montar() {
  const props = {
    onLoadSheet: vi.fn(),
    onLoadPresetAsNewSheet: vi.fn(),
    onCreateNew: vi.fn(),
    onDeleteSheet: vi.fn(),
    onOpenAuthModal: vi.fn()
  };
  render(<PresetsManager {...props} />);
  return {
    props,
    user: userEvent.setup(),
    entrada: () => screen.getByLabelText(/importar/i) as HTMLInputElement
  };
}

/** Uma ficha exportada de verdade, com algo em cada coleção. */
function fichaExportada(): CharacterSheet {
  const s = createBlankCharacterSheet();
  return {
    ...s,
    handle: 'Vex',
    stats: { ...s.stats, REF: 8, BODY: 7 },
    skills: [{ id: 'sk1', name: 'Handgun', stat: 'REF', level: 4 }],
    weapons: [],
    cyberware: []
  };
}

beforeEach(() => {
  localStorage.clear();
  useSheetStore.setState({ user: null, sheet: createBlankCharacterSheet(), roster: [] });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('K.1a — o import passa pelo validador', () => {
  it('atributo e perícia fora da faixa entram grampeados, e a tela diz o que mudou', async () => {
    const m = montar();
    const ficha = fichaExportada();
    const forjada = {
      ...ficha,
      stats: { ...ficha.stats, BODY: 99 },
      skills: [{ id: 'sk1', name: 'Handgun', stat: 'REF', level: 50 }]
    };

    await m.user.upload(m.entrada(), arquivo(forjada));

    await waitFor(() => expect(presetsGravados()).toHaveLength(1));
    const gravado = presetsGravados()[0];
    expect(gravado.stats.BODY).toBe(15);
    expect(gravado.skills[0].level).toBe(10);
    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent(/corrigiu 2 campos/i);
    expect(aviso).toHaveTextContent('stats.BODY');
    expect(aviso).toHaveTextContent('skills[0].level');
  });

  it('coleção que não é lista vira lista vazia, e o preset abre sem quebrar', async () => {
    const m = montar();
    const quebrada = { ...fichaExportada(), skills: 'x', armor: 5, cyberware: { a: 1 } };

    await m.user.upload(m.entrada(), arquivo(quebrada));

    await waitFor(() => expect(presetsGravados()).toHaveLength(1));
    const gravado = presetsGravados()[0];
    expect(gravado.skills).toEqual([]);
    expect(gravado.armor).toEqual([]);
    expect(gravado.cyberware).toEqual([]);
    expect(screen.getByText('Vex')).toBeInTheDocument();
  });

  it('arquivo que não é ficha é recusado com aviso, e nada entra', async () => {
    const m = montar();

    await m.user.upload(m.entrada(), arquivo([1, 2, 3]));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/não é uma ficha/i));
    expect(presetsGravados()).toHaveLength(0);
  });

  it('JSON quebrado é recusado com aviso na tela', async () => {
    const m = montar();

    await m.user.upload(m.entrada(), arquivo('{ "handle": '));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/não é json/i));
    expect(presetsGravados()).toHaveLength(0);
  });

  it('a ficha exportada volta sem correção nenhuma', async () => {
    const m = montar();

    await m.user.upload(m.entrada(), arquivo(fichaExportada()));

    await waitFor(() => expect(presetsGravados()).toHaveLength(1));
    expect(screen.getByRole('status')).toHaveTextContent(/importada/i);
    expect(screen.getByRole('status')).not.toHaveTextContent(/corrigiu/i);
    const gravado = presetsGravados()[0];
    expect(gravado.handle).toBe('Vex');
    expect(gravado.stats.REF).toBe(8);
    expect(gravado.skills).toEqual([{ id: 'sk1', name: 'Handgun', stat: 'REF', level: 4 }]);
  });

  it('o mesmo arquivo importado duas vezes vira dois presets, e apagar um deixa o outro', async () => {
    const m = montar();
    const ficha = fichaExportada();

    await m.user.upload(m.entrada(), arquivo(ficha));
    await waitFor(() => expect(presetsGravados()).toHaveLength(1));
    await m.user.upload(m.entrada(), arquivo(ficha));
    await waitFor(() => expect(presetsGravados()).toHaveLength(2));

    const [a, b] = presetsGravados();
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe('');

    await m.user.click(screen.getAllByRole('button', { name: /apagar preset/i })[0]);
    expect(presetsGravados()).toHaveLength(1);
  });
});
