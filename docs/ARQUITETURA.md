# Arquitetura — diagramas do sistema

> Documento vivo. Cada fase de construção do [`PLANO_MESTRE.md`](./PLANO_MESTRE.md) que muda a forma
> do sistema **atualiza o diagrama afetado antes de fechar** — é parte do portão de segurança.
>
> **Um diagrama desenhado antes do trabalho é especificação. Desenhado depois, é documentação que
> apodrece.** Por isso os diagramas de regra (pipeline de dano, máquina de ferimento) existem aqui
> antes das Fases C e D: eles são o alvo, não o relatório.

## Convenção

Mermaid, com `flowchart` e `subgraph` para os níveis de contexto e contêiner do
[modelo C4](https://c4model.com/). **Não usamos a sintaxe `C4Context` do Mermaid**: ela é
experimental e o renderizador do GitHub não a suporta — os diagramas não apareceriam no repositório,
que é justamente onde precisam ser lidos.

Estilo mínimo e sem preenchimento de cor, para renderizar legível tanto no tema claro quanto no
escuro do GitHub.

---

## Contêineres e fronteiras de confiança

O diagrama que faltava. **O SEC-05 existiu porque ninguém tinha desenhado onde fica a fronteira** —
a ficha atravessava do navegador para o motor de regras sem nada no caminho.

```mermaid
flowchart TB
    subgraph cliente["ZONA NAO CONFIAVEL - navegador do jogador"]
        SPA["SPA React 19<br/>Vite - Zustand - Router"]
        LS[("localStorage<br/>ficha offline + roster")]
    end

    subgraph servidor["ZONA CONFIAVEL - processo unico"]
        API["Express /api<br/>REST - rate limit - helmet"]
        WSS["WebSocket /ws/rooms/:code<br/>chat - rolagem - Yjs"]
        SSE["SSE /stream<br/>fallback"]
        VAL["Validacao de entrada<br/>src/rules/sheetSchema"]
        RULES["Motor FNFF autoritativo<br/>src/rules"]
        MEM[("Memoria<br/>salas - sessoes - Y.Doc")]
    end

    subgraph externo["SERVICOS EXTERNOS"]
        SB[("Supabase<br/>Auth - Postgres+RLS - Storage")]
        AI["Provedor de IA<br/>Gemini hoje - Groq decidido, sem fase (ADR 0005)"]
    end

    SPA -->|"REST + sessionToken"| API
    SPA -->|"upgrade ?token="| WSS
    SPA -.->|"quando WS falha"| SSE
    SPA -->|"anon key + JWT do usuario"| SB
    SPA <--> LS

    API --> VAL
    WSS --> VAL
    VAL --> RULES
    RULES --> MEM
    API --> MEM
    WSS --> MEM
    SSE --> MEM

    API -->|"service_role - nunca no cliente"| SB
    API -->|"chave do dono - nunca no cliente"| AI

    linkStyle 0,1,2,3 stroke-width:2px
    style cliente stroke-dasharray: 6 4
    style servidor stroke-width:2px
    style externo stroke-dasharray: 2 3
```

### As três regras que este desenho expressa

1. **Nada que vem do navegador é confiável** — nem a ficha, nem o `peerId`, nem o `woundLevel`, nem o
   binário Yjs. Toda seta que cruza para a zona confiável passa por `VAL` antes de chegar em `RULES`.
   *A caixa `VAL` existe desde a Fase B (B.2): `src/rules/sheetSchema.ts`, aplicada dentro do
   `roomManager` para cobrir todo caminho que escreve ficha, não só a rota HTTP.* **O binário Yjs
   ainda não passa por ela** — continua com try/catch apenas, e é item da Fase J.
2. **O autor de toda ação é derivado do `sessionToken`**, nunca de um campo do corpo. *Revisão
   pós-D (29/09/2026): a **emissão** do token é a outra metade da regra — o `join` entregava sessão a
   quem apresentasse um `peerId` que o próprio estado da sala publica (SEC-07, R.1 do plano). A seta
   `SPA → API` carrega o token; o que faltava estava antes dela.*
3. **`service_role` e chave de IA não cruzam a fronteira** — vivem só no processo do servidor, jamais
   em variável `VITE_`.

*A caixa `RULES` existe de fato desde a Fase C:* `src/rules/` (tabelas do livro, motor de dados,
atributos derivados, ataque). **O navegador roda o mesmo código** no rolador pessoal da ficha — mas
isso não atravessa a fronteira: na mesa, só vale o que o servidor rola, com o RNG dele e a ficha que
ele saneou. Compartilhar o código é o que garante a paridade (C.10), não confiança no cliente.

### O que o desenho revelou sobre a leitura

O desenho tornava óbvio, de um jeito que 1.000 linhas de `server.ts` não tornavam, que as setas de
**leitura** (`GET /api/rooms/:code`, `/stream`) não passavam por verificação de sessão — o SEC-02.

**Fechado na Fase B (B.3), em 03/09/2026.** A leitura de sala responde em três casos (sem token →
recorte público; token válido → sala completa; token inválido → 401) e o stream exige sessão pela
query, porque `EventSource` não permite header customizado.

---

## Ciclo de vida de sala e sessão

Especificação do coletor que a **Fase B** precisa construir (SEC-04).

```mermaid
stateDiagram-v2
    [*] --> Criada
    Criada --> Ativa: primeiro join
    Ativa --> Ativa: join / leave / heartbeat
    Ativa --> Ociosa: sem heartbeat de ninguem
    Ociosa --> Ativa: alguem reconecta
    Ativa --> Encerrada: ultimo leave
    Ociosa --> Encerrada: coletor recolhe
    Encerrada --> [*]

    note right of Criada
        POST /api/rooms/create
        emite o sessionToken do GM
    end note

    note right of Ociosa
        ROOM_OFFLINE_TIMEOUT_MS (60 s)
        markStalePlayersOffline marca
        os jogadores como offline
    end note

    note right of Encerrada
        revoga sessoes da sala
        apaga a linha no Supabase
        destroi o Y.Doc e a awareness
    end note
```

**Implementado na Fase B (B.5 — SEC-04), em 03/09/2026.** A transição `Ociosa --> Encerrada` era o
buraco: uma mesa que todo mundo fechou a aba nunca morria, e as sessões dela iam junto.

Dois limiares, porque são perguntas diferentes:

| Transição | Env | Padrão | Pergunta |
|---|---|---|---|
| `Ativa --> Ociosa` | `ROOM_OFFLINE_TIMEOUT_MS` | 60 s | o jogador ainda está aí? |
| `Ociosa --> Encerrada` | `ROOM_ABANDONED_TIMEOUT_MS` | 24 h | a mesa foi abandonada? |

O coletor (`collectAbandonedRooms`, varrido de 15 em 15 min) cumpre os **três** passos da nota de
`Encerrada`. Fazer só o primeiro deixaria uma linha órfã que ressuscitaria a sala no próximo boot.

As 24 h são conservadoras de propósito: o risco não é simétrico. Recolher tarde custa uma linha a
mais no banco por mais um dia; recolher cedo apaga a mesa de alguém, e o delete é irreversível.

---

## Pipeline de dano FNFF

**Implementado na D.1 (28/09/2026)** (RUL-04): `resolveHit` e `applyHit` em
[`src/rules/damage.ts`](../src/rules/damage.ts), chamados pelo `applyDamage` do servidor
(`POST /api/rooms/:code/damage`, só o GM). A trilha conta **pontos** (decisão 7b): 40 caixas de 1
ponto, e o `woundLevel` é derivado delas. O death save (último nó) entrou na D.5: rolado pelo
servidor logo depois do dano e na virada de turno (`nextTurn`), até morrer ou o GM estabilizar.

*Conferido contra o livro na C.9 (25/09/2026) — fontes em
[`CONFERENCIA_CP2020.md`](./CONFERENCIA_CP2020.md#dano--a-ordem-do-pipeline-para-a-fase-d). Ordem na
cabeça decidida pelo dono em 26/09/2026 (decisão 6): **armadura → BTM → ×2**.*

```mermaid
flowchart TB
    A["Dano bruto da arma<br/>ex: 2d6+2"] --> B{"Localizacao<br/>1d10"}

    B -->|"1 - Cabeca"| C["Subtrai SP da cabeca"]
    B -->|"2-4 - Tronco"| D["Subtrai SP do tronco"]
    B -->|"5 ou 6 - Bracos"| E["Subtrai SP do braco"]
    B -->|"7-0 - Pernas"| F["Subtrai SP da perna"]

    C --> I{"Passou da armadura?"}
    D --> I
    E --> I
    F --> I

    I -->|"nao"| J["Sem ferimento<br/>a armadura segurou"]
    I -->|"sim"| H["Subtrai BTM<br/>so BODY, 0 a -5<br/>nunca abaixo de 1"]
    H --> Q{"Foi na cabeca?"}
    Q -->|"sim"| G["Dobra o ferimento<br/>x2 depois do BTM"]
    Q -->|"nao"| V{"Mais de 8 pontos<br/>neste acerto?"}
    G --> V
    V -->|"cabeca"| X["Morto"]
    V -->|"membro"| Y["Perda do membro<br/>aviso no chat"]
    V -->|"nao, ou tronco"| K["Soma os pontos na trilha<br/>40 caixas, 4 por nivel"]
    Y --> K
    K -->|"passou de 40"| X

    K --> S["Stun save a cada dano<br/>1d10 menor ou igual a BODY<br/>menos 0 a 9 pelo nivel novo"]
    K --> L["Novo woundLevel<br/>derivado dos pontos"]
    L --> N["Efeito nos atributos<br/>Serio REF -2<br/>Critico REF INT COOL /2<br/>Mortal REF INT COOL /3"]
    L --> M{"Nivel Mortal?"}
    M -->|"sim"| O["Death save na hora, antes do stun,<br/>e a cada turno depois<br/>1d10 menor ou igual a<br/>BODY menos nivel Mortal"]
    O -->|"falhou"| X
    O -->|"estabilizado pelo GM"| Z["Para de rolar<br/>dano novo desfaz"]
```

O que a conferência fixou, e o que ficou para o dono:

- **SP antes de tudo** — a cabeça dobra o dano **que passou** da armadura. Confirmado.
- **O teste "passou da armadura?" vem antes do BTM**, porque é ele que decide se o BTM (com mínimo
  de 1) se aplica: armadura que segurou tudo não gera ferimento. *(O desenho anterior fazia a
  pergunta depois do BTM.)*
- **BTM nunca leva o dano a zero** — mínimo 1 ponto, se a armadura foi vencida. Confirmado.
- **×2 depois do BTM — decisão 6, do dono, em 26/09/2026 (opção A).** O livro dá a regra e não diz
  quando; A é a ordem do texto e a das implementações de fãs. Mínimo de um acerto na cabeça que
  passou da armadura: 2 pontos. A opção B (dobra antes do BTM) seria mais letal por exatamente o
  valor do BTM. Detalhe na [conferência](./CONFERENCIA_CP2020.md#dano--a-ordem-do-pipeline-para-a-fase-d).
- **Não há modificador cumulativo por turno no death save** — o nó antigo dizia "com modificador
  cumulativo", que é do Cyberpunk RED. É BODY menos o nível Mortal, a cada turno.
- **Acerto grave (D.1):** mais de 8 pontos num acerto, depois de tudo — na cabeça mata, num membro o
  perde (S5, S9). O death save em Mortal 0 que o S9 pede ao perder o membro tem **uma fonte só** e
  fica como aviso no chat.
- **Fora do desenho de propósito (ADIAR, decisão 7):** penetração escalonada e cobertura entre
  atirador e alvo. Gatilhos na [conferência](./CONFERENCIA_CP2020.md#o-que-a-fase-d-conferiu).

---

## Máquina de estados do ferimento

**Implementada na Fase C** (C.5 e C.7) — a trilha está em `WOUND_TRACK`
([`src/rules/tables.ts`](../src/rules/tables.ts)), com o nome, o modificador de stun, o nível
Mortal e o efeito de cada caixa. Onze níveis: `woundLevel` 0 é ileso e 1–10 são os dez níveis de quatro caixas de 1 ponto.
**Desde a D.1 a ficha guarda os pontos** (`damagePoints`, 0–40) e o nível é derivado deles: cada
transição abaixo acontece no **primeiro** ponto do nível seguinte.

```mermaid
stateDiagram-v2
    [*] --> Ileso
    Ileso --> Leve: 1 a 4 pontos
    Leve --> Serio: 5 pontos
    Serio --> Critico: 9 pontos
    Critico --> Mortal0: 13 pontos
    Mortal0 --> Mortal1: 17 pontos
    Mortal1 --> Mortal2: 21 pontos
    Mortal2 --> Mortal3: 25 pontos
    Mortal3 --> Mortal4: 29 pontos
    Mortal4 --> Mortal5: 33 pontos
    Mortal5 --> Mortal6: 37 pontos
    Mortal6 --> Morto: dano alem de 40
    Mortal0 --> Morto: falhou death save
    Mortal6 --> Morto: falhou death save
    Ileso --> Morto: mais de 8 na cabeca
    Morto --> [*]

    note left of Serio
        Efeito nos atributos, sem acumular:
        Leve nenhum. Serio REF -2.
        Critico REF INT COOL pela metade.
        Mortal REF INT COOL a um terco.
        Arredonda para cima. MA nunca muda.
    end note

    note right of Mortal0
        Stun save a cada dano: BODY menos
        0 (Leve) ate 9 (Mortal 6).
        Death save em Mortal: na hora do dano
        e a cada turno, BODY menos o nivel
        Mortal, sem acumulo por turno.
        Estabilizado (pelo GM) nao rola;
        dano novo desfaz. (D.5)
    end note
```

> **Morto não é um `woundLevel`.** O modelo tem 0–10, e o 10 é Mortal 6 — **ainda vivo**. Até a
> Fase C o app tratava o 10 como morte e desligava o death save justo ali (o antigo `isDead`, hoje
> `isLastWoundBox`). **Desde a D.1 a morte é um campo à parte da ficha, `isDead`**, escrito pelo
> servidor: dano além de 40, mais de 8 na cabeça (a seta do Ileso vale de qualquer nível) e, na
> D.5, o death save falho.

---

## Schema do Supabase

Desenhado na Fase C porque o **gatilho escrito disparou**: "quando o schema mudar" — a migration
`0007` (Fase B) acrescentou `rooms.sessions`. Só as colunas que carregam relação ou decisão; o
resto está nas migrations.

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "id"
    AUTH_USERS ||--o{ CHARACTER_SHEETS : "user_id"
    PROFILES ||--o{ FRIENDSHIPS : "sender_id e receiver_id"
    PROFILES ||--o{ FRIEND_REQUESTS : "sender_uid e receiver_uid"
    PROFILES ||--o{ DIRECT_MESSAGES : "sender_uid"

    PROFILES {
        uuid id PK
        text cyberpunk_id UK
        text display_name
        text status
    }
    CHARACTER_SHEETS {
        uuid id PK
        uuid user_id FK
        text sheet_id "UK com user_id"
        jsonb data "CharacterSheet inteiro"
    }
    FRIENDSHIPS {
        uuid id PK
        uuid sender_id FK
        uuid receiver_id FK
        text status
    }
    FRIEND_REQUESTS {
        uuid id PK
        uuid sender_uid FK
        uuid receiver_uid FK
    }
    DIRECT_MESSAGES {
        uuid id PK
        text chat_room_id
        uuid sender_uid FK
    }
    ROOMS {
        text code PK
        jsonb room_state "GameRoom transmitido"
        jsonb sessions "SHA-256 dos tokens"
    }
```

- **`rooms` não tem dono nem chave estrangeira** — é estado do servidor, não do usuário. RLS
  ligada com **zero policies**: só a service role do servidor lê e escreve (`0006`).
- **`sessions` é coluna própria, fora do `room_state`** (`0007`, B.4): o `room_state` é o objeto
  transmitido a toda a mesa, e o token de sessão ali dentro vazaria para todos.
- As outras cinco tabelas têm RLS com policies por usuário (`0001`–`0003`), cobertas pelos 56 testes
  de `scripts/test-rls.mjs`. `profiles.email` saiu na `0004`.
- **A Fase C não mexeu no schema.** A `CharacterSheet` mudou de regra, não de forma: o
  `currentStats` continua no `data` por compatibilidade, e o servidor o recalcula.

---

## Diagramas adiados

> **Saiu desta lista na Fase C:** o ER do schema — o gatilho ("quando o schema mudar") disparou
> com a `0007` da Fase B, e o desenho está em [Schema do Supabase](#schema-do-supabase).

Aplicando o [filtro de necessidade](./PLANO_MESTRE.md#-filtro-de-necessidade) aos próprios diagramas
— porque desenho sem sintoma também é overengineering.

| Diagrama | Veredito | Gatilho |
|---|---|---|
| Sequência do handshake (join → token → upgrade → rolagem) | **ADIAR** | Quando a Fase H precisar depurar reconexão. O [`PROTOCOLO_MULTIPLAYER.md`](./PROTOCOLO_MULTIPLAYER.md) já descreve o fluxo em prosa, e ninguém se perdeu nele ainda |
| Reconexão e last-write-wins por `updatedAt` | **ADIAR** | Quando a Fase H achar um bug de convergência de ficha |
| Camadas de token visual | **ADIAR** | Se a Fase F.2 se mostrar confusa na prática. A tabela de tokens na ADR 0006 provavelmente basta |
