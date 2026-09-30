# Histórico — Fases A a D e as pendências operacionais de 25/09

> Movido do [`PLANO_MESTRE.md`](../PLANO_MESTRE.md) na **R.13 (29/09/2026)**, sem mudar o texto — só
> os caminhos de 34 links, que mudam porque o arquivo mudou de pasta. O plano guarda uma
> linha por fase; aqui fica o detalhe: cada verificação, cada prova revertendo, cada decisão e achado.
> **Estas fases estão fechadas** — nada aqui é marcado de novo. O estado vivo é o do plano.

---

### FASE A — REANCORAR O PROJETO 🔨 *(1 dia)*

- [x] **A.1** Conferir se o projeto Supabase pausou (ocioso desde 25/08; o plano gratuito pausa com
      7 dias de baixa atividade). Checar e-mail do dono e o dashboard. Restaurar se necessário.
      *(03/09/2026 — estava pausado, dono restaurou.)*
- [x] **A.2** Conferir que a chave de IA **não tem conta de faturamento vinculada**.
      *(03/09/2026 — dono confirmou: todas as chaves em plano gratuito, sem cartão vinculado.)*
- [x] **A.3** `git tag v0.4.0` no commit atual — ponto de retorno de todo o plano.
      *(03/09/2026 — tag local no commit `d2c742b`, ainda não enviada ao remoto.)*
- [x] **A.4** Atualizar a seção 9 do `docs/PRD.md` e o roadmap do `README.md` para o estado real
      (Fases 0–10 fechadas). *(DOC-01, parte 1 — 03/09/2026)*
- [x] **A.5** **PITR adiado** (decisão 4 — exige plano pago, dono fica no free tier; backup diário
      grátis continua ativo). **Secrets: o DOC-03 estava inteiramente desatualizado.**
      - **Os dois secrets já existiam** antes desta sessão. Provado pelos logs do CI: o
        `SUPABASE_PROJECT_REF` aparece preenchido (`***`) nas execuções de 02/09 19:58, 03/09 00:25 e
        03/09 02:22 — e se estivesse vazio o job teria pulado com `exit 0` em vez de falhar.
      - **Correção de um erro cometido nesta sessão:** eu havia registrado que só o token existia e
        que criei o `PROJECT_REF`. Errado — `gh secret list` mostra a data de **última atualização**,
        não de criação, e meu `gh secret set` foi sobrescrita, não criação. Mesmo defeito que o plano
        tem: afirmar a partir de leitura em vez de verificação.
      - **O que a A.5 de fato entregou:** a verificação com `supabase migration list --linked` (as 6
        migrations constam local **e** remoto, então o `db push` não re-executa nada) e o diagnóstico
        de que o `db-sync` estava **vivo e falhando** desde 02/09 — não inerte, como o plano supunha.
      *(DOC-03 — achado deve ser reescrito na Fase M: a pendência que ele descreve não existia)*
- [x] **A.6** Fixar o **Render** como alvo único de backend; arquivar `fly.toml` e `railway.toml` em
      `docs/deploy-alternativas/`. Manter `vercel.json`/`netlify.toml` — o frontend estático neles é
      recomendado pelo contrato de custo. *(DOC-02 — 03/09/2026)*
- [x] **A.7** Criar `docs/varreduras/` como casa dos ledgers das fases E e G–J.
      *(já existia antes desta sessão — verificado em 03/09/2026.)*
- [x] **A.8** Marcar o `PLANO_DE_ACAO.md` como **substituído** — *não* como concluído. O encerramento
      formal (T12.2–T12.6) é da Fase M. *(DOC-05, parte 1 — já feito antes desta sessão, verificado
      em 03/09/2026.)*
- [x] **A.9** 📐 **Desenho** — conferir que o diagrama de contêineres e fronteiras de confiança
      em [`ARQUITETURA.md`](../ARQUITETURA.md) bate com a realidade. Ele foi desenhado a partir da
      leitura do código; validar é seu. *(03/09/2026 — estrutura bate; corrigida uma rotulagem que
      mostrava Groq como já implementado quando só o Gemini existe hoje.)*
