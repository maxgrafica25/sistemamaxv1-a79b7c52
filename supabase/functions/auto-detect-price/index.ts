// Tenta extrair o preço de uma URL automaticamente, sem precisar de seletor CSS.
// Estratégias (em ordem):
//   1) JSON-LD (schema.org Product/Offer)
//   2) Meta tags (og:price:amount, product:price:amount, itemprop=price)
//   3) Heurística: maior valor "R$ ..." próximo a palavras-chave de preço
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseBRL(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (!s) return null;
  // Remove R$, espaços, mantém dígitos vírgula e ponto
  const cleaned = s
    .replace(/[^\d,.\-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function fromJsonLd(doc: any): { price: number | null; source: string } {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')) as any[];
  for (const sc of scripts) {
    try {
      const data = JSON.parse(sc.textContent || "{}");
      const items = Array.isArray(data) ? data : [data];
      for (const it of items) {
        const candidates: any[] = [];
        const pushOffers = (o: any) => {
          if (!o) return;
          if (Array.isArray(o)) o.forEach(pushOffers);
          else candidates.push(o);
        };
        pushOffers(it.offers);
        pushOffers(it["@graph"]);
        for (const c of candidates) {
          const p = parseBRL(c?.price ?? c?.lowPrice ?? c?.priceSpecification?.price);
          if (p) return { price: p, source: "JSON-LD (schema.org)" };
        }
        const direct = parseBRL(it?.price);
        if (direct) return { price: direct, source: "JSON-LD direto" };
      }
    } catch (_) { /* ignore */ }
  }
  return { price: null, source: "" };
}

function fromMeta(doc: any): { price: number | null; source: string } {
  const selectors = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
    '[itemprop="price"]',
    'meta[name="price"]',
  ];
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const val = el.getAttribute("content") || el.getAttribute("value") || el.textContent;
      const p = parseBRL(val);
      if (p) return { price: p, source: `meta tag ${sel}` };
    }
  }
  return { price: null, source: "" };
}

function fromHeuristic(html: string): { price: number | null; source: string } {
  // Procura padrões R$ X,XX em todo o HTML; pega o mais frequente nos primeiros 50KB
  // Normaliza &nbsp; (\u00A0) e entidades HTML para espaço comum
  const normalized = html
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00A0/g, " ")
    .replace(/&#160;/g, " ");
  const slice = normalized.slice(0, 80000);
  // Aceita "R$" seguido de qualquer espaço (incluindo nenhum) antes do número
  const re = /R\$[\s\u00A0]*([\d.]+,\d{2})/g;
  const all: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    const p = parseBRL(m[1]);
    if (p && p > 0.5 && p < 1_000_000) all.push(p);
  }
  if (!all.length) return { price: null, source: "" };
  // Pega o menor "preço por" típico (geralmente preço à vista). Usa o menor dos top-3 mais frequentes.
  const freq = new Map<number, number>();
  all.forEach((v) => freq.set(v, (freq.get(v) || 0) + 1));
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v).sort((a, b) => a - b);
  return { price: sorted[0], source: "heurística (R$ no HTML)" };
}

const WORKER_ONLY_DOMAINS = ["atualcard.com.br", "imprimarapido.com.br"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const { url } = await req.json();
    if (!url) return json({ success: false, error: "url obrigatória" }, 400);

    // Guard: PWA/SPA suppliers that don't render price in raw HTML.
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (WORKER_ONLY_DOMAINS.some((d) => host.includes(d))) {
        return json({
          success: false,
          useTabelaAuto: true,
          error: "Esse fornecedor não funciona no modo URL simples. Use 'Tabela auto', que usa captura avançada (Playwright).",
        });
      }
    } catch {
      return json({ success: false, error: "URL inválida" }, 400);
    }

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml",
          "Accept-Language": "pt-BR,pt;q=0.9",
        },
      });
    } catch (fetchErr) {
      return json({ success: false, error: `Falha ao acessar a URL: ${(fetchErr as Error).message}. Tente 'Tabela auto'.` });
    }
    if (!res.ok) {
      return json({ success: false, error: `Falha HTTP ${res.status}. Tente 'Tabela auto'.` });
    }

    let html = "";
    try {
      html = await res.text();
    } catch (bodyErr) {
      return json({ success: false, useTabelaAuto: true, error: `Falha ao ler conteúdo da página: ${(bodyErr as Error).message}. Use 'Tabela auto'.` });
    }

    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) return json({ success: false, error: "Não foi possível parsear o HTML" });

    const title =
      doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
      doc.querySelector("title")?.textContent ||
      "";

    let result = fromJsonLd(doc);
    if (!result.price) result = fromMeta(doc);
    if (!result.price) result = fromHeuristic(html);

    if (!result.price) {
      return json({
        success: false,
        error: "Não consegui detectar o preço automaticamente. Use 'Tabela auto' (captura avançada) ou o modo Avançado com seletor CSS.",
        title,
      });
    }

    return json({ success: true, price: result.price, source: result.source, title: title.trim().slice(0, 200) });
  } catch (e) {
    return json({ success: false, error: (e as Error).message }, 200);
  }
});
