/**
 * ============================================================
 * NETSHEET ENGINE — DADOS DO PRD
 * Conteúdo real do Product Requirements Document, consumido pelo
 * PrdViewer. Espelha o PLANO_DE_ACAO.md (documento mestre): visão,
 * módulos, roadmap de 13 fases e arquitetura técnica.
 * ============================================================
 */

import type { PrdDocument } from '../types/prd';

/** Documento PRD oficial do produto. */
export const PRD_DOCUMENT: PrdDocument = {
  id: 'prd-netsheet-engine',
  title: 'NETSHEET ENGINE — Cyberpunk 2020 Sheet Builder & PRD Suite',
  subtitle:
    'Especificação de produto: criação de fichas, calculador de estatísticas, cyberware, lifepath, rolagem FNFF, mesa multiplayer em tempo real, sistema social e visualizador de PRD.',
  version: 'v0.4.0-RELEASE',
  updatedAt: '03/08/2026',
  overview: [
    {
      id: 'visao',
      title: 'Visão do Produto',
      content:
        'NETSHEET ENGINE é uma suíte completa para mesas de Cyberpunk 2020. O produto nasce da necessidade de digitalizar integralmente o fluxo de jogo: da criação da ficha à mesa virtual multiplayer em tempo real, com suporte a rolagem de dados FNFF (Friday Night Firefight), lifepath narrativo e assistente de inteligência artificial para o Netrunner. O objetivo é reduzir o atrito do jogo de mesa para mestres e jogadores, mantendo fidelidade às regras oficiais e identidade visual cyberpunk (HUD neon, scanlines e terminal).',
      items: [
        'Status: fase ALPHA — produto em desenvolvimento ativo, ainda não é lançamento oficial.',
        'Identidade pública 100% própria — nenhum crédito a ferramentas de scaffold na UI, README ou HTML.',
        'Foco: fidelidade CP2020 + experiência multiplayer em tempo real de baixa latência.'
      ]
    },
    {
      id: 'personas',
      title: 'Personas',
      content:
        'O produto atende três personas centrais do ecossistema Cyberpunk 2020: o Jogador, o Mestre de Jogo (GM) e o Netrunner/entusiasta de sistemas.',
      items: [
        'Jogador: cria e evolui fichas, rola dados FNFF, acompanha ferimentos, conversa com amigos e joga em mesas multiplayer.',
        'Mestre (GM): administra salas, grid tático, iniciativa, NPCs gerados, poderes de GM e condições de combate em tempo real.',
        'Entusiasta de sistemas: explora o PRD do produto, o roadmap e a arquitetura técnica.'
      ]
    },
    {
      id: 'escopo',
      title: 'Escopo Funcional',
      content:
        'O produto cobre sete módulos funcionais interligados, do criador de ficha ao sistema social e à mesa multiplayer.',
      items: [
        'Ficha: atributos primários, perícias, cyberware, armas/SP, ferimentos e lifepath.',
        'Mesa Multiplayer: salas em tempo real, grid tático, iniciativa, NPCs gerados e poderes de GM.',
        'Dados: rolador FNFF com crítico explosivo, fumble e dano por localização.',
        'Netrunner IA: assistente com integração Gemini para diagnóstico de build e geração de lifepath.',
        'Lendas: biblioteca de presets e NPCs com clonagem 1-clique.',
        'Social: perfis, amigos, solicitações e mensagens diretas em tempo real.',
        'PRD: visualizador de especificação e roadmap do produto.'
      ]
    },
    {
      id: 'regras',
      title: 'Regras de Negócio CP2020',
      content:
        'As regras de negócio seguem o sistema Cyberpunk 2020 (2ª edição): atributos de 2 a 10 na criação, rolagem 1d10 com explosão em 10 e fumble em 1, BTM derivado de BODY/REF, SP de armadura por localização e níveis de ferimento de 0 a 10.',
      items: [
        'Atributos: INT, REF, TECH, COOL, ATTR, LUCK, MA, BODY, EMP.',
        'Rolagem de perícia: 1d10 + Atributo + Nível da Perícia (explosão/fumble).',
        'Dano: por fórmula (ex.: 2d6+2) com local de impacto sorteado (1d10).',
        'Death Save: 1d10 ≤ BODY para resistir a atordoamento/morte.',
        'Ferimentos: 11 estados (0 Saudável a 10 Mortal 6) controlados pelo bio-monitor.'
      ]
    },
    {
      id: 'nao-objetivos',
      title: 'Não-Objetivos (fora de escopo na ALPHA)',
      content:
        'Para manter o foco e a qualidade, os seguintes itens estão fora do escopo da fase ALPHA:',
      items: [
        'Não é um clonador de conteúdo licenciado — regras implementadas para uso em mesas próprias.',
        'Não substitui o livro físico; suporta consulta rápida via PRD e IA.',
        'Netrunning completo (MU, programas, data walls) fica para fase avançada (P3).',
        'Não há monetização ou sistema de assinaturas na ALPHA.'
      ]
    },
    {
      id: 'metricas',
      title: 'Métricas de Sucesso',
      content:
        'O sucesso do produto é medido por adoção e fidelidade de mesas reais:',
      items: [
        'Tempo para criar uma ficha completa (< 10 minutos para usuários frequentes).',
        'Mesas multiplayer ativas com 2+ jogadores reais por sessão.',
        'Zero perda de dados: persistência em nuvem com fallback local.',
        'Latência de sincronização do grid tático < 50ms (SSE/WebSocket).',
        '100% dos arquivos-fonte compilando com tsc --noEmit sem erros.'
      ]
    }
  ],
  modules: [
    {
      id: 'sheet',
      name: 'Ficha de Personagem',
      description: 'Criador e gestor de fichas de edgerunner: identidade, atributos, perícias, cyberware, armas e armaduras.',
      features: [
        'Autocalculo de estatísticas derivadas (BTM, SP por localização, perda de humanidade)',
        'Gestão de cyberware com custo em eb e perda de humanidade',
        'Rastreamento de ferimentos (bio-monitor 0–10) com penalidades',
        'Lifepath narrativo editável',
        'Presets e clonagem de lendas de Night City'
      ],
      status: 'em andamento'
    },
    {
      id: 'multiplayer',
      name: 'Mesa Multiplayer em Tempo Real',
      description: 'Salas de jogo com sincronização ao vivo, grid tático e poderes de mestre.',
      features: [
        'Salas com código único e SSE de baixa latência',
        'Grid tático com tokens, cobertura, temas e drag & drop',
        'Iniciativa de combate e rolagens compartilhadas na mesa',
        'Geração de NPCs e fichas de edgerunner pelo GM',
        'Chat da mesa com mensagens do sistema e dados rolados'
      ],
      status: 'em andamento'
    },
    {
      id: 'dice',
      name: 'Rolador de Dados FNFF',
      description: 'Motor de rolagem do Friday Night Firefight com histórico e banner de resultado.',
      features: [
        'Rolagem de perícia com crítico explosivo (10!) e fumble (1!)',
        'Rolagem de dano com local de impacto sorteado',
        'Death saves (1d10 ≤ BODY)',
        'Histórico de rolagens e broadcast para a mesa'
      ],
      status: 'em andamento'
    },
    {
      id: 'ai',
      name: 'Netrunner IA',
      description: 'Assistente com integração à API Gemini para diagnóstico tático e geração de lifepath.',
      features: [
        'Chat especializado nas regras de Cyberpunk 2020',
        'Diagnóstico de otimização de build de combate',
        'Gerador de eventos de vida (lifepath) com 1d10',
        'Rota servidor-side (/api/gemini) para proteger a chave da API'
      ],
      status: 'em andamento'
    },
    {
      id: 'presets',
      name: 'Lendas de Night City',
      description: 'Biblioteca de presets de personagens e NPCs com importação/exportação.',
      features: [
        'Presets de personagens prontos',
        'Clonagem 1-clique para a conta do usuário',
        'Import/export JSON de fichas',
        'Marcação de ficha ativa'
      ],
      status: 'em andamento'
    },
    {
      id: 'social',
      name: 'Sistema Social',
      description: 'Rede de edgerunners: perfis, amigos, solicitações e mensagens diretas.',
      features: [
        'Perfil com ID Cyberpunk único (#NC-####)',
        'Solicitações de amizade com aceite/recusa em tempo real',
        'Status de atividade (online, inativo, em jogo)',
        'Mensagens diretas com histórico em tempo real'
      ],
      status: 'em andamento'
    },
    {
      id: 'prd',
      name: 'Visualizador de PRD',
      description: 'Exibição da especificação do produto, roadmap e arquitetura técnica dentro do app.',
      features: [
        'Seções de visão, personas, escopo e métricas',
        'Roadmap com 13 fases e status de cada tarefa',
        'Diagrama de arquitetura técnica'
      ],
      status: 'em andamento'
    }
  ],
  roadmap: [
    {
      id: 'fase-0',
      number: 0,
      title: 'Fundação e Recuperação do Código',
      objective: 'O projeto volta a compilar e ter versionamento (P0 bloqueante).',
      priority: 'P0',
      status: 'em andamento',
      tasks: [
        { code: 'T0.1', title: 'git init + .gitignore', status: 'concluído' },
        { code: 'T0.2', title: 'Node ≥ 20 e npm install', status: 'concluído' },
        { code: 'T0.3', title: 'tsconfig.json completo (strict, paths @/*)', status: 'concluído' },
        { code: 'T0.4', title: 'vite.config.ts (react + tailwindcss + alias)', status: 'concluído' },
        { code: 'T0.5', title: 'components.json corrigido para Tailwind v4', status: 'concluído' },
        { code: 'T0.6', title: 'index.css com tema cyberpunk (@theme)', status: 'concluído' },
        { code: 'T0.7', title: 'types/cyberpunk.ts reconstruído', status: 'concluído' },
        { code: 'T0.8', title: 'types/prd.ts reconstruído', status: 'concluído' },
        { code: 'T0.9', title: 'data/cyberpunkData.ts reconstruído', status: 'concluído' },
        { code: 'T0.10', title: 'data/prdData.ts reconstruído', status: 'concluído' },
        { code: 'T0.11', title: 'hooks/useCharacterSheet.ts', status: 'concluído' },
        { code: 'T0.12', title: 'hooks/useUserActivity.ts', status: 'concluído' },
        { code: 'T0.13', title: 'Componentes CharacterSheet (StatBlock, HealthTracker...)', status: 'concluído' },
        { code: 'T0.14', title: 'HomePage, DiceRoller, AiAssistant, PrdViewer, MultiplayerRoom...', status: 'concluído' },
        { code: 'T0.15', title: 'ui/card.tsx (shadcn)', status: 'concluído' },
        { code: 'T0.16', title: 'Limpeza de código morto (Navbar.tsx, deps não usadas)', status: 'concluído' },
        { code: 'T0.16b', title: 'Remover artefatos de scaffold do repositório', status: 'concluído' },
        { code: 'T0.17', title: 'Renomear package.json (cyberpunk-2020-suite)', status: 'concluído' },
        { code: 'T0.18', title: '.env.example completo', status: 'concluído' },
        { code: 'T0.19', title: 'Validação: tsc --noEmit + build + smoke test', status: 'concluído' },
        { code: 'T0.20', title: 'Commit de recuperação', status: 'concluído' }
      ]
    },
    {
      id: 'fase-1',
      number: 1,
      title: 'Correções de Segurança',
      objective: 'Eliminar riscos de autorização no código existente (P1 alta).',
      priority: 'P1',
      status: 'concluído',
      tasks: [
        { code: 'T1.1', title: 'Reescrever checkIsGm() sem fallback permissivo', status: 'concluído' },
        { code: 'T1.2', title: 'updateTacticalGrid() exige GM legítimo', status: 'concluído' },
        { code: 'T1.3', title: 'Validação estrita de GM em NPCs/settings/initiative', status: 'concluído' },
        { code: 'T1.4', title: 'Rate limit nos endpoints /api/rooms/*', status: 'concluído' },
        { code: 'T1.5', title: 'Sanitização de handle/text/code', status: 'concluído' },
        { code: 'T1.6', title: 'Teste manual GM vs jogador', status: 'concluído' },
        { code: 'T1.7', title: 'Token de sessão anti-impersonificação por peerId', status: 'concluído' },
        { code: 'T1.8', title: 'Tratamento de GM que abandona a sala', status: 'concluído' }
      ]
    },
    {
      id: 'fase-2',
      number: 2,
      title: 'Migração Firebase → Supabase',
      objective: 'Substituir Firebase (Auth/Firestore) por Supabase com RLS e Realtime (P1).',
      priority: 'P1',
      status: 'em andamento',
      tasks: [
        { code: 'T2.1', title: 'Supabase CLI + ambiente local', status: 'concluído' },
        { code: 'T2.2', title: 'Projeto Supabase na nuvem (.env.local)', status: 'concluído' },
        { code: 'T2.3', title: 'Instalar @supabase/supabase-js', status: 'concluído' },
        { code: 'T2.4', title: 'Migration SQL inicial (profiles, friendships, messages, sheets)', status: 'concluído' },
        { code: 'T2.5', title: 'RLS + índices em todas as tabelas', status: 'concluído' },
        { code: 'T2.6', title: 'Trigger on auth.users insert (cyberpunk_id)', status: 'concluído' },
        { code: 'T2.7', title: 'Realtime para mensagens e presença', status: 'concluído' },
        { code: 'T2.8', title: 'Provedores: Email/Senha + Google OAuth', status: 'concluído' },
        { code: 'T2.9', title: 'Migração de dados do Firebase antigo (cancelada)', status: 'cancelado' },
        { code: 'T2.10', title: 'src/lib/supabase.ts com mesma API do firebase.ts', status: 'concluído' },
        { code: 'T2.11', title: 'AuthModal reescrito com Supabase', status: 'concluído' },
        { code: 'T2.12', title: 'FriendsList/chat com Realtime', status: 'concluído' },
        { code: 'T2.13', title: 'useCharacterSheet com persistência jsonb', status: 'concluído' },
        { code: 'T2.14', title: 'useUserActivity com presença', status: 'concluído' },
        { code: 'T2.15', title: 'Migrar imports e remover firebase', status: 'concluído' },
        { code: 'T2.16', title: 'Bucket avatars com RLS', status: 'concluído' },
        { code: 'T2.17', title: 'Upload de avatar no UserProfile', status: 'concluído' },
        { code: 'T2.18', title: 'Testes manuais de auth/social/chat/fichas', status: 'concluído' },
        { code: 'T2.19', title: 'Testes de RLS (acessos anônimos/cross-user)', status: 'concluído' },
        { code: 'T2.20', title: 'tsc + build verdes pós-migração', status: 'pendente' }
      ]
    },
    {
      id: 'fase-3',
      number: 3,
      title: 'Multiplayer: Persistência e Confiabilidade',
      objective: 'Salas não podem viver só em memória; reconexão e estado estável (P1).',
      priority: 'P1',
      status: 'pendente',
      tasks: [
        { code: 'T3.1', title: 'Persistir salas (Supabase/Redis)', status: 'pendente' },
        { code: 'T3.2', title: 'Restaurar salas ativas no boot', status: 'pendente' },
        { code: 'T3.3', title: 'Reconexão com mesmo peerId restaura estado', status: 'pendente' },
        { code: 'T3.4', title: 'Timeout de isOnline por inatividade', status: 'pendente' },
        { code: 'T3.5', title: 'Decisão SSE vs WebSockets/Yjs (evitar retrabalho)', status: 'pendente' }
      ]
    },
    {
      id: 'fase-4',
      number: 4,
      title: 'Estado Frontend: Zustand',
      objective: 'Eliminar prop drilling e re-renders em cascata (P2 média).',
      priority: 'P2',
      status: 'pendente',
      tasks: [
        { code: 'T4.1', title: 'Stores: sheet, room, roll, ui', status: 'pendente' },
        { code: 'T4.2', title: 'Refatorar App.tsx para consumir stores', status: 'pendente' },
        { code: 'T4.3', title: 'MultiplayerRoom migrado para useRoomStore', status: 'pendente' },
        { code: 'T4.4', title: 'Validação tsc + testes manuais', status: 'pendente' }
      ]
    },
    {
      id: 'fase-5',
      number: 5,
      title: 'Multiplayer em Tempo Real: WebSockets/Yjs',
      objective: 'Sincronização de alta frequência sem latência nem conflitos (P2).',
      priority: 'P2',
      status: 'pendente',
      tasks: [
        { code: 'T5.1', title: 'Avaliar Yjs+Hocuspocus vs Socket.IO', status: 'pendente' },
        { code: 'T5.2', title: 'Transporte WebSocket com SSE como fallback', status: 'pendente' },
        { code: 'T5.3', title: 'TacticalGrid com Yjs (tokens CRDT)', status: 'pendente' },
        { code: 'T5.4', title: 'RNG server-authoritative', status: 'pendente' },
        { code: 'T5.5', title: 'Documentar protocolo multiplayer', status: 'pendente' }
      ]
    },
    {
      id: 'fase-6',
      number: 6,
      title: 'Motor de Dados (Dice Engine)',
      objective: 'Rolagens corretas e auditáveis para FNFF (P2).',
      priority: 'P2',
      status: 'pendente',
      tasks: [
        { code: 'T6.1', title: 'Instalar @dice-roller/rpg-dice-roller', status: 'pendente' },
        { code: 'T6.2', title: 'utils/diceEngine.ts (rollSkill, rollDamage, rollDeathSave, rollLocation)', status: 'pendente' },
        { code: 'T6.3', title: 'Substituir lógica manual em App.tsx e DiceRoller', status: 'pendente' },
        { code: 'T6.4', title: 'Unit tests do motor', status: 'pendente' }
      ]
    },
    {
      id: 'fase-7',
      number: 7,
      title: 'Roteamento e Estrutura de Código',
      objective: 'URLs reais e organização por features (P2).',
      priority: 'P2',
      status: 'pendente',
      tasks: [
        { code: 'T7.1', title: 'React Router: /, /sheet, /dice, /ai, /multiplayer, /room/:code...', status: 'pendente' },
        { code: 'T7.2', title: 'Estrutura por features (social, sheet, multiplayer, ai)', status: 'pendente' },
        { code: 'T7.3', title: 'Camada src/api/ centralizada', status: 'pendente' },
        { code: 'T7.4', title: 'Validar build e deep-links', status: 'pendente' }
      ]
    },
    {
      id: 'fase-8',
      number: 8,
      title: 'PRD Real, Documentação e Identidade',
      objective: 'PRD passa a existir de verdade e identidade pública é 100% própria (P1).',
      priority: 'P1',
      status: 'em andamento',
      tasks: [
        { code: 'T8.1', title: 'docs/PRD.md (visão, personas, escopo, métricas)', status: 'pendente' },
        { code: 'T8.2', title: 'Popular data/prdData.ts para o PrdViewer', status: 'concluído' },
        { code: 'T8.3', title: 'README reescrito sem créditos de scaffold', status: 'concluído' },
        { code: 'T8.4', title: 'index.html com identidade própria (pt-BR)', status: 'concluído' },
        { code: 'T8.5', title: 'UI exibindo apenas NETSHEET ENGINE', status: 'pendente' },
        { code: 'T8.6', title: 'ADRs (Supabase, Yjs, Zustand, dice-roller)', status: 'pendente' },
        { code: 'T8.7', title: 'metadata.json sem campos de plataforma', status: 'pendente' }
      ]
    },
    {
      id: 'fase-9',
      number: 9,
      title: 'Testes',
      objective: 'Regras do jogo e fluxos críticos protegidos (P2).',
      priority: 'P2',
      status: 'pendente',
      tasks: [
        { code: 'T9.1', title: 'Vitest + React Testing Library', status: 'pendente' },
        { code: 'T9.2', title: 'Unit: estatísticas derivadas, dice, npcGenerator', status: 'pendente' },
        { code: 'T9.3', title: 'Integração do servidor (salas, GM permissions)', status: 'pendente' },
        { code: 'T9.4', title: 'E2E Playwright (2 navegadores)', status: 'pendente' },
        { code: 'T9.5', title: 'Testes de RLS via SQL', status: 'pendente' }
      ]
    },
    {
      id: 'fase-10',
      number: 10,
      title: 'Deploy, CI/CD e Hardening',
      objective: 'Aplicação pública com pipeline automatizado e produção endurecida (P1).',
      priority: 'P1',
      status: 'pendente',
      tasks: [
        { code: 'T10.1', title: 'Backend em Railway/Fly.io/Render', status: 'pendente' },
        { code: 'T10.2', title: 'Frontend estático no Vercel/Netlify', status: 'pendente' },
        { code: 'T10.3', title: 'Domínio customizado + HTTPS', status: 'pendente' },
        { code: 'T10.4', title: 'Healthcheck /api/health monitorado', status: 'pendente' },
        { code: 'T10.5', title: 'GitHub Actions (tsc, lint, testes, build)', status: 'pendente' },
        { code: 'T10.6', title: 'Hardening: CORS, helmet, rate limit, logs', status: 'pendente' },
        { code: 'T10.7', title: 'Checklist de produção (secrets fora do bundle)', status: 'pendente' },
        { code: 'T10.8', title: 'Backups/PITR + supabase db push no CI', status: 'pendente' }
      ]
    },
    {
      id: 'fase-11',
      number: 11,
      title: 'Regras CP2020 Avançadas',
      objective: 'Profundidade de sistema (P3 baixa).',
      priority: 'P3',
      status: 'pendente',
      tasks: [
        { code: 'T11.1', title: 'Inventário e peso (ENC/EV)', status: 'pendente' },
        { code: 'T11.2', title: 'Netrunning completo (MU, programas, data walls)', status: 'pendente' },
        { code: 'T11.3', title: 'Penalidades automáticas por ferimento', status: 'pendente' },
        { code: 'T11.4', title: 'Loot/NPCs: inventário e drops', status: 'pendente' },
        { code: 'T11.5', title: 'Export/Import (JSON + PDF print)', status: 'pendente' }
      ]
    },
    {
      id: 'fase-12',
      number: 12,
      title: 'Validação Final e Encerramento do Plano',
      objective: 'Garantir que tudo está concluído e deletar o documento mestre (P0).',
      priority: 'P0',
      status: 'pendente',
      tasks: [
        { code: 'T12.1', title: 'git status limpo', status: 'pendente' },
        { code: 'T12.2', title: 'Suíte completa (tsc, build, testes, lint)', status: 'pendente' },
        { code: 'T12.3', title: 'Teste manual em produção (2+ usuários)', status: 'pendente' },
        { code: 'T12.4', title: 'Nenhum checkbox sem [x]', status: 'pendente' },
        { code: 'T12.5', title: 'Arquivar roadmap no README', status: 'pendente' },
        { code: 'T12.6', title: 'git rm PLANO_DE_ACAO.md', status: 'pendente' }
      ]
    }
  ],
  architecture: [
    {
      id: 'arch-frontend',
      layer: 'Frontend',
      description:
        'Aplicação SPA construída com React 19 e Vite, estilizada com Tailwind CSS 4 (configuração via CSS/@theme) e componentes shadcn/ui sobre Radix. Estado gerenciado com hooks; migração planejada para Zustand (Fase 4).',
      tech: ['React 19', 'Vite 6', 'TypeScript 5.8', 'Tailwind CSS 4', 'shadcn/ui (Radix)', 'lucide-react', 'motion']
    },
    {
      id: 'arch-backend',
      layer: 'Backend',
      description:
        'Servidor Express integrado ao Vite (modo middleware em dev, estático em produção). API de salas multiplayer, SSE para realtime e rota de proxy para a API Gemini, protegendo a chave no servidor.',
      tech: ['Express', 'TypeScript (tsx)', 'esbuild (bundle)', 'SSE (Server-Sent Events)']
    },
    {
      id: 'arch-data',
      layer: 'Dados e Persistência',
      description:
        'Camada de dados no Supabase (Auth/PostgreSQL/Realtime/Storage) com RLS rigoroso. Fichas persistidas como JSONB com fallback localStorage offline. Dados do Firebase antigo não foram migrados (banco inicia limpo).',
      tech: ['Supabase (Auth)', 'PostgreSQL', 'Realtime', 'Storage', 'localStorage (fallback)']
    },
    {
      id: 'arch-realtime',
      layer: 'Realtime',
      description:
        'Sincronização atual por SSE (< 50ms) com plano de evolução para WebSockets e Yjs (CRDT) para o grid tático e fichas em alta frequência sem conflitos.',
      tech: ['SSE', 'WebSockets (planejado)', 'Yjs (planejado)']
    },
    {
      id: 'arch-ai',
      layer: 'Inteligência Artificial',
      description:
        'Assistente Netrunner integrado à API Gemini via rota servidor-side /api/gemini, com system prompt especializado nas regras de Cyberpunk 2020.',
      tech: ['Google Gemini API', '@google/genai']
    }
  ]
};
