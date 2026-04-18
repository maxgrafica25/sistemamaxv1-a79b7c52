// Sincroniza preços via Firecrawl. Estratégia HTML-first com parsers por domínio; sem fallback visual no cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tier = { quantidade: number; preco_total: number; preco_unitario: number };

function norm(s: string): string {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.\s]/g, "");
}
function numberAppearsIn(num: number, text: string): boolean {
  const t = norm(text);
  const intPart = Math.trunc(num);
  const variants = new Set<string>([String(intPart), intPart.toLocaleString("pt-BR").replace(/\./g, "")]);
  if (num !== intPart) variants.add(num.toFixed(2).replace(".", ""));
  for (const v of variants) if (t.includes(norm(v))) return true;
  return false;
}
function parseQty(s: string): number { return Number(String(s).replace(/\./g, "").replace(/\s/g, "")) || 0; }
function parsePrice(s: string): number {
  let c = String(s).trim();
  if (/,\d{1,2}$/.test(c)) c = c.replace(/\./g, "").replace(",", ".");
  else c = c.replace(/,/g, "");
  return Number(c) || 0;
}
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function dedupSort(tiers: Tier[]): Tier[] {
  const m = new Map<number, Tier>();
  for (const t of tiers) {
    if (t.quantidade <= 0 || t.preco_total <= 0) continue;
    if (!m.has(t.quantidade) || m.get(t.quantidade)!.preco_total > t.preco_total) {
      m.set(t.quantidade, { ...t, preco_unitario: t.preco_unitario || t.preco_total / t.quantidade });
    }
  }
  return Array.from(m.values()).sort((a, b) => a.quantidade - b.quantidade);
}

function extractTiersFromMarkdown(md: string): Tier[] {
  const out: Tier[] = [];
  const rx = /(\d{1,3}(?:\.\d{3})+|\d{2,6})\s*(?:un|unid|unidades|pcs|pe[çc]as)[\s\S]{0,60}?R\$\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(md)) !== null) {
    const q = parseQty(m[1]); const t = parsePrice(m[2]);
    if (q >= 25 && q <= 1000000 && t > 0 && t < 1000000) {
      out.push({ quantidade: q, preco_total: t, preco_unitario: t / q });
    }
  }
  return out;
}
function extractTiersFromHtmlGeneric(html: string): Tier[] {
  const out: Tier[] = [];
  const rx = /(\d{1,3}(?:\.\d{3})+|\d{2,6})\s*(?:un|unid|unidades|pcs|pe[çc]as)[\s\S]{0,200}?R\$\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    const q = parseQty(m[1]); const t = parsePrice(m[2]);
    if (q >= 25 && q <= 1000000 && t > 0 && t < 1000000) {
      out.push({ quantidade: q, preco_total: t, preco_unitario: t / q });
    }
  }
  return out;
}
function extractTiersFromScripts(html: string): Tier[] {
  const out: Tier[] = [];
  const scriptRx = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let s: RegExpExecArray | null;
  while ((s = scriptRx.exec(html)) !== null) {
    const body = s[1];
    if (body.length < 30 || body.length > 500000) continue;
    if (!/(quant|qtd|qty|preco|price|valor)/i.test(body)) continue;
    const objRx = /\{[^{}]{0,400}?(?:"?(?:quantidade|qtd|qty|min_qty|minimum)"?\s*:\s*"?(\d{2,6})"?)[^{}]{0,400}?(?:"?(?:preco_total|valor_total|preco|valor|price|total)"?\s*:\s*"?([\d.,R$\s]+)"?)[^{}]{0,200}?\}/gi;
    let m: RegExpExecArray | null;
    while ((m = objRx.exec(body)) !== null) {
      const q = parseQty(m[1]); const t = parsePrice(m[2].replace(/R\$/g, "").trim());
      if (q >= 25 && q <= 1000000 && t > 0 && t < 1000000) out.push({ quantidade: q, preco_total: t, preco_unitario: t / q });
    }
  }
  return out;
}

