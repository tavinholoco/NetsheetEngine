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
    <div className="space-y-5 font-mono animate-fadeIn">
      {/* Header */}
      <div className="bg-slate-950/90 border-l-4 border-purple-500 border-y border-r border-slate-800 rounded-xl p-5 flex items-center justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none font-mono text-[50px] font-black text-purple-500 select-none">
          NETRUNNER
        </div>
        <div className="flex items-center space-x-3 relative z-10">
          <div className="w-11 h-11 rounded-lg bg-purple-950 border border-purple-500/60 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.4)]">
            <Bot className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-purple-400 uppercase tracking-widest">Assistente Netrunner IA</h2>
            <p className="text-[10px] text-slate-500">Conectado à Net de Night City via Gemini API</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 relative z-10">
          <button
            onClick={quickDiagnose}
            className="px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 rounded font-bold text-[10px] uppercase transition-all cursor-pointer"
          >
            🔬 Diagnosticar Build
          </button>
          <button
            onClick={generateLifepath}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded font-bold text-[10px] uppercase transition-all cursor-pointer shadow-[0_0_10px_rgba(168,85,247,0.4)]"
          >
            <Dices className="w-3 h-3 inline mr-1" />
            Gerar Lifepath
          </button>
        </div>
      </div>

      {/* Chat */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden flex flex-col h-[520px]">
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3.5 py-2.5 rounded-lg text-xs leading-relaxed font-sans ${
                  msg.role === 'user'
                    ? 'bg-purple-950 text-purple-100 border border-purple-500/50 rounded-br-none'
                    : 'bg-slate-900 text-slate-200 border border-slate-700 rounded-bl-none'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-1 text-[9px] font-mono font-black uppercase">
                  {msg.role === 'user' ? (
                    <>
                      <User className="w-3 h-3 text-purple-300" />
                      <span className="text-purple-300">VOCÊ</span>
                    </>
                  ) : (
                    <>
                      <Bot className="w-3 h-3 text-cyan-400" />
                      <span className="text-cyan-400">NETRUNNER IA</span>
                    </>
                  )}
                </div>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-900 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs text-slate-400 flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                <span className="font-mono">Desbravando a Net...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="border-t border-slate-800 p-3">
          {!user ? (
            <button
              onClick={onOpenAuthModal}
              className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black text-[11px] uppercase rounded flex items-center justify-center space-x-2 cursor-pointer transition-all"
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
                className="flex-1 bg-slate-900 border border-slate-700 text-slate-100 text-xs px-3 py-2.5 rounded focus:border-purple-400 focus:outline-none placeholder:text-slate-600 font-sans"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded font-black uppercase flex items-center space-x-1 cursor-pointer transition-all"
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
