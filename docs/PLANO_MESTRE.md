# 🗺️ PLANO MESTRE — NETSHEET ENGINE

> **Documento mestre do projeto a partir de 02/09/2026.** Substitui o
> [`PLANO_DE_ACAO.md`](../PLANO_DE_ACAO.md), que guiou as Fases 0–10 (recuperação do código,
> segurança, migração para Supabase, multiplayer, testes e deploy) e cumpriu seu papel.
>
> **Como usar:** leia antes de cada sessão de trabalho, marque `[x]` no que concluir e continue do
> primeiro item aberto. Preencha a data ao fechar cada fase.
>
> A versão narrativa desta auditoria — com evidências, trechos de código e justificativas — está
> publicada como artefato e é a fonte de contexto quando um item aqui parecer arbitrário.

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

32 achados no código. IDs referenciados pelas fases.

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

### Arquitetura (9)

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

**Esforço total: 27,5 a 36,5 dias de trabalho concentrado** — quatro a sete meses de calendário para
quem tem outra ocupação. Ponto de corte natural: **fechando A–D o jogo já roda certo**; F entrega a
identidade visual nova; e as varreduras viram manutenção de fim de semana.

Legenda: 🔨 construção · 🔍 varredura (filtro de necessidade obrigatório)

---

### FASE A — REANCORAR O PROJETO 🔨 *(meio dia)*

- [ ] **A.1** Conferir se o projeto Supabase pausou (ocioso desde 25/08; o plano gratuito pausa com
      7 dias de baixa atividade). Checar e-mail do dono e o dashboard. Restaurar se necessário.
- [ ] **A.2** Conferir que a chave de IA **não tem conta de faturamento vinculada**.
- [ ] **A.3** `git tag v0.4.0` no commit atual — ponto de retorno de todo o plano.
- [ ] **A.4** Atualizar a seção 9 do `docs/PRD.md` e o roadmap do `README.md` para o estado real
      (Fases 0–10 fechadas). *(DOC-01, parte 1)*
- [ ] **A.5** Ativar backups/PITR no painel do Supabase e criar os secrets `SUPABASE_ACCESS_TOKEN`
      e `SUPABASE_PROJECT_REF` no repositório. *(DOC-03)*
- [ ] **A.6** Fixar o **Render** como alvo único de backend; arquivar `fly.toml` e `railway.toml` em
      `docs/deploy-alternativas/`. Manter `vercel.json`/`netlify.toml` — o frontend estático neles é
      recomendado pelo contrato de custo. *(DOC-02)*
- [ ] **A.7** Criar `docs/varreduras/` como casa dos ledgers das fases E–I.
- [ ] **A.8** Marcar o `PLANO_DE_ACAO.md` como **substituído** — *não* como concluído. O encerramento
      formal (T12.2–T12.6) é da Fase L. *(DOC-05, parte 1)*
- [ ] ✅ **Fase A concluída em:** ____/____/______

---

### FASE B — FECHAR OS BURACOS DE AUTORIZAÇÃO 🔨 *(2 dias)*

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
- [ ] **B.7** Testes de integração para cada item — a suíte atual cobre bem quem *pode* agir e não
      cobre quem não deveria conseguir *ler*.
- [ ] **B.8** `git tag v0.4.1`.
- [ ] ✅ **Fase B concluída em:** ____/____/______

---

### FASE C — UMA FONTE ÚNICA DE REGRAS 🔨 *(5–7 dias)*

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

### FASE F — REESTRUTURAÇÃO VISUAL DO FRONTEND 🔨 *(3–4 dias)*

> **Por que é fase própria e vem antes da varredura.** Redesign e caça a bug têm posturas opostas:
> a varredura pergunta "isto é necessário?" e tem ADIAR como padrão — se as duas coisas
> compartilhassem uma fase, ou o filtro mataria o redesign (que é discricionário por natureza), ou o
> redesign corromperia o filtro. E varrer código que você está prestes a reestilizar repete
> exatamente o erro que o plano já evita ao pôr as varreduras depois de B, C e D.

#### 🐛 F.0 — O bug que precede o redesign

