# Histórico — Fase E: varredura do backend

> Movido do [`PLANO_MESTRE.md`](../PLANO_MESTRE.md) no **terceiro corte (16/10/2026)**, junto com as
> Fases G e H, pelo método da [R.13](./AUDITORIAS_E_PENDENCIAS_R.md#-pendências-da-revisão-pós-d--antes-da-fase-e)
> e sem mudar o texto: só os caminhos de 9 links, que mudam porque o arquivo mudou de pasta. **Por
> quê:** com as três fases inline, o plano tinha ~1.600 linhas e ~66 mil tokens — quatro leituras da
> ferramenta do Claude —, e sessão fria que lê em pedaços pula coisa. A fase fechou em
> 30/09/2026. **Está fechada** — nada aqui é marcado de novo. O estado vivo é o do plano.

---

### FASE E — 🔍 VARREDURA: BACKEND *(1–2 dias)*

Escopo: `server.ts` e `server/*` — **7 arquivos, ~3.400 linhas** em 29/09/2026 *(a lista antiga tinha
quatro; faltavam `supabaseAuth.ts`, `aiPrompt.ts` e `wsLimits.ts`)*. Segue o
[roteiro de uma varredura](../PLANO_MESTRE.md#o-roteiro-de-uma-varredura).

- [x] **E.0** 🔍 **Premissas** — as pistas de cada área abaixo foram **medidas em 29/09/2026** (revisão
      de robustez). Conferir de novo no dia de abrir: o código anda.
      *(30/09/2026 — as 13 pistas conferidas contra o `master` em `7fdb7bb`: **todas bateram**, linha e
      contagem — tabela no topo do [ledger](../varreduras/E-backend.md). O fuso do chat reproduziu de
      novo: o mesmo instante, `01:02` em UTC e `22:02` em São Paulo.)*
- [x] **E.1** Varredura por área → ledger em `docs/varreduras/E-backend.md`, sem tocar em código.
      *(30/09/2026 — **24 itens: 6 FAZER (25%), 17 ADIAR, 1 DESCARTAR.** As 3.404 linhas lidas inteiras;
      o que dava para reproduzir foi reproduzido fora do repositório. Dois FAZER eram achados de segurança
      abertos — **SEC-14 e SEC-15** —, consertados antes do ledger a pedido do dono: E.3a–b.)*
  - [x] **E.1a Erros e status.** *(E.01 FAZER — reproduzido: `join` com código errado mostra "Room not
        found" em inglês na tela; chat vazio → 403; mesa cheia → 403 na ficha gerada e 409 no `join`. E.21
        e E.22 ADIAR.)* Todo caminho de erro devolve o status certo e uma mensagem tratável?
        Uma linha por rota: status × mensagem × `code`.
        - **Hoje são três jeitos de classificar erro:** o `respondWithResult` por substring em
          português (`server.ts:283` — renomear uma mensagem muda o status da API); o
          `respondToCombat` da D.1 por `startsWith`/regex (`:641`); e o `code` estável que a R.1
          estreou em quatro respostas (`seat_taken`, `room_exists`, `removed_by_gm`, `room_full`).
        - **A E é dona do `code` no servidor** — a versão 10× menor da
          [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457): o status sai do `code`, e a mensagem muda
          à vontade. A I só confere que o cliente decide por ele (o `ApiError.code` já existe).
  - [x] **E.1b Estado que cresce.** Todo `Map`, `Record` e array do servidor: quem limita, quem recolhe?
        *(E.02 e E.03 FAZER — viraram SEC-14 e SEC-15, já consertados; E.04, E.05, E.20, E.24 e E.25 ADIAR;
        E.23 DESCARTAR — o Render já comprime.)*
        - **NPCs sem teto** (`generateRoomNpc`, `roomManager.ts:671`) — cada NPC também vira token no
          grid, e a mensagem de iniciativa da D.4 cresce com eles. Só o GM gera. *(portão da D.9)*
        - **Chat:** o teto de 100 mensagens vale em dois caminhos (o chat do jogador, `:996`, e o
          `pushSystemMessage`, `:1112`); os outros oito `push` à mão dependem do próximo com teto.
        - **`updateTacticalGrid` grava o `gridState` como veio** (`:666`) — a rota só confere
          `typeof object`. A mesma classe do `updateInitiative` que a D.4 fechou. Só o GM chega lá.
        - **Socket morto.** O servidor não manda `ping`: socket que caiu sem aviso fica no `wsClients`
          recebendo broadcast até o TCP desistir. A presença (heartbeat de 20 s) já marca o jogador
          offline — o custo é o buffer do socket morto, não um "online" falso. O
          [README do `ws`](https://github.com/websockets/ws#how-to-detect-and-close-broken-connections)
          recomenda ping a cada ~30 s com `terminate()`. Sintoma a procurar: memória subindo com a
          mesa aberta.
  - [x] **E.1c Concorrência e ciclo de vida.** Que suposição quebra se duas requisições chegarem
        juntas? O Node é uma thread: o risco mora nos `await` — persistência com debounce × `deleteRoom`,
        verificação do JWT na rota da IA.
        *(E.07 FAZER — reproduzido: remover alguém da iniciativa no meio da rodada **pula a vez** de outro.
        E.06 ADIAR, com regra de processo já: **todo deploy roda duas instâncias por ≥60 s** (doc do
        Render) — não mergear com mesa aberta. E.08, E.09 e E.19 ADIAR.)*
        - *Conferido:* o `listen` só acontece depois do `await restoreRoomsFromDb()`
          (`server.ts:1339` → `:1373`) — nenhuma requisição chega antes do restore.
        - **Shutdown:** `flushAllPending()` e `process.exit(0)` sem fechar sockets (`:1421`). O Render
          dá **30 s** entre o `SIGTERM` e o `SIGKILL` ([deploys](https://render.com/docs/deploys)) —
          algo se perde nesse intervalo?
  - [x] **E.1d Dado montado como texto.** O que o servidor formata que devia mandar como dado?
        *(E.10 FAZER — o horário do chat. E.11 e E.12 ADIAR; o modelo 2.5 segue sem data de desligamento,
        com acesso limitado a quem já usava — conferir com uma pergunta ao Netrunner IA no ar.)*
        - **O horário do chat sai no fuso do servidor — reproduzido em 29/09.** São 12 chamadas de
          `toLocaleTimeString("pt-BR")` no `roomManager` (11 à mão e o `chatTime` da D), e o cliente
          mostra a string como veio (`MultiplayerRoom.tsx:687`). O Render roda em **UTC**
          ([comunidade do Render](https://community.render.com/t/date-time-server/5598)): às 22:02 de
          Brasília, a mesa em produção mostra **01:02**. `TZ=UTC node -e "…toLocaleTimeString…"`
          reproduz. Ninguém viu porque o dev local roda no fuso do Brasil e nenhum teste olha o
          horário. **É sintoma pronto para o filtro:** aparece na primeira sessão em produção.
        - `code.toUpperCase()` em **25** pontos (12 no `server.ts`, 10 no `roomManager`, 3 na
          persistência) — normalização sem dono.
        - **Modelo de IA fixo** (`gemini-2.5-flash`, `server.ts:421`). Desde 18/09/2026 o Google limita
          os modelos 2.5 a quem já os usava, sem data de desligamento
          ([descontinuações](https://ai.google.dev/gemini-api/docs/deprecations)). Ler o nome de uma
          variável de ambiente é uma linha — gatilho na [ADR 0005](../adr/0005-provedor-de-ia.md).
  - [x] **E.1e Logs e gatilhos.** Todo `catch` registra? Nenhum segredo sai?
        *(Nenhum segredo sai — conferido. E.13 FAZER, só documento: o Registro de sessões ganha
        `unhandled_error`, `persistence_save_failed` e `rooms_full`. E.14 ADIAR: o `sse_fallback` conta
        queda de rede, não só proxy — premissa levada à H.0. E.15 e E.16 ADIAR.)*
        - *Medido:* a persistência **não engole** erro — `save`, `delete` e `restore` registram
          `warn`, e o save tenta de novo. Mas o log vive 7 dias e ninguém o lê: engolido na prática.
        - **Listar os eventos que são gatilho de algum ADIAR** (`sse_fallback`, `gemini_api_error`,
          `ws_rate_limited`, `persistence_save_failed`, `ws_invalid_yjs_frame`, `unhandled_error`) e
          conferir que é esta a lista do [Registro de sessões](../PLANO_MESTRE.md#registro-de-sessões).
        - ~~`(ws as any)._peerId`~~ — *resolvida na R.3: virou `WeakMap`.* Restam **7** `any` no
          `server.ts` (o `flush` do SSE, o `catch` da IA, o awareness e a mensagem do WebSocket, o
          handler de erro do Express).
  - [x] **E.1f Mapa de cortes** *(ARQ-05)*. *(E.18 — seis cortes no `roomManager`, cinco no
        `server.ts`, todos ADIAR com a L.3 de dona. O que mais barateia teste é o do `server.ts`.)* O `roomManager` tem **1.579 linhas** (1.035 na auditoria,
        1.461 depois da D) e o `server.ts`, **1.436**. Propor os cortes — sessão / autorização / regras
        / NPCs / chat; rotas / realtime / Yjs — **sem executar**, com veredito próprio. É o insumo da
        L.3: sem este mapa, a L.3 não tem de onde partir.
- [x] **E.2** Calibragem e PR do ledger — [roteiro](../PLANO_MESTRE.md#o-roteiro-de-uma-varredura), passo X.2.
      *(30/09/2026 — calibragem: 6 FAZER em 24, **25%**, abaixo de 1/3; a régua não precisou de ajuste.
      Ledger mergeado no PR #23, depois do #22 (segurança); `master` verde nos 4 jobs.)*
- [x] **E.3** Executar só os FAZER — passo X.3. *(30/09/2026 — os seis, cada um com teste antes e prova revertendo.)*
  - [x] **E.3a** 🔒 **SEC-14 — grid malformado derrubava o processo** (E.02 do ledger). *(30/09/2026 —
        adiantado a pedido do dono, num PR de segurança antes do ledger: o Render volta em 01/10.)* A
        forma do grid é validada nas duas portas (REST → `400 invalid_grid`; Yjs → revertido, GM
        inclusive), e o reenvio e o vigia de presença não deixam erro escapar. `grid-integrity` (9);
        provado revertendo por camada. Texto e portão em [`SEGURANCA.md`](../SEGURANCA.md#fase-e--varredura-backend).
  - [x] **E.3b** 🔒 **SEC-15 — tetos de tamanho** (E.03 do ledger). *(30/09/2026, no mesmo PR.)* 30 salas
        (`MAX_ROOMS`), 32 NPCs, ficha de 64 KB, chat de 100 em todo caminho, 1 MiB por socket que não lê;
        o restore não traz sala abandonada. `room-limits` (9); provado revertendo teto a teto.
        **Decisão do dono (30/09):** criar sala **não** passa a exigir login no servidor — ADIAR, gatilho
        em [`SEGURANCA.md`](../SEGURANCA.md#fase-e--varredura-backend).
  - [x] **E.3c** **E.01 — todo erro com `code`, e o status sai do `code`.** Um conjunto fechado de códigos
        e uma tabela `code → status`; `respondWithResult` e `respondToCombat` viram uma função; as mensagens
        em inglês vão para o português. Teste primeiro: `error-codes.integration`, uma linha por caminho de
        erro (os casos reproduzidos no ledger falham hoje). Os quatro `code` da R e os quatro da E.3a–b
        ficam como estão.
        *(30/09/2026 — `server/errors.ts` tem os códigos e a tabela; no `roomManager`, o tipo `RoomResult`
        torna o `code` obrigatório — o compilador não deixa erro sair sem ele; no `server.ts`,
        `sendError` é a única saída. O erro pelo WebSocket também leva `code`, e `/api` desconhecida é 404
        em JSON em todo ambiente. De carona: a iniciativa sem `action` nem lista reenviava a sala a todos
        sem conferir o GM — agora 400. **Três testes antigos fixavam o defeito** ("Room not found", chat
        vazio 403, estabilizar fora de Mortal 400) e foram trocados com o porquê. `error-codes` (32);
        provado revertendo: os 32 falham com o código antigo.)*
  - [x] **E.3d** **E.07 — tirar alguém da iniciativa não pula a vez de outro.** Um helper só para os três
        caminhos (`deleteRoomNpc`, `deleteGeneratedPlayer`, `leaveRoom`), que mantém a vez com quem a tinha
        — ou passa ao seguinte, se foi ele que saiu. Teste primeiro: `initiative-removal`, com os três casos
        do ledger e a saída de um jogador antes da vez.
        *(30/09/2026 — `removeFromInitiative`: quem tinha a vez segue com ela; se foi ele que saiu, a vez
        passa ao seguinte e o turno dele começa, com o death save de Mortal (`beginTurn`, extraído do
        `nextTurn`). Achado no conserto: remover o NPC pelo **nome** deixava a entrada dele na iniciativa.
        `initiative-removal` (8); provado revertendo: 7 falham com o filtro antigo.)*
  - [x] **E.3e** **E.10 — o horário do chat no fuso de Brasília.** Um formatador só, com
        `timeZone: "America/Sao_Paulo"`, no lugar das 12 chamadas. Teste primeiro: `chat-time`, com o
        processo em UTC. *(A versão maior — o instante em ISO, formatado no cliente — é ADIAR: jogador de
        outro fuso.)*
        *(30/09/2026 — `chatTime()` e `CHAT_TIME_ZONE` no `roomManager`. `chat-time` (2) põe o processo em
        UTC: sem isso, passaria nesta máquina e falharia só no CI. Provado revertendo o `timeZone`.)*
  - [x] **E.3f** **E.13 — o Registro de sessões lê os eventos que faltavam.** *(30/09/2026, no PR do
        ledger — só documento.)* A [tabela](../PLANO_MESTRE.md#registro-de-sessões) ganha `unhandled_error`,
        `persistence_save_failed` e `rooms_full`, e a ressalva do `sse_fallback` (E.14).
- [x] **E.4** 🔒 Portão, se a E.3 mudou código — passo X.4. *(30/09/2026 — duas entradas no
      [registro](../SEGURANCA.md#fase-e--varredura-backend): a E.3a–b, com os achados SEC-14 e SEC-15, e a
      E.3c–e, sem achado novo.)*
- [x] **E.5** 🧠 Estado durável — passo X.5. *(30/09/2026 — caixas, linha de base (**651** testes, 45
      arquivos), E2E, o PR #24. **Passo 6 conferido:** depois do merge do #24, o `master` ficou verde nos 4
      jobs, com o `db-sync` em dia ("Remote database is up to date" — a E não teve migration).)*
- [x] ✅ **Fase E concluída em:** 30/09/2026
