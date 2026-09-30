/**
 * Fase E (E.07 → E.3d) — TIRAR ALGUÉM DA INICIATIVA PULAVA A VEZ DE OUTRO
 * =======================================================================
 * A iniciativa guarda a lista e o índice de quem tem a vez. Três caminhos tiram
 * gente da lista — remover NPC, remover ficha gerada e sair da mesa — e nenhum
 * cuidava do índice direito: os dois primeiros não mexiam nele, e o `leave` só
 * o corrigia quando passava do fim. Reproduzido em 30/09 com A → B → C → D e a
 * vez em C:
 *  - o GM remove B → o índice aponta D, a marca fica em C, e a virada seguinte
 *    vai para A: D perde a vez;
 *  - o GM remove C (quem tem a vez) → ninguém marcado, e a virada vai para A;
 *  - o GM remove D com a vez nele → índice fora da lista.
 * O caso comum na mesa: o NPC morre e o GM o tira no meio da rodada. E a vez
 * pulada leva junto o death save do turno (D.5) de quem estava em Mortal.
 *
 * A regra: quem tinha a vez continua com ela; se foi ele que saiu, a vez passa
 * ao seguinte — e o turno dele começa, com o death save se estiver em Mortal.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  createRoom,
  deleteGeneratedPlayer,
  deleteRoomNpc,
  generateRoomNpc,
  generateRoomPlayerEdgerunner,
  getRoom,
  leaveRoom,
  nextTurn,
  updateInitiative,
  updateNpcWoundLevel
} from "../../server/roomManager";

const RNG_PASSA = () => 1; // 1d10 = 1: passa em qualquer save

/** Mesa com quatro combatentes na ordem A → B → C → D, e a vez em C. */
function mesa(tipo: "npc" | "ficha" = "npc") {
  const code = `IR-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  createRoom(code, "Mesa", "GM", "peer_gm");
  const ids: string[] = [];
  for (let i = 0; i < 4; i++) {
    if (tipo === "npc") {
      const r = generateRoomNpc(code, "peer_gm");
      ids.push(r.npcPlayer!.peerId);
    } else {
      const r = generateRoomPlayerEdgerunner(code, "peer_gm");
      ids.push(r.player!.peerId);
    }
  }
  const nomes = ["A", "B", "C", "D"];
  updateInitiative(code, "peer_gm", ids.map((id, i) => ({ playerId: id, handle: nomes[i], role: "x", score: 40 - i, isCurrentTurn: false })));
  nextTurn(code, "peer_gm", RNG_PASSA);
  nextTurn(code, "peer_gm", RNG_PASSA);
  return { code, ids };
}

/** Quem tem a vez, pela marca e pelo índice — os dois têm de concordar. */
function vez(code: string): string {
  const room = getRoom(code)!;
  const marcados = room.initiativeList.filter((e) => e.isCurrentTurn).map((e) => e.handle);
  const peloIndice = room.initiativeList[room.activeTurnIndex]?.handle ?? "fora da lista";
  expect(marcados).toEqual([peloIndice]);
  return peloIndice;
}

describe("E.3d — tirar alguém da iniciativa não pula a vez de ninguém", () => {
  it("premissa: a vez está em C", () => {
    const { code } = mesa();
    expect(vez(code)).toBe("C");
  });

  it("o GM remove B (antes da vez): a vez segue em C, e a seguinte é de D", () => {
    const { code, ids } = mesa();
    deleteRoomNpc(code, "peer_gm", ids[1]);
    expect(vez(code)).toBe("C");
    nextTurn(code, "peer_gm", RNG_PASSA);
    expect(vez(code)).toBe("D");
  });

  it("o GM remove C (quem tem a vez): a vez passa a D", () => {
    const { code, ids } = mesa();
    deleteRoomNpc(code, "peer_gm", ids[2]);
    expect(vez(code)).toBe("D");
  });

  it("o GM remove D, o último, com a vez nele: a vez volta a A", () => {
    const { code, ids } = mesa();
    nextTurn(code, "peer_gm", RNG_PASSA);
    expect(vez(code)).toBe("D");
    deleteRoomNpc(code, "peer_gm", ids[3]);
    expect(vez(code)).toBe("A");
  });

  it("remover uma ficha gerada antes da vez também não pula ninguém", () => {
    const { code, ids } = mesa("ficha");
    deleteGeneratedPlayer(code, "peer_gm", ids[0]);
    expect(vez(code)).toBe("C");
    nextTurn(code, "peer_gm", RNG_PASSA);
    expect(vez(code)).toBe("D");
  });

  it("um jogador que sai da mesa antes da vez também não", () => {
    const { code, ids } = mesa("ficha");
    leaveRoom(code, ids[1]);
    expect(vez(code)).toBe("C");
    nextTurn(code, "peer_gm", RNG_PASSA);
    expect(vez(code)).toBe("D");
  });

  it("se a vez passa a quem está em Mortal, o death save do turno dele é rolado (D.5)", () => {
    const { code, ids } = mesa();
    updateNpcWoundLevel(code, "peer_gm", ids[3], 5);
    const antes = getRoom(code)!.chatMessages.length;
    deleteRoomNpc(code, "peer_gm", ids[2]);
    expect(vez(code)).toBe("D");
    const novas = getRoom(code)!.chatMessages.slice(antes).map((m) => m.text);
    expect(novas.some((t) => t.includes("Death save de [D]") || t.includes(`Death save de [${getRoom(code)!.npcs![ids[3]].handle}]`))).toBe(true);
  });

  it("remover o NPC pelo nome também o tira da iniciativa", () => {
    const { code, ids } = mesa();
    const nome = getRoom(code)!.npcs![ids[0]].handle;
    deleteRoomNpc(code, "peer_gm", nome);
    expect(getRoom(code)!.initiativeList.some((e) => e.playerId === ids[0])).toBe(false);
    expect(vez(code)).toBe("C");
  });
});
