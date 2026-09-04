/**
 * Fase B (B.2 — SEC-05) — VALIDAÇÃO DE FICHA
 * ==========================================
 * O servidor gravava a ficha verbatim. Isso anulava por outro caminho a
 * rolagem autoritativa da T5.4: não adianta rolar `1d10 + REF` com
 * `crypto.randomInt` se o REF vem do navegador sem conferência.
 *
 * A primeira metade testa a função pura. A segunda vai pelo HTTP e prova que
 * uma ficha forjada não vira estado da mesa — é o teste que reproduz o
 * sintoma do SEC-05.
 */
// @vitest-environment node
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../server";
import {
  MAX_SKILLS,
  STAT_MAX,
  STAT_MIN,
  WOUND_LEVEL_MAX,
  sanitizeCharacterSheet
} from "../rules/sheetSchema";

const BASE = {
  handle: "Rex",
  role: "Solo",
  stats: { INT: 5, REF: 6, TECH: 5, COOL: 5, ATTR: 5, LUCK: 5, MA: 5, BODY: 6, EMP: 5 },
  woundLevel: 0
};

describe("sanitizeCharacterSheet — função pura", () => {
  it("rejeita entrada que não é objeto", () => {
    expect(sanitizeCharacterSheet(null)).toBeNull();
    expect(sanitizeCharacterSheet("ficha")).toBeNull();
    expect(sanitizeCharacterSheet(42)).toBeNull();
    expect(sanitizeCharacterSheet([BASE])).toBeNull();
  });

  it("grampeia atributo acima do teto — o caso do BODY 9999", () => {
    const r = sanitizeCharacterSheet({ ...BASE, stats: { ...BASE.stats, BODY: 9999 } })!;
    expect(r.sheet.stats.BODY).toBe(STAT_MAX);
    expect(r.changed).toContain("stats.BODY");
  });

  it("grampeia atributo abaixo do piso e valores não numéricos", () => {
    const r = sanitizeCharacterSheet({ ...BASE, stats: { ...BASE.stats, REF: -50, INT: "muitos" } })!;
    expect(r.sheet.stats.REF).toBe(STAT_MIN);
    expect(r.sheet.stats.INT).toBe(STAT_MIN);
    expect(Number.isFinite(r.sheet.stats.INT)).toBe(true);
  });

  it("grampeia woundLevel negativo — a ficha imortal", () => {
    const r = sanitizeCharacterSheet({ ...BASE, woundLevel: -999 })!;
    expect(r.sheet.woundLevel).toBe(0);
    expect(r.changed).toContain("woundLevel");
  });

  it("grampeia woundLevel acima do máximo", () => {
    const r = sanitizeCharacterSheet({ ...BASE, woundLevel: 100 })!;
    expect(r.sheet.woundLevel).toBe(WOUND_LEVEL_MAX);
  });

  it("grampeia nível de perícia fora da faixa", () => {
    const r = sanitizeCharacterSheet({
      ...BASE,
      skills: [{ id: "s1", name: "Handgun", stat: "REF", level: 99 }]
    })!;
    expect(r.sheet.skills[0].level).toBe(10);
  });

  it("remove perícia com atributo inexistente (quebraria a rolagem adiante)", () => {
    const r = sanitizeCharacterSheet({
      ...BASE,
      skills: [
        { id: "s1", name: "Handgun", stat: "REF", level: 4 },
        { id: "s2", name: "Trapaça", stat: "PODER", level: 10 }
      ]
    })!;
    expect(r.sheet.skills).toHaveLength(1);
    expect(r.sheet.skills[0].name).toBe("Handgun");
    expect(r.changed).toContain("skills[1].stat");
  });

  it("remove armadura com localização inválida", () => {
    const r = sanitizeCharacterSheet({
      ...BASE,
      armor: [
        { id: "a1", name: "Kevlar", location: "Torso", sp: 10, ev: 0, equipped: true },
        { id: "a2", name: "Escudo", location: "Alma", sp: 999, ev: 0, equipped: true }
      ]
    })!;
    expect(r.sheet.armor).toHaveLength(1);
    expect(r.sheet.armor[0].location).toBe("Torso");
  });

  it("descarta campos desconhecidos em vez de propagá-los", () => {
    const r = sanitizeCharacterSheet({ ...BASE, isAdmin: true, __proto__hack: "x", eb: 1 })!;
    expect(r.sheet).not.toHaveProperty("isAdmin");
    expect(r.sheet).not.toHaveProperty("__proto__hack");
    expect(r.sheet).not.toHaveProperty("eb");
  });

  it("corta array acima do teto", () => {
    const skills = Array.from({ length: MAX_SKILLS + 50 }, (_, i) => ({
      id: `s${i}`, name: `P${i}`, stat: "INT", level: 1
    }));
    const r = sanitizeCharacterSheet({ ...BASE, skills })!;
    expect(r.sheet.skills).toHaveLength(MAX_SKILLS);
    expect(r.changed).toContain("skills");
  });

  it("não altera a entrada (função pura)", () => {
    const input = { ...BASE, stats: { ...BASE.stats, BODY: 9999 } };
    const snapshot = JSON.stringify(input);
    sanitizeCharacterSheet(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("não reporta alteração para uma ficha já válida", () => {
    const r = sanitizeCharacterSheet({
      ...BASE,
      id: "c1", realName: "", specialAbilityName: "", specialAbilityRank: 0,
      avatarUrl: "", age: 25, sex: "", eurodollars: 100,
      currentStats: BASE.stats,
      skills: [], cyberware: [], weapons: [], armor: [],
      lifepath: {
        familyBackground: "", parentStatus: "", familyTragedy: "",
        childhoodEnvironment: "", motivationStyle: "", valuedPerson: "",
        valuedPossession: "", lifeEvents: []
      },
      gearNotes: "", createdAt: "", updatedAt: ""
    })!;
    expect(r.changed).toEqual([]);
  });
});

describe("SEC-05 pelo HTTP — ficha forjada não vira estado da mesa", () => {
  it("saneia a ficha enviada no sync, em vez de gravar verbatim", async () => {
    const code = `SEC5-${Date.now().toString(36).slice(-5)}`.toUpperCase();
    await request(app)
      .post("/api/rooms/create")
      .send({ code, name: "Mesa", gmHandle: "GM", gmPeerId: "gm1" });

    const join = await request(app)
      .post("/api/rooms/join")
      .send({ code, peerId: "p1", handle: "Rex", sheet: BASE });
    const token = join.body.sessionToken as string;
    expect(token).toBeTruthy();

    // A ficha do trapaceiro: imortal, BODY absurdo e um campo inventado.
    const res = await request(app)
      .post(`/api/rooms/${code}/sheet`)
      .send({
        sessionToken: token,
        sheet: {
          ...BASE,
          woundLevel: -999,
          stats: { ...BASE.stats, BODY: 9999, REF: 500 },
          isAdmin: true
        }
      });

    expect(res.status).toBe(200);
    const stored = res.body.players.p1.sheet;
    expect(stored.woundLevel).toBe(0);
    expect(stored.stats.BODY).toBe(STAT_MAX);
    expect(stored.stats.REF).toBe(STAT_MAX);
    expect(stored).not.toHaveProperty("isAdmin");
  });

  it("saneia também no join, não só no sync", async () => {
    const code = `SEC5B-${Date.now().toString(36).slice(-4)}`.toUpperCase();
    await request(app)
      .post("/api/rooms/create")
      .send({ code, name: "Mesa", gmHandle: "GM", gmPeerId: "gm1" });

    const join = await request(app)
      .post("/api/rooms/join")
      .send({
        code,
        peerId: "p9",
        handle: "Trapaceiro",
        sheet: { ...BASE, woundLevel: -50, stats: { ...BASE.stats, BODY: 999 } }
      });

    expect(join.status).toBe(200);
    const stored = join.body.room.players.p9.sheet;
    expect(stored.woundLevel).toBe(0);
    expect(stored.stats.BODY).toBe(STAT_MAX);
  });
});
