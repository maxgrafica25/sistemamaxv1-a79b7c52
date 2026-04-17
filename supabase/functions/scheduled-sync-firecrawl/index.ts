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

const PROMPT = `Extraia as faixas de preço por quantidade VISÍVEIS na página.
REGRAS:
- NÃO invente valores. Se não houver tabela de preços por quantidade, retorne tiers: [].
- Use números EXATAMENTE como aparecem (ex: 1.000 → 1000).
- Em "texto_original", copie o trecho bruto onde quantidade e preço aparecem juntos.`;

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
      waitFor: 2000,
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

  const validated = normalized.filter((t) => {
    const qOk = numberAppearsIn(t.quantidade, markdown) || numberAppearsIn(t.quantidade, t.texto_original);
    const pOk = numberAppearsIn(t.preco_total, markdown) || numberAppearsIn(t.preco_total, t.texto_original);
    return qOk && pOk;
  }).map((t) => ({ quantidade: t.quantidade, preco_total: t.preco_total, preco_unitario: t.preco_unitario }));

  return { tiers: validated, descartados: normalized.length - validated.length };
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
