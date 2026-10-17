# Varredura J — segurança (a superfície inteira: autenticação, autorização, entrada e saída)

**Data:** 17/10/2026. *A J.0 e as sete áreas (J.1a–g) feitas no mesmo dia, em duas sessões; a calibragem na J.2.*
**Timebox:** 1,5–2,5 dias
**Escopo:** a superfície inteira, depois do código novo de C a I: as rotas REST, as mensagens do WebSocket,
o quadro Yjs, o stream SSE, as credenciais (o token da mesa e o JWT do Supabase), o CSP, o RLS, o CI e a
cadeia de dependências. As varreduras E, G, H e I olharam cada lado com outra pergunta. Esta pergunta o que um
convidado hostil consegue fazer (decisão 3), que dado sai para quem não deveria vê-lo, e quem recebe uma
credencial provando o quê.
**Itens levantados:** 13 · **FAZER:** 4 · **ADIAR:** 6 · **DESCARTAR:** 3
**Proporção FAZER:** 31% — dois dos quatro são os achados de segurança, consertados antes deste ledger (J.2)

**Como é feito.** Leitura do código. Onde a leitura não basta, a reprodução: um roteiro com o `supertest` contra
o `app`, sem listener nem banco, a suíte de RLS no Supabase local e a API do GitHub para o estado do repositório.
Os roteiros ficam fora do repositório, porque servem para uma medição só. **A régua externa é o
[OWASP API Security Top 10](https://api-security.owasp.org/), edição 2023**, decidida pelo dono em 30/09. Ela é
régua de busca: só vira item o defeito achado numa rota real.

**As linhas citadas são as do `master` em `954ef0e`** (17/10/2026), o código varrido. *O conserto do SEC-17 e do
SEC-18 (J.04 e J.08) mudou o `server.ts` depois; as linhas dele aqui são as de antes.*

---

## J.0 — As pistas, medidas em 17/10/2026

*Linha de base do dia:* `tsc` 0 erros e `vitest` **868** em 65 arquivos, os números do plano. **RLS 63/63**, rodado
hoje no Supabase local. O build saiu limpo. O CI do `master` está verde: o merge do #56 passou, e o run do #55 saiu
`cancelled` pela concorrência, com o mesmo código coberto pelo seguinte. O keepalive de 16/10 também está verde.
**Nenhum gatilho de ADIAR disparou** desde a I, e o Registro de sessões segue vazio. Os dois prazos da semana são de
operação, não da J:
- **o token do CI vence por volta de 25/10**, e a renovação é do dono, até 22/10;
- **o Ubuntu 26 dos runners** entra a partir de 19/10: conferir o primeiro run depois dessa data.

### As premissas da J.0

| Premissa (plano) | Medido em 17/10 |
|---|---|
| O gitleaks do CI já varre o histórico (`fetch-depth: 0`) | ✅ `ci.yml:29`. O run do merge do #56 diz **263 commits scanned**, e o `master` tem **264** commits sem merge. O de diferença não foi identificado: não há commit vazio nem só de renomeação. A J.1f roda o gitleaks local para fechar a conta |
| O CSP segue com `connect-src 'self' ws: wss: https:` (`server.ts:175`) | ✅ igual, mas mudou de linha: `connect-src` em `server.ts:181` e `img-src` (`https:`) em `:179` |
| As 56 de RLS não rodam desde a B | ❌ **envelheceu.** São **63** desde a `0008` (H.3d.1), e rodaram em 15/10, 16/10 e hoje: 63/63. O número velho também aparece na J.1f, na M.0 e no "O que já está no lugar" do `SEGURANCA.md` (`:907`, que ainda dá as migrations até a `0007`) |
| Antes da revisão de robustez, as varreduras E–I não passavam pelo portão; a J confere que cada X.4 foi respondido | ✅ **respondido.** Todo passo de E a I que mudou código tem as seis perguntas no `SEGURANCA.md`: na E, o SEC-14/15 (`:535`) e a E.3c–e (`:573`); na F, um bloco por PR (`:597`, `:621`, `:636`, `:652`); na G, a G.3 (`:685`) e a G.3h (`:712`); na H, a H.3 (`:730`) e a H.3d (`:760`); na I, o SEC-16 (`:838`), mais a linha da I.3, que não mudou código. Fica para a J.1a o que esta medida não diz: se alguma resposta envelheceu, e se algum PR **fora** das fases mudou código sem portão |
| Régua externa: o OWASP API Top 10, **edição 2023, a vigente** | ✅ **ainda é a vigente.** O site do projeto lista só a 2019 e a 2023. A conta do plano ("12 dos 13 achados em cinco categorias") era de 30/09. Com o SEC-14, o SEC-15 e o SEC-16, são **15 dos 16**: veja a tabela abaixo |

### As pistas das áreas, medidas contra o código do dia

| Pista (plano) | Área | Medido em 17/10 |
|---|---|---|
| **E.20** — a ficha de todo NPC vai a todos os jogadores | J.1b | ✅ igual. O reenvio é `JSON.stringify(room)` inteiro (`server.ts:379`), com `room.npcs`, a cada socket e stream da sala |
| **E.21** — leitura que responde "esta sala existe?" sob o limitador global | J.1b | ✅ igual, e são **duas portas**: o `GET /api/rooms/:code` (`server.ts:606`, o recorte público sem token) e o `GET …/stream` (`:864`, que responde `room_not_found` antes de conferir o token). As duas estão sem o `roomLimiter`, só com os 600/min do global (`:159`) |
| **E.22** — ids como `__proto__` acham o protótipo | J.1d | ✅ **ainda vale depois do SEC-16**, reproduzido hoje. O formato novo do `peerId` (`[A-Za-z0-9_-]{1,64}`) **aceita** `__proto__` e `constructor`. O `join` com `__proto__`, `constructor`, `toString`, `hasOwnProperty` ou `valueOf` é recusado com **409 `seat_taken`**, pelo mesmo acaso de antes: o protótipo parece um assento ocupado. Com o token do GM, `player-health` com `__proto__` e `stabilize` com `constructor` dão **500** (`unhandled_error`, `roomManager.ts:742` e `rules/damage.ts:105`); as outras rotas do GM devolvem 400 ou 404. Não há `Object.hasOwn` em `server/` |
| O *upgrade* do WebSocket não confere `Origin`, e o que protege é o token na query | J.1e | ✅ igual (`server.ts:1631–1668`): o caminho, o bastão (503), o token da query e o `401`. Não há cabeçalho `Origin` em lugar nenhum do *upgrade*. A I respondeu que nada do que ela mediu depende disso |
| O token na URL: onde a URL do *upgrade* aparece em log | J.1e | ✅ **no nosso log, não aparece.** O servidor não registra `req.url` em lugar nenhum: não há `morgan`, e o `logger` só recebe eventos com campos escolhidos. O token vai na query em dois lugares do cliente: o WebSocket (`MultiplayerRoom.tsx:243`) e o SSE (`:232`). **Falta medir** o log do Render e o do Cloudflare, no painel, com a sessão do dono |
| Sessão revogada fecha o socket? A R.3 fez isso para a expulsão | J.1e | **Medido o mapa, sem veredito.** `revokeSessionsForPeer` (`roomManager.ts:94`) tem três chamadores, e `deleteRoom` (`:102`) tem dois. **Fecham o socket:** a expulsão (`server.ts:704`) e o "Sair" (`:828`), pelo `closePeerSockets` (`:334`). **Não fecham:** (1) o `join` que troca o token do assento (`roomManager.ts:681`), onde o socket velho é do mesmo dono, porque reivindicar o assento exige o token vigente (R.1), e o teto de 3 sockets por jogador vale; (2) **o coletor de salas abandonadas** (`server.ts:1444–1452`), que revoga as sessões e destrói o doc Yjs, mas não fecha os sockets da sala. Pista nova para a J.1e: se um socket pode seguir aberto numa sala que o coletor apagou |
| *Backpressure*: o teto por socket (E.03) existe, falta o global (**E.24**) | J.1e | ✅ igual. Há o teto por socket (`maxBufferedBytes`, 1 MiB) e por jogador (`maxSocketsPerPeer: 3`, `wsLimits.ts:24`). Não há contagem global de sockets no *upgrade* |
| CSP: `connect-src https:` e `img-src https:` amplos | J.1f | ✅ igual (`server.ts:179`, `:181`). O comentário (`:166–170`) dá o porquê: os avatares do Storage do Supabase, o unsplash e o Realtime. A I deixou a outra metade: com o site fora do Render, o CSP sai do Express (I.09) |
| RLS: re-rodar e conferir as políticas de storage do avatar | J.1f | ✅ **63/63 hoje.** O storage **está na suíte** (`supabase/tests/rls_tests.sql:185–256`): o anônimo não faz upload; cada usuário sobe só na própria pasta e não altera nem apaga o objeto de outro. A J.1f confere o que a suíte não cobre (tipo e tamanho do arquivo, as políticas em `0002` e `0003`) |
| A allowlist do `.gitleaks.toml` libera padrões largos (`<.*>`, `example`, `placeholder`, `your-`) | J.1f | ✅ igual (`.gitleaks.toml`, `[allowlist].regexes`). A allowlist também exclui caminhos (`dist`, `.env.local`, `supabase/.env`). Fica para a J.1f confirmar que cada padrão só esconde exemplo |
| Segredo no bundle: transformar a checagem da T10.7 em script | J.1f | ✅ **ainda à mão** (`PRODUCTION_CHECKLIST.md:31`). Feita hoje no build local: zero `AIzaSy`, `GOCSPX`, `service_role` e `sb_secret_`, e um JWT só, a anon key demo (`iss: supabase-demo`, `role: anon`). O cliente só lê `VITE_API_URL`, e o Supabase lê pelo `src/lib/supabase.ts:37`. O build de produção é feito no Docker do Render, com a anon key de produção, que é pública por desenho; ele não foi conferido aqui |
| O repositório é público e o `master` não tem proteção de branch | J.1f | ✅ igual: a API do GitHub responde `Branch not protected` e `rulesets: []`; `visibility: public` e `allow_forking: true`. Os workflows não usam `pull_request_target` nem `workflow_run`, e as `permissions` são por job (`ci.yml:22`, `:69`, `:142`, `:186`; `keepalive.yml:23`) |
| Actions fixadas por tag, não por SHA; o `supabase/setup-cli` em `latest` | J.1f | ✅ igual: `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `github/codeql-action/upload-sarif@v3` e `supabase/setup-cli@v1` com `version: latest` (`ci.yml:195–197`, `keepalive.yml:30–32`). Só o gitleaks é fixado por versão (`v8.23.3`) |
| **Sair e voltar "curado"** (D.9) | J.1g | ✅ igual. O `leaveRoom` apaga o jogador (`roomManager.ts:1638`). A volta é um assento novo, e um assento novo leva a ficha do cliente como veio, ferimento incluído (`:639`); o `withServerWound` só vale na reconexão (`:628`) |
| A variante do SEC-07 pelo *handle* do GM (R.1) | J.1g | ✅ igual. O GM que sai sem ninguém online deixa `gmPeerId` vazio (`roomManager.ts:1663`). O próximo `join` com o *handle* do GM assume o cargo (`:610`), e o `gmHandle` está no **recorte público** da sala, que qualquer um com o código lê sem token (`:1714`, pelo `GET` da `server.ts:606`) |

### Pistas novas, achadas medindo

- **Os dois caminhos do cliente que o SEC-16 não codificou.** O `roomCode` entra cru na URL do SSE e do WebSocket
  (`MultiplayerRoom.tsx:232` e `:243`), sem o `encodeURIComponent` que o #54 pôs em `src/api/rooms.ts`. O código
  só chega lá depois de o `join` aceitá-lo, e o servidor recusa o que estiver fora de `[A-Za-z0-9-]{2,24}`. É a
  conferência que a I deixou para a J.1b: algum outro id escolhido pelo cliente vira caminho?
- **O comentário do `ci.yml` diz mais do que o gatilho faz.** Ele diz que o job de segredos "também roda em
  qualquer branch (push + PR)" (`ci.yml:8–9`), mas o `on.push` é só o `master` (`:4–5`). Um branch sem PR não
  passa pelo gitleaks até abrir o PR. Fica para a J.1f.
- **O coletor de salas não fecha os sockets** da sala que apaga. Está na linha das revogações, acima, para a J.1e.

### A régua: os achados do projeto no OWASP API Top 10 (2023)

Cruzada com a tabela de superfície na J.1b. O SEC-03 (sessão perdida no restart) é de disponibilidade e fica de
fora.

| Categoria | Achados do projeto |
|---|---|
| API1 — autorização por objeto | SEC-02, 07, 08, 09, 12, 16 |
| API2 — autenticação | SEC-07 |
| API3 — autorização por propriedade | SEC-05, 12 |
| API4 — consumo sem limite | SEC-01, 04, 10, 13, 14, 15 |
| API5 — autorização por função | SEC-16 (o clique do GM disparava outra ação de GM) |
| API6 — fluxo de negócio sensível | — |
| API7 — SSRF | — |
| API8 — configuração | SEC-06, 11 |
| API9 — inventário | — *(a I.1a fez o inventário de rotas, e o I.04 é a pista: duas portas sem chamador)* |
| API10 — consumo inseguro de API | — *(a resposta do Gemini, no `/api/gemini`, é o único consumo de API de terceiro)* |

---

## J.1a — O registro do portão

*Pergunta: toda fase — e toda varredura que mudou código — respondeu as seis perguntas? Alguma resposta
envelheceu?*

**Todas responderam.** A J.0 mediu de E a I; a J.1a conferiu o resto: a A (`SEGURANCA.md:91`) e o adendo do
keepalive (`:133`), a B (`:152`), a C (`:209`), a D (`:254`), a revisão pós-D (`:306`, que não é portão: é o
registro do que escapou) e a R, em quatro entradas e mais a de 10/10 (`:333`, `:382`, `:404`, `:426`, `:449`).

**Os PRs fora das fases.** Dos 57 PRs mergeados até o #57, 31 mexeram em algo além de documento. 26 têm a
entrada do portão da fase deles (o #23 e o #53 levam o código do #22 e do #54, empilhados). Os cinco que não
têm não mudam a superfície que um jogador alcança:

| PR | O que mudou | Por que não pede portão |
|---|---|---|
| #3 (03/09) | tirou 7 componentes de UI sem uso e as dependências deles | só remoção — a superfície encolhe —, e foi o PR que criou o portão |
| #9 (26/09) | 4 números de regra em `src/rules/tables.ts` | dado do livro: nenhuma entrada, saída ou permissão |
| #13 (29/09) | `.claude/launch.json` e `.gitignore` | configuração de desenvolvimento |
| #19 (30/09) | `scripts/verify-prod.mjs` e 7 linhas no `test-ws-e2e.mjs` | roda na máquina do dono, e o cabeçalho dá o que o portão perguntaria: nenhuma credencial, uma sala de teste apagada no fim, nenhum IP impresso, uma requisição por passo |
| #30 (01/10) | `scripts/visual/` | roda contra o `netsheet-prod` local |

**As respostas, contra o código do dia.** Os números que o registro cita batem: a IA em 10/min e o prompt em
4.000 (`server.ts:258`, `aiPrompt.ts:28`); o `kind` da rolagem em 12 caracteres (`roomManager.ts:1167`); a
explosão em 10 dados e a fórmula em 20d100 (`tables.ts:31`, `dice.ts:146–147`); o dano bruto até 2.500 e a
dificuldade de 1 a 50 (`roomManager.ts:1215`, `:1362–1363`); a iniciativa em 50 (`:1478`); o quadro de 1 MiB e
o awareness de 4 KiB (`wsLimits.ts`); 50 removidos (`roomManager.ts:1040`); 16 assentos (`:556`); o código de até
24, com seis símbolos de 31 (`roomCode.ts`); 30 salas, 32 NPCs, ficha de 64 KB e chat de 100 (`:196–203`); o
bastão a cada 2 s e o retry de 1,5 s por 45 s (`instanceLease.ts:107`, `http.ts:36–37`); e o helmet 8.3.0, que
manda `Referrer-Policy: no-referrer` por padrão (a H.3 se apoia nisso). O PAT do CI segue só com o dono: o
único colaborador do repositório é `tavinholoco` (a pergunta 3 da A). **Envelheceram duas respostas** — o J.01 —
e uma, a do SEC-15 ("não prende reenvios num socket parado"), valia só para o reenvio da sala: é o J.08.

### J.01 — Duas respostas do portão e dois comentários dizem o que não é mais

**Área:** J.1a (e J.1f, os comentários)

**Sintoma observado:** medido contra o estado do dia:
- **o adendo do keepalive** (`SEGURANCA.md:138–139`) diz que a saída do `migration list` vai para o log do
  Actions, "que é privado como o repositório". O repositório é **público** (29/09 e J.0), e o log também. O que
  ele mostra, lido no run de 16/10: a lista de migrations, `0001` a `0008` — que já está no repositório — e os
  secrets mascarados (`***`). A conclusão da resposta (nada novo sai) segue certa; a premissa, não;
- **"O que já está no lugar"** (`:910–911`) lista os limitadores sem o da IA (10/min) e diz que eles contam o IP
  real "atrás do proxy do Render (`trust proxy`, R.5)" — desde 10/10 é a `TRUST_PROXY` com o Cloudflare (`:449`);
- **o comentário do `ci.yml`** (`:8–9`) diz que o job de segredos "também roda em qualquer branch (push + PR)", e
  o `on.push` é só o `master` (`:4–5`); o cabeçalho do `.gitleaks.toml` diz "todo push/PR". Um branch sem PR não
  passa pelo gitleaks — mas passa pela **proteção de push do GitHub**, ligada no repositório
  (`secret_scanning_push_protection: enabled`, lido hoje pela API), que barra os padrões dos provedores no
  próprio `push`.

**Onde:** acima.

**Quem sente hoje:** quem lê o registro para não refazer pergunta — a sessão fria.

**Se eu não fizer:** dá retrabalho; o portão de uma fase futura pode se apoiar no "log privado".

**Versão 10× menor:** é ela — só texto.

**Reversível:** sim.

**VEREDITO:** FAZER *(documento)*. As duas respostas, neste PR. Os dois comentários vão com o J.11 na J.3, que
mexe no `.gitleaks.toml` de qualquer jeito (este PR é só de documento).
*(17/10/2026 — ✅ **os dois comentários, na J.3**: o `ci.yml` e o cabeçalho do `.gitleaks.toml` dizem que o gitleaks
roda em todo PR para o `master` e no push ao `master`, e que branch sem PR conta só com a proteção de push.)*

---

## J.1b — A tabela de superfície

*Pergunta: cada endpoint REST, cada tipo de mensagem do WebSocket e o quadro Yjs × autenticado? autorizado?
entrada validada? saída filtrada?*

"Token" é a sessão de mesa (T1.7), conferida contra a sala do caminho; "a sala" é o `JSON.stringify(room)`
inteiro, o mesmo para todo assento.

| Rota (`server.ts`) | Autenticado | Autorizado | Entrada | Saída |
|---|---|---|---|---|
| `POST /api/gemini` (`:439`) | JWT, conferido no Supabase a cada pedido (`auth.getUser`) | qualquer conta | `prompt` em texto, até 4.000; o `systemInstruction` do cliente é descartado | `{ text }`, a quem pediu, mostrado como texto |
| `POST /api/rooms/create` (`:525`) | — (decisão de 30/09) | qualquer um: a sala é nova | código `[A-Z0-9-]{2,24}`, `gmPeerId` no formato (SEC-16), nome 40, handle 30; 409 se existe, 503 no teto | a sala e o token, a quem criou |
| `POST /api/rooms/join` (`:551`) | assento novo: — (o código é o convite, R.11); ocupado: o token dele (R.1) | não removido (R.3), sala não cheia (R.16) | código, `peerId` no formato, ficha saneada até 64 KB, handle 30 | a sala e o token, a quem entrou |
| `GET /api/rooms/:code` (`:606`) | opcional | o assento do token | — | sem token, o recorte `{ code, name, gmHandle, playersCount }`; com token, a sala |
| `POST …/sheet` (`:625`) | token | o próprio assento | ficha saneada, 64 KB, com o ferimento do servidor (decisão 7a) | a sala, a todos |
| `POST …/message` (`:769`) | token | na mesa | texto até 500; 30/min | a sala, a todos |
| `POST …/roll` (`:781`) | token | na mesa | `kind` de uma lista, perícia até 60; o dado é do servidor | a sala, a todos; a rolagem, a quem pediu |
| `POST …/heartbeat` (`:798`), `…/leave` (`:821`) | token | o próprio assento | — | `{ success }`; sair fecha os sockets e streams dele |
| `POST …/player-health` (`:644`), `…/npcs/:npcId/health` (`:719`) | token | GM | nível grampeado em 0–10; o id sem formato (E.22) | a sala, a todos |
| `POST …/tactical-grid` (`:658`) | token | GM | a forma do grid (SEC-14) | a sala, a todos |
| `POST …/npcs/generate` (`:672`), `…/players/generate` (`:687`) | token | GM | `archetypeId` procurado na lista do gerador (desconhecido sorteia); tetos de NPC e de assento | a sala, a todos |
| `POST …/players/:id/delete` (`:697`), `…/npcs/:id/delete` (`:709`) | token | GM, que não remove a si | o id do caminho, só comparado dentro da sala | a sala, a todos; o removido perde a sessão e o socket |
| `POST …/damage`, `…/attack`, `…/stabilize` (`:735–763`) | token | GM | dano finito de 0 a 2.500 e local de uma lista; faixa ou dificuldade de 1 a 50; `stabilized` só `true` | a sala, a todos |
| `POST …/settings` (`:810`) | token | GM | modificador em ±10, textos de 60 e 120 | a sala, a todos — sem chamador (I.01) |
| `POST …/initiative` (`:842`) | token | GM | `next`, `roll` ou lista de até 50, campo a campo | a sala, a todos |
| `GET …/stream` (`:864`) | token na query | na mesa | — | a sala, a cada mudança |
| `GET /api/health` (`:1363`) | — | qualquer um | — | versão, uptime, contagens, o IP de quem pergunta |

| WebSocket (`server.ts`) | Autenticado | Autorizado | Entrada | Saída |
|---|---|---|---|---|
| *upgrade* `/ws/rooms/:code` (`:1632`) | token na query; 401 sem | na mesa; 3 sockets por jogador | o caminho, `[A-Za-z0-9-]+` | a sala, ao abrir |
| qualquer quadro (`:1243`) | o do socket | — | até 1 MiB; 1.800/min antes do parse | — |
| `message` | idem | na mesa | texto até 500; 30/min | a sala, a todos; o erro, ao autor |
| `roll` | idem | na mesa | como o REST; 120/min com a iniciativa | a sala, a todos; `roll-error`, ao autor |
| `heartbeat` | idem | na mesa | — | — |
| `initiative` | idem | GM | como o REST | a sala, a todos — o cliente não manda (I.04) |
| Yjs `messageSync` (0) | idem | jogador: só x/y do próprio token; GM: tudo (R.6) | a forma do grid (SEC-14); 120/min | o update, aos outros; a sala, se aceito; o doc inteiro, a quem pede |
| Yjs `messageAwareness` (1) | idem | **ninguém conferia** — J.04 | até 4 KiB; 1.200/min | **repassado como veio** |
| Yjs `messageQueryAwareness` (3) | idem | na mesa | — | todo o awareness da sala |

**Saída filtrada?** Não, por desenho: a sala vai inteira a todo assento — fichas, NPCs (E.20), chat, grid,
`gmPeerId`, `removedPeerIds`. O que não vai: as sessões (outro mapa, só o hash) e nada de conta — a ficha não
leva e-mail nem id do Supabase. Medido além da tabela:
- **O E.21 segue sem gatilho.** A J.1b procurou outra porta que respondesse "esta sala existe?" mais depressa que
  o `join`: o `create` responde 409 `room_exists`, mas sob o mesmo limitador do `join` (120/min); as rotas com
  token respondem 401 antes de olhar a sala; o *upgrade* responde 401 sem distinguir. Seguem as duas da J.0.
- **O E.20 segue como estava**, e o padrão do SEC-16 não se repete (o J.02).
- **A régua.** API1 (objeto): toda rota de mesa tira o assento do token, e o id do caminho só é comparado dentro
  da sala do token. API3 (propriedade): a ficha, o grid e a iniciativa são montados campo a campo; o awareness,
  não — o J.04. API5 (função): o `checkIsGm` está em toda rota de GM; o cursor, que só o GM emite, não tinha
  conferência — o J.04. API4 (consumo): o J.08. API6: nada. API7 (SSRF): o servidor não busca URL nenhuma que
  venha do cliente — o `avatarUrl` é só guardado (o J.03). API10: a resposta da IA vai à tela como texto; não há
  `dangerouslySetInnerHTML` nem renderizador de markdown no cliente.

### J.02 — O código da sala entra cru na URL do SSE e do WebSocket

**Área:** J.1b — a pista nova da J.0: os dois caminhos do cliente que o SEC-16 não codificou
(`MultiplayerRoom.tsx:232`, `:243`).

**Sintoma observado:** nenhum. O `roomCode` dali só existe depois de o servidor aceitá-lo: o `create` grava o
código que o servidor devolveu (`api/rooms.ts:204`), e o `join`, o que a pessoa digitou (`:218`) — mas só quando o
`join` dá certo, e o servidor só aceita `[A-Za-z0-9-]` com espaço, no máximo, nas pontas (`roomManager.ts:166`
apara antes de conferir). Nada que vire outro caminho: um espaço o navegador codifica. E nenhum outro id escolhido
pelo cliente vira caminho: o `npcId` e o `targetPeerId` são codificados desde o #54.

**VEREDITO:** DESCARTAR — o que vai à URL já passou pelo alfabeto do servidor.

### J.03 — O `avatarUrl` da ficha é uma URL livre

**Área:** J.1b, procurando além das pistas.

**Sintoma observado:** nenhum. A ficha aceita qualquer texto de até 2.048 caracteres em `avatarUrl`
(`sheetSchema.ts:311`), que vai na sala a todos. Se a tela de outro jogador o carregasse num `<img>`, quem
escolheu a URL receberia o IP de cada um. **Nenhuma tela faz isso:** a mesa não desenha imagem nenhuma, e o
`avatarUrl` da ficha só aparece no `CharacterHeader`, na ficha do próprio jogador (`SheetPage.tsx:51`); os
avatares das telas sociais são o do próprio usuário. O servidor nunca busca a URL.

**VEREDITO:** DESCARTAR — nenhum leitor do avatar de outra pessoa. *Se a mesa passar a mostrar o retrato dos
jogadores, a URL entra no portão daquela fase, com o `img-src` do J.09.*

---

## J.1c — Credenciais

*Pergunta: toda emissão — `create`, `join`, *upgrade* do WebSocket, JWT do Supabase — e o que quem recebe prova.*

| Emissão | Quem recebe | Prova o quê |
|---|---|---|
| `create` | quem cria — o servidor não exige login (decisão de 30/09) | nada, e não precisa: a sala é nova, e o token só vale nela |
| `join`, assento novo | quem tem o código | o código, que é o convite (R.11); não removido (R.3); a sala não cheia (R.16) |
| `join`, assento ocupado | o dono do assento | o token vigente dele (R.1) |
| GM pelo *handle* (`gmPeerId` vazio) | quem chega com o *handle* do GM | nada — a variante do SEC-07, ADIAR (J.1g) |
| GM pela saída do GM (`leaveRoom`, `:1649`) | o primeiro jogador online | estar online e ter entrado antes — o desenho da T1.8, sem prova; o GM escolheu sair |
| *upgrade* e stream | o dono do token | o token; não emite credencial nova |
| JWT do Supabase | quem tem conta | e-mail e senha; o servidor confere no Supabase a cada pedido, então a revogação vale na hora |

**Sem item novo.** O token da mesa tem 192 bits (`crypto.randomBytes(24)`), não expira sozinho e morre com a
sala, com a saída ou com a expulsão (a I.1c). Uma coisa **não medida**: o `config.toml` do repositório é o do
Supabase local (`enable_signup = true`, `enable_anonymous_sign_ins = false`); o do ar mora no painel do Supabase,
e a J não o abriu. Se o login anônimo estivesse ligado no ar, qualquer um ganharia um JWT e usaria a IA sem
conta — com o teto de sempre: 10/min por IP, e a chave sem faturamento (regra 1 do custo zero). O dono confere em
*Authentication → Sign In / Providers*.

---

## J.1d — Entrada

*Pergunta: todo campo que entra em `sheet`, `gridState`, `initiativeList` e no protocolo Yjs — o binário Yjs é
entrada de usuário.*

A ficha passa pelo `sheetSchema` em todo caminho (B.2) e tem teto (E.03); o grid, pela forma nas duas portas
(SEC-14); a iniciativa, campo a campo (D.4). No protocolo Yjs, o `messageSync` tem try/catch, a forma (SEC-14) e
a posse (R.6). **O awareness não tinha nada além do tamanho e do ritmo** — o J.04. O **E.22** segue ADIAR: o
`__proto__` cabe no formato do `peerId`, o `join` o recusa por acaso e duas rotas do GM dão 500 (J.0); o gatilho
— uma rota nova indexar `players`/`npcs` por id de quem não é o GM — não disparou: toda rota de jogador indexa
pelo assento do token. **A pista "chave fora do grid no doc Yjs" está fora da J** desde a parada de 17/10 (a nota
na J.1d do plano): ADIAR, gatilho o dono rodar a sonda.

### J.04 — 🔒 SEC-17: o awareness do Yjs entrava cru na tela dos outros

**Área:** J.1d

**Achado de segurança, reproduzido em 17/10/2026** — o texto inteiro está no
[`SEGURANCA.md`](../SEGURANCA.md#fase-j--varredura-segurança), com o portão. Um convidado com um script publicava
um cursor como "Mestre" e, com um nome que não era texto, derrubava o app inteiro de quem estava no grid.

**VEREDITO:** FAZER — ✅ **feito antes deste ledger**, no PR de segurança, o
[#58](https://github.com/tavinholoco/NetsheetEngine/pull/58), a pedido do dono, como na E e na I.

### J.05 — O quadro de texto do WebSocket vai ao `JSON.parse` com até 1 MiB

**Área:** J.1d, procurando além das pistas.

**Sintoma observado:** nenhum. O chat cabe em ~600 bytes, e o maior texto legítimo — a lista de iniciativa — em
~10 KB; o WebSocket aceita 1 MiB por quadro (R.4) e 1.800 quadros por minuto, todos parseados. O REST tem o mesmo
teto (`express.json` de 1 MB) no limitador global. O custo de CPU fica preso ao **upload de quem ataca**: 1.800 MiB
por minuto é ~250 Mbit/s de um jogador só.

**VEREDITO:** DESCARTAR — o teto é a banda de subida do atacante, a mesma do REST.

---

## J.1e — WebSocket

*Pela [folha da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html).*

**O `Origin` — registrado como decisão.** O *upgrade* não confere `Origin` (`server.ts:1632–1668`), e não
precisa: o *cross-site WebSocket hijacking* depende de uma credencial que o navegador manda sozinho, como um
cookie. Aqui a autoridade do socket é o token na query, que uma página de outro site não tem — ele mora no
`sessionStorage` do origin do app. **Se a sessão um dia for para cookie, conferir o `Origin` vira obrigatório.**
A decisão foi para o "O que já está no lugar" do `SEGURANCA.md`.

**Sessão revogada fecha o socket?** A expulsão e o "Sair" fecham (R.3); a troca de token no `join` não precisa (o
socket é do mesmo dono); o coletor não fecha — o J.07. **O *backpressure*:** o teto por socket da E.03 só valia
no reenvio da sala — o J.08. O **E.24** (teto global de sockets) segue ADIAR, sem gatilho: com o J.08, o pior
caso volta à conta dele — sockets e streams vezes ~1 MiB.

### J.06 — O token da mesa vai na URL do WebSocket e do SSE

**Área:** J.1e

**Sintoma observado:** nenhum. O `EventSource` e o `WebSocket` do navegador não mandam cabeçalho próprio, então
o token vai na query (`MultiplayerRoom.tsx:232`, `:243`). Onde a URL fica: **no nosso log, em lugar nenhum** — o
servidor não registra `req.url`, e o `logger` só recebe campos escolhidos (J.0). **No Render**, os *Request logs*
— onde o caminho e a query de cada pedido apareceriam — exigem o plano Pro: o painel do dono, no gratuito,
mostra só o log da aplicação (lido hoje, com a sessão do dono, só leitura). O Cloudflare na frente do Render não
é visível ao dono. A URL do *upgrade* não vai ao histórico nem ao `Referer` (não é a página).

**Quem sente hoje:** ninguém. O token vale só naquela mesa e morre com ela.

**Versão 10× menor:** um *ticket* de uso único e vida curta, pedido pelo REST antes do *upgrade*, no lugar do
token — mexe no cliente, no servidor e no protocolo.

**VEREDITO:** ADIAR. **Gatilho:** o token aparecer num log que outra pessoa lê, ou o serviço passar a um plano
com *Request logs* (aí, conferir se a query é gravada).

### J.07 — O coletor apaga a sala e deixa os sockets dela abertos

**Área:** J.1e — a pista nova da J.0.

**Sintoma observado:** lido, não reproduzido. O coletor revoga as sessões, destrói o doc Yjs e apaga a linha
(`server.ts:1444–1452`), mas não fecha os sockets nem os streams da sala. O que sobra não age — toda mensagem
procura a sala e não acha —, e só seria visto se uma sala **nova** nascesse com o **mesmo código**: o reenvio
dela iria também ao socket velho. Para chegar lá: um socket que fica aberto **sem** heartbeat por 24 h (o
cliente do app manda heartbeat, e quem manda não deixa a sala ser abandonada), e alguém criar outra mesa com o
mesmo código — que a tela gera com sufixo aleatório (R.11).

**Quem sente hoje:** ninguém.

**Versão 10× menor:** o coletor chamar o mesmo fechamento da saída para cada socket e stream da sala — poucas
linhas.

**VEREDITO:** ADIAR. **Gatilho:** o cliente deixar de gerar o sufixo do código (ou o servidor passar a aceitar
código escolhido sem ele), ou um log mostrar mensagem de socket numa sala que não existe.

### J.08 — 🔒 SEC-18: a memória do servidor crescia sem teto por dois caminhos que a E.03 não cobriu

**Área:** J.1e

**Achado de segurança, reproduzido em 17/10/2026** — o texto inteiro está no
[`SEGURANCA.md`](../SEGURANCA.md#fase-j--varredura-segurança), com o portão. Qualquer visitante, sem login,
chegava aos 512 MB da instância — e com ela, a todas as mesas.

**VEREDITO:** FAZER — ✅ **feito antes deste ledger**, no mesmo PR de segurança do J.04.

---

## J.1f — Configuração e cadeia

- **RLS:** 63/63 (J.0). O que a suíte não cobria, nas políticas do avatar (`0002`, `0003`): o bucket aceita
  5 MB e só PNG, JPEG, WebP e GIF — **sem SVG**, então um avatar não carrega script; e a leitura pública dá
  também a **listagem** — o J.10. O e-mail saiu do perfil na `0004`; os perfis que todo usuário logado lê
  (`profiles_select_public`) não têm dado de conta.
- **O repositório e o CI:** público, sem proteção de branch, e o gatilho da A.10 (um segundo colaborador) não
  disparou. O GitHub mantém a **varredura de segredos** e a **proteção de push** ligadas (lido na API). Os
  workflows não usam `pull_request_target` nem `workflow_run` (J.0). As actions seguem por tag — o ADIAR do
  plano, sem gatilho —, e o aviso de Node 20 delas já está na tabela de avisos do CI.
- **A conta de commits do gitleaks** (263 varridos × 264 na J.0): não fechou. O gitleaks não está instalado nesta
  máquina, e a hipótese de um commit só com arquivos da allowlist caiu — não há nenhum. Não muda veredito.

### J.09 — O CSP libera `https:` inteiro em `connect-src` e `img-src`

**Área:** J.1f

**Sintoma observado:** nenhum. `connect-src 'self' ws: wss: https:` e `img-src … https:` (`server.ts:179–181`). O
que o app busca de fora: o Supabase (REST, Auth, Storage e Realtime) e as imagens do unsplash dos NPCs gerados.
Um CSP mais apertado só morderia **depois** de um XSS — e não há HTML cru no cliente (J.1b).

**Versão 10× menor:** trocar o `https:` pela origem do Supabase e a do unsplash, lidas do ambiente.

**VEREDITO:** ADIAR. **Gatilho:** um XSS achado, ou o site sair do Render (I.09) — aí o CSP sai do Express e é
reescrito de qualquer jeito.

### J.10 — O bucket do avatar: a listagem é pública, e o upload não tem conta

**Área:** J.1f

**Sintoma observado:** lido, não reproduzido (o Supabase local estava parado). A política `avatars_select_public`
(`0002:47`) libera o `select` em `storage.objects` a qualquer um, e no Storage isso é também **listar**: um anônimo
lista as pastas do bucket — o UUID de cada usuário que subiu avatar, com a data. O download de bucket público não
precisa dessa política. E cada usuário sobe quantos arquivos quiser na própria pasta (5 MB cada); o cadastro é
aberto, e o Storage gratuito tem 1 GB.

**Quem sente hoje:** ninguém — a produção não tem usuário (o backup de 16/10).

**Versão 10× menor:** tirar a política de `select` (o app lista só a própria pasta, logado) e, para o volume, uma
política de `insert` que recuse mais de alguns arquivos por pasta.

**VEREDITO:** ADIAR. **Gatilho:** o primeiro usuário de fora dos convidados, ou o Storage passar de metade da cota
no painel do Supabase.

### J.11 — A allowlist do gitleaks pula os workflows do CI

**Área:** J.1f — a pista da allowlist larga.

**Sintoma observado:** reproduzível na leitura, contra o código do gitleaks da versão do CI (v8.23.3): o caminho é
testado **sem âncora** (`config/utils.go`, `regexMatched` → `FindString`), e a allowlist tem `'''\.git'''`
(`.gitleaks.toml`). O padrão foi escrito para a pasta `.git`, e casa com **todo caminho que contém `.git`**:
`.github/workflows/ci.yml` e `keepalive.yml` — onde moram as referências aos secrets do CI —, `.gitleaks.toml`,
`.gitleaks/pre-commit.sh`, `.gitignore`, `.gitattributes` e `supabase/.gitignore`. Um token escrito num workflow
passa pelo nosso gitleaks sem alerta. O `'''dist'''` tem o mesmo defeito (nenhum arquivo rastreado hoje). Os
padrões de texto da allowlist (`<.*>`, `example`, `placeholder`, `your-`, `xxxxx`) são testados contra o
**segredo** achado, e só escondem o que tem cara de exemplo — esses ficam.

**Quem sente hoje:** ninguém — não há segredo nos workflows. A proteção de push do GitHub ainda barra os padrões
dos provedores; não barra as regras próprias do `.gitleaks.toml` nem a genérica de alta entropia.

**Se eu não fizer:** vaza dado — o scanner não olha onde um token tem mais chance de ser colado.

**Versão 10× menor:** é ela — ancorar os caminhos (`^\.git/`, `^dist/`, `^node_modules/`), com um teste que lê o
`.gitleaks.toml` e confere que nenhum arquivo do repositório que deveria ser varrido cai na allowlist.

**Reversível:** sim.

**VEREDITO:** FAZER *(configuração, na J.3)* — com os dois comentários do J.01.
*(17/10/2026 — ✅ **feito na J.3**: todo padrão de caminho ancorado, e o `gitleaks-allowlist.test` (2), escrito antes,
confere contra o `git ls-files`. Com a allowlist antiga ele lista os 7 arquivos acima; tirada uma âncora por vez,
cada uma derruba o seu caso.)*

### J.12 — A conferência de segredo no bundle é à mão

**Área:** J.1f

**Sintoma observado:** nenhum. A checagem da T10.7 (`PRODUCTION_CHECKLIST.md:31`) passou na J.0: o bundle só tem a
anon key de demonstração. O cliente lê três variáveis, `VITE_API_URL`, `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` — todas públicas por desenho.

**Versão 10× menor:** um teste que confere que `src/` só lê essas três `VITE_`.

**VEREDITO:** ADIAR. **Gatilho:** uma quarta variável `VITE_` no cliente, ou um passo novo no build que injete
configuração.

### J.13 — Os alertas do Dependabot estão desligados

**Área:** J.1f, procurando além das pistas.

**Sintoma observado:** nenhum. O repositório não tem os alertas de vulnerabilidade do GitHub
(`vulnerability-alerts` → 404, lido hoje). O `audit:ci` roda a cada PR e a cada push no `master` — e pegou dois
alertas do dia em 10/10. Entre um push e outro, nada avisa.

**Versão 10× menor:** ligar os alertas no painel do GitHub (um clique do dono), ou pôr o `npm audit` no keepalive,
que roda a cada 3 dias.

**VEREDITO:** ADIAR. **Gatilho:** o projeto ficar um mês sem push no `master` — o que a M vai fazer —, ou um alerta
crítico só aparecer no run seguinte.

---

## J.1g — Os ADIAR herdados

- **Sair e voltar "curado"** (D.9) — segue ADIAR. Medido na J.0 (`roomManager.ts:1638`, `:639`); o gatilho — um
  jogador aparecer inteiro depois de sair no meio de uma luta — não disparou: a produção não teve sessão de jogo.
- **A variante do SEC-07 pelo *handle* do GM** (R.1) — segue ADIAR, e a J.1g achou uma segunda porta para o mesmo
  vão: com o `gmPeerId` vazio, o `checkIsGm` (`roomManager.ts:351–363`) entrega o cargo a qualquer jogador **já
  sentado** cujo *handle* bata com o do GM — e o *handle* muda na sincronia da ficha (`:708`). Não precisa de
  `join` novo, só da janela de sempre: o GM sair sem ninguém online. O gatilho — uma mesa ser tomada assim — não
  disparou. O conserto, quando vier, cobre as duas portas: as duas passam pelo `gmHandle`.

---

## J.2 — Calibragem

**13 itens, 4 FAZER (31%)** — abaixo de 1/3, perto dele.

| FAZER | O que quebra |
|---|---|
| J.01 — duas respostas do portão e dois comentários | a sessão fria lê o que não é mais; o portão se apoia num "log privado" |
| J.04 — 🔒 SEC-17: o awareness cru | um convidado derruba a tela de combate de todos, a cada recarga — ✅ feito antes deste ledger |
| J.08 — 🔒 SEC-18: a memória sem teto | qualquer visitante derruba a instância e todas as mesas — ✅ feito antes deste ledger |
| J.11 — a allowlist do gitleaks pula os workflows | um token colado num workflow passa pelo scanner |

**A repassada.** Dois FAZER são achados de segurança reproduzidos — o que a J existe para achar. Os outros dois
são pequenos e têm sintoma lido: o texto falso (como o I.05) e uma guarda que não guarda. Os seis ADIAR têm
gatilho que se lê; os três DESCARTAR, um leitor que não existe. Nenhum veredito mudou na repassada.

**Perto da linha — vai ao dono destacado:**
- **J.07 (o coletor e os sockets) — ADIAR.** O conserto é de poucas linhas, no mesmo trecho do J.08. Ficou ADIAR
  porque não há sintoma: o socket velho não age, e o código repetido que o tornaria visível a tela não gera. Se o
  dono preferir FAZER, cabe na J.3.
- **J.10 (o bucket do avatar) — ADIAR.** É dado saindo para quem não deveria vê-lo (os UUIDs), mas de usuário que
  ainda não existe. A versão menor é uma migration — em PR próprio, pela decisão 5.

**Os achados de segurança.** Dois, reproduzidos (J.04 — SEC-17; J.08 — SEC-18). O dono escolheu o conserto antes
do ledger, como na E e na I: o PR de segurança é o [#58](https://github.com/tavinholoco/NetsheetEngine/pull/58), e este foi empilhado nele, já
com o texto. **Mergear o de segurança primeiro.** A J.3 fica com o J.11 (e os comentários do J.01) — o que o merge
deste ledger aprovar.
*(17/10/2026 — o #58 e o #59 mergeados, nessa ordem; o `master` verde nos quatro jobs depois deles. **O merge aprovou
os veredictos como estavam:** o J.07 e o J.10 seguem ADIAR, e a J.3 foi o J.11 e os comentários do J.01.)*
