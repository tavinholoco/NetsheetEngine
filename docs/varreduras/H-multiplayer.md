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
- **Gatilho:** a memória da aba crescer numa sessão longa, ou alguém mexer no `onclose` — a H.1g (a queda
  para o SSE, E.14) mexe nele: a linha vai junto.

---

## H.1c — Refresh no meio do combate, do jogador e do GM

*Pergunta: quem dá F5 com a luta rolando volta ao mesmo lugar — assento, ferimento, vez na iniciativa?*

**Como:** a mesa da H.1a com um NPC, a iniciativa rolada e 25 de dano no torso da Ana e do Beto. A Ana entra
pelo **link do convite** (`/room/CÓDIGO`, o caminho da R.11); o Beto, pelo **lobby, digitando o código**; o
GM, pelo deep link. Cada um dá F5 (`page.reload()`). Roteiros `h1c.mjs`, `h1c-gm.mjs` e `h1c-f5duplo.mjs`.

| Quem dá F5 | Resultado |
|---|---|
| Ana (entrou pelo link) | ✅ volta sozinha à mesa, **mesmo `peerId`**, ferimento 9 na mesa e na ficha local, a mesma entrada na iniciativa; o chat não ganha mensagem nenhuma |
| GM (entrou pelo deep link) | ✅ volta como GM ("Poderes do GM" na tela) e passa o turno |
| **Beto (entrou pelo código)** | ❌ cai no **lobby, com o campo do código vazio**. Digitando de novo, entra com **outro `peerId`**: a mesa fica com **dois "Beto"**, e a iniciativa aponta para o velho — ver H.03 |
| **GM que criou a mesa pela tela** | ❌ **perde o GM** — ver H.03 |
| Ana, dois F5 seguidos com o `join` do primeiro em voo (400 ms de atraso) | ❌ em 1 de 3 rodadas, **assento duplicado** — ver H.04 |

**O gatilho da G.3h** (o `reconnectSession` com trava própria): não cruzou com o `joinRoom` aqui. Depois do
F5 a store começa vazia, e quem reentra é o `RoomPage`; a reconexão só roda num 401 com a mesa ativa.

### H.03 — Depois do F5, quem entrou pelo lobby volta como outra pessoa — e o GM perde a mesa

**Área:** H.1c

**Sintoma observado:** reproduzido. Quem entra pelo lobby — o jogador que digita o código, e **todo GM que
cria a mesa pela tela** — fica com a URL `/multiplayer`: nem o `createRoom` nem o `joinRoom` da tela mudam a
URL (`MultiplayerRoom.tsx:351–383`), e só o `RoomPage` (`/room/:código`) reidrata a sessão do
`sessionStorage` (`pages/RoomPage.tsx:37`). No F5, a página cai no lobby com o campo vazio. Entrando de novo
pelo código, o `getPeerId` olha só a store, que o F5 esvaziou, e **sorteia um `peerId` novo por cima do
antigo no `sessionStorage`** (`api/rooms.ts:35–44`); o `join` vai sem token e cria outro assento.
- **Jogador:** dois assentos com o mesmo nome; o velho fica com a vez na iniciativa e some para offline em
  60 s — o GM tem de remover (o botão da G.3c).
- **GM:** o GM novo é um **jogador comum** — "Gerar NPC" dá `403 gm_only`, e o `gmPeerId` da sala fica no
  assento velho, sem token que o reclame. Nem o link do convite devolve o GM depois disso: o `peerId`
  antigo já foi sobrescrito. **A mesa fica sem Mestre** e o único remédio é criar outra (perdem-se NPCs,
  iniciativa e chat). *O clique em "Criar" não foi feito — exige login, e o Supabase local estava fora do
  ar —; o estado que ele deixa (o `persistSession` grava o `peerId` e o token no `sessionStorage`, a URL
  fica `/multiplayer`) foi montado pelo roteiro a partir do código, e o F5 dali em diante é o real.*

**Onde:** `features/multiplayer/MultiplayerRoom.tsx:351–383` (a mesa fica ativa sem a URL da sala);
`pages/RoomPage.tsx:37`; `api/rooms.ts:35–44`.

**Quem sente hoje:** todo GM que cria mesa e recarrega a página — e o celular recarrega sozinho a aba que
ficou em segundo plano. Aparece na primeira sessão real.

**Se eu não fizer:** perde dado — a mesa inteira fica sem GM, no meio do jogo.

