# Conferência contra o livro — Cyberpunk 2020

Entregável da **C.9** do [`PLANO_MESTRE.md`](./PLANO_MESTRE.md) (decisão 2: **fidelidade estrita**).
Cada regra de jogo que o NetSheet implementa, o que o livro diz, o que o código fazia, e onde foi
resolvida. **Divergência do livro é bug**, não regra de casa.

A versão executável destas tabelas é [`src/rules/tables.ts`](../src/rules/tables.ts). Os testes de
regra são **derivados dela**, não da implementação — é a disciplina da Fase C: tabela do livro como
dado → testes → vê-los falhar → só então mudar o código.

**Concluída em 25/09/2026.** Resultado em uma tabela, detalhe nas seções abaixo.

## Resumo

**13 divergências do livro encontradas e corrigidas na Fase C** — 8 estavam no índice de achados do
plano, 5 não estavam (marcadas com ★):

| # | Divergência | Onde estava | Corrigida em |
|---|---|---|---|
| 1 | Servidor explodia o 10 uma vez só | `roomManager` | C.1 |
| 2 ★ | Fumble subtraía 1d10 (regra do RED), nos dois lados | `diceEngine`, `roomManager` | C.1 |
| 3 ★ | Acerto no tronco (2–4) virava "Perna Esquerda" | `diceEngine` | C.1 |
| 4 | BTM por BODY + REF, com sinal invertido | `derivedStats` | C.2 |
| 5 ★ | Ficha dizia "Reputação derivada de COOL + LUCK" | `StatBlock` | C.2 |
| 6 | Ataque sem a perícia da arma; na ficha, o WA **no lugar** dela | `roomManager`, `App` | C.3 |
| 7 | Modificador do GM não entrava em rolagem nenhuma | `roomManager` | C.4 |
| 8 | Efeito de ferimento de regra de casa, com MA e notas inventadas | `injuryRules` | C.5 |
| 9 | Rolagem ignorava ferimento e humanidade (`currentStats` sem leitor) | todas | C.6 |
| 10 | Death save sem o nível Mortal | `diceEngine`, `roomManager` | C.7 |
| 11 ★ | Stun save não existia (um botão só para os dois saves) | ficha, mesa | C.7 |
| 12 ★ | Mortal 6 tratado como morto, com o death save desligado | `HealthTracker` | C.7 |
| 13 | Atributo da habilidade especial por ternário (1 de 10 certo) | `SkillsSection` | C.8 |

**Ficou para outra fase, com dono e gatilho** — nada disso é "funciona errado hoje"; é o que o
modelo ainda não representa:

