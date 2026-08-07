#!/usr/bin/env node
/**
 * ============================================================
 * NETSHEET ENGINE — MIGRAÇÃO T2.9 (Firebase/Firestore → Supabase)
 * ============================================================
 * Exporta os dados do Firestore antigo (projeto `concise-waters-p1ttq`,
 * banco criado pelo AI Studio) e importa no Supabase local, preservando
 * fichas, amizades, solicitações e mensagens do site anterior.
 *
 * ESTRATÉGIA DE IDENTIDADE
 * ------------------------
 * O Firebase usa UIDs string; o Supabase usa uuid. O script mapeia de
 * forma DETERMINÍSTICA: uuid_v5(ns_projeto, uid_firebase). Assim o mesmo
 * uid antigo sempre gera o mesmo uuid — a migração é idempotente e pode
 * ser re-executada sem duplicar.
 *   - Para cada usuário do Firestore, o script cria uma linha em
 *     auth.users (senha placeholder, e-mail confirmado) → o trigger T2.6
 *     já cria o profile; o script então atualiza o profile com os dados
 *     migrados (display_name, bio, avatar, status, cyberpunk_id).
 *   - Usuários cujo E-MAIL já existe no Supabase (por exemplo, a conta
 *     com que você testou o login Google) são REUTILIZADOS: o uuid
 *     existente é usado e as fichas/amizades antigas entram na conta.
 *   - NPCs de demonstração (uid `npc_*`) e mensagens com participantes
 *     ausentes são ignorados com aviso.
 *   - O dono de cada usuário migrado redefine a senha no primeiro login
 *     (placeholder 'SCRAM' inválido de propósito + e-mail confirmado,
 *     fluxo "Esqueci minha senha" do Supabase).
 *
 * USO
 * ---
 *   # 1) (você) Exportar do Firestore — precisa da service account:
 *   node scripts/migrate-firestore-to-supabase.mjs --command=export \
 *     --service-account=firebase-service-account.json \
 *     --output=data/firestore-export.json
 *
 *   # 2) Importar no Supabase local (também aceita JSON já exportado):
 *   node scripts/migrate-firestore-to-supabase.mjs --command=import \
 *     --input=data/firestore-export.json [--dry-run]
 *
 *   # 3) Conferir o que existe no Firestore (sem exportar tudo):
 *   node scripts/migrate-firestore-to-supabase.mjs --command=validate \
 *     --service-account=firebase-service-account.json
 *
 * O import aplica o SQL diretamente no Postgres local (porta 54322 do
 * `supabase start`): sem senha, usa `docker exec` no container; com senha,
 * use --postgres=postgresql://user:pass@host:port/db.
 * ============================================================
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/* ------------------------------------------------------------------
   HELPERS DE AMBIENTE
   ------------------------------------------------------------------ */

