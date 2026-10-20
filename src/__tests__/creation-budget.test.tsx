/**
 * K.6c — O ORÇAMENTO DA CRIAÇÃO À VISTA DO GM
 * ==========================================
 * O servidor não tem como barrar a ficha acima do orçamento: depois da criação,
 * o IP e o cromo sobem os números legitimamente (K.0). O "trapaceiro plausível"
 * do portão da B fica visível, não barrado: o GM vê, no "Inspecionar ficha", o
 * que a criação gastou contra o orçamento e contra a ficha de hoje, e a lista de
 * jogadores marca quem passou. O jogador não vê o bloco.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiplayerRoom } from '../features/multiplayer/MultiplayerRoom';
import { useRoomStore } from '../stores/useRoomStore';
import { stubRoomTransport } from '../test/roomTransport';
import { creationReport } from '../rules/creation';
import { CAREER_SKILL_POINTS, WOUND_TRACK } from '../rules/tables';
import type { CharacterCreation, CharacterSheet, CharacterStats } from '../types/cyberpunk';
import type { GameRoom, RoomPlayer } from '../types/multiplayer';

const CODE = 'NC-2020-K6C9XD';
const statsAll = (n: number): CharacterStats => ({ INT: n, REF: n, TECH: n, COOL: n, ATTR: n, LUCK: n, MA: n, BODY: n, EMP: n });

/** Um Solo criado no 9D10 (bolo 54), com 40 de carreira e 12 de pickup. */
function criado(patch: Partial<CharacterCreation> = {}): CharacterCreation {
  return {
    method: 'roll9d10',
    dice: [5, 6, 7, 5, 6, 7, 5, 6, 7],
    pool: 54,
    stats: statsAll(6),
    careerSkills: ['Awareness/Notice', 'Handgun', 'Melee', 'Weaponsmith', 'Rifle', 'Athletics', 'Submachinegun', 'Stealth', 'Brawling'],
    careerPoints: 40,
    pickupPoints: 12,
    fundsDie: 3,
    funds: 2000,
    ...patch
  };
}

function ficha(patch: Partial<CharacterSheet> = {}): CharacterSheet {
  return {
    handle: 'Vex',
    role: 'Solo',
    specialAbilityName: 'Combat Sense',
    specialAbilityRank: 4,
    stats: statsAll(6),
    woundLevel: 0,
    eurodollars: 2000,
    weapons: [],
    cyberware: [],
    skills: [
      ...criado().careerSkills.map((name, i) => ({ id: `c${i}`, name, stat: 'REF' as const, level: 4 })),
      { id: 'p1', name: 'Driving', stat: 'REF' as const, level: 6 },
      { id: 'p2', name: 'Dance', stat: 'REF' as const, level: 6 }
    ],
    creation: criado(),
    ...patch
  } as unknown as CharacterSheet;
}

describe('K.6c — o relatório do orçamento', () => {
  it('a ficha que saiu do orçamento e não mudou não tem aviso', () => {
    const r = creationReport(ficha());
    expect(r.recorded).toBe(true);
    expect(r.warnings).toEqual([]);
    expect(r.lines.find((l) => l.key === 'stats')).toMatchObject({ atCreation: 54, budget: 54, now: 54 });
    expect(r.lines.find((l) => l.key === 'career')).toMatchObject({ atCreation: 40, budget: CAREER_SKILL_POINTS, now: 40 });
    expect(r.lines.find((l) => l.key === 'pickup')).toMatchObject({ atCreation: 12, budget: 12, now: 12 });
  });

  it('o bolo que não bate com os dados, e o registro acima do orçamento, aparecem', () => {
    expect(creationReport(ficha({ creation: criado({ pool: 70 }) })).warnings.join(' ')).toMatch(/não bate com os dados/);
    const acima = creationReport(ficha({ creation: criado({ careerPoints: 55 }) }));
    expect(acima.warnings.join(' ')).toMatch(/carreira.*55 de 40/i);
  });

  it('o atributo base que subiu depois da criação, ou passou de 10, aparece', () => {
    const r = creationReport(ficha({ stats: { ...statsAll(6), BODY: 12 } }));
    expect(r.warnings.join(' ')).toMatch(/54 → 60/);
    expect(r.warnings.join(' ')).toMatch(/BODY 12/);
  });

  it('a perícia que passou do orçamento depois da criação aparece — o IP explica, ou não', () => {
    const sheet = ficha();
    const r = creationReport({ ...sheet, skills: sheet.skills.map((s) => (s.name === 'Rifle' ? { ...s, level: 10 } : s)) });
    expect(r.lines.find((l) => l.key === 'career')!.now).toBe(46);
    expect(r.warnings.join(' ')).toMatch(/carreira hoje: 46/i);
  });

  it('sem registro: diz, e confere o pacote do role contra os 40 assim mesmo', () => {
    const sheet = ficha({ creation: undefined });
    const r = creationReport({ ...sheet, skills: sheet.skills.map((s) => (s.name === 'Rifle' ? { ...s, level: 10 } : s)) });
    expect(r.recorded).toBe(false);
    expect(r.notes.join(' ')).toMatch(/sem registro de criação/i);
    expect(r.lines.find((l) => l.key === 'stats')).toMatchObject({ atCreation: null, budget: null, now: 54 });
    expect(r.lines.find((l) => l.key === 'career')!.now).toBe(46);
    expect(r.warnings.join(' ')).toMatch(/carreira hoje: 46/i);
  });
});

