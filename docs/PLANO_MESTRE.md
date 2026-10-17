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
      algum gatilho disparou desde a última sessão? *(A lista inteira, com o gatilho de cada um, está no
      [bloco Q](#bloco-q--quitar-os-adiar--1015-dias-estimativa-grosseira-que-a-q0-refaz--depois-da-l-antes-da-m) — decisão 12.)* Um gatilho que disparou vira trabalho da fase
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
      mudou, e a tabela de progresso no fim deste arquivo. **Todo ADIAR novo da fase entra na lista do
      [bloco Q](#bloco-q--quitar-os-adiar--1015-dias-estimativa-grosseira-que-a-q0-refaz--depois-da-l-antes-da-m)**,
      com o gatilho e a fonte (decisão 12).
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
02/09; 4 em 03/09; 5 em 25/09; 6 em 26/09; 7 em 28/09; 8 em 29/09; 9, 10 e 11 em 30/09; 12 em 16/10/2026.)*

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
| 12 | ADIAR é esquecimento ou ordem? *(16/10/2026, nas palavras do dono: "não quero perder eles no futuro pois quero consertar tudo e fazer tudo do plano")* | **Ordem.** O filtro de necessidade continua decidindo **quando**: nas varreduras, ADIAR segue como veredito padrão, e o FAZER da fase corrente ainda exige sintoma. Mas **nenhum ADIAR sai do plano**: todos são quitados no **bloco Q**, depois da L e antes da M. Na Q, o veredito padrão se inverte, e todo item é FAZER, a não ser que o dono escreva DESCARTAR | A [Q](#bloco-q--quitar-os-adiar--1015-dias-estimativa-grosseira-que-a-q0-refaz--depois-da-l-antes-da-m) lista cada ADIAR em aberto (78 em 16/10) com o gatilho e a fonte, e o ADIAR novo de cada fase entra nela no fechamento (passo 2 do ritual de encerramento). A M.3 passa a conferir a Q, e o grep da M.0 inclui o `historico/`, onde seis itens só existiam lá. Um gatilho que dispara antes da Q continua virando trabalho da fase corrente. O que esbarra num invariante (o PITR pago, o PDF, a Net jogável, o login, o site fora do Render) vai ao dono na Q.0b, com uma opção recomendada |

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
| **ADIAR** | Veredito padrão | **Exige gatilho escrito** ("quando a mesa passar de 6 jogadores", "quando alguém de fora entrar"). Sem gatilho plausível, é DESCARTAR disfarçado. *ADIAR é ordem, não esquecimento: todo ADIAR em aberto é quitado no bloco Q, antes da M (decisão 12)* |
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

*(16/10/2026 — **lido na I.1e**, no painel, com a sessão do dono: **o painel não separa as horas por
serviço**, só a banda. O workspace somava **196,12 h** e **163 MB** em outubro; o NetSheet, **33 MB** de banda.
Perto de 120 h do total são do monitor até 05/10, e o resto não se divide entre os dois serviços — outubro não
decide, e o primeiro mês que se lê inteiro é novembro. O gatilho "o NetSheet acima de 100 h" lia um número que
não existe; **reescrito:** o total do workspace ("Billing" → "Free Instance Hours") acima de 100 h num mês sem o
monitor — e aí separar a parte do NetSheet pelas partidas no log (`server_started`) antes de decidir —, a
primeira sessão mostrar a espera do despertar como problema, ou a mesa abrir para gente de fora. E a I.1e mediu
o que entra junto quando disparar: o CORS barra os cabeçalhos do cliente, e o F5 e a IA param — o
[I.09](./varreduras/I-integracao.md#i09--com-o-site-fora-do-render-o-f5-e-a-ia-param-o-cors-não-libera-os-cabeçalhos-que-o-cliente-manda).)*

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
   *(16/10/2026, I.1e: o painel não mostra as horas por serviço. O gatilho passa a ler o total do workspace
   como teto — acima de 100 h num mês sem o monitor, separar a parte do NetSheet pelo log —, como o da regra 4.)*
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
número real. *(16/10/2026, I.1e: **por serviço, só a banda** — as horas são do workspace inteiro, na
página "Billing".)*

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
**2 da Fase E** (30/09), **1 da Fase I** (16/10) e **2 da Fase J** (17/10), no fim desta seção. IDs referenciados pelas fases.

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

### Fase I (1) — 16/10/2026

Achado da [varredura de integração](./varreduras/I-integracao.md), **reproduzido** e consertado num PR
próprio antes do ledger, como na E — detalhe e portão em
[`SEGURANCA.md`](./SEGURANCA.md#fase-i--varredura-integração).

| ID | Sev. | Achado | Fase |
|---|---|---|---|
| SEC-16 | 🟡 Médio | O `peerId` é escolhido por quem entra e ia cru no caminho do "Remover" do GM: com `/`, `..` ou `?`, o clique removia **outro** jogador, disparava outra ação de GM ou não achava a rota — o hostil ficava impossível de remover *(reproduzido)* | ✅ I.03 |

### Fase J (2) — 17/10/2026

Achados da [varredura de segurança](./varreduras/J-seguranca.md), **reproduzidos** e consertados num PR
próprio antes do ledger, como na E e na I — detalhe e portão em
[`SEGURANCA.md`](./SEGURANCA.md#fase-j--varredura-segurança).

| ID | Sev. | Achado | Fase |
|---|---|---|---|
| SEC-17 | 🟡 Médio | O awareness do Yjs (o cursor do GM) era repassado sem conferir quem escrevia nem a forma: um convidado publicava um cursor "Mestre" e, com um nome que não era texto, derrubava o app inteiro de quem estava no grid, a cada recarga *(reproduzido)* | ✅ J.04 |
| SEC-18 | 🟠 Alto | A memória do servidor sem teto por dois caminhos que a E.03 não cobriu: o repasse do awareness e do Yjs e as respostas do sync ignoravam o teto de 1 MiB (33 MB num socket parado), e o SSE aceitava streams sem conta (150 de um assento) — qualquer visitante, sem login, chegava aos 512 MB da instância *(reproduzido)* | ✅ J.08 |

---

## 🗂️ AS 13 FASES

**Esforço total: 30,5 a 38,5 dias de trabalho concentrado** *(mais 1,5–2,5 das pendências R, da
revisão pós-D, e 10–15 do bloco Q, que quita os ADIAR — decisão 12)* — quatro a sete meses de calendário para
quem tem outra ocupação. Ponto de corte natural: **fechando A–D o jogo já roda certo**; F entrega a
identidade visual nova; e as varreduras viram manutenção de fim de semana.
*(Revisão de robustez, 29/09/2026: o que resta, de E a M, soma **18,5–23,5 dias** pelas estimativas
das próprias fases — e duas estão curtas: a K com a Net inteira (ver K.0) e a L com o broadcast por
diferença (ver L.0).)*

Legenda: 🔨 construção · 🔍 varredura (filtro de necessidade obrigatório)

---

### Fases fechadas — A, B, P, C, D, R, E, F, G e H

O detalhe de cada item — verificações, provas revertendo, decisões e achados — mora em
[`historico/`](./historico/), movido para lá **sem mudar o texto** pela R.13: A–D e P em 29/09/2026
([`FASES_A-D.md`](./historico/FASES_A-D.md)); o bloco R, com as duas auditorias, e a Fase F em
10/10/2026 ([`AUDITORIAS_E_PENDENCIAS_R.md`](./historico/AUDITORIAS_E_PENDENCIAS_R.md),
[`FASE_F.md`](./historico/FASE_F.md)); e as varreduras E, G e H em 16/10/2026, no terceiro corte, pelo
mesmo método ([`FASE_E.md`](./historico/FASE_E.md), [`FASE_G.md`](./historico/FASE_G.md),
[`FASE_H.md`](./historico/FASE_H.md)). Com eles aqui, o plano passava do que a ferramenta do Claude lê
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
| [E — Varredura do backend](./historico/FASE_E.md#fase-e---varredura-backend-12-dias) | 24 itens, 6 FAZER: SEC-14 (grid malformado derrubava o processo) e SEC-15 (tetos: 30 salas, 32 NPCs, ficha de 64 KB, chat de 100, socket que não lê), todo erro da API com `code` (`server/errors.ts`), a iniciativa que não pula a vez, o horário do chat no fuso de Brasília; o mapa de cortes que a L.3 usa | 30/09/2026 | — · #22–#24 |
| [F — Identidade Cyberpunk 2020](./historico/FASE_F.md#fase-f--reestruturação-visual-identidade-cyberpunk-2020--455-dias--era-4-refeita-no-f0a-30092026) | Fontes auto-hospedadas (o bug do CSP), tokens de cor por papel com o CI exigindo zero cor à mão, tipografia em três vozes, vermelho só dano, acessibilidade do WCAG 2.2 (movimento finito, contraste, modais, alvo de toque) | 05/10/2026 (construção 30/09) | `v0.4.4` · #27–#29, #32 |
| [G — Varredura do frontend](./historico/FASE_G.md#fase-g---varredura-frontend-12-dias) | 25 itens, 7 FAZER: armadura nos quatro membros do NPC gerado, clique duplo que não repete a ação (`useInFlight`), o "Remover" do GM, os modais que leem o jogador da sala, o chat que acompanha a mensagem nova, o atributo gravado como digitado, a perda de Humanidade pela fórmula do implante; a revisão G.3h, com quatro consertos | 13/10/2026 (código 11/10) | — · #39, #41, #42 |
| [H — Varredura do multiplayer](./historico/FASE_H.md#fase-h---varredura-multiplayer-2-dias) | 14 itens, 3 FAZER, com os roteiros de `scripts/multiplayer/`: o F5 volta ao mesmo assento (`/room/CÓDIGO`), a queda de rede volta ao WebSocket em vez do SSE, e a passagem de bastão entre instâncias no deploy (`0008`, ADR 0007), provada no ar com 0 perdida; a regra de merge virou "pode, mas não no meio de um combate" | 16/10/2026 (código 15/10) | — · #44, #46–#50 |

> **Ponto de corte:** com A–D fechadas o jogo roda certo; com a R, roda certo **em produção** (sem ela,
> qualquer participante tomava o GM, apagava a mesa ou gastava a banda do workspace); com a F, tem a
> identidade nova. O que resta — a varredura J, a K, a L e a M — é manutenção e profundidade. *(A I
> fechou em 16/10/2026; o detalhe dela segue logo abaixo, até o próximo corte para o `historico/`.)*

---

### FASE I — 🔍 VARREDURA: INTEGRAÇÃO BACKEND ↔ FRONTEND *(1–2 dias)*

Escopo: `src/api/*` contra os endpoints do Express — a costura que nenhuma das varreduras anteriores
olha, porque cada lado parece correto sozinho.

Segue o [roteiro de uma varredura](#o-roteiro-de-uma-varredura).

- [x] **I.0** 🔍 **Premissas** — medidas em 29/09/2026:
      *(16/10/2026 — conferidas contra o `master` em `8dd74da`, no [ledger](./varreduras/I-integracao.md#i0--as-pistas-medidas-em-16102026):
      **todas bateram**, e a do `RollResult` estava resolvida desde a C (uma interface, dois carimbos sobre o
      mesmo `RollCore`). Caiu uma premissa do plano, de configuração: **o painel do Render não mostra as horas
      por serviço** — só do workspace —, e o gatilho da regra 4 e do risco 1 foi reescrito (I.09). E a linha de
      base ainda dava as migrations até a `0007`.)*
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
- [x] **I.1** Varredura por área → ledger em `docs/varreduras/I-integracao.md`. *(16/10/2026 — 9 itens, numa
      sessão: leitura das duas pontas, o `supertest` contra o `app`, um Chromium para o CORS e o painel do
      Render, com a sessão do dono, só leitura.)*
  - [x] **I.1a Inventário de rotas.** Uma linha por endpoint: quem chama no cliente, tipo de request e
        response compartilhado ou escrito duas vezes à mão, códigos de erro tratados. *Se eu mudar este
        endpoint, o TypeScript me avisa no cliente — ou descubro em produção?*
        *(16/10/2026 — 23 rotas e o WebSocket; as 21 chamadas do `api/rooms.ts` batem com o servidor, campo
        a campo. A resposta é **pela metade**: a resposta divide os tipos, o corpo do pedido não (I.02,
        ADIAR, gatilho a L.1). **A rota do modificador do GM não tem chamador** — a C.4 ligou só a leitura
        (I.01, ADIAR, perto da linha). Duas portas sem chamador (I.04, ADIAR), três documentos errados
        (I.05, FAZER, documento) e **um achado de segurança, o SEC-16 (I.03)** — o `peerId` de um convidado
        desviava o "Remover" do GM —, consertado antes do ledger no #54.)*
  - [x] **I.1b Erros.** Todo estado de erro do servidor tem estado de UI? O cliente decide por `code`
        ou por texto? *Referência:* a [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) (`type`,
        `title`, `status`, `detail`). Pelo filtro, a RFC inteira só com sintoma que o `code` não resolva.
        *(16/10/2026 — **nunca pelo texto**: três `code` e o status 401. Os 26 `code` chegam à tela pelo texto,
        menos três caminhos do REST que engolem o erro (I.06, ADIAR). A RFC: nenhum sintoma. O G.08 e o G.10
        olhados — seguem ADIAR.)*
  - [x] **I.1c Sessão.** O que o usuário vê quando o token expira ou é revogado no meio da sessão (401)?
        *(16/10/2026 — a sessão não expira; o 401 só nasce de revogação, e cada uma das quatro portas tem
        tela, menos a do H.05, que já é ADIAR. A expulsão no ar não depende do 4400: o heartbeat pelo REST
        acha o 401 em até ~20 s. Sem item novo.)*
  - [x] **I.1d Transporte.** `apiFetch` / `authedFetch`: timeout, retry e a restrição da hibernação
        acima.
        *(16/10/2026 — sem timeout, e certo: o Render acorda em ~22 s medidos (I.07, DESCARTAR). Um retry
        só, o `503 server_restarting`, que garante que nada foi feito; repetir erro de rede repetiria dano
        (I.08, DESCARTAR).)*
  - [x] **I.1e Cross-origin** (`VITE_API_URL` → `ws`/`wss`, `CORS_ORIGINS`, o `connect-src` do CSP).
        **Condicional:** se a regra 4 continuar sem dono, o veredito natural é ADIAR com o gatilho dela.
        *(16/10/2026 — a regra 4 segue sem gatilho disparado, e o gatilho não se lia: o painel só dá as horas
        do workspace (196,12 h em 16/10, ~120 delas do monitor até 05/10; a banda do NetSheet, 33 MB). **Com
        o site em outra origem, o CORS barra o `X-Session-Token` e o `Authorization`** — o F5 e a IA param,
        reproduzido num Chromium (I.09, ADIAR, gatilho reescrito; a linha é a primeira da I.1e quando
        disparar). O `DEPLOY.md` corrigido (I.05).)*
- [x] **I.2** Calibragem e PR do ledger — passo X.2.
      *(16/10/2026 — calibragem: **2 FAZER em 9, 22%**; a primeira contagem deu 4 em 11 (36%), e a repassada
      juntou as correções de documento sem mudar veredito de código. Destacado ao dono: o **I.01** (ADIAR). O
      achado de segurança (I.03, **SEC-16**): o dono escolheu consertar antes do ledger, como na E — o **PR #54**,
      com o portão no `SEGURANCA.md`; o ledger, no **PR #53**, empilhado nele. Mergear o #54 primeiro.)*
      *(16/10/2026, 19:27 — os dois mergeados juntos, o #53 levando os commits do #54; o `master` verde nos quatro
      jobs depois deles, com o `db-sync` em dia (a I não teve migration). **O merge aprovou os veredictos como
      estavam:** o I.01 segue ADIAR, com o gatilho do ledger.)*
- [x] **I.3** Executar só os FAZER — passo X.3.
      *(16/10/2026 — os dois FAZER já foram: o I.03 no #54 (antes do ledger, com o teste escrito antes e a prova
      revertendo) e o I.05 no próprio #53. Se o merge do #53 aprovar os veredictos como estão, a I.3 não tem mais
      nada; se o dono virar o **I.01** para FAZER, ele é a I.3.)*
      *(16/10/2026 — **vazia**: o merge aprovou os veredictos como estavam, e o I.01 ficou ADIAR.)*
- [x] **I.4** 🔒 Portão, se a I.3 mudou código — passo X.4.
      *(16/10/2026 — o do SEC-16 está respondido no [`SEGURANCA.md`](./SEGURANCA.md#fase-i--varredura-integração),
      no #54.)* *(A I.3 não mudou código: uma linha no registro diz isso. O único código da I é o do SEC-16.)*
- [x] **I.5** 🧠 Estado durável — passo X.5.
      *(16/10/2026 — no `master` em `b6b48f9`, depois dos dois merges: caixas, ledger e registro de segurança;
      linha de base (**868** testes, 65 arquivos — o +26 da I é o SEC-16); E2E 7/7; o smoke de WebSocket 5/5 contra o
      build de produção; RLS 63/63; `audit:ci` limpo; cores e conflitos em 0. Documentos que a I tornou falsos: a
      contagem de testes do `CLAUDE.md` e o "ponto de corte" das fases fechadas, que ainda dava a I como pendente. A
      forma do sistema não mudou — sem diagrama. **Falta:** o merge do PR do fechamento, o **#55**, e o `master` verde
      depois dele.)*
- [x] ✅ **Fase I concluída em:** 16/10/2026 *(o código, o SEC-16, no #54; o ledger no #53)*

> ***Fase I fechada em 16/10/2026.*** *A próxima é a **Fase J** — a varredura de segurança —, começando pela J.0.
> A I deixa para ela as respostas e a premissa velha do fim do [I.2 do ledger](./varreduras/I-integracao.md#i2--calibragem).*

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

> ⏸️ ***17/10/2026, terceira sessão: a J.2, a J.3 e a J.4 feitas.*** *O #58 (SEC-17 e SEC-18) e o #59 (o ledger)
> entraram, e o merge manteve os vereditos. A J.3 — a allowlist do gitleaks ancorada (J.11) e os dois comentários
> do J.01 — vai num PR próprio, o **#60** (`claude/j3-gitleaks`), com o portão no `SEGURANCA.md`. O próximo item é a **J.5**:
> conferir que esse PR entrou e o `master` ficou verde — o primeiro run do gitleaks com a allowlist nova —, e o
> estado durável da fase (a linha de base, o E2E, a tabela do fim do plano, os ADIAR novos da J na lista do bloco
> Q). Durante a J, a linha de base é **881** testes em 69 arquivos (+11 do SEC-17/18, +2 do J.11); a tabela do fim
> do plano muda na J.5. Uma pista da J.1d saiu da J na primeira parada — a nota está nela.*

- [x] **J.0** 🔍 **Premissas** — medidas em 29/09/2026:
      *(17/10/2026 — conferidas contra o `master` em `954ef0e`, no [ledger](./varreduras/J-seguranca.md#j0--as-pistas-medidas-em-17102026):
      a linha de base bateu (868 em 65, RLS 63/63). **Caiu uma:** as 56 de RLS são 63 desde a `0008` e rodam,
      e o número velho foi corrigido aqui e no `SEGURANCA.md`. As outras premissas bateram, com linhas novas.
      O **E.22 ainda vale depois do SEC-16**, reproduzido: o formato novo do `peerId` aceita `__proto__`, o
      `join` o recusa por acaso, e duas rotas do GM dão 500. Três pistas novas foram para as áreas: o
      `roomCode` cru nas URLs do SSE e do WebSocket (J.1b), o comentário do `ci.yml` sobre o gitleaks em todo
      branch (J.1f) e o coletor de salas que não fecha os sockets (J.1e). O OWASP API Top 10 de 2023 ainda é
      a edição vigente.)*
      - O gitleaks do CI **já** varre o histórico (`fetch-depth: 0`) — conferido na revisão pós-D.
      - O CSP segue com `connect-src 'self' ws: wss: https:` (`server.ts:175`, depois da E).
      - ~~As 56 de RLS **não rodam desde a B** — exigem o Supabase local, e o Docker desta máquina falha
        no arranque (contorno no [`BACKUP.md`](./BACKUP.md)).~~ *São **63** desde a `0008` (H.3d.1), e
        rodaram em 15/10, 16/10 e 17/10 — a I deixou a premissa para a J.0 medir.*
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
- [x] **J.1** Varredura por área → ledger em `docs/varreduras/J-seguranca.md`. *(17/10/2026 — 13 itens, numa
      sessão: leitura das duas pontas, reprodução no build de produção local com o GM no navegador do app e um
      convidado num script, medição de memória com o `app` num servidor local, a API do GitHub e o código do
      gitleaks, e o painel do Render com a sessão do dono, só leitura.)*
  - [x] **J.1a Registro do portão** em [`SEGURANCA.md`](./SEGURANCA.md#registro-por-fase): toda fase — e
        toda varredura que mudou código — respondeu as seis perguntas? Alguma resposta envelheceu?
        *(17/10/2026 — **todas responderam**, e os cinco PRs fora das fases que mexeram em código não tocam a
        superfície. Os números do registro batem com o código. Envelheceram duas respostas — o log do Actions
        "privado", e o rate limit sem a IA e sem a `TRUST_PROXY` (J.01, FAZER, documento, neste PR) — e a do
        SEC-15, que só valia no reenvio da sala (J.08).)*
  - [x] **J.1b Tabela de superfície:** cada endpoint REST, cada tipo de mensagem do WebSocket e o
        quadro Yjs × autenticado? autorizado? entrada validada? saída filtrada? Uma linha por rota, sem
        exceção.
        *(17/10/2026 — 19 linhas de REST e 9 de WebSocket e Yjs no ledger. A única entrada sem conferência de
        autor nem de forma era o **awareness** do Yjs (J.04). O E.21 segue sem gatilho: o `create` responde
        "existe" sob o mesmo limitador do `join`. As duas pistas de caminho e URL — o código da sala cru (J.02) e
        o `avatarUrl` livre (J.03) — DESCARTAR: nenhum leitor que as torne perigosas.)*
        - *Da E (30/09):* a ficha de todo **NPC vai a todos os jogadores** no reenvio (E.20 — a saída não
          é filtrada por papel); e há leitura que responde "esta sala existe?" sob o limitador **global**,
          não o do `join` (E.21 — a conta da R.11 fica 5× otimista, e segue em anos). Os dois ADIAR, com
          gatilho no [ledger](./varreduras/E-backend.md).
  - [x] **J.1c Credenciais:** toda emissão — `create`, `join`, *upgrade* do WebSocket, JWT do Supabase
        — e o que quem recebe prova. *(A lição do SEC-07.)*
        *(17/10/2026 — sem item novo; a tabela das sete emissões está no ledger. Não medido: o Auth do Supabase
        **no ar** (o login anônimo, a confirmação de e-mail) — o `config.toml` é o local; o dono confere no
        painel.)*
  - [x] **J.1d Entrada:** todo campo que entra em `sheet`, `gridState`, `initiativeList` e no protocolo
        Yjs — **o binário Yjs é entrada de usuário** e tem try/catch e o teto de 1 MiB (R.4).
        *(17/10/2026 — **o SEC-17 (J.04)**: o awareness do Yjs era repassado sem conferir quem escrevia nem a
        forma; reproduzido — um convidado derrubava o app de quem estava no grid —, e consertado antes do
        ledger. O E.22 segue ADIAR, sem gatilho. O quadro de texto de 1 MiB no `JSON.parse` (J.05): DESCARTAR.)*
        - *Da E (30/09):* a **forma** do `gridState` e do update Yjs passou a ser conferida (SEC-14) — a J
          confere se há outra porta sem forma. E ids como `__proto__` acham o protótipo de `players`/`npcs`
          (E.22, ADIAR: hoje só o GM chega, e o `join` os recusa por acaso).
        - *Tirada da J em 17/10/2026:* a medida da pista **chave fora do grid no doc Yjs** ficou para o dono. A
          análise dela foi barrada duas vezes pelo classificador de segurança do assistente, e uma sessão não
          deve tentar de novo, nem trocando de modelo. Sem sintoma medido, o veredito é o padrão, **ADIAR**: a
          pista não trava a J.1d e entra na lista do bloco Q no fechamento da J (decisão 12; só o dono a tira
          de lá, com DESCARTAR). **Gatilho:** o dono rodar a sonda local
          (`npx vitest run src/__tests__/zz-j-probe.integration.test.ts` — arquivo não rastreado, não commitar)
          e trazer o número para o ledger.
  - [x] **J.1e WebSocket**, pela [folha da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html):
        *(17/10/2026 — **o SEC-18 (J.08)**: o teto de 1 MiB da E.03 só valia no reenvio da sala, e o SSE não
        tinha teto de streams por jogador; medido — 33 MB num socket parado, 150 streams de um assento —, e
        consertado antes do ledger. O `Origin`: **decisão registrada** no "O que já está no lugar" do
        `SEGURANCA.md`. O token na URL (J.06) e o coletor que não fecha os sockets (J.07): ADIAR. Os *Request
        logs* do Render exigem o plano Pro.)*
        - o *upgrade* não confere `Origin`; o que protege de *cross-site WebSocket hijacking* é o token
          ir na query e não em cookie — registrar como decisão, não como acaso;
        - o token na URL: onde a URL do *upgrade* aparece em log (nosso e do Render)?
        - sessão revogada fecha o socket? A R.3 fez isso para a expulsão; e as outras revogações?
        - *backpressure*: cliente lento acumulando reenvios da sala no buffer (liga com a E.1b).
          *(E.03, 30/09: reproduzido — o heap crescia linear — e fechado **por socket**, 1 MiB. Falta o
          teto **global** de sockets: E.24, ADIAR, gatilho de memória no painel do Render.)*
  - [x] **J.1f Configuração e cadeia:**
        *(17/10/2026 — **a allowlist do gitleaks pula os workflows** (J.11, FAZER na J.3): o `\.git` é testado
        sem âncora e casa com `.github/`. O CSP amplo (J.09), o bucket do avatar listável e sem conta de
        uploads (J.10), o bundle à mão (J.12) e os alertas do Dependabot desligados (J.13): ADIAR. A proteção
        de push do GitHub está ligada.)*
        - CSP: `connect-src https:` e `img-src https:` são amplos; apertar para os origins reais.
        - RLS: re-rodar as ~~56~~ 63 e conferir as políticas de storage de avatar. *(J.0, 17/10: 63/63, e
          o storage está na suíte — a J.1f confere o que ela não cobre.)*
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
  - [x] **J.1g ADIAR herdados:**
        *(17/10/2026 — os dois seguem ADIAR, sem gatilho. A variante do *handle* ganhou uma segunda porta: com o
        `gmPeerId` vazio, um jogador **já sentado** que renomeia a ficha com o *handle* do GM vira GM pelo
        `checkIsGm`. O conserto, quando vier, cobre as duas.)*
        - **Sair e voltar "curado"** (D.9, 28/09): o `leaveRoom` apaga o registro do jogador, e a volta
          é um join novo, que aceita o ferimento da ficha do cliente. A decisão 7a fechou a sincronia e
          a reconexão, não essa porta. **Gatilho:** um jogador aparecer inteiro depois de sair no meio
          de uma luta. *(O segundo gatilho — público fora dos convidados — a R.11 fechou em 29/09. A
          versão maior da R.1, assento por conta, fecha esta porta.)*
        - A variante do SEC-07 pelo *handle* do GM (R.1).
- [x] **J.2** Calibragem e PR do ledger — passo X.2, com a exceção do repo público levada a sério: na
      J, quase todo FAZER é achado aberto.
      *(17/10/2026 — calibragem: **4 FAZER em 13, 31%**; nenhum veredito mudou na repassada. Destacados ao dono:
      o **J.07** e o **J.10** (ADIAR). Os dois achados de segurança (J.04 — **SEC-17**; J.08 — **SEC-18**): o dono
      escolheu consertar antes do ledger — o PR de segurança é o **#58** (`claude/j-seguranca`), e o do
      ledger, o **#59** (`claude/j-areas`), empilhado nele. **Falta:** o merge dos dois, o de segurança primeiro, e o `master` verde.
      Se o merge aprovar os veredictos como estão, a J.3 é o J.11 e os dois comentários do J.01.)*
      *(17/10/2026 — o #58 e o #59 mergeados, nessa ordem (o run do #58 no `master` foi cancelado pela concorrência
      do CI; o do #59 cobre o mesmo código); o `master` verde nos quatro jobs em `8d4de6c`, com o `db-sync` em dia (a
      J não teve migration), e o keepalive verde. **O merge aprovou os veredictos como estavam:** o J.07 e o J.10
      seguem ADIAR, com o gatilho do ledger.)*
- [x] **J.3** Executar só os FAZER — passo X.3.
      *(17/10/2026 — os dois que sobraram, um commit cada. **O J.11:** todo padrão de caminho da allowlist do
      `.gitleaks.toml` ancorado (`^\.git/`, `^dist/`, `^node_modules/`, `^package-lock\.json$`…), e o
      `gitleaks-allowlist.test` (2), escrito antes, confere contra o `git ls-files` que só fica de fora o que deve —
      e que o que deve ficar de fora fica. **Provado revertendo:** com a allowlist antiga, o teste lista os 7
      arquivos do ledger (os dois workflows, o `.gitleaks.toml`, o hook, o `.gitattributes` e os dois `.gitignore`)
      e os 4 de exemplo; tirada uma âncora por vez, cada uma derruba o seu caso; âncora demais (`^\.git$`) e o
      lockfile tirado derrubam o segundo teste. O histórico dos 7 (17 commits) não tem texto com cara de token além
      da anon key liberada — esta máquina não tem o binário do gitleaks, e o primeiro run do CI com a allowlist nova
      é a medida nele. **Os comentários do J.01:** o `ci.yml` e o cabeçalho do `.gitleaks.toml` dizem que o
      gitleaks roda em todo PR para o `master` e no push ao `master`, e que branch sem PR conta só com a proteção
      de push do GitHub (`enabled`, relida pela API no dia). O J.01 e o J.11 marcados no
      [ledger](./varreduras/J-seguranca.md#j11--a-allowlist-do-gitleaks-pula-os-workflows-do-ci). Linha de base:
      **881** testes em 69 arquivos (+2). No **#60**, com a J.4.)*
- [x] **J.4** 🔒 Portão, se a J.3 mudou código — passo X.4.
      *(17/10/2026 — os do SEC-17 e do SEC-18 estão no
      [`SEGURANCA.md`](./SEGURANCA.md#fase-j--varredura-segurança), no #58. **A J.3 mudou configuração do CI, não
      código do produto** — as seis perguntas sobre ela estão no fim da mesma seção: nenhuma entrada, dado ou
      autorização nova; o scanner passa a ler sete arquivos a mais. O "O que já está no lugar" diz quando o gitleaks
      roda e que a allowlist é ancorada.)*
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

### BLOCO Q — QUITAR OS ADIAR 🔨 *(10–15 dias, estimativa grosseira que a Q.0 refaz — depois da L, antes da M)*

*(Criado em 16/10/2026 pela [decisão 12](#-decisões-tomadas-02092026): o dono quer cada ADIAR feito, não
esquecido.)* Até aqui, um ADIAR esperava o sintoma, e sem sessão em produção quase nenhum gatilho dispara. Na Q
todos são quitados: **78 itens**, 26 com fase dona (a J, a K, a L ou a M) e 52 que só a Q faz, mais três decisões
do dono. **Por que depois da L:** a J, a K e a L são donas de 26 itens, e a L muda o código onde vivem outros (o
protocolo na L.1, os cortes na L.3, o ESLint na L.5). Fazer antes seria fazer duas vezes. **Por que antes da M:** a
M valida o produto inteiro e fecha o plano. Com a Q antes, a M valida também o que a Q fez.

**Como a Q funciona:**
- **Uma caixa por item**, com o gatilho e a fonte. O detalhe (sintoma, versão menor, linhas do código) fica no
  ledger ou no documento de origem. Ao marcar uma caixa, dizer onde o item foi feito (fase e PR).
- **O veredito padrão se inverte:** aqui, todo item é FAZER. Um item só sai da lista com um **DESCARTAR escrito
  pelo dono**, com o motivo, na própria caixa.
- Bug segue o X.3: teste que reproduz **antes**, prova revertendo, um commit por item. Regra segue a Fase C: a
  tabela e a [conferência](./CONFERENCIA_CP2020.md) com duas fontes (decisão 11).
- **Gatilho que dispara antes da Q** continua virando trabalho da fase corrente (passo 5 do ritual de abertura), e
  a caixa daqui é marcada com o lugar onde o item foi feito.
- **Todo ADIAR novo da J, da K ou da L entra nesta lista** no fechamento da fase dele (passo 2 do ritual de
  encerramento). Um corte do plano para o `historico/` não tira item daqui. ⚠️ marca os seis itens que só
  existiam no `historico/`, onde o grep da M.3 não procurava.
- **Fora da lista:** os cinco DESCARTAR dos ledgers (E.23, G.16, H.08, I.07, I.08), cada um com a razão escrita.
  Dois fariam mal: o timeout do I.07 quebraria o primeiro pedido depois da hibernação, e a repetição do I.08
  repetiria dano. Também ficam fora os cinco ADIAR que o gatilho já levou a trabalho: o E.06, o H.10 e o H.11 (na
  H.3d), o E.14 (na H.3b) e o H.02 (na H.3c).

- [ ] **Q.0** 🔍 **Premissas.**
      - Conferir esta lista contra `grep -rn ADIAR docs/ CLAUDE.md` **com o `historico/`** (fora, só o
        `docs/legacy/`) e contra os ADIAR que a J, a K e a L acrescentaram. O item que falta entra; o que sobra
        sai, com o motivo.
      - Marcar na Q.1 o que a fase dona já fez, com o PR.
      - Medir cada item contra o código do dia (linha, reprodução) e refazer a estimativa da Q.
- [ ] **Q.0b** 🧑‍⚖️ **Decisões do dono** — os itens que esbarram num invariante ou numa decisão já tomada:
      - **PITR do Supabase** (decisão 4): exige o plano Pro, e o custo zero é requisito duro. *(1,
        recomendada)* **DESCARTAR**: o dump manual da decisão 8 é o backup, e a restauração de teste (Q.1) prova
        que ele serve. *(2)* Pagar o Pro, o que muda o contrato de custo zero.
      - **O PDF oficial** (decisão 11; US$ 15 em 30/09). *(1, recomendada)* Comprar quando um item da Q.5 travar
        sem duas fontes: é o gatilho que já existe, e a Q.5 é onde ele mais provavelmente dispara. *(2)* Comprar
        já na Q.0, para fechar as Perguntas para o livro de uma vez. *(3)* DESCARTAR: o que as fontes não
        fecharem vira decisão do dono, item por item.
      - **A Net jogável na mesa** (decisão 9: mapa, turnos, fortalezas de dados, "meio jogo à parte"). *(1,
        recomendada)* **Fase própria, entre a Q e a M**, estimada na Q.0 com a K.5 (o netrunner na ficha) pronta.
        *(2)* Dentro da Q, que dobraria de tamanho. *(3)* Depois da M, fora do plano.
      - **Exigir login para criar mesa no servidor** (o E.25; decisão do dono de 30/09). *(1, recomendada)*
        Exigir: a tela já exige, e é o primeiro passo do **assento por conta** (Q.2), que fecha também o "sair e
        voltar curado". *(2)* Manter sem login e DESCARTAR o E.25.
      - **O site fora do Render** (a regra 4 do [custo zero](#-contrato-de-custo-zero) e o I.09). *(1,
        recomendada)* Fazer: no Vercel Hobby o custo medido é desprezível, e a lista do que muda já está na nota
        de 14/10. A origem nova não leva o `localStorage`, então é preciso avisar a mesa antes. *(2)* Manter no
        Render e DESCARTAR a regra 4 e o I.09.
- [ ] **Q.1** **Os que têm fase dona.** Quem faz é a dona; aqui só se confere, e o que ela deixar a Q faz. Os dois da
      M ficam para ela, e a Q só confere que estão lá. Fontes: os [ledgers](./varreduras/), a
      [conferência](./CONFERENCIA_CP2020.md) e as fases J, K, L e M acima.
  - [ ] **E.20**: a ficha de todo NPC vai a todos os jogadores. *Dona:* J.1b. *Gatilho:* um jogador espiar a ficha
        do NPC, ou a L.1 abrir.
  - [ ] **E.21**: "esta sala existe?" responde no ritmo do limitador global. *Dona:* J.1b. *Gatilho:* a mesa abrir
        para gente de fora, ou a J.1b achar outra leitura que responda existência.
  - [ ] **E.22**: ids como `__proto__` dão 500. *Dona:* J.1d. *Gatilho:* uma rota nova indexar `players`/`npcs`
        por id de quem não é o GM.
  - [ ] **E.24**: não há teto global de sockets. *Dona:* J.1e. *Gatilho:* a memória do serviço passar de ~400 MB,
        ou um reinício por falta de memória.
  - [ ] **Sair e voltar "curado"** (D.9): o `leaveRoom` apaga o jogador, e a volta aceita o ferimento da ficha do
        cliente. *Dona:* J.1g. *Gatilho:* um jogador aparecer inteiro depois de sair no meio de uma luta.
  - [ ] **A variante do SEC-07 pelo *handle* do GM** (R.1): o caso de quando o GM sai e ninguém fica online. *Dona:* J.1g.
  - [ ] **Actions fixadas por tag, não por SHA**, e o `supabase/setup-cli` em `latest`. *Dona:* J.1f. *Gatilho:*
        uma action usada aqui num incidente de cadeia de suprimento, ou o CLI `latest` quebrar o `db-sync`.
  - [ ] **I.01**: o modificador do GM não tem tela (a rota `/settings` não tem chamador). *Dona:* a K, que mexe nas
        rolagens. *Gatilho:* a primeira sessão em que o GM quiser um modificador de cena.
  - [ ] **G.05**: o mesmo ferimento tem dois nomes, às vezes no mesmo cartão. *Dona:* K.3. *Gatilho:* alguém da mesa
        confundir os nomes.
  - [ ] **I.06**: pelo REST, a rolagem e o chat perdem o erro que o WebSocket mostra, e a ficha que não sincroniza
        não avisa. *Dona:* K.2, que engorda a ficha. *Gatilho:* um `sse_fallback` de jogador de verdade.
  - [ ] **Cromo que soma atributo** (ex.: lace muscular): o `CyberwareItem` não tem campo de atributo. *Dona:* K.2.
  - [ ] **EV da armadura → REF** (RUL-11), que precisa de um modelo de peça. *Dona:* K.2.
  - [ ] **H.01**: na rede lenta, o jogador fica segundos atrás. *Dona:* L.1. *Gatilho:* atraso em rede móvel numa
        sessão, a banda acima de 2,5 GB no mês, ou um `ws_rate_limited`.
  - [ ] **G.19**: cada arrasto no grid regrava todos os tokens no Yjs. *Dona:* L.1.
  - [ ] **I.02**: o contrato de cada rota é escrito à mão dos dois lados. *Dona:* L.1. *Gatilho:* uma rota mudar de
        corpo e o cliente quebrar sem teste que pegue.
  - [ ] **I.04**: duas portas do servidor sem chamador; a leitura de existência sai com o E.21, e a mensagem
        `initiative`, com a L.1. *Donas:* J.1b e L.1.
  - [ ] **Compressão do WebSocket** (`perMessageDeflate`, o risco 2 do custo zero), com medição de memória antes.
        *Dona:* L.0 e L.1. *Gatilho:* a banda do workspace passar de 2,5 GB num mês.
  - [ ] **E.18** e **G.21**: os cortes dos arquivos grandes, no backend e no frontend. *Dona:* L.3.
  - [ ] **E.11**: `code.toUpperCase()` em 25 pontos, sem dono. *Dona:* L.3 (o `roomKey` vai para o módulo de
        salas). *Gatilho:* uma sala "não encontrada" por maiúscula ou espaço.
  - [ ] **E.16** (sete `any` no `server.ts`), **G.17** (doze `console.*` no cliente) e **G.18** (o "broadcast" das
        rolagens da ficha, sem ouvinte). *Dona:* L.5.
  - [ ] **E.05**: o `sseClients` guarda um `Set` vazio por sala, para sempre. *Dona:* L.6; o item some se o SSE sair.
  - [ ] **G.25**: as notas de versão chamam de atual a v0.4.0, do "Cyberpunk 2077". *Dona:* M.4.
  - [ ] **Restauração de teste do backup** (R.10), num projeto Supabase novo. *Dona:* M.0, que a exige antes do fim.
        *Gatilho:* a primeira linha do registro com `character_sheets` acima de zero.
- [ ] **Q.2** **Servidor e mesa.** Fontes: [`E-backend.md`](./varreduras/E-backend.md),
      [`H-multiplayer.md`](./varreduras/H-multiplayer.md) e onde cada item diz.
  - [ ] **E.04**: o servidor não detecta socket morto (sem ping/pong). *Gatilho:* a memória subir durante uma
        sessão, ou um socket fantasma num cenário de rede.
  - [ ] **E.08**: gravação em voo × sala encerrada: a sala pode voltar no boot. *Gatilho:* uma sala encerrada
        reaparecer depois de um restart.
  - [ ] **E.09**: o Render pode esperar o CI antes de publicar (é configuração no painel, que fica com o dono).
        *Gatilho:* código no ar antes da migration, ou um `master` vermelho publicado.
  - [ ] **A versão maior do E.10**: o chat manda o instante (ISO), e cada cliente formata no próprio fuso. Isso muda o
        formato persistido das mensagens. *Gatilho:* um jogador de outro fuso na mesa.
  - [ ] **E.12** e a [ADR 0005](./adr/0005-provedor-de-ia.md): o modelo de IA fixo no código, e o **Groq primário
        com o Gemini de fallback**, decidido e nunca implementado (a versão menor é o `AI_MODEL`). *Gatilho:* um
        `429`, a cota esgotada ou o modelo recusado no `gemini_api_error`.
  - [ ] **E.15**: a persistência tenta de novo a cada 2 s, para sempre, sem espaçar. *Gatilho:*
        `persistence_save_failed` em sequência no log.
  - [ ] **E.19**: "Remover NPC" apaga o token de um jogador, se receber o id dele. *Gatilho:* um token de jogador
        sumir do mapa sem ele sair.
  - [ ] **E.25**: criar sala não exige login no servidor (a decisão está na Q.0b). *Gatilho:* `rooms_full` no log
        sem o dono ter criado as salas, ou a mesa abrir para gente de fora.
  - [ ] **Assento por conta** (a versão maior da R.1): o assento ligado à conta do Supabase (JWT). Fecha também o
        "sair e voltar curado" e o H.05. *Gatilho:* a mesa exigir login (o E.25).
  - [ ] **H.04**: dois F5 seguidos, com o `join` do primeiro em voo, duplicam o assento. *Gatilho:* um assento
        duplicado ou um GM perdido depois de um F5 numa sessão.
  - [ ] **H.05**: a aba antiga vira outro jogador, em silêncio. O mecanismo é o mesmo do H.04, e um conserto serve aos
        dois. *Gatilho:* um assento duplicado por duas abas.
  - [ ] **H.06**: o GM que fecha a aba deixa a mesa sem Mestre para sempre. Foi o item mais perto da linha na H, e a
        versão menor é a credencial do GM no `localStorage`. *Gatilho:* um GM perder a mesa por fechar a aba.
  - [ ] **H.07**: o cargo de GM pode ir para uma ficha gerada. *Gatilho:* acontecer numa sessão, ou alguém mexer
        no T1.8.
  - [ ] **H.14**: quem entra na mesa na janela de um deploy cai no SSE. *Gatilho:* um `sse_fallback` no mesmo minuto
        de um `lease_released`.
  - [ ] ⚠️ **O `db-sync` e o keepalive, rodando juntos, derrubam a senha um do outro** (`28P01`). O conserto é um
        grupo de `concurrency` ou um retry no `scripts/supabase-ci.sh`; hoje existe só a regra "nunca disparar os
        dois à mão". *Gatilho:* um `28P01` num run que não foi disparado à mão. *Só estava no
        [histórico](./historico/FASES_A-D.md).*
- [ ] **Q.3** **Tela.** Fonte: [`G-frontend.md`](./varreduras/G-frontend.md), a não ser onde o item diz outra.
  - [ ] **G.01**: a ficha é espelhada na store durante o render do `App` (a versão de uma linha está no ledger).
        *Gatilho:* o aviso esconder um erro numa depuração, ou lentidão ao digitar na ficha.
  - [ ] **G.02**: no dev, o deep link volta para `/` (a versão de uma linha está pronta). *Gatilho:* precisar do HMR
        para depurar um refresh ou um deep link, ou o mesmo sintoma no build de produção.
  - [ ] **G.03**: trocar de ficha no meio da sessão leva o ferimento da mesa para a ficha nova. *Gatilho:* um
        jogador trocar de ficha numa sessão.
  - [ ] **G.08**: a tela diz "sincronizado" quando não está. *Gatilho:* a primeira ficha de jogador na nuvem
        (`character_sheets` acima de 0 no backup).
  - [ ] **G.09**: com uma fórmula de dano inválida, o botão não faz nada, e o parser da
        [ADR 0004](./adr/0004-dice-roller.md) não lê divisão. *Gatilho:* uma arma do livro com `1D6/2` numa ficha
        de verdade.
  - [ ] **G.10**: a rede de amigos não mostra erro, e o chat dela trava. *Gatilho:* alguém da mesa usar a rede de
        amigos e relatar.
  - [ ] **G.11**: o menu busca o perfil de novo a cada troca de aba. *Gatilho:* o egress do Supabase perto da cota,
        ou a rejeição sem tratamento aparecer no console.
  - [ ] **G.20**: não se sabe quais telas quebram sem ninguém ver, porque faltam testes de componente (ARQ-08).
        *Gatilho:* um defeito de tela chegar ao jogador sem teste que o pegasse.
  - [ ] **H.12**: a mesa não rola perícia nem a habilidade especial, e a ficha gerada guarda o atributo do ternário
        que a C.8 tirou. *Gatilho:* alguém pedir para rolar perícia na mesa. Fonte:
        [`H-multiplayer.md`](./varreduras/H-multiplayer.md).
  - [ ] ⚠️ **"Gerar NPC", "Gerar Jogador" e "Rolar iniciativa" sem a trava do `useInFlight`**: em dobro, sai um NPC
        ou uma ficha a mais, ou a iniciativa é rolada duas vezes. *Gatilho:* acontecer numa sessão. *Só estava no
        [histórico](./historico/FASE_G.md) (a revisão G.3h) e no `CLAUDE.md`.*
  - [ ] ⚠️ **A perda de Humanidade digitada aceita até 999**, e o `sheetSchema` a grampeia em 100 quando a ficha
        entra na mesa; a ficha local e a da mesa divergem. *Gatilho:* alguém digitar acima de 100. *Só no
        histórico (G.3h).*
  - [ ] ⚠️ **O cartão do token remonta ao trocar de token** (`key={token.id}`), e a trava de dano e ataque recomeça.
        *Gatilho:* o GM trocar de token e voltar no meio de uma resposta lenta. *Só no histórico (G.3h).*
  - [ ] **Faixas de perigo amarelo-e-preto** (`signal`) no turno do jogador e na sala em combate (a F.3.3, na
        [ADR 0006](./adr/0006-sistema-tipografico.md)). *Gatilho:* alguém perder a vez por não perceber que era o
        turno dele.
  - [ ] ⚠️ **Textura de impressão ou xerox** e aberração cromática sutil (F.3.5). *Gatilho:* o dono pedir, depois de
        ver a F no ar. *Só estava no [histórico](./historico/FASE_F.md).*
  - [ ] **A aba esquecida** (o risco 1 do custo zero): o heartbeat de 20 s mantém o serviço acordado mesmo com a aba
        em segundo plano. A versão menor é pausar com o `document.hidden` e fechar o socket depois de ~30 min com a
        aba oculta. *Gatilho:* o total do workspace acima de 100 h num mês sem o monitor, ou uma aba esquecida
        observada.
- [ ] **Q.4** **Acessibilidade.** Fonte: [`G-frontend.md`](./varreduras/G-frontend.md).
  - [ ] **G.13**: o perfil só abre com o mouse. *Gatilho:* alguém da mesa operar só pelo teclado.
  - [ ] **G.14**: botões e campos sem nome para o leitor de tela. *Gatilho:* alguém usar leitor de tela.
  - [ ] **G.15**: no grid, o token só anda com o mouse. *Gatilho:* o mesmo do G.13.
- [ ] **Q.5** **Regras do CP2020.** Fonte: a [conferência](./CONFERENCIA_CP2020.md). Cada regra precisa de duas
      fontes antes do código (decisão 11), e o teste deriva da tabela.
  - [ ] **O texto das tabelas de fumble**: hoje o dado sai rolado, e o GM lê o efeito no livro. *Gatilho:* o GM
        pedir o efeito impresso, ou uma sessão travar procurando a tabela.
  - [ ] **Humanidade de implante desinstalado**: o modelo não distingue o nunca instalado do removido, e o EMP soma
        todo implante da ficha. *Gatilho:* o EMP cair por um cromo que o jogador não tem.
  - [ ] **Perda de Humanidade fracionária**: o NetSheet guarda a perda inteira, e a diferença chega a meio ponto por
        implante. *Gatilho:* um implante de custo fracionário numa ficha de verdade.
  - [ ] **Empate na iniciativa**: nenhuma fonte trata, e fica a ordem da rolagem. *Gatilho:* a mesa pedir um
        desempate.
  - [ ] **Queima-roupa dá dano máximo?** Só uma linhagem de fonte diz que sim. *Gatilho:* uma fonte fora da linhagem
        S8/S9 confirmar.
  - [ ] **Corpo a corpo resistido**: hoje o GM informa o total do defensor como dificuldade. *Gatilho:* a mesa usar
        corpo a corpo com frequência.
  - [ ] **Penetração escalonada** (decisão 7d): o acerto que fura a armadura tira 1 do SP. É regra do núcleo ou
        opcional? *Gatilho:* a mesa pedir, ou a armadura que nunca gasta incomodar.
  - [ ] **Cobertura entre atirador e alvo** (decisão 7c): o SP da cobertura contra o dano, combinado com a armadura
        pela tabela proporcional. *Gatilho:* o GM precisar da cobertura no cálculo.
  - [ ] **A rolagem de estabilização automática** (First Aid / Medical Tech): hoje o GM marca. *Gatilho:* o GM pedir.
  - [ ] **O estado "atordoado" guardado**: o stun save rola sozinho, e o estado não fica registrado. *Gatilho:* a mesa
        esquecer quem está atordoado.
  - [ ] ⚠️ **Desfazer uma morte na mesa**: o ajuste manual do GM não mexe no `isDead`. *Gatilho:* o GM precisar
        corrigir uma morte aplicada por engano. *Só estava no [histórico](./historico/FASES_A-D.md) (a D).*
  - [ ] **As [Perguntas para o livro](./CONFERENCIA_CP2020.md#perguntas-para-o-livro) que ainda estiverem
        abertas**: cada uma fechada com duas fontes, ou levada ao dono como decisão (Q.0b, o PDF).
- [ ] **Q.6** **Infraestrutura e documentos.**
  - [ ] **O site fora do Render** (a regra 4 e o [I.09](./varreduras/I-integracao.md)): o CORS liberando o
        `X-Session-Token` e o `Authorization`, o CSP copiado para o `vercel.json`, e o `CORS_ORIGINS` e o Auth do
        Supabase ajustados no painel. A decisão está na Q.0b. *Gatilho:* o total do workspace acima de 100 h num
        mês sem o monitor, a espera do despertar virar problema numa sessão, ou a mesa abrir para gente de fora.
  - [ ] **O backup por workflow, com o dump cifrado** (a opção 2 da R.10; a decisão 8 é o dump manual). *Gatilho:*
        perder dado entre dois dumps, ou o volume de fichas tornar inaceitável perder um mês.
  - [ ] **Os avisos de descontinuação do CI**: a CodeQL Action do v3 para o v4 (antes de dezembro de 2026), e as
        actions em Node 20 (`actions/checkout@v4`, `supabase/setup-cli@v1`). *Gatilho:* a data, um run falhar, ou
        sair versão nova. *(O Ubuntu 26 do `ubuntu-latest` se confere no primeiro run depois de 19/10/2026, no passo
        3b do ritual.)*
  - [ ] **Os três diagramas adiados** do [`ARQUITETURA.md`](./ARQUITETURA.md#diagramas-adiados): a sequência do
        handshake, a reconexão com last-write-wins e as camadas de token visual.
  - [ ] **A [ADR 0002](./adr/0002-yjs-websockets.md) (Yjs sob observação)**: rever com o que a L mediu. Se o
        gatilho, um bug de convergência do grid, não disparou, registrar "mantido" e fechar.
- [ ] **Q.7** 🔒 **Portão de segurança**: as seis perguntas sobre o que a Q mudou, no
      [registro](./SEGURANCA.md#registro-por-fase). A pergunta 3 pesa no E.25, no assento por conta e no site em
      outra origem.
- [ ] **Q.8** 🧠 **Estado durável**: caixas, data, linha de base, E2E, PR e o `master` verde, como no
      [ritual de encerramento](#ritual-de-encerramento--ao-fechar-uma-fase). E todo item desta lista feito, ou
      com o DESCARTAR do dono por escrito.
- [ ] ✅ **Bloco Q concluído em:** ____/____/______

---

### FASE M — VALIDAÇÃO E ENCERRAMENTO 🔨 *(1 dia)*

- [ ] **M.0** 🔍 **Verificação de premissas** — *(acrescentado na revisão pós-D, 29/09/2026)*. Já
      sabido: as 56 de RLS **não rodam desde a Fase B** (Supabase local desligado na C e na D) *(J.0,
      17/10/2026: são 63 desde a `0008`, e rodaram na H, na I e na J)*; o
      backup (R.10) precisa ter sido **restaurado ao menos uma vez** num projeto Supabase novo para contar
      como backup; e a M.3 revisa também os ADIAR das ADRs e da conferência, não só os dos ledgers.
      *Medido na revisão de robustez (29/09/2026):* "ADIAR" aparecia **43 vezes** nos documentos vivos
      (contado antes desta revisão), e só **20** linhas traziam o gatilho na mesma linha — a M.3 começa por `grep -rn ADIAR docs/` (fora
      de `historico/` e `legacy/`) e classifica cada um. *(16/10/2026, decisão 12: **o `historico/` entra no
      grep**, e o `CLAUDE.md` também; fica fora só o `legacy/`. Desde os cortes da R.13, seis ADIAR só existiam lá, e
      o grep antigo os perdia. Estão na lista do [bloco Q](#bloco-q--quitar-os-adiar--1015-dias-estimativa-grosseira-que-a-q0-refaz--depois-da-l-antes-da-m).)* Dois têm gatilho **"o dono confirmar no livro"**
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
      *(16/10/2026, decisão 12: a pergunta mudou. Agora é **"a Q quitou todo ADIAR?"**: cada item da lista dela foi
      feito ou tem o DESCARTAR do dono por escrito. E o grep da M.0, com o `historico/`, acha o ADIAR que a lista
      não tiver. O que sobrar volta para a Q, e o plano não fecha com ADIAR em aberto.)*
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
| I | 🔍 | Varredura: integração — ledger com 9 itens, 2 FAZER (um é documento), no #53; o outro, o SEC-16 (o `peerId` que desviava o "Remover" do GM), consertado antes no #54; a I.3 vazia — o I.01 (a rota do modificador do GM sem tela) seguiu ADIAR no merge | ✅ | 16/10/2026 |
| J | 🔍 | Varredura: segurança — J.0 no #57; a J.1 com 13 itens, 4 FAZER: o SEC-17 (o awareness cru derrubava a tela do grid) e o SEC-18 (a memória sem teto pelo repasse e pelo SSE), consertados antes do ledger; a J.3 com a allowlist do gitleaks | 🔄 | — |
| K | 🔨 | Profundidade de sistema | ⬜ | — |
| L | 🔨 | Performance e escala | ⬜ | — |
| Q | 🔨 | Quitar os ADIAR (decisão 12): 78 itens em 16/10, 26 com fase dona | ⬜ | — |
| M | 🔨 | Validação e encerramento | ⬜ | — |

### Linha de base atual

Atualizar ao fechar cada fase. É contra estes números que o passo 6 do ritual de abertura compara.

| Verificação | Ao fechar a Fase I (16/10/2026) |
|---|---|
| Node | **24** (`.node-version`, o mesmo para o CI e o Render — R.8) |
| `npx tsc --noEmit` | 0 erros |
| `npx vitest run` | **868** testes, 65 arquivos *(522 ao fechar a D; +43 das R.1–R.6; +6 da R.16; +6 da R.10; +14 da R.11; +18 da E.3a–b; +42 da E.3c–e; +7 da F.0e; +11 da F.2; +2 da F.1; +73 do PR 3b: `theme-contrast` 41, `cn-theme` 21, `theme-motion` 8, `audit-colors` +3, e o `injury-rules` trocado; +1 da 01.10, `node-version` — **745** ao fechar a R e a F; +47 da G.3: `npc-armor` 14, `double-click` 7, `room-modals` 6, `room-chat` 5, `stat-input` 6, `cyberware-humanity` 9; +4 da G.3h: `room-modals` 3, `cyberware-humanity` 1 — **796** ao fechar a G; +9 da H.3: `room-refresh` 4, `room-transport` 5 — **805**; +36 da H.3d: `instance-lease` 18, `room-persistence` 7, `server-handoff` 6, `api-restart` 3, `room-transport` 2 — **841**; +1 da H.3d.5: `room-transport` 1 — **842** ao fechar a H; +26 da I, o SEC-16: `peer-id.integration` 22, `api-paths` 4)* — `vitest` 4.1.11 |
| `npm run test:e2e` | **7/7** (Playwright) — 2 da ficha ajustados na D.3 para a trilha em pontos; +1 da F.0d (`fonts-csp`: CSP de produção e fontes carregadas) |
| `node scripts/test-ws-e2e.mjs` | 5/5 contra o build de produção (o smoke do CI) |
| `node scripts/test-rls.mjs` | **63/63** na H.3d.1 (15/10/2026: +7 da `instance_lease` — anon e authenticated negados, a service role lê e escreve), e de novo ao fechar a I (16/10). Eram 56/56 na Fase B, sem rodar na C nem na D (nenhuma das duas mexeu em schema nem RLS) |
| `npm run audit:ci` | passa, **ALLOWLIST vazia**, e `npm audit` com **0** vulnerabilidades (R.7: `express@4.22.3`, `qs@6.16.0`; 10/10: `proxy-addr@2.0.8`, `source-map-js@1.2.2`, alertas do dia) |
| Chunk de entrada | 629 kB / 186 kB gzip; CSS 115 kB / 16,8 kB gzip *(PR 3b — a paleta padrão saiu com a F.2.10)* |
| Fontes (F.0c, F.1.3, F.4.3) | Rajdhani **400 e 700**, Share Tech Mono 400 e Orbitron variável — `woff2` do subconjunto `latin`, ~12–16 KB cada, servidos pelo próprio origin |
| `node scripts/multiplayer/h1a.mjs` | A mesa de base da H.1a (14/10/2026): três contextos, do zero ao combate, **0** erro de console; um chat custa **6,7 KB** por aba, o ataque mais o dano **~52–72 KB** (depende de o ataque do NPC ferir), 45 s parada **0,5 KB**; a sala no fim, **~17 KB**. Rodada de novo ao fechar a H.3: os mesmos números. `npm run build` antes; sobe o próprio servidor |
| `node scripts/multiplayer/h1j.mjs` | **No ar, só combinado com o dono** (14/10/2026): o deploy com a mesa aberta deixou as duas instâncias vivas **~20 s**; o despertar da hibernação, **~22 s**. **O ensaio local** (`H1J_LOCAL=1`, com o Supabase local; `H1J_SWITCH_DELAY_S=5` imita o Render da H.3d.0) com o bastão da H.3d, 15/10: **0** mensagem perdida e **6,1 s** de "reconectando" (o código de antes perdia 1) |
| `node scripts/visual/tipografia.mjs` | ✅ 0 negrito sintético e 0 texto abaixo de 10 px, em 12 telas *(precisa do `netsheet-prod` recém-subido)* |
| `npm run audit:colors` | **0** a migrar, e **o CI exige** (F.2.10) — era 1.879 na F.0e e 322 depois da F.2 mecânica. 107 `black`/`white`, à parte. Uma exceção nomeada (o hex do campo `color` do token do grid, sem leitor) |
| `npx tsx scripts/migrate-colors.ts --conflitos` | **0** conflitos de cor no mesmo elemento (eram 19 — F.2.4), e **o CI exige** (F.2.10) |
| Mono com negrito (`audit:colors`, coluna `mono+b`) | **0** (F.1.2) — e 0 no navegador, em 12 telas |
| Migrations em produção | `0001`–`0008` *(a `0008_instance_lease` desde 16/10/2026, na H.3d.1 — PR #47; a D não teve migration)* |

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
