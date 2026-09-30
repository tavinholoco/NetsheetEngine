/**
 * ============================================================
 * NETSHEET ENGINE — CONVERSÃO DE COR PARA TOKEN (Fase F, F.2.4)
 * ============================================================
 * Troca a cor escrita à mão pelo token do @theme, seguindo a tabela
 * `scripts/color-map.json` — que é a especificação: este script só a aplica.
 *
 *  - classe da paleta: `hover:bg-cyan-500/40` → `hover:bg-accent-500/40`; nos
 *    neutros, pelo tipo de utilitário × tom: `bg-slate-950` → `bg-surface`;
 *  - brilho: `shadow-[0_0_15px_rgba(6,182,212,0.4)]` → `shadow-glow-15
 *    shadow-accent-500/40` — a geometria vira a escala do @theme, e a cor, token.
 *
 * O prefixo, a variante (`hover:`) e a opacidade (`/40`) passam intactos, e cada
 * token vale exatamente o tom de hoje: a conversão não muda cor nenhuma (a prova
 * é a F.2.6, por captura). As famílias "à mão" (vermelho, rosa…) ficam literais
 * para a F.2b.
 *
 * Uso:
 *   npx tsx scripts/migrate-colors.ts --tabela            cada combinação no código → destino
 *   npx tsx scripts/migrate-colors.ts --tema              as rampas para o @theme, da paleta instalada
 *   npx tsx scripts/migrate-colors.ts --aplicar [arq…]    reescreve (todos os arquivos, ou só os dados)
 * ============================================================
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export type Mapa = {
  rampas: Record<string, string>;
  porTabela: { familias: string[] };
  neutros: {
    tipos: Record<"fundo" | "texto" | "linha", string[]>;
    fundo: Record<string, string>;
    texto: Record<string, string>;
    linha: Record<string, string>;
  };
  brilho: Record<string, string>;
};

export function lerMapa(): Mapa {
  return JSON.parse(fs.readFileSync(path.join(REPO, "scripts", "color-map.json"), "utf8"));
}

const TONS = "50|100|200|300|400|500|600|700|800|900|950";
const PREFIXOS =
  "text|bg|border(?:-[trblxyse])?|ring(?:-offset)?|outline|divide|placeholder|from|via|to|shadow|accent|caret|fill|stroke|decoration";

/** O destino de uma classe da paleta, ou `null` se a família não entra por tabela. */
export function destinoDaClasse(prefixo: string, familia: string, tom: string, mapa: Mapa): string | null {
  if (!mapa.porTabela.familias.includes(familia)) return null;
  const rampa = mapa.rampas[familia];
  if (familia !== "slate") return `${prefixo}-${rampa}-${tom}`;
  const base = prefixo.startsWith("border-") ? "border" : prefixo;
  const tipo = (Object.keys(mapa.neutros.tipos) as ("fundo" | "texto" | "linha")[]).find((t) =>
    mapa.neutros.tipos[t].includes(base)
  );
  const nome = tipo ? mapa.neutros[tipo][tom] : undefined;
  return `${prefixo}-${nome ?? `${rampa}-${tom}`}`;
}