**Versão 10× menor:** quando a mesa fica ativa pelo lobby (criar ou entrar), trocar a URL por
`/room/CÓDIGO` (`navigate(…, { replace: true })`). O F5 cai no `RoomPage`, que já volta ao mesmo assento
com o token — o caminho que a Ana e o GM do deep link provaram acima. *A maior* (o `getPeerId` ler o
`sessionStorage`, e o lobby lembrar o código) só se a pequena não cobrir.

**Reversível:** sim.

**VEREDITO:** FAZER
- Teste que reproduz: `src/__tests__/room-refresh.test.tsx` — entrar e criar pelo lobby deixam a URL em
  `/room/CÓDIGO`; e o "F5" (stores zeradas, o app montado de novo na URL atual com o `sessionStorage`)
  manda o `join` com o **mesmo `peerId` e o token** (com o `stubRoomTransport`).

### H.04 — Dois F5 seguidos, com o `join` do primeiro em voo, duplicam o assento

**Área:** H.1c

**Sintoma observado:** reproduzido em 1 de 3 rodadas, pelo caminho que funciona (o link do convite): com
400 ms de atraso, o segundo F5 logo depois de o primeiro carregamento mandar o `join`. O primeiro `join`
chega ao servidor (o proxy entrega o que já saiu do navegador, como uma rede de verdade), **revoga o token**
e emite outro, que ninguém recebe; o segundo carregamento chega com o token revogado, cai no `seat_taken`
e o `postJoin` entra com `peerId` novo (`api/rooms.ts:101`). É o assento órfão do G.06, agora entre dois
carregamentos da página — a trava do `joinInFlight` vive em memória e morre no F5. Se for o GM, ele vira
jogador, como no H.03.

**Onde:** `api/rooms.ts:89–104` (`seat_taken` → `rotatePeerId`); `server/roomManager.ts:524–533` e `:668`
(o `join` aceito revoga o token anterior).

**Quem sente hoje:** ninguém ainda. A janela é o tempo de ida e volta do `join` — dezenas a centenas de ms.
*Exceto se* o Render entregar o `join` de quem já recarregou quando a instância acorda: aí a janela vira o
minuto do despertar, e o F5 de impaciência é o gesto natural. Isso só se vê no ar (H.1j).

**Se eu não fizer:** dá retrabalho (o GM remove o assento duplicado); perde o GM no pior caso.

**Versão 10× menor:** no servidor, o `join` aceitar como prova, por alguns segundos, o token que **outro
`join` do mesmo assento** acabou de substituir (não o que a saída ou a expulsão revogaram). Mexe na prova
de posse da R.1 — passa pelo portão.

**Reversível:** sim, mas é autorização.

**VEREDITO:** ADIAR
- **Gatilho:** um assento duplicado ou um GM perdido depois de F5 numa sessão real, ou a H.1j mostrar que o
  Render entrega o `join` de quem já recarregou durante o despertar.

---

## H.1e — O mesmo jogador em duas abas

*Pergunta do plano: o `join` com token revoga as sessões antigas (`roomManager.ts:668`) e não fecha o socket
da outra aba — o que ela vê?*

**Como:** a Ana entra pelo link do convite e **duplica a aba** — no navegador, "Duplicar" copia o
`sessionStorage` (o mesmo `peerId` e o mesmo token) e as duas abas dividem o `localStorage` (a mesma ficha
local). No Playwright, uma página nova no mesmo contexto com o `sessionStorage` copiado. Depois, mais duas
duplicatas, para o teto de 3 sockets por jogador (R.4, o fechamento 4409 da pista nova da H.0). Roteiro
`h1e.mjs`.

| Passo | Resultado |
|---|---|
| A aba 2 abre | reentra pelo `RoomPage` com o token e fica com o assento; o token da aba 1 deixa de valer. **O socket da aba 1 segue aberto** — e manda chat por ele: a mensagem chega à mesa |
| ~1 s depois | o primeiro pedido REST da aba 1 — a sincronia da ficha — volta **401**; a reconexão automática tenta o `join` com o token revogado, recebe **409 `seat_taken`** e entra com **`peerId` novo**: a mesa ganha uma **segunda "Ana"**, com uma cópia da ficha. Nada na tela da aba 1 diz que ela virou outra pessoa |
| Abas 3 e 4 | a mesma coisa em cadeia: cada aba nova toma o assento, a anterior vira jogador novo no primeiro REST. **O 4409 não dispara** — a rotação separa os `peerId`, e nenhum jogador chega a 3 sockets. As quatro abas seguem recebendo a mesa |
| Log do servidor | nada além do `server_started`; no console das abas que rodaram, o 401 e o 409 |

