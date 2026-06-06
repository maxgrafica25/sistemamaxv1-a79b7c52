import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM_VARS = new Set([
  "PATH", "HOME", "DENO_DIR", "HOSTNAME", "PORT", "TMPDIR", "USER",
  "LANG", "TERM", "_", "DENO_REGION", "DENO_DEPLOYMENT_ID",
]);

const knownFunctionNames = [
  "assistente-virtual",
  "backup-database",
  "backup-storage",
  "check-login-attempts",
  "check-overdue-readings",
  "check-reminders",
  "gcal-sync-worker",
  "generate-vps-package",
  "google-disconnect",
  "google-oauth-callback",
  "google-oauth-init",
  "invite-user",
  "migrate-sql",
  "monitor-admin-usage",
  "painel-migracao",
  "rate-limit-login",
  "reminders-api",
  "rest-proxy",
  "scrape-prices",
  "scrape-prices-cron",
  "sync-prices-webhook",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const env = Deno.env.toObject();
    const SUPABASE_URL = env.SUPABASE_URL ?? "";
    const anon_key = env.SUPABASE_ANON_KEY ?? env.SUPABASE_PUBLISHABLE_KEY ?? "";
    const service_role_key = env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    // Secrets extras (filtrando sistema + chaves principais já retornadas)
    const secrets: Record<string, string> = {};
    for (const [k, v] of Object.entries(env)) {
      if (SYSTEM_VARS.has(k)) continue;
      if (k.startsWith("XDG_")) continue;
      if (["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL"].includes(k)) continue;
      secrets[k] = v;
    }

    // Edge Functions via probe
    const probes = await Promise.allSettled(
      knownFunctionNames.map((name) =>
        fetch(`${SUPABASE_URL}/functions/v1/${name}`, { method: "OPTIONS" })
          .then((r) => ({ name, status: r.status })),
      ),
    );
    const edge_functions = probes
      .filter((p): p is PromiseFulfilledResult<{ name: string; status: number }> =>
        p.status === "fulfilled" && p.value.status < 500,
      )
      .map((p) => p.value.name);

    // Tabelas do banco via exec_sql
    let database_tables: unknown[] = [];
    let database_error: string | null = null;
    try {
      const admin = createClient(SUPABASE_URL, service_role_key);
      const tableQuery = `
        SELECT
          t.tablename,
          COALESCE((SELECT n_live_tup FROM pg_stat_user_tables s WHERE s.relname = t.tablename AND s.schemaname = 'public'), 0)::int AS row_count,
          (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.tablename)::int AS column_count,
          (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.tablename AND (c.column_name ILIKE '%password%' OR c.column_name ILIKE '%secret%' OR c.column_name ILIKE '%token%' OR c.column_name ILIKE '%encrypted%'))::int AS encrypted_columns,
          EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.tablename AND c.column_name = 'user_id') AS has_user_id
        FROM pg_tables t
        WHERE t.schemaname = 'public'
        ORDER BY t.tablename
      `;
      const { data, error } = await admin.rpc("exec_sql", { sql_query: tableQuery });
      if (error) database_error = error.message;
      else database_tables = (data as unknown[]) ?? [];
    } catch (e) {
      database_error = (e as Error).message;
    }

    return new Response(
      JSON.stringify({
        project_url: SUPABASE_URL,
        anon_key,
        service_role_key,
        secrets,
        edge_functions,
        edge_functions_count: edge_functions.length,
        database_tables,
        database_error,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
