// L.3b (E.18) — O combate no servidor (Fases C e D): as rolagens da mesa, o dano pelo livro (armadura → BTM → ×2), o ataque do NPC, a iniciativa, a vez e o estabilizar.
// Saiu do `server/roomManager.ts` na L.3b, sem mudar comportamento; o `roomManager` é o barril.
import crypto from "crypto";
import { GameRoom, RoomPlayer, InitiativeEntry } from "../../src/types/multiplayer.js";
import { ArmorLocation, CharacterSheet, RollResult } from "../../src/types/cyberpunk.js";
import { parseDamageFormula, type Rng } from "../../src/rules/dice.js";
import { FALLBACK_DAMAGE, sheetAttackRoll, sheetInitiativeRoll, sheetDamageRoll, sheetDeathSaveRoll, sheetSkillRoll, sheetStunSaveRoll, stunSaveRoll, type RollCore } from "../../src/rules/rolls.js";
import { attackHits, gmModifier, rangeBandFor } from "../../src/rules/combat.js";
import { btmFromBody, deriveCurrentStats, mortalLevel, woundRow } from "../../src/rules/character.js";
import { applyHit, armorSpAt, hitLocationRow, isArmorLocation, resolveHit, woundStateOf, type HitOutcome } from "../../src/rules/damage.js";
import { WOUND_TRACK_POINTS } from "../../src/rules/tables.js";
import { fail, type RoomFailure } from "../errors.js";
import { type RoomResult, checkIsGm, getRoom, sanitizeText } from "./rooms.js";
import { chatTime, postChatMessage, pushSystemMessage } from "./chat.js";
import { writeWound } from "./wounds.js";

// ============================================================
// ROLAGENS SERVER-AUTHORITATIVE (Fase 5 — T5.4)
// ============================================================
// O cliente pede o tipo de rolagem; o servidor rola os dados com
// crypto.randomInt (seguro, não-preditível) e monta o RollResult usando a
// ficha que ELE possui (room.players[peerId].sheet) — o jogador não pode
// forjar o dado nem os bônus. O resultado entra no chat via postChatMessage
// (handle/role derivados do servidor, anti-spoofing) e é broadcastado.

/** RNG da mesa: `crypto.randomInt`, uniforme e não-preditível. Injetável em teste. */
export const serverRng: Rng = (sides) => crypto.randomInt(1, sides + 1);

/** Primeira arma equipada (ou a primeira da lista) da ficha. */
function firstWeapon(sheet: CharacterSheet) {
  const ws = Array.isArray(sheet.weapons) ? sheet.weapons : [];
  return ws.find((w) => w.equipped) || ws[0];
}

/**
 * Executa uma rolagem de mesa no SERVIDOR (T5.4), com as regras de
 * `src/rules/` — as mesmas do rolador do cliente (Fase C, C.1).
 * - `attack`: 1d10 aberto + REF + perícia da arma + WA (+ modificador do GM)
 * - `damage`: fórmula de dano da arma + local de impacto (1d10)
 * - `save`  : death save 1d10 ≤ BODY − nível Mortal
 * - `stun`  : stun save 1d10 ≤ BODY − 0 a 9 pelo nível do ferimento
 * - `skill` : 1d10 aberto + atributo da perícia + nível (+ modificador do GM)
 * Atributos CORRENTES (C.6) e bônus sempre da FICHA do servidor.
 * O `rng` só é passado em teste; em produção é sempre `serverRng`.
 * Retorna a sala com a rolagem já publicada no chat (broadcast é do chamador).
 */
