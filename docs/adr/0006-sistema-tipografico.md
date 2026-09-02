# ADR 0006 — Sistema visual: manter a direção Cyberpunk 2020 e ligar os tokens que já existem

- **Status:** Proposto
- **Data:** 02/09/2026 *(revisado no mesmo dia — ver "Decisão revista" ao final)*
- **Decisores:** Desenvolvimento (Fase F — Reestruturação visual do frontend)
- **Fase do plano:** Fase F do [`PLANO_MESTRE.md`](../PLANO_MESTRE.md)

## Contexto

A proposta inicial era migrar a identidade visual do NetSheet para a linguagem do **Cyberpunk 2077**,
tendo como referência a galeria
[Cyberpunk 2077 — User Interface (Part 2)](https://www.behance.net/gallery/133185623/Cyberpunk-2077User-Interface-(Part-2)),
de Vladimír Vilimovský, Senior UI Artist da CD PROJEKT RED.

A investigação anterior à decisão levantou quatro fatos que mudaram a conclusão.

### 1. A referência não nomeia nenhuma fonte

A galeria descreve o **conceito**, não a especificação. O texto remete à *UI Art Bible*, que fica na
apresentação anterior (Parte 1), e a tipografia aparece apenas dentro das imagens. Não havia lista de
fontes para extrair.

O que ela oferece, e vale registrar como vocabulário: rótulos em CAIXA ALTA com numeração de seção
(`PART_04`), tokens unidos por underscore (`USER_INTERFACE`), fragmentos de código como motivo de
carregamento, e vermelho primário assumindo conscientemente o conflito com vermelho de erro.

### 2. As fontes reais do CP2077 são comerciais

O jogo usa **Blender Pro** e **Refrigerator Deluxe**, ambos tipos comerciais, que não podem ser
embarcados num site sem licença de webfont. Bloqueio jurídico, não técnico.

### 3. O projeto já é Cyberpunk 2020 esteticamente

O Cyberpunk **2077** (jogo) e o Cyberpunk **RED** (sistema de mesa atual) compartilham uma linguagem
moderna: limpa, sistemática, militar, vermelho primário, fios finos, HUD curvo. O **2020** é outra
coisa — mesa de 1988, estética de impressão dos anos 80/90: neon sobre preto, terminal CRT, alto
contraste, ruído analógico.

A identidade atual do NetSheet **já é a segunda**:

- **Rajdhani** — sans quadrada de fatura técnica, livre (SIL OFL), já em uso;
- **Share Tech Mono** — literalmente uma fonte de terminal, já em uso;
- paleta neon (ciano/amarelo) sobre quase-preto;
- o `src/index.css` já define animações de `scanline` e `glitch` — vocabulário 80s, e justamente o
  oposto do 2077, que é limpo e sem ruído.

### 4. O sistema de design existe e está desligado

Medido no repositório:

| Medida | Valor |
|---|---|
| Ocorrências de cor literal em `.tsx` | **1.722** |
| Combinações distintas de cor | **107** |
| Tokens de cor no `@theme` do `index.css` | 5 |
| Componentes que os usam | **0** |
| Animações de identidade definidas | 2 (`scanline`, `glitch`) |
| Componentes que as usam | **0** |

É o mesmo padrão do `combatModifier` e do `currentStats`: construído de ponta a ponta, sem um único
leitor. Terceiro caso no mesmo repositório.

### 5. As fontes não carregam em produção

O `src/index.css` importa as duas fontes do Google Fonts via `@import url(...)`, e esse `@import`
**sobrevive ao build** (confirmado em `dist/assets/index-*.css`). Mas o CSP do helmet, aplicado
apenas em produção, declara:

```
"style-src": ["'self'", "'unsafe-inline'"],
"font-src":  ["'self'", "data:"],
```

A folha do `fonts.googleapis.com` é bloqueada por `style-src`, e os arquivos do `fonts.gstatic.com`
por `font-src`. Como o helmet é pulado em desenvolvimento, **o problema só existe no ar**: a produção
renderiza em fontes de sistema, silenciosamente, provavelmente desde a Fase 10. *(ARQ-09)*

## Decisão

**Manter a direção estética atual (Cyberpunk 2020) e tratar a Fase F como encanamento, não como
redesign.** Três entregas:

1. **Auto-hospedar as fontes** (`@fontsource/*` ou arquivos em `public/fonts/` com `@font-face`
   local), em vez de afrouxar o CSP. Mantém o CSP apertado, remove dependência de terceiro do caminho
   de render, melhora o LCP e não volta a quebrar quando outra fonte for adicionada.
2. **Ligar os tokens.** Substituir os nomes por cor (`--color-neon-cyan`) por nomes por papel
   (`--color-accent`, `--color-signal`, `--color-danger`, `--color-surface`, `--color-line`,
   `--color-ok`) e migrar as 1.722 ocorrências literais para as utilities que o Tailwind v4 gera a
   partir do `@theme`. É renomeação mecânica, arquivo por arquivo, com a app funcionando o tempo todo.
3. **Acabamento tipográfico** dentro da direção existente: escala explícita, `tabular-nums` nas
   colunas de número da ficha, tracking padronizado para caixa alta.

### Regra de política: vermelho significa exclusivamente dano

O `HealthTracker` percorre `text-red-400/500/600` e `text-rose-600/700` conforme o wound level sobe.
Nada mais no produto pode competir com esse significado. É o que impede a paleta de voltar a ambiguar
sozinha — e é a razão de fundo pela qual o vermelho primário do 2077 não cabe aqui.

## Decisão revista

A versão inicial desta ADR propunha adotar a linguagem do 2077, com substitutos livres para as fontes
comerciais (Chakra Petch / Saira Condensed no lugar do Blender Pro) e uma decisão pendente sobre
vermelho primário.

**Revista no mesmo dia**, por dois motivos: o produto é Cyberpunk **2020** e não a era moderna da
franquia, e a medição mostrou que não havia troca de estilo a fazer — havia um sistema desligado e
uma fonte que não carrega. Aplicando o filtro de necessidade do plano, a troca de paleta não passa na
pergunta 1: não há sintoma observado, só preferência.

Consequências da revisão: a Fase F cai de 3–4 para 2 dias, a referência do Behance sai do escopo
(fica citada aqui pelo vocabulário, não como alvo), e Chakra Petch / Saira Condensed ficam como item
opcional da F.2.4, sujeito ao filtro.

## Critério de pronto

O grep de cor literal em `.tsx` tendendo a zero — não "está bonito". A fase entrega a capacidade de
mudar a identidade barato; qual identidade continua sendo decisão de produto, tomada depois e com o
custo já baixo.
