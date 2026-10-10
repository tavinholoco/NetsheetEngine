# Histórico — Fase F: identidade Cyberpunk 2020

> Movido do [`PLANO_MESTRE.md`](../PLANO_MESTRE.md) no **segundo corte da R.13 (10/10/2026)**, junto
> com o bloco R, sem mudar o texto: só os caminhos de 10 links. A fase fechou em
> 05/10/2026 (`v0.4.4`). **Está fechada** — nada aqui é marcado de novo. O estado vivo é o do plano.

---

### FASE F — REESTRUTURAÇÃO VISUAL: IDENTIDADE CYBERPUNK 2020 🔨 *(4,5–5 dias — era 4; refeita no F.0a, 30/09/2026)*

> **Por que é fase própria e vem antes da varredura.** Redesign e caça a bug têm posturas opostas:
> a varredura pergunta "isto é necessário?" e tem ADIAR como padrão — se as duas coisas
> compartilhassem uma fase, ou o filtro mataria o redesign (que é discricionário por natureza), ou o
> redesign corromperia o filtro. E varrer código que você está prestes a reestilizar repete
> exatamente o erro que o plano já evita ao pôr as varreduras depois de B, C e D.

#### 🎯 O alvo: o Cyberpunk de 1988, não o de 2020 (o jogo)

O produto é **Cyberpunk 2020**, RPG de mesa da R. Talsorian publicado em 1990 (sucessor do
*Cyberpunk* de 1988). Sua estética é a do cyberpunk **oitentista**: impressão de alto contraste,
neon sobre preto, terminal CRT, faixas de perigo, ruído analógico, colagem de fanzine.

Isso é **outra coisa** do Cyberpunk 2077 (jogo, 2020) e do Cyberpunk RED (sistema de mesa atual), que
compartilham uma linguagem moderna: limpa, sistemática, militar, vermelho primário, fios finos, HUD
curvo. A migração para o 2077 foi **descartada** — ver ADR 0006.

**O interior do livro de 1990 é preto e branco**, pelas resenhas (duas colunas justificadas, arte a
traço, *sidebars*, tabelas agrupadas, *screamsheets*). Ele é a referência de **diagramação e
tipografia**; a **cor** vem da linguagem da época — capa, neon, CRT —, como a ADR 0006 já dizia
(decisão 10d). *(30/09/2026 — corrigido no mesmo dia: o dono **não tem o livro** (decisão 11). A
diagramação vem do que as fontes públicas mostram do interior, e é a F.3.0 que as procura.)*

#### ⚠️ Honestidade sobre as fontes originais

**Não há documentação pública das fontes exatas que a R. Talsorian usou nos livros.** As buscas
devolvem história editorial e listas de suplementos, não créditos tipográficos, e a identificação por
comunidade nesse nicho é especulativa. Não vou fingir precisão que não tenho.

O que **é** documentado é o vocabulário tipográfico da era que o livro estava usando:

| Face | Papel histórico | Situação |
|---|---|---|
| **Eurostile** (Novarese, 1962; de Microgramma, 1952) | *A* face de ficção científica e técnica dos anos 60–80 — quadrada, cantos arredondados, extendida. Em *2001*, *De Volta para o Futuro*, *Starship Troopers* | **Comercial** |
| **Bank Gothic** | A referência de sci-fi dos anos 90 | **Comercial** |
| **OCR-A / Data 70 / Compacta** | Vozes de "computador" e de ação dos anos 70–80 | Comerciais ou de origem incerta |

Nenhuma pode ser embarcada sem licença de webfont — o que colide com o contrato de custo zero. A
estratégia, portanto, é **reconstruir a linguagem com faces livres**, não copiar arquivos.

#### 📏 O que o F.0a mediu (30/09/2026)

Medido no `master` em `437ed24`, com o build de produção local (helmet ativo) e o modo dev lado a lado.
**Só o bug das fontes se confirmou como estava escrito; o resto mudou de tamanho ou de forma** — a
mesma classe de sempre: afirmação escrita a partir de leitura, não de medição.

| Onde | O plano dizia | Medido |
|---|---|---|
| F.0 | As fontes não carregam no ar | **Confirmado:** o CSP recusa a folha do Google Fonts e o `document.fonts` fica com **0** faces. Como quase tudo é `font-mono`, a produção cai em Cascadia/Consolas |
| F.1.1 | Rajdhani é o corpo ("já em uso") | **Falso na prática:** na ficha, **96%** do texto é Share Tech Mono (240 elementos × 2 em Rajdhani); na página inicial, 85 de 92 nós de texto. **206** `font-mono` no código |
| F.1.2 | Share Tech Mono nos dados | A face **só tem o peso 400**: 99 elementos da ficha pedem 700/900 e ganham **negrito sintético** |
| F.2 | 1.722 / 1.731 / 1.846 cores literais | **1.738** utilitários da paleta em `.tsx` + **11** no `injuryRules.ts` (`.ts`) + **110** `rgba()` dentro de `shadow-[…]` + **5** hex no `.tsx` + **17** hex e 4 `rgba` no `index.css` fora do `@theme`; `black`/`white`: **108**. O grep do plano não via os `rgba`, o `.ts` nem o CSS |
| F.2.1 | 7 tokens com nome de papel; "renomeação mecânica" | **129** combinações prefixo × cor × tom (33 cobrem 80%); o `slate` sozinho tem **727** usos em ~10 tons, e roxo/rosa (**113**) não têm papel. Com 7 nomes planos a troca **não** é mecânica |
| F.2.2 | Vermelho só dano | **244** usos de `red`/`rose`, a maioria **não** é dano: faixa da marca, menu ativo, PRD, página inicial, mensagens do GM, "Poderes do GM", rótulo BODY, erros, botões de apagar, *fumble*, NPC |
| Cor do NPC | `#ef4444` persistido com o grid | O campo `color` do token **não tem leitor**: o grid pinta por `type`, com classes (`TacticalGrid.tsx:534`, `:575`, `:655`). *Quarto caso de "construído e nunca lido"* |
| F.4.2 | 10× menor: `prefers-reduced-motion` | **Não basta para o 2.2.2 (nível A):** a W3C não o lista como técnica suficiente — suficiente é parar em ≤ 5 s ou ter controle ([Understanding 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)). Hoje: 18 `pulse`, 2 `ping`, 2 `spin`, 1 `bounce`, 1 `pulse-glow` e 25 `fadeIn`; **0** `prefers-reduced-motion` |
| F.4.2 | Contraste "conferir" | `text-slate-500` (56 usos) **3,7–4,2:1**; `text-slate-600` (17) **2,4–2,7:1**; a trilha de ferimento de **Mortal 2 a 6** (`red-600`, `rose-600`, `rose-700`) **3,0–4,5:1** — quanto mais perto da morte, menos legível |
| F.4.2 | Ordem de tabulação nos modais | Os 2 modais da mesa (`MultiplayerRoom.tsx:965` e `:997`) são feitos à mão: sem `role="dialog"`, sem prender foco, sem Esc. O `AuthModal` usa o Radix e está certo. As classes `animate-in/out` do `dialog.tsx` **não geram CSS** (falta o plugin) |
| F.4.4 | Verificar com helmet ativo | `document.fonts.check()` devolve `true` **até para fonte inexistente** ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/check)) — não prova nada. A prova é `status === "loaded"`, e o E2E já roda com o helmet |
| F.1.3/F.1.5 | Orbitron; VT323 "~30 KB" | Orbitron variável (400–900) = **11,5 KB**, com todos os acentos do português e o `€` (faltam `º`/`ª` — um uso, na mono). VT323 = **17,5 KB**. Todas as faces candidatas: OFL-1.1, `@fontsource` 5.3.0 |
| F.3.2–F.3.4 | Barra preta com caixa alta invertida, faixas e `FICHA_01` são "o traço da Talsorian" | **Sem fonte pública.** O `FICHA_01` com underscore cheira a interface digital (2077). Vai ao livro: F.3.0 |
| Tamanhos | Escala explícita | 61 textos em **9 px**, 9 em 8 px, 1 em 7 px (e 137 em 10 px) |
| Extras | — | 12 marcas d'água decorativas (`opacity-10`) lidas pelo leitor de tela; 1 teste de unidade fixa `bg-yellow-400` (`ui-smoke`); o E2E acha elementos por **texto visível** ("Mesa Multiplayer", "Autenticação Net-Access") |

