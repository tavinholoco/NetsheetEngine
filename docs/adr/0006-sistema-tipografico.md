# ADR 0006 — Identidade visual: reconstruir a linguagem do Cyberpunk 2020 com faces livres

- **Status:** Aceito
- **Data:** 02/09/2026 *(duas revisões no mesmo dia — ver histórico ao final)*
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
