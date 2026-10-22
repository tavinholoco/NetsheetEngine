# NETSHEET ENGINE — contrato de sessão

> Este projeto é desenvolvido em **sessões separadas do Claude Code, cada uma com contexto zerado**.
> Este arquivo é carregado automaticamente em toda sessão e existe para que uma sessão fria saiba
> onde está o estado e o que não pode violar. **Leia até o fim antes de propor trabalho.**

## Primeiro passo, sempre

0. **Atualize o `master` local antes de ler qualquer coisa:** `git status` (a sessão anterior pode
   ter deixado outro branch), `git checkout master`, `git fetch --all --prune --tags` e
   `git merge --ff-only origin/master`. Os PRs são mergeados pelo dono no GitHub; sem isso você lê um
   plano velho. *(A sessão de 25/09 abriu com o `master` 14 commits atrás; a de 30/09, no branch do PR
   anterior.)*
1. Abra **[`docs/PLANO_MESTRE.md`](./docs/PLANO_MESTRE.md)** — é o documento mestre. 13 fases (A–M),
   mais blocos de pendências fora das fases (P em 25/09; **R**, da revisão pós-D de 29/09) que
   precedem a fase seguinte — e o **Q** (decisão 12, 16/10), que quita todo ADIAR depois da L e antes da M. O arquivo passa de uma leitura só: leia em partes, e não pule nenhuma.
   O detalhe das fases fechadas (A–H, P e R) mora em [`docs/historico/`](./docs/historico/) desde a R.13
   — só abra quando precisar do porquê de algo já feito.
2. Ache o **primeiro item `[ ]` não marcado**. É de onde o trabalho continua.
3. Rode `git log --oneline -15` e `git tag -l` — as tags marcam o fim de cada fase de construção.
4. **Confira o CI do `master` e o keepalive** (`gh run list --branch master --limit 3` e
   `gh run list --workflow keepalive.yml --limit 2`). Vermelho é o primeiro trabalho da sessão.
   O job `db-sync` só roda no `master` — **PR verde não prova que a migration entrou em produção.**
   Se a lista vier com runs velhos (visto em 30/09, com um run na fila), confira sem o filtro:
   `gh run list --limit 8` e olhe a coluna do branch. Run `cancelled` no `master` costuma ser a
   concorrência do CI (`cancel-in-progress`) — o push seguinte cobre o mesmo código.