export function rollDiceForPlayer(
  code: string,
  requesterPeerId: string,
  request: { kind: string; skillName?: string },
  rng: Rng = serverRng
): RoomResult<{ roll: RollResult }> {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");
  const player = room.players[requesterPeerId];
  if (!player) return fail("not_in_room", "Você não está nesta mesa.");

  // As parcelas saem de src/rules/rolls.ts — as mesmas funções que a ficha do
  // cliente chama (C.10). Atributos CORRENTES (C.6): o `currentStats` que o
  // cliente manda nunca é lido.
  const sheet: CharacterSheet = player.sheet || ({} as CharacterSheet);
  const kind = sanitizeText(request?.kind, 12).toLowerCase();
  const now = chatTime();
  const rollId = "roll_" + Date.now() + "_" + crypto.randomBytes(3).toString("hex");
  const stamp = (core: RollCore): RollResult => ({ id: rollId, timestamp: now, characterName: player.handle, ...core });
  // C.4 — o modificador de situação do GM entra em ataque e perícia, com o
  // motivo no detalhe. Não entra em dano nem em save: não é regra do livro.
  const gm = gmModifier(room.combatModifier, room.modifierReason);

  let roll: RollResult;

  if (kind === "attack") {
    // C.3 — 1d10 + REF + perícia da arma + WA (+ GM).
    roll = stamp(sheetAttackRoll(rng, sheet, firstWeapon(sheet), gm));
  } else if (kind === "damage") {
    const { core, formula } = sheetDamageRoll(rng, firstWeapon(sheet));
    if (!core) return fail("invalid_state", `Fórmula de dano inválida na sua arma: ${formula}`);
    roll = stamp(core);
  } else if (kind === "save") {
    // C.7 — death save: BODY − nível Mortal.
    roll = stamp(sheetDeathSaveRoll(rng, sheet));
  } else if (kind === "stun") {
    // C.7 — stun save: BODY − 0 a 9 pelo nível do ferimento. Não existia.
    roll = stamp(sheetStunSaveRoll(rng, sheet));
  } else if (kind === "skill") {
    const skillName = sanitizeText(request?.skillName, 60);
    const skill = Array.isArray(sheet.skills)
      ? sheet.skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase())
      : undefined;
    if (!skill) return fail("invalid_input", "Perícia não encontrada na sua ficha.");
    roll = stamp(sheetSkillRoll(rng, sheet, skill, gm));
  } else {
    return fail("invalid_input", "Tipo de rolagem inválido. Use: attack, damage, save, stun ou skill.");
  }

  const result = postChatMessage(code, requesterPeerId, "", roll);
  if (!result.room) return result;
  return { room: result.room, roll };
}

// ============================================================
// DANO → FERIMENTO (Fase D, D.1 e D.2)
// ============================================================
// O GM aplica; o servidor faz a conta do livro (armadura → BTM mín. 1 → ×2 na
// cabeça — decisão 6), marca os PONTOS na trilha (decisão 7b), rola o stun
// save e deixa a conta inteira no chat. Uma mutação só por dano aplicado: o
// custo por broadcast (ARQ-01) não muda com a D.

/** Teto do dano bruto: 20d100 (o teto do parser de fórmula) com folga. */
const MAX_RAW_DAMAGE = 2500;

/**
 * Acha a ficha do alvo: jogador, NPC, ou o token de um deles no grid. D.2
 * (decisão 7c): token sem ficha — cobertura, perigo, NPC criado direto no
 * grid — não recebe dano.
 */
function findDamageTarget(room: GameRoom, targetId: string): { target: RoomPlayer; failure?: undefined } | { target?: undefined; failure: RoomFailure } {
  const byId = (id: string) => room.players[id] ?? room.npcs?.[id];
  const direct = byId(targetId);
  if (direct) return { target: direct };
  const token = room.tacticalGrid?.tokens.find((t) => t.id === targetId);
  if (!token) return { failure: fail("target_not_found", "Alvo não encontrado na mesa.") };
  const owner = token.peerId ? byId(token.peerId) : undefined;
  if (!owner) {
    return { failure: fail("invalid_input", `[${token.name}] é um token sem ficha e não recebe dano. Para um NPC que sangra, gere-o com ficha.`) };
  }
  return { target: owner };
}

/** A conta do acerto como o livro a faz, para o chat. */
function hitAuditText(outcome: HitOutcome): string {
  const s = outcome.steps;
  const armor = `${s.raw} − SP ${s.sp} = ${s.afterArmor}`;
  if (!s.penetrated) return `${armor}: a armadura segurou. Sem ferimento.`;
  const btm = s.btm === 0 ? "BTM 0" : `BTM −${Math.abs(s.btm)}`;
  const minNote = s.afterArmor + s.btm < s.afterBtm ? " (mín. 1)" : "";
  const head = s.multiplier > 1 ? ` → × ${s.multiplier} = ${s.final}` : "";
  return `${armor} → ${btm} = ${s.afterBtm}${minNote}${head} → ${s.final} ponto(s).`;
}

