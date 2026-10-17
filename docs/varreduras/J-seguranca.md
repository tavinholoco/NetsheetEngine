# Varredura J — segurança (a superfície inteira: autenticação, autorização, entrada e saída)

**Data:** 17/10/2026. *Em andamento: a J.0 está feita, e as áreas J.1a–g ainda não.*
**Timebox:** 1,5–2,5 dias
**Escopo:** a superfície inteira, depois do código novo de C a I: as rotas REST, as mensagens do WebSocket,
o quadro Yjs, o stream SSE, as credenciais (o token da mesa e o JWT do Supabase), o CSP, o RLS, o CI e a
cadeia de dependências. As varreduras E, G, H e I olharam cada lado com outra pergunta. Esta pergunta o que um
convidado hostil consegue fazer (decisão 3), que dado sai para quem não deveria vê-lo, e quem recebe uma
credencial provando o quê.
**Itens levantados:** — · **FAZER:** — · **ADIAR:** — · **DESCARTAR:** — *(a preencher na J.2)*
**Proporção FAZER:** — *(na J, quase todo FAZER é achado aberto: o texto vai ao ar junto com o conserto, nunca
antes — X.2)*

**Como é feito.** Leitura do código. Onde a leitura não basta, a reprodução: um roteiro com o `supertest` contra
o `app`, sem listener nem banco, a suíte de RLS no Supabase local e a API do GitHub para o estado do repositório.
Os roteiros ficam fora do repositório, porque servem para uma medição só. **A régua externa é o
[OWASP API Security Top 10](https://api-security.owasp.org/), edição 2023**, decidida pelo dono em 30/09. Ela é
régua de busca: só vira item o defeito achado numa rota real.

**As linhas citadas são as do `master` em `954ef0e`** (17/10/2026), o código varrido.

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
