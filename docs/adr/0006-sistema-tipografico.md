# ADR 0006 — Sistema tipográfico: fontes auto-hospedadas e substitutos livres do Cyberpunk 2077

- **Status:** Proposto
- **Data:** 02/09/2026
- **Decisores:** Desenvolvimento (Fase F — Reestruturação visual do frontend)
- **Fase do plano:** Fase F do [`PLANO_MESTRE.md`](../PLANO_MESTRE.md)

## Contexto

A identidade visual do NetSheet deve migrar do estilo genérico atual para a linguagem do
**Cyberpunk 2077**, tendo como referência a galeria
[Cyberpunk 2077 — User Interface (Part 2)](https://www.behance.net/gallery/133185623/Cyberpunk-2077User-Interface-(Part-2)),
de Vladimír Vilimovský, Senior UI Artist da CD PROJEKT RED.

Três fatos apurados antes de decidir.

### 1. A referência não nomeia nenhuma fonte

A galeria descreve o **conceito** — não a especificação. O texto diz que as razões da escolha
tipográfica estão na *UI Art Bible*, que fica na apresentação anterior (Parte 1), e a tipografia
aparece apenas dentro das imagens. **Não há lista de fontes para extrair.**

O que a referência **entrega** e é aproveitável é o vocabulário visual:

- rótulos em CAIXA ALTA com numeração de seção (`PART_04`, `PART_05`);
- tokens unidos por underscore (`USER_INTERFACE`, `FULL—SCREEN_PANELS`);
- fragmentos de código como motivo de carregamento;
- **vermelho como cor primária** — decisão que o próprio autor descreve como andar contra a corrente,
  assumindo conscientemente o conflito com o vermelho de erro e aviso.

### 2. As fontes reais do CP2077 são comerciais

O jogo usa **Blender Pro** e **Refrigerator Deluxe**, ambos tipos comerciais. Não podem ser
embarcados num site sem licença de webfont — é bloqueio jurídico, não técnico.

O **Rajdhani** (Google Fonts, licença SIL OFL) é a fonte livre mais associada a esse visual, e
**o projeto já a utiliza** desde antes desta auditoria, junto com **Share Tech Mono**. A base atual,
portanto, já está mais próxima do alvo do que parecia.

### 3. As fontes atuais não carregam em produção

Achado da auditoria de retomada. O `src/index.css` importa as duas fontes do Google Fonts via
`@import url(...)`, e esse `@import` **sobrevive ao build** (confirmado em `dist/assets/index-*.css`).
Mas o CSP do helmet, aplicado apenas em produção, declara:

```
"style-src": ["'self'", "'unsafe-inline'"],
"font-src":  ["'self'", "data:"],
```

A folha do `fonts.googleapis.com` é bloqueada por `style-src`, e os arquivos do `fonts.gstatic.com`
por `font-src`. Como o helmet é pulado em desenvolvimento, **o problema só existe no ar**: a produção
renderiza em fontes de sistema, silenciosamente.

Isto precisa ser corrigido **antes** de qualquer escolha tipográfica nova — caso contrário a Fase F
inteira seria validada num ambiente que não é o real.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Licenciar Blender Pro / Refrigerator Deluxe | Fidelidade máxima à referência | Custo recorrente, contra o contrato de custo zero; licença de webfont é caso à parte |
| Manter Google Fonts e **afrouxar o CSP** | Uma linha de mudança | Troca uma correção permanente por uma exceção; mantém dependência de terceiro no caminho crítico de render |
| **Auto-hospedar fontes livres** (escolhida) | CSP continua apertado; sem dependência externa; melhor LCP; não volta a quebrar ao adicionar fonte | Fontes entram no repositório e no bundle; exige subset para não pesar |

## Decisão

**Auto-hospedar** as fontes (via `@fontsource/*` ou arquivos em `public/fonts/` com `@font-face`
local) e montar a stack apenas com tipos de licença livre:

| Papel | Fonte | Situação |
|---|---|---|
| Display / títulos | **Rajdhani** | Já em uso; livre (SIL OFL) |
| Rótulos, números, chapéus de seção | **Chakra Petch** ou **Saira Condensed** | A avaliar na F.1.2 — substituto livre do Blender Pro |
| Terminal / código | **Share Tech Mono** | Já em uso; livre |

Complementos obrigatórios: escala tipográfica explícita, tracking definido para caixa alta e
`font-variant-numeric: tabular-nums` em toda coluna de número da ficha (atributos, SP, dano,
iniciativa).

### Decisão pendente — vermelho primário colide com vermelho de dano

O CP2077 usa vermelho como cor primária. O NetSheet usa ciano/amarelo e **reserva o vermelho para
ferimento**: o `HealthTracker` percorre `text-red-400/500/600` e `text-rose-600/700` conforme o wound
level sobe. Adotar vermelho primário faz "cor da marca" e "você está morrendo" falarem a mesma
língua.

O artista tinha um jogo inteiro para sustentar essa aposta e um sistema de UI completo para
diferenciar os dois usos. Uma ficha de RPG não tem essa folga.

- **(a) Recomendada:** manter amarelo/ciano como primário e o vermelho exclusivo para dano.
- **(b)** Adotar o vermelho primário e mover a sinalização de dano para outro canal (peso, moldura,
  ícone) — mais fiel à referência, mais caro e mais arriscado.

Decidir na F.2.2, antes de aplicar tokens nos componentes.

## Consequências

- As cores hoje são classes Tailwind literais (`text-cyan-400`, `bg-slate-900/70`, `border-cyan-500`)
  espalhadas por 20 componentes. Extrair para tokens CSS (`--nse-accent`, `--nse-surface`,
  `--nse-danger`…) é pré-requisito: sem isso, esta troca e a próxima exigem busca e substituição em
  todos os arquivos.
- O CSP permanece como está — a correção do F.0 remove a necessidade de afrouxá-lo.
- Verificar a Fase F em `NODE_ENV=production`, com helmet ativo. É a única forma de confirmar que as
  fontes realmente carregam.

## Nota de identidade

A referência é Cyberpunk **2077** (jogo de 2020) e o produto é Cyberpunk **2020** (RPG de mesa de
1988). Adotar a linguagem visual do 2077 produz algo reconhecível como "a franquia Cyberpunk", não
como "o RPG de mesa dos anos 80". É escolha de produto legítima — hoje a imagem mental de cyberpunk
da maioria das pessoas *é* o 2077 — mas fica registrada aqui para ser escolha, e não deriva.