/** Carimba uma rolagem montada pelo servidor em nome de um personagem. */
function stampRoll(characterName: string, core: RollCore): RollResult {
  return { id: "roll_" + Date.now() + "_" + crypto.randomBytes(3).toString("hex"), timestamp: chatTime(), characterName, ...core };
}

/**
 * D.5 — death save de quem está em Mortal: 1d10 ≤ BODY − nível Mortal. Falhou,
 * morto. Chamado no dano (antes do stun) e na virada de turno. Devolve se
 * sobreviveu.
 */
function rollDeathSaveFor(room: GameRoom, target: RoomPlayer, rng: Rng): boolean {
  const sheet = target.sheet;
  const core = sheetDeathSaveRoll(rng, sheet);
  const survived = core.isCriticalSuccess;
  if (!survived) writeWound(sheet, { ...woundStateOf(sheet), isDead: true });
  const verdict = survived ? "passou, segue vivo" : "FALHOU — 💀 MORTO";
  pushSystemMessage(room, "death", `☠️ Death save de [${target.handle}]: ${verdict}.`, stampRoll(target.handle, core));
  return survived;
}

/**
 * O núcleo da D.1: aplica um dano já validado no alvo, espelha no token,
 * deixa a conta no chat e rola o stun save. `applyDamage` (o GM digita o
 * dano) e `resolveGmAttack` (o NPC acertou) passam por aqui.
 */
function applyDamageTo(room: GameRoom, target: RoomPlayer, raw: number, location: ArmorLocation, rng: Rng): HitOutcome {
  const sheet = target.sheet;
  const body = deriveCurrentStats(sheet).BODY;
  const before = woundStateOf(sheet);
  const steps = {
    raw: Math.min(MAX_RAW_DAMAGE, Math.floor(raw)),
    sp: armorSpAt(sheet.armor, location),
    btm: btmFromBody(body),
    location
  };
  const outcome = applyHit(before, resolveHit(steps), location);
  writeWound(sheet, outcome.after);

  const token = room.tacticalGrid?.tokens.find((t) => t.peerId === target.peerId);
  if (token) token.hp = outcome.after.woundLevel;

  const where = hitLocationRow(location).name;
  const track = `${woundRow(before.woundLevel).name} → ${woundRow(outcome.after.woundLevel).name} (${outcome.after.damagePoints}/${WOUND_TRACK_POINTS})`;
  let text = `🩸 [${target.handle}] levou ${steps.raw} de dano — ${where}: ${hitAuditText(outcome)}`;
  if (outcome.steps.penetrated) text += ` Ferimento: ${track}.`;
  if (outcome.limbLost) {
    text += ` ⚠️ Perda de membro: mais de 8 pontos em ${where} — decepado ou inutilizado (o death save em Mortal 0 que uma fonte pede fica com o Mestre).`;
  }
  if (outcome.killed === "head") text += " 💀 MORTO — mais de 8 pontos na cabeça.";
  if (outcome.killed === "track") text += " 💀 MORTO — o dano passou da última caixa da trilha.";
  pushSystemMessage(room, "damage", text);

  if (outcome.steps.final > 0) {
    // D.5 — dano que entra desfaz a estabilização (p. 105, via S9)...
    sheet.isStabilized = false;
    // ...e, em Mortal, o death save vem na hora e ANTES do stun (S9, p. 99).
    if (!outcome.after.isDead && mortalLevel(outcome.after.woundLevel) !== null) {
      rollDeathSaveFor(room, target, rng);
    }
  }

  // Stun save a cada dano que entrou (C.7), com o nível NOVO. Morto não rola.
  if (outcome.steps.final > 0 && !sheet.isDead) {
    const core = stunSaveRoll(rng, body, outcome.after.woundLevel);
    const verdict = core.isCriticalSuccess ? "passou, segue de pé" : "FALHOU — fora de ação até passar num novo teste";
    pushSystemMessage(room, "stun", `😵 Stun save de [${target.handle}]: ${verdict}.`, stampRoll(target.handle, core));
  }

  return outcome;
}

