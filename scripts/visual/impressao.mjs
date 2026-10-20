#!/usr/bin/env node
/**
 * ============================================================
 * NETSHEET ENGINE — A FICHA IMPRESSA (Fase K, K.1c)
 * ============================================================
 * A K.1 promete a ficha em PDF pelo "Salvar como PDF" do navegador, sem
 * biblioteca de PDF no bundle. Este roteiro imprime a ficha como o navegador
 * imprime — mídia `print` e **sem gráficos de fundo**, o padrão do diálogo de
 * impressão — e grava o PDF, para conferir a folha de estilo de impressão.
 *
 * Por que PDF e não captura de tela: a captura desenha o fundo escuro sempre;
 * a impressão o descarta. Medido na K.1c (18/10/2026): sem a folha de
 * impressão, o texto claro do tema saía quase branco no papel branco.
 *
 * A ficha é semeada no `localStorage` (a ficha ativa do modo visitante), com
 * algo em cada seção, e o ferimento marcado.
 *
 * Uso (com o build de produção no ar — a configuração `netsheet-prod` do
 * .claude/launch.json, porta 3100):
 *   npm run build
 *   node scripts/visual/impressao.mjs <pasta-de-saída>
 * ============================================================
 */
// O @playwright/test é CommonJS: o chromium vem do export default.
import playwright from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const { chromium } = playwright;

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const SAIDA = process.argv[2];
if (!SAIDA) {
  console.error("Uso: node scripts/visual/impressao.mjs <pasta-de-saída>");
  process.exit(1);
}
fs.mkdirSync(SAIDA, { recursive: true });

const STATS = { INT: 7, REF: 9, TECH: 5, COOL: 8, ATTR: 6, LUCK: 5, MA: 7, BODY: 8, EMP: 6 };
const LOCAIS = ["Head", "Torso", "Right Arm", "Left Arm", "Right Leg", "Left Leg"];
const FICHA = {
  id: "sheet_impressao",
  handle: "Vex Kaiser",
  realName: "Verônica Kaiser",
  role: "Solo",
  specialAbilityName: "Combat Sense",
  specialAbilityRank: 6,
  avatarUrl: "",
  age: 27,
  sex: "F",
  eurodollars: 4500,
  stats: STATS,
  currentStats: STATS,
  woundLevel: 3,
  damagePoints: 9,
  skills: [
    { id: "sk1", name: "Handgun", stat: "REF", level: 6 },
    { id: "sk2", name: "Awareness / Notice", stat: "INT", level: 5 },
    { id: "sk3", name: "Brawling", stat: "REF", level: 4 },
    { id: "sk4", name: "Streetwise", stat: "COOL", level: 3 }
  ],
  cyberware: [
    { id: "cw1", name: "Neural Processor", category: "Neural", costEb: 1000, humanityLoss: "1d6", actualHL: 4, installed: true },
    { id: "cw2", name: "Reflex Boost (Kerenzikov)", category: "Neural", costEb: 1000, humanityLoss: "1d6", actualHL: 3, installed: true }
  ],
  weapons: [
    {
      id: "wp1", name: "Militech Arms Avenger", type: "Pistol", wa: 0, con: "J", avail: "E", damage: "2d6+1",
      shots: 10, currentShots: 10, rof: 2, rel: "VR", rangeMeters: 50, equipped: true
    }
  ],
  armor: LOCAIS.map((location, i) => ({
    id: `ar${i}`, name: `Jaqueta blindada — ${location}`, location, sp: location === "Head" ? 0 : 14, ev: 0, equipped: true
  })),
  lifepath: {
    familyBackground: "Classe média baixa (trabalhador braçal)",
    parentStatus: "Um vivo, um morto",
    familyTragedy: "Família vítima de crime",
    childhoodEnvironment: "Zona de Combate violenta",
    motivationStyle: "Vingança (ódio)",
    valuedPerson: "A irmã mais nova",
    valuedPossession: "O isqueiro do pai",
    lifeEvents: ["Sobreviveu a uma tentativa de assassinato", "Conseguiu um contato poderoso"]
  },
  gearNotes: "Kit de primeiros socorros, agenda eletrônica, 2 carregadores extras.",
  // K.5 — o deck e os programas, para a seção do netrunner sair na folha.
  deck: { model: "Zetatech Paraline", chassis: "cellular", speed: 2, dataWall: 4, codeGate: 2, extraMemory: false },
  programs: [
    { id: "pg1", name: "Hammer", programClass: "intrusion", strength: 4, mu: 1, costEb: 400, loaded: true },
    { id: "pg2", name: "Killer II", programClass: "antiIc", strength: 2, mu: 5, costEb: 1320, loaded: true },
    { id: "pg3", name: "Shield", programClass: "protection", strength: 3, mu: 1, costEb: 150, loaded: false }
  ],
  createdAt: "2026-10-18T12:00:00.000Z",
  updatedAt: "2026-10-18T12:00:00.000Z"
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 850 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.addInitScript((ficha) => {
  localStorage.setItem("cyberpunk_active_sheet_v1", JSON.stringify(ficha));
}, FICHA);

await page.goto(BASE + "/sheet");
await page.locator("text=BIO-MONITOR // FERIMENTOS").first().waitFor();
await page.evaluate(() => document.fonts.ready);

const pdf = path.join(SAIDA, "ficha.pdf");
await page.pdf({ path: pdf, format: "A4", printBackground: false, margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" } });
console.log("ok", pdf);

await browser.close();