**Resposta à pergunta do plano:** a aba antiga vê tudo e age por um tempo com a sessão revogada (o socket
foi autenticado no *upgrade* e não é conferido de novo); no primeiro REST, vira outro jogador. *Para a J.1e*
("sessão revogada fecha o socket?"): fora da expulsão e da saída, que fecham (R.3), a única revogação é
essa — a do mesmo assento por um `join` mais novo. Quem segue agindo é a mesma pessoa, no mesmo navegador,
que tem o token novo na outra aba: não é escalada.

### H.05 — A aba antiga vira outro jogador, em silêncio

**Área:** H.1e

**Sintoma observado:** reproduzido: duplicar a aba da mesa deixa **dois assentos com o mesmo nome** em ~1 s
— a aba antiga, no primeiro 401, cai no `seat_taken` e o `postJoin` entra com `peerId` novo
(`api/rooms.ts:101`), dentro da reconexão automática (`:113–143`). O desenho da R.1 usa essa rotação para o
caso "a sessão se perdeu" (o servidor caiu antes de persistir); aqui a sessão não se perdeu, **outra aba a
pegou**, e o servidor responde igual nos dois casos.

**Onde:** `api/rooms.ts:89–104` e `:107–143`; `server/roomManager.ts:524–533`.

**Quem sente hoje:** ninguém ainda — exige duas abas com a mesma sessão (duplicar a aba; abrir o link numa
aba nova é outro jogador por desenho, R.11).

**Se eu não fizer:** dá retrabalho: o GM remove o assento duplicado; o jogador que seguir na aba antiga joga
com um personagem que não está na iniciativa.

**Versão 10× menor:** o servidor dizer a diferença — um `code` próprio para "o token foi substituído por
outro `join` deste assento" — e a reconexão, nesse caso, parar com um aviso ("esta mesa está aberta em
outra aba") em vez de entrar como jogador novo. Pede ao servidor lembrar os tokens substituídos por alguns
minutos — **o mesmo mecanismo do H.04**, que pede o contrário (aceitar o substituído por um instante).

**Reversível:** sim, mas mexe na prova de posse da R.1.

**VEREDITO:** ADIAR
- **Gatilho:** um assento duplicado por duas abas numa sessão real, ou o H.04 virar FAZER — os dois saem do
  mesmo mecanismo, e um conserto só serve aos dois.

---

## H.1f — O GM sai (T1.8)

*Pergunta do plano: existe janela de dois GMs ou de nenhum?* E a pista nova da H.0: o expulso recebe o
fechamento **4400**, que o cliente não lê.

**Como:** GM, Ana, Beto e Caio, os jogadores pelo link do convite. O GM remove o Caio; depois clica em
"Sair"; depois a GM nova (a Ana) **fecha a aba**; e numa segunda sala, o GM gera uma ficha, um jogador entra
e o GM sai logo em seguida. Roteiro `h1f.mjs`.

| Passo | Resultado |
|---|---|
| O GM remove o Caio | o Caio vê "O Mestre removeu você desta mesa" em **0,8 s** — pelo REST: o primeiro pedido dele volta 401, e o `join` da reconexão, `403 removed_by_gm` (R.3). Sem pedido REST, o heartbeat cai para o POST no máximo em 20 s e leva ao mesmo lugar |
| O GM clica em "Sair" | o cargo vai **na hora** para a Ana, a primeira online (`roomManager.ts:1635–1659`); só ela vê os poderes; o token do GM antigo dá 401 no mesmo passo. **Nunca há dois GMs**: o `gmPeerId` é um campo só, e a saída revoga a sessão antes de responder |
| A GM nova fecha a aba | offline aos **68 s**; o `gmPeerId` **continua no assento dela**; o Beto leva `403 gm_only`. A Ana volta pelo link do convite numa aba nova: é **jogadora nova** (outro `peerId`, dois assentos "Ana") e também leva 403. **A mesa fica sem GM** — ver H.06 |
| O GM gera uma ficha, a Dani entra, o GM sai | o cargo vai para a **ficha gerada** ("Blitz 'Talon'"), que nenhuma pessoa controla — ver H.07 |

**Resposta à pergunta do plano:** janela de **dois** GMs, não. Janela de **nenhum**, sim — e não é janela,
é permanente, por três portas: o F5 do GM que entrou pelo lobby (H.03), o GM que fecha a aba (H.06) e o
cargo herdado por uma ficha gerada (H.07). A quarta, sem ninguém online, deixa o `gmPeerId` vazio e devolve
o cargo a quem entrar com o *handle* do GM (`:596–599`) — é a variante do SEC-07 que segue ADIAR (R.1) e é
também a única volta de um GM que saiu sozinho.