export function applyDamage(
  code: string,
  requesterPeerId: string,
  request: { targetId?: unknown; raw?: unknown; location?: unknown },
  rng: Rng = serverRng
): RoomResult<{ outcome: HitOutcome }> {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");
  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa aplica dano.");
  }

  const raw = Number(request?.raw);
  if (!Number.isFinite(raw) || raw < 0) return fail("invalid_input", "Dano inválido: informe um número de 0 para cima.");
  if (!isArmorLocation(request?.location)) return fail("invalid_input", "Localização inválida.");

  const { target, failure } = findDamageTarget(room, sanitizeText(request?.targetId, 64));
  if (!target) return failure;

  return { room, outcome: applyDamageTo(room, target, raw, request.location, rng) };
}

// ------------------------------------------------------------
// O NPC ataca (Fase D, D.3)
// ------------------------------------------------------------
// O GM escolhe atacante, alvo e faixa de alcance no grid; o servidor rola o
// ataque com a ficha do NPC e, se acertou, o dano e o local, e aplica pelo
// núcleo da D.1. Tudo numa mutação só. Jogador não passa por aqui: ele rola
// o próprio ataque e o próprio dano, e o GM aplica o dano rolado (D.1).

/** Dificuldade livre aceita (ex.: o total do defensor no corpo a corpo). */
const MIN_FREE_DIFFICULTY = 1;

const MAX_FREE_DIFFICULTY = 50;

export function resolveGmAttack(
  code: string,
  requesterPeerId: string,
  request: { attackerId?: unknown; targetId?: unknown; range?: unknown; difficulty?: unknown },
  rng: Rng = serverRng
): RoomResult<{ hit: boolean; outcome?: HitOutcome }> {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");
  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa ataca pelos NPCs.");
  }

  // A faixa do livro, ou uma dificuldade livre dentro do limite.
  const band = rangeBandFor(request?.range);
  const free = Number(request?.difficulty);
  const hasFree = !band && Number.isInteger(free) && free >= MIN_FREE_DIFFICULTY && free <= MAX_FREE_DIFFICULTY;
  if (!band && !hasFree) {
    return fail("invalid_input", `Informe a faixa de alcance, ou uma dificuldade de ${MIN_FREE_DIFFICULTY} a ${MAX_FREE_DIFFICULTY}.`);
  }
  const difficulty = band ? band.difficulty : free;
  const difficultyLabel = band ? `${band.name} (${band.difficulty})` : `Dificuldade ${free}`;

  // Atacante: um NPC com ficha, pelo id ou pelo token dele.
  const attackerKey = sanitizeText(request?.attackerId, 64);
  const attackerToken = room.tacticalGrid?.tokens.find((t) => t.id === attackerKey);
  const attackerId = attackerToken?.peerId ?? attackerKey;
  const attacker = room.npcs?.[attackerId];
  if (!attacker) {
    return room.players[attackerId]
      ? fail("invalid_input", "Jogador rola o próprio ataque; aplique o dano que ele rolar.")
      : fail("target_not_found", "Atacante não encontrado entre os NPCs da mesa.");
  }
  if (attacker.sheet.isDead) return fail("invalid_state", `[${attacker.handle}] está morto e não ataca.`);

  const { target, failure } = findDamageTarget(room, sanitizeText(request?.targetId, 64));
  if (!target) return failure;
  if (target === attacker) return fail("invalid_input", "O NPC não ataca a si mesmo.");

  const weapon = firstWeapon(attacker.sheet);
  const formula = weapon?.damage || FALLBACK_DAMAGE;
  if (!parseDamageFormula(formula)) return fail("invalid_state", `Fórmula de dano inválida na arma do NPC: ${formula}`);

  // O ataque, com o modificador do GM (C.4), em nome do NPC.
  const gm = gmModifier(room.combatModifier, room.modifierReason);
  const attack = stampRoll(attacker.handle, sheetAttackRoll(rng, attacker.sheet, weapon, gm));
  const hit = attackHits(attack, difficulty);
  const verdict = hit
    ? `acertou (${attack.total} ≥ ${difficulty})`
    : attack.isCriticalFailure
      ? "errou — fumble"
      : `errou (${attack.total} < ${difficulty})`;
  pushSystemMessage(room, "attack", `🎯 [${attacker.handle}] ataca [${target.handle}] — ${difficultyLabel}: ${verdict}.`, attack);
  if (!hit) return { room, hit };

  const { core } = sheetDamageRoll(rng, weapon);
  const damage = stampRoll(attacker.handle, core!);
  pushSystemMessage(room, "dmgroll", "", damage);
  const outcome = applyDamageTo(room, target, damage.total, damage.hitLocation ?? "Torso", rng);
  return { room, hit, outcome };
}

