// =====================================================================
// Edge Function: scrape-prices (Browserless.io + Cheerio)
//   - modo preview      → POST { urls: string[] }   → devolve resultados crus
//   - modo persistência → POST { site_id: string }  → persiste em
//                          site_precos_tiers + sites_monitorados
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as cheerio from "npm:cheerio@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BROWSERLESS_BASE = "https://production-sfo.browserless.io";

type Price = {
  quantity: number;
  unit_price: number;
  unit_price_calculated: boolean;
  total_price: number;
};

type ScrapeResult = {
  source_url: string;
  scraped_at: string;
  strategy: "html" | "html-regex" | "function-atualcard";
  prices: Price[];
  error: string | null;
  elapsed_ms?: number;
};

// ---------- Normalização BR ----------
function parsePriceBR(raw: string): number | null {
  if (!raw) return null;
  let s = String(raw).replace(/R\$/gi, "").replace(/\s/g, "").trim();
  if (!s) return null;
  // BR: 1.234,56 → 1234.56  |  US: 1234.56 mantém
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseQty(raw: string): number | null {
  if (!raw) return null;
  const m = String(raw).replace(/\./g, "").match(/(\d{1,7})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function isValidQty(q: number): boolean {
  return q >= 1 && q <= 1_000_000;
}
function isValidPrice(p: number): boolean {
  return p > 0 && p < 1_000_000;
}

// ---------- Finalização e dedupe ----------
type RawTier = { quantity: number; unit_price?: number; total_price?: number };

function finalizeTiers(raw: RawTier[], urlForLog: string): Price[] {
  const byQty = new Map<number, RawTier>();
  for (const t of raw) {
    if (!isValidQty(t.quantity)) continue;
    if (!byQty.has(t.quantity)) byQty.set(t.quantity, t);
  }
  const out: Price[] = [];
  for (const t of [...byQty.values()].sort((a, b) => a.quantity - b.quantity)) {
    let unit = t.unit_price ?? null;
    let total = t.total_price ?? null;
    let calculated = false;
    if (unit == null && total != null) {
      unit = total / t.quantity;
      calculated = true;
      console.warn(`[unit_calc] ${urlForLog} qty=${t.quantity} total=${total} unit=${unit}`);
    } else if (total == null && unit != null) {
      total = unit * t.quantity;
    }
    if (unit == null || total == null) continue;
    if (!isValidPrice(unit) || !isValidPrice(total)) continue;
    out.push({
      quantity: t.quantity,
      unit_price: Math.round(unit * 10000) / 10000,
      total_price: Math.round(total * 100) / 100,
      unit_price_calculated: calculated,
    });
  }
  return out;
}

// ---------- Estratégias HTML ----------
function extractFromTables($: cheerio.CheerioAPI): RawTier[] {
  const tiers: RawTier[] = [];
  $("table").each((_, tbl) => {
    $(tbl).find("tr").each((_, tr) => {
      const cells = $(tr).find("td,th").map((_, c) => $(c).text().trim()).get();
      if (cells.length < 2) return;
      // Tenta achar coluna qty + 1 ou 2 colunas de preço
      let qty: number | null = null;
      const prices: number[] = [];
      for (const cell of cells) {
        const q = parseQty(cell);
        const p = parsePriceBR(cell);
        // Se a célula tem "R$" é preço; se é só número puro pequeno-grande pode ser qty
        if (/R\$/i.test(cell) && p != null) {
          prices.push(p);
        } else if (qty == null && q != null && !/R\$/i.test(cell)) {
          qty = q;
        } else if (p != null && q == null) {
          prices.push(p);
        }
      }
      if (qty != null && prices.length >= 1) {
        // Heurística: se 2 preços e o menor < maior/qty*1.2 → menor=unit, maior=total
        if (prices.length >= 2) {
          const sorted = [...prices].sort((a, b) => a - b);
          const unit = sorted[0];
          const total = sorted[sorted.length - 1];
          tiers.push({ quantity: qty, unit_price: unit, total_price: total });
        } else {
          tiers.push({ quantity: qty, total_price: prices[0] });
        }
      }
    });
  });
  return tiers;
}

function extractFromLists($: cheerio.CheerioAPI): RawTier[] {
  const tiers: RawTier[] = [];
  const sel = "ul li, ol li, [class*=preco], [class*=tier], [class*=price], [class*=quantidade]";
  $(sel).each((_, el) => {
    const txt = $(el).text().replace(/\s+/g, " ").trim();
    if (!txt || txt.length > 200) return;
    const qtyMatch = txt.match(/(\d{2,6})\s*(?:un|unidades|x|pç|pcs|peças)?/i);
    const priceMatches = [...txt.matchAll(/R\$\s*([\d.,]+)/gi)];
    if (!qtyMatch || priceMatches.length === 0) return;
    const qty = parseQty(qtyMatch[1]);
    if (qty == null) return;
    const prices = priceMatches.map((m) => parsePriceBR(m[1])).filter((n): n is number => n != null);
    if (!prices.length) return;
    if (prices.length >= 2) {
      const sorted = [...prices].sort((a, b) => a - b);
      tiers.push({ quantity: qty, unit_price: sorted[0], total_price: sorted[sorted.length - 1] });
    } else {
      tiers.push({ quantity: qty, total_price: prices[0] });
    }
  });
  return tiers;
}

function extractByRegex(html: string): RawTier[] {
  const tiers: RawTier[] = [];
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  // Procura padrões "1000 ... R$ 96,99"
  const re = /(\d{2,6})\s*(?:un|unid|unidades|x|pç|pcs|peças)?[^R$]{0,80}R\$\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const qty = parseQty(m[1]);
    const price = parsePriceBR(m[2]);
    if (qty != null && price != null) {
      tiers.push({ quantity: qty, total_price: price });
    }
  }
  return tiers;
}

// ---------- Browserless ----------
async function fetchRenderedHtml(url: string, token: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const r = await fetch(`${BROWSERLESS_BASE}/content?token=${encodeURIComponent(token)}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        gotoOptions: { waitUntil: "networkidle2", timeout: 25000 },
      }),
    });
    clearTimeout(timer);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      let friendly = `Browserless HTTP ${r.status}`;
      if (r.status === 401) friendly = "API key inválida (BROWSERLESS_API_KEY)";
      else if (r.status === 402) friendly = "Cota Browserless excedida (402)";
      else if (r.status === 429) friendly = "Rate limit Browserless (429)";
      else if (r.status === 408 || r.status === 504) friendly = `Timeout Browserless (${r.status})`;
      throw new Error(`${friendly}: ${txt.slice(0, 200)}`);
    }
    return await r.text();
  } catch (e) {
    clearTimeout(timer);
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}

// ---------- Browserless /function (JS remoto) ----------
async function scrapeViaBrowserlessFunction<T = unknown>(
  code: string,
  context: Record<string, unknown>,
  token: string,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const r = await fetch(`${BROWSERLESS_BASE}/function?token=${encodeURIComponent(token)}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, context }),
    });
    clearTimeout(timer);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      let friendly = `Browserless /function HTTP ${r.status}`;
      if (r.status === 401) friendly = "API key inválida (BROWSERLESS_API_KEY)";
      else if (r.status === 402) friendly = "Cota Browserless excedida (402)";
      else if (r.status === 429) friendly = "Rate limit Browserless (429)";
      else if (r.status === 408 || r.status === 504) friendly = `Timeout Browserless (${r.status})`;
      throw new Error(`${friendly}: ${txt.slice(0, 200)}`);
    }
    const json = await r.json();
    return (json?.data ?? json) as T;
  } catch (e) {
    clearTimeout(timer);
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}

