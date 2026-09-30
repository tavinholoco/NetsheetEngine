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

- **1.** Ler o [`CLAUDE.md`](../CLAUDE.md) (carregado automaticamente) e **este plano**.
- **2.** Achar o **primeiro item `[ ]` não marcado** — é de onde o trabalho continua. Se o item
      anterior está marcado mas a fase não tem data, a fase está em andamento. *(Os passos destes
      dois rituais não têm checkbox de propósito: são modelo, não estado. Todo `[ ]` do arquivo é
      trabalho real.)*
- **3.** `git log --oneline -15` e `git tag -l` — as tags fecham as fases de construção
      (`v0.4.0` na A, `v0.4.1` na B, `v0.4.2` na C, `v0.4.3` na D, `v0.4.4` na F, `v0.5.0` na M).
      **A tag e o `version` do `package.json` andam juntos** — o `/api/health` publica o `version`
      *(regra da revisão pós-D: ele ficou em 0.4.0 enquanto as tags chegavam a `v0.4.3`)*.
      Se o último commit não corresponde ao último checkbox marcado, **alguém parou no meio**:
      reconcilie antes de escrever código.
- **3b.** **Conferir o CI do `master` e o keepalive** — `gh run list --repo tavinholoco/NetsheetEngine
      --branch master --limit 3` e `gh run list --repo tavinholoco/NetsheetEngine --workflow
      keepalive.yml --limit 2`. **Vermelho em qualquer um dos dois é o primeiro trabalho da sessão**,
      antes de qualquer item de fase. *(Nasceu em 24/09/2026: o merge da Fase B ficou vermelho porque
      o token do CI tinha expirado, e a migration 0007 não chegou em produção — o PR estava verde
      porque o `db-sync` só roda no `master`.)*
- **4.** Ler o registro de [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase) das fases já
      fechadas, e as decisões do [`CLAUDE.md`](../CLAUDE.md) — para não reabrir questão resolvida.
- **5.** Varrer os **ADIAR em aberto** nos ledgers de [`varreduras/`](./varreduras/) e nas ADRs:
      algum gatilho disparou desde a última sessão? Um gatilho que disparou vira trabalho da fase
      corrente.
