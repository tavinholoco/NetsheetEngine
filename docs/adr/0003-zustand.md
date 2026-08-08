# ADR 0003 — Estado global com Zustand

- **Status:** Aceito
- **Data:** 08/08/2026
- **Decisores:** Desenvolvimento (Fase 4, T4.1–T4.4)
- **Fase do plano:** Fase 4 — Estado Frontend

## Contexto

O `App.tsx` concentrava todo o estado da aplicação e o distribuía por
**prop drilling**: `sheet`, `user`, `rollHistory`, `activityStatus` e dezenas
de callbacks desciam por `SheetPage`, `DiceRoller`, `AiAssistant`,
`MultiplayerRoom`, `PresetsManager` e `UserProfile`. Sintomas:

1. **Prop drilling profundo** — componentes de folha recebiam props que não
   usavam só para repassar.
2. **Re-renders em cascata** — qualquer mudança na ficha re-renderizava a
   árvore inteira de componentes filhos.
3. **Estado duplicado** — o `MultiplayerRoom` mantinha estado de sala local,
   impossibilitando outros componentes de reagir (ex.: HUD de status da mesa
   no menu).
4. Havia migração planejada (o próprio `prdData.ts` citava "migração
   planejada para Zustand").

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| **Context API** | Nativo do React, zero dependência | Re-render de todo consumidor do contexto; boilerplate de providers; performance ruim para estado de alta frequência |
| **Redux Toolkit** | Ferramentas maduras, devtools | Muito boilerplate (actions/reducers/slices) para o tamanho do app; curva de aprendizado |
| **Zustand** (escolhida) | Store sem provider; seletor por slice (re-render só em quem consome); ~1KB; API mínima | Padrão diferente do Context (decisão de equipe); é uma dependência a mais |

## Decisão

Adotar **Zustand 5** com **quatro stores** por domínio:

- **`useSheetStore`** — ficha ativa, user, roster; espelha o hook
  `useCharacterSheet` (que segue como fonte de verdade da persistência
  cloud/local) via `syncSheetStore`.
- **`useRoomStore`** — view (lobby/active), sala (`GameRoom`), sessão
  (peerId + token), listagem de salas ativas e mensagens de erro.
- **`useRollStore`** — histórico de rolagens e banner de resultado.
- **`useUiStore`** — aba ativa, modal de auth, toast de salvamento e flag de
  salvamento.

O `App.tsx` passou a consumir as stores com **selectors** (re-render só na
fatia consumida), e o `MultiplayerRoom` migrou o estado de sala para a
`useRoomStore` — preparando o terreno para o router (Fase 7) e para qualquer
componente reagir ao estado da mesa.

## Consequências

**Positivas:**

- Fim do prop drilling: `SheetPage`, `DiceRoller`, `UserProfile` etc. leem
  das stores diretamente.
- Re-renders seletivos (selector por slice).
- `useRoomStore` permitiu o deep link `/room/:code` (T7.1/T7.4) injetar o
  código e reconectar sem cascata de props.
- Sessão de sala persistida em `sessionStorage` e hidratada no reload via
  `hydrateSession()` (T7.4).

**Negativas / custos:**

- Duas fontes de estado para a ficha (hook + store) — mitigado com o
  `syncSheetStore` (espelho unidirecional).
- Estado global de ficha precisa de cuidado com re-renders em formulários de
  alta frequência (autosave) — aceitável na prática.

## Referências

- `src/stores/useSheetStore.ts`, `useRoomStore.ts`, `useRollStore.ts`,
  `useUiStore.ts`.
- Fase 4 do `PLANO_DE_ACAO.md` (T4.1–T4.4).
