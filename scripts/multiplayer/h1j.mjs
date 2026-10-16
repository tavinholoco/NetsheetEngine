// H.1j — (no ar) o Render troca a instância com a mesa aberta, e a mesa volta da
// hibernação. É o único cenário da H contra produção, e roda COMBINADO COM O DONO:
// quem troca a instância é ele, no painel do Render ("Manual Deploy → Deploy latest
// commit"), quando o roteiro imprime PRONTO.
//
//   node scripts/multiplayer/h1j.mjs              # contra https://netsheetengine.onrender.com
//   H1J_LOCAL=1 node scripts/multiplayer/h1j.mjs  # ensaio local (npm run build e o Supabase local antes)
//
// (A) A mesa de teste: GM pelo deep link (sala criada por REST), Ana e Beto pelo link do
//     convite; um NPC, a iniciativa e 25 de dano na Ana. Depois do PRONTO, o GM fala pelo
//     chat da TELA (vai pelo WebSocket — à instância que tem o socket) e, depois da troca,
//     também pela API (vai à instância que recebe o tráfego novo). O que sobra no chat no
//     fim diz o que o deploy perdeu (E.06). Anota quando cada socket cai e volta, quem cai
//     no SSE (H.09) e quem volta com outro `peerId` (H.11).
// (B) Todos fecham a aba, e nenhuma requisição por H1J_IDLE_MIN minutos (18): o serviço
//     hiberna. Na volta, ao mesmo tempo: um `join` da Ana abortado em 4 s (o F5 durante o
//     despertar — o gatilho do H.04: o Render entrega o pedido de quem já foi embora?), o GM
//     pela tela, com paciência, e o Beto, que recarrega a página no meio do despertar.
// (C) Todos saem pela API: a sala some do banco de produção.
//
// Custo: minutos de instância e poucos MB de banda. O /api/health é consultado a cada 5 s
// SÓ na janela do deploy, com prazo (H1J_SWAP_TIMEOUT_MIN) — nada de monitor (regra 3 do
// custo zero). Aborta se o ar já tiver mesa aberta: nunca trocar a instância com gente jogando.
//
// O ensaio local imita o Render: um proxy HTTP que encaminha cada pedido à instância
// "corrente" e prende o WebSocket à instância em que abriu; a instância nova sobe com o
// banco, recebe o tráfego quando a porta dela abre, e a velha morre H1J_OLD_DIES_S (5) s
// depois — mas no Windows morre na hora, sem o flushAllPending do SIGTERM (a diferença está
// no resultado). A hibernação é o proxy segurando os pedidos enquanto a instância seguinte sobe.
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import { chromium, startServer, person, seedRoom, gmInit, setHandle, session, roomState, api, sleep } from "./lib.mjs";

const LOCAL = process.env.H1J_LOCAL === "1";
const IDLE_MIN = Number(process.env.H1J_IDLE_MIN ?? (LOCAL ? 0.2 : 18));
const SWAP_TIMEOUT_MIN = Number(process.env.H1J_SWAP_TIMEOUT_MIN ?? (LOCAL ? 3 : 25));
// Ensaio: quanto a velha vive depois de a nova abrir a porta. 5 s é o medido no Render
// (H.3d.0, 14/10: a porta abriu às 22:34:48,4 e o SIGTERM da velha veio às 22:34:53,5).
const OLD_DIES_S = Number(process.env.H1J_OLD_DIES_S ?? 5);
// Ensaio: quanto o proxy leva da porta aberta da nova à troca do tráfego. No Render, ~5 s
// (o teste TCP e a troca — H.3d.0); 0 é a troca instantânea, a comparação de 15/10. Com o
// bastão (H.3d), é a janela em que a velha já entregou e responde 503 server_restarting.
const SWITCH_DELAY_S = Number(process.env.H1J_SWITCH_DELAY_S ?? 0);
// Ensaio: quanto o proxy segura o fechamento do WebSocket que o servidor manda. No ar
// (H.3d.4, 15/10), 13–16 s; 0 é o fechamento na hora, como nos ensaios até a H.3d.3.
const CLOSE_HOLD_S = Number(process.env.H1J_CLOSE_HOLD_S ?? 0);
const T0 = Date.now();
const log = (...a) => console.log(`${((Date.now() - T0) / 1000).toFixed(1).padStart(7)}s`, ...a);
const rel = (t, ref) => (t == null ? "—" : `${t - ref >= 0 ? "+" : ""}${((t - ref) / 1000).toFixed(1)}s`);
const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const sufixo = () => Array.from({ length: 6 }, () => ALFABETO[Math.floor(Math.random() * ALFABETO.length)]).join("");

