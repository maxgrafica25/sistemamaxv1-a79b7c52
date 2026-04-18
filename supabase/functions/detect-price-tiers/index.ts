// Detect price tiers from a product URL.
// Strategy: HTML-first (lightweight) + domain-specific parsers, visual fallback only as last resort.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Tier = { quantidade: number; preco_total: number; preco_unitario: number };

// ---------- helpers ----------
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
  }
  for (const v of variants) if (t.includes(norm(v))) return true;
  return false;
}
function parseQty(s: string): number {
  return Number(String(s).replace(/\./g, "").replace(/\s/g, "")) || 0;
}
function parsePrice(s: string): number {
  let clean = String(s).trim();
  if (/,\d{1,2}$/.test(clean)) clean = clean.replace(/\./g, "").replace(",", ".");
  else clean = clean.replace(/,/g, "");
  return Number(clean) || 0;
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

// ---------- generic regex extractor (markdown) ----------
function extractTiersFromMarkdown(markdown: string): Tier[] {
  const out: Tier[] = [];
  const rx = /(\d{1,3}(?:\.\d{3})+|\d{2,6})\s*(?:un|unid|unidades|pcs|pe[çc]as|fl[hyo]as?|impress[oõ]es)[\s\S]{0,60}?R\$\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(markdown)) !== null) {
    const qtd = parseQty(m[1]);
    const total = parsePrice(m[2]);
    if (qtd >= 25 && qtd <= 1000000 && total > 0 && total < 1000000) {
      out.push({ quantidade: qtd, preco_total: total, preco_unitario: total / qtd });
    }
  }
  return out;
}

// ---------- HTML extractors ----------
// Strip tags to get plain text from a small HTML chunk.
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// 1) Generic: find pairs of (qty, price) in HTML — works on tables, lists, divs.
function extractTiersFromHtmlGeneric(html: string): Tier[] {
  const out: Tier[] = [];
  // Look for "1.000 unidades ... R$ 99,90" within ~200 chars of HTML
  const rx = /(\d{1,3}(?:\.\d{3})+|\d{2,6})\s*(?:un|unid|unidades|pcs|pe[çc]as|fl[hyo]as?|impress[oõ]es)[\s\S]{0,200}?R\$\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    const text = stripTags(m[0]);
    const qtd = parseQty(m[1]);
    const total = parsePrice(m[2]);
    if (qtd >= 25 && qtd <= 1000000 && total > 0 && total < 1000000 && text.length < 300) {
      out.push({ quantidade: qtd, preco_total: total, preco_unitario: total / qtd });
    }
  }
  return out;
}

// 2) Generic: parse JSON blobs inside <script> tags, looking for arrays of {qty, price}.
function extractTiersFromScripts(html: string): Tier[] {
  const out: Tier[] = [];
  const scriptRx = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let s: RegExpExecArray | null;
  while ((s = scriptRx.exec(html)) !== null) {
    const body = s[1];
    if (body.length < 30 || body.length > 500000) continue;
    if (!/(quant|qtd|qty|preco|price|valor)/i.test(body)) continue;

    // Look for object snippets like {"quantidade":100,"valor":89.90} or {"qty":100,"price":"R$ 89,90"}
    const objRx = /\{[^{}]{0,400}?(?:"?(?:quantidade|qtd|qty|min_qty|minimum)"?\s*:\s*"?(\d{2,6})"?)[^{}]{0,400}?(?:"?(?:preco_total|valor_total|preco|valor|price|total)"?\s*:\s*"?([\d.,R$\s]+)"?)[^{}]{0,200}?\}/gi;
    let m: RegExpExecArray | null;
    while ((m = objRx.exec(body)) !== null) {
      const qtd = parseQty(m[1]);
      const total = parsePrice(m[2].replace(/R\$/g, "").trim());
      if (qtd >= 25 && qtd <= 1000000 && total > 0 && total < 1000000) {
        out.push({ quantidade: qtd, preco_total: total, preco_unitario: total / qtd });
      }
    }
  }
  return out;
}