async function scrapeAtualCard(url: string, token: string): Promise<ScrapeResult> {
  const startedAt = Date.now();
  const code = `
export default async ({ page, context }) => {
  await page.goto(context.url, { waitUntil: 'networkidle2', timeout: 30000 });
  try {
    await page.waitForSelector('table, [class*="preco"], [class*="tier"], [class*="price"]', { timeout: 15000 });
  } catch (_) {}
  await new Promise(r => setTimeout(r, 2000));
  const rows = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('table tr').forEach(tr => {
      const cells = [...tr.querySelectorAll('td,th')].map(c => (c.innerText || c.textContent || '').trim());
      if (cells.length >= 2) out.push(cells);
    });
    return out;
  });
  const html = await page.content();
  return { data: { rows, html }, type: 'application/json' };
};
`.trim();

  let lastErr: string | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await scrapeViaBrowserlessFunction<{ rows: string[][]; html: string }>(
        code,
        { url },
        token,
      );

      const raw: RawTier[] = [];
      for (const cells of result.rows || []) {
        let qty: number | null = null;
        const prices: number[] = [];
        for (const cell of cells) {
          const q = parseQty(cell);
          const p = parsePriceBR(cell);
          if (/R\$/i.test(cell) && p != null) {
            prices.push(p);
          } else if (qty == null && q != null && !/R\$/i.test(cell)) {
            qty = q;
          } else if (p != null && q == null) {
            prices.push(p);
          }
        }
        if (qty != null && prices.length >= 1) {
          if (prices.length >= 2) {
            const sorted = [...prices].sort((a, b) => a - b);
            raw.push({ quantity: qty, unit_price: sorted[0], total_price: sorted[sorted.length - 1] });
          } else {
            raw.push({ quantity: qty, total_price: prices[0] });
          }
        }
      }

      let prices = finalizeTiers(raw, url);

      if (prices.length < 2 && result.html) {
        console.warn(`[atualcard fallback-regex] ${url}`);
        const fromRegex = extractByRegex(result.html);
        prices = finalizeTiers([...raw, ...fromRegex], url);
      }

      console.log(`[scrape-atualcard] ${url} | tiers=${prices.length} | ${Date.now() - startedAt}ms`);

      return {
        source_url: url,
        scraped_at: new Date().toISOString(),
        strategy: "function-atualcard",
        prices,
        error: prices.length === 0 ? "Nenhum tier encontrado" : null,
        elapsed_ms: Date.now() - startedAt,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`[atualcard retry ${attempt}/2] ${url}: ${lastErr}`);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return {
    source_url: url,
    scraped_at: new Date().toISOString(),
    strategy: "function-atualcard",
    prices: [],
    error: lastErr || "Falha desconhecida",
    elapsed_ms: Date.now() - startedAt,
  };
}