function loadDotEnv(file) {
  const path = join(ROOT, file);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function getFirebaseConfig() {
  try {
    return JSON.parse(readFileSync(join(ROOT, 'docs/legacy/firebase-applet-config.json'), 'utf8'));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------
   UUID v5 DETERMINÍSTICO (mapeamento de identidade)
   ------------------------------------------------------------------ */

function uuid5(namespaceBytes, name) {
  const ns = Buffer.from(namespaceBytes);
  const nameBuf = Buffer.from(name, 'utf8');
  const h = createHash('sha1').update(ns).update(nameBuf).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const b = h.subarray(0, 16);
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Namespace de projeto: uuid5(DNS namespace, projectId) — fixo por projeto. */
function projectNamespace(projectId) {
  const DNS = Buffer.from('6ba7b810-9dad-11d1-80b4-00c04fd430c8', 'hex');
  return Buffer.from(uuid5(DNS, `firestore://${projectId}`).replace(/-/g, ''), 'hex');
}

/** Firebase uid (string) → uuid determinístico. */
function firebaseUidToUuid(firebaseUid, ns) {
  return uuid5(ns, `uid:${firebaseUid}`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isRealUserUid(uid) {
  return typeof uid === 'string' && uid.length > 0 && !uid.startsWith('npc_') && !UUID_RE.test(uid);
}

/* ------------------------------------------------------------------
   FORMATO NEUTRO DO EXPORT (data/firestore-export.json)
   {
     "projectId": "...",
     "exportedAt": "ISO",
     "profiles":        [{ uid, cyberpunkId, displayName, bio, avatarIcon, status, email?, createdAt? }],
     "friendRequests":  [{ id, senderUid, receiverUid, senderName, senderCyberpunkId, senderAvatar, timestamp }],
     "friendships":     [{ aUid, bUid, createdAt? }],          // pares aceitos
     "directMessages":  [{ chatRoomId, senderUid, senderName, text, timestamp }],
     "characterSheets": [{ uid, sheetId, handle, role, data, updatedAt }]
   }
   ------------------------------------------------------------------ */

function toIso(v) {
  if (!v) return new Date().toISOString();
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v._seconds != null) return new Date(v._seconds * 1000).toISOString();
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  return new Date().toISOString();
}

/* ------------------------------------------------------------------
   COMANDO: EXPORT (Firestore → JSON)
   ------------------------------------------------------------------ */

async function exportFromFirestore({ serviceAccount, output, projectId, firestoreDatabaseId }) {
  const { cert, initializeApp, firestore } = await import('firebase-admin');
  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId
  });
  const db = firestore(app, firestoreDatabaseId);

  const out = {
    projectId,
    exportedAt: new Date().toISOString(),
    profiles: [],
    friendRequests: [],
    friendships: [],
    directMessages: [],
    characterSheets: []
  };

  const log = (msg) => console.log(`  · ${msg}`);

  // profiles
  const profSnap = await db.collection('profiles').get();
  for (const d of profSnap.docs) {
    const p = d.data();
    out.profiles.push({
      uid: d.id,
      cyberpunkId: p.cyberpunkId || p.cyberpunk_id || null,
      displayName: p.displayName || p.display_name || 'Edgerunner',
      bio: p.bio || '',
      avatarIcon: p.avatarIcon || p.avatar_icon || 'cpu',
      status: p.status || 'offline',
      email: p.email || null,
      createdAt: toIso(p.createdAt || p.created_at)
    });
  }
  log(`${out.profiles.length} perfis`);

  // friends/{uid}/friendships → pares aceitos
  const friendsSnap = await db.collection('friends').get();
  for (const ownerDoc of friendsSnap.docs) {
    const subs = await ownerDoc.ref.collection('friendships').get();
    for (const f of subs.docs) {
      const data = f.data();
      const status = data.status || 'accepted';
      if (status !== 'accepted') continue;
      const aUid = ownerDoc.id < f.id ? ownerDoc.id : f.id;
      const bUid = ownerDoc.id < f.id ? f.id : ownerDoc.id;
      out.friendships.push({ aUid, bUid, createdAt: toIso(data.createdAt || data.created_at) });
    }
  }
  log(`${out.friendships.length} amizades aceitas`);

  // friendRequests
  const reqSnap = await db.collection('friendRequests').get();
  for (const d of reqSnap.docs) {
    const r = d.data();
    out.friendRequests.push({
      id: d.id,
      senderUid: r.senderUid,
      receiverUid: r.receiverUid,
      senderName: r.senderName || '',
      senderCyberpunkId: r.senderCyberpunkId || '',
      senderAvatar: r.senderAvatar || '',
      timestamp: toIso(r.timestamp || r.createdAt || r.created_at)
    });
  }
  log(`${out.friendRequests.length} solicitações pendentes`);

  // directMessages/{roomId}/messages
  const roomsSnap = await db.collection('directMessages').get();
  for (const room of roomsSnap.docs) {
    const msgs = await room.ref.collection('messages').get();
    for (const m of msgs.docs) {
      const data = m.data();
      out.directMessages.push({
        chatRoomId: room.id,
        senderUid: data.senderUid,
        senderName: data.senderName || '',
        text: data.text || '',
        timestamp: toIso(data.timestamp || data.createdAt || data.created_at)
      });
    }
  }
  log(`${out.directMessages.length} mensagens diretas`);

  // characterSheets/{uid}/sheets/{sheetId}
  const sheetsRoot = await db.collection('characterSheets').get();
  for (const userDoc of sheetsRoot.docs) {
    const subs = await userDoc.ref.collection('sheets').get();
    for (const s of subs.docs) {
      const data = s.data();
      out.characterSheets.push({
        uid: userDoc.id,
        sheetId: data.id || s.id,
        handle: data.handle || '',
        role: data.role || '',
        data: data.data || data,
        updatedAt: toIso(data.updatedAt || data.updated_at)
      });
    }
  }
  log(`${out.characterSheets.length} fichas`);

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(out, null, 2));
  log(`export salvo em ${output}`);
}

/* ------------------------------------------------------------------
   COMANDO: VALIDATE (conta coleções sem exportar tudo)
   ------------------------------------------------------------------ */

async function validateFirestore({ serviceAccount, projectId, firestoreDatabaseId }) {
  const { cert, initializeApp, firestore } = await import('firebase-admin');
  const app = initializeApp({ credential: cert(serviceAccount), projectId });
  const db = firestore(app, firestoreDatabaseId);

  const collections = await db.listCollections();
  console.log(`\nColeções encontradas em Firestore ("${firestoreDatabaseId}"):`);
  if (collections.length === 0) {
    console.log('  (nenhuma — o banco está vazio ou foi criado sem uso)');
  }
  for (const c of collections) {
    const snap = await c.get();
    console.log(`  📁 ${c.id}: ${snap.size} documentos`);
    if (c.id === 'friends' && snap.size > 0) {
      const first = snap.docs[0];
      const subs = await first.ref.listCollections();
      console.log(`       subcoleções de "${first.id}": ${subs.map((s) => s.id).join(', ') || '(nenhuma)'}`);
    }
    if (c.id === 'characterSheets' && snap.size > 0) {
      const first = snap.docs[0];
      const subs = await first.ref.listCollections();
      console.log(`       subcoleções de "${first.id}": ${subs.map((s) => s.id).join(', ') || '(nenhuma)'}`);
    }
  }
}

/* ------------------------------------------------------------------
   COMANDO: IMPORT (JSON → Supabase)
   ------------------------------------------------------------------ */

function pgEscape(value) {
  if (value == null) return 'NULL';
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function getPgConfig(args) {
  // --postgres=postgresql://user:pass@host:port/db (ou --pg-host etc.)
  const explicit = args['postgres'];
  if (explicit) {
    const url = new URL(explicit);
    return {
      host: url.hostname || '127.0.0.1',
      port: Number(url.port || 54322),
      user: decodeURIComponent(url.username || 'postgres'),
      password: decodeURIComponent(url.password || ''),
      database: url.pathname.slice(1) || 'postgres'
    };
  }
  return {
    host: args['pg-host'] || '127.0.0.1',
    port: Number(args['pg-port'] || 54322),
    user: args['pg-user'] || 'postgres',
    password: args['pg-password'] || '',
    database: args['pg-db'] || 'postgres'
  };
}

/**
 * Aplica o SQL gerado no Postgres local. Prioriza conexão pg; se a senha
 * não vier configurada, usa `docker exec` (socket local — funciona sem senha
 * no stack do `supabase start`).
 */
async function runSql(pgConfig, sql) {
  if (pgConfig.password) {
    const { default: pg } = await import('pg');
    const client = new pg.Client(pgConfig);
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
    return 'pg';
  }

  // Sem senha → docker exec no container do Supabase (conta local do docker).
  const { execSync } = await import('node:child_process');
  const container = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_cyberpunk-2020-sheet-builder-_-prd-suite';
  execSync(`docker exec -i ${container} psql -U postgres -d ${pgConfig.database} -v ON_ERROR_STOP=1`, {
    input: sql,
    encoding: 'utf8'
  });
  return 'docker';
}

async function importToSupabase({ input, dryRun, args }) {
  if (!existsSync(input)) {
    console.error(`❌ Arquivo de export não encontrado: ${input}`);
    process.exit(1);
  }
  const exportData = JSON.parse(readFileSync(input, 'utf8'));
  const pgConfig = getPgConfig(args);

  const ns = projectNamespace(exportData.projectId || 'unknown-project');
  const stats = { profiles: 0, created: 0, linked: 0, friendships: 0, requests: 0, messages: 0, sheets: 0, skipped: [] };
  const log = (msg) => console.log(`  ${msg}`);

  console.log(`\n🧬 Supabase local: ${pgConfig.host}:${pgConfig.port}/${pgConfig.database} (${dryRun ? 'DRY-RUN — nada será gravado' : 'modo real'})`);

  // ---- 1) Perfis: resolve identidade (uuid determinístico OU conta existente
  // pelo e-mail) e monta o SQL de auth.users + profiles. O trigger T2.6 cria
  // o profile no insert de auth.users; o upsert abaixo atualiza com os dados.
  const profiles = exportData.profiles || [];
  console.log(`\n[1/5] Perfis (${profiles.length}):`);
  const sql = [
    '-- ============================================================',
    '-- NETSHEET ENGINE — IMPORT T2.9 (gerado pelo migrate-firestore-to-supabase.mjs)',
    '-- ============================================================',
    'begin;'
  ];

  // Mapa firebaseUid → uuid final (determinístico ou da conta existente)
  const fireUidToUuid = new Map();

  for (const p of profiles) {
    const fireUid = p.uid;
    if (!isRealUserUid(fireUid)) {
      stats.skipped.push(`perfil ${fireUid} (uid não-gerenciável)`);
      continue;
    }
    const deterministicUuid = firebaseUidToUuid(fireUid, ns);
    const email = p.email || `${fireUid}@migrated.nightcity`;
    const passwordHash = `SCRAM`; // placeholder — usuário precisará redefinir senha

    if (dryRun) {
      fireUidToUuid.set(fireUid, deterministicUuid);
      stats.created++;
      log(`➕ (dry-run) criaria usuário ${email} → ${deterministicUuid}`);
      continue;
    }

    // Já existe uma conta no Supabase com esse e-mail? (ex.: login Google)
    // Se sim, reutiliza a conta existente — as fichas antigas entram nela.
    let finalUuid = deterministicUuid;
    if (p.email) {
      const existing = await runQuery(pgConfig, {
        text: 'select id from auth.users where email = $1 limit 1',
        values: [p.email]
      });
      if (existing && existing.length > 0) {
        finalUuid = existing[0].id;
        stats.linked++;
        log(`🔗 ${p.cyberpunkId || fireUid} (${email}) → conta existente ${finalUuid}`);
      }
    }
    fireUidToUuid.set(fireUid, finalUuid);

    // auth.users: só insere se ainda não existe (uuid determinístico)
    const userMeta = JSON.stringify({ display_name: p.displayName || 'Edgerunner' });
    sql.push(
      `insert into auth.users (id, email, email_confirmed_at, encrypted_password, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
       values (${pgEscape(finalUuid)}, ${pgEscape(email)}, now(), ${pgEscape(passwordHash)},
               '{"provider":"email","providers":["email"]}', ${pgEscape(userMeta)}::jsonb,
               'authenticated', 'authenticated', now(), now())
       on conflict (id) do nothing;`
    );
    // profiles: o trigger T2.6 cria ao inserir auth.users; atualiza com os dados
    // migrados (a coluna email foi removida na migration 0004 — o e-mail vive no JWT)
    sql.push(
      `insert into public.profiles (id, cyberpunk_id, display_name, bio, avatar_icon, status)
       values (${pgEscape(finalUuid)}, ${pgEscape(p.cyberpunkId || generateFallbackId(finalUuid))}, ${pgEscape(p.displayName || 'Edgerunner')}, ${pgEscape(p.bio || '')}, ${pgEscape(p.avatarIcon || 'cpu')}, ${pgEscape(['online', 'inativo', 'em jogo', 'offline'].includes(p.status) ? p.status : 'offline')})
       on conflict (id) do update set cyberpunk_id = excluded.cyberpunk_id, display_name = excluded.display_name, bio = excluded.bio, avatar_icon = excluded.avatar_icon, status = excluded.status;`
    );
    stats.created++;
    log(`➕ ${email} → ${finalUuid}`);
  }
  log(`→ ${stats.created} preparados | ${stats.linked} vinculados a conta existente (por e-mail)`);

  // ---- 2) Amizades aceitas ----
  const friendships = exportData.friendships || [];
  console.log(`\n[2/5] Amizades (${friendships.length}):`);
  const profileUuids = new Set(fireUidToUuid.values());

  for (const f of friendships) {
    const aUid = fireUidToUuid.get(f.aUid);
    const bUid = fireUidToUuid.get(f.bUid);
    if (!aUid || !bUid || !profileUuids.has(aUid) || !profileUuids.has(bUid)) {
      stats.skipped.push(`amizade ${f.aUid}↔${f.bUid} (participante ausente)`);
      continue;
    }
    const [s, r] = aUid < bUid ? [aUid, bUid] : [bUid, aUid];
    if (dryRun) { stats.friendships++; continue; }
    sql.push(
      `insert into public.friendships (sender_id, receiver_id, status, created_at)
       values (${pgEscape(s)}, ${pgEscape(r)}, 'accepted', ${pgEscape(f.createdAt)}::timestamptz)
       on conflict (sender_id, receiver_id) do nothing;`
    );
    stats.friendships++;
  }
  log(`→ ${stats.friendships} amizades importadas`);

  // ---- 3) Solicitações pendentes ----
  const requests = exportData.friendRequests || [];
  console.log(`\n[3/5] Solicitações (${requests.length}):`);
  const existingRequests = !dryRun
    ? await tableHasRows(pgConfig, 'friend_requests')
    : false;
  for (const r of requests) {
    const sUid = fireUidToUuid.get(r.senderUid);
    const rUid = fireUidToUuid.get(r.receiverUid);
    if (!sUid || !rUid || !profileUuids.has(sUid) || !profileUuids.has(rUid)) {
      stats.skipped.push(`solicitação ${r.senderUid}→${r.receiverUid} (participante ausente)`);
      continue;
    }
    if (dryRun) { stats.requests++; continue; }
    if (existingRequests) {
      stats.skipped.push('solicitações (tabela já contém dados — re-execução ignorada)');
      break;
    }
    sql.push(
      `insert into public.friend_requests (sender_uid, sender_name, sender_cyberpunk_id, sender_avatar, receiver_uid, created_at)
       values (${pgEscape(sUid)}, ${pgEscape(r.senderName || '')}, ${pgEscape(r.senderCyberpunkId || '')}, ${pgEscape(r.senderAvatar || '')}, ${pgEscape(rUid)}, ${pgEscape(r.timestamp)}::timestamptz);`
    );
    stats.requests++;
  }
  log(`→ ${stats.requests} solicitações importadas`);

  // ---- 4) Mensagens diretas ----
  const messages = exportData.directMessages || [];
  console.log(`\n[4/5] Mensagens (${messages.length}):`);
  const existingMessages = !dryRun
    ? await tableHasRows(pgConfig, 'direct_messages')
    : false;
  for (const m of messages) {
    const senderUuid = fireUidToUuid.get(m.senderUid);
    if (!senderUuid || !profileUuids.has(senderUuid)) {
      stats.skipped.push(`mensagem de ${m.senderUid} (remetente ausente)`);
      continue;
    }
    if (dryRun) { stats.messages++; continue; }
    if (existingMessages) {
      stats.skipped.push('mensagens (tabela já contém dados — re-execução ignorada)');
      break;
    }
    sql.push(
      `insert into public.direct_messages (chat_room_id, sender_uid, sender_name, text, created_at)
       values (${pgEscape(m.chatRoomId)}, ${pgEscape(senderUuid)}, ${pgEscape(m.senderName || '')}, ${pgEscape(m.text || '')}, ${pgEscape(m.timestamp)}::timestamptz);`
    );
    stats.messages++;
  }
  log(`→ ${stats.messages} mensagens importadas`);

  // ---- 5) Fichas ----
  const sheets = exportData.characterSheets || [];
  console.log(`\n[5/5] Fichas (${sheets.length}):`);
  for (const s of sheets) {
    const userUuid = fireUidToUuid.get(s.uid);
    if (!userUuid || !profileUuids.has(userUuid)) {
      stats.skipped.push(`ficha ${s.sheetId} (dono ausente)`);
      continue;
    }
    if (dryRun) { stats.sheets++; continue; }
    sql.push(
      `insert into public.character_sheets (user_id, sheet_id, handle, role, data, updated_at)
       values (${pgEscape(userUuid)}, ${pgEscape(s.sheetId)}, ${pgEscape(s.handle || '')}, ${pgEscape(s.role || '')}, ${pgEscape(JSON.stringify(s.data))}::jsonb, ${pgEscape(s.updatedAt)}::timestamptz)
       on conflict (user_id, sheet_id) do update set data = excluded.data, handle = excluded.handle, role = excluded.role, updated_at = excluded.updated_at;`
    );
    stats.sheets++;
  }
  log(`→ ${stats.sheets} fichas importadas`);

  if (dryRun) {
    console.log(`\n✅ (dry-run) ${stats.created} usuários, ${stats.friendships} amizades, ${stats.requests} solicitações, ${stats.messages} mensagens, ${stats.sheets} fichas seriam importados.`);
    console.log('ℹ️  Reexecute sem --dry-run para gravar de verdade.');
    return;
  }

  // Aplica tudo em uma transação
  sql.push('commit;');
  try {
    const via = await runSql(pgConfig, sql.join('\n'));
    console.log(`\n✅ Migração aplicada via ${via === 'pg' ? 'conexão PostgreSQL' : 'docker exec'} (transação única).`);
  } catch (e) {
    console.error('\n❌ Erro ao aplicar o SQL (a transação foi revertida):', e?.message || e);
    process.exit(1);
  }

  console.log(JSON.stringify({ ...stats, skipped: stats.skipped.slice(0, 15) }, null, 2));
  if (stats.skipped.length > 15) console.log(`  ... e mais ${stats.skipped.length - 15} avisos.`);
}

/** Executa uma query parametrizada via pg ou docker exec. Retorna rows (array) ou []. */
async function runQuery(pgConfig, query) {
  if (pgConfig.password) {
    const { default: pg } = await import('pg');
    const client = new pg.Client(pgConfig);
    await client.connect();
    try {
      const r = await client.query(query);
      return r.rows ?? [];
    } finally {
      await client.end();
    }
  }
  const { execSync } = await import('node:child_process');
  const container = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_cyberpunk-2020-sheet-builder-_-prd-suite';
  const sql = query.text.replace(/\$1/g, pgEscape(query.values?.[0]));
  const out = execSync(
    `docker exec -i ${container} psql -U postgres -d ${pgConfig.database} -t -A -c ${JSON.stringify(sql)}`,
    { encoding: 'utf8' }
  );
  if (!out.trim()) return [];
  return out
    .trim()
    .split('\n')
    .map((line) => ({ id: line.trim() }));
}

/** Verifica se a tabela já tem linhas (guarda anti-duplicação de re-execução). */
async function tableHasRows(pgConfig, table) {
  try {
    const sql = `select exists(select 1 from public.${table} limit 1) as has;`;
    if (pgConfig.password) {
      const { default: pg } = await import('pg');
      const client = new pg.Client(pgConfig);
      await client.connect();
      try {
        const r = await client.query(sql);
        return r.rows[0]?.has ?? false;
      } finally {
        await client.end();
      }
    }
    const { execSync } = await import('node:child_process');
    const container = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_cyberpunk-2020-sheet-builder-_-prd-suite';
    const out = execSync(
      `docker exec -i ${container} psql -U postgres -d ${pgConfig.database} -t -c "${sql}"`,
      { encoding: 'utf8' }
    );
    return out.trim() === 't';
  } catch {
    return false;
  }
}

/** Fallback de cyberpunk_id para perfis sem ID no Firestore (regra do cliente). */
function generateFallbackId(uid) {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
  return `#NC-${1000 + (hash % 9000)}`;
}

/* ------------------------------------------------------------------
   MAIN
   ------------------------------------------------------------------ */

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const m = argv[i].match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (argv[i].startsWith('--')) out[argv[i].slice(2)] = true;
  }
  return out;
}

const args = parseArgs(process.argv);
const command = args.command || 'import';
const dryRun = !!args['dry-run'];

const cfg = getFirebaseConfig();
const projectId = args['project-id'] || cfg?.projectId;
const firestoreDatabaseId =
  args['firestore-database'] ||
  cfg?.firestoreDatabaseId ||
  `ai-studio-cyberpunk2020she-${projectId}`;

(async () => {
  switch (command) {
    case 'export': {
      const serviceAccount = args['service-account'];
      if (!serviceAccount || !existsSync(serviceAccount)) {
        console.error('❌ --service-account=path/to/service-account.json é obrigatório para export.');
        process.exit(1);
      }
      console.log(`\n📤 Exportando Firestore "${firestoreDatabaseId}" do projeto "${projectId}"...`);
      await exportFromFirestore({
        serviceAccount,
        output: args.output || 'data/firestore-export.json',
        projectId,
        firestoreDatabaseId
      });
      break;
    }
    case 'validate': {
      const serviceAccount = args['service-account'];
      if (!serviceAccount || !existsSync(serviceAccount)) {
        console.error('❌ --service-account=path/to/service-account.json é obrigatório para validate.');
        process.exit(1);
      }
      await validateFirestore({ serviceAccount, projectId, firestoreDatabaseId });
      break;
    }
    case 'import':
    default: {
      const input = args.input || 'data/firestore-export.json';
      await importToSupabase({ input, dryRun, args });
      break;
    }
  }
  process.exit(0);
})().catch((e) => {
  console.error('\n❌ Erro:', e?.message || e);
  process.exit(1);
});
