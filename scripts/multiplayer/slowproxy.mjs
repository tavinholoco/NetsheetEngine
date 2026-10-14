// Proxy TCP de rede ruim, para um jogador só. Fica entre o navegador e o
// servidor e vale para tudo que passa — HTTP, WebSocket e SSE (o throttling do
// DevTools não garante o WebSocket).
//   latencyMs  — atraso de cada sentido
//   downBps    — banda servidor → jogador (bytes/s)
//   upBps      — banda jogador → servidor
//   window     — quanto o "caminho" guarda antes de parar de ler do servidor:
//                é a contrapressão que faz o `bufferedAmount` do ws crescer,
//                como numa rede de verdade
//   stall(ms)  — o túnel: nada passa para o jogador durante `ms`
import net from "node:net";

export function startSlowProxy({ listenPort, targetPort, latencyMs = 300, downBps = 50_000, upBps = 25_000, window = 128 * 1024, drainOnClose = false }) {
  const prof = { latencyMs, downBps, upBps, blockWs: false };
  const wsConns = new Set();
  const conns = new Set();
  let stalledUntil = 0;
  const stats = { downBytes: 0, upBytes: 0, conns: 0, maxQueued: 0 };

  function lane(src, dst, isDown) {
    const queue = []; // { buf, readyAt }
    let queued = 0;
    let paused = false;
    src.on("data", (buf) => {
      queue.push({ buf, readyAt: Date.now() + prof.latencyMs });
      queued += buf.length;
      if (isDown) stats.maxQueued = Math.max(stats.maxQueued, queued);
      if (queued > window && !paused) { paused = true; src.pause(); }
    });
    let budget = 0;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const bps = isDown ? prof.downBps : prof.upBps;
      budget = Math.min(bps, budget + (bps * (now - last)) / 1000);
      last = now;
      if (isDown && now < stalledUntil) return;
      while (queue.length && queue[0].readyAt <= now && budget >= 1) {
        const head = queue[0];
        const n = Math.min(head.buf.length, Math.floor(budget));
        const piece = head.buf.subarray(0, n);
        if (!isDown && process.env.PROXY_DEBUG && piece.includes("POST /api/rooms/join")) console.log("  [proxy] join entregue ao servidor", dst.destroyed ? "(upstream já destruído)" : "", new Date().toISOString().slice(17, 23));
        if (!dst.destroyed) dst.write(piece);
        budget -= n;
        queued -= n;
        if (isDown) stats.downBytes += n; else stats.upBytes += n;
        if (n === head.buf.length) queue.shift();
        else head.buf = head.buf.subarray(n);
      }
      if (paused && queued < window / 2) { paused = false; src.resume(); }
    }, 10);
    const stop = () => clearInterval(timer);
    if (!drainOnClose) src.on("close", stop);
    dst.on("close", stop);
    return stop;
  }

  const server = net.createServer((client) => {
    stats.conns++;
    // blockWs: o proxy corporativo que derruba o upgrade do WebSocket
    client.once("data", (first) => {
      if (/upgrade:\s*websocket/i.test(first.toString("latin1"))) {
        if (prof.blockWs) { stats.wsBlocked = (stats.wsBlocked || 0) + 1; client.destroy(); return; }
        wsConns.add(client);
        client.once("close", () => wsConns.delete(client));
      }
    });
    const upstream = net.connect(targetPort, "127.0.0.1");
    conns.add(client);
    const stopUp = lane(client, upstream, false);
    const stopDown = lane(upstream, client, true);
    const end = () => {
      stopUp(); stopDown();
      client.destroy(); upstream.destroy();
      conns.delete(client);
    };
    // drainOnClose: o que já saiu do navegador chega ao servidor mesmo se a aba
    // fechar — numa rede de verdade, os pacotes em voo não voltam.
    const clientGone = () => (drainOnClose ? setTimeout(end, prof.latencyMs + 1500) : end());
    client.on("error", clientGone); upstream.on("error", end);
    client.on("close", clientGone); upstream.on("close", end);
  });
  server.listen(listenPort, "127.0.0.1");
  return {
    base: `http://127.0.0.1:${listenPort}`,
    stats,
    setProfile(p) { Object.assign(prof, p); },
    killWs() { for (const c of wsConns) c.destroy(); },
    stall(ms) { stalledUntil = Date.now() + ms; },
    async close() {
      for (const c of conns) c.destroy();
      await new Promise((r) => server.close(r));
    }
  };
}
