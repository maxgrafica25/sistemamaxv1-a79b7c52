// Backup completo do banco (schema + dados + RLS + functions + triggers + auth users sem hashes).
// Protegida: somente admins (is_profile_admin) podem invocar. Service-role só é instanciado
// após validação de admin. Streaming via ReadableStream para não estourar memória.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { getAdminClient, logAdminOperation } from "../_shared/admin-client.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const FormatSchema = z.enum(["sql", "json"]).catch("sql");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const LIMITATIONS = [
  "Senhas de auth.users NAO sao exportadas (Auth API nao expoe hashes). Usuarios precisarao resetar senha no destino.",
  "Configuracoes do GoTrue (templates email, providers OAuth, rate limits) nao migraveis - reaplicar manualmente.",
  "Storage buckets (chat-attachments, maintenance-attachments) NAO inclusos.",
  "pg_cron jobs nao inclusos automaticamente - reaplicar manualmente.",
  "Em bancos > 500MB pode atingir timeout (~150s) da edge function.",
];

// ---------- Helpers ----------

function sqlEscape(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `'${value.toISOString()}'::timestamptz`;
  if (typeof value === "object") {
    const json = JSON.stringify(value).replace(/'/g, "''");
    return `'${json}'::jsonb`;
  }
  const s = String(value).replace(/\\/g, "\\\\").replace(/'/g, "''");
  return `E'${s}'`;
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function buildColumnDef(col: any): string {
  let type = col.data_type as string;
  if (type === "USER-DEFINED" || type === "ARRAY") type = col.udt_name;
  if (type === "character varying" && col.character_maximum_length) {
    type = `varchar(${col.character_maximum_length})`;
  }
  let def = `${quoteIdent(col.name)} ${type}`;
  if (col.column_default) def += ` DEFAULT ${col.column_default}`;
  if (col.is_nullable === "NO") def += " NOT NULL";
  return def;
}

// Kahn's topological sort. Tables com ciclo (raras) saem por nome no fim e suas FKs ficam como ALTER TABLE.
function topoSortTables(tables: string[], fks: any[]): { ordered: string[]; deferredFks: any[] } {
  const tableSet = new Set(tables);
  const indeg = new Map<string, number>(tables.map((t) => [t, 0]));
  const adj = new Map<string, string[]>(tables.map((t) => [t, []]));
  for (const fk of fks) {
    if (!tableSet.has(fk.table_name) || !tableSet.has(fk.foreign_table)) continue;
    if (fk.table_name === fk.foreign_table) continue; // self-ref → defer
    adj.get(fk.foreign_table)!.push(fk.table_name);
    indeg.set(fk.table_name, (indeg.get(fk.table_name) || 0) + 1);
  }
  const queue = tables.filter((t) => (indeg.get(t) || 0) === 0).sort();
  const ordered: string[] = [];
  while (queue.length) {
    const t = queue.shift()!;
    ordered.push(t);
    for (const n of adj.get(t) || []) {
      indeg.set(n, (indeg.get(n) || 0) - 1);
      if (indeg.get(n) === 0) queue.push(n);
    }
  }
  const remaining = tables.filter((t) => !ordered.includes(t)).sort();
  ordered.push(...remaining);
  // FKs que envolvem tabelas em ciclo OU self-refs → defer para ALTER TABLE no final
  const inCycle = new Set(remaining);
  const deferredFks = fks.filter(
    (fk) =>
      fk.table_name === fk.foreign_table ||
      inCycle.has(fk.table_name) ||
      inCycle.has(fk.foreign_table),
  );
  return { ordered, deferredFks };
}

// ---------- Main handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // 1) Auth: valida admin via JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;
  const { data: isAdmin, error: adminErr } = await userClient.rpc("is_profile_admin", {
    _user_id: userId,
  });
  if (adminErr || !isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden: admin required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limit: backups são pesados — 3 por hora por admin
  const rl = await checkRateLimit(`user:${userId}`, "backup_database", 3, 3600);
  if (!rl.allowed) return rateLimitResponse(corsHeaders);

  // 2) Service-role client APÓS validação
  const admin = getAdminClient({
    fnName: "backup-database",
    reason: "Full DB export for disaster recovery (admin-initiated)",
  });

  const url = new URL(req.url);
  const format = FormatSchema.parse(url.searchParams.get("format") ?? "sql");
  const ts = new Date();
  const stamp = ts.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  const filename = `backup-${stamp}.${format}`;

  const encoder = new TextEncoder();
  let bytesWritten = 0;
  let tableCount = 0;
  let userCount = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: string) => {
        const enc = encoder.encode(chunk);
        bytesWritten += enc.byteLength;
        controller.enqueue(enc);
      };

      try {
        // Buscar metadata via helpers
        const [tablesRes, fnsRes, trigsRes, polsRes, idxRes, fksRes, cronRes, pubRes] = await Promise.all([
          admin.rpc("backup_get_tables"),
          admin.rpc("backup_get_functions"),
          admin.rpc("backup_get_triggers"),
          admin.rpc("backup_get_policies"),
          admin.rpc("backup_get_indexes"),
          admin.rpc("backup_get_foreign_keys"),
          admin.rpc("backup_get_cron_jobs"),
          admin.rpc("backup_get_realtime_publication"),
        ]);

        const tables = (tablesRes.data as any[]) || [];
        const functions = (fnsRes.data as any[]) || [];
        const triggers = (trigsRes.data as any[]) || [];
        const policies = (polsRes.data as any[]) || [];
        const indexes = (idxRes.data as any[]) || [];
        const fks = (fksRes.data as any[]) || [];
        const cronJobs = (cronRes.data as any[]) || [];
        const realtimePub = (pubRes.data as any[]) || [];
        tableCount = tables.length;

        const tableNames = tables.map((t) => t.table_name);
        const { ordered, deferredFks } = topoSortTables(tableNames, fks);

        // Auth users (sem hashes)
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
              phone: u.phone,
              created_at: u.created_at,
              email_confirmed_at: u.email_confirmed_at,
              last_sign_in_at: u.last_sign_in_at,
              raw_user_meta_data: u.user_metadata,
              raw_app_meta_data: u.app_metadata,
            });
          }
          if (data.users.length < 1000) break;
          page++;
        }
        userCount = authUsers.length;

        if (format === "json") {
          // ----- JSON streaming: emit progressively -----
          write(`{\n  "generated_at": ${JSON.stringify(ts.toISOString())},\n`);
          write(`  "limitations": ${JSON.stringify(LIMITATIONS)},\n`);
          write(`  "schema": {\n`);
          write(`    "extensions": ["pgcrypto","uuid-ossp","pg_net","pg_cron"],\n`);
          write(`    "tables": ${JSON.stringify(tables)},\n`);
          write(`    "indexes": ${JSON.stringify(indexes)},\n`);
          write(`    "foreign_keys": ${JSON.stringify(fks)},\n`);
          write(`    "functions": ${JSON.stringify(functions)},\n`);
          write(`    "triggers": ${JSON.stringify(triggers)},\n`);
          write(`    "policies": ${JSON.stringify(policies)},\n`);
          write(`    "cron_jobs": ${JSON.stringify(cronJobs)},\n`);
          write(`    "realtime_publication": ${JSON.stringify(realtimePub)}\n`);
          write(`  },\n  "auth_users": ${JSON.stringify(authUsers)},\n`);
          write(`  "data": {\n`);
          for (let i = 0; i < ordered.length; i++) {
            const tname = ordered[i];
            const rows = await fetchAllRows(admin, tname);
            write(`    ${JSON.stringify(tname)}: ${JSON.stringify(rows)}`);
            write(i < ordered.length - 1 ? ",\n" : "\n");
          }
          write(`  }\n}\n`);
        } else {
          // ----- SQL streaming -----
          write(`-- =====================================================\n`);
          write(`-- Backup gerado em: ${ts.toISOString()}\n`);
          write(`-- Formato: SQL (psql compativel)\n`);
          write(`-- Restauracao: psql DESTINO < ${filename}\n`);
          write(`-- LIMITACOES:\n`);
          for (const l of LIMITATIONS) write(`--   * ${l}\n`);
          write(`-- =====================================================\n\n`);
          write(`SET client_encoding = 'UTF8';\nSET standard_conforming_strings = on;\n\n`);

          // Extensions necessárias para o restore funcionar em Postgres limpo
          write(`-- ===== EXTENSIONS =====\n`);
          write(`-- NOTA: pg_cron requer "shared_preload_libraries = 'pg_cron'" em postgresql.conf + restart.\n`);
          write(`-- Se o destino não tiver o package, o CREATE abaixo falhará — comente a linha e reaplique cron jobs manualmente (ver migration-runbook.md).\n`);
          write(`CREATE EXTENSION IF NOT EXISTS pgcrypto;\n`);
          write(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n`);
          write(`CREATE EXTENSION IF NOT EXISTS pg_net;\n`);
          write(`CREATE EXTENSION IF NOT EXISTS pg_cron;\n\n`);

          // Functions primeiro (triggers/policies podem depender)
          write(`-- ===== FUNCTIONS =====\n`);
          for (const f of functions) write(`${f.definition};\n\n`);

          // Tables (ordenadas)
          write(`-- ===== TABLES =====\n`);
          for (const tname of ordered) {
            const tdef = tables.find((t) => t.table_name === tname);
            if (!tdef) continue;
            const cols = (tdef.columns as any[]).map(buildColumnDef).join(",\n  ");
            const pk = tdef.primary_key
              ? `,\n  PRIMARY KEY (${(tdef.primary_key as string[]).map(quoteIdent).join(", ")})`
              : "";
            write(`CREATE TABLE IF NOT EXISTS public.${quoteIdent(tname)} (\n  ${cols}${pk}\n);\n\n`);
          }

          // Indexes
          write(`-- ===== INDEXES =====\n`);
          for (const i of indexes) write(`${i.indexdef};\n`);
          write(`\n`);

          // Data (na ordem topológica, com FKs já resolvidas exceto deferred)
          write(`-- ===== DATA =====\n`);
          for (const tname of ordered) {
            const rows = await fetchAllRows(admin, tname);
            if (!rows.length) continue;
            const cols = Object.keys(rows[0]);
            const colList = cols.map(quoteIdent).join(", ");
            write(`-- ${tname} (${rows.length} rows)\n`);
            for (const row of rows) {
              const vals = cols.map((c) => sqlEscape(row[c])).join(", ");
              write(`INSERT INTO public.${quoteIdent(tname)} (${colList}) VALUES (${vals});\n`);
            }
            write(`\n`);
          }

          // Foreign keys (todas — após dados, evita problemas de ordem)
          write(`-- ===== FOREIGN KEYS =====\n`);
          for (const fk of fks) {
            const cols = (fk.columns as string[]).map(quoteIdent).join(", ");
            const fcols = (fk.foreign_columns as string[]).map(quoteIdent).join(", ");
            write(
              `ALTER TABLE public.${quoteIdent(fk.table_name)} ADD CONSTRAINT ${quoteIdent(fk.constraint_name)} FOREIGN KEY (${cols}) REFERENCES public.${quoteIdent(fk.foreign_table)} (${fcols}) ON DELETE ${fk.on_delete} ON UPDATE ${fk.on_update};\n`,
            );
          }
          write(`\n`);

          // RLS + Policies
          write(`-- ===== RLS & POLICIES =====\n`);
          const tablesWithPolicies = new Set(policies.map((p) => p.tablename));
          for (const t of tablesWithPolicies) {
            write(`ALTER TABLE public.${quoteIdent(t as string)} ENABLE ROW LEVEL SECURITY;\n`);
          }
          for (const p of policies) {
            const cmd = p.cmd || "ALL";
            const roles = Array.isArray(p.roles) ? p.roles.join(", ") : "public";
            const usingClause = p.qual ? ` USING (${p.qual})` : "";
            const checkClause = p.with_check ? ` WITH CHECK (${p.with_check})` : "";
            write(
              `CREATE POLICY ${quoteIdent(p.policyname)} ON public.${quoteIdent(p.tablename)} FOR ${cmd} TO ${roles}${usingClause}${checkClause};\n`,
            );
          }
          write(`\n`);

          // Triggers
          write(`-- ===== TRIGGERS =====\n`);
          for (const t of triggers) write(`${t.definition};\n`);
          write(`\n`);

          // Realtime publication
          write(`-- ===== REALTIME PUBLICATION =====\n`);
          if (realtimePub.length > 0) {
            const tablesList = realtimePub
              .map((r) => `${quoteIdent(r.schemaname)}.${quoteIdent(r.tablename)}`)
              .join(", ");
            write(`-- Recria publicação supabase_realtime com as tabelas que estavam habilitadas.\n`);
            write(`DROP PUBLICATION IF EXISTS supabase_realtime;\n`);
            write(`CREATE PUBLICATION supabase_realtime FOR TABLE ${tablesList};\n\n`);
          } else {
            write(`-- Nenhuma tabela em supabase_realtime no ambiente de origem (ou sem permissão de leitura).\n`);
            write(`-- Para habilitar realtime no destino, ver migration-runbook.md Fase 6.\n\n`);
          }

          // Cron jobs
          write(`-- ===== CRON JOBS =====\n`);
          write(`-- Reagenda jobs do pg_cron (requer extensão instalada e shared_preload_libraries='pg_cron').\n`);
          write(`-- IMPORTANTE: o 'command' de cada job aponta para URLs/keys do AMBIENTE DE ORIGEM.\n`);
          write(`-- Revise e ajuste antes de aplicar no destino.\n`);
          if (cronJobs.length > 0) {
            for (const j of cronJobs) {
              const safeName = String(j.jobname).replace(/'/g, "''");
              write(
                `SELECT cron.unschedule('${safeName}') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='${safeName}');\n`,
              );
              write(
                `SELECT cron.schedule('${safeName}', '${String(j.schedule).replace(/'/g, "''")}', $cron$${j.command}$cron$);\n`,
              );
            }
            write(`\n`);
          } else {
            write(`-- Nenhum cron job exportado (sem permissão em cron.job ou pg_cron ausente).\n\n`);
          }

          // Auth users como comentário JSON
          write(`-- ===== AUTH USERS (sem hashes de senha) =====\n`);
          write(`-- Restaurar manualmente via Auth API. Total: ${authUsers.length} usuarios.\n`);
          write(`/* AUTH_USERS_JSON\n${JSON.stringify(authUsers, null, 2)}\n*/\n`);
        }

        controller.close();

        // Auditoria + histórico
        await Promise.all([
          logAdminOperation(admin, {
            function_name: "backup-database",
            operation: "export_full_backup",
            target_table: "ALL",
            target_count: tableCount,
            invoked_by: userId,
            metadata: { format, size_bytes: bytesWritten, table_count: tableCount, user_count: userCount },
          }),
          admin.from("backup_runs").insert({
            created_by: userId,
            format,
            size_bytes: bytesWritten,
            status: "success",
          }),
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[backup-database] failed:", msg);
        try {
          await admin.from("backup_runs").insert({
            created_by: userId,
            format,
            size_bytes: bytesWritten,
            status: "failed",
            error_message: msg,
          });
        } catch (_) { /* ignore */ }
        controller.error(e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": format === "sql" ? "application/sql; charset=utf-8" : "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});

async function fetchAllRows(admin: any, table: string): Promise<any[]> {
  const all: any[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await admin.from(table).select("*").range(from, from + pageSize - 1);
    if (error) {
      console.warn(`[backup-database] read failed for ${table}:`, error.message);
      break;
    }
    if (!data?.length) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
