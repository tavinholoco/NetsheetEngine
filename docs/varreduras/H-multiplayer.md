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

---

## H.1a — Mesa de base: GM + 2 jogadores, do zero ao combate

*Pergunta: o que acontece quando nada quebra?* É a régua dos outros cenários.

**Como:** o build de produção num processo próprio (porta 3201, sem persistência — o log JSON do
servidor capturado), e **três contextos isolados do Playwright** — GM, Ana e Beto, cada um com o próprio
`localStorage` e `sessionStorage`, como três aparelhos. Abas do mesmo navegador dividiriam a ficha local
(`cyberpunk_active_sheet_v1`) e falseariam o cenário. O GM entra pelo deep link com a sala semeada por
REST; os jogadores, pelo lobby com o código. Roteiro fora do repositório (`h1a.mjs`, no scratchpad da
sessão).

**O que se esperava e o que aconteceu** — tudo bateu:

| Passo | Resultado |
|---|---|
| Entrar | GM em ~0,4 s, cada jogador em ~0,9 s (com o `join` e o WebSocket). Os três veem "3 jogadores" |
| Chat da Ana | chega ao GM e ao Beto em **4–6 ms** |
| Death save do Beto | o resultado do servidor aparece nas outras duas abas |
| "Gerar NPC" (2×) e "Rolar iniciativa" pela tela do GM | 2 NPCs e 4 entradas na iniciativa, vistas pelos três; "Próximo Turno" passa a vez |
| O NPC ataca a Ana (o servidor rola) e o GM aplica 25 no torso do Beto | o chat narra o pipeline inteiro ("25 − SP 14 = 11 → BTM −2 = 9 → Crítico (9/40)") e os stun saves; o ferimento na mesa e **na ficha local** de cada jogador é o mesmo (decisão 7a) |
| Console das três abas | **0** erros e **0** avisos. *O G.01 não aparece no build de produção* (é aviso do React só no dev) — não esconde erro nenhum aqui |
| Log do servidor | só `server_started` e o `persistence_disabled` esperado sem banco; nenhum `warn` de transporte |

**Os números da régua** (por aba, contados nos quadros do WebSocket):

| Ação | O que cada aba recebe |
|---|---|
| Uma mensagem de chat | 1 quadro com a sala inteira — **6,7 KB** com 3 jogadores de ficha em branco e o chat curto |
| O ataque do NPC + o dano do GM | 6 quadros, **71,5 KB** — 4 reenvios da sala (~16 KB cada, já com 2 NPCs) e 2 updates do Yjs (o token muda de cor com o ferimento) |
| 45 s parada | 11 quadros, **0,5 KB** — o awareness dos outros dois e o do próprio servidor, que o `y-protocols` renova a cada ~15 s; cada aba manda 6 (o heartbeat de 20 s e o próprio awareness) |
| A sala no fim | **17,2 KB** |

**Os gatilhos levados pela G, conferidos aqui:**
- *"Gerar NPC" e "Rolar iniciativa" sem a trava* (G.3h): **não dobraram** — com o servidor local, a resposta
  volta em milissegundos e o clique comum não repete. O gatilho segue de pé para a mesa no ar (o Render
  acordando é o caso do G.06).
- *O erro do React no console* (G.01): não existe no build de produção. O gatilho não dispara pela H.
- *O menu consultando o perfil* (G.11): sem login, não consulta. Não dispara.

**Itens:** nenhum. Os sinais estranhos da primeira passada não eram defeito — 12 de dano não furam a ficha
em branco (SP 14 em todo local) e o chat diz isso; os "6 tokens para 3 assentos" são 2 coberturas, o NPC
padrão do grid e os 3 jogadores.

---

## H.1b — Rede estrangulada

*Pergunta: chat, rolagem, token movido e dano chegam, e na ordem? E o jogador lento cai pelo teto de
1 MiB do E.03?*

**Como:** o Beto passa por um **proxy TCP** de rede ruim (fora do repositório, `slowproxy.mjs`): 300 ms de
atraso em cada sentido, **50 KB/s** de descida e 25 KB/s de subida — o "3G lento" do DevTools —, e uma
janela de 128 KB que para de ler do servidor quando enche, para o `bufferedAmount` do `ws` crescer como
numa rede de verdade. O throttling do DevTools não serve: não garante o WebSocket. O site carrega rápido
(no ar ele vem comprimido e em cache) e o 3G começa na entrada da mesa. A sala tem o tamanho de uma mesa
de verdade: 3 pessoas, 4 fichas geradas e 4 NPCs — **35 KB**, 47 KB no fim. GM e Ana direto.

**O que aconteceu:**

