// ============================================================
// E2E WebSocket — regressão do discriminador de frames (T5.4)
// ============================================================
// Bug real corrigido na T5.4: o `ws@8.21.1` entrega frames de TEXTO
// como Buffer no servidor — o handler que checava `typeof raw ===
// "string"` nunca processava mensagens (chat/roll/heartbeat).
// Este teste valida o flag `isBinary` como discriminador confiável:
//   1. Frames de texto (JSON) são processados (chat + broadcast)
//   2. Frames binários (protocolo Yjs) são roteados sem crash
//   3. rollResult forjado no `message` é ignorado (anti-forjamento)
// Uso (servidor de produção em :3000): node scripts/test-ws-e2e.mjs
// No CI: roda no job validate (smoke test do servidor).
// ============================================================
import WebSocket from "ws";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const WS_URL = (BASE.startsWith("https") ? "wss" : "ws") + BASE.slice(BASE.indexOf("://"));

let passed = 0;
let failed = 0;
const check = (name, cond) => {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name}`); }
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const code = "CIWS-" + Math.random().toString(36).substring(2, 6).toUpperCase();

console.log(`\n🔷 E2E WS (isBinary) — sala ${code}\n`);

// 1. Cria sala (GM)
const res = await fetch(`${BASE}/api/rooms/create`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code, name: "CI WS Test", gmHandle: "CI_GM", gmPeerId: "peer_ci_gm" })
});
const data = await res.json();
check("1. Sala criada (GM)", res.ok && !!data.sessionToken);

// 2. Conecta WS autenticado
const ws = new WebSocket(`${WS_URL}/ws/rooms/${code}?token=${encodeURIComponent(data.sessionToken)}`);
const received = [];
let errored = false;
ws.on("error", () => { errored = true; });
ws.on("message", (raw) => {
  try {
    const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
    const obj = JSON.parse(text);
    if (obj && obj.chatMessages) received.push(obj);
  } catch { /* binário Yjs — ignorado aqui */ }
});
await new Promise((r, rej) => { ws.once("open", r); ws.once("error", rej); });

// 3. Mensagem de texto via WS → broadcast chega de volta
ws.send(JSON.stringify({ type: "message", text: "ping-ci" }));
await wait(700);
const last = received[received.length - 1]?.chatMessages || [];
const found = last.find((m) => m.text === "ping-ci");
check("3. Texto (isBinary=false) processado → broadcast", !!found && found.senderHandle === "CI_GM");

// 4. rollResult forjado no message é IGNORADO (anti-forjamento)
ws.send(JSON.stringify({ type: "message", text: "hack?", rollResult: { total: 999 } }));
await wait(700);
const last2 = received[received.length - 1]?.chatMessages || [];
const forged = last2[last2.length - 1];
check("4. rollResult forjado ignorado (vira texto normal)", forged && forged.text === "hack?" && !forged.isDiceRoll);

// 5. Frames binários (Yjs) não derrubam o handler (sobrevivência)
ws.send(Buffer.from([0, 1, 2, 3, 4]));
await wait(300);
check("5. Binário (isBinary=true) roteado sem crash", ws.readyState === WebSocket.OPEN && !errored);

// 6. Ainda processa texto após binário (sem desync)
ws.send(JSON.stringify({ type: "message", text: "ping-pos-binary" }));
await wait(700);
const last3 = received[received.length - 1]?.chatMessages || [];
check("6. Texto processado após binário", last3.some((m) => m.text === "ping-pos-binary"));

ws.close();
console.log(`\n📊 Resultado: ${passed} passaram, ${failed} falharam\n`);
process.exit(failed === 0 ? 0 : 1);