### H.06 — O GM que fecha a aba deixa a mesa sem Mestre para sempre

**Área:** H.1f

**Sintoma observado:** reproduzido. A identidade na mesa — o `peerId` e o token — mora no
`sessionStorage`, que morre com a aba. O GM que fecha a aba e volta pelo link do convite (o jeito natural de
voltar) entra como jogador novo; o `gmPeerId` fica no assento antigo, que nada mais reclama: a sessão dele
nunca sai (a transferência do T1.8 só roda no "Sair"), e ficar offline não passa o cargo. *A restauração de
aba do navegador (Ctrl+Shift+T, "continuar de onde parou") devolve o `sessionStorage` — o caso é a aba
fechada e aberta de novo pelo link.*

**Onde:** `api/rooms.ts:35–68` (a sessão no `sessionStorage`); `server/roomManager.ts:1635–1659` (o cargo
só passa no `leaveRoom`).

**Quem sente hoje:** ninguém ainda; aparece no dia em que o GM fechar a aba no meio de uma sessão.

**Se eu não fizer:** perde dado — a mesa fica sem GM, e o remédio é criar outra (NPCs, iniciativa e chat
ficam para trás).

**Versão 10× menor:** guardar a credencial **do GM** também no `localStorage`, por código de sala, e o
`RoomPage` usá-la quando o `sessionStorage` estiver vazio — só o GM; o jogador continua "aba nova é outra
pessoa" (R.11). A maior é o assento por conta (a versão maior da R.1): o GM já está logado para criar a
mesa. *Trade-off da menor:* um GM com duas abas cai no H.05 — a antiga vira jogador.

**Reversível:** sim.

**VEREDITO:** ADIAR — *o item mais perto da linha nesta varredura; vai destacado na calibragem (H.2).*
- **Gatilho:** um GM perder a mesa por fechar a aba numa sessão real; ou o conserto do H.03 mostrar que a
  credencial do GM no `localStorage` cabe junto, sem o trade-off.

### H.07 — O cargo de GM pode ir para uma ficha gerada

**Área:** H.1f

**Sintoma observado:** reproduzido: o T1.8 passa o cargo ao primeiro assento **online**
(`roomManager.ts:1637`), e a ficha gerada pelo GM nasce online, com `lastActiveAt` do momento em que foi
gerada (`:860`). Se o GM gera fichas antes de os jogadores chegarem e sai em menos de ~60 s, o cargo vai
para a ficha — e a mesa fica sem GM.

**Onde:** `server/roomManager.ts:1636–1641`.

**Quem sente hoje:** ninguém — a janela é de um minuto depois de gerar.

**Se eu não fizer:** no caso raro, a mesa fica sem GM.

**Versão 10× menor:** uma linha — o T1.8 escolher só entre assentos com sessão (as pessoas); a ficha gerada
não tem.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** acontecer numa sessão real, ou alguém mexer no T1.8 (o H.06 mexe, se virar FAZER).

### H.08 — O cliente não lê o código de fechamento (4400/4409)

**Área:** H.1f *(a pista nova da H.0, do comentário em `server.ts:889–896`)*

**Sintoma observado:** nenhum que se veja. Medido: o expulso chega ao lobby com a mensagem certa pelo REST,
em 0,8 s (no pior caso, 20 s pelo heartbeat); o que o código não lido custa é uma tentativa de WebSocket a
mais, que volta 401. E o **4409** (socket substituído) **não acontece** com o desenho atual: cada aba nova
toma o assento e a antiga troca de `peerId` (H.1e), então ninguém chega a 3 sockets.

**Onde:** `features/multiplayer/MultiplayerRoom.tsx:267`.

**Quem sente hoje:** ninguém.

**VEREDITO:** DESCARTAR
- **Razão:** o re-join (401 → 403 `removed_by_gm`) já leva o expulso ao lobby com a mensagem, e o 4409 não
  ocorre; ler o código não mudaria o que a pessoa vê. *Se o H.05 virar FAZER* (a aba antiga parar em vez de
  trocar de `peerId`), o 4409 volta a ser possível e a pergunta reabre com ele.

---

## H.1g — A queda para o SSE

*Pergunta do plano: bloqueado o WebSocket, o que deixa de funcionar, o jogador fica sabendo, e o
`sse_fallback` aparece no log?* E a premissa do E.14: o cliente cai para o SSE numa queda de rede comum.