**O que o Tailwind 4.3.3 instalado faz** (conferido compilando): `--color-*: initial` apaga a paleta
padrão (`text-red-500` deixa de gerar CSS); token aceita opacidade (`border-danger/60`); um
`--shadow-glow` no `@theme` com `shadow-accent/50` troca os `rgba()` do brilho (a cor entra por
`--tw-shadow-color`); `text-shadow-*` e `motion-reduce:` existem.

#### Ordem de execução e PRs

A ordem do documento **é** a de execução: o protocolo retoma pelo primeiro `[ ]`. Por isso a parte
mecânica da F.2 vem **antes** da F.1 — os IDs ficaram os de 02/09, que o resto do repositório cita.

| PR | Itens | Por quê |
|---|---|---|
| **1** | F.0 | O único **bug** que o jogador vê vai ao ar sozinho, com as guardas — ✅ **#27**, mergeado em 30/09 |
| **2** | F.2, parte mecânica (F.2.1, F.2.4–F.2.6) | Encanamento sem mudança visual, provado por captura: a revisão do dono é "nada mudou" — ✅ **#28**, 30/09 |
| **3a** | F.1 | A tipografia: as três vozes, mono sem negrito, piso de 10 px — ✅ **#29**, 30/09 |
| **3b** | F.2b, F.3, F.4 | A cor com significado, o vocabulário visual e a acessibilidade; fecha a fase com a tag — **#32**, aberto em 30/09; capturas **aprovadas pelo dono em 01/10**. O #31 (decisão 11), em que ele estava empilhado, entrou em 01/10 |

*(30/09/2026 — o PR 3 virou dois. A ideia era a identidade chegar "de uma vez", mas a F.1 sozinha
toca as 29 telas e componentes, e a produção ainda não tem jogador: duas ondas não custam nada a
ninguém, e cada PR fica revisável.)*

**Mergear fora de sessão de jogo** (`DEPLOY.md`, E.06): cada PR publica sozinho. E desde 01/10 o
site está no ar.

#### F.0 — 🐛 O bug que precede tudo, e as guardas *(meio dia — PR 1)*

- [x] **F.0a** 🔍 **Premissas** — a tabela acima. *(30/09/2026.)* **Se a execução abrir noutro dia,**
      rodar o `npm run audit:colors` da F.0e logo que ele existir e conferir as contagens por arquivo
      antes do primeiro commit da F.2 — o código anda.