5. Confira o **[Protocolo de sessão](./docs/PLANO_MESTRE.md#-protocolo-de-sessão)** no plano: ele
   detalha o ritual de abertura e de encerramento de fase.

**O repositório é a fonte da verdade do estado**, não a memória do Claude. Checkbox marcado, data
preenchida, ledger escrito e registro de segurança atualizado — é isso que diz onde o projeto está.
A memória complementa com decisões e preferências; ela é local desta máquina e pode não existir.

## Onde mora cada coisa

| Arquivo | O que carrega |
|---|---|
| `docs/PLANO_MESTRE.md` | Fases, tarefas, checkboxes, índice de achados (33 da auditoria + 12 da revisão pós-D), filtro de necessidade, contrato de custo zero, registro de sessões |
| `docs/SEGURANCA.md` | Portão de segurança (6 perguntas) e o registro por fase |
| `docs/BACKUP.md` | Runbook do backup manual (decisão 8), o registro de cada dump e o contorno do Docker que não sobe |
| `docs/historico/` | O detalhe das fases fechadas, movido do plano sem mudar o texto (R.13). Consulta, não estado |
| `docs/ARQUITETURA.md` | Diagramas Mermaid — contêineres, fronteiras de confiança, pipeline de dano, máquina de ferimento |
| `docs/adr/` | Decisões arquiteturais com histórico de revisão. **Leia antes de reabrir uma decisão.** |
| `docs/varreduras/` | Ledgers das varreduras (Fases E, G–J) com veredictos FAZER/ADIAR/DESCARTAR |
| `docs/PRD.md` | Escopo de produto e regras CP2020 |
| `docs/CONFERENCIA_CP2020.md` | Cada regra contra o livro, **com fonte**, e o que ficou para outra fase. **Leia antes de mexer em regra** |
| `src/rules/` | As regras como código: `tables.ts` (o livro como dado), motor de dados, atributos derivados, ataque. Cliente **e** servidor usam |

## Invariantes — não viole sem o usuário pedir

- **Custo zero é requisito duro.** Nunca vincular conta de faturamento à chave do provedor de IA;
  um serviço no Render (750 h **e 5 GB de banda** por mês, por *workspace*, divididas com outro
  projeto do usuário — estourar qualquer uma desliga os dois até o mês seguinte);
  **nunca** apontar uptime bot para `/api/health`. Detalhes no contrato de custo zero do plano.
  *Um existiu:* o monitor do Better Stack da T10.4 manteve o serviço acordado 24 h por dia e estourou o
  workspace em agosto e setembro; o dono o pausou em 05/10/2026. O `uptime` do `/api/health` mostra se
  o serviço está hibernando — uma requisição só.
- **Filtro de necessidade: ADIAR é o veredito padrão.** Mudança sem sintoma observado não entra.
  Se mais de 1/3 de uma varredura virar FAZER, o critério está frouxo. **Mas ADIAR é ordem, não
  esquecimento** (decisão 12): todo ADIAR em aberto está na lista do bloco Q do plano, e o ADIAR
  novo entra nela no fechamento da fase. Corte para o `historico/` não tira item da lista.
- **Portão de segurança:** nenhuma fase de construção fecha sem responder as 6 perguntas e registrar.
- **Vermelho significa exclusivamente dano.** O `HealthTracker` ocupa a escala vermelha com wound
  level; nada mais no produto compete com esse significado.
- **Fidelidade estrita ao CP2020.** Divergência da regra do livro é bug, não regra de casa.

## Decisões já tomadas — não reabrir sem motivo novo

| Questão | Decisão |
|---|---|
| Explosão do d10 | **Encadeia.** O cliente e o PRD estão certos; corrigir o servidor |
| Regras | **Fidelidade estrita** ao Cyberpunk 2020 |
| Público da alpha | **Jogadores convidados pelo dono** — é o modelo de ameaça real. **Imposto na R.11 (29/09):** o lobby não lista salas; o código, com sufixo aleatório, é o convite |
| Identidade visual | **Cyberpunk 2020** (mesa de 1988) — *não* 2077 nem RED. Ver ADR 0006. **Na F (decisão 10, 30/09):** Rajdhani nos rótulos, mono só em dado e sem negrito; vermelho só dano, magenta (`fault`) para erro e hostil; o interior do livro de 1990 é P&B — referência de diagramação, não de cor |
| Provedor de IA | **Groq primário, Gemini fallback — decidido, NÃO implementado.** A B.1 trancou o endpoint mantendo o Gemini; a migração ainda não tem fase dona. Ver ADR 0005 |
| Yjs / CRDT do grid | **Mantido sob observação**, com gatilho para reabrir. Ver ADR 0002 |
| PITR do Supabase | **Não** — exige plano pago (decisão 4). *A premissa "o backup diário gratuito basta" era falsa: o plano gratuito não tem backup automático* |
| Backup do banco | **Dump manual** (`npm run backup:db`), todo mês e antes de toda migration, **fora do repositório** — decisão 8 (29/09/2026). Runbook e registro em `docs/BACKUP.md` |
| Vulnerabilidades sem correção | **Exceção nomeada, com motivo e gatilho** em `scripts/audit-ci.mjs` — nunca baixar o nível do portão |
| Dano na cabeça | **Armadura → BTM (mín. 1) → ×2** — o livro não diz quando dobrar; decisão 6 do plano (26/09/2026) |
| Ferimento na mesa | **Pontos (0–40) na ficha, nível derivado; só servidor e GM escrevem na mesa.** Token sem ficha não recebe dano; penetração escalonada ADIAR — decisão 7 (28/09/2026) |
| Migration × deploy | **Migration em PR próprio**, mergeado e conferido em produção antes do PR do código que a usa. O Render publica sem esperar o `db-sync` |
| Merge × sessão de jogo | **Pode mergear com mesa aberta — mas não no meio de um combate.** Desde a H.3d (passagem de bastão, ADR 0007) a troca de instância **não perde nada**: provado no ar em 15/10/2026 (H.3d.4, 30 de 30). Mas a mesa fica **~5–15 s "reconectando"** (as ações demoram e se repetem sozinhas), e quem abre a página nessa janela cai no SSE (H.14, ADIAR). Era "nunca mergear com mesa aberta" (E.06, H.13: o H.1j perdia ~20 s). Migration segue em PR próprio (decisão 5) |
| Login para criar mesa | **O servidor não exige** (a tela exige). Os tetos da E.03 (30 salas, `MAX_ROOMS`) fecham o esgotamento; exigir login é ADIAR com gatilho — decisão do dono (30/09/2026), em `docs/SEGURANCA.md` |
| Netrunning | **O netrunner na ficha** (deck, programas, MU) **entrou na K.5** (20/10, sem o PDF: as fontes fecharam — o programa é digitado); **a Net jogável na mesa: ADIAR**, fase própria depois da L — gatilho: alguém da mesa jogar de netrunner. Decisão 9 (30/09/2026) |
| ADIAR × fazer tudo | **Ordem, não esquecimento** — o dono quer tudo feito (decisão 12, 16/10/2026). Todo ADIAR é quitado no **bloco Q**, depois da L e antes da M, e só sai da lista com DESCARTAR escrito pelo dono. Nas varreduras, ADIAR continua sendo o padrão |
| Criação e carga (K) | **O 9D10 num bolo e o bolo que o Mestre define**, cada atributo de 2 a 10; a evolução por IP, o método rápido e a K.4 ("drops") vão **para a Q**; a K.2 vai até o **EV da armadura, sem pena por peso** (nenhuma fonte a tem) — decisão 13 (18/10/2026). O orçamento de criação **não barra** o trapaceiro no servidor (IP e cromo sobem os números depois): fica à vista do GM — **feito na K.6** (20/10): o assistente grava o que gastou (`creation`), e o GM o compara com a ficha de hoje no "Inspecionar ficha". **O salário do Fixer** só tem uma fonte: a verba dele é do Mestre (o dono, 20/10) |
| Fonte das regras | **O dono não tem o livro** (corrigido em 30/09/2026). Valem as **fontes secundárias**, aceitas com duas concordando; comprar o PDF oficial é **ADIAR** com gatilho. Cópia do livro sem licença não é fonte. Decisão 11 |

## Comandos que importam

```bash
npx tsc --noEmit          # typecheck — deve dar 0 erros (no CI, `npm run typecheck`)
npm run lint              # ESLint, --max-warnings 0 (L.5): nenhum `any`, nenhum `console.*` no cliente; exceção nomeada no lugar
npx vitest run            # 1072 testes ao fechar a K e a revisão dela (K.10), 20/10 (ver "Linha de base atual" no plano; a sonda não rastreada da J.1d fica fora)
npm run build             # Vite (cliente) + esbuild (servidor)
npm run test:e2e          # Playwright, 7 testes, sobe o servidor de produção (o fonts-csp exercita o CSP do ar)
npm run audit:ci          # portão de vulnerabilidades — falha em alta/crítica sem exceção nomeada
npm run audit:colors      # cor escrita à mão em src/ — zero, e o CI exige (F.2.10): cor nova é token no @theme
npx tsx scripts/migrate-colors.ts --conflitos   # duas cores na mesma propriedade do elemento — 0, e o CI exige
node scripts/test-rls.mjs # 63 testes de RLS — exige Supabase local no Docker
npm run backup:db         # dump de produção FORA do repo (docs/BACKUP.md) — exige Docker; nunca junto do CI
```

## Contexto que economiza tempo

- O projeto **não está quebrado**: compila, testa e builda. Desde a Fase C as rolagens seguem o
  livro, na ficha e na mesa, com **um motor só** em `src/rules/`. Desde a Fase D o *loop de jogo*
  fecha no servidor: iniciativa → ataque contra o alcance → dano em **pontos** (armadura → BTM → ×2)
  → stun e death save → virada de turno. O GM age pelo cartão do token no grid; na mesa, o jogador
  não escreve o próprio ferimento.
- **Desde a Fase E (30/09) o servidor tem contrato de erro e tetos.** Todo erro da API é
  `{ error, code }`, e o status sai do `code` por uma tabela só ([`server/errors.ts`](./server/errors.ts));
  no `roomManager`, o tipo `RoomResult` não deixa erro sair sem `code`, e no `server.ts` a única saída
  é o `sendError`. **Rota nova segue isso** — um teste trava status escrito à mão. A mesa tem tetos
  (30 salas, 32 NPCs, ficha de 64 KB, chat de 100, 1 MiB por socket lento) e o grid tem forma
  conferida nas duas portas, REST e Yjs (SEC-14, SEC-15). O ledger da varredura está em
  `docs/varreduras/E-backend.md`, com o mapa de cortes que a L.3 vai usar. **Desde a J (17/10), todo envio
  a um socket da mesa passa pelo `sendToSocket`**, com o teto de 1 MiB (SEC-18) — envio novo também; a
  exceção, comentada, é o aviso da troca de instância —, o SSE tem 3 streams por jogador, e o awareness do
  Yjs é conferido em `server/awarenessGuard.ts` (forma, dono, cursor só do GM — SEC-17).
- **Desde a L.1 (21/10), a sala sai na vista do papel e por diferença.** O jogador não recebe a ficha do NPC
  (E.20) em porta nenhuma: **porta nova que entregue a sala passa pelo `roomViewFor`** (`server/roomDelta.ts`), e
  entrada de socket ou stream pelo `roomEntryFor` do `server.ts`. Quem conecta com `delta=1` recebe `room:full`
  e depois `room:patch` com `rev`; sem `delta`, a sala inteira, como antes — é o que mantém a aba aberta viva
  num deploy. O lado do cliente é o `src/lib/roomPatch.ts`; o contrato, o §6.2 do `PROTOCOLO_MULTIPLAYER.md`.
- **Ver o app rodando:** a configuração `netsheet-dev` do [`.claude/launch.json`](./.claude/launch.json)
  (`npm run dev`, porta 3000) abre o preview no painel. Em modo dev, **deep link volta para `/`**
  (G.02 do [ledger da G](./docs/varreduras/G-frontend.md): ADIAR, com a versão de uma linha pronta) — navegue pelo menu. Criar mesa exige login; para testar como GM sem login,
  semeie a sala por REST com o `gmPeerId` do navegador (a D.3–D.5 fizeram assim). **O build de produção,**
  com o helmet (onde o CSP vale), é a configuração `netsheet-prod` (porta 3100; `npm run build` antes) — e
  `scripts/visual/` captura, compara pixel a pixel e confere a tipografia contra ela (Fase F).
- **A mesa com várias pessoas e rede ruim:** `scripts/multiplayer/` (Fase H) — um contexto isolado do
  Playwright por pessoa (abas do mesmo navegador dividem a ficha local), o build de produção num processo
  próprio e um proxy TCP de rede lenta, túnel e WebSocket bloqueado (o throttling do DevTools não garante o
  WebSocket). Um roteiro por cenário do ledger da H; `npm run build` antes. Dois são diferentes: o
  `h1j.mjs` roda **contra o ar**, combinado com o dono (ele clica no "Manual Deploy"; o roteiro aborta se
  houver mesa aberta e apaga a sua no fim — `H1J_LOCAL=1` é o ensaio local), e o `h1c-gm.mjs` faz login de
  verdade com um usuário descartável no **Supabase local** (recusa qualquer outro). Os testes de tela do
  transporte (cair, voltar, cair no SSE) usam o `controlRoomTransport` de `src/test/roomTransport.ts`.
- **Desde a H.3d (15/10), o boot pede o bastão antes de abrir a porta** (`server/instanceLease.ts`, a
  `instance_lease` da `0008`, ADR 0007): num deploy, a instância nova espera a velha entregar a mesa (503
  `server_restarting`, sockets fechados com `1012`, tudo gravado) e só então lê o banco e escuta. **Nunca abrir
  a porta antes do `lease.acquire()`, nem pôr no painel um *Health Check Path* que responda antes dele:** o
  serviço não tem health check HTTP, e o Render manda tráfego quando a porta TCP abre (H.3d.0). O bastão só
  liga em produção com banco; no dev e nos testes fica desligado.
- **No ar, o fechamento de WebSocket que o servidor manda não chega ao navegador** (H.3d.4, medido): o cliente
  vê `1006` segundos depois, e o que ele manda nesse tempo some; os quadros de dados chegam em ~145 ms. Nada no
  cliente pode depender do código de fechamento do servidor — por isso a entrega do bastão **avisa por um quadro
  de dados** e o cliente fecha o próprio socket (H.3d.5). Medir de novo: `scripts/multiplayer/h3d-fechamento.mjs`.
  O ensaio local só reproduz isso com `H1J_CLOSE_HOLD_S`.
- **Regra nova ou mudada começa na tabela** (`src/rules/tables.ts`) e na conferência, com fonte.
  O teste deriva da tabela, nunca da implementação. Cuidado com **Cyberpunk RED** e regra de casa
  se passando por 2020 — três premissas do plano original vieram de lá.
- **O dono não tem o livro** (corrigido em 30/09/2026 — um registro do mesmo dia dizia que tinha). As
  regras vêm das **fontes secundárias** da conferência, aceitas com duas concordando; o que elas não
  fecharam fica em "Perguntas para o livro", e o que bloquear trabalho vai ao dono como decisão, com a
  pesquisa e uma opção recomendada (decisão 11). Registre a regra com as suas palavras e a página que
  a fonte cita; **nunca copie texto ou tabela do livro** para o repositório, que é público.
- Há um padrão recorrente aqui: **coisa construída de ponta a ponta e nunca ligada.** O
  `currentStats` foi ligado na Fase C, e o `combatModifier` em duas vezes — a C.4 ligou a soma na rolagem,
  e a tela que o escreve só veio na K.3b (a rota `/settings` ficou sem chamador da C à K: o I.01); o
  `@theme` de cores é da Fase F; o `deletePlayer` ganhou botão na G.3 (estava sem desde a Fase 0).
  Antes de construir algo novo, confira se o que existe já resolve.
- **Botão cuja ação repetida estraga a mesa passa pelo `useInFlight`** (`src/hooks/`, G.06): entrar, criar,
  aplicar dano, NPC ataca, próximo turno e as condições da cena (K.3b) — dano em dobro e assento órfão
  foram reproduzidos. Os outros
  botões do GM ("Gerar NPC", "Gerar Jogador", "Rolar iniciativa") **ainda não passam**: em dobro, o
  resultado fica à vista e se desfaz — ADIAR na revisão da G.3, com gatilho na lista do bloco Q. Os testes de tela da
  mesa montam o `MultiplayerRoom` com o `stubRoomTransport` (`src/test/roomTransport.ts`).
- O `PLANO_DE_ACAO.md` na raiz está **substituído, não concluído** — suas Fases 11 e 12 viraram as
  Fases K e M do plano novo, e ele só é removido na Fase M.
- **Verifique a premissa antes de executar um item.** A auditoria de 03/09 mostrou que as afirmações
  do plano sobre *código* se sustentam, e as sobre *estado de configuração* não (secrets, planos
  pagos, tokens). Na Fase B, a verificação prévia (B.0) mudou o tamanho de quatro dos seis itens.
  Toda fase de construção começa com um item `.0` de verificação. **A revisão pós-D (29/09) repetiu o
  padrão:** caíram o backup "gratuito" (não existe), a versão do Node (nunca fixada — produção no
  `latest`) e a retenção de log (7 dias, não meses).
- **O repositório é público** e o `master` não tem proteção de branch (conferido em 29/09). Achado de
  segurança **aberto** é publicado no repo **junto com o conserto**, nunca antes. E backup de banco
  nunca vai para o repositório.
- **Node 24, no `.node-version` (o CI) e no `FROM` do `Dockerfile` (o Render)** — o serviço em
  produção é **Docker**, não o Blueprint do `render.yaml`, e não lê o `.node-version`: a R.8 supôs que
  lia, e a produção rodou o 22 até 10/10/2026. Trocar de versão é mudar os dois; o `node-version.test`
  falha se divergirem.
- **Emitir sessão também é autorização.** O SEC-07 viveu desde a T1.7 porque todos conferiam de onde
  vinha o autor da ação, e ninguém quem recebia o token. É a segunda metade da pergunta 3 do portão.
- **Tailwind 4: duas classes da mesma propriedade no mesmo elemento decidem pelo alfabeto** do nome
  (`border-emerald-500 border-slate-800` → vence `slate`). Renomear classe pode inverter o visual — foi
  o achado da F.2.4. Antes de trocar nome de classe, `migrate-colors --conflitos`; depois, captura.
- **O `cn` (tailwind-merge) não lê o `@theme`.** Um token de **tamanho** novo (`--text-*`, `--tracking-*`,
  `--shadow-*`, `--drop-shadow-*`) que ele não conheça vira "cor" e some do className ao lado de uma cor
  de verdade — o modal de login perdeu o brilho assim (achado da F.4). Token novo entra também no
  `extendTailwindMerge` de `src/lib/utils.ts`; o `cn-theme.test` deriva a lista do `@theme` e pega.
- **A cor (F.2b):** vermelho só dano (`danger` e a escala `wound-0`–`wound-10`, que **clareia** com a
  gravidade); erro, destrutivo, *fumble* e NPC hostil em `fault` (magenta); DADOS em `roll` (azul); o GM
  em `signal`. Contraste de texto (4,5:1) e de borda de campo (3:1) travado no `theme-contrast.test`.
- **Tipografia (F.1):** Rajdhani em rótulo e texto, Share Tech Mono só em dado — e **sem negrito** (a face
  só tem o 400) —, Orbitron em título. Rajdhani **não tem algarismos tabulares**: número vai na mono.
  Nem Rajdhani nem Orbitron têm `º`/`ª`. Nada abaixo de `text-micro` (10 px).
- **Migration e código que a usa nunca vão no mesmo merge** (decisão 5): o Render faz auto-deploy
  independente do `db-sync`, e em 24/09 o código subiu antes da migration.
- **O token do CI expira.** Ele tem validade de 30 dias e vence por volta de **25/10/2026**; renovar
  até 22/10. Se vencer, o `db-sync` dá `Unauthorized` e o keepalive fica vermelho.
- **Nunca dispare `db-sync` e keepalive juntos à mão.** Os dois usam o mesmo papel temporário do CLI
  e um derruba a senha do outro (`28P01`).
- **O CLI do Supabase tem versão fixa nos dois workflows** (2.121.0, J.5 — 17/10/2026): com `latest`, a
  action perguntava a versão à API do GitHub, e o rate limit deixou o `master` vermelho. Subir de versão é
  trocar no `ci.yml` **e** no `keepalive.yml`. O keepalive aceita disparo manual num branch — é como provar
  uma mudança nos dois antes do merge, já que o `db-sync` só roda no `master`.
