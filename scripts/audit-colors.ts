/**
 * ============================================================
 * NETSHEET ENGINE — CONTAGEM DE COR ESCRITA À MÃO (Fase F, F.0e)
 * ============================================================
 * O critério de pronto da Fase F é "a cor literal tendendo a zero" — e, até a
 * F.0a, cada contagem usava uma regex diferente (1.722, 1.731, 1.846) e nenhuma
 * via os `rgba()` escondidos nas sombras, o `.ts` nem o CSS. Um critério sem
 * comando não é medida. Este é o comando.
 *
 * O que conta, por arquivo, em `src/` (fora dos testes):
 *  - paleta  — utilitário da paleta padrão do Tailwind (`text-red-500`,
 *              `hover:bg-slate-900/80`…): as 22 famílias × tom;
 *  - rgba    — `rgb()`/`rgba()` literal (o brilho em `shadow-[…]`);
 *  - hex     — hex literal: em `.ts`/`.tsx`, dentro de string ou de `[…]`; no
 *              CSS, fora do bloco `@theme` (é lá que os tokens moram);
 *  - p/b     — `black`/`white` numa coluna à parte: é neutro absoluto, e a
 *              F.2 decide o que fazer com eles.
 *
 * Exceção só NOMEADA, com motivo e gatilho — o mesmo padrão do audit-ci.mjs.
 * Nesta fase o script só reporta; a trava no CI é a F.2.10.
 *
 * Uso:  npm run audit:colors
 * ============================================================
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** As 22 famílias da paleta padrão do Tailwind v4. */
export const FAMILIAS = [
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber", "yellow", "lime", "green",
  "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"
];
const TONS = "50|100|200|300|400|500|600|700|800|900|950";

const RE_PALETA = new RegExp(`\\b(?:${FAMILIAS.join("|")})-(?:${TONS})\\b`, "g");
// Sem `\b`: no valor arbitrário do Tailwind o `rgba` vem colado num `_`
// (`shadow-[0_0_12px_rgba(…)]`), e `_` conta como letra para o `\b`.
const RE_RGBA = /(?<![A-Za-z])rgba?\(\s*\d/g;
// No código, hex só conta dentro de string ou de valor arbitrário — "PR #123"
// num comentário não é cor. No CSS, conta onde for (fora do @theme).
const RE_HEX_CODIGO = /['"`[]#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const RE_HEX_CSS = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const RE_PRETO_BRANCO =
  /\b(?:text|bg|border(?:-[trblxyse])?|ring|from|via|to|shadow|fill|stroke|divide|outline|placeholder|decoration|caret|accent)-(?:black|white)\b/g;
const RE_THEME = /@theme[^{]*\{[^}]*\}/g;

export type Contagem = { paleta: number; rgba: number; hex: number; pretoBranco: number };

const quantos = (texto: string, re: RegExp) => texto.match(re)?.length ?? 0;

/** Conta um arquivo. `tipo` decide a regra do hex e se o `@theme` sai da conta. */
export function contarTexto(texto: string, tipo: "codigo" | "css"): Contagem {
  const alvo = tipo === "css" ? texto.replace(RE_THEME, "") : texto;
  return {
    paleta: quantos(alvo, RE_PALETA),
    rgba: quantos(alvo, RE_RGBA),
    hex: quantos(alvo, tipo === "css" ? RE_HEX_CSS : RE_HEX_CODIGO),
    pretoBranco: quantos(alvo, RE_PRETO_BRANCO)
  };
}

export type Excecao = {
  /** Caminho relativo ao repositório, com `/`. */
  arquivo: string;
  categoria: "paleta" | "rgba" | "hex";
  /** A exceção cobre até este número; o que passar dele conta. */
  ate: number;
  motivo: string;
  gatilho: string;
  revisadoEm: string;
};

/**
 * Exceções aceitas conscientemente. Cada uma precisa de motivo e gatilho —
 * "dá trabalho migrar" não é motivo.
 */
export const EXCECOES: Excecao[] = [
  {
    arquivo: "src/features/multiplayer/TacticalGrid.tsx",
    categoria: "hex",
    ate: 5,
    motivo:
      "O campo `color` do token do grid: persistido, validado no gridDoc e sem nenhum leitor — o grid pinta por `type`, com classes. Não é cor de tela.",
    gatilho: "A Fase G decidir o campo (remover ou passar a ler).",
    revisadoEm: "30/09/2026"
  }
];

export type Linha = { arquivo: string } & Contagem;

/** Tira de cada linha o que uma exceção nomeada cobre. */
export function aplicarExcecoes(linhas: Linha[], excecoes: Excecao[]): Linha[] {
  return linhas.map((linha) => {
    const resto = { ...linha };
    for (const ex of excecoes) {
      if (ex.arquivo === linha.arquivo) resto[ex.categoria] = Math.max(0, resto[ex.categoria] - ex.ate);
    }
    return resto;
  });
}

const total = (c: Contagem) => c.paleta + c.rgba + c.hex;

function arquivosDoSrc(): string[] {
  const src = path.join(REPO, "src");
  return fs
    .readdirSync(src, { recursive: true, encoding: "utf8" })
    .map((rel) => path.join("src", rel).split(path.sep).join("/"))
    .filter((rel) => /\.(tsx?|css)$/.test(rel))
    .filter((rel) => !rel.startsWith("src/__tests__/") && !rel.startsWith("src/test/") && !/\.test\.tsx?$/.test(rel));
}

function main(): void {
  const brutas: Linha[] = arquivosDoSrc().map((arquivo) => {
    const texto = fs.readFileSync(path.join(REPO, arquivo), "utf8");
    return { arquivo, ...contarTexto(texto, arquivo.endsWith(".css") ? "css" : "codigo") };
  });
  const linhas = aplicarExcecoes(brutas, EXCECOES)
    .filter((l) => total(l) + l.pretoBranco > 0)
    .sort((a, b) => total(b) - total(a) || a.arquivo.localeCompare(b.arquivo));

  console.log("🎨 Cor escrita à mão em src/ (fora dos testes)\n");
  const larg = Math.max(...linhas.map((l) => l.arquivo.length), 7);
  console.log(`${"arquivo".padEnd(larg)}  paleta   rgba    hex    p/b`);
  for (const l of linhas) {
    const n = (v: number) => String(v).padStart(6);
    console.log(`${l.arquivo.padEnd(larg)}  ${n(l.paleta)} ${n(l.rgba)} ${n(l.hex)} ${n(l.pretoBranco)}`);
  }
  const soma = linhas.reduce(
    (s, l) => ({ paleta: s.paleta + l.paleta, rgba: s.rgba + l.rgba, hex: s.hex + l.hex, pretoBranco: s.pretoBranco + l.pretoBranco }),
    { paleta: 0, rgba: 0, hex: 0, pretoBranco: 0 }
  );
  console.log(`\nTotal: paleta ${soma.paleta} · rgba ${soma.rgba} · hex ${soma.hex} → ${total(soma)} a migrar`);
  console.log(`       black/white à parte: ${soma.pretoBranco}`);
  if (EXCECOES.length) {
    console.log(`\nExceções nomeadas (${EXCECOES.length}):`);
    for (const ex of EXCECOES) console.log(`   · ${ex.arquivo} — ${ex.categoria} até ${ex.ate}: ${ex.motivo}`);
  }
}

const invocado = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invocado === fileURLToPath(import.meta.url)) main();
