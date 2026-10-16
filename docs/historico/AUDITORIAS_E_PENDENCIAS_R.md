# Histórico — as auditorias do plano e as pendências R

> Movido do [`PLANO_MESTRE.md`](../PLANO_MESTRE.md) no **segundo corte da R.13 (10/10/2026)** — o gatilho
> era o R.15 marcado —, sem mudar o texto: só os caminhos de 21 links, que mudam porque o
> arquivo mudou de pasta. Aqui ficam a auditoria das afirmações do plano (03/09), a revisão pós-D
> (29/09) e o bloco R inteiro (29/09–10/10). **Está fechado** — nada aqui é marcado de novo. O estado
> vivo é o do plano.

---

## 🔬 AUDITORIA DAS AFIRMAÇÕES DESTE PLANO (03/09/2026)

Feita na Fase A, a pedido do dono, depois que dois defeitos apareceram no mesmo dia. **Todos os
defeitos encontrados são da mesma classe: afirmação escrita a partir de leitura de arquivo, sem
verificar o estado real.** As afirmações sobre *código* se sustentaram; as sobre *estado de
configuração* não.

### Confirmadas por medição

| Afirmação | Medido |
|---|---|
| 141 testes, `tsc` limpo | 141/141, 0 erros ✅ |
| 6 vulnerabilidades (3 altas, 3 moderadas) | exato ✅ |
| Bundle 1,34 MB / 390 KB gzip | 1.335,78 kB / 389,56 kB ✅ |
| `combatModifier` não é lido por rolagem nenhuma | 12 ocorrências: tipo, testes, clamp e persistência. **Zero leituras** ✅ |
| `currentStats` sem um único leitor | 7 ocorrências, todas escrita/tipo/teste. **Zero leituras** ✅ |
| Tokens de cor com 0 consumidores | 0 usos dos 8 tokens em `.tsx` ✅ |
| ARQ-05: 4 arquivos concentram ~4.000 linhas | 3.909 ✅ |
| ~1.700 cores literais em `.tsx` | 1.670 ✅ |

### Corrigidas

| Onde | O plano dizia | O real |
|---|---|---|
| **DOC-03** | secrets do `db-sync` pendentes | **Os dois já existiam.** O job estava vivo e **falhando em todo push no `master`** desde 02/09 — não inerte |
| **A.5** | ativar PITR | PITR exige plano pago; colide com o custo zero → decisão 4 |
| **SEC-06** | cadeia `express → body-parser → qs` | Três pacotes independentes: `qs`, **`mathjs`** e **`nanoid`**. A correção da B.6 é maior que o descrito |
| **F.2** | 5 tokens no `@theme` | 8 tokens *(a conclusão — 0 consumidores — permanece)* |
| **F.2** | `scanline`/`glitch` com 0 componentes usando | Correto para as **animações**. Mas existe uma classe estática `.crt-scanlines` em uso no `HomePage.tsx:38` — nem tudo da identidade está desligado |

### O que isso implica para as próximas fases

Antes de executar um item, **verifique a premissa dele** em vez de confiar no texto. As fases E e
G–J já têm isso embutido (varredura é verificação), mas B, C, D, F e K executam a partir de
descrição — e é ali que uma premissa velha vira trabalho errado.

---

## 🔬 REVISÃO PÓS-D (29/09/2026)

Pedida pelo dono depois do merge da Fase D: rever as fases que faltam, achar inconsistências e
pesquisar melhorias. **Mesmo método da auditoria de 03/09 — medir, não ler.** E o mesmo resultado de
classe: as afirmações sobre **regra de jogo** se sustentaram; as sobre **configuração** e sobre
**quem ganha sessão na mesa** não.

Linha de base conferida antes de tudo: `master` em `55a0acd`, CI e keepalive verdes, `tsc` 0 erros,
**522/522** testes em 26 arquivos.

### Premissas que caíram