- [ ] **F.0** **As fontes do projeto não carregam em produção.** O `src/index.css` importa Rajdhani e
      Share Tech Mono do Google Fonts, e o `@import` sobrevive ao build (confirmado em
      `dist/assets/index-*.css`). Mas o CSP do helmet em produção declara
      `style-src: 'self' 'unsafe-inline'` e `font-src: 'self' data:` — a folha do
      `fonts.googleapis.com` é bloqueada, e os arquivos do `fonts.gstatic.com` também. Como o helmet
      é pulado em dev, **o problema só existe no ar**: a produção renderiza em fontes de sistema.
      Corrigir **antes** de escolher tipografia nova, senão a Fase F inteira é validada num ambiente
      que não é o real.
      - Solução recomendada: **auto-hospedar as fontes** (`@fontsource/*` ou arquivos em
        `public/fonts/` com `@font-face` local). Mantém o CSP apertado, remove dependência de
        terceiro, melhora o LCP e não volta a acontecer quando você adicionar mais uma fonte.
      - Alternativa: afrouxar o CSP para `fonts.googleapis.com` / `fonts.gstatic.com`. Funciona, mas
        troca uma correção permanente por uma exceção.

#### F.1 — Definir o sistema tipográfico

> **O que a referência do Behance realmente entrega.** A galeria é o portfólio de Vladimír
> Vilimovský, Senior UI Artist da CD PROJEKT RED. Ela **não nomeia nenhuma fonte** — o texto diz que
> as razões da escolha estão na "UI Art Bible", que fica na *apresentação anterior* (Parte 1), e a
> tipografia aparece só dentro das imagens. Não há lista para extrair.
>
> O que ela **dá**, e é aproveitável, é o vocabulário visual: rótulos em CAIXA ALTA com numeração de
> seção (`PART_04`, `PART_05`), tokens unidos por underscore (`USER_INTERFACE`,
> `FULL—SCREEN_PANELS`), fragmentos de código como motivo de carregamento, e a decisão deliberada de
> usar **vermelho como cor primária** — que o próprio autor descreve como andar contra a corrente,
> assumindo o conflito com o vermelho de erro/aviso.

- [ ] **F.1.1** Registrar a stack tipográfica na ADR 0006. Realidade de licenciamento: o
      **Blender Pro** e o **Refrigerator Deluxe**, que o CP2077 de fato usa, são **comerciais** e não
      podem ser embarcados sem licença de webfont. O **Rajdhani** é livre (Google Fonts), é a fonte
      mais associada a esse visual — e **o projeto já usa**.
- [ ] **F.1.2** Completar a stack livre: manter Rajdhani (display/títulos) e Share Tech Mono
      (terminal/código), e avaliar **Chakra Petch** ou **Saira Condensed** como substituto livre do
      Blender Pro para rótulos, números e chapéus de seção.
- [ ] **F.1.3** Escala tipográfica explícita, tracking definido para caixa alta e
      `font-variant-numeric: tabular-nums` em toda coluna de número da ficha (atributos, SP, dano,
      iniciativa).

#### F.2 — Tokens de design

- [ ] **F.2.1** As cores hoje são classes Tailwind literais (`text-cyan-400`, `bg-slate-900/70`,
      `border-cyan-500`) espalhadas por 20 componentes — trocar a identidade exige achar e substituir
      em todos. Extrair para tokens CSS (`--nse-accent`, `--nse-surface`, `--nse-danger`…) é o que
      torna esta troca, e a próxima, barata.
- [ ] **F.2.2** **Decisão pendente — vermelho primário colide com vermelho de dano.** O CP2077 usa
      vermelho como cor primária; o NetSheet usa ciano/amarelo e reserva o vermelho para ferimento
      (`HealthTracker` usa `text-red-400/500/600` e `text-rose-600/700` na escala de wound level).
      Adotar vermelho primário faz "primário" e "você está morrendo" falarem a mesma língua. O artista
      tinha um jogo inteiro para sustentar essa aposta; uma ficha de RPG não tem. **Duas saídas:**
      (a) manter o amarelo/ciano como primário e o vermelho só para dano — recomendado; (b) adotar o
      vermelho primário e mover o dano para outro sinal (peso, moldura, ícone).

#### F.3 — Aplicar e verificar

- [ ] **F.3.1** Aplicar tipografia e tokens nos componentes, começando pela ficha (maior superfície
      visual) e terminando na mesa.
- [ ] **F.3.2** Acessibilidade do tema novo: contraste conferido nos dois modos, foco visível, ordem
      de tabulação nos modais. *(auditar contra a paleta nova, não a antiga)*
- [ ] **F.3.3** **Verificar em produção** (`NODE_ENV=production`, com helmet ativo) que as fontes
      realmente carregam. É a única forma de confirmar o F.0.
