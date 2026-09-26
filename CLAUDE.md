# NETSHEET ENGINE — contrato de sessão

> Este projeto é desenvolvido em **sessões separadas do Claude Code, cada uma com contexto zerado**.
> Este arquivo é carregado automaticamente em toda sessão e existe para que uma sessão fria saiba
> onde está o estado e o que não pode violar. **Leia até o fim antes de propor trabalho.**

## Primeiro passo, sempre

1. Abra **[`docs/PLANO_MESTRE.md`](./docs/PLANO_MESTRE.md)** — é o documento mestre. 13 fases (A–M).
2. Ache o **primeiro item `[ ]` não marcado**. É de onde o trabalho continua.
3. Rode `git log --oneline -15` e `git tag -l` — as tags marcam o fim de cada fase de construção.
4. **Confira o CI do `master` e o keepalive** (`gh run list --branch master --limit 3` e
   `gh run list --workflow keepalive.yml --limit 2`). Vermelho é o primeiro trabalho da sessão.
   O job `db-sync` só roda no `master` — **PR verde não prova que a migration entrou em produção.**
5. Confira o **[Protocolo de sessão](./docs/PLANO_MESTRE.md#-protocolo-de-sessão)** no plano: ele
   detalha o ritual de abertura e de encerramento de fase.

**O repositório é a fonte da verdade do estado**, não a memória do Claude. Checkbox marcado, data
preenchida, ledger escrito e registro de segurança atualizado — é isso que diz onde o projeto está.
A memória complementa com decisões e preferências; ela é local desta máquina e pode não existir.

## Onde mora cada coisa

| Arquivo | O que carrega |
|---|---|
| `docs/PLANO_MESTRE.md` | Fases, tarefas, checkboxes, índice de 33 achados, filtro de necessidade, contrato de custo zero |
| `docs/SEGURANCA.md` | Portão de segurança (6 perguntas) e o registro por fase |
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
| Público da alpha | **Jogadores convidados pelo dono** — é o modelo de ameaça real |
| Identidade visual | **Cyberpunk 2020** (mesa de 1988) — *não* 2077 nem RED. Ver ADR 0006 |
| Provedor de IA | **Groq primário, Gemini fallback — decidido, NÃO implementado.** A B.1 trancou o endpoint mantendo o Gemini; a migração ainda não tem fase dona. Ver ADR 0005 |
| Yjs / CRDT do grid | **Mantido sob observação**, com gatilho para reabrir. Ver ADR 0002 |
| PITR do Supabase | **Não** — exige plano pago. O backup diário gratuito basta (decisão 4 do plano) |
| Vulnerabilidades sem correção | **Exceção nomeada, com motivo e gatilho** em `scripts/audit-ci.mjs` — nunca baixar o nível do portão |
| Dano na cabeça | **Armadura → BTM (mín. 1) → ×2** — o livro não diz quando dobrar; decisão 6 do plano (26/09/2026) |
| Migration × deploy | **Migration em PR próprio**, mergeado e conferido em produção antes do PR do código que a usa. O Render publica sem esperar o `db-sync` |

## Comandos que importam

```bash
npx tsc --noEmit          # typecheck — deve dar 0 erros
npx vitest run            # 395 testes ao fechar a Fase C (ver "Linha de base atual" no plano)
npm run build             # Vite (cliente) + esbuild (servidor)
npm run test:e2e          # Playwright, 6 testes, sobe o servidor de produção
npm run audit:ci          # portão de vulnerabilidades — falha em alta/crítica sem exceção nomeada
node scripts/test-rls.mjs # 56 testes de RLS — exige Supabase local no Docker
```

## Contexto que economiza tempo

- O projeto **não está quebrado**: compila, testa e builda. Desde a Fase C as rolagens seguem o
  livro, na ficha e na mesa, com **um motor só** em `src/rules/`. O que falta é fechar o *loop de
  jogo* (Fase D): o dano ainda não vira ferimento sozinho — o `woundLevel` é clicado à mão.
- **Regra nova ou mudada começa na tabela** (`src/rules/tables.ts`) e na conferência, com fonte.
  O teste deriva da tabela, nunca da implementação. Cuidado com **Cyberpunk RED** e regra de casa
  se passando por 2020 — três premissas do plano original vieram de lá.
- Há um padrão recorrente aqui: **coisa construída de ponta a ponta e nunca ligada.** O
  `combatModifier` e o `currentStats` foram ligados na Fase C; o `@theme` de cores é da Fase F.
  Antes de construir algo novo, confira se o que existe já resolve.
- O `PLANO_DE_ACAO.md` na raiz está **substituído, não concluído** — suas Fases 11 e 12 viraram as
  Fases K e M do plano novo, e ele só é removido na Fase M.
- **Verifique a premissa antes de executar um item.** A auditoria de 03/09 mostrou que as afirmações
  do plano sobre *código* se sustentam, e as sobre *estado de configuração* não (secrets, planos
  pagos, tokens). Na Fase B, a verificação prévia (B.0) mudou o tamanho de quatro dos seis itens.
  Toda fase de construção começa com um item `.0` de verificação.
- **Migration e código que a usa nunca vão no mesmo merge** (decisão 5): o Render faz auto-deploy
  independente do `db-sync`, e em 24/09 o código subiu antes da migration.
- **O token do CI expira.** Ele tem validade de 30 dias e vence por volta de **25/10/2026**; renovar
  até 22/10. Se vencer, o `db-sync` dá `Unauthorized` e o keepalive fica vermelho.
- **Nunca dispare `db-sync` e keepalive juntos à mão.** Os dois usam o mesmo papel temporário do CLI
  e um derruba a senha do outro (`28P01`).
