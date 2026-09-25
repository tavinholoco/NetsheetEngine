# 🦾 PRD — NETSHEET ENGINE

**Cyberpunk 2020 Sheet Builder & PRD Suite**

> Documento de Requisitos do Produto (Fase 8 — T8.1). Fonte da verdade de
> produto, espelhada no visualizador de PRD do app (`src/data/prdData.ts`) e
> no [`PLANO_DE_ACAO.md`](../PLANO_DE_ACAO.md) (documento mestre do roadmap).

| Campo | Valor |
|---|---|
| **Produto** | NETSHEET ENGINE |
| **Versão** | v0.4.0-RELEASE |
| **Status** | 🚧 ALPHA — desenvolvimento ativo |
| **Última atualização** | 03/09/2026 |
| **Público-alvo** | Mestres e jogadores de Cyberpunk 2020 |

---

## 1. Visão do Produto

NETSHEET ENGINE é uma suíte completa para mesas de **Cyberpunk 2020**. O
produto nasce da necessidade de digitalizar integralmente o fluxo de jogo:
da criação da ficha à mesa virtual multiplayer em tempo real, com suporte a
rolagem de dados FNFF (Friday Night Firefight), lifepath narrativo e um
assistente de inteligência artificial para o Netrunner. O objetivo é reduzir
o atrito do jogo de mesa para mestres e jogadores, mantendo **fidelidade às
regras oficiais** e uma identidade visual cyberpunk própria (HUD neon,
scanlines e terminal).

Princípios que guiam o produto:

- **Fidelidade CP2020** — as regras são o produto; nenhuma decisão de design
  pode contradizer o sistema oficial (2ª edição).
- **Servidor autoritativo** — o cliente envia intenções; o servidor valida,
  rola os dados e faz o broadcast do estado (anti-cheat por construção).
- **Zero perda de dados** — persistência em nuvem (Supabase) com fallback
  local (localStorage) e restauração de salas após restart do servidor.
- **Identidade 100% própria** — nenhum crédito a ferramentas de scaffold na
  UI, README, HTML ou metadados.

---

## 2. Personas

### 🎮 Jogador
Cria e evolui fichas de edgerunner (atributos, perícias, cromo, armas),
rola dados FNFF com audit trail, acompanha ferimentos no bio-monitor,
conversa com amigos (social) e senta-se em mesas multiplayer em tempo real.

**Dores:** ficha em papel que se perde, cálculo manual de BTM/SP/humanidade,
rolagens sem histórico, mesas a distância sem grid.

### 👑 Mestre de Jogo (GM)
Administra salas com código único, grid tático com tokens, iniciativa de
combate, geração de NPCs e de fichas de edgerunner, poderes de GM e
condições de combate em tempo real.

**Dores:** controle manual de múltiplas fichas de NPC, iniciativa desordenada,
rolagens forjáveis por jogadores, sem ferramenta de grid tático para mesa
virtual.

### 🧠 Netrunner / Entusiasta de sistemas
Explora a especificação do produto (visualizador de PRD), o roadmap e a
arquitetura técnica; usa o assistente Netrunner IA para diagnóstico de build
e geração de lifepath.

**Dores:** regras espalhadas, falta de um "second brain" para regras CP2020.

---

## 3. Escopo Funcional

O produto cobre **sete módulos funcionais interligados**:

| Módulo | Rota | Descrição |
|---|---|---|
| **Ficha** | `/sheet` | Criador e gestor de fichas de edgerunner |
| **Mesa Multiplayer** | `/multiplayer`, `/room/:code` | Salas em tempo real com grid tático, iniciativa e poderes de GM |
| **Dados** | `/dice` | Rolador FNFF com crítico explosivo, fumble e dano por localização |
| **Netrunner IA** | `/ai` | Assistente Gemini para diagnóstico de build e lifepath |
| **Lendas** | `/presets` | Biblioteca de presets com clonagem 1-clique |
| **Social** | `/profile` | Perfis, amigos, solicitações e mensagens diretas |
| **PRD** | `/prd` | Visualizador de especificação e roadmap |

---

## 4. Funcionalidades por Módulo

### 4.1 Ficha de Personagem (`/sheet`)

- Identidade: apelido (handle), nome real, idade, gênero, classe oficial
  (Role) e habilidade especial.
- Atributos primários (INT, REF, TECH, COOL, ATTR, LUCK, MA, BODY, EMP) com
  autocalculo dos derivados: **BTM**, Humanidade (EMP × 10), RUN/WALK.
- Árvore de perícias com rolagem integrada (atributo + nível + 1d10!).
- Cyberware com custo em eb e **perda de humanidade**.
- Arsenal: armas (dano por fórmula, ex.: `2d6+2`) e proteção SP por
  localização.
