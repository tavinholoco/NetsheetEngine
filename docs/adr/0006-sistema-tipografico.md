# ADR 0006 — Identidade visual: reconstruir a linguagem do Cyberpunk 2020 com faces livres

- **Status:** Aceito
- **Data:** 02/09/2026 *(duas revisões no mesmo dia — ver histórico ao final)*; **revisão 4 em
  30/09/2026**, medida antes da execução — ver [o que a medição mudou](#revisão-4--o-que-a-medição-de-30092026-mudou)
- **Decisores:** Desenvolvimento (Fase F — Reestruturação visual: identidade Cyberpunk 2020)
- **Fase do plano:** Fase F do [`PLANO_MESTRE.md`](../PLANO_MESTRE.md)

## Contexto

O NetSheet é uma suíte para **Cyberpunk 2020**, RPG de mesa publicado pela R. Talsorian em 1990
(sucessor do *Cyberpunk* de 1988). A identidade visual do produto deve ser a **desse** livro — não a
do Cyberpunk 2077 (jogo, 2020) nem a do Cyberpunk RED (sistema de mesa atual), que compartilham uma
linguagem moderna: limpa, sistemática, militar, vermelho primário, fios finos, HUD curvo.

A estética alvo é a do cyberpunk **oitentista**: impressão de alto contraste, neon sobre preto,
terminal CRT, faixas de perigo, ruído analógico, colagem de fanzine.

### As fontes originais não são documentadas

Pesquisa em setembro de 2026 não encontrou **nenhuma fonte pública** que documente os tipos usados
nos livros da R. Talsorian. As buscas devolvem história editorial e listas de suplementos, não
créditos de design, e a identificação por comunidade nesse nicho é especulativa.

Registro isso explicitamente para que ninguém, mais tarde, trate a stack abaixo como "as fontes
oficiais". Ela **não** é reprodução — é reconstrução da linguagem da época.

### O que é documentado: o vocabulário tipográfico da era

| Face | Papel histórico | Licença |
|---|---|---|
| **Eurostile** (Novarese, 1962; derivada da Microgramma, 1952) | *A* face de ficção científica e técnica dos anos 60–80 — quadrada, cantos arredondados, extendida. Em *2001*, *De Volta para o Futuro*, *Starship Troopers* | Comercial |
| **Bank Gothic** | Referência de sci-fi dos anos 90 | Comercial |
| **OCR-A / Data 70 / Compacta** | Vozes de "computador" e de ação dos anos 70–80 | Comerciais ou de origem incerta |

Nenhuma pode ser embarcada sem licença de webfont, o que colide com o contrato de custo zero do
plano mestre.

### Dois fatos do repositório que condicionam a decisão

1. **As fontes atuais não carregam em produção.** O `@import` do Google Fonts em `src/index.css`
   sobrevive ao build, mas o CSP do helmet (`style-src 'self' 'unsafe-inline'`,
   `font-src 'self' data:`) bloqueia tanto a folha quanto os arquivos. Como o helmet é pulado em dev,
   o problema só existe no ar — a produção renderiza em fontes de sistema, provavelmente desde a
   Fase 10. *(ARQ-09)*
2. **O sistema de design existe e está desligado.** 1.722 ocorrências de cor literal em `.tsx`, em
   107 combinações; 5 tokens de cor no `@theme` com **zero** componentes usando; 2 animações de
   identidade (`scanline`, `glitch`) com **zero** usos. Terceiro caso do mesmo padrão, depois do
   `combatModifier` e do `currentStats`.

## Decisão

**Reconstruir a linguagem do CP2020 com faces livres e auto-hospedadas**, e ligar o sistema de tokens
antes de aplicar qualquer coisa — sem isso, a identidade nova custa 1.722 substituições, e a próxima
mudança custará outras 1.722.

### Stack tipográfica

| Papel | Face | Situação | Justificativa |
|---|---|---|---|
| Corpo e UI | **Rajdhani** | Já em uso | Sans quadrada de fatura técnica, livre (SIL OFL). Já é a escolha certa; migração zero |
| Terminal e dados | **Share Tech Mono** | Já em uso | Mono de terminal, livre. Sustenta o motivo de "leitura de máquina" do livro |
| Display / títulos | **Orbitron** | **Adicionar** | Alternativa livre mais citada ao Eurostile; eixo 400–900. *Sintoma:* hoje não há voz de display — títulos são a fonte do corpo, só maior, e as seções não se distinguem |
| Números da ficha | **Saira Condensed** | **Condicional** | Só se `tabular-nums` no Rajdhani não resolver o desalinhamento dos dígitos. Medir antes de adicionar |
| Momentos de terminal | **VT323** | **Condicional** | CRT autêntica, livre, ~30 KB. Só para Netrunner IA, `SISTEMA_NET` e telas de carregamento — nunca em corpo de texto, onde é ilegível |

`Michroma` fica considerada apenas para o wordmark: é mais próxima do Eurostile Extended, mas tem
peso único.

### Tokens por papel, não por cor

Substituir `--color-neon-cyan` por `--color-accent`, e assim por diante:
`surface`, `surface-raised`, `line`, `accent`, `signal`, `danger`, `ok`. O Tailwind v4 gera as
utilities a partir do `@theme`, então a migração é renomeação mecânica, arquivo por arquivo, com a
app funcionando o tempo todo.

### Regra de política: vermelho significa exclusivamente dano

O `HealthTracker` percorre `text-red-400/500/600` e `text-rose-600/700` conforme o wound level sobe.
Nada mais no produto pode competir com esse significado — é o que impede a paleta de voltar a
ambiguar sozinha, e é a razão de fundo pela qual o vermelho primário do 2077 nunca caberia aqui.

### Vocabulário gráfico

Barras pretas com caixa alta reversa (o traço mais reconhecível da diagramação da Talsorian), faixas
de perigo amarelo-e-preto para estados de alerta, numeração de seção com underscore
(`FICHA_01`, `MESA_TATICA`), e as animações `scanline`/`glitch` que já existem e nunca foram ligadas —
usadas com intenção narrativa, não como enfeite global.

Textura de impressão e aberração cromática ficam **opcionais e sob o filtro**: "falta sujeira
analógica" é gosto, não sintoma.

## Consequências

- **Acessibilidade não é negociável.** Efeitos oitentistas destroem legibilidade com facilidade:
  contraste conferido nos dois modos, foco visível, e `prefers-reduced-motion` respeitado em
  scanline, glitch e pulse.
- **Peso do bundle.** Cada face adicionada é payload. Carregar apenas os pesos efetivamente usados,
  com `font-display: swap`. É o que mantém as duas adições condicionais realmente condicionais.
- **Auto-hospedagem** resolve o ARQ-09 e é o mesmo mecanismo que as fontes novas usarão. O CSP
  permanece apertado.

## Critério de pronto

Duas medidas objetivas, não "está bonito":

1. O grep de cor literal em `.tsx` tendendo a zero.
2. As fontes carregando com `NODE_ENV=production` e helmet ativo.

A identidade nova é a consequência visível; a capacidade de mudá-la barato é a entrega real.

## Revisão 4 — o que a medição de 30/09/2026 mudou

Antes de executar a Fase F, as premissas desta ADR foram medidas contra o código e contra o app
rodando (o F.0a do [plano](../PLANO_MESTRE.md), com a tabela inteira). **A direção fica; quatro
premissas caíram**, e o dono respondeu às perguntas que elas abriram — a decisão 10 do plano.

| Esta ADR dizia | Medido | Decisão 10 |
|---|---|---|
| Rajdhani "já em uso" no corpo e na UI | **96%** do texto da ficha está em Share Tech Mono; o Rajdhani quase não aparece | **(a)** O papel da tabela acima passa a valer de fato: Rajdhani em rótulo, navegação e texto corrido; mono só em número, dado e terminal |
| Share Tech Mono para terminal e dados | A face **só tem o peso 400**; 99 elementos da ficha pedem negrito e recebem negrito sintético | **(a)** Mono sem negrito — destaque de terminal é brilho, não peso. Piso de 10 px |
| 7 tokens por papel; migração mecânica | 129 combinações prefixo × cor × tom; 727 usos de `slate` em ~10 tons | Duas camadas: **rampa por papel** (mecânica) e **nomes semânticos para os neutros**, com a tabela de conversão versionada |
| Vermelho só dano | 244 usos, a maioria marca, menu, GM, erro e ação destrutiva | **(b)** Papel novo **`fault`** (magenta) para erro, ação destrutiva, *fumble* e NPC hostil; marca e GM para amarelo ou ciano. **(c)** A cor por seção fica, sem vermelho |
| `prefers-reduced-motion` respeitado | Não é técnica suficiente do WCAG 2.2.2 (nível A) | Animação decorativa **para em ≤ 5 s**; a preferência do sistema zera o resto |
| Vocabulário gráfico da diagramação da Talsorian | Sem fonte pública para barra preta, faixas ou numeração | **(d)** O livro do dono (interior em P&B) responde: é a referência de diagramação e tipografia; a cor vem da época |

O critério de pronto ganhou comando: `npm run audit:colors` em zero no CI, e o E2E das fontes com o
helmet ativo.

**Na execução da F.2 (30/09/2026)**, os usos corrigiram três nomes da rampa — o roxo é **`cyber`**
(Netrunner/IA e cyberware), o âmbar ganhou papel próprio (**`caution`**) e o rosa de hoje (DADOS e
armas) **não** é `fault` — e mostraram um defeito de cascata: com duas classes de cor da mesma
propriedade no mesmo elemento, o Tailwind 4 decide pelo alfabeto do nome, e renomear inverte o
vencedor. A tabela de conversão é `scripts/color-map.json`; o detector, `migrate-colors --conflitos`.

## Histórico de revisões

**Versão 1 — migrar para o Cyberpunk 2077.** Proposta a partir da galeria
[Cyberpunk 2077 — User Interface (Part 2)](https://www.behance.net/gallery/133185623/Cyberpunk-2077User-Interface-(Part-2)),
de Vladimír Vilimovský (Senior UI Artist, CD PROJEKT RED). Descartada: a galeria **não nomeia
nenhuma fonte** (o texto remete à *UI Art Bible* da Parte 1, e a tipografia só aparece nas imagens),
as faces reais do jogo — Blender Pro e Refrigerator Deluxe — são comerciais, e o vermelho primário do
2077 colide com o vermelho de dano do produto.

**Versão 2 — não mexer no estilo, só no encanamento.** Sustentava que a identidade atual já era
"suficientemente 2020" e que a fase deveria ser apenas tokens e correção de fontes. Revista: a
direção estava certa, mas a conclusão foi longe demais. O projeto tem os *ingredientes* certos
(Rajdhani, Share Tech Mono, neon sobre preto, scanline) e não tem o *sistema* — falta voz de display,
falta o repertório gráfico impresso, e as animações de identidade nunca foram ligadas. "Já está certo"
confundia matéria-prima com resultado.

**Versão 3 — esta.** Identidade CP2020 reconstruída com faces livres, sobre o encanamento de tokens.
Fase de 2 para 4 dias.

**Revisão 4 (30/09/2026) — a versão 3, medida.** Nenhuma mudança de direção: a medição antes da
execução corrigiu quatro premissas (a fonte "já em uso", a migração "mecânica", o alcance do vermelho
e o critério de movimento) e o dono respondeu às perguntas que elas abriram (decisão 10). Fase de 4
para 4,5–5 dias. Ver [a seção acima](#revisão-4--o-que-a-medição-de-30092026-mudou).