| Regra | Vai para | Por quê não agora |
|---|---|---|
| Ordem ×2 × BTM na cabeça | **Decidido em 26/09: SP → BTM → ×2** (decisão 6). Implementa na D.1 | O livro dá a regra e não diz quando ([pesquisa de 26/09](#dano--a-ordem-do-pipeline-para-a-fase-d)) |
| Dano → ferimento, perda de membro, dificuldade por alcance | Fase D | É o loop de combate. Penetração escalonada e cobertura: **ADIAR** na D.0 ([detalhe](#o-que-a-fase-d-conferiu)) |
| Combat Sense na iniciativa | **D.4 — feito** | Ver [o que a Fase D conferiu](#o-que-a-fase-d-conferiu) |
| Texto das tabelas de fumble | ADIAR | O dado já sai rolado; o GM lê no livro |
| Cromo que soma atributo; EV da armadura no REF | Fase K | O modelo de dados não tem o campo |
| Humanidade de implante "desinstalado" | ADIAR | O modelo não distingue nunca-instalado de removido |
| Walk (não existe), Leap, Carry, Lift; perícias faltando; criação com orçamento | Fase K | RUL-10, 11, 12 |
| Habilidade especial rolável **na mesa** | Pista da Fase H | O tipo `skill` procura em `sheet.skills` |

---

## Fontes, e o quanto confiar nelas

O livro de 1990 não está no repositório. A conferência usou **fontes secundárias independentes**, e
uma regra só foi aceita quando **duas ou mais concordam**. Onde só há inferência, a linha diz.

> **30/09/2026 — não há fonte primária.** Um registro do mesmo dia dizia que o dono tinha o livro
> físico; **estava errado**, e ele corrigiu (decisão 11 do plano). O método segue o de cima — duas
> fontes independentes —, e a divergência do código com o que elas sustentam vira bug (decisão 2). O
> que as secundárias não fecharam está em [Perguntas para o livro](#perguntas-para-o-livro). **Cópia
> do livro sem licença não é fonte.** **O repositório é público:** a conferência anota a regra **com
> as nossas palavras e a página que a fonte cita** — nunca texto ou tabela copiados do livro.

| # | Fonte | O que ela sustenta |
|---|---|---|
| S1 | [Ficha do Roll20 para CP2020](https://github.com/Roll20/roll20-character-sheets/blob/master/Cyberpunk%202020/Cyberpunk2020.html) — fórmulas executáveis | Efeito de ferimento (÷2, ÷3, −2), atributo de cada Special Ability, `1d10!!`, Run/Leap/Carry/Lift (`@{Ma}*3`, `@{Run}/4`, `@{Body}*10`, `@{Body}*40` — relido na K.0); perda de humanidade por implante (G.23) |
| S2 | [Ficha cyberpunk.co.uk v1.1](https://www.cyberpunk.co.uk/assets/pdf/cp2020v1.1.pdf) — auxílio de jogo não oficial | Modificador de stun por nível (0 a −9), tabela de local de impacto, lista de perícias por atributo (lida de novo na K.0: sem "Psychology", e "Social" só em EMP); campos de Character Points, Leap e Lift |
| S3 | [Character Generation Walkthrough](https://www.salroth.com/cp2020/files/CyberPunk2020.pdf) | Atributo das Special Abilities, efeito de Combat Sense, listas de perícias; na K.0: os **10 pacotes de carreira**, os 40 pontos (até 10 cada), o *pickup* de REF + INT fora da carreira, a **verba inicial** por role e nível da habilidade × 1D6/3. Dá **65 pontos** fixos para os atributos — um bolo definido, como o cinemático. *(K.6a, 20/10/2026 — relido: a tabela de salário tem **nove** roles; o Fixer não está nela. O "Weapons Tech" do Solo e o "Security" do Techie são a Weaponsmith e a Electronic Security das listas)* |
| S4 | [GameRant — dicas para o CP2020](https://gamerant.com/cyberpunk-2077-tabletop-2020-pro-tips/) | Efeito de ferimento (Sério −2 REF; Crítico ½; Mortal ⅓), stun e death save |
| S5 | [2d4chan — Cyberpunk 2020](https://2d4chan.org/mediawiki/index.php/Cyberpunk_2020) | Resolução, 10 encadeia, 1 é falha + tabela de fumble, saves, BTM nunca zera o dano, iniciativa; na K.0: os **três métodos** de atributo (9D10 num bolo; 1d10 por atributo, rerrolando o 1; o cinemático, em que o Mestre decide), 40 pontos de carreira e REF + INT de *pickup*. Nada de IP |
| S6 | [Writeup de SirPhoebos](https://writeups.letsyouandhimfight.com/sirphoebos/cyberpunk-2020/) | Combat Sense; Interface (INT), Streetdeal e Authority (COOL); na K.0: os métodos de atributo (1d10 descartando 1 e 2; 9D10; pontos só para NPC, na leitura dele), os 10 pacotes de carreira, os 40 pontos, o *pickup*, a verba inicial (1D6/3; 5 ou 6, desempregado) e o **IP** (perícia nova 10; subir = nível atual × 10 × multiplicador de ×1 a ×4) — o IP só aqui |
| S7 | [Octopus Carnival — On Cyberpsychosis](https://bira.github.io/octopus-carnival/2023/10/23/on-cyberpsychosis.html) | Humanidade = EMP × 10; −1 EMP a cada 10 de Humanidade perdida |
| S8 | [Sistema Cyberpunk 2020 do Foundry VTT](https://github.com/2020-Fission/cyberpunk2020) — `lookups.js` e `role-skills.db` | Arma → perícia (escopeta → Rifle); atributo de 7 habilidades especiais; Jury Rig, Medical Tech e Combat Sense **sem** atributo; o custo de humanidade do implante, rolado uma vez (`item-sheet.js`, G.23); na K.0: a lista de perícias (`default-skills.db`, o campo `diffMod` todo em 1), Run/Leap/Carry/Lift (`actor.js`, o Leap para baixo), e a **armadura como peça** que cobre locais, com o EV de cada peça tirado do REF antes do ferimento. Não modela a Net |
| S9 | [Módulo cp2020-augmented do Foundry](https://github.com/ryno4ever16/cp2020-augmented) — `DamageApplicator.js` | Sequência de dano com página do livro: SP e BTM mínimo 1 (p. 98–99); cabeça dobra (p. 103) "sem dizer quando" |
| S10 | [FNFFAutoFire](https://github.com/krze/FNFFAutoFire) — calculadora de rajada | Aplica SP → BTM → ×2 na cabeça |
| S11 | [karridian.net — FNFF](https://www.karridian.net/cyb_fnff.html), **só a tabela proporcional** (K.2a) | Os degraus do bônus de camada (0–4 → +5 … 27+ → 0) e as camadas em pares de dentro para fora — que a página atribui à errata do livro, entrada na 2.01, e que batem número a número com o S9. **O resto da página é regra de casa** e segue descartado (abaixo) |
| S12 | [Cyberpunk Wiki (Fandom) — Cyberdeck](https://cyberpunk.fandom.com/wiki/Cyberdeck), **só a parte do 2020** (K.5a), que cita o livro básico de 1990 | O deck padrão (um módulo de 10 MU, Speed 0, Data Wall 2) e as melhorias: o segundo módulo (20 MU) por 5.000 eb, +1 de Speed por 2.000 eb (até 5), +1 de Data Wall por 1.000 eb (até 10). Os "slots" da mesma página são do **RED** (a nota dela cita o livro do RED) e ficam de fora |
| S13 | [Datafort do cybersmily](https://github.com/cybersmily/cybersmily_datafort) — `cp2020-cyberdeck.ts` e `nrdeckdata.json` (K.5a) | O deck padrão (10 MU, Data Wall 2, Code Gate 0, Speed 0) e o custo das melhorias, as mesmas do S12 (Data Wall acima de 2 a 1.000 eb, Speed a 2.000, a memória dobrada a 5.000); os **tipos de deck e o preço de cada um** — padrão 1.000 (500 usado), portátil 2.000, celular 4.000, embutido no cyberlimb 3.000 (celular 5.000), de combate 3.000 —, os mesmos do S8. **Os programas e os decks com nome dele vêm do *Rache Bartmoss' Brainware Blowout***, um suplemento: não servem de régua do livro básico. *(K.6a, 20/10/2026 — `cp2020roles.json` e `cp2020rolesext.json`, só as linhas marcadas `CP2020`: os **dez pacotes de carreira**, com a página de cada role (p. 6–22), e o **salário** por nível da habilidade dos mesmos nove roles do S3, célula a célula — e o do **Fixer**, que o S3 não tem)* |
| S14 | [`bytes_n_blades`](https://github.com/Hendo3/bytes_n_blades) — `scripts/build-netrunning-data.js` (K.5a) | As onze classes de programa do livro básico, separadas das dos suplementos, e o catálogo do básico com a página (p. 137–141): força, MU e custo. **O catálogo bate número a número com os programas do S13**, o que não prova independência — um pode ter vindo do outro (ver a K.5a) |

**Fontes descartadas, e por quê** — é daqui que vinham duas premissas erradas do plano:

| Fonte | Por que não serve |
|---|---|
| [karridian.net — FNFF](https://www.karridian.net/cyb_fnff.html) | Se declara **regra de casa** que substitui o dano do livro. É a origem provável do "−2/−4/−6 em todas as ações". *Exceção (K.2a, 18/10/2026): a tabela proporcional de armadura, que ela cita como do livro e o S9 confirma — é a S11* |
| [clon01 — combat revised](https://cyberpunk.clon01.net/htm/combat_revised.htm) | **Regra de casa** declarada ("distilled and interpreted"); inclusive tira o ×2 da cabeça |
| [datafortress2020 — combat rules](https://datafortress2020.com/combatrules.html) | **Regra de casa** declarada |
| [CyberMyth — NetRunning](https://www.icculus.org/~msphil/mythus/conversions/cybermyth/cm-netrun.html) | Conversão para o **Mythus**, outro sistema: o deck padrão de lá (Speed 10, Data Wall 8) é dele. **Era a "divergência no deck padrão" que a K.0 viu** — com o Mythus fora, as fontes do 2020 concordam (K.5a) |
| [NetRunner, de damoaust](https://github.com/damoaust/NetRunner) | Um jogo de Godot com regra própria (pontos de ação, "integridade" do deck) — adaptação, não ficha do 2020 |
| Qualquer material do **Cyberpunk RED** | Sistema diferente. O fumble que subtrai 1d10, a explosão única e o death save que piora a cada sucesso são **do RED** e estavam no código ou no plano |

> **Pesquisa de 26/09/2026, sobre as três inferências que a Fase C deixou:** a escopeta foi
> **confirmada** (S6 e S8). Jury Rig e a ordem da cabeça **o livro não resolve** — nas duas, a linha
> diz qual é a escolha do projeto e por quê. A ordem da cabeça foi decidida pelo dono no mesmo dia:
> **opção A**. O **RPG.net**, onde estava o principal debate sobre a
> cabeça, exige verificação anti-robô e não foi lido direto; o que se sabe dele veio de resumos de
> busca.

---

## Resolução de ações

| Regra | Livro | Código antes da Fase C | Status |
|---|---|---|---|
| Teste | `1d10 + atributo + perícia + modificadores` contra dificuldade | Igual | ✅ sem divergência |
| **10 no dado** | Rola de novo e soma; **cada 10 seguinte continua** (S1 `1d10!!`, S5) | Cliente encadeava; **servidor explodia uma vez** (regra do RED) | **C.1** — motor único encadeia, com teto |
| **1 no dado** | **Falha automática**; rola 1d10 na tabela de fumble da categoria (S5) | Os dois lados **subtraíam 1d10 do total** (regra do RED) | **C.1** — falha automática, dado de fumble exibido |
| Tabela de fumble (texto dos efeitos) | Uma por categoria de perícia | Não existe | **ADIAR** — o dado de fumble já sai rolado e auditável; o GM lê a tabela do livro. **Gatilho:** o GM pedir o efeito impresso na rolagem, ou uma sessão travar procurando a tabela |

## Local de impacto

| d10 | Livro (S2, S5) | Cliente antes | Servidor antes |
|---|---|---|---|
| 1 | Cabeça (dano ×2) | ✅ | ✅ |
| **2–4** | **Tronco** | ❌ **"Perna Esquerda"** — o `else` final engolia 2, 3 e 4 | ✅ |
| 5 | Braço direito | ✅ | ✅ |
| 6 | Braço esquerdo | ✅ | ✅ |
| 7–8 | Perna direita | ✅ | ✅ |
| 9–0 | Perna esquerda | ✅ | ✅ |

**C.1** — uma tabela só (`HIT_LOCATIONS`), usada pelos dois lados.

## Tipo corporal (BTM)

| BODY | Tipo | BTM (livro) | Código antes (BODY + REF) |
|---|---|---|---|
| 2 | Muito fraco | 0 | dependia do REF, de +5 a −2 |
| 3–4 | Fraco | −1 | idem |
| 5–7 | Médio | −2 | idem |
| 8–9 | Forte | −3 | idem |
| 10 | Muito forte | −4 | idem |
| 11+ | Sobre-humano | −5 | idem |

Save = BODY. O BTM reduz o dano que passou da armadura e **nunca o leva abaixo de 1** (S5) — isso é
da Fase D. **C.2** — `btmFromBody`, rótulo do `StatBlock` e PRD corrigidos.

## Ataque

| Regra | Livro | Código antes | Status |
|---|---|---|---|
| Rolagem de ataque | `1d10 + REF + perícia da arma + WA + modificadores` | Servidor: sem perícia. **Cliente: passava o WA no lugar da perícia** | **C.3** |
| Perícia por tipo de arma | Pistola → Handgun; SMG → Submachinegun; Rifle → Rifle; Pesada → Heavy Weapons; Branca → Melee; Arco → Archery | Não existia mapa | **C.3** (`WEAPON_SKILL_BY_TYPE`) |
| Escopeta | **Rifle** — não existe perícia de escopeta; o capítulo de armas manda usar Rifle | — | **C.3 — confirmado em 26/09** (S6, S8) |
| Modificador de situação do GM | Entra na rolagem | `combatModifier` sem leitor | **C.4** — entra em ataque e perícia, visível no detalhe |
| Dificuldade por alcance | Queima-roupa 10, curto 15, médio 20, longo 25, extremo 30 | Não existe | **D.3** — `RANGE_BANDS`; ver [o que a Fase D conferiu](#o-que-a-fase-d-conferiu) |

## Ferimentos

A trilha tem 10 caixas de 4 pontos: Leve, Sério, Crítico, Mortal 0–6. No NetSheet, `woundLevel`
0 é ileso e 1–10 são essas caixas.

| `woundLevel` | Nível | Efeito no livro (S1, S4) | Stun (S2) | Death (S5) | Código antes |
|---|---|---|---|---|---|
| 0 | Ileso | — | — | — | — |
| 1 | Leve | nenhum | BODY −0 | — | nenhum ✅ |
| 2 | Sério | **REF −2** | BODY −1 | — | REF −2 **e MA −2** |
| 3 | Crítico | **REF, INT, COOL ÷2** (para cima) | BODY −2 | — | REF −2, MA −2 |
| 4 | Mortal 0 | **REF, INT, COOL ÷3** (para cima) | BODY −3 | BODY −0 | REF −4, MA −4, "consciência 50%" |
| 5 | Mortal 1 | idem | BODY −4 | BODY −1 | REF −4, MA −4 |
| 6 | Mortal 2 | idem | BODY −5 | BODY −2 | REF −5, MA −5 |
| 7 | Mortal 3 | idem | BODY −6 | BODY −3 | REF −5, MA −5 |
| 8 | Mortal 4 | idem | BODY −7 | BODY −4 | REF −6, MA −6, "morte provável" |
| 9 | Mortal 5 | idem | BODY −8 | BODY −5 | REF −6, MA −6 |
| 10 | Mortal 6 | idem | BODY −9 | BODY −6 | tratado como **morto** — death save desligado |

- Os efeitos **não se somam** entre níveis: Crítico é "metade", não "metade e mais −2" (S1).
- **Ferimento não penaliza MA.** A penalidade de MA e as duas notas eram invenção.
- **Stun save:** a cada dano sofrido, `1d10 ≤ BODY − modificador`. Falhou, está fora de ação.
- **Death save:** em nível Mortal, **a cada turno**, `1d10 ≤ BODY − nível Mortal`, até morrer ou ser
  estabilizado. Não há acúmulo por turno — isso é do RED.
- **Morte:** falhar um death save, ou dano além da última caixa. Mortal 6 ainda está vivo.

**C.5** (efeitos), **C.7** (stun e death save). A automação na virada de turno é a D.5.

## Atributos correntes

`currentStats` = atributo base → **mais o cromo instalado que soma atributo** (K.2e) → **REF menos o EV da
armadura vestida** (K.2c) → **−1 EMP a cada 10 de Humanidade perdida** (S7) → efeito do ferimento. É o que
**toda** rolagem lê — e o BTM do dano, o Carry, o Lift e os saves leem o BODY daqui. **C.6.**

| Fonte de modificação | Status |
|---|---|
| Humanidade → EMP | **C.6** — soma o `actualHL` de **todo** implante da ficha, instalado ou não, igual ao painel de cromo. O livro cobra a humanidade na instalação; o modelo não distingue "nunca instalado" de "removido". **ADIAR** — gatilho: um jogador usar o botão de desinstalar para planejar compra, e o EMP cair por cromo que ele não tem |
| **Perda de Humanidade de cada implante** *(G.23, 11/10/2026)* | O implante tem um **custo de humanidade** — um número ou uma fórmula de dados (`2d6`, `1d6/2`, `0.5`, `3d6`…) —, **rolado uma vez** ao instalar; o resultado é a perda **daquele** implante, e a ficha soma a de cada um. **S8:** o `humanityCost` do item, e um botão que rola a fórmula (ou usa o número) e guarda em `humanityLoss` (`module/item/item-sheet.js`, conferido de novo em 11/10). **S1:** a perda é uma coluna por implante (HL), somada. Nenhuma das duas sorteia um valor que ignore o item. **Código antes:** `2 + round(random × 6)` — de 2 a 8, qualquer que fosse a fórmula digitada. **G.3g** — `rollHumanityLoss` (`src/rules/character.ts`), com o RNG injetado: número inteiro vale o número; `NdM±X` rola pelo parser do dano; o que ele não lê (`1d6/2`, `0.5`) **o jogador digita**, como na S1. A divisão no parser segue o gatilho da [ADR 0004](./adr/0004-dice-roller.md). *Cuidado:* a busca aberta devolve o **RED** (custo fixo, teto de humanidade) — nada daqui vem dele |
| Perda de Humanidade **fracionária** *(revisão da G.3, 11/10/2026)* | A S8 guarda a perda como veio: `0.5` vale meio ponto, e `1d6/2` avalia **sem arredondar** (um 5 dá 2,5). O NetSheet guarda a perda **inteira** — o `actualHL` é validado como inteiro no `sheetSchema` —, e o campo pede ao jogador que arredonde. A diferença é de no máximo meio ponto por implante, e o EMP só cai a cada 10. **ADIAR** — gatilho: um implante de custo fracionário numa ficha de verdade, ou a soma das frações mudar o EMP de alguém. Aí o `actualHL` passa a aceitar meio ponto: é **formato persistido**, e exige a certeza toda (a regra de arredondamento do livro é pergunta em aberto — nenhuma das duas fontes a dá) |
| Ferimento → REF/INT/COOL | **C.6** |
| Cromo que soma atributo (ex.: lace muscular) | ~~**ADIAR** — `CyberwareItem` não tem campo de atributo. **Gatilho:** Fase K modelar o efeito de implante (K.2)~~ **K.2e (18/10/2026):** o implante guarda `statBonus` (atributo e quanto soma); instalado, soma antes do EV, e o BTM melhora com o BODY (o Lace: BODY +2 — S6, S8). As variantes dos Chromebooks ("não no BTM", "só para Lift") ficam de fora: são suplemento |
| EV da armadura → REF | ~~**ADIAR para a K** (RUL-11). A armadura padrão é modelada **uma peça por localização**; somar o EV por peça contaria a mesma jaqueta várias vezes. Precisa de modelo de peça antes~~ **K.2c (18/10/2026):** a peça cobre locais desde a K.2b, e o EV de cada peça vestida sai do REF, uma vez por peça (S6, S8), **antes** do ferimento (só o S8 — escolha do projeto, pergunta aberta). A iniciativa, que lê o REF corrente, sente o EV também |

## Habilidades especiais

| Role | Habilidade | Atributo | Evidência | Código antes |
|---|---|---|---|---|
| Solo | Combat Sense | **não se rola sozinha**: soma em Awareness/Notice (INT) e na iniciativa | S1, S3, S5, S6 | REF |
| Netrunner | Interface | INT | S1, S6 | INT ✅ |
| Tech | Jury Rig | TECH | **o livro não diz** — S6 lê a descrição e registra que ela não traz atributo; S1 e S8 deixam em branco. **TECH é escolha do projeto** (abaixo) | EMP |
| Medtechie | Medical Tech | TECH | S1, S3 | EMP |
| Media | Credibility | INT | S1, S3 | EMP |
| Cop | Authority | COOL | S1, S3, S6 | EMP |
| Corp | Resources | INT | S1 | EMP |
| Fixer | Streetdeal | COOL | S1, S3, S6 | EMP |
| Rockerboy | Charismatic Leadership | COOL | S1 | EMP |
| Nomad | Family | INT | S1, S3 | EMP |

**C.8** — o atributo mora em `OFFICIAL_ROLES`. O ternário acertava 1 de 10.

**S8 confere 7 das 10 linhas exatamente como estão** (Interface, Credibility, Resources e Family em
INT; Authority, Streetdeal e Charismatic Leadership em COOL). As três que ele deixa sem atributo são
Combat Sense (que não se rola sozinha), Medical Tech (TECH por S1 e S3) e Jury Rig.

**Jury Rig — por que TECH, se o livro não diz.** As alternativas são rolar **sem atributo** (só
1d10 + nível, que é o que S1 e S8 fazem por omissão) ou escolher um. Sem atributo, um Techie de nível
6 rolaria como um personagem comum sem treino rola uma perícia — a habilidade que define o role
ficaria mais fraca que uma perícia qualquer. E Jury Rig é um conserto: todo conserto no 2020 é
perícia de TECH (Basic Tech, Electronics, CyberTech, Weaponsmith). **Gatilho para rever:** duas
fontes independentes darem um atributo diferente, ou a mesa sentir o Techie forte demais. *(Era "o
dono achar no livro físico" — o dono não tem o livro, decisão 11.)*

## Dano — a ordem do pipeline (para a Fase D)

O livro dá as duas regras e **não diz em que ordem**: a sequência de dano (SP, depois BTM com mínimo
de 1) está nas p. 98–99, e "acerto na cabeça dobra o dano" aparece depois, na p. 103, sem dizer
quando (S9, que cita as páginas e registra a omissão). **Nenhum FAQ oficial resolveu** — o debate do
RPG.net trata como questão em aberto, e um moderador conclui que a escolha é da mesa.

> **Correção de 26/09/2026.** A versão anterior desta seção dizia que "a leitura mais comum" era
> dobrar antes do BTM. **Estava errado, e sem fonte:** as duas implementações encontradas (S9 e S10)
> e o argumento registrado no debate aplicam **o BTM antes de dobrar**. Mesmo defeito que a
> auditoria de 03/09 apontou no plano: afirmação escrita sem verificar.

As duas opções, para 10 pontos que passaram da armadura contra BTM −3:

| Opção | Ordem | Exemplo | Mínimo na cabeça |
|---|---|---|---|
| **A** (recomendada) | SP → BTM (mín. 1) → ×2 | (10 − 3) × 2 = **14** | 2 |
| **B** (a do desenho original) | SP → ×2 → BTM (mín. 1) | 10 × 2 − 3 = **17** | 1 |

**B é sempre mais letal, por exatamente o valor do BTM** (0 a 5 pontos). Para personagem de BODY 2
(BTM 0) as duas dão o mesmo; para BODY 11+ (BTM −5), B tira 5 pontos a mais — mais de uma caixa da
trilha.

**Por que A:** (1) segue a ordem em que o livro apresenta as regras — o BTM faz parte da sequência de
dano, o ×2 vem depois, como efeito do local; (2) é a que as duas implementações de fãs adotaram, uma
delas citando as páginas; (3) o BTM representa a resistência do corpo a *qualquer* ferimento que
passou da armadura, e a cabeça dobra o **ferimento** — o que de fato chegou ao corpo. **Por que
alguém escolheria B:** combate mais letal, e o texto não proíbe.

**Decidido pelo dono em 26/09/2026: opção A** (decisão 6 do plano). O
[diagrama](./ARQUITETURA.md#pipeline-de-dano-fnff) foi redesenhado com ela, e a D.1 implementa assim.
**Gatilho para rever:** uma fonte que mostre uma ordem explícita no livro, ou um exemplo resolvido
dele que só feche com B — uma errata ou FAQ oficial basta sozinha. *(Era "o dono achar no livro
físico" — o dono não tem o livro, decisão 11.)*

Também da Fase D: **penetração escalonada** (cada acerto que passa reduz o SP daquele ponto em 1) e
**perda de membro** (mais de 8 pontos num membro de uma vez; na cabeça, morte).

## O que a Fase D conferiu

Verificação da **D.0** (28/09/2026), com as decisões do dono (decisão 7 do plano).

| Regra | Livro | Fontes | Status |
|---|---|---|---|
| Dano conta **pontos** | 4 pontos por caixa, 40 no total; o resto de uma caixa fica marcado | Trilha acima; S9 escreve pontos | **D.1** — a ficha guarda pontos, o nível é derivado (decisão 7b) |
| Perda de membro | Membro com **mais de 8** pontos num acerto, depois de todos os modificadores: decepado ou inutilizado | S5, S9 | **D.1** — aviso no chat |
| Death save ao perder membro | Imediato, em Mortal 0 | **só S9** | **D.1 como aviso**, sem rolagem automática. **Gatilho:** uma segunda fonte independente confirmar (era "o dono confirmar no livro" — decisão 11) — [pergunta aberta](#perguntas-para-o-livro) |
| Cabeça com mais de 8 | Morte instantânea (o ×2 já aplicado) | S5, S9 | **D.1** — estado Morto |
| Iniciativa | `1d10` **aberto** (o 10 explode) + REF **corrente** (com o ferimento) + Combat Sense do Solo. O 1 **não** é fumble — iniciativa não é teste | S1 (`1d10!!+REF+Combat_Sense`), S8 (`1d10x10 + ref.total + CombatSense`, com o `ref.total` já ferido), S5 | **D.4** — `sheetInitiativeRoll` |
| Empate na iniciativa | O livro não dá desempate | Nenhuma fonte trata | Fica a ordem da rolagem. **ADIAR** — gatilho: a mesa pedir um desempate (ex.: maior REF) |
| Dificuldade por alcance | Queima-roupa 10 (até 1 m); curto 15 (¼ do alcance); médio 20 (½); longo 25 (alcance); extremo 30 (2×) — p. 99 | **S8** (`lookups.js`) e **S9** (`rangefinding.js`, cita a p. 99) dão as cinco; **S1** confirma as quatro de cima | **D.3** — `RANGE_BANDS` no `tables.ts` |
| O ataque acerta com | Total **igual ou maior** que a dificuldade | S8 (`attackRoll.total >= DC`), S9 | **D.3** — `attackHits` |
| Fumble no ataque | Erro, mesmo com total alto | S9; e a regra do 1 (C.1) | **D.3** |
| Queima-roupa dá dano máximo | Com arma de fogo | **Uma linhagem só**: o S9 descreve o S8 fazendo isso, mas o arquivo do S8 lido não tem; um resumo de busca repete | **ADIAR** — gatilho: uma fonte de fora da linhagem S8/S9 confirmar (era "o dono confirmar no livro" — decisão 11) — [pergunta aberta](#perguntas-para-o-livro) |
| Corpo a corpo | Teste **resistido**: o defensor rola (Dodge, Melee…) | Conhecido; não conferido em fonte nesta fase | **D.3 parcial:** o GM informa o total do defensor como dificuldade livre. Rolagem resistida automática: **ADIAR** — gatilho: a mesa usar corpo a corpo com frequência |
| Penetração escalonada | Cada acerto que fura a armadura tira 1 do SP daquele ponto | Um resumo de busca a chama de **opcional** ("One option is…"), página de origem não lida; S9 a implementa **atrás de uma chave** | **ADIAR** (decisão 7d). **Gatilho:** a mesa pedir, ou uma luta longa em que a armadura que nunca gasta incomode |
| Cobertura entre atirador e alvo | SP da cobertura contra o dano | S5 diz só "subtraído do dano"; S9 **combina** cobertura e armadura pela tabela proporcional (p. 99) | **ADIAR** (decisão 7c: token sem ficha não recebe dano). **Gatilho:** o GM precisar da cobertura no cálculo, com a regra de combinação conferida em duas fontes |
| Death save no Mortal | **Logo depois do dano** que deixa em Mortal (antes do stun) e **a cada turno** depois, até morrer ou ser estabilizado. Alvo ≤ 0 é morte certa | S5 ("and then again every round"), S9 (`save-rolls.js`, p. 99; uma pergunta por aplicação de dano, e a cadência por turno) | **D.5** |
| Estabilização | Estabilizado não rola death save; **dano novo desfaz** | S9 (p. 105), S5 ("até morrer ou ser estabilizado") | **D.5** — o GM marca; o teste de First Aid/Medical Tech que estabiliza é rolado à parte. Rolagem de estabilização automática: **ADIAR** — gatilho: o GM pedir |
| Estado atordoado | Falhou o stun save, fora de ação até passar num novo | Conferido na C.7 | O stun save rola sozinho com o dano (D.1); o **estado** não é guardado. **ADIAR** — gatilho: a mesa esquecer quem está atordoado |

## O que fica para a Fase K

*(Refeita na K.0, 18/10/2026, com as fontes da tabela acima e a decisão 13 do plano. Os números da criação —
a verba por role, os pacotes — vão para o `tables.ts` na K.6a, como dado; aqui fica a regra com as nossas
palavras.)*

| Regra | O que as fontes dizem | Fontes | Código hoje | Vai para |
|---|---|---|---|---|
| Movimento | Run = MA × 3 m; Leap = Run ÷ 4 (o S8 arredonda para baixo). Walk não existe | S1, S8 | Run ✅; **Walk inventado**; Leap ausente | K.7c (RUL-11) — feito: `RUN_METERS_PER_MA`, `LEAP_RUN_DIVISOR`; o Leap na ficha com o MA corrente, como o Run, e o Walk fora |
| Carga | Carry = BODY × 10 kg; Lift = BODY × 40 kg, com o BODY do cromo (o S6 faz a conta com o Lace). **Nenhuma fonte penaliza o peso carregado** — o S8 soma o peso equipado e não penaliza, e o S6 diz que o livro em geral não conta peso | S1, S6, S8 | Ausentes | K.2d (decisão 13: sem pena por peso) — `CARRY_KG_PER_BODY`, `LIFT_KG_PER_BODY` |
| EV da armadura | Cada peça vestida tira o EV dela do REF, e o EV **soma** peça por peça (no livro: jaqueta leve 0, média 1, pesada 2, colete flak 1, MetalGear 2 — S8). **A ordem contra o ferimento só o S8 dá:** o EV sai **antes** do efeito do ferimento. É a escolha do projeto (como o Jury Rig): o EV muda o atributo corrente, como o cromo, e o ferimento age sobre o corrente | S6, S8 (a ordem: S8 só) | `ev` sem leitor; uma peça por local | K.2b–c |
| Camadas de armadura | Duas peças no mesmo local não somam: vale o maior SP mais um bônus pela diferença (0–4 → +5, 5–8 → +4, 9–14 → +3, 15–20 → +2, 21–26 → +1, 27+ → 0); três ou mais, em pares de dentro para fora. O S8 só soma (diverge). **O S9 escolhe a melhor ordem** entre as camadas; o S11, de dentro para fora — no NetSheet, a ordem da lista é de dentro para fora. No máximo **três camadas, uma rígida** (S6, S9): **ADIAR**, na Q. **O EV extra por camada** diverge — o S6 soma 1 por camada (três → 3), o S9 cobra 0, 1 e 2 —: pergunta aberta, na Q | S9 (p. 99), S11; o S6 confirma o mecanismo e o teto de +5 | Uma peça por local | K.2b — `ARMOR_LAYER_BONUS` |
| Perícias | INT ganha Accounting, Anthropology, Gamble, Shadow/Track e Wilderness Survival; COOL, Interrogation; TECH, Cyberdeck Design e Pharmaceuticals. "Social" é só de EMP. **"Psychology" não existe**. *(K.7a, 20/10/2026 — relidos a lista de pickup do S3, p. 4, e o `default-skills.db` do S8:)* as duas dão **quatro perícias de piloto** — Gyro, Fixed Wing, Dirigible e Vectored Thrust —, não uma "à escolha". As **artes marciais** o S8 dá por estilo (onze), e o S3 como uma só; o estilo carrega bônus de combate, que é outra regra — fica "(escolha)", e o bônus por estilo vai à Q. **Expert** e **Language** o S3 tem e o S8 não: ficam, como estavam | S2, S3, S8 | "Social" e "Psychology" em INT; as oito faltam; um "Pilot (escolha)" | K.7a (RUL-12) — feito: o `SKILL_TABLES` pelas duas, e as quatro perícias dos pacotes da K.6 que faltavam entraram |
| Atributos na criação | De 2 a 10. Três métodos: o **9D10 num bolo** (S5, S6); o **bolo que o Mestre define**, o cinemático (S5; o S3 dá 65 fixos; o S6 lê os pontos como coisa de NPC); e **1d10 por atributo** — o S5 rerrola o 1, o S6 descarta o 1 e o 2. *(K.6a:)* o bolo do Mestre fica entre 18 e 90, o que nove atributos de 2 a 10 comportam — **escolha do projeto**, como o total de um 9D10 abaixo de 18 (uma chance em ~10 mil): cada atributo segue no 2, e a sobra aparece | S3, S5, S6 | Sem orçamento | K.6a: os dois primeiros (decisão 13) — `CREATION_STAT_MIN/MAX`, `STAT_POOL_DICE`; o rápido, na Q |
| Perícias na criação | 40 pontos nas 10 perícias de carreira do role, a habilidade especial entre elas, até 10 cada; *pickup* = REF + INT, fora das de carreira e da habilidade. *(K.6a:)* o REF + INT é o da criação — o S3 manda somar os dois antes de gastar —, e o teto de 10 vale também no *pickup* (o S3 o dá só na carreira; 10 é o teto de perícia da ficha) | S3, S6; o S5 confirma os 40 e o REF + INT | Sem orçamento | K.6a (RUL-10) — `CAREER_SKILL_POINTS`, `CREATION_SKILL_MAX`, `PICKUP_STATS` |
| Pacotes de carreira | As 10 listas, e o Techie escolhe três perícias de TECH, entre Gyro Tech, Aero Tech, Weaponsmith e Electronic Security; o Solo, Brawling ou Martial Art. O "Weapons Tech" do Solo no S3 e no S6 é a Weaponsmith do S13: a única perícia de TECH de armas nas listas (S2, S3, S8). Quatro perícias dos pacotes — Wilderness Survival, Cyberdeck Design, Pharmaceuticals e Interrogation — ainda não estão no `SKILL_TABLES`: entram na K.7a | S3, S6, S13 — iguais nos dez | Não existem | K.6a — `CAREER_PACKAGES` |
| Verba inicial | Salário mensal por role e nível da habilidade especial (do 1 ao 5 numa coluna, do 6 ao 10 uma a uma), multiplicado por 1D6/3 — os meses de emprego. *(K.6a:)* **a tabela fecha em duas fontes para nove roles** — o S3 e o S13, célula a célula; o S6 confirma o Solo (1–5, 7 e 10) e o Nomad (10). **O Fixer, não:** o S3 não o traz, e a linha só o S13 dá. Sem duas fontes, a verba do Fixer é do Mestre, como o S3 deixa todo dinheiro além da tabela. A fração do 1D6/3 nenhuma fonte arredonda: **para baixo** é escolha do projeto, a regra que o S3 dá para a Humanidade. O nível 0 da habilidade cai na coluna 1–5 (escolha do projeto: a tabela começa no 1) | S3, S13 (S6). "5 ou 6 no dado: desempregado" — **só o S6** | `eurodollars` livre | K.6a — `STARTING_SALARY`, `STARTING_FUNDS_DIE` |
| Evolução por IP | Perícia nova custa 10 IP; subir custa o nível atual × 10 × o multiplicador da perícia (×1 a ×4) | **S6 só**; o S8 tem o campo do multiplicador, todo em 1 | Não existe | Q (decisão 13) |
| Cromo que soma atributo | O implante soma ao atributo: o Muscle and Bone Lace dá **BODY +2**, e com ele o BTM melhora (o S6 leva um BODY 10 a 12 e o BTM a −5). As variantes dos Chromebooks ("+1 BODY, mas não no BTM", "só para Lift") ficam de fora: são suplemento | S6, S8 (o S8 guarda o efeito só como texto) | `CyberwareItem` sem campo | K.2e |
| Deck do netrunner | O deck guarda MU, Speed, Data Wall e Code Gate. **O padrão:** 10 MU, Speed 0, Data Wall 2 (S6, S12, S13); Code Gate 0 só o S13 dá. **As melhorias:** o segundo módulo de memória leva a 20 MU por 5.000 eb, cada ponto de Speed custa 2.000 eb e cada ponto de Data Wall acima de 2, 1.000 eb (S12, S13). **O teto das melhorias diverge:** Speed até 5 e Data Wall até 10 no S12, sem teto no S6 — aberto, na Q; no NetSheet, só o grampo do absurdo | S6, S12, S13 | Nada | K.5b — `DECK_BASE`, `DECK_UPGRADE_EB` |
| Tipos de deck | Padrão 1.000 eb (500 usado), portátil 2.000, celular 4.000, embutido no cyberlimb 3.000 (celular 5.000), de combate 3.000. O S8 cita o livro básico, p. 133–134 (e p. 90–91 para o do cyberlimb, que custa 1 de Humanidade e exige o cyberlimb); o S1 tem os mesmos cinco tipos, sem preço; o S6 confirma o celular, 4.000 | S8, S13 (S1, S6) | Nada | K.5b — `DECK_CHASSIS` |
| Programas | Cada um tem nome, classe, força, MU (de 1 a 6, no S6) e custo (S1, S13, S14). **As onze classes do livro:** Intrusion, Decryption, Detection/Alarm, Anti-System, Evasion/Stealth, Protection, Anti-IC, Anti-Personnel, Controller, Utility e Demon (S6, S14). O S14 e o *Brainware Blowout* chamam a Anti-IC de "Anti-Program"; o S1 não tem a classe e tem "Shield" e "Other". Os programas carregados ocupam a MU do deck (S6, S13). **O catálogo com os números:** só o S14 e o S13, que batem e podem não ser independentes — aberto, na Q; no NetSheet, o programa é digitado, como a arma | S1, S6, S13, S14 | Nada | K.5b — `PROGRAM_CLASSES` |
| O netrunner no personagem | A perícia **Interface** (INT), a habilidade especial do Netrunner (S1, S6); para entrar na Net, os *interface plugs* e o *link* do deck (S6) — o caminho sem cromo custa −2 de REF no S6, e o S8 dá −2 na Interface: aberto. **Iniciativa na Net:** 1d10 + REF + Speed do deck (S1, S6) | S1, S6 (S8) | A Interface existe | K.5c mostra a iniciativa; a Net jogável é ADIAR (decisão 9) |

**A premissa que caiu na K.0:** o orçamento de criação **não fecha o "trapaceiro plausível"** do portão da B
no servidor. Ele só vale no dia da criação: depois, o IP e o cromo sobem os números legitimamente. A K.6c o
deixa à vista do GM.

## Perguntas para o livro

*(Criada em 30/09/2026, quando o dono disse ter o livro físico — **corrigido no mesmo dia: ele não
tem** (decisão 11 do plano).)* O que as fontes secundárias não fecharam. **Como fechar uma
pergunta:** duas fontes independentes concordando, cada uma na [tabela de
fontes](#fontes-e-o-quanto-confiar-nelas) (S11 em diante), a regra com as nossas palavras e a página
que a fonte cita — nunca o texto do livro (o repositório é público). A sessão que fechar registra
aqui e na linha da regra; **se a resposta divergir do código, é bug** e entra na fase corrente, com
teste derivado da tabela (a disciplina da Fase C). **Se a pergunta bloquear trabalho e as fontes não
fecharem,** ela vai ao dono como decisão, com a pesquisa e uma opção recomendada (como a decisão 6) —
e é o gatilho de comprar o PDF oficial (decisão 11).

**Já implementadas — a resposta pode mudar o jogo de hoje:**

- [ ] **Death save ao perder membro.** É imediato, em Mortal 0? Só o S9 diz isso. Hoje a perda de
      membro vira **aviso no chat**, sem rolagem ([linha](#o-que-a-fase-d-conferiu)).
- [ ] **Queima-roupa com arma de fogo dá dano máximo?** Uma linhagem de fonte só. Hoje **não** dá.
- [ ] **Penetração escalonada** (o acerto que fura a armadura tira 1 do SP daquele ponto): é regra do
      núcleo ou opcional? A decisão 7d a adiou supondo opcional — se for do núcleo, o ADIAR vira bug.
- [ ] **Corpo a corpo:** o defensor rola o quê contra o ataque? Hoje o GM informa o total do defensor
      como dificuldade livre.
- [ ] **Cabeça — a ordem entre ×2 e BTM.** A decisão 6 escolheu armadura → BTM → ×2 porque as fontes
      dizem que o livro não traz a ordem (p. 103, segundo o S9). Um exemplo resolvido no livro com
      outra ordem é o motivo novo que reabre a decisão; na falta dele, ela fica.
- [ ] **Jury Rig:** a descrição dá atributo? Hoje é TECH, escolha do projeto
      ([por quê](#habilidades-especiais)).

**Para a Fase K — respondidas antes de a K.0 estimar:** *(K.0, 18/10/2026 — o detalhe na
[seção da K](#o-que-fica-para-a-fase-k).)*

- [ ] **Criação (K.6):** os métodos de gerar atributos que o livro oferece; os 40 pontos de perícia de
      carreira; REF + INT de perícias livres; a verba inicial.
      *Fechada em parte:* os 40 pontos, o REF + INT, os pacotes, a verba e dois métodos (o 9D10 e o bolo do
      Mestre) em duas fontes. **Abertas:** o que o método rápido rerrola (o 1, ou o 1 e o 2); se há totais
      fixos para o bolo do Mestre (só o S3 dá um, 65); e o "5 ou 6, desempregado" da verba (só o S6).
      *(20/10/2026, K.6a — os pacotes fecharam em três fontes (S3, S6, S13), e a tabela de salário em duas (S3,
      S13) para nove roles. **Abriu uma:** o salário do Fixer, que só o S13 dá — abaixo.)*
- [ ] **O salário do Fixer:** a tabela do S3 não tem o Fixer, e o S13 dá 1.500, 3.000, 5.000, 7.000, 8.000 e
      10.000 eb (nível 1–5 e do 6 ao 10). Hoje a verba do Fixer é do Mestre, digitada no assistente.
- [ ] **A fração do 1D6/3 e o nível 0 da habilidade:** nenhuma fonte arredonda os meses, nem dá o salário
      abaixo do nível 1. Hoje, para baixo e a coluna 1–5 — escolha do projeto.
- [ ] **Evolução por IP (K.6):** o custo de subir um nível de perícia, com o multiplicador.
      *Uma fonte só (S6), e o multiplicador de cada perícia em nenhuma — ADIAR na Q (decisão 13).*
- [x] **Carga e movimento (K.2, K.7):** Carry, Lift e Leap; a penalidade de EV da armadura no REF.
      *Carry, Lift e Leap fechados (S1, S8). O EV no REF só no S8, e a ordem contra o ferimento também — a
      K.2a busca a segunda.* *(18/10/2026, K.2a — o EV no REF fechou com o S6. A ordem contra o ferimento
      segue só no S8: escolha do projeto, aberta abaixo.)*
- [ ] **O EV antes ou depois do efeito do ferimento?** Só o S8 dá a ordem (antes). Hoje é antes — escolha
      do projeto. Com REF 9, EV 2 e Crítico (÷2): antes, 4; depois, 3.
- [ ] **O EV extra por camada de armadura:** o S6 soma 1 por camada; o S9 cobra 0 na primeira, 1 na segunda e
      2 na terceira. Hoje não há EV extra (ADIAR, na Q).
- [x] **Perícias (K.7):** conferir a lista por atributo, com as oito que faltam.
      *Fechada em 18/10 (S2, S3, S8): as oito confirmadas, e a "Psychology" de INT não existe.*
- [x] **O netrunner na ficha (K.5, decisão 9):** o que a ficha precisa guardar — deck, programas, MU e
      o que mais o livro amarra ao personagem.
      *Aberta: as fontes de fã divergem no deck padrão. É a K.5a.*
      *(20/10/2026, K.5a — **fechada para a ficha:** o deck padrão, os tipos e as melhorias em duas fontes; a
      "divergência" era a conversão para o Mythus. As três de baixo ficaram abertas, e nenhuma trava a K.5: o
      gatilho do PDF não disparou.)*
- [ ] **O teto das melhorias do deck:** Speed até 5 e Data Wall até 10 (S12), ou sem teto (S6)? Hoje, só o
      grampo do absurdo (Speed 10, Data Wall e Code Gate 40).
- [ ] **O catálogo de programas do livro básico** (força, MU e custo de cada um): o S14 e o S13 batem, mas o S13
      tira os números do *Brainware Blowout* e o S14 pode ter vindo dele. Hoje o programa é digitado.
- [ ] **Entrar na Net sem cromo:** −2 de REF (S6) ou −2 na Interface (S8)? Hoje a ficha não modela.
