// =====================================================================
// Edge Function: scrape-prices
// Uma única função que chama o Worker Playwright (Railway) e:
//   - modo preview      → POST { urls: string[] }   → devolve resultados crus
//   - modo persistência → POST { site_id: string }  → persiste em
//                          site_precos_tiers + sites_monitorados
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WorkerPrice = {
  quantity: number;
  unit_price: number;
  unit_price_calculated: boolean;
  total_price: number;
};

type WorkerResult = {
  source_url: string;
  scraped_at: string;
  strategy: "api" | "html" | "html-regex";
  prices: WorkerPrice[];
  error: string | null;
  elapsed_ms?: number;
};

function normalizeWorkerUrl(raw: string | undefined): string {
  if (!raw) throw new Error("SCRAPER_WORKER_URL não configurada");
  let u = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    if (!parsed.hostname || !parsed.hostname.includes(".")) {
      throw new Error(`SCRAPER_WORKER_URL inválida: "${raw}"`);
    }
    return parsed.origin;
  } catch {
    throw new Error(`SCRAPER_WORKER_URL inválida: "${raw}"`);
  }
}

async function checkWorkerHealth(origin: string): Promise<{ ok: boolean; detail?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${origin}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return { ok: false, detail: `health HTTP ${r.status}` };
    const j = await r.json().catch(() => null);
    if (!j || j.status !== "ok") return { ok: false, detail: "health inválido" };
    return { ok: true };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function callWorker(urls: string[]): Promise<WorkerResult[]> {
  const origin = normalizeWorkerUrl(Deno.env.get("SCRAPER_WORKER_URL"));
  const secret = Deno.env.get("WORKER_SECRET");
  if (!secret) throw new Error("WORKER_SECRET não configurada");

  const health = await checkWorkerHealth(origin);
  if (!health.ok) {
    throw new Error(
      `Worker offline em ${origin} (${health.detail}). Verifique o deploy no Railway e o secret SCRAPER_WORKER_URL.`,
    );
  }

  const ctrl = new AbortController();
  // Timeout generoso: cada URL leva ~10-25s no Playwright
  const timer = setTimeout(() => ctrl.abort(), 90_000 + urls.length * 30_000);
  try {
    const r = await fetch(`${origin}/scrape`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urls }),
    });
    clearTimeout(timer);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(data?.error || `Worker HTTP ${r.status}`);
    }
    return Array.isArray(data?.results) ? (data.results as WorkerResult[]) : [];
  } catch (e) {
    clearTimeout(timer);
    throw new Error(e instanceof Error ? e.message : String(e));
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
    const urls: string[] | undefined = Array.isArray(body?.urls) ? body.urls : undefined;

    // ---------- Modo PREVIEW ----------
    if (!siteId && urls && urls.length) {
      const results = await callWorker(urls);
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!siteId) {
      return new Response(
        JSON.stringify({ success: false, error: "informe site_id ou urls[]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---------- Modo PERSISTÊNCIA ----------
    const { data: site, error: siteErr } = await supabase
      .from("sites_monitorados")
      .select("id, url_completa, nome_produto")
      .eq("id", siteId)
      .maybeSingle();

    if (siteErr || !site) {
      return new Response(
        JSON.stringify({ success: false, error: "site não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!site.url_completa) {
      await supabase.from("sites_monitorados").update({
        scrape_status: "error",
        scrape_error: "URL vazia",
        scrape_source: "playwright",
        timestamp_check: new Date().toISOString(),
      }).eq("id", site.id);
      return new Response(
        JSON.stringify({ success: false, error: "URL vazia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let results: WorkerResult[] = [];
    try {
      results = await callWorker([site.url_completa]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("sites_monitorados").update({
        scrape_status: "error",
        scrape_error: msg,
        scrape_source: "playwright",
        timestamp_check: new Date().toISOString(),
      }).eq("id", site.id);
      return new Response(
        JSON.stringify({ success: false, error: msg, site_id: site.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = results[0];
    if (!result || !result.prices.length) {
      await supabase.from("sites_monitorados").update({
        scrape_status: "error",
        scrape_error: result?.error || "Nenhum tier encontrado",
        scrape_source: "playwright",
        timestamp_check: new Date().toISOString(),
      }).eq("id", site.id);
      return new Response(
        JSON.stringify({ success: false, error: result?.error || "sem tiers", site_id: site.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Marca tiers existentes como inativos
    await supabase.from("site_precos_tiers").update({ ativo: false }).eq("site_id", site.id);

    // Upsert por (site_id, quantidade)
    const nowIso = new Date().toISOString();
    for (const p of result.prices) {
      const { data: existing } = await supabase
        .from("site_precos_tiers")
        .select("id")
        .eq("site_id", site.id)
        .eq("quantidade", p.quantity)
        .maybeSingle();

      const row = {
        site_id: site.id,
        quantidade: p.quantity,
        preco_total: p.total_price,
        preco_unitario: p.unit_price,
        ativo: true,
        atualizado_em: nowIso,
      };

      if (existing) {
        await supabase.from("site_precos_tiers").update(row).eq("id", existing.id);
      } else {
        await supabase.from("site_precos_tiers").insert(row);
      }
    }

    const minUnit = Math.min(...result.prices.map((p) => p.unit_price));
    await supabase.from("sites_monitorados").update({
      preco_atual: minUnit,
      scrape_status: "ok",
      scrape_error: null,
      scrape_source: "playwright",
      timestamp_check: nowIso,
    }).eq("id", site.id);

    return new Response(
      JSON.stringify({
        success: true,
        site_id: site.id,
        tiers_count: result.prices.length,
        strategy: result.strategy,
        elapsed_ms: result.elapsed_ms,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("scrape-prices:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