// GM Power: Update or replace initiative list (T1.3)
export function updateInitiative(code: string, requesterPeerId: string, initiativeList: InitiativeEntry[]): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa pode editar a ordem de iniciativa.");
  }

  if (!Array.isArray(initiativeList)) return fail("invalid_input", "Lista de iniciativa inválida.");

  // D.4 — a entrada é montada campo a campo. Antes era `{ ...e }`: qualquer
  // campo que o cliente mandasse virava estado da sala, persistido e
  // transmitido a todos, sem teto de tamanho.
  setInitiativeOrder(
    room,
    initiativeList.slice(0, MAX_INITIATIVE_ENTRIES).map((e, i) => ({
      playerId: sanitizeText(e?.playerId, 64) || `init_${i}`,
      handle: sanitizeText(e?.handle, 30) || "—",
      role: sanitizeText(e?.role, 30) || "—",
      score: Math.max(0, Math.min(999, Number(e?.score) || 0)),
      isCurrentTurn: false
    }))
  );
  return { room };
}

const MAX_INITIATIVE_ENTRIES = 50;

/** Grava a ordem e dá a vez ao primeiro — a rodada (re)começa. */
function setInitiativeOrder(room: GameRoom, entries: InitiativeEntry[]): void {
  room.initiativeList = entries.map((e, i) => ({ ...e, isCurrentTurn: i === 0 }));
  room.activeTurnIndex = 0;
}

/**
 * Fase E (E.07 → E.3d) — tira gente da iniciativa sem pular a vez de ninguém.
 * Os três caminhos que tiram alguém da lista (remover NPC, remover ficha
 * gerada, sair da mesa) filtravam a lista e deixavam o índice: tirar quem vem
 * ANTES da vez deslocava o índice para o seguinte, e a virada pulava alguém —
 * o caso comum é o GM tirar o NPC que acabou de morrer, no meio da rodada.
 *
 * Quem tinha a vez continua com ela. Se foi ele que saiu, a vez passa ao
 * seguinte na ordem (dando a volta), e o turno dele começa — com o death save
 * de quem está em Mortal (D.5), como numa virada normal.
 */
export function removeFromInitiative(room: GameRoom, gone: (e: InitiativeEntry) => boolean, rng: Rng = serverRng): void {
  const list = room.initiativeList;
  const kept = list.filter((e) => !gone(e));
  if (kept.length === list.length) return;
  if (kept.length === 0) {
    room.initiativeList = [];
    room.activeTurnIndex = 0;
    return;
  }
  const current = list[room.activeTurnIndex];
  let next = current && !gone(current) ? current : undefined;
  const turnPassed = !next;
  for (let i = 1; !next && i <= list.length; i++) {
    const e = list[(room.activeTurnIndex + i) % list.length];
    if (!gone(e)) next = e;
  }
  const index = Math.max(0, kept.indexOf(next!));
  room.initiativeList = kept.map((e, i) => ({ ...e, isCurrentTurn: i === index }));
  room.activeTurnIndex = index;
  if (turnPassed) beginTurn(room, rng);
}

/** D.5 — a vez chegou a quem está em Mortal, vivo e não estabilizado: o
 *  servidor rola o death save do turno. Entrada posta à mão não tem ficha. */