// 3) Domain-specific parsers
function parseAtualCard(html: string): Tier[] {
  // Atual Card costuma renderizar tabela com células "Qtd" e "Valor"
  const tiers: Tier[] = [];
  // Tenta ler linhas da tabela: <tr> ... <td>250</td> ... <td>R$ 89,90</td>
  const rowRx = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let r: RegExpExecArray | null;
  while ((r = rowRx.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRx = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let c: RegExpExecArray | null;
    while ((c = cellRx.exec(r[1])) !== null) cells.push(stripTags(c[1]));
    if (cells.length < 2) continue;
    // Procura uma célula com quantidade pura e outra com R$
    let qtd = 0, total = 0;
    for (const cell of cells) {
      if (!qtd) {
        const mq = cell.match(/^\s*(\d{1,3}(?:\.\d{3})+|\d{2,6})\s*(?:un|unid|unidades)?\s*$/i);
        if (mq) qtd = parseQty(mq[1]);
      }
      if (!total) {
        const mp = cell.match(/R\$\s*([\d.,]+)/i);
        if (mp) total = parsePrice(mp[1]);
      }
    }
    if (qtd >= 25 && total > 0) tiers.push({ quantidade: qtd, preco_total: total, preco_unitario: total / qtd });
  }
  if (tiers.length) return tiers;
  // Fallback: padrão "250 un - R$ 89,90"
  return extractTiersFromHtmlGeneric(html);
}

function parseImprimaRapido(html: string): Tier[] {
  const tiers: Tier[] = [];
  // Imprima Rápido normalmente expõe tiers em <option> ou em divs com data-attrs / JSON
  const optRx = /<option[^>]*>([\s\S]*?)<\/option>/gi;
  let o: RegExpExecArray | null;
  while ((o = optRx.exec(html)) !== null) {
    const text = stripTags(o[1]);
    // Ex: "1000 un - R$ 199,90" ou "1.000 unidades por R$ 199,90"
    const m = text.match(/(\d{1,3}(?:\.\d{3})+|\d{2,6})\s*(?:un|unid|unidades|pcs|pe[çc]as)?[\s\S]{0,40}?R\$\s*([\d.,]+)/i);
    if (m) {
      const qtd = parseQty(m[1]);
      const total = parsePrice(m[2]);
      if (qtd >= 25 && total > 0) tiers.push({ quantidade: qtd, preco_total: total, preco_unitario: total / qtd });
    }
  }
  // Também tenta scripts e genérico
  const fromScripts = extractTiersFromScripts(html);
  const fromGeneric = extractTiersFromHtmlGeneric(html);
  return dedupSort([...tiers, ...fromScripts, ...fromGeneric]);
}

function pickDomainParser(url: string): ((html: string) => Tier[]) | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("atualcard.com.br")) return parseAtualCard;
    if (host.includes("imprimarapido.com.br")) return parseImprimaRapido;
  } catch { /* ignore */ }
  return null;
}

// Domains where the HTML is known to be unrenderable by Firecrawl (anti-bot / SPA without prices in initial HTML).
// For these, we skip HTML parsing and go straight to visual screenshot extraction (only if allowVisual=true).
function isVisualOnlyDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("atualcard.com.br") || host.includes("imprimarapido.com.br");
  } catch {
    return false;
  }
}

// Quick health check on the scraped HTML: does it look like a real product page with prices?
function diagnoseHtml(html: string, markdown: string) {
  const hasRS = /R\$/.test(html);
  const hasUnit = /\bunidade|\bunid\b|\bun\b/i.test(html);
  const scriptCount = (html.match(/<script\b/gi) || []).length;
  const tdCount = (html.match(/<td\b/gi) || []).length;
  const optionCount = (html.match(/<option\b/gi) || []).length;
  const mdLen = markdown.trim().length;
  const looksEmpty = !hasRS && !hasUnit && scriptCount === 0 && tdCount === 0 && optionCount === 0 && mdLen < 500;
  return { hasRS, hasUnit, scriptCount, tdCount, optionCount, mdLen, looksEmpty };
}

// ---------- Firecrawl scrape (lightweight, html+markdown only) ----------
async function scrapeLight(url: string, apiKey: string): Promise<{ html: string; markdown: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        onlyMainContent: false,
        waitFor: 3000,
        formats: ["html", "markdown"],
      }),
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

