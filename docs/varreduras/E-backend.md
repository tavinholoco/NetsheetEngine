# Varredura E — backend (`server.ts` e `server/*`)

**Data:** 30/09/2026
**Timebox:** 1–2 dias (usado: meio dia para E.0 e E.1)
**Escopo:** `server.ts` (1.436 linhas) e os seis arquivos de `server/` (1.968) — 3.404 linhas, lidas
inteiras. De fora, só o que o servidor chama e que decide um achado: `src/lib/gridDoc.ts` (o doc Yjs do
grid), `src/rules/sheetSchema.ts` (os tetos da ficha) e o trecho do cliente que mostra o que o servidor
manda.
**Itens levantados:** 24 · **FAZER:** 6 · **ADIAR:** 17 · **DESCARTAR:** 1
**Proporção FAZER:** 25% — abaixo de 1/3. Um dos seis é só de documento (E.13).

> **Dois FAZER eram achados de segurança abertos (E.02 e E.03)** — viraram o **SEC-14** e o **SEC-15**.
> O repositório é público, e a regra do [roteiro de varredura](../PLANO_MESTRE.md#o-roteiro-de-uma-varredura)
> (passo X.2) é que o texto de achado aberto vá ao ar **junto com o conserto**. Por decisão do dono, os
> dois foram consertados **antes** do ledger, no [PR #22](https://github.com/tavinholoco/NetsheetEngine/pull/22)
> — o Render volta em 01/10 e publica o `master`. Este ledger sobe depois dele, então já traz o texto.

**Como foi feito.** O E.0 mediu de novo cada pista do plano contra o código do dia (todas bateram —
tabela abaixo). Cada área respondeu à pergunta dela e procurou além das pistas; o que dava para
reproduzir foi reproduzido com um script **fora do repositório**, contra o `roomManager` ou contra o
servidor de verdade (HTTP e WebSocket, em processo ou pelo `npm run dev`). Nenhum código do repositório
mudou nesta etapa. Onde a resposta dependia de plataforma, a fonte é a documentação do fornecedor,
citada no item.

**Numeração:** por área, na ordem em que os itens foram achados; não há E.17 (na redação, ele foi
absorvido pelo E.02). **As linhas citadas são as do `master` em `7fdb7bb`**, o código que foi varrido. O PR #22 (E.02 e E.03)
as desloca; para achar um trecho depois dele, procure pelo nome da função.

---

## E.0 — As pistas, medidas de novo em 30/09/2026

| Pista (plano, 29/09) | Medido em 30/09 |
|---|---|
| `respondWithResult` classifica por substring (`server.ts:283`); `respondToCombat` por regex (`:641`) | ✅ igual |
| `code` estável em quatro respostas | ✅ igual: `room_exists` `:458`, `removed_by_gm` `:484`, `seat_taken` `:489`, `room_full` `:495` |
| NPCs sem teto (`roomManager.ts:671`) | ✅ igual |
| Chat: teto em dois caminhos (`:996`, `:1112`) e oito `push` à mão | ✅ igual — os oito: `:564`, `:715`, `:773`, `:834`, `:903`, `:1512`, `:1521`, `:1531` |
| `updateTacticalGrid` grava o `gridState` como veio (`:666`) | ✅ igual |
| Nenhum `ping` do servidor no WebSocket | ✅ igual — o único "ping" é o comentário do SSE (`server.ts:835`) |
| `listen` só depois do restore (`:1339` → `:1373`) | ✅ igual |
| Shutdown sem fechar sockets (`:1421`) | ✅ igual |
| 12 `toLocaleTimeString("pt-BR")` no `roomManager`; o cliente mostra a string (`MultiplayerRoom.tsx:687`) | ✅ igual. **Reproduzido de novo:** o mesmo instante sai `01:02` com `TZ=UTC` e `22:02` com `TZ=America/Sao_Paulo` |
| `toUpperCase()` em 25 pontos (12 + 10 + 3) | ✅ igual |
| Modelo de IA fixo (`server.ts:421`) | ✅ igual |
| 7 `any` no `server.ts` | ✅ igual: `:348`, `:349`, `:430`, `:947`, `:1148`, `:1157`, `:1284` |
| `roomManager` 1.579 linhas, `server.ts` 1.436 | ✅ igual |

---

## E.1a — Erros e status

*Pergunta: todo caminho de erro devolve o status certo e uma mensagem tratável?* **Não.** Três jeitos
de classificar convivem, e dois deles decidem o status pelo **texto** da mensagem.

### E.01 — O status sai do texto da mensagem, e o `code` estável só existe em quatro respostas

**Área:** E.1a

**Sintoma observado:** reproduzido em 30/09 com requisições de verdade:

| Requisição | Hoje | Deveria |
|---|---|---|
| `join` com código que não existe | `404 "Room not found"` — **em inglês, na tela** do lobby (`MultiplayerRoom.tsx:317` mostra o texto do servidor). Desde a R.11 o código é o convite: errar uma letra é o erro mais comum do produto | `404`, em português, `code` |
| chat vazio | `403 "Mensagem vazia"` | `400` |
| iniciativa com lista que não é lista | `403` | `400` |
| GM gera ficha com a mesa cheia | `403` | `409 room_full`, **como o `join` já responde** para a mesma condição |

Mais três no mesmo padrão, lidos: `/roll` responde `400` a todo erro (inclusive "jogador não está na
mesa"); `/sheet` responde `404` a todo erro; o `POST /initiative` sem `action` nem lista devolve a sala
e **reenvia a sala a todos** sem conferir se quem pediu é o GM (o ritmo é o do limitador de sala — não
abre porta nova, mas é um reenvio que ninguém pediu).

**Onde:** `server.ts:280` (`respondWithResult`, por substring), `:638` (`respondToCombat`, por regex),
`:697` (`/roll`), `:531` (`/sheet`), `:761` (`/initiative`); as mensagens em inglês em `:500`, `:515`,
`:542`, `:786`.

**Quem sente hoje:** o jogador que erra o código do convite; e quem mantém o servidor — **renomear uma
mensagem muda o status da API**, em silêncio.

**Se eu não fizer:** fica feio (inglês na tela) e dá retrabalho: a Fase I conta com o servidor mandando
`code` em todo erro (I.0: "o que falta é o servidor mandá-lo em todo erro — isso é da E.1a").

**Versão 10× menor:** não a RFC 9457 inteira ([`type`/`title`/`status`/`detail`](https://www.rfc-editor.org/rfc/rfc9457)),
e sim o que o plano já escolheu: todo erro sai com um `code` de um conjunto fechado e pequeno
(`room_not_found`, `not_in_room`, `gm_only`, `invalid_input`, `room_full`, `target_not_found`, …), e o
**status sai do `code`** por uma tabela só; `respondWithResult` e `respondToCombat` viram uma função. A
mensagem muda à vontade. A RFC fica para quando um sintoma pedir o que o `code` não resolve.

**Reversível:** sim — acrescentar um campo ao JSON de erro não quebra cliente nenhum (o `ApiError` já
lê `code` desde a R.1). Os quatro `code` que existem ficam como estão.

**VEREDITO:** FAZER — ✅ **feito** na E.3c (30/09/2026).
- Teste que reproduz: `src/__tests__/error-codes.integration.test.ts` (32) — uma linha por caminho de
  erro, status × `code` × mensagem em português, o erro pelo WebSocket, e duas travas no código-fonte.
  Provado revertendo: com o código antigo, os 32 falham. O contrato está no
  [protocolo](../PROTOCOLO_MULTIPLAYER.md#3-endpoints-rest).

### E.21 — "Esta sala existe?" responde no ritmo do limitador global

**Área:** E.1a

**Sintoma observado:** nenhum. Achado na leitura: a conta da R.11 ("chutar uma sala leva anos") usou o
limitador do `join` (120/min por IP), e há leitura que responde se um código existe sob o limitador
global da API (600/min). A conta fica 5× otimista — **e continua em anos** por IP (~30 bits de sufixo).

**Quem sente hoje:** ninguém.

**Se eu não fizer:** nada, com o convite como está.

**Versão 10× menor:** pôr o limitador de sala nessas leituras — uma linha cada.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** a mesa abrir para gente de fora dos convidados, ou a J.1b (tabela de superfície) achar
  outra leitura que responda existência — aí as duas se resolvem juntas.

### E.22 — Ids que coincidem com nomes herdados de `Object` dão 500

**Área:** E.1a

**Sintoma observado:** nenhum em uso. Lido: `room.players` e `room.npcs` são objetos comuns, e um id
como `__proto__` ou `constructor` encontra o **protótipo** em vez de "não existe". Nas rotas do GM que
recebem id (ferimento de jogador e de NPC, dano), isso vira `TypeError` e `500`, não `404`. No `join`, o
mesmo acaso **recusa** o id (ele parece um assento ocupado) — por isso ninguém consegue sentar com ele.

**Quem sente hoje:** ninguém — só o GM chega nessas rotas, e só com id forjado.

**Se eu não fizer:** nada; o erro é `500` para quem forjou.

**Versão 10× menor:** `Object.hasOwn` nas buscas por id (um helper).

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** uma rota nova indexar `players`/`npcs` por id vindo de quem **não** é o GM, ou a J.1d
  (entrada) pegar o mesmo padrão num caminho de jogador.

---

## E.1b — Estado que cresce

*Pergunta: todo `Map`, `Record` e array do servidor — quem limita, quem recolhe?* Conferidos um a um:

| Estado | Limite | Quem recolhe | Situação |
|---|---|---|---|
| limitadores do REST e do WS | janela de 1 min | poda amortizada a cada 500 | ✅ |
| `sessions` | uma por assento (o `join` revoga a anterior) | `deleteRoom`, `leaveRoom`, expulsão | ✅ — limitado pelo número de salas |
| `removedPeerIds` | 50 | saneado no restore | ✅ |
| `roomYjs` | um doc por sala com socket | último socket fecha, `leave`, coletor | ✅ |
| `wsClients`, `ssePeer`, `wsPeer` | 3 sockets por jogador, 16 assentos | `close`; os dois `WeakMap` somem com a conexão | ✅ |
| `pendingTimers` (persistência) | um por sala | o próprio timer | ⚠️ tenta de novo **para sempre**, a cada 2 s — E.15 |
| `sseClients` | — | o `Set` esvazia, a chave fica | ⚠️ E.05 |
| salas (`rooms`) | — | coletor, 24 h depois — e o restore trazia tudo de volta antes dele | 🔒 E.03 → 30 salas |
| `room.npcs` *(pista)* | — | nunca | 🔒 E.03 → 32 NPCs |
| ficha de cada assento | só o corpo de 1 MB e os tetos de lista do schema — até ~557 KB | — | 🔒 E.03 → 64 KB |
| chat *(pista)* | 100 em dois caminhos; oito `push` sem, e o do jogador tirava uma só | — | 🔒 E.03 → um caminho só |
| buffer de socket que não lê | — | só quando o TCP desiste | 🔒 E.03 → 1 MiB |
| `gridState` *(pista)* | — | — | 🔒 E.02 → forma conferida |

### E.02 — 🔒 SEC-14: um grid malformado derrubava o servidor inteiro

**Área:** E.1b *(a pista do `updateTacticalGrid`)*

**Sintoma observado:** **reproduzido** em 30/09. O grid tem duas portas de escrita — a REST (fallback do
GM) e o doc Yjs (todo jogador) — e nenhuma conferia a forma. Criar sala não exige login no servidor, então
**qualquer visitante é GM da própria sala**: com o socket aberto, `tokens: 5` pela REST → `500`, e daí em
diante chat e rolagem → `500`. Um **jogador comum** faz o mesmo empurrando pelo Yjs um item que não é
token. E o vigia de presença chama o mesmo reenvio num `setInterval` sem `try`: ~75 s depois, **o
processo cai** (exit 1, visto com o `npm run dev`) — todas as mesas.

**Onde:** `roomManager.ts:666` (grava como veio), `server.ts:338` (o espelho dentro do reenvio),
`:1301` (o vigia), `src/lib/gridDoc.ts:84` (onde lança).

**Quem sente hoje:** ninguém em produção (0 usuários) — mas a URL está no repositório, e o Render volta
em 01/10.

**Se eu não fizer:** qualquer pessoa derruba todas as mesas, quantas vezes quiser.

**Versão 10× menor:** não há versão menor que resolva: duas camadas — a forma validada nas duas portas, e
o reenvio isolado para nenhuma sala derrubar o processo.

**Reversível:** sim — a REST passa a recusar o que já era lixo.

**VEREDITO:** FAZER — ✅ **feito** na E.3a ([PR #22](https://github.com/tavinholoco/NetsheetEngine/pull/22)).
- Teste que reproduz: `src/__tests__/grid-integrity.integration.test.ts` (9). Provado revertendo por
  camada. Detalhe e portão em [`SEGURANCA.md`](../SEGURANCA.md#fase-e--varredura-backend).

### E.03 — 🔒 SEC-15: o tamanho da mesa não tinha teto

**Área:** E.1b *(as pistas de NPCs e de chat, e o que a tabela acima achou além delas)*

**Sintoma observado:** medido e **reproduzido** em 30/09: salas a ~4 KB cada, sem teto — um IP, no ritmo
do limitador, passa dos 512 MB da instância e dos 500 MB do banco gratuito (que vira só-leitura) em
horas; ficha saneada de até ~557 KB; e um socket que não lê faz o servidor guardar cada reenvio (com 3
sockets parados, o heap vivo foi de 49 a 156 MB em 100 reenvios). É a família do SEC-10 e do SEC-13: a
R.4 e a R.16 limitaram o ritmo e os assentos, não o tamanho.

**Quem sente hoje:** ninguém em produção.

**Se eu não fizer:** a instância cai sem memória, ou o banco vira só-leitura — perde dado.

**Versão 10× menor:** um teto por estado, sem mudar o formato de nada (a versão maior, login para criar
sala, é o E.25).

**Reversível:** sim.

**VEREDITO:** FAZER — ✅ **feito** na E.3b ([PR #22](https://github.com/tavinholoco/NetsheetEngine/pull/22)).
- Teste que reproduz: `src/__tests__/room-limits.integration.test.ts` (9). Provado revertendo teto a
  teto.

### E.24 — Não há teto global de sockets

**Área:** E.1b *(nasceu no conserto do E.03)*

**Sintoma observado:** nenhum. O teto de buffer do E.03 é **por socket**; o pior caso de memória é o
número de sockets (até 48 por sala, em até 30 salas) vezes ~1 MiB mais uma sala.

**Quem sente hoje:** ninguém.

**Se eu não fizer:** um ataque sustentado com centenas de sockets parados ainda pode levar a instância ao
teto — e o Render a reinicia.

**Versão 10× menor:** um teto de sockets no *upgrade* (uma contagem e um `503`).

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** a memória do serviço passar de ~400 MB no painel do Render, ou um reinício por falta de
  memória. Levado à J.1e (*backpressure*).

### E.25 — Criar sala não exige login no servidor

**Área:** E.1b *(a versão maior do E.03)*

**Sintoma observado:** a tela exige login para criar mesa; o servidor não — foi o que fez de qualquer
visitante um GM no E.02 e no E.03.

**Quem sente hoje:** ninguém, com os tetos no lugar.

**Se eu não fizer:** qualquer um cria sala e ocupa as 30 vagas — o preço aceito do teto (a saída é o
`MAX_ROOMS` no painel).

**Versão 10× menor:** os tetos do E.03, que já fecham o esgotamento com ou sem login. Cadastro no Supabase
é aberto: o login seria atrito e rastro, não barreira.

**Reversível:** não de todo — muda o contrato do `create` e os testes que criam sala.

**VEREDITO:** ADIAR — **decisão do dono** (30/09).
- **Gatilho:** `rooms_full` no log de produção sem o dono ter criado as salas, ou a mesa abrir para gente
  de fora dos convidados.

### E.04 — O servidor não detecta socket morto (sem ping/pong)

**Área:** E.1b

**Sintoma observado:** nenhum — nenhuma sessão em produção ainda. A pista previa "memória subindo com a
mesa aberta".

**Onde:** `server.ts:1127` (o `connection` do WebSocket).

**Quem sente hoje:** ninguém. O teto de **3 sockets por jogador** (R.4) já limita os zumbis de quem
volta: o socket novo fecha o mais velho. A presença não mente — o heartbeat de 20 s marca offline.
O custo é o buffer dos reenvios da sala num socket que ninguém lê, até o TCP desistir.

**Se eu não fizer:** nada observável numa mesa de convidados.

**Versão 10× menor:** a do [README do `ws`](https://github.com/websockets/ws#how-to-detect-and-close-broken-connections):
`ping` a cada 30 s, `terminate()` em quem não respondeu ao anterior — umas 15 linhas. *Não atrapalha a
hibernação:* o Render dorme depois de 15 min **sem tráfego de entrada** ([free](https://render.com/docs/free)),
e um socket morto não manda nada; o `pong` só existe enquanto há cliente vivo, que já manda heartbeat.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** a memória do serviço subir durante uma sessão (painel do Render → *Metrics*), ou a H
  achar socket fantasma num cenário de rede (H.1b, H.1j).

### E.05 — `sseClients` guarda um `Set` vazio por sala, para sempre

**Área:** E.1b

**Sintoma observado:** nenhum. Lido: o `wsClients` apaga a chave quando o conjunto esvazia; o
`sseClients` não (`server.ts:842`, `:316`). Uma chave por sala que já teve stream SSE, até o processo
reiniciar — e o Render reinicia a cada deploy e a cada hibernação.

**Quem sente hoje:** ninguém.

**Se eu não fizer:** nada mensurável.

**Versão 10× menor:** apagar a chave quando o `Set` esvaziar, como o WS faz — duas linhas.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** a L.6 decidir **manter** o SSE. Se remover, o item some junto.

### E.20 — A ficha de todo NPC vai a todos os jogadores

**Área:** E.1b

**Sintoma observado:** nenhum. Lido: o reenvio da sala leva `room.npcs` inteiro — atributos, armas,
armadura e pontos de dano do NPC — a cada jogador. Na mesa, a ficha do NPC é segredo do Mestre; hoje
ela está no DevTools de qualquer jogador.

**Quem sente hoje:** ninguém — a tela só mostra o cartão do NPC ao GM.

**Se eu não fizer:** um jogador curioso lê a ficha do NPC.

**Versão 10× menor:** o reenvio por papel nasce naturalmente com o broadcast por diferença (L.1); antes
dela, seria um segundo `JSON.stringify` por reenvio — custo de CPU na instância de 0,1 CPU.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** a mesa do dono se importar (um jogador "espiar" a ficha do NPC), ou a L.1 abrir — o
  filtro por papel entra no mesmo trabalho. Levado à J.1b como linha da tabela de superfície.

### E.23 — Compressão HTTP no Express

**Área:** E.1b *(banda)*

**Sintoma observado:** nenhum — e a premissa não se sustenta.

**VEREDITO:** DESCARTAR
- **Razão:** os balanceadores do Render **já comprimem** as respostas HTTP de web services com Brotli e
  gzip ([web services](https://render.com/docs/web-services)). Um `compression()` no Express gastaria a
  CPU de 0,1 da instância gratuita para comprimir o que a borda comprime de graça. O WebSocket não passa
  por isso — a compressão dele é o `perMessageDeflate` da L.0, com o aviso de memória do README do `ws`.

---

## E.1c — Concorrência e ciclo de vida

*Pergunta: que suposição quebra se duas coisas acontecerem juntas?* O Node é uma thread; o risco mora
nos `await`, nos timers e — descoberta desta área — **entre duas instâncias**.

### E.06 — Todo deploy roda duas instâncias ao mesmo tempo por pelo menos 60 s

**Área:** E.1c

**Sintoma observado:** nenhum ainda (nenhum deploy com mesa aberta). **Previsto pela documentação do
Render**, não reproduzido: no deploy sem interrupção, a instância nova sobe, fica saudável e **passa a
receber o tráfego novo**; a velha segue viva e, **60 s depois**, recebe o `SIGTERM`, com 30 s de
carência antes do `SIGKILL` ([deploys](https://render.com/docs/deploys)). O `docs/DEPLOY.md` manda
"manter 1 réplica" — e cada deploy tem duas, por 60–90 s.

**O que quebra, pela leitura:**
- a instância nova **restaura as salas do banco no boot** (`server.ts:1339`) — o estado de antes da troca;
- quem está no WebSocket segue jogando na **velha**; o que o GM faz por REST (dano, NPC, iniciativa —
  tudo que é do GM vai por REST) cai na **nova**. Por até ~90 s, **duas mesas divergentes**;
- no `SIGTERM`, a velha grava as pendências no banco (`flushAllPending`) e sai; os sockets reconectam na
  nova, que **nunca relê o banco** — e a próxima gravação dela passa por cima do que a velha gravou;
- no próprio `SIGTERM`, o que chegar depois da fotografia do `flushAllPending` também se perde (a janela
  é de milissegundos, o problema menor dos três).

**Quem sente hoje:** ninguém. **Quem sentiria:** a mesa inteira, se o dono mergear um PR no meio de uma
sessão — o Render publica a cada push no `master`.

**Se eu não fizer:** perde dado — até ~1,5 min de chat, dano e grid — **só** num merge durante sessão.

**Versão 10× menor:** uma **regra de processo**, custo zero: *não mergear no `master` com mesa aberta.*
Entra no `DEPLOY.md` neste mesmo PR. O conserto técnico (a nova instância reler a sala do banco depois do
`SIGTERM` da velha, ou uma instância só por vez) é trabalho grande, e sem sintoma.

**Reversível:** sim.

**VEREDITO:** ADIAR *(o código)* — a regra de processo entra já, no `DEPLOY.md`.
- **Gatilho:** estado perdido depois de um deploy com mesa aberta — o cenário da **H.1j** (no ar), que
  passa a ter o roteiro do que conferir.

### E.07 — Remover alguém da iniciativa no meio da rodada pula a vez de outro

**Área:** E.1c *(além das pistas)*

**Sintoma observado:** **reproduzido** em 30/09 contra o `roomManager`, com quatro NPCs na ordem
A → B → C → D e a vez em C:

| O GM remove | Depois | Na virada seguinte | O livro |
|---|---|---|---|
| B (antes de quem tem a vez) | lista A, C, D; índice 2 aponta D, a marca segue em C | a vez vai para **A — D perde a vez** | D |
| C (quem tem a vez) | lista A, B, D; **ninguém marcado** | a vez vai para **A — D perde a vez** | D |
| D (o último, com a vez) | lista A, B, C; índice 3 **fora da lista**, ninguém marcado | — | A, na rodada seguinte |

O `deleteRoomNpc` e o `deleteGeneratedPlayer` filtram a lista e **não mexem no índice**; o `leaveRoom`
só corrige o índice que passou do fim — pula a vez do mesmo jeito quando quem sai está antes da vez.
O caso comum: **o NPC morre e o GM o tira da mesa** no meio da rodada. E a vez pulada leva junto o
death save do turno (D.5) de quem estava em Mortal.

**Onde:** `roomManager.ts:829` (`deleteRoomNpc`), `:899` (`deleteGeneratedPlayer`), `:1497`
(`leaveRoom`).

**Quem sente hoje:** o jogador (ou NPC) que perde a vez; o GM, que precisa notar e corrigir à mão.

**Se eu não fizer:** regra errada na mesa — fidelidade estrita: divergência do livro é bug.

**Versão 10× menor:** um helper só, "tirar da iniciativa", que mantém a vez com quem a tinha (ou passa
ao seguinte, se foi ele que saiu), usado pelos três caminhos.

**Reversível:** sim — nada persistido muda de formato.

**VEREDITO:** FAZER — ✅ **feito** na E.3d (30/09/2026).
- Teste que reproduz: `src/__tests__/initiative-removal.test.ts` (8) — os três casos acima, a saída de
  um jogador e a remoção de uma ficha gerada antes da vez, o death save de quem recebe a vez em Mortal, e
  a remoção do NPC pelo nome (achada no conserto: filtrava só pelo id da rota). Provado revertendo: com o
  filtro antigo, 7 falham.

### E.08 — Gravação em voo × sala encerrada: a sala pode voltar no boot

**Área:** E.1c

**Sintoma observado:** nenhum. Lido: se a última pessoa sai enquanto um `upsert` da sala está em voo
(`roomPersistence.ts:66`), o `delete` pode chegar ao banco **antes** dele e a linha renasce. No boot
seguinte a sala volta, sem ninguém.

**Quem sente hoje:** ninguém. A janela é a de uma requisição (~100 ms), e o coletor recolhe a sala
fantasma em 24 h — ela não tem ninguém ativo.

**Se eu não fizer:** uma linha a mais no banco por um dia, raramente.

**Versão 10× menor:** o `delete` esperar o `upsert` em voo daquela sala (guardar a promessa).

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** uma sala encerrada reaparecer depois de um restart.

### E.09 — O Render pode esperar o CI antes de publicar

**Área:** E.1c

**Sintoma observado:** nenhum — a decisão 5 (migration em PR próprio) funciona. **Fato novo:** o
Render tem o gatilho de auto-deploy **"After CI Checks Pass"** (`autoDeployTrigger: checksPass`): ele
espera os checks do commit e **não publica se algum falhar**
([deploys](https://render.com/docs/deploys), [changelog](https://render.com/changelog/skip-auto-deploying-if-ci-checks-fail)).
Com o `db-sync` sendo um check do push no `master`, a ordem migration → código passaria a ser imposta
pela plataforma, e um `master` vermelho deixaria de ir ao ar.

**Quem sente hoje:** ninguém.

**Se eu não fizer:** a decisão 5 segue dependendo de disciplina — e já funcionou.

**Versão 10× menor:** uma opção no painel do Render (do dono), ou uma linha no `render.yaml`.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** a regra da decisão 5 falhar uma vez (código no ar antes da migration), ou um `master`
  vermelho ser publicado. *Não reabre a decisão 5 — é o jeito de a plataforma cumpri-la.*

### E.19 — "Remover NPC" apaga o token de um jogador, se receber o id dele

**Área:** E.1c *(além das pistas)*

**Sintoma observado:** nenhum. Lido: `deleteRoomNpc` (`roomManager.ts:785`) procura o NPC e, **mesmo
sem achar**, filtra do grid todo token com aquele `peerId` e tira a entrada da iniciativa — com o id de
um jogador, o token dele some do mapa e o chat anuncia "removeu o NPC [peer_…]".

**Quem sente hoje:** ninguém — a tela só oferece "remover" no cartão do NPC.

**Se eu não fizer:** nada, com a tela como está.

**Versão 10× menor:** só limpar o grid se o id for de um NPC, ou de um token sem ficha.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** um token de jogador sumir do mapa sem ele sair, ou a tela passar a oferecer "remover"
  fora do cartão do NPC.

---

## E.1d — Dado montado como texto

### E.10 — O horário do chat sai no fuso do servidor, e o Render roda em UTC

**Área:** E.1d

**Sintoma observado:** **reproduzido** (E.0): o mesmo instante sai `01:02` com `TZ=UTC` e `22:02` com
`TZ=America/Sao_Paulo`. O Render roda em UTC
([comunidade do Render](https://community.render.com/t/date-time-server/5598)); o dev local roda no fuso
do Brasil — por isso ninguém viu. Aparece **na primeira sessão em produção**: toda mensagem da mesa três
horas adiantada.

**Onde:** as 12 chamadas de `toLocaleTimeString("pt-BR")` no `roomManager` (11 à mão e o `chatTime`,
`:1099`); o cliente mostra a string como veio (`MultiplayerRoom.tsx:687`).

**Quem sente hoje:** toda a mesa, no primeiro dia no ar.

**Se eu não fizer:** número errado na tela, em toda mensagem.

**Versão 10× menor:** um formatador só, com `timeZone: "America/Sao_Paulo"` explícito, no lugar das 12
chamadas. A mesa é de convidados do dono, no Brasil; o Brasil não tem horário de verão desde 2019, e o
Node oficial traz o ICU completo — o fuso nomeado funciona sem pacote. *A versão maior* — o servidor
mandar o instante (ISO) e o cliente formatar no fuso de cada um — muda o formato persistido das
mensagens e o contrato do chat: **ADIAR**, gatilho "um jogador de outro fuso na mesa".
*(Uma variável `TZ` no painel do Render resolveria sem código, mas é configuração fora do repositório —
invisível para quem lê o código, e o teste não a pegaria.)*

**Reversível:** sim — a mensagem continua uma string de horário; só o fuso muda.

**VEREDITO:** FAZER — ✅ **feito** na E.3e (30/09/2026).
- Teste que reproduz: `src/__tests__/chat-time.test.ts` (2) — com o processo em UTC, um instante fixo
  formata no horário de Brasília. Provado revertendo: sem o `timeZone` explícito, os 2 falham.

### E.11 — `code.toUpperCase()` em 25 pontos: normalização sem dono

**Área:** E.1d

**Sintoma observado:** nenhum bug. Lido: o `getRoom` normaliza com `trim()` e maiúsculas; o stream SSE e
o `closePeerSockets` só com maiúsculas. Um código com espaço na URL acharia a sala e cairia num `Set` de
streams que o reenvio nunca visita. Nenhum cliente manda código assim.

**Quem sente hoje:** ninguém.

**Se eu não fizer:** nada.

**Versão 10× menor:** um `roomKey(code)` só — nasce com o corte "salas" do mapa (E.18).

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** um bug de sala "não encontrada" ou de stream mudo por causa de maiúscula ou espaço — ou a
  L.3 fatiar o `roomManager` (o `roomKey` vai para o módulo de salas).

### E.12 — O modelo de IA é fixo no código

**Área:** E.1d

**Sintoma observado:** nenhum. **Fato do dia**, da [página de descontinuações](https://ai.google.dev/gemini-api/docs/deprecations)
(30/09): o `gemini-2.5-flash` **não está descontinuado** e segue sem data de desligamento, mas o acesso
está limitado "a quem já usou ativamente" os modelos 2.5; para projeto novo, a recomendação é o 3.5
Flash-Lite ou o 3.8 Flash. **O NetSheet nunca chamou a IA em produção** — se o acesso é por projeto do
Google, quem garante o acesso é o uso do Newra News com a mesma chave, e isso não se confere daqui.

**Onde:** `server.ts:421`.

**Quem sente hoje:** ninguém.

**Se eu não fizer:** no pior caso, "a IA parou" — o custo zero segura o resto.

**Versão 10× menor:** a que a [ADR 0005](../adr/0005-provedor-de-ia.md) já prevê para o gatilho: ler o
nome do modelo de uma variável de ambiente.

**Reversível:** sim.

**VEREDITO:** ADIAR — o gatilho é o da ADR 0005 (o Gemini recusar o modelo no `gemini_api_error`).
- **Como conferir o gatilho sem esperar uma sessão:** na primeira visita ao ar com login, **uma pergunta
  ao Netrunner IA**. Resposta normal fecha a dúvida; erro, o log diz se foi o modelo.

---

## E.1e — Logs e gatilhos

*Pergunta: todo `catch` registra? Nenhum segredo sai?*

**Conferido sem achado:**
- **Nenhum segredo sai.** O logger nunca recebe token: o `sse_fallback` grava `peerId` e *user agent*; o
  `unhandled_error`, mensagem e *stack*; a IA, só o id do usuário e o tamanho do prompt. A chave do
  Gemini viaja no header `x-goog-api-key`, não na URL (conferido no `@google/genai` instalado) — a
  mensagem de erro do provedor não a carrega.
- **A persistência não engole erro** (`save`, `delete` e `restore` registram `warn`).
- **Um `catch` engole:** o do *sync* Yjs, e o que escapa dele sai como texto cru do `y-protocols`, fora
  do logger JSON. O E.02 cobriu o caso que importava: update malformado agora é recusado e registrado
  (`grid_update_rejected`), em vez de lançar dentro do `y-protocols`.

### E.13 — A lista de eventos-gatilho do Registro de sessões está incompleta

**Área:** E.1e

**Sintoma observado:** dois eventos que dizem "algo quebrou" ficam fora da tabela que manda ler o log
depois de cada sessão:
- `unhandled_error` — é o `500`, o sinal de bug que chegou ao usuário; foi ele que apareceu nas
  reproduções do E.02, e nenhuma lista o lê;
- `persistence_save_failed` — o banco recusando gravar. **Visto hoje** no log do `npm run dev` (o
  Supabase local desligado): uma linha a cada 2 s por sala, sem parar (E.15). Em produção, é o sinal de
  estado da mesa que não chegou ao banco.

E o `sse_fallback`, que está na lista, **conta mais do que o gatilho supõe** — ver E.14.

**Onde:** a tabela em [Registro de sessões](../PLANO_MESTRE.md#registro-de-sessões).

**Quem sente hoje:** quem vai ler o log depois da primeira sessão.

**Se eu não fizer:** um `500` ou uma gravação perdida passa pela sessão sem ninguém anotar — o log vive
7 dias.

**Versão 10× menor:** duas linhas na tabela e uma ressalva no `sse_fallback`. Só documento.

**Reversível:** sim.

**VEREDITO:** FAZER *(documento — neste PR)*.

### E.14 — O `sse_fallback` conta queda de rede e restart, não só proxy que bloqueia WebSocket

**Área:** E.1e

**Sintoma observado:** nenhum ainda. **Lido no cliente** (`MultiplayerRoom.tsx:171` e `:211`), não
reproduzido: o `wsEverOpen` nasce `false` a cada tentativa. Se o WebSocket cai **depois** de conectar,
o cliente tenta de novo em 3 s — e, se essa tentativa falhar (Wi-Fi que piscou, notebook que dormiu,
servidor reiniciando), a tentativa nova "nunca abriu" e **cai para o SSE**. O servidor registra
`sse_fallback`, e o comentário dele supõe que "toda conexão aqui é uma queda de fallback" por proxy.

**Quem sente hoje:** a decisão da L.6 — "alguém caiu para SSE? mantém" — contaria queda de rede comum
como evidência a favor do SSE.

**Se eu não fizer:** a L.6 decide com um número inflado.

**Versão 10× menor:** o cliente lembrar que o WS **já abriu nesta mesa** (um `ref` fora do efeito) e só
cair para SSE se nunca abriu. É código do cliente — da **H**, não da E.

**Reversível:** sim.

**VEREDITO:** ADIAR — **gatilho:** a H.1g (queda para SSE), ou antes, se a primeira contagem do
`sse_fallback` no Registro de sessões vier acima de zero. A ressalva vai para a tabela do Registro
(E.13) e para as premissas da H.0.

### E.15 — A persistência tenta de novo a cada 2 s, para sempre, sem espaçar

**Área:** E.1e

**Sintoma observado:** visto hoje no dev local (o Supabase local desligado): `persistence_save_failed` a
cada 2 s por sala, até o processo sair. Em produção, só com o Supabase fora do ar — o keepalive impede a
pausa do plano gratuito.

**Onde:** `roomPersistence.ts:80`.

**Quem sente hoje:** ninguém em produção.

**Se eu não fizer:** com o banco fora, uma requisição e uma linha de log a cada 2 s por sala — nada se
perde a mais por isso.

**Versão 10× menor:** espaçar o retry dobrando até 60 s.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** `persistence_save_failed` em sequência no log de produção (o banco fora por minutos).

### E.16 — Sete `any` no `server.ts`

**Área:** E.1e

**Sintoma observado:** nenhum.

**VEREDITO:** ADIAR — a dona é a **L.5** (ESLint, zerar `any` e `console.*`). **Gatilho:** a L.5 abrir.

---

## E.1f — Mapa de cortes *(ARQ-05, insumo da L.3)*

*Pergunta: por onde fatiar, se um dia fatiar?* Nenhum corte tem sintoma hoje — o filtro manda ADIAR
todos, com a L.3 como dona. O mapa existe para a L.3 não recomeçar a varredura.

### E.18 — Os cortes

**VEREDITO:** ADIAR — **gatilho:** a L.3 abrir; ou antes, se um FAZER precisar de um corte para ser
testável (nenhum dos seis precisa).

| Arquivo | Linhas | Corte proposto | Linhas de hoje | Veredito |
|---|---|---|---|---|
| `server/roomManager.ts` | 1.579 | `sessions.ts` — token, hash, emitir, conferir, revogar, exportar e restaurar | 38–137 (~100) | ADIAR (L.3) — o primeiro: não depende de nada |
| | | `rooms.ts` — o mapa de salas, `getRoom`, criar, restaurar, presença, coletor, recorte público; o `roomKey` do E.11 nasce aqui | 139–370, 1551–1579 (~260) | ADIAR (L.3) |
| | | `seats.ts` — assento, sala cheia, removidos, `join`, `leave` | 418–579, 916–936, 1477–1549 (~260) | ADIAR (L.3) |
| | | `chat.ts` — `postChatMessage`, `pushSystemMessage`, o horário; o teto único de mensagens (E.03) e o formatador do E.10 moram aqui | 968–1001, 1098–1113 (~55) | ADIAR (L.3) |
| | | `gmPowers.ts` — grid, NPCs, fichas geradas, remoções, ferimento manual | 616–966 (~350) | ADIAR (L.3) |
| | | `combat.ts` — rolagens, dano, ataque do NPC, iniciativa, turno, estabilizar; o helper do E.07 mora aqui | 1003–1475 (~470) | ADIAR (L.3) |
| `server.ts` | 1.436 | `server/http.ts` — `trust proxy`, CORS, helmet, limitadores, resposta de erro (a tabela do E.01) | 88–288 (~200) | ADIAR (L.3) |
| | | `server/routes/rooms.ts` — as rotas de sala e o stream SSE | 437–846 (~410) | ADIAR (L.3) |
| | | `server/routes/ai.ts` — o Netrunner IA | 372–435 (~65) | ADIAR (L.3) — o candidato natural da migração da ADR 0005 |
| | | `server/realtime.ts` — reenvio, WS, tetos, *upgrade* | 290–370, 848–884, 1122–1258, 1378–1418 (~330) | ADIAR (L.3) |
| | | `server/yjsGrid.ts` — doc por sala, espelho doc ↔ JSON, posse | 885–1120 (~235) | ADIAR (L.3) |
| | | fica no `server.ts` — health, vigias, `startServer`, shutdown | ~150 | — |

**Uma observação para a L.3:** o `roomManager` é quase todo funções puras sobre um mapa — os testes já o
chamam direto. O `server.ts` não: as rotas, o reenvio e o Yjs só se testam subindo o app. O corte que
mais barateia teste é o do `server.ts`, não o do `roomManager`.

---

## Pesquisa usada nesta varredura

| Fonte | O que decidiu |
|---|---|
| [Render — deploys](https://render.com/docs/deploys) | E.06: instância nova recebe tráfego; a velha vive 60 s + 30 s de carência (até 300 s com `maxShutdownDelaySeconds`). E.09: "After CI Checks Pass" |
| [Render — free](https://render.com/docs/free) e [preços](https://render.com/pricing) | 512 MB de RAM e 0,1 CPU; dorme após 15 min sem tráfego de entrada (E.04) |
| [Render — web services](https://render.com/docs/web-services) | O balanceador comprime com Brotli e gzip (E.23) |
| [Supabase — database size](https://supabase.com/docs/guides/platform/database-size) | Plano gratuito: 500 MB de banco; acima disso, modo só-leitura (E.03) |
| [README do `ws`](https://github.com/websockets/ws#how-to-detect-and-close-broken-connections) | Ping/pong com `terminate()` (E.04); o aviso de memória da compressão (E.23) |
| [Gemini — descontinuações](https://ai.google.dev/gemini-api/docs/deprecations) | 2.5 sem data de desligamento, acesso limitado a quem já usava (E.12) |
| [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) | A referência que o E.01 não adota inteira |
