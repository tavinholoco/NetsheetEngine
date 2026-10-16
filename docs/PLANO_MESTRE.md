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
      porque o `db-sync` só roda no `master`.)* *(30/09: com um run na fila, o filtro `--branch`
      devolveu runs de agosto — conferir também sem o filtro, `gh run list --limit 8`. E `cancelled`
      no `master` costuma ser a concorrência do CI: o push seguinte cobre o mesmo código.)*
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

## 🔬 Auditorias do plano — 03/09 e 29/09/2026

Duas revisões mediram as afirmações deste plano contra o estado real: a **auditoria de 03/09**, feita
na Fase A, e a **revisão pós-D de 29/09**, que abriu o bloco R. As tabelas — premissas que caíram, os
achados SEC-07 a SEC-12, o que a pesquisa acrescentou — moram em
[`historico/AUDITORIAS_E_PENDENCIAS_R.md`](./historico/AUDITORIAS_E_PENDENCIAS_R.md) desde o segundo
corte da R.13 (10/10/2026). **A lição que vale para toda sessão:** as afirmações sobre **código** se
sustentaram; as sobre **configuração** — secrets, planos pagos, tokens, o que o Render faz — não. Por
isso toda fase começa com um item `.0` que mede. A verificação no ar de 10/10 repetiu o padrão: o
serviço era Docker (não lia o `.node-version`) e tinha o Cloudflare na frente (o `trust proxy` de um
salto não servia).
---

## ⚖️ Decisões tomadas (02/09/2026)

