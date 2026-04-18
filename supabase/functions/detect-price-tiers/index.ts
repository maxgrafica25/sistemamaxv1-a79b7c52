// Detect price tiers from a product URL using Firecrawl + visual fallback (Lovable AI multimodal).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TIER_SCHEMA = {
  type: "object",
  properties: {
    produto: { type: "string" },
    fornecedor: { type: "string" },
    tiers: {
      type: "array",
      description: "TODAS as faixas de preço por quantidade visíveis. Não pule nenhuma linha.",
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
- Retorne TODAS as linhas da tabela, sem exceção. Se há 8 quantidades, retorne 8 tiers.
- NÃO invente. Se não houver tabela de tiers, retorne tiers: [].
- Use números EXATAMENTE como aparecem (ex: "1.000" → 1000).
- Em "texto_original", copie o trecho bruto onde quantidade e preço aparecem juntos.`;

function norm(s: string): string {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.\s]/g, "");
}
function numberAppearsIn(num: number, text: string): boolean {
  const t = norm(text);
  const intPart = Math.trunc(num);
  const variants = new Set<string>([String(intPart), intPart.toLocaleString("pt-BR").replace(/\./g, "")]);
  if (num !== intPart) {
    const fixed2 = num.toFixed(2);
    variants.add(fixed2.replace(".", ""));
    variants.add(fixed2.replace(".", ",").replace(",", ""));
  }
  for (const v of variants) if (t.includes(norm(v))) return true;
  return false;
}
function parseQty(s: string): number {
  return Number(s.replace(/\./g, "").replace(/\s/g, "")) || 0;
}
function parsePrice(s: string): number {
  let clean = s.trim();
  if (/,\d{1,2}$/.test(clean)) clean = clean.replace(/\./g, "").replace(",", ".");
  else clean = clean.replace(/,/g, "");
  return Number(clean) || 0;
}
function extractTiersFromMarkdown(markdown: string) {
  const results: Array<{ quantidade: number; preco_total: number; preco_unitario: number; texto_original: string }> = [];
  const rx = /(\d{1,3}(?:\.\d{3})+|\d{3,6})\s*(?:un|unid|unidades|pcs|pe[çc]as)[\s\S]{0,40}?R\$\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(markdown)) !== null) {
    const qtd = parseQty(m[1]);
    const total = parsePrice(m[2]);
    const isRound = qtd >= 50 && qtd <= 1000000 && (qtd % 50 === 0);
    if (isRound && total > 0 && total < 1000000) {
      results.push({ quantidade: qtd, preco_total: total, preco_unitario: qtd > 0 ? total / qtd : 0, texto_original: m[0].slice(0, 120) });
    }
  }
  return results;
}

type Tier = { quantidade: number; preco_total: number; preco_unitario: number };

// Visual fallback: use Lovable AI multimodal on screenshot
async function extractTiersFromScreenshot(screenshotUrl: string): Promise<Tier[]> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("LOVABLE_API_KEY ausente — pulando fallback visual");
    return [];
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 50000);
  let resp: Response;
  try {
    resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    signal: ctrl.signal,
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        {
          role: "system",
          content: "Você extrai tabelas de preços por quantidade de imagens de páginas de produto. Retorne TODAS as faixas visíveis. Não invente valores.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia TODAS as faixas (quantidade × preço total) visíveis nesta imagem. Use a ferramenta extract_tiers." },
            { type: "image_url", image_url: { url: screenshotUrl } },
          ],
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "extract_tiers",
          description: "Retorna todas as faixas de preço por quantidade visíveis na imagem.",
          parameters: {
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
                  required: ["quantidade", "preco_total"],
                },
              },
            },
            required: ["tiers"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_tiers" } },
    });
  } catch (e) {
    clearTimeout(timer);
    console.warn(`fallback visual abortado: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
  clearTimeout(timer);
  if (!resp.ok) {
    const t = await resp.text();
    console.warn(`fallback visual falhou ${resp.status}: ${t.slice(0, 200)}`);
    return [];
  }
  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return [];
  try {
    const args = JSON.parse(call.function.arguments);
    const raw: any[] = Array.isArray(args.tiers) ? args.tiers : [];
    return raw
      .map((t) => {
        const qtd = Number(t.quantidade) || 0;
        const total = Number(t.preco_total) || 0;
        const uni = Number(t.preco_unitario) || (qtd > 0 ? total / qtd : 0);
        return { quantidade: qtd, preco_total: total, preco_unitario: uni };
      })
      .filter((t) => t.quantidade > 0 && t.preco_total > 0);
  } catch {
    return [];
  }
}

// Conservative merge: extras só se quantidade ainda não existe e a sequência continua coerente
function mergeConservative(base: Tier[], extras: Tier[]): Tier[] {
  const byQty = new Map<number, Tier>();
  for (const t of base) byQty.set(t.quantidade, t);
  for (const t of extras) {
    if (!byQty.has(t.quantidade)) byQty.set(t.quantidade, t);
  }
  const sorted = Array.from(byQty.values()).sort((a, b) => a.quantidade - b.quantidade);
  // Garantir monotonia em preço_total (filtra outliers grosseiros)
  const cleaned: Tier[] = [];
  for (const t of sorted) {
    const last = cleaned[cleaned.length - 1];
    if (!last || t.preco_total >= last.preco_total * 0.8) cleaned.push(t);
  }
  return cleaned;
}

export async function scrapeAndExtractTiers(url: string, firecrawlKey: string) {
  // Etapa 1: scrape com markdown + json + screenshot
  const fcResp = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      onlyMainContent: false,
      waitFor: 8000,
      actions: [
        { type: "wait", milliseconds: 3000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
        { type: "scroll", direction: "down" },
        { type: "wait", milliseconds: 2000 },
      ],
      formats: [
        "markdown",
        "screenshot",
        { type: "json", schema: TIER_SCHEMA, prompt: PROMPT },
      ],
    }),
  });
  const data = await fcResp.json();
  if (!fcResp.ok) throw new Error(data?.error || `Firecrawl ${fcResp.status}`);

  const extracted = data?.data?.json ?? data?.json ?? {};
  const markdown: string = data?.data?.markdown ?? data?.markdown ?? "";
  const screenshot: string = data?.data?.screenshot ?? data?.screenshot ?? "";
  const rawTiers: any[] = Array.isArray(extracted?.tiers) ? extracted.tiers : [];

  const fromJson = rawTiers
    .map((t: any) => {
      const qtd = Number(t.quantidade) || 0;
      const total = Number(t.preco_total) || 0;
      const uni = Number(t.preco_unitario) || (qtd > 0 ? total / qtd : 0);
      return { quantidade: qtd, preco_total: total, preco_unitario: uni, texto_original: String(t.texto_original ?? "") };
    })
    .filter((t: any) => t.quantidade > 0 && t.preco_total > 0);

  const validatedJson: Tier[] = [];
  for (const t of fromJson) {
    const qOk = numberAppearsIn(t.quantidade, markdown) || numberAppearsIn(t.quantidade, t.texto_original);
    const pOk = numberAppearsIn(t.preco_total, markdown) || numberAppearsIn(t.preco_total, t.texto_original);
    if (qOk || pOk) validatedJson.push({ quantidade: t.quantidade, preco_total: t.preco_total, preco_unitario: t.preco_unitario });
  }

  const fromRegex = extractTiersFromMarkdown(markdown).map((t) => ({ quantidade: t.quantidade, preco_total: t.preco_total, preco_unitario: t.preco_unitario }));

  // Merge texto
  const byQty = new Map<number, Tier>();
  for (const t of fromRegex) byQty.set(t.quantidade, t);
  for (const t of validatedJson) byQty.set(t.quantidade, t);
  const textTiers = Array.from(byQty.values()).sort((a, b) => a.quantidade - b.quantidade);

  // Confiança
  const lowConfidence =
    markdown.length < 500 ||
    textTiers.length < 3 ||
    (fromRegex.length === 0 && validatedJson.length < 3);

  console.log(`[${url}] md=${markdown.length} json=${fromJson.length} validJson=${validatedJson.length} regex=${fromRegex.length} text=${textTiers.length} low=${lowConfidence} hasShot=${!!screenshot}`);

  let finalTiers = textTiers;
  let usedVisual = false;

  if (lowConfidence && screenshot) {
    const visual = await extractTiersFromScreenshot(screenshot);
    console.log(`[${url}] visual fallback retornou ${visual.length} tier(s)`);
    if (visual.length > textTiers.length) {
      // Usa visual como base, completa com texto se coerente
      finalTiers = mergeConservative(visual, textTiers);
      usedVisual = true;
    } else if (visual.length > 0) {
      finalTiers = mergeConservative(textTiers, visual);
    }
  }

  return {
    produto: extracted?.produto ?? "",
    fornecedor: extracted?.fornecedor ?? "",
    tiers: finalTiers,
    diagnostics: {
      markdown_chars: markdown.length,
      json_count: fromJson.length,
      json_validated: validatedJson.length,
      regex_count: fromRegex.length,
      text_count: textTiers.length,
      low_confidence: lowConfidence,
      used_visual: usedVisual,
    },
  };
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
    const result = await scrapeAndExtractTiers(url, apiKey);
    return new Response(JSON.stringify({ success: true, url, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("detect-price-tiers:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
