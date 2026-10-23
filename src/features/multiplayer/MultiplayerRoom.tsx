import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RoomPlayer, ChatMessage, TacticalGridState, TacticalToken } from '../../types/multiplayer';
import { errorMessage } from '../../lib/errorMessage';
import { TacticalGrid } from './TacticalGrid';
import { CombatPanel } from './CombatPanel';
import { signedModifier } from './SceneConditions';
import { useRoomTransport } from './useRoomTransport';
import { RoomLobby } from './RoomLobby';
import { RoomChat } from './RoomChat';
import { RoomSidebar } from './RoomSidebar';
import { InitiativePanel } from './InitiativePanel';
import { HealthMonitorDialog, InspectSheetDialog } from './RoomDialogs';
import { trailingThrottle } from '../../lib/throttle';
import { useRoomStore } from '../../stores/useRoomStore';
import { useSheetStore } from '../../stores/useSheetStore';
import { woundStateOf } from '../../rules/damage';
import { mortalLevel, woundRow } from '../../rules/character';
import { useInFlight } from '../../hooks/useInFlight';
// Fase 7 (T7.3) — camada HTTP centralizada (sem fetch cru no componente)
import * as roomsApi from '../../api/rooms';
import { Radio, Users, LogOut, Link2 } from 'lucide-react';

interface MultiplayerRoomProps {
  onOpenAuthModal: () => void;
}

interface RoomTab {
  id: 'chat' | 'grid' | 'initiative';
  label: string;
}