function beginTurn(room: GameRoom, rng: Rng): void {
  const current = room.initiativeList[room.activeTurnIndex];
  const who = current && (room.players[current.playerId] ?? room.npcs?.[current.playerId]);
  if (who?.sheet && !who.sheet.isDead && !who.sheet.isStabilized && mortalLevel(woundStateOf(who.sheet).woundLevel) !== null) {
    rollDeathSaveFor(room, who, rng);
  }
}

// ============================================================
// INICIATIVA AUTOMÁTICA (Fase D, D.4)
// ============================================================
// 1d10 aberto + REF corrente + Combat Sense, rolado no servidor para todo
// combatente com ficha: os jogadores (menos o GM) e os NPCs vivos. Quem o GM
// pôs à mão (sem ficha) continua na lista com o valor dele — o ajuste manual
// segue valendo, antes e depois. Empate: o livro não dá desempate; a ordem
// fica a da rolagem (a `sort` do JS é estável).
export function rollInitiative(
  code: string,
  requesterPeerId: string,
  rng: Rng = serverRng
): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");
  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa rola a iniciativa.");
  }

  const combatants = [
    ...Object.values(room.players).filter((p) => p.peerId !== room.gmPeerId),
    ...Object.values(room.npcs ?? {})
  ].filter((c) => c.sheet && !c.sheet.isDead);

  const rolled = combatants.map((c) => ({ c, roll: sheetInitiativeRoll(rng, c.sheet) }));
  const isCharacter = (id: string) => !!room.players[id] || !!room.npcs?.[id];
  const manual = room.initiativeList.filter((e) => !isCharacter(e.playerId));

  const entries: InitiativeEntry[] = [
    ...rolled.map(({ c, roll }) => ({
      playerId: c.peerId,
      handle: sanitizeText(c.handle, 30) || "—",
      role: sanitizeText(c.role, 30) || "—",
      score: roll.total,
      isCurrentTurn: false
    })),
    ...manual
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_INITIATIVE_ENTRIES);
  setInitiativeOrder(room, entries);

  const lines = rolled.map(({ c, roll }) => `${c.handle} ${roll.total} (${roll.details})`);
  pushSystemMessage(room, "initiative", `⚔️ Iniciativa rolada pelo servidor: ${lines.join(" · ") || "nenhum combatente com ficha"}.`);
  return { room };
}

// GM Power: Advance to next turn (T1.3)
export function nextTurn(code: string, requesterPeerId: string, rng: Rng = serverRng): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");

  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa pode avançar o turno.");
  }

  if (room.initiativeList.length === 0) return { room };

  room.activeTurnIndex = (room.activeTurnIndex + 1) % room.initiativeList.length;
  room.initiativeList = room.initiativeList.map((item, idx) => ({
    ...item,
    isCurrentTurn: idx === room.activeTurnIndex
  }));
  beginTurn(room, rng);

  return { room };
}

/**
 * D.5 — o GM marca (ou desfaz) a estabilização, depois do teste de First Aid
 * ou Medical Tech que ele conduz. Só faz sentido em Mortal.
 */
export function setStabilized(
  code: string,
  requesterPeerId: string,
  request: { targetId?: unknown; stabilized?: unknown }
): RoomResult {
  const room = getRoom(code);
  if (!room) return fail("room_not_found", "Sala não encontrada.");
  if (!checkIsGm(room, requesterPeerId)) {
    return fail("gm_only", "Acesso Negado! Apenas o Mestre da Mesa estabiliza.");
  }
  const { target, failure } = findDamageTarget(room, sanitizeText(request?.targetId, 64));
  if (!target) return failure;
  const stabilized = request?.stabilized === true;
  if (stabilized && mortalLevel(woundStateOf(target.sheet).woundLevel) === null) {
    return fail("invalid_state", `[${target.handle}] não está em Mortal: não há o que estabilizar.`);
  }
  target.sheet.isStabilized = stabilized;
  pushSystemMessage(
    room,
    "stabilize",
    stabilized
      ? `🩹 [${target.handle}] foi estabilizado: para de rolar o death save a cada turno.`
      : `🩹 [${target.handle}] não está mais estabilizado.`
  );
  return { room };
}