Estas respostas fecham ambiguidades que mudariam o trabalho. Não reabrir sem motivo novo. *(1 a 3 em
02/09; 4 em 03/09; 5 em 25/09; 6 em 26/09; 7 em 28/09; 8 em 29/09; 9, 10 e 11 em 30/09/2026.)*

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
| 9 | Quanto de netrunning entra na K? (K.0b — a revisão de robustez mediu que a Net inteira não cabe na K) | **O netrunner na ficha** — deck, programas e MU como dado — entra na K.5. **A Net jogável na mesa** (mapa, turnos, fortalezas de dados) fica **fora da K: ADIAR**, como fase própria depois da L | A K volta a caber na estimativa. **Gatilho** da Net na mesa: alguém da mesa do dono jogar de netrunner. ~~As regras vêm do livro, que o dono tem (30/09)~~ **⚠️ Corrigido no mesmo dia (decisão 11):** o dono não tem o livro — as regras vêm das fontes secundárias, com duas concordando. O cuidado com o RED, que mudou quase tudo no netrunning, vale em dobro — e pesa mais sem o livro para desempatar |
| 10 | As quatro perguntas que a medição da F abriu (F.0b): a voz do texto, o vermelho que não é dano, a cor por seção, o livro como referência visual | **(a)** **Rajdhani** nos rótulos, na navegação e no texto corrido; a **mono** só em número, dado e momento de terminal, **sem negrito**; piso de **10 px**. **(b)** **Vermelho só dano**; marca, menu e PRD vão para amarelo ou ciano, o GM para amarelo, e erro, ação destrutiva, *fumble* e NPC hostil para um papel novo, **`fault`** (magenta). **(c)** A **cor por seção fica**; o PRD sai do vermelho e DADOS sai do rosa. **(d)** ~~O livro do dono é~~ O interior do livro de 1990 é **preto e branco**: referência de **diagramação e tipografia**; a cor vem da linguagem da época. **⚠️ Corrigido no mesmo dia (decisão 11):** o dono não tem o livro — a diagramação vem do que as fontes públicas mostram do interior (F.3.0) | (a) segue a ADR 0006 — a premissa "Rajdhani já em uso" era falsa: 96% do texto da ficha é mono, e a Share Tech Mono só tem o peso 400 (negrito sintético em 99 elementos). (b) é o invariante do `CLAUDE.md` aplicado aos 244 usos medidos. (c) não tinha recomendação explícita na análise; foi registrada como **manter** — a leitura de menor mudança, que o merge do PR confirma ou corrige. *(01/10/2026: **confirmada** — o dono aprovou as capturas do PR 3b, com a cor de cada seção.)* (d) as três premissas da F.3 (barra preta, faixas, numeração) são de diagramação, que o P&B responde: F.3.0. Detalhe na [F.0a](./historico/FASE_F.md#-o-que-o-f0a-mediu-30092026) e na [ADR 0006](./adr/0006-sistema-tipografico.md) |
| 11 | De onde vêm as regras e a diagramação, se o dono **não tem o livro**? *(Correção do dono, 30/09/2026 à noite: o registro "o dono tem o livro físico", do mesmo dia, estava errado — e as decisões 9 e 10d, a F.3.0 e as "Perguntas para o livro" se apoiavam nele)* | **Fontes secundárias**, pelo método da [conferência](./CONFERENCIA_CP2020.md#fontes-e-o-quanto-confiar-nelas): regra aceita com **duas fontes independentes** concordando; o que não fecha e bloqueia trabalho vai ao dono como decisão, com a pesquisa e uma opção recomendada — como a decisão 6. **Comprar o PDF oficial** (R. Talsorian, *Cyberpunk 2.0.2.0, Second Edition, Version 2.01*, no [DriveThruRPG](https://legacy.drivethrurpg.com/product/50354/Cyberpunk-2020-The-Second-Edition-Version-201), US$ 15 em 30/09): **ADIAR**. **Cópia do livro sem licença não é fonte** | Os gatilhos "o dono confirmar no livro" da conferência viram "uma segunda fonte independente" — sem isso nunca disparariam, o DESCARTAR disfarçado que a M.0 já previa. A F.3.0 passa a ser pesquisa em fonte pública. **Gatilho da compra:** uma pergunta para o livro bloquear o trabalho de uma fase e as secundárias não fecharem — a K.0 (criação, IP, netrunning) é a candidata mais provável. O contrato de custo zero é sobre a infraestrutura; a compra é decisão do dono. Se houver PDF, ele fica **fora do repositório**, como o backup |

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
| **X.2** Calibragem e revisão do dono | Contar os FAZER (acima de 1/3, recalibrar). O ledger vai num **PR só de documento**; o merge do dono aprova os veredictos. **Achado de segurança aberto fica fora desse PR** (o repo é público): uma linha sem o caminho, e o texto inteiro vai com o conserto. *Precedente da E (30/09):* achado **reproduzido** e grave pode ser consertado **antes** do ledger, num PR de segurança próprio — perguntar ao dono; o branch do ledger vai empilhado no de segurança e já traz o texto | Ledger mergeado |
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

*(14/10/2026 — **o frontend no Vercel, medido**, a pedido do dono, que já usa o plano Hobby em outros
projetos. Só o site — o servidor da mesa fica no Render: o WebSocket das Functions do Vercel (beta desde
06/2026) cai na duração máxima, 5 min no Hobby, e cada conexão pode cair em outra instância, sem memória
dividida — e a sala, o doc Yjs e o reenvio vivem na memória de um processo só.)*
- **O peso no Hobby é desprezível.** A primeira visita baixa **~0,25 MB comprimido** (medido no build: o JS de
  entrada 182 KB, o CSS 16 KB e as 4 fontes `woff2` latinas; o resto é sob demanda), e as visitas seguintes
  vêm do cache (nomes com hash). Pessimista — 10 pessoas × 20 visitas/mês, todas sem cache: **~66 MB de 100 GB**
  de transferência (0,07%) e **~3.000 de 1.000.000** de requisições na CDN (0,3%); nenhuma Function; um build
  de ~25 s por push, contra 100 deploys/dia. As cotas são **por conta**, divididas com os outros projetos do
  dono; estourar pausa o recurso **até completar 30 dias**, sem cobrança — o NetSheet cairia junto se outro
  projeto estourasse, o incidente de setembro pelo avesso. O Hobby é só para uso não comercial (o NetSheet
  é), e não aceita repositório de organização do GitHub (o daqui é da conta pessoal).
  ([Hobby](https://vercel.com/docs/plans/hobby), [limites](https://vercel.com/docs/limits),
  [WebSockets](https://vercel.com/docs/functions/websockets))
- **O que já está pronto:** o `vercel.json` (build `build:web`, saída `dist`, o *rewrite* do deep link), o
  `VITE_API_URL` (REST, SSE e WebSocket derivam dele — T10.2) e o `CORS_ORIGINS` do servidor; o caminho está
  no [`DEPLOY.md`](./DEPLOY.md#frontend-estático-vercelnetlify--backend-no-render).
- **O que muda, e entra junto se for feito:** (1) **dois deploys por merge** — o site no Vercel em ~1 min, a
  API no Render em alguns: um PR que mude os dois lados deixa o cliente novo falando com o servidor velho no
  intervalo; (2) **o CSP** sai do `helmet` do Express e teria de ser copiado para os `headers` do
  `vercel.json` (o `fonts-csp` só confere o do servidor); (3) **a origem muda**, e o `localStorage` não
  migra — quem tem ficha só no navegador a perde de vista (hoje não há jogador nem ficha em produção: é o
  momento mais barato de trocar); (4) `CORS_ORIGINS` no Render e a URL nova no Auth do Supabase, passos do
  dono no painel.
- **O ganho é pequeno:** a visita só para a ficha deixa de acordar o Render (as ~3–15 h/mês da estimativa) e
  a página abre na hora com o servidor dormindo. A banda que pesa no Render é a da mesa, e ela não muda.
- **Segue ADIAR, com o gatilho de cima.** Pendente do dono: as horas e a banda do NetSheet em outubro na página
  de uso do Render — **o primeiro mês sem o monitor do Better Stack**. Se passar de 100 h, ou se a primeira
  sessão mostrar a espera do despertar como problema, vira item da I (com a I.1e), feito antes de entrar
  jogador.

**Os riscos reais — os dois de uso normal ainda sem sintoma; o de abuso, calculado na revisão pós-D:**

1. **Aba esquecida.** ~~O lobby consulta a lista de salas a cada **8 s**, e~~ a mesa manda heartbeat a
   cada 20 s — **inclusive com a aba em segundo plano** *(desde a R.11, 29/09, o lobby não consulta
   mais nada: a lista de salas saiu, e com ela metade deste risco)* (o navegador desacelera os timers, mas não para
   intervalos acima de 15 min). Uma aba de mesa esquecida mantém o serviço acordado enquanto o
   computador estiver ligado: uma noite ≈ +10 h; um PC que nunca desliga ≈ +720 h — o mesmo efeito do
   uptime bot da regra 3. **ADIAR — gatilho:** a página de uso do Render mostrar o NetSheet acima de
   100 h num mês, ou uma aba esquecida observada. Versão 10× menor, quando disparar: pausar o polling e
   o heartbeat com a aba oculta (`document.hidden`) e fechar o socket depois de ~30 min oculta.
   *(05/10/2026: as 100 h de outubro passaram no dia 5 — mas pelo monitor do Better Stack, sem mesa
   nenhuma aberta (ver o incidente abaixo). A causa não é a deste risco: **segue ADIAR**, e o gatilho
   volta a valer com o número de um mês sem o monitor. O mesmo vale para o gatilho da regra 4.)*
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
>
> *Corrigido em 05/10/2026: o NetSheet **causou**, e não foi só setembro.* Um **monitor do Better
> Stack** ("NetsheetEngine — API Health", no `/api/health`) ficou ligado desde a T10.4 de agosto — a
> regra 3 proibiu o uptime bot em 02/09, mas ninguém conferiu se o monitor existia. O plano gratuito do
> Better Stack checa a cada **3 min** (a frequência deste monitor não foi conferida na conta): o serviço
> **nunca hibernava**, ~720 h/mês só do NetSheet. O histórico do próprio monitor mostra **dois** `503`:
> de 29/08 11:10 por 2 dias e 10 h, e de 19/09 13:31 por 1 semana e 4 dias — os dois terminam na
> virada do mês (UTC), que é quando o Render libera o workspace. **O workspace estourou em agosto e em
> setembro**; as instâncias do Newra completaram a conta, não a começaram.
> **Medido em 05/10** (21:32 BRT), sem nenhuma mesa — a tabela `rooms` de produção vazia e o
> `/api/health` com `rooms: 0` —: `uptime` de **357.038 s (99,2 h)**, ou seja, o processo do deploy do
> #34 (01/10, 18:22 BRT) não tinha dormido nenhuma vez. O painel do Render mostrava ~18 h/dia do
> NetSheet. **O dono pausou o monitor em 05/10/2026**; o Newra News não tinha monitor. Conferir que a
> hibernação voltou era o item 01.13 do R.15 — *voltou: conferido em 05/10, 22:51 BRT*. **Nunca reativar o monitor** com intervalo abaixo de
> 15 min — se quiser aviso de queda, 1×/dia ou 1×/semana, como o `DEPLOY.md` já diz.

> **Nota sobre o Newra News:** o `CRON_SCHEDULE: "0 8 * * *"` é um cron **em processo**. No plano
> gratuito do Render, se ninguém acessar o portal nos 15 minutos anteriores às 08:00, o processo está
> hibernado e o artigo diário **não é gerado**. Isso é problema do outro repositório, mas foi
> observado durante esta auditoria e vale registrar.

---

## 📊 ÍNDICE DE ACHADOS

33 achados da auditoria de 02/09, **12 da [revisão pós-D](./historico/AUDITORIAS_E_PENDENCIAS_R.md#-revisão-pós-d-29092026)** (29/09 — 11 na revisão, 1 no portão das R) e
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
| ARQ-09 | 🟠 Alto | **As fontes não carregam em produção** — o `@import` do Google Fonts sobrevive ao build, mas o CSP (`style-src`/`font-src`) o bloqueia; como o helmet é pulado em dev, só quebra no ar | ✅ F.0c |

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
| SEC-11 | 🟡 Médio | Sem `trust proxy`, os limitadores tendem a ser um balde só atrás do proxy do Render | ✅ R.5 + 01.3 (no ar em 10/10: a `TRUST_PROXY` com os privados e o Cloudflare) |
| SEC-12 | 🟡 Médio | Posse de token no grid Yjs compara o dono **novo** — jogador move e toma token alheio *(reproduzido na R.6)* | ✅ R.6 |
| OPS-02 | 🟡 Médio | Node sem versão fixa: produção no `latest` (26, não LTS), CI no 20 (fim de vida) e no 22. *(10/10: a premissa estava errada — o serviço é Docker e rodava o `node:22-alpine` do `Dockerfile`)* | ✅ R.8 + 01.10 (o `Dockerfile` no 24) |
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

### Fases fechadas — A, B, P, C, D, R e F

O detalhe de cada item — verificações, provas revertendo, decisões e achados — mora em
[`historico/`](./historico/), movido para lá **sem mudar o texto** pela R.13: A–D e P em 29/09/2026
([`FASES_A-D.md`](./historico/FASES_A-D.md)); o bloco R, com as duas auditorias, e a Fase F em
10/10/2026 ([`AUDITORIAS_E_PENDENCIAS_R.md`](./historico/AUDITORIAS_E_PENDENCIAS_R.md),
[`FASE_F.md`](./historico/FASE_F.md)). Com eles aqui, o plano passava do que a ferramenta do Claude lê
de uma vez, e sessão fria que lê em pedaços pula coisa. Aqui fica o que uma sessão nova precisa saber
de cada fase.

| Fase | O que entregou | Fechada | Tag · PR |
|---|---|---|---|
| [A — Reancorar o projeto](./historico/FASES_A-D.md#fase-a--reancorar-o-projeto--1-dia) | Tag de retorno, docs no estado real, Render como alvo único, keepalive e o CI de volta ao verde | 03/09/2026 | `v0.4.0` |
| [B — Buracos de autorização](./historico/FASES_A-D.md#fase-b--fechar-os-buracos-de-autorização--25-dias) | SEC-01 a SEC-06: IA trancada, ficha validada, leitura com sessão, sessões persistidas (`0007`), coletor de salas, portão de audit | 03/09 (merge 24/09) | `v0.4.1` · #6 |
| [P — Pendências operacionais](./historico/FASES_A-D.md#-pendências-operacionais--resolvidas-em-25092026-antes-da-fase-c) | `0007` aplicada em produção, token do CI trocado (vence ~25/10), decisão 5 (migration em PR próprio) | 25/09/2026 | — |
| [C — Fonte única de regras](./historico/FASES_A-D.md#fase-c--uma-fonte-única-de-regras--5575-dias) | `src/rules/`: motor único com paridade testada, BTM e ferimento do livro, perícia e modificador do GM na rolagem, stun e death save, habilidades especiais | 25/09 (merge 26/09) | `v0.4.2` · #8 |
| [D — Loop de combate](./historico/FASES_A-D.md#fase-d--fechar-o-loop-de-combate--34-dias) | Dano em pontos (armadura → BTM → ×2), ataque de NPC contra o alcance, iniciativa automática, death save por turno, estabilizar | 28/09 (merge 29/09) | `v0.4.3` · #12 |
| [R — Pendências da revisão pós-D](./historico/AUDITORIAS_E_PENDENCIAS_R.md#-pendências-da-revisão-pós-d--antes-da-fase-e) | SEC-07 a SEC-13 (assento com prova de posse, `create` sem sobrescrever, expulsão que revoga, tetos do WebSocket, `trust proxy`, posse no grid, teto de assentos), Node fixado, versão com a tag, backup manual (decisão 8), sala fora do lobby (R.11); no ar, a `TRUST_PROXY` com o Cloudflare e o `Dockerfile` no Node 24 | 10/10/2026 (código 29–30/09) | — · #14–#18, #36 |
| [F — Identidade Cyberpunk 2020](./historico/FASE_F.md#fase-f--reestruturação-visual-identidade-cyberpunk-2020--455-dias--era-4-refeita-no-f0a-30092026) | Fontes auto-hospedadas (o bug do CSP), tokens de cor por papel com o CI exigindo zero cor à mão, tipografia em três vozes, vermelho só dano, acessibilidade do WCAG 2.2 (movimento finito, contraste, modais, alvo de toque) | 05/10/2026 (construção 30/09) | `v0.4.4` · #27–#29, #32 |

> **Ponto de corte:** com A–D fechadas o jogo roda certo; com a R, roda certo **em produção** (sem ela,
> qualquer participante tomava o GM, apagava a mesa ou gastava a banda do workspace); com a F, tem a
> identidade nova. O que resta — as varreduras G–J, a K, a L e a M — é manutenção e profundidade.

---


### FASE E — 🔍 VARREDURA: BACKEND *(1–2 dias)*

Escopo: `server.ts` e `server/*` — **7 arquivos, ~3.400 linhas** em 29/09/2026 *(a lista antiga tinha
quatro; faltavam `supabaseAuth.ts`, `aiPrompt.ts` e `wsLimits.ts`)*. Segue o
[roteiro de uma varredura](#o-roteiro-de-uma-varredura).

- [x] **E.0** 🔍 **Premissas** — as pistas de cada área abaixo foram **medidas em 29/09/2026** (revisão
      de robustez). Conferir de novo no dia de abrir: o código anda.
      *(30/09/2026 — as 13 pistas conferidas contra o `master` em `7fdb7bb`: **todas bateram**, linha e
      contagem — tabela no topo do [ledger](./varreduras/E-backend.md). O fuso do chat reproduziu de
      novo: o mesmo instante, `01:02` em UTC e `22:02` em São Paulo.)*
- [x] **E.1** Varredura por área → ledger em `docs/varreduras/E-backend.md`, sem tocar em código.
      *(30/09/2026 — **24 itens: 6 FAZER (25%), 17 ADIAR, 1 DESCARTAR.** As 3.404 linhas lidas inteiras;
      o que dava para reproduzir foi reproduzido fora do repositório. Dois FAZER eram achados de segurança
      abertos — **SEC-14 e SEC-15** —, consertados antes do ledger a pedido do dono: E.3a–b.)*
  - [x] **E.1a Erros e status.** *(E.01 FAZER — reproduzido: `join` com código errado mostra "Room not
        found" em inglês na tela; chat vazio → 403; mesa cheia → 403 na ficha gerada e 409 no `join`. E.21
        e E.22 ADIAR.)* Todo caminho de erro devolve o status certo e uma mensagem tratável?
        Uma linha por rota: status × mensagem × `code`.
        - **Hoje são três jeitos de classificar erro:** o `respondWithResult` por substring em
          português (`server.ts:283` — renomear uma mensagem muda o status da API); o
          `respondToCombat` da D.1 por `startsWith`/regex (`:641`); e o `code` estável que a R.1
          estreou em quatro respostas (`seat_taken`, `room_exists`, `removed_by_gm`, `room_full`).
        - **A E é dona do `code` no servidor** — a versão 10× menor da
          [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457): o status sai do `code`, e a mensagem muda
          à vontade. A I só confere que o cliente decide por ele (o `ApiError.code` já existe).
  - [x] **E.1b Estado que cresce.** Todo `Map`, `Record` e array do servidor: quem limita, quem recolhe?
        *(E.02 e E.03 FAZER — viraram SEC-14 e SEC-15, já consertados; E.04, E.05, E.20, E.24 e E.25 ADIAR;
        E.23 DESCARTAR — o Render já comprime.)*
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
  - [x] **E.1c Concorrência e ciclo de vida.** Que suposição quebra se duas requisições chegarem
        juntas? O Node é uma thread: o risco mora nos `await` — persistência com debounce × `deleteRoom`,
        verificação do JWT na rota da IA.
        *(E.07 FAZER — reproduzido: remover alguém da iniciativa no meio da rodada **pula a vez** de outro.
        E.06 ADIAR, com regra de processo já: **todo deploy roda duas instâncias por ≥60 s** (doc do
        Render) — não mergear com mesa aberta. E.08, E.09 e E.19 ADIAR.)*
        - *Conferido:* o `listen` só acontece depois do `await restoreRoomsFromDb()`
          (`server.ts:1339` → `:1373`) — nenhuma requisição chega antes do restore.
        - **Shutdown:** `flushAllPending()` e `process.exit(0)` sem fechar sockets (`:1421`). O Render
          dá **30 s** entre o `SIGTERM` e o `SIGKILL` ([deploys](https://render.com/docs/deploys)) —
          algo se perde nesse intervalo?
  - [x] **E.1d Dado montado como texto.** O que o servidor formata que devia mandar como dado?
        *(E.10 FAZER — o horário do chat. E.11 e E.12 ADIAR; o modelo 2.5 segue sem data de desligamento,
        com acesso limitado a quem já usava — conferir com uma pergunta ao Netrunner IA no ar.)*
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
  - [x] **E.1e Logs e gatilhos.** Todo `catch` registra? Nenhum segredo sai?
        *(Nenhum segredo sai — conferido. E.13 FAZER, só documento: o Registro de sessões ganha
        `unhandled_error`, `persistence_save_failed` e `rooms_full`. E.14 ADIAR: o `sse_fallback` conta
        queda de rede, não só proxy — premissa levada à H.0. E.15 e E.16 ADIAR.)*
        - *Medido:* a persistência **não engole** erro — `save`, `delete` e `restore` registram
          `warn`, e o save tenta de novo. Mas o log vive 7 dias e ninguém o lê: engolido na prática.
        - **Listar os eventos que são gatilho de algum ADIAR** (`sse_fallback`, `gemini_api_error`,
          `ws_rate_limited`, `persistence_save_failed`, `ws_invalid_yjs_frame`, `unhandled_error`) e
          conferir que é esta a lista do [Registro de sessões](#registro-de-sessões).
        - ~~`(ws as any)._peerId`~~ — *resolvida na R.3: virou `WeakMap`.* Restam **7** `any` no
          `server.ts` (o `flush` do SSE, o `catch` da IA, o awareness e a mensagem do WebSocket, o
          handler de erro do Express).
  - [x] **E.1f Mapa de cortes** *(ARQ-05)*. *(E.18 — seis cortes no `roomManager`, cinco no
        `server.ts`, todos ADIAR com a L.3 de dona. O que mais barateia teste é o do `server.ts`.)* O `roomManager` tem **1.579 linhas** (1.035 na auditoria,
        1.461 depois da D) e o `server.ts`, **1.436**. Propor os cortes — sessão / autorização / regras
        / NPCs / chat; rotas / realtime / Yjs — **sem executar**, com veredito próprio. É o insumo da
        L.3: sem este mapa, a L.3 não tem de onde partir.
- [x] **E.2** Calibragem e PR do ledger — [roteiro](#o-roteiro-de-uma-varredura), passo X.2.
      *(30/09/2026 — calibragem: 6 FAZER em 24, **25%**, abaixo de 1/3; a régua não precisou de ajuste.
      Ledger mergeado no PR #23, depois do #22 (segurança); `master` verde nos 4 jobs.)*
- [x] **E.3** Executar só os FAZER — passo X.3. *(30/09/2026 — os seis, cada um com teste antes e prova revertendo.)*
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
  - [x] **E.3c** **E.01 — todo erro com `code`, e o status sai do `code`.** Um conjunto fechado de códigos
        e uma tabela `code → status`; `respondWithResult` e `respondToCombat` viram uma função; as mensagens
        em inglês vão para o português. Teste primeiro: `error-codes.integration`, uma linha por caminho de
        erro (os casos reproduzidos no ledger falham hoje). Os quatro `code` da R e os quatro da E.3a–b
        ficam como estão.
        *(30/09/2026 — `server/errors.ts` tem os códigos e a tabela; no `roomManager`, o tipo `RoomResult`
        torna o `code` obrigatório — o compilador não deixa erro sair sem ele; no `server.ts`,
        `sendError` é a única saída. O erro pelo WebSocket também leva `code`, e `/api` desconhecida é 404
        em JSON em todo ambiente. De carona: a iniciativa sem `action` nem lista reenviava a sala a todos
        sem conferir o GM — agora 400. **Três testes antigos fixavam o defeito** ("Room not found", chat
        vazio 403, estabilizar fora de Mortal 400) e foram trocados com o porquê. `error-codes` (32);
        provado revertendo: os 32 falham com o código antigo.)*
  - [x] **E.3d** **E.07 — tirar alguém da iniciativa não pula a vez de outro.** Um helper só para os três
        caminhos (`deleteRoomNpc`, `deleteGeneratedPlayer`, `leaveRoom`), que mantém a vez com quem a tinha
        — ou passa ao seguinte, se foi ele que saiu. Teste primeiro: `initiative-removal`, com os três casos
        do ledger e a saída de um jogador antes da vez.
        *(30/09/2026 — `removeFromInitiative`: quem tinha a vez segue com ela; se foi ele que saiu, a vez
        passa ao seguinte e o turno dele começa, com o death save de Mortal (`beginTurn`, extraído do
        `nextTurn`). Achado no conserto: remover o NPC pelo **nome** deixava a entrada dele na iniciativa.
        `initiative-removal` (8); provado revertendo: 7 falham com o filtro antigo.)*
  - [x] **E.3e** **E.10 — o horário do chat no fuso de Brasília.** Um formatador só, com
        `timeZone: "America/Sao_Paulo"`, no lugar das 12 chamadas. Teste primeiro: `chat-time`, com o
        processo em UTC. *(A versão maior — o instante em ISO, formatado no cliente — é ADIAR: jogador de
        outro fuso.)*
        *(30/09/2026 — `chatTime()` e `CHAT_TIME_ZONE` no `roomManager`. `chat-time` (2) põe o processo em
        UTC: sem isso, passaria nesta máquina e falharia só no CI. Provado revertendo o `timeZone`.)*
  - [x] **E.3f** **E.13 — o Registro de sessões lê os eventos que faltavam.** *(30/09/2026, no PR do
        ledger — só documento.)* A [tabela](#registro-de-sessões) ganha `unhandled_error`,
        `persistence_save_failed` e `rooms_full`, e a ressalva do `sse_fallback` (E.14).
- [x] **E.4** 🔒 Portão, se a E.3 mudou código — passo X.4. *(30/09/2026 — duas entradas no
      [registro](./SEGURANCA.md#fase-e--varredura-backend): a E.3a–b, com os achados SEC-14 e SEC-15, e a
      E.3c–e, sem achado novo.)*
- [x] **E.5** 🧠 Estado durável — passo X.5. *(30/09/2026 — caixas, linha de base (**651** testes, 45
      arquivos), E2E, o PR #24. **Passo 6 conferido:** depois do merge do #24, o `master` ficou verde nos 4
      jobs, com o `db-sync` em dia ("Remote database is up to date" — a E não teve migration).)*
- [x] ✅ **Fase E concluída em:** 30/09/2026

---


### FASE G — 🔍 VARREDURA: FRONTEND *(1–2 dias)*

Escopo: `src/components`, `src/features`, `src/pages`, `src/stores`, `src/hooks` — e, desde a
revisão de robustez, **`src/utils` e `src/lib`** (menos o `supabase.ts`, que é da L.4): os dois
somavam ~1.800 linhas **fora do escopo de qualquer varredura**. Vem **depois** da Fase F para não
varrer código que acabou de ser reestilizado. Segue o
[roteiro de uma varredura](#o-roteiro-de-uma-varredura).

- [x] **G.0** 🔍 **Premissas** — medidas em 29/09/2026; conferir de novo no dia, e depois da F.
      *(10/10/2026 — as nove pistas conferidas contra o `master` em `c3e3375`: **todas bateram**, e as duas
      da G.1a **reproduziram** (o aviso do React no console; `/dice` aberto no dev termina em `/`). Mudou um
      número: o `MultiplayerRoom` tem **1.049** linhas. Tabela no topo do [ledger](./varreduras/G-frontend.md).)*
- [x] **G.1** Varredura por área → ledger em `docs/varreduras/G-frontend.md`.
      *(10/10/2026 — **25 itens: 7 FAZER (28%), 17 ADIAR, 1 DESCARTAR**, depois de recalibrar (a primeira
      passada deu 40%). As 9.170 linhas lidas inteiras; reproduzido no navegador — dev e build de produção
      local — e com script fora do repo. Nenhum achado de segurança aberto. O que depende de login ficou
      lido: o Supabase local não subiu.)*
  - [x] **G.1a Estado em dois lugares.** *(G.04 FAZER — reproduzido: o modal do Bio-Monitor congela no
        jogador de quando abriu. G.01, G.02, G.03 e G.05 ADIAR — as duas pistas reproduziram, mas só quem
        mantém o código as sente; G.05, os dois nomes do ferimento, só fica feio.)* Que estado existe em
        dois lugares e pode divergir?
        - `syncSheetStore(sheetResult)` no **corpo do render** (`App.tsx:69`). **Com sintoma** *(visto na
          C, 25/09)*: o React avisa a cada carga "Cannot update a component while rendering a different
          component". Anterior à Fase C (`7fe4f47`).
        - Os dois `useEffect` que sincronizam URL ↔ aba, com dois refs de guarda. **Com sintoma** *(visto
          na D.3, 28/09)*: em modo dev, **todo deep link** (`/room/X`, `/multiplayer`) volta para `/` — o
          `StrictMode` roda o efeito "aba → URL" duas vezes e a guarda só segura a primeira. Produção não
          tem o duplo efeito, e o E2E roda o build de produção.
        - A ficha local × a ficha na mesa (desde a decisão 7a, a mesa não aceita o ferimento do cliente).
  - [x] **G.1b Rede, sessão e espera.** *(G.06 FAZER — reproduzido: clique duplo aplica o dano duas vezes
        e, com o servidor lento, cria um assento órfão; nada na tela mostra espera. G.07 FAZER — reproduzido:
        o `deletePlayer` existe de ponta a ponta e **nenhum botão o chama desde a Fase 0** — a mensagem de
        mesa cheia manda o GM "remover alguém". G.08–G.11 ADIAR. Os estados das R têm mensagem certa.)* O que
        a tela mostra quando a rede falha, o token expira ou a resposta demora? *(A G olha a tela; o
        contrato é da I.)*
        - Os estados novos das R: `409 seat_taken` (R.1), `403 removed_by_gm` (R.3), `409 room_full`
          (R.16), `409 room_exists` (R.2).
        - **A espera de ~1 min** quando o Render acorda de hibernação ([free](https://render.com/docs/free)):
          a primeira ação depois de um tempo parado parece travada?
  - [x] **G.1c Teclado e foco.** *(Quase: todo controle da ficha é nativo e o foco é visível. G.12 FAZER —
        reproduzido: digitar 12 num atributo grava 15. G.13–G.15 ADIAR: o perfil e o grid só de mouse, e
        nome acessível para leitor de tela.)* Dá para operar a ficha só com teclado? *(Contraste, movimento e
        foco em modal são da F.4.2 — não repetir.)*
  - [x] **G.1d Efeitos, IDs e console.** *(G.16 DESCARTAR — o id da armadura não tem leitor. G.17 e G.18
        ADIAR para a L.5 — os 12 `console.*` e um evento sem ouvinte. G.19 ADIAR para a L.1 — o arrasto
        regrava o grid no Yjs, mas o reenvio da sala custa ~40× mais.)*
        - `createBlankCharacterSheet` (`useCharacterSheet.ts:46`) gera seis IDs de armadura no mesmo tick
          com `Date.now()` + sufixo curto.
        - **12** `console.*` no cliente sobrevivendo ao logger estruturado *(ARQ-07, parte 1; contados em
          29/09 — os 3 do `server/logger.ts` são o próprio logger)*.
        - ~~`StatBlock.handleSet` altera `stats` sem tocar em `currentStats`.~~ *Resolvida na C.6.*
  - [x] **G.1e Testes de componente** *(ARQ-08)*. *(G.20 ADIAR — seis dos sete FAZER são defeito de
        componente que nenhum teste pegaria; cada um traz o seu teste, e a tela sem sintoma não ganha.)*
        **27** componentes `.tsx` e **3** arquivos de teste
        que renderizam componente (`ui-smoke`, `combat-ui`, `invite-button`). Quais telas quebram sem
        ninguém ver? O filtro vale: teste novo só onde houve sintoma ou regra de jogo na tela.
  - [x] **G.1f Mapa de cortes** *(ARQ-05)*. *(G.21 — cortes em cinco arquivos, o `App` incluído, todos
        ADIAR com a L.3 de dona. O que mais barateia teste: os sockets do `MultiplayerRoom` num hook.)*
        `MultiplayerRoom` **1.028** *(1.049 em 10/10)*, `TacticalGrid` **792** (não
        estava na lista), `FriendsList` **723**, `CyberpunkMenu` **609**. Mesmo formato da E.1f — insumo
        da L.3, sem executar.
  - [x] **G.1g Regra de jogo e mesa** *(acrescentada na varredura, 10/10/2026: a leitura achou quatro
        defeitos fora das perguntas das áreas)*. *(G.22 FAZER — reproduzido: o NPC gerado não tem armadura
        no braço nem na perna esquerdos, e **3 em cada 10 acertos** nele ignoram a armadura. G.23 FAZER —
        a perda de Humanidade do cromo é sorteada de 2 a 8, qualquer que seja a fórmula do implante; duas
        fontes (S1, S8) dizem que é a do item. G.24 FAZER — reproduzido: o chat da mesa não acompanha a
        mensagem nova. G.25 ADIAR para a M.4 — as notas de versão chamam a v0.4.0 de atual.)*
- [x] **G.2** Calibragem e PR do ledger — passo X.2. *(10/10/2026 — calibragem feita: a primeira passada
      deu 10 FAZER em 25 (40%); com a pergunta 2 levada a sério, G.01, G.02 e G.05 viraram ADIAR — **7 em
      25, 28%**. Ledger mergeado no PR #39 em 11/10/2026, com a correção da ADR 0004 (G.09), sem mudança de
      veredicto; `master` verde nos 4 jobs.)*
- [x] **G.3** Executar só os FAZER — passo X.3. Os sete, cada um com o teste que o [ledger](./varreduras/G-frontend.md)
      nomeia **escrito antes** e a prova revertendo; um commit por item; G.3, G.4 e G.5 num PR só, como o
      #24 da E. Ordem pelo peso na mesa — os três primeiros mexem no combate:
      *(11/10/2026 — os sete, **+47 testes** em seis arquivos, cada um visto falhando com o código antigo e
      conferido na tela do build de produção local. Mais um commit de revisão: o WebSocket falso dos testes
      da mesa virou o `src/test/roomTransport.ts`.)*
  - [x] **G.3a** **G.22 — o NPC gerado ganha armadura no braço e na perna esquerdos**, com o SP das peças da
        direita (`utils/npcGenerator.ts:245–248`). Só dado; o servidor usa o mesmo gerador. NPC já gerado numa
        mesa aberta segue como está. Teste: `npc-armor` — cada arquétipo, os dois braços e as duas pernas
        com o mesmo SP.
        *(11/10/2026 — `npc-armor` (14), derivado de `HIT_LOCATIONS`: os 14 falham com o gerador antigo.)*
  - [x] **G.3b** **G.06 — clique duplo não repete a ação.** Duas peças: (1) `joinRoom` e `createRoom` devolvem
        a chamada **em voo** em vez de abrir outra, como o `reconnectInFlight` (`api/rooms.ts:106–114`) — cobre
        também a reentrada do `RoomPage` —, e os dois botões mostram "Entrando…"/"Criando…" desligados; (2)
        aplicar dano, NPC ataca e próximo turno ficam desligados enquanto a requisição está em voo. Teste:
        `double-click` — dois cliques com a resposta pendente fazem **uma** requisição.
        *(11/10/2026 — a tela usa o `useInFlight` (`src/hooks/`), uma ação por chave: o ref barra o clique
        que chega antes do render, o estado desliga o botão. `double-click` (7); provado por camada — sem a
        API, os 2 de API falham; sem a tela, os 4 de botão.)*
  - [x] **G.3c** **G.07 — o botão "Remover" do GM**, com `confirm()`, ao lado de cada outro jogador, chamando o
        `deletePlayer` que já existe (`MultiplayerRoom.tsx:459`). O servidor já barra quem não é GM (R.3) — a
        G.4 confere. Teste: `room-modals` — o GM vê o botão (não ao lado de si), o jogador não.
        *(11/10/2026 — ícone `UserX` no papel `fault` (ação destrutiva, decisão 10b), com nome para leitor de
        tela. `room-modals`, os 4 de G.07. Na tela: o `confirm` pergunta, o servidor tira o jogador e o chat
        registra.)*
  - [x] **G.3d** **G.04 — os dois modais leem o jogador da sala**: o estado guarda o `peerId`, não a cópia do
        `RoomPlayer` (`MultiplayerRoom.tsx:100–101`). Teste: no mesmo `room-modals`, a sala muda o ferimento
        com o modal aberto e o modal acende o nível novo.
        *(11/10/2026 — `room-modals`, os 2 de G.04. Na tela, o roteiro do ledger (clicar 5, depois 2): o
        modal acende 0–5 e depois 0–2. De carona: se o jogador sai, o modal fecha.)*
  - [x] **G.3e** **G.24 — o chat da mesa acompanha a mensagem nova**, só quando quem lê já está no fim (o
        `scrollIntoView` do `AiAssistant`). Teste: `room-chat`. *O jsdom não tem layout: o teste define
        `scrollHeight`/`clientHeight`/`scrollTop` à mão ou espia o `scrollIntoView`.*
        *(11/10/2026 — `scrollTop` na própria caixa, não `scrollIntoView` (que rolaria a página também). O
        gatilho é o id da última mensagem: no teto de 100 (E.3b) a contagem para de crescer — o teste pega.
        A caixa ganhou `role="log"`. `room-chat` (5).)*
  - [x] **G.3f** **G.12 — atributo digitado entra como digitado**: o texto é livre enquanto digita, e o grampo
        (2–15) roda no `blur` (`StatBlock.tsx:32–35`). Teste: `stat-input` — "12" grava 12; sair com 40 grava 15.
        *(11/10/2026 — o número entra assim que cabe na faixa; sair vazio devolve o valor que estava.
        `stat-input` (6): com o código antigo, "12" vira `'15'`, o sintoma do ledger.)*
  - [x] **G.3g** **G.23 — a perda de Humanidade sai da fórmula do implante.** **Começa pela conferência:** a
        linha da regra com as duas fontes, S8 e S1 (a evidência está no G.23 do ledger), antes do código. A
        rolagem mora em `src/rules/` (o motor único), com o RNG injetado: fórmula `NdM±X` rola pelo parser que
        existe (`parseDamageFormula`, `rules/dice.ts:153`), número usa o número, e o que o parser não lê
        (`1d6/2`, `0.5`) o jogador digita. Teste: `cyberware-humanity` — nunca um valor fora do que a fórmula
        permite.
        *(11/10/2026 — a linha na [conferência](./CONFERENCIA_CP2020.md#atributos-correntes), com a S8 lida de
        novo; `rollHumanityLoss` e `humanityCostIsReadable` em `rules/character.ts`. `cyberware-humanity`
        (9): com o sorteio antigo, um `1d6` deu 8.)*
  - [x] **G.3h** **Revisão do código da G.3** *(pedido do dono depois do merge do #41, 11/10/2026)*: o diff
        inteiro lido de novo atrás de inconsistência, erro de lógica e defeito, e cada achado pelo filtro.
        **Quatro consertos e dois documentos corrigidos**, cada conserto com o teste antes; **quatro ADIAR**.
    - [x] **O modal de quem saiu reabria sozinho** (defeito da G.3d). O estado guardava o `peerId` e não o
          esquecia; quem sai pelo "Sair" volta com o **mesmo** `peerId` (o `sessionStorage` o guarda), e o
          Bio-Monitor ou a inspeção reabriam na tela do GM. `room-modals` +2; conferido no navegador (o
          jogador sai e volta pela API, e o modal continua fechado).
    - [x] **O "Remover" não avisava que a pessoa não volta pela mesma aba** (G.3c × R.3): o servidor recusa a
          volta daquele `peerId` (`removed_by_gm`). O `confirm` diz agora. `room-modals` +1.
    - [x] **A perda de Humanidade digitada é inteira, e o campo não dizia** (G.3g): `1d6/2` dá fração na S8,
          o `actualHL` é inteiro, e "2.5" deixava o "Instalar" mudo — o defeito do G.09. O rótulo pede o
          inteiro; a fração virou **ADIAR** na [conferência](./CONFERENCIA_CP2020.md#atributos-correntes)
          (é formato persistido). `cyberware-humanity` +1.
    - [x] **Dois testes do `double-click` terminavam com a resposta resolvendo depois** do teste, escrevendo
          na store do seguinte. Agora esperam — e o do próximo turno prova que a trava **solta** (com o
          `useInFlight` sem soltar a chave, ele falha).
    - [x] **Documentos:** a convenção do `useInFlight` no `CLAUDE.md` dizia "todo botão que manda ação ao
          servidor", mais largo que o código; e o [protocolo](./PROTOCOLO_MULTIPLAYER.md) ganhou a regra que
          a G.06 criou — nunca dois `join` em paralelo — e o limite dela.
    - **ADIAR**, cada um com gatilho:
      - "Gerar NPC", "Gerar Jogador" e "Rolar iniciativa" **sem a trava**: em dobro, um NPC ou uma ficha a
        mais, ou a iniciativa rolada duas vezes — à vista de todos e desfazível (o "✕" do NPC em dobro só
        reenvia a sala, sem erro). **Gatilho:** acontecer numa sessão real ou na H.1a. Versão de uma linha:
        o `run` do `useInFlight`, como nos outros.
      - A perda digitada aceita até 999, e o `sheetSchema` grampeia 100 por implante quando a ficha entra
        na mesa — a ficha local e a da mesa divergiriam. **Gatilho:** alguém digitar acima de 100 (nenhuma
        fórmula do livro passa de 3d6).
      - O cartão do token remonta (`key={token.id}`) ao trocar de token, e a trava de dano e ataque começa
        de novo. **Gatilho:** o GM trocar de token e voltar no meio de uma resposta lenta, e repetir a ação.
      - O `reconnectSession` não compartilha a trava do `joinRoom`. Hoje não se cruzam; o caminho em que
        cruzariam está no protocolo. **Gatilho:** a H.1c ou a H.1e, que mexem nele.
- [x] **G.4** 🔒 Portão, se a G.3 mudou código — passo X.4. *(11/10/2026 — entrada no
      [registro](./SEGURANCA.md#fase-g--varredura-frontend), sem achado novo: nenhuma rota nem sessão nova;
      dois `join` seguidos viram um — menos sessões emitidas; +230 bytes por NPC no reenvio da sala. A G.3h
      ganhou um adendo, também sem achado.)*
- [x] **G.5** 🧠 Estado durável — passo X.5. *(11/10/2026 — caixas, ledger com os sete FAZER marcados, linha
      de base (**796** testes, 57 arquivos), E2E 7/7, `audit:colors` e conflitos em 0, o PR #41 (G.3–G.5) e o
      #42 (G.3h). **Passo 6 conferido nos dois:** depois do #41 (11/10) e do #42 (13/10), o `master` ficou
      verde nos 4 jobs, com o `db-sync` em dia ("Remote database is up to date" — a G não teve migration).
      No fechamento, os ADIAR da G com gatilho na H e na I foram levados à H.0 e à I.0, como a E fez.)*
- [x] ✅ **Fase G concluída em:** 13/10/2026 *(código em 11/10)*

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

- [x] **H.0** 🔍 **Premissas** — medidas em 29/09/2026:
      *(14/10/2026 — as pistas conferidas contra o `master` em `8203479`: **todas bateram**, e as linhas
      das pistas da E e da G foram medidas de novo. Duas coisas a mais: as revogações que não são expulsão
      **não fecham o socket** de quem perdeu a sessão, e um comentário do `server.ts` guardava uma pista
      que o plano não tinha — o cliente não lê o código de fechamento 4400/4409. O Registro de sessões
      segue vazio: a H corre sem sessão real. Tabela no topo do [ledger](./varreduras/H-multiplayer.md).)*
      - ~~**O stream SSE só confere o token na abertura** — a expulsão não derruba um stream aberto.~~
        *Resolvida para a expulsão na R.3:* a rota fecha o stream do expulso (`ssePeer`). Resta a
        pergunta para outras revogações — no H.1e.
      - **Awareness órfão dura até 30 s, não para sempre.** O `y-protocols` apaga o estado remoto que
        não se atualiza em 30 s (`outdatedTimeout`, no servidor e em cada cliente). O servidor não
        remove o estado quando o socket fecha (`server.ts:1297`, depois da E) — o sintoma possível é um cursor
        fantasma de até 30 s.
      - **O gatilho da [ADR 0002](./adr/0002-yjs-websockets.md) é conferido aqui** (bug de
        convergência). A autorização por diff do grid já teve um buraco (SEC-12, R.6) — evidência para
        a ADR, não gatilho.
      - **O diagrama adiado da sequência do handshake** tem gatilho "quando a H precisar depurar
        reconexão" ([`ARQUITETURA.md`](./ARQUITETURA.md#diagramas-adiados)) — decidir no H.1d.
      - **De preferência, com uma sessão real já registrada** no [Registro de sessões](#registro-de-sessões):
        os bugs daqui aparecem com gente de verdade, e a primeira sessão é o melhor insumo da H.
      - *Levados pela E (30/09/2026), do [ledger](./varreduras/E-backend.md):*
        - **O cliente cai para o SSE numa queda de rede comum** (E.14, lido, não reproduzido): o
          `wsEverOpen` nasce `false` a cada tentativa (`MultiplayerRoom.tsx:171`); se o WS cai depois de
          conectar e a tentativa de 3 s depois falha, o cliente vai para o SSE e o servidor registra
          `sse_fallback`. É o H.1g — e a contagem da L.6 depende dele.
        - **Todo deploy roda duas instâncias por ≥60 s** (E.06, pela [doc do Render](https://render.com/docs/deploys)):
          a nova recebe o tráfego novo e restaura do banco no boot; a velha segue com os sockets e só leva
          o `SIGTERM` 60 s depois. O H.1j confere o que se perde — o ledger tem a previsão.
        - **Socket que não lê agora é derrubado** (E.03, 1 MiB): na rede estrangulada do H.1b, conferir
          que um jogador lento de verdade **não** cai por isso.
      - *Levados pela G (13/10/2026), do [ledger](./varreduras/G-frontend.md) e da revisão G.3h — todos
        ADIAR com gatilho que a H pode disparar:*
        - **O console já tem um erro do React a cada edição da ficha** (G.01: `Cannot update a component
          (App) while rendering…`). A H lê o console de três abas: se ele esconder um erro de verdade, o
          gatilho dispara, e a versão de uma linha (o `syncSheetStore` num `useLayoutEffect`) entra.
        - **No dev, o deep link volta para `/`** (G.02). Por isso os cenários de refresh e deep link (H.1c,
          H.1d) vão no build de produção. Se a H precisar do HMR, o gatilho dispara — a versão de uma linha
          está no ledger.
        - **Trocar de ficha com a mesa aberta leva o ferimento para a ficha nova** (G.03) — o mesmo caminho
          da H.1i. Se a H.1i mexer nele, os dois se resolvem juntos.
        - **O menu consulta o perfil a cada troca de aba, sem `catch`** (G.11): uma rejeição sem tratamento
          no console numa sessão da H dispara o gatilho.
        - **"Gerar NPC", "Gerar Jogador" e "Rolar iniciativa" não têm a trava do clique duplo** (G.3h). A
          H.1a monta a mesa de base com eles: se dobrarem ali, o gatilho dispara, e a versão é o `run` do
          `useInFlight`.
        - **O `reconnectSession` tem trava própria, separada da do `joinRoom`** (G.3h). Onde os dois se
          cruzariam (a página da sala aberta com a mesa já ativa e o token vencido) está no
          [protocolo](./PROTOCOLO_MULTIPLAYER.md) — a H.1c e a H.1e conferem.
        - **As linhas citadas nas pistas acima mudaram**: a G levou o `MultiplayerRoom` de 1.049 para 1.123
          linhas (o `wsEverOpen` do E.14 saiu da `:171` para a `:227`). Medir de novo no dia, como manda o
          passo X.0.
> **Estado em 15/10/2026:** a H.0–H.2, a H.3a–c e a H.4 estão feitas, no PR #46. O H.1j rodou no ar, combinado
> com o dono (ele clicou no "Manual Deploy" com a mesa de teste aberta), e a H.3 executou os dois FAZER e o H.02
> que o conserto disparou. **O dono decidiu o H.13 como FAZER** (15/10, no #46): é a **H.3d**, a passagem de
> bastão entre instâncias, com o H.10 e o H.11 — ~2 dias, dois PRs e mais um teste no ar com ele. **Falta:** a
> H.3d, pelas caixas dela, e a H.5 (o `master` verde depois de cada merge, e a data da fase).
> *(15/10/2026, 23:55 — **a H.3d está feita e provada no ar**: a migration no #47, o código no #48, o aviso antes
> do fechamento no #49 — o que a primeira prova no ar pediu —, e a H.3d.4 refeita perdeu 0 de 30. **Falta só a
> H.5:** o merge do PR do registro, o `master` verde depois dele, e a data da fase.)*
> ***Fase H fechada em 16/10/2026*** *(o #50 mergeado e o `master` verde). A próxima é a **Fase I** — a varredura da
> integração backend ↔ frontend —, começando pela I.0.*

- [x] **H.1** Varredura por cenário → ledger em `docs/varreduras/H-multiplayer.md`. *(14/10/2026 — os dez cenários
      locais no #44; o H.1j, no ar, depois do merge dele.)*
  - [x] **H.1a Mesa de base:** GM + 2 jogadores em 3 abas, do zero ao combate. O que os outros cenários
        comparam.
        *(14/10/2026 — tudo bateu, sem item: três contextos isolados do Playwright contra o build de
        produção, 0 erro de console, o ferimento igual na mesa e na ficha local. A régua: um chat custa
        6,7 KB por aba, o ataque mais o dano ~72 KB, 45 s parada 0,5 KB. Os gatilhos da G.3h e do G.01 não
        dispararam.)*
  - [x] **H.1b Rede estrangulada:** chat, rolagem, token movido e dano chegam, e na ordem? Broadcast
        completo e update Yjs incremental podem chegar fora de ordem.
        *(14/10/2026 — um proxy TCP de 3G lento (50 KB/s) no Beto: tudo chega e **na ordem**, e o token
        converge. O jogador lento **não cai** pelo teto de 1 MiB do E.03 — só num túnel de 90 s, e a volta é
        limpa (mesmo assento, alcança em 4 s). H.01 ADIAR para a L.1: numa rajada ele fica 7–9 s atrás,
        porque cada ação reenvia a sala inteira. H.02 ADIAR: cada queda deixa a conexão Yjs velha viva.)*
  - [x] **H.1c Refresh no meio do combate** — do jogador e do GM.
        *(14/10/2026 — quem entrou pelo link do convite ou pelo deep link volta ao mesmo assento, com o
        ferimento e a vez. **H.03 FAZER — reproduzido:** quem entrou pelo lobby fica em `/multiplayer`, e o F5
        o devolve ao lobby; entrando de novo, ganha outro `peerId` — o jogador duplica, e **o GM que criou a
        mesa pela tela vira jogador comum: a mesa fica sem Mestre**. H.04 ADIAR: dois F5 com o `join` em voo
        duplicam o assento (1 em 3), gatilho na H.1j.)*
  - [x] **H.1d Servidor reiniciado com a mesa aberta:** restore, sessões persistidas (B.4) e o fluxo
        401 → `join` **com o token** que a R.1 impôs.
        *(14/10/2026 — com o Supabase local de verdade e a queda brusca (no Windows, o processo morre sem o
        `flushAllPending`): o restore volta com a sala e as sessões, e quem tinha o token gravado segue igual.
        H.10 ADIAR — o *debounce* reinicia a cada mutação, e uma rajada de 10 s nunca foi gravada: a queda
        perdeu a rajada inteira. H.11 ADIAR — quem deu F5 na janela volta como outro jogador. O diagrama do
        handshake segue ADIAR: não fez falta.)*
  - [x] **H.1e O mesmo jogador em duas abas:** o `join` com token revoga as sessões antigas
        (`roomManager.ts:668`, depois da E) e não fecha o socket da outra aba — o que ela vê?
        *(14/10/2026 — duplicar a aba: a antiga segue vendo e agindo pelo socket aberto, e no primeiro REST
        (401 → `seat_taken`) **vira outro jogador em silêncio** — dois assentos com o mesmo nome. H.05 ADIAR,
        com o H.04: os dois pedem ao servidor distinguir "token substituído por outro `join`". O 4409 da pista
        nova não dispara: a rotação separa os `peerId`.)*
  - [x] **H.1f O GM sai** (T1.8): existe janela de dois GMs ou de nenhum? A variante do SEC-07 pelo
        *handle* do GM segue ADIAR (R.1).
        *(14/10/2026 — dois GMs, nunca: o "Sair" passa o cargo e revoga o token no mesmo passo. Nenhum GM, sim,
        e permanente: **H.06 ADIAR (o mais perto da linha)** — o GM que fecha a aba e volta pelo convite é
        jogador novo, e o cargo fica num assento que ninguém reclama; H.07 ADIAR — o cargo pode ir para uma
        ficha gerada. H.08 DESCARTAR: o código 4400/4409 não lido não muda nada na tela.)*
  - [x] **H.1g Queda para SSE** (bloquear o WebSocket): o que deixa de funcionar, o jogador fica
        sabendo, e o `sse_fallback` aparece no log?
        *(14/10/2026 — no SSE funcionam chat, rolagem e presença; **o jogador não move o próprio token** (o
        REST do grid é do GM) e só fica sabendo pelo "Acesso Negado". O `sse_fallback` aparece, com o *user
        agent*. **H.09 FAZER — o E.14 reproduzido:** uma queda de ~6 s deixa a jogadora no SSE para sempre, e o
        log conta a queda como proxy.)*
  - [x] **H.1h Último socket fecha e alguém reconecta no mesmo instante:** o `destroyRoomYjs`
        (`server.ts:1302`, depois da E) descarta o doc — a reconexão perde movimento do grid?
        *(14/10/2026 — não perde: o CRDT convergiu nas três corridas (os dois sockets caindo juntos, o
        movimento em voo, o GM caindo enquanto a Ana move), sem token duplicado — o JSON é espelhado a cada
        update. De carona, **o grid congela na tela de quem caiu para o SSE**: foi para o H.09. O gatilho da
        ADR 0002, na leitura desta varredura, não disparou — vai à H.2 para o dono confirmar.)*
  - [x] **H.1i Ficha editada em duas abas:** a reconexão resolve por **last-write-wins com o
        `updatedAt` do cliente** — o relógio do navegador decide quem ganha.
        *(14/10/2026 — não decide nada que importe, sem item: com o relógio 2 h atrasado a edição entra na
        mesa. A ficha de um assento tem um escritor só além do servidor (que só escreve o ferimento), e a
        sincronia grava sem comparar `updatedAt` logo depois de cada reentrada. Duas abas: é o H.05.)*
  - [x] **H.1j** *(no ar)* **O Render troca a instância com a mesa aberta:** um merge no `master` no
        meio da sessão publica sozinho (30 s entre `SIGTERM` e `SIGKILL`); e a volta depois de hibernar
        leva ~1 min ([free](https://render.com/docs/free)).
        *(14/10/2026, 22:32–22:55, combinado com o dono — ele clicou no "Manual Deploy" com a mesa de teste
        aberta; roteiro `scripts/multiplayer/h1j.mjs`, ensaiado antes no build local com duas instâncias. **As
        duas instâncias ficaram vivas ~20 s**, não os 60 s da doc do Render: perdeu-se o que a velha recebeu
        pelo WebSocket nesse intervalo (1 mensagem), e os três voltaram em 3 s ao mesmo assento, sem SSE —
        **H.13** — o E.06 medido; ADIAR na primeira leitura, FAZER por decisão do dono (a H.3d). **A hibernação:** o despertar levou ~22 s, e um `join` abortado aos 4 s
        não chegou ao servidor — o gatilho do **H.04** não disparou. A mesa de teste saiu do banco no fim.)*
  - [x] **H.1k Habilidade especial na mesa:** não é rolável — o tipo `skill` procura em `sheet.skills`,
        e ela mora em `specialAbilityName` (visto na C.8). Na ficha funciona. Sem sintoma de mesa até
        alguém pedir.
        *(14/10/2026 — confirmado pela API, e é maior: a mesa **não tem botão de perícia nenhum**; o tipo
        `skill` só existe no servidor. De carona, a ficha gerada guarda a habilidade especial com o
        atributo do ternário que a C.8 tirou da ficha. H.12 ADIAR, gatilho: alguém pedir.)*
- [x] **H.2** Calibragem e PR do ledger — passo X.2.
      *(14/10/2026 — calibragem: **2 FAZER em 12, 17%**, abaixo de 1/3 na primeira passada. Ledger e roteiros
      mergeados no **PR #44** em 14/10/2026; `master` verde, deploy no ar. **O merge aprovou os veredictos como
      estavam**, inclusive os dois que foram destacados ao dono: o **H.06** fica ADIAR (o GM que fecha a aba
      perde a mesa — a versão menor, a credencial do GM no `localStorage`, cabe no PR do H.03 se o dono pedir)
      e o gatilho da **ADR 0002 não disparou** (a revisão está na própria ADR). *Com o H.13, do H.1j: 13 itens,
      2 FAZER, 15%. O dono decidiu o H.13 como FAZER no #46 (15/10): **3 FAZER, 23%** — a H.3d.*)*
- [x] **H.3** Executar só os FAZER — passo X.3. Teste que reproduz **escrito antes**, a prova revertendo,
      um commit por item, e a conferência na tela pelo roteiro do cenário (`scripts/multiplayer/`). H.3, H.4 e
      H.5 num PR só, como o #41 da G. As linhas citadas são as do ledger (`master` em `8203479`); medir de novo.
      *(14/10/2026 — os três, **+9 testes** em dois arquivos novos, cada um visto falhando com o código antigo e
      conferido na tela do build de produção local; a seção [H.3 do ledger](./varreduras/H-multiplayer.md#h3--os-fazer-executados) tem a tabela.)*
  - [x] **H.3a** **H.03 — a mesa ativa pelo lobby troca a URL por `/room/CÓDIGO`** (`navigate(…, { replace:
        true })`) ao criar e ao entrar (`MultiplayerRoom.tsx:351–383`). O F5 passa a cair no `RoomPage`, que já
        volta ao mesmo assento com o token — o caminho que a H.1c provou. Conferir que o efeito "aba → URL"
        do `App` (`:94–115`) não briga (o `pathToTab('/room/X')` já dá `multiplayer`) e que o "Sair" em
        `/room/CÓDIGO` volta ao lobby com o código. Teste: `room-refresh` — criar e entrar pelo lobby deixam
        a URL em `/room/CÓDIGO`; e o "F5" (stores zeradas, o app montado de novo na URL atual com o
        `sessionStorage`) manda o `join` com o **mesmo `peerId` e o token**. Na tela: `h1c.mjs` (o Beto volta
        com o mesmo `peerId`); o `h1c-gm.mjs` monta o estado de antes do conserto (`/multiplayer`) — ajustar
        para partir de `/room/CÓDIGO`, a URL que o conserto deixa.
        *(14/10/2026 — o `RoomPage` virou a página das duas rotas: no lobby, a mesa ativa leva a URL para
        `/room/CÓDIGO`, e ele não repete o `join` de uma sessão viva — sem essa guarda, o token trocava à toa.
        `room-refresh` (4): os 4 falham com o código antigo. O `h1c-gm.mjs` agora faz o caminho de verdade —
        login no Supabase local com um usuário descartável, "Criar Mesa como GM", F5: o GM segue GM.)*
  - [x] **H.3b** **H.09 — depois de uma conexão que funcionou, a queda tenta o WebSocket de novo**, com espera
        crescente, em vez de abrir o SSE: o "já abriu uma vez" sai da rodada do efeito para um `useRef`
        (`MultiplayerRoom.tsx:226–283`); o SSE fica para quem **nunca** conectou (o proxy corporativo, o que
        o `sse_fallback` quer contar). E, na mesma mudança, zerar o `yjsGrid` quando o socket cai, para a
        tela voltar ao JSON da sala (`:659`). Teste: `room-transport` — um WebSocket falso controlável (uma
        variação do `stubRoomTransport`): abre, cai, a tentativa seguinte falha, e o cliente tenta o
        WebSocket de novo, não o `EventSource`; quem nunca conectou ainda cai no SSE; sem Yjs, o grid da tela é
        o da sala. Na tela: `h1g.mjs` (parte B — a Ana volta ao WebSocket) e `h1h.mjs` (parte 4 — o grid não
        congela).
        *(14/10/2026 — espera de 3, 6, 12… até 30 s, de volta a 3 s quando conecta. `room-transport` (4), com o
        `controlRoomTransport`: 3 falham com o código antigo, e o do proxy (nunca conectou → SSE) passa nos dois.
        Na tela, a Ana volta ao WebSocket e arrasta o próprio token, e o log tem **um** `sse_fallback` — o do
        Beto, atrás do proxy.)*
  - [x] **H.3c** **H.02 — o gatilho dispara com a H.3b** ("alguém mexer no `onclose`"): a conexão Yjs velha
        recebe `destroy()` quando o socket cai, antes de zerar o ref (`MultiplayerRoom.tsx:267–271`). Teste:
        no mesmo `room-transport`, a queda chama o `destroy()` da conexão velha (ou: nenhum `setInterval` a
        mais por queda — medido +2 no H.1b).
        *(14/10/2026 — `room-transport` +1, falha com 0 chamadas ao `destroy`. No `h1b-tunel.mjs`, 4 intervalos
        vivos antes e depois do túnel de 90 s — eram 4 → 6.)*
  - [x] **H.3d** **H.13 — a passagem de bastão entre instâncias no deploy** *(FAZER por decisão do dono, 15/10/2026,
        no PR #46 — o [H.13 do ledger](./varreduras/H-multiplayer.md#h13--no-deploy-com-mesa-aberta-o-que-a-instância-velha-recebe-nos-20-s-depois-de-a-nova-subir-se-perde)
        tem o desenho e as versões descartadas)*. Hoje, num deploy, a nova instância lê a mesa do banco ao ligar e as
        duas seguem separadas por ~20 s; o que vai à velha some (H.1j). **O conserto:** só uma instância manda na mesa
        por vez. A nova anota no banco que quer assumir e não abre a porta (o servidor só escuta depois do restore,
        `server.ts:1417`, e o Render só troca o tráfego com o `/api/health` respondendo); a velha, que confere a
        anotação a cada 2 s, para de aceitar ações, fecha os sockets, grava tudo e marca que entregou; só então a nova
        lê o banco e escuta. Sem marca de vida da velha (morta, ou o serviço hibernava), a nova assume depois de alguns
        segundos — a volta da hibernação não espera. **Preço:** um "reconectando" de uns 5–20 s a cada deploy, no
        lugar da perda em silêncio; uma escrita no banco a cada 2 s com o serviço acordado. ~2 dias. De carona, no
        mesmo arquivo da persistência, o **H.10** e o **H.11**, com os gatilhos disparados por ela.
    - [x] **H.3d.0** 🔍 **Premissas** (com o dono no painel do Render — o login é dele): (1) no log do deploy de
          14/10 (~22:34 BRT; o log do Hobby guarda 7 dias, até ~21/10), a instância velha registrou o
          `server_shutdown` — recebeu o `SIGTERM`? (2) o serviço Docker tem o health check `/api/health` no painel,
          e o Render espera ele responder antes de trocar o tráfego? (3) quanto o Render leva da porta aberta à
          troca — é o que dura o "reconectando". Uma premissa que caia muda o desenho antes do código.
          *(15/10/2026, com o dono logado — a linha do tempo no [H.13 do ledger](./varreduras/H-multiplayer.md#h3d0--as-premissas-no-painel-do-render-15102026).
          (1) **Sim:** a velha (`lgv8m`) registrou `server_shutdown`/`SIGTERM` às 22:34:53,5, **5 s** depois de a nova
          abrir a porta, e nenhum erro de gravação depois — não os 60 s da doc. (2) **Caiu em parte:** o campo
          *Health Check Path* está **vazio**; sem ele, o Render testa a **porta TCP**, e o servidor só abre a porta
          depois do restore — o efeito é o mesmo, e o desenho fica, sem mudar nada no painel. A regra passa a ser
          "nunca abrir a porta antes de ter o bastão". (3) **~5 s** da porta aberta (22:34:48,4) ao `SIGTERM` da velha
          e ao *live* (22:34:54); o processo novo levou 1,4 s do início à porta. O "reconectando" previsto: **~7–9 s**.)*
    - [x] **H.3d.1** **PR da migration** (decisão 5): uma tabela de uma linha — quem manda, a última marca de vida,
          quem entregou —, com RLS ligado e **sem política**: só a service role lê e escreve, como a `rooms`.
          **Backup antes** (`npm run backup:db`, decisão 8, anotado no [registro](./BACKUP.md#registro-de-backups)),
          o merge, e a conferência em produção com `npx supabase migration list --linked` antes do PR do código.
          *(15/10/2026 — a `0008_instance_lease.sql`: os privilégios de anon e authenticated **revogados** (o select
          nega, em vez de voltar vazio como na `rooms`) e o RLS ligado sem política, como segunda camada. Os testes
          de RLS foram de **56 para 63**; devolvendo os privilégios no banco local, os 5 de cliente falham. Pela API
          REST local, a chave anônima leva `401`/`42501`. Backup de 16/10 (UTC) no registro. **Mergeado no #47**
          (16/10, 01:11 UTC), sem mesa aberta; o `master` verde com o `db push`. **Em produção:** o
          `migration list --linked` mostra a `0008` no remoto, e o schema tem a tabela, a restrição `id = 1`, o RLS
          ligado e privilégio só da `service_role` — anon e authenticated sem nenhum.)*
    - [x] **H.3d.2** **O teste que reproduz, antes do código:** o ensaio `H1J_LOCAL=1 node scripts/multiplayer/h1j.mjs`
          (duas instâncias com o Supabase local, atrás de um proxy que faz o papel do Render) perde o que vai à velha
          depois de a nova subir — 5 mensagens em 14/10. E os testes do módulo, com um banco falso: com a velha viva,
          a nova espera a entrega; com a marca de vida velha, assume na hora; a velha que vê a troca entrega; um erro
          de rede na renovação **não** é troca; depois de entregar, a velha não grava mais nada.
          *(15/10/2026 — o ensaio ficou fiel ao Render da H.3d.0: o tráfego vai à nova quando a porta dela abre, com
          atraso configurável (`H1J_SWITCH_DELAY_S`), e a velha morre `H1J_OLD_DIES_S` depois. Com o código de antes,
          perdeu **1** mensagem (a `d-3`, pelo WebSocket à velha depois de a nova abrir a porta). Os testes vieram antes
          de cada parte e foram vistos falhando: `instance-lease` (18 — os cinco da caixa, mais a hibernação, o prazo, o
          banco fora do ar, o SIGTERM e a entrega sem sucessor), `room-persistence` (7), `server-handoff` (6),
          `api-restart` (3) e `room-transport` +2. Mutações no módulo e no servidor, uma por propriedade: cada uma
          derruba o seu teste.)*
    - [x] **H.3d.3** **PR do código:** o módulo da passagem (`server/instanceLease.ts`: assumir, renovar a cada 2 s,
          entregar); o boot na ordem assumir → esperar a entrega → restaurar → escutar; a velha que entrega recusa
          ações e *upgrade* com `503 server_restarting` (código novo na tabela do `server/errors.ts`), fecha os
          sockets e o SSE, grava, para o vigia de presença e o coletor, e só então marca que entregou; o cliente tenta
          de novo sozinho por alguns segundos diante do `server_restarting`. **De carona:** o H.10 (gravar pelo menos
          a cada N s mesmo em rajada — o `maxWait`) e o H.11 (o `join` grava na hora), cada um com o seu teste.
          **Portão** (adendo à H.4): a pergunta 3 pesa — uma instância manda a outra parar, e só a service role
          escreve na tabela —, e a 5 (a tabela tem uma linha). ADR 0007 (a passagem de bastão), protocolo,
          `DEPLOY.md` e o diagrama de contêineres. **Prova:** o ensaio local perde 0.
          *(15/10/2026 — feito; a seção [H.3d do ledger](./varreduras/H-multiplayer.md#h3--os-fazer-executados) tem a
          tabela. **O ensaio perde 0:** na troca instantânea (a comparação com o código de antes) e na fiel ao Render
          (a troca 5 s depois da porta aberta), em que a velha recusa o WebSocket três vezes e o chat pela tela e pela
          API leva `503 server_restarting`, tenta de novo e fica. **"Reconectando": 6,1 s.** Dois acréscimos que o
          desenho não previa: o stream SSE acaba com `retry: 1500` e o pedido de stream à velha recebe 200 — um 503
          faria o `EventSource` desistir para sempre —; e a velha que entregou e ninguém assumiu sai em 60 s, para o
          Render a religar. O banco que não responde nem ao pedido desiste em 5 s, não em 30 — o despertar não espera.
          Portão no [registro](./SEGURANCA.md#fase-h--varredura-multiplayer). O PR abriu depois do merge do #47 e
          da `0008` conferida em produção. **O deploy do merge dele ainda perde como antes** — a velha não tem o
          bastão para entregar; o teste no ar é o "Manual Deploy" seguinte.)*
    - [x] **H.3d.4** **No ar, com o dono:** o H.1j de novo — a mesa de teste, o "Manual Deploy" clicado por ele —:
          0 mensagem perdida, e quanto dura o "reconectando". A regra "nunca mergear com mesa aberta" só sai do
          `CLAUDE.md` e do `DEPLOY.md` se este passo provar a perda zero.
          *(15/10/2026, 22:20–22:41, combinado com o dono — **1 perdida, não 0.** O primeiro deploy do #48 entrou como
          previsto (a velha sem bastão; a nova `how: free`). No "Manual Deploy" seguinte, **o servidor fez tudo**: a velha
          avisou `handoff_drained` (3 conexões, gravou), marcou em 0,1 s, a nova assumiu `handed-over` e abriu a porta,
          a velha saiu no SIGTERM sem gravar. Mas os navegadores viram os sockets fecharem **13–16 s depois**, com
          `1006`, e a tela do GM mandou uma mensagem pelo socket morto. **O caminho do Render não entrega o fechamento que o
          servidor manda** — medido em seguida com `scripts/multiplayer/h3d-fechamento.mjs`: dados em ~145 ms, o `4400`
          da expulsão nunca chegou (`1006` em 1,7 s). É a H.3d.5. **A hibernação com o bastão funcionou no ar:** no
          *spin-down* (22:37) a instância entregou no SIGTERM, e o despertar (22:40) assumiu `handed-over` em 1,7 s — o
          health em 24,1 s (eram 21,6 s em 14/10). A renovação a cada 2 s não impediu a hibernação. **Refazer este passo
          depois da H.3d.5 no ar.** A regra "nunca mergear com mesa aberta" fica.)*
          *(15/10/2026, 23:51 — **refeito com a H.3d.5 no ar (#49): 0 perdida, 30 de 30.** A velha avisou os 3 sockets, os
          navegadores fecharam o próprio socket na hora (ela entregou com `connections: 0`) e mandaram as ações por REST,
          que repetiu o 503 até a nova; os três no mesmo assento, sem SSE. **"Reconectando": 12,4 s** — 2 s de carência,
          ~1 s de entrega e 9,7 s da troca do Render, a parte que varia (já foi 2,4 e 5 s). A hibernação em seguida: o
          health em 21,7 s, os três no mesmo assento. Uma rodada antes se perdeu: o
          deploy começou com a mesa ainda sendo montada — o bastão funcionou, mas a sobra `H1J-9YCMEW` ficou para o
          coletor (24 h), e dela saiu o **H.14** (quem entra na janela da troca cai no SSE — ADIAR). Detalhe no
          [ledger](./varreduras/H-multiplayer.md#h3d4-de-novo--com-o-aviso-15102026-23450012). **A regra de merge:** a
          perda zero estava provada, e ela saiu do `CLAUDE.md` e do `DEPLOY.md` — vira "pode, mas não no meio de um
          combate", pelo "reconectando" de até ~15 s.)*
    - [x] **H.3d.5** **O aviso antes do fechamento** *(acrescentado em 15/10/2026, pela H.3d.4)*: na entrega, a velha
          manda a cada socket um quadro de **dados** (`{ type: "error", code: "server_restarting" }` — o bundle de antes só
          mostra o texto) e segue aceitando ações por **2 s**, recusando só conexão nova; o cliente que recebe o aviso
          fecha o próprio socket na hora e passa ao REST, que repete o 503. O ensaio local ganha o proxy que segura o
          fechamento (`H1J_CLOSE_HOLD_S=13`). **Prova:** o ensaio com o fechamento segurado perde 1 com o código do #48 e
          0 com o aviso; testes vistos falhando antes; ADR 0007 (revisão de 15/10), protocolo, `CLAUDE.md`.
          *(15/10/2026 — feito no branch `claude/h3d-aviso`: o ensaio segurando 13 s perdeu **1** com o código do #48
          (a mesma assinatura do ar: volta em 3 s, sem `1012`) e **0** com o aviso; o "reconectando", ~6 s.
          `server-handoff` estendido (o aviso, a ação na carência pelo socket e pelo REST, o *upgrade* recusado) e
          `room-transport` +1 (o socket fechado na hora, a mensagem por REST, a volta em 1,5 s sem o `onclose`), vistos
          falhando; mutações — sem aviso, sem carência, *upgrade* aceito na carência — cada uma derruba o teste. **842**
          testes. Mergeado no **#49**; provado no ar na H.3d.4 refeita: 0 perdida.)*
- [x] **H.4** 🔒 Portão, se a H.3 mudou código — passo X.4. *(Vai mudar: a URL depois de entrar e a reconexão
      do transporte. A pergunta 3 pesa — o F5 volta ao assento com o token, e nenhum caminho novo emite sessão.)*
      *(14/10/2026 — entrada no [registro](./SEGURANCA.md#fase-h--varredura-multiplayer), sem achado: nenhuma
      rota nem sessão nova — uma emissão a menos (a chegada a `/room/CÓDIGO` não repete o `join`); o código da
      mesa na barra de endereço já estava no cabeçalho e no convite, e o `helmet` manda `no-referrer`.)*
      *A H.3d traz o seu adendo — está na caixa H.3d.3.*
- [x] **H.5** 🧠 Estado durável — passo X.5. *(Inclui rodar `scripts/multiplayer/h1a.mjs` como régua: 0 erro de
      console e os números da H.1a.)*
      *(14/10/2026 — feito antes do PR: caixas, ledger, linha de base (**805** testes, 59 arquivos), E2E 7/7, o
      smoke de WebSocket 5/5, `audit:colors` e conflitos em 0, `audit:ci` limpo, e a régua `h1a.mjs`: 0 erro de
      console, 6,7 KB por chat, 0,5 KB em 45 s parada. Documentos que a H.3 tornou falsos: o protocolo (§1, §2, a
      nota dos códigos de fechamento, §7), a seta do SSE no diagrama de contêineres, e o "≥60 s / ~1,5 min" do
      deploy no `DEPLOY.md` e no `CLAUDE.md`. **Falta:** o merge do #46 e o `master` verde depois dele; e, com a
      H.3d (15/10), o mesmo passo para os PRs dela — a linha de base volta a ser medida no fim.)*
      *(15/10/2026, 23:58 — a H.3d nos #47, #48 e #49, cada um com o `master` verde depois (o #47 com o `db push` e a
      `0008` conferida em produção). A linha de base no fim: **842** testes, 63 arquivos; E2E 7/7; smoke de WebSocket
      5/5; RLS 63/63; `audit:ci` limpo; cores e conflitos em 0. A régua `h1a.mjs` no código do `master`: 0 erro de
      console, 6,7 KB por chat, ~50 KB no combate (o ataque errou), 0,5 KB em 45 s parada — os números da H.1a.
      **Falta:** o merge do PR do registro (este), o `master` verde depois dele, e a data da fase.)*
      *(16/10/2026 — o registro no **#50**, mergeado com o dono aprovando a regra de merge nova; o `master` verde
      depois dele, os quatro jobs.)*
- [x] ✅ **Fase H concluída em:** 16/10/2026 *(código em 15/10; a H.3d provada no ar em 15/10, 23:51)*

---

### FASE I — 🔍 VARREDURA: INTEGRAÇÃO BACKEND ↔ FRONTEND *(1–2 dias)*

Escopo: `src/api/*` contra os endpoints do Express — a costura que nenhuma das varreduras anteriores
olha, porque cada lado parece correto sozinho.

Segue o [roteiro de uma varredura](#o-roteiro-de-uma-varredura).

- [ ] **I.0** 🔍 **Premissas** — medidas em 29/09/2026:
      - **O cliente já sabe ler `code`:** o `ApiError` guarda o `code` do servidor desde a R.1
        (`src/api/http.ts:20`). ~~O que falta é o servidor mandá-lo em todo erro — isso é da **E.1a**.~~
        *Feito na E.3c (30/09): todo erro sai com `code`, e a tabela está no
        [protocolo](./PROTOCOLO_MULTIPLAYER.md#3-endpoints-rest). A I confere que o cliente decide por ele.*
      - **O `apiFetch` já trata corpo não-JSON** (`.catch(() => ({}))`) e **não tem timeout.** Cuidado
        antes de pôr um: a instância gratuita volta da hibernação em **cerca de 1 min**
        ([free](https://render.com/docs/free)). Timeout menor que isso quebra a primeira requisição
        depois de um tempo parado — exatamente o `join` de quem chega para jogar.
      - **O `RollResult` tem uma interface só** (`src/types/cyberpunk.ts:141`) e o motor é um só desde a
        C (`src/rules/`). Conferir se ainda há dois montadores com campos diferentes, como a pista dizia.
      - **O `VITE_API_URL` só importa quando o site sair do Render** (regra 4 do
        [custo zero](#-contrato-de-custo-zero)) — hoje o site e a API são o mesmo origin, e a regra 4
        **não tem fase dona**. Ver a I.1e.
      - *Levados pela G (13/10/2026), do [ledger](./varreduras/G-frontend.md):*
        - **A rede de amigos não mostra erro, e o chat dela trava** quando a nuvem recusa a mensagem (G.10,
          ADIAR) — o gatilho é a própria I.1b olhar os caminhos do Supabase no cliente.
        - **A tela diz "sincronizado" quando não está** (G.08, ADIAR) — o gatilho é a primeira ficha na nuvem,
          mas o caminho (o aviso de sucesso quando o save falha) é da I.1b.
      - *Levados pela H (14/10/2026):*
        - **O frontend no Vercel foi medido** (a nota de 14/10 na [regra 4](#-contrato-de-custo-zero)): o custo
          no Hobby é desprezível, e os quatro pontos que mudam (dois deploys por merge, o CSP fora do Express,
          a origem nova sem o `localStorage`, `CORS_ORIGINS` e o Auth do Supabase) são o que a I.1e confere se
          a regra 4 disparar.
        - **O `DEPLOY.md` se contradiz sobre o CORS** (seção do frontend estático): diz que o servidor responde
          a "qualquer origin" e, logo abaixo, que "não responde CORS por padrão" desde a T10.6. Vale o
          segundo (`server.ts:123–129`) — a I.1e corrige o texto.
      - *Levados pela H.3d (15/10/2026, a passagem de bastão — ADR 0007):*
        - **O `apiFetch` já tem um retry:** repete o `503 server_restarting` a cada 1,5 s por até 45 s
          (`src/api/http.ts`) — só esse `code`, que garante que nada foi executado. A I.1d mede o resto
          (timeout, os outros erros) sem duplicar este.
        - **No ar, nenhum código de fechamento de WebSocket que o servidor manda chega ao navegador** (`1006`
          segundos depois — H.3d.4). A I.1c (o 401 no meio da sessão) não pode contar com o `4400` da expulsão.
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
      - O CSP segue com `connect-src 'self' ws: wss: https:` (`server.ts:175`, depois da E).
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
        - *Da E (30/09):* a ficha de todo **NPC vai a todos os jogadores** no reenvio (E.20 — a saída não
          é filtrada por papel); e há leitura que responde "esta sala existe?" sob o limitador **global**,
          não o do `join` (E.21 — a conta da R.11 fica 5× otimista, e segue em anos). Os dois ADIAR, com
          gatilho no [ledger](./varreduras/E-backend.md).
  - [ ] **J.1c Credenciais:** toda emissão — `create`, `join`, *upgrade* do WebSocket, JWT do Supabase
        — e o que quem recebe prova. *(A lição do SEC-07.)*
  - [ ] **J.1d Entrada:** todo campo que entra em `sheet`, `gridState`, `initiativeList` e no protocolo
        Yjs — **o binário Yjs é entrada de usuário** e tem try/catch e o teto de 1 MiB (R.4).
        - *Da E (30/09):* a **forma** do `gridState` e do update Yjs passou a ser conferida (SEC-14) — a J
          confere se há outra porta sem forma. E ids como `__proto__` acham o protótipo de `players`/`npcs`
          (E.22, ADIAR: hoje só o GM chega, e o `join` os recusa por acaso).
  - [ ] **J.1e WebSocket**, pela [folha da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html):
        - o *upgrade* não confere `Origin`; o que protege de *cross-site WebSocket hijacking* é o token
          ir na query e não em cookie — registrar como decisão, não como acaso;
        - o token na URL: onde a URL do *upgrade* aparece em log (nosso e do Render)?
        - sessão revogada fecha o socket? A R.3 fez isso para a expulsão; e as outras revogações?
        - *backpressure*: cliente lento acumulando reenvios da sala no buffer (liga com a E.1b).
          *(E.03, 30/09: reproduzido — o heap crescia linear — e fechado **por socket**, 1 MiB. Falta o
          teto **global** de sockets: E.24, ADIAR, gatilho de memória no painel do Render.)*
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
      - ~~**O dono tem o livro** *(30/09/2026)*. Ele é a fonte primária da K.~~ **Corrigido no mesmo
        dia (decisão 11): o dono não tem o livro.** Onde as fontes secundárias divergem (criação, IP,
        netrunning), vale a regra de duas fontes; o que não fechar vai ao dono como decisão com
        recomendação — e é aqui que o gatilho da compra do PDF oficial tem mais chance de disparar. As
        perguntas estão em [Perguntas para o livro](./CONFERENCIA_CP2020.md#perguntas-para-o-livro), na
        conferência.
- [ ] **K.0b** 🧑‍⚖️ **Decisão do dono — o tamanho da K.5 e o método da K.6.**
      - **K.5**, em ordem de tamanho: *(1, recomendada)* **o netrunner na ficha** — deck, programas e MU
        como dado, sem a Net jogável; *(2)* **a Net na mesa**, com mapa e turnos — fase própria, depois da
        L; *(3)* **ADIAR** até alguém da mesa do dono jogar de netrunner. A 1 agora e a 2 com o gatilho da
        3 é a combinação que o filtro sugere.
        *(30/09/2026 — **o dono escolheu a recomendação:** a 1 na K.5, e a 2 como ADIAR com o gatilho
        da 3. Virou a [decisão 9](#-decisões-tomadas-02092026).)*
      - **K.6:** quais métodos de atributo a criação oferece (rolagem, bolo de 9d10, pontos), e se a
        evolução por IP entra junto ou depois. **Ainda aberta** — decidir na K.0, com as fontes
        secundárias (decisão 11): os métodos que duas delas confirmam são o cardápio.
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
      gatilho nunca dispara — é DESCARTAR disfarçado, e a M.3 os resolve. *(30/09: ~~**o dono tem o
      livro.** Os dois gatilhos são executáveis e viraram
      [Perguntas para o livro](./CONFERENCIA_CP2020.md#perguntas-para-o-livro) — não precisam esperar
      a M.~~ **Corrigido no mesmo dia (decisão 11): o dono não tem o livro** — exatamente o caso que
      este item previa. Os dois gatilhos foram reescritos na conferência para "uma segunda fonte
      independente", que dispara sem o livro.)*
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
| R | 🔨 | Pendências da revisão pós-D (segurança da mesa, Node, backup) | ✅ | 10/10/2026 |
| E | 🔍 | Varredura: backend — 24 itens, 6 FAZER; SEC-14 e SEC-15 | ✅ | 30/09/2026 |
| F | 🔨 | Reestruturação visual: identidade Cyberpunk 2020 — #27, #28, #29 e #32, tag `v0.4.4`; conferida no ar em 05/10 | ✅ | 05/10/2026 |
| G | 🔍 | Varredura: frontend — ledger com 25 itens, 7 FAZER (#39); os sete executados na G.3, com o portão (#41); a revisão do código da G.3 (G.3h, #42) com quatro consertos | ✅ | 13/10/2026 |
| H | 🔍 | Varredura: multiplayer — ledger com 14 itens, 3 FAZER (#44, 14/10); o H.1j no ar com o dono (o deploy perdia ~20 s); a H.3a–c com dois FAZER e o H.02 (#46); a H.3d — o H.13, FAZER por decisão do dono: a passagem de bastão entre instâncias (`0008` no #47, o código no #48, o aviso antes do fechamento no #49), provada no ar com 0 perdida (#50) — e a regra de merge virou "pode, mas não no meio de um combate" | ✅ | 16/10/2026 |
| I | 🔍 | Varredura: integração | ⬜ | — |
| J | 🔍 | Varredura: segurança | ⬜ | — |
| K | 🔨 | Profundidade de sistema | ⬜ | — |
| L | 🔨 | Performance e escala | ⬜ | — |
| M | 🔨 | Validação e encerramento | ⬜ | — |

### Linha de base atual

Atualizar ao fechar cada fase. É contra estes números que o passo 6 do ritual de abertura compara.

| Verificação | Ao fechar a H.3d.5 no código (15/10/2026) |
|---|---|
| Node | **24** (`.node-version`, o mesmo para o CI e o Render — R.8) |
| `npx tsc --noEmit` | 0 erros |
| `npx vitest run` | **842** testes, 63 arquivos *(522 ao fechar a D; +43 das R.1–R.6; +6 da R.16; +6 da R.10; +14 da R.11; +18 da E.3a–b; +42 da E.3c–e; +7 da F.0e; +11 da F.2; +2 da F.1; +73 do PR 3b: `theme-contrast` 41, `cn-theme` 21, `theme-motion` 8, `audit-colors` +3, e o `injury-rules` trocado; +1 da 01.10, `node-version` — **745** ao fechar a R e a F; +47 da G.3: `npc-armor` 14, `double-click` 7, `room-modals` 6, `room-chat` 5, `stat-input` 6, `cyberware-humanity` 9; +4 da G.3h: `room-modals` 3, `cyberware-humanity` 1 — **796** ao fechar a G; +9 da H.3: `room-refresh` 4, `room-transport` 5 — **805**; +36 da H.3d: `instance-lease` 18, `room-persistence` 7, `server-handoff` 6, `api-restart` 3, `room-transport` 2 — **841**; +1 da H.3d.5: `room-transport` 1)* — `vitest` 4.1.11 |
| `npm run test:e2e` | **7/7** (Playwright) — 2 da ficha ajustados na D.3 para a trilha em pontos; +1 da F.0d (`fonts-csp`: CSP de produção e fontes carregadas) |
| `node scripts/test-ws-e2e.mjs` | 5/5 contra o build de produção (o smoke do CI) |
| `node scripts/test-rls.mjs` | **63/63** na H.3d.1 (15/10/2026: +7 da `instance_lease` — anon e authenticated negados, a service role lê e escreve). Eram 56/56 na Fase B, sem rodar na C nem na D (nenhuma das duas mexeu em schema nem RLS) |
| `npm run audit:ci` | passa, **ALLOWLIST vazia**, e `npm audit` com **0** vulnerabilidades (R.7: `express@4.22.3`, `qs@6.16.0`; 10/10: `proxy-addr@2.0.8`, `source-map-js@1.2.2`, alertas do dia) |
| Chunk de entrada | 629 kB / 186 kB gzip; CSS 115 kB / 16,8 kB gzip *(PR 3b — a paleta padrão saiu com a F.2.10)* |
| Fontes (F.0c, F.1.3, F.4.3) | Rajdhani **400 e 700**, Share Tech Mono 400 e Orbitron variável — `woff2` do subconjunto `latin`, ~12–16 KB cada, servidos pelo próprio origin |
| `node scripts/multiplayer/h1a.mjs` | A mesa de base da H.1a (14/10/2026): três contextos, do zero ao combate, **0** erro de console; um chat custa **6,7 KB** por aba, o ataque mais o dano **~52–72 KB** (depende de o ataque do NPC ferir), 45 s parada **0,5 KB**; a sala no fim, **~17 KB**. Rodada de novo ao fechar a H.3: os mesmos números. `npm run build` antes; sobe o próprio servidor |
| `node scripts/multiplayer/h1j.mjs` | **No ar, só combinado com o dono** (14/10/2026): o deploy com a mesa aberta deixou as duas instâncias vivas **~20 s**; o despertar da hibernação, **~22 s**. **O ensaio local** (`H1J_LOCAL=1`, com o Supabase local; `H1J_SWITCH_DELAY_S=5` imita o Render da H.3d.0) com o bastão da H.3d, 15/10: **0** mensagem perdida e **6,1 s** de "reconectando" (o código de antes perdia 1) |
| `node scripts/visual/tipografia.mjs` | ✅ 0 negrito sintético e 0 texto abaixo de 10 px, em 12 telas *(precisa do `netsheet-prod` recém-subido)* |
| `npm run audit:colors` | **0** a migrar, e **o CI exige** (F.2.10) — era 1.879 na F.0e e 322 depois da F.2 mecânica. 107 `black`/`white`, à parte. Uma exceção nomeada (o hex do campo `color` do token do grid, sem leitor) |
| `npx tsx scripts/migrate-colors.ts --conflitos` | **0** conflitos de cor no mesmo elemento (eram 19 — F.2.4), e **o CI exige** (F.2.10) |
| Mono com negrito (`audit:colors`, coluna `mono+b`) | **0** (F.1.2) — e 0 no navegador, em 12 telas |
| Migrations em produção | `0001`–`0007` *(a D não teve migration)* |

**Operação:** o `SUPABASE_ACCESS_TOKEN` do CI **vence por volta de 25/10/2026** (validade de 30 dias).
Renovar até 22/10 — passo a passo no P.2.

**10/10/2026 — produção conferida, e o bloco R fechado.** O Node é o 24 — o do `FROM` do
`Dockerfile`, porque o serviço é Docker —, a `TRUST_PROXY` confia nos privados e no Cloudflare (o valor
no [`DEPLOY.md`](./DEPLOY.md#variáveis-de-ambiente)), e o serviço voltou a hibernar sem o monitor. As
notas de 01/10 e 05/10 que viviam aqui estão no checklist do R.15, em
[`historico/AUDITORIAS_E_PENDENCIAS_R.md`](./historico/AUDITORIAS_E_PENDENCIAS_R.md). Depois de cada
deploy: `node scripts/verify-prod.mjs` — uma requisição por passo, **nada de monitor** (regra 3).

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
| `sse_fallback` | L.6 — manter ou remover o SSE | Decide com a contagem acumulada. **Ressalva (E.14, 30/09):** até a H.1g consertar o cliente, a contagem inclui queda de rede e restart do servidor, não só proxy que bloqueia WebSocket — anotar o *user agent* e a hora, para separar depois. *Consertado na H.3b (14/10/2026): depois do deploy dela, só conta quem nunca conectou* |
| `gemini_api_error` | [ADR 0005](./adr/0005-provedor-de-ia.md) — Groq / `AI_MODEL` | `429`, cota esgotada ou modelo recusado |
| `ws_rate_limited` | L.1 antecipada (risco 3 do custo zero) | Aparecer numa sessão real |
| `unhandled_error` *(E.13)* | Um bug chegou ao usuário como `500` | **Qualquer** ocorrência — investigar na hora |
| `persistence_save_failed` *(E.13)* | Estado da mesa que não chegou ao banco; em sequência, o E.15 (retry sem espaçar) | Uma sequência de linhas: o banco esteve fora |
| `rooms_full` *(E.03)* | E.25 — criar sala exigir login | Aparecer sem o dono ter criado as salas |
| `sse_fallback` no mesmo minuto de um `lease_released` *(H.3d)* | H.14 — quem entra na mesa na janela da troca cai no SSE | Uma vez, numa sessão real |
| `lease_forced`, `lease_unavailable`, `lease_orphaned_exit` *(H.3d)* | [ADR 0007](./adr/0007-passagem-de-bastao.md) — rever a passagem de bastão | **Qualquer** ocorrência fora de um teste: a troca saiu da borda prevista |

**A primeira sessão não espera a M.2.** Desde as R, a mesa aguenta uma sessão em produção; a H, a
L.0, a L.1, a L.6 e as estimativas do custo zero dependem desta tabela, e ela está vazia. Jogar cedo
é o insumo mais barato do plano — a M.2 continua sendo a sessão de encerramento.

| Data | Jogadores × horas | Eventos-gatilho no log (a contagem de cada evento da tabela acima) | Horas e banda do NetSheet no painel do Render | Observação |
|---|---|---|---|---|
| — | — | — | — | *nenhuma sessão em produção ainda* |
