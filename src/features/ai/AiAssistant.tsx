import React, { useEffect, useRef, useState } from 'react';
import { CharacterSheet } from '../../types/cyberpunk';
import { Bot, Send, Sparkles, Lock, Dices, User } from 'lucide-react';
// Fase 7 (T7.3) — camada HTTP centralizada (sem fetch cru no componente)
import { askGemini } from '../../api/gemini';

interface AiAssistantProps {
  sheet: CharacterSheet;
  onChange: (updated: Partial<CharacterSheet>) => void;
  user: { uid: string; displayName?: string | null; email?: string | null } | null;
  onOpenAuthModal: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

// O SYSTEM_PROMPT vivia aqui e era enviado a cada requisição. Ele passou para
// `server/aiPrompt.ts` na Fase B (B.1 — SEC-01): enquanto era o cliente que o
// mandava, qualquer um podia trocá-lo e usar a chave do dono como proxy de LLM.

export const AiAssistant: React.FC<AiAssistantProps> = ({ sheet, onChange, user, onOpenAuthModal }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Bem-vindo ao NETRUNNER IA, ${user?.displayName || 'Edgerunner'}. Posso diagnosticar seu build, explicar regras CP2020 e gerar lifepath. Ficha ativa: "${sheet.handle || 'Sem nome'}" (${sheet.role}).`
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    if (!user) {
      onOpenAuthModal();
      return;
    }
    setInput('');
    setMessages((prev) => [...prev, { id: 'u_' + Date.now(), role: 'user', text: content }]);
    setLoading(true);

    try {
      const text = await askGemini(content);
      setMessages((prev) => [...prev, { id: 'a_' + Date.now(), role: 'assistant', text }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          role: 'assistant',
          text: `⚠️ Falha de conexão com o NETRUNNER IA: ${e?.message || 'Verifique a GEMINI_API_KEY no servidor.'}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const generateLifepath = () => {
    const roll = () => Math.min(10, Math.max(1, Math.floor(Math.random() * 10) + 1));
    const prompt = `Gere um lifepath narrativo completo para meu personagem Cyberpunk 2020 (Role: ${sheet.role}). Use estas rolagens 1D10: família=${roll()}, pais=${roll()}, tragédia=${roll()}, infância=${roll()}, motivação=${roll()}, eventos=${roll()},${roll()},${roll()}. Formate como uma história curta e imersiva.`;
    sendMessage(prompt);
  };

  const quickDiagnose = () => {
    const stats = sheet.stats;
    const weak = (Object.keys(stats) as (keyof typeof stats)[])
      .filter((k) => stats[k] <= 4)
      .map((k) => k)
      .join(', ');
    const prompt = `Diagnostique o build da minha ficha: Role=${sheet.role}, Stats=${JSON.stringify(stats)}, Perícias=${sheet.skills.map(s => s.name).join(', ') || 'nenhuma'}, Ciberware=${sheet.cyberware.length} itens, Ferimento=${sheet.woundLevel}. Dê 3 dicas de otimização para combate FNFF.${weak ? ` Atenção: atributos fracos (≤4): ${weak}.` : ''}`;
    sendMessage(prompt);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="bg-surface/90 border-l-4 border-l-cyber-500 border-y border-r border-line rounded-xl p-5 flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-display text-[50px] font-black text-cyber-500 select-none">
          NETRUNNER
        </div>
        <div className="flex items-center space-x-3 relative z-10">
          <div className="w-11 h-11 rounded-lg bg-cyber-950 border border-cyber-500/60 flex items-center justify-center shadow-glow-15 shadow-cyber-500/40">
            <Bot className="w-6 h-6 text-cyber-400" />
          </div>
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-cyber-400 uppercase tracking-display">Assistente Netrunner IA</h2>
            <p className="text-micro text-subtle">Conectado à Net de Night City via Gemini API</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 relative z-10">
          <button
            onClick={quickDiagnose}
            className="px-3 py-1.5 bg-accent-950/80 hover:bg-accent-900 border border-accent-500/50 text-accent-300 rounded font-bold text-micro uppercase transition-all cursor-pointer"
          >
            🔬 Diagnosticar Build
          </button>
          <button
            onClick={generateLifepath}
            className="px-3 py-1.5 bg-cyber-600 hover:bg-cyber-500 text-white rounded font-bold text-micro uppercase transition-all cursor-pointer shadow-glow-10 shadow-cyber-500/40"
          >
            <Dices className="w-3 h-3 inline mr-1" />
            Gerar Lifepath
          </button>
        </div>
      </div>

      {/* Chat */}
      <div className="bg-surface/80 border border-line rounded-xl overflow-hidden flex flex-col h-[520px]">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-lg text-xs leading-relaxed font-sans ${
                  msg.role === 'user'
                    ? 'bg-cyber-950 text-cyber-100 border border-cyber-500/50 rounded-br-none'
                    : 'bg-raised text-fg border border-line-strong rounded-bl-none'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-1 text-micro font-mono uppercase">
                  {msg.role === 'user' ? (
                    <>
                      <User className="w-3 h-3 text-cyber-300" />
                      <span className="text-cyber-300">VOCÊ</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3 h-3 text-accent-400" />
                      <span className="text-accent-400">NETRUNNER IA</span>
                    </>
                  )}
                </div>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-raised border border-line-strong rounded-lg px-3.5 py-2.5 text-xs text-muted flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-cyber-400 animate-pulse" />
                <span className="font-mono">Desbravando a Net...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="border-t border-line p-3">
          {!user ? (
            <button
              onClick={onOpenAuthModal}
              className="w-full py-2.5 bg-signal-400 hover:bg-signal-300 text-black font-black text-mini uppercase rounded flex items-center justify-center space-x-2 cursor-pointer transition-all"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Acesse sua conta para usar o NETRUNNER IA</span>
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
              className="flex space-x-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte sobre regras CP2020, otimize sua build..."
                className="flex-1 bg-raised border border-line-strong text-fg-strong text-xs px-3 py-2.5 rounded focus:border-cyber-400 focus:outline-none placeholder:text-faint font-sans"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 bg-cyber-600 hover:bg-cyber-500 disabled:opacity-40 text-white rounded font-black uppercase flex items-center space-x-1 cursor-pointer transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
