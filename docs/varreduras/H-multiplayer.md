# Varredura H — multiplayer (WebSocket, SSE, Yjs, awareness, reconexão, presença)

**Data:** 14/10/2026 (aberta)
**Timebox:** 2 dias
**Escopo:** o transporte da mesa, dos dois lados — no servidor, o WebSocket, o stream SSE, o doc Yjs e o
awareness (`server.ts`), as sessões e a reconexão (`server/roomManager.ts`, `server/wsLimits.ts`); no
cliente, o efeito de transporte e o heartbeat (`features/multiplayer/MultiplayerRoom.tsx`), a camada CRDT
(`lib/yjsConnection.ts`, `lib/gridDoc.ts`) e a sessão (`api/rooms.ts`, `pages/RoomPage.tsx`).
**Itens levantados:** __ · **FAZER:** __ · **ADIAR:** __ · **DESCARTAR:** __
**Proporção FAZER:** __%

**Como é feito.** A H não é teste automatizado: é **quebrar de propósito, cenário por cenário**, com o log
aberto. Cada cenário do plano (H.1a–H.1k) é uma seção, com o que se esperava, o que aconteceu e os eventos
do log. Onde: o **build de produção local** (`npm run build` e o `netsheet-prod`, porta 3100), que não
gasta hora nem banda do Render — só o H.1j precisa do ar. A rede estrangulada vem do DevTools ou do
`setOffline` do Playwright; o GM sem login, de uma sala criada por REST (o método do
[`CLAUDE.md`](../../CLAUDE.md)). Nenhum código do repositório muda nesta etapa (X.1); o que reproduz fora
dele fica no scratchpad.

**Numeração:** por cenário, na ordem em que os itens foram achados. **As linhas citadas são as do `master`
em `8203479`** (14/10/2026), o código varrido.

---

## H.0 — As pistas, medidas de novo em 14/10/2026

*Linha de base do dia:* `tsc` 0 erros, `vitest` **796** em 57 arquivos — os números do plano.

