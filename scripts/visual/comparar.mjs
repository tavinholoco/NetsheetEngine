#!/usr/bin/env node
/**
 * ============================================================
 * NETSHEET ENGINE — COMPARAÇÃO PIXEL A PIXEL (Fase F)
 * ============================================================
 * Compara duas pastas de capturas (`capturar.mjs`) no canvas do Chromium do
 * Playwright — nenhuma dependência nova. Por tela: quantos pixels mudaram, a
 * maior diferença de canal (Δ, 0–255), quantos mudaram mais que o limiar e a
 * região que os contém; e grava, na pasta de diferença, a tela em cinza com
 * os pixels acima do limiar em vermelho.
 *
 * Como ler (F.2.6, 30/09/2026): Δ ≤ 8 é arredondamento de tom, invisível a
 * olho nu; Δ > 12 é mudança de verdade — olhe a imagem de diferença.
 *
 * Uso:
 *   node scripts/visual/comparar.mjs <pasta-antes> <pasta-depois> <pasta-diferença>
 *   LIMIAR=2 node scripts/visual/comparar.mjs …   (marca diferenças menores)
 * ============================================================
 */
// O @playwright/test é CommonJS: o chromium vem do export default.
import playwright from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const { chromium } = playwright;

const [A, B, D] = process.argv.slice(2).map((p) => p && path.resolve(p));
if (!A || !B || !D) {
  console.error("Uso: node scripts/visual/comparar.mjs <antes> <depois> <diferença>");
  process.exit(1);
}
const LIMIAR = Number(process.env.LIMIAR ?? 12);
fs.mkdirSync(D, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<html><body></body></html>");
const comoUrl = (f) => "data:image/png;base64," + fs.readFileSync(f).toString("base64");

for (const nome of fs.readdirSync(A).filter((f) => f.endsWith(".png"))) {
  if (!fs.existsSync(path.join(B, nome))) {
    console.log(`${nome.padEnd(20)} sem par em ${B}`);
    continue;
  }
  const r = await page.evaluate(
    async ([a, b, lim]) => {
      const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { tamanho: `${ia.width}x${ia.height} ≠ ${ib.width}x${ib.height}` };
      const w = ia.width, h = ia.height;
      const ctx = (img) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x; };
      const da = ctx(ia).getImageData(0, 0, w, h).data;
      const db = ctx(ib).getImageData(0, 0, w, h).data;
      const out = document.createElement("canvas"); out.width = w; out.height = h;
      const ox = out.getContext("2d"); const od = ox.createImageData(w, h);
      let dif = 0, forte = 0, max = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        const g = (da[i] + da[i + 1] + da[i + 2]) / 12;
        if (d > 0) { dif++; max = Math.max(max, d); }
        if (d > lim) {
          forte++;
          const p = i / 4, x = p % w, y = (p / w) | 0;
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
          od.data[i] = 255; od.data[i + 1] = 40; od.data[i + 2] = 40;
        } else {
          od.data[i] = od.data[i + 1] = od.data[i + 2] = g;
        }
        od.data[i + 3] = 255;
      }
      ox.putImageData(od, 0, 0);
      return { w, h, dif, forte, max, caixa: forte ? `${x0},${y0}–${x1},${y1}` : "-", png: out.toDataURL("image/png") };
    },
    [comoUrl(path.join(A, nome)), comoUrl(path.join(B, nome)), LIMIAR]
  );
  if (r.png) fs.writeFileSync(path.join(D, nome), Buffer.from(r.png.split(",")[1], "base64"));
  const pct = r.w ? ((100 * r.dif) / (r.w * r.h)).toFixed(3) : "-";
  console.log(
    `${nome.padEnd(20)} ${r.tamanho ?? `${r.w}x${r.h}`}  diferentes ${String(r.dif ?? "-").padStart(7)} (${pct}%)  Δ>${LIMIAR}: ${String(r.forte ?? "-").padStart(6)}  Δmáx ${r.max ?? "-"}  região ${r.caixa ?? "-"}`
  );
}
await browser.close();
