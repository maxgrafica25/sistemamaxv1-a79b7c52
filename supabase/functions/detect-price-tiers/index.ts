// Detect price tiers from a product URL using Firecrawl JSON extraction + markdown validation.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIER_SCHEMA = {
  type: "object",
  properties: {
    produto: { type: "string", description: "Nome exato do produto na página" },
    fornecedor: { type: "string", description: "Nome da loja/fornecedor" },
    tiers: {
      type: "array",
      description: "Faixas de preço por quantidade extraídas DA TABELA REAL da página. NÃO invente valores.",
      items: {
        type: "object",
        properties: {
          quantidade: { type: "number", description: "Quantidade EXATA como aparece na página (ex: 1000, 2500)" },
          preco_total: { type: "number", description: "Preço total EXATO como aparece (ex: 93.00)" },
          preco_unitario: { type: "number", description: "Preço por unidade, se mostrado" },
          texto_original: { type: "string", description: "Trecho bruto do texto onde quantidade e preço aparecem juntos (para validação)" },
        },
        required: ["quantidade", "preco_total", "texto_original"],
      },
    },
  },
  required: ["produto", "tiers"],
};

const PROMPT = `Extraia o nome do produto e as faixas de preço por quantidade que estiverem VISÍVEIS na página.

REGRAS RÍGIDAS:
- NÃO invente valores. Se a página NÃO mostra tabela de preços por quantidade, retorne tiers: [].
- Use os números EXATAMENTE como aparecem (sem arredondar, sem normalizar). Ex: se diz "1.000", retorne 1000.
- Para cada tier, copie em "texto_original" o trecho bruto onde quantidade e preço aparecem juntos.
- Não confunda "quantidade mínima" com tabela de tiers. Só extraia se houver múltiplas linhas de quantidade × preço.`;

// Normaliza string para comparação: tira acento, espaços extras, separadores
function norm(s: string): string {
  return String(s)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.\s]/g, "");
}

// Verifica se um número aparece no texto bruto, considerando variações brasileiras
function numberAppearsIn(num: number, text: string): boolean {
  const t = norm(text);
  const intPart = Math.trunc(num);
  // formas: "1000", "1.000", "1,000"
  const variants = new Set<string>([
    String(intPart),
    intPart.toLocaleString("pt-BR").replace(/\./g, ""),
  ]);
  // para preços com decimais: "93,00", "93.00", "93"
  if (num !== intPart) {
    const fixed2 = num.toFixed(2);
    variants.add(fixed2.replace(".", ""));
    variants.add(fixed2.replace(".", ",").replace(",", ""));
  }
  for (const v of variants) {
    if (t.includes(norm(v))) return true;
  }
  return false;
}

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
        onlyMainContent: false,
        waitFor: 2000,
        formats: [
          "markdown",
          { type: "json", schema: TIER_SCHEMA, prompt: PROMPT },
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
    const markdown: string = data?.data?.markdown ?? data?.markdown ?? "";
    const rawTiers = Array.isArray(extracted?.tiers) ? extracted.tiers : [];

    // Normaliza e valida cada tier contra o markdown bruto
    const normalized = rawTiers
      .map((t: any) => {
        const qtd = Number(t.quantidade) || 0;
        const total = Number(t.preco_total) || 0;
        const uni = Number(t.preco_unitario) || (qtd > 0 ? total / qtd : 0);
        const texto = String(t.texto_original ?? "");
        return { quantidade: qtd, preco_total: total, preco_unitario: uni, texto_original: texto };
      })
      .filter((t: any) => t.quantidade > 0 && t.preco_total > 0);

    const validated: any[] = [];
    const discarded: any[] = [];
    for (const t of normalized) {
      const qtdOk = numberAppearsIn(t.quantidade, markdown) || numberAppearsIn(t.quantidade, t.texto_original);
      const precoOk = numberAppearsIn(t.preco_total, markdown) || numberAppearsIn(t.preco_total, t.texto_original);
      if (qtdOk && precoOk) {
        validated.push({ quantidade: t.quantidade, preco_total: t.preco_total, preco_unitario: t.preco_unitario });
      } else {
        discarded.push({ ...t, qtdOk, precoOk });
      }
    }

    validated.sort((a, b) => a.quantidade - b.quantidade);

    if (discarded.length) {
      console.log(`detect-price-tiers: ${discarded.length} tier(s) descartado(s) por validação`, discarded);
    }

    return new Response(
      JSON.stringify({
        success: true,
        produto: extracted?.produto ?? "",
        fornecedor: extracted?.fornecedor ?? "",
        tiers: validated,
        tiers_brutos: normalized.length,
        descartados: discarded.length,
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
