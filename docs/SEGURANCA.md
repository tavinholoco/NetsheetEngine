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

Seis perguntas. Aplicadas **ao fechar cada fase de construção** (A, B, C, D, F, K, L, M), sobre o que
*aquela fase* mudou — nunca sobre o sistema inteiro. Timebox: 30 minutos.

Cada pergunta mapeia uma categoria STRIDE e nasceu de um achado real deste repositório.

| # | Pergunta | STRIDE | Origem |
|---|---|---|---|
| **1** | Que **entrada nova** este trabalho aceita? Está validada no limite do servidor — tipo, faixa, tamanho, campos desconhecidos descartados? | Tampering | SEC-05 — a ficha era gravada verbatim, e o RNG autoritativo ficava sem efeito |
| **2** | Que **dado novo sai** do servidor? Quem pode lê-lo, e isso é **verificado** ou só presumido? | Information Disclosure | SEC-02 — a escrita era protegida por sessão, a leitura não |
| **3** | Que **autorização nova** existe? O autor da ação é derivado da **sessão**, nunca do corpo da requisição? | Spoofing / Elevation of Privilege | T1.7 e o `checkIsGm` que terminava em `return true` |
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
   livre na requisição não autentica nada.
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

**Nota de precisão:** o DOC-03 dizia que os dois secrets estavam pendentes; na verificação, o
`SUPABASE_ACCESS_TOKEN` já existia desde 25/08. O achado tinha sido redigido a partir do comentário
no `ci.yml`, não de checagem real — mesmo padrão do PITR, que foi planejado sem verificar que exigia
plano pago.

### Fase B — Fechar os buracos de autorização

*(a preencher — esta fase existe justamente para zerar SEC-01 a SEC-06)*

### Fase C — Fonte única de regras

*(a preencher)*

### Fase D — Loop de combate

*(a preencher)*

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
| SEC-01 | `/api/gemini` sem autenticação, com `systemInstruction` do cliente | B | ⬜ aberto |
| SEC-02 | Leitura de sala e stream SSE sem sessão | B | ⬜ aberto |
| SEC-03 | Sessões só em memória — restart derruba as mesas | B | ⬜ aberto |
| SEC-04 | Salas, sessões e buckets nunca expiram | B | ⬜ aberto |
| SEC-05 | Ficha gravada sem validação | B | ⬜ aberto |
| SEC-06 | 6 vulnerabilidades em dependências de produção | B | ⬜ aberto |

---

## O que já está no lugar

Registrado para não ser refeito, e para o portão não repetir pergunta já respondida:

- **Sessão por token** (T1.7) — o autor de toda mutação vem do `sessionToken`, e o WebSocket valida
  no upgrade (close 4401 se inválido).
- **Autorização de GM sem fallback permissivo** (T1.1) — `checkIsGm` não termina mais em `return true`.
- **RLS no Supabase** — migrations 0001–0006, com suíte de 56 testes (`scripts/test-rls.mjs`).
- **Rate limit** — global (600/min), de sala (120/min) e de chat (30/min), com buckets separados por
  limiter.
- **helmet + CSP** em produção, CORS por allowlist via `CORS_ORIGINS`.
- **gitleaks** no CI, com SARIF na aba Security, e hook de pre-commit opcional.
- **Rolagens server-authoritative** (T5.4) — o cliente pede, o servidor rola com `crypto.randomInt`.
  *Vale lembrar que o SEC-05 contorna essa garantia por outro caminho.*
- **Logs estruturados** que nunca registram segredos (`server/logger.ts`).
