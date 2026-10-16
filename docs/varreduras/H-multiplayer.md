# Varredura H — multiplayer (WebSocket, SSE, Yjs, awareness, reconexão, presença)

**Data:** 14/10/2026 — os cenários locais, o H.1j no ar (combinado com o dono) e a H.3
**Timebox:** 2 dias
**Escopo:** o transporte da mesa, dos dois lados — no servidor, o WebSocket, o stream SSE, o doc Yjs e o
awareness (`server.ts`), as sessões e a reconexão (`server/roomManager.ts`, `server/wsLimits.ts`); no
cliente, o efeito de transporte e o heartbeat (`features/multiplayer/MultiplayerRoom.tsx`), a camada CRDT
(`lib/yjsConnection.ts`, `lib/gridDoc.ts`) e a sessão (`api/rooms.ts`, `pages/RoomPage.tsx`).
**Itens levantados:** 13 · **FAZER:** 3 · **ADIAR:** 9 · **DESCARTAR:** 1 *(12 na varredura local; o H.13
veio do H.1j, no ar)*
**Proporção FAZER:** 23% — abaixo de 1/3 (ver [H.2](#h2--calibragem)). Dois FAZER, e o H.02 que o conserto do
H.09 disparou, foram executados na [H.3](#h3--os-fazer-executados); o terceiro, o **H.13**, virou FAZER por
decisão do dono em 15/10/2026 e é a **H.3d** do plano — com o H.10 e o H.11, que mexem no mesmo arquivo.

**Como é feito.** A H não é teste automatizado: é **quebrar de propósito, cenário por cenário**, com o log
aberto. Cada cenário do plano (H.1a–H.1k) é uma seção, com o que se esperava, o que aconteceu e os eventos
do log. Onde: o **build de produção** (`npm run build`, o `dist/server.cjs` com `NODE_ENV=production`),
num processo por roteiro, que não gasta hora nem banda do Render — só o H.1j precisa do ar. As pessoas são
**contextos isolados do Playwright** (cada um com o próprio `localStorage`, como aparelhos diferentes); a
rede ruim vem de um **proxy TCP** entre o navegador e o servidor (atraso, banda, túnel, *upgrade* do
WebSocket derrubado) — o throttling do DevTools não garante o WebSocket; o GM sem login, de uma sala
criada por REST (o método do [`CLAUDE.md`](../../CLAUDE.md)). Nenhum código do repositório muda nesta etapa
(X.1). Os roteiros — `lib.mjs`, o `slowproxy.mjs` e um `h1*.mjs` por cenário — estão em
[`scripts/multiplayer/`](../../scripts/multiplayer/lib.mjs), versionados no PR do ledger para o H.1j e a H.3 os reusarem: são
ferramenta de varredura, fora do CI e do vitest, como o `scripts/visual/` da F.

**Numeração:** por cenário, na ordem em que os itens foram achados. As seções seguem a ordem em que os
cenários **rodaram** — o H.1d esperou o Docker subir o Supabase local, e veio depois do H.1h. **As linhas
citadas são as do `master` em `8203479`** (14/10/2026), o código varrido.

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
REST; os jogadores, pelo lobby com o código. Roteiro `h1a.mjs`.

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

**Como:** o Beto passa por um **proxy TCP** de rede ruim (`slowproxy.mjs`): 300 ms de
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

**VEREDITO:** ADIAR — ✅ **feito** na H.3c (14/10/2026), com o gatilho disparado.
- **Gatilho:** a memória da aba crescer numa sessão longa, ou alguém mexer no `onclose` — a H.1g (a queda
  para o SSE, E.14) mexe nele: a linha vai junto.
- **⚡ Gatilho disparado (14/10/2026, depois do merge do ledger):** o conserto do H.09 (H.3b) mexe no `onclose`.
  O item vira a **H.3c** do plano, com teste — como o protocolo manda com gatilho que dispara.

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

**VEREDITO:** FAZER — ✅ **feito** na H.3a (14/10/2026).
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
que a L.6 vai decidir se o SSE fica. **E o grid congela na tela dele** (medido no H.1h): a tela desenha
`yjsGrid || room.tacticalGrid` (`:659`), e o `yjsGrid` da última conexão nunca é limpo — o GM move o token e
só quem está no SSE não vê. Quem *nunca* teve WebSocket (o proxy corporativo) não sofre disso: o `yjsGrid`
dele é nulo e a tela segue o JSON.

**Onde:** `features/multiplayer/MultiplayerRoom.tsx:226–283` e `:659`.

**Quem sente hoje:** todo jogador cuja rede pisca por mais de 3 s — Wi-Fi, celular — ou que estava na mesa
quando o servidor reiniciou devagar. Ninguém ainda numa sessão real, mas a primeira sessão em celular passa
por isso.

**Se eu não fizer:** dá retrabalho (o jogador tem de recarregar para mover o token — e, sem o H.03, o F5 de
quem entrou pelo lobby o duplica) e a L.6 decide com um número inflado.

**Versão 10× menor:** guardar o "já abriu uma vez" fora da rodada do efeito (um `useRef`): depois de uma
conexão que funcionou, a queda tenta o WebSocket de novo, com espera crescente, em vez de abrir o SSE; o SSE
fica para quem **nunca** conectou — o proxy corporativo, o caso que o `sse_fallback` quer contar. Junto, uma
linha: zerar o `yjsGrid` quando o socket cai, para a tela voltar ao JSON enquanto não houver Yjs. *A maior*
(o SSE tentar voltar ao WebSocket de tempos em tempos) só se a pequena não cobrir.

**Reversível:** sim.

**VEREDITO:** FAZER — ✅ **feito** na H.3b (14/10/2026).
- Teste que reproduz: `src/__tests__/room-transport.test.tsx` — com um WebSocket falso controlável (uma
  variação do `stubRoomTransport`): o socket abre, cai, a tentativa seguinte falha, e o cliente **tenta o
  WebSocket de novo** em vez de abrir o `EventSource`; quem nunca conectou continua caindo no SSE; e, sem
  Yjs, o grid da tela é o da sala (um token movido pelo JSON aparece).

---

## H.1h — O último socket fecha e alguém reconecta no mesmo instante

*Pergunta do plano: o `destroyRoomYjs` (`server.ts:1302`) descarta o doc — a reconexão perde movimento do
grid?* É também o exemplo que a [ADR 0002](../adr/0002-yjs-websockets.md) dá para o seu gatilho.

**Como:** GM e Ana, cada um atrás de um proxy que derruba o socket na hora (`killWs`), com a aba do grid
aberta; a Ana arrasta o próprio token pela tela (o arrasto de verdade, que passa pelo Yjs). A posição que
cada tela desenha vem do `title` do token ("… - Setor C6"). Roteiro `h1h.mjs`.

| Corrida | Resultado |
|---|---|
| A Ana move; **os dois sockets caem juntos** (o último fecha → o doc é destruído) e voltam em 3 s | todos em **C6**, a mesma casa do servidor; **5 tokens** em cada tela, nenhum duplicado |
| A Ana move e tudo cai **com o update ainda no caminho** | o movimento que não chegou some da tela dela na volta: todos na casa do servidor. Coerente — o que a mesa não recebeu não aconteceu |
| O GM cai; a Ana move; o GM volta | todos em **G8** |
| *De carona:* a Ana no SSE depois de ter tido WebSocket; o GM move o token dela | o servidor e o GM em A1; **a tela da Ana continua em G8** — o grid congela. Anotado no **H.09**, que é o mesmo caminho |

**Por que não perde:** todo update do Yjs aceito é espelhado no JSON na mesma hora (`mirrorDocToJson`,
`server.ts:1050–1113`), e o JSON é a verdade durável (T5.1); o doc que nasce na volta é semeado dele
(`getRoomYjs`, `:953–967`). Do lado do cliente, cada conexão cria um `YjsGridConnection` novo, com um doc
vazio (`MultiplayerRoom.tsx:236–250`) — não há duas histórias do mesmo grid para o CRDT fundir, que seria
onde um token duplicaria.

**O gatilho da ADR 0002** ("um bug de convergência do grid"): **na minha leitura, não disparou.** O CRDT
convergiu nas três corridas, inclusive na que a ADR cita. O grid congelado do SSE é um bug de convergência
do grid na tela, mas nasce de o cliente guardar uma cópia velha do Yjs depois que o Yjs saiu — uma linha no
H.09 o resolve, e trocar o CRDT pelo protocolo de intenção não seria a versão menor. *Vai à calibragem
(H.2) como leitura a confirmar: reabrir uma ADR é decisão do dono.*

**Itens:** nenhum novo — o grid congelado foi para o H.09.

---

## H.1d — O servidor cai e volta com a mesa aberta

*Pergunta do plano: o restore, as sessões persistidas (B.4) e o fluxo 401 → `join` **com o token** que a
R.1 impôs.*

**Como:** o build de produção **com o Supabase local de verdade** (o Docker subiu com o contorno do
[`BACKUP.md`](../BACKUP.md), e o Supabase sem o Studio, que não ficava saudável). GM, Ana e Beto pelo link,
com NPC, iniciativa e ferimento; uma **rajada** de 10 s de chat (1 mensagem por segundo); e, na janela antes
da queda, dano no Beto, o Caio entrando e a Ana dando F5. Então o processo morre e sobe de novo na mesma
porta. *No Windows, matar o processo é a **queda brusca** — o `SIGTERM` não roda o `flushAllPending`*; o
desligamento educado do deploy é do H.1j. A data da última gravação vem do próprio banco. Roteiro `h1d.mjs`.

| Pergunta | Resultado |
|---|---|
| O restore | ✅ `persistence_restored` com a sala, as 3 sessões gravadas, o NPC e a iniciativa |
| Quem tinha o token gravado (GM, Beto) | ✅ volta sozinho: o token vale, o mesmo `peerId`, o GM segue GM (gera NPC). O socket reabre — a volta levou ~4 s, e as tentativas de 3 s pegaram o servidor de pé (nenhum `sse_fallback` no servidor novo). Num servidor mais lento, quem tem token válido cai no SSE — o **H.09** |
| **A rajada** | ❌ a última gravação no banco ficou **antes da rajada**: o *debounce* reinicia a cada mutação, e com uma por segundo ele nunca disparou. Na queda, foram-se **as 10 mensagens, o dano do Beto e a entrada do Caio** — 13 s de mesa, não 2 — ver H.10 |
| O dano do Beto (dado na janela) | perdido; a ficha local dele, que tinha recebido o ferimento, volta a 0 com a mesa (decisão 7a: vale a do servidor). O GM viu o dano no chat antes da queda e não vê depois |
| O Caio (entrou na janela) | o token não vale; no primeiro heartbeat (401), a reconexão entra de novo — **o mesmo `peerId`**, porque o assento dele nem estava na sala gravada ✅ |
| **A Ana (F5 na janela)** | ❌ a sala voltou com o assento dela e o token **de antes do F5**; o token novo não estava no banco. No primeiro 401, o `join` com o token novo cai no `seat_taken` e ela entra com **outro `peerId`**: duas "Ana", a velha offline com o ferimento — ver H.11 |
| O stream SSE com o token que não voltou | `401`, e o `EventSource` não tenta mais (é o padrão); quem resgata é o heartbeat pelo POST, em até 20 s |
| Presença | quem voltou aparece offline até o próximo heartbeat (≤ 20 s) — passageiro |

**O diagrama adiado da sequência do handshake** (decidir aqui, pela H.0): **segue ADIAR.** Não fez falta
para depurar a reconexão: o protocolo em prosa e os pedidos de rede de cada aba bastaram. O gatilho fica.

### H.10 — A sala só é gravada 2 s depois da última mutação — e nunca durante uma rajada

**Área:** H.1d

**Sintoma observado:** medido: o `queueRoomPersist` limpa o timer e agenda outro a cada mutação
(`roomPersistence.ts:46–56`), sem espera máxima. Com uma ação por segundo, a sala não foi gravada nenhuma vez
em 10 s; uma queda brusca no meio perde **a rajada inteira** — e uma rajada de combate (arrastos de token,
rolagens, chat) pode durar minutos.

**Onde:** `server/roomPersistence.ts:46–56`.

**Quem sente hoje:** ninguém — só a queda brusca perde: o deploy manda `SIGTERM`, e o `flushAllPending`
(`:155`) grava o pendente. Queda brusca é *crash* — um `unhandled_error` que derrube o processo, falta de
memória, a instância morta pela plataforma.

**Se eu não fizer:** perde dado, no dia de uma queda brusca com a mesa ativa.

**Versão 10× menor:** uma espera máxima — gravar pelo menos a cada N segundos mesmo com mutação contínua (o
`maxWait` de um *debounce* comum). Três linhas.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** uma queda que não seja deploy no log de uma sessão real (`unhandled_error`, o processo
  reiniciado no painel do Render), ou a L.1 mexer na persistência (o broadcast por diferença passa por aqui).
- **⚡ Gatilho disparado (15/10/2026):** a H.3d (o H.13) mexe na persistência antes da L.1 — o que o gatilho
  pedia era alguém mexer ali. As três linhas entram nela, com teste.

### H.11 — O token novo de um F5 recente não está no banco

**Área:** H.1d

**Sintoma observado:** reproduzido: o `join` aceito troca o token (`roomManager.ts:668–669`), e a rota só o
grava pelo mesmo *debounce* (o `broadcastRoomUpdate` da rota, `server.ts:554`). Quem deu F5 nos 2 s antes de uma queda — ou durante uma
rajada, pelo H.10 — volta com um token que o servidor restaurado não conhece, e o assento dele tem o token
antigo: `seat_taken`, e ele vira **outro jogador** (se for o GM, perde o cargo — o H.03 por outra porta).

**Onde:** `server.ts:518–563` (a rota do `join`); `server/roomPersistence.ts:46–56`.

**Quem sente hoje:** ninguém — exige um F5 e uma queda brusca na mesma janela.

**Se eu não fizer:** no caso raro, assento duplicado ou GM perdido.

**Versão 10× menor:** a rota do `join` gravar **na hora** (`persistRoomNow`) em vez de pelo *debounce* —
`join` é raro, e é ele que cria e troca a credencial. Uma linha.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** o mesmo do H.10 — e se o H.10 virar FAZER, este vai junto, no mesmo arquivo.
- **⚡ Gatilho disparado (15/10/2026), com o do H.10:** a linha entra na H.3d, com teste.

---

## H.1i — Ficha editada em duas abas

*Pergunta do plano: a reconexão resolve por last-write-wins com o `updatedAt` do cliente — o relógio do
navegador decide quem ganha?*

**Como:** (A) a Ana com o **relógio do navegador 2 h atrasado** (`page.clock`) entra, edita o apelido fora da
mesa, volta com F5 e leva dano do GM; (B) a Ana em duas abas do mesmo assento, a segunda renomeando a ficha.
Roteiro `h1i.mjs`.

| Caso | Resultado |
|---|---|
| (A) Relógio atrasado: editar e voltar | a edição **entra na mesa** ("Ana-v2"); o `updatedAt` gravado é o do relógio dela (11:57 com o real em 13:57) |
| (A) O GM fere a Ana | 9 pontos na mesa e na ficha local |
| (B) Duas abas, a segunda renomeia | o nome novo vai ao mesmo assento; a ficha local, que as duas abas dividem, fica com ele. A aba antiga só se separa no primeiro REST dela — o **H.05** |

**Por que o relógio não decide nada que importe:** a ficha de um assento tem **um escritor só** além do
servidor — o navegador daquele assento —, e o servidor só escreve o ferimento, que a reconexão nunca toma do
cliente (decisão 7a, `withServerWound`, `roomManager.ts:615`). O *last-write-wins* da reconexão
(`pickSheet`, `:555–561`) compara duas versões do mesmo navegador. E a sincronia da ficha (`POST /sheet`)
grava **sem comparar** `updatedAt` (`:673–707`) e roda logo depois de cada reentrada: o que a reconexão
escolher dura no máximo os 600 ms da sincronia. *O caso composto* — uma queda brusca que perca a última
sincronia (H.10) **e** o relógio atrasado — deixaria a mesa com a versão antiga até a próxima edição; não vale
item próprio, vai com o H.10.

**Os gatilhos:** o G.03 (trocar de ficha com a mesa aberta) não foi tocado — o caminho é outro. O diagrama
adiado de "reconexão e last-write-wins" ([`ARQUITETURA.md`](../ARQUITETURA.md#diagramas-adiados), gatilho:
bug de convergência de **ficha**) segue ADIAR: não houve bug.

**Itens:** nenhum.

---

## H.1k — A habilidade especial na mesa

*Pergunta do plano: não é rolável — o tipo `skill` procura em `sheet.skills`, e ela mora em
`specialAbilityName` (visto na C.8). Na ficha funciona.*

**Como:** a Ana (Solo, Combat Sense) na mesa; uma perícia de verdade posta na ficha dela pela sincronia, e
os pedidos de rolagem direto à API com a sessão dela — porque a tela não tem por onde. Roteiro `h1k.mjs`.

| Pergunta | Resultado |
|---|---|
| A barra de rolagem da mesa | **só ataque, dano, stun save e death save** (`MultiplayerRoom.tsx:408–411`). Nenhum botão de perícia: o tipo `skill` do servidor (`roomManager.ts:1177–1182`) e do `TableRollKind` (`types/multiplayer.ts:65`) **não tem chamador no cliente** — o padrão "construído de ponta a ponta e nunca ligado" do `CLAUDE.md` |
| Uma perícia pela API | `200`, "Rolagem: Awareness / Notice" — o caminho funciona |
| A habilidade especial pela API | `400 invalid_input`, "Perícia não encontrada na sua ficha." — a pista do plano, confirmada |
| *De carona:* a ficha **gerada** | guarda a habilidade especial como uma perícia (`isSpecialAbility: true`, `utils/npcGenerator.ts:137–144`) com o atributo escolhido **pelo ternário que a C.8 tirou da ficha** — Solo → REF, Netrunner → INT, o resto → EMP: o RUL-07 vivo em outro lugar. Sem leitor hoje: a mesa não rola perícia |

### H.12 — A mesa não rola perícia — nem a habilidade especial

**Área:** H.1k

**Sintoma observado:** nenhum na mesa — ninguém jogou ainda. Medido: não há botão de perícia na mesa, e o
tipo `skill` só existe no servidor. Pela API, a habilidade especial não rola, e a da ficha gerada rolaria
com o atributo errado em 7 dos 10 papéis.

**Onde:** `features/multiplayer/MultiplayerRoom.tsx:408–411` (a barra); `server/roomManager.ts:1177–1182`;
`utils/npcGenerator.ts:137–144`.

**Quem sente hoje:** ninguém. Na sessão, quem quiser rolar perícia rola na aba de dados da ficha — que não
vai para o chat da mesa.

**Se eu não fizer:** nada até alguém pedir.

**Versão 10× menor, quando pedirem:** uma lista das perícias da ficha (mais a habilidade especial) na barra
da mesa, mandando `{ type: "roll", kind: "skill" }`; e, no servidor, a habilidade especial pelo
`specialAbilityRoll` de `src/rules/roles.ts:51` — a regra da C.8 —, nunca pelo atributo que o gerador
gravou.

**Reversível:** sim.

**VEREDITO:** ADIAR — o plano já dizia "sem sintoma de mesa até alguém pedir".
- **Gatilho:** alguém da mesa pedir para rolar perícia ou a habilidade especial na mesa numa sessão real.
  Quando disparar, o atributo da ficha gerada vai junto (ou o gerador passa a gravar a habilidade como a
  ficha grava).

---

## H.1j — *(no ar)* O Render troca a instância com a mesa aberta

*Pergunta do plano: um merge no `master` no meio da sessão publica sozinho (30 s entre `SIGTERM` e
`SIGKILL`); e a volta depois de hibernar leva ~1 min.*

**Como:** rodado em **14/10/2026, 22:32–22:55 (BRT)**, combinado com o dono, contra
`netsheetengine.onrender.com`. O roteiro `h1j.mjs` (ensaiado antes no build local, com duas instâncias e o
Supabase local atrás de um proxy que faz o papel do Render) conferiu que o ar não tinha mesa nenhuma — o
serviço estava hibernando e acordou em 22 s —, montou a mesa de teste (GM pelo deep link, Ana e Beto pelo
convite; um NPC, a iniciativa e 25 de dano na Ana) e, no PRONTO, **o dono clicou em "Manual Deploy → Deploy
latest commit"**. Durante a troca, o GM falou pelo chat da **tela** (vai pelo WebSocket, à instância que tem
o socket) a cada 20 s, a cada 3 s depois da troca, e pela **API** (vai à instância que recebe o tráfego novo)
a cada 6 s; o `/api/health` a cada 5 s, só nessa janela, dizia qual processo respondia (o que subiu em
*agora − uptime*). Depois, todos fecharam a aba e a mesa ficou **18 min** sem nenhuma requisição. Custo: ~25
min de instância e poucos MB. *O log do Render não foi lido:* o painel estava em manutenção programada até as
23:00 — não se sabe se a instância velha recebeu o `SIGTERM` (e gravou pelo `flushAllPending`) ou foi morta.

**A troca de instância:**

| Pergunta | Resultado |
|---|---|
| Quanto demorou | a instância nova respondeu o health ~2,5 min depois do clique (o build do Docker) |
| As duas vivas ao mesmo tempo | **~20 s**, não os 60 s da [doc do Render](https://render.com/docs/deploys) que o E.06 citou: os três sockets caíram juntos 19,7 s depois de a nova subir (7,7 s depois de o health já vir dela) |
| O que se perdeu | **o que a velha recebeu depois de a nova restaurar do banco** — aqui uma mensagem (`d-8`), a única que caiu na janela (o chat da tela ia a cada 20 s antes da troca). O que foi pela API à nova ficou (9 de 9), o que foi antes de a nova subir também (7 de 7), e o que foi depois de a velha morrer (11 de 11). Com uma mesa jogando (uma ação a cada ~3 s), seriam ~7 ações perdidas — ver H.13 |
| A volta | os três reconectaram **em 3 s, à instância nova**, no mesmo assento (`peerId` igual), com o ferimento da Ana (9), o NPC e a iniciativa; nenhum pedido fora do 2xx, **0** erro de console |
| O H.09 no ar (a volta cai no SSE?) | **não** — a tentativa de 3 s já achou a nova de pé. Ninguém no SSE |
| O H.11 (alguém volta como outro jogador?) | não — ninguém deu F5 na janela, e os tokens de todos estavam no banco desde a entrada |

**A hibernação** (18 min parada; o health voltou com `uptime` de 15 s — processo novo):

| Pergunta | Resultado |
|---|---|
| O despertar | o health respondeu em **21,6 s**; o GM, pela tela, estava na mesa em **24,1 s**; o Beto, que recarregou a página aos 5 s (no meio do despertar), em **23,0 s**, no mesmo assento |
| **O H.04** — o Render entrega o `join` de quem já foi embora? | **não**: um `join` com o token da Ana, mandado no começo do despertar e **abortado aos 4 s** (o que o navegador faz com o F5), não chegou ao servidor — o token antigo dela seguiu valendo (`200`), e ela voltou pela aba de antes ao **mesmo** assento. *Uma tentativa só.* O gatilho do H.04 não disparou |
| O que voltou do banco | a mesa inteira, até a última mensagem antes de dormir: o banco tinha o estado da instância **nova** — o que a velha possa ter gravado no `SIGTERM` foi coberto pela gravação seguinte da nova |
| Console | 1 erro no GM e 2 no Beto, sem nenhum pedido da API fora do 2xx — o roteiro só os contava (agora os imprime) |

No fim, todos saíram pela API e o health voltou a mostrar **0** mesa no ar.

### H.13 — No deploy com mesa aberta, o que a instância velha recebe nos ~20 s depois de a nova subir se perde

**Área:** H.1j *(o E.06 da Fase E, medido no ar)*

**Sintoma observado:** medido, com o deploy provocado de propósito: a instância nova restaura a mesa do banco
ao subir e passa a receber o tráfego novo; a velha segue com os WebSockets por **~20 s** e tudo o que chega a
ela nesse tempo — chat, rolagem, token movido pelo socket — some quando os sockets reconectam na nova, que
nunca relê o banco. O que vai por REST (tudo do GM) já cai na nova e fica. Perdeu-se 1 mensagem.

**Onde:** `server.ts` (o restore só no boot) e o deploy do Render — o mesmo lugar do E.06.

**Quem sente hoje:** ninguém, enquanto vale a regra de processo — **nunca mergear com mesa aberta** (no
`CLAUDE.md` e no `DEPLOY.md`). O H.1j foi a exceção combinada.

**Se eu não fizer:** perde dado só se alguém publicar no meio de uma sessão — ~20 s de mesa, não os ~1,5 min
que o E.06 previa.

**Versão 10× menor:** é a regra de processo, que já existe. O conserto técnico (a nova esperar a velha morrer
e reler o banco, ou a velha recusar mutação depois do `SIGTERM`) segue grande.

**Reversível:** —

**VEREDITO:** FAZER — *por decisão do dono (15/10/2026, no PR #46), depois de ver o tamanho do conserto.* Na
primeira leitura (14/10) foi ADIAR: o gatilho do E.06 ("estado perdido depois de um deploy com mesa aberta — o
cenário da H.1j") disparou por desenho, a medição encolheu o dano de ~1,5 min para ~20 s, e quem sente seguia
sendo ninguém enquanto valesse "nunca mergear com mesa aberta". A regra de processo cobre o merge do dono; o
conserto tira a perda de qualquer troca de instância.
- **A versão escolhida — a passagem de bastão:** só uma instância manda na mesa por vez. A nova anota no banco
  que quer assumir e não abre a porta (o servidor só escuta depois do restore, e o Render só troca o tráfego
  com o health respondendo); a velha, que confere a anotação a cada 2 s, para de aceitar ações, fecha os
  sockets, grava tudo e marca que entregou; só então a nova lê o banco e escuta. Sem marca de vida da velha
  (morta, ou o serviço hibernava), a nova assume depois de alguns segundos. O preço: um "reconectando" de uns
  5–20 s a cada deploy, no lugar da perda em silêncio — a medir no ar.
- **Descartadas:** a nova reler o banco quando os jogadores voltam (troca a perda do WebSocket pela das ações do
  GM por REST); tirar o deploy sem interrupção (só com disco persistente, pago); o aviso pelo Realtime do
  Supabase (a chave anônima é pública: qualquer visitante mandaria a instância parar).
- **Teste que reproduz:** o ensaio `H1J_LOCAL=1 node scripts/multiplayer/h1j.mjs` — duas instâncias com o
  Supabase local, atrás de um proxy que faz o papel do Render — perde o que vai à velha depois de a nova subir
  (5 mensagens em 14/10); depois do conserto, 0. E os testes do módulo da passagem com um banco falso.
- **Onde:** a **H.3d** do plano, em dois PRs (a migration primeiro, decisão 5) e mais um H.1j no ar com o dono.

### H.3d.0 — As premissas no painel do Render (15/10/2026)

O log da aplicação de 14/10, lido com o dono logado (o painel estava em manutenção na noite do H.1j). Os
horários são os do Render, em Brasília; entre colchetes, a instância:

| Hora | Instância | O que o log diz |
|---|---|---|
| 22:32:06,5 | `lgv8m` (a velha) | `server_started` — o despertar do H.1j |
| 22:34:32 | Render | `Deploying...` — a imagem pronta (o clique do dono foi ~2 min antes: o build) |
| 22:34:47 | `lfm45` (a nova) | o processo começa |
| 22:34:48,412 | `lfm45` | `persistence_restored`: 1 sala, 3 sessões |
| 22:34:48,415 | `lfm45` | `server_started` — **a porta abre** |
| 22:34:53,469 | `lgv8m` | `server_shutdown`, `SIGTERM` — nenhuma linha depois, nenhum `persistence_save_failed` |
| 22:34:54 | Render | `Your service is live` |

1. **A velha recebeu o `SIGTERM`.** Chegou **5 s depois de a nova abrir a porta** — na troca do tráfego, não
   60 s depois dela, como a [doc](https://render.com/docs/deploys) descreve. O `flushAllPending` rodou sem erro
   no log; o que ele tivesse a gravar foi ao banco depois do restore da nova — a nova não leu, e a gravação
   seguinte dela cobriu. É o H.13 por dentro.
2. **Não há health check HTTP:** o campo *Health Check Path* das configurações do serviço está **vazio**. Sem
   ele, o Render testa se a **porta TCP** aceita conexão ([health checks](https://render.com/docs/health-checks))
   e só manda tráfego para a nova quando ela passa. O servidor só chama o `listen` depois do restore
   (`server.ts:1447`), então o efeito é o do desenho: **a nova não recebe ninguém enquanto não abre a porta**.
   O desenho fica, sem mudar nada no painel — e a regra que ele depende vira "nunca abrir a porta antes de ter
   o bastão". Com a porta fechada, o Render espera até 15 min antes de desistir do deploy.
3. **Da porta aberta à troca: ~5 s.** O processo novo levou 1,4 s do começo à porta (o restore, 0,1 s). Com o
   bastão, o "reconectando" previsto é a soma: a velha vê o pedido (≤ 2 s), entrega (~0,5 s), a nova lê o banco
   e abre a porta (~0,5 s), o Render troca (~5 s) — **~7–9 s**, a medir no H.3d.4.

**O que o log não explica:** no H.1j, os sockets dos três caíram ~20 s depois de o processo novo começar
(pelo relógio local, com o começo vindo do `uptime` do health) — ~13 s depois do `SIGTERM` da velha, que não
escreveu mais nada. O processo grava e sai em menos de 1 s; os 13 s parecem do caminho até o navegador (o
proxy do Render ou o Cloudflare segurando a conexão de quem já morreu). Com o bastão, não importa: a velha
fecha os sockets ela mesma, antes da troca — e o que um navegador mandasse por um socket morto nesses 13 s
também se perdia hoje.

---

## H.2 — Calibragem

**12 itens, 2 FAZER (17%).** Abaixo de 1/3 na primeira passada — a régua não precisou de ajuste. *Com o
H.13 do H.1j (14/10, depois do merge do ledger): 13 itens, 2 FAZER, **15%**; com a decisão do dono de 15/10
(o H.13 FAZER): **3 FAZER, 23%**.* Os dois
FAZER são reproduzidos, sentidos na mesa e sem versão mais barata que esperar:

| FAZER | O que quebra |
|---|---|
| H.03 — o F5 de quem entrou pelo lobby | o jogador volta como outra pessoa; **o GM que criou a mesa pela tela perde o cargo** — a mesa fica sem Mestre |
| H.09 — a queda breve que prende no SSE | o jogador para de mover o próprio token, o grid congela na tela dele, e o `sse_fallback` conta queda como proxy |

**Os que ficaram perto da linha** — vão ao dono destacados, porque o merge é que aprova o veredito:
- **H.06 (o GM que fecha a aba perde a mesa) — ADIAR.** O dano é o mesmo do H.03 (mesa sem Mestre), mas a
  porta é menos comum (fechar a aba e voltar pelo link, não o F5), e a versão menor tem um custo: a
  credencial do GM no `localStorage` faz um GM com duas abas cair no H.05. Se o dono preferir FAZER, a
  versão menor cabe no mesmo PR do H.03.
- **H.04 e H.05 (o assento duplicado) — ADIAR, juntos.** Saem do mesmo mecanismo no servidor (distinguir o
  token substituído por outro `join`); o H.1j pode disparar o gatilho do H.04.
- **H.13 (o deploy com mesa aberta perde ~20 s) — ADIAR na primeira leitura, FAZER por decisão do dono
  (15/10, no #46)**, *acrescentado depois do H.1j (14/10)*: o gatilho do E.06 disparou por desenho — o H.1j era o
  teste dele —, e a medição encolheu o dano (~20 s, não ~1,5 min). O dono viu o tamanho do conserto (~2 dias,
  dois PRs, mais um teste no ar) e decidiu fazer: é a H.3d. O H.1j também respondeu ao
  **H.04**: o Render não entregou o `join` abortado no despertar — o gatilho não disparou.
- **A ADR 0002 — o gatilho não disparou, na leitura desta varredura** (H.1h): o CRDT convergiu nas três
  corridas; o grid congelado é a cópia velha do Yjs na tela, e uma linha do H.09 o resolve. Reabrir a ADR é
  decisão do dono.

**Nenhum achado de segurança aberto.** O H.05 e o H.04 tocam a prova de posse da R.1, mas nenhum dá a
ninguém um assento ou um poder que não tinha — o que sobra é o dono do assento virando outra pessoa. A
J.1e herda duas respostas: a única revogação que não fecha o socket é a do mesmo assento por um `join` mais
novo (H.1e), e o token do *upgrade* aparece no console do próprio navegador (H.1g).

---

## H.3 — Os FAZER executados

*14/10/2026, na mesma sessão do H.1j.* Cada item com o teste escrito antes (visto falhando com o código antigo),
a prova revertendo e a conferência na tela pelo roteiro do cenário, contra o build de produção local.

| Item | O conserto | Teste | Na tela |
|---|---|---|---|
| **H.3a** — H.03 | O `RoomPage` é a página das duas rotas (`/multiplayer` e `/room/:código`): no lobby, a mesa que fica ativa leva a URL para `/room/CÓDIGO` (`replace`); e ele não repete o `join` de uma sessão viva no mesmo código | `room-refresh` (4): os 4 falham com o código antigo; sem só a guarda do `join`, os 4 falham de novo (o token trocava à toa) | `h1c.mjs`: o Beto, que entra pelo código, volta do F5 ao mesmo assento (3 assentos, sem duplicata). `h1c-gm.mjs`, agora com o caminho de verdade — login no Supabase local com um usuário descartável, "Criar Mesa como GM" e F5: o GM segue GM e gera NPC. O "Sair" em `/room/CÓDIGO` volta ao lobby com a URL da sala e o campo vazio — como o de quem entrou pelo convite desde a R.11; sem sintoma, fica |
| **H.3b** — H.09 | O "já conectou nesta mesa" num `useRef`: quem já conectou tenta o WebSocket de novo, com espera crescente (3, 6, 12… até 30 s; volta a 3 s quando conecta); o SSE fica para quem nunca conectou. Quando o socket cai, a tela volta ao grid da sala | `room-transport` (4), com um WebSocket que o teste abre, derruba e faz falhar (`controlRoomTransport`): 3 falham com o código antigo, e o do proxy (nunca conectou → SSE) passa nos dois; sem só o `setYjsGrid(null)`, o do grid falha | `h1g.mjs`: depois da queda de ~6 s, a Ana volta ao WebSocket e arrasta o próprio token pela tela; **um** `sse_fallback` no log — o do Beto, atrás do proxy. `h1h.mjs`: o grid da Ana segue a mesa em 4 s |
| **H.3c** — H.02 | O `onclose` destrói a conexão Yjs do socket que caiu antes de zerar o ref | `room-transport` +1: falha com 0 chamadas ao `destroy` | `h1b-tunel.mjs`: 4 `setInterval` vivos antes e depois do túnel de 90 s (eram 4 → 6) |
| **H.3d** — H.13, com o H.10 e o H.11 *(15/10)* | **A passagem de bastão** ([ADR 0007](../adr/0007-passagem-de-bastao.md)): a migration `0008` (a `instance_lease`, uma linha, só a service role — PR #47) e o `server/instanceLease.ts`. A nova pede o bastão e espera de porta fechada; a velha, que renova a marca de vida a cada 2 s, entrega — `503 server_restarting` nas rotas da mesa, WebSocket fechado com `1012`, stream SSE com `retry: 1500` (e 200 no pedido de stream: o `EventSource` desiste de um 503), grava tudo esperando o que estava em voo, congela a persistência — e só então marca. O cliente atravessa sozinho: o `apiFetch` tenta de novo a cada 1,5 s, e o WebSocket fechado com `1012` volta a cada 1,5 s. **H.10:** espera máxima de 10 s no *debounce*. **H.11:** o `join` grava na hora. As gravações de uma sala em fila | `instance-lease` (18), `room-persistence` (7), `server-handoff` (6), `api-restart` (3), `room-transport` +2 — cada parte vista falhando antes; e mutações, uma por propriedade (a nova que não espera, o erro de rede que vira troca, marcar antes de gravar, o SIGTERM que grava depois de entregar; as rotas, o *upgrade*, os sockets e a gravação da entrega) | `h1j.mjs` local: o código de antes perde **1** (a troca na porta aberta, a velha morre 5 s depois); com o bastão, **0** — e **0** na troca fiel ao Render (5 s depois da porta), com o WebSocket recusado três vezes, o chat pela tela e pela API recusado com 503 e repetido, e **6,1 s** de "reconectando". A hibernação do ensaio, igual (8,6 s) |

**O que a H.3 mudou no comportamento, além do sintoma:** com o WebSocket bloqueado *no meio* da sessão (um
proxy que passa a barrar o *upgrade*), quem já conectou não cai mais no SSE — tenta o WebSocket até 30 s em 30 s
e, enquanto isso, recebe a mesa só quando ele volta. É o que o H.09 escolheu ("o SSE fica para quem nunca
conectou"); a versão maior — o SSE tentando voltar ao WebSocket — segue sem sintoma.

**De carona, sem item novo:** numa das sete rodadas do `h1c-gm.mjs` (login no Supabase local), o console teve
quatro 401 e uma rejeição não tratada que o navegador mostra como `Object` — a forma do erro do Supabase. As
outras seis rodadas tiveram 0, e naquela os pedidos não estavam sendo anotados. A forma bate com o **G.11** (o
`fetchUserProfile` lança o erro do Supabase, e o menu o chama sem `catch` a cada troca de aba), mas não foi
atribuída nem reproduzida: o gatilho do G.11 ("uma rejeição sem tratamento no console numa sessão da H") fica
**anotado, não disparado** — o próximo que aparecer, com o pedido, decide.
