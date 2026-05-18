// Gera um pacote ZIP completo para auto-hospedar o sistema numa VPS.
// Conteúdo: database.sql + auth-users.json + cron-jobs.sql (reescrito) +
// realtime.sql + secrets-checklist.md + INSTALL.md em português.
// Sobe o ZIP no bucket "vps-packages" e retorna URL assinada (7 dias).
// Mantém no máximo 3 pacotes simultâneos (auto-limpeza).
//
// Fase 1: dados + configs + manual. Fase 2 adicionará arquivos de Storage.
//
// Protegida: apenas admins (is_profile_admin).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { zipSync, strToU8, type Zippable } from "https://esm.sh/fflate@0.8.2";
import { getAdminClient, logAdminOperation } from "../_shared/admin-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const BUCKET = "vps-packages";
const KEEP_PACKAGES = 3;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1) Auth + admin check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) return json({ error: "Unauthorized" }, 401);

  const { data: isAdmin } = await userClient.rpc("is_profile_admin", { _user_id: userData.user.id });
  if (!isAdmin) return json({ error: "Forbidden: admin required" }, 403);

  const admin = getAdminClient({
    fnName: "generate-vps-package",
    reason: "Generate self-hosting package for VPS migration (admin-initiated)",
  });

  try {
    // 2) Buscar database.sql via backup-database (reaproveita lógica existente)
    const dbResp = await fetch(`${SUPABASE_URL}/functions/v1/backup-database?format=sql`, {
      headers: { Authorization: authHeader },
    });
    if (!dbResp.ok) {
      const txt = await dbResp.text();
      throw new Error(`backup-database falhou: ${dbResp.status} ${txt.slice(0, 200)}`);
    }
    const databaseSql = await dbResp.text();

    // 3) Listar usuários auth (sem hashes)
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

    // 4) Buscar cron jobs e reescrever com placeholders
    const { data: cronJobsRaw } = await admin.rpc("backup_get_cron_jobs");
    const cronJobsArr = (cronJobsRaw as any[]) || [];
    const cronJobsSql = buildCronJobsSql(cronJobsArr);

    // 5) Realtime publication
    const { data: realtimeRaw } = await admin.rpc("backup_get_realtime_publication");
    const realtimeArr = (realtimeRaw as any[]) || [];
    const realtimeSql = buildRealtimeSql(realtimeArr);

    // 6) Listar tamanho do storage por bucket (informativo no manual)
    const storageInfo = await collectStorageInfo(admin);

    // 7) Documentos textuais
    const installMd = buildInstallMd(authUsers.length, cronJobsArr.length, storageInfo);
    const secretsMd = buildSecretsChecklist();
    const usersJson = JSON.stringify({ generated_at: new Date().toISOString(), count: authUsers.length, users: authUsers }, null, 2);

    // 8) Empacotar ZIP
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    const filename = `pacote-vps-${stamp}.zip`;
    const zipPayload: Zippable = {
      "INSTALL.md": strToU8(installMd),
      "checklist-pos-instalacao.md": strToU8(buildPostInstallChecklist()),
      ".env.exemplo": strToU8(buildEnvExample()),
      "dados/database.sql": strToU8(databaseSql),
      "dados/auth-users.json": strToU8(usersJson),
      "dados/cron-jobs.sql": strToU8(cronJobsSql),
      "dados/realtime.sql": strToU8(realtimeSql),
      "dados/secrets-checklist.md": strToU8(secretsMd),
      "LEIA-ME-PRIMEIRO.txt": strToU8(buildReadmeFirst(filename)),
    };
    const zipBytes = zipSync(zipPayload, { level: 6 });

    // 9) Upload no bucket
    const path = `${filename}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, zipBytes, {
      contentType: "application/zip",
      upsert: true,
    });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

    // 10) Auto-limpeza: manter apenas KEEP_PACKAGES mais recentes
    const cleaned = await cleanupOldPackages(admin);

    // 11) URL assinada
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signErr) throw new Error(`Signed URL falhou: ${signErr.message}`);

    // 12) Audit log
    await logAdminOperation(admin, {
      function_name: "generate-vps-package",
      operation: "package_generated",
      invoked_by: userData.user.id,
      target_count: 1,
      metadata: {
        filename,
        size_bytes: zipBytes.byteLength,
        users_count: authUsers.length,
        cron_jobs_count: cronJobsArr.length,
        cleaned_old_packages: cleaned,
      },
    });

    return json({
      success: true,
      filename,
      size_bytes: zipBytes.byteLength,
      download_url: signed.signedUrl,
      expires_in_days: 7,
      contents: {
        users: authUsers.length,
        cron_jobs: cronJobsArr.length,
        realtime_tables: realtimeArr.length,
        storage_files_total: storageInfo.totalFiles,
        storage_size_bytes: storageInfo.totalBytes,
      },
      note: "Fase 1: pacote inclui banco + usuários + cron + manual. Arquivos do Storage NÃO inclusos ainda — baixe pelo botão antigo 'Exportar lista de arquivos (Storage)'.",
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

// ----- Construtores de arquivos -----

function buildCronJobsSql(jobs: any[]): string {
  if (!jobs.length) {
    return "-- Nenhum cron job encontrado no projeto de origem.\n";
  }
  const header = `-- Cron jobs reescritos para o destino.
-- ANTES de rodar: substitua os placeholders abaixo no editor de texto:
--   {{API_BASE_URL}}  → URL pública das suas edge functions na VPS
--                       (ex: https://api.seudominio.com.br/functions/v1)
--   {{SERVICE_ROLE_KEY}} → service_role key gerada pelo seu Supabase self-hosted
--
-- Pré-requisitos no destino: extensões pg_cron e pg_net habilitadas.
-- Rodar como superuser no banco da VPS:
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- Depois aplique este arquivo:
--   psql -U postgres -d postgres < cron-jobs.sql
\n`;
  const body = jobs.map((j) => {
    const command = String(j.command || "")
      .replaceAll(/https?:\/\/[a-z0-9.-]+\/functions\/v1/gi, "{{API_BASE_URL}}")
      .replaceAll(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer {{SERVICE_ROLE_KEY}}")
      .replaceAll(/'[A-Za-z0-9._-]{100,}'/g, "'{{SERVICE_ROLE_KEY}}'");
    return `-- Job: ${j.jobname} (${j.schedule})\nSELECT cron.schedule(\n  ${sqlLiteral(j.jobname)},\n  ${sqlLiteral(j.schedule)},\n  $job$${command}$job$\n);\n`;
  }).join("\n");
  const verify = `\n-- Verificar:\nSELECT jobname, schedule, active FROM cron.job ORDER BY jobname;\n`;
  return header + body + verify;
}

function buildRealtimeSql(pubs: any[]): string {
  if (!pubs.length) return "-- Nenhuma tabela com realtime habilitada.\n";
  const tables = pubs.map((p) => `  ${p.schemaname}.${p.tablename}`).join(",\n");
  return `-- Recria a publication do Supabase Realtime no destino.\n-- Execute APÓS restaurar database.sql.\n\nDROP PUBLICATION IF EXISTS supabase_realtime;\nCREATE PUBLICATION supabase_realtime FOR TABLE\n${tables};\n\n-- Verificar:\nSELECT pubname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime';\n`;
}

async function collectStorageInfo(admin: ReturnType<typeof getAdminClient>) {
  const buckets = ["chat-attachments", "maintenance-attachments", "quote-attachments"];
  let totalFiles = 0;
  let totalBytes = 0;
  const perBucket: Record<string, { files: number; bytes: number }> = {};
  for (const b of buckets) {
    try {
      const { data, error } = await admin.storage.from(b).list("", { limit: 1000 });
      if (error || !data) {
        perBucket[b] = { files: 0, bytes: 0 };
        continue;
      }
      let files = 0;
      let bytes = 0;
      for (const o of data) {
        if (o.name && !o.id) continue; // pasta
        files++;
        bytes += (o.metadata as any)?.size ?? 0;
      }
      perBucket[b] = { files, bytes };
      totalFiles += files;
      totalBytes += bytes;
    } catch {
      perBucket[b] = { files: 0, bytes: 0 };
    }
  }
  return { totalFiles, totalBytes, perBucket };
}

async function cleanupOldPackages(admin: ReturnType<typeof getAdminClient>): Promise<number> {
  const { data: list, error } = await admin.storage.from(BUCKET).list("", {
    limit: 100,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error || !list) return 0;
  const old = list.slice(KEEP_PACKAGES).map((o) => o.name);
  if (!old.length) return 0;
  await admin.storage.from(BUCKET).remove(old);
  return old.length;
}

function sqlLiteral(s: string): string {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function buildEnvExample(): string {
  return `# === Configuração da VPS — preencha antes de rodar ./instalar.sh ===

# Domínio público que vai servir o app (sem https://, ex: maxgrafica.com.br)
DOMINIO_PRINCIPAL=seudominio.com.br

# Domínio das APIs do Supabase self-hosted (subdomínio, ex: api.maxgrafica.com.br)
DOMINIO_API=api.seudominio.com.br

# E-mail para os certificados Let's Encrypt (precisa ser válido)
EMAIL_TLS=admin@seudominio.com.br

# === Credenciais OAuth do Google (criar em https://console.cloud.google.com) ===
# Passo-a-passo no INSTALL.md, seção "Google OAuth"
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# === SMTP para envio dos e-mails de reset de senha ===
# Pode usar Gmail (com senha de app), SendGrid, Resend, Mailgun, etc.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=naoresponda@seudominio.com.br
SMTP_FROM_NAME=MaxGráfica

# === As variáveis abaixo serão GERADAS automaticamente pelo instalar.sh ===
# Não preencha manualmente, salvo se souber o que está fazendo.
# JWT_SECRET=
# POSTGRES_PASSWORD=
# ANON_KEY=
# SERVICE_ROLE_KEY=
# MINIO_ROOT_PASSWORD=
`;
}

function buildSecretsChecklist(): string {
  return `# Checklist de secrets para configurar nas Edge Functions

Após o \`instalar.sh\` rodar, configure no Supabase self-hosted (Dashboard → Edge Functions → Secrets):

## Obrigatórios
- [ ] \`SUPABASE_URL\` — preenchido automaticamente pelo instalador
- [ ] \`SUPABASE_SERVICE_ROLE_KEY\` — preenchido automaticamente
- [ ] \`SUPABASE_ANON_KEY\` — preenchido automaticamente
- [ ] \`LOVABLE_API_KEY\` — copie do seu workspace Lovable (Configurações → Lovable AI Gateway)

## Para integração Google Calendar
- [ ] \`GOOGLE_OAUTH_CLIENT_ID\` — do .env
- [ ] \`GOOGLE_OAUTH_CLIENT_SECRET\` — do .env
- [ ] \`GOOGLE_OAUTH_REDIRECT_URI\` — \`https://api.seudominio.com.br/functions/v1/google-oauth-callback\`
- [ ] \`GOOGLE_OAUTH_STATE_SECRET\` — gere com \`openssl rand -base64 32\`
- [ ] \`GOOGLE_API_KEY\` — só se usar APIs públicas do Google

## Opcionais (recursos avançados)
- [ ] \`BROWSERLESS_API_KEY\` — para scraping de preços (https://browserless.io)

> Sem \`LOVABLE_API_KEY\`, o assistente virtual e sugestões de IA param de funcionar.
> Os outros são opcionais — o sistema funciona sem eles, apenas algumas features ficam off.
`;
}

function buildReadmeFirst(filename: string): string {
  return `==========================================================
  MAXGRAFICA — PACOTE DE INSTALAÇÃO VPS
  ${filename}
==========================================================

LEIA ESTE ARQUIVO PRIMEIRO!

Você baixou um pacote completo para instalar o sistema
na sua VPS (servidor próprio). Para começar:

1. Descompacte este ZIP num diretório da VPS:
     unzip ${filename}
     cd pacote-vps-*

2. Abra o arquivo INSTALL.md e siga passo-a-passo.
   Está em português, escrito para leigos.

3. Em caso de dúvida, leia o checklist-pos-instalacao.md
   no final do processo.

==========================================================
Validade do link de download: 7 dias
Gerado automaticamente pelo botão "Gerar pacote VPS"
==========================================================
`;
}

function buildInstallMd(usersCount: number, cronCount: number, storage: any): string {
  return `# Instalação do MaxGráfica na sua VPS

> **Para leigos.** Siga na ordem, sem pular passos.
> Tempo estimado: **60 a 90 minutos** na primeira vez.

---

## Resumo do que este pacote contém

- **Banco de dados** completo com todos os seus dados (schema + RLS + funções + triggers).
- **${usersCount} usuários** cadastrados (sem senhas — todos receberão e-mail pra redefinir).
- **${cronCount} tarefas agendadas** já reescritas pro novo domínio.
- **Manual passo-a-passo** (este arquivo).
- **Arquivos do Storage:** ${storage.totalFiles} arquivos, ${formatBytes(storage.totalBytes)} no total. ⚠️ **NÃO incluídos nesta versão do pacote.** Use o botão "Exportar lista de arquivos (Storage)" no painel para baixar separado.

---

## Pré-requisitos da VPS

- **Sistema:** Ubuntu 22.04 ou Debian 12
- **RAM:** mínimo 4 GB (recomendado 8 GB)
- **Disco:** mínimo 40 GB livres
- **Portas livres:** 80 e 443
- **Docker** e **docker-compose** instalados ([guia oficial](https://docs.docker.com/engine/install/))
- **Domínio próprio** com 2 subdomínios apontando pro IP da VPS:
  - \`seudominio.com.br\` → frontend
  - \`api.seudominio.com.br\` → APIs do Supabase

---

## Passo 1 — Preparar variáveis (5 min)

1. Abra o arquivo \`.env.exemplo\` num editor de texto.
2. Preencha os campos com seus dados (domínio, e-mail, SMTP).
3. **Salve como \`.env\`** (sem o \`.exemplo\`) no mesmo diretório.

---

## Passo 2 — Criar credenciais Google (10 min)

Sem isso, o login com Google e a sincronização do Calendar não funcionam.

1. Acesse https://console.cloud.google.com
2. Crie um projeto novo (ou use um existente).
3. Vá em **APIs e Serviços → Credenciais**.
4. Clique em **Criar credenciais → ID do cliente OAuth**.
5. Tipo de aplicativo: **Aplicativo da Web**.
6. **URIs de redirecionamento autorizados:** adicione:
   - \`https://api.seudominio.com.br/functions/v1/google-oauth-callback\`
7. Copie o **Client ID** e **Client Secret** para o \`.env\`.

---

## Passo 3 — Subir o stack (5 min)

> ⚠️ A Fase 1 deste pacote ainda **não inclui** o \`docker-compose.yml\` nem o \`instalar.sh\` automatizado. Esses arquivos virão na Fase 2.
> Por ora, siga o runbook manual em \`docs/migration-runbook.md\` do repositório principal.

Quando o instalador automatizado estiver pronto, você só vai precisar de:

\`\`\`bash
chmod +x instalar.sh
./instalar.sh
\`\`\`

E o script vai:
- Verificar pré-requisitos
- Gerar todas as chaves de segurança
- Subir Postgres, Auth, Storage e Edge Functions
- Restaurar o banco
- Importar os usuários e disparar reset de senha
- Aplicar cron jobs e realtime
- Imprimir o que falta fazer manualmente

---

## Passo 4 — Smoke tests (5 min)

Após subir, valide:

- [ ] \`https://seudominio.com.br\` carrega a tela de login
- [ ] Faz login com a senha redefinida pelo e-mail
- [ ] Lista de clientes aparece com dados
- [ ] Consegue criar um orçamento
- [ ] Anexar arquivo no chat funciona
- [ ] Disparar um reminder manualmente

---

## Suporte

Em caso de problema, anexe:
- Saída completa do \`./instalar.sh\`
- Logs de \`docker compose logs --tail 200\`
- Versão do pacote: ver no nome do arquivo ZIP

E veja \`checklist-pos-instalacao.md\` para itens que **sempre** precisam de configuração manual.
`;
}

function buildPostInstallChecklist(): string {
  return `# Checklist pós-instalação

Itens que o instalador automático **não consegue fazer** por você:

## 🔴 Obrigatórios para o app funcionar
- [ ] DNS dos 2 subdomínios apontando pro IP da VPS (aguardar propagação até 24h)
- [ ] Certificado TLS ativo (Caddy faz sozinho, mas valide acessando https://)
- [ ] Credenciais Google OAuth criadas e cadastradas no .env
- [ ] SMTP testado (envie um reset de senha pra você mesmo)

## 🟡 Recomendados antes de colocar em produção
- [ ] Backup automático do volume Docker do Postgres (cron na própria VPS)
- [ ] Monitoramento de espaço em disco (alerta quando passar 80%)
- [ ] Firewall (ufw) liberando apenas 22, 80, 443

## 🟢 Opcionais
- [ ] Configurar templates de e-mail do Auth (boas-vindas, reset) em PT-BR
- [ ] Integrar com Cloudflare na frente (DDoS + cache)
- [ ] CDN para arquivos do Storage (se ficar pesado)

## Avisar usuários
Antes de virar a chave, envie pra todos os ${0} usuários:

> "Olá! Vamos mudar a hospedagem do sistema na próxima [DATA]. Após a troca, você precisará redefinir sua senha (vai receber um e-mail automático). O endereço também muda de [OLD] para [NEW]. Salve nos favoritos!"
`;
}

function formatBytes(b: number): string {
  if (!b) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i ? 2 : 0)} ${u[i]}`;
}
