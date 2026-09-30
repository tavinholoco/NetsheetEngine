/**
 * Fase E (E.10 → E.3e) — O HORÁRIO DO CHAT SAÍA NO FUSO DO SERVIDOR
 * =================================================================
 * O servidor monta o horário de cada mensagem da mesa como texto
 * (`toLocaleTimeString("pt-BR")`), e o cliente mostra a string como veio. O
 * dev local roda no fuso do Brasil; o Render roda em UTC. Reproduzido em
 * 29/09 e de novo em 30/09: o mesmo instante sai `22:02` em São Paulo e
 * `01:02` em UTC — a mesa em produção veria toda mensagem três horas
 * adiantada, e nenhum teste olhava o horário.
 *
 * O teste põe o processo em UTC, como o Render, e confere o horário de
 * Brasília. Sem o `TZ` explícito ele passaria nesta máquina e falharia só no
 * CI — por isso o fuso é o primeiro passo.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";

const tzAntes = process.env.TZ;
process.env.TZ = "UTC";

import { CHAT_TIME_ZONE, chatTime, createRoom, getRoom, joinRoom, postChatMessage, rollDiceForPlayer } from "../../server/roomManager";

/** 30/09/2026, 01:02 em UTC — 22:02 do dia 29 em Brasília. */
const INSTANTE = new Date(Date.UTC(2026, 8, 30, 1, 2));

const SHEET = {
  handle: "Vex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 }
};

beforeAll(() => {
  // A premissa do teste: o processo está mesmo em UTC.
  expect(INSTANTE.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })).toBe("01:02");
});

afterEach(() => vi.useRealTimers());

afterAll(() => {
  if (tzAntes === undefined) delete process.env.TZ;
  else process.env.TZ = tzAntes;
});

describe("E.3e — o horário do chat sai no fuso de Brasília, com o servidor em UTC", () => {
  it("o formatador usa o fuso da mesa, não o do processo", () => {
    expect(CHAT_TIME_ZONE).toBe("America/Sao_Paulo");
    expect(chatTime(INSTANTE)).toBe("22:02");
  });

  it("mensagem de jogador, de sistema e rolagem saem todas em 22:02", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(INSTANTE);
    const code = "TZ-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    createRoom(code, "Mesa", "GM", "peer_gm");
    joinRoom(code, "peer_vex", "Vex", SHEET as never);
    postChatMessage(code, "peer_vex", "que horas são?");
    rollDiceForPlayer(code, "peer_vex", { kind: "save" }, () => 5);

    const room = getRoom(code)!;
    const horarios = new Set(room.chatMessages.map((m) => m.timestamp));
    expect([...horarios]).toEqual(["22:02"]);
    expect(room.chatMessages.at(-1)!.rollResult!.timestamp).toBe("22:02");
  });
});