async function scrapeOne(url: string, token: string): Promise<ScrapeResult> {
  // Dispatcher por host: domínios com preços via JS usam /function
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "atualcard.com.br") {
      return await scrapeAtualCard(url, token);
    }
  } catch (_) {
    // URL inválida cai no fluxo padrão (vai falhar lá com erro claro)
  }

  const startedAt = Date.now();
  let lastErr: string | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const html = await fetchRenderedHtml(url, token);
      const $ = cheerio.load(html);

      // Estratégia 1: tabelas
      let raw = extractFromTables($);
      let strategy: "html" | "html-regex" = "html";

      // Estratégia 2: listas / classes
      if (finalizeTiers(raw, url).length < 2) {
        const fromLists = extractFromLists($);
        raw = [...raw, ...fromLists];
      }

      let prices = finalizeTiers(raw, url);

      // Estratégia 3: regex no texto puro
      if (prices.length < 2) {
        console.warn(`[fallback-regex] ${url}`);
        const fromRegex = extractByRegex(html);
        prices = finalizeTiers([...raw, ...fromRegex], url);
        if (prices.length > 0) strategy = "html-regex";
      }

      console.log(`[scrape] ${url} | tiers=${prices.length} | strategy=${strategy} | ${Date.now() - startedAt}ms`);

      return {
        source_url: url,
        scraped_at: new Date().toISOString(),
        strategy,
        prices,
        error: prices.length === 0 ? "Nenhum tier encontrado" : null,
        elapsed_ms: Date.now() - startedAt,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`[retry ${attempt}/3] ${url}: ${lastErr}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return {
    source_url: url,
    scraped_at: new Date().toISOString(),
    strategy: "html",
    prices: [],
    error: lastErr || "Falha desconhecida",
    elapsed_ms: Date.now() - startedAt,
  };
}

async function scrapeMany(urls: string[]): Promise<ScrapeResult[]> {
  const token = Deno.env.get("BROWSERLESS_API_KEY");
  if (!token) throw new Error("BROWSERLESS_API_KEY não configurada");

  const results: ScrapeResult[] = [];
  for (const url of urls) {
    try {
      results.push(await scrapeOne(url, token));
    } catch (e) {
      results.push({
        source_url: url,
        scraped_at: new Date().toISOString(),
        strategy: "html",
        prices: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

// ---------- Handler ----------
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
      const results = await scrapeMany(urls);
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
        scrape_source: "browserless",
        timestamp_check: new Date().toISOString(),
      }).eq("id", site.id);
      return new Response(
        JSON.stringify({ success: false, error: "URL vazia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let results: ScrapeResult[] = [];
    try {
      results = await scrapeMany([site.url_completa]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("sites_monitorados").update({
        scrape_status: "error",
        scrape_error: msg,
        scrape_source: "browserless",
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
        scrape_source: "browserless",
        timestamp_check: new Date().toISOString(),
      }).eq("id", site.id);
      return new Response(
        JSON.stringify({ success: false, error: result?.error || "sem tiers", site_id: site.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Marca tiers existentes como inativos
    await supabase.from("site_precos_tiers").update({ ativo: false }).eq("site_id", site.id);

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
      scrape_source: "browserless",
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
