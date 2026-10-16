# Histórico — Fase H: varredura do multiplayer

> Movido do [`PLANO_MESTRE.md`](../PLANO_MESTRE.md) no **terceiro corte (16/10/2026)**, junto com as
> Fases E e G, pelo método da [R.13](./AUDITORIAS_E_PENDENCIAS_R.md#-pendências-da-revisão-pós-d--antes-da-fase-e)
> e sem mudar o texto: só os caminhos de 16 links, que mudam porque o arquivo mudou de pasta. **Por
> quê:** com as três fases inline, o plano tinha ~1.600 linhas e ~66 mil tokens — quatro leituras da
> ferramenta do Claude —, e sessão fria que lê em pedaços pula coisa. A fase fechou em
> 16/10/2026 (código em 15/10). **Está fechada** — nada aqui é marcado de novo. O estado vivo é o do plano.

---

### FASE H — 🔍 VARREDURA: MULTIPLAYER *(2 dias)*

Escopo: transporte WebSocket, fallback SSE, CRDT Yjs, awareness, reconexão, presença. A varredura
mais cara — os bugs aqui só aparecem com duas pessoas e rede ruim, e é onde a decisão 3 concentra o
uso real.

**Como varrer:** não é teste automatizado — é quebrar de propósito, com o log aberto, **cenário por
cenário**. Cada cenário é uma caixa, e o ledger anota o que se esperava, o que aconteceu e os eventos
do log. Onde: o **build de produção local** (`npm run build` e `npm start` com
`NODE_ENV=production`, como o E2E), que não gasta hora nem banda do Render; só o H.1j precisa do ar.
Rede estrangulada pelo DevTools (perfil lento) ou pelo `setOffline` do Playwright. *(ARQ-08, parte
3.)* Segue o [roteiro de uma varredura](../PLANO_MESTRE.md#o-roteiro-de-uma-varredura).

- [x] **H.0** 🔍 **Premissas** — medidas em 29/09/2026:
      *(14/10/2026 — as pistas conferidas contra o `master` em `8203479`: **todas bateram**, e as linhas
      das pistas da E e da G foram medidas de novo. Duas coisas a mais: as revogações que não são expulsão
      **não fecham o socket** de quem perdeu a sessão, e um comentário do `server.ts` guardava uma pista
      que o plano não tinha — o cliente não lê o código de fechamento 4400/4409. O Registro de sessões
      segue vazio: a H corre sem sessão real. Tabela no topo do [ledger](../varreduras/H-multiplayer.md).)*
      - ~~**O stream SSE só confere o token na abertura** — a expulsão não derruba um stream aberto.~~
        *Resolvida para a expulsão na R.3:* a rota fecha o stream do expulso (`ssePeer`). Resta a
        pergunta para outras revogações — no H.1e.
      - **Awareness órfão dura até 30 s, não para sempre.** O `y-protocols` apaga o estado remoto que
        não se atualiza em 30 s (`outdatedTimeout`, no servidor e em cada cliente). O servidor não
        remove o estado quando o socket fecha (`server.ts:1297`, depois da E) — o sintoma possível é um cursor
        fantasma de até 30 s.
      - **O gatilho da [ADR 0002](../adr/0002-yjs-websockets.md) é conferido aqui** (bug de
        convergência). A autorização por diff do grid já teve um buraco (SEC-12, R.6) — evidência para
        a ADR, não gatilho.
      - **O diagrama adiado da sequência do handshake** tem gatilho "quando a H precisar depurar
        reconexão" ([`ARQUITETURA.md`](../ARQUITETURA.md#diagramas-adiados)) — decidir no H.1d.
      - **De preferência, com uma sessão real já registrada** no [Registro de sessões](../PLANO_MESTRE.md#registro-de-sessões):
        os bugs daqui aparecem com gente de verdade, e a primeira sessão é o melhor insumo da H.
      - *Levados pela E (30/09/2026), do [ledger](../varreduras/E-backend.md):*
        - **O cliente cai para o SSE numa queda de rede comum** (E.14, lido, não reproduzido): o
          `wsEverOpen` nasce `false` a cada tentativa (`MultiplayerRoom.tsx:171`); se o WS cai depois de
          conectar e a tentativa de 3 s depois falha, o cliente vai para o SSE e o servidor registra
          `sse_fallback`. É o H.1g — e a contagem da L.6 depende dele.
        - **Todo deploy roda duas instâncias por ≥60 s** (E.06, pela [doc do Render](https://render.com/docs/deploys)):
          a nova recebe o tráfego novo e restaura do banco no boot; a velha segue com os sockets e só leva
          o `SIGTERM` 60 s depois. O H.1j confere o que se perde — o ledger tem a previsão.
        - **Socket que não lê agora é derrubado** (E.03, 1 MiB): na rede estrangulada do H.1b, conferir
          que um jogador lento de verdade **não** cai por isso.
      - *Levados pela G (13/10/2026), do [ledger](../varreduras/G-frontend.md) e da revisão G.3h — todos
        ADIAR com gatilho que a H pode disparar:*
        - **O console já tem um erro do React a cada edição da ficha** (G.01: `Cannot update a component
          (App) while rendering…`). A H lê o console de três abas: se ele esconder um erro de verdade, o
          gatilho dispara, e a versão de uma linha (o `syncSheetStore` num `useLayoutEffect`) entra.
        - **No dev, o deep link volta para `/`** (G.02). Por isso os cenários de refresh e deep link (H.1c,
          H.1d) vão no build de produção. Se a H precisar do HMR, o gatilho dispara — a versão de uma linha
          está no ledger.
        - **Trocar de ficha com a mesa aberta leva o ferimento para a ficha nova** (G.03) — o mesmo caminho
          da H.1i. Se a H.1i mexer nele, os dois se resolvem juntos.
        - **O menu consulta o perfil a cada troca de aba, sem `catch`** (G.11): uma rejeição sem tratamento
          no console numa sessão da H dispara o gatilho.
        - **"Gerar NPC", "Gerar Jogador" e "Rolar iniciativa" não têm a trava do clique duplo** (G.3h). A
          H.1a monta a mesa de base com eles: se dobrarem ali, o gatilho dispara, e a versão é o `run` do
          `useInFlight`.
        - **O `reconnectSession` tem trava própria, separada da do `joinRoom`** (G.3h). Onde os dois se
          cruzariam (a página da sala aberta com a mesa já ativa e o token vencido) está no
          [protocolo](../PROTOCOLO_MULTIPLAYER.md) — a H.1c e a H.1e conferem.
        - **As linhas citadas nas pistas acima mudaram**: a G levou o `MultiplayerRoom` de 1.049 para 1.123
          linhas (o `wsEverOpen` do E.14 saiu da `:171` para a `:227`). Medir de novo no dia, como manda o
          passo X.0.
> **Estado em 15/10/2026:** a H.0–H.2, a H.3a–c e a H.4 estão feitas, no PR #46. O H.1j rodou no ar, combinado
> com o dono (ele clicou no "Manual Deploy" com a mesa de teste aberta), e a H.3 executou os dois FAZER e o H.02
> que o conserto disparou. **O dono decidiu o H.13 como FAZER** (15/10, no #46): é a **H.3d**, a passagem de
> bastão entre instâncias, com o H.10 e o H.11 — ~2 dias, dois PRs e mais um teste no ar com ele. **Falta:** a
> H.3d, pelas caixas dela, e a H.5 (o `master` verde depois de cada merge, e a data da fase).
> *(15/10/2026, 23:55 — **a H.3d está feita e provada no ar**: a migration no #47, o código no #48, o aviso antes
> do fechamento no #49 — o que a primeira prova no ar pediu —, e a H.3d.4 refeita perdeu 0 de 30. **Falta só a
> H.5:** o merge do PR do registro, o `master` verde depois dele, e a data da fase.)*
> ***Fase H fechada em 16/10/2026*** *(o #50 mergeado e o `master` verde). A próxima é a **Fase I** — a varredura da
> integração backend ↔ frontend —, começando pela I.0.*

- [x] **H.1** Varredura por cenário → ledger em `docs/varreduras/H-multiplayer.md`. *(14/10/2026 — os dez cenários
      locais no #44; o H.1j, no ar, depois do merge dele.)*
  - [x] **H.1a Mesa de base:** GM + 2 jogadores em 3 abas, do zero ao combate. O que os outros cenários
        comparam.
        *(14/10/2026 — tudo bateu, sem item: três contextos isolados do Playwright contra o build de
        produção, 0 erro de console, o ferimento igual na mesa e na ficha local. A régua: um chat custa
        6,7 KB por aba, o ataque mais o dano ~72 KB, 45 s parada 0,5 KB. Os gatilhos da G.3h e do G.01 não
        dispararam.)*
  - [x] **H.1b Rede estrangulada:** chat, rolagem, token movido e dano chegam, e na ordem? Broadcast
        completo e update Yjs incremental podem chegar fora de ordem.
        *(14/10/2026 — um proxy TCP de 3G lento (50 KB/s) no Beto: tudo chega e **na ordem**, e o token
        converge. O jogador lento **não cai** pelo teto de 1 MiB do E.03 — só num túnel de 90 s, e a volta é
        limpa (mesmo assento, alcança em 4 s). H.01 ADIAR para a L.1: numa rajada ele fica 7–9 s atrás,
        porque cada ação reenvia a sala inteira. H.02 ADIAR: cada queda deixa a conexão Yjs velha viva.)*
  - [x] **H.1c Refresh no meio do combate** — do jogador e do GM.
        *(14/10/2026 — quem entrou pelo link do convite ou pelo deep link volta ao mesmo assento, com o
        ferimento e a vez. **H.03 FAZER — reproduzido:** quem entrou pelo lobby fica em `/multiplayer`, e o F5
        o devolve ao lobby; entrando de novo, ganha outro `peerId` — o jogador duplica, e **o GM que criou a
        mesa pela tela vira jogador comum: a mesa fica sem Mestre**. H.04 ADIAR: dois F5 com o `join` em voo
        duplicam o assento (1 em 3), gatilho na H.1j.)*
  - [x] **H.1d Servidor reiniciado com a mesa aberta:** restore, sessões persistidas (B.4) e o fluxo
        401 → `join` **com o token** que a R.1 impôs.
        *(14/10/2026 — com o Supabase local de verdade e a queda brusca (no Windows, o processo morre sem o
        `flushAllPending`): o restore volta com a sala e as sessões, e quem tinha o token gravado segue igual.
        H.10 ADIAR — o *debounce* reinicia a cada mutação, e uma rajada de 10 s nunca foi gravada: a queda
        perdeu a rajada inteira. H.11 ADIAR — quem deu F5 na janela volta como outro jogador. O diagrama do
        handshake segue ADIAR: não fez falta.)*
  - [x] **H.1e O mesmo jogador em duas abas:** o `join` com token revoga as sessões antigas
        (`roomManager.ts:668`, depois da E) e não fecha o socket da outra aba — o que ela vê?
        *(14/10/2026 — duplicar a aba: a antiga segue vendo e agindo pelo socket aberto, e no primeiro REST
        (401 → `seat_taken`) **vira outro jogador em silêncio** — dois assentos com o mesmo nome. H.05 ADIAR,
        com o H.04: os dois pedem ao servidor distinguir "token substituído por outro `join`". O 4409 da pista
        nova não dispara: a rotação separa os `peerId`.)*
  - [x] **H.1f O GM sai** (T1.8): existe janela de dois GMs ou de nenhum? A variante do SEC-07 pelo
        *handle* do GM segue ADIAR (R.1).
        *(14/10/2026 — dois GMs, nunca: o "Sair" passa o cargo e revoga o token no mesmo passo. Nenhum GM, sim,
        e permanente: **H.06 ADIAR (o mais perto da linha)** — o GM que fecha a aba e volta pelo convite é
        jogador novo, e o cargo fica num assento que ninguém reclama; H.07 ADIAR — o cargo pode ir para uma
        ficha gerada. H.08 DESCARTAR: o código 4400/4409 não lido não muda nada na tela.)*
  - [x] **H.1g Queda para SSE** (bloquear o WebSocket): o que deixa de funcionar, o jogador fica
        sabendo, e o `sse_fallback` aparece no log?
        *(14/10/2026 — no SSE funcionam chat, rolagem e presença; **o jogador não move o próprio token** (o
        REST do grid é do GM) e só fica sabendo pelo "Acesso Negado". O `sse_fallback` aparece, com o *user
        agent*. **H.09 FAZER — o E.14 reproduzido:** uma queda de ~6 s deixa a jogadora no SSE para sempre, e o
        log conta a queda como proxy.)*
  - [x] **H.1h Último socket fecha e alguém reconecta no mesmo instante:** o `destroyRoomYjs`
        (`server.ts:1302`, depois da E) descarta o doc — a reconexão perde movimento do grid?
        *(14/10/2026 — não perde: o CRDT convergiu nas três corridas (os dois sockets caindo juntos, o
        movimento em voo, o GM caindo enquanto a Ana move), sem token duplicado — o JSON é espelhado a cada
        update. De carona, **o grid congela na tela de quem caiu para o SSE**: foi para o H.09. O gatilho da
        ADR 0002, na leitura desta varredura, não disparou — vai à H.2 para o dono confirmar.)*
  - [x] **H.1i Ficha editada em duas abas:** a reconexão resolve por **last-write-wins com o
        `updatedAt` do cliente** — o relógio do navegador decide quem ganha.
        *(14/10/2026 — não decide nada que importe, sem item: com o relógio 2 h atrasado a edição entra na
        mesa. A ficha de um assento tem um escritor só além do servidor (que só escreve o ferimento), e a
        sincronia grava sem comparar `updatedAt` logo depois de cada reentrada. Duas abas: é o H.05.)*
  - [x] **H.1j** *(no ar)* **O Render troca a instância com a mesa aberta:** um merge no `master` no
        meio da sessão publica sozinho (30 s entre `SIGTERM` e `SIGKILL`); e a volta depois de hibernar
        leva ~1 min ([free](https://render.com/docs/free)).
        *(14/10/2026, 22:32–22:55, combinado com o dono — ele clicou no "Manual Deploy" com a mesa de teste
        aberta; roteiro `scripts/multiplayer/h1j.mjs`, ensaiado antes no build local com duas instâncias. **As
        duas instâncias ficaram vivas ~20 s**, não os 60 s da doc do Render: perdeu-se o que a velha recebeu
        pelo WebSocket nesse intervalo (1 mensagem), e os três voltaram em 3 s ao mesmo assento, sem SSE —
        **H.13** — o E.06 medido; ADIAR na primeira leitura, FAZER por decisão do dono (a H.3d). **A hibernação:** o despertar levou ~22 s, e um `join` abortado aos 4 s
        não chegou ao servidor — o gatilho do **H.04** não disparou. A mesa de teste saiu do banco no fim.)*
  - [x] **H.1k Habilidade especial na mesa:** não é rolável — o tipo `skill` procura em `sheet.skills`,
        e ela mora em `specialAbilityName` (visto na C.8). Na ficha funciona. Sem sintoma de mesa até
        alguém pedir.
        *(14/10/2026 — confirmado pela API, e é maior: a mesa **não tem botão de perícia nenhum**; o tipo
        `skill` só existe no servidor. De carona, a ficha gerada guarda a habilidade especial com o
        atributo do ternário que a C.8 tirou da ficha. H.12 ADIAR, gatilho: alguém pedir.)*
- [x] **H.2** Calibragem e PR do ledger — passo X.2.
      *(14/10/2026 — calibragem: **2 FAZER em 12, 17%**, abaixo de 1/3 na primeira passada. Ledger e roteiros
      mergeados no **PR #44** em 14/10/2026; `master` verde, deploy no ar. **O merge aprovou os veredictos como
      estavam**, inclusive os dois que foram destacados ao dono: o **H.06** fica ADIAR (o GM que fecha a aba
      perde a mesa — a versão menor, a credencial do GM no `localStorage`, cabe no PR do H.03 se o dono pedir)
      e o gatilho da **ADR 0002 não disparou** (a revisão está na própria ADR). *Com o H.13, do H.1j: 13 itens,
      2 FAZER, 15%. O dono decidiu o H.13 como FAZER no #46 (15/10): **3 FAZER, 23%** — a H.3d.*)*
- [x] **H.3** Executar só os FAZER — passo X.3. Teste que reproduz **escrito antes**, a prova revertendo,
      um commit por item, e a conferência na tela pelo roteiro do cenário (`scripts/multiplayer/`). H.3, H.4 e
      H.5 num PR só, como o #41 da G. As linhas citadas são as do ledger (`master` em `8203479`); medir de novo.
      *(14/10/2026 — os três, **+9 testes** em dois arquivos novos, cada um visto falhando com o código antigo e
      conferido na tela do build de produção local; a seção [H.3 do ledger](../varreduras/H-multiplayer.md#h3--os-fazer-executados) tem a tabela.)*
  - [x] **H.3a** **H.03 — a mesa ativa pelo lobby troca a URL por `/room/CÓDIGO`** (`navigate(…, { replace:
        true })`) ao criar e ao entrar (`MultiplayerRoom.tsx:351–383`). O F5 passa a cair no `RoomPage`, que já
        volta ao mesmo assento com o token — o caminho que a H.1c provou. Conferir que o efeito "aba → URL"
        do `App` (`:94–115`) não briga (o `pathToTab('/room/X')` já dá `multiplayer`) e que o "Sair" em
        `/room/CÓDIGO` volta ao lobby com o código. Teste: `room-refresh` — criar e entrar pelo lobby deixam
        a URL em `/room/CÓDIGO`; e o "F5" (stores zeradas, o app montado de novo na URL atual com o
        `sessionStorage`) manda o `join` com o **mesmo `peerId` e o token**. Na tela: `h1c.mjs` (o Beto volta
        com o mesmo `peerId`); o `h1c-gm.mjs` monta o estado de antes do conserto (`/multiplayer`) — ajustar
        para partir de `/room/CÓDIGO`, a URL que o conserto deixa.
        *(14/10/2026 — o `RoomPage` virou a página das duas rotas: no lobby, a mesa ativa leva a URL para
        `/room/CÓDIGO`, e ele não repete o `join` de uma sessão viva — sem essa guarda, o token trocava à toa.
        `room-refresh` (4): os 4 falham com o código antigo. O `h1c-gm.mjs` agora faz o caminho de verdade —
        login no Supabase local com um usuário descartável, "Criar Mesa como GM", F5: o GM segue GM.)*
  - [x] **H.3b** **H.09 — depois de uma conexão que funcionou, a queda tenta o WebSocket de novo**, com espera
        crescente, em vez de abrir o SSE: o "já abriu uma vez" sai da rodada do efeito para um `useRef`
        (`MultiplayerRoom.tsx:226–283`); o SSE fica para quem **nunca** conectou (o proxy corporativo, o que
        o `sse_fallback` quer contar). E, na mesma mudança, zerar o `yjsGrid` quando o socket cai, para a
        tela voltar ao JSON da sala (`:659`). Teste: `room-transport` — um WebSocket falso controlável (uma
        variação do `stubRoomTransport`): abre, cai, a tentativa seguinte falha, e o cliente tenta o
        WebSocket de novo, não o `EventSource`; quem nunca conectou ainda cai no SSE; sem Yjs, o grid da tela é
        o da sala. Na tela: `h1g.mjs` (parte B — a Ana volta ao WebSocket) e `h1h.mjs` (parte 4 — o grid não
        congela).
        *(14/10/2026 — espera de 3, 6, 12… até 30 s, de volta a 3 s quando conecta. `room-transport` (4), com o
        `controlRoomTransport`: 3 falham com o código antigo, e o do proxy (nunca conectou → SSE) passa nos dois.
        Na tela, a Ana volta ao WebSocket e arrasta o próprio token, e o log tem **um** `sse_fallback` — o do
        Beto, atrás do proxy.)*
  - [x] **H.3c** **H.02 — o gatilho dispara com a H.3b** ("alguém mexer no `onclose`"): a conexão Yjs velha
        recebe `destroy()` quando o socket cai, antes de zerar o ref (`MultiplayerRoom.tsx:267–271`). Teste:
        no mesmo `room-transport`, a queda chama o `destroy()` da conexão velha (ou: nenhum `setInterval` a
        mais por queda — medido +2 no H.1b).
        *(14/10/2026 — `room-transport` +1, falha com 0 chamadas ao `destroy`. No `h1b-tunel.mjs`, 4 intervalos
        vivos antes e depois do túnel de 90 s — eram 4 → 6.)*
  - [x] **H.3d** **H.13 — a passagem de bastão entre instâncias no deploy** *(FAZER por decisão do dono, 15/10/2026,
        no PR #46 — o [H.13 do ledger](../varreduras/H-multiplayer.md#h13--no-deploy-com-mesa-aberta-o-que-a-instância-velha-recebe-nos-20-s-depois-de-a-nova-subir-se-perde)
        tem o desenho e as versões descartadas)*. Hoje, num deploy, a nova instância lê a mesa do banco ao ligar e as
        duas seguem separadas por ~20 s; o que vai à velha some (H.1j). **O conserto:** só uma instância manda na mesa
        por vez. A nova anota no banco que quer assumir e não abre a porta (o servidor só escuta depois do restore,
        `server.ts:1417`, e o Render só troca o tráfego com o `/api/health` respondendo); a velha, que confere a
        anotação a cada 2 s, para de aceitar ações, fecha os sockets, grava tudo e marca que entregou; só então a nova
        lê o banco e escuta. Sem marca de vida da velha (morta, ou o serviço hibernava), a nova assume depois de alguns
        segundos — a volta da hibernação não espera. **Preço:** um "reconectando" de uns 5–20 s a cada deploy, no
        lugar da perda em silêncio; uma escrita no banco a cada 2 s com o serviço acordado. ~2 dias. De carona, no
        mesmo arquivo da persistência, o **H.10** e o **H.11**, com os gatilhos disparados por ela.
    - [x] **H.3d.0** 🔍 **Premissas** (com o dono no painel do Render — o login é dele): (1) no log do deploy de
          14/10 (~22:34 BRT; o log do Hobby guarda 7 dias, até ~21/10), a instância velha registrou o
          `server_shutdown` — recebeu o `SIGTERM`? (2) o serviço Docker tem o health check `/api/health` no painel,
          e o Render espera ele responder antes de trocar o tráfego? (3) quanto o Render leva da porta aberta à
          troca — é o que dura o "reconectando". Uma premissa que caia muda o desenho antes do código.
          *(15/10/2026, com o dono logado — a linha do tempo no [H.13 do ledger](../varreduras/H-multiplayer.md#h3d0--as-premissas-no-painel-do-render-15102026).
          (1) **Sim:** a velha (`lgv8m`) registrou `server_shutdown`/`SIGTERM` às 22:34:53,5, **5 s** depois de a nova
          abrir a porta, e nenhum erro de gravação depois — não os 60 s da doc. (2) **Caiu em parte:** o campo
          *Health Check Path* está **vazio**; sem ele, o Render testa a **porta TCP**, e o servidor só abre a porta
          depois do restore — o efeito é o mesmo, e o desenho fica, sem mudar nada no painel. A regra passa a ser
          "nunca abrir a porta antes de ter o bastão". (3) **~5 s** da porta aberta (22:34:48,4) ao `SIGTERM` da velha
          e ao *live* (22:34:54); o processo novo levou 1,4 s do início à porta. O "reconectando" previsto: **~7–9 s**.)*
    - [x] **H.3d.1** **PR da migration** (decisão 5): uma tabela de uma linha — quem manda, a última marca de vida,
          quem entregou —, com RLS ligado e **sem política**: só a service role lê e escreve, como a `rooms`.
          **Backup antes** (`npm run backup:db`, decisão 8, anotado no [registro](../BACKUP.md#registro-de-backups)),
          o merge, e a conferência em produção com `npx supabase migration list --linked` antes do PR do código.
          *(15/10/2026 — a `0008_instance_lease.sql`: os privilégios de anon e authenticated **revogados** (o select
          nega, em vez de voltar vazio como na `rooms`) e o RLS ligado sem política, como segunda camada. Os testes
          de RLS foram de **56 para 63**; devolvendo os privilégios no banco local, os 5 de cliente falham. Pela API
          REST local, a chave anônima leva `401`/`42501`. Backup de 16/10 (UTC) no registro. **Mergeado no #47**
          (16/10, 01:11 UTC), sem mesa aberta; o `master` verde com o `db push`. **Em produção:** o
          `migration list --linked` mostra a `0008` no remoto, e o schema tem a tabela, a restrição `id = 1`, o RLS
          ligado e privilégio só da `service_role` — anon e authenticated sem nenhum.)*
    - [x] **H.3d.2** **O teste que reproduz, antes do código:** o ensaio `H1J_LOCAL=1 node scripts/multiplayer/h1j.mjs`
          (duas instâncias com o Supabase local, atrás de um proxy que faz o papel do Render) perde o que vai à velha
          depois de a nova subir — 5 mensagens em 14/10. E os testes do módulo, com um banco falso: com a velha viva,
          a nova espera a entrega; com a marca de vida velha, assume na hora; a velha que vê a troca entrega; um erro
          de rede na renovação **não** é troca; depois de entregar, a velha não grava mais nada.
          *(15/10/2026 — o ensaio ficou fiel ao Render da H.3d.0: o tráfego vai à nova quando a porta dela abre, com
          atraso configurável (`H1J_SWITCH_DELAY_S`), e a velha morre `H1J_OLD_DIES_S` depois. Com o código de antes,
          perdeu **1** mensagem (a `d-3`, pelo WebSocket à velha depois de a nova abrir a porta). Os testes vieram antes
          de cada parte e foram vistos falhando: `instance-lease` (18 — os cinco da caixa, mais a hibernação, o prazo, o
          banco fora do ar, o SIGTERM e a entrega sem sucessor), `room-persistence` (7), `server-handoff` (6),
          `api-restart` (3) e `room-transport` +2. Mutações no módulo e no servidor, uma por propriedade: cada uma
          derruba o seu teste.)*
    - [x] **H.3d.3** **PR do código:** o módulo da passagem (`server/instanceLease.ts`: assumir, renovar a cada 2 s,
          entregar); o boot na ordem assumir → esperar a entrega → restaurar → escutar; a velha que entrega recusa
          ações e *upgrade* com `503 server_restarting` (código novo na tabela do `server/errors.ts`), fecha os
          sockets e o SSE, grava, para o vigia de presença e o coletor, e só então marca que entregou; o cliente tenta
          de novo sozinho por alguns segundos diante do `server_restarting`. **De carona:** o H.10 (gravar pelo menos
          a cada N s mesmo em rajada — o `maxWait`) e o H.11 (o `join` grava na hora), cada um com o seu teste.
          **Portão** (adendo à H.4): a pergunta 3 pesa — uma instância manda a outra parar, e só a service role
          escreve na tabela —, e a 5 (a tabela tem uma linha). ADR 0007 (a passagem de bastão), protocolo,
          `DEPLOY.md` e o diagrama de contêineres. **Prova:** o ensaio local perde 0.
          *(15/10/2026 — feito; a seção [H.3d do ledger](../varreduras/H-multiplayer.md#h3--os-fazer-executados) tem a
          tabela. **O ensaio perde 0:** na troca instantânea (a comparação com o código de antes) e na fiel ao Render
          (a troca 5 s depois da porta aberta), em que a velha recusa o WebSocket três vezes e o chat pela tela e pela
          API leva `503 server_restarting`, tenta de novo e fica. **"Reconectando": 6,1 s.** Dois acréscimos que o
          desenho não previa: o stream SSE acaba com `retry: 1500` e o pedido de stream à velha recebe 200 — um 503
          faria o `EventSource` desistir para sempre —; e a velha que entregou e ninguém assumiu sai em 60 s, para o
          Render a religar. O banco que não responde nem ao pedido desiste em 5 s, não em 30 — o despertar não espera.
          Portão no [registro](../SEGURANCA.md#fase-h--varredura-multiplayer). O PR abriu depois do merge do #47 e
          da `0008` conferida em produção. **O deploy do merge dele ainda perde como antes** — a velha não tem o
          bastão para entregar; o teste no ar é o "Manual Deploy" seguinte.)*
    - [x] **H.3d.4** **No ar, com o dono:** o H.1j de novo — a mesa de teste, o "Manual Deploy" clicado por ele —:
          0 mensagem perdida, e quanto dura o "reconectando". A regra "nunca mergear com mesa aberta" só sai do
          `CLAUDE.md` e do `DEPLOY.md` se este passo provar a perda zero.
          *(15/10/2026, 22:20–22:41, combinado com o dono — **1 perdida, não 0.** O primeiro deploy do #48 entrou como
          previsto (a velha sem bastão; a nova `how: free`). No "Manual Deploy" seguinte, **o servidor fez tudo**: a velha
          avisou `handoff_drained` (3 conexões, gravou), marcou em 0,1 s, a nova assumiu `handed-over` e abriu a porta,
          a velha saiu no SIGTERM sem gravar. Mas os navegadores viram os sockets fecharem **13–16 s depois**, com
          `1006`, e a tela do GM mandou uma mensagem pelo socket morto. **O caminho do Render não entrega o fechamento que o
          servidor manda** — medido em seguida com `scripts/multiplayer/h3d-fechamento.mjs`: dados em ~145 ms, o `4400`
          da expulsão nunca chegou (`1006` em 1,7 s). É a H.3d.5. **A hibernação com o bastão funcionou no ar:** no
          *spin-down* (22:37) a instância entregou no SIGTERM, e o despertar (22:40) assumiu `handed-over` em 1,7 s — o
          health em 24,1 s (eram 21,6 s em 14/10). A renovação a cada 2 s não impediu a hibernação. **Refazer este passo
          depois da H.3d.5 no ar.** A regra "nunca mergear com mesa aberta" fica.)*
          *(15/10/2026, 23:51 — **refeito com a H.3d.5 no ar (#49): 0 perdida, 30 de 30.** A velha avisou os 3 sockets, os
          navegadores fecharam o próprio socket na hora (ela entregou com `connections: 0`) e mandaram as ações por REST,
          que repetiu o 503 até a nova; os três no mesmo assento, sem SSE. **"Reconectando": 12,4 s** — 2 s de carência,
          ~1 s de entrega e 9,7 s da troca do Render, a parte que varia (já foi 2,4 e 5 s). A hibernação em seguida: o
          health em 21,7 s, os três no mesmo assento. Uma rodada antes se perdeu: o
          deploy começou com a mesa ainda sendo montada — o bastão funcionou, mas a sobra `H1J-9YCMEW` ficou para o
          coletor (24 h), e dela saiu o **H.14** (quem entra na janela da troca cai no SSE — ADIAR). Detalhe no
          [ledger](../varreduras/H-multiplayer.md#h3d4-de-novo--com-o-aviso-15102026-23450012). **A regra de merge:** a
          perda zero estava provada, e ela saiu do `CLAUDE.md` e do `DEPLOY.md` — vira "pode, mas não no meio de um
          combate", pelo "reconectando" de até ~15 s.)*
    - [x] **H.3d.5** **O aviso antes do fechamento** *(acrescentado em 15/10/2026, pela H.3d.4)*: na entrega, a velha
          manda a cada socket um quadro de **dados** (`{ type: "error", code: "server_restarting" }` — o bundle de antes só
          mostra o texto) e segue aceitando ações por **2 s**, recusando só conexão nova; o cliente que recebe o aviso
          fecha o próprio socket na hora e passa ao REST, que repete o 503. O ensaio local ganha o proxy que segura o
          fechamento (`H1J_CLOSE_HOLD_S=13`). **Prova:** o ensaio com o fechamento segurado perde 1 com o código do #48 e
          0 com o aviso; testes vistos falhando antes; ADR 0007 (revisão de 15/10), protocolo, `CLAUDE.md`.
          *(15/10/2026 — feito no branch `claude/h3d-aviso`: o ensaio segurando 13 s perdeu **1** com o código do #48
          (a mesma assinatura do ar: volta em 3 s, sem `1012`) e **0** com o aviso; o "reconectando", ~6 s.
          `server-handoff` estendido (o aviso, a ação na carência pelo socket e pelo REST, o *upgrade* recusado) e
          `room-transport` +1 (o socket fechado na hora, a mensagem por REST, a volta em 1,5 s sem o `onclose`), vistos
          falhando; mutações — sem aviso, sem carência, *upgrade* aceito na carência — cada uma derruba o teste. **842**
          testes. Mergeado no **#49**; provado no ar na H.3d.4 refeita: 0 perdida.)*
- [x] **H.4** 🔒 Portão, se a H.3 mudou código — passo X.4. *(Vai mudar: a URL depois de entrar e a reconexão
      do transporte. A pergunta 3 pesa — o F5 volta ao assento com o token, e nenhum caminho novo emite sessão.)*
      *(14/10/2026 — entrada no [registro](../SEGURANCA.md#fase-h--varredura-multiplayer), sem achado: nenhuma
      rota nem sessão nova — uma emissão a menos (a chegada a `/room/CÓDIGO` não repete o `join`); o código da
      mesa na barra de endereço já estava no cabeçalho e no convite, e o `helmet` manda `no-referrer`.)*
      *A H.3d traz o seu adendo — está na caixa H.3d.3.*
- [x] **H.5** 🧠 Estado durável — passo X.5. *(Inclui rodar `scripts/multiplayer/h1a.mjs` como régua: 0 erro de
      console e os números da H.1a.)*
      *(14/10/2026 — feito antes do PR: caixas, ledger, linha de base (**805** testes, 59 arquivos), E2E 7/7, o
      smoke de WebSocket 5/5, `audit:colors` e conflitos em 0, `audit:ci` limpo, e a régua `h1a.mjs`: 0 erro de
      console, 6,7 KB por chat, 0,5 KB em 45 s parada. Documentos que a H.3 tornou falsos: o protocolo (§1, §2, a
      nota dos códigos de fechamento, §7), a seta do SSE no diagrama de contêineres, e o "≥60 s / ~1,5 min" do
      deploy no `DEPLOY.md` e no `CLAUDE.md`. **Falta:** o merge do #46 e o `master` verde depois dele; e, com a
      H.3d (15/10), o mesmo passo para os PRs dela — a linha de base volta a ser medida no fim.)*
      *(15/10/2026, 23:58 — a H.3d nos #47, #48 e #49, cada um com o `master` verde depois (o #47 com o `db push` e a
      `0008` conferida em produção). A linha de base no fim: **842** testes, 63 arquivos; E2E 7/7; smoke de WebSocket
      5/5; RLS 63/63; `audit:ci` limpo; cores e conflitos em 0. A régua `h1a.mjs` no código do `master`: 0 erro de
      console, 6,7 KB por chat, ~50 KB no combate (o ataque errou), 0,5 KB em 45 s parada — os números da H.1a.
      **Falta:** o merge do PR do registro (este), o `master` verde depois dele, e a data da fase.)*
      *(16/10/2026 — o registro no **#50**, mergeado com o dono aprovando a regra de merge nova; o `master` verde
      depois dele, os quatro jobs.)*
- [x] ✅ **Fase H concluída em:** 16/10/2026 *(código em 15/10; a H.3d provada no ar em 15/10, 23:51)*
