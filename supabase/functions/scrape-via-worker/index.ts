// Edge Function: chama o Worker Railway (Playwright) e faz upsert dos tiers em site_precos_tiers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tier = { quantidade: number; preco: number };

async function callWorker(url: string): Promise<{ tiers: Tier[]; error?: string; elapsed_ms?: number }> {
  const workerUrl = Deno.env.get("SCRAPER_WORKER_URL");
  const workerSecret = Deno.env.get("WORKER_SECRET");
  if (!workerUrl) throw new Error("SCRAPER_WORKER_URL não configurada");
  if (!workerSecret) throw new Error("WORKER_SECRET não configurada");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const r = await fetch(`${workerUrl.replace(/\/$/, "")}/scrape`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${workerSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });
    clearTimeout(timer);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return { tiers: [], error: data?.error || `Worker HTTP ${r.status}` };
    }
    return {
      tiers: Array.isArray(data?.tiers) ? data.tiers : [],
      error: data?.error,
      elapsed_ms: data?.elapsed_ms,
    };
  } catch (e) {
    clearTimeout(timer);
    return { tiers: [], error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const siteId: string | undefined = body?.site_id;
    const directUrl: string | undefined = body?.url;

    if (!siteId && !directUrl) {
      return new Response(JSON.stringify({ success: false, error: "site_id ou url obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Modo "preview": só extrair tiers sem persistir (usado pelo NovoSiteDialog antes de salvar)
    if (!siteId && directUrl) {
      const result = await callWorker(directUrl);
      if (result.error && !result.tiers.length) {
        return new Response(JSON.stringify({ success: false, error: result.error, url: directUrl }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Normaliza para o mesmo shape de detect-price-tiers
      const tiers = result.tiers.map((t) => ({
        quantidade: t.quantidade,
        preco_total: t.preco,
        preco_unitario: t.quantidade > 0 ? t.preco / t.quantidade : 0,
      }));
      return new Response(JSON.stringify({ success: true, url: directUrl, tiers, source: "worker" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Modo "site_id": busca site, scrapeia e persiste
    const { data: site, error: siteErr } = await supabase
      .from("sites_monitorados")
      .select("id, url_completa, nome_produto, fornecedor_nome")
      .eq("id", siteId!)
      .maybeSingle();
    if (siteErr || !site) {
      return new Response(JSON.stringify({ success: false, error: "site não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!site.url_completa) {
      await supabase.from("sites_monitorados")
        .update({ scrape_status: "error", scrape_error: "URL vazia", scrape_source: "worker" })
        .eq("id", site.id);
      return new Response(JSON.stringify({ success: false, error: "URL vazia" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await callWorker(site.url_completa);

    if (!result.tiers.length) {
      await supabase.from("sites_monitorados")
        .update({
          scrape_status: "error",
          scrape_error: result.error || "Nenhuma faixa encontrada",
          scrape_source: "worker",
          timestamp_check: new Date().toISOString(),
        })
        .eq("id", site.id);
      return new Response(JSON.stringify({ success: false, error: result.error || "sem tiers", site_id: site.id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert dos tiers em site_precos_tiers
    // Marca todos os tiers ativos do site como inativos primeiro, depois insere os novos
    await supabase.from("site_precos_tiers").update({ ativo: false }).eq("site_id", site.id);

    const rows = result.tiers.map((t) => ({
      site_id: site.id,
      quantidade: t.quantidade,
      preco_total: t.preco,
      preco_unitario: t.quantidade > 0 ? t.preco / t.quantidade : 0,
      ativo: true,
      atualizado_em: new Date().toISOString(),
    }));

    // Para cada tier, tentar update por (site_id, quantidade); senão insert
    for (const row of rows) {
      const { data: existing } = await supabase
        .from("site_precos_tiers")
        .select("id, preco_total")
        .eq("site_id", site.id)
        .eq("quantidade", row.quantidade)
        .maybeSingle();
      if (existing) {
        await supabase.from("site_precos_tiers")
          .update({
            preco_total: row.preco_total,
            preco_unitario: row.preco_unitario,
            ativo: true,
            atualizado_em: row.atualizado_em,
          })
          .eq("id", existing.id);
      } else {
        await supabase.from("site_precos_tiers").insert(row);
      }
    }

    // Atualiza preco_atual do site = menor preço unitário
    const minUnit = Math.min(...rows.map((r) => r.preco_unitario));
    await supabase.from("sites_monitorados")
      .update({
        preco_atual: minUnit,
        scrape_status: "ok",
        scrape_error: null,
        scrape_source: "worker",
        timestamp_check: new Date().toISOString(),
      })
      .eq("id", site.id);

    return new Response(JSON.stringify({
      success: true,
      site_id: site.id,
      tiers_count: rows.length,
      elapsed_ms: result.elapsed_ms,
      source: "worker",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("scrape-via-worker:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
