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
   precedem a fase seguinte. O arquivo passa de uma leitura só: leia em partes, e não pule nenhuma.
   O detalhe das fases fechadas (A–D e P) mora em [`docs/historico/`](./docs/historico/) desde a R.13
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
- **Filtro de necessidade: ADIAR é o veredito padrão.** Mudança sem sintoma observado não entra.
  Se mais de 1/3 de uma varredura virar FAZER, o critério está frouxo.
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
| Identidade visual | **Cyberpunk 2020** (mesa de 1988) — *não* 2077 nem RED. Ver ADR 0006. **Na F (decisão 10, 30/09):** Rajdhani nos rótulos, mono só em dado e sem negrito; vermelho só dano, magenta (`fault`) para erro e hostil; o livro do dono é P&B — referência de diagramação, não de cor |
| Provedor de IA | **Groq primário, Gemini fallback — decidido, NÃO implementado.** A B.1 trancou o endpoint mantendo o Gemini; a migração ainda não tem fase dona. Ver ADR 0005 |
| Yjs / CRDT do grid | **Mantido sob observação**, com gatilho para reabrir. Ver ADR 0002 |
| PITR do Supabase | **Não** — exige plano pago (decisão 4). *A premissa "o backup diário gratuito basta" era falsa: o plano gratuito não tem backup automático* |
| Backup do banco | **Dump manual** (`npm run backup:db`), todo mês e antes de toda migration, **fora do repositório** — decisão 8 (29/09/2026). Runbook e registro em `docs/BACKUP.md` |
| Vulnerabilidades sem correção | **Exceção nomeada, com motivo e gatilho** em `scripts/audit-ci.mjs` — nunca baixar o nível do portão |
| Dano na cabeça | **Armadura → BTM (mín. 1) → ×2** — o livro não diz quando dobrar; decisão 6 do plano (26/09/2026) |
| Ferimento na mesa | **Pontos (0–40) na ficha, nível derivado; só servidor e GM escrevem na mesa.** Token sem ficha não recebe dano; penetração escalonada ADIAR — decisão 7 (28/09/2026) |
| Migration × deploy | **Migration em PR próprio**, mergeado e conferido em produção antes do PR do código que a usa. O Render publica sem esperar o `db-sync` |
| Merge × sessão de jogo | **Nunca mergear no `master` com mesa aberta.** Todo deploy do Render roda duas instâncias por ≥60 s, e a mesa perde até ~1,5 min de estado (E.06, `docs/DEPLOY.md`) |
| Login para criar mesa | **O servidor não exige** (a tela exige). Os tetos da E.03 (30 salas, `MAX_ROOMS`) fecham o esgotamento; exigir login é ADIAR com gatilho — decisão do dono (30/09/2026), em `docs/SEGURANCA.md` |
| Netrunning | **O netrunner na ficha** (deck, programas, MU) entra na K.5; **a Net jogável na mesa: ADIAR**, fase própria depois da L — gatilho: alguém da mesa jogar de netrunner. Decisão 9 (30/09/2026) |

## Comandos que importam

```bash
npx tsc --noEmit          # typecheck — deve dar 0 erros
npx vitest run            # 669 testes depois da F.2 mecânica (ver "Linha de base atual" no plano)
npm run build             # Vite (cliente) + esbuild (servidor)
npm run test:e2e          # Playwright, 7 testes, sobe o servidor de produção (o fonts-csp exercita o CSP do ar)
npm run audit:ci          # portão de vulnerabilidades — falha em alta/crítica sem exceção nomeada
npm run audit:colors      # cor escrita à mão em src/ (Fase F) — o critério de pronto da F.2 é zero
node scripts/test-rls.mjs # 56 testes de RLS — exige Supabase local no Docker
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
  `docs/varreduras/E-backend.md`, com o mapa de cortes que a L.3 vai usar.
- **Ver o app rodando:** a configuração `netsheet-dev` do [`.claude/launch.json`](./.claude/launch.json)
  (`npm run dev`, porta 3000) abre o preview no painel. Em modo dev, **deep link volta para `/`**
  (pista da Fase G) — navegue pelo menu. Criar mesa exige login; para testar como GM sem login,
  semeie a sala por REST com o `gmPeerId` do navegador (a D.3–D.5 fizeram assim).
- **Regra nova ou mudada começa na tabela** (`src/rules/tables.ts`) e na conferência, com fonte.
  O teste deriva da tabela, nunca da implementação. Cuidado com **Cyberpunk RED** e regra de casa
  se passando por 2020 — três premissas do plano original vieram de lá.
- **O dono tem o livro físico** (30/09/2026) — a fonte primária quando as secundárias divergem. As
  dúvidas abertas ficam em "Perguntas para o livro", na conferência. Registre a regra com as suas
  palavras e a página; **nunca copie texto ou tabela do livro** para o repositório, que é público.
- Há um padrão recorrente aqui: **coisa construída de ponta a ponta e nunca ligada.** O
  `combatModifier` e o `currentStats` foram ligados na Fase C; o `@theme` de cores é da Fase F.
  Antes de construir algo novo, confira se o que existe já resolve.
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
- **Node 24, no `.node-version`** (R.8) — o mesmo arquivo para o Render e o CI. Trocar de versão é
  mudar esse arquivo; `NODE_VERSION` no painel do Render passaria por cima dele em silêncio.
- **Emitir sessão também é autorização.** O SEC-07 viveu desde a T1.7 porque todos conferiam de onde
  vinha o autor da ação, e ninguém quem recebia o token. É a segunda metade da pergunta 3 do portão.
- **Migration e código que a usa nunca vão no mesmo merge** (decisão 5): o Render faz auto-deploy
  independente do `db-sync`, e em 24/09 o código subiu antes da migration.
- **O token do CI expira.** Ele tem validade de 30 dias e vence por volta de **25/10/2026**; renovar
  até 22/10. Se vencer, o `db-sync` dá `Unauthorized` e o keepalive fica vermelho.
- **Nunca dispare `db-sync` e keepalive juntos à mão.** Os dois usam o mesmo papel temporário do CLI
  e um derruba a senha do outro (`28P01`).
