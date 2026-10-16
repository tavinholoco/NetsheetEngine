# ADR 0007 — A passagem de bastão entre instâncias no deploy

- **Status:** Aceito — implementado na H.3d (código no PR da H.3d.3; a tabela na migration `0008`, PR #47)
- **Data:** 15/10/2026
- **Decisores:** o dono (o H.13 virou FAZER no PR #46); o desenho, na H.3d do plano
- **Fase do plano:** H (varredura do multiplayer) — a caixa H.3d

## Contexto

O serviço roda **uma instância** no Render, no plano gratuito, com a mesa inteira na memória do processo
(a sala, o doc Yjs do grid, as sessões, os sockets) e um espelho no Supabase (`rooms`, gravado com
*debounce*). Todo deploy é *zero-downtime*: o Render liga a instância nova enquanto a velha ainda serve, e só
manda tráfego à nova quando ela passa no health check.

O que isso fazia com uma mesa aberta foi medido no ar (H.1j, 14/10/2026) e no log do Render (H.3d.0):

| BRT, 14/10 | O que aconteceu |
|---|---|
| 22:34:47 | o processo novo começa |
| 22:34:48,4 | a nova **lê o banco** (o restore) e abre a porta |
| 22:34:53,5 | a velha leva o `SIGTERM` — na troca do tráfego, 5 s depois |
| ~22:35:06 | os sockets dos jogadores caem (pelo relógio local; o caminho até o navegador segurou ~13 s) |

A nova leu o banco às 22:34:48,4 e nunca mais. Tudo o que chegou à velha pelo WebSocket depois disso —
chat, rolagem, token movido — **sumiu** quando os jogadores reconectaram na nova (H.13: 1 mensagem no ar, 1 no
ensaio local fiel ao Render). O que foi por REST depois da troca caiu na nova e ficou. A regra de processo
"nunca mergear com mesa aberta" cobria o merge do dono, mas não qualquer troca de instância.

**Premissas que o desenho usa, medidas na H.3d.0:** a velha recebe o `SIGTERM` (e roda o `flushAllPending`);
o serviço **não tem** *Health Check Path* — o Render testa a **porta TCP** —, e o servidor só chama o `listen`
depois do restore; da porta aberta à troca, ~5 s.

## Opções consideradas

| Opção | O que faz | Por que não (ou sim) |
|---|---|---|
| **Regra de processo só** | "nunca mergear com mesa aberta" | É a versão 10× menor e já existia; não cobre o "Manual Deploy", uma mudança de variável no painel, nem o merge distraído. O dono escolheu tirar a perda, não só evitá-la |
| **A nova relê o banco quando os jogadores voltam** | quando o primeiro socket chega à nova, ela relê a `rooms` | Troca uma perda por outra: o que o GM fez por REST na nova antes disso seria sobrescrito pelo que a velha gravou no `SIGTERM` |
| **Deploy sem sobreposição** | desligar o *zero-downtime* | Só com disco persistente no Render — pago. Fere o contrato de custo zero |
| **Aviso pelo Realtime do Supabase** | a nova publica "vou assumir" num canal | A chave anônima é **pública** (vai no bundle): qualquer visitante mandaria o servidor parar |
| **A passagem de bastão** (escolhida) | uma linha no banco diz quem serve; a nova pede, a velha entrega, e só então a nova lê | Custo zero (uma tabela de uma linha, uma escrita a cada 2 s com o serviço acordado); só a service role escreve; o preço é um "reconectando" curto a cada deploy, no lugar da perda em silêncio |

## Decisão

**Uma instância manda na mesa por vez.** O bastão é a linha única da `instance_lease` (`0008`): quem serve
(`holder`), a marca de vida (`holder_beat`), quem pediu (`claimant`) e quem entregou (`released_by`).

```
nova:  pede (claimant) ──── espera, porta FECHADA ────────────── assume → lê o banco → abre a porta
velha: serve … renova (2 s) → vê o pedido → recusa ações (503), fecha sockets (1012), grava tudo → marca que entregou
Render:                                                                       porta aberta → ~5 s → troca o tráfego → SIGTERM na velha
```

1. **A ordem do boot** (`startServer`): pedir o bastão → esperar → ler o banco → abrir a porta.
   **Nunca abrir a porta antes do bastão**: com o teste TCP, porta aberta é "pronta" para o Render.
2. **A velha renova a marca de vida a cada 2 s** e, na renovação, vê o pedido. Entrega: as rotas da mesa
   respondem `503 server_restarting` (o health segue 200 — o Render reinicia instância que não responde), o
   WebSocket fecha com **1012** (*Service Restart*), o stream SSE acaba com `retry: 1500`, o vigia de presença e
   o coletor param, a mesa é gravada — esperando o que estava em voo, e tentando de novo o que falhou — e a
   persistência congela. Só então ela marca que entregou.
3. **A nova assume** quando a velha entregou, quando a marca de vida passou de **6 s** (a velha morreu, ou o
   serviço hibernava — no `SIGTERM` da hibernação ela entrega, e a próxima assume na hora) ou quando não há
   ninguém.
4. **O cliente atravessa a troca sozinho:** o `apiFetch` tenta de novo a cada 1,5 s diante do
   `server_restarting` (até 45 s), e o WebSocket fechado com 1012 volta a cada 1,5 s (até 1 min), sem a espera
   crescente da H.3b. A ação do jogador demora; não some.
5. **No `SIGTERM`:** quem ainda serve entrega (grava e marca); quem já entregou **sai sem gravar nada** — o
   banco já é da nova. Antes, o `flushAllPending` da velha gravava por cima do que a nova já tinha restaurado.

**Os casos de borda:**

| Caso | O que acontece |
|---|---|
| A velha viva não entrega (o primeiro deploy, com a velha sem este código; ou travada) | A nova força depois de **30 s**. A velha, na renovação seguinte, vê que o bastão não é dela e para **sem gravar** (`lost`). No primeiro deploy a velha nem renova — a marca está vazia, e a nova assume na hora: a perda daquela troca é a de antes |
| Banco fora do ar no boot | Sem resposta nem ao pedido em **5 s**, a nova sobe sem bastão (`unavailable`) — como antes da H.3d. Sem banco, o restore também falha; esperar só atrasaria o despertar |
| Erro de rede na renovação | Não é troca: segue servindo e tenta na próxima |
| A velha entregou e ninguém assumiu (a nova morreu no boot) | Depois de **60 s**, a velha confere a linha; se o bastão ainda é dela, sai com erro — o Render a religa, e ela assume de novo e lê o banco (`lease_orphaned_exit`) |
| Dev (`npm run dev`) e testes | Sem bastão: só em produção e com banco. O `tsx` reinicia a cada arquivo salvo, sem `SIGTERM` no Windows |

## Consequências

- **Um "reconectando" a cada deploy**, no lugar da perda em silêncio: ~7–9 s previstos pela H.3d.0 (a velha vê o
  pedido em ≤ 2 s, entrega, a nova lê e abre a porta, o Render troca em ~5 s). Medido no ar na H.3d.4.
- **Uma escrita no banco a cada 2 s com o serviço acordado.** Não mantém o serviço acordado: a hibernação do
  Render conta tráfego **de entrada**, e a renovação é de saída. No Supabase gratuito, uma linha atualizada.
- **A regra "nunca mergear com mesa aberta"** só sai do `CLAUDE.md` e do `DEPLOY.md` quando a H.3d.4 provar a
  perda zero no ar.
- **Segurança (portão da H, adendo da H.3d):** quem escreve na `instance_lease` manda o servidor parar — só a
  service role tem privilégio nela (anon e authenticated revogados, RLS sem política). Nenhuma rota nova, nenhum
  dado novo para o cliente: o `server_restarting` não carrega nada da mesa.
- **O que este ADR não resolve:** o que um navegador manda por um socket que o caminho até ele ainda segura
  depois de a instância morrer (os ~13 s do H.1j). Com o bastão, a velha fecha os sockets **antes** de morrer, e
  o caso some do deploy; numa queda brusca (o *crash*), continua — como antes.

## Gatilho para rever

- O "reconectando" medido no ar passar de **30 s**, ou um jogador perder ação numa troca (o `lease_forced` ou o
  `lease_orphaned_exit` no log de uma sessão real).
- O serviço passar a ter mais de uma instância ao mesmo tempo **fora** do deploy (o plano pago, ou o
  *autoscaling*) — aí o bastão vira o pedaço pequeno de um problema maior (a mesa na memória de um processo só,
  ADR 0002).