// ---------------------------------------------------------------------------
// O ensaio local: as instâncias e o proxy que faz o papel do Render
// ---------------------------------------------------------------------------
const PROXY_PORT = 3290;
let instances = [];
let proxy = null;
function renderLikeProxy(listenPort, firstTarget) {
  let target = firstTarget;
  let hold = null; // a hibernação: os pedidos esperam a instância seguinte
  const waitAwake = () => hold?.promise ?? Promise.resolve();
  const srv = http.createServer(async (req, res) => {
    await waitAwake();
    const up = http.request({ host: "127.0.0.1", port: target, path: req.url, method: req.method, headers: req.headers }, (ur) => {
      res.writeHead(ur.statusCode, ur.headers);
      ur.pipe(res);
    });
    up.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(up);
    res.on("close", () => up.destroy());
  });
  srv.on("upgrade", async (req, sock, head) => {
    await waitAwake();
    // H.3d.4 — no ar, o caminho até o navegador segurou o FECHAMENTO do WebSocket que o
    // servidor manda por 13–16 s: o navegador seguiu achando o socket aberto, e o que
    // ele mandou nesse tempo sumiu. Com H1J_CLOSE_HOLD_S, o proxy faz o mesmo: o quadro
    // de fechamento do servidor (0x88) e o fim da conexão esperam esse tempo, e o que o
    // navegador manda enquanto isso é engolido. Os quadros de dados passam na hora.
    let held = false;
    const kill = () => { u.destroy(); sock.destroy(); };
    const holdThenKill = () => {
      if (held) return;
      held = true;
      setTimeout(kill, CLOSE_HOLD_S * 1000);
    };
    const u = net.connect(target, "127.0.0.1", () => {
      const lines = [`${req.method} ${req.url} HTTP/1.1`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      u.write(lines.join("\r\n") + "\r\n\r\n");
      if (head?.length) u.write(head);
      u.on("data", (chunk) => {
        if (CLOSE_HOLD_S > 0 && (held || chunk[0] === 0x88)) return holdThenKill();
        sock.write(chunk);
      });
      sock.on("data", (chunk) => {
        if (!held && !u.destroyed) u.write(chunk);
      });
    });
    const upstreamGone = () => (CLOSE_HOLD_S > 0 ? holdThenKill() : kill());
    u.on("error", upstreamGone); u.on("close", upstreamGone);
    sock.on("error", kill); sock.on("close", kill);
  });
  srv.listen(listenPort);
  return {
    setTarget: (p) => (target = p),
    sleep: () => { let release; hold = { promise: new Promise((r) => (release = r)) }; hold.release = release; },
    wake: () => { hold?.release(); hold = null; },
    close: () => srv.close()
  };
}

let base;
if (LOCAL) {
  instances.push(await startServer({ port: 3291, persist: true }));
  proxy = renderLikeProxy(PROXY_PORT, 3291);
  base = `http://127.0.0.1:${PROXY_PORT}`;
} else {
  base = (process.env.H1J_BASE || "https://netsheetengine.onrender.com").replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// O health diz QUAL instância respondeu: o processo que subiu em (agora − uptime)
// ---------------------------------------------------------------------------
const seenInstances = []; // { bootAt, firstSeen }
async function health(timeoutMs = 30_000) {
  const t = Date.now();
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(base + "/api/health", { signal: ctl.signal });
    const j = await r.json();
    const at = Date.now();
    const bootAt = at - j.uptime * 1000;
    let idx = seenInstances.findIndex((i) => Math.abs(i.bootAt - bootAt) < 15_000);
    if (idx < 0) { seenInstances.push({ bootAt, firstSeen: at }); idx = seenInstances.length - 1; }
    return { ms: at - t, version: j.version, uptime: j.uptime, rooms: j.rooms, bootAt, instance: idx };
  } finally {
    clearTimeout(to);
  }
}

function track(p) {
  p.sse = [];
  p.seen = new Set();
  p.page.on("request", (r) => { if (r.url().includes("/stream?")) p.sse.push(Date.now()); });
  p.page.on("websocket", (ws) => ws.on("framereceived", (f) => {
    if (typeof f.payload !== "string" || !f.payload.startsWith('{"code"')) return;
    try { p.seen = new Set((JSON.parse(f.payload).chatMessages || []).map((m) => m.text)); } catch { /* quadro parcial */ }
  }));
  return p;
}
const wsOpenNow = (p) => p.ws.length > 0 && !p.ws[p.ws.length - 1].closed;
const inRoom = (p, ms) => p.page.getByPlaceholder("Mensagem para a mesa...").waitFor({ timeout: ms }).then(() => true, () => false);
async function sayQuick(p, text) {
  try {
    const box = p.page.getByPlaceholder("Mensagem para a mesa...");
    await box.fill(text, { timeout: 3000 });
    await box.press("Enter", { timeout: 3000 });
    return true;
  } catch { return false; }
}
async function enterByInvite(p, code) {
  await p.page.goto(base + "/room/" + code, { timeout: 120_000 });
  await p.page.getByRole("button", { name: /Entrar na Mesa/i }).click({ timeout: 60_000 });
  if (!(await inRoom(p, 60_000))) throw new Error(`${p.name} não entrou na mesa`);
}
const seatsOf = (st, original) => Object.values(st.players || {}).map((s) => {
  const who = Object.entries(original).find(([, id]) => id === s.peerId)?.[0];
  return `${s.handle}[${who ? "o mesmo" : "NOVO " + s.peerId.slice(-6)}]${s.isOnline ? "" : "(off)"}:${s.sheet?.damagePoints ?? "?"}`;
}).join("  ");

// ===========================================================================
// (A) A mesa de teste e a troca de instância
// ===========================================================================
const h0 = await health(150_000);
log(`health: v${h0.version}, uptime ${h0.uptime}s, ${h0.rooms.active} mesa(s) e ${h0.rooms.players} jogador(es) no ar, ${h0.ms} ms`);
if (h0.rooms.active > 0 && !LOCAL) {
  log("ABORTADO: já há mesa aberta neste servidor. Trocar a instância agora atropelaria quem está jogando.");
  process.exit(1);
}
if (h0.rooms.active > 0) log("(ensaio: as mesas acima são sobras de testes no Supabase local)");
const code = "H1J-" + sufixo();
const { gmPeerId, gmToken } = await seedRoom(base, code, "peer_h1j_gm_" + sufixo().toLowerCase(), "Mestre");
const browser = await chromium.launch();
const gm = track(await person(browser, "GM", { init: gmInit(gmPeerId, gmToken) }));
const ana = track(await person(browser, "Ana"));
const beto = track(await person(browser, "Beto"));
const people = [gm, ana, beto];
const original = {};
// As sessões conhecidas, para a limpeza funcionar mesmo se o roteiro cair no meio.
const known = { GM: { peerId: gmPeerId, token: gmToken } };
async function remember(p) {
  try { known[p.name] = await session(p); } catch { /* aba fechada: fica a última conhecida */ }
}

try {
  for (const [p, h] of [[gm, "Mestre"], [ana, "Ana"], [beto, "Beto"]]) await setHandle(p, base, h);
  await gm.page.goto(base + "/room/" + code, { timeout: 120_000 });
  if (!(await inRoom(gm, 60_000))) throw new Error("o GM não entrou na mesa");
  await enterByInvite(ana, code);
  await enterByInvite(beto, code);
  for (const p of people) {
    await remember(p);
    original[p.name] = known[p.name].peerId;
  }
  const tok = async (p) => (await session(p)).token;
  await api(base, `/api/rooms/${code}/npcs/generate`, await tok(gm));
  await api(base, `/api/rooms/${code}/initiative`, await tok(gm), { action: "roll" });
  await api(base, `/api/rooms/${code}/damage`, await tok(gm), { targetId: original.Ana, raw: 25, location: "Torso" });
  await sleep(4000); // o debounce da persistência (2 s) grava a mesa montada
  let st = await roomState(base, code, await tok(gm));
  log(`mesa ${code} montada: ${seatsOf(st, original)} | NPCs ${Object.keys(st.npcs || {}).length} | iniciativa ${(st.initiativeList || []).length} | chat ${st.chatMessages.length}`);

  const tReady = Date.now();
  log("==================================================================");
  log(LOCAL ? "PRONTO — o ensaio troca a instância sozinho em 15 s." : "PRONTO — agora o dono clica em Manual Deploy → Deploy latest commit.");
  log("==================================================================");

  if (LOCAL) {
    (async () => {
      await sleep(15_000);
      // Como o Render (H.3d.0): o tráfego só vai à nova quando a porta dela abre — o
      // `startServer` espera o health —, e a velha leva o SIGTERM uns 5 s depois da troca.
      log("[ensaio] a instância nova sobe (restaura do banco)…");
      const next = await startServer({ port: 3291 + instances.length, persist: true });
      instances.push(next);
      if (SWITCH_DELAY_S > 0) {
        log(`[ensaio] a porta da nova abriu; o proxy troca o tráfego em ${SWITCH_DELAY_S} s (o Render)`);
        await sleep(SWITCH_DELAY_S * 1000);
      }
      proxy.setTarget(next.port);
      log(`[ensaio] o tráfego novo vai para a nova; a velha morre em ${OLD_DIES_S} s`);
      await sleep(OLD_DIES_S * 1000);
      await instances[instances.length - 2].stop();
      log("[ensaio] a velha morreu (no Windows, sem o flushAllPending)");
    })();
  }

  // --- o laço da janela do deploy ---
  const sent = [];
  const apiSends = [];
  let n = 0;
  let swapAt = null;
  let newBootAt = null;
  let firstDropAt = null;
  let nextHealth = 0;
  let nextUi = 0;
  let nextApi = 0;
  const deadline = tReady + SWAP_TIMEOUT_MIN * 60_000;
  while (Date.now() < deadline) {
    const now = Date.now();
    const hot = swapAt !== null || firstDropAt !== null;
    if (now >= nextHealth) {
      nextHealth = now + 5000;
      try {
        const h = await health();
        if (h.instance > 0 && swapAt === null) {
          swapAt = Date.now();
          newBootAt = h.bootAt;
          log(`TROCA — o health já vem da instância nova (subiu ${rel(h.bootAt, swapAt)} antes; v${h.version})`);
        }
      } catch (e) {
        log("health falhou:", e.message);
      }
    }
    if (now >= nextUi) {
      nextUi = now + (hot ? 3000 : 20_000);
      const label = `d-${++n}`;
      const via = wsOpenNow(gm) ? "ws" : "rest";
      const ok = await sayQuick(gm, label);
      sent.push({ label, t: Date.now(), via: ok ? `tela/${via}` : "tela: falhou" });
    }
    if (hot && now >= nextApi) {
      nextApi = now + 6000;
      const label = `r-${++n}`;
      // Como o `apiFetch` do cliente desde a H.3d: o 503 `server_restarting` não
      // executou nada (a velha entregou a mesa) — tentar de novo a cada 1,5 s. Sem
      // prender o laço: o chat da tela segue saindo enquanto isto espera.
      const t = Date.now();
      apiSends.push((async () => {
        let r;
        let tries = 0;
        for (;;) {
          r = await api(base, `/api/rooms/${code}/message`, await tok(gm), { text: label });
          tries += 1;
          if (r.status === 503 && r.body?.code === "server_restarting" && Date.now() - t < 45_000) { await sleep(1500); continue; }
          break;
        }
        sent.push({ label, t, via: `api ${r.status}${tries > 1 ? " (tentou de novo)" : ""}` });
      })());
    }
    if (firstDropAt === null) {
      const drops = people.flatMap((p) => p.ws.filter((w) => w.closed && w.closed > tReady).map((w) => w.closed));
      if (drops.length) {
        firstDropAt = Math.min(...drops);
        log("o primeiro socket caiu — a instância velha morreu?");
      }
    }
    if (swapAt && firstDropAt && Date.now() - Math.max(swapAt, firstDropAt) > 45_000) break;
    // Desistir sem deixar a mesa no banco: criar o arquivo H1J_CANCEL_FILE leva à limpeza.
    if (process.env.H1J_CANCEL_FILE && fs.existsSync(process.env.H1J_CANCEL_FILE)) {
      log("cancelado pelo arquivo — sem deploy.");
      break;
    }
    await sleep(400);
  }

  if (!swapAt) {
    log(`Nenhuma troca de instância em ${SWAP_TIMEOUT_MIN} min — o deploy não aconteceu. Pulando para a limpeza.`);
  } else {
    // --- o que sobrou ---
    await Promise.all(apiSends);
    await sleep(3000);
    st = await roomState(base, code, await tok(gm));
    const texts = new Set((st.chatMessages || []).map((m) => m.text));
    // A fase de cada mensagem é o último marco antes dela — em qualquer ordem: se o
    // Render derrubar a velha antes de a nova responder, a ordem dos marcos diz.
    const marks = [
      { t: newBootAt, name: "a nova subiu e restaurou do banco" },
      { t: swapAt, name: "o health vem da nova" },
      { t: firstDropAt, name: "o primeiro socket caiu" }
    ].filter((m) => m.t).sort((a, b) => a.t - b.t);
    const phase = (t) => {
      const i = marks.findLastIndex((m) => m.t <= t);
      return i < 0 ? "0. antes de tudo" : `${i + 1}. depois de: ${marks[i].name}`;
    };
    const groups = {};
    for (const s of sent) {
      const k = `${phase(s.t)} · ${s.via}`;
      groups[k] ??= { mantidas: 0, perdidas: [] };
      if (texts.has(s.label)) groups[k].mantidas++; else groups[k].perdidas.push(s.label);
    }
    log("------------------------------------------------------------------");
    log(`A linha do tempo (relativa à troca): a nova subiu ${rel(newBootAt, swapAt)}; o primeiro socket caiu ${rel(firstDropAt, swapAt)}`);
    for (const k of Object.keys(groups).sort()) {
      const g = groups[k];
      log(`  ${k}: ${g.mantidas} mantidas, ${g.perdidas.length} perdidas ${g.perdidas.length ? JSON.stringify(g.perdidas) : ""}`);
    }
    log(`  chat no fim: ${st.chatMessages.length} mensagens${st.chatMessages.length >= 100 ? " — ⚠ no teto de 100: as mais antigas saíram pelo teto, não pelo deploy" : ""}`);
    log(`  assentos: ${seatsOf(st, original)}`);
    log(`  NPCs ${Object.keys(st.npcs || {}).length} | iniciativa: ${(st.initiativeList || []).map((e) => `${e.handle}${e.isCurrentTurn ? "*" : ""}`).join(" ")}`);
    for (const p of people) {
      const s = await session(p);
      const tl = p.ws.map((w) => `[${rel(w.opened, swapAt)} → ${w.closed ? rel(w.closed, swapAt) : "aberto"}]`).join(" ");
      const bad = p.http.filter((h) => !/ 2\d\d$/.test(h));
      log(`  ${p.name}: peerId ${s.peerId === original[p.name] ? "o mesmo" : "NOVO"} | sockets ${tl} | SSE ${p.sse.length ? p.sse.map((t) => rel(t, swapAt)).join(",") : "nunca"}`);
      log(`        pedidos fora do 2xx: ${JSON.stringify(bad.slice(-6))} | console: ${p.console.length} | erros de página: ${p.pageErrors.length}`);
      log(`        a tela tem a última mensagem do servidor? ${p.seen.has(st.chatMessages.at(-1)?.text) ? "sim" : "NÃO"}`);
      if (p.console.length) log(`        ${JSON.stringify([...new Set(p.console)].slice(0, 4))}`);
    }
    if (LOCAL) {
      const ev = {};
      for (const inst of instances) for (const l of inst.logs) if (l.json?.event) ev[`${inst.port}:${l.json.event}`] = (ev[`${inst.port}:${l.json.event}`] || 0) + 1;
      log("  eventos das instâncias:", JSON.stringify(ev));
    }

    // =======================================================================
    // (B) A hibernação
    // =======================================================================
    const chatBeforeSleep = st.chatMessages.length;
    const lastBeforeSleep = st.chatMessages.at(-1)?.text;
    const saved = {};
    for (const p of people) {
      await remember(p);
      saved[p.name] = { session: { ...known[p.name] }, storage: await p.ctx.storageState() };
      await p.ctx.close();
    }
    log("------------------------------------------------------------------");
    log(`(B) todos fecharam a aba. ${IDLE_MIN} min sem nenhuma requisição — o serviço hiberna aos 15.`);
    if (LOCAL) {
      proxy.sleep();
      await instances[instances.length - 1].stop();
    }
    await sleep(IDLE_MIN * 60_000);

    const tw = Date.now();
    log("o despertar: o join abortado da Ana, o health, o GM pela tela e o Beto que recarrega");
    if (LOCAL) {
      (async () => {
        await sleep(8000);
        const next = await startServer({ port: 3291 + instances.length, persist: true });
        instances.push(next);
        proxy.setTarget(next.port);
        proxy.wake();
      })();
    }
    const reopen = async (name) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, storageState: saved[name].storage });
      await ctx.addInitScript(([id, t]) => {
        if (!sessionStorage.getItem("cyberpunk_peer_id")) {
          sessionStorage.setItem("cyberpunk_peer_id", id);
          sessionStorage.setItem("cyberpunk_session_token", t);
        }
      }, [saved[name].session.peerId, saved[name].session.token]);
      const page = await ctx.newPage();
      const p = { name, ctx, page, console: [], pageErrors: [], ws: [], http: [] };
      page.on("console", (m) => { if (m.type() === "error") p.console.push(m.text().slice(0, 200)); });
      page.on("pageerror", (e) => p.pageErrors.push(String(e).slice(0, 200)));
      page.on("response", (r) => { if (r.url().includes("/api/")) p.http.push(`${r.request().method()} ${new URL(r.url()).pathname} ${r.status()}`); });
      page.on("websocket", (ws) => { const rec = { opened: Date.now(), closed: null }; p.ws.push(rec); ws.on("close", () => (rec.closed = Date.now())); });
      return track(p);
    };

    // 1. A Ana: o join com o token dela, abortado em 4 s — a página recarregada no meio do despertar
    const anaSheet = (() => {
      const item = saved.Ana.storage.origins.flatMap((o) => o.localStorage).find((i) => i.name === "cyberpunk_active_sheet_v1");
      return item ? JSON.parse(item.value) : undefined;
    })();
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 4000);
    const probe = fetch(base + "/api/rooms/join", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Token": saved.Ana.session.token },
      body: JSON.stringify({ code, peerId: saved.Ana.session.peerId, handle: "Ana", sheet: anaSheet }),
      signal: ctl.signal
    }).then(async (r) => ({ status: r.status, ms: Date.now() - tw, body: await r.json().catch(() => null) }), () => ({ aborted: true, ms: Date.now() - tw }));
    await sleep(300);
    // 2. O health: quanto tempo o despertar leva
    const wakeHealth = health(150_000).then((h) => ({ ...h, at: Date.now() - tw }), (e) => ({ error: e.message, at: Date.now() - tw }));
    await sleep(300);
    // 3. O GM pela tela, com paciência
    const gm2 = await reopen("GM");
    const gmIn = (async () => {
      await gm2.page.goto(base + "/room/" + code, { timeout: 150_000 }).catch(() => {});
      const ok = await inRoom(gm2, 90_000);
      return { ok, ms: Date.now() - tw };
    })();
    // 4. O Beto abre o convite e recarrega aos 5 s, com a página ainda carregando
    const beto2 = await reopen("Beto");
    const betoIn = (async () => {
      beto2.page.goto(base + "/room/" + code, { timeout: 150_000 }).catch(() => {});
      await sleep(5000);
      await beto2.page.goto(base + "/room/" + code, { timeout: 150_000 }).catch((e) => log("Beto: a segunda carga falhou:", e.message.split("\n")[0]));
      const ok = await inRoom(beto2, 90_000);
      return { ok, ms: Date.now() - tw };
    })();

    const [pr, wh, gi, bi] = await Promise.all([probe, wakeHealth, gmIn, betoIn]);
    log(`  o join da Ana: ${pr.aborted ? `abortado aos ${pr.ms} ms, como a página que recarrega` : `respondeu ${pr.status} em ${pr.ms} ms (o despertar foi mais rápido que 4 s)`}`);
    log(`  o health: ${wh.error ? "falhou — " + wh.error : `respondeu aos ${wh.at} ms; uptime ${wh.uptime}s (${wh.uptime * 1000 < wh.at + 120_000 ? "processo novo: hibernou" : "o MESMO processo — não hibernou"})`}`);
    log(`  o GM pela tela: ${gi.ok ? "na mesa" : "NÃO entrou"} aos ${gi.ms} ms | o Beto (recarregou aos 5 s): ${bi.ok ? "na mesa" : "NÃO entrou"} aos ${bi.ms} ms`);

    const anaOld = await fetch(`${base}/api/rooms/${code}`, { headers: { "X-Session-Token": saved.Ana.session.token } });
    const probeArrived = anaOld.status === 401 || (!pr.aborted && pr.status === 200);
    log(`  o token antigo da Ana: ${anaOld.status} — ${anaOld.status === 401 ? "o join abortado CHEGOU ao servidor e trocou o token: o gatilho do H.04 disparou" : "o join abortado não chegou (ou não trocou o token)"}`);
    if (!pr.aborted && pr.status === 200 && pr.body?.sessionToken) {
      saved.Ana.session.token = pr.body.sessionToken;
      known.Ana = { ...saved.Ana.session };
    }
    // 5. A Ana volta pela própria aba (o sessionStorage de antes): mesmo assento?
    const ana2 = await reopen("Ana");
    await ana2.page.goto(base + "/room/" + code, { timeout: 120_000 }).catch(() => {});
    const anaIn = await inRoom(ana2, 60_000);
    const people2 = [gm2, ana2, beto2];
    st = await roomState(base, code, (await session(gm2)).token);
    log(`  a Ana pela aba de antes: ${anaIn ? "na mesa" : "NÃO entrou"}, peerId ${(await session(ana2)).peerId === original.Ana ? "o mesmo" : "NOVO"}${probeArrived ? " (o token dela tinha sido trocado pelo join abortado)" : ""}`);
    log(`  assentos: ${seatsOf(st, original)}`);
    log(`  o chat depois do despertar: ${st.chatMessages?.length} mensagens (antes de dormir, ${chatBeforeSleep}); a última de antes ${st.chatMessages?.some((m) => m.text === lastBeforeSleep) ? "está lá" : "SUMIU"}`);
    const gen = await api(base, `/api/rooms/${code}/npcs/generate`, (await session(gm2)).token);
    log(`  o GM segue GM? gerar NPC → ${gen.status}`);
    for (const p of people2) {
      const bad = p.http.filter((h) => !/ 2\d\d$/.test(h));
      log(`  ${p.name}: sockets ${p.ws.length} (${p.ws.filter((w) => !w.closed).length} aberto) | SSE ${p.sse.length ? "sim" : "não"} | fora do 2xx: ${JSON.stringify(bad.slice(-5))} | console ${p.console.length}`);
      if (p.console.length) log(`        ${JSON.stringify([...new Set(p.console)].slice(0, 3))}`);
    }
    people.splice(0, people.length, ...people2);
  }
} finally {
  // =========================================================================
  // (C) Todos saem — a sala some do banco
  // =========================================================================
  try {
    for (const p of people) await remember(p);
    const gmS = known.GM;
    const st = await roomState(base, code, gmS.token);
    // Assento que nenhuma sessão conhecida reclama (um "NOVO" do H.04 ou do H.11): o GM tira.
    const mine = new Set(Object.values(known).map((s) => s.peerId));
    for (const seat of Object.keys(st.players || {})) {
      if (!mine.has(seat)) await api(base, `/api/rooms/${code}/players/${seat}/delete`, gmS.token);
    }
    for (const name of [...Object.keys(known).filter((n) => n !== "GM"), "GM"]) {
      const r = await api(base, `/api/rooms/${code}/leave`, known[name].token);
      if (r.status !== 200) log(`(C) ${name} não saiu: ${r.status} ${JSON.stringify(r.body)}`);
    }
    const h = await health(60_000).catch(() => null);
    log(`(C) limpeza: todos saíram; o servidor tem ${h ? h.rooms.active : "?"} mesa(s) aberta(s).`);
  } catch (e) {
    log("(C) a limpeza falhou:", e.message, `— a sala ${code} pode ter ficado no banco`);
  }
  await browser.close();
  if (LOCAL) {
    proxy.close();
    for (const inst of instances) await inst.stop();
  }
}
