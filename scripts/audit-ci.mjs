#!/usr/bin/env node
/**
 * ============================================================
 * NETSHEET ENGINE — PORTÃO DE AUDIT (Fase B, B.6 — SEC-06)
 * ============================================================
 * Falha o CI quando aparece vulnerabilidade ALTA ou CRÍTICA em dependência de
 * produção. Vulnerabilidade moderada e baixa são reportadas, não bloqueiam.
 *
 * POR QUE UM SCRIPT, E NÃO `npm audit --audit-level=high`
 * Na Fase B, duas altas do `mathjs` não tinham correção aplicável (saíram na
 * Fase C, com o @dice-roller). Um portão que fica permanentemente vermelho não é um portão: em
 * uma semana ninguém olha, e a vulnerabilidade NOVA se esconde no meio do
 * ruído das velhas.
 *
 * A alternativa honesta não é baixar o nível da checagem — é aceitar exceções
 * NOMEADAS, com motivo escrito e gatilho de reavaliação, visíveis no
 * repositório e revisáveis num PR. Qualquer alta que não esteja na lista
 * derruba a build.
 *
 * Uso:  node scripts/audit-ci.mjs
 * ============================================================
 */

import { execSync } from "node:child_process";

/**
 * Exceções aceitas conscientemente. Cada entrada precisa de motivo e gatilho —
 * "é chato de arrumar" não é motivo.
 */
const ALLOWLIST = [
  // Vazia desde a Fase C (25/09/2026). As duas exceções do mathjs (#1117167 e
  // #1117889) saíram junto com o @dice-roller, que era o único caminho até ele:
  // o motor de dados passou a ser próprio, em src/rules/dice.ts (C.1, ADR 0004).
  // Modelo de entrada: { id, pkg, title, motivo, gatilho, revisadoEm }.
];

const BLOQUEIA = new Set(["high", "critical"]);

// Comando fixo, sem interpolação — daí `execSync` com string ser seguro aqui.
// (`execFileSync` com args + shell:true dispara DEP0190; e sem shell o Node no
// Windows não consegue spawnar npm.cmd, EINVAL. String literal resolve os dois.)
const AUDIT_CMD = "npm audit --omit=dev --json";

function runAudit() {
  try {
    // `npm audit` sai com código != 0 quando ACHA vulnerabilidade — é o caso
    // normal aqui. O erro traz o JSON no stdout, então lemos dos dois lados.
    return execSync(AUDIT_CMD, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    if (e.stdout) return e.stdout;
    throw e;
  }
}

const audit = JSON.parse(runAudit());
const allowById = new Map(ALLOWLIST.map((a) => [a.id, a]));

const bloqueantes = [];
const aceitas = [];
const informativas = [];
const vistos = new Set();

for (const vuln of Object.values(audit.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via !== "object" || vistos.has(via.source)) continue;
    vistos.add(via.source);
    const item = { id: via.source, pkg: via.name, severity: via.severity, title: via.title, url: via.url };
    if (!BLOQUEIA.has(via.severity)) informativas.push(item);
    else if (allowById.has(via.source)) aceitas.push({ ...item, ...allowById.get(via.source) });
    else bloqueantes.push(item);
  }
}

console.log("🔎 Portão de audit — dependências de produção\n");

if (informativas.length) {
  console.log(`ℹ️  ${informativas.length} de severidade baixa/moderada (não bloqueiam):`);
  for (const v of informativas) console.log(`   · [${v.severity}] ${v.pkg} — ${v.title}`);
  console.log("");
}

if (aceitas.length) {
  console.log(`🟡 ${aceitas.length} alta(s) ACEITA(S) conscientemente:`);
  for (const v of aceitas) {
    console.log(`   · [${v.severity}] ${v.pkg} (#${v.id}) — ${v.title}`);
    console.log(`     motivo:  ${v.motivo}`);
    console.log(`     gatilho: ${v.gatilho}   (revisado em ${v.revisadoEm})`);
  }
  console.log("");
}

// Entrada obsoleta é ruído que vira permissão esquecida: avisa, sem falhar.
const idsPresentes = new Set(vistos);
const obsoletas = ALLOWLIST.filter((a) => !idsPresentes.has(a.id));
if (obsoletas.length) {
  console.log("🧹 Exceções na ALLOWLIST que não aparecem mais no audit — remova de scripts/audit-ci.mjs:");
  for (const a of obsoletas) console.log(`   · #${a.id} ${a.pkg}`);
  console.log("");
}

if (bloqueantes.length) {
  console.log(`❌ ${bloqueantes.length} vulnerabilidade(s) ALTA/CRÍTICA sem exceção registrada:\n`);
  for (const v of bloqueantes) {
    console.log(`   · [${v.severity}] ${v.pkg} (#${v.id}) — ${v.title}`);
    if (v.url) console.log(`     ${v.url}`);
  }
  console.log(
    "\nCorrija (`npm audit fix`) ou registre a exceção com motivo e gatilho em scripts/audit-ci.mjs."
  );
  process.exit(1);
}

console.log("✅ Nenhuma vulnerabilidade alta/crítica sem exceção registrada.");
