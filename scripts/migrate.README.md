# T2.9 — Migração Firebase/Firestore → Supabase

Script: `scripts/migrate-firestore-to-supabase.mjs`

Exporta os dados do Firestore antigo (projeto `concise-waters-p1ttq`, banco
`ai-studio-cyberpunk2020she-...`) e importa no Supabase local — fichas,
amizades, solicitações e mensagens do site anterior.

> ⚠️ **O export exige UMA ação sua** (só você tem acesso ao projeto Google):
> criar uma **service account** e baixar a chave. O import, em seguida,
> roda automático nesta máquina.

---

## Passo 1 — Criar a service account no Google Cloud (2 min)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com) com a
   mesma conta do projeto **`concise-waters-p1ttq`**.
2. Menu **≡ → IAM e administrador → Contas de serviço**.
3. Clique em **+ Criar conta de serviço**:
   - **Nome:** `firestore-export` (qualquer nome serve)
   - **ID:** deixa o que sugerir
   - **Função (Role):** escolha **Firestore → Administrador de Firestore**
     (ou, se não aparecer, **Cloud Datastore Owner**)
   - **Concluir**.
4. Na lista, clique na conta criada → aba **Chaves** → **Adicionar chave →
   Criar nova chave** → **JSON** → **Criar**.
5. O navegador baixa um arquivo `nome-do-arquivo.json`. **Copie para a raiz
   deste projeto** com o nome `firebase-service-account.json`.

> 💡 Este arquivo dá acesso de leitura ao Firestore do projeto. **Não
> commite nem compartilhe.** O `.gitignore` já cobre `*.json` de service
> account? Não — adicione manualmente o nome do arquivo ao `.gitignore`
> (ex.: `firebase-service-account.json`) ou apague-o após a migração.

---

## Passo 2 — Conferir o que existe no Firestore (opcional)

```bash
node scripts/migrate-firestore-to-supabase.mjs --command=validate \
  --service-account=firebase-service-account.json
```

Lista as coleções e quantos documentos cada uma tem. Se aparecer
"(nenhuma)", o banco está vazio — e a migração pode ser pulada.

## Passo 3 — Exportar

```bash
node scripts/migrate-firestore-to-supabase.mjs --command=export \
  --service-account=firebase-service-account.json \
  --output=data/firestore-export.json
```

Gera `data/firestore-export.json` com `profiles`, `friendships`,
`friendRequests`, `directMessages` e `characterSheets`.

## Passo 4 — Importar no Supabase local

```bash
# Simulação (não grava nada):
node scripts/migrate-firestore-to-supabase.mjs --command=import \
  --input=data/firestore-export.json --dry-run

# Importar de verdade (transação única; re-executar NÃO duplica):
node scripts/migrate-firestore-to-supabase.mjs --command=import \
  --input=data/firestore-export.json
```

O import aplica o SQL direto no Postgres local (porta 54322 do
`supabase start`): sem senha, usa `docker exec`; com senha, passe
`--postgres=postgresql://user:pass@127.0.0.1:54322/postgres`.

---

## Como a identidade é mapeada

| Firebase (uid string) | Supabase (uuid) |
|---|---|
| `abc123...` (usuário real) | `uuid_v5(ns_projeto, uid)` — **determinístico** |
| usuário com **e-mail já no Supabase** | **reutiliza a conta existente** — fichas/amizades entram na sua conta atual (importante para o login Google) |
| `npc_*` (demonstração) | **ignorado** (continua no localStorage do app) |

- **Match por e-mail:** antes de criar, o script consulta `auth.users` pelo
  e-mail do Firestore. Se a conta já existe (ex.: a conta Google com que
  você testa o app), o uuid dela é usado — as fichas antigas caem na sua
  conta atual, sem duplicado.
- Usuários novos ganham **e-mail confirmado** e **senha placeholder**
  (inválida de propósito) — o dono redefine a senha no primeiro login com
  o recurso "Esqueci minha senha" do Supabase.
- **Idempotente:** usuários/fichas/amizades usam `on conflict do nothing`/
  `do update`; solicitações e mensagens **só importam se a tabela estiver
  vazia** (evita duplicar em re-execução). ⚠️ Se o banco local já tiver
  mensagens/solicitações de testes anteriores, a importação delas é
  pulada com aviso — para re-importar, limpe antes:
  `docker exec supabase_db_<nome> psql -U postgres -d postgres -c "truncate public.direct_messages, public.friend_requests;"`

## E os usuários do Firebase Auth (senha)?

O script importa **perfis + dados**, não as senhas criptografadas do
Firebase (scrypt). Se houver usuários reais que precisam manter a senha,
a migração exige o passo extra de exportar os hashes scrypt do Firebase —
não é possível sem os parâmetros do projeto. Para a maioria dos casos
(banco de demonstração/teste), o caminho com redefinição de senha é o
prático.