function jogador(peerId: string, sheet: CharacterSheet): RoomPlayer {
  return { peerId, handle: sheet.handle, role: 'Solo', sheet, isOnline: true, joinedAt: '' };
}

function mesa(players: RoomPlayer[]): GameRoom {
  return {
    code: CODE,
    name: 'Mesa de sexta',
    gmHandle: 'Dono',
    gmPeerId: 'peer_dono',
    locationName: 'Afterlife',
    combatModifier: 0,
    modifierReason: '',
    players: Object.fromEntries(players.map((p) => [p.peerId, p])),
    chatMessages: [],
    initiativeList: [],
    activeTurnIndex: 0,
    createdAt: new Date().toISOString()
  };
}

const DONO = jogador('peer_dono', ficha({ handle: 'Dono' }));
// Vex: base BODY 12, acima do que a criação registrou
const VEX = jogador('peer_vex', ficha({ handle: 'Vex', stats: { ...statsAll(6), BODY: 12 } }));
const KID = jogador('peer_kid', ficha({ handle: 'Kid' }));

function entrarComo(peerId: string) {
  const s = useRoomStore.getState();
  s.setPeerId(peerId);
  s.setSessionToken('token');
  s.setRoomCode(CODE);
  s.setRoom(mesa([DONO, VEX, KID]));
  s.setView('active');
}

beforeEach(() => {
  stubRoomTransport();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(useRoomStore.getState().room), { status: 200 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  useRoomStore.getState().resetRoom();
});

const inspecionar = (handle: string) =>
  screen
    .getAllByRole('button', { name: /inspecionar ficha/i })
    .find((b) => b.closest('[draggable]')?.textContent?.includes(handle))!;

describe('K.6c — o GM vê o orçamento na mesa', () => {
  it('no "Inspecionar ficha", o GM vê o que a criação gastou contra a ficha de hoje', async () => {
    entrarComo('peer_dono');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
    await userEvent.setup().click(inspecionar('Vex'));
    const bloco = screen.getByRole('region', { name: /orçamento de criação/i });
    expect(within(bloco).getByText(/9D10/)).toBeInTheDocument();
    expect(within(bloco).getByTestId('report-stats')).toHaveTextContent('54/54 → 60');
    expect(within(bloco).getByText(/BODY 12/)).toBeInTheDocument();
  });

  it('a lista de jogadores marca, para o GM, quem passou do orçamento', () => {
    entrarComo('peer_dono');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
    expect(screen.getByLabelText('Vex fora do orçamento de criação')).toBeInTheDocument();
    expect(screen.queryByLabelText('Kid fora do orçamento de criação')).toBeNull();
  });

  it('o jogador não vê o bloco nem a marca', async () => {
    entrarComo('peer_kid');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
    expect(screen.queryByLabelText('Vex fora do orçamento de criação')).toBeNull();
    await userEvent.setup().click(inspecionar('Vex'));
    expect(screen.queryByRole('region', { name: /orçamento de criação/i })).toBeNull();
  });
});

/**
 * Revisão da K — o resto do "Inspecionar ficha", ao lado do orçamento, falava
 * outra língua: o ferimento pelo índice ("2/10"), que a K.3a tirou do cartão do
 * token, e a verba em "€$", com o orçamento logo abaixo em "eb".
 */
describe('Revisão da K — o "Inspecionar ficha" fala como a ficha', () => {
  const ferido = jogador('peer_vex', ficha({ handle: 'Vex', woundLevel: 2 }));

  function abrir() {
    const s = useRoomStore.getState();
    s.setPeerId('peer_dono');
    s.setSessionToken('token');
    s.setRoomCode(CODE);
    s.setRoom(mesa([DONO, ferido]));
    s.setView('active');
    render(<MultiplayerRoom onOpenAuthModal={() => {}} />);
    return userEvent.setup().click(inspecionar('Vex'));
  }

  it('o ferimento sai pelo nome da trilha do livro, não pelo índice', async () => {
    await abrir();
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText(WOUND_TRACK[2].name)).toBeInTheDocument();
    expect(within(modal).queryByText(/\d+\/10/)).toBeNull();
  });
});