| Pista (plano) | Medido em 14/10 |
|---|---|
| ~~O SSE só confere o token na abertura~~ — resolvida para a expulsão na R.3; resta a pergunta para outras revogações | ✅ A expulsão e a saída fecham o WebSocket **e** o stream do jogador (`closePeerSockets`, `server.ts:326–350`, chamado em `:662` e `:786`). **As outras revogações não fecham nada:** o `revokeSessionsForPeer` (`roomManager.ts:94–99`) só apaga o token do mapa, e o `join` com token o chama em `:668` sem fechar o socket da aba que perdeu a sessão. O socket foi autenticado no *upgrade* e segue recebendo a sala. É o H.1e |
| Awareness órfão dura até 30 s, não para sempre; o servidor não remove o estado quando o socket fecha (`server.ts:1297`) | ✅ igual. `outdatedTimeout = 30000` (`y-protocols/awareness.js:13`), no servidor e em cada cliente; o `ws.on("close")` está em `server.ts:1297` e não chama `removeAwarenessStates`. O cliente publica o estado `null` ao **desmontar** (`yjsConnection.ts:162–168`), mas não quando o socket **cai**: o `onclose` (`MultiplayerRoom.tsx:267–283`) só zera o ref. *Visto de carona:* nessa queda o `YjsGridConnection` velho nunca recebe `destroy()`, e o `setInterval` de 25 s dele (`yjsConnection.ts:86–89`) fica vivo — um por queda. Vai ao H.1b/H.1c |
| O gatilho da [ADR 0002](../adr/0002-yjs-websockets.md) (bug de convergência do grid) é conferido aqui | ✅ o gatilho está no fim da ADR, como o plano diz. Conferido nos cenários que mexem no grid: H.1b (fora de ordem), H.1c (refresh), H.1h (o doc descartado) |
| O diagrama adiado da sequência do handshake — decidir no H.1d | ✅ segue ADIAR no [`ARQUITETURA.md`](../ARQUITETURA.md#diagramas-adiados) (`:354`), ao lado do de reconexão e *last-write-wins* (`:355`, gatilho: bug de convergência de **ficha**) — o H.1i decide esse |
| De preferência, com uma sessão real já registrada | ❌ **O [Registro de sessões](../PLANO_MESTRE.md#registro-de-sessões) segue vazio** — nenhuma sessão em produção até 14/10. A H corre sem esse insumo; os cenários fazem as vezes da mesa de verdade, e o que só gente de verdade mostraria fica dito no item |
| E.14 — o cliente cai para o SSE numa queda de rede comum (`wsEverOpen`, de `:171` para `:227`) | ✅ igual, na `:227`. O `wsEverOpen` nasce `false` a cada rodada do efeito; a queda depois de conectar agenda a rodada seguinte em 3 s (`:275–281`); se essa tentativa falha, o `:272` abre o SSE. **E do SSE não há volta:** nenhum caminho tenta o WebSocket de novo enquanto o efeito não rodar outra vez, e o `onerror` do `EventSource` não faz nada (`:220`). É o H.1g |
| E.06 — todo deploy roda duas instâncias por ≥60 s | ✅ é dado da [doc do Render](https://render.com/docs/deploys), não do código; a regra de processo (não mergear com mesa aberta) está no `CLAUDE.md`. O H.1j confere no ar |
| E.03 — socket que não lê é derrubado (1 MiB); um jogador lento de verdade **não** pode cair por isso | ✅ `maxBufferedBytes` = 1 MiB (`wsLimits.ts:32`), conferido a cada reenvio no WebSocket (`terminate`) e no SSE (`end`), com `slow_consumer_closed` no log. Uma sala de ~48 KB cabe ~20 reenvios no buffer. É o H.1b |
| G.01 — o console tem um erro do React a cada edição da ficha | ✅ igual: o `syncSheetStore(sheetResult)` segue no corpo do render (`App.tsx:69`). A H lê o console das três abas |
| G.02 — no dev, o deep link volta para `/` | ✅ igual (`App.tsx:94–115`). Por isso a H roda no build de produção |
| G.03 — trocar de ficha com a mesa aberta leva o ferimento para a ficha nova | ✅ igual: o efeito do ferimento em `MultiplayerRoom.tsx:74–90` e a sincronia da ficha em `:334–347` (eram `:75–88` e `:294–305`) |
| G.11 — o menu consulta o perfil a cada troca de aba, sem `catch` | ✅ igual (`CyberpunkMenu.tsx:130–161`, dependência `[user, activeTab]`). O `fetchUserProfile` **lança** no erro (`lib/supabase.ts:360`) e o `.then` não tem `catch`. Na H só dispara com login — o Supabase local é do Docker |
| G.3h — "Gerar NPC", "Gerar Jogador" e "Rolar iniciativa" sem a trava do clique duplo | ✅ igual: os três passam só pelo `roomAction`, sem o `run` do `useInFlight` (`MultiplayerRoom.tsx:453–459` e `:981`). É o H.1a |
| G.3h — o `reconnectSession` tem trava própria, separada da do `joinRoom` | ✅ igual: `reconnectInFlight` (`api/rooms.ts:107–143`) × `joinInFlight` (`:181–212`). É o H.1c e o H.1e |
| As linhas mudaram: o `MultiplayerRoom` tem 1.123 linhas | ✅ **1.123**. O `server.ts` tem **1.508** e o `roomManager`, **1.713** (eram 1.436 e 1.579 na E) |
| H.1e — o `join` com token revoga as sessões antigas (`roomManager.ts:668`) | ✅ a mesma linha |
| H.1h — o `destroyRoomYjs` quando o último socket fecha (`server.ts:1302`) | ✅ a mesma linha |
| H.1i — a reconexão resolve a ficha por *last-write-wins* com o `updatedAt` do cliente | ✅ `pickSheet` (`roomManager.ts:555–561`): o `updatedAt` vem da ficha que o navegador manda; empate fica com o cliente (`>=`) |
| H.1k — a habilidade especial não é rolável na mesa | ✅ igual: o tipo `skill` procura só em `sheet.skills` (`roomManager.ts:1177–1182`) |
| ***Pista nova, achada num comentário do código:*** os fechamentos 4400–4499 são permanentes, "mas o cliente ainda não olha o código: reconecta e cai no re-join (T3.3). Pista da Fase H." (`server.ts:889–896`) | ✅ o comentário bate com o cliente: o `onclose` (`MultiplayerRoom.tsx:267`) não lê `ev.code`. O **4409** (socket substituído — R.4, no máximo 3 por jogador) e o **4400** (saída e expulsão) caem no mesmo "reconecta em 3 s". O plano não tinha essa pista: vai ao H.1e (4409) e ao H.1f (4400) |
