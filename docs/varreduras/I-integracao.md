# Varredura I — integração backend ↔ frontend (`src/api/*` contra as rotas do Express)

**Data:** 16/10/2026. **Fechada em 16/10/2026.**
**Timebox:** 1–2 dias (feita em um)
**Escopo:** a costura, dos dois lados. No cliente, `src/api/` (`http.ts`, `rooms.ts`, `gemini.ts`,
`base.ts`) e quem o chama (`features/multiplayer/MultiplayerRoom.tsx`, `pages/RoomPage.tsx`,
`features/ai/AiAssistant.tsx`); no servidor, as rotas e as mensagens do WebSocket do `server.ts`, a tabela
de `server/errors.ts` e as recusas do `server/roomManager.ts`. O resto de cada lado foi da E (backend), da
G (frontend) e da H (transporte).
**Itens levantados:** 9 · **FAZER:** 2 · **ADIAR:** 5 · **DESCARTAR:** 2
**Proporção FAZER:** 22% — abaixo de 1/3 depois de uma repassada (ver [I.2](#i2--calibragem)). De código, um
FAZER só: o achado de segurança, o **SEC-16** — consertado antes deste ledger, no
[#54](https://github.com/tavinholoco/NetsheetEngine/pull/54), como na E.

**Como é feito.** Leitura das duas pontas, rota por rota, e medição onde a leitura não basta: um roteiro
com o `supertest` contra o `app` (sem listener nem banco) para as recusas, um Chromium de verdade com a
página e a API em portas diferentes para o CORS (I.1e), e o painel do Render, com a sessão do dono no
navegador do app, para as horas e a banda de outubro. Os roteiros ficaram fora do repositório — são de
uma medição só. Nenhum código muda nesta etapa (I.1).

**As linhas citadas são as do `master` em `8dd74da`** (16/10/2026), o código varrido.

---

## I.0 — As pistas, medidas em 16/10/2026

*Linha de base do dia:* `tsc` 0 erros, `vitest` **842** em 63 arquivos — os números do plano. CI do
`master` verde (o merge do #52, 13:00 UTC) e o keepalive de 16/10 verde. Nenhum gatilho de ADIAR disparou
desde a H: o Registro de sessões segue vazio, e o próximo datado é o Ubuntu 26 dos runners, a partir de
19/10.

| Pista (plano) | Medido em 16/10 |
|---|---|
| O cliente já sabe ler `code` (`src/api/http.ts:20`); a I confere que decide por ele | ✅ `ApiError.code` em `http.ts:20`. O cliente decide por `code` em três lugares — `seat_taken` (`api/rooms.ts:101`), `removed_by_gm` (`:125`) e `server_restarting` (`http.ts:57` e, no socket, `MultiplayerRoom.tsx:215`) — e por **status** num, o 401 (`api/rooms.ts:160`). **Nunca pelo texto.** É a I.1b |
| O `apiFetch` trata corpo não-JSON e não tem timeout; a instância volta da hibernação em ~1 min | ✅ igual (`http.ts:54`; nenhum `AbortController`). O despertar **medido no ar** é menor: ~22 s (H.1j, 14/10) e 21,7 s (H.3d.4, 15/10); o painel do Render avisa "50 seconds or more". É a I.1d |
| O `RollResult` tem uma interface só; conferir se ainda há dois montadores com campos diferentes | ~~resolvida~~ desde a C: uma interface (`types/cyberpunk.ts:141`) e dois carimbos — o do cliente (`utils/diceEngine.ts:58`) e o do servidor (`server/roomManager.ts:1157`) —, os dois sobre o mesmo `RollCore` (`rules/rolls.ts:25`), acrescentando só `id`, `timestamp` e `characterName` |
| O `VITE_API_URL` só importa com o site fora do Render; a regra 4 não tem fase dona | ✅ igual (`api/base.ts:19`). E o número que decidiria a regra 4 não existe no painel — ver a I.1e |
| G.10 — a rede de amigos não mostra erro; o gatilho é a I.1b olhar o Supabase no cliente | ✅ as mesmas linhas (`FriendsList.tsx:74–85`, `:308–326`, `:329–345`). Olhado na I.1b |
| G.08 — a tela diz "sincronizado" quando não está | ✅ as mesmas linhas (`App.tsx:126`, `:143`, `:227`, `:380`; `SheetPage.tsx:87`, `:93`; `useCharacterSheet.ts:257`). Olhado na I.1b |
| O frontend no Vercel foi medido (H, 14/10); os quatro pontos que mudam são da I.1e | ✅ — e a I.1e achou um quinto: o I.09 |
| O `DEPLOY.md` se contradiz sobre o CORS | ✅ `DEPLOY.md:202–203` × `:218–222`. Vale o segundo (`server.ts:134–152`). Corrigido neste PR (I.05) |
| O `apiFetch` já repete o `503 server_restarting` a cada 1,5 s por até 45 s | ✅ `http.ts:36–37` e `:57–60`. É a I.1d |
| No ar, nenhum código de fechamento que o servidor manda chega ao navegador | ✅ é medida da H.3d.4. A I.1c traça o caminho da expulsão sem ele |
| *Fora das pistas, para a linha de base:* "Migrations em produção: `0001`–`0007`" | ❌ desatualizada: a `0008_instance_lease` está em produção desde 16/10 (H.3d.1). Corrigido neste PR |

---

## I.1a — Inventário de rotas

*Pergunta: se eu mudar este endpoint, o TypeScript me avisa no cliente — ou descubro em produção?*

**23 rotas REST e um WebSocket.** 20 rotas têm chamador no app; três não: `/settings` (I.01), o `GET` da
sala (I.04) e o `/api/health`, que é de operação de propósito (o `scripts/verify-prod.mjs`). As **21
funções** de `api/rooms.ts` têm, todas, um chamador na tela — conferidas uma a uma. *"Banner"* abaixo é o
texto do servidor na faixa de erro da mesa (o `roomAction`, `MultiplayerRoom.tsx:465–469`).

| Rota (`server.ts`) | Quem chama no cliente | Corpo → resposta | O que a tela faz no erro |
|---|---|---|---|
| `POST /api/rooms/create` (`:522`) | `createRoom` (`api/rooms.ts:188`) ← "Criar Mesa" | `{ code, name, gmHandle, gmPeerId }` → `{ room, sessionToken }` | banner (`MultiplayerRoom.tsx:415`) |
| `POST /api/rooms/join` (`:544`) | `postJoin` (`:89`), por `joinRoom` (`:205` — o lobby e o `RoomPage.tsx:60`) e por `reconnectSession` (`:113`) | `{ code, peerId, handle, sheet }` + `X-Session-Token` → `{ room, sessionToken }` | `seat_taken`: entra com outro `peerId`; `removed_by_gm`: volta ao lobby; o resto, banner |
| `GET /api/rooms/:code` (`:594`) | **ninguém no app** — os testes e os roteiros da H (`scripts/multiplayer/lib.mjs:161`) | sem token, o recorte público; com token, a sala | — |
| `POST …/sheet` (`:613`) | `syncSheet` (`:224`) ← a ficha mudou (`MultiplayerRoom.tsx:391`, 600 ms depois) | `{ sheet }` → `GameRoom` | **nada** (I.06) |
| `POST …/message` (`:757`) | `postMessage` (`:229`) — só sem WebSocket | `{ text }` → `GameRoom` | **nada** (I.06) |
| `POST …/roll` (`:769`) | `postRoll` (`:234`) — só sem WebSocket | `{ kind, skillName? }` → `{ room, roll }` | **nada** (I.06) |
| `POST …/heartbeat` (`:786`) | `postHeartbeat` (`:219`) — só sem WebSocket | `{}` → `{ success, isOnline }` | nada, de propósito: o 401 já reconectou no `authedFetch` |
| `POST …/leave` (`:809`) | `leaveRoom` (`:239`) ← "Sair" | `{}` → `{ success }` | nada, de propósito: a tela sai de qualquer jeito |
| `POST …/tactical-grid` (`:646`) | `updateTacticalGrid` (`:244`) — só sem Yjs | `{ gridState }` → `GameRoom` | banner |
| `POST …/npcs/generate` (`:660`) | `generateNpc` (`:249`) | `{ archetypeId? }` → `GameRoom` | banner |
| `POST …/players/generate` (`:675`) | `generatePlayers` (`:254`) | `{}` → `GameRoom` | banner |
| `POST …/players/:targetPeerId/delete` (`:685`) | `deletePlayer` (`:298`) ← "Remover" (G.07) | `{}` → `GameRoom` | banner |
| `POST …/npcs/:npcId/delete` (`:697`) | `deleteNpc` (`:293`) | `{}` → `GameRoom` | banner |
| `POST …/npcs/:npcId/health` (`:707`) | `setNpcHealth` (`:264`) ← o +1 do NPC (`MultiplayerRoom.tsx:973`) | `{ woundLevel }` → `GameRoom` | banner |
| `POST …/player-health` (`:632`) | `setPlayerHealth` (`:259`) ← o bio-monitor (`MultiplayerRoom.tsx:1118`) | `{ targetPeerId, woundLevel }` → `GameRoom` | banner |
| `POST …/damage` (`:723`) | `applyDamage` (`:272`) ← o cartão do token | `{ targetId, raw, location }` → `GameRoom` | banner |
| `POST …/attack` (`:734`) | `gmAttack` (`:280`) ← o cartão do token | `{ attackerId, targetId, range? ou difficulty? }` → `GameRoom` | banner |
| `POST …/stabilize` (`:744`) | `setStabilized` (`:288`) | `{ targetId, stabilized }` → `GameRoom` | banner |
| `POST …/initiative` (`:830`) | `setInitiativeList`, `nextTurn`, `rollInitiative` (`:303–315`) | `{ initiativeList }` ou `{ action: "next" \| "roll" }` → `GameRoom` | banner |
| `POST …/settings` (`:798`) | **ninguém** | `{ locationName?, combatModifier?, modifierReason? }` → `GameRoom` | — (I.01) |
| `GET …/stream` (`:852`) | o `EventSource` (`MultiplayerRoom.tsx:231`) — quem nunca conectou o WebSocket | `?token=` → a sala a cada mudança | o `EventSource` tenta de novo sozinho |
| `POST /api/gemini` (`:436`) | `askGemini` (`api/gemini.ts:24`) ← o Netrunner IA | `{ prompt }` + `Authorization: Bearer` → `{ text }` | o texto na conversa (`AiAssistant.tsx:54–62`) |
| `GET /api/health` (`:1351`) | ninguém no app — o `scripts/verify-prod.mjs` | — | — |
| WebSocket `/ws/rooms/:code` (`:937`) | `MultiplayerRoom.tsx:244` | manda `message`, `roll`, `heartbeat`; recebe a sala, `error`, `roll-error` | `server_restarting` fecha o socket (H.3d.5); o resto, banner (`:216`). O servidor aceita também `initiative` (`:1284`), que o cliente nunca manda (I.04) |

**A resposta à pergunta:** pela metade. A **resposta** divide os tipos — `GameRoom`, `RollResult` e a
ficha vêm de `src/types/`, que o servidor importa (`roomManager.ts:2–3`) —, mas o `apiFetch<T>` é um
*cast* (`http.ts:63`). O **corpo do pedido** não tem tipo nenhum: o cliente monta um objeto, o servidor
desestrutura o `req.body`. Renomear um campo no servidor não acende nada no TypeScript; aparece em
produção como `400 invalid_input` no banner — ou como nada, nos campos opcionais. Hoje as 21 chamadas batem
com o que o servidor lê, campo a campo. É o I.02.

### I.01 — O modificador do GM não tem tela: a rolagem o soma desde a C.4, e nada o escreve

**Área:** I.1a

**Sintoma observado:** reproduzível na leitura, sem mesa: a rota `/settings` (`server.ts:798–806`) recebe
`combatModifier` (−10 a +10), `modifierReason` e `locationName`, confere o GM e reenvia a sala — e
**nenhum código do cliente a chama**: `api/rooms.ts` não tem a função, e o `git log -S combatModifier`
não acha o campo em nenhum `.tsx` da história do repositório. A C.4 ligou a leitura: o servidor soma
`gmModifier(room.combatModifier, room.modifierReason)` ao ataque e à perícia do jogador
(`roomManager.ts:1160`) e ao ataque do NPC (`:1395`), e o detalhe da rolagem mostraria "Mod. do Mestre:
<motivo> (−2)". Mas o valor é sempre o `0` da criação da sala (`:379`), e zero não aparece. Pelo mesmo
motivo o cabeçalho da mesa diz "Night City - Afterlife Club" (`:378`) para sempre. **O `CLAUDE.md` diz
que o `combatModifier` foi "ligado na Fase C"** — foi pela metade; o I.05 corrige a frase.

**Onde:** `server.ts:798–806`; `server/roomManager.ts:1414–1436`; o painel do GM em
`features/multiplayer/MultiplayerRoom.tsx`, sem o campo.

**Quem sente hoje:** ninguém ainda — o Registro de sessões está vazio. Na primeira cena com modificador
(escuridão, fumaça), o GM.

**Se eu não fizer:** dá retrabalho. O GM soma de cabeça na rolagem do jogador (o total aparece no chat) e,
no ataque do NPC, troca a faixa de alcance pela dificuldade livre do cartão (`CombatPanel.tsx:58–60`),
com o modificador já descontado. Nada se perde.

**Versão 10× menor:** um campo numérico e um de motivo no painel do GM, chamando a rota que existe — a
validação, o teto de ±10, o reenvio e o detalhe da rolagem já estão prontos. Uma função em
`api/rooms.ts` e o teste de tela.

**Reversível:** sim.

**VEREDITO:** ADIAR — **perto da linha** ([I.2](#i2--calibragem)).
- **Gatilho:** a primeira sessão em que o GM quiser um modificador de cena (anotar no Registro de
  sessões), ou a **K** abrir — ela mexe nas rolagens, e o campo entra junto.

### I.02 — O contrato de cada rota é escrito à mão dos dois lados

**Área:** I.1a

**Sintoma observado:** nenhum — **as 21 chamadas batem** com o que o servidor lê (a tabela acima). Lido:
os testes não fecham o vão. Os do cliente respondem com um `fetch` falso (`rooms-client.test.ts`); os do
servidor mandam corpos escritos à mão (`server-api.integration.test.ts`, `error-codes.integration.test.ts`).
Nenhum teste passa uma chamada do `api/rooms.ts` pelo servidor de verdade.

**Onde:** `src/api/http.ts:39–65`; `src/api/rooms.ts:151–315`; as rotas em `server.ts:522–849`.

**Quem sente hoje:** ninguém — você, no dia de mudar uma rota.

**Se eu não fizer:** dá retrabalho, e só quando o contrato mudar.

**Versão 10× menor:** um `src/types/api.ts` com o corpo e a resposta de cada rota, importado pelo
`api/rooms.ts` e pelas rotas. Sem biblioteca de validação nem de RPC.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** a **L.1** abrir — o broadcast por diferença muda o contrato de várias rotas e do socket de
  uma vez, e é quando o módulo de tipos se paga —, ou uma rota mudar de corpo e o cliente quebrar sem teste
  que pegue.

### I.03 — 🔒 SEC-16: o `peerId` de um convidado desviava o "Remover" do GM

**Área:** I.1a

**Sintoma observado:** reproduzido em 16/10/2026, com o `supertest` contra o `app` e o caminho resolvido pelo
mesmo parser de URL do `fetch`. O `peerId` é escolhido por quem entra (`POST /join`, e o `gmPeerId` do
`create`), e o servidor só tirava dele controle e espaço (`sanitizeText`, `roomManager.ts:155`). O cliente o
punha cru no caminho do "Remover" (`api/rooms.ts:298–300`, `/players/${targetPeerId}/delete`), e o `fetch`
normaliza o caminho antes de mandar:
- `peer_h/x` → o "Remover" vai a `/players/peer_h/x/delete` → **404**: o GM não tira o convidado da mesa;
- `a/../../players/peer_vitima/delete?` → o clique em "Remover" ao lado do hostil (o `confirm` mostra o nome
  dele) vai a `/players/peer_vitima/delete?/delete`, com o token do GM → **sai a vítima**, e o hostil fica;
- `a/../../npcs/generate?` → o mesmo clique **gera um NPC** — qualquer ação de GM da sala sem corpo
  obrigatório.

**Onde:** `src/api/rooms.ts:298–300`; `server.ts:544–551` (o `join`) e `:522–524` (o `create`);
`server/roomManager.ts:155`.

**Quem sente hoje:** ninguém — a produção não tem mesa. Mas é o modelo de ameaça da decisão 3: o convidado
hostil, com um script (a tela não deixa escolher o `peerId`).

**Se eu não fizer:** a moderação do GM sequestrada — e quem sai não volta pelo mesmo `peerId` (R.3).

**Versão 10× menor:** é a feita — o formato do `peerId` no servidor e o `encodeURIComponent` no cliente.

**Reversível:** sim. A entrada fica mais estreita, e nada do que o app gera fica de fora.

**VEREDITO:** FAZER — ✅ **feito antes deste ledger**, num PR de segurança próprio
([#54](https://github.com/tavinholoco/NetsheetEngine/pull/54)), por decisão do dono (16/10/2026), como na E.
- Testes que reproduzem, escritos antes: `src/__tests__/peer-id.integration.test.ts` (22) e
  `src/__tests__/api-paths.test.ts` (4). O texto inteiro, a prova revertendo e o portão estão no
  [`SEGURANCA.md`](../SEGURANCA.md#fase-i--varredura-integração).

### I.04 — Duas portas do servidor sem chamador

**Área:** I.1a

**Sintoma observado:** nenhum. Lido:
- o `GET /api/rooms/:code` **sem token** devolve o recorte público (`server.ts:600–603`,
  `roomManager.ts:1706`), "o mesmo que o lobby já expõe" — diz o comentário (`server.ts:591`). O lobby
  deixou de expor salas na R.11, e nada no app pede o recorte; com token, a rota só tem leitor nos testes e
  nos roteiros da H;
- a mensagem `initiative` do WebSocket (`server.ts:1284–1296`) não tem remetente: o cliente passa a vez,
  rola e edita a iniciativa pelo REST (`api/rooms.ts:303–315`). É também a única do socket que, recusada,
  não responde nada a quem pediu.

**Onde:** acima.

**Quem sente hoje:** ninguém.

**Se eu não fizer:** nada. O recorte público é a leitura "esta sala existe?" do **E.21**, que já tem
gatilho.

**Versão 10× menor:** apagar os dois ramos — o `GET` sem token passaria a responder 401.

**Reversível:** sim, mas é contrato de API.

**VEREDITO:** ADIAR
- **Gatilho:** o recorte, com o do E.21 (a J.1b achar outra leitura que responda existência, ou a mesa abrir
  para gente de fora) — e a versão menor do E.21 ganha esta, mais barata que um limitador; a mensagem
  `initiative`, a **L.1**, que reescreve o protocolo do socket.

### I.05 — Três documentos da costura dizem o que o código não faz

**Área:** I.1a e I.1e

**Sintoma observado:** medido contra o código:
- **`PROTOCOLO_MULTIPLAYER.md`:** estabilizar fora de Mortal responde **409 `invalid_state`**
  (`roomManager.ts:1602`, travado no `error-codes.integration.test.ts`), e a tabela da §3.2 diz 400
  (`:127`). A lista da §5 (`:244–246`) ainda dá o ataque como "1d10 + REF + WA" (desde a C.3 soma a perícia
  e o modificador do GM — a §6.1, logo abaixo, está certa), o death save sem o nível Mortal, e esquece o
  `stun`;
- **`DEPLOY.md`** (a pista da H): a seção do frontend estático diz que o servidor responde CORS a
  "qualquer origin" (`:202–203`) e, quinze linhas abaixo, que não responde por padrão (`:218–222`). Vale o
  segundo (`server.ts:134–152`). E nenhum dos dois avisa o que o I.09 mediu: os cabeçalhos que o cliente
  manda não passam;
- **`CLAUDE.md`:** "O `combatModifier` e o `currentStats` foram ligados na Fase C" — o `combatModifier`,
  só a leitura (I.01).

**Onde:** acima.

**Quem sente hoje:** quem lê — e a sessão fria lê o `CLAUDE.md` primeiro.

**Se eu não fizer:** dá retrabalho; o `DEPLOY.md` leva o dono a um frontend que perde o F5 (I.09).

**Versão 10× menor:** é ela — só texto.

**Reversível:** sim.

**VEREDITO:** FAZER *(documento — neste PR)*.
- De carona, três **comentários de código** envelhecidos ficam para o próximo PR que tocar o `server.ts`
  (este é só de documento): `:264–267` ("o passo mínimo na direção dos códigos de erro estáveis que a Fase
  I vai propor" — a E.3c os fez), `:591` (o lobby) e `:926–928` ("o cliente ainda não olha o código" —
  desde a H.3d ele lê o `1012`; o 4400 e o 4409 seguem sem leitura, H.08).

---

## I.1b — Erros

*Pergunta: todo estado de erro do servidor tem estado de UI? O cliente decide por `code` ou por texto?*

**Como o cliente decide** (medido):

| Onde | Decide por | O que a tela faz |
|---|---|---|
| `postJoin` (`api/rooms.ts:101`) | `code` `seat_taken` | entra com outro `peerId`, uma vez |
| `reconnectSession` (`:125`) | `code` `removed_by_gm` | volta ao lobby: "O Mestre removeu você desta mesa." |
| `apiFetch` (`http.ts:57`) | `503` com `code` `server_restarting` | repete a cada 1,5 s, por até 45 s |
| o quadro do socket (`MultiplayerRoom.tsx:215`) | `code` `server_restarting` | fecha o próprio socket e passa ao REST (H.3d.5) |
| `authedFetch` (`api/rooms.ts:160`) | **status** 401 | reconecta e repete a ação uma vez |
| o resto | — | o `error` do servidor no banner, ou na conversa da IA |

**Nunca pelo texto** — nenhuma comparação de mensagem no cliente. O 401 por status é seguro: os dois
`code` de 401 vivem em rotas separadas (`session_invalid` em `/api/rooms`, `login_required` só no
`/api/gemini`), e o `authedFetch` só chama as da mesa.

**Todo estado de erro tem UI?** Os **26** `code` da tabela (`server/errors.ts:17–70`) chegam à tela pelo
texto em português do servidor, com uma exceção — três caminhos que engolem o erro, o I.06 — e dois
silêncios de propósito (o heartbeat e a saída). Os textos estão em português desde a E.3c.

**A RFC 9457.** Nenhum sintoma que o `code` não resolva: o cliente decide pelos `code` que importam e
mostra o texto do resto. O E.01 escolheu a versão 10× menor, e esta área não achou caso contra. Sem item.

**O Supabase no cliente (os gatilhos do G.08 e do G.10).** O `src/lib/supabase.ts` (895 linhas) tem 20
pontos `throw error` que lançam o erro do Supabase como veio — um objeto que não é `Error`, o "`Object`"
que a H viu no console —, e quem chama decide. Os caminhos da G seguem nas mesmas linhas (I.0). O gatilho
do G.10 era esta olhada, e ela não muda o veredito: o Supabase no cliente não passa pelo `server.ts` — não é
a costura desta fase —, a rede de amigos segue fora do caminho da mesa, e a produção não tem usuário (o
backup de 16/10: 0 em `auth.users`, `profiles` e `character_sheets`). **G.10 segue ADIAR**, com o gatilho
que sobra: alguém da mesa usar a rede de amigos e relatar. **G.08 segue ADIAR**, com o dele: a primeira
ficha na nuvem.

### I.06 — Pelo REST, a rolagem e o chat perdem o erro que o WebSocket mostra; e a ficha que não sincroniza não avisa

**Área:** I.1b

**Sintoma observado:** nenhum em uso. Lido: no WebSocket, a recusa volta ao autor como `error` ou
`roll-error` e vira banner (`MultiplayerRoom.tsx:212–217`); pelo REST, o mesmo erro cai num `catch` vazio —
o chat (`:441–445`, com o campo **já apagado** em `:437`) e a rolagem (`:454`). A sincronia da ficha
(`:391`) engole tudo: com `sheet_too_large` (64 KB), `rate_limited` ou a rede fora, a mesa fica com a ficha
velha e a tela não diz nada. Quem está no REST: quem nunca conectou o WebSocket (o proxy que o bloqueia —
o SSE) e, por segundos, quem está entre um socket e outro.

**Onde:** `features/multiplayer/MultiplayerRoom.tsx:391`, `:441–445` e `:454`.

**Quem sente hoje:** ninguém. O `sse_fallback` nunca apareceu numa sessão real (o Registro está vazio); a
ficha gerada tem ~2,7 KB (E.03), longe dos 64 KB; e nenhuma arma da tela tem fórmula quebrada (G.09: o
arsenal padrão não tem campo livre).

**Se eu não fizer:** para quem está no SSE, uma mensagem ou uma rolagem somem sem aviso; uma ficha gigante
fica velha na mesa.

**Versão 10× menor:** o `catch` dos três passar o texto ao banner, como o `roomAction` faz — três linhas.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** um `sse_fallback` de jogador de verdade no Registro de sessões, ou a **K.2** (o inventário
  engorda a ficha — medir a ficha cheia contra os 64 KB).

---

## I.1c — Sessão: o 401 no meio da mesa

*Pergunta: o que o usuário vê quando o token expira ou é revogado no meio da sessão?*

**Medido no código:** a sessão de mesa **não expira** — o `Session` não tem prazo (`roomManager.ts:56–59`);
vive até ser revogada e, desde a B.4, sobrevive ao restart (o banco guarda o hash). Então o 401 no meio da
mesa só nasce de uma revogação. As quatro portas, e o que a tela mostra em cada uma:

| Quem revoga | Onde | O que a tela mostra |
|---|---|---|
| A própria pessoa, ao sair | `leaveRoom` (`roomManager.ts:1674`) e `closePeerSockets` (`server.ts:809–816`) | nada — foi ela quem pediu |
| O GM, ao remover (R.3) | `deleteGeneratedPlayer` (`roomManager.ts:996–997`) e `closePeerSockets` (`server.ts:692`) | o próximo pedido REST dá 401 → `reconnectSession` → `removed_by_gm` → o lobby, com "O Mestre removeu você desta mesa." (`api/rooms.ts:125–130`). **No ar o 4400 não chega** (H.3d.4): o socket parece aberto até o `1006`, a volta do WebSocket é recusada no *upgrade* — e o navegador não deixa ler o status do *upgrade* —, e quem acha o 401 é o heartbeat pelo REST, que só vai quando o socket não está aberto: até ~20 s depois de ele cair (`MultiplayerRoom.tsx:367–376`). Lido, não medido no ar — mas o caminho não depende de código de fechamento nenhum |
| O coletor (B.5) ou a mesa encerrada | `deleteRoom` revoga todas (`roomManager.ts:102–108`) | 401 → reconexão → `room_not_found` → o banner "Sessão expirada e reconexão falhou — a sala pode ter sido encerrada. Saia e entre novamente." (`api/rooms.ts:132–134`). A tela da mesa fica, e cada heartbeat tenta de novo (3 por minuto) até o "Sair". O coletor só leva mesa parada há 24 h (`roomManager.ts:263–264`) — uma aba aberta, com heartbeat, não deixa |
| Outro `join` do mesmo assento (uma aba duplicada) | `joinRoom` revoga as antigas (`roomManager.ts:668`) | **nada**: a aba antiga cai no `seat_taken` e entra como outro jogador, em silêncio — é o **H.05** (ADIAR, reproduzido na H) |

**Itens:** nenhum novo. O único caminho que esconde a revogação é o do H.05, e o gatilho dele segue de pé.
A reconexão que falha manda sair, e o texto diz a verdade.

---

## I.1d — Transporte

*Pergunta: `apiFetch` e `authedFetch` — timeout, retry e a restrição da hibernação.*

**Medido:**
- **Timeout:** nenhum (`http.ts:39–65`; o `authedFetch` passa pelo `apiFetch`). Quem desiste é o navegador,
  em minutos. O despertar da hibernação no ar: ~22 s (H.1j) e 21,7 s (H.3d.4); "50 seconds or more", avisa
  o painel.
- **Retry:** um só — o `503 server_restarting`, que garante que nada foi executado: o servidor o responde
  **antes** de qualquer rota de `/api/rooms` (`server.ts:501–513`). Vale para todo chamador do `apiFetch`,
  criar e entrar incluídos; o `/api/gemini`, fora do `/api/rooms`, nunca o recebe. E outro, de outra
  camada: o 401 que reconecta e repete uma vez (`api/rooms.ts:151–166`) — também seguro, porque a sessão é
  conferida antes da ação.
- **Erro de rede** (o `fetch` que lança): vira `ApiError(0, "Falha de conexão com o servidor.")`
  (`http.ts:50–52`), sem retry — banner nas ações do GM; nada nos caminhos do I.06.
- **Corpo que não é JSON** (a página de erro de um proxy, o "503 Service Suspended" do Render): o
  `.catch(() => ({}))` (`http.ts:54`) faz a tela dizer "Erro 503". Feio, mas aponta o servidor.
- **A mesa na mesma rede:** os limitadores contam por IP (120/min na sala, 600/min na API —
  `server.ts:158` e `:252`), e jogadores na mesma casa saem pelo mesmo IP. Chat, rolagem e heartbeat vão
  pelo WebSocket, que conta por jogador (R.4); pelo REST passam a ficha e as ações do GM. Sem item.

### I.07 — Um timeout no `apiFetch`

**Área:** I.1d

**Sintoma observado:** nenhum — nenhum pedido pendurado em nenhuma varredura; a pista do plano já avisava
o contrário.

**Onde:** `src/api/http.ts:46`.

**Quem sente hoje:** ninguém.

**Se eu não fizer:** nada.

**Versão 10× menor:** —

**Reversível:** sim.

**VEREDITO:** DESCARTAR
- **Razão:** o Render acorda em ~22 s medidos (e "50 s ou mais", diz o painel): um timeout menor quebra o
  `join` de quem chega para jogar, e um maior não faz nada que o navegador já não faça.

### I.08 — Repetir sozinho o pedido que falhou na rede

**Área:** I.1d

**Sintoma observado:** nenhum.

**Onde:** `src/api/http.ts:50–52`.

**Quem sente hoje:** ninguém.

**Se eu não fizer:** nada — o GM clica de novo, e o `useInFlight` (G.06) segura o clique duplo.

**Versão 10× menor:** —

**Reversível:** sim.

**VEREDITO:** DESCARTAR
- **Razão:** com a rede caindo no meio, a ação pode ter sido executada e só a resposta se perdeu — repetir
  dano, turno ou `join` é o G.06 por outro caminho. O `503 server_restarting` é o único erro em que se sabe
  que nada foi feito, e é o único repetido (H.3d).

---

## I.1e — Cross-origin

*Pergunta: `VITE_API_URL` → `ws`/`wss`, `CORS_ORIGINS` e o `connect-src` do CSP. Condicional: se a regra
4 continuar sem dono, o veredito natural é ADIAR com o gatilho dela.*

**A condição — os números de outubro.** Lidos no painel do Render em 16/10/2026, ~10:20 em Brasília, com a
sessão do dono no navegador do app (só leitura):

| Página do painel | O que mostra |
|---|---|
| *Billing* → *Monthly Included Usage* | **196,12 h** de 750 — do **workspace**, os dois serviços somados; banda **163 MB** de 5 GB (respostas HTTP 118 MB, iniciada pelo serviço 41 MB, WebSocket 4 MB); *pipeline* 18 de 500 min |
| *Billing* → *Unbilled Charges* | por serviço, só a banda: **NetsheetEngine 0,03 GB** e newra-news-api 0,13 GB. O "usage" em horas de cada serviço (372 h, os dois) é o relógio do mês — a instância existe, acordada ou não —, não as horas acordadas |
| O serviço → *Metrics* | a banda do mês, **33 MB**; memória e CPU só no plano pago |
| A fatura de setembro | só o total, US$ 0,00 |

**O painel não separa as horas por serviço.** O gatilho da regra 4 e o do risco 1 do custo zero — "o
painel do Render mostrar o NetSheet acima de 100 h num mês" — lêem um número que não existe, e gatilho que
não se lê é DESCARTAR disfarçado. O que se lê é o total do workspace, que é um **teto** para o NetSheet.
Outubro não decide: perto de 120 h dele são do monitor do Better Stack até 05/10 (o processo estava acordado
havia 99,2 h às 21:32 daquele dia, e o monitor o mantinha assim desde a virada do mês), e o resto — ~76 h —
é o Newra o mês inteiro mais o NetSheet desde 06/10, sem como separar. **A regra 4 segue sem gatilho
disparado**; o gatilho reescrito está no I.09, e o primeiro mês que o lê inteiro é novembro.

**Medido — o site em outra origem, num Chromium de verdade.** Um roteiro fora do repositório: a página
numa porta, a API (o `app` do `server.ts`) em outra, e `CORS_ORIGINS` com a origem da página.

| Pedido | Resultado |
|---|---|
| criar mesa (só `Content-Type`) | 200 |
| entrar pela primeira vez (sem token) | 200 |
| **entrar com `X-Session-Token`** — o F5, a reconexão, a prova de posse da R.1 | **barrado pelo navegador** ("Failed to fetch") |
| uma ação com o token no corpo (o heartbeat) | 200 |
| **a IA, com `Authorization: Bearer`** | **barrado pelo navegador** |
| o stream SSE (`EventSource`, um GET simples) | recebe a sala |

O *preflight* responde `Access-Control-Allow-Headers: Content-Type` e mais nada (`server.ts:145`). O
WebSocket não passa por CORS (o `Origin` do *upgrade* é da J.1e), e o `wsUrl` troca `http` por `ws`
preservando o host (`api/base.ts:33–39`) — certo. O CSP sai do Express com o site (o ponto 2 da nota de
14/10 na regra 4); o `connect-src` largo é da J.1f.

### I.09 — Com o site fora do Render, o F5 e a IA param: o CORS não libera os cabeçalhos que o cliente manda

**Área:** I.1e

**Sintoma observado:** reproduzido num Chromium (a tabela acima) — mas só existe com o site em outra origem,
e hoje ele é servido pelo próprio Express. Com o `VITE_API_URL` apontando para o Render, a primeira entrada
funciona e **toda entrada seguinte na mesma aba falha**: depois do primeiro `join`, o `postJoin` sempre
manda o `X-Session-Token` (`api/rooms.ts:91–95`) — o F5, a reconexão depois de um 401, o "Entrar" de novo.
A tela diz "Falha de conexão com o servidor.". E o Netrunner IA não responde nunca.

**Onde:** `server.ts:145`.

**Quem sente hoje:** ninguém — o site e a API são o mesmo origin.

**Se eu não fizer:** quem seguir o `DEPLOY.md` para o Vercel quebra a mesa no primeiro F5. O `DEPLOY.md`
passa a avisar (I.05).

**Versão 10× menor:** uma linha — `Content-Type, X-Session-Token, Authorization` no
`Access-Control-Allow-Headers` —, com um teste do *preflight*.

**Reversível:** sim.

**VEREDITO:** ADIAR — é a primeira linha da I.1e quando a regra 4 disparar.
- **Gatilho — o da regra 4, reescrito para o que o painel mostra:** o total de horas do **workspace**
  (*Billing* → *Free Instance Hours*) passar de **100 h** num mês sem o monitor — e aí separar a parte do
  NetSheet antes de decidir, pelas partidas no log (`server_started`) e pelo que o Newra fez no mês —; a
  primeira sessão mostrar a espera do despertar como problema; ou a mesa abrir para gente de fora dos
  convidados. O plano ganhou a mesma correção no gatilho da regra 4 e no do risco 1.

---

## I.2 — Calibragem

**9 itens, 2 FAZER (22%)** — e de código, um só: o achado de segurança.

*A primeira contagem deu 11 itens e 4 FAZER (36%), acima de 1/3.* Três FAZER eram correção de documento, cada
um num item. Repassada a lista: a contradição do `DEPLOY.md` era pista que o plano já mandava a I.1e
corrigir, e reescrever o gatilho da regra 4 é parte do ADIAR do I.09 — ADIAR exige gatilho que se leia. Os
documentos viraram um item (I.05), e o gatilho foi para o I.09. **Nenhum veredito de código mudou na
repassada**, e a régua não estava frouxa: o único FAZER de código é o achado reproduzido.

| FAZER | O que quebra |
|---|---|
| I.03 — 🔒 SEC-16: o `peerId` de um convidado desviava o "Remover" do GM | o GM remove outro jogador, ou não consegue tirar o hostil da mesa — ✅ feito no #54 |
| I.05 — três documentos da costura | a sessão fria e o dono lêem o que o código não faz; o `DEPLOY.md` leva a um F5 quebrado |

**Perto da linha — vai ao dono destacado, porque o merge é que aprova o veredito:**
- **I.01 (o modificador do GM sem tela) — ADIAR.** É o padrão do `CLAUDE.md` — construído de ponta a ponta
  e nunca ligado —, como o G.07, que foi FAZER. A diferença: sem o botão do G.07, a mesa enchia de assentos
  que não saíam e o único jeito de tirar alguém era a API à mão; sem este campo, o GM faz a conta de cabeça
  e usa a dificuldade livre no ataque do NPC. Nada se perde. Se o dono preferir FAZER, a versão menor é
  pequena e cabe na I.3.

**O achado de segurança.** Um, reproduzido (I.03 — SEC-16). Pelo X.2, a primeira versão deste ledger o
tinha numa linha só; o dono escolheu o conserto antes do ledger, como na E (16/10/2026): o PR de segurança é o
[#54](https://github.com/tavinholoco/NetsheetEngine/pull/54), e este branch foi empilhado nele, já com o
texto. **A I.3 fica só com o que o merge deste ledger aprovar** — hoje, nenhum FAZER de código.
*(16/10/2026 — o #53 e o #54 mergeados juntos; **o merge aprovou os veredictos como estavam**: o I.01 segue
ADIAR, e a I.3 ficou vazia.)*

**Para a J**, a I deixa duas respostas: o *upgrade* do WebSocket não confere `Origin` e nada do que a I mediu
depende disso (J.1e); e com o site fora do Render, o CSP sai do Express (J.1f). E uma premissa que envelheceu,
para a J.0 medir: "as 56 de RLS não rodam desde a B" — são **63** desde a `0008`, e rodaram em 15/10 (H.3d.1);
o número velho segue na J.0, na M.0 e no "O que já está no lugar" do `SEGURANCA.md`. O SEC-16 é o primeiro
achado do padrão *client-side path traversal* aqui: a J.1b, na tabela de superfície, confere se outro id
escolhido pelo cliente vira caminho.
