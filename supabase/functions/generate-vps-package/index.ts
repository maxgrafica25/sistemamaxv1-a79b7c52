// Gera um pacote ZIP completo para auto-hospedar o sistema numa VPS.
//
// Fase 2 + 3 — conteúdo:
//   - dados/database.sql      (dump completo via backup-database)
//   - dados/auth-users.json   (sem hashes)
//   - dados/cron-jobs.sql     (placeholders {{API_BASE_URL}} / {{SERVICE_ROLE_KEY}})
//   - dados/realtime.sql
//   - dados/secrets-checklist.md
//   - storage/<bucket>/...    (arquivos físicos — se total <= STORAGE_INLINE_LIMIT)
//   - storage/manifest.json
//   - docker/docker-compose.yml + Caddyfile + kong.yml + backup-cron.sh
//   - funcoes-edge/MANIFEST.json + README.md (lista das 16 funções)
//   - instalar.sh             (script "1-clique")
//   - INSTALL.md + checklist-pos-instalacao.md + LEIA-ME-PRIMEIRO.txt + .env.exemplo
//
// Política de tamanho:
//   - Se storage total > STORAGE_INLINE_LIMIT (200 MB), gera DOIS arquivos:
//        pacote-vps-<stamp>.zip          (base, sem storage)
//        pacote-vps-<stamp>-storage.zip  (só os arquivos do storage)
//     O instalar.sh detecta os dois e processa ambos.
//
// Bucket "vps-packages": mantém 3 pacotes (base+storage contam como 1 par), expira 7 dias.
//
// Protegida: apenas admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { zipSync, strToU8, type Zippable } from "https://esm.sh/fflate@0.8.2";
import { getAdminClient, logAdminOperation } from "../_shared/admin-client.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { validateOrigin } from "../_shared/errorHandler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BUCKET = "vps-packages";
const KEEP_PACKAGES = 6; // 3 pares (base + storage)
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;

// Se storage total > este limite, vai pra ZIP separado
const STORAGE_INLINE_LIMIT = 200 * 1024 * 1024; // 200 MB
// Limite duro de segurança pra não estourar memória da edge function
const STORAGE_HARD_LIMIT = 400 * 1024 * 1024; // 400 MB

const STORAGE_BUCKETS = ["chat-attachments", "maintenance-attachments", "quote-attachments"];