- **6.** Rodar `npx tsc --noEmit` e `npx vitest run` **antes de mudar qualquer coisa**. É a linha
      de base: sem ela, você não sabe se quebrou algo ou se já estava quebrado. Os números esperados
      estão em [Linha de base atual](#linha-de-base-atual), no fim deste arquivo.

### Ritual de ENCERRAMENTO — ao fechar uma fase

Cada fase de construção termina com estes passos — o portão e o estado durável já aparecem como
itens da própria fase. Não são opcionais:

- **1.** 🔒 **Portão de segurança** — as seis perguntas, registradas em
      [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase).
- **2.** 🧠 **Atualizar o estado durável** — marcar os checkboxes da fase, preencher a data,
      atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema
      mudou, e a tabela de progresso no fim deste arquivo.
- **3.** 🧠 **Atualizar a memória do Claude** — mas **só o que o repo não carrega**: uma decisão
      nova que valha para as próximas sessões, uma preferência de trabalho que você expressou, uma
      correção de rumo. **Não** copie o estado da fase para lá.
- **4.** **Revisar o que a fase produziu** — antes do PR, não depois:
      - *inconsistências*: documento que a fase tornou **falso** (diagrama, contrato de API, guia de
        deploy). Procurar também **fora de `*.md`** — `.env.example`, `render.yaml`, comentários de
        código. Na Fase B, duas sobras escaparam de uma varredura que olhou só `*.md`/`*.yml`/`*.json`;
      - *refatoração* do código que a própria fase escreveu (duplicação, abstração faltando). **Não**
        é varredura do repositório — isso é das Fases E e G–J.
- **4b.** Rodar **tudo**, E2E incluído (`npm run test:e2e`), antes do PR. *(Nasceu na Fase C: dois E2E
      codificavam as regras antigas e só apareceram no fim.)*
- **5.** Commit com mensagem que explique o *porquê*, e a tag da fase quando houver. Push do branch e
      **PR para o dono revisar e mergear** — nunca push direto no `master`.
      **Se a fase tiver migration** (decisão 5): a migration vai num **PR próprio**, que é mergeado
      primeiro e conferido em produção com `npx supabase migration list --linked`. Só depois abre o PR
      do código que a usa. O Render publica a cada push no `master` sem esperar o `db-sync`.
      **E antes do merge do PR da migration, um backup** (`npm run backup:db` — decisão 8), anotado
      no [registro](./BACKUP.md#registro-de-backups). Nunca durante um `db-sync` ou o keepalive.
- **6.** **Depois do merge, conferir o CI do `master`.** O job `db-sync` só roda lá: **PR verde não
      prova que a migration entrou em produção.** A fase só termina de verdade com o `master` verde.

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

## 🔬 AUDITORIA DAS AFIRMAÇÕES DESTE PLANO (03/09/2026)

Feita na Fase A, a pedido do dono, depois que dois defeitos apareceram no mesmo dia. **Todos os
defeitos encontrados são da mesma classe: afirmação escrita a partir de leitura de arquivo, sem
verificar o estado real.** As afirmações sobre *código* se sustentaram; as sobre *estado de
configuração* não.

### Confirmadas por medição

| Afirmação | Medido |
|---|---|
| 141 testes, `tsc` limpo | 141/141, 0 erros ✅ |
| 6 vulnerabilidades (3 altas, 3 moderadas) | exato ✅ |
| Bundle 1,34 MB / 390 KB gzip | 1.335,78 kB / 389,56 kB ✅ |
| `combatModifier` não é lido por rolagem nenhuma | 12 ocorrências: tipo, testes, clamp e persistência. **Zero leituras** ✅ |
| `currentStats` sem um único leitor | 7 ocorrências, todas escrita/tipo/teste. **Zero leituras** ✅ |
| Tokens de cor com 0 consumidores | 0 usos dos 8 tokens em `.tsx` ✅ |
| ARQ-05: 4 arquivos concentram ~4.000 linhas | 3.909 ✅ |
| ~1.700 cores literais em `.tsx` | 1.670 ✅ |

### Corrigidas

| Onde | O plano dizia | O real |
|---|---|---|
| **DOC-03** | secrets do `db-sync` pendentes | **Os dois já existiam.** O job estava vivo e **falhando em todo push no `master`** desde 02/09 — não inerte |
| **A.5** | ativar PITR | PITR exige plano pago; colide com o custo zero → decisão 4 |
| **SEC-06** | cadeia `express → body-parser → qs` | Três pacotes independentes: `qs`, **`mathjs`** e **`nanoid`**. A correção da B.6 é maior que o descrito |
| **F.2** | 5 tokens no `@theme` | 8 tokens *(a conclusão — 0 consumidores — permanece)* |
| **F.2** | `scanline`/`glitch` com 0 componentes usando | Correto para as **animações**. Mas existe uma classe estática `.crt-scanlines` em uso no `HomePage.tsx:38` — nem tudo da identidade está desligado |

### O que isso implica para as próximas fases

Antes de executar um item, **verifique a premissa dele** em vez de confiar no texto. As fases E e
G–J já têm isso embutido (varredura é verificação), mas B, C, D, F e K executam a partir de
descrição — e é ali que uma premissa velha vira trabalho errado.

---

## 🔬 REVISÃO PÓS-D (29/09/2026)

Pedida pelo dono depois do merge da Fase D: rever as fases que faltam, achar inconsistências e
pesquisar melhorias. **Mesmo método da auditoria de 03/09 — medir, não ler.** E o mesmo resultado de
classe: as afirmações sobre **regra de jogo** se sustentaram; as sobre **configuração** e sobre
**quem ganha sessão na mesa** não.

Linha de base conferida antes de tudo: `master` em `55a0acd`, CI e keepalive verdes, `tsc` 0 erros,
**522/522** testes em 26 arquivos.

### Premissas que caíram

| Onde | O plano dizia | O real | Fonte |
|---|---|---|---|
| **Decisão 4** | "O free tier já faz backup diário automático" | **Não faz.** O Supabase só faz backup automático dos planos Pro, Team e Enterprise, e recomenda que o gratuito exporte com `db dump`. **Hoje o projeto não tem backup nenhum** | [Supabase — backups](https://supabase.com/docs/guides/platform/backups) |
| **Decisão 3** | público da alpha = convidados do dono | O produto **não tem convite**: `GET /api/rooms` lista toda sala a qualquer visitante, e `POST /join` aceita quem souber o código. O "convidado hostil" do portão é, na prática, **qualquer pessoa com a URL** | `server.ts` |
| **B.6 / SEC-06** | `qs` sem patch na linha 4.x do Express | **O gatilho disparou:** saiu o `express@4.22.3` (tag `latest-4`), que pede `qs ~6.16.0`, fora da faixa vulnerável (`≤ 6.15.3`). `npm audit fix` fecha as 3 moderadas | `npm view express dist-tags`, `npm audit` |
| **B.7 → L.6** | decidir o SSE com "meses de mesa" do log `sse_fallback` | O plano Hobby do Render **guarda log por 7 dias**. Sem registro fora do Render, o dado da L.6 some antes de ser lido | [Render — logging](https://render.com/docs/logging) |
| **Versão do Node** | *(nenhuma — ninguém fixou)* | `engines: ">=20"` e nenhum `.node-version`: o Render resolve faixa sem teto para o **`latest`**, hoje o **Node 26 (Current, não LTS)**. O CI testa o 20 — **fim de vida em 30/04/2026** — e o 22; o dev local roda o 24. A produção roda uma versão que ninguém testa | [Render — Node](https://render.com/docs/node-version), [calendário do Node](https://github.com/nodejs/Release/blob/main/schedule.json) |
| **L.2** | "Revisar se `motion` paga o próprio peso"; Supabase como "maior contribuinte do 1,3 MB" | O `motion` saiu na ARQ-10 (02/09) e o chunk de entrada é **629 kB** desde a C.1 | `package.json`, linha de base |
| **F.2** | 5 tokens no `@theme`; 1.722 cores literais | **8** tokens (a auditoria de 03/09 corrigiu o índice, a tabela da F ficou) e **1.731** cores literais | grep em 29/09 |
| **J** | "gitleaks sobre o histórico completo, não só o HEAD" | **Já é assim:** o job do CI faz checkout com `fetch-depth: 0` e o `gitleaks detect` varre o histórico | `ci.yml` |
| `package.json` | *(versão acompanha a tag)* | `version` parado em **0.4.0** com a tag em `v0.4.3` — o `/api/health` publica a versão errada | `server.ts:6` |
| `PRODUCTION_CHECKLIST.md` | *(corrigido na Fase A, junto com o `DEPLOY.md`)* | **Não foi.** Ainda manda ligar **UptimeRobot no `/api/health`** (a regra 3 do custo zero proíbe), "confirmar backups diários automáticos" e diz que o `db-sync` é inerte | o próprio arquivo |
| `ARQUITETURA.md`, `ci.yml` | "Groq previsto na Fase B"; `db-sync` "INERTE", "0001–0006" | A B não migrou o provedor (ADR 0005); o job nunca foi inerte (A.5) e há 7 migrations | ADR 0005, A.5 |

### Achados novos no código

Os quatro primeiros foram **reproduzidos** com um script contra o `roomManager` (fora do repo). São
**anteriores à Fase D** — nascem da T1.7 e da T3.3 do plano antigo — e passaram pelo portão da B
porque o portão pergunta sobre *o que a fase mudou*, e ali mudou quem **usa** a sessão, não quem a
**recebe**. A pergunta 3 do portão ganhou essa segunda metade.

| ID | Sev. | Achado | Prova |
|---|---|---|---|
| SEC-07 | 🔴 | `join` com um `peerId` que já está na sala é tratado como reconexão: **emite token novo e revoga o do dono, sem prova de posse**. Todo `peerId` — inclusive o `gmPeerId` — vai no estado transmitido à mesa | O convidado lê o `gmPeerId`, faz `join` com ele e recebe sessão de GM; o token do GM verdadeiro passa a não valer; `updateRoomSettings` com o token tomado é **permitido** |
| SEC-08 | 🟠 | `create` com um código que já existe **substitui a sala** — sem sessão e sem conferência. O lobby público entrega os códigos | Sala com GM e jogador → `createRoom` com o mesmo código → jogadores `[peer_hostil]`, GM `peer_hostil`. A persistência grava por cima da linha |
| SEC-09 | 🟡 | Expulsar jogador (`deleteGeneratedPlayer`) **não revoga a sessão nem fecha o socket**: o expulso reabre o WebSocket e segue recebendo a sala inteira, fichas e chat | Depois da expulsão, `verifySession` ainda devolve o `peerId` dele. A saída voluntária revoga certo |
| SEC-10 | 🟠 | O WebSocket **não tem limitador por mensagem** — o chat pelo WS escapa do `chatLimiter` de 30/min — e o `maxPayload` é o padrão do `ws`, **100 MiB**. Cada mensagem reenvia a sala inteira a todas as conexões | Com a medição de 26/09 (sala ~48 KB × 5 conexões ≈ 250 KB por mensagem), **10 mensagens/s gastam os 5 GB do workspace em ~35 min** — e a cota estourada desliga NetSheet **e** Newra News até o mês seguinte. Um quadro de 100 MiB leva a instância gratuita perto do teto de memória |
| SEC-11 | 🟡 | Nenhum `trust proxy`: atrás do proxy do Render o `req.ip` tende a ser o do proxy, e os três limitadores viram **um balde só para todo mundo** | Predito pela doc do Express e por deploys no Render. **Conferir em produção** — número de saltos de proxy é premissa de configuração |
| SEC-12 | 🟡 | No grid Yjs, a checagem de posse (`mirrorDocToJson`) usa o `peerId` **novo** do token e não compara o campo `peerId` (nem o `icon`): um jogador moveria qualquer token reescrevendo o dono no mesmo update | **Derivado da leitura, não reproduzido** — exige cliente Yjs. Reproduzir com teste antes de consertar. *(Reproduzido na R.6, com cliente Yjs real: pior que o lido — o jogador toma o token de outro jogador)* |

### O que a pesquisa acrescentou às próximas fases

| Tema | Achado | Vai para |
|---|---|---|
| Conexão morta no WS | O servidor não manda `ping`: socket que caiu sem aviso fica no `wsClients` recebendo broadcast. O [README do `ws`](https://github.com/websockets/ws#how-to-detect-and-close-broken-connections) recomenda ping/pong com `terminate()` | pista da E |
| Modelo de IA fixo | `gemini-2.5-flash` está no código. Desde 18/09/2026 o Google [limita o acesso aos modelos 2.5](https://ai.google.dev/gemini-api/docs/deprecations) a quem já os usava — sem data de desligamento | gatilho novo na ADR 0005, pista da E |
| Acessibilidade dos efeitos | [WCAG 2.2](https://www.w3.org/TR/WCAG22/): animação automática com mais de 5 s precisa de controle para parar (**2.2.2, nível A**); nada pode piscar mais de 3×/s (**2.3.1, A**). Hoje: **0** `prefers-reduced-motion` e **23** usos de `animate-pulse/ping/spin` | F.4.2 |
| Fontes auto-hospedadas | Os pacotes [`@fontsource`](https://fontsource.org/) das três faces (todas SIL OFL) trazem `woff2` por subconjunto; o Vite os copia para `dist/assets` e o CSP `'self'` continua valendo | F.0 |
| Erro tratável pelo cliente | A [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) (Problem Details, substitui a 7807) é o formato padrão; a versão 10× menor é um `code` estável ao lado do `error` | I, pista da E |
| Backup de custo zero | O [guia oficial](https://supabase.com/docs/guides/deployment/ci/backups) commita o dump no repositório — e avisa para nunca fazer isso em repo público. **Este repo é público** | R.10 |

### O que isso implica

1. **Um bloco novo antes da Fase E** — as [pendências da revisão pós-D](#-pendências-da-revisão-pós-d--antes-da-fase-e).
   SEC-07 e 08 são "perde dado", a resposta da pergunta 3 do filtro que justifica interromper; o
   SEC-10 desliga os dois serviços do workspace por até um mês. **Janela:** o Render volta em 01/10;
   até lá nada está no ar.
2. **O repositório é público** (conferido em 29/09), e o `master` não tem proteção de branch. Este
   plano descreve as falhas com precisão, como sempre fez — por isso o texto que as descreve **vai
   ao ar junto com o conserto, não antes**. Regra nova do portão: achado de segurança aberto é
   publicado com a correção.
3. **As decisões 3 e 4 voltam ao dono** com fato novo — é o "motivo novo" que o `CLAUDE.md` exige
   para reabrir decisão.

---

## ⚖️ Decisões tomadas (02/09/2026)

Estas respostas fecham ambiguidades que mudariam o trabalho. Não reabrir sem motivo novo. *(1 a 3 em
02/09; 4 em 03/09; 5 em 25/09; 6 em 26/09; 7 em 28/09; 8 em 29/09; 9 em 30/09/2026.)*

| # | Pergunta | Decisão | Consequência |
|---|---|---|---|
| 1 | A explosão do d10 encadeia? | **Sim, encadeia** | Cliente e PRD já estão certos. Corrigir só o servidor, sem configuração por mesa. |
| 2 | Fidelidade estrita ou regras de casa? | **Fidelidade estrita ao CP2020** | Nenhuma divergência vira "regra de casa". A Fase C ganha conferência sistemática contra o livro. |
| 3 | Quem é o público da alpha? | **Jogadores convidados pelo dono** | SEC-02 cai de crítico para alto. Fase L (performance) fica por último. SEC-01 continua crítico — custo de API não depende de quem joga. **⚠️ Revisão pós-D (29/09):** o produto não impunha o convite — o lobby listava toda sala e o `join` aceitava quem soubesse o código. **Imposto na R.11 (29/09):** a sala saiu do lobby, e o código, com sufixo aleatório, é o convite |
| 4 | Ativar PITR no Supabase (A.5)? | **Não — ADIAR.** PITR exige plano Pro (pago); o dono confirmou que o projeto fica no free tier | Colide com o contrato de custo zero sem sintoma que justifique. ~~O free tier já faz backup diário automático — só falta granularidade de restauração por ponto no tempo.~~ **⚠️ Premissa falsa (revisão pós-D, 29/09):** o plano gratuito **não tem backup automático nenhum** — só Pro, Team e Enterprise ([docs](https://supabase.com/docs/guides/platform/backups)). O "não ao PITR" continua; **como fazer backup** voltou ao dono na R.10 e virou a **decisão 8** |
| 5 | Como evitar que o Render publique código antes da migration que ele usa? (P.5) | **Migration em PR próprio**, mergeado e conferido em produção antes do PR do código que a usa | O Render faz auto-deploy a cada push no `master`, sem esperar o `db-sync`. Regra de processo, custo zero, nada novo para configurar. Ver o passo 5 do ritual de encerramento |
| 6 | Na cabeça, o dano dobra antes ou depois do BTM? | **Depois — opção A: armadura → BTM (mín. 1) → ×2** | O livro dá a regra e não diz quando; A é a ordem do texto e a das implementações de fãs. B seria mais letal pelo valor do BTM. Pesquisa e números na [conferência](./CONFERENCIA_CP2020.md#dano--a-ordem-do-pipeline-para-a-fase-d) |
| 7 | As quatro perguntas da D.0: quem escreve o ferimento na mesa, pontos × nível, token sem ficha, penetração escalonada | **(a)** Na mesa, **só o servidor e o GM** escrevem o ferimento — a sincronia da ficha deixa de levá-lo. **(b)** A ficha **guarda pontos** (0–40), e o nível é derivado; junto nasce o estado **Morto**. **(c)** Token sem ficha **não recebe dano**. **(d)** Penetração escalonada: **ADIAR** | (a) fecha o achado do portão C.14. (b) é fidelidade estrita: o livro conta pontos, e o nível sozinho perde o resto da caixa. Sem migration SQL — a ficha mora no `data` jsonb. (c) e (d) são as versões menores, com gatilho na [conferência](./CONFERENCIA_CP2020.md#o-que-a-fase-d-conferiu). Detalhe na D.0 |
| 8 | Como fazer backup, se o plano gratuito não faz nenhum? (R.10 — reabre a premissa da decisão 4) | **Dump manual** com o CLI (`npm run backup:db`), **todo mês e antes de toda migration**, guardado **fora do repositório** e fora da máquina, de preferência cifrado | Custo zero, e é o que a doc do Supabase recomenda ao gratuito. O repo é **público**: o script recusa destino dentro dele, e o `.gitignore` barra o dump à mão. Os arquivos do Storage (avatares) ficam de fora. Runbook e registro em [`BACKUP.md`](./BACKUP.md). **Gatilho para rever:** perder dado entre dois dumps, ou o volume de fichas tornar o mês de perda inaceitável — aí o workflow com dump cifrado (opção 2 da R.10) |
| 9 | Quanto de netrunning entra na K? (K.0b — a revisão de robustez mediu que a Net inteira não cabe na K) | **O netrunner na ficha** — deck, programas e MU como dado — entra na K.5. **A Net jogável na mesa** (mapa, turnos, fortalezas de dados) fica **fora da K: ADIAR**, como fase própria depois da L | A K volta a caber na estimativa. **Gatilho** da Net na mesa: alguém da mesa do dono jogar de netrunner. As regras vêm do livro, que o dono tem (30/09) — o cuidado com o RED, que mudou quase tudo no netrunning, vale em dobro |

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

### O roteiro de uma varredura

*(Revisão de robustez, 29/09/2026.)* Até aqui cada varredura tinha **duas caixas** — "varrer" e
"executar" — e o resto era prosa. Três defeitos saíam disso: uma varredura de 1–2 dias numa caixa só
não deixa a sessão fria saber **o que já foi olhado** (o protocolo de sessão depende de caixa); as
pistas envelheciam sem ninguém medir (das 14 da E, uma a R.3 já tinha resolvido sem ninguém riscar,
uma dava ao `roomManager` 1.461 linhas quando são 1.579, e uma escondia um bug reproduzível — o
horário do chat, na E.1d); e o código que a varredura muda **não passava pelo portão** nem tinha
passo de PR. Toda varredura (E, G–J) segue agora os mesmos passos — escritos só aqui —, e cada fase
lista só as suas áreas.

| Passo | O que é | Pronto quando |
|---|---|---|
| **X.0** 🔍 Premissas | Medir cada pista contra o código do dia (grep, contagem, reprodução). Resolvida sai riscada; mudada ganha o número novo | Toda pista com medição e data |
| **X.1** Áreas | Uma caixa por área. Cada área responde às perguntas dela, classifica as pistas dela **e procura além delas** — varredura que só classifica pista é revisão, não varredura | A seção da área existe no ledger |
| **X.2** Calibragem e revisão do dono | Contar os FAZER (acima de 1/3, recalibrar). O ledger vai num **PR só de documento**; o merge do dono aprova os veredictos. **Achado de segurança aberto fica fora desse PR** (o repo é público): uma linha sem o caminho, e o texto inteiro vai com o conserto | Ledger mergeado |
| **X.3** Executar os FAZER | Um commit por item, teste que reproduz **antes**, provado revertendo | Cada FAZER com teste e prova |
| **X.4** 🔒 Portão | Se a X.3 mudou código, as seis perguntas em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). Se nada virou código, uma linha dizendo isso | Registro escrito |
| **X.5** 🧠 Estado durável | Passos 2–6 do [ritual de encerramento](#ritual-de-encerramento--ao-fechar-uma-fase): caixas, data, linha de base, E2E, PR, `master` verde | `master` verde depois do merge |

**Por que a X.2 separa os dois tempos com um merge:** a regra 1 acima pede disciplina; o PR a impõe
por processo. E quem corrige veredicto é o dono — foi ele que desfez o ADIAR errado da A.5.

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
| 3 | Que **autorização nova** existe? O autor vem da sessão, nunca do corpo? **E quem recebe a sessão prova o quê?** | Spoofing / EoP | T1.7; a segunda metade, SEC-07 (revisão pós-D) |
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

*Refeito em 26/09/2026, com medição. A estimativa de 02/09 olhava só as horas e supunha que só a
mesa acordava o servidor.* Duas cotas do plano gratuito importam. As duas são **por workspace**
(divididas com o Newra News), e as duas **desligam os serviços até o mês seguinte** se estourarem
sem cartão cadastrado ([docs do Render](https://render.com/docs/free),
[banda](https://render.com/docs/outbound-bandwidth)):

| Cota | Limite | NetSheet, uso esperado | Fatia |
|---|---|---|---|
| Horas de instância | 750 h/mês | **~15–40 h** | 2–5% |
| Banda de saída | **5 GB/mês** (era 100 GB até abril de 2026) | **~0,5–1,5 GB** | 10–30% |
| Minutos de build | 500 min/mês | ~20–75 min (um build de ~2–5 min por merge no `master`; setembro teve 9) | 4–15% |

**De onde vêm as horas.** O serviço dorme após 15 min sem tráfego, e dormindo não gasta hora. Ele
acorda com:
- **sessão de jogo** — mensagens de WebSocket contam como tráfego, e o heartbeat de 20 s mantém o
  servidor acordado a sessão inteira, mais 15 min no fim. 2–4 sessões de ~4 h, mais a preparação do
  GM: **~10–20 h**;
- **qualquer visita ao site**, mesmo só para mexer na ficha: hoje o Render serve o site **e** a API.
  Cada visita custa pelo menos 15 min: **~3–15 h**;
- testes do dono em produção: **~2–5 h**.

**De onde vem a banda.** Cada ação na mesa (mensagem, rolagem, token movido, ferimento, ficha
editada) **reenvia a sala inteira a cada conexão** e ainda a grava no Supabase — o ARQ-01. Medido em
26/09 com o código do servidor: sala com 4 jogadores, 4 NPCs e o chat cheio = **~48 KB** (fichas do
gerador, ~2,7 KB cada); com fichas de jogador de verdade, ~50–100 KB. Com 5 conexões e ~150 ações por
hora de mesa: **~45–90 MB por hora**, ~0,2–0,4 GB por sessão. O site inteiro pesa 0,95 MB
(0,27 MB com gzip) na primeira carga de cada aparelho — pouco.

**A regra 4 (site fora do Render) economiza pouco, pelos números:** só as horas de visita e a banda do
site. Continua valendo, mas não é urgente — fazer quando o produto for publicado.
*(Revisão de robustez, 29/09/2026: "quando o produto for publicado" não é gatilho verificável, e
nenhuma fase é dona da regra 4. **ADIAR — gatilho:** o painel do Render mostrar o NetSheet acima de
100 h num mês (o mesmo número do risco 1 abaixo), ou a mesa abrir para gente de fora dos convidados.
Quando disparar, vira item junto com a I.1e — o cross-origin só se testa de verdade com o site fora.)*

**Os riscos reais — os dois de uso normal ainda sem sintoma; o de abuso, calculado na revisão pós-D:**

1. **Aba esquecida.** ~~O lobby consulta a lista de salas a cada **8 s**, e~~ a mesa manda heartbeat a
   cada 20 s — **inclusive com a aba em segundo plano** *(desde a R.11, 29/09, o lobby não consulta
   mais nada: a lista de salas saiu, e com ela metade deste risco)* (o navegador desacelera os timers, mas não para
   intervalos acima de 15 min). Uma aba de mesa esquecida mantém o serviço acordado enquanto o
   computador estiver ligado: uma noite ≈ +10 h; um PC que nunca desliga ≈ +720 h — o mesmo efeito do
   uptime bot da regra 3. **ADIAR — gatilho:** a página de uso do Render mostrar o NetSheet acima de
   100 h num mês, ou uma aba esquecida observada. Versão 10× menor, quando disparar: pausar o polling e
   o heartbeat com a aba oculta (`document.hidden`) e fechar o socket depois de ~30 min oculta.
2. **Mesa grande.** A banda cresce com o **quadrado** dos jogadores (sala maior × mais conexões). Com
   6 ou mais jogadores e fichas cheias, uma sessão passa de 0,5 GB. **É o ARQ-01, já na Fase L**
   (broadcast por diferença). **Gatilho para antecipar:** a banda do workspace passar de 2,5 GB num
   mês. Mitigação intermediária de uma linha: compressão por mensagem no WebSocket
   (`perMessageDeflate`) — JSON comprime bem, mas custa CPU e memória no servidor gratuito. *(Revisão
   de robustez, 29/09: o README do `ws` avisa de fragmentação de memória catastrófica com
   concorrência no Linux — a linha é uma, o teste de memória antes não é opcional. Ver a L.0.)*
3. **Abuso pela mesa (SEC-10, revisão pós-D).** O WebSocket não limita mensagens, e cada uma reenvia
   a sala inteira a todas as conexões. Um participante com um script — e, com o lobby aberto, qualquer
   visitante é participante — a **10 mensagens/s gasta os 5 GB do workspace em ~35 min**. Não é
   estimativa de uso, é teto que falta: **FAZER na R.4**, antes da primeira sessão em produção.
   *(Feito na R.4, 29/09.)* O WebSocket ganhou os tetos do REST — mas os tetos do REST ainda deixam
   120 reenvios da sala por minuto a um participante hostil: **menos de 3 h para os 5 GB**. O abuso
   passou de minutos para horas, não para nunca. O que fecha de vez é quem pode entrar (R.11) e o
   broadcast por diferença (L.1). **Gatilho para antecipar a L.1:** a R.11 manter a mesa aberta a
   qualquer visitante, ou um `ws_rate_limited` aparecer no log de uma sessão real.

**Medir em vez de estimar:** a partir de 01/10, a página de uso do workspace no painel do Render mostra
horas e banda por serviço. Conferir depois da primeira sessão de jogo e trocar esta estimativa pelo
número real.

> **⚠️ Incidente de setembro de 2026 — o limite de horas estourou.** Em 26/09 o serviço respondia
> `503 Service Suspended`: o workspace passou das 750 h do mês. **Causa, segundo o dono:** durante o
> desenvolvimento do Newra News, instâncias novas foram criadas sem querer e ficaram rodando, somando
> horas — a regra 2 vista pelo avesso. O dono já corrigiu no outro projeto. O Render suspende os
> serviços gratuitos até a virada do mês, e as horas são **por workspace**: o NetSheet caiu junto,
> sem ter causado. **Volta em 01/10/2026.** Enquanto o serviço está suspenso, nada que for mergeado
> no `master` chega ao ar.

> **Nota sobre o Newra News:** o `CRON_SCHEDULE: "0 8 * * *"` é um cron **em processo**. No plano
> gratuito do Render, se ninguém acessar o portal nos 15 minutos anteriores às 08:00, o processo está
> hibernado e o artigo diário **não é gerado**. Isso é problema do outro repositório, mas foi
> observado durante esta auditoria e vale registrar.

---

## 📊 ÍNDICE DE ACHADOS

33 achados da auditoria de 02/09, **12 da [revisão pós-D](#-revisão-pós-d-29092026)** (29/09 — 11 na revisão, 1 no portão das R) e
**2 da Fase E** (30/09), no fim desta seção. IDs referenciados pelas fases.

### Segurança (6)

| ID | Sev. | Achado | Fase |
|---|---|---|---|
| SEC-01 | 🔴 Crítico | `/api/gemini` sem autenticação e com `systemInstruction` do cliente — proxy de LLM pago pela sua chave | B |
| SEC-05 | 🟠 Alto | Ficha gravada sem validação (`sheet` verbatim) — anula o RNG server-authoritative da T5.4 | B |
| SEC-02 | 🟠 Alto | Leitura de sala e stream SSE sem sessão — expõe fichas, chat e grid | B |
| SEC-03 | 🟠 Alto | Sessões só em memória — restart derruba todas as mesas | B |
| SEC-06 | 🟡 Médio | 6 vulnerabilidades em dependências de produção — **três pacotes independentes**: `qs` (via `express → body-parser`), `mathjs` e `nanoid`. *(Corrigido em 03/09: o achado original citava só a cadeia do `qs`)* | B |
| SEC-04 | 🟡 Médio | Salas, sessões e buckets do rate limiter nunca expiram | B |

### Regras CP2020 (12)

| ID | Sev. | Achado | Fase |
|---|---|---|---|
| RUL-01 | 🔴 Crítico | BTM derivado de `BODY+REF` com sinal invertido (livro: só BODY, 0 a −5) | ✅ C.2 |
| RUL-02 | 🔴 Crítico | Ataque na mesa é `1d10 + REF + WA` — falta a perícia de arma | ✅ C.3 |
| RUL-03 | 🔴 Crítico | `combatModifier` do GM nunca é somado a rolagem nenhuma | ✅ C.4 |
| RUL-04 | 🔴 Crítico | Sem pipeline de dano: SP, ×2 na cabeça e BTM não se conectam ao `woundLevel` | D |
| RUL-05 | 🟠 Alto | Dois motores de dados divergentes (cliente encadeia, servidor explode uma vez) | ✅ C.1 |
| RUL-06 | 🟠 Alto | Penalidade de ferimento não entra em rolagem; `currentStats` é campo morto | ✅ C.5, C.6 |
| RUL-07 | 🟠 Alto | Atributo da Special Ability escolhido por ternário — erra 7 dos 10 roles *(eram 9: a C.0 mediu)* | ✅ C.8 |
| RUL-08 | 🟡 Médio | Death save sem modificador cumulativo *(no 2020: −1 por nível Mortal; o "cumulativo por turno" é do RED)* | ✅ C.7 |
| RUL-09 | 🟡 Médio | Iniciativa digitada à mão, sem `1d10 + REF` | D |
| RUL-10 | 🟡 Médio | Criação de personagem sem orçamento (pontos, perícias, IP) | K |
| RUL-11 | 🔵 Baixo | Faltam Leap/Carry/Lift e EV; "Walk" é invenção | K |
| RUL-12 | 🔵 Baixo | Tabelas de perícia incompletas; "Social" duplicado em INT | K |

### Arquitetura (10)

| ID | Sev. | Achado | Fase |
|---|---|---|---|
| ARQ-01 | 🟠 Alto | Broadcast do estado completo da sala a cada mutação (100–300 KB) | L |
| ARQ-02 | 🟠 Alto | Regras do jogo implementadas duas vezes, sem teste de paridade | ✅ C.1, C.10 |
| ARQ-03 | 🟡 Médio | Instância única obrigatória combinada com plano que hiberna | B |
| ARQ-04 | 🟡 Médio | 1,34 MB no chunk de entrada *(623 kB desde a C.1 — a biblioteca de dados puxava o `mathjs`)* | L |
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

### Revisão pós-D (12) — 29/09/2026

| ID | Sev. | Achado | Fase |
|---|---|---|---|
| SEC-07 | 🔴 Crítico | `join` com `peerId` já presente emite sessão sem prova de posse e revoga a do dono — **tomada de GM** por qualquer um na mesa *(reproduzido)* | ✅ R.1 |
| SEC-08 | 🟠 Alto | `create` com código existente **substitui a sala** — sem sessão; perde fichas, chat e grid *(reproduzido)* | ✅ R.2 |
| SEC-10 | 🟠 Alto | WebSocket sem limitador por mensagem e com `maxPayload` de 100 MiB — um participante gasta a banda do workspace | ✅ R.4 |
| SEC-13 | 🟠 Alto | Sala sem teto de **assentos**: cada `join` novo cria um, cada um abre até 3 sockets e recebe cada reenvio *(achado do portão das R, 29/09 — reproduzido na R.16: 101 assentos para 100 joins)* | ✅ R.16 |
| OPS-01 | 🟠 Alto | **Nenhum backup** — a decisão 4 supôs um backup diário que o plano gratuito não tem | ✅ R.10 (decisão 8; restauração de teste com gatilho) |
| SEC-09 | 🟡 Médio | Expulsar não revoga a sessão nem fecha o socket — o expulso segue lendo a mesa *(reproduzido)* | ✅ R.3 |
| SEC-11 | 🟡 Médio | Sem `trust proxy`, os limitadores tendem a ser um balde só atrás do proxy do Render | ✅ R.5 (conferir no ar) |
| SEC-12 | 🟡 Médio | Posse de token no grid Yjs compara o dono **novo** — jogador move e toma token alheio *(reproduzido na R.6)* | ✅ R.6 |
| OPS-02 | 🟡 Médio | Node sem versão fixa: produção no `latest` (26, não LTS), CI no 20 (fim de vida) e no 22 | ✅ R.8 (conferir no log de 01/10) |
| DOC-06 | 🟡 Médio | A L.6 depende de meses de log, e o Render Hobby guarda 7 dias | ✅ R.12 |
| DOC-07 | 🟡 Médio | A decisão 3 (só convidados) não é imposta pelo produto: lobby público e `join` aberto | ✅ R.11 |
| OPS-03 | 🔵 Baixo | `version` do `package.json` em 0.4.0 com a tag em `v0.4.3` | ✅ R.9 |

### Fase E (2) — 30/09/2026

Achados da [varredura do backend](./varreduras/E-backend.md), **reproduzidos** e consertados num PR
próprio antes do ledger — detalhe e portão em [`SEGURANCA.md`](./SEGURANCA.md#fase-e--varredura-backend).

| ID | Sev. | Achado | Fase |
|---|---|---|---|
| SEC-14 | 🔴 Crítico | Grid malformado, pela REST ou pelo Yjs, trava a sala e — pelo vigia de presença, num `setInterval` sem `try` — **derruba o processo**, todas as mesas juntas. Sem login: criar sala não exige login no servidor *(reproduzido com o `npm run dev`)* | ✅ E.3a |
| SEC-15 | 🟠 Alto | O tamanho da mesa não tinha teto: salas (a instância de 512 MB e os 500 MB do banco em horas), ficha de até ~557 KB, NPCs, chat, e o buffer de socket que não lê *(medido e reproduzido)* | ✅ E.3b |

---

## 🗂️ AS 13 FASES

**Esforço total: 30,5 a 38,5 dias de trabalho concentrado** *(mais 1,5–2,5 das pendências R, da
revisão pós-D)* — quatro a sete meses de calendário para
quem tem outra ocupação. Ponto de corte natural: **fechando A–D o jogo já roda certo**; F entrega a
identidade visual nova; e as varreduras viram manutenção de fim de semana.
*(Revisão de robustez, 29/09/2026: o que resta, de E a M, soma **18,5–23,5 dias** pelas estimativas
das próprias fases — e duas estão curtas: a K com a Net inteira (ver K.0) e a L com o broadcast por
diferença (ver L.0).)*

Legenda: 🔨 construção · 🔍 varredura (filtro de necessidade obrigatório)

---

### Fases fechadas — A, B, pendências P, C e D

O detalhe de cada item — verificações, provas revertendo, decisões e achados — mora em
[`historico/FASES_A-D.md`](./historico/FASES_A-D.md), movido para lá **sem mudar o texto** na R.13
(29/09/2026): com ele aqui, o plano passava do que a ferramenta do Claude lê de uma vez, e sessão fria
que lê em pedaços pula coisa. Aqui fica o que uma sessão nova precisa saber de cada fase.

| Fase | O que entregou | Fechada | Tag · PR |
|---|---|---|---|
| [A — Reancorar o projeto](./historico/FASES_A-D.md#fase-a--reancorar-o-projeto--1-dia) | Tag de retorno, docs no estado real, Render como alvo único, keepalive e o CI de volta ao verde | 03/09/2026 | `v0.4.0` |
| [B — Buracos de autorização](./historico/FASES_A-D.md#fase-b--fechar-os-buracos-de-autorização--25-dias) | SEC-01 a SEC-06: IA trancada, ficha validada, leitura com sessão, sessões persistidas (`0007`), coletor de salas, portão de audit | 03/09 (merge 24/09) | `v0.4.1` · #6 |
| [P — Pendências operacionais](./historico/FASES_A-D.md#-pendências-operacionais--resolvidas-em-25092026-antes-da-fase-c) | `0007` aplicada em produção, token do CI trocado (vence ~25/10), decisão 5 (migration em PR próprio) | 25/09/2026 | — |
| [C — Fonte única de regras](./historico/FASES_A-D.md#fase-c--uma-fonte-única-de-regras--5575-dias) | `src/rules/`: motor único com paridade testada, BTM e ferimento do livro, perícia e modificador do GM na rolagem, stun e death save, habilidades especiais | 25/09 (merge 26/09) | `v0.4.2` · #8 |
| [D — Loop de combate](./historico/FASES_A-D.md#fase-d--fechar-o-loop-de-combate--34-dias) | Dano em pontos (armadura → BTM → ×2), ataque de NPC contra o alcance, iniciativa automática, death save por turno, estabilizar | 28/09 (merge 29/09) | `v0.4.3` · #12 |

> **Ponto de corte:** com A–D fechadas o jogo roda certo. Dá para jogar aqui e tratar o resto como
> manutenção — com a exceção da F, que é a única fase restante que muda o que o jogador vê.
> **Ressalva da revisão pós-D (29/09):** "roda certo" vale para as regras. Para jogar **em produção**,
> as pendências R.1–R.5 abaixo vêm antes — sem elas, qualquer participante toma o GM, apaga a mesa ou
> gasta a banda do workspace. *(R.1–R.6 e a R.16, teto de assentos, feitas em 29/09. O que resta antes
> de abrir a mesa ao público é a decisão R.11 — quem pode entrar.)*

---

### 🚨 PENDÊNCIAS DA REVISÃO PÓS-D — antes da Fase E

🔨 *(1,5–2,5 dias)* Nasceram da [revisão de 29/09/2026](#-revisão-pós-d-29092026). Mesmo formato das
pendências operacionais de 25/09: itens com checkbox, fora das 13 fases, que **precedem** a próxima.
SEC-07 e SEC-08 são **perda de dado** — a resposta da pergunta 3 do filtro que justifica interromper.
O SEC-10 não perde dado: ele **desliga os dois serviços do workspace até o mês seguinte**, o mesmo
efeito do incidente de setembro, e o contrato de custo zero existe para impedir isso. **Janela:** o
Render volta em 01/10/2026; até lá nada está no ar. O ideal é R.1–R.5 no `master` antes da primeira
sessão de jogo em produção.

**Por que isto não é a Fase J adiantada:** a J procura o que ninguém achou. Aqui os achados já estão
achados — quatro reproduzidos —, e o filtro manda consertar com teste que reproduz primeiro e
**provar revertendo**, como na B.

- [x] **R.0** 🔍 **Verificação de premissas** — a própria [revisão pós-D](#-revisão-pós-d-29092026).
      *(29/09/2026)*
- [x] **R.1** **SEC-07 — reconexão exige prova de posse.** Hoje o `peerId` faz papel de credencial, e
      ele é público. O `join` com um `peerId` que já está na sala passa a exigir **o token de sessão
      vigente daquele `peerId`** (header `X-Session-Token`, o mesmo da B.3); sem ele, `409` e o cliente
      entra como jogador novo. O `gmPeerId` inclusive.
      - **Muda contrato documentado** — a pergunta 5 do filtro pede a certeza toda. O
        [`PROTOCOLO_MULTIPLAYER.md`](./PROTOCOLO_MULTIPLAYER.md) §2 diz que, ao receber 401, o cliente
        refaz o `join` com o mesmo `peerId`. Desde a B.4 as sessões sobrevivem ao restart, então o 401
        legítimo para quem está na sala ficou raro — e é justamente o sintoma que o ataque produz.
        Decidir, com o teste na mão, o que o cliente mostra no 409.
      - **Caso de borda aceito:** sessão perdida na janela de 2 s do debounce de persistência (crash
        logo depois do `join`) vira assento novo; o GM remove o antigo.
      - **Versão maior, ADIAR:** assento vinculado à conta do Supabase (JWT), que também fecharia a
        porta "sair e voltar curado" da D.9. **Gatilho:** a R.11 decidir que a mesa exige login.
      - Teste primeiro, com o caso do script de 29/09 (o convidado toma o GM); depois o conserto,
        **provado revertendo**.
      - *(29/09/2026 — feito.)* `seatClaimRefusal` no `roomManager` é a regra única: assento ocupado
        (jogador **ou** `gmPeerId` sem jogador) só com o token vigente dele. O `joinRoom` a aplica e a
        rota responde **409 `{ code: "seat_taken" }`** — o primeiro `code` estável da API, a versão
        10× menor da RFC 9457. No cliente, `postJoin` manda o token no `X-Session-Token` e, no 409,
        entra como jogador novo uma vez só. Protocolo reescrito (§2).
      - **Testes:** `seat-claim.integration` (9) e `rooms-client` (5). **Provado revertendo:** com o
        código antigo, 11 dos 14 falham (os 3 que passam são os caminhos legítimos).
      - **Oito testes antigos reconectavam só com o `peerId`** — a tomada de assento escrita como
        expectativa, como o teste do `GET /api/rooms/:code` que a B.3 substituiu. Os três da T3.3
        passaram a provar o assento; e cinco helpers (`damage`, `death-save-turn`, `combat-loop`,
        `initiative`, `gm-attack`) faziam o GM reentrar sem token — tinham virado no-op silencioso.
        Um deles escondia um teste **passando pelo motivo errado**: "nem reconectando com uma ficha
        curada" passava porque a reconexão era recusada, não pela decisão 7a. Agora reconecta com o
        token e confere que a reconexão aconteceu.
      - **Variante achada no conserto, ADIAR:** quando o GM sai e ninguém fica online, o `gmPeerId`
        vira `undefined` e quem entrar com o **handle** do GM (público no lobby) assume o cargo
        (T1.1/T1.8). Não há prova possível — o assento do GM já não existe —, e mudar isso muda como
        uma mesa sem GM volta a ter um. **Gatilho:** a R.11 decidir manter o lobby aberto, ou uma mesa
        ser tomada assim. *(R.11, 29/09: o lobby fechou — o handle do GM só aparece para quem tem o
        código, que é o convite. O gatilho não disparou; o ADIAR fica.)*
- [x] **R.2** **SEC-08 — `create` não sobrescreve.** Código em uso → `409`, com mensagem que diga
      para escolher outro. Conferir os testes que reaproveitam o mesmo código de sala entre casos.
      *(29/09/2026)* A rota responde **409 `{ code: "room_exists" }`** ("Entre nela pelo código, ou
      escolha outro" — a tela de criação já mostra a mensagem do servidor), com o código
      comparado já normalizado. O `createRoom` **lança** se chegar com código em uso: é defesa para
      caminho futuro, e chegar lá é bug. Nenhum teste antigo reaproveitava código — conferido: a suíte
      inteira passou sem ajuste. `create-conflict.integration` (4); **provado revertendo:** 3 dos 4
      falham com o código antigo (o que passa é o do código livre). Efeito colateral bom: o **próprio
      GM** também perdia a mesa se clicasse "criar" de novo com o mesmo código.
- [x] **R.3** **SEC-09 — expulsar revoga.** O `deleteGeneratedPlayer` revoga as sessões do alvo
      (`revokeSessionsForPeer`, como o `leaveRoom`) e a rota fecha os sockets dele (`closePeerSockets`,
      como a do `leave`). *Detalhe:* o mapa do SSE não sabe de quem é cada stream — um expulso que
      estiver no fallback só cai se o `peerId` for guardado junto. Decidir no teste se vale a linha.
      *(29/09/2026)* **Maior que o descrito:** só revogar criaria uma regressão — no primeiro 401, a
      reconexão automática do cliente (T3.3) faria um `join` novo com o mesmo `peerId`, e o expulso
      voltaria em até 20 s (o próximo heartbeat). Então a expulsão faz quatro coisas:
      - revoga a sessão do expulso;
      - a rota fecha o WebSocket **e o stream SSE** dele — o `ssePeer` (um `WeakMap`) guarda o dono de
        cada stream, e valeu a linha: o teste mostrou o stream do expulso **aberto para sempre**;
      - a sala guarda o `peerId` em `removedPeerIds` (os **50** mais recentes — pergunta 5 do portão;
        persiste com a sala e é saneado no restore), e o `join` por ele responde **403
        `removed_by_gm`**; no cliente, a reconexão volta ao lobby com "O Mestre removeu você desta
        mesa", sem insistir. **Não é banimento:** sem conta, uma aba nova é outro jogador — é a R.11;
      - o GM **não remove a si mesmo** (ficaria trancado fora da própria mesa): a tela já não
        oferecia, e o servidor passou a recusar.
      - `kick.integration` (6, com um servidor HTTP de verdade para ver o stream fechar) + 1 em
        `rooms-client`. **Provado revertendo:** os 6 do R.3 falham com o código antigo; o de stream
        **estoura o tempo**, porque o stream do expulso nunca terminava.
- [x] **R.4** **SEC-10 — o WebSocket ganha os tetos do REST.** `maxPayload` explícito (1 MiB, o mesmo
      do `express.json`) e limitador **por conexão** para os quadros JSON, com os números do REST (chat
      30/min; o resto, 120/min). O teste mede o que o contrato de custo precisa: N mensagens acima do
      teto **não** geram N reenvios da sala.
      *(29/09/2026)* Os tetos moram em [`server/wsLimits.ts`](../server/wsLimits.ts), com o porquê de
      cada número. Três mudanças no desenho, achadas ao escrever o teste:
      - **Por jogador, não por conexão:** conta por conexão se compra abrindo mais sockets. E o
        número de sockets **por jogador** ganhou teto (3, fecha os mais antigos com `4409`), porque
        cada socket a mais recebe cada reenvio da sala — outro multiplicador de banda.
      - **O binário também:** update do grid aceito reenvia a sala inteira (120/min, como o REST), e o
        *awareness* é repassado a todos com estado livre — **4 KiB** de teto de tamanho e 1.200/min.
        Antes de qualquer parse, 1.800 quadros/min por jogador (teto de CPU). Os baldes **não** somem
        quando o socket fecha: somem quando a janela vence — senão reconectar zeraria a cota.
      - **O cursor do GM ia a cada `mousemove`** (~60/s, sem throttle). Com o teto no servidor, o
        cursor travaria para o GM legítimo; o cliente passou a mandar no máximo um a cada 60 ms,
        sempre a última posição (`src/lib/throttle.ts`).
      - O `makeRateLimiter` do REST passou a usar a mesma conta de janela (`allowInWindow`): uma
        implementação para os dois transportes. O handler de *upgrade* saiu do `startServer` para
        `attachRealtime`, para o teste subir o socket de verdade.
      - `ws-limits.integration` (5, com socket real) + `throttle` (2). **Provado revertendo:**
        neutralizadas as 4 linhas dos tetos, os 4 testes de socket falham — **100 reenvios para 100
        mensagens**, quadro de 2 MiB aceito, *awareness* de 10 KB repassado, 5 sockets abertos.
      - **O que sobra, com número:** com os tetos do REST, um participante hostil ainda reenvia a sala
        120 vezes por minuto (~250 KB cada) — **menos de 3 h para os 5 GB**, em vez de ~35 min. O
        teto certo é o ARQ-01 (broadcast por diferença, L.1), e quem entra na mesa é a R.11. Ver o
        risco 3 do contrato de custo zero.
- [x] **R.5** **SEC-11 — `trust proxy`.** `app.set("trust proxy", 1)` só em produção (um salto: o
      proxy do Render). **Verificar no ar**, com uma requisição conhecida e o `req.ip` no log: o
      número de saltos é premissa de configuração, e premissa de configuração se confere.
      *(29/09/2026 — o código; a conferência no ar fica para o deploy.)* `resolveTrustProxy`: 1 salto
      em produção, nenhum fora dela; `TRUST_PROXY` corrige sem deploy de código, e `true` é recusado
      (confiaria em qualquer `X-Forwarded-For`). **Em vez de log** (que o Render guarda 7 dias), o
      `/api/health` devolve a quem pergunta o **próprio** IP como o servidor o enxerga (`clientIp`) —
      a verificação no ar é uma requisição, e está no passo 1 da
      [verificação pós-deploy](./DEPLOY.md#verificação-pós-deploy). `trust-proxy.integration` (5).
      **Provado revertendo** a linha do `app.set`: o jogador de outro IP levava **429 pelo chat do
      GM** (um balde só) e o health mostrava o IP do "proxy". **Pendente no ar:** o `clientIp` bater
      com o IP público de quem pergunta, no deploy de 01/10.
- [x] **R.6** **SEC-12 — posse no grid.** Reproduzir com teste (update Yjs que reescreve o `peerId`
      de um token alheio e o move). Se reproduzir: comparar com o dono **anterior** e proteger `peerId`
      e `icon`. Anotar na [ADR 0002](./adr/0002-yjs-websockets.md) como evidência — a autorização por
      diff é o custo que a revisão de 02/09 apontou no CRDT — **sem reabri-la**: o gatilho dela é bug de
      convergência, e isto é de autorização.
      *(29/09/2026)* **Reproduziu**, com um cliente Yjs de verdade sobre o WebSocket: o jogador levou
      o NPC para (0,0) tomando o dono dele, e **roubou o token de outro jogador** (`peer_kaze` →
      `peer_vex`). A causa é de classe — a checagem enumerava à mão os campos protegidos e esqueceu
      dois. O conserto compara **todo** campo que o doc carrega, menos `x`/`y`, pela mesma lista do
      `gridDoc` (`TOKEN_KEYS`, agora exportada): campo novo nasce protegido. E a posse é a do dono
      **anterior**. Conferido que o `deriveGridFromDoc` não converte tipo (não há falso positivo que
      reverta movimento legítimo). `grid-ownership.integration` (5). **Provado revertendo:** com a
      checagem antiga, 4 dos 5 falham (o que passa é mover o próprio token). Nota na ADR 0002 atualizada.
- [x] **R.7** **SEC-06 — o gatilho da B.6 disparou.** `npm audit fix` leva a `express@4.22.3` e
      `qs@6.16.0`. Esperado: `npm audit --omit=dev` com **0** vulnerabilidades. Atualizar a linha do
      SEC-06 em [`SEGURANCA.md`](./SEGURANCA.md#estado-dos-achados-de-segurança) e a linha de base.
      *(29/09/2026)* Só o `package-lock.json` mudou (a faixa `^4.21.2` do `package.json` já aceitava
      a 4.22.3). Produção: `express` 4.22.2 → **4.22.3**, `body-parser` 1.20.6 → **1.20.8**, `qs`
      6.15.3 → **6.16.0**. Desenvolvimento, de carona: `undici` 7.30.0 (via `jsdom`, também moderada) e
      `vitest` 4.1.11 — patches. `npm audit`: **0** em produção e 0 no total (eram 3 e 6).
      **Armadilha achada:** o `npm audit fix` atualizou o lock mas **não** o `node_modules` — a suíte
      rodou verde contra o `express` antigo, sem provar nada. Com `npm ci` (o que o CI faz), as versões
      novas entraram e a suíte passou de novo: 571/571, com o `vitest` 4.1.11.
- [x] **R.8** **OPS-02 — fixar o Node.** `.node-version` com `24` (LTS; manutenção a partir de
      20/10/2026, fim de vida em 30/04/2028), `engines` com teto (`">=24 <25"`), e o CI — a matriz e o
      job de E2E — no 24. O 20 está em fim de vida, e o 22 não é o que roda em produção. **Conferir no
      log do deploy de 01/10** qual versão o Render vinha usando.
      *(29/09/2026)* Um lugar só decide: o CI deixou de ter matriz e lê o **mesmo** `.node-version`
      que o Render (`node-version-file`), nos jobs `validate` e `e2e`. O `DEPLOY.md` avisa para **não**
      definir `NODE_VERSION` no painel, que passaria por cima do arquivo. `npm ci` local (Node 24.14)
      sem aviso de `engines`. Não há teste automatizado possível do que o Render escolhe: **a prova é o
      log do deploy** — em 01/10, o primeiro deploy deve dizer Node 24.x. *O `@types/node` segue no
      ^22: tipos mais velhos que o runtime não quebram nada; sobe quando algo do 24 fizer falta.*
- [x] **R.9** **OPS-03 — versão com a tag.** `package.json` → `0.4.3`. A regra entrou no passo 3 do
      ritual de abertura.
      *(29/09/2026)* `npm version 0.4.3 --no-git-tag-version` (o `package.json` e as duas linhas da
      raiz do lock; nenhuma tag criada). **Visto no build de produção:** o `/api/health` responde
      `"version":"0.4.3"`. O bloco R não ganha tag própria — o plano reserva a `v0.4.4` para a F, e
      renumerar tags é decisão do dono.
- [x] **R.10** 🧑‍⚖️ **Decisão do dono — backup (reabre a decisão 4, OPS-01).** Em ordem de tamanho:
      1. *(recomendada — a versão 10× menor)* **Dump manual** com o CLI já logado
         (`npx supabase db dump --linked`, esquema e `--data-only`), guardado **fora do repositório**,
         mensal e antes de toda migration. É o que a doc do Supabase recomenda ao plano gratuito.
      2. Workflow agendado com o dump **cifrado** como artefato. O guia oficial commita o dump no
         repositório — **proibido aqui: o repo é público**, e artefato de repo público também se baixa.
         Exige cifra e um secret novo.
      3. Plano Pro — colide com o custo zero.
      A K.1 (export da ficha em JSON) é o backup que o **jogador** controla — complementa, não substitui.
      *(29/09/2026 — **o dono escolheu a opção 1**, que virou a [decisão 8](#-decisões-tomadas-02092026).)*
      - **`npm run backup:db`** ([`scripts/backup-db.ts`](../scripts/backup-db.ts)): os três dumps do
        guia oficial (papéis, esquema e dados em `COPY`) numa pasta datada **fora do repositório**
        (`~/netsheet-backups/AAAA-MM-DD`), e um `MANIFEST.txt` com tamanho, SHA-256 e **linhas por
        tabela**, contadas sem imprimir conteúdo. **Recusa destino dentro do repo** (é público) e nunca
        sobrescreve; o `.gitignore` ganhou a mesma barreira para o dump à mão. `backup-script` (6
        testes); **provado revertendo** a trava do repo: os 2 testes dela falham.
      - **Runbook:** [`BACKUP.md`](./BACKUP.md) — quando (todo mês e antes de toda migration; o passo 5
        do ritual de encerramento ganhou isso), o que fica de fora (os **arquivos** do Storage), onde
        guardar (fora da máquina, **cifrado** — o `data.sql` tem `auth.users`), como restaurar, e o
        registro de cada dump.
      - **Primeiro backup, feito:** 29/09/2026, 20:42 UTC. **A produção ainda não tem usuário
        nenhum** (`auth.users` 0, `character_sheets` 0, 1 sala velha) — o processo existe antes do
        primeiro dado real, não depois de perdê-lo.
      - **Restauração de teste: ADIAR, com gatilho.** O alvo certo é um projeto Supabase novo, com as
        versões do `auth` da produção — criar isso é recurso na conta do dono; o Supabase local tem
        outra versão do `auth`, e com uma linha o teste provaria pouco. **Gatilho:** a primeira linha
        do registro com `character_sheets` acima de zero; a M.0 exige antes do fim do plano.
      - **Achado no caminho — o Docker não subia:** dois *sockets* velhos
        (`Docker\run\sailor-ingest.sock` e `docker-secrets-engine\engine.sock`) que o Windows não deixa
        renomear. Contorno reversível, registrado no runbook: renomear **as duas** pastas juntas. Nada
        foi apagado, e o "Reset to factory defaults" da janela de erro — que apagaria o Supabase local
        — não foi usado.
- [x] **R.11** 🧑‍⚖️ **Decisão do dono — quem pode entrar numa mesa (DOC-07; o alcance da decisão 3).**
      Hoje o lobby lista toda sala a qualquer visitante, e o `join` aceita quem souber o código.
      1. **Manter aberto** e assumir o modelo de ameaça real, "qualquer pessoa com a URL". R.1–R.4
         impedem que ela *tome* a mesa; ela continua *lendo* fichas e chat.
      2. *(recomendada)* **Sala fora do lobby** — o lobby para de listar; entra-se pelo código ou pelo
         link `/room/CÓDIGO`, que o GM manda aos convidados. É a decisão 3 imposta sem conta nova.
         Exige código difícil de adivinhar: hoje o GM escolhe (ex.: `NC-2020`), e o servidor
         acrescentaria um sufixo aleatório.
      3. **Mesa exige login** (JWT do Supabase no `join`, como a IA já exige). O mais forte, e abre a
         versão maior da R.1.
      *(29/09/2026 — **o dono escolheu a opção 2**, sala fora do lobby.)*
      - **Reproduzido antes:** `GET /api/rooms` respondia **200 com o código de toda sala** a um
        visitante sem sessão nenhuma.
      - **O lobby não lista mais:** a rota `GET /api/rooms` saiu (404); a lista "Salas ativas" e o
        *polling* de 8 s sumiram do cliente — visto no navegador: nenhuma chamada a `/api/rooms`. De
        carona, **metade do risco 1 do custo zero** (aba esquecida no lobby mantendo o Render acordado)
        deixou de existir. As contagens seguem no `/api/health`, sem código nenhum.
      - **O código é o convite:** o GM digita um prefixo (`NC-2020`) e o cliente acrescenta um sufixo
        aleatório de Web Crypto — `NC-2020-K7Q9XD`, seis símbolos de um alfabeto de 31 sem ambíguos
        (0/O, 1/I/L), ~30 bits. Com o limitador do `join`, chutar uma sala leva anos
        ([`src/lib/roomCode.ts`](../src/lib/roomCode.ts)). O servidor passou a aceitar código de até
        24 caracteres (era 12).
      - **No cliente, e não no servidor, como a opção descrevia** — escolha registrada: o contrato da
        API não muda, e quem cria sala por fora da interface com código fraco só expõe a própria mesa
        (ninguém ganha acesso à de outro). E os ~15 arquivos de teste que criam salas com código fixo
        seguem valendo.
      - **O GM ganhou "Copiar convite"** no cabeçalho da mesa: copia `/room/CÓDIGO`; se o navegador
        não deixar, o link aparece para seleção manual.
      - `room-invite.integration` (4), `room-invite` (5), `invite-button` (3, teste do componente —
        sem o clique, os 2 do GM falham). **Provado revertendo** o servidor: 2 falham (200 em vez de
        404; código de convite recusado). O teste antigo que afirmava a lista pública foi substituído,
        como o da B.3. E2E 6/6: o fluxo de dois navegadores entra por código.
      - **Achado na verificação visual:** a interface mostrava **"v0.4.0" escrito à mão em seis
        lugares** (rodapé, menu, página inicial, PRD) — o R.9 consertou o `package.json` e não pegou
        a tela. Agora os seis leem o `package.json` (`src/version.ts`; só a string entra no bundle),
        e um teste falha se alguém escrever versão à mão de novo — provado reintroduzindo o literal.
- [x] **R.12** **DOC-06 — a L.6 precisa de outra fonte de dado.** Com 7 dias de retenção, "meses de
      log" não existe. Versão 10× menor: depois de cada sessão de jogo em produção, buscar
      `sse_fallback` no log do Render (dentro dos 7 dias) e anotar a contagem numa tabela **Registro de
      sessões**, no fim deste plano. É o mesmo passo que troca a estimativa de banda pelo número real.
      *(29/09/2026 — a [tabela](#registro-de-sessões) existe; a L.6 aponta para ela.)*
- [x] **R.13** *(proposta — decisão do dono)* **Encolher este plano.** Sintoma observado nesta
      revisão: com ~1.700 linhas o arquivo **não cabe numa leitura** da ferramenta do Claude (passa de
      25 mil tokens) e foi lido em quatro pedaços — sessão fria que lê em pedaços pula coisa. Versão
      10× menor: mover o detalhe das fases fechadas (A–D e as pendências P) **verbatim** para
      `docs/historico/FASES_A-D.md`, deixando aqui uma linha por fase com o link. PR próprio, só de
      movimento de texto, revisável com `git diff --color-moved`.
      *(29/09/2026 — aprovada pelo dono e feita.)* **689 linhas** movidas para
      [`historico/FASES_A-D.md`](./historico/FASES_A-D.md); **668 idênticas** e 21 com o caminho de
      link ajustado (34 links, porque o arquivo mudou de pasta — âncora que foi junto ficou igual).
      Conferido: toda âncora e todo caminho dos dois arquivos existem. No lugar ficou a tabela
      [Fases fechadas](#fases-fechadas--a-b-pendências-p-c-e-d). O plano foi de 2.015 para **1.340
      linhas** — e de ~75 mil para **~47 mil tokens**: de quatro leituras para **duas**. **Ainda não
      cabe numa só.** O próximo corte, com o mesmo método: mover o bloco R quando ele fechar (R.15), a
      revisão pós-D e a auditoria de 03/09. **Gatilho:** o R.15 marcado.
      *(Revisão de robustez, 29/09: dar itens às fases E–M somou ~200 linhas, e o plano voltou a três
      leituras. O corte acima tira mais que isso — o bloco R sozinho passa de 300.)*
- [x] **R.14** 🔒 **Portão de segurança** — o bloco muda autorização (R.1, R.3, R.6) e entrada (R.4):
      as seis perguntas em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). E a pergunta que o repo
      público impõe: **o que este PR ensina a quem lê o código antes de o conserto estar no ar?**
      *(29/09/2026 — respondido para R.1–R.6, no [registro](./SEGURANCA.md#pendências-r--revisão-pós-d).
      Achado do portão: **SEC-13**, virou a R.16. O item fecha quando R.7–R.9 e a R.16 responderem.)*
      *(29/09/2026 — R.16, R.7, R.8 e R.9 responderam no mesmo registro; nenhum achado novo. R.10,
      R.11 e R.13 são decisão e documentação — o portão pergunta de novo se virarem código.)*
- [ ] **R.15** 🧠 **Estado durável e PRs.** Ordem: consertos de segurança (R.1–R.6) **junto com** o
      texto que os descreve, nunca depois dele; dependências, Node e versão (R.7–R.9) podem ir no mesmo
      PR; a R.13 em PR próprio. Depois do merge, `master` verde e a verificação pós-deploy de 01/10.
      *(29/09/2026 — R.0–R.6 e R.12 publicados juntos, a pedido do dono: um commit por item, cada um
      com o teste que reproduz e a prova revertendo. R.7–R.11, R.13 e R.16 ficam para o próximo PR.)*
      *(29/09/2026 — PR #14 mergeado; CI do `master` verde nos 5 jobs, e o `db-sync` conectou: "Remote
      database is up to date", como esperado sem migration. R.16, R.7, R.8 e R.9 no PR seguinte, um
      commit por item. Fica aberto o que é do dono: R.10, R.11 e R.13.)*
      *(29/09–30/09/2026 — os PRs #15 a #18 mergeados; CI do `master` verde depois do último — os 4
      jobs, Node 24, 590 testes + 1 só-Windows pulado, E2E 6/6, `db-sync` em dia. **Todo o código do
      bloco R está no `master`.** O que falta é a verificação no ar, no checklist abaixo.)*

      > **Isto NÃO bloqueia a Fase E.** O R.15 fecha em 01/10, pela tarefa agendada e pelos dois itens
      > do dono. **A próxima sessão abre a Fase E (E.1)** — decisão do dono em 30/09/2026.

      **Checklist de 01/10/2026 — quando a API voltar.** O Render suspendeu o serviço em setembro
      (incidente no [contrato de custo zero](#-contrato-de-custo-zero)); ele volta na virada do mês e
      publica o `master`. Os itens automáticos rodam num comando só —
      **`node scripts/verify-prod.mjs`** —, que a tarefa agendada `verificar-render-netsheet-01-10`
      (app do Claude, 01/10 às 11:30) executa e registra num PR. O backup mensal roda antes, às 10:00.
      - [ ] **01.1** O serviço voltou: `/api/health` responde JSON, não `503 Service Suspended`.
      - [ ] **01.2** A versão publicada é a do `package.json` (`0.4.3`) — o deploy é o último commit
            (R.9). Se não for: painel do Render → *Manual Deploy → Deploy latest commit* (dono).
      - [ ] **01.3** O `clientIp` do health é o IP público de quem pergunta (R.5, `trust proxy`). Registrar
            só se **bateu** — nunca o IP. Se não bateu: `TRUST_PROXY` no [`DEPLOY.md`](./DEPLOY.md).
      - [ ] **01.4** O site carrega e a interface mostra `v0.4.3` (continuação do R.9).
      - [ ] **01.5** `/api/nao-existe` → 404 em JSON, não a SPA.
      - [ ] **01.6** `GET /api/rooms` → 404: o lobby não lista salas (R.11).
      - [ ] **01.7** `POST /api/gemini` sem login → 401 (SEC-01).
      - [ ] **01.8** Os contratos da revisão, com uma sala de teste que o script apaga no fim: código de
            convite aceito; `join` com o `gmPeerId` sem o token → 409 `seat_taken` (R.1); `create` com
            código em uso → 409 `room_exists` (R.2).
      - [ ] **01.9** O E2E de WebSocket contra o ar: chat, rolagem e Yjs, 5/5.
      - [ ] **01.10** *(dono)* Painel do Render → *Events* → log do build: **Node 24.x** (R.8, OPS-02). O
            CLI do Render desta máquina está deslogado, e o login é do dono.
      - [ ] **01.11** *(dono)* Painel do Render → uso do workspace: anotar horas e banda do NetSheet —
            a linha de base que troca a estimativa do contrato de custo zero pelo número real.
      - [ ] **01.12** *(dono)* Mergear o PR que a tarefa abrir com o resultado (e o do backup mensal).
      Com tudo marcado, o R.15 e o bloco R fecham. *Provado antes de 01/10:* o script passa os 12
      checagens contra o build de produção local e **acusa falha** (sai com erro) contra um servidor
      fora do ar.
- [x] **R.16** **SEC-13 — teto de assentos por sala** *(achado do portão das R, 29/09/2026)*. Cada
      `join` com `peerId` novo cria um assento, cada assento abre até 3 sockets (R.4), e o `join` só
      tem o limitador de sala (120/min por IP): dezenas de assentos multiplicam cada reenvio da sala —
      o amplificador do SEC-10 por outra porta, e a mesma família da "sala sem teto de NPCs" (pista da
      E). **Reproduzir primeiro.** Versão 10× menor: teto de assentos por sala (uma mesa real tem até
      ~8; 12 dá folga), `409` com código estável acima dele. Antes da primeira sessão em produção.
      *(29/09/2026)* **Reproduzido:** 100 `join`s criaram 101 assentos, e o GM gerou 41 fichas sem
      parar. `MAX_SEATS_PER_ROOM = 16` — **não 12**: o teto conta **todo** assento (GM, jogadores e
      fichas geradas pelo GM), porque contar só os "humanos" pelo prefixo do `peerId` seria contornável
      (ele vem do cliente; bastaria entrar como `edgerunner_x`). 16 cabe GM, uma mesa cheia e fichas
      pré-geradas. Acima do teto: `join` de assento novo → **409 `room_full`**; quem já tem assento
      sempre volta ao seu; gerar ficha → recusado com "A mesa está cheia". Teto máximo de sockets por
      sala: 48. `seat-cap.integration` (6). **Provado revertendo** as 2 linhas do teto: 4 falham. As
      **fichas de NPC** (`room.npcs`) continuam sem teto — é a pista da E, e NPC não abre socket.
- [ ] ✅ **Pendências da revisão pós-D resolvidas em:** ____/____/______

---

### FASE E — 🔍 VARREDURA: BACKEND *(1–2 dias)*

Escopo: `server.ts` e `server/*` — **7 arquivos, ~3.400 linhas** em 29/09/2026 *(a lista antiga tinha
quatro; faltavam `supabaseAuth.ts`, `aiPrompt.ts` e `wsLimits.ts`)*. Segue o
[roteiro de uma varredura](#o-roteiro-de-uma-varredura).

- [ ] **E.0** 🔍 **Premissas** — as pistas de cada área abaixo foram **medidas em 29/09/2026** (revisão
      de robustez). Conferir de novo no dia de abrir: o código anda.
- [ ] **E.1** Varredura por área → ledger em `docs/varreduras/E-backend.md`, sem tocar em código.
  - [ ] **E.1a Erros e status.** Todo caminho de erro devolve o status certo e uma mensagem tratável?
        Uma linha por rota: status × mensagem × `code`.
        - **Hoje são três jeitos de classificar erro:** o `respondWithResult` por substring em
          português (`server.ts:283` — renomear uma mensagem muda o status da API); o
          `respondToCombat` da D.1 por `startsWith`/regex (`:641`); e o `code` estável que a R.1
          estreou em quatro respostas (`seat_taken`, `room_exists`, `removed_by_gm`, `room_full`).
        - **A E é dona do `code` no servidor** — a versão 10× menor da
          [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457): o status sai do `code`, e a mensagem muda
          à vontade. A I só confere que o cliente decide por ele (o `ApiError.code` já existe).
  - [ ] **E.1b Estado que cresce.** Todo `Map`, `Record` e array do servidor: quem limita, quem recolhe?
        - **NPCs sem teto** (`generateRoomNpc`, `roomManager.ts:671`) — cada NPC também vira token no
          grid, e a mensagem de iniciativa da D.4 cresce com eles. Só o GM gera. *(portão da D.9)*
        - **Chat:** o teto de 100 mensagens vale em dois caminhos (o chat do jogador, `:996`, e o
          `pushSystemMessage`, `:1112`); os outros oito `push` à mão dependem do próximo com teto.
        - **`updateTacticalGrid` grava o `gridState` como veio** (`:666`) — a rota só confere
          `typeof object`. A mesma classe do `updateInitiative` que a D.4 fechou. Só o GM chega lá.
        - **Socket morto.** O servidor não manda `ping`: socket que caiu sem aviso fica no `wsClients`
          recebendo broadcast até o TCP desistir. A presença (heartbeat de 20 s) já marca o jogador
          offline — o custo é o buffer do socket morto, não um "online" falso. O
          [README do `ws`](https://github.com/websockets/ws#how-to-detect-and-close-broken-connections)
          recomenda ping a cada ~30 s com `terminate()`. Sintoma a procurar: memória subindo com a
          mesa aberta.
  - [ ] **E.1c Concorrência e ciclo de vida.** Que suposição quebra se duas requisições chegarem
        juntas? O Node é uma thread: o risco mora nos `await` — persistência com debounce × `deleteRoom`,
        verificação do JWT na rota da IA.
        - *Conferido:* o `listen` só acontece depois do `await restoreRoomsFromDb()`
          (`server.ts:1339` → `:1373`) — nenhuma requisição chega antes do restore.
        - **Shutdown:** `flushAllPending()` e `process.exit(0)` sem fechar sockets (`:1421`). O Render
          dá **30 s** entre o `SIGTERM` e o `SIGKILL` ([deploys](https://render.com/docs/deploys)) —
          algo se perde nesse intervalo?
  - [ ] **E.1d Dado montado como texto.** O que o servidor formata que devia mandar como dado?
        - **O horário do chat sai no fuso do servidor — reproduzido em 29/09.** São 12 chamadas de
          `toLocaleTimeString("pt-BR")` no `roomManager` (11 à mão e o `chatTime` da D), e o cliente
          mostra a string como veio (`MultiplayerRoom.tsx:687`). O Render roda em **UTC**
          ([comunidade do Render](https://community.render.com/t/date-time-server/5598)): às 22:02 de
          Brasília, a mesa em produção mostra **01:02**. `TZ=UTC node -e "…toLocaleTimeString…"`
          reproduz. Ninguém viu porque o dev local roda no fuso do Brasil e nenhum teste olha o
          horário. **É sintoma pronto para o filtro:** aparece na primeira sessão em produção.
        - `code.toUpperCase()` em **25** pontos (12 no `server.ts`, 10 no `roomManager`, 3 na
          persistência) — normalização sem dono.
        - **Modelo de IA fixo** (`gemini-2.5-flash`, `server.ts:421`). Desde 18/09/2026 o Google limita
          os modelos 2.5 a quem já os usava, sem data de desligamento
          ([descontinuações](https://ai.google.dev/gemini-api/docs/deprecations)). Ler o nome de uma
          variável de ambiente é uma linha — gatilho na [ADR 0005](./adr/0005-provedor-de-ia.md).
  - [ ] **E.1e Logs e gatilhos.** Todo `catch` registra? Nenhum segredo sai?
        - *Medido:* a persistência **não engole** erro — `save`, `delete` e `restore` registram
          `warn`, e o save tenta de novo. Mas o log vive 7 dias e ninguém o lê: engolido na prática.
        - **Listar os eventos que são gatilho de algum ADIAR** (`sse_fallback`, `gemini_api_error`,
          `ws_rate_limited`, `persistence_save_failed`, `ws_invalid_yjs_frame`, `unhandled_error`) e
          conferir que é esta a lista do [Registro de sessões](#registro-de-sessões).
        - ~~`(ws as any)._peerId`~~ — *resolvida na R.3: virou `WeakMap`.* Restam **7** `any` no
          `server.ts` (o `flush` do SSE, o `catch` da IA, o awareness e a mensagem do WebSocket, o
          handler de erro do Express).
  - [ ] **E.1f Mapa de cortes** *(ARQ-05)*. O `roomManager` tem **1.579 linhas** (1.035 na auditoria,
        1.461 depois da D) e o `server.ts`, **1.436**. Propor os cortes — sessão / autorização / regras
        / NPCs / chat; rotas / realtime / Yjs — **sem executar**, com veredito próprio. É o insumo da
        L.3: sem este mapa, a L.3 não tem de onde partir.
- [ ] **E.2** Calibragem e PR do ledger — [roteiro](#o-roteiro-de-uma-varredura), passo X.2.
- [ ] **E.3** Executar só os FAZER — passo X.3.
  - [x] **E.3a** 🔒 **SEC-14 — grid malformado derrubava o processo** (E.02 do ledger). *(30/09/2026 —
        adiantado a pedido do dono, num PR de segurança antes do ledger: o Render volta em 01/10.)* A
        forma do grid é validada nas duas portas (REST → `400 invalid_grid`; Yjs → revertido, GM
        inclusive), e o reenvio e o vigia de presença não deixam erro escapar. `grid-integrity` (9);
        provado revertendo por camada. Texto e portão em [`SEGURANCA.md`](./SEGURANCA.md#fase-e--varredura-backend).
  - [x] **E.3b** 🔒 **SEC-15 — tetos de tamanho** (E.03 do ledger). *(30/09/2026, no mesmo PR.)* 30 salas
        (`MAX_ROOMS`), 32 NPCs, ficha de 64 KB, chat de 100 em todo caminho, 1 MiB por socket que não lê;
        o restore não traz sala abandonada. `room-limits` (9); provado revertendo teto a teto.
        **Decisão do dono (30/09):** criar sala **não** passa a exigir login no servidor — ADIAR, gatilho
        em [`SEGURANCA.md`](./SEGURANCA.md#fase-e--varredura-backend).
- [ ] **E.4** 🔒 Portão, se a E.3 mudou código — passo X.4.
- [ ] **E.5** 🧠 Estado durável — passo X.5.
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
      - **Premissa conferida na revisão pós-D (29/09/2026):** o `@import` segue na linha 1 do
        `index.css` e o CSP é o mesmo — o bug está de pé. As três faces têm pacote
        [`@fontsource`](https://fontsource.org/) (SIL OFL) com `woff2` por subconjunto; o subconjunto
        `latin` cobre os acentos do português, e o Vite copia os arquivos para `dist/assets`, servidos
        pelo mesmo origin. **A F não tinha item `.0` de verificação** (o `CLAUDE.md` pede um em toda
        fase de construção): este F.0 passa a abrir com a conferência das premissas da F.1–F.4 antes
        do conserto.
      - **Premissas medidas na revisão de robustez (29/09/2026):**
        - **O critério de pronto não tem comando.** A F.2 conta 1.722 cores literais, a revisão pós-D
          1.731; uma terceira regex, no mesmo dia, deu **1.846**. "Tendendo a zero" só é medida se a
          contagem for **um comando versionado** (script ou linha exata no plano). O F.0 fixa o comando
          e a linha de base **antes** da primeira migração — e diz o que fica fora (a escala do
          `HealthTracker`, por exemplo).
        - **O vermelho também mora em dado, não só em classe.** O token de NPC nasce `#ef4444` no
          servidor (`roomManager.ts:323`, `:711`) e no cliente (`TacticalGrid.tsx:251`, `:279`), e a cor
          é **persistida** com o grid da sala. O grep de classes não a vê, e a F.2.2 ("vermelho só para
          dano") precisa decidir a cor do NPC — NPC não é dano.
        - **A F.4.2 tem versão 10× menor:** uma regra `@media (prefers-reduced-motion: reduce)` no
          `index.css` desliga as 23 animações `animate-*` e os efeitos novos de uma vez; o `motion-safe:`
          do Tailwind fica para exceção.
        - **A F.2.4 migra ~1,7–1,8 mil literais em "1 dia"** — o F.0 refaz a estimativa com a contagem
          por arquivo.

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
| Ocorrências de cor literal em `.tsx` | **1.722** *(1.731 em 29/09)* |
| Combinações distintas de cor | **107** |
| Tokens de cor no `@theme` do `index.css` | **8** *(a tabela dizia 5; corrigido no índice em 03/09 e aqui em 29/09)* |
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
      *Critérios concretos, do [WCAG 2.2](https://www.w3.org/TR/WCAG22/) (revisão pós-D, 29/09):*
      - **2.2.2 Pausar, parar, ocultar (nível A)** — animação automática com mais de 5 s, ao lado de
        outro conteúdo, precisa de meio de parar. O `scanline` é loop infinito de 8 s: ou tem controle,
        ou não roda em tela de leitura.
      - **2.3.1 Três flashes (nível A)** — o `glitch` não pode piscar mais de 3 vezes por segundo.
      - **1.4.3** (texto, 4,5:1) e **1.4.11** (borda e ícone, 3:1) — os dois de nível AA.
      - Medido em 29/09: **0** ocorrências de `prefers-reduced-motion` no CSS e **23** usos de
        `animate-pulse/ping/spin` em `.tsx` — a preferência vale para eles também, não só para os
        efeitos novos.
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

Escopo: `src/components`, `src/features`, `src/pages`, `src/stores`, `src/hooks` — e, desde a
revisão de robustez, **`src/utils` e `src/lib`** (menos o `supabase.ts`, que é da L.4): os dois
somavam ~1.800 linhas **fora do escopo de qualquer varredura**. Vem **depois** da Fase F para não
varrer código que acabou de ser reestilizado. Segue o
[roteiro de uma varredura](#o-roteiro-de-uma-varredura).

- [ ] **G.0** 🔍 **Premissas** — medidas em 29/09/2026; conferir de novo no dia, e depois da F.
- [ ] **G.1** Varredura por área → ledger em `docs/varreduras/G-frontend.md`.
  - [ ] **G.1a Estado em dois lugares.** Que estado existe em dois lugares e pode divergir?
        - `syncSheetStore(sheetResult)` no **corpo do render** (`App.tsx:69`). **Com sintoma** *(visto na
          C, 25/09)*: o React avisa a cada carga "Cannot update a component while rendering a different
          component". Anterior à Fase C (`7fe4f47`).
        - Os dois `useEffect` que sincronizam URL ↔ aba, com dois refs de guarda. **Com sintoma** *(visto
          na D.3, 28/09)*: em modo dev, **todo deep link** (`/room/X`, `/multiplayer`) volta para `/` — o
          `StrictMode` roda o efeito "aba → URL" duas vezes e a guarda só segura a primeira. Produção não
          tem o duplo efeito, e o E2E roda o build de produção.
        - A ficha local × a ficha na mesa (desde a decisão 7a, a mesa não aceita o ferimento do cliente).
  - [ ] **G.1b Rede, sessão e espera.** O que a tela mostra quando a rede falha, o token expira ou a
        resposta demora? *(A G olha a tela; o contrato é da I.)*
        - Os estados novos das R: `409 seat_taken` (R.1), `403 removed_by_gm` (R.3), `409 room_full`
          (R.16), `409 room_exists` (R.2).
        - **A espera de ~1 min** quando o Render acorda de hibernação ([free](https://render.com/docs/free)):
          a primeira ação depois de um tempo parado parece travada?
  - [ ] **G.1c Teclado e foco.** Dá para operar a ficha só com teclado? *(Contraste, movimento e foco
        em modal são da F.4.2 — não repetir.)*
  - [ ] **G.1d Efeitos, IDs e console.**
        - `createBlankCharacterSheet` (`useCharacterSheet.ts:46`) gera seis IDs de armadura no mesmo tick
          com `Date.now()` + sufixo curto.
        - **12** `console.*` no cliente sobrevivendo ao logger estruturado *(ARQ-07, parte 1; contados em
          29/09 — os 3 do `server/logger.ts` são o próprio logger)*.
        - ~~`StatBlock.handleSet` altera `stats` sem tocar em `currentStats`.~~ *Resolvida na C.6.*
  - [ ] **G.1e Testes de componente** *(ARQ-08)*. **27** componentes `.tsx` e **3** arquivos de teste
        que renderizam componente (`ui-smoke`, `combat-ui`, `invite-button`). Quais telas quebram sem
        ninguém ver? O filtro vale: teste novo só onde houve sintoma ou regra de jogo na tela.
  - [ ] **G.1f Mapa de cortes** *(ARQ-05)*. `MultiplayerRoom` **1.028**, `TacticalGrid` **792** (não
        estava na lista), `FriendsList` **723**, `CyberpunkMenu` **609**. Mesmo formato da E.1f — insumo
        da L.3, sem executar.
- [ ] **G.2** Calibragem e PR do ledger — passo X.2.
- [ ] **G.3** Executar só os FAZER — passo X.3.
- [ ] **G.4** 🔒 Portão, se a G.3 mudou código — passo X.4.
- [ ] **G.5** 🧠 Estado durável — passo X.5.
- [ ] ✅ **Fase G concluída em:** ____/____/______

---

### FASE H — 🔍 VARREDURA: MULTIPLAYER *(2 dias)*

Escopo: transporte WebSocket, fallback SSE, CRDT Yjs, awareness, reconexão, presença. A varredura
mais cara — os bugs aqui só aparecem com duas pessoas e rede ruim, e é onde a decisão 3 concentra o
uso real.

**Como varrer:** não é teste automatizado — é quebrar de propósito, com o log aberto, **cenário por
cenário**. Cada cenário é uma caixa, e o ledger anota o que se esperava, o que aconteceu e os eventos
do log. Onde: o **build de produção local** (`npm run build` e `npm start` com
`NODE_ENV=production`, como o E2E), que não gasta hora nem banda do Render; só o H.1j precisa do ar.
Rede estrangulada pelo DevTools (perfil lento) ou pelo `setOffline` do Playwright. *(ARQ-08, parte
3.)* Segue o [roteiro de uma varredura](#o-roteiro-de-uma-varredura).

- [ ] **H.0** 🔍 **Premissas** — medidas em 29/09/2026:
      - ~~**O stream SSE só confere o token na abertura** — a expulsão não derruba um stream aberto.~~
        *Resolvida para a expulsão na R.3:* a rota fecha o stream do expulso (`ssePeer`). Resta a
        pergunta para outras revogações — no H.1e.
      - **Awareness órfão dura até 30 s, não para sempre.** O `y-protocols` apaga o estado remoto que
        não se atualiza em 30 s (`outdatedTimeout`, no servidor e em cada cliente). O servidor não
        remove o estado quando o socket fecha (`server.ts:1246`) — o sintoma possível é um cursor
        fantasma de até 30 s.
      - **O gatilho da [ADR 0002](./adr/0002-yjs-websockets.md) é conferido aqui** (bug de
        convergência). A autorização por diff do grid já teve um buraco (SEC-12, R.6) — evidência para
        a ADR, não gatilho.
      - **O diagrama adiado da sequência do handshake** tem gatilho "quando a H precisar depurar
        reconexão" ([`ARQUITETURA.md`](./ARQUITETURA.md#diagramas-adiados)) — decidir no H.1d.
      - **De preferência, com uma sessão real já registrada** no [Registro de sessões](#registro-de-sessões):
        os bugs daqui aparecem com gente de verdade, e a primeira sessão é o melhor insumo da H.
- [ ] **H.1** Varredura por cenário → ledger em `docs/varreduras/H-multiplayer.md`.
  - [ ] **H.1a Mesa de base:** GM + 2 jogadores em 3 abas, do zero ao combate. O que os outros cenários
        comparam.
  - [ ] **H.1b Rede estrangulada:** chat, rolagem, token movido e dano chegam, e na ordem? Broadcast
        completo e update Yjs incremental podem chegar fora de ordem.
  - [ ] **H.1c Refresh no meio do combate** — do jogador e do GM.
  - [ ] **H.1d Servidor reiniciado com a mesa aberta:** restore, sessões persistidas (B.4) e o fluxo
        401 → `join` **com o token** que a R.1 impôs.
  - [ ] **H.1e O mesmo jogador em duas abas:** o `join` com token revoga as sessões antigas
        (`roomManager.ts:576`) e não fecha o socket da outra aba — o que ela vê?
  - [ ] **H.1f O GM sai** (T1.8): existe janela de dois GMs ou de nenhum? A variante do SEC-07 pelo
        *handle* do GM segue ADIAR (R.1).
  - [ ] **H.1g Queda para SSE** (bloquear o WebSocket): o que deixa de funcionar, o jogador fica
        sabendo, e o `sse_fallback` aparece no log?
  - [ ] **H.1h Último socket fecha e alguém reconecta no mesmo instante:** o `destroyRoomYjs`
        (`server.ts:1251`) descarta o doc — a reconexão perde movimento do grid?
  - [ ] **H.1i Ficha editada em duas abas:** a reconexão resolve por **last-write-wins com o
        `updatedAt` do cliente** — o relógio do navegador decide quem ganha.
  - [ ] **H.1j** *(no ar)* **O Render troca a instância com a mesa aberta:** um merge no `master` no
        meio da sessão publica sozinho (30 s entre `SIGTERM` e `SIGKILL`); e a volta depois de hibernar
        leva ~1 min ([free](https://render.com/docs/free)).
  - [ ] **H.1k Habilidade especial na mesa:** não é rolável — o tipo `skill` procura em `sheet.skills`,
        e ela mora em `specialAbilityName` (visto na C.8). Na ficha funciona. Sem sintoma de mesa até
        alguém pedir.
- [ ] **H.2** Calibragem e PR do ledger — passo X.2.
- [ ] **H.3** Executar só os FAZER — passo X.3.
- [ ] **H.4** 🔒 Portão, se a H.3 mudou código — passo X.4.
- [ ] **H.5** 🧠 Estado durável — passo X.5.
- [ ] ✅ **Fase H concluída em:** ____/____/______

---

### FASE I — 🔍 VARREDURA: INTEGRAÇÃO BACKEND ↔ FRONTEND *(1–2 dias)*

Escopo: `src/api/*` contra os endpoints do Express — a costura que nenhuma das varreduras anteriores
olha, porque cada lado parece correto sozinho.

Segue o [roteiro de uma varredura](#o-roteiro-de-uma-varredura).

- [ ] **I.0** 🔍 **Premissas** — medidas em 29/09/2026:
      - **O cliente já sabe ler `code`:** o `ApiError` guarda o `code` do servidor desde a R.1
        (`src/api/http.ts:20`). O que falta é o servidor mandá-lo em todo erro — isso é da **E.1a**.
      - **O `apiFetch` já trata corpo não-JSON** (`.catch(() => ({}))`) e **não tem timeout.** Cuidado
        antes de pôr um: a instância gratuita volta da hibernação em **cerca de 1 min**
        ([free](https://render.com/docs/free)). Timeout menor que isso quebra a primeira requisição
        depois de um tempo parado — exatamente o `join` de quem chega para jogar.
      - **O `RollResult` tem uma interface só** (`src/types/cyberpunk.ts:141`) e o motor é um só desde a
        C (`src/rules/`). Conferir se ainda há dois montadores com campos diferentes, como a pista dizia.
      - **O `VITE_API_URL` só importa quando o site sair do Render** (regra 4 do
        [custo zero](#-contrato-de-custo-zero)) — hoje o site e a API são o mesmo origin, e a regra 4
        **não tem fase dona**. Ver a I.1e.
- [ ] **I.1** Varredura por área → ledger em `docs/varreduras/I-integracao.md`.
  - [ ] **I.1a Inventário de rotas.** Uma linha por endpoint: quem chama no cliente, tipo de request e
        response compartilhado ou escrito duas vezes à mão, códigos de erro tratados. *Se eu mudar este
        endpoint, o TypeScript me avisa no cliente — ou descubro em produção?*
  - [ ] **I.1b Erros.** Todo estado de erro do servidor tem estado de UI? O cliente decide por `code`
        ou por texto? *Referência:* a [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) (`type`,
        `title`, `status`, `detail`). Pelo filtro, a RFC inteira só com sintoma que o `code` não resolva.
  - [ ] **I.1c Sessão.** O que o usuário vê quando o token expira ou é revogado no meio da sessão (401)?
  - [ ] **I.1d Transporte.** `apiFetch` / `authedFetch`: timeout, retry e a restrição da hibernação
        acima.
  - [ ] **I.1e Cross-origin** (`VITE_API_URL` → `ws`/`wss`, `CORS_ORIGINS`, o `connect-src` do CSP).
        **Condicional:** se a regra 4 continuar sem dono, o veredito natural é ADIAR com o gatilho dela.
- [ ] **I.2** Calibragem e PR do ledger — passo X.2.
- [ ] **I.3** Executar só os FAZER — passo X.3.
- [ ] **I.4** 🔒 Portão, se a I.3 mudou código — passo X.4.
- [ ] **I.5** 🧠 Estado durável — passo X.5.
- [ ] ✅ **Fase I concluída em:** ____/____/______

---

### FASE J — 🔍 VARREDURA: SEGURANÇA *(1,5–2,5 dias)*

A Fase B fecha os seis buracos conhecidos. Esta procura os que a auditoria não achou —
sistematicamente, e depois de todo o código novo de C, D e F ter entrado.

**O que a varredura pergunta:** se um jogador convidado virar hostil, o que ele consegue fazer? (é o
modelo de ameaça real da decisão 3) Que dado sai do servidor para quem não deveria vê-lo? **E quem
recebe credencial, provando o quê?** — a pergunta que a revisão pós-D mostrou faltar: o SEC-07 viveu
desde a T1.7 porque todos perguntavam de onde vinha o autor, e ninguém, quem ganhava o token. Segue o
[roteiro de uma varredura](#o-roteiro-de-uma-varredura). **O que a J achar aberto vai ao ar junto com
o conserto** (o repo é público).

- [ ] **J.0** 🔍 **Premissas** — medidas em 29/09/2026:
      - O gitleaks do CI **já** varre o histórico (`fetch-depth: 0`) — conferido na revisão pós-D.
      - O CSP segue com `connect-src 'self' ws: wss: https:` (`server.ts:166`).
      - As 56 de RLS **não rodam desde a B** — exigem o Supabase local, e o Docker desta máquina falha
        no arranque (contorno no [`BACKUP.md`](./BACKUP.md)).
      - **Antes desta revisão, as varreduras E–I não passavam pelo portão** — a J confere que cada X.4
        foi respondido.
      - **Régua externa.** *Sintoma que a justifica:* os seis achados da revisão pós-D escaparam de
        portões que perguntam de memória — uma lista de fora pega o que a memória não lembra de
        perguntar.
        - **Decidida pelo dono em 30/09/2026: o [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x11-t10)
          (edição 2023, a vigente)** — dez categorias de defeito, uma linha cada, cruzadas com a tabela
          da J.1b. É régua de busca: só vira item o defeito achado numa rota real.
          É a versão 10× menor, e ela cobre o histórico: **12 dos 13 achados** de segurança do projeto
          caem em cinco categorias — API1, autorização por objeto (SEC-02, 07, 08, 09, 12); API2,
          autenticação (SEC-07); API3, autorização por campo (SEC-05, 12); API4, consumo sem limite
          (SEC-01, 04, 10, 13); API8, configuração (SEC-06, 11). Só o SEC-03 (sessão perdida no
          restart, disponibilidade) fica de fora.
        - **O [ASVS 5.0](https://github.com/OWASP/ASVS) inteiro, não:** são ~345 requisitos (70 no
          nível 1), escritos para aplicação com usuário autenticado — aqui o jogador é um assento
          anônimo com token, e boa parte viraria "não se aplica". Vale como **consulta pontual** quando
          uma área pedir profundidade: sessão (V7) na J.1c, frontend e CSP (V3) na J.1f.
        - *Risco das duas:* virar teatro de conformidade. Só vira item o que se aplica a uma rota real.
- [ ] **J.1** Varredura por área → ledger em `docs/varreduras/J-seguranca.md`.
  - [ ] **J.1a Registro do portão** em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase): toda fase — e
        toda varredura que mudou código — respondeu as seis perguntas? Alguma resposta envelheceu?
  - [ ] **J.1b Tabela de superfície:** cada endpoint REST, cada tipo de mensagem do WebSocket e o
        quadro Yjs × autenticado? autorizado? entrada validada? saída filtrada? Uma linha por rota, sem
        exceção.
  - [ ] **J.1c Credenciais:** toda emissão — `create`, `join`, *upgrade* do WebSocket, JWT do Supabase
        — e o que quem recebe prova. *(A lição do SEC-07.)*
  - [ ] **J.1d Entrada:** todo campo que entra em `sheet`, `gridState`, `initiativeList` e no protocolo
        Yjs — **o binário Yjs é entrada de usuário** e tem try/catch e o teto de 1 MiB (R.4).
  - [ ] **J.1e WebSocket**, pela [folha da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html):
        - o *upgrade* não confere `Origin`; o que protege de *cross-site WebSocket hijacking* é o token
          ir na query e não em cookie — registrar como decisão, não como acaso;
        - o token na URL: onde a URL do *upgrade* aparece em log (nosso e do Render)?
        - sessão revogada fecha o socket? A R.3 fez isso para a expulsão; e as outras revogações?
        - *backpressure*: cliente lento acumulando reenvios da sala no buffer (liga com a E.1b).
  - [ ] **J.1f Configuração e cadeia:**
        - CSP: `connect-src https:` e `img-src https:` são amplos; apertar para os origins reais.
        - RLS: re-rodar as 56 e conferir as políticas de storage de avatar.
        - gitleaks: a allowlist do `.gitleaks.toml` libera, além da anon key, padrões largos (`<.*>`,
          `example`, `placeholder`, `your-`) — confirmar que só escondem exemplo.
        - Segredo no bundle depois das mudanças de B: transformar o teste da T10.7 em script.
        - **O repositório é público e o `master` não tem proteção de branch** (conferido em 29/09). O
          gatilho da A.10 continua o mesmo — repo público não dá push a ninguém, e workflow disparado
          por fork não recebe secret —, mas a pergunta 2 do portão pesa mais: código, ledgers e este
          plano são lidos por qualquer um.
        - **Actions fixadas por tag, não por SHA** (`@v4`, `@v1`), e o `supabase/setup-cli` instala
          `version: latest`. O [guia de hardening do GitHub](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions)
          recomenda SHA para action de terceiro. **ADIAR** — gatilho: uma action usada aqui aparecer
          num incidente de cadeia de suprimento, ou o CLI `latest` quebrar o `db-sync`.
  - [ ] **J.1g ADIAR herdados:**
        - **Sair e voltar "curado"** (D.9, 28/09): o `leaveRoom` apaga o registro do jogador, e a volta
          é um join novo, que aceita o ferimento da ficha do cliente. A decisão 7a fechou a sincronia e
          a reconexão, não essa porta. **Gatilho:** um jogador aparecer inteiro depois de sair no meio
          de uma luta. *(O segundo gatilho — público fora dos convidados — a R.11 fechou em 29/09. A
          versão maior da R.1, assento por conta, fecha esta porta.)*
        - A variante do SEC-07 pelo *handle* do GM (R.1).
- [ ] **J.2** Calibragem e PR do ledger — passo X.2, com a exceção do repo público levada a sério: na
      J, quase todo FAZER é achado aberto.
- [ ] **J.3** Executar só os FAZER — passo X.3.
- [ ] **J.4** 🔒 Portão, se a J.3 mudou código — passo X.4.
- [ ] **J.5** 🧠 Estado durável — passo X.5.
- [ ] ✅ **Fase J concluída em:** ____/____/______

---

### FASE K — PROFUNDIDADE DE SISTEMA 🔨 *(4–5 dias)*

A Fase 11 do plano antigo, reordenada por retorno: export/import primeiro (dá confiança para usar de
verdade), netrunning por último (é meio jogo à parte).

- [ ] **K.0** 🔍 **Verificação de premissas** — *(acrescentado na revisão pós-D, 29/09/2026: o
      `CLAUDE.md` manda toda fase de construção abrir com um `.0`, e a K não tinha)*. Já sabido:
      - **A K.3 foi em boa parte entregue** pela C (efeito do ferimento em toda rolagem) e pela D
        (pontos, stun e death save automáticos, estabilização, perda de membro como aviso). Medir o que
        sobra antes de estimar — pode não sobrar item.
      - **K.7 continua valendo:** `Social` segue em INT **e** em EMP (`cyberpunkData.ts`), e o `Walk`
        segue no `StatBlock`.
      - **A K.1 também é backup** — o que o jogador controla, fora do banco (R.10).
      - **K.6 é a regra que fecha o "trapaceiro plausível"** do portão da B (BODY 15, perícias em 10):
        sem orçamento de criação, a ficha grampeada ainda é válida.
      - Toda regra nova começa na tabela e na [conferência](./CONFERENCIA_CP2020.md#o-que-fica-para-a-fase-k),
        com duas fontes — o cuidado com Cyberpunk RED vale em dobro para netrunning (K.5), onde o RED
        mudou quase tudo.
      - *Medido na revisão de robustez (29/09/2026):*
        - **A K cabe em 4–5 dias só sem a K.5 inteira.** Netrunning no 2020 é "meio jogo à parte" (as
          palavras deste plano): mapa da Net, fortalezas de dados, programas, MU — um relato o descreve
          como uma masmorra que o netrunner joga enquanto o grupo espera
          ([SirPhoebos](https://writeups.letsyouandhimfight.com/sirphoebos/cyberpunk-2020/)). Não cabe
          com outros seis itens. **O defeito é do plano, não da K.5** — daí a decisão abaixo.
        - **A criação (K.6) tem mais regra do que o item diz**, e as fontes divergem em parte: atributos
          por rolagem (1d10 nove vezes, descartando 1 e 2, ou 9d10 num bolo) ou por pontos — que um
          relato diz ser só para NPC; **40 pontos de perícia de carreira** e **REF + INT de perícias
          livres** (S3 e S6 concordam); verba inicial pela habilidade especial (S6); e o custo em IP
          (nível × 10 × multiplicador, em S6 — outras fontes divergem). Cada regra, duas fontes.
        - **"Drops" (K.4) é vocabulário de videogame**, não regra do 2020 — o mesmo cuidado que já
          pegou três premissas do RED. O NPC gerado já traz armas, armadura e cromo; o item precisa
          dizer o que a mesa quer fazer com isso.
        - **A K.2 muda o formato da ficha** (o `data` jsonb e o `sheetSchema`). Hoje a produção tem
          **0** fichas (backup de 29/09): mudar antes de haver jogador é barato; depois, exige migrar o
          JSON das fichas salvas.
        - **A K.7 esqueceu uma perícia:** a conferência lista **oito** faltando — Cyberdeck Design
          (TECH) também, e ela não está em `cyberpunkData.ts:234`.
      - **O dono tem o livro** *(30/09/2026)*. Ele é a fonte primária da K: onde as fontes secundárias
        divergem (criação, IP, netrunning), a regra sai do livro, com a página. As perguntas estão em
        [Perguntas para o livro](./CONFERENCIA_CP2020.md#perguntas-para-o-livro), na conferência.
- [ ] **K.0b** 🧑‍⚖️ **Decisão do dono — o tamanho da K.5 e o método da K.6.**
      - **K.5**, em ordem de tamanho: *(1, recomendada)* **o netrunner na ficha** — deck, programas e MU
        como dado, sem a Net jogável; *(2)* **a Net na mesa**, com mapa e turnos — fase própria, depois da
        L; *(3)* **ADIAR** até alguém da mesa do dono jogar de netrunner. A 1 agora e a 2 com o gatilho da
        3 é a combinação que o filtro sugere.
        *(30/09/2026 — **o dono escolheu a recomendação:** a 1 na K.5, e a 2 como ADIAR com o gatilho
        da 3. Virou a [decisão 9](#-decisões-tomadas-02092026).)*
      - **K.6:** quais métodos de atributo a criação oferece (rolagem, bolo de 9d10, pontos), e se a
        evolução por IP entra junto ou depois. **Ainda aberta** — decidir na K.0, com o livro na mão:
        os métodos que ele oferece são o cardápio.
- [ ] **K.1** *(era T11.5)* Export/import de ficha (JSON + impressão em PDF) — reaproveita o validador
      de `src/rules/sheetSchema.ts`. *Versão 10× menor do PDF:* folha de estilo de impressão
      (`@media print` e o "Salvar como PDF" do navegador), sem biblioteca de PDF no bundle nem no CSP.
- [ ] **K.2** *(era T11.1)* Inventário, peso e EV: Carry (BODY×10 kg), Lift (BODY×40 kg), encumbrance
      automático, penalidade de REF por armadura. *(RUL-11)*
- [ ] **K.3** *(era T11.3)* Pós-ferimento automático — em boa parte já entregue pela Fase C.
- [ ] **K.4** *(era T11.4)* Inventário e drops de NPC — *reescrever na K.0 com o que a mesa precisa
      (ver acima).*
- [ ] **K.5** *(era T11.2)* **O netrunner na ficha** (decisão 9): o deck, os programas e a MU como
      dado da ficha, com as regras do livro — sem a Net jogável.
      - **A Net na mesa** (mapa, turnos, data walls, ações por turno): **ADIAR**, fase própria depois
        da L. **Gatilho:** alguém da mesa do dono jogar de netrunner.
- [ ] **K.6** Criação de personagem com orçamento (pontos de atributo, perícia por INT+REF, carreira)
      e evolução por IP. *(RUL-10)*
- [ ] **K.7** Completar `SKILL_TABLES` (remover "Social" de INT; adicionar Accounting, Anthropology,
      Gamble, Shadow/Track, Wilderness Survival, Interrogation, Cyberdeck Design, Pharmaceuticals) e
      adicionar Leap (Run÷4). Remover "Walk", que não existe no livro. *(RUL-12, RUL-11)*
- [ ] **K.8** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](./SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
- [ ] **K.9** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](#-protocolo-de-sessão).
- [ ] ✅ **Fase K concluída em:** ____/____/______

---

### FASE L — AGUENTAR UMA MESA DE VERDADE 🔨 *(3 dias)*

Com jogadores convidados (decisão 3), é a fase que mais pode esperar — e a primeira a antecipar se o
público mudar.

- [ ] **L.0** 🔍 **Verificação de premissas** — *(acrescentado na revisão pós-D, 29/09/2026)*. Já
      sabido: a L.2 falava de um bundle que não existe mais (ver a nota nela); a L.6 perdeu a fonte de
      dado que supunha (ver a nota nela); e a **R.4 põe teto no abuso** do broadcast — a L.1 fica com o
      custo do **uso normal**, e deve ser decidida com os números do Registro de sessões (R.12), não
      com a estimativa de 26/09.
      *Medido na revisão de robustez (29/09/2026):*
      - **A L.1 sozinha pode ocupar os 3 dias da fase:** muda o contrato do
        [`PROTOCOLO_MULTIPLAYER.md`](./PROTOCOLO_MULTIPLAYER.md), o *merge* no cliente, a reconexão e o
        caminho do SSE. Refazer a estimativa aqui.
      - **O `perMessageDeflate` não é "mitigação de uma linha"** (risco 2 do custo zero): o
        [README do `ws`](https://github.com/websockets/ws#websocket-compression) avisa que, com
        concorrência, a compressão pode causar **fragmentação de memória catastrófica** no Linux, e por
        isso vem desligada no servidor. Na instância gratuita, só com medição de memória antes.
      - **A L.3 depende dos mapas de corte da E.1f e da G.1f** — sem eles, fatiar vira varredura nova.
      - **A L.5 parte de 20 `any`** (fora de teste e de comentário; eram 23 na auditoria) e **12
        `console.*`** no cliente.
- [ ] **L.1** Broadcast por delta (`chat:new`, `player:health`, `initiative:set`); estado completo só
      no join e na reconexão. *(ARQ-01)*
- [ ] **L.2** `manualChunks` separando **o Supabase**, que está no chunk de entrada e é carregado até
      para quem só quer rolar dados — é o maior contribuinte identificado do 1,3 MB. **Não** investir em
      lazy-loading do Yjs: a [ADR 0002](./adr/0002-yjs-websockets.md) o deixou sob observação, e não vale
      otimizar o carregamento de algo que pode sair inteiro. ~~Revisar se
      `motion` paga o próprio peso.~~ *(ARQ-04)*
      *Premissa corrigida na revisão pós-D (29/09):* o `motion` saiu na ARQ-10 (02/09), e o chunk de
      entrada é **629 kB / 186 kB gzip** desde que a C.1 tirou o `mathjs` — não 1,3 MB. Medir o que o
      Supabase pesa hoje antes de separar; se o ganho não pagar o `manualChunks`, a L.2 vira DESCARTAR.
- [ ] **L.3** Fatiar os arquivos grandes aproveitando os cortes que a E.1f e a G.1f mapearam. *(ARQ-05)*
- [ ] **L.4** Renomear os exports da camada Supabase e dividir o módulo por domínio. *(ARQ-06)*
- [ ] **L.5** ESLint com `typescript-eslint` em modo mínimo, zerar `any` e `console.*`,
      `--max-warnings 0` no CI. *(ARQ-07)*
- [ ] **L.6** **Decidir o fallback SSE com o dado da B.7.** Ninguém caiu para SSE em meses de uso? Remove
      o endpoint, o mapa `sseClients`, o caminho duplo do broadcast e o `EventSource` do cliente. Alguém
      caiu? Mantém, e a dúvida está encerrada com evidência em vez de opinião.
      *Premissa corrigida na revisão pós-D (29/09):* o Render Hobby **guarda log por 7 dias** — "meses
      de log" não existe. O dado vem do **Registro de sessões** (R.12), preenchido depois de cada
      sessão. Poucas sessões registradas = evidência fraca: dizer isso ao decidir.
- [ ] **L.7** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](./SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
- [ ] **L.8** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](./ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](#-protocolo-de-sessão).
- [ ] ✅ **Fase L concluída em:** ____/____/______

---

### FASE M — VALIDAÇÃO E ENCERRAMENTO 🔨 *(1 dia)*

- [ ] **M.0** 🔍 **Verificação de premissas** — *(acrescentado na revisão pós-D, 29/09/2026)*. Já
      sabido: as 56 de RLS **não rodam desde a Fase B** (Supabase local desligado na C e na D); o
      backup (R.10) precisa ter sido **restaurado ao menos uma vez** num projeto Supabase novo para contar
      como backup; e a M.3 revisa também os ADIAR das ADRs e da conferência, não só os dos ledgers.
      *Medido na revisão de robustez (29/09/2026):* "ADIAR" aparecia **43 vezes** nos documentos vivos
      (contado antes desta revisão), e só **20** linhas traziam o gatilho na mesma linha — a M.3 começa por `grep -rn ADIAR docs/` (fora
      de `historico/` e `legacy/`) e classifica cada um. Dois têm gatilho **"o dono confirmar no livro"**
      ([conferência](./CONFERENCIA_CP2020.md#o-que-a-fase-d-conferiu)): se o dono não tem o livro, o
      gatilho nunca dispara — é DESCARTAR disfarçado, e a M.3 os resolve. *(30/09: **o dono tem o
      livro.** Os dois gatilhos são executáveis e viraram
      [Perguntas para o livro](./CONFERENCIA_CP2020.md#perguntas-para-o-livro) — não precisam esperar
      a M.)*
- [ ] **M.1** Suíte completa: `tsc --noEmit`, build, unit, integração, E2E, RLS, `npm audit`.
      *(é a T12.2 do plano antigo)*
- [ ] **M.2** **Uma sessão de jogo real**, 2+ pessoas, do zero ao combate. É o teste que nenhuma suíte
      substitui e o único que valida C e D. *(é a T12.3 do plano antigo)* *(Revisão de robustez: esta é
      a sessão de **encerramento**, não a primeira. A primeira não precisa esperar a M — o
      [Registro de sessões](#registro-de-sessões) diz por quê.)*
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
| B | 🔨 | Fechar buracos de autorização | ✅ | 03/09/2026 |
| C | 🔨 | Fonte única de regras | ✅ | 25/09/2026 |
| D | 🔨 | Loop de combate | ✅ | 28/09/2026 |
| R | 🔨 | **Pendências da revisão pós-D** (segurança da mesa, Node, backup) | 🔶 R.0–R.14 e R.16 feitos; falta o R.15 (checklist de 01/10) | — |
| E | 🔍 | Varredura: backend | ⬜ | — |
| F | 🔨 | **Reestruturação visual: identidade Cyberpunk 2020** | ⬜ | — |
| G | 🔍 | Varredura: frontend | ⬜ | — |
| H | 🔍 | Varredura: multiplayer | ⬜ | — |
| I | 🔍 | Varredura: integração | ⬜ | — |
| J | 🔍 | Varredura: segurança | ⬜ | — |
| K | 🔨 | Profundidade de sistema | ⬜ | — |
| L | 🔨 | Performance e escala | ⬜ | — |
| M | 🔨 | Validação e encerramento | ⬜ | — |

### Linha de base atual

Atualizar ao fechar cada fase. É contra estes números que o passo 6 do ritual de abertura compara.

| Verificação | Depois do bloco R (29/09/2026 — conferida de novo na revisão de robustez) |
|---|---|
| Node | **24** (`.node-version`, o mesmo para o CI e o Render — R.8) |
| `npx tsc --noEmit` | 0 erros |
| `npx vitest run` | **609** testes, 42 arquivos *(522 ao fechar a D; +43 das R.1–R.6; +6 da R.16; +6 da R.10; +14 da R.11; +18 da E.3a–b)* — `vitest` 4.1.11 |
| `npm run test:e2e` | 6/6 (Playwright) — 2 da ficha ajustados na D.3 para a trilha em pontos |
| `node scripts/test-ws-e2e.mjs` | 5/5 contra o build de produção (o smoke do CI) |
| `node scripts/test-rls.mjs` | 56/56 na Fase B — **não rodado na C nem na D** (Supabase local desligado; nenhuma das duas mexeu em schema nem RLS — a ficha em pontos mora no `data` jsonb) |
| `npm run audit:ci` | passa, **ALLOWLIST vazia**, e `npm audit` com **0** vulnerabilidades (R.7: `express@4.22.3`, `qs@6.16.0`) |
| Chunk de entrada | 629 kB / 186 kB gzip |
| Migrations em produção | `0001`–`0007` *(a D não teve migration)* |

**Operação:** o `SUPABASE_ACCESS_TOKEN` do CI **vence por volta de 25/10/2026** (validade de 30 dias).
Renovar até 22/10 — passo a passo no P.2.

**⏰ 01/10/2026 — o Render volta** depois da suspensão de setembro (ver o incidente no
[contrato de custo zero](#-contrato-de-custo-zero)). Conferir na aba *Events* que o deploy que subiu é
o do commit mais recente do `master` — se não for, *Manual Deploy → Deploy latest commit* — e rodar a
[verificação pós-deploy](./DEPLOY.md#verificação-pós-deploy) contra
`https://netsheetengine.onrender.com`. Uma requisição por passo; **nada de monitor** (regra 3).
*Acrescentado na revisão pós-D:* no log desse deploy, anotar **qual versão do Node** o Render usou
(OPS-02, R.8). E, se as R.1–R.5 ainda não estiverem no `master`, **não abrir mesa em produção** —
o site pode voltar, a mesa espera. *(29/09: R.1–R.6 estão no PR da revisão; com ele mergeado, o passo
novo é conferir o `clientIp` do `/api/health` contra o seu IP público — R.5. Com o PR seguinte, o
log do deploy deve dizer **Node 24.x** (R.8) e o health, `"version":"0.4.3"` (R.9).)*
**30/09: tudo isso virou o checklist de 01/10 no R.15** — um lugar só, com um comando
(`node scripts/verify-prod.mjs`) e uma tarefa agendada que o executa.

**Avisos de descontinuação no log do CI** (vistos no merge da Fase C, 26/09/2026). Hoje são só aviso —
o run está verde. **ADIAR**, cada um com gatilho datado; o passo 3b do ritual de abertura pega o
vermelho se algum virar erro antes:

| Aviso | Onde | Gatilho |
|---|---|---|
| `ubuntu-latest` passa a ser Ubuntu 26 | os 4 jobs do `ci.yml` e o `keepalive.yml` | **A partir de 19/10/2026** — conferir o primeiro run depois dessa data |
| CodeQL Action v3 descontinuada | `github/codeql-action/upload-sarif@v3` (gitleaks) | **Dezembro de 2026** — trocar por `@v4` antes |
| Actions em Node 20 forçadas a rodar em Node 24 | `actions/checkout@v4`, `supabase/setup-cli@v1` | Um run falhar por isso, ou sair versão nova das duas |
| **Node 20 na matriz do `validate`** *(revisão pós-D)* | `ci.yml` — o runtime do **projeto**, não das actions | ✅ **Resolvido na R.8 (29/09):** o CI lê o `.node-version` (24), o mesmo arquivo do Render |

### Registro de sessões

*(Criado na revisão pós-D — R.12.)* Uma linha por sessão de jogo **em produção**, preenchida em até
7 dias (a retenção do log do Render Hobby). É a fonte de dado da L.6 e o número real que substitui a
estimativa do [contrato de custo zero](#-contrato-de-custo-zero).

**É também onde os gatilhos que moram no log são lidos** *(revisão de robustez, 29/09/2026)*. Três
ADIAR deste plano disparam com uma linha de log — e um log de 7 dias que ninguém lê faz o gatilho
disparar e sumir, como a [ADR 0005](./adr/0005-provedor-de-ia.md) já avisava. Depois de cada sessão,
buscar no log do Render e anotar a contagem de cada um (a E.1e confere e completa a lista):

| Evento | Gatilho de | Dispara quando |
|---|---|---|
| `sse_fallback` | L.6 — manter ou remover o SSE | Decide com a contagem acumulada |
| `gemini_api_error` | [ADR 0005](./adr/0005-provedor-de-ia.md) — Groq / `AI_MODEL` | `429`, cota esgotada ou modelo recusado |
| `ws_rate_limited` | L.1 antecipada (risco 3 do custo zero) | Aparecer numa sessão real |

**A primeira sessão não espera a M.2.** Desde as R, a mesa aguenta uma sessão em produção; a H, a
L.0, a L.1, a L.6 e as estimativas do custo zero dependem desta tabela, e ela está vazia. Jogar cedo
é o insumo mais barato do plano — a M.2 continua sendo a sessão de encerramento.

| Data | Jogadores × horas | Eventos-gatilho no log (`sse_fallback` · `gemini_api_error` · `ws_rate_limited`) | Horas e banda do NetSheet no painel do Render | Observação |
|---|---|---|---|---|
| — | — | — | — | *nenhuma sessão em produção ainda* |
