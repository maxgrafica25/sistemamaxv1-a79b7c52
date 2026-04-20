// Cron orchestrator: runs daily and triggers scrape-prices for every active monitored site.
// Postgres triggers automatically generate price-drop alerts and history rows.
//
// SERVICE ROLE: necessária — invocada por cron sem JWT de usuário; precisa ler
// todos os sites ativos (RLS authenticated não se aplica). Cliente criado via
// wrapper auditado (_shared/admin-client).

import { getAdminClient, logAdminOperation } from "../_shared/admin-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getAdminClient({
    fnName: "scrape-prices-cron",
    reason: "Cron diário: ler todos os sites monitorados ativos e disparar scrape-prices",
  });

  const startedAt = new Date().toISOString();
  console.log(`[scrape-prices-cron] starting at ${startedAt}`);

  const { data: sites, error } = await supabase
    .from("sites_monitorados")
    .select("id, nome_produto, fornecedor_nome, ativo")
    .eq("ativo", true);

  if (error) {
    console.error("[scrape-prices-cron] failed to load sites", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const total = sites?.length ?? 0;
  let ok = 0;
  let fail = 0;
  const failures: { site_id: string; error: string }[] = [];

  for (const site of sites || []) {
    try {
      const { data, error: invErr } = await supabase.functions.invoke("scrape-prices", {
        body: { site_id: site.id },
      });
      if (invErr) throw invErr;
      if (!data?.success) throw new Error(data?.error || "scrape-prices returned failure");
      ok++;
      console.log(`[scrape-prices-cron] ok: ${site.nome_produto} (${site.fornecedor_nome || "?"})`);
    } catch (e: any) {
      fail++;
      const msg = e?.message || String(e);
      failures.push({ site_id: site.id, error: msg });
      console.error(`[scrape-prices-cron] fail: ${site.nome_produto} — ${msg}`);
    }
  }

  const summary = { total, ok, fail, startedAt, finishedAt: new Date().toISOString(), failures };
  console.log(`[scrape-prices-cron] done`, summary);

  await logAdminOperation(supabase, {
    function_name: "scrape-prices-cron",
    operation: "orchestrate_scrape",
    target_table: "sites_monitorados",
    target_count: total,
    metadata: { ok, fail },
  });

  return new Response(JSON.stringify({ success: true, ...summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