function parseAtualCard(html: string): Tier[] {
  const tiers: Tier[] = [];
  const rowRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let r: RegExpExecArray | null;
  while ((r = rowRx.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRx = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c: RegExpExecArray | null;
    while ((c = cellRx.exec(r[1])) !== null) cells.push(stripTags(c[1]));
    if (cells.length < 2) continue;
    let qtd = 0, total = 0;
    for (const cell of cells) {
      if (!qtd) { const mq = cell.match(/^\s*(\d{1,3}(?:\.\d{3})+|\d{2,6})\s*(?:un|unid|unidades)?\s*$/i); if (mq) qtd = parseQty(mq[1]); }
      if (!total) { const mp = cell.match(/R\$\s*([\d.,]+)/i); if (mp) total = parsePrice(mp[1]); }
    }
    if (qtd >= 25 && total > 0) tiers.push({ quantidade: qtd, preco_total: total, preco_unitario: total / qtd });
  }
  return tiers.length ? tiers : extractTiersFromHtmlGeneric(html);
}
function parseImprimaRapido(html: string): Tier[] {
  const tiers: Tier[] = [];
  const optRx = /<option[^>]*>([\s\S]*?)<\/option>/gi;
  let o: RegExpExecArray | null;
  while ((o = optRx.exec(html)) !== null) {
    const text = stripTags(o[1]);
    const m = text.match(/(\d{1,3}(?:\.\d{3})+|\d{2,6})\s*(?:un|unid|unidades|pcs|pe[çc]as)?[\s\S]{0,40}?R\$\s*([\d.,]+)/i);
    if (m) {
      const q = parseQty(m[1]); const t = parsePrice(m[2]);
      if (q >= 25 && t > 0) tiers.push({ quantidade: q, preco_total: t, preco_unitario: t / q });
    }
  }
  return dedupSort([...tiers, ...extractTiersFromScripts(html), ...extractTiersFromHtmlGeneric(html)]);
}
function pickDomainParser(url: string): ((html: string) => Tier[]) | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("atualcard.com.br")) return parseAtualCard;
    if (host.includes("imprimarapido.com.br")) return parseImprimaRapido;
  } catch { /* ignore */ }
  return null;
}

async function scrapeLight(url: string, apiKey: string): Promise<{ html: string; markdown: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, onlyMainContent: false, waitFor: 3000, formats: ["html", "markdown"] }),
    });
    clearTimeout(timer);
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || `Firecrawl ${r.status}`);
    return {
      html: String(d?.data?.html ?? d?.html ?? ""),
      markdown: String(d?.data?.markdown ?? d?.markdown ?? ""),
    };
  } catch (e) {
    clearTimeout(timer);
    throw new Error(`Firecrawl light: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function scrapeTiers(url: string, apiKey: string) {
  const { html, markdown } = await scrapeLight(url, apiKey);
  const domainParser = pickDomainParser(url);
  let domainTiers: Tier[] = [];
  if (domainParser) { try { domainTiers = dedupSort(domainParser(html)); } catch { /* ignore */ } }
  const htmlGeneric = extractTiersFromHtmlGeneric(html);
  const scriptTiers = extractTiersFromScripts(html);
  const mdTiers = extractTiersFromMarkdown(markdown);
  const haystack = markdown + " " + stripTags(html.slice(0, 200000));
  const validate = (arr: Tier[]) => arr.filter((t) =>
    numberAppearsIn(t.quantidade, haystack) && numberAppearsIn(t.preco_total, haystack)
  );
  const tiers = dedupSort([...domainTiers, ...validate([...htmlGeneric, ...scriptTiers, ...mdTiers])]);
  console.log(`scheduled [${url}] html=${html.length} md=${markdown.length} domain=${domainTiers.length} final=${tiers.length}`);
  return { tiers, descartados: 0 };
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

    if (onlySiteId) query = query.eq("id", onlySiteId);
    else query = query.eq("ativo", true).eq("metodo_coleta", "firecrawl");

    const { data: sites, error } = await query;
    if (error) throw error;

    const results: any[] = [];
    for (const site of sites ?? []) {
      if (!site.url_completa) {
        results.push({ site_id: site.id, skipped: true, reason: "no_url" });
        continue;
      }
      try {
        const { tiers } = await scrapeTiers(site.url_completa, FIRECRAWL);
        if (!tiers.length) {
          results.push({ site_id: site.id, error: "sem tiers" });
          continue;
        }
        const wh = await fetch(`${SUPABASE_URL}/functions/v1/sync-prices-webhook`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
          body: JSON.stringify({ site_id: site.id, origem: "firecrawl", tiers }),
        });
        const whData = await wh.json();
        results.push({ site_id: site.id, ...whData });
      } catch (e) {
        results.push({ site_id: site.id, error: e instanceof Error ? e.message : String(e) });
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
