// ============================================================
// NETSHEET ENGINE — RODA OS TESTES DE RLS NO SUPABASE LOCAL (T9.5)
// ============================================================
// 1. Descobre o container do banco Supabase via `docker ps`
//    (override com SUPABASE_DB_CONTAINER).
// 2. Pipeia supabase/tests/rls_tests.sql para dentro do psql
//    (o script é auto-seed: cria os usuários A/B/C se preciso).
// 3. Parseia o resumo `pass | fail | total` e sai com exit code
//    0 (tudo verde) ou 1 (algum FAIL) — pronto para scripting.
//
// Uso:
//   node scripts/test-rls.mjs
//   SUPABASE_DB_CONTAINER=meu_container node scripts/test-rls.mjs
// ============================================================
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQL_PATH = path.join(__dirname, "..", "supabase", "tests", "rls_tests.sql");

/** Descobre o container do banco Supabase (nome contém "supabase_db"). */
function findDbContainer() {
  if (process.env.SUPABASE_DB_CONTAINER) return process.env.SUPABASE_DB_CONTAINER;
  const ps = spawnSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" });
  const hit = (ps.stdout ?? "")
    .split(/\r?\n/)
    .map((n) => n.trim())
    .find((n) => n.includes("supabase_db"));
  if (!hit) {
    console.error("❌ Container do banco Supabase não encontrado. Suba o stack (supabase start) ou defina SUPABASE_DB_CONTAINER.");
    process.exit(1);
  }
  return hit;
}

const container = findDbContainer();
const sql = readFileSync(SQL_PATH, "utf8");

console.log(`\n🔐 Testes de RLS — container: ${container}\n`);

const run = spawnSync(
  "docker",
  ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-f", "-"],
  { input: sql, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
);
// psql manda os NOTICE (PASS/FAIL) para o STDERR — une os dois streams.
const out = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
if (run.status !== 0) {
  console.error(out);
  console.error(`❌ psql saiu com código ${run.status} — container acessível? psql ok?`);
  process.exit(1);
}

// Resumo numérico: ` pass | fail | total ` + linha ` N | M | T `
const summary = out.match(/^\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*$/m);
if (!summary) {
  console.error("❌ Não encontrei o resumo pass/fail na saída do psql.");
  process.exit(1);
}
const pass = Number(summary[1]);
const fail = Number(summary[2]);
const total = Number(summary[3]);

// Contagem dos NOTICE de PASS/FAIL para conferência
const passNotices = (out.match(/NOTICE:\s+PASS/g) || []).length;
const failNotices = (out.match(/NOTICE:\s+FAIL/g) || []).length;

console.log(`📊 Resumo: ${pass}/${total} passaram, ${fail} falharam (${passNotices} NOTICE PASS, ${failNotices} NOTICE FAIL)`);

if (fail > 0 || failNotices > 0) {
  // Imprime os FAILs para diagnóstico
  for (const line of out.split(/\r?\n/)) {
    if (line.includes("FAIL")) console.log(`  ❌ ${line.trim()}`);
  }
  console.error(`❌ RLS: ${fail || failNotices} teste(s) falharam.`);
  process.exit(1);
}

console.log("✅ RLS: todos os testes passaram.");
process.exit(0);
