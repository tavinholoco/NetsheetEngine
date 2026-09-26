# ADR 0004 — Motor de dados com @dice-roller/rpg-dice-roller

- **Status:** Substituída em 25/09/2026 — ver a [revisão da Fase C](#revisão-de-25092026--motor-próprio-em-srcrules) no fim
- **Data:** 08/08/2026
- **Decisores:** Desenvolvimento (Fase 6, T6.1–T6.4)
- **Fase do plano:** Fase 6 — Motor de Dados (Dice Engine)

## Contexto

As rolagens FNFF eram feitas com **`Math.random()` manual**, com a lógica
**duplicada** em `App.tsx`, `DiceRoller.tsx` e no servidor
(`server/roomManager.ts`). Problemas:

1. **Duplicação** — três implementações da mesma regra (perícia, dano,
   death save) divergem facilmente.
2. **Sem audit trail** — o resultado final não mostrava "dado + bônus =
   total" de forma confiável (necessário para conferência de mesa).
3. **Explosão encadeada** do FNFF (10! → rola de novo, pode encadear) era
   implementada à mão e arriscada de regredir.
4. **Testabilidade** — `Math.random` não permite resultado determinístico.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Manter `Math.random` manual** | Zero dependência | Lógica triplicada; sem audit trail; sem explosão encadeada robusta; intestável |
| **Escrever motor próprio** | Controle total | Reimplementar notação de dados, explosão, fumble e testes do zero — retrabalho |
| **`@dice-roller/rpg-dice-roller`** (escolhida) | Notação `NdM±X` e `1d10!` nativas; `DiceRoll.output` (audit trail); engine seedável para testes | É uma dependência; API precisa de validação empírica (feita na T6.1) |

## Decisão

Adotar **`@dice-roller/rpg-dice-roller`** encapsulado em um motor próprio
`src/utils/diceEngine.ts` com a API que os callers já usavam:

- **`rollSkill(stat, skill, ctx?)`** — `1d10!` + atributo + nível; explosão
  em 10 (soma inclusa) e fumble em 1 (**1d10 subtraído**).
- **`rollDamage(formula, ctx?)`** — `NdM±X` + local de impacto sorteado
  (1d10: 1 = cabeça ×2, 2–4 tronco, 5/6 braços, 7–0 pernas); fórmula
  inválida lança `NotationError`.
- **`rollDeathSave(body, ctx?)`** — `1d10 ≤ BODY` (passou/falhou).
- **`rollLocation()`** — sorteio do local de impacto.

Todas retornam **`RollResult`** completo com **audit trail** (`DiceRoll.output`).
O RNG é **seedável** (`NumberGenerator.engines.MersenneTwister19937`) — base
dos testes determinísticos.

## Consequências

**Positivas:**

- **−157 linhas** de lógica manual eliminadas (App.tsx + DiceRoller delegam
  ao motor; zero `Math.random` restante no rolador).
- **Audit trail** confiável (`1d10!: [10!, 5] = 15 + REF (8) + Perícia (3) =
  26`) — transparência para a mesa.
- **Testes determinísticos** (suíte migrada na T9.2 para `src/__tests__/dice-engine.test.ts` via Vitest, originalmente 52/52 em `scripts/test-dice-engine.ts`): explosão
  encadeada, fumble, faixas de dano, death save, local de impacto exato —
  integrados ao CI (`npm run test`).

**Negativas / custos:**

- A lib é ESM — exigiu conferir o empacotamento no Vite (ok) e invocar o
  binário direto no tsc (peculiaridade da máquina, não da lib).
- **Limite de escopo**: o motor é **client-only**. As rolagens da mesa
  multiplayer continuam **server-authoritative** (`crypto.randomInt` +
  ficha do servidor, T5.4) — decisão de segurança, não de motor.

## Referências

- `src/utils/diceEngine.ts` — motor FNFF.
- `src/__tests__/dice-engine.test.ts` — suíte determinística (18 testes, Vitest).
- Fase 6 do `PLANO_DE_ACAO.md` (T6.1–T6.4).

---

## Revisão de 25/09/2026 — motor próprio em `src/rules/`

**A biblioteca saiu.** O motor de dados passou a ser próprio, em
[`src/rules/dice.ts`](../../src/rules/dice.ts), usado **pelo cliente e pelo servidor**. A decisão
original não estava errada para o problema que tinha — um rolador só do cliente. O que mudou foi o
problema: a Fase C (C.1, ARQ-02) exige **uma** implementação das regras para os dois lados, e a
biblioteca não pode ir para o servidor.

### Por que ela não serve para os dois lados

- **Gerador global.** O RNG da biblioteca é um singleton (`NumberGenerator.generator.engine`). Não
  dá para injetar um RNG por chamada — e o teste de paridade (C.10) precisa passar **a mesma fila**
  de dados para o cliente e para o servidor, na mesma execução.
- **O `mathjs` iria junto.** A biblioteca avalia a notação com o `mathjs`, que tem duas altas sem
  correção aplicável (B.6). No cliente isso era aceitável porque a fórmula era do próprio usuário. No
  servidor, a fórmula de dano vem **da ficha, que vem da rede** — exatamente o gatilho escrito na
  exceção de audit. Levar a biblioteca ao servidor transformaria uma exceção aceita num buraco.
- **Ela codificava a regra errada em dois pontos**, e a Fase C ia ter de contorná-la: o fumble
  "subtrai 1d10" (regra do Cyberpunk RED) estava no nosso invólucro, e a notação `1d10!` não
  distingue o fumble do primeiro dado de um 1 depois da explosão.

### O que o motor próprio precisa — e é pouco

d10 aberto (explosão encadeada com teto de segurança), fumble só no primeiro dado, fórmula de dano
`NdM±X` **sem avaliar expressão**, tabela de local de impacto e save. Tudo o que a biblioteca dava e
a decisão original listou como vantagem continua: a trilha auditável vira o `details` com cada dado
e cada parcela nomeada; o determinismo em teste vem do RNG injetado (`scriptedRng`).

### Consequências

- **Duas exceções a menos no portão de audit.** O `mathjs` saiu da árvore de dependências e a
  ALLOWLIST de `scripts/audit-ci.mjs` ficou vazia.
- **A página de dados perde notação livre.** Quem digitar `3d6+1d4` ou `1d6/2` recebe fórmula
  inválida, como a mesa já respondia desde a T5.4. Nenhuma arma do arsenal padrão usa outra forma.
  **Gatilho para ampliar o parser:** uma arma do livro com fórmula de divisão (`1D6/2`, `1D6/3`)
  entrar numa ficha de verdade.
- A suíte do rolador foi reescrita contra o RNG injetado; os testes que trocavam o gerador global
  da biblioteca saíram com ela.
