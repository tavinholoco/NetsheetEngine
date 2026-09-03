# NETSHEET ENGINE — contrato de sessão

> Este projeto é desenvolvido em **sessões separadas do Claude Code, cada uma com contexto zerado**.
> Este arquivo é carregado automaticamente em toda sessão e existe para que uma sessão fria saiba
> onde está o estado e o que não pode violar. **Leia até o fim antes de propor trabalho.**

## Primeiro passo, sempre

1. Abra **[`docs/PLANO_MESTRE.md`](./docs/PLANO_MESTRE.md)** — é o documento mestre. 13 fases (A–M).
2. Ache o **primeiro item `[ ]` não marcado**. É de onde o trabalho continua.
3. Rode `git log --oneline -15` e `git tag -l` — as tags marcam o fim de cada fase de construção.
4. Confira o **[Protocolo de sessão](./docs/PLANO_MESTRE.md#-protocolo-de-sessão)** no plano: ele
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

## Invariantes — não viole sem o usuário pedir

- **Custo zero é requisito duro.** Nunca vincular conta de faturamento à chave do provedor de IA;
  um serviço no Render (750 h/mês são por *workspace*, compartilhadas com outro projeto do usuário);
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
| Provedor de IA | **Groq primário, Gemini fallback.** Ver ADR 0005 |
| Yjs / CRDT do grid | **Mantido sob observação**, com gatilho para reabrir. Ver ADR 0002 |

## Comandos que importam

```bash
npx tsc --noEmit          # typecheck — deve dar 0 erros
npx vitest run            # 141 testes na abertura do plano
npm run build             # Vite (cliente) + esbuild (servidor)
npm run test:e2e          # Playwright, 6 testes, sobe o servidor de produção
node scripts/test-rls.mjs # 56 testes de RLS — exige Supabase local no Docker
```

## Contexto que economiza tempo

- O projeto **não está quebrado**: compila, testa e builda. O que falta é o *loop de jogo* — dano
  não vira ferimento, o `combatModifier` do GM não entra em rolagem nenhuma, e a tabela de BTM não é
  a do livro.
- Há um padrão recorrente aqui: **coisa construída de ponta a ponta e nunca ligada.** O
  `combatModifier`, o `currentStats` e o `@theme` de cores são três casos. Antes de construir algo
  novo, confira se o que existe já resolve.
- O `PLANO_DE_ACAO.md` na raiz está **substituído, não concluído** — suas Fases 11 e 12 viraram as
  Fases K e M do plano novo, e ele só é removido na Fase M.
