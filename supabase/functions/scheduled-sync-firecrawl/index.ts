// Sincroniza preços via Firecrawl com fallback visual (Lovable AI) quando confiança é baixa.
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
          texto_original: { type: "string" },
        },
        required: ["quantidade", "preco_total", "texto_original"],
      },
    },
  },
  required: ["tiers"],
};

const PROMPT = `Extraia TODAS as faixas de preço por quantidade visíveis. Retorne TODAS, sem exceção. Se não houver tabela, retorne tiers: []. Use números exatamente como aparecem.`;

type Tier = { quantidade: number; preco_total: number; preco_unitario: number };

function parseQty(s: string): number { return Number(s.replace(/\./g, "").replace(/\s/g, "")) || 0; }
function parsePrice(s: string): number {
  let c = s.trim();
  if (/,\d{1,2}$/.test(c)) c = c.replace(/\./g, "").replace(",", ".");
  else c = c.replace(/,/g, "");
  return Number(c) || 0;
}
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
function extractTiersFromMarkdown(md: string) {
  const out: Tier[] = [];
  const rx = /(\d{1,3}(?:\.\d{3})+|\d{3,6})\s*(?:un|unid|unidades|pcs|pe[çc]as)[\s\S]{0,40}?R\$\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(md)) !== null) {
    const q = parseQty(m[1]); const t = parsePrice(m[2]);
    if (q >= 50 && q <= 1000000 && q % 50 === 0 && t > 0 && t < 1000000) {
      out.push({ quantidade: q, preco_total: t, preco_unitario: q > 0 ? t / q : 0 });
    }
  }
  return out;
}

async function extractTiersFromScreenshot(screenshotUrl: string): Promise<Tier[]> {
  const KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!KEY) return [];
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: "Você extrai tabelas de preço por quantidade de imagens. Retorne TODAS as faixas visíveis. Nunca invente." },
        { role: "user", content: [
          { type: "text", text: "Extraia TODAS as faixas (quantidade × preço total) desta imagem usando a ferramenta extract_tiers." },
          { type: "image_url", image_url: { url: screenshotUrl } },
        ] },
      ],
      tools: [{
        type: "function",
        function: {
          name: "extract_tiers",
          description: "Faixas de preço extraídas da imagem.",
          parameters: {
            type: "object",
            properties: {
              tiers: { type: "array", items: { type: "object", properties: {
                quantidade: { type: "number" }, preco_total: { type: "number" }, preco_unitario: { type: "number" },
              }, required: ["quantidade", "preco_total"] } },
            },
            required: ["tiers"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_tiers" } },
    }),
  });
  if (!r.ok) { console.warn(`visual fallback ${r.status}`); return []; }
  const d = await r.json();
  const call = d?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return [];
  try {
    const args = JSON.parse(call.function.arguments);
    const raw: any[] = Array.isArray(args.tiers) ? args.tiers : [];
    return raw.map((t) => {
      const q = Number(t.quantidade) || 0;
      const tot = Number(t.preco_total) || 0;
      const u = Number(t.preco_unitario) || (q > 0 ? tot / q : 0);
      return { quantidade: q, preco_total: tot, preco_unitario: u };
    }).filter((t) => t.quantidade > 0 && t.preco_total > 0);
  } catch { return []; }
}

function mergeConservative(base: Tier[], extras: Tier[]): Tier[] {
  const m = new Map<number, Tier>();
  for (const t of base) m.set(t.quantidade, t);
  for (const t of extras) if (!m.has(t.quantidade)) m.set(t.quantidade, t);
  const sorted = Array.from(m.values()).sort((a, b) => a.quantidade - b.quantidade);
  const out: Tier[] = [];
  for (const t of sorted) {
    const last = out[out.length - 1];
    if (!last || t.preco_total >= last.preco_total * 0.8) out.push(t);
  }
  return out;
}

async function scrapeTiers(url: string, apiKey: string) {
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url, onlyMainContent: false, waitFor: 8000,
      actions: [
        { type: "wait", milliseconds: 3000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
      ],
      formats: ["markdown", "screenshot", { type: "json", schema: TIER_SCHEMA, prompt: PROMPT }],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || `Firecrawl ${r.status}`);
  const markdown: string = d?.data?.markdown ?? d?.markdown ?? "";
  const screenshot: string = d?.data?.screenshot ?? d?.screenshot ?? "";
  const raw = (d?.data?.json?.tiers ?? d?.json?.tiers ?? []) as any[];

  const normalized = raw.map((t: any) => {
    const q = Number(t.quantidade) || 0; const tot = Number(t.preco_total) || 0;
    const u = Number(t.preco_unitario) || (q > 0 ? tot / q : 0);
    return { quantidade: q, preco_total: tot, preco_unitario: u, texto_original: String(t.texto_original ?? "") };
  }).filter((t) => t.quantidade > 0 && t.preco_total > 0);

  const validatedJson: Tier[] = normalized.filter((t) => {
    const qOk = numberAppearsIn(t.quantidade, markdown) || numberAppearsIn(t.quantidade, t.texto_original);
    const pOk = numberAppearsIn(t.preco_total, markdown) || numberAppearsIn(t.preco_total, t.texto_original);
    return qOk || pOk;
  }).map((t) => ({ quantidade: t.quantidade, preco_total: t.preco_total, preco_unitario: t.preco_unitario }));

  const fromRegex = extractTiersFromMarkdown(markdown);

  const m = new Map<number, Tier>();
  for (const t of fromRegex) m.set(t.quantidade, t);
  for (const t of validatedJson) m.set(t.quantidade, t);
  const textTiers = Array.from(m.values()).sort((a, b) => a.quantidade - b.quantidade);

  const lowConfidence = markdown.length < 500 || textTiers.length < 3 || (fromRegex.length === 0 && validatedJson.length < 3);

  console.log(`scheduled [${url}] md=${markdown.length} validJson=${validatedJson.length} regex=${fromRegex.length} text=${textTiers.length} low=${lowConfidence}`);

  let finalTiers = textTiers;
  if (lowConfidence && screenshot) {
    const visual = await extractTiersFromScreenshot(screenshot);
    console.log(`scheduled [${url}] visual=${visual.length}`);
    if (visual.length > textTiers.length) finalTiers = mergeConservative(visual, textTiers);
    else if (visual.length > 0) finalTiers = mergeConservative(textTiers, visual);
  }

  return { tiers: finalTiers, descartados: normalized.length - validatedJson.length };
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
        const { tiers, descartados } = await scrapeTiers(site.url_completa, FIRECRAWL);
        if (!tiers.length) {
          results.push({ site_id: site.id, error: descartados ? `todos os ${descartados} tiers reprovaram` : "sem tiers" });
          continue;
        }
        const wh = await fetch(`${SUPABASE_URL}/functions/v1/sync-prices-webhook`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
          body: JSON.stringify({ site_id: site.id, origem: "firecrawl", tiers }),
        });
        const whData = await wh.json();
        results.push({ site_id: site.id, descartados, ...whData });
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
