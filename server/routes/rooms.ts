// L.3a (E.18) — as rotas da mesa e o stream SSE. Cada uma lê a sessão, chama o
// `roomManager` (que decide) e reenvia a sala. Saiu do `server.ts` na L.3a.
import express, { type Express } from "express";
import {
  createRoom,
  getRoom,
  joinRoom,
  updatePlayerSheet,
  postChatMessage,
  updateRoomSettings,
  updateInitiative,
  nextTurn,
  rollInitiative,
  leaveRoom,
  getRoomPublicSummary,
  updatePlayerWoundLevel,
  updateTacticalGrid,
  generateRoomNpc,
  generateRoomPlayerEdgerunner,
  deleteGeneratedPlayer,
  deleteRoomNpc,
  updateNpcWoundLevel,
  applyDamage,
  resolveGmAttack,
  setStabilized,
  rollDiceForPlayer,
  seatClaimRefusal,
  wasRemovedByGm,
  roomIsFullFor,
  MAX_SEATS_PER_ROOM,
  roomsAtCapacity,
  MAX_ROOMS,
  roomNpcsFull,
  MAX_NPCS_PER_ROOM,
  sheetTooLarge,
  type RoomResult,
  isValidRoomCode,
  isValidPeerId,
  touchPlayer
} from "../roomManager.js";
import { persistRoomNow, deleteRoomPersisted } from "../roomPersistence.js";
import { logger } from "../logger.js";
import { WS_LIMITS } from "../wsLimits.js";
import { audienceOf, roomViewFor } from "../roomDelta.js";
import {
  ERR_FICHA_GRANDE,
  ERR_PEER_ID,
  ERR_SALA_NAO_ENCONTRADA,
  ERR_SESSAO_MESA,
  chatLimiter,
  getSessionPeerId,
  getSessionPeerIdFromHeader,
  getSessionPeerIdFromQuery,
  roomLimiter,
  sendError
} from "../http.js";
import {
  SSE_RETRY_SOON,
  broadcastRoomUpdate,
  closePeerSockets,
  dropFeedIfIdle,
  dropRoomFeed,
  isDraining,
  roomEntryFor,
  sseClients,
  sseDelta,
  ssePeer
} from "../realtime.js";
import { destroyRoomYjs } from "../yjsGrid.js";

// Resposta padronizada das ações na sala: a sala, ou o erro pelo `code` (E.3c).
// Antes, o status saía do TEXTO — 404 se a mensagem dizia "não encontrad",
// senão 403 —, e renomear uma mensagem mudava o status da API. O
// `respondToCombat` da Fase D repetia a ideia com outra regra; virou esta.
// L.1 (E.20) — a sala vai como o papel de quem pediu a recebe.
function respondWithResult(res: express.Response, result: RoomResult<object>, requesterPeerId: string) {
  if (!result.room) return sendError(res, result.code, result.error);
  broadcastRoomUpdate(result.room.code);
  return res.json(roomViewFor(result.room, audienceOf(result.room, requesterPeerId)));
}

