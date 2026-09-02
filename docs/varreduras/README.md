# 🔍 Ledgers das varreduras

Casa dos resultados das **Fases E e G–J** do [`PLANO_MESTRE.md`](../PLANO_MESTRE.md).

Cada varredura produz **um arquivo**, e o arquivo é o entregável — mesmo que nenhum item vire código.
Uma varredura que não gerou ledger não aconteceu.

| Arquivo | Fase | Escopo |
|---|---|---|
| `E-backend.md` | E | `server.ts`, `server/*` |
| `G-frontend.md` | G | `src/components`, `src/features`, `src/pages`, `src/stores`, `src/hooks` |
| `H-multiplayer.md` | H | WebSocket, SSE, Yjs, awareness, reconexão, presença |
| `I-integracao.md` | I | `src/api/*` contra os endpoints do Express |
| `J-seguranca.md` | J | Superfície completa de autenticação, autorização, entrada e saída |

> A **Fase F** fica entre E e G e **não é varredura** — é reestruturação visual do frontend
> (construção). Redesign e caça a bug têm posturas opostas: o filtro abaixo tem ADIAR como padrão e
> mataria um redesign, que é discricionário por natureza. Por isso são fases separadas, e a
> reestruturação vem antes de varrer o código que ela reescreve.

---

## Os dois tempos

**Não misture.** Achar um problema e já consertar é irresistível, e é exatamente assim que o filtro
morre.

1. **Achar e classificar** — sem tocar em código. Preencher o ledger inteiro, com veredito em cada
   linha.
2. **Executar** — apenas os itens marcados FAZER.

## A regra de calibragem

**Se mais de 1/3 dos itens virar FAZER, o critério está frouxo.** Recalibre a régua e passe a lista
de novo. A resposta agradável ("tudo isso é importante") é o sintoma de que o filtro não foi
aplicado.

---

## Modelo de ledger

Copie o bloco abaixo ao abrir uma varredura.

```markdown
# Varredura X — <escopo>

**Data:** __/__/____
**Timebox:** __ dias
**Itens levantados:** __ · **FAZER:** __ · **ADIAR:** __ · **DESCARTAR:** __
**Proporção FAZER:** __% (se > 33%, recalibrar e repassar)

---

## X.01 — <título curto do achado>

**Sintoma observado:** <bug reproduzível, número errado, erro no log, incômodo sentido jogando.
"Seria mais limpo se…" NÃO é sintoma — se a resposta aqui for vazia, o veredito é ADIAR.>

**Onde:** `arquivo.ts:linha`

**Quem sente hoje:** você / jogador / GM / ninguém ainda

**Se eu não fizer:** nada · fica feio · dá retrabalho · perde dado · vaza dado

**Versão 10× menor:** <existe? qual? se existir, é ELA que segue no filtro>

**Reversível:** sim / não (schema, contrato de API ou formato persistido = não)

**VEREDITO:** FAZER | ADIAR | DESCARTAR
- Se FAZER → teste que reproduz o sintoma: `<caminho do teste>`
- Se ADIAR → **gatilho:** "quando <condição verificável>"
- Se DESCARTAR → **razão:** "<uma linha, para a ideia não voltar na próxima varredura>"
```

---

## Por que isto existe

O projeto tem as provas de que o filtro é necessário:

- **`combatModifier`** foi construído de ponta a ponta — validação, clamp em ±10, persistência,
  broadcast, exibição na UI — e nenhuma rolagem o lê.
- **`currentStats`** existe no tipo, é escrito a cada edição, é persistido — e não tem um único
  leitor no repositório.
- **Seis configurações de deploy** para um serviço que roda num lugar só.
- **Cinco tabelas de lifepath** escritas antes de o dano virar ferimento.

Todos passariam pela pergunta 1 com um "não". É esse tipo de trabalho que o filtro devolve para a
fila — e é bastante trabalho.