**Como:** dois proxies (`slowproxy.mjs` com `blockWs`, que derruba o pedido de *upgrade* como um proxy
corporativo): **(A)** o Beto atrás dele desde a entrada; **(B)** a Ana no WebSocket, que perde a conexão
numa queda de ~6 s (o socket derrubado e o *upgrade* bloqueado até a rede voltar). Roteiro `h1g.mjs`.

| Pergunta | (A) WebSocket bloqueado desde o início |
|---|---|
| Entra? | sim, em ~1 s, pelo SSE |
| Chat, rolagem, presença | funcionam — o chat chega a ele em 8 ms; o dele (POST) ao GM em 87 ms; o heartbeat pelo POST o mantém online |
| **O que deixa de funcionar** | **mover o próprio token**: sem o Yjs, o cliente manda o grid pelo REST (`MultiplayerRoom.tsx:426–432`), e essa rota é **só do GM** (`roomManager.ts:757–759`) — o arrasto volta "Acesso Negado! Apenas o Mestre da Mesa pode alterar o mapa tático." E o cursor do GM, que só existe no awareness |
| O jogador fica sabendo? | só pelo "Acesso Negado" quando tenta mover; nada diz que ele está no modo de reserva |
| `sse_fallback` no log? | sim, com o *user agent* |

| (B) Queda de ~6 s com o WebSocket funcionando | Resultado |
|---|---|
| Depois da queda | a tentativa de 3 s cai no bloqueio, e a Ana vai para o SSE — o E.14 **reproduzido** |
| 60 s depois, com a rede boa | **continua no SSE**: nenhuma tentativa de WebSocket a mais. Recebe o chat, mas **não move o próprio token** (`403 gm_only`) até recarregar a página |
| O log | um `sse_fallback` com o `peerId` dela — **uma queda de rede contada como proxy corporativo** |

*De carona, para a J.1e* ("o token na URL: onde a URL do *upgrade* aparece em log?"): no **console do
próprio navegador**, a falha do WebSocket imprime a URL inteira, com o `?token=`. É o navegador do dono da
sessão, não um log nosso — anotado para a J conferir os logs do Render.

### H.09 — Uma queda de rede breve deixa o jogador no SSE para sempre, sem mover o próprio token

**Área:** H.1g *(a premissa do E.14, reproduzida)*

**Sintoma observado:** reproduzido: o `wsEverOpen` é uma variável de cada rodada do efeito
(`MultiplayerRoom.tsx:227`). A queda depois de conectar agenda uma rodada nova em 3 s (`:275–281`), e nela o
`wsEverOpen` nasce `false`; se essa tentativa falha — a rede ainda fora, o servidor reiniciando —, o `:272`
abre o SSE, e do SSE não há volta. No SSE, o jogador **perde o arrasto do próprio token** (o REST do grid é
do GM) e o cursor do GM; e o servidor registra um `sse_fallback` que é queda de rede, não proxy — o dado com
que a L.6 vai decidir se o SSE fica.

**Onde:** `features/multiplayer/MultiplayerRoom.tsx:226–283`.

**Quem sente hoje:** todo jogador cuja rede pisca por mais de 3 s — Wi-Fi, celular — ou que estava na mesa
quando o servidor reiniciou devagar. Ninguém ainda numa sessão real, mas a primeira sessão em celular passa
por isso.

**Se eu não fizer:** dá retrabalho (o jogador tem de recarregar para mover o token — e, sem o H.03, o F5 de
quem entrou pelo lobby o duplica) e a L.6 decide com um número inflado.

**Versão 10× menor:** guardar o "já abriu uma vez" fora da rodada do efeito (um `useRef`): depois de uma
conexão que funcionou, a queda tenta o WebSocket de novo, com espera crescente, em vez de abrir o SSE; o SSE
fica para quem **nunca** conectou — o proxy corporativo, o caso que o `sse_fallback` quer contar. *A maior*
(o SSE tentar voltar ao WebSocket de tempos em tempos) só se a pequena não cobrir.

**Reversível:** sim.

**VEREDITO:** FAZER
- Teste que reproduz: `src/__tests__/room-transport.test.tsx` — com um WebSocket falso controlável (uma
  variação do `stubRoomTransport`): o socket abre, cai, a tentativa seguinte falha, e o cliente **tenta o
  WebSocket de novo** em vez de abrir o `EventSource`; e quem nunca conectou continua caindo no SSE.