export const MultiplayerRoom: React.FC<MultiplayerRoomProps> = ({ onOpenAuthModal }) => {
  // Fase 4 (T4.3) — estado da sala vem da useRoomStore
  const view = useRoomStore((s) => s.view);
  const roomCode = useRoomStore((s) => s.roomCode);
  const room = useRoomStore((s) => s.room);
  const peerId = useRoomStore((s) => s.peerId);
  const sessionToken = useRoomStore((s) => s.sessionToken);
  const errorMsg = useRoomStore((s) => s.errorMsg);
  const setErrorMsg = useRoomStore((s) => s.setErrorMsg);
  const resetRoom = useRoomStore((s) => s.resetRoom);

  // Fase 4 — dados da ficha/user/rolagem via stores (sem props)
  const sheet = useSheetStore((s) => s.sheet);
  const user = useSheetStore((s) => s.user);
  const updateSheet = useSheetStore((s) => s.updateSheet);

  // D.1 (decisão 7a) — na mesa, o ferimento é do servidor: quando o GM aplica
  // dano ou ajusta o Bio-Monitor, a ficha local acompanha (e é salva com ele).
  // Sem loop: a sincronia da ficha não leva o ferimento de volta.
  const tableSheet = view === 'active' && peerId ? room?.players?.[peerId]?.sheet : undefined;
  // D.5 — a estabilização também é do servidor, e vem junto.
  const serverWound = tableSheet ? { ...woundStateOf(tableSheet), isStabilized: tableSheet.isStabilized === true } : null;
  const localWound = woundStateOf(sheet);
  const woundDiffers =
    !!serverWound &&
    (serverWound.damagePoints !== localWound.damagePoints ||
      serverWound.isDead !== localWound.isDead ||
      serverWound.isStabilized !== (sheet.isStabilized === true) ||
      sheet.damagePoints === undefined);
  useEffect(() => {
    if (woundDiffers && serverWound) updateSheet(serverWound);
    // O gatilho é a divergência e os valores do servidor, não o objeto (novo a cada render).
  }, [woundDiffers, serverWound?.damagePoints, serverWound?.isDead, serverWound?.isStabilized]);

  const [tab, setTab] = useState<RoomTab['id']>('chat');
  // G.04 — os modais guardam QUEM, e leem o jogador da sala a cada render: com a
  // cópia tirada no clique, o Bio-Monitor não acendia o nível que o próprio GM
  // acabara de aplicar.
  const [healthPeerId, setHealthPeerId] = useState<string | null>(null);
  const [inspectedPeerId, setInspectedPeerId] = useState<string | null>(null);
  // F.4.2 — os modais abrem por estado, sem DialogTrigger: o Radix não sabe a
  // quem devolver o foco ao fechar. Guarda quem o tinha ao abrir.
  const quemAbriuModal = useRef<HTMLElement | null>(null);
  const abrirSaude = (p: RoomPlayer) => {
    quemAbriuModal.current = document.activeElement as HTMLElement | null;
    setHealthPeerId(p.peerId);
  };
  const abrirInspecao = (p: RoomPlayer) => {
    quemAbriuModal.current = document.activeElement as HTMLElement | null;
    setInspectedPeerId(p.peerId);
  };
  const devolverFoco = (e: Event) => {
    e.preventDefault();
    quemAbriuModal.current?.focus();
  };
  // R.11 — o convite que o GM copia (o link /room/CÓDIGO). Se o navegador não
  // deixar copiar, o link aparece para seleção manual.
  const [inviteState, setInviteState] = useState<'idle' | 'copied' | 'manual'>('idle');

  const handle = user?.displayName || sheet.handle || 'Edgerunner';
  const isGm = !!room && room.gmPeerId === peerId;
  const players = room?.players || {};
  const npcs = room?.npcs || {};
  const selectedHealthPlayer = healthPeerId ? players[healthPeerId] ?? null : null;
  const inspectedPlayer = inspectedPeerId ? players[inspectedPeerId] ?? null : null;
  // Quem sai some da sala, e o modal fecha. Esquecer QUEM era: quem sai pelo
  // "Sair" volta com o mesmo peerId (o sessionStorage o guarda), e o modal
  // reabriria sozinho na cara do GM.
  const healthGone = healthPeerId !== null && selectedHealthPlayer === null;
  const inspectedGone = inspectedPeerId !== null && inspectedPlayer === null;
  useEffect(() => {
    if (healthGone) setHealthPeerId(null);
    if (inspectedGone) setInspectedPeerId(null);
  }, [healthGone, inspectedGone]);

  // L.3c (G.21) — o WebSocket, o SSE, o Yjs, o heartbeat e a sincronia da ficha.
  const { yjsGrid, remoteCursors, yjsConnRef, wsSend } = useRoomTransport({ view, roomCode, sessionToken, peerId, handle, sheet });

  // G.06 — o próximo turno: um por vez, com o botão desligado enquanto a
  // requisição não volta (criar e entrar, no RoomLobby).
  const { run, isBusy } = useInFlight();

  // Helper: ação autenticada (T7.3 — camada api). A api lança ApiError com a
  // mensagem do servidor; o banner mostra o motivo. Devolve a promessa já
  // tratada, para quem precisa saber quando a requisição voltou (G.06).
  const roomAction = (p: Promise<unknown>): Promise<void> =>
    p.then(
      () => {},
      (e: unknown) => setErrorMsg(errorMessage(e, 'Ação negada pelo servidor.'))
    );

  // Fase 5 (T5.3) — grid editado pelo TacticalGrid:
  // - Yjs ativo → escreve no doc CRDT (latência zero, o servidor espelha e
  //   propaga para a mesa); jogador só move o próprio token (validado lá).
  // - Fallback (SSE/REST) → endpoint antigo /tactical-grid.
  const updateGrid = (gridState: TacticalGridState) => {
    if (yjsConnRef.current) {
      yjsConnRef.current.applyLocalGrid(gridState);
      return;
    }
    roomAction(roomsApi.updateTacticalGrid(roomCode, gridState));
  };

  // GM: publica o cursor no grid via awareness Yjs (T5.3). R.4 — no máximo um
  // envio a cada 60 ms, sempre a última posição: ia a cada mousemove (~60/s),
  // e o servidor passou a aceitar ~20/s de awareness por jogador.
  const sendCursor = useMemo(
    () =>
      trailingThrottle((x: number | null, y: number | null) => {
        const conn = yjsConnRef.current;
        if (!conn) return;
        if (x === null || y === null) conn.clearCursor();
        else conn.setCursor(x, y);
      }, 60),
    []
  );
  useEffect(() => () => sendCursor.cancel(), [sendCursor]);
  const handleGmCursorMove = (x: number | null, y: number | null) => {
    if (!isGm) return;
    sendCursor(x, y);
  };

  const updatePlayerHealth = (targetPeerId: string, woundLevel: number) => {
    roomAction(roomsApi.setPlayerHealth(roomCode, targetPeerId, woundLevel));
  };

  // Fase D (D.3) — combate no cartão do token. O servidor faz toda a conta;
  // aqui só se escolhe quem, onde e de onde. Token sem ficha não recebe dano
  // (D.2), então o painel nem aparece para ele.
  const renderTokenCombat = (token: TacticalToken) => {
    const ownerId = token.peerId;
    const owner = ownerId ? room?.players?.[ownerId] ?? room?.npcs?.[ownerId] : undefined;
    if (!owner) {
      return <p className="text-micro text-subtle border-t border-line pt-2">Token sem ficha: não recebe dano.</p>;
    }
    const attackers = Object.values(room?.npcs ?? {}).filter((n) => n.peerId !== ownerId && !n.sheet?.isDead);
    const wound = woundStateOf(owner.sheet ?? {});
    // Só dano rolado por JOGADOR: o do ataque de NPC (mensagem do sistema) o
    // servidor já aplicou, e oferecê-lo aqui convidaria a aplicar duas vezes.
    const lastDamageRoll = [...(room?.chatMessages ?? [])]
      .reverse()
      .find((m) => m.senderHandle !== 'SISTEMA_NET' && m.rollResult?.rollType === 'DAMAGE' && m.rollResult.hitLocation)?.rollResult;
    return (
      <CombatPanel
        key={token.id}
        targetId={token.id}
        targetName={owner.handle}
        attackers={attackers}
        lastDamageRoll={lastDamageRoll}
        onAttack={(input) => roomAction(roomsApi.gmAttack(roomCode, input))}
        onApplyDamage={(targetId, raw, location) => roomAction(roomsApi.applyDamage(roomCode, targetId, raw, location))}
        status={{
          label: woundRow(wound.woundLevel).name,
          points: wound.damagePoints,
          isMortal: mortalLevel(wound.woundLevel) !== null,
          isDead: wound.isDead,
          isStabilized: owner.sheet?.isStabilized === true
        }}
        onToggleStabilized={(targetId, value) => roomAction(roomsApi.setStabilized(roomCode, targetId, value))}
      />
    );
  };

  const nextTurn = () => {
    run('nextTurn', () => roomAction(roomsApi.nextTurn(roomCode)));
  };

  // R.11 — sem a lista do lobby, o convite é o link /room/CÓDIGO.
  const inviteLink = `${window.location.origin}/room/${roomCode}`;
  const copyInvite = () => {
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => setInviteState('copied'))
      .catch(() => setInviteState('manual'));
  };

  const leaveRoom = async () => {
    const { roomCode: code, sessionToken: token } = useRoomStore.getState();
    if (code && token) {
      // T3.3 — authedFetch: após restart, "Sair" reconecta (token novo) e
      // então sai de fato — evita deixar player fantasma online na sala.
      await roomsApi.leaveRoom(code).catch(() => {});
    }
    sessionStorage.removeItem('cyberpunk_session_token');
    resetRoom();
  };

  /* ============================================================
     LOBBY
     ============================================================ */
  if (view === 'lobby') return <RoomLobby onOpenAuthModal={onOpenAuthModal} handle={handle} />;

  /* ============================================================
     SALA ATIVA
     ============================================================ */
  const chatMessages: ChatMessage[] = room?.chatMessages || [];
  const initiative = room?.initiativeList || [];
  const gridState = yjsGrid || room?.tacticalGrid || { rows: 8, cols: 10, theme: 'alley', tokens: [] };

  return (
    <div className="space-y-4 animate-fadeIn">
      {errorMsg && (
        <div className="bg-fault-950/70 border border-fault-500/50 p-3 rounded-lg text-mini text-fault-300 animate-fadeIn">
          {errorMsg}
        </div>
      )}
      {/* Header da sala */}
      <div className="bg-surface/90 border-l-4 border-l-ok-500 border-y border-r border-line rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-ok-950 border border-ok-500/60 flex items-center justify-center">
            <Radio className="w-5 h-5 text-ok-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-black text-white uppercase tracking-caps">{room?.name}</span>
              <span className="text-micro px-1.5 py-0.5 rounded bg-raised border border-line-strong text-accent-300 font-mono select-all">
                {roomCode}
              </span>
              {isGm && (
                <button
                  onClick={copyInvite}
                  className="text-micro px-1.5 py-0.5 rounded bg-raised border border-accent-700/60 text-accent-300 hover:border-accent-400 font-bold uppercase flex items-center space-x-1 cursor-pointer transition-all"
                >
                  <Link2 className="w-3 h-3" />
                  <span>{inviteState === 'copied' ? 'Link copiado' : 'Copiar convite'}</span>
                </button>
              )}
              {isGm && (
                <span className="text-micro px-1.5 py-0.5 rounded bg-signal-950 border border-signal-500/60 text-signal-300 font-black uppercase">
                  GM
                </span>
              )}
            </div>
            <p className="text-micro text-subtle">{room?.locationName || 'Night City'}</p>
            {/* K.3b — o modificador da cena entra em toda rolagem de ataque e
                perícia: a mesa inteira o vê enquanto ele vale. */}
            {!!room?.combatModifier && (
              <p className="text-micro text-signal-300">
                Mod. do Mestre <span className="font-mono">{signedModifier(room.combatModifier)}</span>
                {room.modifierReason ? ` · ${room.modifierReason}` : ''}
              </p>
            )}
            {isGm && inviteState === 'manual' && (
              <p className="text-micro text-accent-300 font-mono select-all break-all">{inviteLink}</p>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-micro text-muted flex items-center space-x-1">
            <Users className="w-3.5 h-3.5 text-accent-400" />
            <span>{Object.keys(players).length} jogadores</span>
          </span>
          <button
            onClick={leaveRoom}
            className="px-3 py-1.5 bg-raised hover:bg-raised-strong border border-line-strong hover:border-accent-500 text-fg-soft hover:text-accent-400 rounded font-bold text-micro uppercase flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center space-x-1.5">
        {([
          { id: 'chat' as const, label: '💬 Chat' },
          { id: 'grid' as const, label: '🗺️ Grid Tático' },
          { id: 'initiative' as const, label: '⚔️ Iniciativa' }
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-2 rounded-lg border-2 text-mini font-black uppercase tracking-caps transition-all cursor-pointer ${
              tab === t.id
                ? 'bg-ok-600 text-white border-ok-400 shadow-glow-12 shadow-ok-500/50'
                : 'bg-surface text-muted border-line hover:border-ok-500/50 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CHAT */}
      {tab === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <RoomChat chatMessages={chatMessages} roomCode={roomCode} wsSend={wsSend} />

          {/* Lateral: jogadores & NPCs */}
          <RoomSidebar
            room={room}
            roomCode={roomCode}
            peerId={peerId}
            isGm={isGm}
            players={players}
            npcs={npcs}
            roomAction={roomAction}
            onInspectPlayer={abrirInspecao}
            onSelectPlayerForHealthEdit={abrirSaude}
          />
        </div>
      )}

      {/* GRID TÁTICO */}
      {tab === 'grid' && (
        <div className="space-y-3">
          {isGm && (
            <div className="bg-surface/60 border border-line rounded p-2.5 text-micro text-muted">
              💡 Arraste as fichas da barra lateral diretamente para o grid, ou use os controles do grid para adicionar NPCs, cobertura e perigos.
            </div>
          )}
          <TacticalGrid
            gridState={gridState}
            roleMode={isGm ? 'gm' : 'player'}
            peerId={peerId}
            players={players}
            onUpdateGrid={updateGrid}
            onSelectPlayerForHealthEdit={isGm ? abrirSaude : undefined}
            onInspectPlayer={abrirInspecao}
            remoteCursors={remoteCursors}
            onCursorMove={handleGmCursorMove}
            renderTokenCombat={isGm ? renderTokenCombat : undefined}
          />
        </div>
      )}

      {/* INICIATIVA */}
      {tab === 'initiative' && (
        <InitiativePanel
          initiative={initiative}
          roomCode={roomCode}
          isGm={isGm}
          roomAction={roomAction}
          onNextTurn={nextTurn}
          nextTurnBusy={isBusy('nextTurn')}
        />
      )}

      {/* Os dois modais da mesa (F.4.2), no RoomDialogs. */}
      <HealthMonitorDialog
        selectedHealthPlayer={selectedHealthPlayer}
        onClose={() => setHealthPeerId(null)}
        onCloseAutoFocus={devolverFoco}
        onSetWound={updatePlayerHealth}
      />
      <InspectSheetDialog
        inspectedPlayer={inspectedPlayer}
        isGm={isGm}
        onClose={() => setInspectedPeerId(null)}
        onCloseAutoFocus={devolverFoco}
      />
    </div>
  );
};