| Pergunta | Resultado |
|---|---|
| Ordem | Seis mensagens da Ana entremeadas com dano e token movido pelo GM: o Beto vê `ord-1…ord-6` **na ordem**, e o token na mesma casa que o servidor (B7). Um socket TCP só não reordena; o reenvio da sala sai antes do update do Yjs que o causou (`mirrorDocToJson` chama o `broadcastRoomUpdate`, `server.ts:1111`), e a tela usa o grid do Yjs quando ele existe (`MultiplayerRoom.tsx:659`) — os dois caminhos não se atropelam |
| Atraso | A rajada de 12 ações custou **437 KB por aba**; o Beto viu a última **7,4 s** depois do GM. A rolagem dele chega ao GM em 0,9 s (subida curta, um quadro pequeno) |
| Carga normal (1 ação a cada 3 s, 45 s) | nada cortado; o caminho guardou até 192 KB |
| Rajada (2 ações/s, 20 s) | nada cortado; o Beto alcança **9 s** depois do fim |
| Túnel de 30 s (só a descida para) | nada cortado; alcança em 9,5 s |
| **Túnel de 90 s, os dois sentidos**, a mesa agindo a cada 2 s | o Beto aparece **offline aos 59 s** (o heartbeat de 60 s); o teto corta **aos 73 s** (`slow_consumer_closed`, 1.064.765 bytes). Na volta, o cliente reconecta sozinho em 3 s, recebe a sala atual e alcança em **4,4 s** — mais rápido que sem o corte, porque não baixa o atraso. Mesmo assento, de volta a online, 0 erro de console |

**Resposta à pergunta do E.03:** um jogador lento de verdade **não cai** pelo teto — só a queda longa de
rede, e aí cair é o certo: a volta é limpa. *Ressalva:* no loopback o kernel do Windows absorve parte do
buffer; num caminho de verdade o `bufferedAmount` cresce antes, e o corte viria mais cedo que 73 s. O
efeito do corte (reconectar e baixar a sala atual) é o mesmo.

### H.01 — Na rede lenta, o jogador fica segundos atrás: cada ação reenvia a sala inteira

**Área:** H.1b

**Sintoma observado:** medido, não sentido: com 50 KB/s e a sala de 35–47 KB, cada ação na mesa custa ~1 s
de descida para o jogador lento. Uma rajada de combate o deixa **7–9 s** atrás do resto da mesa — o chat,
o dano e o token chegam todos, na ordem, mas atrasados.

**Onde:** `server.ts:353–418` (`broadcastRoomUpdate` manda a sala inteira a cada conexão) — o **ARQ-01**.

**Quem sente hoje:** ninguém ainda — o Registro de sessões está vazio, e 50 KB/s é o pior caso (o 3G lento
do DevTools; 4G passa de 1 MB/s).

**Se eu não fizer:** fica lento para quem joga no celular em rede ruim.

**Versão 10× menor:** não há — o conserto é o broadcast por diferença, que já é a L.1. O que este item
acrescenta é o número para a L.0 decidir: o atraso cresce com o tamanho da sala, não com a distância.

**Reversível:** —

**VEREDITO:** ADIAR — dona: a **L.1**.
- **Gatilho:** um jogador da mesa jogar em rede móvel e o atraso aparecer numa sessão real (anotar no
  Registro de sessões), ou os gatilhos que a L.1 já tem (banda acima de 2,5 GB no mês, `ws_rate_limited`).

### H.02 — A conexão Yjs velha não é destruída quando o socket cai

**Área:** H.1b *(lido na H.0, medido aqui)*

**Sintoma observado:** medido: a cada queda do WebSocket a aba fica com **+2 `setInterval` vivos** (de 4 para
6 depois do túnel de 90 s, contados com um `setInterval` instrumentado). O `onclose` zera o
`yjsConnRef` sem chamar o `destroy()` (`MultiplayerRoom.tsx:267–271`), e o efeito, ao rodar de novo,
encontra o ref vazio e não destrói nada (`:286–289`). Ficam o intervalo de 25 s do `YjsGridConnection`
(`yjsConnection.ts:86–89`), o de 3 s do `Awareness` do `y-protocols` e o `Y.Doc` do grid. Nada chega à
tela: os retornos de chamada da conexão velha olham o `disposed` do efeito antigo, e o socket dela está
fechado.

**Onde:** `features/multiplayer/MultiplayerRoom.tsx:267–289`.

**Quem sente hoje:** ninguém — dois timers e um doc pequeno por queda.

**Se eu não fizer:** nada que se veja numa sessão; memória da aba cresce um pouco a cada queda.

**Versão 10× menor:** uma linha — `yjsConnRef.current?.destroy()` no `onclose` antes de zerar o ref.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** a memória da aba crescer numa sessão longa, ou alguém mexer no `onclose` — a pista dos
  códigos 4400/4409 (H.0, H.1e, H.1f) mexe: a linha vai junto.
