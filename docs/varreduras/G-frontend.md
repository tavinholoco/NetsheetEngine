# Varredura G — frontend (`src/components`, `features`, `pages`, `stores`, `hooks`, `utils`, `lib`)

**Data:** 10/10/2026
**Timebox:** 1–2 dias (usado: uma sessão para G.0 e G.1)
**Escopo:** 44 arquivos, **9.170 linhas**, lidos inteiros — os sete diretórios do plano (menos o
`src/lib/supabase.ts`, da L.4), mais o `App.tsx` e o `main.tsx`, onde moram as duas pistas da G.1a. De
fora, só o que decide um achado: o `src/api/` (a costura é da I), o `server/roomManager.ts` (quem escreve
o `token.hp`) e as fontes da conferência.
**Itens levantados:** 25 · **FAZER:** 7 · **ADIAR:** 17 · **DESCARTAR:** 1
**Proporção FAZER:** 28% — abaixo de 1/3, **depois de recalibrar** (ver [G.2](#g2--calibragem)).

**Como foi feito.** O G.0 mediu de novo cada pista contra o `master` do dia (`c3e3375`). Cada área
respondeu à pergunta dela e procurou além das pistas. O que dava para reproduzir foi reproduzido — no
navegador do app contra o `npm run dev` (porta 3000) e contra o **build de produção local** (porta 3100,
uma mesa criada por REST com sessão de GM, como na F), ou com um script **fora do repositório** contra o
código do repo. Nenhum código do repositório mudou nesta etapa. O Supabase local estava desligado (o
Docker não subiu): o que depende de login ficou **lido, não reproduzido**, e o item diz isso.

**Numeração:** por área, na ordem em que os itens foram achados. **As linhas citadas são as do `master`
em `c3e3375`**, o código varrido.

---

## G.0 — As pistas, medidas de novo em 10/10/2026

| Pista (plano, 29/09) | Medido em 10/10 |
|---|---|
| `syncSheetStore(sheetResult)` no corpo do render (`App.tsx:69`), com o aviso do React | ✅ igual, e **reproduzido**: ao digitar na ficha, o console mostra `Cannot update a component (App) while rendering a different component (App)` — nível *error* |
| Dois `useEffect` URL ↔ aba com dois refs de guarda; no dev, todo deep link volta para `/` | ✅ igual (`App.tsx:89–107`), e **reproduzido**: `localhost:3000/dice` aberto direto termina em `/` |
| A ficha local × a ficha na mesa (decisão 7a) | ✅ o caminho é `MultiplayerRoom.tsx:75–88` (o ferimento desce do servidor) e `:289–305` (a ficha sobe, sem o ferimento) |
| Estados das R: `seat_taken`, `removed_by_gm`, `room_full`, `room_exists` | ✅ os quatro têm mensagem em português (E.3c). **Reproduzido** o `removed_by_gm`: o expulso volta ao lobby com "O Mestre removeu você desta mesa." — mas ver G.07 |
| A espera de ~1 min do Render acordando | ✅ nenhum botão da mesa mostra espera — ver G.06 |
| `createBlankCharacterSheet` (`useCharacterSheet.ts:46`) gera seis IDs de armadura no mesmo tick | ✅ seis (`DEFAULT_ARMOR`), `Date.now()` + 4 símbolos — ver G.16 |
| **12** `console.*` no cliente | ✅ 12 — 10 no escopo da G, 2 no `supabase.ts` |
| **27** componentes `.tsx` e **3** testes que renderizam | ✅ 27 componentes (29 `.tsx` com `App` e `main`); os três testes: `ui-smoke` (Button e 404), `combat-ui` (`CombatPanel` e `HealthTracker`), `invite-button` (`MultiplayerRoom`) |
| `MultiplayerRoom` 1.028, `TacticalGrid` 792, `FriendsList` 723, `CyberpunkMenu` 609 | `MultiplayerRoom` **1.049** (a F acrescentou os modais do Radix); os outros três iguais |

---

## G.1a — Estado em dois lugares

*Pergunta: que estado existe em dois lugares e pode divergir?* Quatro: a ficha (hook × store), a aba
(URL × store), o ferimento (servidor × ficha local) e o jogador do modal (sala × foto tirada ao abrir) —
mais os nomes do ferimento, que são dado em duas listas.

### G.01 — A ficha é espelhada na store durante o render do `App`

**Área:** G.1a

**Sintoma observado:** reproduzido em 10/10 no `npm run dev`: digitar no apelido da ficha dispara, no
console, `Cannot update a component (App) while rendering a different component (App)`. O `App` lê
`sheet` da store (`App.tsx:64`) **antes** de espelhar nela o estado do hook (`:69`) — cada edição
renderiza o `App` duas vezes, a primeira com a ficha da edição anterior. Nada errado chega à tela: o
segundo render acontece antes da pintura.

**Onde:** `App.tsx:64` e `:69`; `stores/useSheetStore.ts:55`.

**Quem sente hoje:** quem mantém o código — uma mensagem de nível *error* em toda sessão de dev.

**Se eu não fizer:** nada na tela. O custo é ruído: a H vai ler o console de três abas.

**Versão 10× menor:** o `syncSheetStore` num `useLayoutEffect` — uma linha. A maior (o hook escrever
direto na store, sem ponte) é da L.3.

**Reversível:** sim.

**VEREDITO:** ADIAR — *recalibrado na G.2* (era FAZER na primeira passada).
- **Gatilho:** o aviso esconder um erro de verdade numa sessão de depuração da H ou da I, ou lentidão ao
  digitar na ficha (o render duplo). Quando disparar, a versão de uma linha.

### G.02 — No dev, o deep link volta para `/`

**Área:** G.1a

**Sintoma observado:** reproduzido em 10/10: `localhost:3000/dice` termina em `/`. O `StrictMode` roda o
efeito "aba → URL" duas vezes na montagem; o primeiro pula (o ref de primeiro render), e o segundo vê a
aba inicial da store (`home`, `useUiStore.ts:39`) diferente da aba que veio da URL e navega para `/`.
Produção não tem o efeito duplo — o E2E e a `scripts/visual/` rodam o build de produção e passam.

**Onde:** `App.tsx:89–107`; `stores/useUiStore.ts:39`.

**Quem sente hoje:** quem testa no dev. O contorno está documentado (o `CLAUDE.md` e a memória mandam usar
o `netsheet-prod` para deep link).

**Se eu não fizer:** dá retrabalho só no dev.

**Versão 10× menor:** a store nascer com a aba da URL (`pathToTab(location.pathname) ?? 'home'`) — os
dois efeitos passam a concordar desde o primeiro render. A maior (a URL como fonte única da aba) é da L.3.

**Reversível:** sim.

**VEREDITO:** ADIAR — *recalibrado na G.2* (era FAZER na primeira passada).
- **Gatilho:** a H precisar do dev (HMR) para depurar um cenário com refresh ou deep link — a H.1c e a
  H.1d estão planejadas no build de produção —, ou o mesmo sintoma aparecer no build de produção.

### G.03 — Trocar de ficha no meio da sessão leva o ferimento da mesa para a ficha nova

**Área:** G.1a

**Sintoma observado:** nenhum em uso. Lido: sair da aba da mesa desmonta o `MultiplayerRoom`, mas a
store continua `active`. Se o jogador carregar outra ficha e voltar à mesa, o efeito de sincronia
(`MultiplayerRoom.tsx:294–305`) sobe a ficha nova; o servidor a aceita sem o ferimento (decisão 7a); e o
efeito do ferimento (`:85–88`) escreve na ficha **nova** o ferimento da antiga — que o autosave leva à
nuvem. Não reproduzido: carregar outra ficha exige login.

**Onde:** `features/multiplayer/MultiplayerRoom.tsx:75–88` e `:294–305`.

**Quem sente hoje:** ninguém — exige trocar de ficha com a mesa aberta.

**Se eu não fizer:** perde dado no caso raro (a ficha nova herda um ferimento que não é dela).

**Versão 10× menor:** o efeito do ferimento só escrever se o `id` da ficha local for o da ficha na mesa.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** um jogador trocar de ficha durante uma sessão real, ou a H.1i (ficha editada em duas abas)
  mexer no mesmo caminho — aí os dois se resolvem juntos.

### G.04 — O modal do Bio-Monitor mostra o jogador de quando abriu

**Área:** G.1a

**Sintoma observado:** reproduzido em 10/10 no build de produção, como GM: aberto o Bio-Monitor de um
jogador, clicar **5** e depois **2** — o servidor aplicou os dois ("alterou o Bio-Monitor … para Mortal
1", depois "para Sério", no chat), e o modal continuou com **só o 0 aceso**. O estado guarda uma **cópia**
do `RoomPlayer` tirada no clique (`useState<RoomPlayer>`), e não o jogador da sala. O modal de inspecionar
ficha tem o mesmo defeito: mostra a ficha de quando abriu.

**Onde:** `features/multiplayer/MultiplayerRoom.tsx:100–101` (o estado), `:997` e `:1027–1038` (a leitura).

**Quem sente hoje:** o GM — o clique não tem efeito visível no próprio modal, e ele não sabe se pegou.

**Se eu não fizer:** fica errado na tela, e convida a clicar de novo.

**Versão 10× menor:** guardar só o `peerId` e ler o jogador de `room.players` a cada render.

**Reversível:** sim.

**VEREDITO:** FAZER — ✅ **feito** na G.3d (11/10/2026).
- Teste que reproduz: `src/__tests__/room-modals.test.tsx` — a sala muda o ferimento com o modal aberto,
  e o modal acende o nível novo.

### G.05 — O mesmo ferimento tem dois nomes, às vezes no mesmo cartão

**Área:** G.1a

**Sintoma observado:** reproduzido em 10/10 na ficha: no cartão do Bio-Monitor, o botão diz **"Ileso"** e
o estado diz **"Saudável (OK)"**; marcada a caixa 6, as caixas dizem **"Sério"** e o estado **"Ferimento
Sério (Serious)"**. Na mesa, o cartão do token diz `Ferimento Sério (Serious) (2/10)` e o painel de
combate, logo abaixo, `Sério · 8/40`. São duas listas: `WOUND_LEVEL_NAMES` (`utils/injuryRules.ts:30`) e a
trilha do livro, `WOUND_TRACK` (`rules/tables.ts:80`). "Mortal 6 (Morte Iminente)" não é nome do livro.

**Onde:** `utils/injuryRules.ts:30–42`; `HealthTracker.tsx:30` e `:109`; `TacticalGrid.tsx:694–695`.

**Quem sente hoje:** jogador e GM, com dois vocabulários para a mesma coisa.

**Se eu não fizer:** fica feio — nenhum número está errado.

**Versão 10× menor:** o `WOUND_LEVEL_NAMES` guardar só a cor e tirar o nome do `WOUND_TRACK`.

**Reversível:** sim.

**VEREDITO:** ADIAR — *recalibrado na G.2* (era FAZER na primeira passada).
- **Gatilho:** a K.3 (pós-ferimento) mexer na trilha — junta as listas de passagem —, ou alguém da mesa
  confundir os nomes numa sessão.

---

## G.1b — Rede, sessão e espera

*Pergunta: o que a tela mostra quando a rede falha, o token expira ou a resposta demora?* Os estados das
R estão certos (G.0). O que falta é a **espera**: nenhuma ação da mesa mostra que está esperando, e o
clique repetido vira ação repetida (G.06). E uma ação que o servidor sabe fazer não tem botão (G.07).

### G.06 — Clique duplo repete a ação: assento órfão, dano em dobro

**Área:** G.1b

**Sintoma observado:** reproduzido em 10/10 no build de produção:
- **Aplicar dano:** um clique duplo em "Aplicar 20 de dano" num NPC aplicou o acerto **duas vezes** — o
  chat registrou "Ileso → Sério (8/40)" e "Sério → Mortal 0 (16/40)". O botão não desliga depois do
  clique.
- **Entrar na mesa:** com a resposta do `join` atrasada em 2 s (o que o Render faz ao acordar, ~1 min no
  pior caso), um clique duplo em "Entrar na Mesa" mandou **três** `join` — os dois cliques e a nova
  tentativa do `seat_taken` com outro `peerId` (R.1) — e o GM passou a ver o visitante **duas vezes**
  ("Jogadores (4)"). O assento a mais fica, e conta no teto de 16 (R.16). E não sai — ver G.07.
- **Lido, mesmo mecanismo:** "Criar Mesa" duas vezes cria **duas salas** (cada clique sorteia um sufixo
  novo, `api/rooms.ts:183`); "Próximo Turno" duas vezes **pula a vez** de alguém; "Rolar ataque" do NPC
  ataca duas vezes.

Nada na tela diz que a ação está em andamento — com o Render acordando, a primeira ação parece travada,
que é a pista da G.1b.

**Onde:** `MultiplayerRoom.tsx:307–335` (criar, entrar), `:944` (próximo turno); `CombatPanel.tsx:141` e
`:182`; `api/rooms.ts:89–106` (`postJoin`); `pages/RoomPage.tsx:45` (a reentrada automática, que também
chama o `join`).

**Quem sente hoje:** o GM (ferimento errado no NPC ou no jogador, turno pulado) e quem entra na mesa
(assento fantasma).

**Se eu não fizer:** dano e turno errados no meio do combate; assentos e salas fantasmas.

**Versão 10× menor:** duas peças, nada de biblioteca. (1) O `joinRoom` e o `createRoom` devolvem a
chamada **que já está em voo** em vez de abrir outra — como o `reconnectInFlight` já faz (`rooms.ts:106–114`) —,
o que cobre também a reentrada do `RoomPage`; e os dois botões mostram "Entrando…"/"Criando…" desligados.
(2) Os botões de combate que mudam estado (aplicar dano, NPC ataca, próximo turno) ficam desligados
enquanto a requisição está em voo.

**Reversível:** sim.

**VEREDITO:** FAZER — ✅ **feito** na G.3b (11/10/2026).
- Teste que reproduz: `src/__tests__/double-click.test.tsx` — dois cliques com a resposta pendente fazem
  **uma** requisição (entrar, aplicar dano, próximo turno); e `joinRoom` chamado duas vezes em seguida
  devolve a mesma promessa.

### G.07 — O GM não tem botão para tirar ninguém da mesa

**Área:** G.1b

**Sintoma observado:** reproduzido em 10/10: na lista de jogadores, o GM tem "Inspecionar ficha" e
"Editar bio-monitor" — e nada para remover. A função existe de ponta a ponta: `deletePlayer` no componente
(`MultiplayerRoom.tsx:459`), na API (`api/rooms.ts`) e no servidor, que a R.3 endureceu (revoga a sessão e
fecha o socket — removido pela API em 10/10, o expulso voltou ao lobby com a mensagem certa). **Nenhum
botão a chama, desde a restauração da Fase 0** (conferido no histórico do arquivo). É o padrão do
`CLAUDE.md`: construído de ponta a ponta e nunca ligado. Três textos contam com o botão:
- a mensagem de mesa cheia manda "Remova alguém para gerar outra ficha" (`roomManager.ts:847`) e "Peça ao
  Mestre para abrir espaço" (`server.ts:548`);
- o comentário da R.1: "o GM remove o assento antigo" (`api/rooms.ts:87`), depois de um `seat_taken`;
- o assento órfão do G.06 não tem como sair.

**Onde:** `features/multiplayer/MultiplayerRoom.tsx:459` (definida) e `:783–821` (a lista, sem o botão).

**Quem sente hoje:** o GM — com um assento fantasma, com a mesa cheia, ou com um convidado que não devia
estar ali (o modelo de ameaça da decisão 3).

**Se eu não fizer:** a mesa enche de assentos que não saem; o único jeito de tirar alguém é chamar a API
à mão ou fechar a mesa.

**Versão 10× menor:** um botão "Remover" ao lado de cada jogador, só para o GM, com `confirm()` (o padrão
que o grid já usa para "limpar tokens"), chamando o `deletePlayer` que existe.

**Reversível:** sim.

**VEREDITO:** FAZER — ✅ **feito** na G.3c (11/10/2026).
- Teste que reproduz: `src/__tests__/room-modals.test.tsx` — o GM vê "Remover" ao lado dos outros
  jogadores (não ao lado de si), confirmar chama a API com o `peerId`; o jogador não vê o botão.

### G.08 — A tela diz "sincronizado" quando não está

**Área:** G.1b

**Sintoma observado:** em parte. **Reproduzido:** o rodapé diz "SUPABASE CLOUD CONECTADO" com o Supabase
desligado — é texto fixo (`App.tsx:380`). **Lido:** quando o save na nuvem falha, o aviso sai com o
cabeçalho verde **"Sincronização Concluída"** e o texto "Ficha salva localmente… Aviso da nuvem: …"
(`App.tsx:126–127` e `:228`); a ficha diz "Auto-Sincronização Ativa" e "Sincronizada com seu perfil na
nuvem" (`SheetPage.tsx:87` e `:93`) enquanto o autosave falha calado (`useCharacterSheet.ts:257`). Não
reproduzido: precisa de login.

**Onde:** `App.tsx:126`, `:143`, `:228`, `:380`; `pages/SheetPage.tsx:87`, `:93`;
`hooks/useCharacterSheet.ts:257`.

**Quem sente hoje:** ninguém — a produção tem **0** fichas na nuvem (backup de 01/10).

**Se eu não fizer:** perde dado só no caso de quem confia na nuvem, a nuvem falhou, e ele trocou de
aparelho (no mesmo aparelho, a ficha está no `localStorage`).

**Versão 10× menor:** o aviso ganhar tipo (sucesso × aviso), e o rodapé perder a frase.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** a primeira ficha de jogador na nuvem — o backup mensal mostrar `character_sheets` acima de
  0 —, ou alguém relatar ficha que não chegou ao outro aparelho.

### G.09 — Fórmula de dano inválida: o botão não faz nada

**Área:** G.1b

**Sintoma observado:** reproduzido em 10/10: na página de dados, "Rolar 1d6/2 + Local de Impacto" não
rola, não mostra banner nem histórico, e não diz por quê. O `catch` engole o erro em silêncio
(`DiceRoller.tsx:45–54`; o mesmo na ficha, `App.tsx:180–186`). **A ADR 0004 supôs o contrário** — "quem
digitar `1d6/2` recebe fórmula inválida" (`docs/adr/0004-dice-roller.md:105`): recebe nada. A frase foi
corrigida no PR deste ledger.

**Onde:** `features/sheet/DiceRoller.tsx:45–54`; `App.tsx:180–186`.

**Quem sente hoje:** quem digita uma fórmula na página de dados. Na ficha, toda arma vem do arsenal padrão
(`WeaponsArmor` não tem campo livre), e todas as fórmulas dele passam.

**Se eu não fizer:** confunde — um clique sem efeito.

**Versão 10× menor:** uma linha de aviso ao lado do botão.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** o da própria ADR 0004 — uma arma do livro com divisão entrar numa ficha de verdade; aí o
  parser cresce e o aviso vem junto —, ou alguém relatar o botão mudo.

### G.10 — A rede de amigos não mostra erro, e o chat trava

**Área:** G.1b

**Sintoma observado:** nenhum em uso. Lido: no chat de amigo, se a nuvem recusa a mensagem, o `await`
lança antes do `setSending(false)` — **o botão de enviar fica desligado** até fechar o chat, e o texto já
foi apagado (`FriendsList.tsx:75–86`). Aceitar e recusar pedido não têm `catch` (`:308–326`); desfazer
amizade some da lista antes da nuvem responder e não volta se ela falhar (`:329–345`). Não reproduzido:
precisa de login.

**Onde:** `features/social/FriendsList.tsx:75–86`, `:308–326`, `:329–345`.

**Quem sente hoje:** ninguém — a rede de amigos não é o caminho da mesa dos convidados.

**Se eu não fizer:** uma mensagem perdida e um botão travado, quando a nuvem falhar.

**Versão 10× menor:** `try/finally` no envio.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** alguém da mesa usar a rede de amigos e relatar, ou a I.1b (erros) olhar os caminhos do
  Supabase no cliente.

### G.11 — O menu busca o perfil de novo a cada troca de aba

**Área:** G.1b

**Sintoma observado:** nenhum. Lido: o efeito do avatar e do ID depende de `[user, activeTab]`
(`CyberpunkMenu.tsx:130–162`) — cada clique no menu é uma consulta ao `profiles`, sem `catch` (uma falha
vira rejeição sem tratamento no console).

**Onde:** `components/CyberpunkMenu.tsx:130–162`.

**Quem sente hoje:** ninguém. O Supabase gratuito não cobra por consulta.

**Se eu não fizer:** nada.

**Versão 10× menor:** tirar o `activeTab` da dependência (o evento `cyberpunk:avatar-updated` já cobre a
troca de avatar).

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** o egress do Supabase aparecer no painel perto da cota do plano gratuito, ou a rejeição sem
  tratamento aparecer no console numa sessão da H.

---

## G.1c — Teclado e foco

*Pergunta: dá para operar a ficha só com teclado?* **Quase.** Todo controle da ficha é nativo (`button`,
`input`, `select`, `range`) e o foco é visível — conferido em 10/10: botões com o contorno do navegador
(`auto 3px`), campos com a borda trocando de cor. Um campo não aceita o que se digita (G.12). Fora da ficha,
o perfil e o grid são só de mouse (G.13, G.15).

### G.12 — Digitar 12 num atributo grava 15

**Área:** G.1c

**Sintoma observado:** reproduzido em 10/10: selecionar o INT e digitar **12** deixa o campo em **15**. O
grampo (2 a 15) roda **a cada tecla** (`StatBlock.tsx:32–35`): o "1" vira 2, e o "2" seguinte faz "22", que
vira 15. Nenhum valor de 10 a 14 entra pelo teclado (o 15 entra por acaso); apagar o campo vira 2. As setas
e os botões −/+ funcionam.

**Onde:** `features/sheet/CharacterSheet/StatBlock.tsx:32–35` e `:92`.

**Quem sente hoje:** o jogador montando a ficha — grava um atributo errado sem perceber, e ele entra nas
rolagens.

**Se eu não fizer:** número errado na ficha.

**Versão 10× menor:** deixar o texto livre enquanto digita e grampear no `blur` (ou só quando o número
estiver completo).

**Reversível:** sim.

**VEREDITO:** FAZER — ✅ **feito** na G.3f (11/10/2026).
- Teste que reproduz: `src/__tests__/stat-input.test.tsx` — digitar "12" grava 12; "1" sozinho não vira 2
  antes de sair do campo; sair com 40 grava 15.

### G.13 — O perfil só abre com o mouse

**Área:** G.1c

**Sintoma observado:** nenhum em uso. Lido: o cartão do usuário no menu é um `div` com `onClick`, sem
`tabIndex` nem papel (`CyberpunkMenu.tsx:282` no celular, `:528` no computador), e o perfil não está na
lista de módulos. Pelo teclado, a página do perfil (avatar, "Minhas Fichas") não é alcançável — a lista de
fichas também está em LENDAS, que é botão. Não reproduzido: precisa de login.

**Onde:** `components/CyberpunkMenu.tsx:282`, `:528`.

**Quem sente hoje:** ninguém da mesa usa só teclado, até onde se sabe.

**Se eu não fizer:** o perfil fica fora do teclado.

**Versão 10× menor:** o `div` vira `button`.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** alguém da mesa operar o app só pelo teclado.

### G.14 — Botões e campos sem nome para o leitor de tela

**Área:** G.1c

**Sintoma observado:** nenhum em uso. Contado em 10/10 na ficha em branco: **18 botões** só com "−" ou "+"
e **21 campos** sem rótulo ligado — **23 dos 28 `<label>`** do escopo não têm `htmlFor` nem envolvem o
campo. Na mesa e na ficha cheia, lixeiras e "enviar" só com ícone. O teclado opera tudo (G.1c); quem perde
é o leitor de tela, que anuncia "botão" e "campo" sem dizer qual. A F.4 cobriu contraste, movimento, alvo e
foco em modal — não nome acessível (WCAG 4.1.2).

**Onde:** `StatBlock.tsx`, `SkillsSection.tsx`, `WeaponsArmor.tsx`, `CyberwareManager.tsx`,
`LifepathGenerator.tsx`, `CharacterHeader.tsx`, `MultiplayerRoom.tsx`.

**Quem sente hoje:** ninguém da mesa usa leitor de tela, até onde se sabe.

**Se eu não fizer:** o app fica opaco para leitor de tela.

**Versão 10× menor:** `aria-label` nos botões de glifo e `htmlFor` nos rótulos da ficha.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** alguém da mesa usar leitor de tela.

### G.15 — No grid, o token só anda com o mouse

**Área:** G.1c

**Sintoma observado:** nenhum em uso. Lido: mover token é arrastar ou clicar numa célula vazia — as duas
por `div` com `onClick`/`onDrop` (`TacticalGrid.tsx:445`, `:508`). O "?" de cada token é botão, então
selecionar e abrir o cartão funcionam pelo teclado; mover, não.

**Onde:** `features/multiplayer/TacticalGrid.tsx:440–520`.

**Quem sente hoje:** ninguém.

**Se eu não fizer:** quem joga só de teclado não move o próprio token.

**Versão 10× menor:** setas movendo o token selecionado.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** o mesmo do G.13.

---

## G.1d — Efeitos, IDs e console

### G.16 — Seis IDs de armadura no mesmo tick

**Área:** G.1d

**Sintoma observado:** nenhum. Medido: o sufixo é `Math.random` em 4 símbolos de base 36 (~1,7 milhão);
seis peças dão **~9 × 10⁻⁶** de colisão por ficha criada. E **nenhum código lê o id da armadura**: a peça é
achada pelo `location` (`armorSpAt`, `rules/damage.ts:41`; `WeaponsArmor.tsx:58`). Uma colisão não muda
nada.

**Onde:** `hooks/useCharacterSheet.ts:65–68`.

**VEREDITO:** DESCARTAR
- **Razão:** o id da armadura não tem leitor; colisão não tem efeito.

### G.17 — Doze `console.*` no cliente

**Área:** G.1d

**Sintoma observado:** nenhum. Contado: 12 — `App.tsx` (3), `ErrorBoundary` (1), `TacticalGrid` (1),
`AuthModal` (3), `FriendsList` (1), `useCharacterSheet` (1), e 2 no `supabase.ts`.

**VEREDITO:** ADIAR — a dona é a **L.5** (ESLint, zerar `any` e `console.*`), como o E.16. **Gatilho:** a
L.5 abrir.

### G.18 — O "broadcast" das rolagens da ficha não tem ouvinte

**Área:** G.1d

**Sintoma observado:** nenhum. Lido: toda rolagem dispara `cyberpunk_broadcast_roll`
(`useRollStore.ts:30`), e o comentário diz que é o "broadcast multiplayer" — **ninguém escuta o evento**
desde a T5.4 (a mesa só aceita rolagem do servidor). Código morto com comentário falso.

**VEREDITO:** ADIAR — a dona é a **L.5**, com o G.17. **Gatilho:** a L.5 abrir.

### G.19 — Cada arrasto no grid regrava todos os tokens no Yjs

**Área:** G.1d

**Sintoma observado:** nenhum. Medido em 10/10 com um script fora do repo: o `writeGridToDoc` faz `set` em
todos os campos de todos os tokens (`gridDoc.ts:207–224`), e cada `set` gera update mesmo com valor igual.
Um token arrastado num grid de 8 tokens manda **1.249 B**; só o campo que mudou seriam **27 B** (46×). Mas
o mesmo arrasto, no servidor, **reenvia a sala inteira** a cada conexão (`server.ts:1111` — o ARQ-01, ~48
KB): o Yjs é menos de 3% do custo do arrasto.

**Onde:** `lib/gridDoc.ts:207–224`.

**Quem sente hoje:** ninguém; a banda do arrasto é a do reenvio da sala.

**Se eu não fizer:** nada até a L.1.

**Versão 10× menor:** o mesmo "só grava quando muda" que a `meta` já tem (`gridDoc.ts:193–197`).

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** a L.1 tirar o reenvio da sala do caminho do grid — aí o update do Yjs passa a ser o custo do
  arrasto.

---

## G.1e — Testes de componente *(ARQ-08)*

### G.20 — Quais telas quebram sem ninguém ver

**Área:** G.1e

**Sintoma observado:** a própria varredura: **seis dos sete FAZER** (G.04, G.06, G.07, G.12, G.23 e G.24)
são defeitos de componente que nenhum teste pegaria — dos 27 componentes, três têm teste que renderiza (G.0).

**Quem sente hoje:** quem mantém o código.

**Versão 10× menor:** a regra do filtro — teste novo **só onde houve sintoma**. Os FAZER desta varredura
trazem o teste deles (`room-modals`, `double-click`, `stat-input`, `room-chat`, `cyberware-humanity`,
`npc-armor`); as telas sem sintoma não ganham teste agora.

**VEREDITO:** ADIAR — fora dos testes que os FAZER já trazem.
- **Gatilho:** um defeito de tela chegar ao jogador numa sessão real sem teste que o pegasse.

---

## G.1f — Mapa de cortes *(ARQ-05, insumo da L.3)*

### G.21 — Os cortes

**Área:** G.1f

Nenhum corte tem sintoma hoje: os quatro arquivos se leem, e os FAZER desta varredura cabem neles sem
cortar. **Todos ADIAR, com a L.3 de dona.** O que mais barateia teste é o primeiro do `MultiplayerRoom`:
sem os sockets dentro do componente, a tela da mesa se testa sem servidor.

| Arquivo | Linhas | Corte proposto | Veredito |
|---|---|---|---|
| `MultiplayerRoom.tsx` | 1.049 | **`useRoomTransport`** — os efeitos de WebSocket, SSE, Yjs, heartbeat e sincronia da ficha (`:144–305`, ~160 linhas) num hook | ADIAR (L.3) |
| | | **`RoomLobby`** — criar e entrar (`:506–595`) | ADIAR (L.3) |
| | | **`RoomChat`** e **`RoomSidebar`** — o chat com os botões de rolagem (`:680–775`); jogadores e poderes do GM (`:776–872`) | ADIAR (L.3) |
| | | **`InitiativePanel`** (`:898–977`) e os dois modais (`:979–1046`) | ADIAR (L.3) |
| `TacticalGrid.tsx` | 792 | **`TokenPopover`** — o cartão do token (`:614–759`) | ADIAR (L.3) |
| | | **`gridDrop.ts`** — `getSectorFromEvent` e o tratamento do *drop*, puros e testáveis (`:150–264`) | ADIAR (L.3) |
| | | **`AddTokenForm`** (`:355–430`) e o `THEME_STYLES` como dado | ADIAR (L.3) |
| `FriendsList.tsx` | 723 | **`FriendChatBox`** para arquivo próprio (já é componente, `:56–177`); o perfil do usuário montado duas vezes (`:275` e `:310`) num helper | ADIAR (L.3) |
| | | O modal de busca e a lista de pedidos pendentes | ADIAR (L.3) |
| `CyberpunkMenu.tsx` | 609 | **`ProfileCard`** — o cartão do usuário existe em **duas cópias** (`:282` no celular, `:528` no computador); e o efeito do avatar num hook | ADIAR (L.3) |
| `App.tsx` | 390 | **`PageHeader`** (o `pageInfoMap`, `:245–282`) e as rolagens da ficha num hook | ADIAR (L.3) |

---

## G.1g — Regra de jogo e mesa *(achados fora das seis áreas)*

*Acrescentada nesta varredura:* a leitura inteira achou quatro defeitos que não cabem em nenhuma pergunta
das áreas — dois de regra (o `src/utils/` e um componente da ficha calculam regra fora do `src/rules/`) e
dois da tela da mesa. O plano ganhou a caixa G.1g.

### G.22 — O NPC gerado não tem armadura no braço nem na perna esquerdos

**Área:** G.1g

**Sintoma observado:** reproduzido em 10/10 com um script fora do repo, nos **sete** arquétipos: Cabeça,
Tronco, Braço Direito e Perna Direita com SP (10 a 18); **Braço Esquerdo = 0 e Perna Esquerda = 0**. O
gerador lista "Proteção de Braços" e "Calças Balísticas" — no plural — com um local só cada
(`npcGenerator.ts:245–248`). O servidor usa este gerador para todo NPC da mesa (`roomManager.ts:4`). Nas
faces do d10 (`HIT_LOCATIONS`), o braço esquerdo é o 6 e a perna esquerda o 9 e o 0: **3 em cada 10
acertos num NPC ignoram a armadura**.

**Onde:** `utils/npcGenerator.ts:245–248`.

**Quem sente hoje:** a mesa inteira, em todo combate contra NPC gerado — o dano passa da armadura onde não
devia.

**Se eu não fizer:** dano errado (regra).

**Versão 10× menor:** as duas peças que faltam (Braço Esquerdo e Perna Esquerda, com o mesmo SP das
direitas).

**Reversível:** sim — NPC já gerado numa mesa aberta segue como está; o próximo vem certo.

**VEREDITO:** FAZER — ✅ **feito** na G.3a (11/10/2026).
- Teste que reproduz: `src/__tests__/npc-armor.test.ts` — para cada arquétipo, os dois braços têm o mesmo
  SP, e as duas pernas também; nenhum local de impacto fica com 0 onde o arquétipo tem armadura.

### G.23 — A perda de Humanidade do cromo ignora a fórmula do implante

**Área:** G.1g

**Sintoma observado:** lido e calculado em 10/10. Ao instalar, a perda real é
`Math.round(Math.random() * 6) + 2` (`CyberwareManager.tsx:34`) — **de 2 a 8, qualquer que seja a fórmula
digitada** no campo "Perda HL" (o padrão é `1d6`). Com `1d6`, sai 7 ou 8 em ~1 de cada 4 instalações —
impossível no dado do próprio item —; com `3d6`, nunca passa de 8; com `0`, perde 2. A perda entra no EMP
corrente (C.6) e, por ele, nas rolagens.

**Fontes (decisão 11 — duas, independentes):** **S8**, o sistema do 2020 no Foundry: o implante tem
`humanityCost` como número ou fórmula (`2d6`, `1d6/2`, `0.5`, `3d6`…, contados no pacote de cyberware), e
um botão **rola essa fórmula uma vez** e guarda o resultado em `humanityLoss`, somado no EMP
(`module/item/item-sheet.js`, `module/actor/actor.js`). **S1**, a ficha do Roll20: a perda é um número **por
implante** (coluna HL), somado em `Humanity_loss`, que tira 1 de EMP a cada 10. As duas concordam: a perda
é a do item, rolada uma vez — nenhuma sorteia um valor que ignore o item. *Cuidado registrado:* a busca
aberta devolve regra do RED (custo fixo de 7, teto de humanidade); nada daqui vem dela. A linha entra na
conferência **antes** do código.

**Onde:** `features/sheet/CharacterSheet/CyberwareManager.tsx:34`.

**Quem sente hoje:** quem instala cromo na ficha.

**Se eu não fizer:** número errado na tela, e no EMP das rolagens.

**Versão 10× menor:** rolar a fórmula digitada com o parser que já existe (`NdM±X`, o mesmo do dano) ou
usar o número, se for número; o que o parser não lê (`1d6/2`, `0.5`) o jogador digita — é o que a ficha do
Roll20 faz (S1). A divisão no parser segue o gatilho da ADR 0004.

**Reversível:** sim — implante já instalado mantém a perda que tem.

**VEREDITO:** FAZER — ✅ **feito** na G.3g (11/10/2026).
- Teste que reproduz: `src/__tests__/cyberware-humanity.test.tsx` — com RNG injetado, `2d6` dá a soma dos
  dois dados; `3` dá 3; `1d6/2` pede o número ao jogador; nunca um valor fora do que a fórmula permite.

### G.24 — O chat da mesa não acompanha a mensagem nova

**Área:** G.1g

**Sintoma observado:** reproduzido em 10/10 no build de produção: com 25 mensagens, a caixa do chat
continua no topo (`scrollTop` 0, `scrollHeight` 2.703 para 392 visíveis) e a última mensagem **não aparece**.
A partir de ~10 mensagens, toda rolagem nova — que na mesa só existe no chat (T5.4) — cai abaixo da dobra, e
o jogador rola a caixa à mão a cada uma. O assistente de IA e o chat de amigos já acompanham
(`scrollIntoView`, `AiAssistant.tsx:37` e `FriendsList.tsx:72`); a mesa, não.

**Onde:** `features/multiplayer/MultiplayerRoom.tsx:690–728`.

**Quem sente hoje:** todos na mesa, a sessão inteira.

**Se eu não fizer:** incômodo em toda sessão — o resultado da rolagem fica escondido.

**Versão 10× menor:** o mesmo `scrollIntoView` dos outros dois chats — só quando quem lê já está no fim,
para não arrancar a leitura de quem rolou para cima.

**Reversível:** sim.

**VEREDITO:** FAZER — ✅ **feito** na G.3e (11/10/2026).
- Teste que reproduz: `src/__tests__/room-chat.test.tsx` — chega mensagem nova com a caixa no fim: a caixa
  vai para o fim; com a caixa lá em cima, fica onde está.

### G.25 — As notas de versão dizem que a atual é a v0.4.0, do "Cyberpunk 2077"

**Área:** G.1g

**Sintoma observado:** reproduzido na tela: o menu abre, para todo visitante, as notas de versão com a
**v0.4.0** marcada "FASE 7 // ATUAL" — e o rodapé mostra **v0.4.4**. As entradas falam de "Firestore" e de
"REDESIGN HUD CYBERPUNK 2077 … Phantom Liberty" — a identidade decidida é o 2020 (ADR 0006). A R.9 tirou a
versão escrita à mão da interface; o histórico das notas ficou (`PatchNotesFeed.tsx:16–18`, `:48–51`).

**Onde:** `components/PatchNotesFeed.tsx`.

**Quem sente hoje:** todo visitante, com informação velha na primeira tela.

**Se eu não fizer:** fica errado na tela — nenhum dado do jogo.

**Versão 10× menor:** tirar o "ATUAL" e as notas que contradizem a identidade; o que o feed deve mostrar é
decisão do dono.

**Reversível:** sim.

**VEREDITO:** ADIAR
- **Gatilho:** a **M.4** (arquivar o roadmap concluído), que é dona do mesmo tipo de conteúdo — ou o dono
  decidir antes o que o feed mostra.

---

## G.2 — Calibragem

A primeira passada deu **10 FAZER em 25 (40%)** — acima de 1/3. A régua estava frouxa num ponto: aceitava
como FAZER sintoma que **só quem mantém o código sente** (G.01, G.02) e defeito que **só fica feio** (G.05),
quando o resto da lista tem dano errado, ação repetida e número errado gravado. Passada de novo com a
pergunta 2 levada a sério ("quem sente isso hoje?"), os três viraram ADIAR, cada um com gatilho e a versão
de uma linha pronta. **Ficaram 7 FAZER em 25 (28%)** — todos sentidos por jogador ou GM, seis reproduzidos
(o G.06 em parte) e um lido com conta (G.23):

| FAZER | O que quebra |
|---|---|
| G.04 — modal do Bio-Monitor congelado | o GM não vê o próprio clique |
| G.06 — clique duplo repete a ação | dano em dobro, turno pulado, assento e sala fantasmas |
| G.07 — remover jogador nunca ligado | a mesa enche de assentos que não saem |
| G.12 — atributo digitado errado | a ficha grava 15 no lugar de 12 |
| G.22 — NPC sem armadura do lado esquerdo | 3 em 10 acertos ignoram a armadura |
| G.23 — perda de Humanidade sorteada | o EMP cai pelo número errado |
| G.24 — chat da mesa não acompanha | a rolagem nova fica escondida |

**Nenhum achado de segurança aberto.** O G.07 é um controle de moderação que falta na tela, não uma porta:
o servidor já faz a remoção certa (R.3), e saber que o botão falta não dá a ninguém poder que não tinha.

**Documento corrigido neste PR:** a ADR 0004 dizia que quem digita `1d6/2` "recebe fórmula inválida" — a
página não mostra nada (G.09).

---

## Pesquisa usada nesta varredura

- **S8 — sistema do Cyberpunk 2020 no Foundry** ([`2020-Fission/cyberpunk2020`](https://github.com/2020-Fission/cyberpunk2020)),
  lido em 10/10: `template.json` (`humanityCost: "1d6"`, `humanityLoss: 0`), `module/item/item-sheet.js`
  (o botão que rola o custo), `module/actor/actor.js` (EMP − perda ÷ 10) e `packs/cyberware.db` (os custos
  do pacote: `2`, `2d6`, `1`, `0`, `1d6/2`, `1d6`, `0.5`, `3d6`…). Já é fonte da conferência.
- **S1 — ficha do Roll20 para o CP2020**
  ([`Cyberpunk2020.html`](https://github.com/Roll20/roll20-character-sheets/blob/master/Cyberpunk%202020/Cyberpunk2020.html)),
  lida em 10/10: coluna HL por implante, somada em `Humanity_loss`; EMP − perda ÷ 10. Já é fonte da
  conferência.
- [React — *Cannot update a component while rendering a different component*](https://react.dev/link/setstate-in-render)
  — o aviso do G.01.
- [WCAG 2.2 — 4.1.2 Name, Role, Value](https://www.w3.org/TR/WCAG22/#name-role-value) — o critério do G.14,
  que a F.4 não cobriu.
