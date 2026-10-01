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

/* ------------------------------------------------------------------
   CONFLITOS — duas classes de cor da mesma propriedade no mesmo elemento
   (`border-emerald-500 … border-slate-800`). O Tailwind 4 decide pela
   ordem do CSS gerado, que para a mesma propriedade é a ALFABÉTICA do
   nome da classe: vence a maior. Renomear muda o alfabeto e inverte o
   vencedor — foi assim que a F.2.6 pegou a borda verde que tomou o
   cartão inteiro da sala. Por isso o conflito é resolvido ANTES da
   conversão, tirando a classe que perdia (código morto: nunca pintou
   nada), e a conversão fica imune a nome.
   ------------------------------------------------------------------ */

export type Classe = { texto: string; inicio: number; fim: number };

function classesEm(fonte: string, a: number, b: number): Classe[] {
  const out: Classe[] = [];
  for (const m of fonte.slice(a, b).matchAll(/\S+/g)) {
    out.push({ texto: m[0], inicio: a + m.index!, fim: a + m.index! + m[0].length });
  }
  return out;
}

function lerTemplate(fonte: string, i: number, fim: number): { fim: number; fixo: Classe[]; ramos: Classe[][] } {
  const fixo: Classe[] = [];
  const ramos: Classe[][] = [];
  let j = i + 1;
  let trecho = j;
  while (j < fim && fonte[j] !== "`") {
    if (fonte[j] === "\\") { j += 2; continue; }
    if (fonte[j] === "$" && fonte[j + 1] === "{") {
      fixo.push(...classesEm(fonte, trecho, j));
      let k = j + 2;
      let prof = 1;
      while (k < fim && prof > 0) {
        const c = fonte[k];
        if (c === "'" || c === '"') {
          k++;
          while (k < fim && fonte[k] !== c) k += fonte[k] === "\\" ? 2 : 1;
          k++;
          continue;
        }
        if (c === "`") { k = lerTemplate(fonte, k, fim).fim + 1; continue; }
        if (c === "{") prof++;
        else if (c === "}") prof--;
        k++;
      }
      // cada literal dentro do `${…}` é um ramo: soma-se à parte fixa, nunca aos outros ramos
      ramos.push(...varrer(fonte, j + 2, k - 1));
      j = k;
      trecho = j;
      continue;
    }
    j++;
  }
  fixo.push(...classesEm(fonte, trecho, j));
  return { fim: j, fixo, ramos };
}

function varrer(fonte: string, ini: number, fim: number): Classe[][] {
  const ctx: Classe[][] = [];
  let i = ini;
  while (i < fim) {
    const c = fonte[i];
    if (c === "/" && fonte[i + 1] === "/") { const j = fonte.indexOf("\n", i); i = j < 0 || j > fim ? fim : j; continue; }
    if (c === "/" && fonte[i + 1] === "*") { const j = fonte.indexOf("*/", i + 2); i = j < 0 ? fim : j + 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < fim && fonte[j] !== c && fonte[j] !== "\n") j += fonte[j] === "\\" ? 2 : 1;
      if (fonte[j] === c) ctx.push(classesEm(fonte, i + 1, j));
      i = j + 1;
      continue;
    }
    if (c === "`") {
      const t = lerTemplate(fonte, i, fim);
      ctx.push(t.fixo);
      for (const ramo of t.ramos) ctx.push([...t.fixo, ...ramo]);
      i = t.fim + 1;
      continue;
    }
    i++;
  }
  return ctx;
}

/** As listas de classes que podem estar juntas no mesmo elemento. */
export function contextos(fonte: string): Classe[][] {
  return varrer(fonte, 0, fonte.length);
}

const RE_PREFIXO_COR = new RegExp(`^(${PREFIXOS})-(.+)$`);
const RE_VALOR_COR = new RegExp(
  `^(?:[a-z]+-(?:${TONS})|surface|raised|raised-strong|line-soft|line|line-strong|fg-strong|fg|fg-soft|muted|subtle|faint|black|white|transparent|current)(?:/\\d+)?$`
);