// ---------- Visual fallback (last resort, individual mode only) ----------
async function scrapeWithScreenshot(url: string, apiKey: string): Promise<{ markdown: string; screenshot: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        onlyMainContent: false,
        waitFor: 4000,
        actions: [{ type: "scroll", direction: "down" }, { type: "wait", milliseconds: 1500 }],
        formats: ["markdown", "screenshot"],
      }),
    });
    clearTimeout(timer);
    const d = await r.json();
    if (!r.ok) throw new Error(d?.error || `Firecrawl ${r.status}`);
    return {
      markdown: String(d?.data?.markdown ?? d?.markdown ?? ""),
      screenshot: String(d?.data?.screenshot ?? d?.screenshot ?? ""),
    };
  } catch (e) {
    clearTimeout(timer);
    throw new Error(`Firecrawl visual: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function extractTiersFromScreenshot(screenshotUrl: string): Promise<Tier[]> {
  const KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!KEY) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 50000);
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você extrai tabelas de preço por quantidade de imagens. Retorne TODAS as faixas visíveis. Nunca invente." },
          { role: "user", content: [
            { type: "text", text: "Extraia TODAS as faixas (quantidade × preço total) usando a ferramenta extract_tiers." },
            { type: "image_url", image_url: { url: screenshotUrl } },
          ] },
        ],
        tools: [{
          type: "function",
          function: {
            name: "extract_tiers",
            parameters: {
              type: "object",
              properties: {
                tiers: { type: "array", items: { type: "object", properties: {
                  quantidade: { type: "number" }, preco_total: { type: "number" },
                }, required: ["quantidade", "preco_total"] } },
              },
              required: ["tiers"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "extract_tiers" } },
      }),
    });
    clearTimeout(timer);
    if (!r.ok) return [];
    const d = await r.json();
    const call = d?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) return [];
    const args = JSON.parse(call.function.arguments);
    const raw: any[] = Array.isArray(args.tiers) ? args.tiers : [];
    return raw.map((t) => {
      const q = Number(t.quantidade) || 0;
      const tot = Number(t.preco_total) || 0;
      return { quantidade: q, preco_total: tot, preco_unitario: q > 0 ? tot / q : 0 };
    }).filter((t) => t.quantidade > 0 && t.preco_total > 0);
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ---------- main ----------
export async function scrapeAndExtractTiers(url: string, firecrawlKey: string, opts?: { allowVisual?: boolean }) {
  const allowVisual = opts?.allowVisual !== false;

  // Step 1: lightweight HTML+markdown scrape
  const { html, markdown } = await scrapeLight(url, firecrawlKey);

  // Step 2: try domain-specific parser first
  const domainParser = pickDomainParser(url);
  let domainTiers: Tier[] = [];
  if (domainParser) {
    try { domainTiers = dedupSort(domainParser(html)); } catch (e) { console.warn(`domain parser error: ${e}`); }
  }

  // Step 3: generic HTML + markdown extractors
  const htmlGeneric = extractTiersFromHtmlGeneric(html);
  const scriptTiers = extractTiersFromScripts(html);
  const mdTiers = extractTiersFromMarkdown(markdown);

  // Validate generic tiers against page text (markdown OR html-stripped) to avoid garbage
  const haystack = markdown + " " + stripTags(html.slice(0, 200000));
  const validate = (arr: Tier[]) => arr.filter((t) =>
    numberAppearsIn(t.quantidade, haystack) && numberAppearsIn(t.preco_total, haystack)
  );

  const merged = dedupSort([
    ...domainTiers,                                    // domain-specific is trusted
    ...validate([...htmlGeneric, ...scriptTiers, ...mdTiers]),
  ]);

  console.log(`[${url}] html=${html.length} md=${markdown.length} domain=${domainTiers.length} htmlGen=${htmlGeneric.length} scripts=${scriptTiers.length} md=${mdTiers.length} → final=${merged.length}`);

  // Step 4: visual fallback only if we still have nothing AND visual is allowed
  if (merged.length === 0 && allowVisual) {
    try {
      const { screenshot, markdown: md2 } = await scrapeWithScreenshot(url, firecrawlKey);
      console.log(`[${url}] visual fallback hasShot=${!!screenshot}`);
      if (screenshot) {
        const visual = await extractTiersFromScreenshot(screenshot);
        const valid = visual.filter((t) =>
          numberAppearsIn(t.quantidade, md2 + " " + haystack) || numberAppearsIn(t.preco_total, md2 + " " + haystack)
        );
        if (valid.length) return { produto: "", fornecedor: "", tiers: dedupSort(valid), diagnostics: { used_visual: true } };
        if (visual.length) return { produto: "", fornecedor: "", tiers: dedupSort(visual), diagnostics: { used_visual: true, unvalidated: true } };
      }
    } catch (e) {
      console.warn(`visual fallback skipped: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    produto: "",
    fornecedor: "",
    tiers: merged,
    diagnostics: {
      html_chars: html.length,
      md_chars: markdown.length,
      domain_count: domainTiers.length,
      html_generic: htmlGeneric.length,
      script_count: scriptTiers.length,
      md_count: mdTiers.length,
      used_visual: false,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY não configurada");
    const body = await req.json().catch(() => ({}));
    const url = body?.url;
    const allowVisual = body?.allowVisual !== false; // default true (individual)
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ success: false, error: "URL obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await scrapeAndExtractTiers(url, apiKey, { allowVisual });
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
