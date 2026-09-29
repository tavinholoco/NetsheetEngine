/**
 * Fase D (D.6) — COMPORTAMENTO DOS COMPONENTES DO LOOP DE COMBATE
 * ===============================================================
 * O `CombatPanel` (cartão do token, D.3/D.5) e o `HealthTracker` (a trilha
 * em pontos, D.1) nasceram nesta fase. A conta é do servidor; o que se testa
 * aqui é o que o componente MANDA e o que ele DEIXA fazer. (ARQ-08, parte 2 —
 * até aqui a UI tinha 3 smoke tests.)
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CombatPanel } from '../features/multiplayer/CombatPanel';
import { HealthTracker } from '../features/sheet/CharacterSheet/HealthTracker';
import { useRoomStore } from '../stores/useRoomStore';
import type { CharacterSheet, RollResult } from '../types/cyberpunk';
import type { RoomPlayer } from '../types/multiplayer';

const STATS = { INT: 6, REF: 8, TECH: 5, COOL: 6, ATTR: 5, LUCK: 5, MA: 6, BODY: 8, EMP: 5 };
const SHEET = {
  id: 's', handle: 'Vex', realName: '', role: 'Solo', specialAbilityName: 'Combat Sense', specialAbilityRank: 2,
  avatarUrl: '', age: 20, sex: '', eurodollars: 0, stats: STATS, currentStats: { ...STATS }, woundLevel: 0, damagePoints: 0,
  skills: [], cyberware: [], armor: [], gearNotes: '', createdAt: '', updatedAt: '',
  lifepath: { style: '', motivation: '', valuedPerson: '', valuedPossession: '', lifeEvents: [] },
  weapons: [{ id: 'w', name: 'Pistola', type: 'Pistol', wa: 0, con: 'J', avail: 'C', damage: '2d6', shots: 10, currentShots: 10, rof: 2, rel: 'VR', rangeMeters: 50, equipped: true }]
} as unknown as CharacterSheet;

const NPC: RoomPlayer = { peerId: 'npc_1', handle: 'Booster', role: 'Nomad', sheet: SHEET, isOnline: true, joinedAt: '' };
const ILESO = { label: 'Ileso', points: 0, isMortal: false, isDead: false, isStabilized: false };

function panel(props: Partial<React.ComponentProps<typeof CombatPanel>> = {}) {
  const onAttack = vi.fn();
  const onApplyDamage = vi.fn();
  const onToggleStabilized = vi.fn();
  render(
    <CombatPanel
      targetId="token_p1"
      targetName="Vex"
      attackers={[NPC]}
      status={ILESO}
      onAttack={onAttack}
      onApplyDamage={onApplyDamage}
      onToggleStabilized={onToggleStabilized}
      {...props}
    />
  );
  return { onAttack, onApplyDamage, onToggleStabilized, user: userEvent.setup() };
}

describe('D.6 — CombatPanel: o NPC ataca', () => {
  it('a faixa padrão é a Média, e o pedido leva atacante, alvo e faixa', async () => {
    const { onAttack, user } = panel();
    await user.click(screen.getByText(/NPC ataca Vex/));
    await user.click(screen.getByRole('button', { name: 'Rolar ataque' }));
    expect(onAttack).toHaveBeenCalledWith({ attackerId: 'npc_1', targetId: 'token_p1', range: 'medium' });
  });

  it('escolher Queima-roupa muda a faixa do pedido', async () => {
    const { onAttack, user } = panel();
    await user.click(screen.getByText(/NPC ataca Vex/));
    await user.click(screen.getByRole('radio', { name: /Queima-roupa 10/ }));
    await user.click(screen.getByRole('button', { name: 'Rolar ataque' }));
    expect(onAttack).toHaveBeenCalledWith(expect.objectContaining({ range: 'pointBlank' }));
  });

  it('"Outra" manda a dificuldade livre e nenhuma faixa (corpo a corpo)', async () => {
    const { onAttack, user } = panel();
    await user.click(screen.getByText(/NPC ataca Vex/));
    await user.click(screen.getByRole('radio', { name: 'Outra' }));
    const field = screen.getByRole('spinbutton', { name: /Dificuldade/ });
    await user.clear(field);
    await user.type(field, '12');
    await user.click(screen.getByRole('button', { name: 'Rolar ataque' }));
    expect(onAttack).toHaveBeenCalledWith({ attackerId: 'npc_1', targetId: 'token_p1', difficulty: 12 });
  });

  it('a faixa mostra até onde vai com a arma do atacante (Curta: 13 m com 50 m)', async () => {
    const { user } = panel();
    await user.click(screen.getByText(/NPC ataca Vex/));
    expect(screen.getByRole('radio', { name: /Curta 15/ })).toHaveAttribute('title', 'até 13 m com Pistola');
  });

  it('sem NPC com ficha, não há botão de atacar', async () => {
    const { user } = panel({ attackers: [] });
    await user.click(screen.getByText(/NPC ataca Vex/));
    expect(screen.queryByRole('button', { name: 'Rolar ataque' })).toBeNull();
    expect(screen.getByText(/Nenhum NPC com ficha/)).toBeInTheDocument();
  });
});

describe('D.6 — CombatPanel: aplicar dano', () => {
  it('sem valor, o botão fica desligado', async () => {
    const { user } = panel();
    await user.click(screen.getByText(/Aplicar dano em Vex/));
    expect(screen.getByRole('button', { name: /Aplicar\s+de dano/ })).toBeDisabled();
  });

  it('manda alvo, dano bruto e local escolhidos', async () => {
    const { onApplyDamage, user } = panel();
    await user.click(screen.getByText(/Aplicar dano em Vex/));
    await user.type(screen.getByRole('spinbutton', { name: /Dano bruto/ }), '7');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Local de impacto' }), 'Head');
    await user.click(screen.getByRole('button', { name: /Aplicar 7 de dano/ }));
    expect(onApplyDamage).toHaveBeenCalledWith('token_p1', 7, 'Head');
  });

  it('"usar último dano" preenche o total e o local da rolagem do jogador', async () => {
    const roll = { total: 9, hitLocation: 'Torso', characterName: 'Kaze', rollType: 'DAMAGE' } as RollResult;
    const { onApplyDamage, user } = panel({ lastDamageRoll: roll });
    await user.click(screen.getByText(/Aplicar dano em Vex/));
    await user.click(screen.getByRole('button', { name: /Usar último dano: 9 \(Kaze\)/ }));
    await user.click(screen.getByRole('button', { name: /Aplicar 9 de dano/ }));
    expect(onApplyDamage).toHaveBeenCalledWith('token_p1', 9, 'Torso');
  });
});

describe('D.6 — CombatPanel: o estado do alvo e o estabilizar', () => {
  it('fora do Mortal não há botão de estabilizar', () => {
    panel();
    expect(screen.queryByRole('button', { name: /Estabilizar/ })).toBeNull();
    expect(screen.getByText(/Ileso · 0\/40/)).toBeInTheDocument();
  });

  it('em Mortal, estabiliza; estabilizado, desfaz', async () => {
    const first = panel({ status: { label: 'Mortal 2', points: 21, isMortal: true, isDead: false, isStabilized: false } });
    await first.user.click(screen.getByRole('button', { name: /Estabilizar/ }));
    expect(first.onToggleStabilized).toHaveBeenCalledWith('token_p1', true);
  });

  it('estabilizado mostra o estado e o botão desfaz', async () => {
    const { onToggleStabilized, user } = panel({ status: { label: 'Mortal 2', points: 21, isMortal: true, isDead: false, isStabilized: true } });
    expect(screen.getByText(/estabilizado/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(onToggleStabilized).toHaveBeenCalledWith('token_p1', false);
  });

  it('morto: aparece MORTO e não há o que estabilizar', () => {
    panel({ status: { label: 'Mortal 2', points: 21, isMortal: true, isDead: true, isStabilized: false } });
    expect(screen.getByText(/MORTO/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Estabilizar/ })).toBeNull();
  });
});

describe('D.6 — HealthTracker: a trilha em pontos', () => {
  afterEach(() => useRoomStore.setState({ view: 'lobby' }));

  const tracker = (patch: Partial<CharacterSheet> = {}) => {
    const onChange = vi.fn();
    render(<HealthTracker sheet={{ ...SHEET, ...patch }} onChange={onChange} onRollDeathSave={vi.fn()} onRollStunSave={vi.fn()} />);
    return { onChange, user: userEvent.setup() };
  };

  it('40 caixas, 4 por nível, do Leve ao Mortal 6', () => {
    tracker();
    expect(screen.getAllByRole('button', { name: /^Ponto \d+/ })).toHaveLength(40);
    expect(screen.getByRole('button', { name: 'Ponto 40 (Mortal 6)' })).toBeInTheDocument();
  });

  it('clicar a caixa 6 marca 6 pontos: Sério', async () => {
    const { onChange, user } = tracker();
    await user.click(screen.getByRole('button', { name: 'Ponto 6 (Sério)' }));
    expect(onChange).toHaveBeenCalledWith({ damagePoints: 6, woundLevel: 2, isDead: false });
  });

  it('clicar a última caixa marcada desmarca ela', async () => {
    const { onChange, user } = tracker({ damagePoints: 6, woundLevel: 2 });
    await user.click(screen.getByRole('button', { name: 'Ponto 6 (Sério)' }));
    expect(onChange).toHaveBeenCalledWith({ damagePoints: 5, woundLevel: 2, isDead: false });
  });

  it('ficha antiga (só nível) aparece no mínimo da caixa: Crítico = 9 pontos', () => {
    tracker({ woundLevel: 3, damagePoints: undefined });
    expect(screen.getByText('9', { exact: true })).toBeInTheDocument();
  });

  it('na mesa, a trilha é só leitura (decisão 7a)', async () => {
    useRoomStore.setState({ view: 'active' });
    const { onChange, user } = tracker();
    const box = screen.getByRole('button', { name: 'Ponto 6 (Sério)' });
    expect(box).toBeDisabled();
    await user.click(box);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/o Mestre aplica o dano/)).toBeInTheDocument();
  });

  it('morto: MORTO, e os saves desligados', () => {
    tracker({ damagePoints: 21, woundLevel: 6, isDead: true });
    expect(screen.getByText('MORTO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /death · 1d10/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /stun · 1d10/i })).toBeDisabled();
  });

  it('estabilizado em Mortal: a ficha avisa', () => {
    tracker({ damagePoints: 21, woundLevel: 6, isStabilized: true });
    expect(screen.getByText(/Estabilizado — sem death save por turno/)).toBeInTheDocument();
  });
});
