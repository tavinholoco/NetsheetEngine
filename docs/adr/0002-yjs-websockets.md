# ADR 0002 — Transporte realtime: WebSocket puro (ws) + Yjs sobre o mesmo socket, SSE como fallback

- **Status:** Aceito
- **Data:** 08/08/2026
- **Decisores:** Desenvolvimento (Fase 5, T5.1–T5.5)
- **Fase do plano:** Fase 5 — Multiplayer em Tempo Real

## Contexto

A mesa multiplayer já funcionava com **SSE** (Server-Sent Events): o servidor
era autoritativo e fazia broadcast do `GameRoom` inteiro em JSON. Limitações:

1. **SSE é unidirecional** — ações do cliente voltam por REST (`POST`), com
   latência de ida e volta por ação.
2. **Grid tático** precisa de sincronização de alta frequência (mover token,
   cursores do GM) sem latência nem conflitos entre clientes.
3. Havia a hipótese de adotar um framework completo de collab (Hocuspocus)
   ou um transporte com rooms prontas (Socket.IO).

A decisão precisava considerar a arquitetura existente: **servidor
autoritativo** que já validava tudo (T1.x) e persistia salas no Supabase
(T3.x).

## Opções consideradas (avaliação da T5.1)

| Opção | Prós | Contras |
|---|---|---|
| **Yjs + Hocuspocus** | Provider collab pronto (auth, persistência) | Acopla o protocolo de sync a um servidor de collab; menos controle sobre o transporte de chat/roll; camada extra de complexidade |
| **Socket.IO** | Rooms, reconnect, fallback prontos | Framework próprio (não é o WebSocket nativo); overhead do protocolo; duplicaria a lógica de broadcast já feita no roomManager |
| **WebSocket puro (`ws`) + `y-protocols`** (escolhida) | Protocolo binário sob controle; mesmo socket serve JSON e Yjs; sem dependência pesada; o roomManager continua autoritativo | Implementar reconnect/fallback na mão |

## Decisão

Usar **`ws` (WebSocket puro) + Yjs sobre o MESMO socket**:

- **`/ws/rooms/:code`** — handshake autenticado por token de sessão
  (`?token=`); frames **JSON** para chat, rolagens, iniciativa e heartbeat;
  frames **binários** para o protocolo **Yjs** (`y-protocols`):
  - `messageSync` (0) — updates do doc CRDT do grid tático;
  - `messageAwareness` (1) / `messageQueryAwareness` (3) — cursores do GM.
- **SSE permanece como fallback automático**: se o WS nunca conecta
  (firewall/proxy), o cliente cai para `EventSource`; se cai depois de
  conectar, reconecta em ~3s.
- **JSON persistido no Supabase = verdade durável**: o doc Yjs é reconstruído
  no re-join (T3.3); o grid espelha doc ↔ JSON com revert propagado.
- **RNG server-authoritative** (T5.4): o cliente pede só o tipo de rolagem;
  o servidor rola com `crypto.randomInt` e bônus da ficha que ELE possui.

## Consequências

**Positivas:**

- Latência de sincronização do grid < 50ms; sem conflitos (CRDT).
- Um único socket para tudo (JSON + binário) — menos conexões, menos código.
- O roomManager continua sendo a única fonte de verdade de autorização.
- Teste de regressão E2E versionado (`scripts/test-ws-e2e.mjs`) cobre o
  discriminador `isBinary` — o bug real de transporte (o `ws@8.21.1` entrega
  frames de texto como `Buffer`, quebrando o `typeof`) nunca mais volta.

**Negativas / custos:**

- Reconnect/fallback implementados à mão (clientes SSE, retry com backoff).
- O protocolo binário é nosso — documentado em
  `docs/PROTOCOLO_MULTIPLAYER.md` para não virar caixa-preta.
- Awareness do Yjs exige cuidado com privacidade (cursores por jogador).

## Referências

- `docs/PROTOCOLO_MULTIPLAYER.md` — protocolo completo (WS + SSE + REST).
- `server.ts` — handler WS com discriminador `isBinary`.
- `src/lib/yjsConnection.ts` — camada CRDT no cliente.
- Fase 5 do `PLANO_DE_ACAO.md` (T5.1–T5.5).

---

## Revisão de 02/09/2026 — o CRDT continua, mas sob observação

Uma varredura de overengineering questionou se o Yjs se paga neste caso. **A decisão é manter**, mas
o questionamento fica registrado para não ser refeito do zero.

### O que a análise encontrou

A autorização do grid (`mirrorDocToJson` em `server.ts`) faz diff campo a campo e reverte o que não
for permitido: **jogador só altera `x`/`y` do próprio token; o GM faz o resto**. Ou seja, a
autorização garante **dono único por token** — duas pessoas nunca escrevem no mesmo dado.

Um CRDT existe para resolver escrita concorrente sobre o mesmo dado. Aqui, **a autorização já
eliminou os conflitos que o CRDT resolveria**. A literatura corrente é direta: CRDTs resolveram
sincronização *descentralizada*, um problema que a maioria dos produtos não tem, e *last-write-wins*
é honesto quando a sobreposição é rara.

### O custo que isso cobra

- 3 dependências (`yjs`, `y-protocols`, `lib0`);
- ~313 linhas de máquina de sincronização entre `server.ts`, `gridDoc.ts` e `yjsConnection.ts`;
- espelhamento em três caminhos (doc → JSON, JSON → doc, broadcast);
- **60 linhas de autorização por diff**, que só existem *porque* o CRDT deixa o cliente escrever o
  documento inteiro e obriga o servidor a conferir o resultado depois.

Um protocolo de intenção (`{ move: tokenId, x, y }`) seria da ordem de 10 linhas, com a autorização
verificada *antes* de aplicar em vez de revertida depois.

### Por que mesmo assim fica

Funciona, está coberto por testes, e trocar é refactor de vários dias em código que não está dando
problema. Trocar agora seria exatamente o tipo de mudança sem sintoma que o filtro de necessidade do
plano existe para barrar.

### Gatilho para reabrir

**Quando a Fase H (varredura de multiplayer) achar um bug de convergência do grid** — por exemplo a
corrida do `destroyRoomYjs` quando o último socket fecha e alguém reconecta no mesmo instante. Se o
CRDT começar a *causar* bugs em vez de prevenir, a troca pelo protocolo de intenção passa a ter
sintoma e vira FAZER.

### Consequência imediata no plano

A tarefa **L.2** planejava carregar o Yjs sob demanda na rota de mesa. Não vale investir em
lazy-loading de algo que pode sair inteiro: a tarefa passa a priorizar a separação do **Supabase**,
que está no chunk de entrada e é carregado até para quem só quer rolar dados.