| Onde | O plano dizia | O real | Fonte |
|---|---|---|---|
| **Decisão 4** | "O free tier já faz backup diário automático" | **Não faz.** O Supabase só faz backup automático dos planos Pro, Team e Enterprise, e recomenda que o gratuito exporte com `db dump`. **Hoje o projeto não tem backup nenhum** | [Supabase — backups](https://supabase.com/docs/guides/platform/backups) |
| **Decisão 3** | público da alpha = convidados do dono | O produto **não tem convite**: `GET /api/rooms` lista toda sala a qualquer visitante, e `POST /join` aceita quem souber o código. O "convidado hostil" do portão é, na prática, **qualquer pessoa com a URL** | `server.ts` |
| **B.6 / SEC-06** | `qs` sem patch na linha 4.x do Express | **O gatilho disparou:** saiu o `express@4.22.3` (tag `latest-4`), que pede `qs ~6.16.0`, fora da faixa vulnerável (`≤ 6.15.3`). `npm audit fix` fecha as 3 moderadas | `npm view express dist-tags`, `npm audit` |
| **B.7 → L.6** | decidir o SSE com "meses de mesa" do log `sse_fallback` | O plano Hobby do Render **guarda log por 7 dias**. Sem registro fora do Render, o dado da L.6 some antes de ser lido | [Render — logging](https://render.com/docs/logging) |
| **Versão do Node** | *(nenhuma — ninguém fixou)* | `engines: ">=20"` e nenhum `.node-version`: o Render resolve faixa sem teto para o **`latest`**, hoje o **Node 26 (Current, não LTS)**. O CI testa o 20 — **fim de vida em 30/04/2026** — e o 22; o dev local roda o 24. A produção roda uma versão que ninguém testa | [Render — Node](https://render.com/docs/node-version), [calendário do Node](https://github.com/nodejs/Release/blob/main/schedule.json) |
| **L.2** | "Revisar se `motion` paga o próprio peso"; Supabase como "maior contribuinte do 1,3 MB" | O `motion` saiu na ARQ-10 (02/09) e o chunk de entrada é **629 kB** desde a C.1 | `package.json`, linha de base |
| **F.2** | 5 tokens no `@theme`; 1.722 cores literais | **8** tokens (a auditoria de 03/09 corrigiu o índice, a tabela da F ficou) e **1.731** cores literais | grep em 29/09 |
| **J** | "gitleaks sobre o histórico completo, não só o HEAD" | **Já é assim:** o job do CI faz checkout com `fetch-depth: 0` e o `gitleaks detect` varre o histórico | `ci.yml` |
| `package.json` | *(versão acompanha a tag)* | `version` parado em **0.4.0** com a tag em `v0.4.3` — o `/api/health` publica a versão errada | `server.ts:6` |
| `PRODUCTION_CHECKLIST.md` | *(corrigido na Fase A, junto com o `DEPLOY.md`)* | **Não foi.** Ainda manda ligar **UptimeRobot no `/api/health`** (a regra 3 do custo zero proíbe), "confirmar backups diários automáticos" e diz que o `db-sync` é inerte | o próprio arquivo |
| `ARQUITETURA.md`, `ci.yml` | "Groq previsto na Fase B"; `db-sync` "INERTE", "0001–0006" | A B não migrou o provedor (ADR 0005); o job nunca foi inerte (A.5) e há 7 migrations | ADR 0005, A.5 |

### Achados novos no código

Os quatro primeiros foram **reproduzidos** com um script contra o `roomManager` (fora do repo). São
**anteriores à Fase D** — nascem da T1.7 e da T3.3 do plano antigo — e passaram pelo portão da B
porque o portão pergunta sobre *o que a fase mudou*, e ali mudou quem **usa** a sessão, não quem a
**recebe**. A pergunta 3 do portão ganhou essa segunda metade.

| ID | Sev. | Achado | Prova |
|---|---|---|---|
| SEC-07 | 🔴 | `join` com um `peerId` que já está na sala é tratado como reconexão: **emite token novo e revoga o do dono, sem prova de posse**. Todo `peerId` — inclusive o `gmPeerId` — vai no estado transmitido à mesa | O convidado lê o `gmPeerId`, faz `join` com ele e recebe sessão de GM; o token do GM verdadeiro passa a não valer; `updateRoomSettings` com o token tomado é **permitido** |
| SEC-08 | 🟠 | `create` com um código que já existe **substitui a sala** — sem sessão e sem conferência. O lobby público entrega os códigos | Sala com GM e jogador → `createRoom` com o mesmo código → jogadores `[peer_hostil]`, GM `peer_hostil`. A persistência grava por cima da linha |
| SEC-09 | 🟡 | Expulsar jogador (`deleteGeneratedPlayer`) **não revoga a sessão nem fecha o socket**: o expulso reabre o WebSocket e segue recebendo a sala inteira, fichas e chat | Depois da expulsão, `verifySession` ainda devolve o `peerId` dele. A saída voluntária revoga certo |
| SEC-10 | 🟠 | O WebSocket **não tem limitador por mensagem** — o chat pelo WS escapa do `chatLimiter` de 30/min — e o `maxPayload` é o padrão do `ws`, **100 MiB**. Cada mensagem reenvia a sala inteira a todas as conexões | Com a medição de 26/09 (sala ~48 KB × 5 conexões ≈ 250 KB por mensagem), **10 mensagens/s gastam os 5 GB do workspace em ~35 min** — e a cota estourada desliga NetSheet **e** Newra News até o mês seguinte. Um quadro de 100 MiB leva a instância gratuita perto do teto de memória |
| SEC-11 | 🟡 | Nenhum `trust proxy`: atrás do proxy do Render o `req.ip` tende a ser o do proxy, e os três limitadores viram **um balde só para todo mundo** | Predito pela doc do Express e por deploys no Render. **Conferir em produção** — número de saltos de proxy é premissa de configuração |
| SEC-12 | 🟡 | No grid Yjs, a checagem de posse (`mirrorDocToJson`) usa o `peerId` **novo** do token e não compara o campo `peerId` (nem o `icon`): um jogador moveria qualquer token reescrevendo o dono no mesmo update | **Derivado da leitura, não reproduzido** — exige cliente Yjs. Reproduzir com teste antes de consertar. *(Reproduzido na R.6, com cliente Yjs real: pior que o lido — o jogador toma o token de outro jogador)* |

### O que a pesquisa acrescentou às próximas fases

| Tema | Achado | Vai para |
|---|---|---|
| Conexão morta no WS | O servidor não manda `ping`: socket que caiu sem aviso fica no `wsClients` recebendo broadcast. O [README do `ws`](https://github.com/websockets/ws#how-to-detect-and-close-broken-connections) recomenda ping/pong com `terminate()` | pista da E |
| Modelo de IA fixo | `gemini-2.5-flash` está no código. Desde 18/09/2026 o Google [limita o acesso aos modelos 2.5](https://ai.google.dev/gemini-api/docs/deprecations) a quem já os usava — sem data de desligamento | gatilho novo na ADR 0005, pista da E |
| Acessibilidade dos efeitos | [WCAG 2.2](https://www.w3.org/TR/WCAG22/): animação automática com mais de 5 s precisa de controle para parar (**2.2.2, nível A**); nada pode piscar mais de 3×/s (**2.3.1, A**). Hoje: **0** `prefers-reduced-motion` e **23** usos de `animate-pulse/ping/spin` | F.4.2 |
| Fontes auto-hospedadas | Os pacotes [`@fontsource`](https://fontsource.org/) das três faces (todas SIL OFL) trazem `woff2` por subconjunto; o Vite os copia para `dist/assets` e o CSP `'self'` continua valendo | F.0 |
| Erro tratável pelo cliente | A [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) (Problem Details, substitui a 7807) é o formato padrão; a versão 10× menor é um `code` estável ao lado do `error` | I, pista da E |
| Backup de custo zero | O [guia oficial](https://supabase.com/docs/guides/deployment/ci/backups) commita o dump no repositório — e avisa para nunca fazer isso em repo público. **Este repo é público** | R.10 |

### O que isso implica

1. **Um bloco novo antes da Fase E** — as [pendências da revisão pós-D](#-pendências-da-revisão-pós-d--antes-da-fase-e).
   SEC-07 e 08 são "perde dado", a resposta da pergunta 3 do filtro que justifica interromper; o
   SEC-10 desliga os dois serviços do workspace por até um mês. **Janela:** o Render volta em 01/10;
   até lá nada está no ar.
2. **O repositório é público** (conferido em 29/09), e o `master` não tem proteção de branch. Este
   plano descreve as falhas com precisão, como sempre fez — por isso o texto que as descreve **vai
   ao ar junto com o conserto, não antes**. Regra nova do portão: achado de segurança aberto é
   publicado com a correção.
3. **As decisões 3 e 4 voltam ao dono** com fato novo — é o "motivo novo" que o `CLAUDE.md` exige
   para reabrir decisão.


---

### 🚨 PENDÊNCIAS DA REVISÃO PÓS-D — antes da Fase E

🔨 *(1,5–2,5 dias)* Nasceram da [revisão de 29/09/2026](#-revisão-pós-d-29092026). Mesmo formato das
pendências operacionais de 25/09: itens com checkbox, fora das 13 fases, que **precedem** a próxima.
SEC-07 e SEC-08 são **perda de dado** — a resposta da pergunta 3 do filtro que justifica interromper.
O SEC-10 não perde dado: ele **desliga os dois serviços do workspace até o mês seguinte**, o mesmo
efeito do incidente de setembro, e o contrato de custo zero existe para impedir isso. **Janela:** o
Render volta em 01/10/2026; até lá nada está no ar. O ideal é R.1–R.5 no `master` antes da primeira
sessão de jogo em produção.

**Por que isto não é a Fase J adiantada:** a J procura o que ninguém achou. Aqui os achados já estão
achados — quatro reproduzidos —, e o filtro manda consertar com teste que reproduz primeiro e
**provar revertendo**, como na B.

- [x] **R.0** 🔍 **Verificação de premissas** — a própria [revisão pós-D](#-revisão-pós-d-29092026).
      *(29/09/2026)*
- [x] **R.1** **SEC-07 — reconexão exige prova de posse.** Hoje o `peerId` faz papel de credencial, e
      ele é público. O `join` com um `peerId` que já está na sala passa a exigir **o token de sessão
      vigente daquele `peerId`** (header `X-Session-Token`, o mesmo da B.3); sem ele, `409` e o cliente
      entra como jogador novo. O `gmPeerId` inclusive.
      - **Muda contrato documentado** — a pergunta 5 do filtro pede a certeza toda. O
        [`PROTOCOLO_MULTIPLAYER.md`](../PROTOCOLO_MULTIPLAYER.md) §2 diz que, ao receber 401, o cliente
        refaz o `join` com o mesmo `peerId`. Desde a B.4 as sessões sobrevivem ao restart, então o 401
        legítimo para quem está na sala ficou raro — e é justamente o sintoma que o ataque produz.
        Decidir, com o teste na mão, o que o cliente mostra no 409.
      - **Caso de borda aceito:** sessão perdida na janela de 2 s do debounce de persistência (crash
        logo depois do `join`) vira assento novo; o GM remove o antigo.
      - **Versão maior, ADIAR:** assento vinculado à conta do Supabase (JWT), que também fecharia a
        porta "sair e voltar curado" da D.9. **Gatilho:** a R.11 decidir que a mesa exige login.
      - Teste primeiro, com o caso do script de 29/09 (o convidado toma o GM); depois o conserto,
        **provado revertendo**.
      - *(29/09/2026 — feito.)* `seatClaimRefusal` no `roomManager` é a regra única: assento ocupado
        (jogador **ou** `gmPeerId` sem jogador) só com o token vigente dele. O `joinRoom` a aplica e a
        rota responde **409 `{ code: "seat_taken" }`** — o primeiro `code` estável da API, a versão
        10× menor da RFC 9457. No cliente, `postJoin` manda o token no `X-Session-Token` e, no 409,
        entra como jogador novo uma vez só. Protocolo reescrito (§2).
      - **Testes:** `seat-claim.integration` (9) e `rooms-client` (5). **Provado revertendo:** com o
        código antigo, 11 dos 14 falham (os 3 que passam são os caminhos legítimos).
      - **Oito testes antigos reconectavam só com o `peerId`** — a tomada de assento escrita como
        expectativa, como o teste do `GET /api/rooms/:code` que a B.3 substituiu. Os três da T3.3
        passaram a provar o assento; e cinco helpers (`damage`, `death-save-turn`, `combat-loop`,
        `initiative`, `gm-attack`) faziam o GM reentrar sem token — tinham virado no-op silencioso.
        Um deles escondia um teste **passando pelo motivo errado**: "nem reconectando com uma ficha
        curada" passava porque a reconexão era recusada, não pela decisão 7a. Agora reconecta com o
        token e confere que a reconexão aconteceu.
      - **Variante achada no conserto, ADIAR:** quando o GM sai e ninguém fica online, o `gmPeerId`
        vira `undefined` e quem entrar com o **handle** do GM (público no lobby) assume o cargo
        (T1.1/T1.8). Não há prova possível — o assento do GM já não existe —, e mudar isso muda como
        uma mesa sem GM volta a ter um. **Gatilho:** a R.11 decidir manter o lobby aberto, ou uma mesa
        ser tomada assim. *(R.11, 29/09: o lobby fechou — o handle do GM só aparece para quem tem o
        código, que é o convite. O gatilho não disparou; o ADIAR fica.)*
- [x] **R.2** **SEC-08 — `create` não sobrescreve.** Código em uso → `409`, com mensagem que diga
      para escolher outro. Conferir os testes que reaproveitam o mesmo código de sala entre casos.
      *(29/09/2026)* A rota responde **409 `{ code: "room_exists" }`** ("Entre nela pelo código, ou
      escolha outro" — a tela de criação já mostra a mensagem do servidor), com o código
      comparado já normalizado. O `createRoom` **lança** se chegar com código em uso: é defesa para
      caminho futuro, e chegar lá é bug. Nenhum teste antigo reaproveitava código — conferido: a suíte
      inteira passou sem ajuste. `create-conflict.integration` (4); **provado revertendo:** 3 dos 4
      falham com o código antigo (o que passa é o do código livre). Efeito colateral bom: o **próprio
      GM** também perdia a mesa se clicasse "criar" de novo com o mesmo código.
- [x] **R.3** **SEC-09 — expulsar revoga.** O `deleteGeneratedPlayer` revoga as sessões do alvo
      (`revokeSessionsForPeer`, como o `leaveRoom`) e a rota fecha os sockets dele (`closePeerSockets`,
      como a do `leave`). *Detalhe:* o mapa do SSE não sabe de quem é cada stream — um expulso que
      estiver no fallback só cai se o `peerId` for guardado junto. Decidir no teste se vale a linha.
      *(29/09/2026)* **Maior que o descrito:** só revogar criaria uma regressão — no primeiro 401, a
      reconexão automática do cliente (T3.3) faria um `join` novo com o mesmo `peerId`, e o expulso
      voltaria em até 20 s (o próximo heartbeat). Então a expulsão faz quatro coisas:
      - revoga a sessão do expulso;
      - a rota fecha o WebSocket **e o stream SSE** dele — o `ssePeer` (um `WeakMap`) guarda o dono de
        cada stream, e valeu a linha: o teste mostrou o stream do expulso **aberto para sempre**;
      - a sala guarda o `peerId` em `removedPeerIds` (os **50** mais recentes — pergunta 5 do portão;
        persiste com a sala e é saneado no restore), e o `join` por ele responde **403
        `removed_by_gm`**; no cliente, a reconexão volta ao lobby com "O Mestre removeu você desta
        mesa", sem insistir. **Não é banimento:** sem conta, uma aba nova é outro jogador — é a R.11;
      - o GM **não remove a si mesmo** (ficaria trancado fora da própria mesa): a tela já não
        oferecia, e o servidor passou a recusar.
      - `kick.integration` (6, com um servidor HTTP de verdade para ver o stream fechar) + 1 em
        `rooms-client`. **Provado revertendo:** os 6 do R.3 falham com o código antigo; o de stream
        **estoura o tempo**, porque o stream do expulso nunca terminava.
- [x] **R.4** **SEC-10 — o WebSocket ganha os tetos do REST.** `maxPayload` explícito (1 MiB, o mesmo
      do `express.json`) e limitador **por conexão** para os quadros JSON, com os números do REST (chat
      30/min; o resto, 120/min). O teste mede o que o contrato de custo precisa: N mensagens acima do
      teto **não** geram N reenvios da sala.
      *(29/09/2026)* Os tetos moram em [`server/wsLimits.ts`](../../server/wsLimits.ts), com o porquê de
      cada número. Três mudanças no desenho, achadas ao escrever o teste:
      - **Por jogador, não por conexão:** conta por conexão se compra abrindo mais sockets. E o
        número de sockets **por jogador** ganhou teto (3, fecha os mais antigos com `4409`), porque
        cada socket a mais recebe cada reenvio da sala — outro multiplicador de banda.
      - **O binário também:** update do grid aceito reenvia a sala inteira (120/min, como o REST), e o
        *awareness* é repassado a todos com estado livre — **4 KiB** de teto de tamanho e 1.200/min.
        Antes de qualquer parse, 1.800 quadros/min por jogador (teto de CPU). Os baldes **não** somem
        quando o socket fecha: somem quando a janela vence — senão reconectar zeraria a cota.
      - **O cursor do GM ia a cada `mousemove`** (~60/s, sem throttle). Com o teto no servidor, o
        cursor travaria para o GM legítimo; o cliente passou a mandar no máximo um a cada 60 ms,
        sempre a última posição (`src/lib/throttle.ts`).
      - O `makeRateLimiter` do REST passou a usar a mesma conta de janela (`allowInWindow`): uma
        implementação para os dois transportes. O handler de *upgrade* saiu do `startServer` para
        `attachRealtime`, para o teste subir o socket de verdade.
      - `ws-limits.integration` (5, com socket real) + `throttle` (2). **Provado revertendo:**
        neutralizadas as 4 linhas dos tetos, os 4 testes de socket falham — **100 reenvios para 100
        mensagens**, quadro de 2 MiB aceito, *awareness* de 10 KB repassado, 5 sockets abertos.
      - **O que sobra, com número:** com os tetos do REST, um participante hostil ainda reenvia a sala
        120 vezes por minuto (~250 KB cada) — **menos de 3 h para os 5 GB**, em vez de ~35 min. O
        teto certo é o ARQ-01 (broadcast por diferença, L.1), e quem entra na mesa é a R.11. Ver o
        risco 3 do contrato de custo zero.
- [x] **R.5** **SEC-11 — `trust proxy`.** `app.set("trust proxy", 1)` só em produção (um salto: o
      proxy do Render). **Verificar no ar**, com uma requisição conhecida e o `req.ip` no log: o
      número de saltos é premissa de configuração, e premissa de configuração se confere.
      *(29/09/2026 — o código; a conferência no ar fica para o deploy.)* `resolveTrustProxy`: 1 salto
      em produção, nenhum fora dela; `TRUST_PROXY` corrige sem deploy de código, e `true` é recusado
      (confiaria em qualquer `X-Forwarded-For`). **Em vez de log** (que o Render guarda 7 dias), o
      `/api/health` devolve a quem pergunta o **próprio** IP como o servidor o enxerga (`clientIp`) —
      a verificação no ar é uma requisição, e está no passo 1 da
      [verificação pós-deploy](../DEPLOY.md#verificação-pós-deploy). `trust-proxy.integration` (5).
      **Provado revertendo** a linha do `app.set`: o jogador de outro IP levava **429 pelo chat do
      GM** (um balde só) e o health mostrava o IP do "proxy". **Pendente no ar:** o `clientIp` bater
      com o IP público de quem pergunta, no deploy de 01/10.
- [x] **R.6** **SEC-12 — posse no grid.** Reproduzir com teste (update Yjs que reescreve o `peerId`
      de um token alheio e o move). Se reproduzir: comparar com o dono **anterior** e proteger `peerId`
      e `icon`. Anotar na [ADR 0002](../adr/0002-yjs-websockets.md) como evidência — a autorização por
      diff é o custo que a revisão de 02/09 apontou no CRDT — **sem reabri-la**: o gatilho dela é bug de
      convergência, e isto é de autorização.
      *(29/09/2026)* **Reproduziu**, com um cliente Yjs de verdade sobre o WebSocket: o jogador levou
      o NPC para (0,0) tomando o dono dele, e **roubou o token de outro jogador** (`peer_kaze` →
      `peer_vex`). A causa é de classe — a checagem enumerava à mão os campos protegidos e esqueceu
      dois. O conserto compara **todo** campo que o doc carrega, menos `x`/`y`, pela mesma lista do
      `gridDoc` (`TOKEN_KEYS`, agora exportada): campo novo nasce protegido. E a posse é a do dono
      **anterior**. Conferido que o `deriveGridFromDoc` não converte tipo (não há falso positivo que
      reverta movimento legítimo). `grid-ownership.integration` (5). **Provado revertendo:** com a
      checagem antiga, 4 dos 5 falham (o que passa é mover o próprio token). Nota na ADR 0002 atualizada.
- [x] **R.7** **SEC-06 — o gatilho da B.6 disparou.** `npm audit fix` leva a `express@4.22.3` e
      `qs@6.16.0`. Esperado: `npm audit --omit=dev` com **0** vulnerabilidades. Atualizar a linha do
      SEC-06 em [`SEGURANCA.md`](../SEGURANCA.md#estado-dos-achados-de-segurança) e a linha de base.
      *(29/09/2026)* Só o `package-lock.json` mudou (a faixa `^4.21.2` do `package.json` já aceitava
      a 4.22.3). Produção: `express` 4.22.2 → **4.22.3**, `body-parser` 1.20.6 → **1.20.8**, `qs`
      6.15.3 → **6.16.0**. Desenvolvimento, de carona: `undici` 7.30.0 (via `jsdom`, também moderada) e
      `vitest` 4.1.11 — patches. `npm audit`: **0** em produção e 0 no total (eram 3 e 6).
      **Armadilha achada:** o `npm audit fix` atualizou o lock mas **não** o `node_modules` — a suíte
      rodou verde contra o `express` antigo, sem provar nada. Com `npm ci` (o que o CI faz), as versões
      novas entraram e a suíte passou de novo: 571/571, com o `vitest` 4.1.11.
- [x] **R.8** **OPS-02 — fixar o Node.** `.node-version` com `24` (LTS; manutenção a partir de
      20/10/2026, fim de vida em 30/04/2028), `engines` com teto (`">=24 <25"`), e o CI — a matriz e o
      job de E2E — no 24. O 20 está em fim de vida, e o 22 não é o que roda em produção. **Conferir no
      log do deploy de 01/10** qual versão o Render vinha usando.
      *(29/09/2026)* Um lugar só decide: o CI deixou de ter matriz e lê o **mesmo** `.node-version`
      que o Render (`node-version-file`), nos jobs `validate` e `e2e`. O `DEPLOY.md` avisa para **não**
      definir `NODE_VERSION` no painel, que passaria por cima do arquivo. `npm ci` local (Node 24.14)
      sem aviso de `engines`. Não há teste automatizado possível do que o Render escolhe: **a prova é o
      log do deploy** — em 01/10, o primeiro deploy deve dizer Node 24.x. *O `@types/node` segue no
      ^22: tipos mais velhos que o runtime não quebram nada; sobe quando algo do 24 fizer falta.*
      *(10/10/2026 — **a premissa caiu na 01.10:** o serviço é Docker e não lê o `.node-version`; a
      produção rodava o `node:22-alpine` do `Dockerfile`. Consertado lá, com teste de paridade.)*
- [x] **R.9** **OPS-03 — versão com a tag.** `package.json` → `0.4.3`. A regra entrou no passo 3 do
      ritual de abertura.
      *(29/09/2026)* `npm version 0.4.3 --no-git-tag-version` (o `package.json` e as duas linhas da
      raiz do lock; nenhuma tag criada). **Visto no build de produção:** o `/api/health` responde
      `"version":"0.4.3"`. O bloco R não ganha tag própria — o plano reserva a `v0.4.4` para a F, e
      renumerar tags é decisão do dono.
- [x] **R.10** 🧑‍⚖️ **Decisão do dono — backup (reabre a decisão 4, OPS-01).** Em ordem de tamanho:
      1. *(recomendada — a versão 10× menor)* **Dump manual** com o CLI já logado
         (`npx supabase db dump --linked`, esquema e `--data-only`), guardado **fora do repositório**,
         mensal e antes de toda migration. É o que a doc do Supabase recomenda ao plano gratuito.
      2. Workflow agendado com o dump **cifrado** como artefato. O guia oficial commita o dump no
         repositório — **proibido aqui: o repo é público**, e artefato de repo público também se baixa.
         Exige cifra e um secret novo.
      3. Plano Pro — colide com o custo zero.
      A K.1 (export da ficha em JSON) é o backup que o **jogador** controla — complementa, não substitui.
      *(29/09/2026 — **o dono escolheu a opção 1**, que virou a [decisão 8](../PLANO_MESTRE.md#-decisões-tomadas-02092026).)*
      - **`npm run backup:db`** ([`scripts/backup-db.ts`](../../scripts/backup-db.ts)): os três dumps do
        guia oficial (papéis, esquema e dados em `COPY`) numa pasta datada **fora do repositório**
        (`~/netsheet-backups/AAAA-MM-DD`), e um `MANIFEST.txt` com tamanho, SHA-256 e **linhas por
        tabela**, contadas sem imprimir conteúdo. **Recusa destino dentro do repo** (é público) e nunca
        sobrescreve; o `.gitignore` ganhou a mesma barreira para o dump à mão. `backup-script` (6
        testes); **provado revertendo** a trava do repo: os 2 testes dela falham.
      - **Runbook:** [`BACKUP.md`](../BACKUP.md) — quando (todo mês e antes de toda migration; o passo 5
        do ritual de encerramento ganhou isso), o que fica de fora (os **arquivos** do Storage), onde
        guardar (fora da máquina, **cifrado** — o `data.sql` tem `auth.users`), como restaurar, e o
        registro de cada dump.
      - **Primeiro backup, feito:** 29/09/2026, 20:42 UTC. **A produção ainda não tem usuário
        nenhum** (`auth.users` 0, `character_sheets` 0, 1 sala velha) — o processo existe antes do
        primeiro dado real, não depois de perdê-lo.
      - **Restauração de teste: ADIAR, com gatilho.** O alvo certo é um projeto Supabase novo, com as
        versões do `auth` da produção — criar isso é recurso na conta do dono; o Supabase local tem
        outra versão do `auth`, e com uma linha o teste provaria pouco. **Gatilho:** a primeira linha
        do registro com `character_sheets` acima de zero; a M.0 exige antes do fim do plano.
      - **Achado no caminho — o Docker não subia:** dois *sockets* velhos
        (`Docker\run\sailor-ingest.sock` e `docker-secrets-engine\engine.sock`) que o Windows não deixa
        renomear. Contorno reversível, registrado no runbook: renomear **as duas** pastas juntas. Nada
        foi apagado, e o "Reset to factory defaults" da janela de erro — que apagaria o Supabase local
        — não foi usado.
- [x] **R.11** 🧑‍⚖️ **Decisão do dono — quem pode entrar numa mesa (DOC-07; o alcance da decisão 3).**
      Hoje o lobby lista toda sala a qualquer visitante, e o `join` aceita quem souber o código.
      1. **Manter aberto** e assumir o modelo de ameaça real, "qualquer pessoa com a URL". R.1–R.4
         impedem que ela *tome* a mesa; ela continua *lendo* fichas e chat.
      2. *(recomendada)* **Sala fora do lobby** — o lobby para de listar; entra-se pelo código ou pelo
         link `/room/CÓDIGO`, que o GM manda aos convidados. É a decisão 3 imposta sem conta nova.
         Exige código difícil de adivinhar: hoje o GM escolhe (ex.: `NC-2020`), e o servidor
         acrescentaria um sufixo aleatório.
      3. **Mesa exige login** (JWT do Supabase no `join`, como a IA já exige). O mais forte, e abre a
         versão maior da R.1.
      *(29/09/2026 — **o dono escolheu a opção 2**, sala fora do lobby.)*
      - **Reproduzido antes:** `GET /api/rooms` respondia **200 com o código de toda sala** a um
        visitante sem sessão nenhuma.
      - **O lobby não lista mais:** a rota `GET /api/rooms` saiu (404); a lista "Salas ativas" e o
        *polling* de 8 s sumiram do cliente — visto no navegador: nenhuma chamada a `/api/rooms`. De
        carona, **metade do risco 1 do custo zero** (aba esquecida no lobby mantendo o Render acordado)
        deixou de existir. As contagens seguem no `/api/health`, sem código nenhum.
      - **O código é o convite:** o GM digita um prefixo (`NC-2020`) e o cliente acrescenta um sufixo
        aleatório de Web Crypto — `NC-2020-K7Q9XD`, seis símbolos de um alfabeto de 31 sem ambíguos
        (0/O, 1/I/L), ~30 bits. Com o limitador do `join`, chutar uma sala leva anos
        ([`src/lib/roomCode.ts`](../../src/lib/roomCode.ts)). O servidor passou a aceitar código de até
        24 caracteres (era 12).
      - **No cliente, e não no servidor, como a opção descrevia** — escolha registrada: o contrato da
        API não muda, e quem cria sala por fora da interface com código fraco só expõe a própria mesa
        (ninguém ganha acesso à de outro). E os ~15 arquivos de teste que criam salas com código fixo
        seguem valendo.
      - **O GM ganhou "Copiar convite"** no cabeçalho da mesa: copia `/room/CÓDIGO`; se o navegador
        não deixar, o link aparece para seleção manual.
      - `room-invite.integration` (4), `room-invite` (5), `invite-button` (3, teste do componente —
        sem o clique, os 2 do GM falham). **Provado revertendo** o servidor: 2 falham (200 em vez de
        404; código de convite recusado). O teste antigo que afirmava a lista pública foi substituído,
        como o da B.3. E2E 6/6: o fluxo de dois navegadores entra por código.
      - **Achado na verificação visual:** a interface mostrava **"v0.4.0" escrito à mão em seis
        lugares** (rodapé, menu, página inicial, PRD) — o R.9 consertou o `package.json` e não pegou
        a tela. Agora os seis leem o `package.json` (`src/version.ts`; só a string entra no bundle),
        e um teste falha se alguém escrever versão à mão de novo — provado reintroduzindo o literal.
- [x] **R.12** **DOC-06 — a L.6 precisa de outra fonte de dado.** Com 7 dias de retenção, "meses de
      log" não existe. Versão 10× menor: depois de cada sessão de jogo em produção, buscar
      `sse_fallback` no log do Render (dentro dos 7 dias) e anotar a contagem numa tabela **Registro de
      sessões**, no fim deste plano. É o mesmo passo que troca a estimativa de banda pelo número real.
      *(29/09/2026 — a [tabela](../PLANO_MESTRE.md#registro-de-sessões) existe; a L.6 aponta para ela.)*
- [x] **R.13** *(proposta — decisão do dono)* **Encolher este plano.** Sintoma observado nesta
      revisão: com ~1.700 linhas o arquivo **não cabe numa leitura** da ferramenta do Claude (passa de
      25 mil tokens) e foi lido em quatro pedaços — sessão fria que lê em pedaços pula coisa. Versão
      10× menor: mover o detalhe das fases fechadas (A–D e as pendências P) **verbatim** para
      `docs/historico/FASES_A-D.md`, deixando aqui uma linha por fase com o link. PR próprio, só de
      movimento de texto, revisável com `git diff --color-moved`.
      *(29/09/2026 — aprovada pelo dono e feita.)* **689 linhas** movidas para
      [`historico/FASES_A-D.md`](./FASES_A-D.md); **668 idênticas** e 21 com o caminho de
      link ajustado (34 links, porque o arquivo mudou de pasta — âncora que foi junto ficou igual).
      Conferido: toda âncora e todo caminho dos dois arquivos existem. No lugar ficou a tabela
      [Fases fechadas](../PLANO_MESTRE.md#fases-fechadas--a-b-p-c-d-r-e-f-g-e-h). O plano foi de 2.015 para **1.340
      linhas** — e de ~75 mil para **~47 mil tokens**: de quatro leituras para **duas**. **Ainda não
      cabe numa só.** O próximo corte, com o mesmo método: mover o bloco R quando ele fechar (R.15), a
      revisão pós-D e a auditoria de 03/09. **Gatilho:** o R.15 marcado.
      *(Revisão de robustez, 29/09: dar itens às fases E–M somou ~200 linhas, e o plano voltou a três
      leituras. O corte acima tira mais que isso — o bloco R sozinho passa de 300.)*
- [x] **R.14** 🔒 **Portão de segurança** — o bloco muda autorização (R.1, R.3, R.6) e entrada (R.4):
      as seis perguntas em [`SEGURANCA.md`](../SEGURANCA.md#registro-por-fase). E a pergunta que o repo
      público impõe: **o que este PR ensina a quem lê o código antes de o conserto estar no ar?**
      *(29/09/2026 — respondido para R.1–R.6, no [registro](../SEGURANCA.md#pendências-r--revisão-pós-d).
      Achado do portão: **SEC-13**, virou a R.16. O item fecha quando R.7–R.9 e a R.16 responderem.)*
      *(29/09/2026 — R.16, R.7, R.8 e R.9 responderam no mesmo registro; nenhum achado novo. R.10,
      R.11 e R.13 são decisão e documentação — o portão pergunta de novo se virarem código.)*
- [x] **R.15** 🧠 **Estado durável e PRs.** Ordem: consertos de segurança (R.1–R.6) **junto com** o
      texto que os descreve, nunca depois dele; dependências, Node e versão (R.7–R.9) podem ir no mesmo
      PR; a R.13 em PR próprio. Depois do merge, `master` verde e a verificação pós-deploy de 01/10.
      *(29/09/2026 — R.0–R.6 e R.12 publicados juntos, a pedido do dono: um commit por item, cada um
      com o teste que reproduz e a prova revertendo. R.7–R.11, R.13 e R.16 ficam para o próximo PR.)*
      *(29/09/2026 — PR #14 mergeado; CI do `master` verde nos 5 jobs, e o `db-sync` conectou: "Remote
      database is up to date", como esperado sem migration. R.16, R.7, R.8 e R.9 no PR seguinte, um
      commit por item. Fica aberto o que é do dono: R.10, R.11 e R.13.)*
      *(29/09–30/09/2026 — os PRs #15 a #18 mergeados; CI do `master` verde depois do último — os 4
      jobs, Node 24, 590 testes + 1 só-Windows pulado, E2E 6/6, `db-sync` em dia. **Todo o código do
      bloco R está no `master`.** O que falta é a verificação no ar, no checklist abaixo.)*

      > **Isto NÃO bloqueia a Fase F.** O R.15 fecha em 01/10, pela tarefa agendada e pelos itens do dono.
      > A Fase E abriu e fechou em 30/09 com ele aberto, e a Fase F andou com ele aberto: em 30/09
      > entraram no `master` a F.0, a F.2 mecânica e a F.1 (#26 a #29). *(30/09, à noite: o PR 3b — F.2b,
      > F.3 e F.4 — foi aberto, o #32. 01/10: o #31 da decisão 11 entrou, e o dono aprovou as capturas
      > do #32. **A próxima sessão — a API voltou em 01/10 — roda o checklist abaixo e, com o #32 no
      > ar, confere a F.0g e a F.4.4; então abre a [Fase G](./FASE_G.md#fase-g---varredura-frontend-12-dias).)*
      > Exceção: se o checklist de 01/10 falhou (algo ❌ no PR `claude/verificacao-01-10` ou no resumo da
      > tarefa), esse vermelho vem primeiro.
      >
      > **Decisão do dono (05/10/2026): a G só abre depois de fechar o que falta da R e da F.** A
      > próxima sessão segue esta ordem: **01.13** (a hibernação voltou?), depois os itens do dono —
      > **01.3** (`TRUST_PROXY`), **01.10** (Node no log) e **01.11** (horas e banda) —, a data do bloco
      > R; então a **F.0g** e a **F.4.4** (uma visita ao ar, pelo navegador do app) e a data da F. Só
      > então a [Fase G](./FASE_G.md#fase-g---varredura-frontend-12-dias).

      **Checklist de 01/10/2026 — quando a API voltar.** O Render suspendeu o serviço em setembro
      (incidente no [contrato de custo zero](../PLANO_MESTRE.md#-contrato-de-custo-zero)); ele volta na virada do mês e
      publica o `master`. Os itens automáticos rodam num comando só —
      **`node scripts/verify-prod.mjs`** —, que a tarefa agendada `verificar-render-netsheet-01-10`
      (app do Claude, 01/10 às 11:30) executa e registra num PR. O backup mensal roda antes, às 10:00.
      - [x] **01.1** O serviço voltou: `/api/health` responde JSON, não `503 Service Suspended`.
            *(01/10/2026: `/api/health` online.)*
      - [x] **01.2** A versão publicada é a do `package.json` (`0.4.3`; `0.4.4` se o PR 3b da F entrar
            antes — o script lê o `package.json`) — o deploy é o último commit
            (R.9). Se não for: painel do Render → *Manual Deploy → Deploy latest commit* (dono).
            *(01/10/2026: publicada `0.4.4` = `package.json`.)*
      - [x] **01.3** O `clientIp` do health é o IP público de quem pergunta (R.5, `trust proxy`). Registrar
            só se **bateu** — nunca o IP. Se não bateu: `TRUST_PROXY` no [`DEPLOY.md`](../DEPLOY.md).
            *01/10/2026: não bateu. O ajuste é o `TRUST_PROXY` no painel do Render (dono), e depois
            rodar o script de novo.*
            *05/10/2026 — diagnosticado, com a requisição da 01.13:* o `clientIp` é um IPv4 **privado** —
            o endereço de um proxy **interno** do Render, não o do jogador. (Hipótese descartada: não é
            IPv6 contra o IPv4 do `api.ipify.org`.) A documentação e os relatos dizem "um salto"; a
            medição diz que há pelo menos dois, e o último anexa um endereço privado. **Os limitadores
            ainda são um balde só em produção** — o SEC-11 está aberto no ar, com o código certo e a
            configuração errada. Simulado com o Express do projeto (cadeia `IP real, 10.x`, conexão de
            loopback): `1` devolve o `10.x` — o sintoma de produção —; `2` e a lista
            **`loopback, linklocal, uniquelocal`** devolvem o IP real, e os dois ignoram um
            `X-Forwarded-For` forjado pelo cliente. **Recomendada a lista:** confia em todo endereço
            privado, e por isso continua certa se o Render mudar o número de proxies internos; um IP
            privado não chega da internet, então o cliente não consegue se passar por proxy. O
            `resolveTrustProxy` já a aceita (teste da R.5). **Depois de pôr a env** (o Render reinicia o
            serviço): uma requisição ao health — o `clientIp` tem de bater —, e uma com
            `X-Forwarded-For: 203.0.113.9` — o `clientIp` tem de **continuar** o seu.*
            *(10/10/2026 — **resolvido, em duas voltas.** O dono pôs a lista privada no painel; no ar, o
            `clientIp` passou a ser um IP **público que não era o meu** — conferido contra as faixas
            publicadas, um IP do **Cloudflare**. A cadeia real é jogador → borda do Cloudflare → proxy
            interno privado → app: a lista pulou o proxy interno e parou na borda, e os limitadores
            seguiam um balde por borda. Simulado de novo: só os privados devolvem o IP do Cloudflare (o
            que o ar mostrou); **os privados mais as 22 faixas oficiais do Cloudflare** devolvem o IP
            real, e ignoram um `X-Forwarded-For` forjado — mesmo um que imite IP do Cloudflare, porque
            fica à esquerda do IP que a borda anexa. O dono trocou o valor; **no ar:** o `clientIp` é o
            meu IPv4 público, e continua sendo com `X-Forwarded-For: 203.0.113.9`. O valor e de onde vêm
            as faixas estão no [`DEPLOY.md`](../DEPLOY.md#variáveis-de-ambiente). **Nenhuma linha de
            código mudou** — o `resolveTrustProxy` da R.5 já aceitava a lista. O SEC-11 fecha no ar.)*
      - [x] **01.4** O site carrega e a interface mostra a versão do `package.json` (continuação do R.9).
            *(01/10/2026: título "NETSHEET ENGINE — Cyberpunk 2020 Sheet Builder"; bundle com `0.4.4`.)*
      - [x] **01.5** `/api/nao-existe` → 404 em JSON, não a SPA. *(01/10/2026: 404 JSON.)*
      - [x] **01.6** `GET /api/rooms` → 404: o lobby não lista salas (R.11). *(01/10/2026: 404.)*
      - [x] **01.7** `POST /api/gemini` sem login → 401 (SEC-01). *(01/10/2026: recebeu 401.)*
      - [x] **01.8** Os contratos da revisão, com uma sala de teste que o script apaga no fim: código de
            convite aceito; `join` com o `gmPeerId` sem o token → 409 `seat_taken` (R.1); `create` com
            código em uso → 409 `room_exists` (R.2). *(01/10/2026: criar sala 200; `seat_taken` 409;
            `room_exists` 409; sala de teste removida.)*
      - [x] **01.9** O E2E de WebSocket contra o ar: chat, rolagem e Yjs, 5/5.
            *(01/10/2026: 5 passaram, 0 falharam.)*
      - [x] **01.10** *(dono)* Painel do Render → *Events* → log do build: **Node 24.x** (R.8, OPS-02). O
            CLI do Render desta máquina está deslogado, e o login é do dono.
            *10/10/2026 — **falhou, e a premissa da R.8 caiu.** Lido no painel, com o dono logado no
            navegador do app: o serviço é **Docker** (o selo do painel, e o log do deploy do #35 roda os
            estágios `build`/`runtime` do `Dockerfile`), e o `Dockerfile` tinha `FROM node:22-alpine`. **A
            produção rodava o Node 22**; o `.node-version` com o 24 só valia para o CI. O Render não lê o
            `.node-version` num serviço Docker, e o `render.yaml` (Blueprint de runtime nativo, outro nome,
            outra região) não é o serviço que existe. Não era risco imediato — o 22 é LTS até 30/04/2027 —,
            mas a produção rodava uma versão que o CI não testa, o que a R.8 existia para impedir.
            **Conserto, neste PR:** os dois `FROM` em `node:24-alpine`, e o `node-version.test` falha se o
            `Dockerfile` e o `.node-version` divergirem (provado: com o `Dockerfile` antigo, "expected '22'
            to be '24'"). O `DEPLOY.md`, o `CLAUDE.md` e o cabeçalho do `render.yaml` dizem agora o que
            roda. O Docker local não sobe (o contorno do `BACKUP.md`), então **a prova é o build do Render
            depois do merge**: o log tem de puxar o `node:24-alpine`, e o health, responder.*
            *(10/10/2026 — **conferido.** O deploy do #36 (`8eefe08`) no log do Render: `load metadata for
            docker.io/library/node:24-alpine` e `[build 1/6] FROM docker.io/library/node:24-alpine@sha256:…`,
            *Deploy succeeded | Live*. O health respondeu no processo novo (`uptime` de 33 s, `0.4.4`), com
            o `clientIp` da 01.3 ainda certo. CI do `master` verde nos 4 jobs depois do merge.)*
      - [x] **01.11** *(dono)* Painel do Render → uso do workspace: anotar horas e banda do NetSheet —
            a linha de base que troca a estimativa do contrato de custo zero pelo número real.
            *05/10/2026: ~18 h/dia de horas — mas com o monitor do Better Stack ligado (incidente no
            [contrato de custo zero](../PLANO_MESTRE.md#-contrato-de-custo-zero)), então **não é linha de base**. Anotar de
            novo depois da 01.13, com alguns dias sem o monitor: as horas por dia **e a banda** do mês.*
            *(10/10/2026 — lido no painel, cinco dias sem o monitor. **Workspace** em outubro (NetSheet e
            Newra juntos): **177,4 h** de 750 e **112 MB** de 5 GB; build, 11 de 500 min. **NetSheet:**
            **14 MB** de banda no mês. O gráfico de 7 dias mostra o filete constante do monitor até a noite
            de 05/10, o pico da visita da F.0g, e **nada** de 06/10 a 10/10 — "no data captured" nas
            últimas 12 h. O painel gratuito não divide as horas por serviço; pela conta, o NetSheet gastou
            ~120 h de 01/10 a 05/10 (acordado sem parar, pelo monitor) e perto de **0 h por dia** desde
            então, sem mesa. **Linha de base:** sem sessão de jogo, o NetSheet não gasta nada; o que vier
            agora é mesa, e vai para o [Registro de sessões](../PLANO_MESTRE.md#registro-de-sessões).)*
      - [x] **01.12** *(dono)* Mergear o PR que a tarefa abrir com o resultado (e o do backup mensal).
            *(01/10/2026: #34, da verificação, e #33, do backup, no `master`.)*
      - [x] **01.13** **A hibernação voltou** depois de pausar o monitor (05/10/2026). Uma requisição só ao
            `/api/health`, com pelo menos 1 h sem ninguém no site: o `uptime` tem de vir **pequeno**
            (minutos — o processo dormiu e esta requisição o acordou) e a resposta, lenta (~1 min de
            partida a frio). Se vier em horas, ainda tem algo batendo no serviço: o próximo passo é logar
            caminho e *user agent* de cada requisição (nunca o IP) para achar quem. **Nunca** repetir a
            requisição em sequência — cada uma o mantém acordado por mais 15 min.
            *(05/10/2026, 22:51 BRT — **voltou.** Uma requisição, ~1 h 20 min depois da medição das 21:32 e
            ~57 min depois do deploy do #35: `uptime` de **9 s** e resposta em **12,4 s**, a partida a
            frio. O processo do deploy das 21:54 dormiu, e nada mais bate no serviço.)*
      Com tudo marcado, o R.15 e o bloco R fecham. *Provado antes de 01/10:* o script passa os 12
      checagens contra o build de produção local e **acusa falha** (sai com erro) contra um servidor
      fora do ar.
- [x] **R.16** **SEC-13 — teto de assentos por sala** *(achado do portão das R, 29/09/2026)*. Cada
      `join` com `peerId` novo cria um assento, cada assento abre até 3 sockets (R.4), e o `join` só
      tem o limitador de sala (120/min por IP): dezenas de assentos multiplicam cada reenvio da sala —
      o amplificador do SEC-10 por outra porta, e a mesma família da "sala sem teto de NPCs" (pista da
      E). **Reproduzir primeiro.** Versão 10× menor: teto de assentos por sala (uma mesa real tem até
      ~8; 12 dá folga), `409` com código estável acima dele. Antes da primeira sessão em produção.
      *(29/09/2026)* **Reproduzido:** 100 `join`s criaram 101 assentos, e o GM gerou 41 fichas sem
      parar. `MAX_SEATS_PER_ROOM = 16` — **não 12**: o teto conta **todo** assento (GM, jogadores e
      fichas geradas pelo GM), porque contar só os "humanos" pelo prefixo do `peerId` seria contornável
      (ele vem do cliente; bastaria entrar como `edgerunner_x`). 16 cabe GM, uma mesa cheia e fichas
      pré-geradas. Acima do teto: `join` de assento novo → **409 `room_full`**; quem já tem assento
      sempre volta ao seu; gerar ficha → recusado com "A mesa está cheia". Teto máximo de sockets por
      sala: 48. `seat-cap.integration` (6). **Provado revertendo** as 2 linhas do teto: 4 falham. As
      **fichas de NPC** (`room.npcs`) continuam sem teto — é a pista da E, e NPC não abre socket.
- [x] ✅ **Pendências da revisão pós-D resolvidas em:** 10/10/2026 *(o código, em 29–30/09; a verificação no ar
      fechou com o #36 — a `TRUST_PROXY` com o Cloudflare, o `Dockerfile` no Node 24, e a hibernação de volta)*
