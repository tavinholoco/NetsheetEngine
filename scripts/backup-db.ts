/**
 * Revisão pós-D (R.10, decisão 8) — BACKUP MANUAL DO BANCO DE PRODUÇÃO
 * ====================================================================
 * O plano gratuito do Supabase não faz backup automático (só Pro, Team e
 * Enterprise), e a doc recomenda que o gratuito exporte com `supabase db dump`.
 * O dono escolheu o dump manual: mensal, e antes de toda migration. Runbook em
 * docs/BACKUP.md.
 *
 *   npm run backup:db
 *
 * Três arquivos, no formato do guia oficial de backup e restauração:
 *   roles.sql   — papéis do cluster
 *   schema.sql  — esquema (sem auth, storage e extensões, que o Supabase recria)
 *   data.sql    — dados, em COPY, INCLUSIVE auth.users (e-mail e hash de senha)
 * Os ARQUIVOS do Storage (avatares) não entram — só a metadata deles.
 *
 * Três travas, porque o dump carrega dado pessoal:
 *   1. o destino nunca fica dentro do repositório — ele é PÚBLICO;
 *   2. uma pasta por dia, sem sobrescrever dump anterior;
 *   3. um MANIFEST.txt com tamanho, SHA-256 e linhas por tabela, contadas sem
 *      imprimir conteúdo — é como se confere, depois, que o dump está inteiro.
 *
 * Exige Docker rodando (o CLI roda o pg_dump num contêiner) e o CLI linkado ao
 * projeto (supabase/.temp). NUNCA rodar junto com o db-sync ou o keepalive do
 * CI: os três usam o mesmo papel temporário do CLI e um derruba a senha do
 * outro (28P01).
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** `child` é `parent` ou fica dentro dele? (caixa ignorada no Windows) */
export function isInside(child: string, parent: string): boolean {
  const norm = (p: string) => (process.platform === "win32" ? path.resolve(p).toLowerCase() : path.resolve(p));
  const rel = path.relative(norm(parent), norm(child));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/**
 * Linhas de dado por tabela num dump em COPY. Conta as linhas entre
 * `COPY tabela (...) FROM stdin;` e `\.` sem guardar nem imprimir nenhuma.
 */
export function countCopyRows(sql: string): Record<string, number> {
  const counts: Record<string, number> = {};
  let current: string | null = null;
  for (const line of sql.split(/\r?\n/)) {
    if (current === null) {
      const m = line.match(/^COPY\s+(\S+)\s.*FROM stdin;$/);
      if (m) {
        current = m[1].replace(/"/g, "");
        counts[current] = 0;
      }
    } else if (line === "\\.") {
      current = null;
    } else {
      counts[current] += 1;
    }
  }
  return counts;
}

/** Pasta do dia (`AAAA-MM-DD`), com sufixo `-2`, `-3`… se já existir: nunca sobrescreve. */
export function dayFolder(root: string, date: Date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  let dir = path.join(root, day);
  for (let i = 2; fs.existsSync(dir); i++) dir = path.join(root, `${day}-${i}`);
  return dir;
}

function sha256(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function main(): void {
  const root = path.resolve(process.env.NETSHEET_BACKUP_DIR || path.join(os.homedir(), "netsheet-backups"));
  if (isInside(root, REPO)) {
    console.error(`❌ Destino dentro do repositório (${root}). O repositório é PÚBLICO — o dump tem dado pessoal.`);
    process.exit(1);
  }
  const dir = dayFolder(root);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`📦 Backup do banco de produção → ${dir}\n`);

  const dump = (flags: string, file: string) =>
    execSync(`npx supabase db dump --linked ${flags} -f "${path.join(dir, file)}"`, { cwd: REPO, stdio: "inherit" });
  dump("--role-only", "roles.sql");
  dump("", "schema.sql");
  dump('--use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"', "data.sql");

  const files = ["roles.sql", "schema.sql", "data.sql"].map((f) => {
    const full = path.join(dir, f);
    return { f, bytes: fs.statSync(full).size, sha: sha256(full) };
  });
  const rows = countCopyRows(fs.readFileSync(path.join(dir, "data.sql"), "utf8"));
  const cli = execSync("npx supabase --version", { cwd: REPO }).toString().trim();

  const manifest = [
    `NetSheet Engine — backup do banco de produção`,
    `Data: ${new Date().toISOString()}`,
    `Supabase CLI: ${cli}`,
    ``,
    `Arquivos (bytes, SHA-256):`,
    ...files.map((x) => `  ${x.f.padEnd(11)} ${String(x.bytes).padStart(10)}  ${x.sha}`),
    ``,
    `Linhas por tabela (data.sql):`,
    ...Object.entries(rows).map(([t, c]) => `  ${t.padEnd(40)} ${c}`),
    ``,
    `CONTÉM DADO PESSOAL (auth.users com e-mail e hash de senha, perfis, mensagens diretas).`,
    `Guardar FORA do repositório e de preferência cifrado. Não inclui os arquivos do Storage (avatares).`,
    `Restauração: docs/BACKUP.md.`
  ].join("\n");
  fs.writeFileSync(path.join(dir, "MANIFEST.txt"), manifest + "\n");

  console.log(`\n${manifest}\n\n✅ Backup completo em ${dir}`);
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invoked === fileURLToPath(import.meta.url)) main();
