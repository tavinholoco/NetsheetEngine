# Histórico — Fase G: varredura do frontend

> Movido do [`PLANO_MESTRE.md`](../PLANO_MESTRE.md) no **terceiro corte (16/10/2026)**, junto com as
> Fases E e H, pelo método da [R.13](./AUDITORIAS_E_PENDENCIAS_R.md#-pendências-da-revisão-pós-d--antes-da-fase-e)
> e sem mudar o texto: só os caminhos de 7 links, que mudam porque o arquivo mudou de pasta. **Por
> quê:** com as três fases inline, o plano tinha ~1.600 linhas e ~66 mil tokens — quatro leituras da
> ferramenta do Claude —, e sessão fria que lê em pedaços pula coisa. A fase fechou em
> 13/10/2026 (código em 11/10). **Está fechada** — nada aqui é marcado de novo. O estado vivo é o do plano.

---

### FASE G — 🔍 VARREDURA: FRONTEND *(1–2 dias)*

Escopo: `src/components`, `src/features`, `src/pages`, `src/stores`, `src/hooks` — e, desde a
revisão de robustez, **`src/utils` e `src/lib`** (menos o `supabase.ts`, que é da L.4): os dois
somavam ~1.800 linhas **fora do escopo de qualquer varredura**. Vem **depois** da Fase F para não
varrer código que acabou de ser reestilizado. Segue o
[roteiro de uma varredura](../PLANO_MESTRE.md#o-roteiro-de-uma-varredura).

- [x] **G.0** 🔍 **Premissas** — medidas em 29/09/2026; conferir de novo no dia, e depois da F.
      *(10/10/2026 — as nove pistas conferidas contra o `master` em `c3e3375`: **todas bateram**, e as duas
      da G.1a **reproduziram** (o aviso do React no console; `/dice` aberto no dev termina em `/`). Mudou um
      número: o `MultiplayerRoom` tem **1.049** linhas. Tabela no topo do [ledger](../varreduras/G-frontend.md).)*
- [x] **G.1** Varredura por área → ledger em `docs/varreduras/G-frontend.md`.
      *(10/10/2026 — **25 itens: 7 FAZER (28%), 17 ADIAR, 1 DESCARTAR**, depois de recalibrar (a primeira
      passada deu 40%). As 9.170 linhas lidas inteiras; reproduzido no navegador — dev e build de produção
      local — e com script fora do repo. Nenhum achado de segurança aberto. O que depende de login ficou
      lido: o Supabase local não subiu.)*
  - [x] **G.1a Estado em dois lugares.** *(G.04 FAZER — reproduzido: o modal do Bio-Monitor congela no
        jogador de quando abriu. G.01, G.02, G.03 e G.05 ADIAR — as duas pistas reproduziram, mas só quem
        mantém o código as sente; G.05, os dois nomes do ferimento, só fica feio.)* Que estado existe em
        dois lugares e pode divergir?
        - `syncSheetStore(sheetResult)` no **corpo do render** (`App.tsx:69`). **Com sintoma** *(visto na
          C, 25/09)*: o React avisa a cada carga "Cannot update a component while rendering a different
          component". Anterior à Fase C (`7fe4f47`).
        - Os dois `useEffect` que sincronizam URL ↔ aba, com dois refs de guarda. **Com sintoma** *(visto
          na D.3, 28/09)*: em modo dev, **todo deep link** (`/room/X`, `/multiplayer`) volta para `/` — o
          `StrictMode` roda o efeito "aba → URL" duas vezes e a guarda só segura a primeira. Produção não
          tem o duplo efeito, e o E2E roda o build de produção.
        - A ficha local × a ficha na mesa (desde a decisão 7a, a mesa não aceita o ferimento do cliente).
  - [x] **G.1b Rede, sessão e espera.** *(G.06 FAZER — reproduzido: clique duplo aplica o dano duas vezes
        e, com o servidor lento, cria um assento órfão; nada na tela mostra espera. G.07 FAZER — reproduzido:
        o `deletePlayer` existe de ponta a ponta e **nenhum botão o chama desde a Fase 0** — a mensagem de
        mesa cheia manda o GM "remover alguém". G.08–G.11 ADIAR. Os estados das R têm mensagem certa.)* O que
        a tela mostra quando a rede falha, o token expira ou a resposta demora? *(A G olha a tela; o
        contrato é da I.)*
        - Os estados novos das R: `409 seat_taken` (R.1), `403 removed_by_gm` (R.3), `409 room_full`
          (R.16), `409 room_exists` (R.2).
        - **A espera de ~1 min** quando o Render acorda de hibernação ([free](https://render.com/docs/free)):
          a primeira ação depois de um tempo parado parece travada?
  - [x] **G.1c Teclado e foco.** *(Quase: todo controle da ficha é nativo e o foco é visível. G.12 FAZER —
        reproduzido: digitar 12 num atributo grava 15. G.13–G.15 ADIAR: o perfil e o grid só de mouse, e
        nome acessível para leitor de tela.)* Dá para operar a ficha só com teclado? *(Contraste, movimento e
        foco em modal são da F.4.2 — não repetir.)*
  - [x] **G.1d Efeitos, IDs e console.** *(G.16 DESCARTAR — o id da armadura não tem leitor. G.17 e G.18
        ADIAR para a L.5 — os 12 `console.*` e um evento sem ouvinte. G.19 ADIAR para a L.1 — o arrasto
        regrava o grid no Yjs, mas o reenvio da sala custa ~40× mais.)*
        - `createBlankCharacterSheet` (`useCharacterSheet.ts:46`) gera seis IDs de armadura no mesmo tick
          com `Date.now()` + sufixo curto.
        - **12** `console.*` no cliente sobrevivendo ao logger estruturado *(ARQ-07, parte 1; contados em
          29/09 — os 3 do `server/logger.ts` são o próprio logger)*.
        - ~~`StatBlock.handleSet` altera `stats` sem tocar em `currentStats`.~~ *Resolvida na C.6.*
  - [x] **G.1e Testes de componente** *(ARQ-08)*. *(G.20 ADIAR — seis dos sete FAZER são defeito de
        componente que nenhum teste pegaria; cada um traz o seu teste, e a tela sem sintoma não ganha.)*
        **27** componentes `.tsx` e **3** arquivos de teste
        que renderizam componente (`ui-smoke`, `combat-ui`, `invite-button`). Quais telas quebram sem
        ninguém ver? O filtro vale: teste novo só onde houve sintoma ou regra de jogo na tela.
  - [x] **G.1f Mapa de cortes** *(ARQ-05)*. *(G.21 — cortes em cinco arquivos, o `App` incluído, todos
        ADIAR com a L.3 de dona. O que mais barateia teste: os sockets do `MultiplayerRoom` num hook.)*
        `MultiplayerRoom` **1.028** *(1.049 em 10/10)*, `TacticalGrid` **792** (não
        estava na lista), `FriendsList` **723**, `CyberpunkMenu` **609**. Mesmo formato da E.1f — insumo
        da L.3, sem executar.
  - [x] **G.1g Regra de jogo e mesa** *(acrescentada na varredura, 10/10/2026: a leitura achou quatro
        defeitos fora das perguntas das áreas)*. *(G.22 FAZER — reproduzido: o NPC gerado não tem armadura
        no braço nem na perna esquerdos, e **3 em cada 10 acertos** nele ignoram a armadura. G.23 FAZER —
        a perda de Humanidade do cromo é sorteada de 2 a 8, qualquer que seja a fórmula do implante; duas
        fontes (S1, S8) dizem que é a do item. G.24 FAZER — reproduzido: o chat da mesa não acompanha a
        mensagem nova. G.25 ADIAR para a M.4 — as notas de versão chamam a v0.4.0 de atual.)*
- [x] **G.2** Calibragem e PR do ledger — passo X.2. *(10/10/2026 — calibragem feita: a primeira passada
      deu 10 FAZER em 25 (40%); com a pergunta 2 levada a sério, G.01, G.02 e G.05 viraram ADIAR — **7 em
      25, 28%**. Ledger mergeado no PR #39 em 11/10/2026, com a correção da ADR 0004 (G.09), sem mudança de
      veredicto; `master` verde nos 4 jobs.)*
- [x] **G.3** Executar só os FAZER — passo X.3. Os sete, cada um com o teste que o [ledger](../varreduras/G-frontend.md)
      nomeia **escrito antes** e a prova revertendo; um commit por item; G.3, G.4 e G.5 num PR só, como o
      #24 da E. Ordem pelo peso na mesa — os três primeiros mexem no combate:
      *(11/10/2026 — os sete, **+47 testes** em seis arquivos, cada um visto falhando com o código antigo e
      conferido na tela do build de produção local. Mais um commit de revisão: o WebSocket falso dos testes
      da mesa virou o `src/test/roomTransport.ts`.)*
  - [x] **G.3a** **G.22 — o NPC gerado ganha armadura no braço e na perna esquerdos**, com o SP das peças da
        direita (`utils/npcGenerator.ts:245–248`). Só dado; o servidor usa o mesmo gerador. NPC já gerado numa
        mesa aberta segue como está. Teste: `npc-armor` — cada arquétipo, os dois braços e as duas pernas
        com o mesmo SP.
        *(11/10/2026 — `npc-armor` (14), derivado de `HIT_LOCATIONS`: os 14 falham com o gerador antigo.)*
  - [x] **G.3b** **G.06 — clique duplo não repete a ação.** Duas peças: (1) `joinRoom` e `createRoom` devolvem
        a chamada **em voo** em vez de abrir outra, como o `reconnectInFlight` (`api/rooms.ts:106–114`) — cobre
        também a reentrada do `RoomPage` —, e os dois botões mostram "Entrando…"/"Criando…" desligados; (2)
        aplicar dano, NPC ataca e próximo turno ficam desligados enquanto a requisição está em voo. Teste:
        `double-click` — dois cliques com a resposta pendente fazem **uma** requisição.
        *(11/10/2026 — a tela usa o `useInFlight` (`src/hooks/`), uma ação por chave: o ref barra o clique
        que chega antes do render, o estado desliga o botão. `double-click` (7); provado por camada — sem a
        API, os 2 de API falham; sem a tela, os 4 de botão.)*
  - [x] **G.3c** **G.07 — o botão "Remover" do GM**, com `confirm()`, ao lado de cada outro jogador, chamando o
        `deletePlayer` que já existe (`MultiplayerRoom.tsx:459`). O servidor já barra quem não é GM (R.3) — a
        G.4 confere. Teste: `room-modals` — o GM vê o botão (não ao lado de si), o jogador não.
        *(11/10/2026 — ícone `UserX` no papel `fault` (ação destrutiva, decisão 10b), com nome para leitor de
        tela. `room-modals`, os 4 de G.07. Na tela: o `confirm` pergunta, o servidor tira o jogador e o chat
        registra.)*
  - [x] **G.3d** **G.04 — os dois modais leem o jogador da sala**: o estado guarda o `peerId`, não a cópia do
        `RoomPlayer` (`MultiplayerRoom.tsx:100–101`). Teste: no mesmo `room-modals`, a sala muda o ferimento
        com o modal aberto e o modal acende o nível novo.
        *(11/10/2026 — `room-modals`, os 2 de G.04. Na tela, o roteiro do ledger (clicar 5, depois 2): o
        modal acende 0–5 e depois 0–2. De carona: se o jogador sai, o modal fecha.)*
  - [x] **G.3e** **G.24 — o chat da mesa acompanha a mensagem nova**, só quando quem lê já está no fim (o
        `scrollIntoView` do `AiAssistant`). Teste: `room-chat`. *O jsdom não tem layout: o teste define
        `scrollHeight`/`clientHeight`/`scrollTop` à mão ou espia o `scrollIntoView`.*
        *(11/10/2026 — `scrollTop` na própria caixa, não `scrollIntoView` (que rolaria a página também). O
        gatilho é o id da última mensagem: no teto de 100 (E.3b) a contagem para de crescer — o teste pega.
        A caixa ganhou `role="log"`. `room-chat` (5).)*
  - [x] **G.3f** **G.12 — atributo digitado entra como digitado**: o texto é livre enquanto digita, e o grampo
        (2–15) roda no `blur` (`StatBlock.tsx:32–35`). Teste: `stat-input` — "12" grava 12; sair com 40 grava 15.
        *(11/10/2026 — o número entra assim que cabe na faixa; sair vazio devolve o valor que estava.
        `stat-input` (6): com o código antigo, "12" vira `'15'`, o sintoma do ledger.)*
  - [x] **G.3g** **G.23 — a perda de Humanidade sai da fórmula do implante.** **Começa pela conferência:** a
        linha da regra com as duas fontes, S8 e S1 (a evidência está no G.23 do ledger), antes do código. A
        rolagem mora em `src/rules/` (o motor único), com o RNG injetado: fórmula `NdM±X` rola pelo parser que
        existe (`parseDamageFormula`, `rules/dice.ts:153`), número usa o número, e o que o parser não lê
        (`1d6/2`, `0.5`) o jogador digita. Teste: `cyberware-humanity` — nunca um valor fora do que a fórmula
        permite.
        *(11/10/2026 — a linha na [conferência](../CONFERENCIA_CP2020.md#atributos-correntes), com a S8 lida de
        novo; `rollHumanityLoss` e `humanityCostIsReadable` em `rules/character.ts`. `cyberware-humanity`
        (9): com o sorteio antigo, um `1d6` deu 8.)*
  - [x] **G.3h** **Revisão do código da G.3** *(pedido do dono depois do merge do #41, 11/10/2026)*: o diff
        inteiro lido de novo atrás de inconsistência, erro de lógica e defeito, e cada achado pelo filtro.
        **Quatro consertos e dois documentos corrigidos**, cada conserto com o teste antes; **quatro ADIAR**.
    - [x] **O modal de quem saiu reabria sozinho** (defeito da G.3d). O estado guardava o `peerId` e não o
          esquecia; quem sai pelo "Sair" volta com o **mesmo** `peerId` (o `sessionStorage` o guarda), e o
          Bio-Monitor ou a inspeção reabriam na tela do GM. `room-modals` +2; conferido no navegador (o
          jogador sai e volta pela API, e o modal continua fechado).
    - [x] **O "Remover" não avisava que a pessoa não volta pela mesma aba** (G.3c × R.3): o servidor recusa a
          volta daquele `peerId` (`removed_by_gm`). O `confirm` diz agora. `room-modals` +1.
    - [x] **A perda de Humanidade digitada é inteira, e o campo não dizia** (G.3g): `1d6/2` dá fração na S8,
          o `actualHL` é inteiro, e "2.5" deixava o "Instalar" mudo — o defeito do G.09. O rótulo pede o
          inteiro; a fração virou **ADIAR** na [conferência](../CONFERENCIA_CP2020.md#atributos-correntes)
          (é formato persistido). `cyberware-humanity` +1.
    - [x] **Dois testes do `double-click` terminavam com a resposta resolvendo depois** do teste, escrevendo
          na store do seguinte. Agora esperam — e o do próximo turno prova que a trava **solta** (com o
          `useInFlight` sem soltar a chave, ele falha).
    - [x] **Documentos:** a convenção do `useInFlight` no `CLAUDE.md` dizia "todo botão que manda ação ao
          servidor", mais largo que o código; e o [protocolo](../PROTOCOLO_MULTIPLAYER.md) ganhou a regra que
          a G.06 criou — nunca dois `join` em paralelo — e o limite dela.
    - **ADIAR**, cada um com gatilho:
      - "Gerar NPC", "Gerar Jogador" e "Rolar iniciativa" **sem a trava**: em dobro, um NPC ou uma ficha a
        mais, ou a iniciativa rolada duas vezes — à vista de todos e desfazível (o "✕" do NPC em dobro só
        reenvia a sala, sem erro). **Gatilho:** acontecer numa sessão real ou na H.1a. Versão de uma linha:
        o `run` do `useInFlight`, como nos outros.
      - A perda digitada aceita até 999, e o `sheetSchema` grampeia 100 por implante quando a ficha entra
        na mesa — a ficha local e a da mesa divergiriam. **Gatilho:** alguém digitar acima de 100 (nenhuma
        fórmula do livro passa de 3d6).
      - O cartão do token remonta (`key={token.id}`) ao trocar de token, e a trava de dano e ataque começa
        de novo. **Gatilho:** o GM trocar de token e voltar no meio de uma resposta lenta, e repetir a ação.
      - O `reconnectSession` não compartilha a trava do `joinRoom`. Hoje não se cruzam; o caminho em que
        cruzariam está no protocolo. **Gatilho:** a H.1c ou a H.1e, que mexem nele.
- [x] **G.4** 🔒 Portão, se a G.3 mudou código — passo X.4. *(11/10/2026 — entrada no
      [registro](../SEGURANCA.md#fase-g--varredura-frontend), sem achado novo: nenhuma rota nem sessão nova;
      dois `join` seguidos viram um — menos sessões emitidas; +230 bytes por NPC no reenvio da sala. A G.3h
      ganhou um adendo, também sem achado.)*
- [x] **G.5** 🧠 Estado durável — passo X.5. *(11/10/2026 — caixas, ledger com os sete FAZER marcados, linha
      de base (**796** testes, 57 arquivos), E2E 7/7, `audit:colors` e conflitos em 0, o PR #41 (G.3–G.5) e o
      #42 (G.3h). **Passo 6 conferido nos dois:** depois do #41 (11/10) e do #42 (13/10), o `master` ficou
      verde nos 4 jobs, com o `db-sync` em dia ("Remote database is up to date" — a G não teve migration).
      No fechamento, os ADIAR da G com gatilho na H e na I foram levados à H.0 e à I.0, como a E fez.)*
- [x] ✅ **Fase G concluída em:** 13/10/2026 *(código em 11/10)*
