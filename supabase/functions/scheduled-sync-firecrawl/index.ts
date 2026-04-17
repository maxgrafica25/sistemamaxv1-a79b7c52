// Sincroniza preços de sites monitorados via Firecrawl.
// - Sem body: percorre todos os sites ativos com metodo_coleta='firecrawl' cujo intervalo expirou.
// - Com { site_id }: força sync de um único site (botão "Sincronizar agora").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIER_SCHEMA = {
  type: "object",
  properties: {
    tiers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quantidade: { type: "number" },
          preco_total: { type: "number" },
          preco_unitario: { type: "number" },
        },
        required: ["quantidade", "preco_total"],
      },
    },
  },
  required: ["tiers"],
};

async function scrapeTiers(url: string, apiKey: string) {
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      onlyMainContent: true,
      formats: [{
        type: "json",
        schema: TIER_SCHEMA,
        prompt: "Extraia TODAS as faixas de preço por quantidade. Inclua todas as linhas da tabela de preços (ex: 1un, 10un, 20un, 50un, 100un).",
      }],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || `Firecrawl ${r.status}`);
  const tiers = (d?.data?.json?.tiers ?? d?.json?.tiers ?? [])
    .map((t: any) => {
      const qtd = Number(t.quantidade) || 0;
      const total = Number(t.preco_total) || 0;
      const uni = Number(t.preco_unitario) || (qtd > 0 ? total / qtd : 0);
      return { quantidade: qtd, preco_total: total, preco_unitario: uni };
    })
    .filter((t: any) => t.quantidade > 0 && t.preco_total > 0);
  return tiers;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIRECRAWL = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL) throw new Error("FIRECRAWL_API_KEY ausente");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const onlySiteId: string | undefined = body?.site_id;

    let query = supabase
      .from("sites_monitorados")
      .select("id, nome_produto, url_completa, metodo_coleta, intervalo_check_horas, timestamp_check, ativo");

    if (onlySiteId) {
      query = query.eq("id", onlySiteId);
    } else {
      query = query.eq("ativo", true).eq("metodo_coleta", "firecrawl");
    }

    const { data: sites, error } = await query;
    if (error) throw error;

    const results: any[] = [];
    for (const site of sites ?? []) {
      // respeita intervalo (a menos que seja sync forçado)
      if (!onlySiteId && site.timestamp_check) {
        const hoursSince = (Date.now() - new Date(site.timestamp_check).getTime()) / 3600000;
        if (hoursSince < (site.intervalo_check_horas ?? 24)) {
          results.push({ site_id: site.id, skipped: true, reason: "interval" });
          continue;
        }
      }
      if (!site.url_completa) {
        results.push({ site_id: site.id, skipped: true, reason: "no_url" });
        continue;
      }

      try {
        const tiers = await scrapeTiers(site.url_completa, FIRECRAWL);
        if (!tiers.length) {
          results.push({ site_id: site.id, error: "sem tiers" });
          continue;
        }

        // posta no webhook unificado (mesma porta da VPS)
        const wh = await fetch(`${SUPABASE_URL}/functions/v1/sync-prices-webhook`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ site_id: site.id, origem: "firecrawl", tiers }),
        });
        const whData = await wh.json();
        results.push({ site_id: site.id, ...whData });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ site_id: site.id, error: msg });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("scheduled-sync-firecrawl:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
