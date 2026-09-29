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
*aquela fase* mudou — nunca sobre o sistema inteiro. Timebox: 30 minutos.

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
   livre na requisição não autentica nada. **⚠️ Revisão pós-D (29/09/2026):** a regra vale para as
   ações, mas a **emissão** do token tinha o buraco — o `join` com um `peerId` que já está na sala
   entregava sessão nova sem prova de posse (SEC-07). Na prática, o `peerId` público autenticava.
   Conserto na R.1 do plano.
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
  outro motivo.
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

*(a preencher na R.14)*

### Fase F — Reestruturação visual

*(a preencher)*

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
| SEC-06 | 6 vulnerabilidades em dependências de produção — **três pacotes**: `qs`, `mathjs`, `nanoid` | B | ✅ fechado 03/09 (B.6) — `nanoid` corrigido; `qs`/`express` sem patch 4.x (3 moderadas, não bloqueiam). **`mathjs` saiu da árvore em 25/09 (C.1)**, com o `@dice-roller`; a ALLOWLIST ficou vazia. **Gatilho do `qs` disparou em 29/09:** saiu o `express@4.22.3` (`qs ~6.16.0`) — R.7 |
| SEC-07 | `join` com `peerId` existente emite sessão sem prova de posse — tomada de GM | R | 🔴 **aberto** — reproduzido em 29/09; R.1 |
| SEC-08 | `create` com código existente substitui a sala | R | 🟠 **aberto** — reproduzido em 29/09; R.2 |
| SEC-09 | Expulsão não revoga sessão nem fecha socket | R | 🟡 **aberto** — reproduzido em 29/09; R.3 |
| SEC-10 | WebSocket sem limitador por mensagem, `maxPayload` de 100 MiB | R | 🟠 **aberto** — R.4 |
| SEC-11 | Sem `trust proxy`: limitadores contam o IP do proxy | R | 🟡 **aberto** — conferir em produção; R.5 |
| SEC-12 | Posse de token no grid Yjs conferida contra o dono novo | R | 🟡 **aberto** — lido, não reproduzido; R.6 |

---

## O que já está no lugar

Registrado para não ser refeito, e para o portão não repetir pergunta já respondida:

- **Sessão por token** (T1.7) — o autor de toda mutação vem do `sessionToken`, e o WebSocket valida
  no upgrade (close 4401 se inválido). *⚠️ A **emissão** do token por `join` não exigia prova de
  posse do `peerId` — SEC-07, aberto (R.1).*
- **Autorização de GM sem fallback permissivo** (T1.1) — `checkIsGm` não termina mais em `return true`.
- **RLS no Supabase** — migrations 0001–0007, com suíte de 56 testes (`scripts/test-rls.mjs`). A
  `rooms` tem RLS ligada e zero policies: só a service role.
- **Rate limit** — global (600/min), de sala (120/min) e de chat (30/min), com buckets separados por
  limiter. *⚠️ Só no REST: o WebSocket não tem limitador (SEC-10), e sem `trust proxy` o balde é o
  IP do proxy (SEC-11) — R.4 e R.5.*
- **helmet + CSP** em produção, CORS por allowlist via `CORS_ORIGINS`.
- **gitleaks** no CI, com SARIF na aba Security, e hook de pre-commit opcional.
- **Rolagens server-authoritative** (T5.4) — o cliente pede, o servidor rola com `crypto.randomInt`.
  O SEC-05 (ficha verbatim) foi fechado na B.2, e o `currentStats` forjado na C.6: os números da
  rolagem saem da ficha saneada, recalculados pelo servidor, com as mesmas regras do cliente
  (`src/rules/`, paridade testada na C.10).
- **Logs estruturados** que nunca registram segredos (`server/logger.ts`).
