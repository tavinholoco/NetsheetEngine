# Segurança — portão por fase e modelo de ameaça

> Documento vivo. O [`PLANO_MESTRE.md`](./PLANO_MESTRE.md) exige que **nenhuma fase de construção
> feche sem atualizar este arquivo**. Se uma fase entregou código e não mexeu aqui, ou não mudou nada
> relevante — o que é raro — ou o portão foi pulado.

---

## Por que portão por fase, e não uma fase de segurança

Todos os seis achados de segurança da auditoria de retomada nasceram do mesmo jeito: uma
funcionalidade foi construída e as perguntas de segurança não foram feitas **naquele momento**.

- **SEC-01** — o `/api/gemini` foi escrito para funcionar, e ninguém perguntou "quem pode chamar?"
- **SEC-05** — a ficha passou a ser sincronizada, e ninguém perguntou "isso é confiável?"
- **SEC-02** — a leitura da sala foi exposta, e ninguém perguntou "quem pode ler?"
- **SEC-04** — salas passaram a existir, e ninguém perguntou "quem as recolhe?"

Uma auditoria no fim encontra esses problemas — e é exatamente o que a **Fase J** faz. Mas encontrar
custa muito mais caro do que não introduzir. A prática corrente para times ágeis é rodar
[STRIDE de forma iterativa e timeboxed](https://blog.secureflag.com/2026/06/05/guide-to-stride-threat-model/)
sobre as mudanças de cada ciclo, alimentando **critérios de aceitação** e a **definição de pronto**,
em vez de uma análise monolítica no final. O portão abaixo é essa prática, reduzida ao tamanho de um
projeto solo.

**A Fase J continua existindo.** O portão previne; a varredura confere. São camadas diferentes, e a
segunda não substitui a primeira.

---

## O portão de segurança

Seis perguntas. Aplicadas **ao fechar cada fase de construção** (A, B, C, D, F, K, L, M — e todo
bloco de pendências que mude código, como o R da revisão pós-D), sobre o que
*aquela fase* mudou — nunca sobre o sistema inteiro. Timebox: 30 minutos. **As varreduras (E, G–J)
também passam, quando executam FAZER que muda código** — é o passo X.4 do
[roteiro de uma varredura](./PLANO_MESTRE.md#o-roteiro-de-uma-varredura) *(revisão de robustez,
29/09/2026: antes, o código que uma varredura mudava não passava por portão nenhum)*.

Cada pergunta mapeia uma categoria STRIDE e nasceu de um achado real deste repositório.

| # | Pergunta | STRIDE | Origem |
|---|---|---|---|
| **1** | Que **entrada nova** este trabalho aceita? Está validada no limite do servidor — tipo, faixa, tamanho, campos desconhecidos descartados? | Tampering | SEC-05 — a ficha era gravada verbatim, e o RNG autoritativo ficava sem efeito |
| **2** | Que **dado novo sai** do servidor? Quem pode lê-lo, e isso é **verificado** ou só presumido? | Information Disclosure | SEC-02 — a escrita era protegida por sessão, a leitura não |
| **3** | Que **autorização nova** existe? O autor da ação é derivado da **sessão**, nunca do corpo da requisição? **E quem recebe a sessão prova o quê?** — emitir credencial também é autorização | Spoofing / Elevation of Privilege | T1.7 e o `checkIsGm` que terminava em `return true`; a segunda metade nasceu do SEC-07 (revisão pós-D, 29/09/2026) |
| **4** | O que um **jogador convidado que virasse hostil** consegue fazer aqui? | Elevation of Privilege | Decisão 3 — este é o modelo de ameaça real do produto |
| **5** | Que **estado novo cresce sem limite**, e quem o recolhe? | Denial of Service | SEC-04 — salas, sessões e buckets do rate limiter nunca expiram |
| **6** | Isso adiciona **custo por requisição** a um serviço externo pago? | DoS / financeiro | SEC-01 — endpoint aberto na chave do dono |

### Sobre Repudiation

A letra R do STRIDE é deliberadamente leve aqui: não há transação financeira, e o chat carimba autor
e horário no servidor. O único ponto que importa é a **rolagem autoritativa** — o log de chat é a
trilha de auditoria que permite ao Mestre conferir um resultado. Se alguma fase mexer em como as
rolagens são registradas, a pergunta vira: *dá para provar depois que o servidor rolou aquilo?*

### Saída do portão

Uma entrada no [registro abaixo](#registro-por-fase), mesmo que curta. **"Nada mudou nessa frente"
é resposta válida** — o que não é válido é não ter perguntado.

Achado que vira trabalho entra na fase corrente. Achado que não justifica interromper vai para o
ledger da **Fase J** com gatilho escrito, seguindo o
[filtro de necessidade](./PLANO_MESTRE.md#-filtro-de-necessidade).

---

## Fronteiras de confiança

O desenho está em [`ARQUITETURA.md`](./ARQUITETURA.md#contêineres-e-fronteiras-de-confiança). As três
regras que ele expressa:

1. **Nada que venha do navegador é confiável** — nem a ficha, nem o `peerId`, nem o `woundLevel`, nem
   o binário Yjs. O servidor valida no limite.
2. **O autor de toda ação é derivado do `sessionToken`**, nunca de um campo do corpo. Um `peerId`
   livre na requisição não autentica nada. **Revisão pós-D (29/09/2026):** a regra valia para as
   ações, mas a **emissão** do token tinha o buraco — o `join` com um `peerId` que já está na sala
   entregava sessão nova sem prova de posse (SEC-07). Na prática, o `peerId` público autenticava.
   **Fechado na R.1:** reivindicar assento ocupado exige o token vigente dele.
3. **A `service_role` do Supabase e a chave do provedor de IA nunca cruzam a fronteira** — vivem só
   no processo do servidor, jamais em variável `VITE_`.

---

## Registro por fase

> Preencher ao fechar cada fase de construção. Formato: as seis respostas em uma linha cada, e o que
> virou trabalho.

### Fase A — Reancorar o projeto

**03/09/2026.** Nenhuma linha de código de produto mudou — documentação, configuração de deploy, uma
tag git e a ativação de um job de CI que já existia.

1. **Entrada nova?** Nenhuma. Nenhum endpoint, campo ou parâmetro novo.
2. **Dado novo exposto?** Nenhum. Os arquivos movidos (`fly.toml`/`railway.toml` →
   `docs/deploy-alternativas/`) não continham segredo — eram templates com `sync: false`/env vars
   sem valor. O `SUPABASE_PROJECT_REF` gravado como secret é identificador **público** (já vai no
   bundle do cliente); virou secret só porque é assim que o workflow o consome.
3. **Autorização nova? SIM — é o achado da fase.** O job `db-sync` deixou de ser inerte. O CI agora
   tem autoridade para **aplicar migrations no banco de produção** usando um PAT do Supabase guardado
   como secret do repositório. Consequência: quem consegue dar push no `master` — ou alterar o
   próprio workflow — altera o schema de produção. Hoje isso é só o dono, num repo sem branch
   protection.
4. **Jogador convidado hostil?** Sem mudança de superfície — nada nesta fase toca em `server.ts`,
   `roomManager` ou qualquer caminho que um jogador alcança. O `db-sync` não é acessível por jogador.
5. **Estado novo sem limite?** Nenhum.
6. **Custo por requisição a serviço externo?** **Quase.** O item A.5 original pedia ativar PITR no
   Supabase, recurso pago (plano Pro). Registrado como decisão 4 e **ADIAR**: o dono confirmou que
   fica no free tier, sem cartão vinculado a nada. Nenhum custo novo foi introduzido.

**O que virou trabalho:** o passo de verificação antes de ligar o `db-sync`. Confirmado por
`supabase migration list --linked` que as 6 migrations constam local **e** remoto — se tivessem sido
aplicadas à mão, ficariam fora da tabela de controle e o primeiro `db push` tentaria re-executá-las.

**Levado para a Fase J, com gatilho:** o caminho `push no master → schema de produção` não tem
aprovação humana no meio. **Gatilho:** quando um segundo colaborador ganhar permissão de push, ou
quando a primeira migration destrutiva (`DROP`/`ALTER ... DROP COLUMN`) for escrita. A mitigação
seria branch protection ou um GitHub Environment com aprovação — desproporcional para repo solo hoje.

**Nota de precisão (corrigida em 03/09/2026, após ler os logs do CI):** o DOC-03 dizia que os dois
secrets estavam pendentes. **Os dois já existiam** — o `SUPABASE_PROJECT_REF` aparece preenchido nos
logs de 02/09 e 03/09, e um secret vazio teria feito o job pular com `exit 0` em vez de falhar. Logo,
o `db-sync` não estava inerte: estava **vivo e falhando em todo push no `master`** desde 02/09,
porque o projeto Supabase tinha pausado. Ninguém notou porque a falha só ocorre pós-merge, nunca no
PR.

Registro do meu próprio erro, pelo mesmo motivo que o do plano: eu havia escrito aqui que só o token
existia, lendo a data do `gh secret list` como se fosse de criação quando é de **última atualização**.
Afirmação a partir de leitura, sem verificação. A checagem que desfez o engano foi ler o log do CI.

### Adendo — o workflow `keepalive.yml` (A.12)

Nasceu do conserto do CI e passa pelas mesmas seis perguntas:

1. **Entrada nova?** Nenhuma — roda por agendamento, sem receber dado externo.
2. **Dado novo exposto?** Nenhum. O `migration list` só lê a tabela de controle de migrations e a
   saída vai para o log do Actions, que é privado como o repositório.
3. **Autorização nova?** Não amplia nada: usa os mesmos dois secrets que o `db-sync` já usava.
   Vale registrar que **mais um workflow passa a ter acesso ao PAT do Supabase** — a superfície de um
   vazamento por workflow comprometido cresce de um job para dois.
4. **Jogador convidado hostil?** Fora de alcance — não há caminho do jogador até o Actions.
5. **Estado novo sem limite?** Não. Uma execução a cada 3 dias, sem escrita.
6. **Custo?** Zero em dinheiro. Consome minutos do GitHub Actions (~30 s a cada 3 dias) e existe
   justamente para *proteger* o custo zero, evitando que o projeto durma.

A tolerância a `project is paused` no `db-sync` é redução de ruído, não de rigor: se houver migration
pendente e o banco estiver dormindo, ela entra no push seguinte. O que a tolerância evita é um build
vermelho por motivo alheio ao commit.

### Fase B — Fechar os buracos de autorização

**03/09/2026.** Os seis achados fechados. Esta fase é a que mais mexeu em superfície de segurança do
projeto até aqui, então o portão vale mais que de costume.

1. **Entrada nova?** Muita, e toda validada no limite:
   - **A ficha** deixou de entrar verbatim — `src/rules/sheetSchema.ts` grampeia faixas, corta
     arrays e strings, remove item estruturalmente inválido e **constrói a saída campo a campo**, de
     modo que campo desconhecido não sobrevive. Aplicado no `roomManager`, não na rota, para cobrir
     todo caminho de escrita.
   - **O `prompt` da IA** ganhou tipo, obrigatoriedade e teto de 4.000 caracteres; o
     `systemInstruction` **saiu do contrato** e é descartado.
   - **Token por header e por query** (`X-Session-Token`, `?token=`) — ambos passam pelo mesmo
     `verifySession`.
   - **A coluna `sessions` lida no boot** é entrada não confiável como qualquer outra:
     `restoreRoomSessions` valida forma e ignora lixo em vez de criar sessão inválida.
2. **Dado novo sai?** No saldo, sai **menos**: leitura de sala e stream agora exigem sessão. O que
   entrou de novo:
   - *recorte público* para leitura sem token — mas é exatamente o que o lobby (`GET /api/rooms`) já
     expunha, então não abre nada novo;
   - *hashes de sessão no banco* — SHA-256, nunca o token, justamente para o dado em repouso não ser
     utilizável;
   - *três eventos de log*: `ai_request` (id do usuário — UUID pseudônimo), `sse_fallback` (peer +
     userAgent) e `sheet_sanitized` (caminhos de campo). Nenhum carrega segredo, ficha ou prompt.
3. **Autorização nova? SIM, e de um tipo que não existia.** O servidor não sabia verificar identidade
   de **conta** — só conhecia o `sessionToken` de mesa. Agora convivem duas credenciais de escopos
   diferentes: sessão de mesa (o que você pode fazer *nesta sala*) e JWT do Supabase (*quem você é*).
   A regra 2 da fronteira continua de pé: o autor vem sempre da credencial, nunca do corpo. A
   distinção está documentada no `PROTOCOLO_MULTIPLAYER.md` §2, inclusive por que o header é
   `X-Session-Token` e não `Authorization`.
4. **Jogador convidado hostil?** É onde a fase mais mudou o jogo. Antes ele podia ler qualquer sala
   sabendo o código, assinar o stream de qualquer mesa, forjar atributos e `woundLevel` na própria
   ficha, e usar o proxy de IA à vontade. Agora precisa de sessão **daquela** sala (testado com token
   válido de outra sala → 401), a ficha é grampeada, e a IA exige conta.
   **O que ele ainda consegue:** mandar uma ficha *plausível porém trapaceira* dentro dos limites
   (BODY 15, todas as perícias em 10). Isso é regra de jogo, não autorização — cabe às Fases C/K
   (orçamento de criação), e está registrado como tal, não como buraco de segurança.
5. **Estado novo sem limite?** O SEC-04 fechou os três que existiam. O estado **novo** que esta fase
   criou — a coluna `sessions` — cresce junto com a sala e é recolhido junto com ela pelo coletor,
   então nasce limitado por construção.
6. **Custo por requisição a serviço externo? SIM — e é o achado do portão.** A B.1 introduziu uma
   chamada ao Supabase Auth **por requisição de IA** (`auth.getUser`). É gratuita, mas é uma
   dependência nova no caminho quente: **se o Supabase estiver fora ou pausado, o Netrunner IA para**
   — por desenho, já que a alternativa seria degradar para "deixa passar" num endpoint que gasta a
   chave do dono. O custo do Gemini em si ficou *mais* contido: exige conta, 10 req/min por IP e
   prompt de no máximo 4.000 caracteres.

**Levado para a Fase J, com gatilho:**
- **Duas altas de `mathjs` aceitas conscientemente** (`scripts/audit-ci.mjs`). Cliente-only, fórmula
  do próprio usuário. **Gatilho:** rolador publicar 6.x estável, mathjs corrigir em versão aceita
  pela 5.5.x, ou alguma fórmula vinda da rede passar a ser avaliada no cliente.
- **A cadeia `express → body-parser → qs`** (3 moderadas) não tem patch na linha 4.x — 4.22.2 é a
  última publicada. **Gatilho:** sair um patch 4.x, ou a migração para Express 5 entrar em pauta por
  outro motivo. *(Gatilho disparado e fechado em 29/09/2026 — R.7: `express@4.22.3`, `qs@6.16.0`.)*
- **O binário Yjs continua sem validação** — a caixa `VAL` do diagrama cobre a ficha, não o CRDT.
  Segue como item da Fase J, agora explícito no `ARQUITETURA.md`.

### Fase C — Fonte única de regras

**25/09/2026.** Fase de regra, não de autorização — mas mexeu no caminho que o servidor usa para
decidir números, então o portão não é formalidade. O saldo de superfície é **negativo**: a fase
tirou mais confiança do cliente do que deu.

1. **Entrada nova?** Duas, as duas validadas no limite:
   - **O tipo de rolagem `stun`** (C.7). Passa pelo mesmo `sanitizeText(kind, 12)` e pela mesma
     cadeia fechada de `if`s — tipo desconhecido continua recusado (testado).
   - **O `weapon.type` passou a ser lido** (C.3), para achar a perícia. Casa por palavra contra uma
     lista fixa; tipo desconhecido vira `sem perícia para "X" (0)` no detalhe, com o texto cortado
     em 30 caracteres (além do teto que o `sheetSchema` já aplica). O detalhe é texto renderizado
     pelo React, sem HTML.
   - **E uma entrada deixou de ser confiada:** o `currentStats` do cliente. Até a Fase C era
     saneado e **guardado como veio**; agora o servidor o recalcula da ficha e descarta o do cliente.
   - **A fórmula de dano** continua vindo da ficha, e agora é lida por um parser estrito (`NdM±X`,
     até 20 dados de até 100 faces), **sem avaliar expressão** — o `mathjs` saiu do projeto.
2. **Dado novo sai?** Nada que a mesa já não visse. O detalhe da rolagem passou a mostrar o nome da
   perícia, o motivo do modificador do GM e o dado de fumble — os dois primeiros já estavam na ficha
   e no estado da sala transmitidos a todos. Nenhum segredo, nenhum dado de outra sala.
3. **Autorização nova?** Nenhuma. As rolagens seguem derivando o autor da sessão; o modificador do GM
   é lido da sala, onde só o GM escreve (`checkIsGm`, T1.1). O `stun` rola a ficha do próprio
   jogador, como o `save`.
4. **Jogador convidado hostil?**
   - **Fechado nesta fase:** forjar `currentStats` para rolar com REF 15 — o servidor ignora
     (testado: `table-rolls.integration`, "REF 15 forjado não entra").
   - **Continua podendo:** baixar o próprio `woundLevel` pela sincronia da ficha e rolar sem a
     penalidade de ferimento. Isso já existia (o jogador sempre editou o próprio Bio-Monitor), e só
     passou a *importar* agora que o ferimento entra na rolagem. É regra de jogo, não autorização —
     a Fase D decide quem escreve o `woundLevel` quando o dano virar ferimento sozinho.
   - **Não consegue:** travar o servidor com um RNG patológico (o RNG é do servidor; a explosão tem
     teto de 10 dados) nem com fórmula gigante (teto de 20d100).
5. **Estado novo sem limite?** Nenhum. A fase não criou estado persistente nem em memória. O detalhe
   de uma rolagem é limitado por construção: no máximo 11 dados e 5 parcelas.
6. **Custo por requisição a serviço externo?** Nenhum. A fase **removeu** uma dependência de produção
   (`@dice-roller`, e com ela o `mathjs`) e não adicionou chamada externa.

**O que o portão achou:** o item 4 acima — o `woundLevel` escrito pelo próprio jogador. **Levado à
Fase D com gatilho:** quando o `applyDamage` (D.1) existir, o `woundLevel` do jogador passa a ser
escrito pelo servidor a partir do dano, e a sincronia da ficha não pode mais baixá-lo. Se a D não
fizer isso, vira item da Fase J.

**Saiu da lista da Fase J:** as duas altas do `mathjs` (#1117167, #1117889). A ALLOWLIST do
`scripts/audit-ci.mjs` está vazia.

### Fase D — Loop de combate

**28/09/2026.** Fase de regra que deu ao GM **poderes novos sobre as fichas dos outros** — aplicar
dano, atacar pelo NPC, estabilizar, rolar a iniciativa de todos. O portão não é formalidade: é a
fase que mais mexeu em quem escreve o quê desde a B.

1. **Entrada nova?** Três rotas e uma ação, todas validadas no limite:
   - `POST /damage` — `targetId` (texto, 64), `raw` (número finito ≥ 0, teto 2 500), `location`
     (enum da tabela de local de impacto).
   - `POST /attack` — `attackerId` e `targetId` (texto, 64), `range` (enum de `RANGE_BANDS`) **ou**
     `difficulty` (inteiro 1–50). A fórmula de dano da arma do NPC passa pelo parser estrito
     **antes** de rolar qualquer dado.
   - `POST /stabilize` — `targetId`, `stabilized` (só `true` literal).
   - `initiative` com `action: "roll"`, pela rota e pelo WebSocket — sem corpo além da ação.
   - E três campos novos na ficha, saneados no `sheetSchema`: `damagePoints` (0–40), `isDead` e
     `isStabilized` (só `true` literal). Entrada inválida responde **400** com mensagem clara, não o 403
     genérico do `respondWithResult` (`respondToCombat` no `server.ts`).
2. **Dado novo sai?** Nada que a mesa já não visse. O chat passou a mostrar a conta do dano, o ataque
   do NPC com as parcelas (REF, perícia, WA) e as parcelas da iniciativa — as fichas dos NPCs **já**
   vão inteiras no estado da sala transmitido a todos. O local de impacto estruturado
   (`hitLocation`) é o mesmo que já saía no texto do detalhe.
3. **Autorização nova?** Sim, e é o centro da fase: o GM passa a **agir sobre a ficha dos outros** e
   a **rolar com a ficha do NPC**. As quatro ações passam por `checkIsGm` e o jogador recebe 403
   (testado em cada uma, pela função e pela rota). A rolagem continua do servidor (`crypto.randomInt`)
   — o GM escolhe **quem, onde e de onde**, nunca o número.
4. **Jogador convidado hostil?**
   - **Fechado nesta fase — o achado do portão C.14:** o jogador escrevia o próprio `woundLevel` pela
     sincronia da ficha e rolava sem a penalidade. Agora, na mesa, o ferimento (`damagePoints`,
     `woundLevel`, `isDead`) e a estabilização são **do servidor**: a sincronia e a reconexão mantêm
     os valores dele. **Provado revertendo** nos dois casos: sem as linhas novas, os testes da decisão
     7a e o do `isStabilized` falham.
   - **Fechado de passagem — `updateInitiative` gravava qualquer campo:** a entrada era `{ ...e }`, e
     qualquer campo do cliente virava estado da sala, persistido e transmitido, sem teto de tamanho.
     Só o GM chegava lá — mas o GM também é um convidado de quem cria a sala. Agora a entrada é
     montada campo a campo. **Provado revertendo:** com o corpo antigo, os 2 testes falham.
   - **Continua podendo — sair e voltar "curado":** o `leaveRoom` apaga o registro do jogador, e a
     volta é um **join novo**, que aceita o ferimento da ficha que o cliente trouxer. Exige editar a
     ficha fora da mesa de propósito, e o chat anuncia a entrada (não é reconexão silenciosa). **Vai
     para a Fase J**, com gatilho: um jogador aparecer inteiro depois de sair no meio de uma luta, ou
     a mesa passar a ter público fora dos convidados do dono. Conserto provável: guardar o ferimento de
     quem saiu, por sala, até ela expirar.
5. **Estado novo sem limite?** Nenhum criado. O chat do sistema respeita o teto de 100 mensagens (o
   `pushSystemMessage` corta como o `postChatMessage`); a iniciativa tem teto de 50 entradas. **Pista
   da Fase E:** a mensagem da iniciativa cresce com o número de combatentes, e a sala **não tem teto
   de NPCs** — anterior à fase (`generateRoomNpc`), só o GM gera, e o limitador de taxa segura o ritmo.
6. **Custo por requisição a serviço externo?** Nenhum. Uma mutação por ação do GM (o ataque inteiro
   do NPC — ataque, dano, local, ferimento e saves — é **uma** só), como o contrato de custo pedia; o
   broadcast da sala inteira (ARQ-01) não mudou de tamanho de forma relevante.

**O que o portão achou:** a porta lateral do item 4 (sair e voltar), levada à Fase J com gatilho; e
a falta de teto de NPCs, que vira pista da Fase E. **O achado da C.14 está fechado.**

### Revisão pós-D — o que o portão não pegou

**29/09/2026.** Não é portão de fase: é o registro de seis achados que **escaparam** aos portões da A
à D, achados numa revisão pedida pelo dono. Detalhe e provas na
[revisão pós-D do plano](./PLANO_MESTRE.md#-revisão-pós-d-29092026); consertos nas pendências R.

**Por que escaparam.** O portão pergunta sobre *o que a fase mudou*. O SEC-07, o SEC-08 e o SEC-09
nasceram antes dele (T1.7 e T3.3, no plano antigo). A Fase B **passou perto**: a B.3 exigiu sessão
para ler a sala, e o portão dela registrou "agora precisa de sessão **daquela** sala" — sem perguntar
**como** alguém consegue essa sessão. A resposta era: fazendo `join` com um `peerId` que o estado da
sala entrega a todos. A pergunta 3 ganhou a segunda metade — *quem recebe a sessão prova o quê?* — e a
Fase J passa a fazê-la para toda credencial.

| ID | Pergunta do portão que teria pegado | Por quê |
|---|---|---|
| SEC-07 | 3 (a nova metade) | A sessão era emitida por `join` a quem apresentasse um `peerId` público |
| SEC-08 | 4 | "O que um hostil faz aqui?" — `create` sem sessão, com código tirado do lobby |
| SEC-09 | 2 | "Quem pode ler?" — o expulso continuava com sessão e socket |
| SEC-10 | 5 e 6 | Estado sem teto (tamanho de quadro) e custo por requisição (banda do Render por mensagem) |
| SEC-11 | 5 | Os limitadores existiam, mas contavam o IP do proxy |
| SEC-12 | 3 | A posse do token era conferida contra o dono **depois** da mudança |

**Uma consequência de processo:** o repositório é **público** (conferido em 29/09). A partir desta
revisão, **achado aberto é publicado junto com o conserto**, e o portão ganha uma pergunta de
fechamento para PR de segurança: *o que este texto ensina a quem lê o código antes de o conserto
estar no ar?*

### Pendências R — revisão pós-D

**29/09/2026 — R.1 a R.6**, publicados num PR só, junto com a revisão que os descreve (o repo é
público: o texto vai ao ar com o conserto). R.7–R.9 respondem quando entrarem.

1. **Entrada nova?** Três, todas no limite do servidor:
   - o header `X-Session-Token` no `POST /join` (R.1) — passa pelo mesmo `verifySession` de toda
     rota, e só serve para provar **aquele** assento naquela sala;
   - o `X-Forwarded-For`, agora confiado **um salto** em produção (R.5). Com `trust proxy = 1` o
     Express usa a entrada que o proxy do Render acrescenta; o que o cliente puser à esquerda é
     ignorado. `TRUST_PROXY=true` é recusado de propósito;
   - os quadros do WebSocket ganharam teto de tamanho (1 MiB; *awareness* 4 KiB) e de taxa por
     jogador (R.4). Antes, 100 MiB e sem limite.
2. **Dado novo sai?** Pouco, e nada de outra pessoa: o `code` estável nas respostas de erro; o
   `clientIp` do `/api/health`, que devolve a quem pergunta **o próprio** IP; a lista
   `removedPeerIds` no estado da sala, que só tem `peerId`s — já públicos para quem está na mesa;
   e dois eventos de log (`ws_rate_limited`, `ws_awareness_too_big`) com sala, `peerId` e tamanho,
   sem segredo nem conteúdo.
3. **Autorização nova? Sim — e é a segunda metade da pergunta, que nasceu aqui.** A **emissão** de
   sessão passou a exigir prova: reivindicar assento ocupado só com o token vigente dele (R.1). A
   expulsão passou a **revogar** (R.3). O GM não remove a si mesmo. No grid, a posse é a do dono
   **anterior**, e todo campo além de `x`/`y` é do GM (R.6). Cada uma provada revertendo.
4. **Jogador convidado hostil?**
   - **Não consegue mais:** tomar o GM ou o assento de outro (R.1); apagar a mesa pelo `create`
     (R.2); continuar lendo depois de expulso, nem voltar sozinho pela reconexão (R.3); mandar
     mensagens sem limite ou quadros gigantes pelo WS (R.4); gastar a cota dos outros jogadores no
     limitador (R.5); mover ou tomar o token de outro (R.6).
   - **Continua conseguindo:** ler fichas e chat enquanto estiver na mesa, e entrar de novo por uma
     aba nova depois de expulso — sem conta, aba nova é outro jogador (**R.11**); assumir o GM pelo
     *handle* quando o GM sai e ninguém fica online (variante do SEC-07, **ADIAR** com gatilho na R.1);
     gastar a banda **no ritmo do REST** — menos de 3 h para os 5 GB, em vez de ~35 min (**L.1** e
     **R.11**).
   - **Achado deste portão — SEC-13, sala sem teto de assentos.** Cada `join` com `peerId` novo cria
     um assento, e cada assento abre até 3 sockets; o `join` só tem o limitador de sala (120/min por
     IP). Dezenas de assentos multiplicam cada reenvio da sala — o mesmo amplificador do SEC-10 por
     outra porta, e a mesma família da "sala sem teto de NPCs" que o portão da D levou à Fase E. Não
     reproduzido. Versão 10× menor: teto de assentos por sala (uma mesa real tem até ~8). Vai para o
     bloco R como **R.16**, antes da primeira sessão em produção.
5. **Estado novo sem limite?** Nenhum: `removedPeerIds` tem teto de 50 e é saneado no restore; os
   baldes do limitador do WS vencem com a janela e são podados de forma amortizada (não somem no
   `close`, senão reconectar zeraria a cota); `ssePeer` e `wsPeer` são `WeakMap` — somem com a
   conexão.
6. **Custo por requisição a serviço externo?** Nenhum novo. O saldo é **negativo**: o canal sem
   limite que gastava a banda do Render em minutos foi fechado.

**E a pergunta que o repo público impõe — o que este PR ensina antes de o conserto estar no ar?**
Tudo o que descreve, **se** o `master` não tiver o conserto quando o Render voltar (01/10). Por isso o
PR traz o texto **e** o código juntos, e a recomendação ao dono é mergear antes de 01/10.

**29/09/2026 — R.16, R.7, R.8 e R.9** (o PR seguinte, depois do merge do #14):

1. **Entrada nova?** Nenhuma. A R.16 **recusa** entrada: `join` de assento novo numa sala com 16
   assentos → 409 `room_full`, e a geração de ficha pelo GM para no mesmo teto.
2. **Dado novo sai?** Nenhum além da mensagem do 409 (o número de lugares, que é constante do código).
   O `/api/health` passa a publicar `0.4.3` em vez de `0.4.0` — a versão certa, sem dado novo.
3. **Autorização nova?** Nenhuma. O teto vale para todo mundo, GM incluído — e **quem já tem assento
   sempre volta ao seu**, então a sala cheia não tranca ninguém fora do próprio lugar.
4. **Jogador convidado hostil?** Não multiplica mais os reenvios abrindo assentos: são no máximo 16,
   com até 3 sockets cada (**48 por sala**). Pode **ocupar** os lugares vazios para impedir outros de
   entrar — o GM o remove, e a R.3 impede a volta pelo mesmo `peerId`; com o lobby aberto, é mais um
   motivo para a **R.11**.
5. **Estado novo sem limite?** O contrário: `room.players` ganhou teto — inclusive as fichas geradas
   pelo GM, que não tinham. `room.npcs` continua sem teto (pista da E; NPC não abre socket).
6. **Custo por requisição a serviço externo?** Nenhum. **Dependências (R.7):** `express` 4.22.3,
   `body-parser` 1.20.8, `qs` 6.16.0 em produção; `npm audit` com **0** vulnerabilidades. **Runtime
   (R.8):** Node 24 (LTS) fixado no `.node-version`, o mesmo arquivo para o Render e o CI — a produção
   deixa de rodar uma versão que o CI nunca testou.

**O que ensina antes de o conserto estar no ar?** O SEC-13 fica descrito neste PR; o Render volta em
01/10 e publica o `master`. Mesma recomendação do #14: mergear antes.

**29/09/2026 — R.10, o backup manual** (decisão 8). Não muda o produto, mas cria uma ferramenta que lê
o banco de produção inteiro — e isso passa pelo portão:

1. **Entrada nova?** Só a variável `NETSHEET_BACKUP_DIR` (o destino), na máquina do dono. O script
   recusa qualquer destino dentro do repositório.
2. **Dado novo sai? Sim — é o achado do portão, e é o propósito da ferramenta.** O `data.sql` leva do
   banco para o disco do dono **todo** o dado, inclusive `auth.users` (e-mail e hash de senha), perfis e
   mensagens diretas. Quem lê: quem tiver o arquivo. Por isso: destino **fora do repo** (público),
   verificado no código e barrado de novo no `.gitignore`; o runbook manda guardar fora da máquina e
   **cifrado**, com a senha num gerenciador; e o `MANIFEST.txt` conta linhas **sem** copiar conteúdo.
   *Hoje o dump não tem dado pessoal nenhum — a produção ainda não tem usuário.*
3. **Autorização nova?** Nenhuma. Usa o login do CLI que já existe na máquina do dono — o mesmo que
   verificou a `0007` em produção. Nada vai para o CI nem ganha secret novo.
4. **Jogador convidado hostil?** Fora de alcance: não há caminho do jogador até o script.
5. **Estado novo sem limite?** Os dumps acumulam no disco do dono, **por escolha**: um por mês e um por
   migration. O registro em `BACKUP.md` diz quantos existem.
6. **Custo?** Zero. O dump puxa ~30 kB hoje, e a banda de saída do Supabase gratuito é de GB.

**Efeito colateral de operação:** o dump usa o mesmo papel temporário do CLI (`cli_login_postgres`) que
o `db-sync` e o keepalive. Rodar junto derruba a senha do outro (`28P01`) — o runbook e o cabeçalho do
script avisam.

**29/09/2026 — R.11, a sala sai do lobby** (decisão do dono; impõe a decisão 3):

1. **Entrada nova?** Nenhuma. O código de sala aceita até 24 caracteres (eram 12) — mesma regex,
   mesmo alfabeto, validado no limite como antes.
2. **Dado novo sai? Sai menos — é o propósito.** A rota `GET /api/rooms`, que entregava a qualquer
   visitante o código, o nome, o GM e o número de jogadores de toda sala, **saiu**. O `/api/health`
   segue com contagens, sem código. O recorte público do `GET /api/rooms/:code` (B.3) continua, mas
   agora exige saber o código — que é o convite.
3. **Autorização nova?** Nenhuma nova; a de sempre ficou **mais difícil de alcançar**: o código deixou
   de ser adivinhável. Seis símbolos de 31, de Web Crypto (~30 bits); com o limitador do `join` (120/min
   por IP) e o `trust proxy` (R.5), chutar uma sala leva anos.
4. **Jogador convidado hostil?** Continua podendo o que um convidado pode — e **repassar o convite**.
   O que muda é o **visitante não convidado**: não vê mais sala nenhuma, e não adivinha código. O sufixo
   é gerado **no cliente**: quem cria sala por fora da interface com código fraco só expõe a própria
   mesa. **Variante do SEC-07 (GM pelo *handle*):** o *handle* do GM saiu do lobby — só quem tem o
   código o vê. O ADIAR fica, e o gatilho não disparou.
5. **Estado novo sem limite?** Nenhum. E um *timer* a menos: o *polling* do lobby a cada 8 s.
6. **Custo?** **Menor:** o lobby parou de consultar o servidor a cada 8 s — era uma das duas coisas que
   mantinham o Render acordado (risco 1 do contrato de custo zero).

**Junto, fora da segurança:** a interface mostrava "v0.4.0" escrito à mão em seis lugares; agora lê o
`package.json` (continuação do R.9).

### Fase E — Varredura: backend

**30/09/2026 — SEC-14 e SEC-15**, achados na varredura (E.02 e E.03 do
[ledger](./varreduras/E-backend.md)), **reproduzidos antes** e consertados num PR próprio, a pedido do
dono, antes do ledger: o Render volta em 01/10 e publica o `master`. O ledger público os tem em uma
linha; o texto inteiro é este, e vai ao ar com o conserto. Os outros FAZER da E respondem ao portão
quando entrarem.

**SEC-14 — um grid malformado derrubava o servidor inteiro** 🔴. O grid tem duas portas de escrita —
a rota REST (fallback do GM) e o doc Yjs (todo jogador, ao vivo) — e nenhuma conferia a **forma** do
que entrava; a R.6 conferiu *quem* pode mudar o quê, não *o que* é um token. O reenvio da sala espelha
o JSON no doc Yjs a cada mutação, e um grid que o espelho não entendia fazia o `broadcastRoomUpdate`
lançar. Reproduzido em 30/09:
- **qualquer visitante, sem login:** o servidor não exige login para criar sala (só a tela exige), então
  ele é GM da própria sala; abre o socket e manda `tokens: 5` pela REST → `500`, e daí em diante chat e
  rolagem da sala → `500`;
- **qualquer jogador convidado:** um update Yjs com um item que não é token no array do grid → a mesma
  trava;
- **e o processo cai:** o vigia de presença chama o mesmo reenvio dentro de um `setInterval`, sem `try`.
  Quando alguém da sala cai para offline (~75 s), a exceção escapa do timer e o Node sai com código 1 —
  **visto com o `npm run dev`**, com o stack em `gridDoc.ts` ← `seedDocFromJson` ←
  `broadcastRoomUpdate` ← o timer. Todas as mesas juntas, repetível a cada restart.

**Conserto, em duas camadas:** (1) a forma é validada nas duas portas, pela mesma regra
(`src/lib/gridDoc.ts`): a REST responde `400 invalid_grid` e grava o grid campo a campo; o Yjs reverte
— GM inclusive, porque validar forma não é autorização —, e o revert apaga o lixo do doc. Só o que
**mudou** é conferido: dado velho que ninguém tocou não reverte movimento legítimo. (2) O reenvio
nunca deixa o espelho escapar (o doc é descartado e renasce do JSON, que é a verdade durável), e o
vigia e o coletor pegam erro por sala. `grid-integrity.integration` (9). **Provado revertendo:** com o
código antigo, 8 falham; só a validação revertida, 5; só o isolamento, os 2 dele. E o mesmo ataque do
`npm run dev`, depois do conserto: `400`, e o servidor no ar por mais de 2 min.

**SEC-15 — o tamanho da mesa não tinha teto** 🟠. A R.4 e a R.16 limitaram o ritmo e os assentos; o
tamanho do que o servidor guarda e reenvia seguia livre. Medido e reproduzido em 30/09:
- **salas sem teto**, ~4 KB de memória e ~3,9 KB no banco cada: um IP, no ritmo do limitador (120/min),
  cria ~172 mil por dia — ~680 MB de heap numa instância de **512 MB** e ~650 MB no banco, acima dos
  **500 MB** do Supabase gratuito, que então entra em
  [modo só-leitura](https://supabase.com/docs/guides/platform/database-size). E o restore trazia tudo
  de volta no boot, 15 min antes da primeira volta do coletor;
- **ficha saneada de até ~557 KB** (a do gerador tem 2,7 KB): 16 assim fazem uma sala de ~8,7 MB,
  reenviada a até 48 sockets;
- **NPCs sem teto; chat** com teto em dois caminhos e oito `push` sem (as pistas da E.1b);
- **socket que não lê:** cada reenvio ficava no buffer do servidor. Com 3 sockets parados, o heap vivo foi
  de 49 a 156 MB em 100 reenvios, linear. Com os 48 sockets de uma sala, segundos até o teto.

**Conserto:** 30 salas (`MAX_ROOMS` no painel muda sem deploy) → `503 rooms_full`; 32 NPCs por sala →
`409 npcs_full`; ficha saneada de 64 KB → `413 sheet_too_large`; chat de 100 por um caminho só
(`pushChat`); socket com mais de 1 MiB esperando é derrubado, no WS e no SSE (`slow_consumer_closed`);
o restore não traz sala abandonada nem passa do teto. `room-limits.integration` (9). **Provado
revertendo:** neutralizado um teto por vez, falham exatamente os testes dele.

**Portão — as seis perguntas sobre este código:**

1. **Entrada nova?** Nenhuma nova; duas que já existiam passaram a ser **conferidas** — o `gridState` da
   REST e o update Yjs do grid (forma, tamanho, tipo de cada campo, só os campos de token). E a ficha
   ganhou teto de tamanho.
2. **Dado novo sai?** Nenhum: quatro `code` estáveis nas respostas de erro (`invalid_grid`, `rooms_full`,
   `npcs_full`, `sheet_too_large`) e cinco eventos de log (`yjs_seed_failed`, `grid_update_rejected`,
   `room_sweep_failed`, `rooms_full`, `slow_consumer_closed`) com sala, `peerId` e tamanho — sem
   conteúdo nem segredo.
3. **Autorização nova?** Nenhuma. A validação de forma vale para todo mundo, GM incluído — ela não
   decide quem pode, decide o que é um grid.
4. **Jogador convidado hostil — ou visitante, que cria a própria sala?** Não derruba mais o processo
   (nem pela REST, nem pelo Yjs), não trava a sala dos outros, não enche a memória nem o banco com salas,
   fichas, NPCs ou chat, e não prende reenvios num socket parado. **Continua podendo:** ocupar as 30
   vagas de sala — o GM legítimo fica sem criar mesa até o coletor liberar (24 h) ou o dono subir
   `MAX_ROOMS` no painel; é o preço aceito do teto (versão 10× menor), registrado no `DEPLOY.md`. E
   abrir sockets em várias salas: o teto de buffer é **por socket**, e o número total de sockets não tem
   teto global — ADIAR abaixo.
5. **Estado novo sem limite?** O contrário: salas, NPCs, ficha, chat e buffer de socket ganharam teto.
6. **Custo por requisição a serviço externo?** Menor: o banco deixa de receber linhas sem fim, e o
   restore apaga as abandonadas.

**Decisão do dono (30/09) — criar sala exigir login no servidor: não agora.** A tela já exige; o servidor
não. Os tetos fecham o esgotamento com ou sem login, e cadastro no Supabase é aberto — o login seria
atrito e rastro, não barreira. **ADIAR — gatilho:** `rooms_full` no log de produção sem o dono ter
criado as salas, ou a mesa abrir para gente de fora dos convidados.

**ADIAR — teto global de sockets.** Com o teto por socket, o pior caso é o número de sockets vezes
~1 MiB mais uma sala. **Gatilho:** a memória do serviço passar de ~400 MB no painel do Render, ou um
reinício por falta de memória. Vai para a J.1e (*backpressure*), que já pergunta isso.

**O que este PR ensina antes de o conserto estar no ar?** Tudo o que descreve — e o texto vai **junto**
com o código, nunca antes. O Render volta em 01/10 e publica o `master`: a recomendação é mergear
antes. Até lá o serviço está suspenso, e a produção não tem usuário nenhum.

**30/09/2026 — E.3c–e** (os outros FAZER da E: códigos de erro, a vez na iniciativa, o horário do
chat). Fecha a **E.4**.

1. **Entrada nova?** Nenhuma. Uma entrada que era aceita passou a ser **recusada**: `POST /initiative`
   sem `action` nem lista respondia 200 e reenviava a sala a todos, **sem conferir se quem pedia era o
   GM** — agora `400 invalid_input`.
2. **Dado novo sai?** Um `code` em toda resposta de erro — constante do servidor, sem dado de ninguém.
   As mensagens trocaram o inglês pelo português. A rota `/api` desconhecida responde 404 em JSON em todo
   ambiente (antes, em dev e nos testes, o Express respondia HTML). Nenhum código novo distingue algo que
   antes não se distinguia: `room_not_found` é o mesmo 404 de antes, e `session_invalid`, o mesmo 401.
3. **Autorização nova?** Nenhuma. Os mesmos `gm_only`, agora com código; o único caminho sem conferência
   de GM que existia (a iniciativa vazia) fechou.
4. **Jogador convidado hostil?** Quem tem a vez e **sai da mesa** passa a vez ao seguinte — e, se ele está
   em Mortal, o death save do turno dele é rolado na hora, como o GM faria virando o turno. Sair e voltar
   não o põe de volta na iniciativa (o GM rola de novo), então não dá para "girar" a vez de ninguém. Nada
   além disso.
5. **Estado novo sem limite?** Nenhum.
6. **Custo por requisição a serviço externo?** Nenhum.

**O que este PR ensina antes de o conserto estar no ar?** Nada de segurança aberta: são correções de
contrato e de regra, sem achado de segurança.

### Fase F — Reestruturação visual

**30/09/2026 — F.0 (PR 1: as fontes e as guardas).** A F vai ao ar em três PRs, e cada um publica
sozinho — por isso uma entrada por PR, como na E. O F.5 fecha a fase inteira.

1. **Entrada nova?** Nenhuma. As fontes são arquivos estáticos do build; o servidor não aceita nada novo.
2. **Dado novo sai?** Nenhum do servidor. **Sai um dado a menos:** o navegador do jogador deixava de
   pedir a folha ao `fonts.googleapis.com` porque o CSP a recusava — mas a intenção do código era pedir,
   com o IP e o *referer* do jogador indo ao Google. Agora a fonte vem do próprio origin, e o
   `font-src 'self'` passou a descrever o que o app faz, em vez de só barrar.
3. **Autorização nova?** Nenhuma.
4. **Jogador convidado hostil?** Nada muda para ele.
5. **Estado novo sem limite?** Nenhum. O `dist/` cresce com 26 arquivos de fonte (13 `woff2` e 13
   `woff`, todos os subconjuntos), mas o `unicode-range` faz o navegador baixar só o `latin` — medido: três
   arquivos, ~15 KB cada, na ficha.
6. **Custo por requisição a serviço externo?** Nenhum externo. A banda das fontes sai do Render: ~40–80 KB
   por aparelho, uma vez, com o nome do arquivo com *hash*. Longe dos 5 GB do workspace.

**Dependências novas:** `@fontsource/rajdhani` e `@fontsource/share-tech-mono` 5.3.0 — só CSS e fontes,
**sem código executável** e sem dependência transitiva; licença OFL-1.1. `npm audit`: 0.

**Guarda nova:** o E2E `fonts-csp` falha com **qualquer** violação de CSP nas três telas principais. Até
aqui o CSP de produção não era exercitado por nenhum teste — o helmet é pulado em dev.

**O que este PR ensina antes de o conserto estar no ar?** Nada de segurança: o ARQ-09 é um bug de
apresentação, e o CSP ficou como estava.

**30/09/2026 — F.2 mecânica (PR 2: os tokens, a conversão e o brilho).**

1. **Entrada nova?** Nenhuma. Só nomes de classe e variáveis de CSS.
2. **Dado novo sai?** Nenhum.
3. **Autorização nova?** Nenhuma.
4. **Jogador convidado hostil?** Nada muda para ele.
5. **Estado novo sem limite?** Nenhum. O CSS cresce ~7 kB (de 15,8 para 16,8 kB com gzip) com as rampas.
6. **Custo por requisição a serviço externo?** Nenhum.

**Scripts novos** (`scripts/migrate-colors.ts`, `scripts/color-map.json`): rodam só na máquina de
quem migra, leem e escrevem arquivos de `src/`, sem rede e sem segredo. Não entram no build.

**O que este PR ensina antes de o conserto estar no ar?** Nada de segurança: é refatoração visual,
provada por captura sem mudança de tela.

*F.1, F.2b, F.3 e F.4: a preencher no F.5.*

### Fases G, H, I e J — varreduras

*(cada uma a preencher no seu passo X.4 — só se a execução dos FAZER mudar código)*

### Fase K — Profundidade de sistema

*(a preencher)*

### Fase L — Performance e escala

*(a preencher)*

### Fase M — Validação e encerramento

*(a preencher)*

---

## Estado dos achados de segurança

Atualizar conforme forem fechados. Detalhe completo no
[índice de achados](./PLANO_MESTRE.md#-índice-de-achados).

| ID | Achado | Fase | Estado |
|---|---|---|---|
| SEC-01 | `/api/gemini` sem autenticação, com `systemInstruction` do cliente | B | ✅ fechado 03/09 (B.1) |
| SEC-02 | Leitura de sala e stream SSE sem sessão | B | ✅ fechado 03/09 (B.3) |
| SEC-03 | Sessões só em memória — restart derruba as mesas | B | ✅ fechado 03/09 (B.4) |
| SEC-04 | Salas, sessões e buckets nunca expiram | B | ✅ fechado 03/09 (B.5) |
| SEC-05 | Ficha gravada sem validação | B | ✅ fechado 03/09 (B.2) |
| SEC-06 | 6 vulnerabilidades em dependências de produção — **três pacotes**: `qs`, `mathjs`, `nanoid` | B | ✅ fechado 03/09 (B.6) — `nanoid` corrigido; `qs`/`express` sem patch 4.x (3 moderadas, não bloqueiam). **`mathjs` saiu da árvore em 25/09 (C.1)**, com o `@dice-roller`; a ALLOWLIST ficou vazia. **`qs` fechado em 29/09 (R.7):** o gatilho disparou com o `express@4.22.3`; `npm audit` com **0** vulnerabilidades |
| SEC-07 | `join` com `peerId` existente emite sessão sem prova de posse — tomada de GM | R | ✅ fechado 29/09 (R.1) — variante do *handle* do GM: ADIAR |
| SEC-08 | `create` com código existente substitui a sala | R | ✅ fechado 29/09 (R.2) |
| SEC-09 | Expulsão não revoga sessão nem fecha socket | R | ✅ fechado 29/09 (R.3) — sem conta, aba nova é outro jogador (R.11) |
| SEC-10 | WebSocket sem limitador por mensagem, `maxPayload` de 100 MiB | R | ✅ fechado 29/09 (R.4) — o ritmo do REST ainda gasta a banda em horas (L.1, R.11) |
| SEC-11 | Sem `trust proxy`: limitadores contam o IP do proxy | R | ✅ fechado no código 29/09 (R.5) — **conferir no ar** com o `clientIp` do `/api/health` |
| SEC-12 | Posse de token no grid Yjs conferida contra o dono novo | R | ✅ fechado 29/09 (R.6) — reproduzido antes, com cliente Yjs real |
| SEC-13 | Sala sem teto de assentos: cada assento abre até 3 sockets e recebe cada reenvio | R | ✅ fechado 29/09 (R.16) — 16 assentos, contando as fichas geradas; `room.npcs` segue sem teto (pista da E) — *teto de NPCs no SEC-15* |
| SEC-14 | Grid malformado (REST ou Yjs) trava a sala e, pelo vigia de presença, **derruba o processo** — sem login | E | ✅ fechado 30/09 (E.02) — forma validada nas duas portas; reenvio e vigia isolados |
| SEC-15 | O tamanho da mesa não tinha teto: salas, NPCs, ficha, chat e buffer de socket lento | E | ✅ fechado 30/09 (E.03) — teto global de sockets: ADIAR, na J.1e |

---

## O que já está no lugar

Registrado para não ser refeito, e para o portão não repetir pergunta já respondida:

- **Sessão por token** (T1.7) — o autor de toda mutação vem do `sessionToken`, e o WebSocket valida
  no upgrade (HTTP 401 se inválido). Desde a R.1 a **emissão** também tem prova: reivindicar um
  assento ocupado exige o token vigente dele (antes, o `peerId` público bastava — SEC-07).
- **Autorização de GM sem fallback permissivo** (T1.1) — `checkIsGm` não termina mais em `return true`.
- **RLS no Supabase** — migrations 0001–0007, com suíte de 56 testes (`scripts/test-rls.mjs`). A
  `rooms` tem RLS ligada e zero policies: só a service role.
- **Rate limit** — global (600/min), de sala (120/min) e de chat (30/min), com buckets separados por
  limiter, contando o IP real atrás do proxy do Render (`trust proxy`, R.5). O **WebSocket** tem os
  mesmos tetos por jogador, mais teto de quadro e de sockets (R.4, `server/wsLimits.ts`).
- **Tetos de tamanho** (E.03 — SEC-15): 30 salas abertas, 32 NPCs por sala, ficha de 64 KB, chat de 100
  por um caminho só, 1 MiB de reenvios esperando por socket. E a **forma do grid** conferida nas duas
  portas, REST e Yjs (E.02 — SEC-14). Números em `server/roomManager.ts`, `server/wsLimits.ts` e
  `src/lib/gridDoc.ts`, com o porquê.
- **helmet + CSP** em produção, CORS por allowlist via `CORS_ORIGINS`.
- **gitleaks** no CI, com SARIF na aba Security, e hook de pre-commit opcional.
- **Rolagens server-authoritative** (T5.4) — o cliente pede, o servidor rola com `crypto.randomInt`.
  O SEC-05 (ficha verbatim) foi fechado na B.2, e o `currentStats` forjado na C.6: os números da
  rolagem saem da ficha saneada, recalculados pelo servidor, com as mesmas regras do cliente
  (`src/rules/`, paridade testada na C.10).
- **Logs estruturados** que nunca registram segredos (`server/logger.ts`).