export function registerRoomRoutes(app: Express): void {
  // H.3d (H.13) — a instância que entregou o bastão à nova não executa mais nada
  // da mesa: o que ela aceitasse daqui em diante a nova nunca leria. 503 com um
  // `code` que o cliente conhece — ele tenta de novo sozinho, e a ação cai na
  // instância nova quando o Render trocar o tráfego. O health segue respondendo.
  app.use("/api/rooms", (req, res, next) => {
    if (!isDraining()) return next();
    // O stream SSE é diferente: o EventSource desiste PARA SEMPRE de uma resposta
    // que não é 200, e quem está no SSE ficaria sem a mesa depois do deploy. Um
    // stream que só diz "tente de novo em 1,5 s" e acaba o faz voltar até cair na
    // instância nova.
    if (req.method === "GET" && req.path.endsWith("/stream")) {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      res.end(SSE_RETRY_SOON);
      return;
    }
    sendError(res, "server_restarting", "O servidor está trocando de instância. Tente de novo em instantes.");
  });

  // R.11 (DOC-07) — o lobby NÃO lista salas. Aqui havia `GET /api/rooms`, que
  // entregava o código de toda sala a qualquer visitante — e com o código
  // qualquer um entrava. A decisão 3 (só convidados do dono) passou a valer: a
  // sala se acha pelo código ou pelo link que o GM manda. As contagens seguem no
  // /api/health, sem código nenhum.

  // Create a new room
  app.post("/api/rooms/create", roomLimiter, (req, res) => {
    const { code, name, gmHandle, gmPeerId } = req.body ?? {};
    if (typeof code !== "string" || !isValidRoomCode(code)) {
      return sendError(res, "invalid_input", "Código de sala inválido. Use 2–24 caracteres alfanuméricos ou hífen (ex.: NC-2020).");
    }
    // I.03 (SEC-16) — o peerId do GM tem o formato de qualquer outro; sem ele, o servidor gera.
    if (gmPeerId !== undefined && gmPeerId !== null && gmPeerId !== "" && !isValidPeerId(gmPeerId)) {
      return sendError(res, "invalid_input", ERR_PEER_ID);
    }
    // R.2 (SEC-08) — código em uso é outra mesa, com gente dentro: nunca
    // sobrescrever. Antes, qualquer um apagava a mesa com o código do lobby.
    if (getRoom(code)) {
      return sendError(res, "room_exists", `Já existe uma mesa com o código ${code.trim().toUpperCase()}. Entre nela pelo código, ou escolha outro.`);
    }
    // E.03 (SEC-15) — salas abertas têm teto: criar não exige login no servidor,
    // e cada sala é memória na instância de 512 MB e uma linha no banco.
    if (roomsAtCapacity()) {
      logger.warn("rooms_full", { max: MAX_ROOMS });
      return sendError(res, "rooms_full", `O servidor está com o máximo de mesas abertas (${MAX_ROOMS}). Tente de novo mais tarde.`);
    }
    const result = createRoom(code, name, gmHandle, gmPeerId);
    broadcastRoomUpdate(result.room.code);
    res.json({ room: roomViewFor(result.room, "gm"), sessionToken: result.sessionToken });
  });

  // Join a room
  app.post("/api/rooms/join", roomLimiter, (req, res) => {
    const { code, peerId, handle, sheet } = req.body ?? {};
    if (typeof code !== "string" || !isValidRoomCode(code)) {
      return sendError(res, "invalid_input", "Código de sala inválido.");
    }
    if (typeof peerId !== "string" || !peerId.trim()) {
      return sendError(res, "invalid_input", "peerId é obrigatório.");
    }
    // I.03 (SEC-16) — o peerId vira segmento de URL no cliente (o "Remover" do
    // GM): com um `/`, um `..` ou um `?`, o clique ia a outra rota.
    if (!isValidPeerId(peerId)) {
      return sendError(res, "invalid_input", ERR_PEER_ID);
    }
    if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) {
      return sendError(res, "invalid_input", "Ficha de personagem inválida.");
    }
    // E.03 (SEC-15) — a ficha vai em todo reenvio da sala, a cada socket.
    if (sheetTooLarge(sheet)) {
      return sendError(res, "sheet_too_large", ERR_FICHA_GRANDE);
    }
    // R.1 (SEC-07) — voltar a um assento ocupado exige o token vigente dele, no
    // mesmo header da leitura autenticada (B.3). O `peerId` sozinho é público.
    // `code` estável: o cliente decide por ele, não pelo texto (pista da Fase I).
    // R.3 (SEC-09) — quem o GM removeu não volta pelo mesmo peerId; sem isto, a
    // reconexão automática do cliente desfazia a expulsão em segundos.
    if (wasRemovedByGm(code, peerId)) {
      return sendError(res, "removed_by_gm", "O Mestre removeu você desta mesa.");
    }
    const proofToken = (req.get("X-Session-Token") || "").trim() || undefined;
    const refusal = seatClaimRefusal(code, peerId, proofToken);
    if (refusal) {
      return sendError(res, "seat_taken", refusal);
    }
    // R.16 (SEC-13) — assento novo só se couber: cada um abre até 3 sockets.
    if (roomIsFullFor(code, peerId)) {
      return sendError(res, "room_full", `Esta mesa está cheia (${MAX_SEATS_PER_ROOM} lugares). Peça ao Mestre para abrir espaço.`);
    }
    const result = joinRoom(code, peerId, handle, sheet, proofToken);
    if (!result) {
      return sendError(res, "room_not_found", ERR_SALA_NAO_ENCONTRADA);
    }
    broadcastRoomUpdate(result.room.code);
    // H.11 — o `join` cria ou troca a credencial do assento: vai ao banco na
    // hora, não pelo debounce. Quem dava F5 logo antes de uma queda voltava com
    // um token que o servidor restaurado não conhecia — e virava outro jogador.
    void persistRoomNow(result.room.code);
    res.json({ room: roomViewFor(result.room, audienceOf(result.room, peerId)), sessionToken: result.sessionToken });
  });

  // Get current room state (B.3 — SEC-02)
  // Antes devolvia a sala INTEIRA — fichas, chat e grid — para quem soubesse o
  // código. Agora o payload depende de haver sessão na mesa:
  //   sem token          → recorte público (o mesmo que o lobby já expõe)
  //   token válido       → sala completa, na vista do papel (L.1 — E.20)
  //   token inválido     → 401, para não mascarar bug de cliente com meio payload
  app.get("/api/rooms/:code", (req, res) => {
    const room = getRoom(req.params.code);
    if (!room) {
      return sendError(res, "room_not_found", ERR_SALA_NAO_ENCONTRADA);
    }

    const rawToken = req.get("X-Session-Token");
    if (!rawToken || !rawToken.trim()) {
      return res.json(getRoomPublicSummary(req.params.code));
    }

    const peerId = getSessionPeerIdFromHeader(req, req.params.code);
    if (!peerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    res.json(roomViewFor(room, audienceOf(room, peerId)));
  });

  // Sync player sheet (T1.7 — autenticado por token)
  app.post("/api/rooms/:code/sheet", roomLimiter, (req, res) => {
    const peerId = getSessionPeerId(req, req.params.code);
    if (!peerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { sheet } = req.body ?? {};
    if (!sheet || typeof sheet !== "object" || Array.isArray(sheet)) {
      return sendError(res, "invalid_input", "Ficha inválida.");
    }
    if (sheetTooLarge(sheet)) {
      return sendError(res, "sheet_too_large", ERR_FICHA_GRANDE);
    }
    const result = updatePlayerSheet(req.params.code, peerId, sheet);
    if (!result.room) return sendError(res, result.code, result.error);
    broadcastRoomUpdate(result.room.code);
    // L.1 — sem a sala: o cliente sincroniza a ficha a cada pausa de 600 ms na
    // edição e nunca leu esta resposta; a sala chega pelo reenvio.
    res.json({ ok: true });
  });

  // GM Power: Update player's Bio-Monitor / health
  app.post("/api/rooms/:code/player-health", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { targetPeerId, woundLevel } = req.body ?? {};
    if (typeof targetPeerId !== "string" || woundLevel === undefined) {
      return sendError(res, "invalid_input", "targetPeerId e woundLevel são obrigatórios.");
    }
    const result = updatePlayerWoundLevel(req.params.code, requesterPeerId, targetPeerId, woundLevel);
    return respondWithResult(res, result, requesterPeerId);
  });

  // Tactical Grid sync (T1.2 — apenas GM)
  app.post("/api/rooms/:code/tactical-grid", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { gridState } = req.body ?? {};
    if (!gridState || typeof gridState !== "object") {
      return sendError(res, "invalid_input", "gridState é obrigatório.");
    }
    const result = updateTacticalGrid(req.params.code, requesterPeerId, gridState);
    return respondWithResult(res, result, requesterPeerId);
  });

  // GM Power: Generate random NPC
  app.post("/api/rooms/:code/npcs/generate", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { archetypeId } = req.body ?? {};
    // E.03 (SEC-15) — teto de NPCs: 409 com código, como a sala cheia (R.16).
    if (roomNpcsFull(req.params.code)) {
      return sendError(res, "npcs_full", `A mesa já tem ${MAX_NPCS_PER_ROOM} NPCs. Remova algum para gerar outro.`);
    }
    const result = generateRoomNpc(req.params.code, requesterPeerId, archetypeId);
    return respondWithResult(res, result, requesterPeerId);
  });

  // GM Power: Generate random Player Edgerunner sheet
  app.post("/api/rooms/:code/players/generate", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const result = generateRoomPlayerEdgerunner(req.params.code, requesterPeerId);
    return respondWithResult(res, result, requesterPeerId);
  });

  // GM Power: Delete GM-generated player sheet
  app.post("/api/rooms/:code/players/:targetPeerId/delete", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const result = deleteGeneratedPlayer(req.params.code, requesterPeerId, req.params.targetPeerId);
    // R.3 (SEC-09) — a sessão já foi revogada; fecha o que ele ainda tem aberto.
    if (result.room && result.removedPeerId) closePeerSockets(req.params.code, result.removedPeerId);
    return respondWithResult(res, result, requesterPeerId);
  });

  // GM Power: Delete NPC
  app.post("/api/rooms/:code/npcs/:npcId/delete", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const result = deleteRoomNpc(req.params.code, requesterPeerId, req.params.npcId);
    return respondWithResult(res, result, requesterPeerId);
  });

  // GM Power: Update NPC Wound Level
  app.post("/api/rooms/:code/npcs/:npcId/health", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { woundLevel } = req.body ?? {};
    if (woundLevel === undefined) {
      return sendError(res, "invalid_input", "woundLevel é obrigatório.");
    }
    const result = updateNpcWoundLevel(req.params.code, requesterPeerId, req.params.npcId, woundLevel);
    return respondWithResult(res, result, requesterPeerId);
  });

  // Fase D (D.1) — GM aplica dano: o servidor faz a conta do livro (armadura →
  // BTM → ×2 na cabeça), marca os pontos na trilha e rola o stun save. O
  // cliente manda só alvo, dano bruto e localização.
  app.post("/api/rooms/:code/damage", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { targetId, raw, location } = req.body ?? {};
    return respondWithResult(res, applyDamage(req.params.code, requesterPeerId, { targetId, raw, location }), requesterPeerId);
  });

  // Fase D (D.3) — GM ataca com um NPC: o servidor rola ataque contra a
  // dificuldade de alcance e, se acertou, dano e local, e aplica. Uma mutação.
  app.post("/api/rooms/:code/attack", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { attackerId, targetId, range, difficulty } = req.body ?? {};
    return respondWithResult(res, resolveGmAttack(req.params.code, requesterPeerId, { attackerId, targetId, range, difficulty }), requesterPeerId);
  });

  // Fase D (D.5) — GM estabiliza quem está em Mortal: para o death save por turno.
  app.post("/api/rooms/:code/stabilize", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { targetId, stabilized } = req.body ?? {};
    return respondWithResult(res, setStabilized(req.params.code, requesterPeerId, { targetId, stabilized }), requesterPeerId);
  });

  // Send chat message (T1.7 — autenticado; handle/role vêm do servidor).
  // Fase 5 (T5.4) — o cliente NÃO pode enviar rollResult no message: rolagens
  // só existem via /roll (RNG server-authoritative). rollResult do cliente é
  // ignorado (anti-forjamento).
  app.post("/api/rooms/:code/message", roomLimiter, chatLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { text } = req.body ?? {};
    const result = postChatMessage(req.params.code, requesterPeerId, text);
    return respondWithResult(res, result, requesterPeerId);
  });

  // Fase 5 (T5.4) — rolagem server-authoritative (fallback REST p/ SSE): o
  // servidor rola os dados (crypto.randomInt) usando a ficha que ELE possui.
  app.post("/api/rooms/:code/roll", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { kind, skillName } = req.body ?? {};
    const result = rollDiceForPlayer(req.params.code, requesterPeerId, { kind, skillName });
    if (!result.room) return sendError(res, result.code, result.error);
    broadcastRoomUpdate(result.room.code);
    return res.json({ room: roomViewFor(result.room, audienceOf(result.room, requesterPeerId)), roll: result.roll });
  });

  // Fase 3 (T3.4) — heartbeat: mantém o jogador online enquanto a aba estiver
  // aberta na mesa. O timeout marca como offline após inatividade.
  // SEM broadcast: o status isOnline não muda no heartbeat (já é true), e a
  // virada para OFFLINE já é broadcastada pelo watcher — broadcast aqui seria
  // um payload SSE redundante de 100–300 KB a cada 20s × jogador.
  app.post("/api/rooms/:code/heartbeat", roomLimiter, (req, res) => {
    const peerId = getSessionPeerId(req, req.params.code);
    if (!peerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    if (!touchPlayer(req.params.code, peerId)) {
      return sendError(res, "not_in_room", "Você não está nesta mesa.");
    }
    res.json({ success: true, isOnline: true });
  });

  // Update room atmosphere/combat modifiers (T1.3 — apenas GM)
  app.post("/api/rooms/:code/settings", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { locationName, combatModifier, modifierReason } = req.body ?? {};
    const result = updateRoomSettings(req.params.code, requesterPeerId, locationName, combatModifier, modifierReason);
    return respondWithResult(res, result, requesterPeerId);
  });

  // Leave room endpoint (T1.7 — autenticado por token)
  app.post("/api/rooms/:code/leave", roomLimiter, async (req, res) => {
    const peerId = getSessionPeerId(req, req.params.code);
    if (!peerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const result = leaveRoom(req.params.code, peerId);
    // Fase 5 (T5.2) — fecha o socket WS do peer que saiu (evita fantasma)
    closePeerSockets(req.params.code, peerId);
    if (result.room) {
      broadcastRoomUpdate(result.room.code);
    } else {
      // Fase 3 (T3.1) — mesa encerrada: remover do banco (o broadcast não roda).
      // Await para não deixar linha órfã que ressuscitaria a sala no próximo boot.
      await deleteRoomPersisted(req.params.code);
      // Fase 5 (T5.3) — descarta o doc CRDT/awareness da sala encerrada.
      destroyRoomYjs(req.params.code);
      dropRoomFeed(req.params.code);
    }
    res.json({ success: true });
  });

  // Update or advance initiative (T1.3 — apenas GM)
  app.post("/api/rooms/:code/initiative", roomLimiter, (req, res) => {
    const requesterPeerId = getSessionPeerId(req, req.params.code);
    if (!requesterPeerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }
    const { action, initiativeList } = req.body ?? {};
    let result;
    if (action === 'next') {
      result = nextTurn(req.params.code, requesterPeerId);
    } else if (action === 'roll') {
      // D.4 — iniciativa automática, rolada no servidor.
      result = rollInitiative(req.params.code, requesterPeerId);
    } else if (initiativeList) {
      result = updateInitiative(req.params.code, requesterPeerId, initiativeList);
    } else {
      // E.3c — antes devolvia a sala e a reenviava a todos, sem conferir o GM.
      return sendError(res, "invalid_input", "Informe action (next ou roll) ou initiativeList.");
    }
    return respondWithResult(res, result, requesterPeerId);
  });

  // Server-Sent Events (SSE) stream for live real-time updates (< 50ms latency)
  app.get("/api/rooms/:code/stream", (req, res) => {
    const code = req.params.code.toUpperCase();
    const room = getRoom(code);
    if (!room) {
      return sendError(res, "room_not_found", ERR_SALA_NAO_ENCONTRADA);
    }

    // B.3 (SEC-02) — o stream despejava a sala inteira, a cada mutação, para
    // qualquer um que soubesse o código. Era o vazamento mais grave dos dois:
    // não é uma leitura pontual, é assinatura contínua do estado da mesa.
    // Sem recorte público aqui — stream sem sessão não tem para que servir.
    const peerId = getSessionPeerIdFromQuery(req, code);
    if (!peerId) {
      return sendError(res, "session_invalid", ERR_SESSAO_MESA);
    }

    // Fase B (B.7) — INSTRUMENTAÇÃO DO FALLBACK, para a Fase L decidir com dado.
    //
    // O cliente sempre tenta WebSocket primeiro; só abre EventSource quando o WS
    // NUNCA conectou nesta mesa. Então toda conexão aqui é uma queda de fallback.
    // (Até a H.3b, 14/10/2026, uma queda de rede breve também abria o SSE — E.14,
    // H.09 — e entrava nesta conta.)
    //
    // Por que medir antes de decidir: o suporte a WebSocket passa de 99%, e o
    // motivo real de manter o fallback é proxy corporativo que quebra o
    // handshake de Upgrade — algo que uma mesa de convidados pode simplesmente
    // nunca encontrar. Se em meses de jogo esta linha nunca aparecer, a L.6
    // remove o endpoint, o mapa sseClients, o caminho duplo do broadcast e o
    // EventSource do cliente. Se aparecer, a dúvida acaba com evidência em vez
    // de opinião. O userAgent entra porque identifica o padrão (navegador antigo
    // × proxy corporativo); não é segredo e o logger nunca grava token.
    logger.info("sse_fallback", {
      room: code,
      peerId,
      userAgent: (req.get("user-agent") || "desconhecido").slice(0, 160)
    });

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    if (!sseClients[code]) {
      sseClients[code] = new Set();
    }
    // J.1e (SEC-18) — o teto de conexões por jogador da R.4, que o SSE não tinha:
    // um assento abria quantos streams o limitador global deixasse (150 aceitos na
    // medição), e cada um recebe a sala inteira a cada mudança. Fecha os mais
    // antigos, como o WebSocket.
    const doPeer = [...sseClients[code]].filter((r) => ssePeer.get(r) === peerId);
    for (const velho of doPeer.slice(0, Math.max(0, doPeer.length + 1 - WS_LIMITS.maxSocketsPerPeer))) {
      sseClients[code].delete(velho);
      try {
        velho.end();
      } catch {
        /* já fechado */
      }
    }
    // L.1 — a sala inteira de entrada, antes de entrar na lista (a diferença que
    // levar o feed até agora parte de um rev que este stream não tem).
    const delta = req.query?.delta === "1";
    const entrada = roomEntryFor(code, room, peerId, delta);
    sseClients[code].add(res);
    ssePeer.set(res, peerId);
    if (delta) sseDelta.add(res);

    // Send initial state immediately
    res.write(`data: ${entrada}\n\n`);

    // Keep-alive ping interval to keep connection alive through cloud proxies
    const keepAlive = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch (e) {
        clearInterval(keepAlive);
        sseClients[code]?.delete(res);
      }
    }, 15000);

    req.on("close", () => {
      clearInterval(keepAlive);
      sseClients[code]?.delete(res);
      dropFeedIfIdle(code);
    });
  });
}
