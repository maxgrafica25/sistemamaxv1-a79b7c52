// Detect price tiers from a product URL using Firecrawl JSON extraction + markdown validation + regex fallback.
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
      description: "TODAS as faixas de preço por quantidade visíveis na página. Não pule nenhuma linha.",
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
  required: ["produto", "tiers"],
};

const PROMPT = `Extraia o nome do produto e TODAS as faixas de preço por quantidade visíveis na página.

REGRAS RÍGIDAS:
- Retorne TODAS as linhas da tabela de preços, sem exceção. Se a página tem 8 quantidades diferentes, retorne 8 tiers. NÃO resuma, NÃO pule, NÃO selecione apenas algumas.
- Exemplo: se vir "1.000 → R$ 180,00", "2.500 → R$ 328,00", "5.000 → R$ 497,00", "10.000 → R$ 850,00" etc., retorne TODOS.
- NÃO invente valores. Se a página NÃO mostra tabela de preços por quantidade, retorne tiers: [].
- Use os números EXATAMENTE como aparecem (sem arredondar, sem normalizar). Ex: "1.000" → 1000.
- Para cada tier, copie em "texto_original" o trecho bruto onde quantidade e preço aparecem juntos.
- Não confunda "quantidade mínima" com tabela de tiers. Só extraia se houver múltiplas linhas de quantidade × preço.`;

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
    variants.add(fixed2.replace(".", ",").replace(",", ""));
  }
  for (const v of variants) {
    if (t.includes(norm(v))) return true;
  }
  return false;
}

// Parse "1.000" / "1000" → 1000
function parseQty(s: string): number {
  const clean = s.replace(/\./g, "").replace(/\s/g, "");
  return Number(clean) || 0;
}

// Parse "180,00" / "180.00" / "1.234,56" → 180
function parsePrice(s: string): number {
  let clean = s.trim();
  // Brazilian: "1.234,56" → "1234.56"
  if (/,\d{1,2}$/.test(clean)) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else {
    clean = clean.replace(/,/g, "");
  }
  return Number(clean) || 0;
}

// Regex fallback: find "quantity ... R$ price" patterns in markdown
function extractTiersFromMarkdown(markdown: string): Array<{ quantidade: number; preco_total: number; preco_unitario: number; texto_original: string }> {
  const results: Array<{ quantidade: number; preco_total: number; preco_unitario: number; texto_original: string }> = [];
  // Pattern: number (with optional thousand separators) ... up to 80 chars ... R$ price
  const rx = /(\d{1,3}(?:\.\d{3})+|\d{3,6})\s*(?:un|unid|unidades|pcs|pe[çc]as)?[\s\S]{0,80}?R\$\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(markdown)) !== null) {
    const qtd = parseQty(m[1]);
    const total = parsePrice(m[2]);
    if (qtd >= 50 && qtd <= 1000000 && total > 0 && total < 1000000) {
      results.push({
        quantidade: qtd,
        preco_total: total,
        preco_unitario: qtd > 0 ? total / qtd : 0,
        texto_original: m[0].slice(0, 120),
      });
    }
  }
  return results;
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
        waitFor: 4000,
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

    console.log(`detect-price-tiers [${url}]: JSON retornou ${rawTiers.length} tier(s), markdown=${markdown.length} chars`);

    // Normaliza tiers do JSON
    const fromJson = rawTiers
      .map((t: any) => {
        const qtd = Number(t.quantidade) || 0;
        const total = Number(t.preco_total) || 0;
        const uni = Number(t.preco_unitario) || (qtd > 0 ? total / qtd : 0);
        return { quantidade: qtd, preco_total: total, preco_unitario: uni, texto_original: String(t.texto_original ?? "") };
      })
      .filter((t: any) => t.quantidade > 0 && t.preco_total > 0);

    // Validação relaxada: aceita se quantidade OU preço aparecer no markdown/texto_original
    const validatedJson: any[] = [];
    const discarded: any[] = [];
    for (const t of fromJson) {
      const qtdOk = numberAppearsIn(t.quantidade, markdown) || numberAppearsIn(t.quantidade, t.texto_original);
      const precoOk = numberAppearsIn(t.preco_total, markdown) || numberAppearsIn(t.preco_total, t.texto_original);
      if (qtdOk || precoOk) {
        validatedJson.push({ quantidade: t.quantidade, preco_total: t.preco_total, preco_unitario: t.preco_unitario });
      } else {
        discarded.push({ ...t, qtdOk, precoOk });
      }
    }

    // Fallback regex sobre markdown
    const fromRegex = extractTiersFromMarkdown(markdown);
    console.log(`detect-price-tiers [${url}]: regex encontrou ${fromRegex.length} candidato(s)`);

    // Mescla deduplicando por quantidade (preferindo JSON quando houver conflito)
    const byQty = new Map<number, { quantidade: number; preco_total: number; preco_unitario: number }>();
    for (const t of fromRegex) byQty.set(t.quantidade, { quantidade: t.quantidade, preco_total: t.preco_total, preco_unitario: t.preco_unitario });
    for (const t of validatedJson) byQty.set(t.quantidade, t);

    const validated = Array.from(byQty.values()).sort((a, b) => a.quantidade - b.quantidade);

    if (discarded.length) {
      console.log(`detect-price-tiers [${url}]: ${discarded.length} tier(s) JSON descartado(s)`, discarded);
    }
    console.log(`detect-price-tiers [${url}]: total final ${validated.length} tier(s) (JSON validado=${validatedJson.length}, regex=${fromRegex.length})`);

    return new Response(
      JSON.stringify({
        success: true,
        produto: extracted?.produto ?? "",
        fornecedor: extracted?.fornecedor ?? "",
        tiers: validated,
        tiers_brutos: fromJson.length,
        tiers_regex: fromRegex.length,
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
