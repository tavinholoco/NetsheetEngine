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
| Dano → ferimento, penetração escalonada, perda de membro, dificuldade por alcance | Fase D | É o loop de combate |
| Combat Sense na iniciativa | D.4 | A iniciativa automática nasce lá |
| Texto das tabelas de fumble | ADIAR | O dado já sai rolado; o GM lê no livro |
| Cromo que soma atributo; EV da armadura no REF | Fase K | O modelo de dados não tem o campo |
| Humanidade de implante "desinstalado" | ADIAR | O modelo não distingue nunca-instalado de removido |
| Walk (não existe), Leap, Carry, Lift; perícias faltando; criação com orçamento | Fase K | RUL-10, 11, 12 |
| Habilidade especial rolável **na mesa** | Pista da Fase H | O tipo `skill` procura em `sheet.skills` |

---

## Fontes, e o quanto confiar nelas

O livro de 1990 não está no repositório. A conferência usou **fontes secundárias independentes**, e
uma regra só foi aceita quando **duas ou mais concordam**. Onde só há inferência, a linha diz.

| # | Fonte | O que ela sustenta |
|---|---|---|
| S1 | [Ficha do Roll20 para CP2020](https://github.com/Roll20/roll20-character-sheets/blob/master/Cyberpunk%202020/Cyberpunk2020.html) — fórmulas executáveis | Efeito de ferimento (÷2, ÷3, −2), atributo de cada Special Ability, `1d10!!`, Run/Leap/Carry/Lift |
| S2 | [Ficha cyberpunk.co.uk v1.1](https://www.cyberpunk.co.uk/assets/pdf/cp2020v1.1.pdf) — auxílio de jogo não oficial | Modificador de stun por nível (0 a −9), tabela de local de impacto, lista de perícias por atributo |
| S3 | [Character Generation Walkthrough](https://www.salroth.com/cp2020/files/CyberPunk2020.pdf) | Atributo das Special Abilities, efeito de Combat Sense, listas de perícias |
| S4 | [GameRant — dicas para o CP2020](https://gamerant.com/cyberpunk-2077-tabletop-2020-pro-tips/) | Efeito de ferimento (Sério −2 REF; Crítico ½; Mortal ⅓), stun e death save |
| S5 | [2d4chan — Cyberpunk 2020](https://2d4chan.org/mediawiki/index.php/Cyberpunk_2020) | Resolução, 10 encadeia, 1 é falha + tabela de fumble, saves, BTM nunca zera o dano, iniciativa |
| S6 | [Writeup de SirPhoebos](https://writeups.letsyouandhimfight.com/sirphoebos/cyberpunk-2020/) | Combat Sense; Interface (INT), Streetdeal e Authority (COOL) |
| S7 | [Octopus Carnival — On Cyberpsychosis](https://bira.github.io/octopus-carnival/2023/10/23/on-cyberpsychosis.html) | Humanidade = EMP × 10; −1 EMP a cada 10 de Humanidade perdida |
| S8 | [Sistema Cyberpunk 2020 do Foundry VTT](https://github.com/2020-Fission/cyberpunk2020) — `lookups.js` e `role-skills.db` | Arma → perícia (escopeta → Rifle); atributo de 7 habilidades especiais; Jury Rig, Medical Tech e Combat Sense **sem** atributo |
| S9 | [Módulo cp2020-augmented do Foundry](https://github.com/ryno4ever16/cp2020-augmented) — `DamageApplicator.js` | Sequência de dano com página do livro: SP e BTM mínimo 1 (p. 98–99); cabeça dobra (p. 103) "sem dizer quando" |
| S10 | [FNFFAutoFire](https://github.com/krze/FNFFAutoFire) — calculadora de rajada | Aplica SP → BTM → ×2 na cabeça |

**Fontes descartadas, e por quê** — é daqui que vinham duas premissas erradas do plano:

| Fonte | Por que não serve |
|---|---|
| [karridian.net — FNFF](https://www.karridian.net/cyb_fnff.html) | Se declara **regra de casa** que substitui o dano do livro. É a origem provável do "−2/−4/−6 em todas as ações" |
| [clon01 — combat revised](https://cyberpunk.clon01.net/htm/combat_revised.htm) | **Regra de casa** declarada ("distilled and interpreted"); inclusive tira o ×2 da cabeça |
| [datafortress2020 — combat rules](https://datafortress2020.com/combatrules.html) | **Regra de casa** declarada |
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
| Dificuldade por alcance | Queima-roupa 10, curto 15, médio 20, longo 25, extremo 30 | Não existe | **Fase D** (acertar o alvo é do loop de combate) |

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

`currentStats` = atributo base → **−1 EMP a cada 10 de Humanidade perdida** (S7) → efeito do
ferimento. É o que **toda** rolagem lê. **C.6.**

| Fonte de modificação | Status |
|---|---|
| Humanidade → EMP | **C.6** — soma o `actualHL` de **todo** implante da ficha, instalado ou não, igual ao painel de cromo. O livro cobra a humanidade na instalação; o modelo não distingue "nunca instalado" de "removido". **ADIAR** — gatilho: um jogador usar o botão de desinstalar para planejar compra, e o EMP cair por cromo que ele não tem |
| Ferimento → REF/INT/COOL | **C.6** |
| Cromo que soma atributo (ex.: lace muscular) | **ADIAR** — `CyberwareItem` não tem campo de atributo. **Gatilho:** Fase K modelar o efeito de implante (K.2) |
| EV da armadura → REF | **ADIAR para a K** (RUL-11). A armadura padrão é modelada **uma peça por localização**; somar o EV por peça contaria a mesma jaqueta várias vezes. Precisa de modelo de peça antes |

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
perícia de TECH (Basic Tech, Electronics, CyberTech, Weaponsmith). **Gatilho para rever:** o dono
achar no livro físico um atributo diferente, ou a mesa sentir o Techie forte demais.

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
**Gatilho para rever:** o dono achar no livro físico uma ordem explícita, ou um exemplo resolvido
que só feche com B.

Também da Fase D: **penetração escalonada** (cada acerto que passa reduz o SP daquele ponto em 1) e
**perda de membro** (mais de 8 pontos num membro de uma vez; na cabeça, morte).

## O que fica para a Fase K

| Regra | Livro | Código | Achado |
|---|---|---|---|
| Movimento | Run = MA × 3 m; Leap = Run ÷ 4 | Run ✅; **Walk não existe no livro**; Leap ausente | RUL-11 |
| Carga | Carry = BODY × 10 kg; Lift = BODY × 40 kg | Ausentes | RUL-11 |
| Perícias | Social é **EMP**; INT tem Accounting, Anthropology, Gamble, Shadow/Track, Wilderness Survival; COOL tem Interrogation; TECH tem Cyberdeck Design e Pharmaceuticals | Social duplicado em INT; essas 9 faltam | RUL-12 |
| Criação | 10 roles; atributos 2–10 na criação | Sem orçamento | RUL-10 |