/** Grupos de classes de cor que brigam: mesma variante, mesmo utilitário. */
export function conflitosEm(ctx: Classe[]): Classe[][] {
  const grupos = new Map<string, Classe[]>();
  for (const cl of ctx) {
    const i = cl.texto.lastIndexOf(":");
    const variante = cl.texto.slice(0, i + 1);
    const m = cl.texto.slice(i + 1).match(RE_PREFIXO_COR);
    if (!m || m[1] === "shadow" || !RE_VALOR_COR.test(m[2])) continue;
    const chave = variante + m[1];
    const g = grupos.get(chave) ?? [];
    if (!g.some((x) => x.texto === cl.texto)) g.push(cl);
    grupos.set(chave, g);
  }
  return [...grupos.values()].filter((g) => g.length > 1);
}

/** O vencedor pela regra do Tailwind 4: na mesma propriedade, o nome alfabeticamente maior. */
export const vencedor = (g: Classe[]) => g.reduce((a, b) => (b.texto > a.texto ? b : a));

/**
 * Tira a classe que perde em TODO contexto em que briga — ela nunca pintou
 * nada. Se ela vence em outro contexto (a parte fixa de um template contra um
 * ramo), fica: tirá-la mudaria o ramo em que ela vencia.
 */
export function resolverConflitos(fonte: string): { texto: string; removidas: string[] } {
  const perde = new Map<number, Classe>();
  const vence = new Set<number>();
  for (const ctx of contextos(fonte)) {
    for (const g of conflitosEm(ctx)) {
      const v = vencedor(g);
      vence.add(v.inicio);
      for (const cl of g) if (cl !== v) perde.set(cl.inicio, cl);
    }
  }
  const tirar = [...perde.values()].filter((cl) => !vence.has(cl.inicio)).sort((a, b) => b.inicio - a.inicio);
  let texto = fonte;
  for (const cl of tirar) {
    // leva junto um espaço vizinho, para não deixar espaço duplo
    const antes = texto[cl.inicio - 1] === " " ? 1 : 0;
    const depois = !antes && texto[cl.fim] === " " ? 1 : 0;
    texto = texto.slice(0, cl.inicio - antes) + texto.slice(cl.fim + depois);
  }
  return { texto, removidas: tirar.map((c) => c.texto).reverse() };
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

function conflitos(resolver: boolean): void {
  let total = 0;
  for (const arq of arquivosDoSrc()) {
    const caminho = path.join(REPO, arq);
    const fonte = fs.readFileSync(caminho, "utf8");
    if (resolver) {
      const { texto, removidas } = resolverConflitos(fonte);
      if (removidas.length) {
        fs.writeFileSync(caminho, texto);
        console.log(`${String(removidas.length).padStart(4)}  ${arq}  — sai: ${removidas.join(" ")}`);
        total += removidas.length;
      }
      continue;
    }
    for (const ctx of contextos(fonte)) {
      for (const g of conflitosEm(ctx)) {
        const linha = fonte.slice(0, g[0].inicio).split("\n").length;
        console.log(`${arq}:${linha}  vence ${vencedor(g).texto}  (de ${g.map((c) => c.texto).join(" ")})`);
        total++;
      }
    }
  }
  console.log(resolver ? `\n${total} classes mortas removidas` : `\n${total} conflitos`);
  // F.2.10: no CI, conflito é erro — o visual passaria a depender do alfabeto.
  if (!resolver && total > 0) process.exitCode = 1;
}

function main(): void {
  const [modo, ...resto] = process.argv.slice(2);
  const mapa = lerMapa();
  if (modo === "--tabela") tabela(mapa);
  else if (modo === "--tema") tema(mapa);
  else if (modo === "--aplicar") aplicar(mapa, resto);
  else if (modo === "--conflitos") conflitos(false);
  else if (modo === "--resolver") conflitos(true);
  else console.log("Uso: --tabela | --tema | --conflitos | --resolver | --aplicar [arquivo…]");
}

const invocado = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invocado === fileURLToPath(import.meta.url)) main();
