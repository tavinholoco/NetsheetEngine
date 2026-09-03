# Ledgers das varreduras

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
> (construção). Redesign e caça a bug têm posturas opostas: o filtro tem ADIAR como padrão e mataria
> um redesign, que é discricionário por natureza.

## As regras

Estão no plano, não aqui — [o filtro de necessidade](../PLANO_MESTRE.md#-filtro-de-necessidade)
define as cinco perguntas, os três veredictos, a separação em dois tempos (*achar e classificar*,
depois *executar só os FAZER*) e a regra de calibragem de 1/3.

**Este arquivo não repete essas regras de propósito.** Regra escrita em dois lugares vira duas regras
diferentes em três meses.

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

## Varreduras já realizadas fora das fases

| Data | Escopo | Resultado |
|---|---|---|
| 02/09/2026 | Overengineering em dependências, arquitetura e no próprio plano | 6 pacotes npm e 8 arquivos removidos; Yjs analisado e **adiado com gatilho** ([ADR 0002](../adr/0002-yjs-websockets.md#revisão-de-02092026--o-crdt-continua-mas-sob-observação)); fallback SSE marcado para **medir antes de decidir**; 2 dos 3 cortes propostos ao plano **rejeitados na avaliação** |
