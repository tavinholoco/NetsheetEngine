import React from 'react';
import { Sparkles, Terminal, FileCode, CheckCircle2, ShieldAlert, Cpu } from 'lucide-react';

export interface PatchNote {
  version: string;
  date: string;
  title: string;
  tag: string;
  tagColor: string;
  summary: string;
  highlights: string[];
}

export const PATCH_NOTES: PatchNote[] = [
  {
    version: 'v0.4.0',
    date: 'FASE 7 // ATUAL',
    title: 'TÁTICO & INTERATIVIDADE DO GRID',
    tag: 'GRID & HUD',
    tagColor: 'text-yellow-400 border-yellow-500/60 bg-yellow-950/60',
    summary: 'Atualização v0.4.0 com otimização em tempo real do grid tático, inspeção direta por botão (?) de status, movimentação sem latência visual e eliminação de saltos de tela.',
    highlights: [
      'Ícone de Inspeção (?): Adicionado botão dedicado de interrogação em cada token/elemento do grid para alternar o painel de status do elemento de forma direta e sem conflitos de drag.',
      'Sincronização Tática Instantânea: Atualização otimista imediata ao mover tokens e ajustar pontos de vida no grid tático.',
      'Streaming SSE sem Buffering: Cabeçalhos HTTP ajustados (X-Accel-Buffering: no) para transmissão em tempo real sem atraso de proxy.',
      'Estabilidade de Tela: Remoção da rolagem indesejada da página ao interagir ou mover itens no grid tático e envio no chat.',
      'Suporte Aprimorado para o GM: Posicionamento direto com clique em células vazias para tokens selecionados e feedback tático refinado.'
    ]
  },
  {
    version: 'v0.3.0',
    date: 'FASE 6 // CONCLUÍDO',
    title: 'SISTEMA SOCIAL & REFINAMENTO MULTIPLAYER',
    tag: 'SOCIAL & MULTI',
    tagColor: 'text-emerald-400 border-emerald-500/60 bg-emerald-950/60',
    summary: 'Conclusão da Fase 6 (Rede Social de Edgerunners, solicitações de amizade com aceite/recusa em tempo real e correção do sistema de remoção de amigos) e início da Fase 7.',
    highlights: [
      'Envio e recebimento de solicitações de amizade para usuários reais com ID Cyberpunk único',
      'Notificações reativas e painel de solicitações de amizade pendentes para aceite ou recusa instantâneos',
      'Correção do bug de desfazer amizade (remoção imediata local e sincronizada no Firestore com blacklist de segurança)',
      'Avisos inteligentes e tratamento automático mantido para adição direta de NPCs',
      'Início oficial da Fase 7: Refinamento da mesa virtual multiplayer V2 e ordenamento de combate'
    ]
  },
  {
    version: 'v0.2.5',
    date: 'FASE 5 // CONCLUÍDO',
    title: 'REDESIGN HUD CYBERPUNK 2077',
    tag: 'LAYOUT',
    tagColor: 'text-red-400 border-red-500/60 bg-red-950/60',
    summary: 'Novo layout de navegacao inspirado no menu principal de Cyberpunk 2077 Phantom Liberty, com barra vertical neon e feed flutuante de patch notes.',
    highlights: [
      'Menu vertical exclusivo com botoes Jogar, Ficha, Lendas, Netrunner, Dados, PRD e Perfil',
      'Feed flutuante de historico de versoes e notas de atualizacao do sistema',
      'Responsividade aprimorada para telas de alta densidade e dispositivos mobes',
      'Efeitos visuais de glitch, linhas de escaneamento CRT e leds reativos'
    ]
  },
  {
    version: 'v0.2.4',
    date: 'FASE 4 // CONCLUÍDO',
    title: 'PERFIL LED & BIBLIOTECA DE LENDAS',
    tag: 'PERFIL',
    tagColor: 'text-emerald-400 border-emerald-500/60 bg-emerald-950/60',
    summary: 'Botao unificado de perfil com LED de status reativo, selecao de avatar com cores distintas e clonagem de lendas de Night City.',
    highlights: [
      'Indicador LED com cores reativas: Verde (Online), Amarelo (Inativo) e Roxo (Em Jogo)',
      'Aventais customizaveis (CPU, Shield, Skull, Radio, Zap) com paletas proprias',
      'Biblioteca de Presets com clonagem 1-Clique para a conta do usuario',
      'Marcacao de Ficha Ativa no perfil para selecao automatica em salas multiplayer'
    ]
  },
  {
    version: 'v0.2.3',
    date: 'FASE 3 // CONCLUÍDO',
    title: 'MULTIPLAYER EM TEMPO REAL',
    tag: 'NETWORKING',
    tagColor: 'text-purple-400 border-purple-500/60 bg-purple-950/60',
    summary: 'Infraestrutura de sincronizacao em tempo real para salas de jogo multiplayer com monitoramento do Mestre e rolagens simultaneas.',
    highlights: [
      'Canal de transmissao SSE e WebSockets de ultrabaixa latencia (< 50ms)',
      'Painel do Mestre (Ref Dashboard) para inspecionar saude e atributos de jogadores',
      'Feed dinamico de combate com rolagens de dados compartilhadas na mesa'
    ]
  },
  {
    version: 'v0.2.2',
    date: 'FASE 2 // CONCLUÍDO',
    title: 'ASSISTENTE NETRUNNER IA',
    tag: 'INTELLIGENCE',
    tagColor: 'text-cyan-400 border-cyan-500/60 bg-cyan-950/60',
    summary: 'Integracao com Gemini API para diagnosticos taticos de build, geracao de Lifepath narrativo e suporte ao livro de regras.',
    highlights: [
      'Chat inteligente especializado no sistema Cyberpunk 2020',
      'Gerador automatico de eventos de vida (Lifepath) com 1D10 e inteligencia artificial',
      'Diagnostico de otimizacao de combate FNFF'
    ]
  },
  {
    version: 'v0.2.0',
    date: 'FASE 1 // CONCLUÍDO',
    title: 'MOTOR FNFF & AUTOMATIZACAO',
    tag: 'CORE ENGINE',
    tagColor: 'text-yellow-400 border-yellow-500/60 bg-yellow-950/60',
    summary: 'Calculadora completa de estatisticas derivadas, sistema de combate FNFF, gestao de cyberware e rolador de dados com efeitos sonoros.',
    highlights: [
      'Autocalculo de BTM, SP de Armadura por localizacao e Perda de Humanidade',
      'Rolador de dados 1d10 com acerto critico explosivo e falha critica (fumble)',
      'Efeitos sonoros HUD com Web Audio API'
    ]
  }
];