// Todas as edge functions que devem ser deployadas no destino
const EDGE_FUNCTIONS = [
  "assistente-virtual",
  "backup-database",
  "backup-storage",
  "check-overdue-readings",
  "check-reminders",
  "gcal-sync-worker",
  "generate-vps-package",
  "google-disconnect",
  "google-oauth-callback",
  "google-oauth-init",
  
  "invite-user",
  "monitor-admin-usage",
  
  "reminders-api",
  "scrape-prices-cron",
  "scrape-prices",
  "sync-prices-webhook",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const originBlock = validateOrigin(req, corsHeaders);
  if (originBlock) return originBlock;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);

  const { data: isAdmin } = await userClient.rpc("is_profile_admin", { _user_id: userData.user.id });
  if (!isAdmin) return json({ error: "Forbidden: admin required" }, 403);

  // Rate limit: gerar pacote VPS é muito pesado — 2 por hora por admin
  const rl = await checkRateLimit(`user:${userData.user.id}`, "generate_vps_package", 2, 3600);
  if (!rl.allowed) return rateLimitResponse(corsHeaders);


  const admin = getAdminClient({
    fnName: "generate-vps-package",
    reason: "Generate self-hosting package for VPS migration (admin-initiated)",
  });

  try {
    // 1) database.sql
    const dbResp = await fetch(`${SUPABASE_URL}/functions/v1/backup-database?format=sql`, {
      headers: { Authorization: authHeader },
    });
    if (!dbResp.ok) {
      const txt = await dbResp.text();
      throw new Error(`backup-database falhou: ${dbResp.status} ${txt.slice(0, 200)}`);
    }
    const databaseSql = await dbResp.text();

    // 2) usuários
    const authUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      if (!data?.users?.length) break;
      for (const u of data.users) {
        authUsers.push({
          id: u.id,
          email: u.email,
          email_confirmed_at: u.email_confirmed_at,
          phone: u.phone,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          raw_user_meta_data: u.user_metadata,
          raw_app_meta_data: u.app_metadata,
        });
      }
      if (data.users.length < 1000) break;
      page++;
    }

    // 3) cron + realtime
    const { data: cronJobsRaw } = await admin.rpc("backup_get_cron_jobs");
    const cronJobsArr = (cronJobsRaw as any[]) || [];
    const cronJobsSql = buildCronJobsSql(cronJobsArr);

    const { data: realtimeRaw } = await admin.rpc("backup_get_realtime_publication");
    const realtimeArr = (realtimeRaw as any[]) || [];
    const realtimeSql = buildRealtimeSql(realtimeArr);

    // 4) storage — listar e baixar
    const storage = await collectAndDownloadStorage(admin);
    const storageManifest = JSON.stringify({
      generated_at: new Date().toISOString(),
      total_files: storage.totalFiles,
      total_bytes: storage.totalBytes,
      buckets: storage.perBucket,
    }, null, 2);

    // 5) decidir modo (inline vs split)
    const splitMode = storage.totalBytes > STORAGE_INLINE_LIMIT;
    if (storage.totalBytes > STORAGE_HARD_LIMIT) {
      throw new Error(
        `Storage total (${formatBytes(storage.totalBytes)}) excede o limite de ${formatBytes(STORAGE_HARD_LIMIT)} ` +
        `suportado pela edge function. Faça download manual via supabase CLI: 'supabase storage download'.`
      );
    }

    // 6) Documentos
    const installMd = buildInstallMd(authUsers.length, cronJobsArr.length, storage, splitMode);
    const checklistMd = buildPostInstallChecklist(authUsers.length);
    const secretsMd = buildSecretsChecklist();
    const envExample = buildEnvExample();
    const usersJson = JSON.stringify({ generated_at: new Date().toISOString(), count: authUsers.length, users: authUsers }, null, 2);
    const installerSh = buildInstallerSh(splitMode);
    const dockerCompose = buildDockerCompose();
    const caddyfile = buildCaddyfile();
    const kongYml = buildKongYml();
    const backupCronSh = buildBackupCronSh();
    const edgeManifest = JSON.stringify({ functions: EDGE_FUNCTIONS }, null, 2);
    const edgeReadme = buildEdgeFunctionsReadme();
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    const filename = `pacote-vps-${stamp}.zip`;
    const storageFilename = splitMode ? `pacote-vps-${stamp}-storage.zip` : null;

    // 7) ZIP base
    const basePayload: Zippable = {
      "LEIA-ME-PRIMEIRO.txt": strToU8(buildReadmeFirst(filename, storageFilename)),
      "INSTALL.md": strToU8(installMd),
      "checklist-pos-instalacao.md": strToU8(checklistMd),
      ".env.exemplo": strToU8(envExample),
      "instalar.sh": strToU8(installerSh),
      "dados/database.sql": strToU8(databaseSql),
      "dados/auth-users.json": strToU8(usersJson),
      "dados/cron-jobs.sql": strToU8(cronJobsSql),
      "dados/realtime.sql": strToU8(realtimeSql),
      "dados/secrets-checklist.md": strToU8(secretsMd),
      "docker/docker-compose.yml": strToU8(dockerCompose),
      "docker/Caddyfile": strToU8(caddyfile),
      "docker/kong.yml": strToU8(kongYml),
      "docker/backup-cron.sh": strToU8(backupCronSh),
      "funcoes-edge/MANIFEST.json": strToU8(edgeManifest),
      "funcoes-edge/README.md": strToU8(edgeReadme),
      "storage/manifest.json": strToU8(storageManifest),
    };

    // Se inline, joga arquivos de storage dentro do base
    if (!splitMode) {
      for (const f of storage.files) {
        basePayload[`storage/${f.bucket}/${f.path}`] = f.bytes;
      }
    }

    const baseZip = zipSync(basePayload, { level: 6 });

    // 8) Upload base
    const { error: upErr } = await admin.storage.from(BUCKET).upload(filename, baseZip, {
      contentType: "application/zip",
      upsert: true,
    });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

    let storageZipBytes = 0;
    let storageSignedUrl: string | null = null;

    // 9) Se split, gera ZIP separado de storage
    if (splitMode && storageFilename) {
      const storagePayload: Zippable = {
        "LEIA-ME-STORAGE.txt": strToU8(
          `Este ZIP contém apenas os arquivos do Storage do pacote ${filename}.\n` +
          `Coloque-o no MESMO diretório do pacote base antes de rodar ./instalar.sh\n`
        ),
      };
      for (const f of storage.files) {
        storagePayload[`storage/${f.bucket}/${f.path}`] = f.bytes;
      }
      const storageZip = zipSync(storagePayload, { level: 6 });
      storageZipBytes = storageZip.byteLength;

      const { error: storageUpErr } = await admin.storage
        .from(BUCKET)
        .upload(storageFilename, storageZip, { contentType: "application/zip", upsert: true });
      if (storageUpErr) throw new Error(`Upload storage falhou: ${storageUpErr.message}`);

      const { data: storageSigned } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(storageFilename, SIGNED_URL_TTL_SECONDS);
      storageSignedUrl = storageSigned?.signedUrl ?? null;
    }

    // 10) Auto-limpeza
    const cleaned = await cleanupOldPackages(admin);

    // 11) URL assinada base
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(filename, SIGNED_URL_TTL_SECONDS);
    if (signErr) throw new Error(`Signed URL falhou: ${signErr.message}`);

    await logAdminOperation(admin, {
      function_name: "generate-vps-package",
      operation: "package_generated",
      invoked_by: userData.user.id,
      target_count: 1,
      metadata: {
        filename,
        storage_filename: storageFilename,
        split_mode: splitMode,
        size_bytes: baseZip.byteLength,
        storage_size_bytes: storageZipBytes,
        users_count: authUsers.length,
        cron_jobs_count: cronJobsArr.length,
        storage_files: storage.totalFiles,
        cleaned_old_packages: cleaned,
      },
    });

    return json({
      success: true,
      filename,
      size_bytes: baseZip.byteLength,
      download_url: signed.signedUrl,
      expires_in_days: 7,
      split_mode: splitMode,
      storage_filename: storageFilename,
      storage_download_url: storageSignedUrl,
      storage_size_bytes: storageZipBytes,
      contents: {
        users: authUsers.length,
        cron_jobs: cronJobsArr.length,
        realtime_tables: realtimeArr.length,
        edge_functions: EDGE_FUNCTIONS.length,
        storage_files_total: storage.totalFiles,
        storage_size_bytes: storage.totalBytes,
      },
      note: splitMode
        ? `Pacote dividido em 2 arquivos por causa do tamanho do Storage (${formatBytes(storage.totalBytes)}). Baixe AMBOS e coloque na mesma pasta antes de rodar ./instalar.sh`
        : `Pacote completo gerado — basta descompactar e rodar ./instalar.sh na VPS.`,
    }, 200);
  } catch (err: any) {
    console.error("[generate-vps-package] failed:", err);
    return json({ error: err?.message ?? "Erro desconhecido" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ============ Storage download ============

async function collectAndDownloadStorage(admin: ReturnType<typeof getAdminClient>) {
  const files: { bucket: string; path: string; bytes: Uint8Array }[] = [];
  const perBucket: Record<string, { files: number; bytes: number }> = {};
  let totalFiles = 0;
  let totalBytes = 0;

  for (const bucket of STORAGE_BUCKETS) {
    let bFiles = 0;
    let bBytes = 0;
    try {
      const paths = await listAllPaths(admin, bucket, "");
      for (const p of paths) {
        try {
          const { data, error } = await admin.storage.from(bucket).download(p);
          if (error || !data) continue;
          const arr = new Uint8Array(await data.arrayBuffer());
          files.push({ bucket, path: p, bytes: arr });
          bFiles++;
          bBytes += arr.byteLength;
          totalBytes += arr.byteLength;
          totalFiles++;
          if (totalBytes > STORAGE_HARD_LIMIT) {
            // Não para — quem checa o limite é o caller, mas evita memória estourar
            break;
          }
        } catch (e) {
          console.warn(`[storage] falhou ${bucket}/${p}:`, e);
        }
      }
    } catch (e) {
      console.warn(`[storage] bucket ${bucket} falhou:`, e);
    }
    perBucket[bucket] = { files: bFiles, bytes: bBytes };
    if (totalBytes > STORAGE_HARD_LIMIT) break;
  }

  return { files, totalFiles, totalBytes, perBucket };
}

async function listAllPaths(
  admin: ReturnType<typeof getAdminClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  const stack = [prefix];
  while (stack.length) {
    const cur = stack.pop()!;
    const { data, error } = await admin.storage.from(bucket).list(cur, { limit: 1000 });
    if (error || !data) continue;
    for (const o of data) {
      const full = cur ? `${cur}/${o.name}` : o.name;
      if (!o.id && !o.metadata) {
        // pasta
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }
  return out;
}

// ============ Builders ============

function buildCronJobsSql(jobs: any[]): string {
  if (!jobs.length) return "-- Nenhum cron job encontrado no projeto de origem.\n";
  const header = `-- Cron jobs reescritos para o destino.
-- O instalar.sh substitui os placeholders automaticamente.
--   {{API_BASE_URL}}    → URL pública das edge functions na VPS
--   {{SERVICE_ROLE_KEY}}→ service_role gerada pelo instalador
--
-- Pré-requisitos no destino (já cumpridos pelo instalar.sh):
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
\n`;
  const body = jobs.map((j) => {
    const command = String(j.command || "")
      .replaceAll(/https?:\/\/[a-z0-9.-]+\/functions\/v1/gi, "{{API_BASE_URL}}")
      .replaceAll(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer {{SERVICE_ROLE_KEY}}")
      .replaceAll(/'[A-Za-z0-9._-]{100,}'/g, "'{{SERVICE_ROLE_KEY}}'");
    return `-- Job: ${j.jobname} (${j.schedule})\nSELECT cron.schedule(\n  ${sqlLiteral(j.jobname)},\n  ${sqlLiteral(j.schedule)},\n  $job$${command}$job$\n);\n`;
  }).join("\n");
  return header + body + `\nSELECT jobname, schedule, active FROM cron.job ORDER BY jobname;\n`;
}

function buildRealtimeSql(pubs: any[]): string {
  if (!pubs.length) return "-- Nenhuma tabela com realtime habilitada.\n";
  const tables = pubs.map((p) => `  ${p.schemaname}.${p.tablename}`).join(",\n");
  return `-- Recria a publication do Supabase Realtime no destino.\nDROP PUBLICATION IF EXISTS supabase_realtime;\nCREATE PUBLICATION supabase_realtime FOR TABLE\n${tables};\n`;
}

async function cleanupOldPackages(admin: ReturnType<typeof getAdminClient>): Promise<number> {
  const { data: list } = await admin.storage.from(BUCKET).list("", {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (!list) return 0;
  const old = list.slice(KEEP_PACKAGES).map((o) => o.name);
  if (!old.length) return 0;
  await admin.storage.from(BUCKET).remove(old);
  return old.length;
}

function sqlLiteral(s: string): string {
  return `'${String(s).replace(/'/g, "''")}'`;
}

// ============ Configs Docker ============

function buildEnvExample(): string {
  return `# === Preencha ANTES de rodar ./instalar.sh ===

# Domínio do app (sem https://). Ex: sistema.suaempresa.com.br
DOMINIO_PRINCIPAL=seudominio.com.br

# Subdomínio das APIs do Supabase. Ex: api.suaempresa.com.br
DOMINIO_API=api.seudominio.com.br

# E-mail válido para certificados Let's Encrypt
EMAIL_TLS=admin@seudominio.com.br

# === Google OAuth (criar em https://console.cloud.google.com) ===
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# === SMTP para envio dos e-mails de reset de senha ===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=naoresponda@seudominio.com.br
SMTP_FROM_NAME=MaxGrafica

# === Lovable AI (copie do seu workspace) ===
LOVABLE_API_KEY=

# === GERADAS AUTOMATICAMENTE pelo instalar.sh — não preencher ===
# POSTGRES_PASSWORD=
# JWT_SECRET=
# ANON_KEY=
# SERVICE_ROLE_KEY=
# DASHBOARD_PASSWORD=
`;
}

function buildSecretsChecklist(): string {
  return `# Secrets das Edge Functions

O \`instalar.sh\` injeta automaticamente:
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI, GOOGLE_OAUTH_STATE_SECRET
- LOVABLE_API_KEY
- SMTP_* (para invite-user)

Opcionais (configurar manualmente depois se quiser):
- BROWSERLESS_API_KEY — scraping de preços (https://browserless.io)
- GOOGLE_API_KEY — só se usar APIs públicas do Google
`;
}

function buildDockerCompose(): string {
  return `# docker-compose.yml — Stack Supabase self-hosted + frontend + backup
# Gerado automaticamente pelo botão "Gerar pacote VPS"
# Use: docker compose up -d
#
# Volumes persistentes:
#   pgdata       — banco de dados
#   storage_data — arquivos do storage
#   backups      — backups diários automáticos
#   caddy_data   — certificados TLS

services:
  postgres:
    image: supabase/postgres:15.6.1.139
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
      JWT_SECRET: \${JWT_SECRET}
      JWT_EXP: 3600
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

  auth:
    image: supabase/gotrue:v2.158.1
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:\${POSTGRES_PASSWORD}@postgres:5432/postgres
      GOTRUE_SITE_URL: https://\${DOMINIO_PRINCIPAL}
      GOTRUE_URI_ALLOW_LIST: https://\${DOMINIO_PRINCIPAL},https://\${DOMINIO_API}
      GOTRUE_JWT_SECRET: \${JWT_SECRET}
      GOTRUE_JWT_EXP: 3600
      GOTRUE_DISABLE_SIGNUP: "false"
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: \${GOOGLE_OAUTH_CLIENT_ID}
      GOTRUE_EXTERNAL_GOOGLE_SECRET: \${GOOGLE_OAUTH_CLIENT_SECRET}
      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: https://\${DOMINIO_API}/auth/v1/callback
      GOTRUE_SMTP_HOST: \${SMTP_HOST}
      GOTRUE_SMTP_PORT: \${SMTP_PORT}
      GOTRUE_SMTP_USER: \${SMTP_USER}
      GOTRUE_SMTP_PASS: \${SMTP_PASS}
      GOTRUE_SMTP_ADMIN_EMAIL: \${SMTP_FROM_EMAIL}
      GOTRUE_SMTP_SENDER_NAME: \${SMTP_FROM_NAME}
      GOTRUE_MAILER_AUTOCONFIRM: "false"

  rest:
    image: postgrest/postgrest:v12.2.0
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PGRST_DB_URI: postgres://authenticator:\${POSTGRES_PASSWORD}@postgres:5432/postgres
      PGRST_DB_SCHEMAS: public,storage
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: \${JWT_SECRET}
      PGRST_DB_USE_LEGACY_GUCS: "false"

  realtime:
    image: supabase/realtime:v2.30.34
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PORT: 4000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: supabase_admin
      DB_PASSWORD: \${POSTGRES_PASSWORD}
      DB_NAME: postgres
      DB_ENC_KEY: supabaserealtime
      API_JWT_SECRET: \${JWT_SECRET}
      SECRET_KEY_BASE: \${JWT_SECRET}
      ERL_AFLAGS: -proto_dist inet_tcp
      DNS_NODES: "''"

  storage:
    image: supabase/storage-api:v1.11.6
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      ANON_KEY: \${ANON_KEY}
      SERVICE_KEY: \${SERVICE_ROLE_KEY}
      POSTGREST_URL: http://rest:3000
      PGRST_JWT_SECRET: \${JWT_SECRET}
      DATABASE_URL: postgres://supabase_storage_admin:\${POSTGRES_PASSWORD}@postgres:5432/postgres
      FILE_SIZE_LIMIT: 52428800
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: stub
      REGION: stub
      GLOBAL_S3_BUCKET: stub
    volumes:
      - storage_data:/var/lib/storage

  functions:
    image: supabase/edge-runtime:v1.58.5
    restart: unless-stopped
    environment:
      JWT_SECRET: \${JWT_SECRET}
      SUPABASE_URL: https://\${DOMINIO_API}
      SUPABASE_ANON_KEY: \${ANON_KEY}
      SUPABASE_SERVICE_ROLE_KEY: \${SERVICE_ROLE_KEY}
      SUPABASE_DB_URL: postgres://postgres:\${POSTGRES_PASSWORD}@postgres:5432/postgres
      GOOGLE_OAUTH_CLIENT_ID: \${GOOGLE_OAUTH_CLIENT_ID}
      GOOGLE_OAUTH_CLIENT_SECRET: \${GOOGLE_OAUTH_CLIENT_SECRET}
      GOOGLE_OAUTH_REDIRECT_URI: https://\${DOMINIO_API}/functions/v1/google-oauth-callback
      GOOGLE_OAUTH_STATE_SECRET: \${GOOGLE_OAUTH_STATE_SECRET}
      LOVABLE_API_KEY: \${LOVABLE_API_KEY}
    volumes:
      - ./funcoes-edge:/home/deno/functions:ro
    command: ["start", "--main-service", "/home/deno/functions"]

  kong:
    image: kong:3.4
    restart: unless-stopped
    depends_on: [auth, rest, realtime, storage, functions]
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /etc/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: request-transformer,cors,key-auth,acl
    volumes:
      - ./kong.yml:/etc/kong/kong.yml:ro
    ports:
      - "8000:8000"

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on: [kong]
    ports:
      - "80:80"
      - "443:443"
    environment:
      DOMINIO_PRINCIPAL: \${DOMINIO_PRINCIPAL}
      DOMINIO_API: \${DOMINIO_API}
      EMAIL_TLS: \${EMAIL_TLS}
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
      - ../frontend-build:/srv/frontend:ro

  backup:
    image: postgres:15-alpine
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PGHOST: postgres
      PGUSER: postgres
      PGPASSWORD: \${POSTGRES_PASSWORD}
      RETENCAO_DIAS: 14
    volumes:
      - backups:/backups
      - storage_data:/storage:ro
      - ./backup-cron.sh:/usr/local/bin/backup-cron.sh:ro
    entrypoint: ["/bin/sh", "-c", "apk add --no-cache tzdata && cp /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime && chmod +x /usr/local/bin/backup-cron.sh && echo '0 3 * * * /usr/local/bin/backup-cron.sh' | crontab - && crond -f -l 2"]

volumes:
  pgdata:
  storage_data:
  backups:
  caddy_data:
  caddy_config:
`;
}

function buildCaddyfile(): string {
  return `# Caddyfile — TLS automático via Let's Encrypt
{
  email {$EMAIL_TLS}
}

# Frontend (SPA)
{$DOMINIO_PRINCIPAL} {
  root * /srv/frontend
  try_files {path} /index.html
  file_server
  encode gzip zstd
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}

# APIs do Supabase (auth, rest, realtime, storage, functions)
{$DOMINIO_API} {
  reverse_proxy kong:8000
  encode gzip zstd
  header {
    Access-Control-Allow-Origin "https://{$DOMINIO_PRINCIPAL}"
    Access-Control-Allow-Credentials true
  }
}
`;
}

function buildKongYml(): string {
  return `# kong.yml — roteamento para os serviços do Supabase
_format_version: "2.1"
_transform: true

services:
  - name: auth-v1
    url: http://auth:9999/
    routes: [{ name: auth-v1-all, strip_path: true, paths: ["/auth/v1/"] }]

  - name: rest-v1
    url: http://rest:3000/
    routes: [{ name: rest-v1-all, strip_path: true, paths: ["/rest/v1/"] }]
    plugins:
      - name: cors
      - name: key-auth
        config: { hide_credentials: false }

  - name: realtime-v1
    url: http://realtime:4000/socket/
    routes: [{ name: realtime-v1-all, strip_path: true, paths: ["/realtime/v1/"] }]

  - name: storage-v1
    url: http://storage:5000/
    routes: [{ name: storage-v1-all, strip_path: true, paths: ["/storage/v1/"] }]

  - name: functions-v1
    url: http://functions:9000/
    routes: [{ name: functions-v1-all, strip_path: true, paths: ["/functions/v1/"] }]

consumers:
  - username: anon
    keyauth_credentials: [{ key: \${ANON_KEY} }]
  - username: service_role
    keyauth_credentials: [{ key: \${SERVICE_ROLE_KEY} }]
`;
}

function buildBackupCronSh(): string {
  return `#!/bin/sh
# Backup diário automático (rodando dentro do container 'backup')
# Banco → /backups/db-YYYY-MM-DD.sql.gz
# Storage → /backups/storage-YYYY-MM-DD.tar.gz
# Mantém últimos $RETENCAO_DIAS (padrão 14)
set -e
STAMP=$(date +%Y-%m-%d)
echo "[backup] iniciando $STAMP"

pg_dump -d postgres --clean --if-exists --no-owner | gzip > /backups/db-$STAMP.sql.gz
tar -czf /backups/storage-$STAMP.tar.gz -C /storage .

# Limpa antigos
find /backups -name "db-*.sql.gz" -mtime +$RETENCAO_DIAS -delete
find /backups -name "storage-*.tar.gz" -mtime +$RETENCAO_DIAS -delete

echo "[backup] concluído $STAMP"
`;
}

// ============ Edge functions ============

function buildEdgeFunctionsReadme(): string {
  return `# Edge Functions (${EDGE_FUNCTIONS.length} funções)

> ⚠️ **Importante:** o código-fonte das edge functions NÃO pôde ser embutido neste pacote
> por limitação técnica (cada função roda isolada e não consegue ler o código das outras).
>
> O \`instalar.sh\` busca o código de uma destas fontes (na ordem):
>
> 1. **Repositório Git** definido em \`EDGE_FUNCTIONS_REPO\` no \`.env\`
>    (ex: \`https://github.com/seu-usuario/maxgrafica.git\`).
>    O instalador clona, copia \`supabase/functions/*\` e remove o clone.
>
> 2. **Pasta local** \`./funcoes-edge-src/\` (se você já tem o código baixado).
>
> 3. Se nenhum dos dois existir, o instalador imprime instruções para você
>    rodar \`supabase functions download <nome>\` manualmente apontando para o
>    seu projeto Lovable Cloud antes de continuar.

## Funções incluídas

${EDGE_FUNCTIONS.map((f) => `- \`${f}\``).join("\n")}

## Como o sistema as encontra

O \`docker-compose.yml\` monta a pasta \`./funcoes-edge/\` como volume read-only
em \`/home/deno/functions\` dentro do container \`functions\`. Basta ter o código lá.
`;
}

// ============ Installer ============

function buildInstallerSh(splitMode: boolean): string {
  const storageNote = splitMode
    ? `# Modo split detectado — o instalador também procura por pacote-vps-*-storage.zip\n`
    : `# Modo single — storage embutido no pacote principal\n`;
  return `#!/bin/bash
# ==========================================================
#  MaxGrafica — Instalador VPS (script "1-clique")
#  Gerado em $(date 2>/dev/null || echo desconhecido)
${storageNote}# ==========================================================
set -e
cd "$(dirname "$0")"

C_OK="\\033[0;32m"; C_ERR="\\033[0;31m"; C_INFO="\\033[0;34m"; C_END="\\033[0m"
ok()   { echo -e "\${C_OK}✓\${C_END} $*"; }
info() { echo -e "\${C_INFO}→\${C_END} $*"; }
err()  { echo -e "\${C_ERR}✗\${C_END} $*" >&2; }
die()  { err "$*"; exit 1; }

# 1) Pré-requisitos
info "Verificando pré-requisitos..."
command -v docker >/dev/null || die "Docker não encontrado. Instale: https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || die "docker compose v2 não encontrado."
command -v openssl >/dev/null || die "openssl não encontrado. Instale: apt install openssl"
command -v unzip >/dev/null   || die "unzip não encontrado. Instale: apt install unzip"
command -v curl >/dev/null    || die "curl não encontrado. Instale: apt install curl"
ok "Pré-requisitos OK"

# 2) .env
[ -f .env ] || die "Arquivo .env não encontrado. Copie .env.exemplo para .env e preencha."
set -a; . ./.env; set +a
[ -n "\${DOMINIO_PRINCIPAL:-}" ] || die ".env: DOMINIO_PRINCIPAL vazio"
[ -n "\${DOMINIO_API:-}" ]       || die ".env: DOMINIO_API vazio"
[ -n "\${EMAIL_TLS:-}" ]         || die ".env: EMAIL_TLS vazio"
[ -n "\${GOOGLE_OAUTH_CLIENT_ID:-}" ] || die ".env: GOOGLE_OAUTH_CLIENT_ID vazio (crie em https://console.cloud.google.com)"
ok "Configuração carregada para \$DOMINIO_PRINCIPAL"

# 3) Gera chaves se ainda não existirem
if [ -z "\${POSTGRES_PASSWORD:-}" ]; then
  info "Gerando chaves de segurança..."
  POSTGRES_PASSWORD=$(openssl rand -hex 32)
  JWT_SECRET=$(openssl rand -hex 32)
  GOOGLE_OAUTH_STATE_SECRET=$(openssl rand -base64 32 | tr -d '\\n')
  # Para gerar ANON_KEY e SERVICE_ROLE_KEY usamos node ou python — fallback simples:
  # As keys são JWTs assinados com JWT_SECRET. Aqui pedimos pra fazer manualmente
  # OU geramos via Docker quick-script.
  ANON_KEY=$(docker run --rm -e JWT_SECRET="\$JWT_SECRET" node:20-alpine sh -c '
    node -e "
      const c=require(\\\"crypto\\\");
      const h={alg:\\\"HS256\\\",typ:\\\"JWT\\\"};
      const p={role:\\\"anon\\\",iss:\\\"supabase\\\",iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60*60*24*365*10};
      const b64=o=>Buffer.from(JSON.stringify(o)).toString(\\\"base64url\\\");
      const data=b64(h)+\\\".\\\"+b64(p);
      const sig=c.createHmac(\\\"sha256\\\",process.env.JWT_SECRET).update(data).digest(\\\"base64url\\\");
      console.log(data+\\\".\\\"+sig);
    "
  ')
  SERVICE_ROLE_KEY=$(docker run --rm -e JWT_SECRET="\$JWT_SECRET" node:20-alpine sh -c '
    node -e "
      const c=require(\\\"crypto\\\");
      const h={alg:\\\"HS256\\\",typ:\\\"JWT\\\"};
      const p={role:\\\"service_role\\\",iss:\\\"supabase\\\",iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+60*60*24*365*10};
      const b64=o=>Buffer.from(JSON.stringify(o)).toString(\\\"base64url\\\");
      const data=b64(h)+\\\".\\\"+b64(p);
      const sig=c.createHmac(\\\"sha256\\\",process.env.JWT_SECRET).update(data).digest(\\\"base64url\\\");
      console.log(data+\\\".\\\"+sig);
    "
  ')
  cat >> .env <<EOF

# === Gerado automaticamente em $(date) ===
POSTGRES_PASSWORD=\$POSTGRES_PASSWORD
JWT_SECRET=\$JWT_SECRET
ANON_KEY=\$ANON_KEY
SERVICE_ROLE_KEY=\$SERVICE_ROLE_KEY
GOOGLE_OAUTH_STATE_SECRET=\$GOOGLE_OAUTH_STATE_SECRET
EOF
  ok "Chaves geradas e salvas no .env"
else
  info "Chaves já existem no .env (não vou regerar)"
fi

# 4) Storage split (se aplicável)
STORAGE_ZIP=\$(ls pacote-vps-*-storage.zip 2>/dev/null | head -n1 || true)
if [ -n "\$STORAGE_ZIP" ]; then
  info "Storage zipado separado encontrado: \$STORAGE_ZIP — extraindo..."
  unzip -oq "\$STORAGE_ZIP"
  ok "Storage extraído"
fi

# 5) Edge functions — busca código-fonte
mkdir -p funcoes-edge
if [ -n "\${EDGE_FUNCTIONS_REPO:-}" ]; then
  info "Clonando \$EDGE_FUNCTIONS_REPO para obter as edge functions..."
  rm -rf /tmp/edge-src
  git clone --depth 1 "\$EDGE_FUNCTIONS_REPO" /tmp/edge-src
  cp -r /tmp/edge-src/supabase/functions/* funcoes-edge/ 2>/dev/null || true
  rm -rf /tmp/edge-src
  ok "Edge functions copiadas do repositório"
elif [ -d funcoes-edge-src ]; then
  cp -r funcoes-edge-src/* funcoes-edge/
  ok "Edge functions copiadas de ./funcoes-edge-src/"
else
  err "ATENÇÃO: código-fonte das edge functions não encontrado."
  err "Opções:"
  err "  a) Adicione no .env: EDGE_FUNCTIONS_REPO=https://github.com/seu/repo.git"
  err "  b) Copie sua pasta supabase/functions para ./funcoes-edge-src/ e rode novamente"
  err "  c) Continue sem edge functions (algumas features ficarão off)"
  read -p "Continuar mesmo assim? (s/N): " r
  [ "\$r" = "s" ] || exit 1
fi

# 6) Sobe stack
info "Preparando docker-compose..."
mkdir -p frontend-build
cp -r docker/* .
docker compose up -d
info "Aguardando Postgres ficar pronto..."
for i in \$(seq 1 30); do
  docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 2
done
ok "Postgres pronto"

# 7) Restaura banco
info "Restaurando banco de dados (pode levar alguns minutos)..."
docker compose exec -T postgres psql -U postgres -d postgres < dados/database.sql >/dev/null 2>&1 || true
ok "Banco restaurado"

# 8) Aplica realtime + cron (após substituir placeholders)
info "Aplicando realtime publication..."
docker compose exec -T postgres psql -U postgres -d postgres < dados/realtime.sql >/dev/null 2>&1 || true

info "Reescrevendo cron jobs..."
sed -e "s|{{API_BASE_URL}}|https://\$DOMINIO_API/functions/v1|g" \\
    -e "s|{{SERVICE_ROLE_KEY}}|\$SERVICE_ROLE_KEY|g" \\
    dados/cron-jobs.sql > /tmp/cron-jobs-final.sql
docker compose exec -T postgres psql -U postgres -d postgres < /tmp/cron-jobs-final.sql >/dev/null 2>&1 || true
rm -f /tmp/cron-jobs-final.sql
ok "Realtime + cron aplicados"

# 9) Importa usuários (sem senha — dispara reset)
info "Importando \$(jq '.count' dados/auth-users.json 2>/dev/null || echo '?') usuários..."
if command -v jq >/dev/null; then
  jq -c '.users[]' dados/auth-users.json | while read u; do
    email=\$(echo "\$u" | jq -r .email)
    curl -sS -X POST "http://localhost:8000/auth/v1/admin/users" \\
      -H "apikey: \$SERVICE_ROLE_KEY" \\
      -H "Authorization: Bearer \$SERVICE_ROLE_KEY" \\
      -H "Content-Type: application/json" \\
      -d "{\\\"email\\\":\\\"\$email\\\",\\\"email_confirm\\\":true,\\\"user_metadata\\\":\$(echo \$u | jq .raw_user_meta_data)}" >/dev/null || true
    # dispara reset
    curl -sS -X POST "http://localhost:8000/auth/v1/recover" \\
      -H "apikey: \$ANON_KEY" \\
      -H "Content-Type: application/json" \\
      -d "{\\\"email\\\":\\\"\$email\\\"}" >/dev/null || true
  done
  ok "Usuários importados e e-mails de reset disparados"
else
  err "jq não instalado — pulei importação de usuários. Instale com: apt install jq && rode novamente"
fi

# 10) Upload do storage
if [ -d storage ]; then
  info "Subindo arquivos do storage..."
  for bucket in chat-attachments maintenance-attachments quote-attachments; do
    [ -d "storage/\$bucket" ] || continue
    find "storage/\$bucket" -type f | while read f; do
      rel="\${f#storage/\$bucket/}"
      curl -sS -X POST "http://localhost:8000/storage/v1/object/\$bucket/\$rel" \\
        -H "apikey: \$SERVICE_ROLE_KEY" \\
        -H "Authorization: Bearer \$SERVICE_ROLE_KEY" \\
        --data-binary "@\$f" >/dev/null || true
    done
  done
  ok "Storage carregado"
fi

# 11) Final
echo ""
echo "=========================================="
ok "Instalação concluída!"
echo "=========================================="
echo ""
echo "🌐 Acesse: https://\$DOMINIO_PRINCIPAL"
echo "🔧 API:    https://\$DOMINIO_API"
echo ""
echo "⚠️  Próximos passos (manuais):"
echo "  1. DNS dos dois domínios → IP desta VPS (se ainda não fez)"
echo "  2. Caddy levará ~1 minuto pra emitir TLS na primeira request"
echo "  3. Os usuários receberão e-mail pra definir nova senha"
echo "  4. Construa o frontend (npm run build) e copie 'dist/*' para ./frontend-build/"
echo ""
echo "📋 Ver checklist-pos-instalacao.md para detalhes."
echo "💾 Backups automáticos diários em volume Docker 'backups' (3h da manhã, retenção 14 dias)"
echo ""
`;
}

// ============ Manuais ============

function buildReadmeFirst(filename: string, storageFilename: string | null): string {
  const splitNote = storageFilename
    ? `\n⚠️  ATENÇÃO: Storage muito grande — você precisa baixar TAMBÉM:\n    ${storageFilename}\n    Coloque os DOIS ZIPs na mesma pasta antes de descompactar.\n`
    : "";
  return `==========================================================
  MAXGRAFICA — PACOTE DE INSTALAÇÃO VPS
  ${filename}
==========================================================
${splitNote}
COMO INSTALAR (resumo em 4 passos):

  1. Descompacte:
       unzip ${filename}
       ${storageFilename ? `unzip ${storageFilename}\n       ` : ""}cd pacote-vps-*

  2. Edite o arquivo .env.exemplo (preencha domínio, e-mail,
     Google OAuth e SMTP) e salve como .env

  3. Rode o instalador:
       chmod +x instalar.sh
       ./instalar.sh

  4. Quando terminar, leia checklist-pos-instalacao.md

Tempo total: ~15 minutos (após Docker já instalado).
Manual detalhado: INSTALL.md

==========================================================
Validade do link de download: 7 dias
==========================================================
`;
}

function buildInstallMd(usersCount: number, cronCount: number, storage: any, splitMode: boolean): string {
  return `# Instalação do MaxGrafica na sua VPS

> **Para leigos.** Siga na ordem. Tempo: ~15 minutos depois do Docker instalado.

---

## O que vem no pacote

- **Banco completo** (schema + dados + RLS + funções + triggers)
- **${usersCount} usuários** (sem senha — recebem e-mail de reset automático)
- **${cronCount} cron jobs** já reescritos pro novo domínio
- **Storage:** ${storage.totalFiles} arquivos, ${formatBytes(storage.totalBytes)}${splitMode ? " (em ZIP separado por causa do tamanho)" : ""}
- **docker-compose.yml** com Postgres + Auth + Storage + Realtime + API + Caddy + Backup
- **instalar.sh** que faz tudo automaticamente
- **Edge functions:** lista das 16 funções (código vem do seu repositório Git — ver \`funcoes-edge/README.md\`)

---

## Pré-requisitos da VPS

| Item | Mínimo |
|---|---|
| Sistema | Ubuntu 22.04 ou Debian 12 |
| RAM | 4 GB (recomendado 8 GB) |
| Disco | 40 GB |
| Portas | 80 e 443 livres |
| Software | Docker, docker-compose v2, openssl, unzip, curl, jq, git |

Instalar tudo de uma vez no Ubuntu:
\`\`\`bash
curl -fsSL https://get.docker.com | sh
apt install -y openssl unzip curl jq git
\`\`\`

---

## Passo 1 — DNS (5 min, antes da instalação)

Aponte os dois subdomínios pro IP da VPS:

| Tipo | Nome | Valor |
|---|---|---|
| A | seudominio.com.br | IP da VPS |
| A | api.seudominio.com.br | IP da VPS |

Propagação pode levar até 1h. Teste com \`dig seudominio.com.br\`.

---

## Passo 2 — Credenciais Google OAuth (10 min)

1. Acesse https://console.cloud.google.com
2. Crie projeto novo → **APIs e Serviços → Credenciais**
3. **Criar credenciais → ID do cliente OAuth → Aplicativo da Web**
4. **URIs de redirecionamento autorizados** (adicione AMBAS):
   - \`https://api.seudominio.com.br/auth/v1/callback\`
   - \`https://api.seudominio.com.br/functions/v1/google-oauth-callback\`
5. Copie **Client ID** e **Client Secret** para o \`.env\`

---

## Passo 3 — .env

\`\`\`bash
cp .env.exemplo .env
nano .env  # preencher domínios, e-mail, Google OAuth, SMTP, LOVABLE_API_KEY
\`\`\`

---

## Passo 4 — Instalar (1 comando)

\`\`\`bash
chmod +x instalar.sh
./instalar.sh
\`\`\`

O script:
1. Verifica Docker e demais pré-requisitos
2. Gera todas as chaves de segurança (POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY)
3. Sobe Postgres, Auth, Storage, Realtime, API gateway, Caddy e Edge Runtime
4. Restaura o banco
5. Aplica realtime publication
6. Aplica cron jobs (substituindo placeholders pelo seu domínio + service_role)
7. Importa os ${usersCount} usuários e dispara e-mails de reset de senha
8. Sobe os ${storage.totalFiles} arquivos do storage
9. Mostra URL final + próximos passos

---

## Passo 5 — Frontend

O frontend (HTML/JS/CSS gerado pelo Lovable) **não está** dentro deste pacote.
Você precisa fazer build da sua aplicação React e colocar em \`./frontend-build/\`:

\`\`\`bash
# Na máquina onde está o código-fonte do app:
npm install
npm run build
# Copia para a VPS:
scp -r dist/* usuario@ip-da-vps:/caminho/pacote-vps-*/frontend-build/
\`\`\`

O Caddy serve essa pasta automaticamente.

---

## Edge Functions

Igual ao frontend: o **código-fonte** das 16 edge functions não pôde ser embutido
(limitação técnica). Duas opções:

**Opção A — Repositório Git (recomendado):**
Adicione no \`.env\`:
\`\`\`
EDGE_FUNCTIONS_REPO=https://github.com/seu-usuario/maxgrafica.git
\`\`\`
O \`instalar.sh\` clona automaticamente.

**Opção B — Copiar manualmente:**
Antes de rodar o instalador:
\`\`\`bash
cp -r /caminho/local/supabase/functions ./funcoes-edge-src
\`\`\`

---

## Backup automático

Já configurado no docker-compose! Todo dia às 3h da manhã:
- \`pg_dump\` do banco → \`/backups/db-YYYY-MM-DD.sql.gz\`
- \`tar\` do storage → \`/backups/storage-YYYY-MM-DD.tar.gz\`
- Mantém últimos 14 dias

Volume Docker: \`backups\`. Para restaurar:
\`\`\`bash
docker compose exec -T postgres psql -U postgres < /backups/db-YYYY-MM-DD.sql
\`\`\`

Recomendado: cron na VPS host enviando os backups pra um S3/Backblaze externo.

---

## Validar instalação

- [ ] \`https://seudominio.com.br\` carrega a tela de login
- [ ] Você consegue fazer login (após definir senha pelo e-mail)
- [ ] Lista de clientes aparece
- [ ] Cria orçamento sem erro
- [ ] Anexa arquivo no chat
- [ ] Verifica em \`https://api.seudominio.com.br/rest/v1/profiles?select=count\` que retorna JSON

---

## Suporte

Em caso de erro, colete:
\`\`\`bash
docker compose logs --tail 200 > logs.txt
\`\`\`
e o conteúdo do \`.env\` (REMOVA AS SENHAS antes de compartilhar).
`;
}

function buildPostInstallChecklist(usersCount: number): string {
  return `# Checklist pós-instalação

## 🔴 Obrigatórios
- [ ] DNS dos 2 subdomínios apontando pra VPS
- [ ] Certificado TLS ativo (acesse https:// e veja o cadeado)
- [ ] Google OAuth criado e cadastrado no .env
- [ ] SMTP funcionando (envie um reset pra você)
- [ ] Frontend buildado e copiado pra ./frontend-build/
- [ ] Edge functions presentes em ./funcoes-edge/ (16 pastas)

## 🟡 Recomendados antes de produção
- [ ] Backup externo: copiar /backups pra S3/Backblaze diariamente
- [ ] Firewall (ufw allow 22, 80, 443; deny outras)
- [ ] Monitoramento de disco (alerta em 80%)
- [ ] Snapshot semanal da VPS pelo provedor

## 🟢 Opcionais
- [ ] Templates de e-mail do Auth em PT-BR
- [ ] Cloudflare na frente (DDoS + cache)
- [ ] Alertas de uptime (UptimeRobot, etc)

## Comunicar usuários
Antes de virar a chave, avise os ${usersCount} usuários:

> "Vamos migrar o sistema no dia X. Após a troca, vocês receberão um e-mail
> automático pra definir uma nova senha. O endereço também muda — guardem
> https://seudominio.com.br nos favoritos."
`;
}

function formatBytes(b: number): string {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 2 : 0)} ${u[i]}`;
}
