# 📡 Protocolo Multiplayer — NETSHEET ENGINE

> Documento de referência do protocolo de multiplayer em tempo real (Fase 5 — T5.5).
> Cobre autenticação por token de sessão, endpoints REST, WebSocket (JSON + binário Yjs),
> fallback SSE, presença e persistência.

---

## 1. Visão geral da arquitetura

O servidor é **autoritativo**: o cliente envia *intenções* (mensagem, rolagem, movimento de token)
e o servidor valida, executa com os dados que **ele** possui e faz o **broadcast** do estado completo
da sala (`GameRoom` em JSON) para todos os membros.

```
┌─────────┐   WebSocket (base) / SSE (fallback)   ┌──────────────┐
│ Cliente │ ──────── mensagens JSON ────────────▶ │  Express     │
│ (React) │ ◀──────── broadcast room JSON ─────── │  server.ts   │
│         │ ─── binário Yjs (grid CRDT) ────────▶ │  roomManager │
└─────────┘ ◀── binário Yjs (updates/awareness) ─ │  Supabase    │
                                                  └──────────────┘
```

**Transportes (decisão T5.1/T5.2):**

| Transporte | Papel | Quando |
|---|---|---|
| **WebSocket** (`/ws/rooms/:code`) | Transporte base — chat, rolagens, iniciativa, grid CRDT | Sempre que conecta |
| **SSE** (`/api/rooms/:code/stream`) | Fallback automático | Se o WS não conectar (firewall/proxy) |
| **REST** (`/api/rooms/*`) | Criação/entrada na sala e fallback de ações | Ações pontuais + fallback de chat/roll |

O cliente (`MultiplayerRoom.tsx`) tenta o WebSocket primeiro; se **nunca** conectar, cai para o
SSE. Se o WS cair **depois** de conectar, reconecta em ~3s. Ambos os transportes entregam o
**mesmo payload**: a sala inteira serializada em JSON.

---

## 2. Autenticação — token de sessão (T1.7)

Cada jogador recebe um **token de sessão secreto** ao criar/entrar numa sala. O `peerId` é um
identificador público; **toda ação autenticada deriva o autor do token**, nunca de um `peerId`
enviado no corpo (anti-impersonificação).

| Canal | Como o token é enviado |
|---|---|
| **REST** | Campo `sessionToken` no **corpo JSON** de todo POST autenticado |
| **WebSocket** | Query param `?token=` no handshake de upgrade |

**Regras:**

- `POST /api/rooms/create` e `POST /api/rooms/join` retornam `{ room, sessionToken }`.
- Token inválido/expirado → REST responde **401** `{ error: "Sessão inválida ou expirada..." }`; o
  WS rejeita o handshake com **HTTP 401** (socket destruído).
- **1 sessão ativa por jogador**: re-join revoga os tokens antigos do mesmo `peerId`.
- **Reconexão (T3.3)**: ao receber 401, o cliente refaz `POST /join` com o **mesmo `peerId`** e
  re-tenta a ação original. O servidor reconhece a reconexão, preserva a ficha persistida
  (last-write-wins por `updatedAt`) e emite um token novo — sem duplicar o jogador.

---

## 3. Endpoints REST

Base: `http://<host>:3000`. Limites: `roomLimiter` **120 req/min/IP**; `chatLimiter` **30 msg/min/IP**.

### 3.1 Sem autenticação

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| `GET` | `/api/health` | — | `{ status: "online", system }` |
| `GET` | `/api/rooms` | — | Lista `{ code, name, gmHandle, playersCount }[]` das salas ativas |
| `POST` | `/api/rooms/create` | `{ code, name, gmHandle, gmPeerId }` | `{ room, sessionToken }` |
| `POST` | `/api/rooms/join` | `{ code, peerId, handle, sheet }` | `{ room, sessionToken }` |
| `GET` | `/api/rooms/:code` | — | `GameRoom` completo (404 se não existe) |
| `GET` | `/api/rooms/:code/stream` | — | **SSE** — stream de updates (ver §7) |
| `POST` | `/api/gemini` | `{ prompt, systemInstruction? }` | `{ text }` (IA Netrunner) |