- [ ] **F.3.4** `git tag v0.4.4`.
- [ ] ✅ **Fase F concluída em:** ____/____/______

> **Nota de identidade.** A referência é Cyberpunk **2077** (jogo de 2020) e o produto é Cyberpunk
> **2020** (mesa de 1988). Adotar a linguagem visual do 2077 dá um resultado reconhecível como "a
> franquia Cyberpunk", não como "o RPG de mesa dos anos 80". É uma escolha de produto legítima — hoje
> a imagem mental de cyberpunk da maioria das pessoas *é* o 2077 — mas vale ser escolha, e não
> deriva.

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

### FASE J — 🔍 VARREDURA: SEGURANÇA *(1–2 dias)*

A Fase B fecha os seis buracos conhecidos. Esta procura os que a auditoria não achou —
sistematicamente, e depois de todo o código novo de C, D e F ter entrado.

- [ ] **M.1** Varredura → ledger em `docs/varreduras/J-seguranca.md`.
- [ ] **M.2** Executar apenas os itens FAZER.

**Como varrer:**
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

- [ ] **M.1** *(era T11.5)* Export/import de ficha (JSON + impressão em PDF) — reaproveita o validador
      de `src/rules/sheetSchema.ts`.
- [ ] **M.2** *(era T11.1)* Inventário, peso e EV: Carry (BODY×10 kg), Lift (BODY×40 kg), encumbrance
      automático, penalidade de REF por armadura. *(RUL-11)*
- [ ] **M.3** *(era T11.3)* Pós-ferimento automático — em boa parte já entregue pela Fase C.
- [ ] **M.4** *(era T11.4)* Inventário e drops de NPC.
- [ ] **M.5** *(era T11.2)* Netrunning: MU, programas, data walls, ações por turno.
- [ ] **K.6** Criação de personagem com orçamento (pontos de atributo, perícia por INT+REF, carreira)
      e evolução por IP. *(RUL-10)*
- [ ] **K.7** Completar `SKILL_TABLES` (remover "Social" de INT; adicionar Accounting, Anthropology,
      Gamble, Shadow/Track, Wilderness Survival, Interrogation, Pharmaceuticals) e adicionar Leap
      (Run÷4). Remover "Walk", que não existe no livro. *(RUL-12, RUL-11)*
- [ ] ✅ **Fase K concluída em:** ____/____/______

---

### FASE L — AGUENTAR UMA MESA DE VERDADE 🔨 *(3 dias)*

Com jogadores convidados (decisão 3), é a fase que mais pode esperar — e a primeira a antecipar se o
público mudar.

- [ ] **M.1** Broadcast por delta (`chat:new`, `player:health`, `initiative:set`); estado completo só
      no join e na reconexão. *(ARQ-01)*
- [ ] **M.2** `manualChunks` separando supabase e yjs; Yjs sob demanda na rota de mesa; revisar se
      `motion` paga o próprio peso. *(ARQ-04)*
- [ ] **M.3** Fatiar os arquivos grandes aproveitando os cortes que E–I mapearam. *(ARQ-05)*
- [ ] **M.4** Renomear os exports da camada Supabase e dividir o módulo por domínio. *(ARQ-06)*
- [ ] **M.5** ESLint com `typescript-eslint` em modo mínimo, zerar `any` e `console.*`,
      `--max-warnings 0` no CI. *(ARQ-07)*
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
- [ ] ✅ **Plano concluído em:** ____/____/______

---

## 📈 RESUMO DE PROGRESSO

| Fase | Tipo | Descrição | Status | Data |
|---|---|---|---|---|
| A | 🔨 | Reancorar o projeto | ⬜ | — |
| B | 🔨 | Fechar buracos de autorização | ⬜ | — |
| C | 🔨 | Fonte única de regras | ⬜ | — |
| D | 🔨 | Loop de combate | ⬜ | — |
| E | 🔍 | Varredura: backend | ⬜ | — |
| F | 🔨 | **Reestruturação visual do frontend** | ⬜ | — |
| G | 🔍 | Varredura: frontend | ⬜ | — |
| H | 🔍 | Varredura: multiplayer | ⬜ | — |
| I | 🔍 | Varredura: integração | ⬜ | — |
| J | 🔍 | Varredura: segurança | ⬜ | — |
| K | 🔨 | Profundidade de sistema | ⬜ | — |
| L | 🔨 | Performance e escala | ⬜ | — |
| M | 🔨 | Validação e encerramento | ⬜ | — |
