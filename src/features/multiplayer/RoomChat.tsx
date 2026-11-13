import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ChatMessage, TableRollKind } from '../../types/multiplayer';
import * as roomsApi from '../../api/rooms';
import { MessageSquare, Send, Target, Zap, HeartPulse } from 'lucide-react';

interface RoomChatProps {
  chatMessages: ChatMessage[];
  roomCode: string;
  /** Envia pelo WebSocket; `false` = sem socket, vai pelo REST. */
  wsSend: (msg: object) => boolean;
}

/** L.3c (G.21) — o chat da mesa, com os botões de rolagem (o servidor rola, T5.4). */
export const RoomChat: React.FC<RoomChatProps> = ({ chatMessages, roomCode, wsSend }) => {
  const [chatInput, setChatInput] = useState('');

  // G.24 — o chat acompanha a mensagem nova, só quando quem lê já está no fim
  // (quem rolou para cima para reler fica onde está). Na mesa, a rolagem só
  // existe no chat (T5.4). O gatilho é a ÚLTIMA mensagem, não a contagem: no
  // teto de 100 (E.3b) a contagem para de crescer. Só a caixa rola, não a página.
  const chatBox = useRef<HTMLDivElement | null>(null);
  const chatAtBottom = useRef(true);
  const chatBoxRef = useCallback((el: HTMLDivElement | null) => {
    chatBox.current = el;
    if (el) {
      chatAtBottom.current = true; // a caixa (re)aparece mostrando a última
      el.scrollTop = el.scrollHeight;
    }
  }, []);
  const onChatScroll = () => {
    const el = chatBox.current;
    if (el) chatAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };
  const lastChatId = chatMessages[chatMessages.length - 1]?.id;
  useLayoutEffect(() => {
    const el = chatBox.current;
    if (el && chatAtBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastChatId]);

  const sendChat = async (text?: string) => {
    const content = (text ?? chatInput).trim();
    if (!content) return;
    if (text === undefined) setChatInput('');
    // Fase 5 (T5.2) — WebSocket quando disponível; fallback: POST autenticado.
    // T5.4 — sem rollResult: rolagens só existem via { type: 'roll' }.
    if (wsSend({ type: 'message', text: content })) return;
    try {
      await roomsApi.postMessage(roomCode, content);
    } catch {
      /* ignore */
    }
  };

  // Fase 5 (T5.4) — RNG SERVER-AUTHORITATIVE: o cliente só pede o tipo de
  // rolagem; o servidor rola os dados (crypto.randomInt) usando a ficha que
  // ELE possui e o resultado volta no broadcast do chat. WS-first, fallback
  // POST /roll (clientes SSE).
  const requestTableRoll = (kind: TableRollKind, skillName?: string) => {
    if (wsSend({ type: 'roll', kind, skillName })) return;
    roomsApi.postRoll(roomCode, kind, skillName).catch(() => {});
  };

  const rollAttack = () => requestTableRoll('attack');
  const rollTableDamage = () => requestTableRoll('damage');
  const rollTableSave = () => requestTableRoll('save');
  const rollTableStun = () => requestTableRoll('stun');

  return (
    <div className="lg:col-span-2 bg-surface/80 border border-line rounded-xl overflow-hidden flex flex-col h-[540px]">
      <div className="flex items-center justify-between p-3 border-b border-line">
        <span className="text-xs font-black text-accent-400 uppercase tracking-caps flex items-center space-x-1.5">
          <MessageSquare className="w-4 h-4" /> Chat da Mesa
        </span>
        <span className="text-micro text-subtle">{chatMessages.length} mensagens</span>
      </div>
      <div
        ref={chatBoxRef}
        onScroll={onChatScroll}
        role="log"
        aria-label="Mensagens da mesa"
        className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2"
      >
        {chatMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.senderHandle === 'SISTEMA_NET' ? 'justify-center' : ''}`}>
            {msg.senderHandle === 'SISTEMA_NET' ? (
              <div className="bg-raised/60 border border-line rounded px-3 py-1.5 text-micro text-muted text-center font-mono max-w-[90%]">
                {msg.text}
              </div>
            ) : (
              <div className="max-w-[85%] space-y-0.5">
                <div className="flex items-center space-x-1.5 text-micro font-mono">
                  <span className={msg.senderRole === 'gm' ? 'text-signal-400' : 'text-accent-300'}>
                    {msg.senderRole === 'gm' ? '👑' : '🔹'} {msg.senderHandle}
                  </span>
                  <span className="text-faint">{msg.timestamp}</span>
                </div>
                <div className={`px-3 py-2 rounded-lg text-xs leading-relaxed font-sans ${
                  msg.senderRole === 'gm'
                    ? 'bg-signal-950/50 border border-signal-800/60 text-signal-100'
                    : 'bg-raised border border-line-strong text-fg'
                }`}>
                  {msg.isDiceRoll && msg.rollResult ? (
                    <div>
                      <span className="font-mono text-signal-400">
                        🎲 {msg.rollResult.label}: {msg.rollResult.total}
                      </span>
                      <p className="font-mono text-micro text-muted mt-1">{msg.rollResult.details}</p>
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {chatMessages.length === 0 && (
          <div className="text-center py-10 text-micro text-faint">A mesa está em silêncio... Quebre o gelo!</div>
        )}
      </div>
      <div className="border-t border-line p-3 flex space-x-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendChat()}
          placeholder="Mensagem para a mesa..."
          className="flex-1 bg-raised border border-field text-fg-strong text-xs px-3 py-2.5 rounded focus:border-accent-400 focus:outline-none placeholder:text-faint"
        />
        <button
          onClick={() => sendChat()}
          className="px-3.5 py-2.5 bg-accent-500 hover:bg-accent-400 text-black rounded font-black uppercase cursor-pointer transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
        <button
          onClick={rollAttack}
          title="🎯 Ataque — d10 + REF + perícia da arma + WA (RNG no servidor)"
          className="px-3 py-2.5 bg-signal-500 hover:bg-signal-400 text-black rounded font-black uppercase cursor-pointer transition-all"
        >
          <Target className="w-4 h-4" />
        </button>
        <button
          onClick={rollTableDamage}
          title="💥 Dano da arma + local de impacto (RNG no servidor)"
          className="px-3 py-2.5 bg-danger-600 hover:bg-danger-700 text-white rounded font-black uppercase cursor-pointer transition-all"
        >
          <Zap className="w-4 h-4" />
        </button>
        <button
          onClick={rollTableStun}
          title="💫 Stun Save — 1d10 ≤ BODY − 0 a 9 pelo ferimento (RNG no servidor)"
          aria-label="Stun Save"
          className="px-3 py-2.5 bg-caution-500 hover:bg-caution-400 text-black rounded font-black uppercase cursor-pointer transition-all"
        >
          <Zap className="w-4 h-4 rotate-180" />
        </button>
        <button
          onClick={rollTableSave}
          title="🩸 Death Save — 1d10 ≤ BODY − nível Mortal (RNG no servidor)"
          className="px-3 py-2.5 bg-danger-800 hover:bg-danger-700 border border-danger-500 text-white rounded font-black uppercase cursor-pointer transition-all"
        >
          <HeartPulse className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