/** Converte um texto. Idempotente: o que já é token não casa com nenhuma regex. */
export function converter(texto: string, mapa: Mapa): { texto: string; trocas: number } {
  let trocas = 0;
  // 1) brilho — antes das classes, porque carrega um rgba
  const reBrilho =
    /(^|[\s"'`])((?:[a-z0-9-]+:)*)(drop-)?shadow-\[0_0_(\d+)px_rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)\]/g;
  let saida = texto.replace(reBrilho, (inteiro, lead, variante, drop = "", raio, r, g, b, a) => {
    const token = mapa.brilho[`${r},${g},${b}`];
    if (!token) return inteiro;
    trocas++;
    const alfa = a === undefined || Number(a) >= 1 ? "" : `/${Math.round(Number(a) * 100)}`;
    return `${lead}${variante}${drop}shadow-glow-${raio} ${variante}${drop}shadow-${token}${alfa}`;
  });
  // 2) classes da paleta
  const familias = Object.keys(mapa.rampas).join("|");
  const reClasse = new RegExp(`\\b(${PREFIXOS})-(${familias})-(${TONS})\\b`, "g");
  saida = saida.replace(reClasse, (inteiro, prefixo, familia, tom) => {
    const destino = destinoDaClasse(prefixo, familia, tom, mapa);
    if (!destino) return inteiro;
    trocas++;
    return destino;
  });
  return { texto: saida, trocas };
}

function arquivosDoSrc(): string[] {
  return fs
    .readdirSync(path.join(REPO, "src"), { recursive: true, encoding: "utf8" })
    .map((rel) => path.join("src", rel).split(path.sep).join("/"))
    .filter((rel) => /\.tsx?$/.test(rel))
    .filter((rel) => !rel.startsWith("src/__tests__/") && !rel.startsWith("src/test/") && !/\.test\.tsx?$/.test(rel));
}

function tabela(mapa: Mapa): void {
  const familias = Object.keys(mapa.rampas).join("|");
  const re = new RegExp(`\\b(${PREFIXOS})-(${familias})-(${TONS})\\b`, "g");
  const cont = new Map<string, number>();
  for (const arq of arquivosDoSrc()) {
    for (const m of fs.readFileSync(path.join(REPO, arq), "utf8").matchAll(re)) {
      const chave = `${m[1]}-${m[2]}-${m[3]}`;
      cont.set(chave, (cont.get(chave) ?? 0) + 1);
    }
  }
  const linhas = [...cont].sort((a, b) => b[1] - a[1]);
  for (const [chave, n] of linhas) {
    const [, prefixo, familia, tom] = chave.match(new RegExp(`^(${PREFIXOS})-(${familias})-(${TONS})$`))!;
    const destino = destinoDaClasse(prefixo, familia, tom, mapa) ?? "— à mão (F.2b)";
    console.log(`${String(n).padStart(4)}  ${chave.padEnd(26)} → ${destino}`);
  }
  console.log(`\n${linhas.length} combinações prefixo × cor × tom`);
}

function tema(mapa: Mapa): void {
  const css = fs.readFileSync(path.join(REPO, "node_modules", "tailwindcss", "theme.css"), "utf8");
  for (const [familia, rampa] of Object.entries(mapa.rampas).filter(([k]) => !k.startsWith("_"))) {
    for (const tom of TONS.split("|")) {
      const m = css.match(new RegExp(`--color-${familia}-${tom}:\\s*([^;]+);`));
      if (!m) throw new Error(`sem --color-${familia}-${tom} no theme.css`);
      console.log(`  --color-${rampa}-${tom}: ${m[1]};`);
    }
    console.log("");
  }
}

function aplicar(mapa: Mapa, alvos: string[]): void {
  const arquivos = alvos.length ? alvos.map((a) => a.split(path.sep).join("/")) : arquivosDoSrc();
  let total = 0;
  for (const arq of arquivos) {
    const caminho = path.join(REPO, arq);
    const { texto, trocas } = converter(fs.readFileSync(caminho, "utf8"), mapa);
    if (trocas) {
      fs.writeFileSync(caminho, texto);
      console.log(`${String(trocas).padStart(5)}  ${arq}`);
      total += trocas;
    }
  }
  console.log(`\n${total} trocas`);
}

function main(): void {
  const [modo, ...resto] = process.argv.slice(2);
  const mapa = lerMapa();
  if (modo === "--tabela") tabela(mapa);
  else if (modo === "--tema") tema(mapa);
  else if (modo === "--aplicar") aplicar(mapa, resto);
  else console.log("Uso: --tabela | --tema | --aplicar [arquivo…]");
}

const invocado = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invocado === fileURLToPath(import.meta.url)) main();
