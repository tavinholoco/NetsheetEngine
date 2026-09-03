# 🗺️ PLANO MESTRE — NETSHEET ENGINE

> **Documento mestre do projeto a partir de 02/09/2026.** Substitui o
> [`PLANO_DE_ACAO.md`](../PLANO_DE_ACAO.md), que guiou as Fases 0–10 (recuperação do código,
> segurança, migração para Supabase, multiplayer, testes e deploy) e cumpriu seu papel.
>
> **Como usar:** leia antes de cada sessão de trabalho, marque `[x]` no que concluir e continue do
> primeiro item aberto. Preencha a data ao fechar cada fase.
>
> **O desenvolvimento acontece em sessões separadas do Claude Code, com contexto zerado.** O
> [Protocolo de sessão](#-protocolo-de-sessão) abaixo é obrigatório na abertura e no encerramento
> de cada fase — é o que faz o trabalho sobreviver à troca de sessão.
>
> A versão narrativa desta auditoria — com evidências, trechos de código e justificativas — está
> publicada como artefato e é a fonte de contexto quando um item aqui parecer arbitrário.

---

## 🔄 PROTOCOLO DE SESSÃO

> **Este projeto é desenvolvido em sessões separadas do Claude Code, cada uma com contexto zerado.**
> Uma sessão nova não sabe nada do que a anterior fez — a não ser o que estiver escrito. Este
> protocolo é o que faz o trabalho sobreviver à troca de sessão.

### Divisão de responsabilidade: repo × memória

**O repositório é a fonte da verdade do estado.** Checkbox marcado, data preenchida, ledger escrito,
registro de segurança atualizado, tag criada — é isso que diz onde o projeto está.

**A memória do Claude complementa, não substitui.** Ela é local da máquina, não é versionada e pode
simplesmente não existir numa sessão nova. Guardar "estamos na Fase C, tarefa C.4" nela seria
duplicar os checkboxes — e estado escrito em dois lugares diverge em três meses, exatamente o
problema que o [`varreduras/README.md`](./varreduras/README.md) foi deduplicado para evitar.

| Vai para o **repo** | Vai para a **memória** |
|---|---|
| Qual fase, qual tarefa, quais datas | Que o desenvolvimento acontece em sessões de contexto zerado |
| Achados, veredictos, gatilhos de ADIAR | Preferências de trabalho do usuário |
| Decisões arquiteturais (ADRs) | Ponteiro para o plano e para os documentos vivos |
| Respostas do portão de segurança | Correções que o usuário fez em rumo errado |

O [`CLAUDE.md`](../CLAUDE.md) na raiz é o que amarra os dois: é carregado automaticamente em toda
sessão e manda ler o plano antes de propor trabalho.

### Ritual de ABERTURA — ao começar ou retomar uma fase

- [ ] **1.** Ler o [`CLAUDE.md`](../CLAUDE.md) (carregado automaticamente) e **este plano**.
- [ ] **2.** Achar o **primeiro item `[ ]` não marcado** — é de onde o trabalho continua. Se o item
      anterior está marcado mas a fase não tem data, a fase está em andamento.
- [ ] **3.** `git log --oneline -15` e `git tag -l` — as tags fecham as fases de construção
      (`v0.4.0` na A, `v0.4.1` na B, `v0.4.2` na C, `v0.4.3` na D, `v0.4.4` na F, `v0.5.0` na M).
      Se o último commit não corresponde ao último checkbox marcado, **alguém parou no meio**:
      reconcilie antes de escrever código.
- [ ] **4.** Ler o registro de [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase) das fases já
      fechadas, e as decisões do [`CLAUDE.md`](../CLAUDE.md) — para não reabrir questão resolvida.
- [ ] **5.** Varrer os **ADIAR em aberto** nos ledgers de [`varreduras/`](./varreduras/) e nas ADRs:
      algum gatilho disparou desde a última sessão? Um gatilho que disparou vira trabalho da fase
      corrente.
- [ ] **6.** Rodar `npx tsc --noEmit` e `npx vitest run` **antes de mudar qualquer coisa**. É a linha
      de base: sem ela, você não sabe se quebrou algo ou se já estava quebrado.

### Ritual de ENCERRAMENTO — ao fechar uma fase

Cada fase de construção tem estes três últimos itens na própria lista. Não são opcionais:

- [ ] **1.** 🔒 **Portão de segurança** — as seis perguntas, registradas em
      [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase).
- [ ] **2.** 🧠 **Atualizar o estado durável** — marcar os checkboxes da fase, preencher a data,
      atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema
      mudou, e a tabela de progresso no fim deste arquivo.
- [ ] **3.** 🧠 **Atualizar a memória do Claude** — mas **só o que o repo não carrega**: uma decisão
      nova que valha para as próximas sessões, uma preferência de trabalho que você expressou, uma
      correção de rumo. **Não** copie o estado da fase para lá.
- [ ] **4.** Commit com mensagem que explique o *porquê*, e a tag da fase quando houver.

### Se a sessão anterior parou no meio de uma fase

É o caso mais provável, e o plano prevê:

1. O **último checkbox marcado** diz o que terminou. O **primeiro desmarcado** diz o que falta.
2. `git status` e `git log` dizem se há trabalho não commitado ou commitado sem checkbox.
3. Se houver divergência entre os dois, **o código ganha** — marque o checkbox que o código já
      cumpriu, em vez de refazer.
4. Se não estiver claro se uma tarefa foi feita, rode a verificação dela (a suíte, o grep, o
      endpoint) em vez de adivinhar. Quase toda tarefa deste plano tem um critério verificável.

---

## 🧭 Estado na abertura deste plano

Verificado localmente no commit `a75abd2` em 02/09/2026:

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` | 0 erros |
| Vitest | 141/141 (7 arquivos) |
| Build (Vite + esbuild) | OK |
| `npm audit --omit=dev` | **6 vulnerabilidades** (3 altas, 3 moderadas) |
| Bundle de entrada | 1,34 MB / 390 KB gzip |
| Árvore de trabalho | limpa |

**O projeto não está quebrado.** O que falta é o *loop de jogo*: dano não vira ferimento, o
modificador do Mestre não entra em rolagem nenhuma, e a tabela de BTM não é a do livro.

---

## ⚖️ Decisões tomadas (02/09/2026)

Estas três respostas fecham ambiguidades que mudariam o trabalho. Não reabrir sem motivo novo.

| # | Pergunta | Decisão | Consequência |
|---|---|---|---|
| 1 | A explosão do d10 encadeia? | **Sim, encadeia** | Cliente e PRD já estão certos. Corrigir só o servidor, sem configuração por mesa. |
| 2 | Fidelidade estrita ou regras de casa? | **Fidelidade estrita ao CP2020** | Nenhuma divergência vira "regra de casa". A Fase C ganha conferência sistemática contra o livro. |
| 3 | Quem é o público da alpha? | **Jogadores convidados pelo dono** | SEC-02 cai de crítico para alto. Fase L (performance) fica por último. SEC-01 continua crítico — custo de API não depende de quem joga. |
| 4 | Ativar PITR no Supabase (A.5)? | **Não — ADIAR.** PITR exige plano Pro (pago); o dono confirmou que o projeto fica no free tier | Colide com o contrato de custo zero sem sintoma que justifique. O free tier já faz backup diário automático — só falta granularidade de restauração por ponto no tempo. **Gatilho:** um incidente real de perda de dado que o backup diário não cobriria |

---

## 🔎 FILTRO DE NECESSIDADE

Aplicado obrigatoriamente a **toda mudança candidata** nas fases de varredura (E e G–J), e recomendado
em qualquer decisão de escopo nas demais.

### As cinco perguntas

1. **Qual sintoma observado?** Bug reproduzível, número errado na tela, erro no log, incômodo sentido
   jogando. *"Seria mais limpo se…" não é sintoma.* Sem sintoma, o veredito já é ADIAR.
2. **Quem sente isso hoje?** Você mantendo o código, o jogador na ficha, o GM na mesa — ou ninguém
   ainda? "Ninguém ainda" é resposta legítima e quase sempre significa esperar.
3. **O que quebra se eu não fizer?** Nada / fica feio / dá retrabalho / perde dado / vaza dado. Só as
   duas últimas justificam interromper o que estava em andamento.
4. **Existe uma versão 10× menor?** Se uma solução muito menor resolve 80% do sintoma, ela — e não a
   original — é a candidata que segue no filtro.
5. **É reversível?** Mudança reversível pode ser feita com menos certeza. Schema, contrato de API e
   formato persistido exigem a certeza toda.

### Os três veredictos

| Veredito | Quando | Exigência |
|---|---|---|
| **FAZER** | Só com sintoma observado na pergunta 1 | Entra na fase corrente **com teste que reproduz o sintoma antes da correção** |
| **ADIAR** | Veredito padrão | **Exige gatilho escrito** ("quando a mesa passar de 6 jogadores", "quando alguém de fora entrar"). Sem gatilho plausível, é DESCARTAR disfarçado |
| **DESCARTAR** | Não resolve sintoma real | Razão registrada em uma linha, para a ideia não voltar na varredura seguinte |

### As duas regras que fazem o filtro funcionar

1. **Cada varredura tem dois tempos separados:** *achar e classificar* (sem tocar em código), depois
   *executar só os FAZER*. Misturar os dois é como o filtro morre — achar um problema e já consertar
   é irresistível.
2. **Se mais de 1/3 dos itens virar FAZER, o critério está frouxo.** Recalibre a régua e passe a
   lista de novo, em vez de aceitar a resposta agradável.

### Por que este projeto precisa disso

Não é conselho abstrato, é diagnóstico. O `combatModifier` foi construído de ponta a ponta
(validação, clamp em ±10, persistência, broadcast, exibição) e **nenhuma rolagem o lê**. O
`currentStats` existe no tipo, é escrito a cada edição, é persistido — e não tem um único leitor no
repositório. Há seis configurações de deploy para um serviço que roda num lugar só. Cinco tabelas de
lifepath foram escritas antes de o dano virar ferimento. Todos passariam pela pergunta 1 com um
"não".

Os ledgers das varreduras ficam em [`docs/varreduras/`](./varreduras/).

---

## 🔒 PORTÃO DE SEGURANÇA

**Nenhuma fase de construção fecha sem passar por ele.** Seis perguntas, 30 minutos, sobre o que
*aquela fase* mudou — nunca sobre o sistema inteiro. Definição completa, com o mapeamento STRIDE e a
origem de cada pergunta, em [`SEGURANCA.md`](./SEGURANCA.md).

| # | Pergunta | STRIDE | Nasceu de |
|---|---|---|---|
| 1 | Que **entrada nova** este trabalho aceita? Está validada no limite do servidor? | Tampering | SEC-05 |
| 2 | Que **dado novo sai**? Quem pode lê-lo, e isso é verificado ou presumido? | Info. Disclosure | SEC-02 |
| 3 | Que **autorização nova** existe? O autor vem da sessão, nunca do corpo? | Spoofing / EoP | T1.7 |
| 4 | O que um **jogador convidado hostil** consegue fazer aqui? | EoP | Decisão 3 |
| 5 | Que **estado novo cresce sem limite**, e quem recolhe? | DoS | SEC-04 |
| 6 | Isso adiciona **custo por requisição** a um serviço externo pago? | DoS / financeiro | SEC-01 |

### Por que portão por fase, e não só a varredura da Fase J

Os seis achados de segurança da auditoria nasceram do mesmo jeito: a funcionalidade foi construída e
as perguntas não foram feitas **naquele momento**. O `/api/gemini` foi escrito para funcionar, e
ninguém perguntou quem pode chamar. A ficha passou a ser sincronizada, e ninguém perguntou se era
confiável.

Uma auditoria no fim encontra isso — e é o que a Fase J faz. Mas encontrar custa muito mais caro do
que não introduzir. A prática corrente para times ágeis é rodar STRIDE de forma **iterativa e
timeboxed** sobre as mudanças de cada ciclo, alimentando critérios de aceitação e a definição de
pronto, em vez de uma análise monolítica no final.

**O portão previne; a varredura confere.** São camadas diferentes, e a segunda não substitui a
primeira.

### Saída

Uma entrada no registro de [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase), mesmo que curta.
**"Nada mudou nessa frente" é resposta válida** — o que não é válido é não ter perguntado. Achado que
não justifica interromper vai para o ledger da Fase J com gatilho escrito.

---

## 📐 DESENHO ANTES DO CÓDIGO

**Um diagrama desenhado antes do trabalho é especificação. Desenhado depois, é documentação que
apodrece.** Os diagramas vivem em [`ARQUITETURA.md`](./ARQUITETURA.md) e são mantidos pelas fases que
mudam a forma do sistema — atualizar o diagrama afetado faz parte do portão de segurança.

Entregues junto com este plano, porque são especificação do que vem pela frente:

| Diagrama | Tipo | Serve a | Sintoma que o justifica |
|---|---|---|---|
| **Contêineres e fronteiras de confiança** | `flowchart` | A, B | O SEC-05 existiu porque ninguém tinha desenhado onde fica a fronteira |
| **Ciclo de vida de sala e sessão** | `stateDiagram` | B | O SEC-04 é um estado que não existe: nada define quando uma sala morre |
| **Pipeline de dano FNFF** | `flowchart` | C, D | O RUL-04 tem as peças implementadas e nenhuma conectada; o desenho é o alvo |
| **Máquina de estados do ferimento** | `stateDiagram` | C | O RUL-06 e o RUL-08 divergem do livro; onze estados precisam de espec. sem ambiguidade |

Quatro outros foram **adiados com gatilho escrito** — desenho sem sintoma também é overengineering.
A lista está no fim do [`ARQUITETURA.md`](./ARQUITETURA.md#diagramas-adiados).

### Nota técnica

Usamos `flowchart` + `subgraph` para os níveis de contexto e contêiner do
[modelo C4](https://c4model.com/), **não** a sintaxe `C4Context` do Mermaid: ela é experimental e o
renderizador do GitHub não a suporta — os diagramas não apareceriam no repositório, que é justamente
onde precisam ser lidos.

---

## 💸 CONTRATO DE CUSTO ZERO

Objetivo declarado: **o projeto não gera despesa.** Cinco regras. Se todas valerem, o pior caso de
qualquer abuso é uma funcionalidade parar — nunca uma fatura.

1. **Nunca vincular conta de faturamento à chave do provedor de IA.** É o único teto que importa.
   Sem faturamento, um abuso do `/api/gemini` custa "a IA parou hoje". Com faturamento e o endpoint
   aberto (SEC-01), não tem teto.
2. **Um serviço no Render, não dois.** As 750 horas/mês são **por workspace**, e um mês tem ~730 h.
3. **Nunca apontar uptime bot para o `/api/health`.** Ver ⚠️ abaixo.
4. **Frontend estático no Vercel/Netlify**, deixando banda e minutos de build do Render para a API.
5. **Manter o projeto Supabase acordado** — o plano gratuito pausa com 7 dias de baixa atividade no
   banco. Pelo painel antes de cada sessão, ou por um cron semanal.

### ⚠️ O uptime bot quebra o free tier de TODOS os seus projetos no Render

O `docs/DEPLOY.md` recomendava (T10.4) um monitor UptimeRobot no `/api/health` a cada 5 minutos.
Isso impede a hibernação e faz o serviço consumir **~730 h/mês sozinho**, de um orçamento de 750 h
que é **compartilhado por todo o workspace**. Consequência concreta: o `newra-news-api` (o outro
projeto no Render) e o NetSheet **ficariam suspensos até a virada do mês**.

A recomendação foi corrigida no `docs/DEPLOY.md` nesta mesma entrega.

### Consumo estimado do workspace Render

| Serviço | Regime | Estimativa |
|---|---|---|
| `netsheet-engine` | Acorda só em sessão de jogo; heartbeat de 20 s impede hibernar durante a mesa | ~20–30 h/mês |
| `newra-news-api` | Acorda por visita ao portal; sem keep-alive e sem workflow agendado que o desperte | ~75–150 h/mês |
| **Total** | | **~100–180 h de 750** |

Folga confortável — **desde que a regra 3 seja respeitada.**

> **Nota sobre o Newra News:** o `CRON_SCHEDULE: "0 8 * * *"` é um cron **em processo**. No plano
> gratuito do Render, se ninguém acessar o portal nos 15 minutos anteriores às 08:00, o processo está
> hibernado e o artigo diário **não é gerado**. Isso é problema do outro repositório, mas foi
> observado durante esta auditoria e vale registrar.

---

## 📊 ÍNDICE DE ACHADOS

33 achados no código. IDs referenciados pelas fases.

### Segurança (6)

| ID | Sev. | Achado | Fase |
|---|---|---|---|
| SEC-01 | 🔴 Crítico | `/api/gemini` sem autenticação e com `systemInstruction` do cliente — proxy de LLM pago pela sua chave | B |
| SEC-05 | 🟠 Alto | Ficha gravada sem validação (`sheet` verbatim) — anula o RNG server-authoritative da T5.4 | B |
| SEC-02 | 🟠 Alto | Leitura de sala e stream SSE sem sessão — expõe fichas, chat e grid | B |
| SEC-03 | 🟠 Alto | Sessões só em memória — restart derruba todas as mesas | B |
| SEC-06 | 🟡 Médio | 6 vulnerabilidades em dependências de produção (`express → body-parser → qs`) | B |
| SEC-04 | 🟡 Médio | Salas, sessões e buckets do rate limiter nunca expiram | B |

### Regras CP2020 (12)

| ID | Sev. | Achado | Fase |
|---|---|---|---|
| RUL-01 | 🔴 Crítico | BTM derivado de `BODY+REF` com sinal invertido (livro: só BODY, −1 a −5) | C |
| RUL-02 | 🔴 Crítico | Ataque na mesa é `1d10 + REF + WA` — falta a perícia de arma | C |
| RUL-03 | 🔴 Crítico | `combatModifier` do GM nunca é somado a rolagem nenhuma | C |
| RUL-04 | 🔴 Crítico | Sem pipeline de dano: SP, ×2 na cabeça e BTM não se conectam ao `woundLevel` | D |
| RUL-05 | 🟠 Alto | Dois motores de dados divergentes (cliente encadeia, servidor explode uma vez) | C |
| RUL-06 | 🟠 Alto | Penalidade de ferimento não entra em rolagem; `currentStats` é campo morto | C |
| RUL-07 | 🟠 Alto | Atributo da Special Ability escolhido por ternário — erra 7 dos 10 roles | C |
| RUL-08 | 🟡 Médio | Death save sem modificador cumulativo | C |
| RUL-09 | 🟡 Médio | Iniciativa digitada à mão, sem `1d10 + REF` | D |
| RUL-10 | 🟡 Médio | Criação de personagem sem orçamento (pontos, perícias, IP) | K |
| RUL-11 | 🔵 Baixo | Faltam Leap/Carry/Lift e EV; "Walk" é invenção | K |
| RUL-12 | 🔵 Baixo | Tabelas de perícia incompletas; "Social" duplicado em INT | K |

### Arquitetura (10)

| ID | Sev. | Achado | Fase |
|---|---|---|---|
| ARQ-01 | 🟠 Alto | Broadcast do estado completo da sala a cada mutação (100–300 KB) | L |
| ARQ-02 | 🟠 Alto | Regras do jogo implementadas duas vezes, sem teste de paridade | C |
| ARQ-03 | 🟡 Médio | Instância única obrigatória combinada com plano que hiberna | B |
| ARQ-04 | 🟡 Médio | 1,34 MB no chunk de entrada | L |
| ARQ-05 | 🟡 Médio | Quatro arquivos concentram ~4.000 das 14.282 linhas | E/G/L |
| ARQ-06 | 🔵 Baixo | Camada Supabase ainda exporta nomes do Firebase | L |
| ARQ-07 | 🔵 Baixo | Sem ESLint; 23 `any` e 16 `console.*` | L |
| ARQ-08 | 🔵 Baixo | 3 smoke tests para 20 componentes React | C/D/G/H |
| ARQ-10 | 🟡 Médio | **Dependências e arquivos mortos** — `motion` instalado sem nenhum import, 7 wrappers `components/ui/*` sem consumidor (com 5 pacotes Radix), e `bun.lock` desatualizado desde 07/08 enquanto o CI usa `npm ci` | ✅ resolvido em 02/09 |
| ARQ-09 | 🟠 Alto | **As fontes não carregam em produção** — o `@import` do Google Fonts sobrevive ao build, mas o CSP (`style-src`/`font-src`) o bloqueia; como o helmet é pulado em dev, só quebra no ar | F |

### Documentação e processo (5)

| ID | Sev. | Achado | Fase |
|---|---|---|---|
| DOC-01 | 🟠 Alto | PRD atrasado e documentando as regras erradas como especificação | A |
| DOC-02 | 🟡 Médio | Seis alvos de deploy configurados, nenhum eleito | A |
| DOC-03 | 🟡 Médio | T10.8 fechada com PITR e secrets do `db-sync` pendentes | A |
| DOC-04 | 🔵 Baixo | Sem tags nem releases | A |
| DOC-05 | 🔵 Baixo | Plano mestre programado para se autodeletar | A/M |

---

## 🗂️ AS 13 FASES

**Esforço total: 30,5 a 38,5 dias de trabalho concentrado** — quatro a sete meses de calendário para
quem tem outra ocupação. Ponto de corte natural: **fechando A–D o jogo já roda certo**; F entrega a
identidade visual nova; e as varreduras viram manutenção de fim de semana.

Legenda: 🔨 construção · 🔍 varredura (filtro de necessidade obrigatório)

---

### FASE A — REANCORAR O PROJETO 🔨 *(1 dia)*

- [x] **A.1** Conferir se o projeto Supabase pausou (ocioso desde 25/08; o plano gratuito pausa com
      7 dias de baixa atividade). Checar e-mail do dono e o dashboard. Restaurar se necessário.
      *(03/09/2026 — estava pausado, dono restaurou.)*
- [x] **A.2** Conferir que a chave de IA **não tem conta de faturamento vinculada**.
      *(03/09/2026 — dono confirmou: todas as chaves em plano gratuito, sem cartão vinculado.)*
- [x] **A.3** `git tag v0.4.0` no commit atual — ponto de retorno de todo o plano.
      *(03/09/2026 — tag local no commit `d2c742b`, ainda não enviada ao remoto.)*
- [x] **A.4** Atualizar a seção 9 do `docs/PRD.md` e o roadmap do `README.md` para o estado real
      (Fases 0–10 fechadas). *(DOC-01, parte 1 — 03/09/2026)*
- [x] **A.5** **PITR adiado** (decisão 4 — exige plano pago, dono fica no free tier; backup diário
      grátis continua ativo). **Secrets do `db-sync` resolvidos em 03/09/2026:**
      - `SUPABASE_ACCESS_TOKEN` **já existia** desde 25/08 — o DOC-03 afirmava que os dois estavam
        pendentes, mas foi redigido a partir do comentário no `ci.yml`, não de verificação real.
      - `SUPABASE_PROJECT_REF` (`frsoqgtekrafdhfvlkqu`) criado nesta sessão. O ref é identificador
        **público** — vai no bundle do cliente —, por isso não é credencial.
      - Antes de ligar, conferido com `supabase migration list --linked`: as 6 migrations constam
        **local e remoto**, logo o primeiro `db push` não re-executa nada. Era o risco real (migration
        aplicada à mão fica fora da tabela de controle e o CI tentaria rodar de novo).
      - **Efeito:** o job `db-sync` deixa de ser inerte. A partir do próximo push no `master`, migration
        nova em `supabase/migrations/` é aplicada no banco de produção automaticamente.
      *(DOC-03)*
- [x] **A.6** Fixar o **Render** como alvo único de backend; arquivar `fly.toml` e `railway.toml` em
      `docs/deploy-alternativas/`. Manter `vercel.json`/`netlify.toml` — o frontend estático neles é
      recomendado pelo contrato de custo. *(DOC-02 — 03/09/2026)*
- [x] **A.7** Criar `docs/varreduras/` como casa dos ledgers das fases E e G–J.
      *(já existia antes desta sessão — verificado em 03/09/2026.)*
- [x] **A.8** Marcar o `PLANO_DE_ACAO.md` como **substituído** — *não* como concluído. O encerramento
      formal (T12.2–T12.6) é da Fase M. *(DOC-05, parte 1 — já feito antes desta sessão, verificado
      em 03/09/2026.)*
- [x] **A.9** 📐 **Desenho** — conferir que o diagrama de contêineres e fronteiras de confiança
      em [`ARQUITETURA.md`](./ARQUITETURA.md) bate com a realidade. Ele foi desenhado a partir da
      leitura do código; validar é seu. *(03/09/2026 — estrutura bate; corrigida uma rotulagem que
      mostrava Groq como já implementado quando só o Gemini existe hoje.)*
- [x] **A.10** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](./SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.** *(03/09/2026 — achado na pergunta 3: o `db-sync` dá ao CI autoridade de alterar o schema de produção; item levado à Fase J com gatilho escrito.)*
- [x] **A.11** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](#-protocolo-de-sessão).
- [x] ✅ **Fase A concluída em:** __03__/__09__/__2026__

---

### FASE B — FECHAR OS BURACOS DE AUTORIZAÇÃO 🔨 *(2,5 dias)*

- [ ] **B.1** Travar `/api/gemini`: system prompt fixo no servidor (mover o `SYSTEM_PROMPT` de
      `AiAssistant.tsx`), ignorar `systemInstruction` do cliente, exigir JWT do Supabase, limiter
      dedicado, teto de tamanho de prompt. *Sem regressão de UX — o `AiAssistant` já bloqueia
      visitante no cliente.* *(SEC-01)*
- [ ] **B.2** Criar `src/rules/sheetSchema.ts` com validador de `CharacterSheet` no limite do
      servidor: atributos 2–15, perícias 0–10, `woundLevel` 0–10, arrays com teto, campos
      desconhecidos descartados. Aplicar em `joinRoom` e `updatePlayerSheet`. *(SEC-05)*
- [ ] **B.3** Exigir `sessionToken` na leitura de sala e no stream SSE (via header); separar payload
      público (código, nome, GM, contagem) do payload de mesa. *(SEC-02)*
- [ ] **B.4** Persistir as sessões junto com a sala, na mesma gravação da T3.1. **Não** trocar por JWT
      stateless: `revokeSessionsForPeer` e `deleteRoom` dependem de revogação server-side e têm
      teste. *(SEC-03, ARQ-03)*
- [ ] **B.5** Coletor de salas abandonadas (sem jogador online há N horas) e poda dos buckets vencidos
      do rate limiter. *(SEC-04)*
- [ ] **B.6** `npm audit fix` + passo de audit no CI falhando em severidade alta. *(SEC-06)*
- [ ] **B.7** **Instrumentar o fallback SSE** — uma linha de log estruturado quando um cliente cai
      do WebSocket para o `EventSource`. O suporte a WebSocket passa de 99% e o motivo real de
      manter fallback é proxy corporativo que quebra o handshake de Upgrade — algo que a sua mesa
      de convidados pode simplesmente nunca encontrar. Como esta fase já mexe no SSE por causa do
      SEC-02, o log sai de graça. **Decidir na Fase L, com dado**: se em meses de mesa ninguém caiu,
      o fallback sai; se alguém caiu, você descobriu que era necessário.
- [ ] **B.8** Testes de integração para cada item — a suíte atual cobre bem quem *pode* agir e não
      cobre quem não deveria conseguir *ler*.
- [ ] **B.9** `git tag v0.4.1`.
- [ ] **B.10** 📐 **Desenho** — implementar o coletor contra o [ciclo de vida de sala e sessão](./ARQUITETURA.md#ciclo-de-vida-de-sala-e-sessão), que já especifica a transição `Ociosa → Encerrada` que hoje não existe.
- [ ] **B.11** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](./SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
- [ ] **B.12** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](#-protocolo-de-sessão).
- [ ] ✅ **Fase B concluída em:** ____/____/______

---

### FASE C — UMA FONTE ÚNICA DE REGRAS 🔨 *(5,5–7,5 dias)*

Fase estruturante. Criar `src/rules/` — funções puras, RNG injetado, sem DOM nem rede — e migrar
cliente e servidor para ela.

> **Disciplina obrigatória:** os 32 testes de `derived-stats` codificam a tabela **errada**.
> Reescrevê-los para bater com o código novo destrói a verificação exatamente na mudança mais
> delicada do plano. Ordem correta: **escrever a tabela do livro como dado primeiro**, derivar os
> testes desse dado, vê-los falhar contra a implementação atual, e só então mudar a implementação.

- [ ] **C.1** Extrair e unificar o motor FNFF em `src/rules/`. Explosão **encadeada** dos dois lados
      (decisão 1), com teto de segurança contra sequência patológica. *(RUL-05, ARQ-02)*
- [ ] **C.2** BTM canônico por BODY (2→0, 3–4→−1, 5–7→−2, 8–9→−3, 10→−4, 11+→−5), sinal negativo,
      rótulo do `StatBlock` e linha do PRD corrigidos. *(RUL-01)*
- [ ] **C.3** Ataque com perícia de arma: mapear `weapon.type` → nome de perícia e somar o nível da
      ficha que o servidor já possui. *(RUL-02)*
- [ ] **C.4** `combatModifier` entrando em `attack` e `skill`, visível no detalhe da rolagem. *(RUL-03)*
- [ ] **C.5** Tabela de penalidade de ferimento igual à do livro (Crítico REF −4; todos os Mortais
      REF −6). *(RUL-06, parte 1)*
- [ ] **C.6** `currentStats` derivado (base + cyberware + penalidade de ferimento) num único seletor,
      lido por **todas** as rolagens. *(RUL-06, parte 2)*
- [ ] **C.7** Death save com modificador cumulativo por nível mortal e por turno. *(RUL-08)*
- [ ] **C.8** Atributo da Special Ability dentro de `OFFICIAL_ROLES`. *(RUL-07)*
- [ ] **C.9** **Conferência sistemática contra o livro** (decisão 2): atributos, perícias, combate,
      dano, armadura, humanidade e movimento. Registrar cada divergência encontrada, inclusive as não
      listadas nesta auditoria.
- [ ] **C.10** Testes de paridade cliente↔servidor com a mesma entrada nos dois RNGs. *(ARQ-08, parte 1)*
- [ ] **C.11** Atualizar `docs/PRD.md` §5 no mesmo commit de cada correção. *(DOC-01, parte 2)*
- [ ] **C.12** `git tag v0.4.2`.
- [ ] **C.13** 📐 **Desenho** — a C.9 confere o [pipeline de dano](./ARQUITETURA.md#pipeline-de-dano-fnff) e a [máquina de ferimento](./ARQUITETURA.md#máquina-de-estados-do-ferimento) contra o livro, e **corrige os diagramas** com o que a conferência determinar. Eles são hipótese de trabalho, não autoridade.
- [ ] **C.14** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](./SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
- [ ] **C.15** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](#-protocolo-de-sessão).
- [ ] ✅ **Fase C concluída em:** ____/____/______

---

### FASE D — FECHAR O LOOP DE COMBATE 🔨 *(3–4 dias)*

- [ ] **D.1** `applyDamage(alvo, danoBruto, localizacao)`: SP da localização → ×2 na cabeça → BTM →
      conversão em níveis de ferimento (4 pontos por nível), com trilha de auditoria no chat. *(RUL-04)*
- [ ] **D.2** Definir e implementar o caso do **token sem ficha**: o grid tem tokens `cover` e
      `hazard` sem `sheet` nem BTM, só `spCover`. Precisa estar decidido antes de codar.
- [ ] **D.3** Fluxo de GM: rolar ataque → acertar token → aplicar dano, sem sair do grid.
- [ ] **D.4** Iniciativa automática (`1d10 + REF` no servidor para todos), com ajuste manual mantido.
      *(RUL-09)*
- [ ] **D.5** Death saves entrando na virada de turno de quem está em nível mortal.
- [ ] **D.6** Testes de comportamento do loop (aplicar dano, avançar turno). *(ARQ-08, parte 2)*
- [ ] **D.7** `git tag v0.4.3`.
- [ ] **D.8** 📐 **Desenho** — implementar o `applyDamage` contra o [pipeline de dano](./ARQUITETURA.md#pipeline-de-dano-fnff) já confirmado pela Fase C. Se a implementação divergir do desenho, o desenho muda junto no mesmo commit.
- [ ] **D.9** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](./SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
- [ ] **D.10** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](#-protocolo-de-sessão).
- [ ] ✅ **Fase D concluída em:** ____/____/______

> **Ponto de corte:** com A–D fechadas o jogo roda certo. Dá para jogar aqui e tratar o resto como
> manutenção — com a exceção da F, que é a única fase restante que muda o que o jogador vê.

---

### FASE E — 🔍 VARREDURA: BACKEND *(1–2 dias)*

Escopo: `server.ts`, `server/roomManager.ts`, `server/roomPersistence.ts`, `server/logger.ts`.

- [ ] **E.1** Varredura (sem tocar em código) → ledger em `docs/varreduras/E-backend.md`.
- [ ] **E.2** Executar apenas os itens FAZER.

**Pistas já levantadas:**
- `respondWithResult` decide entre 404 e 403 **por substring em português** — renomear uma mensagem
  muda o status code da API.
- `code.toUpperCase()` repetido em dezenas de pontos; normalização sem dono.
- `process.exit(0)` no shutdown sem drenar sockets abertos.
- Conferir se algum erro de `roomPersistence` é engolido em silêncio.
- `(ws as any)._peerId` e os `any` do protocolo Yjs.
- Candidato a refactor: fatiar `roomManager` (1.035 linhas) em sessão / autorização / regras / npcs /
  chat. *(ARQ-05)*

**O que a varredura pergunta:** todo caminho de erro devolve o status certo e uma mensagem tratável?
Existe estado que cresce sem limite? Que suposição quebra se duas requisições chegarem juntas?

- [ ] ✅ **Fase E concluída em:** ____/____/______

---

### FASE F — REESTRUTURAÇÃO VISUAL: IDENTIDADE CYBERPUNK 2020 🔨 *(4 dias)*

> **Por que é fase própria e vem antes da varredura.** Redesign e caça a bug têm posturas opostas:
> a varredura pergunta "isto é necessário?" e tem ADIAR como padrão — se as duas coisas
> compartilhassem uma fase, ou o filtro mataria o redesign (que é discricionário por natureza), ou o
> redesign corromperia o filtro. E varrer código que você está prestes a reestilizar repete
> exatamente o erro que o plano já evita ao pôr as varreduras depois de B, C e D.

#### 🎯 O alvo: o Cyberpunk de 1988, não o de 2020 (o jogo)

O produto é **Cyberpunk 2020**, RPG de mesa da R. Talsorian publicado em 1990 (sucessor do
*Cyberpunk* de 1988). Sua estética é a do cyberpunk **oitentista**: impressão de alto contraste,
neon sobre preto, terminal CRT, faixas de perigo, ruído analógico, colagem de fanzine.

Isso é **outra coisa** do Cyberpunk 2077 (jogo, 2020) e do Cyberpunk RED (sistema de mesa atual), que
compartilham uma linguagem moderna: limpa, sistemática, militar, vermelho primário, fios finos, HUD
curvo. A migração para o 2077 foi **descartada** — ver ADR 0006.

#### ⚠️ Honestidade sobre as fontes originais

**Não há documentação pública das fontes exatas que a R. Talsorian usou nos livros.** As buscas
devolvem história editorial e listas de suplementos, não créditos tipográficos, e a identificação por
comunidade nesse nicho é especulativa. Não vou fingir precisão que não tenho.

O que **é** documentado é o vocabulário tipográfico da era que o livro estava usando:

| Face | Papel histórico | Situação |
|---|---|---|
| **Eurostile** (Novarese, 1962; de Microgramma, 1952) | *A* face de ficção científica e técnica dos anos 60–80 — quadrada, cantos arredondados, extendida. Em *2001*, *De Volta para o Futuro*, *Starship Troopers* | **Comercial** |
| **Bank Gothic** | A referência de sci-fi dos anos 90 | **Comercial** |
| **OCR-A / Data 70 / Compacta** | Vozes de "computador" e de ação dos anos 70–80 | Comerciais ou de origem incerta |

Nenhuma pode ser embarcada sem licença de webfont — o que colide com o contrato de custo zero. A
estratégia, portanto, é **reconstruir a linguagem com faces livres**, não copiar arquivos.

#### F.0 — 🐛 O bug que precede tudo *(meio dia)*

- [ ] **F.0** **As fontes do projeto não carregam em produção.** O `src/index.css` importa Rajdhani e
      Share Tech Mono do Google Fonts, e o `@import` sobrevive ao build (confirmado em
      `dist/assets/index-*.css`). Mas o CSP do helmet declara `style-src: 'self' 'unsafe-inline'` e
      `font-src: 'self' data:` — a folha do `fonts.googleapis.com` é bloqueada, e os arquivos do
      `fonts.gstatic.com` também. Como o helmet é pulado em dev, **o problema só existe no ar**: a
      produção renderiza em fontes de sistema, provavelmente desde a Fase 10. *(ARQ-09)*
      - Solução: **auto-hospedar** (`@fontsource/*` ou `public/fonts/` com `@font-face` local).
        Mantém o CSP apertado e é o mesmo mecanismo que as fontes novas vão usar.
      - Verificar com `NODE_ENV=production` e helmet ativo. É a única forma de confirmar.

#### F.1 — O sistema tipográfico 2020 *(1 dia)*

Cinco papéis. Duas faces já existem no projeto e ficam; as adições passam pelo filtro de necessidade,
com o sintoma declarado.

- [ ] **F.1.1** **Corpo e UI → `Rajdhani`** *(já em uso, mantém)*. Sans quadrada de fatura técnica,
      livre (SIL OFL). Já é a escolha certa; custo de migração zero.
- [ ] **F.1.2** **Terminal e dados → `Share Tech Mono`** *(já em uso, mantém)*. Mono de terminal,
      livre. Sustenta o motivo de "leitura de máquina" do livro.
- [ ] **F.1.3** **Display / títulos de seção → `Orbitron`** *(adicionar)*.
      *Sintoma:* hoje não existe voz de display — títulos são a fonte do corpo, só maior e em caixa
      alta, e por isso as seções não se distinguem. `Orbitron` é a alternativa livre mais citada ao
      **Eurostile**, tem eixo de peso 400–900 e cobre exatamente o papel de manchete quadrada
      oitentista. *(Considerar `Michroma` só para o wordmark: é mais próxima do Eurostile Extended,
      mas tem peso único.)*
- [ ] **F.1.4** **Números da ficha → condicional.** Primeiro aplicar `tabular-nums` no Rajdhani
      (F.2.2). *Só se* os dígitos continuarem desalinhados, adicionar `Saira Condensed` para blocos
      de estatística. Não adicionar fonte antes de medir — é o filtro aplicado à própria tipografia.
- [ ] **F.1.5** **Momentos de terminal → condicional.** `VT323` é uma face de CRT autêntica, livre e
      pequena (~30 KB). *Sintoma que a justifica:* o Netrunner IA, as mensagens de `SISTEMA_NET` no
      chat e as telas de carregamento hoje falam com a mesma voz do resto da interface. Se a
      distinção não aparecer com Share Tech Mono, `VT323` entra **só nesses lugares** — nunca em
      corpo de texto, onde é ilegível.
- [ ] **F.1.6** Escala tipográfica explícita e tracking padronizado para caixa alta (hoje varia entre
      `tracking-wider` e `tracking-widest` sem critério).

#### F.2 — Ligar os tokens *(1 dia)*

O sistema de design **já existe e nunca foi conectado**. Medido no repositório:

| Medida | Valor |
|---|---|
| Ocorrências de cor literal em `.tsx` | **1.722** |
| Combinações distintas de cor | **107** |
| Tokens de cor no `@theme` do `index.css` | 5 |
| **Componentes que os usam** | **0** |
| Animações de identidade definidas (`scanline`, `glitch`) | 2 |
| **Componentes que as usam** | **0** |

Terceiro caso do mesmo padrão, depois do `combatModifier` e do `currentStats`: construído de ponta a
ponta, sem um único leitor. **Sem esta etapa, aplicar a identidade nova custa 1.722 substituições —
e a próxima mudança custará outras 1.722.**

- [ ] **F.2.1** Trocar nomes por cor (`--color-neon-cyan`) por nomes por **papel**. O Tailwind v4 gera
      as utilities a partir do `@theme`: declarar `--color-accent` cria `text-accent`, `bg-accent`,
      `border-accent`. A migração vira **renomeação mecânica**, greppável e revisável.

      --color-surface        fundo dos painéis
      --color-surface-raised painéis elevados / hover
      --color-line           bordas e divisores
      --color-accent         ciano — ação, foco, links
      --color-signal         amarelo — destaque, GM, atenção
      --color-danger         vermelho — SÓ dano e perigo
      --color-ok             verde — sucesso, online

- [ ] **F.2.2** **Regra de política: vermelho significa exclusivamente dano.** O `HealthTracker` já
      ocupa a escala vermelha com wound level; nada mais no produto pode competir com esse
      significado. É o que impede a paleta de voltar a ambiguar sozinha.
- [ ] **F.2.3** `font-variant-numeric: tabular-nums` em toda coluna de número da ficha (atributos,
      SP, dano, iniciativa) — hoje os dígitos dançam quando o valor muda.
- [ ] **F.2.4** Migrar arquivo por arquivo, do maior para o menor (`MultiplayerRoom` 211 →
      `FriendsList` 154 → `CyberpunkMenu` 154 → `TacticalGrid` 150 → …). A app funciona o tempo todo;
      cada arquivo é um commit conferível por `git diff`.

#### F.3 — O vocabulário visual oitentista *(1 dia)*

A tipografia é metade. A outra metade é o repertório gráfico do livro impresso — e boa parte dele
**já está paga**: as animações `scanline` e `glitch` existem no `index.css` e nenhum componente as usa.

- [ ] **F.3.1** Ligar `scanline` e `glitch` onde fazem sentido narrativo (cabeçalho da mesa, telas de
      carregamento, Bio-Monitor em nível mortal) — não como enfeite global.
- [ ] **F.3.2** **Barras pretas com caixa alta reversa** — o traço mais reconhecível da diagramação
      da Talsorian. Vira um componente de cabeçalho de seção, não uma classe repetida.
- [ ] **F.3.3** **Faixas de perigo amarelo-e-preto** para estados de alerta (ferimento grave, turno
      do jogador, sala em combate). Usa o `--color-signal` já definido.
- [ ] **F.3.4** **Numeração de seção e rótulos técnicos** em caixa alta com underscore
      (`FICHA_01`, `MESA_TATICA`) — vocabulário que o próprio material da franquia usa e que combina
      com a fatura de impressão do livro.
- [ ] **F.3.5** *(opcional, sob o filtro)* Textura de impressão/xerox e aberração cromática sutil.
      **Só entra com sintoma** — "falta sujeira analógica" é gosto, não sintoma. E qualquer textura
      precisa passar no F.4.2.

#### F.4 — Aplicar e verificar *(meio dia)*

- [ ] **F.4.1** Aplicar começando pela ficha (maior superfície visual) e terminando na mesa.
- [ ] **F.4.2** **Acessibilidade — não negociável.** Efeitos oitentistas destroem legibilidade com
      facilidade: conferir contraste com a paleta nova nos dois modos, foco visível, ordem de
      tabulação nos modais, e **respeitar `prefers-reduced-motion`** em scanline, glitch e pulse.
- [ ] **F.4.3** Conferir o peso das fontes auto-hospedadas no bundle. Cada face adicionada é payload:
      se `Orbitron` só aparece em títulos, carregar **apenas os pesos usados**, com `font-display: swap`.
- [ ] **F.4.4** Verificar com `NODE_ENV=production` e helmet ativo. Fecha o F.0.
- [ ] **F.4.5** `git tag v0.4.4`.
- [ ] **F.5** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](./SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
- [ ] **F.6** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](#-protocolo-de-sessão).
- [ ] ✅ **Fase F concluída em:** ____/____/______

> **Critério de pronto:** duas medidas objetivas, não "está bonito". (1) O grep de cor literal em
> `.tsx` tendendo a zero. (2) As fontes carregando com helmet ativo em produção. A identidade nova é
> a consequência visível; a capacidade de mudá-la barato é a entrega real.

---

### FASE G — 🔍 VARREDURA: FRONTEND *(1–2 dias)*

Escopo: `src/components`, `src/features`, `src/pages`, `src/stores`, `src/hooks`. Vem **depois** da
Fase F para não varrer código que acabou de ser reestilizado.

- [ ] **G.1** Varredura → ledger em `docs/varreduras/G-frontend.md`.
- [ ] **G.2** Executar apenas os itens FAZER.

**Pistas já levantadas:**
- `syncSheetStore(sheetResult)` é chamado **no corpo do render** do `App.tsx` — efeito colateral fora
  de efeito.
- Os dois `useEffect` que sincronizam URL ↔ aba com dois refs de guarda.
- `createBlankCharacterSheet` gera seis IDs de armadura no mesmo tick com `Date.now()` + sufixo curto.
- `StatBlock.handleSet` altera `stats` sem tocar em `currentStats`; `handleChange` aplica um
  `Math.min` difícil de justificar.
- 16 `console.*` sobrevivendo ao logger estruturado. *(ARQ-07, parte 1)*
- Candidatos a refactor: `MultiplayerRoom` 944, `FriendsList` 723, `CyberpunkMenu` 608. *(ARQ-05)*

**O que a varredura pergunta:** que estado existe em dois lugares e pode divergir? O que a UI faz
quando a rede falha, o token expira ou a resposta demora? Dá para operar a ficha só com teclado?

- [ ] ✅ **Fase G concluída em:** ____/____/______

---

### FASE H — 🔍 VARREDURA: MULTIPLAYER *(2 dias)*

Escopo: transporte WebSocket, fallback SSE, CRDT Yjs, awareness, reconexão, presença. A varredura
mais cara — os bugs aqui só aparecem com duas pessoas e rede ruim, e é onde a decisão 3 concentra o
uso real.

- [ ] **H.1** Varredura → ledger em `docs/varreduras/H-multiplayer.md`.
- [ ] **H.2** Executar apenas os itens FAZER.

**Pistas já levantadas:**
- `destroyRoomYjs` dispara quando o último socket fecha — corrida se alguém reconecta no mesmo
  instante.
- Reconexão resolve ficha por **last-write-wins com `updatedAt` do cliente**: o relógio do navegador
  decide quem ganha.
- Transferência de GM na saída (T1.8) — existe janela de dois GMs ou de nenhum?
- Quando o cliente cai para SSE, quais ações deixam de funcionar? O usuário fica sabendo?
- Broadcast completo e updates Yjs incrementais podem chegar fora de ordem.
- Awareness sem limpeza de estados órfãos.

**Como varrer:** sessão real com 3+ abas, rede estrangulada, refresh no meio do combate, servidor
reiniciado com a mesa aberta. Não é teste automatizado — é meia hora quebrando de propósito com o log
aberto. *(ARQ-08, parte 3)*

- [ ] ✅ **Fase H concluída em:** ____/____/______

---

### FASE I — 🔍 VARREDURA: INTEGRAÇÃO BACKEND ↔ FRONTEND *(1–2 dias)*

Escopo: `src/api/*` contra os endpoints do Express — a costura que nenhuma das varreduras anteriores
olha, porque cada lado parece correto sozinho.

- [ ] **I.1** Varredura → ledger em `docs/varreduras/I-integracao.md`.
- [ ] **I.2** Executar apenas os itens FAZER.

**Pistas já levantadas:**
- Contratos de rota escritos duas vezes à mão: conferir se cada endpoint tem tipo compartilhado de
  request e response.
- Erros do servidor são strings em português (`{ error: "Acesso Negado! ..." }`) — o cliente decide
  comportamento a partir de texto? Códigos estáveis resolveriam.
- O que o usuário vê quando o token expira no meio da sessão (401)?
- `apiFetch` / `authedFetch`: têm timeout? retry? tratam corpo não-JSON?
- `RollResult` montado em dois lugares com campos ligeiramente diferentes.
- `VITE_API_URL` derivando `ws`/`wss` — testar cross-origin de verdade.

**O que a varredura pergunta:** se eu mudar este endpoint, o TypeScript me avisa no cliente — ou
descubro em produção? Todo estado de erro do servidor tem estado de UI correspondente?

- [ ] ✅ **Fase I concluída em:** ____/____/______

---

### FASE J — 🔍 VARREDURA: SEGURANÇA *(1,5–2,5 dias)*

A Fase B fecha os seis buracos conhecidos. Esta procura os que a auditoria não achou —
sistematicamente, e depois de todo o código novo de C, D e F ter entrado.

- [ ] **J.1** Varredura → ledger em `docs/varreduras/J-seguranca.md`.
- [ ] **J.2** Executar apenas os itens FAZER.

**Como varrer:**
- **Conferir o registro do portão** em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase): toda fase de construção respondeu as seis perguntas? Alguma resposta envelheceu?
- **Tabela completa:** cada endpoint e cada mensagem de WebSocket × autenticado? autorizado? entrada
  validada? saída filtrada? Uma linha por rota, sem exceção.
- Superfície de entrada: todo campo que entra em `sheet`, `gridState`, `initiativeList` e no
  protocolo Yjs — **o binário Yjs é entrada de usuário e hoje só tem try/catch**.
- Revisar o CSP: `connect-src https:` e `img-src https:` são amplos; apertar para os origins reais.
- Re-rodar as 56 de RLS e conferir as políticas de storage de avatar.
- `npm audit` e `gitleaks` sobre o **histórico completo**, não só o HEAD.
- Conferir que nenhum segredo entrou no bundle depois das mudanças de B (transformar o teste da T10.7
  em script).

**O que a varredura pergunta:** se um jogador convidado virar hostil, o que ele consegue fazer? (é o
modelo de ameaça real da decisão 3) Que dado sai do servidor para quem não deveria vê-lo?

- [ ] ✅ **Fase J concluída em:** ____/____/______

---

### FASE K — PROFUNDIDADE DE SISTEMA 🔨 *(4–5 dias)*

A Fase 11 do plano antigo, reordenada por retorno: export/import primeiro (dá confiança para usar de
verdade), netrunning por último (é meio jogo à parte).

- [ ] **K.1** *(era T11.5)* Export/import de ficha (JSON + impressão em PDF) — reaproveita o validador
      de `src/rules/sheetSchema.ts`.
- [ ] **K.2** *(era T11.1)* Inventário, peso e EV: Carry (BODY×10 kg), Lift (BODY×40 kg), encumbrance
      automático, penalidade de REF por armadura. *(RUL-11)*
- [ ] **K.3** *(era T11.3)* Pós-ferimento automático — em boa parte já entregue pela Fase C.
- [ ] **K.4** *(era T11.4)* Inventário e drops de NPC.
- [ ] **K.5** *(era T11.2)* Netrunning: MU, programas, data walls, ações por turno.
- [ ] **K.6** Criação de personagem com orçamento (pontos de atributo, perícia por INT+REF, carreira)
      e evolução por IP. *(RUL-10)*
- [ ] **K.7** Completar `SKILL_TABLES` (remover "Social" de INT; adicionar Accounting, Anthropology,
      Gamble, Shadow/Track, Wilderness Survival, Interrogation, Pharmaceuticals) e adicionar Leap
      (Run÷4). Remover "Walk", que não existe no livro. *(RUL-12, RUL-11)*
- [ ] **K.8** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](./SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
- [ ] **K.9** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](#-protocolo-de-sessão).
- [ ] ✅ **Fase K concluída em:** ____/____/______

---

### FASE L — AGUENTAR UMA MESA DE VERDADE 🔨 *(3 dias)*

Com jogadores convidados (decisão 3), é a fase que mais pode esperar — e a primeira a antecipar se o
público mudar.

- [ ] **L.1** Broadcast por delta (`chat:new`, `player:health`, `initiative:set`); estado completo só
      no join e na reconexão. *(ARQ-01)*
- [ ] **L.2** `manualChunks` separando **o Supabase**, que está no chunk de entrada e é carregado até
      para quem só quer rolar dados — é o maior contribuinte identificado do 1,3 MB. **Não** investir em
      lazy-loading do Yjs: a [ADR 0002](./adr/0002-yjs-websockets.md) o deixou sob observação, e não vale
      otimizar o carregamento de algo que pode sair inteiro. Revisar se
      `motion` paga o próprio peso. *(ARQ-04)*
- [ ] **L.3** Fatiar os arquivos grandes aproveitando os cortes que E e G–J mapearam. *(ARQ-05)*
- [ ] **L.4** Renomear os exports da camada Supabase e dividir o módulo por domínio. *(ARQ-06)*
- [ ] **L.5** ESLint com `typescript-eslint` em modo mínimo, zerar `any` e `console.*`,
      `--max-warnings 0` no CI. *(ARQ-07)*
- [ ] **L.6** **Decidir o fallback SSE com o dado da B.7.** Ninguém caiu para SSE em meses de uso? Remove
      o endpoint, o mapa `sseClients`, o caminho duplo do broadcast e o `EventSource` do cliente. Alguém
      caiu? Mantém, e a dúvida está encerrada com evidência em vez de opinião.
- [ ] **L.7** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](./SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
- [ ] **L.8** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](#-protocolo-de-sessão).
- [ ] ✅ **Fase L concluída em:** ____/____/______

---

### FASE M — VALIDAÇÃO E ENCERRAMENTO 🔨 *(1 dia)*

- [ ] **M.1** Suíte completa: `tsc --noEmit`, build, unit, integração, E2E, RLS, `npm audit`.
      *(é a T12.2 do plano antigo)*
- [ ] **M.2** **Uma sessão de jogo real**, 2+ pessoas, do zero ao combate. É o teste que nenhuma suíte
      substitui e o único que valida C e D. *(é a T12.3 do plano antigo)*
- [ ] **M.3** Revisar os cinco ledgers de varredura: todo ADIAR ainda tem gatilho plausível?
- [ ] **M.4** Arquivar o roadmap concluído no `README.md`. *(é a T12.5)*
- [ ] **M.5** Encerrar formalmente o `PLANO_DE_ACAO.md` (`git rm` + commit). *(é a T12.6, DOC-05)*
- [ ] **M.6** `git tag v0.5.0`.
- [ ] **M.7** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](./SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
- [ ] **M.8** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](#-protocolo-de-sessão).
- [ ] ✅ **Plano concluído em:** ____/____/______

---

## 📈 RESUMO DE PROGRESSO

| Fase | Tipo | Descrição | Status | Data |
|---|---|---|---|---|
| A | 🔨 | Reancorar o projeto | ✅ | 03/09/2026 |
| B | 🔨 | Fechar buracos de autorização | ⬜ | — |
| C | 🔨 | Fonte única de regras | ⬜ | — |
| D | 🔨 | Loop de combate | ⬜ | — |
| E | 🔍 | Varredura: backend | ⬜ | — |
| F | 🔨 | **Reestruturação visual: identidade Cyberpunk 2020** | ⬜ | — |
| G | 🔍 | Varredura: frontend | ⬜ | — |
| H | 🔍 | Varredura: multiplayer | ⬜ | — |
| I | 🔍 | Varredura: integração | ⬜ | — |
| J | 🔍 | Varredura: segurança | ⬜ | — |
| K | 🔨 | Profundidade de sistema | ⬜ | — |
| L | 🔨 | Performance e escala | ⬜ | — |
| M | 🔨 | Validação e encerramento | ⬜ | — |
