import React, { useState, useEffect, useRef } from 'react';
import { Bot, MessageSquare, Send, X } from 'lucide-react';
import {
  DirectMessage,
  FriendUser,
  User,
  getChatRoomId,
  sendDirectMessage,
  subscribeToDirectMessages
} from '../../lib/supabase';

export interface FriendChatBoxProps {
  currentUser: User;
  friend: FriendUser;
  onClose: () => void;
}

// Inline Cyberpunk Chat Component for Friends / NPCs
export const FriendChatBox: React.FC<FriendChatBoxProps> = ({ currentUser, friend, onClose }) => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatRoomId = getChatRoomId(currentUser.uid, friend.uid);

  useEffect(() => {
    const unsub = subscribeToDirectMessages(chatRoomId, (msgs) => {
      setMessages(msgs);
    });
    return () => unsub();
  }, [chatRoomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const textToSend = inputText;
    setInputText('');
    setSending(true);

    const senderName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Edgerunner';
    await sendDirectMessage(currentUser.uid, senderName, friend.uid, textToSend);
    setSending(false);
  };

  const isNpc = friend.uid.startsWith('npc_');

  return (
    <div className="mt-2 bg-black/95 border border-accent-500/60 rounded-lg p-2 space-y-2 animate-fadeIn shadow-glow-15 shadow-accent-500/15">
      {/* Chat Header */}
      <div className="flex items-center justify-between border-b border-accent-500/30 pb-1.5">
        <div className="flex items-center space-x-1.5 min-w-0">
          <MessageSquare className="w-3.5 h-3.5 text-accent-400 shrink-0" />
          <span className="text-micro text-accent-300 font-mono uppercase truncate">
            CHAT // {friend.displayName}
          </span>
          <span className="text-micro font-mono text-fg-soft bg-accent-950 px-1 py-0.2 rounded border border-accent-500/40 shrink-0">
            {friend.cyberpunkId}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-muted hover:text-accent-400 p-0.5 rounded transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* NPC Cyberpunk Badge Notice */}
      {isNpc && (
        <div className="bg-signal-950/40 border border-signal-500/30 px-2 py-1 rounded text-micro text-signal-300 flex items-center space-x-1">
          <Bot className="w-3 h-3 text-signal-400 shrink-0" />
          <span>SISTEMA NET: IA de {friend.displayName} ativa em Night City</span>
        </div>
      )}

      {/* Messages Scroll Box */}
      <div className="h-40 overflow-y-auto custom-scrollbar space-y-2 p-1.5 bg-surface/90 rounded border border-line-soft">
        {messages.length === 0 ? (
          <div className="text-center py-6 text-micro text-subtle">
            Nenhuma mensagem trocada ainda. Envie um ping no HoloNet!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderUid === currentUser.uid;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center space-x-1 text-micro font-mono text-muted mb-0.5">
                  <span className={isMe ? 'text-accent-400' : 'text-signal-400'}>
                    {isMe ? 'VOCÊ' : msg.senderName}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  className={`max-w-[88%] px-2.5 py-1.5 rounded text-mini leading-relaxed break-words font-sans ${
                    isMe
                      ? 'bg-accent-950 text-accent-100 border border-accent-500/50 rounded-br-none shadow-glow-8 shadow-accent-500/15'
                      : 'bg-raised text-fg-strong border border-line-strong rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box Form */}
      <form onSubmit={handleSend} className="flex space-x-1 pt-1">
        <input
          type="text"
          placeholder={`Digitar para ${friend.displayName}...`}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-surface border border-accent-700 text-fg-strong px-2.5 py-1 rounded text-mini focus:border-accent-400 focus:outline-none placeholder:text-faint font-sans"
        />
        <button
          type="submit"
          disabled={sending || !inputText.trim()}
          className="px-2.5 py-1 bg-accent-500 hover:bg-accent-400 text-black font-black text-micro rounded uppercase flex items-center space-x-1 cursor-pointer transition-all disabled:opacity-40"
        >
          <Send className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
};
