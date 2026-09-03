# Alvos de deploy arquivados

> Arquivado na Fase A (`A.6` do [`PLANO_MESTRE.md`](../PLANO_MESTRE.md), DOC-02) em 03/09/2026.

O backend tinha **seis alvos de deploy configurados e nenhum eleito** (DOC-02): Railway, Render,
Fly.io, Docker genérico, e o frontend estático em Vercel/Netlify. Sustentar walkthroughs completos
para plataformas que nunca são usadas é trabalho de manutenção sem retorno — toda vez que uma env var
muda, três guias precisam mudar junto.

**Render é o único alvo de backend.** Ver a regra 2 do
[contrato de custo zero](../PLANO_MESTRE.md#-contrato-de-custo-zero): as 750 h/mês grátis são por
*workspace*, compartilhadas com o `newra-news-api` — rodar em duas plataformas ao mesmo tempo não
economiza nada e só duplica configuração para manter em dia.

Estes arquivos ficam aqui como referência caso o Render pare de ser viável (mudança de preço, corte de
free tier). Não são mantidos ativamente e podem estar desatualizados frente ao `server.ts` atual —
confira as env vars contra [`docs/DEPLOY.md`](../DEPLOY.md) antes de usar.

| Arquivo | Plataforma | Por que existia |
|---|---|---|
| `fly.toml` | Fly.io | Alternativa via Dockerfile, HTTPS + healthcheck automáticos |
| `railway.toml` | Railway | Alternativa mais simples, detecção automática do config |

O guia de deploy ativo é [`docs/DEPLOY.md`](../DEPLOY.md), que documenta só o Render.