- [x] **A.10** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](../SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](../SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](../ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.** *(03/09/2026 — achado na pergunta 3: o `db-sync` dá ao CI autoridade de alterar o schema de produção; item levado à Fase J com gatilho escrito.)*
- [x] **A.11** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](../ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](../PLANO_MESTRE.md#-protocolo-de-sessão).
- [x] **A.12** *(acrescentado após o fechamento, na revisão pedida pelo dono em 03/09)*
      **Consertar o CI vermelho.** Todo push no `master` falhava desde 02/09 — os quatro merges de PR.
      Causa lida no log: `project is paused`. O `db-sync` derrubava a build inteira porque o projeto
      Supabase tinha dormido, e o plano gratuito dorme a cada ~7 dias de baixa atividade no banco.
      - `ci.yml`: projeto pausado agora vira **warning**, não falha. Migration entra no push seguinte.
      - `.github/workflows/keepalive.yml`: toca o banco a cada 3 dias, resetando o contador de
        inatividade. É a "cron semanal" que a regra 5 do contrato de custo zero já previa —
        3 dias em vez de 7 porque intervalo igual ao limite não tem margem.
      - Corrigido também `src/data/prdData.ts:376`, que dizia "Backend em Railway/Fly.io/Render" na
        tela de PRD do app — sobra da A.6, que eu não peguei na primeira passada.
- [x] ✅ **Fase A concluída em:** __03__/__09__/__2026__ *(revisada e complementada no mesmo dia)*

---

### FASE B — FECHAR OS BURACOS DE AUTORIZAÇÃO 🔨 *(2,5 dias)*

- [x] **B.0** 🔍 **Verificação de premissas** *(03/09/2026 — disciplina nova, nascida da
      [auditoria da Fase A](../PLANO_MESTRE.md#-auditoria-das-afirmações-deste-plano-03092026): não executar a partir
      de descrição sem conferir o estado real).* **Os seis achados se confirmaram todos.** Refinamentos
      que mudam o trabalho:
      - **SEC-01 é maior que o descrito.** Além de não ter autenticação e aceitar `systemInstruction`
        do cliente, o `/api/gemini` (`server.ts:242`) não tem **limiter dedicado** nem **teto de
        tamanho de prompt**. Só o limiter global de 600/min por IP se aplica.
      - **"Exigir JWT do Supabase" não é ajuste, é infraestrutura nova.** Não existe **nenhuma**
        verificação de JWT no servidor hoje — `grep` por `jwt|getUser|verifyToken` volta vazio. O
        servidor só conhece o `sessionToken` próprio das salas. A B.1 precisa construir isso do zero.
      - **SEC-02: metade do trabalho já existe.** `getAllActiveRooms()` (`roomManager.ts:1028`) já
        devolve exatamente o payload público que a B.3 pede (`code`, `name`, `gmHandle`,
        `playersCount`). Falta aplicar a mesma separação ao `GET /api/rooms/:code` e ao SSE.
      - **SEC-05: o autor já é confiável, o conteúdo não.** `POST /api/rooms/:code/sheet` autentica
        via `getSessionPeerId` (a regra 2 da fronteira de confiança se sustenta). O que falta é
        validar **campos** — hoje só checa se é objeto e não array.
      - **SEC-04 são três vazamentos distintos**, não um: buckets do rate limiter (`server.ts:143`,
        uma entrada por IP que nunca é removida, em três mapas), sessões (`roomManager.ts:18`, só
        saem por revogação explícita) e salas (o `presenceWatcher` marca jogador offline, mas nunca
        recolhe sala — exatamente o estado `Ociosa` que o diagrama diz não existir).
      - **SEC-03 confirmado:** `roomPersistence.ts` não tem nenhuma função de sessão. Restart derruba
        todas as mesas.

- [x] **B.1** Travar `/api/gemini`: system prompt fixo no servidor (mover o `SYSTEM_PROMPT` de
      `AiAssistant.tsx`), ignorar `systemInstruction` do cliente, exigir JWT do Supabase, limiter
      dedicado, teto de tamanho de prompt. *Sem regressão de UX — o `AiAssistant` já bloqueia
      visitante no cliente.* *(SEC-01 — 03/09/2026)*
      - `server/aiPrompt.ts`: o prompt virou código do servidor. O que o cliente mandar em
        `systemInstruction` é **descartado**, e o campo saiu do contrato de `askGemini`.
      - `server/supabaseAuth.ts`: verificação de JWT construída do zero (não existia nada).
        `auth.getUser(jwt)` por requisição — escolhido sobre validar assinatura localmente para não
        introduzir um `SUPABASE_JWT_SECRET` novo. **Falha fechada** em toda condição de erro.
      - Limiter dedicado de **10/min por IP** (o global de 600/min não protegia nada aqui) e teto de
        **4.000 caracteres** no prompt.
      - Ordem de checagem deliberada: sem token → 401 sem tocar em rede; com token e sem verificação
        configurada → 503 (a verdade é "problema do servidor", não "sua sessão é inválida").
      - Erro do provedor vira **502 genérico** — a mensagem original podia carregar detalhe interno.
      - 8 testes em `src/__tests__/ai-endpoint.integration.test.ts`, cobrindo os caminhos de
        rejeição. O caminho feliz exige rede e cota, e ficou deliberadamente fora da suíte.
      - `docs/DEPLOY.md`: o curl de verificação agora espera **401**. Se vier 200, o SEC-01 voltou.
      - **Groq adiado** (ADR 0005): a troca de provedor entra depois, para não misturar correção
        crítica com migração num commit só. O endpoint já está isolado para isso.
- [x] **B.2** Criar `src/rules/sheetSchema.ts` com validador de `CharacterSheet` no limite do
      servidor: atributos 2–15, perícias 0–10, `woundLevel` 0–10, arrays com teto, campos
      desconhecidos descartados. Aplicar em `joinRoom` e `updatePlayerSheet`. *(SEC-05 — 03/09/2026)*
      - **Saneia em vez de rejeitar:** número fora da faixa é grampeado, campo desconhecido é
        descartado, item estruturalmente inválido (perícia com atributo inexistente, armadura com
        localização inválida) é removido. Rejeitar a ficha inteira por um campo estranho tiraria o
        jogador da sincronia sem ele entender por quê.
      - Toda correção volta em `changed` e o servidor **loga** (`sheet_sanitized`). Ficha corrigida a
        cada sync é sinal: bug no cliente ou alguém testando limites.
      - **Aplicado no `roomManager`, não na rota** — assim cobre todo caminho que escreve ficha
        (REST, WebSocket, o que vier), não só o endpoint que existe hoje.
      - Tetos de string e de array também entraram: um `handle` de 10 MB ou um array de 100 mil
        perícias seria persistido e transmitido a todos — mesmo vetor de DoS do SEC-04, por outra porta.
      - **Primeiro arquivo de `src/rules/`**, já no contrato da Fase C (função pura, sem DOM nem rede).
        A K.1 reaproveita no import de ficha: JSON de disco é tão não confiável quanto corpo de requisição.
      - 14 testes. **Verificado revertendo o `roomManager`:** os 2 testes de HTTP falham contra o
        código antigo e passam contra o novo — reproduzem o sintoma, como o filtro exige.
- [x] **B.3** Exigir `sessionToken` na leitura de sala e no stream SSE (via header); separar payload
      público (código, nome, GM, contagem) do payload de mesa. *(SEC-02 — 03/09/2026)*
      - **`GET /api/rooms/:code` em três casos:** sem token → recorte público (`getRoomPublicSummary`,
        o mesmo que o lobby já expunha); token válido → sala completa; token **inválido → 401**, para
        não mascarar bug de cliente devolvendo meio payload.
      - **Descoberta que simplificou tudo:** esse endpoint **não tinha nenhum caller na aplicação** —
        só nos testes. O cliente recebe a sala do `create`/`join` e depois pelo WS/SSE. Trancar não
        quebrou UX nenhuma.
      - **O stream exigiu solução diferente do que o plano previa.** O plano dizia "via header", mas
        `EventSource` **não permite header customizado** — é limitação da API do navegador. O token
        vai na query, como o WebSocket já fazia desde a T5.2. Token em URL aparece em log de proxy,
        então esse caminho ficou **confinado ao stream**: nenhuma outra rota aceita `?token=`.
      - Um teste existente assertava que qualquer um lia a sala inteira — era a vulnerabilidade
        escrita como expectativa. Substituído por quatro, cobrindo os três casos e o 404.
      - 6 testes novos em `room-read-auth.integration.test.ts`, incluindo **token válido de outra
        sala** (o escopo por sala é o que impede um convidado de ler a mesa do vizinho).
      - **Verificado revertendo o `server.ts`:** 5 dos 6 falham contra o código antigo. Os quatro de
        stream levam 5 s cada antes de falhar — porque o servidor antigo **aceitava a conexão e
        começava a transmitir**. O vazamento aparece no próprio tempo do teste.
- [x] **B.4** Persistir as sessões junto com a sala, na mesma gravação da T3.1. **Não** trocar por JWT
      stateless: `revokeSessionsForPeer` e `deleteRoom` dependem de revogação server-side e têm
      teste. *(SEC-03, ARQ-03 — 03/09/2026)*
      - **Migration `0007_room_sessions.sql`** — a primeira desde que o `db-sync` está ativo.
        **Coluna própria, não dentro de `room_state`:** aquele jsonb é o `GameRoom`, que é
        exatamente o objeto transmitido a todos a cada mutação. Sessão ali dentro vazaria o token de
        cada jogador para a mesa inteira — trocaria o SEC-03 por algo pior.
      - **Grava o SHA-256 do token, nunca o token.** O mapa em memória também passou a ser keyed por
        hash. Como as sessões agora existem em disco, persistir segredo em claro abriria um buraco
        novo enquanto se fecha outro: um dump do banco entregaria sessões vivas. O token existe só no
        cliente e em trânsito.
      - Restore tolera linha antiga sem a coluna (`undefined` = nenhuma sessão) e ignora dado
        corrompido em vez de criar sessão inválida.
      - **Migration validada localmente antes de ir para o CI:** aplicada no Supabase do Docker,
        conferido que a coluna é `jsonb NOT NULL DEFAULT '{}'`, que a RLS continua ativa com zero
        policies (postura da 0006 intacta) e que as **56 de RLS** seguem passando.
      - 10 testes novos. O central prova a propriedade que o SEC-03 pedia: um token emitido por um
        processo, exportado e restaurado, continua válido — inclusive um token que o processo atual
        nunca emitiu, que é o caso real do restart.
      - *Nota sobre ARQ-03:* a metade "hiberna e perde as mesas" está resolvida. A metade "instância
        única" continua, por desenho — as salas vivem em memória (ADR 0002).
- [x] **B.5** Coletor de salas abandonadas (sem jogador online há N horas) e poda dos buckets vencidos
      do rate limiter. *(SEC-04 — 03/09/2026)*
      - **Os três vazamentos, os três fechados.** (1) Salas: `collectAbandonedRooms`, varrido de 15 em
        15 min, com janela `ROOM_ABANDONED_TIMEOUT_MS` (24 h). (2) Sessões: vão junto, porque o
        coletor usa `deleteRoom`, que já revoga. (3) Buckets: poda amortizada a cada 500 requisições.
      - **Encerrar são três passos, e o coletor faz os três** — revogar sessões, apagar a linha no
        Supabase, destruir o Y.Doc. Fazer só o primeiro deixaria linha órfã que ressuscitaria a sala
        no próximo boot.
      - **24 h é conservador de propósito:** o risco não é simétrico. Recolher tarde custa uma linha a
        mais no banco por um dia; recolher cedo apaga a mesa de alguém, e o delete é irreversível.
      - **Poda amortizada em vez de timer** — nenhum intervalo novo para gerenciar no shutdown ou no
        HMR, custo O(n) diluído.
      - *Refatoração da própria fase:* a poda vivia dentro do closure do limiter, invisível para
        teste. Extraída para `pruneExpiredBuckets`, pura e exportada — uma poda que nunca roda
        falharia em silêncio.
      - 13 testes, **metade deles sobre o que o coletor NÃO pode fazer**: sala nova, sala um minuto
        abaixo do limite, mesa em pausa de 6 h, e sessões de outras salas intactas.
- [x] **B.6** `npm audit fix` + passo de audit no CI falhando em severidade alta. *(SEC-06 — 03/09/2026)*
      - **O achado era maior E menor que o descrito.** Maior: três pacotes independentes (`qs`,
        `mathjs`, `nanoid`), não só a cadeia do `qs`. Menor: `npm audit fix` só resolve o `nanoid` —
        **4.22.2 é a última 4.x do express publicada**, então a cadeia `express → body-parser → qs`
        não tem patch, o "fix" seria migrar para Express 5 (major).
      - **`mathjs` é cliente-only.** Chega via `@dice-roller/rpg-dice-roller`, importado só em
        `src/utils/diceEngine.ts`; o servidor tem o próprio `rollDice` e não usa mathjs em caminho
        nenhum. E `rollDamage()` só recebe fórmula da ficha local ou do que o usuário digita — não há
        caminho em que a fórmula de outro jogador seja avaliada no navegador de alguém.
      - O "fix" proposto pelo npm é **downgrade** do rolador para 5.5.0, marcado semver-major; a única
        versão mais nova é `6.0.0-alpha`. Trocar o motor de dados do jogo por um alpha é risco maior
        que a falha. **ADIAR com gatilho escrito** (na ALLOWLIST do script).
      - **`scripts/audit-ci.mjs`** em vez de `npm audit --audit-level=high`: um portão
        permanentemente vermelho não é portão — em uma semana ninguém olha, e a vulnerabilidade
        **nova** se esconde no ruído das velhas. As exceções são **nomeadas, com motivo e gatilho**,
        visíveis no repositório e revisáveis num PR. Qualquer alta fora da lista derruba a build.
      - Avisa também sobre exceção **obsoleta** na lista — permissão esquecida vira buraco.
      - **Verificados os dois caminhos:** com a lista atual sai 0 e sem stderr; com a lista vazia sai
        1 e imprime as bloqueantes. *(Na primeira tentativa o script quebrou no Windows —
        `execFileSync` não spawna `npm.cmd` sem shell — e o exit 1 vinha do crash, não do portão.
        Corrigido e re-verificado.)*
- [x] **B.7** **Instrumentar o fallback SSE** — uma linha de log estruturado quando um cliente cai
      do WebSocket para o `EventSource`. O suporte a WebSocket passa de 99% e o motivo real de
      manter fallback é proxy corporativo que quebra o handshake de Upgrade — algo que a sua mesa
      de convidados pode simplesmente nunca encontrar. Como esta fase já mexe no SSE por causa do
      SEC-02, o log sai de graça. **Decidir na Fase L, com dado**: se em meses de mesa ninguém caiu,
      o fallback sai; se alguém caiu, você descobriu que era necessário. *(03/09/2026 — evento
      `sse_fallback` no handler do stream, com sala, peer e userAgent. Como o cliente só abre
      EventSource quando o WS falha, toda conexão ali é, por definição, uma queda. **Tem teste**
      porque o modo de falha é traiçoeiro: se o log nunca for emitido, a L.6 leria "ninguém caiu" e
      removeria um caminho que talvez seja o único que funciona atrás de proxy corporativo — ausência
      de evidência viraria evidência de ausência. Um segundo teste garante que recusa por falta de
      sessão NÃO conta, para não inflar o número.)*
- [x] **B.8** Testes de integração para cada item — a suíte atual cobre bem quem *pode* agir e não
      cobre quem não deveria conseguir *ler*. *(03/09/2026 — escritos junto com cada item, não no fim.)*
      **141 → 197 testes (+56).** Por arquivo: `ai-endpoint` 8 · `sheet-schema` 14 · `room-read-auth` 6
      · `session-persistence` 10 · `room-collector` 13 · `sse-fallback-log` 2 · `server-api` +3 líquidos.
      - **A lacuna que o item nomeava está coberta:** os testes de *quem não deveria conseguir ler*
        são os 6 do `room-read-auth` mais os 4 que substituíram o antigo caso do `GET /api/rooms/:code`
        — inclusive **token válido de outra sala**, que é o convidado hostil da decisão 3.
      - **Uma intermitência encontrada e corrigida:** o teste do B.7 esperava 300 ms fixos e conferia
        depois. Passava quase sempre e falhou uma vez. Teste que depende de "tempo suficiente" não
        mede o evento, mede a carga da máquina — trocado por espera pelo próprio evento, com teto.
        Seis execuções seguidas limpas depois da correção.
- [x] **B.9** `git tag v0.4.1`. *(03/09/2026)*
- [x] **B.10** 📐 **Desenho** — implementar o coletor contra o [ciclo de vida de sala e sessão](../ARQUITETURA.md#ciclo-de-vida-de-sala-e-sessão), que já especifica a transição `Ociosa → Encerrada` que hoje não existe. *(03/09/2026 — implementado contra o diagrama, e o diagrama atualizado no mesmo commit: a nota que dizia "HOJE ESTE ESTADO NAO EXISTE" saiu, e entrou a tabela dos dois limiares.)*
- [x] **B.11** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](../SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](../SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](../ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
- [x] **B.12** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](../ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](../PLANO_MESTRE.md#-protocolo-de-sessão).
- [x] ✅ **Fase B concluída em:** __03__/__09__/__2026__ *(mergeada em 24/09/2026 — PR #6)*

---

### ✅ PENDÊNCIAS OPERACIONAIS — resolvidas em 25/09/2026, antes da Fase C

Descobertas em 24/09/2026 ao conferir o CI do `master` depois do merge da Fase B. **O merge ficou
vermelho:** o job `db-sync` falhou com `Unexpected error retrieving remote project status:
{"message":"Unauthorized"}`. O `SUPABASE_ACCESS_TOKEN` do repositório deixou de valer entre o
keepalive de 22/09 (ok) e o merge de 25/09 01:38 UTC. O token tinha sido gravado em 25/08: tudo
indica um token criado com **validade de 30 dias**.

**Consequência:** a migration `0007` não chegou em produção, enquanto o Render fazia auto-deploy do
código que grava e lê a coluna `sessions`. Pela leitura do código, a persistência de salas falha
(PostgREST rejeita coluna inexistente) e fica re-tentando a cada 2 s, e o restore do boot não recupera
sala nenhuma. **Não observado nos logs do Render** — derivado do código.

- [x] **P.1** Aplicar a `0007` em produção. *(24/09/2026 — com autorização do dono, pelo CLI local,
      depois de um `--dry-run` que mostrou a `0007` como **única** pendente. Verificado direto no schema
      de produção (`supabase db dump`): tabela de controle `0001`–`0007`; coluna `sessions jsonb
      DEFAULT '{}' NOT NULL`; RLS da `rooms` ativa com **zero policies**. Janela de quebra: ~15 min
      entre o merge e a aplicação.)*
- [x] **P.2** **Trocar o `SUPABASE_ACCESS_TOKEN`.** Gerar em
      [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) e gravar
      com `gh secret set SUPABASE_ACCESS_TOKEN --repo tavinholoco/NetsheetEngine` (o valor é pedido no
      prompt — **Claude não insere token**). *(25/09/2026 02:01 UTC — trocado pelo dono.)*
      **⏰ O token novo tem validade de 30 dias, por escolha do dono: vence por volta de 25/10/2026.**
      **Gatilho: renovar até 22/10/2026**, com o mesmo passo a passo. Se passar, o sintoma é o de hoje:
      `Unauthorized` no `db-sync` e keepalive vermelho. O passo 3b do ritual de abertura pega isso.
- [x] **P.3** Re-rodar o job que falhou (`gh run rerun 36082927327 --failed --repo
      tavinholoco/NetsheetEngine`) e confirmar o `master` verde. Como a `0007` já entrou, o esperado
      no log é `Remote database is up to date`. *(25/09/2026 — run `36082927327` com conclusão
      `success`; o log mostra `Connecting to remote database...` e `Remote database is up to date`.)*
- [x] **P.4** Disparar o keepalive à mão e confirmar que ele **conecta** (`Connecting to remote
      database...` no log). Verde sozinho não basta: o script também sai verde com secret ausente.
      *(25/09/2026 — run `36084925724` verde; o log mostra a conexão e a `0007` local **e** remota.)*
      - **Achado no caminho, uma corrida.** A primeira tentativa (run `36084634828`) falhou com
        `FATAL: password authentication failed for user "cli_login_postgres"`. Ela tinha sido
        disparada **no mesmo segundo** que o re-run do `db-sync`. O CLI cria um papel temporário com
        nome fixo e define uma senha nova a cada execução, então um job trocou a senha do outro.
        Rodando sozinho, passou. Mesmo token e mesmo projeto, então a corrida é a explicação que sobra.
      - **Regra:** nunca disparar `db-sync` e keepalive juntos à mão.
      - **ADIAR o conserto no workflow** (grupo de `concurrency` compartilhado ou retry em
        `SQLSTATE 28P01` no `scripts/supabase-ci.sh`). No uso normal, a colisão exige um push no
        `master` durante os ~20 s do keepalive agendado (06:00 UTC, a cada 3 dias). **Gatilho:** uma
        falha `28P01` em run que **não** foi disparado à mão. Detalhe ao escolher: um grupo de
        `concurrency` do GitHub mantém só **um** run pendente e cancela o anterior, e isso poderia
        cancelar um `db-sync` pendente. O retry não tem esse risco.
- [x] **P.5** **Decidir a ordem migration × deploy** — decisão rápida, com o dono, **antes da próxima
      migration**. *(25/09/2026 — **decidido pelo dono: opção 1, migration em PR próprio.** Virou a
      decisão 5 do plano e o passo 5 do ritual de encerramento.)* O incidente expôs um defeito de desenho: o Render faz auto-deploy no push para o
      `master` **independente** do `db-sync` do GitHub Actions. Mesmo com token válido existe corrida
      (o Render pode subir antes da migration), e com o `db-sync` falhando o código sobe assim mesmo.
      Opções:
      1. **Disciplina expand/contract** *(recomendada — versão 10× menor)*: migration aditiva em PR
         **próprio**, mergeado e conferido em produção **antes** do PR do código que a usa. Custo zero,
         nenhuma infraestrutura.
      2. **Deploy do Render condicionado ao `db-sync`**: `autoDeploy: false` no `render.yaml` e deploy
         hook chamado pelo CI depois de migration ok. Resolve na raiz, mas exige mais um secret
         (`RENDER_DEPLOY_HOOK`).
      3. **Código tolerante à coluna ausente** — rejeitada de antemão: esconde o problema em vez de
         evitá-lo.

---

### FASE C — UMA FONTE ÚNICA DE REGRAS 🔨 *(5,5–7,5 dias)*

Fase estruturante. Criar `src/rules/` — funções puras, RNG injetado, sem DOM nem rede — e migrar
cliente e servidor para ela.

> **Disciplina obrigatória:** os 32 testes de `derived-stats` codificam a tabela **errada**.
> Reescrevê-los para bater com o código novo destrói a verificação exatamente na mudança mais
> delicada do plano. Ordem correta: **escrever a tabela do livro como dado primeiro**, derivar os
> testes desse dado, vê-los falhar contra a implementação atual, e só então mudar a implementação.

- [x] **C.0** 🔍 **Verificação de premissas** *(25/09/2026)*. Conferido no código **e contra fontes do
      livro** — a pesquisa está em [`CONFERENCIA_CP2020.md`](../CONFERENCIA_CP2020.md), com a fonte de
      cada regra. **Três premissas do plano estavam erradas, e as três vieram de fora do 2020:** duas
      do Cyberpunk RED, uma de regra de casa publicada como se fosse do livro. O defeito é do plano,
      não da execução — mesma classe da [auditoria de 03/09](../PLANO_MESTRE.md#-auditoria-das-afirmações-deste-plano-03092026).
      - **Linha de base: 196/197, não 197.** No checkout principal o `supabaseAuth` do B.1 ia à rede
        (o `.env.local` aponta para o Supabase local) e o teste de falha fechada recebia 401 em vez de
        503. Nos worktrees da Fase B não havia `.env.local`, por isso escapou. Corrigido com a mesma
        guarda de `NODE_ENV=test` que o `roomPersistence` tem desde a T9.3 (`c7c25a3`).
      - **C.1 — maior que o descrito.** Os **dois** motores implementam o fumble do **RED** (rolar 1
        subtrai 1d10). No 2020, o 1 natural é **falha automática** e rola-se 1d10 na tabela de fumble.
        A explosão única do servidor também é a regra do RED. E um bug que a auditoria não pegou: o
        `rollLocation` do cliente manda acerto no **tronco (2–4) para "Perna Esquerda"** — o do
        servidor está certo, e a divergência é o próprio sintoma do ARQ-02. Os testes só cobriam as
        faces 1, 5 e 9.
      - **C.1 — a biblioteca não pode ir para o servidor.** O `@dice-roller` tem gerador **global**
        (não aceita RNG por chamada) e levaria o `mathjs` para o lado que avalia a fórmula de dano
        vinda da rede — exatamente o gatilho da exceção de audit do B.6. Unificar = motor próprio em
        `src/rules/`, e a biblioteca sai. Reabre a [ADR 0004](../adr/0004-dice-roller.md) com motivo
        novo, e as duas exceções do `mathjs` saem da ALLOWLIST.
      - **C.2 confirmado.** `btmFromStats(BODY, REF)` com sinal invertido (+5 a −2). **15 dos 32**
        testes de `derived-stats` codificam a tabela errada.
      - **C.3 confirmado, e o cliente é pior:** `handleRollWeaponAttack` passa o **WA no lugar do nível
        de perícia**. Nenhum mapa `weapon.type → perícia` existe. Escopeta → Rifle é inferência
        (não existe perícia de escopeta no 2020) e está marcada assim na conferência.
      - **C.4 confirmado:** `combatModifier` com zero leitores.
      - **C.5 — premissa errada.** "Crítico REF −4, Mortais REF −6" é **regra de casa** — as duas
        fontes que a publicam se declaram house rules. O livro: **Sério REF −2; Crítico REF/INT/COOL
        pela metade; Mortal REF/INT/COOL a um terço** (arredondando para cima). Ferimento **não
        penaliza MA** — a tabela atual inventa MA e as notas "consciência 50%" e "morte provável".
      - **C.6 confirmado, com um recorte:** o tipo `CyberwareItem` não tem modificador de atributo.
        O único efeito de cromo que o modelo representa é o do livro: **−1 EMP a cada 10 de
        Humanidade perdida**. E o servidor **deriva** o `currentStats` — nunca confia no do cliente.
      - **C.7 — premissa meio errada.** Death save "cumulativo por turno" é do **RED** (cada save
        bem-sucedido piora o próximo). No 2020 o death save é **a cada turno, com −1 por nível
        Mortal**, sem acúmulo por turno. E falta o **stun save** (BODY −0 a −9 pelo nível do
        ferimento): o único botão diz "Atordoamento/Morte" e rola `1d10 ≤ BODY` para os dois. Além
        disso, `isDead(10)` trata Mortal 6 como morto e **desliga o death save** justo no último nível.
      - **C.8 — maior que o descrito:** o ternário acerta **1 de 10**, não 3. Nenhuma habilidade usa
        EMP, e Combat Sense não se rola sozinha — soma em Awareness/Notice e na iniciativa.
        `SPECIAL_ABILITIES` em `cyberpunkData.ts` é duplicata morta de `OFFICIAL_ROLES`.
      - **C.10:** o servidor não tem RNG injetável — a paridade exige isso.
- [x] **C.1** Extrair e unificar o motor FNFF em `src/rules/`. Explosão **encadeada** dos dois lados
      (decisão 1), com teto de segurança contra sequência patológica. *(RUL-05, ARQ-02 — 25/09/2026)*
      - **`src/rules/dice.ts`** (motor: d10 aberto, teste, dano, local, save) e **`src/rules/rolls.ts`**
        (monta o `RollResult`). Cliente e servidor só acrescentam `id`, horário e personagem — o
        `diceEngine.ts` virou casca, e o `rollDiceForPlayer` perdeu `secureD10`, `rollDice` e
        `impactLocationName`.
      - **RNG injetado dos dois lados:** o servidor passa `crypto.randomInt`, o cliente passa Web
        Crypto (com rejeição, sem viés), o teste passa `scriptedRng` (`src/test/`).
      - **Fumble do 2020:** falha automática, total sem o −1d10, e o dado da tabela de fumble aparece
        no detalhe. O **texto** das tabelas de fumble ficou **ADIADO** (gatilho na conferência).
      - **Teto de 10 dados extras** na explosão — onze 10 seguidos têm probabilidade 10⁻¹¹; o teto só
        existe para um RNG defeituoso não travar o servidor.
      - **Fórmula de dano sem avaliar expressão:** `NdM±X`, até 20 dados de até 100 faces. A página de
        dados perde a notação livre da biblioteca (gatilho na ADR 0004).
      - **`@dice-roller` removido** ([ADR 0004 revisada](../adr/0004-dice-roller.md#revisão-de-25092026--motor-próprio-em-srcrules)).
        O `mathjs` saiu da árvore e a **ALLOWLIST do audit ficou vazia**.
      - **Efeito colateral medido, não previsto:** o chunk de entrada caiu de **1.336 kB / ~390 kB
        gzip para 623 kB / 184,5 kB gzip** (−53%). A biblioteca puxava o `mathjs` inteiro para o
        bundle principal. Metade do **ARQ-04** (Fase L) resolvida de graça — a L ainda decide se o
        resto precisa de code-splitting.
      - Suíte do rolador reescrita contra o RNG injetado (16) + 44 testes novos do motor (`rules-dice`).
        Local de impacto testado nas **10 faces** — os antigos cobriam 1, 5 e 9.
- [x] **C.2** BTM canônico por BODY (2→0, 3–4→−1, 5–7→−2, 8–9→−3, 10→−4, 11+→−5), sinal negativo,
      rótulo do `StatBlock` e linha do PRD corrigidos. *(RUL-01 — 25/09/2026)*
      - `btmFromBody`/`bodyTypeFor` em `src/rules/character.ts`; `btmFromStats` saiu. O `StatBlock`
        mostra o BTM **e o tipo corporal**, e perdeu a frase "Reputação derivada de COOL + LUCK", que
        o livro não tem e a tela não calculava.
      - Os 15 testes de BTM foram **reescritos a partir de `BODY_TYPE_TABLE`**, não do código novo —
        e a tabela antiga falhava em 31 de 36 casos do oráculo da C.0 (os 5 que passavam eram
        coincidência: o piso −2 e o 0 da soma 17).
- [x] **C.3** Ataque com perícia de arma: mapear `weapon.type` → nome de perícia e somar o nível da
      ficha que o servidor já possui. *(RUL-02 — 25/09/2026)*
      - `src/rules/combat.ts`: `WEAPON_SKILL_BY_TYPE` (tabela), `weaponSkillFor`, `skillLevelOf` (compara
        sem caixa nem pontuação: "Awareness / Notice" casa com "Awareness/Notice") e `attackModifiers`.
        **O mesmo código na mesa e na ficha** — o cliente passava o WA no lugar da perícia.
      - Sem a perícia na ficha, ataca **sem treino (nível 0)** e o detalhe mostra `Handgun (0)`.
        Desarmado usa **Brawling**. Tipo desconhecido aparece como `sem perícia para "X" (0)` em vez
        de somar perícia errada.
- [x] **C.4** `combatModifier` entrando em `attack` e `skill`, visível no detalhe da rolagem. *(RUL-03 —
      25/09/2026)* Entra como `Mod. do Mestre: <motivo> (−2)`. **Não** entra em dano nem em save — o
      livro aplica modificador de situação ao teste, não ao dano. Zero não aparece no detalhe.
      - **Provado revertendo:** com o `roomManager` anterior, os 5 testes de C.3/C.4 falham.
- [x] **C.5** Tabela de penalidade de ferimento igual à do livro: Sério REF −2; Crítico REF/INT/COOL
      ÷2; Mortal REF/INT/COOL ÷3 (arredondando para cima); sem penalidade de MA. *(RUL-06, parte 1 —
      texto corrigido na C.0: o original, "Crítico REF −4; Mortais REF −6", era regra de casa)*
      *(25/09/2026)* `WOUND_TRACK` + `applyWoundEffect`. Saíram `WOUND_PENALTY_DATA`,
      `woundPenalties` e `woundPenaltyText` (com as notas inventadas). O Bio-Monitor mostra o efeito
      do livro ("REF, INT, COOL ÷2"). A tabela antiga falhava em **9 dos 11 níveis** contra o livro.
- [x] **C.6** `currentStats` derivado (base + cyberware + penalidade de ferimento) num único seletor,
      lido por **todas** as rolagens. *(RUL-06, parte 2 — 25/09/2026)*
      - `deriveCurrentStats(sheet)`: base → **−1 EMP a cada 10 de humanidade** → ferimento. Lido pelo
        `rollDiceForPlayer`, pela árvore de perícias, pelo ataque e death save da ficha e pelo rolador.
      - **O servidor recalcula no `sanitizeCharacterSheet`** e descarta o `currentStats` do cliente —
        antes era saneado e guardado como veio. Não entra no `changed`, para não encher o log.
      - O `StatBlock` parou de **escrever** o campo (era a única escrita com efeito) e mostra
        **"rola com N"** quando o valor corrente difere da base — em âmbar, porque vermelho é dano.
      - **Provado revertendo:** com as duas linhas antigas (servidor e esquema), os 3 testes de C.6
        em `table-rolls.integration` falham; com as novas, passam.
- [x] **C.7** Death save a cada turno com −1 por nível Mortal (Mortal 0 = BODY, Mortal 6 = BODY −6),
      e o **stun save** que não existe (BODY −0 a −9 pelo nível do ferimento). *(RUL-08 — texto
      corrigido na C.0: "cumulativo por turno" era regra do RED — 25/09/2026)*
      - `stunSaveRoll` e `deathSaveRoll` em `src/rules/rolls.ts`, com o alvo explicado na fórmula
        (`1d10 ≤ BODY 8 − 3`). **Tipo de rolagem novo na mesa: `stun`** (entrada nova no servidor —
        vai para o portão). Botão âmbar ao lado do death save, na mesa, na ficha e no rolador.
      - O Bio-Monitor mostra **os dois alvos** no botão e **desliga o death save fora do Mortal**. O
        `isDead` virou `isLastWoundBox`: Mortal 6 ainda está vivo e **voltou a poder rolar** o death
        save, que era desligado justo ali.
      - Fora do Mortal, o death save da mesa **rola** contra o BODY e o rótulo avisa "não exigido" — em
        vez de um erro novo no servidor, que o `respondWithResult` classificaria por substring (pista
        da Fase E).
      - **Provado revertendo:** com o `roomManager` anterior, 3 dos 4 testes de C.7 falham (o de Mortal
        6 passava: o bloqueio era só no botão da ficha).
- [x] **C.8** Atributo da Special Ability dentro de `OFFICIAL_ROLES`. *(RUL-07 — 25/09/2026)*
      - `specialAbilityStat` (e `specialAbilityAddsTo` para o Combat Sense) em cada role;
        `specialAbilityRoll` em `src/rules/roles.ts`. O ternário do `SkillsSection` saiu, e a
        ficha mostra "INT + nível" embaixo do nome da habilidade.
      - **Combat Sense rola como Awareness/Notice + INT + o bônus** — o livro não a rola sozinha. A
        soma na iniciativa é da D.4.
      - Role livre é achado pelo nome da habilidade; fora do livro, rola só o nível e o rótulo avisa.
      - `SPECIAL_ABILITIES` (duplicata morta de `OFFICIAL_ROLES`, zero leitores) removido.
      - O teste guarda o ternário antigo como registro: **acertava só o Netrunner**.
      - *Fora do escopo, anotado:* a habilidade especial não é rolável **na mesa** (o tipo `skill`
        procura em `sheet.skills`, e ela mora em `specialAbilityName`). Nenhum item do plano pede
        isso; entra como pista da Fase H.
- [x] **C.9** **Conferência sistemática contra o livro** (decisão 2): atributos, perícias, combate,
      dano, armadura, humanidade e movimento. Registrar cada divergência encontrada, inclusive as não
      listadas nesta auditoria. *(25/09/2026 — [`CONFERENCIA_CP2020.md`](../CONFERENCIA_CP2020.md))*
      - **13 divergências encontradas e corrigidas, 5 delas fora do índice de achados** (fumble do
        RED, tronco→perna, "Reputação" inventada, stun save inexistente, Mortal 6 tratado como
        morto). O resto — o que o modelo ainda não representa — está na conferência com fase dona.
      - **Método:** fonte secundária só vale com **duas concordando**; o que é inferência está marcado
        (Jury Rig/TECH, escopeta→Rifle). Três fontes descartadas por serem regra de casa — era delas
        que vinham a tabela "−4/−6" e o "sem ×2 na cabeça".
      - **Pendente do dono, com o livro na mão:** as duas inferências e a ordem ×2 × BTM (decide a D.1).
        *Pesquisa de 26/09:* escopeta→Rifle **confirmada** (duas fontes); Jury Rig **o livro não diz** —
        fica TECH por escolha registrada; a ordem da cabeça **o livro não diz** — resta só essa decisão,
        com recomendação (SP → BTM → ×2). A conferência também corrigiu uma afirmação minha sem fonte.
- [x] **C.10** Testes de paridade cliente↔servidor com a mesma entrada nos dois RNGs. *(ARQ-08, parte 1 —
      25/09/2026)*
      - **A paridade achou divergência mesmo com o motor único:** a ficha escrevia `Perícia (4)` e
        `Ataque com X`, a mesa `Handgun (4)` e `Ataque (X)`. O número batia, o texto não. A montagem
        "ficha → rolagem" subiu para `src/rules/rolls.ts` (`sheetSkillRoll`, `sheetAttackRoll`,
        `sheetDamageRoll`, `sheetDeathSaveRoll`, `sheetStunSaveRoll`), que o servidor e as casquinhas
        `rollSheet*` do cliente chamam. O `App.tsx` perdeu a lógica de regra que ainda tinha.
      - `parity.integration.test.ts`: **52 casos** — 3 fichas (ilesa, Crítica com cromo, Mortal 3) ×
        perícia, ataque, dano, stun e death save × filas com explosão, fumble e 1 depois de explodir.
        Compara o `RollResult` inteiro, menos id, horário e nome.
      - **Provado:** com as funções da ficha montando a rolagem como o `App` fazia antes, 30 dos 52
        falham; com as compartilhadas, 52 passam.
      - Fecha o **ARQ-02** (regras implementadas duas vezes, sem teste de paridade).
- [x] **C.11** Atualizar `docs/PRD.md` §5 no mesmo commit de cada correção. *(DOC-01, parte 2 — feito em
      cada commit da fase, e também na cópia do PRD que o app exibe, `src/data/prdData.ts`, e no
      `PROTOCOLO_MULTIPLAYER.md`, cuja tabela de rolagens a fase tornou falsa)*
- [x] **C.12** `git tag v0.4.2`. *(25/09/2026)*
- [x] **C.13** 📐 **Desenho** — a C.9 confere o [pipeline de dano](../ARQUITETURA.md#pipeline-de-dano-fnff) e a [máquina de ferimento](../ARQUITETURA.md#máquina-de-estados-do-ferimento) contra o livro, e **corrige os diagramas** com o que a conferência determinar. Eles são hipótese de trabalho, não autoridade.
      *(25/09/2026)* Os dois corrigidos: o pipeline ganhou o stun save, o efeito do livro, o BTM por
      BODY com mínimo 1, e perdeu o "death save com modificador cumulativo" (RED). A ordem ×2 × BTM
      ficou marcada como **decisão do dono antes da D.1** *(decidida em 26/09: opção A, armadura → BTM → ×2 — decisão 6)*. A máquina ganhou o estado **Morto**, fora
      do `woundLevel` — Mortal 6 é o último estado **vivo**.
      - **Gatilho de ADIAR que disparou, achado no passo 5 do ritual de abertura:** o ER do schema
        ("quando o schema mudar") — a `0007` da Fase B mudou o schema. Desenhado na mesma seção.
- [x] **C.14** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](../SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](../SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](../ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
      *(25/09/2026)* Saldo de superfície **negativo**: o `currentStats` do cliente deixou de ser
      confiado e o `mathjs` saiu. Entrada nova: o tipo `stun` e a leitura do `weapon.type`, ambos
      validados. **Achado:** o jogador ainda baixa o próprio `woundLevel` pela sincronia — levado à
      D.1 com gatilho. Diagrama de contêineres: a caixa `RULES` ganhou nota (o navegador roda o mesmo
      código, mas na mesa só vale o do servidor).
- [x] **C.15** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](../ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](../PLANO_MESTRE.md#-protocolo-de-sessão).
- [x] ✅ **Fase C concluída em:** __25__/__09__/__2026__ *(mergeada em 26/09/2026 — PR #8. CI do `master` verde nos 5 jobs, e o
      `db-sync` conectou: "Remote database is up to date", como esperado numa fase sem migration)*

---

### FASE D — FECHAR O LOOP DE COMBATE 🔨 *(3–4 dias)*

- [x] **D.0** 🔍 **Verificação de premissas** — a mesma disciplina da B.0 e da C.0 (que achou três
      premissas vindas do RED e de regra de casa). *(Item acrescentado em 26/09/2026, no pós-merge da
      C: o `CLAUDE.md` manda toda fase de construção abrir com um `.0`, e a D não tinha.)* Pontos de
      partida já conhecidos:
      - **As três dúvidas de regra da C estão resolvidas** (26/09/2026): a ordem na cabeça é
        **armadura → BTM → ×2** (decisão 6, do dono); escopeta usa Rifle (confirmado, duas fontes);
        Jury Rig fica em TECH (o livro não diz; escolha registrada, com gatilho). Detalhe na
        [conferência](../CONFERENCIA_CP2020.md#dano--a-ordem-do-pipeline-para-a-fase-d).
      - **As peças do pipeline já existem e seguem o livro** (Fase C): `HIT_LOCATIONS`,
        `btmFromBody`, `DAMAGE_POINTS_PER_WOUND_LEVEL`, `stunSaveRoll`, `deathSaveRoll`,
        `armorSpAt`. A D **liga** o que existe — não reescreve.
      - **Achado do portão C.14:** o jogador escreve o próprio `woundLevel` pela sincronia da ficha,
        e isso baixa a penalidade da rolagem. A D.1 decide quem escreve o `woundLevel`.
      - **"Morto" não é um `woundLevel`** (0–10, e o 10 é Mortal 6, vivo). Ver a máquina de ferimento
        no `ARQUITETURA.md`. Conferir se a D precisa desse estado ou se ele fica para depois.
      - Conferir contra o livro o que a C deixou para a D: penetração escalonada, perda de membro,
        dificuldade por alcance e o Combat Sense na iniciativa (D.4).
      - **Premissa de modelo, achada no preparo da D (28/09):** a ficha guarda só o **nível**
        (`woundLevel` 0–10), e o livro conta **pontos** (4 por caixa, 40 no total). Aplicar 6 pontos
        deixa Leve com 2 guardados para a próxima caixa — o modelo atual perde esses 2. *(Correção da
        D.1: 6 pontos já é **Sério**, com 2 das 4 caixas dele marcadas — o nível muda no primeiro
        ponto da caixa seguinte. O argumento vale igual: só o nível não diz quantas caixas faltam.)* Guardar pontos
        muda o **formato salvo** da ficha (o `data` jsonb e o `room_state`): não é migration SQL,
        mas é mudança de contrato que o `sheetSchema` e fichas antigas precisam aceitar. Decidir na
        D.0, antes da D.1. Se virar migration, vale a decisão 5 (PR próprio, antes do código).
      - **Duas perguntas para o dono, cedo na fase:** quem escreve o `woundLevel` quando o dano virar
        automático (D.1 — hoje o jogador baixa o próprio pela ficha), e o que acontece com dano em token
        sem ficha (D.2).
      - **Onde está o código:** regras em `src/rules/` (`tables.ts`, `character.ts`, `rolls.ts`);
        `armorSpAt` ainda mora em `src/utils/derivedStats.ts`; na mesa, `updatePlayerWoundLevel`,
        `updateNpcWoundLevel` e `rollDiceForPlayer` em `server/roomManager.ts`; grid em
        `src/features/multiplayer/TacticalGrid.tsx`. Padrão de teste da C: `scriptedRng`
        (`src/test/`), `table-rolls.integration` e `parity.integration` — a D deve seguir o mesmo.
      - **Custo:** cada dano aplicado é uma mutação da sala, e cada mutação reenvia a sala inteira a
        todos (ARQ-01). Não muda a estimativa de banda do contrato de custo zero, mas o fluxo da D.3
        não deve gerar mutação por passo intermediário (mirar, escolher alvo) — só no dano aplicado.
      - **Infra:** o Render está suspenso até 01/10 (ver Operação). Não bloqueia a D: o CI testa o
        build de produção, inclusive o E2E com dois navegadores.
      - **Resultado da verificação (28/09/2026).** Linha de base conferida (0 erros, 394 testes). As
        quatro perguntas foram ao dono e viraram a **decisão 7**. O que a leitura do código e das
        fontes mudou na fase:
        - **Pontos, não nível** (decisão 7b). Campo novo na ficha, `woundLevel` derivado. Ficha antiga
          sem o campo converte para o **mínimo da caixa** (`4 × (nível − 1) + 1`): não inventa dano.
          Sem migration SQL — confirmado que nenhuma migration tem coluna de ferimento; a ficha mora
          no `data` jsonb. O `HealthTracker` hoje mostra 11 botões de nível, não 40 caixas: a D mexe
          na ficha também.
        - **"Morto" entra na D** — as três mortes do livro chegam com ela: dano além da 40ª caixa, e
          cabeça com **mais de 8** pontos (D.1); death save falho (D.5).
        - **Perda de membro entra na D.1.** Mais de 8 pontos num membro de uma vez, **depois de todos
          os modificadores**, decepa ou inutiliza (S5, S9). O S9 manda um death save imediato em Mortal
          0 — **uma fonte só**: entra como aviso no chat, não como rolagem automática, até o dono
          conferir no livro.
        - **Stun save automático a cada dano aplicado** (regra conferida na C.7), rolado pelo servidor
          e registrado no chat com o dano. É o mesmo mecanismo da D.5 e fecha o "trilha de auditoria"
          da D.1. O estado **atordoado** não é guardado: o chat diz "FALHOU — fora de ação" e o GM
          conduz. **ADIAR**, gatilho: a mesa esquecer quem está atordoado.
        - **O GM não rola por NPC na mesa.** O `rollDiceForPlayer` só rola a ficha de quem pede. O
          fluxo da D.3 (NPC ataca) precisa de rolagem do GM **com a ficha do NPC** — autorização nova,
          vai para o portão. E o `damageRoll` devolve o local de impacto **só no texto** do detalhe; a
          D.3 precisa dele estruturado.
        - **Dificuldade por alcance** (D.3): queima-roupa 10, curto 15 (25% do alcance da arma), médio
          20 (50%), longo 25 (100%), extremo 30 (200%). A arma já tem `rangeMeters`. **Só um resumo de
          busca sustenta a tabela hoje** — a D.3 confirma com duas fontes antes de codar.
        - **Combat Sense soma na iniciativa** — confirmado (S5; S3 e S6 já estavam na conferência).
        - **Penetração escalonada** é opcional no livro segundo um resumo de busca (a página de origem
          não foi lida), e o S9 a trata como chave desligável. **ADIAR** (decisão 7d); gatilho na
          conferência.
        - **O `hp` do token no grid é espelho** do ferimento, mas o GM pode escrevê-lo direto pelo
          grid (o `mirrorDocToJson` deixa) sem mexer na ficha. Com o dano automático, o espelho passa
          a ser escrito só pelo servidor, a partir da ficha.
- [x] **D.1** `applyDamage(alvo, danoBruto, localizacao)`: SP da localização → BTM → ×2 na cabeça →
      conversão em níveis de ferimento (4 pontos por nível), com trilha de auditoria no chat. *(RUL-04 —
      28/09/2026)*
      - **Regra:** `resolveHit` e `applyHit` em `src/rules/damage.ts`, testados contra a tabela
        (`rules-damage`, 25 casos). Constantes novas no `tables.ts`: `WOUND_TRACK_POINTS` (40),
        `SEVERE_HIT_THRESHOLD` (8), `MIN_DAMAGE_AFTER_BTM`, e `limb` em cada local de impacto. O
        `armorSpAt` saiu do `utils` para `src/rules/` (o servidor lê).
      - **Ficha em pontos (decisão 7b):** `damagePoints` e `isDead` no tipo e no `sheetSchema`; o
        `woundLevel` é derivado e continua gravado para os leitores antigos. A ficha mostra as 40
        caixas do livro (10 níveis × 4) em vez de 11 botões.
      - **Servidor:** `applyDamage` (só GM) + `POST /api/rooms/:code/damage`. Faz a conta, grava os
        pontos, espelha o nível no token do grid, **rola o stun save sozinho** (com o nível novo) e
        deixa a conta inteira no chat. Mais de 8 na cabeça ou além dos 40 → Morto; mais de 8 num
        membro → aviso de perda do membro. O ajuste manual do GM passou a gravar pontos.
      - **Achado do portão C.14 fechado (decisão 7a):** a sincronia e a reconexão mantêm o ferimento
        do servidor; a ficha do jogador fica só-leitura na mesa e **recebe** o ferimento de lá.
        **Provado revertendo:** com as duas linhas antigas (`updatePlayerSheet` e `joinRoom`), os 3
        testes da decisão 7a em `damage.integration` falham; com as novas, passam.
      - Um teste antigo mudou de propósito: o LWW da reconexão (T3.3) usava o `woundLevel` como
        amostra — agora usa `gearNotes`, porque o ferimento não segue mais o LWW.
      - **O commit da D.1 quebrou 2 E2E da ficha** (clicavam os 11 botões de nível que viraram 40
        caixas). Só apareceu ao rodar o E2E na D.3; corrigido lá, trocando os seletores pelo primeiro
        ponto de cada nível — as asserções de regra ficaram iguais.
      - **ADIAR — desfazer uma morte na mesa.** O ajuste manual do GM não mexe no `isDead`, e a
        sincronia também não. **Gatilho:** o GM precisar corrigir uma morte aplicada por engano.
      - Diagramas (pipeline e máquina de ferimento) atualizados no mesmo commit — a D.8. A máquina
        tinha as transições no **teto** de cada caixa (Leve → Sério em "8 pontos"); o nível muda no
        primeiro ponto da seguinte (5).
      - **Ordem decidida (decisão 6):** armadura → BTM (mínimo 1) → ×2 na cabeça. O
        [diagrama](../ARQUITETURA.md#pipeline-de-dano-fnff) já está nessa ordem.
      - **Achado do portão da C.14:** hoje o jogador escreve o próprio `woundLevel` pela sincronia da
        ficha (`updatePlayerSheet`), e desde a C.6 isso **baixa a penalidade da rolagem**. Quando o dano
        virar ferimento no servidor, a sincronia não pode mais baixá-lo. Se a D não resolver, vira item
        da Fase J.
- [x] **D.2** Definir e implementar o caso do **token sem ficha**: o grid tem tokens `cover` e
      `hazard` sem `sheet` nem BTM, só `spCover`. Precisa estar decidido antes de codar.
      *(28/09/2026 — decisão 7c)* O `applyDamage` acha a ficha pelo jogador, pelo NPC ou pelo token
      deles; token sem dono com ficha (cobertura, perigo, NPC criado direto no grid) é recusado com
      `400` e a mensagem "gere-o com ficha". Testado em `damage.integration`. Cobertura como proteção
      do alvo: ADIAR, gatilho na conferência.
- [x] **D.3** Fluxo de GM: rolar ataque → acertar token → aplicar dano, sem sair do grid. *(28/09/2026)*
      - **Regra conferida antes de codar:** a tabela de alcance (10/15/20/25/30, cortes em 1 m, ¼, ½,
        1× e 2× o alcance da arma — p. 99) tem **S8 e S9**, e o S1 confirma as quatro de cima. O ataque
        acerta com total **igual ou maior** que a dificuldade (S8, S9); fumble erra sempre.
        `RANGE_BANDS` no `tables.ts`; `rangeBandFor`, `rangeBandMeters` e `attackHits` no `combat.ts`.
      - **Servidor:** `resolveGmAttack` + `POST /api/rooms/:code/attack` (só GM). Um NPC **com
        ficha** ataca um alvo com ficha, numa faixa ou numa dificuldade livre (1–50); se acertou, rola
        dano e local e aplica pelo **mesmo núcleo da D.1** (`applyDamageTo`). Uma mutação por ataque,
        como o contrato de custo pede. Recusa antes de rolar qualquer dado: jogador como atacante (ele
        rola o próprio), NPC morto, alvo sem ficha, o NPC contra si mesmo, faixa inválida.
      - **Rolagem de dano com local estruturado:** `RollResult.hitLocation`. Antes o local só existia no
        texto do detalhe. A paridade cliente↔servidor (C.10) continua verde.
      - **Tela:** o cartão do token selecionado ganhou, para o GM, "NPC ataca" (atacante, faixas com os
        metros da arma, "Outra") e "Aplicar dano" (com "usar último dano" rolado **por jogador** — o
        dano do ataque de NPC já foi aplicado pelo servidor e não é oferecido de novo). As duas seções
        recolhem, para o cartão não cobrir o grid. Token sem ficha mostra o aviso da D.2.
      - **Visto funcionando no navegador**, com sala semeada localmente: ataque que errou (17 < 20),
        ataque que acertou (dano 5 no braço → 2 pontos, stun save), e o "aplicar dano" pela tela.
      - 19 testes em `gm-attack.integration` + 1 de rota. **ADIAR:** queima-roupa com dano máximo (uma
        linhagem de fonte) e a rolagem resistida do corpo a corpo — gatilhos na conferência.
      - **Pista da Fase G (achada ao testar):** em modo dev, **todo deep link** (`/room/X`,
        `/multiplayer`) volta para `/`. O efeito "aba → URL" do `App.tsx` se protege do primeiro render
        com um `ref`, e o `StrictMode` roda o efeito duas vezes. Produção não tem `StrictMode` duplo,
        mas o E2E roda o build de produção — por isso nunca apareceu.
- [x] **D.4** Iniciativa automática (`1d10 + REF` no servidor para todos), com ajuste manual mantido.
      *(RUL-09 — 28/09/2026)*
      - **Regra conferida:** `1d10` **aberto** + REF **corrente** + Combat Sense do Solo (S1
        `1d10!!+REF+Combat_Sense`; S8 `1d10x10 + ref.total + CombatSense`, com o ferimento já no REF).
        O 1 **não** é fumble: iniciativa não é teste. O `resolveCheck` ganhou `fumbleTable: false`
        para isso; `sheetInitiativeRoll` em `rolls.ts`, `combatSenseBonus` em `roles.ts`.
      - **Servidor:** `rollInitiative` (só GM), pela rota e pelo WebSocket (`action: "roll"`). Rola
        para os jogadores (menos o GM) e os NPCs vivos com ficha; a entrada que o GM pôs à mão continua
        com o valor dela. Empate fica na ordem da rolagem (o livro não dá desempate — ADIAR com
        gatilho na conferência). As parcelas de cada rolagem vão para o chat.
      - **Achado ao mexer no `updateInitiative`:** a entrada era gravada com `{ ...e }` — **qualquer
        campo** do cliente virava estado da sala, persistido e transmitido a todos, sem teto de
        tamanho; e a vez podia apontar para outra entrada que não a primeira. Agora a entrada é montada
        campo a campo e a vez começa no primeiro. **Provado revertendo:** com o corpo antigo, os 2
        testes do ajuste manual falham; com o novo, passam. Só o GM chegava a esse caminho — vai para
        o portão (D.9).
      - **Tela:** "🎲 Rolar iniciativa" na aba de iniciativa, só para o GM. **Visto no navegador:**
        Vex 27 (o 10 explodiu, 10 → 9), o NPC 23 e o Kaze 14 (Solo, com Combat Sense 3), e o "Guarda"
        posto à mão continuou na lista.
      - 15 testes em `initiative.integration` + 1 de rota.
- [x] **D.5** Death saves entrando na virada de turno de quem está em nível mortal. *(28/09/2026)*
      - **Regra conferida, e maior que o texto do item:** em Mortal, o death save vem **logo depois do
        dano** (antes do stun save) **e a cada turno** depois, até morrer ou ser **estabilizado**; dano
        novo desfaz a estabilização (S5; S9 com as p. 99 e 105). Sem estabilização, a rolagem
        automática a cada turno mataria todo mundo cedo ou tarde — divergência do livro. Por isso a
        D.5 trouxe o `isStabilized` mínimo.
      - **Servidor:** o `nextTurn` rola o death save quando a vez chega a quem está em Mortal, vivo e
        não estabilizado (jogador ou NPC; entrada posta à mão não tem ficha). O núcleo do dano rola o
        death save antes do stun; falhou, Morto e sem stun. `setStabilized` + `POST
        /api/rooms/:code/stabilize` (só GM, só em Mortal). Na mesa, o `isStabilized` é do servidor —
        a sincronia e a reconexão o mantêm, como o ferimento.
      - **Provado revertendo:** sem a linha que mantém o `isStabilized` do servidor na sincronia, o
        jogador se estabiliza sozinho e o teste falha.
      - **Tela:** o cartão do token mostra o estado ("Mortal 2 · 21/40 · estabilizado") e o botão
        "🩹 Estabilizar"/"Desfazer" em Mortal; a ficha do jogador mostra "Estabilizado". **Visto no
        navegador:** a vez chegou ao Vex (Mortal 2) e o servidor rolou "4 ≤ 6 (BODY 8 − 2)";
        estabilizado pelo cartão, a vez deu a volta e nenhum death save novo saiu.
      - Um teste da D.1 ganhou um dado na fila: o NPC que leva 40 pode cair em Mortal e agora rola o
        death save também. 14 testes em `death-save-turn.integration` + 5 no `damage.integration` +
        1 de rota.
      - **ADIAR:** a rolagem de estabilização (First Aid/Medical Tech) automática — o GM conduz e
        marca; gatilho na conferência.
- [x] **D.6** Testes de comportamento do loop (aplicar dano, avançar turno). *(ARQ-08, parte 2 — 28/09/2026)*
      - Cada peça já nasceu com teste na D.1–D.5 (`rules-damage`, `damage`, `gm-attack`, `initiative`,
        `death-save-turn`). A D.6 acrescentou o que faltava:
      - **`combat-loop.integration`** — **uma luta inteira**, na ordem da mesa e com dados
        roteirizados: iniciativa → o NPC acerta → perda da perna e Mortal 0 → death save na hora e
        stun → o jogador tenta se curar pela sincronia (não passa) → death save na virada de turno →
        o GM estabiliza → a vez passa sem rolar → dano novo desfaz a estabilização → death save falha
        → morto sai da iniciativa seguinte. Confere também a trilha do chat, na ordem.
        O teste pegou um erro **meu**, não do código: eu esperava a iniciativa do Vex com REF 8, e ele
        estava Sério — o REF corrente é 6. É a D.4 funcionando.
      - **`combat-ui`** — 19 testes de comportamento dos componentes que a fase criou, onde o ARQ-08
        apontava o buraco (a UI tinha 3 smoke tests): o `CombatPanel` (o que manda ao atacar e ao
        aplicar dano, faixas e "Outra", "usar último dano", estado do alvo, estabilizar só em Mortal) e
        o `HealthTracker` (40 caixas, marcar e desmarcar, ficha antiga no mínimo da caixa, **só
        leitura na mesa**, Morto, estabilizado).
      - **Provado que mordem:** sem a trava da mesa no `HealthTracker` e sem o filtro de Mortal no
        botão de estabilizar, os 2 testes certos falham; com elas, os 19 passam.
      - 505 → 525 testes. A parte 3 do ARQ-08 (o resto dos componentes) continua com as Fases G–H.
- [x] **D.7** `git tag v0.4.3`. *(28/09/2026, no último commit da fase, antes do PR — como a `v0.4.2` na C)*
- [x] **D.8** 📐 **Desenho** — implementar o `applyDamage` contra o [pipeline de dano](../ARQUITETURA.md#pipeline-de-dano-fnff) já confirmado pela Fase C. Se a implementação divergir do desenho, o desenho muda junto no mesmo commit.
      *(28/09/2026)* Divergiu, e o desenho mudou junto em cada commit: o pipeline ganhou o acerto grave
      (> 8: cabeça mata, membro se perde), a trilha em pontos e a morte além dos 40 (D.1), e o death
      save na hora do dano e a estabilização (D.5). A máquina de ferimento tinha as transições no
      **teto** de cada caixa (Leve → Sério em "8 pontos") — corrigidas para o primeiro ponto do nível
      seguinte — e ganhou o `isDead` e a estabilização. Conferidos de novo no fechamento.
- [x] **D.9** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](../SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](../SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](../ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.**
      *(28/09/2026)* Registro em [`SEGURANCA.md`](../SEGURANCA.md#fase-d--loop-de-combate). O GM ganhou
      poderes sobre as fichas dos outros (dano, ataque do NPC, estabilizar, iniciativa), todos com
      `checkIsGm` e 403 testado. **O achado da C.14 está fechado** (a sincronia e a reconexão não
      escrevem mais o ferimento), e o `updateInitiative` parou de gravar campo arbitrário — os dois
      provados revertendo. **Achado do portão:** a porta lateral "sair e voltar curado", levada à Fase
      J com gatilho; e a sala sem teto de NPCs, pista da Fase E. Nenhum diagrama de contêineres mudou:
      as rotas novas vivem no mesmo servidor, atrás da mesma sessão.
- [x] **D.10** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](../ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](../PLANO_MESTRE.md#-protocolo-de-sessão).
      *(28/09/2026)* Plano, linha de base, `CLAUDE.md` (o "falta fechar o loop" virou falso), PRD,
      protocolo, conferência e diagramas em dia. **Revisão do que a fase produziu:** o
      `clampWoundLevel` ficou morto com o `HealthTracker` novo (saiu, com os 3 testes dele); o
      `pushSystemMessage` passou a usar o `chatTime`; o ajuste manual do GM parou de ter uma lista
      própria de nomes de nível (duplicava a `WOUND_TRACK`) e passou a dizer pontos, não "/10 caixas".
      Memória: só o truque de testar a mesa como GM no navegador local.
- [x] ✅ **Fase D concluída em:** __28__/__09__/__2026__ *(mergeada em 29/09/2026 — PR #12, tag `v0.4.3`.
      CI do `master` verde nos 5 jobs, e o `db-sync` conectou: "Remote database is up to date", como
      esperado numa fase sem migration)*