> Validações do `code`: 2–12 caracteres alfanuméricos ou hífen, normalizado para maiúsculas
> (`NC-2020`). Código inválido → **400**.

### 3.2 Autenticadas por `sessionToken` (no corpo)

| Método | Rota | Permissão | Corpo | Resposta |
|---|---|---|---|---|
| `POST` | `/api/rooms/:code/sheet` | qualquer membro | `{ sheet }` | `GameRoom` (ficha sincronizada) |
| `POST` | `/api/rooms/:code/message` | qualquer membro | `{ text }` | `GameRoom` (chat atualizado) |
| `POST` | `/api/rooms/:code/roll` | qualquer membro | `{ kind, skillName? }` | `{ room, roll }` (RNG no servidor) |
| `POST` | `/api/rooms/:code/heartbeat` | qualquer membro | `{}` | `{ success, isOnline }` (sem broadcast) |
| `POST` | `/api/rooms/:code/leave` | qualquer membro | `{}` | `{ success }` (fecha WS do peer) |
| `POST` | `/api/rooms/:code/player-health` | **GM** | `{ targetPeerId, woundLevel }` | `GameRoom` |
| `POST` | `/api/rooms/:code/tactical-grid` | **GM** (ou Yjs) | `{ gridState }` | `GameRoom` |
| `POST` | `/api/rooms/:code/npcs/generate` | **GM** | `{ archetypeId? }` | `GameRoom` |
| `POST` | `/api/rooms/:code/players/generate` | **GM** | `{}` | `GameRoom` |
| `POST` | `/api/rooms/:code/players/:targetPeerId/delete` | **GM** | `{}` | `GameRoom` |
| `POST` | `/api/rooms/:code/npcs/:npcId/delete` | **GM** | `{}` | `GameRoom` |
| `POST` | `/api/rooms/:code/npcs/:npcId/health` | **GM** | `{ woundLevel }` | `GameRoom` |
| `POST` | `/api/rooms/:code/settings` | **GM** | `{ locationName?, combatModifier?, modifierReason? }` | `GameRoom` |
| `POST` | `/api/rooms/:code/initiative` | **GM** | `{ action: "next" }` **ou** `{ initiativeList }` | `GameRoom` |

**Anti-forjamento (T5.4):** o campo `rollResult` enviado no `message` é **ignorado** — vira texto
normal. Rolagens só existem via `roll`/`/roll`, com RNG e bônus derivados da ficha do servidor.

**Códigos de erro padrão:**

- **400** — validação de entrada (código inválido, corpo malformado, tipo de rolagem inválido)
- **401** — token ausente/inválido/expirado
- **403** — ação negada (não é GM, não é membro)
- **404** — sala/jogador não encontrado
- **413** — payload acima de 1 MB
- **429** — rate limit

---

## 4. WebSocket — handshake

```
ws(s)://<host>/ws/rooms/:code?token=<sessionToken>
```

1. O servidor intercepta o upgrade HTTP em `/ws/rooms/:code` (regex `[A-Z0-9-]{2,12}`).
2. `verifySession(code, token)` resolve o `peerId` do autor.
   - **Inválido** → responde `HTTP/1.1 401 Unauthorized` e destrói o socket.
3. **Conectado** → o servidor envia imediatamente o **estado inicial** (sala inteira em JSON).

**Close codes:** `4400–4499` = fechamento permanente (ex.: `4400` sessão encerrada no leave) —
o cliente **não** reconecta com o mesmo token; ele refaz o re-join (T3.3).

