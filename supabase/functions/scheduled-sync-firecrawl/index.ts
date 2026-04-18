// Sincroniza preços de sites monitorados via Firecrawl, com validação cruzada contra markdown.
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

const PROMPT = `Extraia TODAS as faixas de preço por quantidade visíveis na página.
REGRAS:
- Retorne TODAS as linhas, sem exceção. Se há 8 quantidades, retorne 8 tiers. NÃO resuma.
- NÃO invente valores. Se não houver tabela de preços por quantidade, retorne tiers: [].
- Use números EXATAMENTE como aparecem (ex: 1.000 → 1000).
- Em "texto_original", copie o trecho bruto onde quantidade e preço aparecem juntos.`;

function parseQty(s: string): number {
  const clean = s.replace(/\./g, "").replace(/\s/g, "");
  return Number(clean) || 0;
}
function parsePrice(s: string): number {
  let clean = s.trim();
  if (/,\d{1,2}$/.test(clean)) clean = clean.replace(/\./g, "").replace(",", ".");
  else clean = clean.replace(/,/g, "");
  return Number(clean) || 0;
}
function extractTiersFromMarkdown(markdown: string) {
  const results: Array<{ quantidade: number; preco_total: number; preco_unitario: number }> = [];
  const rx = /(\d{1,3}(?:\.\d{3})+|\d{3,6})\s*(?:un|unid|unidades|pcs|pe[çc]as)?[\s\S]{0,80}?R\$\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(markdown)) !== null) {
    const qtd = parseQty(m[1]);
    const total = parsePrice(m[2]);
    if (qtd >= 50 && qtd <= 1000000 && total > 0 && total < 1000000) {
      results.push({ quantidade: qtd, preco_total: total, preco_unitario: qtd > 0 ? total / qtd : 0 });
    }
  }
  return results;
}

function norm(s: string): string {
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.\s]/g, "");
}

function numberAppearsIn(num: number, text: string): boolean {
  const t = norm(text);
  const intPart = Math.trunc(num);
  const variants = new Set<string>([
    String(intPart),
    intPart.toLocaleString("pt-BR").replace(/\./g, ""),
  ]);
  if (num !== intPart) {
    const fixed2 = num.toFixed(2);
    variants.add(fixed2.replace(".", ""));
  }
  for (const v of variants) {
    if (t.includes(norm(v))) return true;
  }
  return false;
}

async function scrapeTiers(url: string, apiKey: string) {
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      onlyMainContent: false,
      waitFor: 4000,
      formats: ["markdown", { type: "json", schema: TIER_SCHEMA, prompt: PROMPT }],
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || `Firecrawl ${r.status}`);
  const markdown: string = d?.data?.markdown ?? d?.markdown ?? "";
  const raw = (d?.data?.json?.tiers ?? d?.json?.tiers ?? []) as any[];

  const normalized = raw
    .map((t: any) => {
      const qtd = Number(t.quantidade) || 0;
      const total = Number(t.preco_total) || 0;
      const uni = Number(t.preco_unitario) || (qtd > 0 ? total / qtd : 0);
      return { quantidade: qtd, preco_total: total, preco_unitario: uni, texto_original: String(t.texto_original ?? "") };
    })
    .filter((t) => t.quantidade > 0 && t.preco_total > 0);

  // Validação relaxada: aceita se qtd OU preço aparecer
  const validatedJson = normalized.filter((t) => {
    const qOk = numberAppearsIn(t.quantidade, markdown) || numberAppearsIn(t.quantidade, t.texto_original);
    const pOk = numberAppearsIn(t.preco_total, markdown) || numberAppearsIn(t.preco_total, t.texto_original);
    return qOk || pOk;
  }).map((t) => ({ quantidade: t.quantidade, preco_total: t.preco_total, preco_unitario: t.preco_unitario }));

  // Fallback regex
  const fromRegex = extractTiersFromMarkdown(markdown);

  // Mescla por quantidade (JSON tem prioridade)
  const byQty = new Map<number, { quantidade: number; preco_total: number; preco_unitario: number }>();
  for (const t of fromRegex) byQty.set(t.quantidade, t);
  for (const t of validatedJson) byQty.set(t.quantidade, t);

  const validated = Array.from(byQty.values()).sort((a, b) => a.quantidade - b.quantidade);
  console.log(`scheduled-sync-firecrawl [${url}]: JSON=${normalized.length} validado=${validatedJson.length} regex=${fromRegex.length} final=${validated.length}`);

  return { tiers: validated, descartados: normalized.length - validatedJson.length };
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
      if (!site.url_completa) {
        results.push({ site_id: site.id, skipped: true, reason: "no_url" });
        continue;
      }

      try {
        const { tiers, descartados } = await scrapeTiers(site.url_completa, FIRECRAWL);
        if (!tiers.length) {
          results.push({ site_id: site.id, error: descartados ? `todos os ${descartados} tiers reprovaram na validação` : "sem tiers" });
          continue;
        }

        const wh = await fetch(`${SUPABASE_URL}/functions/v1/sync-prices-webhook`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ site_id: site.id, origem: "firecrawl", tiers }),
        });
        const whData = await wh.json();
        results.push({ site_id: site.id, descartados, ...whData });
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