- Bio-monitor de ferimentos (0 Saudável → 10 Mortal 6) com penalidades de
  REF/MA e teste de morte (1d10 ≤ BODY).
- Lifepath narrativo editável + gerador 1d10.
- Persistência: nuvem (Supabase, JSONB) com fallback localStorage offline e
  autosave; modo visitante permite criar localmente, login habilita a nuvem.
- Presets/clonagem de "Lendas de Night City" e import/export JSON.

### 4.2 Mesa Multiplayer (`/multiplayer`, `/room/:code`)

- Salas com código único (ex.: `NC-2020`) e **persistência no Supabase**
  (salas ativas restauradas no boot do servidor).
- **Transporte híbrido**: WebSocket base (`/ws/rooms/:code`) com fallback
  automático para SSE (`/api/rooms/:code/stream`) e REST para ações pontuais.
- **Grid tático com Yjs (CRDT)**: tokens como estado sincronizado sem
  conflitos, awareness para cursores do GM, espelho autoritativo doc↔JSON
  (jogador move só o próprio token; revert propagado para a mesa).
- Iniciativa de combate (lista ordenada + avanço de turno) e chat da mesa com
  mensagens do sistema, dados rolados e notificações de conexão.
- **RNG server-authoritative** (T5.4): o cliente pede só o tipo
  (`attack`/`damage`/`save`/`stun`/`skill`); o servidor rola com `crypto.randomInt`
  usando a ficha que ELE possui — resultado forjado é ignorado.
- Poderes de GM: gerar NPCs e fichas de edgerunner, ajustar ferimentos de
  jogadores/NPCs, remover jogadores/NPCs, definir condições de combate
  (localização, modificador e motivo).
- **Presença e reconexão**: heartbeat a cada 20s (timeout de 60s marca
  offline), reconexão automática com o mesmo peerId restaurando a ficha
  persistida (last-write-wins por `updatedAt`) e 1 sessão ativa por jogador
  (token de sessão T1.7 anti-impersonificação).
- **Deep link**: `/room/ABC123` recarrega e reconecta sozinho (sessão
  hidratada do `sessionStorage`).

### 4.3 Rolador de Dados FNFF (`/dice`)

- Motor próprio em `src/rules/` — **o mesmo** no rolador do cliente
  (`src/utils/diceEngine.ts`) e nas rolagens da mesa, com RNG injetado e
  **audit trail** (cada dado e cada parcela com nome). *(Fase C, C.1)*
- Rolagem de perícia: `1d10` + atributo + nível, com **explosão em 10**
  (encadeada) e **fumble em 1** (falha automática + dado da tabela de fumble).
- Dano: fórmula `NdM±X` + **local de impacto** sorteado (1d10: cabeça ×2,
  tronco, braços, pernas).
- Saves: **stun** `1d10 ≤ BODY − 0 a 9` e **death** `1d10 ≤ BODY − nível Mortal`,
  com o alvo à vista no botão (sucesso/falha explícito).
- Histórico de rolagens + banner de resultado; na mesa, os dados rolam no
  servidor e entram no chat.

### 4.4 Netrunner IA (`/ai`)

- Chat especializado nas regras de Cyberpunk 2020 via Google Gemini.
- Diagnóstico de otimização de build de combate (atributos fracos, perícias,
  cromo, ferimentos).
- Gerador de lifepath narrativo a partir de rolagens 1d10.
- **Chave protegida**: a API Gemini só é chamada pelo servidor
  (`POST /api/gemini`); o cliente nunca vê a chave.

### 4.5 Lendas de Night City (`/presets`)

- Biblioteca de presets de personagens prontos (lendas).
- Clonagem 1-clique para a conta do usuário.
- Import/export JSON de fichas e marcação de ficha ativa.

### 4.6 Sistema Social (`/profile`)