**Discriminador texto vs binário:** frames de texto podem chegar como `string` **ou** `Buffer`
(dependendo da versão do `ws` — no `ws@8.21.1` texto chega como `Buffer`). O servidor usa o flag
**`isBinary`** do handler (nunca `typeof`) + `Buffer.toString('utf8')` para frames de texto e
`Buffer.concat` para binário fragmentado (`Buffer[]`). No browser o cliente usa `typeof ev.data ===
'string'` (spec WHATWG garante texto como string; `binaryType='arraybuffer'` afeta só binário).

---

## 5. Mensagens WS — cliente → servidor (texto JSON)

| `type` | Corpo | Efeito no servidor |
|---|---|---|
| `message` | `{ type, text }` | `postChatMessage` — handle/role derivados do servidor; `rollResult` do cliente é **ignorado** |
| `roll` | `{ type, kind, skillName? }` | `rollDiceForPlayer` — RNG **server-authoritative** (ver §6) |
| `heartbeat` | `{ type }` | `touchPlayer` — renova `isOnline`/`lastActiveAt` (**sem broadcast**) |
| `initiative` | `{ type, action: "next" }` | `nextTurn` (GM) |
| `initiative` | `{ type, initiativeList }` | `updateInitiative` (GM) |

Qualquer outro `type` ou JSON inválido é ignorado silenciosamente. Tipos de rolagem válidos:
`attack` (1d10 + REF + WA), `damage` (fórmula da arma + local de impacto), `save`
(1d10 ≤ BODY), `skill` (1d10 + atributo + nível — `skillName` validado na ficha).

---

## 6. Mensagens WS — servidor → cliente (texto JSON)

| Mensagem | Formato | Quando |
|---|---|---|
| **Broadcast de sala** | `GameRoom` inteiro em JSON | Após **qualquer** mutação (chat, roll, grid, iniciativa, join/leave, presença) |
| **Erro pontual** | `{ type: "error", error: string }` | Ex.: mensagem vazia (vai só ao autor) |
| **Erro de rolagem** | `{ type: "roll-error", error: string }` | Ex.: perícia inexistente, tipo inválido (vai só ao autor) |

> O cliente (`handlePayload`) reconhece `error`/`roll-error` pelo campo `type` e exibe no banner;
> qualquer outro payload é tratado como o estado da sala (`setRoom`).

### 6.1 Rolagem server-authoritative (T5.4)

O cliente envia **apenas o tipo** — nunca o resultado. O servidor:

1. Rola com `crypto.randomInt` (uniforme e não-preditível) — `secureD10()` = 1–10.
2. Deriva os bônus da **ficha que ele possui** (`room.players[peerId].sheet`).
3. Publica o `RollResult` no chat via `postChatMessage` (handle/role do servidor) e faz broadcast.

Regras FNFF implementadas:

| kind | Fórmula | Detalhes |
|---|---|---|
| `attack` | `1d10 + REF + WA` | 10 = explosão (+1d10); 1 = falha crítica (−1d10) |
| `damage` | fórmula da arma (`NdM±X`, máx. 20 dados × 100 lados) | + local de impacto (1d10: 1 = cabeça ×2, 2–4 tronco, 5/6 braços, 7–0 pernas) |
| `save` | `1d10 ≤ BODY` | Death save / atordoamento |
| `skill` | `1d10 + <atributo> + <nível>` | `skillName` obrigatório e validado na ficha |

---

## 7. Fallback SSE

```
GET /api/rooms/:code/stream   (EventSource)
```

- Headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`.
- Envia o **estado inicial** imediatamente e depois cada broadcast como `data: <room JSON>\n\n`.
- Keep-alive: `: ping\n\n` a cada **15s** (atravessa proxies).
- Cada conexão re-sincroniza o estado completo → reconexão do EventSource é segura.
- O payload é **idêntico** ao do WebSocket (mesma função `broadcastRoomUpdate`).

---

## 8. Protocolo binário — grid CRDT (Yjs, T5.3)

Frames **binários** no mesmo WebSocket carregam o protocolo `y-protocols` (y-websocket wire):

| Tipo | Valor | Direção | Conteúdo |
|---|---|---|---|
| `messageSync` | `0` | ↔ | `syncStep1` (pedir estado), `syncStep2` (estado completo), `update` (diff incremental) |
| `messageAwareness` | `1` | ↔ | Updates de awareness (cursores do GM) |
| `messageQueryAwareness` | `3` | → | Pedido do awareness completo (resposta = `messageAwareness`) |

**Estado por sala:** cada sala com sockets WS ativos tem um `Y.Doc` + `Awareness` (`roomYjs`),
seedado do JSON `tacticalGrid` e descartado quando o último socket fecha ou a sala encerra.

**Estrutura do doc:** `Y.Map("meta")` (`rows`, `cols`, `theme`) + `Y.Array("tokens")` de `Y.Map`s
(um por token; `writeGridToDoc` reutiliza o Map por `id` → diff granular).

**Regras de propagação:**

- Updates de um socket são **validados e espelhados** para o JSON (`mirrorDocToJson`), depois
  propagados aos **outros** sockets (nunca ecoa o autor).
- Awareness é propagado aos outros sockets (cursores do GM — amarelo com nome).
- Refresh de awareness a cada **25s** (o estado expira no servidor após 30s).
- `destroy()` publica `setLocalState(null)` antes de fechar → cursor some imediatamente.

### 8.1 Espelho autoritativo doc ↔ JSON

O **JSON `room.tacticalGrid` continua a verdade durável** (decisão T5.1/T3.5):

- **doc → JSON** (`mirrorDocToJson`): após update de cliente. Permissões:
  - **GM**: pode tudo (meta, adicionar/remover tokens, qualquer campo).
  - **Jogador**: só pode mudar `x`/`y` do **próprio token** (`token.peerId === autor`).
  - Mutação não autorizada → **revertida no doc** (`writeGridToDoc(doc, prev, "server")`); o update
    original **não** é propagado aos outros clientes (o revert é, sincronamente).
- **JSON → doc** (`seedDocFromJson`): roda em todo `broadcastRoomUpdate` — mutações REST
  (join, gerar NPC, etc.) convergem para o CRDT dos clientes conectados.

---

## 9. Presença e heartbeat (T3.4)

| Item | Valor |
|---|---|
| Heartbeat do cliente | A cada **20s** (WS `{ type: "heartbeat" }` ou `POST /heartbeat`) |
| Timeout | `ROOM_OFFLINE_TIMEOUT_MS` — default **60s** (env `ROOM_OFFLINE_TIMEOUT_MS`) |
| Watcher | Varre as salas a cada `min(15s, timeout/2)`; marca `isOnline: false` quem passou do timeout |
| Efeito | Broadcast + persistência das salas alteradas |

O heartbeat **não** faz broadcast (status já é `true`; só a virada para OFFLINE é broadcastada).

---

## 10. Persistência (T3.1/T3.2)

- Toda mutação passa por `broadcastRoomUpdate` → `queueRoomPersist(code)` com **debounce de 2s**
  (rajadas = 1 write) na tabela `rooms` (`room_state jsonb`) via service-role.
- **Boot**: `restoreRoomsFromDb()` restaura as salas persistidas (todos os jogadores `isOnline: false`).
- **Mesa encerrada** (último jogador sai): linha removida do banco + doc Yjs destruído.
- **Shutdown** (SIGINT/SIGTERM): `flushAllPending()` grava pendências antes de sair.

---

## 11. Exemplos de payload

### `GameRoom` (broadcast / `GET /api/rooms/:code`)

```jsonc
{
  "code": "NC-2020",
  "name": "Mesa de Night City",
  "gmHandle": "Mestre",
  "gmPeerId": "peer_xxx",
  "locationName": "Night City - Afterlife Club",
  "combatModifier": 0,
  "modifierReason": "Condições Normais de Combate",
  "players": {
    "peer_xxx": {
      "peerId": "peer_xxx",
      "handle": "Mestre",
      "role": "Mestre (GM)",
      "sheet": { "handle": "...", "stats": { "REF": 8, "BODY": 9 }, "woundLevel": 0, "...": "..." },
      "isOnline": true,
      "joinedAt": "2026-08-08T...Z",
      "lastActiveAt": "2026-08-08T...Z"
    }
  },
  "npcs": {},
  "chatMessages": [
    { "id": "msg_...", "senderHandle": "Mestre", "senderRole": "gm",
      "text": "Bem-vindos!", "timestamp": "12:30", "isDiceRoll": false }
  ],
  "initiativeList": [],
  "activeTurnIndex": 0,
  "tacticalGrid": {
    "rows": 8, "cols": 10, "theme": "alley",
    "tokens": [ { "id": "token_peer_xxx", "name": "Mestre", "type": "player",
                  "x": 1, "y": 1, "peerId": "peer_xxx", "role": "...", "hp": 0, "color": "#06b6d4" } ]
  },
  "createdAt": "2026-08-08T...Z"
}
```

### `RollResult` (dentro de `ChatMessage.isDiceRoll`)

```jsonc
{
  "id": "roll_...", "timestamp": "12:31",
  "characterName": "Mestre", "rollType": "SKILL",
  "label": "Ataque (desarmado)", "diceFormula": "1d10",
  "baseRoll": 7, "bonus": 8, "total": 15,
  "isCriticalSuccess": false, "isCriticalFailure": false,
  "details": "1d10: 7 + REF (8) + WA (0)"
}
```

---

## 12. Fluxos típicos

### Entrar na mesa (WS)

```
Cliente                          Servidor
   │  POST /api/rooms/join          │
   │  { code, peerId, handle, sheet } │
   │◀────── { room, sessionToken }  │
   │  ws://.../ws/rooms/NC-2020?token=... │
   │◀────── GameRoom (estado inicial)
   │  [binário] messageSync: syncStep1 │
   │◀────── [binário] messageSync: syncStep2 (doc completo)
   │  { type: "heartbeat" } (20s)   │
