# ADR 0004 — Motor de dados com @dice-roller/rpg-dice-roller

- **Status:** Aceito
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
- **52/52 testes determinísticos** (`scripts/test-dice-engine.ts`): explosão
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
- `scripts/test-dice-engine.ts` — suíte determinística (52/52).
- Fase 6 do `PLANO_DE_ACAO.md` (T6.1–T6.4).