- Perfil com ID Cyberpunk único (#NC-####) e **upload de avatar** no bucket
  `avatars` do Supabase (RLS por dono).
- Solicitações de amizade com aceite/recusa em **tempo real** (Supabase
  Realtime).
- Status de atividade (online, inativo, em jogo) via presença.
- Mensagens diretas com histórico em tempo real.

### 4.7 Visualizador de PRD (`/prd`)

- Seções de visão, personas, escopo, regras, não-objetivos e métricas.
- Roadmap com 13 fases e status de cada tarefa.
- Diagrama de arquitetura técnica.

---

## 5. Regras de Negócio CP2020

Regras do sistema Cyberpunk 2020 (2ª edição) implementadas no produto:

### Atributos
- Nove atributos primários: **INT, REF, TECH, COOL, ATTR, LUCK, MA, BODY, EMP**.
- Faixa na criação: **2–10**; até **15** com ciberware (cromo).
- Derivados: **BTM** pelo tipo corporal, **só BODY**: 2 → 0, 3–4 → −1, 5–7 → −2,
  8–9 → −3, 10 → −4, 11+ → −5. **Humanidade = EMP × 10**; RUN = MA × 3.
  *(Fase C, C.2 — antes era BODY + REF com sinal invertido.)*
- **Atributos correntes** (`deriveCurrentStats`, Fase C, C.6): base → **−1 EMP a
  cada 10 de Humanidade perdida** → efeito do ferimento. **Toda rolagem**, da
  ficha ou da mesa, usa esses valores; a ficha mostra "rola com N" quando o
  valor corrente difere da base. O servidor recalcula e nunca confia no
  `currentStats` enviado pelo cliente.

### Rolagem de perícia (FNFF)
- Fórmula: `1d10 + Atributo + Nível da Perícia`.
- **Crítico explosivo**: rolar 10 explode (soma o novo dado; cada 10 seguinte
  continua encadeando). Teto de segurança de 10 dados extras.
- **Fumble**: rolar 1 no primeiro dado é **falha automática**; rola-se 1d10 na
  tabela de fumble da categoria, e o GM lê o efeito no livro. *(O total não
  perde 1d10 — isso é regra do Cyberpunk RED, corrigida na Fase C.)*
- Habilidade especial de Role (ex.: Combat Sense) soma ao total.

### Dano e local de impacto
- Dano por fórmula (ex.: `2d6+2`), validada pelo motor.
- Local de impacto (1d10): **1 = Cabeça (dano ×2)**, 2–4 = Tronco,
  5 = Braço Direito, 6 = Braço Esquerdo, 7–8 = Perna Direita, 9–0 = Perna
  Esquerda. Uma tabela só (`HIT_LOCATIONS`) para cliente e servidor.

### Morte e ferimentos
- **Stun save** *(Fase C, C.7)*: a cada dano sofrido, `1d10 ≤ BODY` + modificador do
  nível — Leve 0, Sério −1, Crítico −2, Mortal 0 −3 … Mortal 6 −9. Falhou, está
  fora de ação.
- **Death save** *(Fase C, C.7)*: em nível Mortal, **a cada turno**, `1d10 ≤ BODY −
  nível Mortal` (Mortal 0 = BODY, Mortal 6 = BODY −6), até morrer ou ser
  estabilizado. Sem acúmulo por turno. Mortal 6 ainda está vivo.
- Bio-monitor com **11 estados** (0 Saudável → 10 Mortal 6). Efeito do livro
  nos atributos, **sem acumular** entre níveis *(Fase C, C.5)*:
  **Sério** REF −2; **Crítico** REF, INT e COOL pela metade; **Mortal** REF, INT
  e COOL a um terço (arredondando para cima). Ferimento **não** afeta MA.

### Combate na mesa
- Ataque: `1d10 + REF + perícia da arma + WA + modificador do GM` — rolado
  **no servidor**. A perícia vem do tipo da arma (pistola → Handgun, SMG →
  Submachinegun, rifle e escopeta → Rifle, pesada → Heavy Weapons, branca →
  Melee; desarmado → Brawling); sem a perícia na ficha, o ataque é sem treino
  (nível 0). *(Fase C, C.3 — antes faltava a perícia.)*
- O **modificador de situação do GM** (`combatModifier`, ±10) entra em ataque e
  perícia, com o motivo no detalhe da rolagem. Não entra em dano nem em save.
  *(Fase C, C.4 — antes era exibido e nenhuma rolagem o somava.)*
- Rolagens da mesa são **server-authoritative**: o cliente nunca envia o
  resultado; o bônus é derivado da ficha que o servidor possui.
- Iniciativa ordenada por score (decrescente) com avanço de turno.

---

## 6. Não-Objetivos (fora de escopo na ALPHA)

- **Não é um clonador de conteúdo licenciado** — regras implementadas para
  uso em mesas próprias, sem material oficial embutido.
- **Não substitui o livro físico** — o produto oferece consulta rápida via
  PRD e IA, não o livro completo.
- **Netrunning completo** (MU, programas, data walls) fica para fase avançada
  (P3) — hoje há apenas o assistente IA com o nome temático.
- **Sem monetização ou assinaturas** na ALPHA.
- **Não é um VTT genérico** — o foco é Cyberpunk 2020; não há planos de
  suportar outros sistemas na fase ALPHA.
- **Sem aplicativo nativo** — web-first (PWA é uma evolução possível, não
  compromisso atual).

---

## 7. Métricas de Sucesso

| Métrica | Meta |
|---|---|
| Tempo para criar uma ficha completa | < 10 min para usuários frequentes |
| Mesas multiplayer ativas | 2+ jogadores reais por sessão |
| Perda de dados | **Zero** (nuvem + fallback local + restauração de salas) |
| Latência de sincronização do grid | < 50ms (WebSocket/Yjs) |
| Qualidade de código | `tsc --noEmit` sem erros; suíte de testes (52+ unit) verde |
| CI/CD | Pipeline verde em todo push/PR (gitleaks + tsc/build + testes + E2E WS) |
| Adoção | Mesas que voltam a jogar no produto em sessões seguintes |

---

## 8. Arquitetura Técnica (estado atual)

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (SPA) — React 19 · Vite · Tailwind 4 · shadcn/ui   │
│  Zustand (sheet/room/roll/ui) · React Router (lazy)         │
│  src/features/{social,sheet,multiplayer,ai} · src/api/      │
├─────────────────────────────────────────────────────────────┤
│ BACKEND — Express (autoritativo) · ws · Yjs · esbuild       │
│  REST /api/rooms/* · WS /ws/rooms/:code · SSE fallback      │
│  RNG server-authoritative (crypto.randomInt)                │
│  /api/gemini (protege a chave da IA)                        │
├─────────────────────────────────────────────────────────────┤
│ DADOS — Supabase (Auth · PostgreSQL · Realtime · Storage)   │
│  RLS rigoroso · fichas JSONB · salas persistidas            │
│  avatars bucket · fallback localStorage                     │
└─────────────────────────────────────────────────────────────┘
```

**Stack real (package.json):** React 19 · Vite 6 · TypeScript 5.8 · Tailwind
CSS 4 · shadcn/ui (Radix) · Zustand 5 · react-router-dom 7 · Express 4 ·
ws 8.21 · yjs 13.6 + y-protocols ·
Supabase (supabase-js 2) · @google/genai · lucide-react · motion · esbuild
(bundle do servidor) · tsx (dev).

**Decisões de arquitetura registradas** (ADRs em [`docs/adr/`](./adr/);
detalhes do protocolo em [`docs/PROTOCOLO_MULTIPLAYER.md`](./PROTOCOLO_MULTIPLAYER.md)):

- **Transporte híbrido**: WebSocket base + fallback SSE + REST — decidido na
  T5.1/T5.2 (avaliação Yjs+Hocuspocus vs Socket.IO vs ws puro; escolhido
  **ws puro + Yjs** por simplicidade e controle sobre o protocolo binário).
- **CRDT no grid**: Yjs sobre o mesmo WebSocket; o JSON persistido no
  Supabase continua sendo a **verdade durável** (o doc Yjs é reconstruído no
  re-join).
- **Servidor autoritativo**: todo estado mutável da sala é validado e
  executado no servidor; o cliente é "thin".
- **Camada `src/api/`** centraliza todo fetch do cliente (T7.3), com
  `authedFetch` + reconexão automática em 401 (T3.3).
- **Roteamento real**: React Router com lazy loading e deep-links
  `/room/:code` que reconectam sozinhos (T7.1/T7.4).
- **Segurança**: token de sessão por jogador (T1.7), RLS no banco, gitleaks
  no CI e pre-commit para bloquear segredos.

---

## 9. Roadmap e Estado

O documento mestre do projeto é o [`docs/PLANO_MESTRE.md`](./PLANO_MESTRE.md) — 13 fases (A–M),
que substituiu o [`PLANO_DE_ACAO.md`](../PLANO_DE_ACAO.md) em 02/09/2026. Espelhado no
visualizador de PRD do app (`/prd`).

**Fases 0–10 do plano antigo fechadas:** 0 (fundação) · 1 (segurança) · 2 (migração
Firebase → Supabase) · 3 (multiplayer: persistência e confiabilidade) ·
4 (estado global com Zustand) · 5 (WebSockets/Yjs + RNG autoritativo) ·
6 (motor de dados FNFF) · 7 (roteamento, features e camada api) · 8 (PRD real,
documentação e identidade do produto) · 9 (testes) · 10 (deploy/CI-CD/hardening).
As Fases 11 e 12 foram reordenadas para as Fases K e M do plano novo.

**Em andamento:** Fase A (reancorar o projeto) do `PLANO_MESTRE.md`.

**Próximas:** B (fechar buracos de autorização) · C (fonte única de regras) · D (loop de
combate) · E–J (varreduras) · F (identidade visual Cyberpunk 2020) · K (profundidade de
sistema) · L (performance e escala) · M (validação e encerramento).