```

### Chat / rolagem

```
   │  { type: "message", text: "oi" } │
   │◀────── GameRoom (chat atualizado, broadcast p/ todos)
   │  { type: "roll", kind: "attack" } │
   │◀────── GameRoom (RollResult no chat — RNG do servidor)
   │  { type: "roll", kind: "skill", skillName: "Inexistente" } │
   │◀────── { type: "roll-error", error: "Perícia não encontrada..." } (só o autor)
```

### Grid CRDT (drag de token)

```
   │  [binário] messageSync: update (jogador move o próprio token)
   │◀────── [binário] messageSync: update (propagado aos outros)
   │        (servidor espelha doc → JSON e persiste)
   │  [binário] messageSync: update (jogador tenta mover token do GM)
   │◀────── [binário] messageSync: update (REVERT — ninguém recebe o original)
```

---

## 13. Referência de tipos

`src/types/multiplayer.ts` — `GameRoom`, `RoomPlayer`, `ChatMessage`, `InitiativeEntry`,
`TacticalToken`, `TacticalGridState`, `TableRollKind`, `TableRollRequest`, `UserRole`.

`src/types/cyberpunk.ts` — `CharacterSheet`, `RollResult` (usado no chat).

`src/lib/yjsConnection.ts` — cliente Yjs (sync, awareness, cursores).
`src/lib/gridDoc.ts` — funções puras doc ↔ grid.
`server/roomManager.ts` — regras de negócio (sessões, GM, rolagens, iniciativa).
`server/roomPersistence.ts` — persistência `room_state jsonb`.

---

*Última atualização: 08/08/2026 (T5.5).*
