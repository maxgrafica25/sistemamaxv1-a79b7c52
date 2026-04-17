// Detect price tiers from a product URL using Firecrawl JSON extraction.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIER_SCHEMA = {
  type: "object",
  properties: {
    produto: { type: "string", description: "Nome do produto na página" },
    fornecedor: { type: "string", description: "Nome da loja/fornecedor" },
    tiers: {
      type: "array",
      description: "Lista de faixas de preço por quantidade. Inclua TODAS as faixas mostradas (ex: 1, 10, 20, 50, 100 unidades).",
      items: {
        type: "object",
        properties: {
          quantidade: { type: "number", description: "Quantidade de unidades" },
          preco_total: { type: "number", description: "Preço TOTAL da faixa em reais (ex: 538.20)" },
          preco_unitario: { type: "number", description: "Preço por unidade em reais (ex: 53.82)" },
        },
        required: ["quantidade", "preco_total"],
      },
    },
  },
  required: ["produto", "tiers"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY não configurada");

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ success: false, error: "URL obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcResp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        onlyMainContent: true,
        formats: [
          {
            type: "json",
            schema: TIER_SCHEMA,
            prompt: "Extraia o nome do produto e TODAS as faixas de preço por quantidade visíveis na página (ex: 1un, 10un, 20un, 50un). Sempre que houver tabela de preços por quantidade, inclua todas as linhas. Se preco_unitario não estiver explícito, calcule preco_total/quantidade.",
          },
        ],
      }),
    });

    const data = await fcResp.json();
    if (!fcResp.ok) {
      console.error("Firecrawl error:", data);
      return new Response(
        JSON.stringify({ success: false, error: data?.error || `Firecrawl ${fcResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extracted = data?.data?.json ?? data?.json ?? {};
    const tiers = Array.isArray(extracted?.tiers) ? extracted.tiers : [];

    // normalize
    const cleanTiers = tiers
      .map((t: any) => {
        const qtd = Number(t.quantidade) || 0;
        const total = Number(t.preco_total) || 0;
        const uni = Number(t.preco_unitario) || (qtd > 0 ? total / qtd : 0);
        return { quantidade: qtd, preco_total: total, preco_unitario: uni };
      })
      .filter((t: any) => t.quantidade > 0 && t.preco_total > 0)
      .sort((a: any, b: any) => a.quantidade - b.quantidade);

    return new Response(
      JSON.stringify({
        success: true,
        produto: extracted?.produto ?? "",
        fornecedor: extracted?.fornecedor ?? "",
        tiers: cleanTiers,
        url,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("detect-price-tiers:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
