# Backup do banco — runbook

> **Decisão 8 do [plano](./PLANO_MESTRE.md#-decisões-tomadas-02092026) (29/09/2026, R.10):** o projeto fica no
> plano gratuito do Supabase, que **não faz backup automático** — só os planos Pro, Team e Enterprise
> fazem ([docs](https://supabase.com/docs/guides/platform/backups)). O backup é um **dump manual**,
> guardado **fora do repositório**. É o que a própria doc do Supabase recomenda ao plano gratuito.
>
> *A decisão 4 (03/09) supunha um backup diário gratuito que não existe. Até 29/09 o projeto não tinha
> backup nenhum.*

## Quando

| Momento | Por quê |
|---|---|
| **Todo mês**, no dia 1º | Limita a perda a um mês de fichas, no pior caso |
| **Antes de mergear o PR de uma migration** (passo 5 do ritual de encerramento) | Migration é a única mudança que o código faz no banco. Se ela destruir dado, o dump de minutos antes é o ponto de volta |
| Antes de qualquer operação manual no banco de produção | Idem |

Anote cada dump na tabela do [fim deste arquivo](#registro-de-backups).

## Como

Pré-requisitos: **Docker rodando** (o CLI executa o `pg_dump` num contêiner) e o CLI linkado ao projeto
(`supabase/.temp` no checkout; o login do CLI é o da máquina).

```bash
npm run backup:db
```

O script ([`scripts/backup-db.ts`](../scripts/backup-db.ts)) grava três arquivos em
`~/netsheet-backups/AAAA-MM-DD/` (ou em `NETSHEET_BACKUP_DIR`), no formato do
[guia oficial de backup e restauração](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore):

| Arquivo | Comando | Conteúdo |
|---|---|---|
| `roles.sql` | `supabase db dump --linked --role-only` | Papéis do cluster |
| `schema.sql` | `supabase db dump --linked` | Esquema — sem `auth`, `storage` e extensões, que o Supabase recria |
| `data.sql` | `supabase db dump --linked --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes` | **Todos os dados, inclusive `auth.users`** |
| `MANIFEST.txt` | — | Data, versão do CLI, tamanho e SHA-256 de cada arquivo, e **linhas por tabela** |

As travas do script:

- **Recusa destino dentro do repositório.** O repositório é **público** e o dump tem dado pessoal. O
  `.gitignore` ainda barra `roles.sql`, `schema.sql`, `data.sql`, `backups/` e `netsheet-backups/` na
  raiz, para o caso de um dump feito à mão.
- **Nunca sobrescreve:** um segundo dump no mesmo dia vai para `AAAA-MM-DD-2`.
- **Conta as linhas por tabela sem imprimir conteúdo.** É assim que se confere que o dump está
  inteiro: compare com o dump anterior; uma tabela que zerou sem motivo é sinal de problema.

> ⚠️ **Nunca rode o backup ao mesmo tempo que o `db-sync` (merge no `master`) ou o keepalive do CI.**
> Os três usam o mesmo papel temporário do CLI (`cli_login_postgres`), e cada execução troca a senha
> dele — um derruba o outro com `28P01`. Confira antes: `gh run list --limit 3`.

## O que o dump NÃO tem

| Fica de fora | Consequência | Gatilho para mudar |
|---|---|---|
| **Arquivos do Storage** (avatares) | Numa restauração, cada jogador sobe a foto de novo. A metadata (`storage.objects`) vem no `data.sql`, os arquivos não | Alguém guardar no Storage algo que não se recria |
| Configuração de Auth (provedores, Google OAuth, URLs de redirect) | Refazer no painel do projeto novo — está no [`DEPLOY.md`](./DEPLOY.md) | — |
| As salas em andamento (`rooms`) | **Vêm** no `data.sql`, mas envelhecem rápido e o coletor as recolhe em 24 h (B.5) | — |

## Onde guardar

**Fora do repositório e fora desta máquina** — o dump na mesma máquina do projeto não sobrevive a
um disco perdido. Uma pasta do seu armazenamento pessoal na nuvem serve.

O `data.sql` tem **e-mail e hash de senha** de toda conta (`auth.users`), perfis e mensagens diretas.
**Cifre antes de copiar para a nuvem** — por exemplo, um `.7z` com senha (AES-256) — e guarde a senha
num gerenciador de senhas, não junto do arquivo.

## Como restaurar

Num **projeto Supabase novo** (o mesmo plano gratuito), com o `psql` instalado e a *connection
string* do projeto novo — o comando é o do guia oficial:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "<CONNECTION_STRING do projeto novo>"
```

Depois: apontar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e as `VITE_SUPABASE_*` para o projeto novo
(Render e build), refazer a configuração de Auth, trocar o `SUPABASE_PROJECT_REF` do CI, e rodar
`npx supabase migration list --linked` para conferir que a tabela de controle veio junto.

**Um backup que nunca foi restaurado não é backup** — por isso a M.0 exige uma restauração de
verdade antes do fim do plano. Ver o registro abaixo.

## Registro de backups

Uma linha por dump. O conteúdo fica fora do repositório; aqui fica só que ele existe e foi conferido.

> **`rooms` subir e descer é esperado — não é alarme.** A tabela guarda as mesas em andamento, e mesa
> sem ninguém ativo por 24 h sai do banco: pelo coletor (B.5) e, desde a Fase E (E.03, 30/09/2026), já
> **no boot** do servidor. A sala velha do primeiro backup (29/09) sai no primeiro boot depois da
> suspensão de setembro — `rooms` 1 → 0 no backup de 01/10 é isso. O alarme vale para as tabelas de
> gente: `auth.users`, `character_sheets`, `profiles` e `direct_messages`.

| Data | Motivo | Linhas (principais tabelas) | Restaurado? | Observação |
|---|---|---|---|---|
| 29/09/2026 | Primeiro backup (R.10) | `auth.users` 0 · `character_sheets` 0 · `profiles` 0 · `rooms` 1 · `storage.buckets` 1 | Não — ver abaixo | **A produção ainda não tem usuário nenhum**: o backup existe antes do primeiro dado real, não depois de perdê-lo. 16,6 kB de `data.sql`; hashes no `MANIFEST.txt` |
| 01/10/2026 | Mensal | `auth.users` 0 · `character_sheets` 0 · `profiles` 0 · `rooms` 0 · `direct_messages` 0 | Não | Ainda sem usuário. `rooms` 1 → 0 é a sala velha recolhida no boot (nota acima). `auth.flow_state` 2: login OAuth começado e não concluído, sem conta criada. 12,0 kB de `data.sql`. O Docker não subiu (`sailor-ingest.sock`) e o contorno abaixo resolveu de novo |

**A restauração de teste espera o primeiro dado real.** O alvo certo é um projeto Supabase **novo**
(o gratuito permite dois), com as mesmas versões do schema `auth` da produção. O Supabase local do
Docker tem outra versão do `auth`, e o `COPY` das tabelas dele falharia por coluna, não por defeito
do backup. E um teste com uma linha só provaria pouco. **Gatilho:** a primeira linha deste registro
com `character_sheets` acima de zero — e a M.0 do plano exige a restauração antes do fim.

## Se o Docker não subir (Windows)

Visto em 29/09/2026 nesta máquina: o Docker Desktop abre a janela *"An unexpected error occurred"*,
com as opções **Quit** e **Reset to factory defaults**, e o log do *backend*
(`%LOCALAPPDATA%\Docker\log\host\com.docker.backend.exe.log`) diz que não consegue renomear um
*socket* velho — `...\Docker\run\sailor-ingest.sock` ou `...\docker-secrets-engine\engine.sock` —
com "Não é possível o acesso ao arquivo pelo sistema".

**Não use o "Reset to factory defaults"** — ele apaga contêineres e volumes, inclusive o Supabase
local. O contorno reversível: feche o Docker Desktop, renomeie **as duas** pastas **ao mesmo tempo**
(`%LOCALAPPDATA%\Docker\run` e `%LOCALAPPDATA%\docker-secrets-engine`, para `*.orfao-<data>`) e abra
o Docker de novo. Renomear uma só não basta: o arranque que quebra no segundo *socket* deixa um
*socket* velho novo na primeira pasta.