interface PatchNotesFeedProps {
  className?: string;
  compact?: boolean;
  embedded?: boolean;
}

export const PatchNotesFeed: React.FC<PatchNotesFeedProps> = ({
  className = '',
  compact = false,
  embedded = false
}) => {
  return (
    <div className={`space-y-3 font-mono ${className}`}>
      {/* Header Badge (Hidden when embedded in accordion button) */}
      {!embedded && (
        <div className="flex items-center justify-between border-b border-red-500/40 pb-2">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-red-400 animate-pulse" />
            <h3 className="text-xs font-black tracking-widest text-red-400 uppercase">
              PATCH NOTES // NETWORK FEED
            </h3>
          </div>
          <span className="text-[10px] text-slate-300 bg-red-950/80 px-2 py-0.5 rounded border border-red-800">
            SYSTEM_LOG.DAT
          </span>
        </div>
      )}

      {/* Feed Container */}
      <div className={`space-y-3 overflow-y-auto pr-1 custom-scrollbar ${embedded ? 'max-h-48' : compact ? 'max-h-[360px]' : 'max-h-[500px]'}`}>
        {PATCH_NOTES.map((note) => (
          <div
            key={note.version}
            className="bg-slate-950/80 border border-slate-800 hover:border-red-500/60 p-3.5 rounded-lg transition-all group backdrop-blur-md relative overflow-hidden shadow-lg hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]"
          >
            {/* Top Accent Bar */}
            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-500 via-yellow-500 to-cyan-500"></div>

            <div className="pl-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-extrabold text-red-400 tracking-wider">
                    {note.version}
                  </span>
                  <span className="text-[10px] text-slate-300 font-bold uppercase tracking-tight">
                    {note.title}
                  </span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 border rounded font-bold uppercase ${note.tagColor}`}>
                  {note.tag}
                </span>
              </div>

              <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                {note.summary}
              </p>

              {!compact && (
                <div className="pt-1.5 border-t border-slate-900 space-y-1">
                  <span className="text-[10px] text-red-400/90 font-bold uppercase block">
                    Destaques da Atualizacao:
                  </span>
                  <ul className="space-y-1">
                    {note.highlights.map((h, idx) => (
                      <li key={idx} className="text-[10px] text-slate-400 flex items-start space-x-1.5">
                        <span className="text-red-500 font-bold shrink-0">•</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between text-[9px] text-slate-300 pt-1">
                <span>STATUS: STABLE_DEPLOY</span>
                <span className="text-slate-200">{note.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
