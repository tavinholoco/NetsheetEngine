# Conferência contra o livro — Cyberpunk 2020

Entregável da **C.9** do [`PLANO_MESTRE.md`](./PLANO_MESTRE.md) (decisão 2: **fidelidade estrita**).
Cada regra de jogo que o NetSheet implementa, o que o livro diz, o que o código fazia, e onde foi
resolvida. **Divergência do livro é bug**, não regra de casa.

A versão executável destas tabelas é [`src/rules/tables.ts`](../src/rules/tables.ts). Os testes de
regra são **derivados dela**, não da implementação — é a disciplina da Fase C: tabela do livro como
dado → testes → vê-los falhar → só então mudar o código.

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

**Fontes descartadas, e por quê** — é daqui que vinham duas premissas erradas do plano:

| Fonte | Por que não serve |
|---|---|
| [karridian.net — FNFF](https://www.karridian.net/cyb_fnff.html) | Se declara **regra de casa** que substitui o dano do livro. É a origem provável do "−2/−4/−6 em todas as ações" |
| [clon01 — combat revised](https://cyberpunk.clon01.net/htm/combat_revised.htm) | **Regra de casa** declarada ("distilled and interpreted"); inclusive tira o ×2 da cabeça |
| [datafortress2020 — combat rules](https://datafortress2020.com/combatrules.html) | **Regra de casa** declarada |
| Qualquer material do **Cyberpunk RED** | Sistema diferente. O fumble que subtrai 1d10, a explosão única e o death save que piora a cada sucesso são **do RED** e estavam no código ou no plano |

> **Para o dono, com o livro na mão:** as linhas marcadas **inferido** são as que valem uma
> conferência no físico. Tudo o que está marcado **confirmado** tem duas fontes concordando.

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
| Escopeta | Não existe perícia de escopeta no 2020 | — | **C.3 — inferido:** Rifle (arma longa). Conferir no livro |
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
| Humanidade → EMP | **C.6** |
| Ferimento → REF/INT/COOL | **C.6** |
| Cromo que soma atributo (ex.: lace muscular) | **ADIAR** — `CyberwareItem` não tem campo de atributo. **Gatilho:** Fase K modelar o efeito de implante (K.2) |
| EV da armadura → REF | **ADIAR para a K** (RUL-11). A armadura padrão é modelada **uma peça por localização**; somar o EV por peça contaria a mesma jaqueta várias vezes. Precisa de modelo de peça antes |

## Habilidades especiais

| Role | Habilidade | Atributo | Evidência | Código antes |
|---|---|---|---|---|
| Solo | Combat Sense | **não se rola sozinha**: soma em Awareness/Notice (INT) e na iniciativa | S1, S3, S5, S6 | REF |
| Netrunner | Interface | INT | S1, S6 | INT ✅ |
| Tech | Jury Rig | TECH | **inferido** — S1 não soma atributo nenhum (defeito da ficha), S3 não diz | EMP |
| Medtechie | Medical Tech | TECH | S1, S3 | EMP |
| Media | Credibility | INT | S1, S3 | EMP |
| Cop | Authority | COOL | S1, S3, S6 | EMP |
| Corp | Resources | INT | S1 | EMP |
| Fixer | Streetdeal | COOL | S1, S3, S6 | EMP |
| Rockerboy | Charismatic Leadership | COOL | S1 | EMP |
| Nomad | Family | INT | S1, S3 | EMP |

**C.8** — o atributo mora em `OFFICIAL_ROLES`. O ternário acertava 1 de 10.

## Dano — a ordem do pipeline (para a Fase D)

O livro diz que a cabeça dobra o dano **que passou da armadura**, e que o BTM **nunca reduz o dano
abaixo de 1** (S5). Ele **não é explícito** sobre dobrar antes ou depois do BTM — há debate na
comunidade, e o argumento pela outra ordem é só a ordem das seções no texto. A leitura mais comum,
e a do [diagrama](./ARQUITETURA.md#pipeline-de-dano-fnff), é **SP → ×2 na cabeça → BTM (mínimo 1)**.

**Decisão pendente do dono antes da D.1**, com o livro na mão. Registrada aqui para não ser
descoberta no meio do código.

Também da Fase D: **penetração escalonada** (cada acerto que passa reduz o SP daquele ponto em 1) e
**perda de membro** (mais de 8 pontos num membro de uma vez; na cabeça, morte).

## O que fica para a Fase K

| Regra | Livro | Código | Achado |
|---|---|---|---|
| Movimento | Run = MA × 3 m; Leap = Run ÷ 4 | Run ✅; **Walk não existe no livro**; Leap ausente | RUL-11 |
| Carga | Carry = BODY × 10 kg; Lift = BODY × 40 kg | Ausentes | RUL-11 |
| Perícias | Social é **EMP**; INT tem Accounting, Anthropology, Gamble, Shadow/Track, Wilderness Survival; COOL tem Interrogation; TECH tem Cyberdeck Design e Pharmaceuticals | Social duplicado em INT; essas 9 faltam | RUL-12 |
| Criação | 10 roles; atributos 2–10 na criação | Sem orçamento | RUL-10 |