- [x] **F.0b** 🧑‍⚖️ **Decisão do dono** — as quatro perguntas que a medição abriu viraram a
      [decisão 10](../PLANO_MESTRE.md#-decisões-tomadas-02092026) *(30/09/2026)*: **(a)** Rajdhani nos rótulos, na
      navegação e no texto corrido; mono só em número, dado e momento de terminal, e **sem negrito**;
      piso de 10 px. **(b)** Vermelho só para dano; o resto vai para amarelo, ciano ou o papel novo
      **`fault`** (magenta). **(c)** A cor por seção fica. **(d)** O livro, em P&B, é a referência de
      diagramação; a cor vem da época.
- [x] **F.0c** **Fontes auto-hospedadas** *(ARQ-09)*. `@fontsource/rajdhani` (pesos 400, 500, 600 e
      700 — os que o `@import` pede hoje) e `@fontsource/share-tech-mono` (400), importadas por peso
      no `main.tsx`; sai o `@import` do Google da linha 1 do `index.css`. O arquivo por peso traz todos
      os subconjuntos, e o `unicode-range` faz o navegador baixar só o `latin`. O CSP **não muda**
      (`font-src 'self'`), e o `font-display: swap` já é o padrão do `@fontsource`. O Orbitron entra
      na F.1.3. *De carona, privacidade:* o navegador do jogador deixa de pedir fonte ao Google.
      *(30/09/2026 — os dois pacotes em `dependencies`, porque o Render builda com
      `NODE_ENV=production`, como o Vite e o Tailwind. O build emite 13 `woff2` (e 13 `woff`); na ficha,
      com o helmet, o navegador baixou **três**, só do `latin` — Rajdhani 400 e 700 e Share Tech Mono,
      ~15 KB cada. `npm audit`: 0. Nenhuma referência ao Google no `dist/`.)*
- [x] **F.0d** **Guarda no E2E** — o Playwright já sobe o build de produção, com o helmet. Um teste
      novo, em três telas (início, ficha, entrada da mesa): **(1)** nenhuma violação de CSP no console;
      **(2)** as faces carregadas — `[...document.fonts]` com `status === "loaded"`, **nunca**
      `document.fonts.check()`. **Provado revertendo:** com o `@import` de volta, os dois falham. É o
      critério de pronto (2) da fase virando teste, e pega qualquer recurso externo futuro.
      *(30/09/2026 — `e2e/fonts-csp.spec.ts`, escrito **antes** do conserto. A violação vem do evento
      `securitypolicyviolation` e do console. **Provado dos dois lados:** com o código de antes, falha
      por `style-src-elem https://fonts.googleapis.com/…`; sem os imports do `@fontsource` (e sem o
      Google), falha por "nenhuma face carregada em /". E2E: 7/7.)*
- [x] **F.0e** **O comando da contagem** — `npm run audit:colors` (`scripts/audit-colors.ts`), o
      critério de pronto (1) com comando versionado. Conta, **por arquivo**, em `src/**/*.{ts,tsx}`:
      utilitário da paleta padrão (as 22 famílias × tom), `rgb()`/`rgba()` e hex literal; e hex e
      `rgba` no `index.css` fora do `@theme`. `black`/`white` numa coluna à parte. **Exceção só
      nomeada, com motivo** — o padrão do `audit-ci.mjs`; a primeira é o hex do campo `color` do
      token (sem leitor). Teste do contador com um arquivo de exemplo. Nesta PR ele **só reporta**; a
      trava no CI é a F.2.10. Linha de base: a da tabela acima.
      *(30/09/2026 — em `.ts`, rodado pelo `tsx` como o `backup-db.ts`: o teste importa as funções com
      tipo. **Linha de base: paleta 1.748 · `rgba` 114 · hex 17 → 1.879 a migrar; `black`/`white` 108.**
      Achado ao escrever: `\brgba` não pega `shadow-[0_0_12px_rgba(…)]` — o `_` conta como letra para o
      `\b`, o mesmo motivo de as contagens antigas não verem o brilho. `audit-colors` (7); provado
      revertendo o lookbehind para `\b`: o teste do brilho falha.)*
- [x] **F.0f** **`netsheet-prod` no [`.claude/launch.json`](../../.claude/launch.json)** — o build de
      produção na porta 3100, para a verificação visual no painel com o helmet ativo (testado em 30/09
      e desfeito; entra aqui). A porta 3000 fica com o dev e com o E2E.
      *(30/09/2026 — exige `npm run build` antes. Usado na prova visual da F.0c: a ficha, que caía em
      Cascadia/Consolas, agora carrega as duas faces, sem aviso de CSP.)*
- [x] **F.0g** **Conferir no ar** depois do deploy do PR 1: uma visita a
      `https://netsheetengine.onrender.com` com o DevTools — **antes**, o console recusa o
      `fonts.googleapis.com`; **depois**, nenhum aviso de CSP e as faces `loaded`. Uma visita de cada
      vez, nada de monitor (regra 3 do custo zero).
      **Não bloqueia o resto da F:** se o PR 1 ainda não estiver no ar (o Render volta em 01/10), a
      sessão segue pelo primeiro item aberto depois desta caixa e a marca quando conferir. *(Em 30/09 o
      `master` já tinha #27–#29, então a visita confere também a tipografia: Orbitron nos títulos e
      nenhum aviso de CSP.)*
      *(05/10/2026 — conferido no ar, com a `0.4.4`, pelo navegador do app, logo depois da 01.13 (a
      visita acordaria o serviço antes dela). Nas três telas do E2E da F.0d — início, ficha e entrada da
      mesa —: **nenhuma** mensagem no console, **nenhum** recurso de fora do origin, **0** faces em
      `error`, e `loaded` o Rajdhani 400 e 700, o Share Tech Mono e o Orbitron. Os quatro primeiros
      títulos da página inicial computam `Orbitron Variable`. O cabeçalho do ar traz `font-src 'self'
      data:` e `style-src 'self' 'unsafe-inline'` — o helmet ativo. As faces `unloaded` que o
      `document.fonts` lista são os outros subconjuntos do `unicode-range`, que o navegador não baixa.)*

#### F.2 — Ligar os tokens: o encanamento *(1–1,5 dia — PR 2; vem antes da F.1)*

O sistema de design **já existe e nunca foi conectado**: 8 tokens de cor no `@theme`, **0**
componentes usando; `scanline` e `glitch` definidas, **0** usos. Terceiro caso do mesmo padrão, depois
do `combatModifier` e do `currentStats`. **Sem esta etapa, aplicar a identidade nova custa ~1.850
substituições — e a próxima mudança custará outras tantas.** Esta parte **não muda o visual**; a que
muda é a [F.2b](#f2b--cor-com-significado-meio-dia--pr-3b).

- [x] **F.2.1** **Duas camadas de token, e a tabela de conversão.** No `@theme` do `index.css`:
      - **rampa por papel**, com os tons que o código usa e os valores de hoje — `accent` (ciano: ação,
        foco, links), `signal` (amarelo: destaque, GM, marca), `ok` (verde: sucesso, online), `net`
        (roxo: Netrunner e IA), `fault` (magenta: erro, destrutivo, hostil) e `danger` (vermelho: **só
        dano**). Ex.: `cyan-400` → `accent-400`;
      - **nomes semânticos para os neutros** — os 727 `slate` —, pelo par prefixo × tom: `bg-slate-950`
        → `bg-surface`, `bg-slate-900` → `bg-raised`, `border-slate-800` → `border-line`,
        `text-slate-400` → `text-muted`, e assim por diante (`fg`, `line-strong`…).
      - **A tabela** — as 129 combinações → token —, versionada ao lado do script
        (`scripts/color-map.json`): é a especificação revisável da migração **e** a documentação da
        camada de token (o diagrama segue ADIAR, [`ARQUITETURA.md`](../ARQUITETURA.md#diagramas-adiados)).
      - **O vermelho não entra pela tabela:** os 244 usos são classificados à mão na F.2.2.
      - *Por que duas camadas e não os 7 nomes planos de 02/09:* com 7 nomes, `slate-100/200/300`
        viram um só `fg` e a conversão exige juízo em cada linha; com a rampa, é mecânica — que era a
        promessa do item.
      *(30/09/2026 — as rampas têm 11 tons cada, copiados da paleta instalada
      (`npx tsx scripts/migrate-colors.ts --tema`); os neutros com nome são `surface`, `raised`,
      `raised-strong`, `line-soft`, `line`, `line-strong`, `fg-strong`, `fg`, `fg-soft`, `muted`,
      `subtle` e `faint`, e o tom sem nome cai em `night-*`. Os 8 tokens antigos, sem uso, saíram, e o
      resto do `index.css` (corpo, seleção, scrollbars, scanline) lê os tokens. **Três ajustes, pelo
      que os usos mostraram** (a tabela diz o porquê de cada um):
      - o **rosa não entra por tabela**: os 39 usos de hoje são DADOS, rolagem e armas — nenhum é
        falha. Trocar por `fault` rotularia errado todos; vai à mão na F.2.2, com o vermelho (e as
        famílias de poucos usos: `rose` e `orange` da escala de ferimento, `sky` do tema de grid azul,
        `teal` do atributo EMP);
      - o **roxo** é Netrunner/IA **e** cyberware/humanidade: o papel é **`cyber`**, não `net`;
      - o **âmbar** (56 usos) ganha papel próprio, **`caution`**: ação de combate, perigo no grid,
        status inativo.
      A tabela real tem **130** combinações (`--tabela` imprime cada uma e o destino).
      `migrate-colors` (11 — conversão e conflitos).)*
- [x] **F.2.4** **Converter por script**, arquivo por arquivo, do maior para o menor (`MultiplayerRoom`
      235 → `TacticalGrid` 168 → `CyberpunkMenu` 162 → `FriendsList` 161 → `PrdViewer` 92 → …), um
      commit por arquivo ou lote. Inclui as strings de classe fora de `.tsx` (`injuryRules.ts`). A
      app funciona o tempo todo.
      *(30/09/2026 — `npx tsx scripts/migrate-colors.ts --aplicar`: os quatro maiores um por commit e
      os outros 24 num lote; ~1.520 trocas. **Achado pela F.2.6 — a primeira conversão mudou o
      visual:** o cartão da sala ganhou uma borda verde inteira. **19 elementos** tinham duas classes
      de cor da mesma propriedade (`border-l-4 border-emerald-500 … border-slate-800`), e o Tailwind 4
      resolve pela ordem do CSS, que para a mesma propriedade é a **alfabética do nome** (conferido
      compilando): `slate` vencia `emerald`, mas `line` perde para `ok` — renomear inverte o vencedor.
      A conversão foi desfeita (os commits eram gerados e não tinham subido) e refeita em ordem:
      primeiro `--resolver` tira a classe que perdia — código morto, nunca pintou nada —, depois a
      conversão. O detector entende template e ternário (a parte fixa soma a cada ramo, os ramos não
      somam entre si): **por linha eram 101 "conflitos"; os reais são 19**. `--conflitos` depois da
      conversão: **0**. *Revelado de desenho:* 13 cartões têm uma "barra de destaque" colorida à
      esquerda que **nunca apareceu**, e os 4 amarelos pintavam a borda inteira — vai à F.2.11.)*
- [x] **F.2.5** **Brilho por token:** `--shadow-glow` (e os raios que o código usa) no `@theme`, e
      `shadow-glow shadow-accent/40` no lugar dos **110** `rgba()` em `shadow-[…]`.
      *(30/09/2026 — uma escala por raio, `shadow-glow-5` a `-30` e `drop-shadow-glow-10` a `-20`, com
      `currentColor` que o Tailwind troca pela cor de `shadow-<token>` (conferido no 4.3.3). No mesmo
      passe do script: `shadow-[0_0_15px_rgba(6,182,212,0.4)]` → `shadow-glow-15 shadow-accent-500/40`.
      Os brilhos vermelhos e rosas e o fósforo RGB do efeito CRT ficam para a F.2b.)*
- [x] **F.2.6** **Prova — nada mudou:** capturas antes e depois de cinco telas (início, ficha, dados,
      mesa do GM, mesa do jogador) no `netsheet-prod`. Diferença aceita: só o arredondamento dos tons
      fundidos nos neutros. O `ui-smoke`, que fixa `bg-yellow-400`, passa a fixar o token — trocado
      com o porquê. `audit:colors` deve cair perto de zero, fora o vermelho da F.2.2.
      *(30/09/2026 — captura com o Chromium do Playwright, relógio congelado e animação desligada, e
      comparação pixel a pixel. **Ruído medido antes:** duas capturas do mesmo build diferem só numa
      região de 30×8 px da ficha. **Resultado:** nenhuma diferença forte (Δ > 12) fora dessa região;
      sobram diferenças de **no máximo 8** (de 255) nos halos de brilho — o `rgba` da paleta antiga
      (v3) virou o tom equivalente de hoje (v4, oklch). A remoção das 19 classes mortas, sozinha: zero
      diferença. `audit:colors`: **1.879 → 322** (paleta 285 · `rgba` 36 · hex 1) — o que sobra é
      todo da F.2b. `black`/`white`: 109.)*

#### F.1 — O sistema tipográfico *(1 dia — PR 3a; decisão 10a)*

- [x] **F.1.1** **Papéis das faces**, pelo `@theme`:
      - `--font-sans` **Rajdhani** — rótulos, navegação, títulos de campo e texto corrido;
      - `--font-mono` **Share Tech Mono** — números, dados, valores de campo, rolagens, mensagens de
        sistema e momentos de terminal;
      - `--font-display` **Orbitron** — títulos de seção e wordmark (F.1.3).
      Cada um dos **206** `font-mono` é classificado: a maioria é rótulo e sai.
      *(30/09/2026 — classificado elemento a elemento, lendo o que cada um mostra: rótulo, navegação,
      botão e prosa saíram da mono; campo, número, código, ID, versão, rolagem e mensagem de sistema
      ficaram. **Os contêineres eram o grosso:** a raiz do menu, da página inicial, do rolador, da
      mesa, do perfil e do grid era mono, e tudo dentro herdava — a raiz passou a sans e os dados de
      dentro ganharam a mono de volta. Medido no navegador, a fatia de texto por voz: **a ficha foi de
      96% mono para 75% Rajdhani, 16% mono e 9% Orbitron**; nas outras telas, ~72–76% Rajdhani,
      ~20–30% mono (a mesa tem mais, pelo chat) e 2–5% Orbitron.)*
- [x] **F.1.2** **Mono sem negrito.** A Share Tech Mono só tem o 400; destaque na mono é **brilho**
      (cor, tamanho, caixa alta), como no terminal — nunca peso. O `audit:colors` ganha uma coluna que
      acusa `font-mono` com `font-bold|extrabold|black` no mesmo elemento (99 só na ficha, hoje).
      *(30/09/2026 — a coluna `mono+b` do `audit:colors` conta o trecho de classe que junta os dois
      (ternário não soma alternativas): **0**. Mas negrito **herdado** de um contêiner a análise
      estática não vê — a prova é no navegador: todo elemento renderizado em Share Tech Mono com peso
      ≥ 600, em 12 telas (as 9 rotas e a mesa do GM em chat, grid e iniciativa). Achou dois — o selo
      da versão dentro do botão das notas e o "Modo Visitante" na linha de ID da ficha —, corrigidos:
      **0**. `audit-colors` (9).)*
- [x] **F.1.3** **Display → `Orbitron`** *(adicionar)*, por `@fontsource-variable/orbitron` (400–900,
      11,5 KB). *Sintoma:* não existe voz de display — títulos são a fonte do corpo, só maior, e as
      seções não se distinguem. Conferido: todos os acentos do português e o `€`. **Não usar onde
      aparece `º`/`ª`** (a ordem da iniciativa fica na mono). *(Michroma, mais próxima do Eurostile
      Extended, só se o Orbitron não servir no wordmark: 17,5 KB, peso único.)*
      *(30/09/2026 — na marca, no título de cada página e de cada seção, no herói da página inicial,
      nos títulos de modal e nas marcas d'água (`EDGERUNNER`, `BIOMON`…). Um `woff2` de 11,8 KB. O
      itálico dos títulos de página é sintético — o Orbitron não tem itálico —, e numa face
      geométrica fica bem. Como ela é larga, os títulos de seção descem um tamanho abaixo de 640 px
      (`text-base sm:text-lg`), e a marca do menu passou a ocupar duas linhas. O Michroma não fez
      falta. **O `1º` da iniciativa foi para a mono:** o Rajdhani também não tem `º`/`ª`.)*
- [x] **F.1.4** **Números da ficha → condicional.** Primeiro `tabular-nums` (F.2.3; 0 usos hoje). *Só
      se* os dígitos continuarem desalinhados, `Saira Condensed` (17,5 KB por peso) nos blocos de
      estatística. Não adicionar fonte antes de medir — é o filtro aplicado à tipografia.
      *(30/09/2026 — **medido: o Rajdhani não tem algarismos tabulares.** Com ou sem `tabular-nums`,
      `1111` mede 50,7 px e `8888`, 83,1 px. O que alinha os dígitos é a F.1.1: todo número está na
      mono, que tem largura fixa. A Saira não entra — a condição não se cumpriu.)*
- [x] **F.1.5** **Momentos de terminal → condicional.** `VT323` (17,5 KB) **só** se o Netrunner IA, as
      mensagens de `SISTEMA_NET` e as telas de carregamento não se distinguirem com a mono — e nunca
      em corpo de texto, onde é ilegível.
      *(30/09/2026 — distinguem-se: com o resto da interface em Rajdhani, o cabeçalho do Netrunner IA,
      as mensagens do sistema no chat e as telas de carregamento ficaram sendo o que está em mono. O
      VT323 não entra — a condição não se cumpriu.)*
- [x] **F.1.6** **Escala e tracking** com nome, no `@theme` (`--text-*`), com **piso de 10 px**: os 61
      textos em 9 px, os 9 em 8 px e o de 7 px sobem. Dois trackings para caixa alta, com critério
      (hoje 51 `tracking-widest` e 32 `tracking-wider` sem regra).
      *(30/09/2026 — `text-micro` (10 px) no lugar de 208 `text-[7–10px]` e `text-mini` (11 px) no de 42
      `text-[11px]`; `tracking-caps` (0,08em) no lugar dos 86 `wide`/`wider`/`widest`, e
      `tracking-display` (0,04em) nos títulos em Orbitron. Os `tracking-tight` de etiquetas pequenas
      ficaram: são exceção de espaço, não critério de caixa alta. **Piso conferido no navegador:**
      nenhum texto visível abaixo de 10 px nas 12 telas. O E2E passou sem mudar uma linha — nenhum
      rótulo mudou de texto.)*
      - **E2E:** o fluxo acha elementos por texto visível. Mudar rótulo é mudar o teste — de propósito,
        e com o porquê no commit.

#### F.2b — Cor com significado *(meio dia — PR 3b)*

> *(30/09/2026, à noite — **o PR 3b foi feito nesta mesma data**; as notas abaixo ficam como o que a
> sessão herdou. As ferramentas e as travas continuam valendo para qualquer mudança visual: o
> `audit:colors` e o `--conflitos` agora rodam no CI, e o `capturar.mjs` faz o GM entrar pelo deep
> link — antes ele virava jogador.)*
>
> **Para a sessão que abrir o PR 3b** *(fim da sessão de 30/09/2026)*. O que esta parte herda:
> - **Comece pela F.3.0 — a pesquisa em fonte pública** das três perguntas de diagramação (barra
>   preta, faixas, numeração): o dono **não tem o livro** (decisão 11). A F.3 inteira depende delas; a
>   F.2b e a F.4 não, e podem andar enquanto o dono decide o que ficar sem fonte.
> - **Renomear cor pode inverter o visual** (achado da F.2.4): com duas classes de cor da mesma
>   propriedade no mesmo elemento, o Tailwind 4 decide pela ordem **alfabética** do nome. A F.2.2
>   renomeia vermelho e rosa à mão — rode `npx tsx scripts/migrate-colors.ts --conflitos` depois de cada
>   lote (hoje: 0) e prove por captura.
> - **As ferramentas de prova estão em `scripts/visual/`**, contra o `netsheet-prod` (porta 3100, build de
>   produção com helmet; `npm run build` antes, e servidor recém-subido — as salas de teste têm código
>   fixo): `capturar.mjs` (cinco telas, relógio congelado), `comparar.mjs` (pixel a pixel; Δ ≤ 8 é
>   arredondamento, Δ > 12 é mudança — a região de ~30×8 px da ficha muda sozinha: é o ID aleatório da
>   ficha nova) e `tipografia.mjs` (as regras da F.1 no navegador; tem de continuar ✅).
> - **`npm run audit:colors`** mostra o que falta: hoje 322 cores à mão, todas desta parte; a F.2.10 o
>   põe no CI exigindo zero. A coluna `mono+b` tem de seguir em 0.
> - **Contraste:** a medida da F.0a (`text-slate-500` 3,7–4,2:1, Mortal 2–6 3,0–4,5:1) foi feita com a
>   cor computada contra o fundo composto — refazer igual depois de mudar `subtle`, `faint` e `wound-*`.

- [x] **F.2.2** **Regra de política: vermelho significa exclusivamente dano** (decisão 10b). Os 244
      usos, classificados à mão:

  | Hoje em vermelho | Vai para |
  |---|---|
  | Dano, ferimento, stun e death save, morte | `danger` e a escala `wound-*` (F.2.7) |
  | Faixa da marca, menu ativo, PRD, página inicial, cabeçalho da página | `signal` ou `accent` |
  | O GM — mensagens no chat, "Poderes do GM" | `signal` (o GM já é amarelo no papel) |
  | Rótulo do atributo BODY | neutro ou `accent` |
  | Erro de sistema, botão de apagar, alerta de humanidade, falha crítica no dado, NPC hostil no grid | **`fault`** — magenta (a rampa já existe no `@theme` desde a F.2.1) |
  | **O rosa de hoje** (F.2.1): DADOS, rolagem, armas, o atributo ATTR | a matiz nova de DADOS (F.2.9) — **não** `fault` |
  | `rose`/`orange` da escala de ferimento; `orange` do atributo MA; `sky` do tema de grid azul; `teal` do atributo EMP | `wound-*` (F.2.7); nos atributos e no tema, um tom da paleta de papéis que os mantenha distintos |

  *O NPC:* muda nas classes do `TacticalGrid`; o campo `color` persistido fica como está (sem
  leitor — pista da G). Os grids já gravados seguem válidos.

  *(30/09/2026 — feito, um commit por lote, cada um com `--conflitos` em 0. Medido antes: **285**
  utilitários (238 `red`, 38 `pink`, 9 das famílias pequenas), **36** `rgba` e **1** hex. O que cada
  vermelho virou:*
  - ***A moldura da marca** (menu, gaveta do celular, cabeçalho de página, herói da página inicial,
    feed de notas, lista de amigos) → `accent`. A marca fica no par amarelo e ciano; a barra
    vermelho-amarelo-ciano virou amarelo-ciano. **O item ativo** (menu e abas da PRD) → `signal`: com
    a moldura ciano, o ativo precisa de outra cor.*
  - ***`fault`:** erro (404, ErrorBoundary, login, busca, avatar, sala), ação destrutiva (apagar
    ficha, preset, perícia, cyberware, arma, evento, avatar; recusar pedido, desfazer amizade, limpar
    histórico, remover do grid), o *fumble*, o alerta de humanidade, o NPC hostil no grid, "Gerar
    NPC", a variante `destructive` do botão, o "cancelado" e o P0 da PRD, o avatar caveira.*
  - ***`danger`:** o Bio-Monitor da ficha e do GM, rolar dano, stun e death save (no rolador e na
    mesa), editar saúde, aplicar dano, o ponto de token ferido, "MORTO".*
  - ***`signal`:** o GM — etiqueta, nome e balão no chat, "Poderes do GM".*
  - ***Neutro:** "Sair" do perfil e da mesa (sair não perde dado), o "fechar" (X) vai a `accent`, e
    o "−" de atributo e perícia também (o "+" já era).*
  - ***O rosa** (DADOS, rolagem, armas) → a rampa nova **`roll`** (F.2.9). "Sem munição" → `caution`.
    Atributos: ATTR `roll`, MA `caution-600` (LUCK é o 400), BODY neutro, EMP `cyber-300` (a EMP gera
    a Humanidade). O tema de grid azul (`sky`) → `roll`.*
  - ***O tema de grid "Alerta de Combate (Vermelho)"** vira "(Magenta)", em `fault`: um grid inteiro
    vermelho competiria com a trilha de ferimento. A chave gravada (`redalert`) não muda.*
  - ***O fósforo do CRT** do menu saiu do `bg-[…rgba…]` para a classe `.crt-phosphor`, lendo os
    tokens: a franja vermelho/azul virou magenta/ciano, o par do `.glitch-text` — cujo `::after` era o
    hex do vermelho e virou `fault-500`. O gradiente do fundo do App lê `raised` e `surface`.*
  - ***De carona, um resto da F.1:** `tracking-displayer` em 2 títulos (a troca de `tracking-tighter`
    deixou o `er`) — classe que não gera CSS. Virou `tracking-display`.*

  ***`audit:colors`: 322 → 0.** Prova por captura: as cinco telas antes e depois, no `netsheet-prod`.)*
- [x] **F.2.3** `font-variant-numeric: tabular-nums` em toda coluna de número da ficha (atributos, SP,
      dano, iniciativa) — hoje os dígitos dançam quando o valor muda.
      *(30/09/2026 — **descartado, com medição** (F.1.4): o Rajdhani não tem algarismos tabulares, e
      `tabular-nums` nele não muda nada. Os números foram para a mono, que tem largura fixa — o
      sintoma (dígito que dança) acabou por outro caminho.)*
- [x] **F.2.7** **A escala de dano, `wound-*`, com contraste.** No fundo escuro, a gravidade tem que
      **clarear**, não escurecer: hoje Mortal 2–6 fica entre 3,0 e 4,5:1. Todo tom da escala com
      **≥ 4,5:1** sobre `surface` e `raised`, medido com a cor computada.
      *(30/09/2026 — 11 tokens no `@theme`, `wound-0` a `wound-10` (o índice do
      `WOUND_LEVEL_NAMES`). Do Crítico à Morte Iminente o tom sobe pelos claros do `danger` (500 → 100):
      sobre `raised`, Mortal 2–3 foi de 3,7 a 9,3:1 e Mortal 5–6, de 2,9 a 12,3–14,6:1. **A trava é
      um teste,** `theme-contrast.test`: lê o `@theme`, converte oklch → sRGB e exige 4,5:1 de cada
      `wound-N` e de cada texto neutro sobre `surface` e `raised`, e que a escala clareie. Os números
      dele batem com a medição da F.0a no navegador. **Provado** com os valores de antes: 16 falham.)*
- [x] **F.2.8** **Texto apagado com ≥ 4,5:1.** Desde a F.2.4, os antigos `text-slate-500` (56) e
      `text-slate-600` (17) são os tokens `subtle` e `faint`: o conserto é trocar o **valor** deles no
      `@theme` (ou fundi-los em `muted`), num lugar só — o ganho do token.
      *(30/09/2026 — `subtle` sobe para oklch(62% …): 4,9:1 sobre `raised` (era 3,7) e 5,5 sobre
      `surface`. O `faint` (2,4:1) se funde nele: dois degraus abaixo de 4,5:1 não existem. Os dois só
      eram cor de texto. Travado pelo mesmo teste da F.2.7.)*
- [x] **F.2.9** **Cor por seção, mantida** (decisão 10c). As 8 abas seguem com cor própria, tirada da
      paleta de papéis e nunca de `danger`: o **PRD** sai do vermelho e **DADOS** sai do rosa (que virou
      `fault`). A matiz nova de cada uma é escolhida com captura no PR.
      *(30/09/2026 — **DADOS ganha uma rampa nova, `roll` (azul, do `blue`):** nenhum papel sobrava —
      accent é FICHA, ok é JOGAR, cyber é NETRUNNER IA, signal é INÍCIO e LENDAS, caution é PERFIL —, e
      o `caution-500` tentado primeiro quase não se distingue do âmbar de PERFIL. **A PRD vai para o
      neutro** (`fg-strong`): o documento, em P&B. As abas: INÍCIO e LENDAS `signal`, JOGAR `ok`, FICHA
      `accent`, NETRUNNER IA `cyber`, DADOS `roll`, PRD neutro, PERFIL `caution`. O `color-map.json`
      ganhou `blue → roll`.)* *(01/10/2026 — **aprovado pelo dono**, com as capturas do #32.)*
- [x] **F.2.10** **A trava.** `--color-*: initial` no `@theme` (a paleta padrão deixa de gerar classe;
      `black` e `white` redefinidos) e o `npm run audit:colors` no CI **exigindo zero**, fora das
      exceções nomeadas. Sem isso a paleta volta a ambiguar sozinha — a razão de fundo da F.2.2.
      **E `--conflitos` em zero** (`scripts/migrate-colors.ts`): duas classes de cor da mesma
      propriedade no mesmo elemento fazem o visual depender do alfabeto (achado da F.2.4) — a
      classificação à mão da F.2.2 renomeia vermelho e rosa, e cada troca pode inverter um vencedor.
      *(30/09/2026 — `--color-*: initial`, com `black` e `white` redefinidos; no build, as 101
      variáveis de cor usadas estão todas definidas e `text-red-500` não existe mais no CSS. O
      `audit:colors` sai com erro (`codigoDeSaida`, com teste) e o `--conflitos` também; o job de
      validação do CI roda os dois depois do typecheck. **Provado:** com um `text-red-500` e um par
      `border-accent-500 border-line` plantados, os dois saem com 1. **Não muda a tela:** as cinco
      capturas antes e depois da trava são iguais, fora o ruído conhecido da ficha.)*
- [x] **F.2.11** **As barras de destaque que nunca apareceram** (achado da F.2.4). 13 cartões tinham
      `border-l-4` com uma cor que perdia para a borda neutra, e os 4 amarelos pintavam a borda
      inteira. A F.2.4 preservou o que se via; aqui se decide, com captura, se a barra aparece — com
      `border-l-<cor>`, que não briga com a borda dos outros lados — ou se o desenho fica sem ela.
      *(30/09/2026 — **a barra aparece**, com a cor da seção pela F.2.2 (o Bio-Monitor em `danger`;
      a PRD com visão em `accent`, módulos em `signal` e roadmap neutro), como os cartões de item já
      faziam. Os 4 amarelos perdem a borda inteira e ganham a barra. A captura vai no PR para o dono
      confirmar.)* *(01/10/2026 — **aprovado pelo dono**, pelas capturas antes e depois das cinco telas
      no PR #32.)*

#### F.3 — O vocabulário visual oitentista *(1 dia — PR 3b; decisão 10d)*

A tipografia é metade. A outra metade é o repertório gráfico do livro impresso.

- [x] **F.3.0** 🔍 **Conferir em fonte pública** — o dono **não tem o livro** (decisão 11; o texto
      anterior pedia "o dono, com o livro na mão"). As três perguntas são de diagramação: **(1)**
      títulos de seção em barra preta com texto branco em caixa alta? **(2)** faixas de perigo
      diagonais? **(3)** numeração de seção ou rótulos técnicos? Vale o que as fontes públicas mostram
      do interior do livro de 1990: uma imagem do interior é prova; descrição de resenha sozinha precisa
      de duas. A resposta vai com o link, **sem copiar arte nem texto** (o repositório é público). A
      F.0a já não achou fonte pública para as três (ADR 0006): **o que nenhuma fonte mostrar sai da
      F.3**, com uma linha de razão — a não ser que o dono queira mantê-lo como "linguagem da época",
      item a item (🧑‍⚖️, com uma opção recomendada).
      *(30/09/2026 — pesquisado: a resenha do RPG.net (lida pelo resumo da busca — o arquivo antigo do
      site redireciona para o fórum), a [revisão da série OSSR no The Gaming Den](http://www.tgdmb.com/phpBB3/viewtopic.php?t=57550)
      e o [artigo da R. Talsorian sobre a diagramação do RED](https://rtalsoriangames.com/2020/11/13/cyberpunk-red-alert-layout-and-launch/),
      que não fala do 2020. **Nenhuma das três aparece.** O que as fontes confirmam do interior: duas
      colunas justificadas, face sem serifa, *sidebars*, arte a traço em P&B, o nome do capítulo no
      alto da página e o número embaixo. **O dono decidiu pelas recomendações:** a F.3.2 e a F.3.4
      saem, e a F.3.3 vira ADIAR com gatilho.)*
- [x] **F.3.1** **`scanline` e `glitch` com intenção, dentro do 2.2.2:** a scanline **estática** (a
      `.crt-scanlines` que já existe, 1 uso) no lugar da animação de 8 s em loop; o `glitch` **só em
      evento** e uma vez (menos de 1 s) — entrar em Mortal, trocar de tela. Nunca em loop numa tela de
      leitura.
      *(30/09/2026 — medido: a scanline animada, o glitch e o `.glitch-text` tinham **0 usos**, todos em
      loop infinito. A animada e o `.glitch-text` saem; o glitch vira `glitch 0.75s steps(1, end) 1` —
      dois saltos e a volta, três mudanças. Quem dispara é a `key` do React: o título da página a cada
      troca de tela, e o estado do Bio-Monitor ao entrar ou piorar em Mortal e ao morrer. Conferido no
      navegador: 0,75 s, 1 iteração.)*
- [x] ~~**F.3.2** **Barras pretas com caixa alta reversa** — um componente de cabeçalho de seção, não
      uma classe repetida. *Se o F.3.0 confirmar.*~~ **Saiu (F.3.0, 30/09/2026):** sem fonte, e o
      sintoma que ela resolveria — seções que não se distinguem — a F.1.3 já resolveu com o Orbitron.
- [x] **F.3.3** **Faixas de perigo amarelo-e-preto** (`signal`) para estados de alerta (turno do
      jogador, sala em combate). *Se o F.3.0 confirmar.* **ADIAR (F.3.0, 30/09/2026):** sem fonte e
      sem sintoma — nenhuma sessão em produção ainda. **Gatilho:** alguém da mesa perder a vez por não
      perceber que era o turno dele, anotado no [registro de sessões](../PLANO_MESTRE.md#registro-de-sessões).
- [x] ~~**F.3.4** **Numeração de seção e rótulos técnicos.** *Se o F.3.0 confirmar* — e no formato do
      livro. O `FICHA_01` com underscore, sem o livro, sai.~~ **Saiu (F.3.0, 30/09/2026):** sem fonte;
      fica o `SISTEMA // FICHA` que o app já usa.
- [x] **F.3.5** *(opcional, sob o filtro)* Textura de impressão/xerox e aberração cromática sutil.
      **ADIAR** por padrão — "falta sujeira analógica" é gosto, não sintoma. Qualquer textura passa no
      F.4.2. *(30/09/2026 — **ADIAR**, como o item previa. **Gatilho:** o dono pedir a textura depois de
      ver a F no ar. A aberração sutil que já existe é a franja magenta/ciano do `.crt-phosphor`.)*

#### F.4 — Aplicar e verificar *(meio dia a 1 dia — PR 3b)*

- [x] **F.4.1** Aplicar começando pela ficha (maior superfície visual) e terminando na mesa.
      *(30/09/2026 — aplicado pela F.2b em lotes, da moldura e da interface à ficha e à mesa, cada um
      com `--conflitos` em 0; prova pelas cinco capturas antes e depois no `netsheet-prod`, que vão no
      PR. A ferramenta de captura tinha um defeito: a "mesa do GM" entrava pelo lobby e virava jogador
      desde a R.1 — consertada, o GM entra pelo deep link.)*
- [x] **F.4.2** **Acessibilidade — não negociável.** Critérios do [WCAG 2.2](https://www.w3.org/TR/WCAG22/):
      - **2.2.2 Pausar, parar, ocultar (A)** — a versão 10× menor **certa**: no `@theme`,
        `--animate-pulse` e `--animate-ping` com **iterações finitas** (param em ≤ 5 s) — um lugar para
        os 18 `pulse` e os 2 `ping`. O `spin` de carregando é essencial e fica. **E** a regra
        `@media (prefers-reduced-motion: reduce)` zera o resto (`fadeIn`, `glitch`, `bounce`) — boa
        prática, não o critério.
      - **2.3.1 Três flashes (A)** — o `glitch` não pisca mais de 3 vezes por segundo.
      - **1.4.3** (texto, 4,5:1) e **1.4.11** (borda e ícone, 3:1), nível AA — pelos tokens (F.2.7,
        F.2.8), medidos com a cor computada.
      - **Modais:** os dois da mesa passam ao `dialog.tsx` (Radix) — foco preso, Esc e
        `role="dialog"`. As classes `animate-in/out` do `dialog.tsx` saem (não geram CSS) ou viram o
        `fadeIn`.
      - As **12 marcas d'água** decorativas ganham `aria-hidden`.
      - **2.5.8 Tamanho do alvo (AA, 24 px):** 44 dos 111 alvos da ficha têm menos de 24 px. Os 40 da
        trilha (20 × 20, com 4 px de vão) passam pela exceção de espaçamento; conferir os outros.
      *(30/09/2026 — feito, cada parte com teste ou prova por script:*
      - ***2.2.2:** `pulse` (2 s × 2), `ping` (1 s × 4), `bounce` (1 s × 3) e `pulse-glow` (2 s × 2) no
        `@theme`, finitos; o `spin` fica. `prefers-reduced-motion` zera o resto, fora o spin. Trava:
        `theme-motion.test` (provado: 6 de 8 falhavam antes).*
      - ***2.3.1:** o glitch tem três mudanças em 0,75 s (F.3.1).*
      - ***1.4.3:** pelos tokens (F.2.7, F.2.8). **1.4.11 — achado ao medir:** a borda dos campos de
        formulário ficava em 1,27–2,14:1 (borda de cartão é decoração e fica). Token novo `field`
        (night-500) e o 700 da rampa nos campos coloridos: pior caso 3,53:1. Trava no
        `theme-contrast.test` (provado: o valor de antes dá 1,95 e 1,73:1).*
      - ***Modais:** os dois da mesa no `Dialog` do Radix, com o foco devolvido a quem abriu (eles
        abrem por estado). Prova com o build de produção, GM e jogador: `role="dialog"` com título, foco
        preso por 20 Tabs, Esc fecha, foco volta. Do `dialog.tsx` saíram os `animate-in/out`, `zoom-*`,
        `slide-*` (do plugin que não está instalado); o conteúdo entra com o `fadeIn`.*
      - ***Marcas d'água:** as 12 com `aria-hidden`.*
      - ***2.5.8 — medido em 9 larguras, de 375 a 1920 px:** a 375 px os 40 quadrados da trilha eram
        12×12 e falhavam (a medida de 20×20 era a do desktop); a 1024 px os "−"/"+" dos atributos
        encolhiam para 14×28. A trilha passa a 2 níveis por linha no celular, 5 a partir de 640 px e
        os 10 do livro a partir de 1536 px (quadrado de 25 a 48 px); os botões, `shrink-0`. **0** alvos
        fora do critério nas 9 larguras.*
      - ***Achado ao converter os modais — o `cn` apagava classes:** o `tailwind-merge` não lê o
        `@theme` e tomava `shadow-glow-*`, `text-micro`/`text-mini` por cor; o modal de login perdera o
        brilho desde a F.2.5. `extendTailwindMerge` com os tokens de tamanho, e o `cn-theme.test`
        deriva a lista do `@theme` (provado: 20 de 21 falhavam).)*
- [x] **F.4.3** Peso das fontes: só os pesos usados. Linha de base (`latin`, `woff2`): Rajdhani 14–15 KB
      por peso, Share Tech Mono 13 KB, Orbitron variável 11,5 KB. Uma vez por aparelho — ~40–80 KB,
      nada perto dos 5 GB de banda do workspace.
      *(30/09/2026 — o Rajdhani 500 e o 600 tinham **um** uso cada, na linha "FICHA ATIVA" do
      cabeçalho; viraram 400 e 700, e os dois imports saem. Ficam Rajdhani 400 e 700, Share Tech Mono
      400 e o Orbitron variável; o build passa de 13 para 7 `woff2` do Rajdhani e da mono, mais o do
      Orbitron.)*
- [x] **F.4.4** Produção com helmet ativo — coberta pelo E2E da F.0d a cada PR. Conferir no ar uma vez,
      depois do último deploy (como na F.0g).
      *(30/09/2026 — o E2E `fonts-csp` passou neste PR, 7/7. A visita ao ar é depois do merge, junto
      com a F.0g.)* *(05/10/2026 — conferida na mesma visita da F.0g, com o PR 3b no ar: a `0.4.4` e
      as faces da F.4.3, nada além delas.)*
- [x] **F.4.5** `git tag v0.4.4`, com o `package.json` em `0.4.4` (a regra do R.9).
      *(30/09/2026 — `npm version 0.4.4 --no-git-tag-version`; a tag `v0.4.4` está no commit que fechou
      a construção (`41d3305`), como a `v0.4.3` no da D. O registro da aprovação, de 01/10, veio depois e
      é só documento — a tag publicada não foi movida.)*
- [x] **F.5** 🔒 **Portão de segurança** — responder as seis perguntas de [`SEGURANCA.md`](../SEGURANCA.md#o-portão-de-segurança) sobre o que esta fase mudou, e registrar em [`SEGURANCA.md`](../SEGURANCA.md#registro-por-fase). Atualizar o diagrama afetado em [`ARQUITETURA.md`](../ARQUITETURA.md), se houver. **30 min — a fase não fecha sem isso.** *(Prévia de 30/09: nenhuma entrada, saída ou autorização nova; o CSP continua `'self'`; custo novo só a banda das fontes.)* *(30/09/2026 — registrado em [`SEGURANCA.md`](../SEGURANCA.md#fase-f--reestruturação-visual), para o PR 3b e para a fase inteira: nada novo nas seis; a banda cai com os dois pesos a menos; o CI roda dois scripts que só leem `src/`. Nenhum diagrama mudou de forma — o das camadas de token segue ADIAR, sem o gatilho disparado.)*
- [x] **F.6** 🧠 **Fechar o estado durável** — marcar os checkboxes desta fase e a data, atualizar a tabela de progresso e o diagrama afetado em [`ARQUITETURA.md`](../ARQUITETURA.md) se a forma do sistema mudou, e **atualizar a memória do Claude apenas com o que o repo não carrega** (decisão nova, preferência, correção de rumo — nunca o estado da fase). Ver o [Protocolo de sessão](../PLANO_MESTRE.md#-protocolo-de-sessão).
- [x] ✅ **Fase F concluída em:** 05/10/2026 *(a construção fechou em 30/09/2026, no PR 3b; a data
      entrou com a F.0g e a F.4.4 — a visita ao ar depois do deploy)*

> **Critério de pronto:** duas medidas objetivas, não "está bonito" — e as duas com comando.
> (1) `npm run audit:colors` em **zero** no CI, fora das exceções nomeadas (F.2.10). (2) O E2E das
> fontes verde com o helmet ativo (F.0d). A identidade nova é a consequência visível; a capacidade de
> mudá-la barato é a entrega real.
