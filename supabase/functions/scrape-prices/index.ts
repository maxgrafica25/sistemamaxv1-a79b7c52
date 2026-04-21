// =====================================================================
// Edge Function: scrape-prices (Browserless.io + Cheerio)
//   - modo preview      → POST { urls: string[] }   → devolve resultados crus
//   - modo persistência → POST { site_id: string }  → persiste em
//                          site_precos_tiers + sites_monitorados
//
// SERVICE ROLE: necessária — modo persistência atualiza sites_monitorados e
// site_precos_tiers em nome de chamadas internas (cron, webhook) sem JWT de
// usuário. Cliente criado via wrapper auditado (_shared/admin-client).
// =====================================================================
import * as cheerio from "npm:cheerio@1.0.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { getAdminClient, logAdminOperation } from "../_shared/admin-client.ts";

const BodySchema = z.union([
  z.object({ site_id: z.string().uuid() }),
  z.object({ urls: z.array(z.string().url().max(2000)).min(1).max(20) }),
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BROWSERLESS_BASE = "https://production-sfo.browserless.io";

type Price = {
  quantity: number;
  unit_price: number;
  unit_price_calculated: boolean;
  total_price: number;
};

type ScrapeResult = {
  source_url: string;
  scraped_at: string;
  strategy: "html" | "html-regex" | "function-atualcard" | "function-imprimarapido";
  prices: Price[];
  error: string | null;
  elapsed_ms?: number;
  debugHtml?: string | null;
};

// ---------- Normalização BR ----------
function parsePriceBR(raw: string): number | null {
  if (!raw) return null;
  let s = String(raw).replace(/R\$/gi, "").replace(/\s/g, "").trim();
  if (!s) return null;
  // BR: 1.234,56 → 1234.56  |  US: 1234.56 mantém
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseQty(raw: string): number | null {
  if (!raw) return null;
  const m = String(raw).replace(/\./g, "").match(/(\d{1,7})/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function isValidQty(q: number): boolean {
  return q >= 1 && q <= 1_000_000;
}
function isValidPrice(p: number): boolean {
  return p > 0 && p < 1_000_000;
}

// ---------- Finalização e dedupe ----------
type RawTier = { quantity: number; unit_price?: number; total_price?: number };

function finalizeTiers(raw: RawTier[], urlForLog: string): Price[] {
  const byQty = new Map<number, RawTier>();
  for (const t of raw) {
    if (!isValidQty(t.quantity)) continue;
    if (!byQty.has(t.quantity)) byQty.set(t.quantity, t);
  }
  const out: Price[] = [];
  for (const t of [...byQty.values()].sort((a, b) => a.quantity - b.quantity)) {
    let unit = t.unit_price ?? null;
    let total = t.total_price ?? null;
    let calculated = false;
    if (unit == null && total != null) {
      unit = total / t.quantity;
      calculated = true;
      console.warn(`[unit_calc] ${urlForLog} qty=${t.quantity} total=${total} unit=${unit}`);
    } else if (total == null && unit != null) {
      total = unit * t.quantity;
    }
    if (unit == null || total == null) continue;
    if (!isValidPrice(unit) || !isValidPrice(total)) continue;
    out.push({
      quantity: t.quantity,
      unit_price: Math.round(unit * 10000) / 10000,
      total_price: Math.round(total * 100) / 100,
      unit_price_calculated: calculated,
    });
  }
  return out;
}

// ---------- Estratégias HTML ----------
function extractFromTables($: cheerio.CheerioAPI): RawTier[] {
  const tiers: RawTier[] = [];
  $("table").each((_, tbl) => {
    $(tbl).find("tr").each((_, tr) => {
      const cells = $(tr).find("td,th").map((_, c) => $(c).text().trim()).get();
      if (cells.length < 2) return;
      // Tenta achar coluna qty + 1 ou 2 colunas de preço
      let qty: number | null = null;
      const prices: number[] = [];
      for (const cell of cells) {
        const q = parseQty(cell);
        const p = parsePriceBR(cell);
        // Se a célula tem "R$" é preço; se é só número puro pequeno-grande pode ser qty
        if (/R\$/i.test(cell) && p != null) {
          prices.push(p);
        } else if (qty == null && q != null && !/R\$/i.test(cell)) {
          qty = q;
        } else if (p != null && q == null) {
          prices.push(p);
        }
      }
      if (qty != null && prices.length >= 1) {
        // Heurística: se 2 preços e o menor < maior/qty*1.2 → menor=unit, maior=total
        if (prices.length >= 2) {
          const sorted = [...prices].sort((a, b) => a - b);
          const unit = sorted[0];
          const total = sorted[sorted.length - 1];
          tiers.push({ quantity: qty, unit_price: unit, total_price: total });
        } else {
          tiers.push({ quantity: qty, total_price: prices[0] });
        }
      }
    });
  });
  return tiers;
}

function extractFromLists($: cheerio.CheerioAPI): RawTier[] {
  const tiers: RawTier[] = [];
  const sel = "ul li, ol li, [class*=preco], [class*=tier], [class*=price], [class*=quantidade]";
  $(sel).each((_, el) => {
    const txt = $(el).text().replace(/\s+/g, " ").trim();
    if (!txt || txt.length > 200) return;
    const qtyMatch = txt.match(/(\d{2,6})\s*(?:un|unidades|x|pç|pcs|peças)?/i);
    const priceMatches = [...txt.matchAll(/R\$\s*([\d.,]+)/gi)];
    if (!qtyMatch || priceMatches.length === 0) return;
    const qty = parseQty(qtyMatch[1]);
    if (qty == null) return;
    const prices = priceMatches.map((m) => parsePriceBR(m[1])).filter((n): n is number => n != null);
    if (!prices.length) return;
    if (prices.length >= 2) {
      const sorted = [...prices].sort((a, b) => a - b);
      tiers.push({ quantity: qty, unit_price: sorted[0], total_price: sorted[sorted.length - 1] });
    } else {
      tiers.push({ quantity: qty, total_price: prices[0] });
    }
  });
  return tiers;
}

function extractByRegex(html: string): RawTier[] {
  const tiers: RawTier[] = [];
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  // Procura padrões "1000 ... R$ 96,99"
  const re = /(\d{2,6})\s*(?:un|unid|unidades|x|pç|pcs|peças)?[^R$]{0,80}R\$\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const qty = parseQty(m[1]);
    const price = parsePriceBR(m[2]);
    if (qty != null && price != null) {
      tiers.push({ quantity: qty, total_price: price });
    }
  }
  return tiers;
}

// ---------- Browserless ----------
async function fetchRenderedHtml(url: string, token: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45_000);
  try {
    const r = await fetch(`${BROWSERLESS_BASE}/content?token=${encodeURIComponent(token)}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        gotoOptions: { waitUntil: "networkidle2", timeout: 25000 },
      }),
    });
    clearTimeout(timer);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      let friendly = `Browserless HTTP ${r.status}`;
      if (r.status === 401) friendly = "API key inválida (BROWSERLESS_API_KEY)";
      else if (r.status === 402) friendly = "Cota Browserless excedida (402)";
      else if (r.status === 429) friendly = "Rate limit Browserless (429)";
      else if (r.status === 408 || r.status === 504) friendly = `Timeout Browserless (${r.status})`;
      throw new Error(`${friendly}: ${txt.slice(0, 200)}`);
    }
    return await r.text();
  } catch (e) {
    clearTimeout(timer);
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}

// ---------- Browserless /function (executa JS na página renderizada) ----------
async function fetchViaBrowserlessFunction<T>(
  url: string,
  token: string,
  fnSource: string,
  context: Record<string, unknown> = {},
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const r = await fetch(`${BROWSERLESS_BASE}/function?token=${encodeURIComponent(token)}`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: fnSource,
        context: { url, ...context },
      }),
    });
    clearTimeout(timer);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      let friendly = `Browserless /function HTTP ${r.status}`;
      if (r.status === 400) {
        console.warn(`[browserless /function 400] body=${txt.slice(0, 300)}`);
        friendly = "Browserless /function 400 (formato do código rejeitado)";
      }
      else if (r.status === 401) friendly = "API key inválida (BROWSERLESS_API_KEY)";
      else if (r.status === 402) friendly = "Cota Browserless excedida (402)";
      else if (r.status === 429) friendly = "Rate limit Browserless (429)";
      else if (r.status === 408 || r.status === 504) friendly = `Timeout Browserless (${r.status})`;
      throw new Error(`${friendly}: ${txt.slice(0, 300)}`);
    }
    const json = await r.json();
    return (json?.data ?? json) as T;
  } catch (e) {
    clearTimeout(timer);
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}

// Função JS executada DENTRO do navegador headless do Browserless.
const ATUALCARD_FN_SOURCE = `
export default async function ({ page, context }) {
  await page.goto(context.url, { waitUntil: 'networkidle2', timeout: 30000 });

  try {
    await page.waitForFunction(() => {
      const txt = document.body ? document.body.innerText : '';
      const matches = txt.match(/R\\\$\\s*[\\d.,]+/g) || [];
      return matches.length >= 3;
    }, { timeout: 15000 });
  } catch (_) { /* segue mesmo sem match */ }

  const data = await page.evaluate(() => {
    const parsePriceBR = (raw) => {
      if (!raw) return null;
      let s = String(raw).replace(/R\\\$/gi, '').replace(/\\s/g, '').trim();
      if (!s) return null;
      if (s.includes(',')) s = s.replace(/\\./g, '').replace(',', '.');
      const n = parseFloat(s);
      return isFinite(n) ? n : null;
    };
    // BR: trata ponto como separador de milhar. "1.000" -> 1000, "1.000.000" -> 1000000.
    const parseQtyBR = (raw) => {
      if (raw == null) return null;
      const s = String(raw);
      const m = s.match(/(\\d{1,3}(?:\\.\\d{3})+|\\d{2,7})/);
      if (!m) return null;
      const n = parseInt(m[1].replace(/\\./g, ''), 10);
      return isFinite(n) && n >= 100 ? n : null;
    };

    // Localiza o container da seção "Quantidade" para escopar o varrimento de listas
    const findQuantidadeRoot = () => {
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,label,strong,legend,div,span,p'));
      for (const h of headings) {
        const t = (h.textContent || '').trim().toLowerCase();
        if (t === 'quantidade' || t === 'quantidades' || t.startsWith('quantidade ') || t.startsWith('quantidades ')) {
          let node = h;
          for (let i = 0; i < 6 && node; i++) {
            node = node.parentElement;
            if (!node) break;
            const count = (node.textContent.match(/R\\\$/g) || []).length;
            if (count >= 5) return node;
          }
        }
      }
      return null;
    };
    const qtyRoot = findQuantidadeRoot() || document;

    const tiers = [];
    const counts = { table: 0, radio: 0, dataAttr: 0, list: 0 };
    const pushTier = (qty, total, unit) => {
      if (!qty || qty < 100 || qty > 1000000) return;
      const t = { quantity: qty };
      if (total != null && total > 0) t.total_price = total;
      if (unit != null && unit > 0) t.unit_price = unit;
      if (t.total_price == null && t.unit_price == null) return;
      tiers.push(t);
    };

    qtyRoot.querySelectorAll('table').forEach((tbl) => {
      tbl.querySelectorAll('tr').forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('td,th')).map((c) => c.textContent.trim());
        if (cells.length < 2) return;
        let qty = null;
        const prices = [];
        for (const cell of cells) {
          if (/R\\\$/i.test(cell)) {
            const p = parsePriceBR(cell);
            if (p != null) prices.push(p);
          } else if (qty == null) {
            const q = parseQtyBR(cell);
            if (q != null) qty = q;
          }
        }
        if (qty != null && prices.length >= 1) {
          counts.table++;
          if (prices.length >= 2) {
            const sorted = [...prices].sort((a, b) => a - b);
            pushTier(qty, sorted[sorted.length - 1], sorted[0]);
          } else {
            pushTier(qty, prices[0], null);
          }
        }
      });
    });

    qtyRoot.querySelectorAll('input[type="radio"][name*="quant" i], input[type="radio"][name*="qtd" i]').forEach((inp) => {
      const qty = parseQtyBR(inp.value || inp.getAttribute('data-quantidade') || inp.getAttribute('data-qtd'));
      if (!qty) return;
      let total = parsePriceBR(inp.getAttribute('data-price') || inp.getAttribute('data-preco') || inp.getAttribute('data-valor'));
      if (!total && inp.id) {
        const lbl = document.querySelector('label[for="' + inp.id + '"]');
        if (lbl) {
          const m = lbl.textContent.match(/R\\\$\\s*[\\d.,]+/);
          if (m) total = parsePriceBR(m[0]);
        }
      }
      if (!total) {
        const parent = inp.closest('label,li,tr,div');
        if (parent) {
          const m = parent.textContent.match(/R\\\$\\s*[\\d.,]+/);
          if (m) total = parsePriceBR(m[0]);
        }
      }
      if (total && total > 1) { counts.radio++; pushTier(qty, total, null); }
    });

    qtyRoot.querySelectorAll('[data-quantidade],[data-qtd],[data-quantity]').forEach((el) => {
      const qty = parseQtyBR(el.getAttribute('data-quantidade') || el.getAttribute('data-qtd') || el.getAttribute('data-quantity'));
      if (!qty) return;
      const total = parsePriceBR(el.getAttribute('data-price') || el.getAttribute('data-preco') || el.getAttribute('data-valor'));
      if (total && total > 1) { counts.dataAttr++; pushTier(qty, total, null); }
    });

    qtyRoot.querySelectorAll('ul li, ol li, [class*="preco"], [class*="tier"], [class*="quantidade"]').forEach((el) => {
      const txt = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!txt || txt.length > 200) return;
      const qm = txt.match(/(\\d{1,3}(?:\\.\\d{3})+|\\d{3,7})\\s*(?:un|unid|unidades|x|pç|pcs|peças)?/i);
      const pm = txt.match(/R\\\$\\s*([\\d.,]+)/i);
      if (!qm || !pm) return;
      const qty = parseQtyBR(qm[1]);
      const total = parsePriceBR(pm[1]);
      if (qty && total && total > 1) { counts.list++; pushTier(qty, total, null); }
    });

    return { tiers, counts, scoped: qtyRoot !== document };
  });

  return data;
}
`;

// Fallback: 1 tier do dataLayer/data-price do HTML estático
async function scrapeAtualCardDataLayerFallback(url: string, token: string): Promise<Price[]> {
  let qty: number | null = null;
  try {
    const pathname = new URL(url).pathname;
    const m = pathname.match(/-(\d{2,7})-\d+\/?$/);
    qty = m ? parseInt(m[1], 10) : null;
  } catch (_) { /* ignore */ }
  if (!qty || !isValidQty(qty)) return [];

  const html = await fetchRenderedHtml(url, token);
  let total: number | null = null;
  const dlMatch = html.match(/item_id:\s*"\d+"[^}]*?price:\s*([\d.]+)/);
  if (dlMatch) total = parseFloat(dlMatch[1]);
  if (!total || total <= 0) {
    const dpMatch = html.match(/data-price="(\d+\.\d{1,2})"/);
    if (dpMatch) total = parseFloat(dpMatch[1]);
  }
  if (!total || !isValidPrice(total)) return [];
  return finalizeTiers([{ quantity: qty, total_price: total }], url);
}

// ---------- Imprima Rápido ----------
const IMPRIMARAPIDO_FN_SOURCE = `
export default async function ({ page, context }) {
  await page.goto(context.url, { waitUntil: 'networkidle2', timeout: 45000 });

  const tierSelector = [
    'select[name*="quant" i] option[value]:not([value=""])',
    'select[name*="qtd" i] option[value]:not([value=""])',
    '[data-quantidade]',
    '[data-qtd]',
    '[data-quantity]',
    'input[type="radio"][name*="quant" i]',
    'input[type="radio"][name*="qtd" i]',
  ].join(', ');

  try {
    await page.waitForSelector(tierSelector, { timeout: 8000 });
  } catch (_) { /* segue mesmo sem o seletor — estratégias abaixo podem pegar dataLayer */ }

  const data = await page.evaluate(() => {
    const parsePriceBR = (s) => {
      const m = String(s).replace(/\\s|\\u00a0/g, '').match(/(\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?|\\d+(?:,\\d+)?)/);
      if (!m) return null;
      const n = parseFloat(m[1].replace(/\\./g, '').replace(',', '.'));
      return isFinite(n) && n > 0 ? n : null;
    };
    const parseQtyBR = (s) => {
      if (s == null) return null;
      const m = String(s).replace(/\\s|\\u00a0/g, '').match(/(\\d{1,3}(?:\\.\\d{3})+|\\d{2,7})/);
      if (!m) return null;
      const n = parseInt(m[1].replace(/\\./g, ''), 10);
      return isFinite(n) && n >= 10 && n <= 1000000 ? n : null;
    };

    const tiers = [];

    // A) <select><option>
    document.querySelectorAll('select option').forEach((opt) => {
      const txt = (opt.textContent || '').trim();
      const qty = parseQtyBR(opt.value) || parseQtyBR(txt);
      const priceAttr = opt.getAttribute('data-preco') || opt.getAttribute('data-price') || opt.getAttribute('data-valor');
      let price = priceAttr ? parsePriceBR(priceAttr) : null;
      if (!price && txt.includes('R$')) price = parsePriceBR(txt.split('R$')[1]);
      if (qty && price) tiers.push({ quantity: qty, total_price: price });
    });

    // B) [data-quantidade] / [data-qtd] / [data-quantity]
    document.querySelectorAll('[data-quantidade], [data-qtd], [data-quantity]').forEach((el) => {
      const qty = parseQtyBR(el.getAttribute('data-quantidade') || el.getAttribute('data-qtd') || el.getAttribute('data-quantity'));
      const price = parsePriceBR(el.getAttribute('data-preco') || el.getAttribute('data-price') || el.getAttribute('data-valor') || el.textContent || '');
      if (qty && price) tiers.push({ quantity: qty, total_price: price });
    });

    // C) Imprima Rápido — regex no textContent do <li>, escopado ao js-quantity-container
    const qtyContainer = document.querySelector('div.js-quantity-container');
    if (qtyContainer) {
      qtyContainer.querySelectorAll('li').forEach((li) => {
        const txt = (li.textContent || '').replace(/\\s+/g, ' ').trim();
        const qtyMatch = txt.match(/(\\d{1,3}(?:\\.\\d{3})+)/);
        const priceMatch = txt.match(/R\\$\\s*([\\d.]+,\\d{2})/);
        if (!qtyMatch || !priceMatch) return;
        const qty = parseQtyBR(qtyMatch[1]);
        const price = parsePriceBR(priceMatch[1]);
        if (qty && price && qty >= 100) tiers.push({ quantity: qty, total_price: price });
      });
    }

    // D) dataLayer (GTM)
    try {
      const dl = (window.dataLayer || []).flatMap((o) => (o && o.ecommerce && (o.ecommerce.detail && o.ecommerce.detail.products || o.ecommerce.items)) || []);
      dl.forEach((p) => {
        const qty = parseQtyBR(p.quantity || p.variant);
        const price = parsePriceBR(p.price);
        if (qty && price) tiers.push({ quantity: qty, total_price: price });
      });
    } catch (_) {}

    let debugHtml = null;
    if (tiers.length === 0) {
      const container = document.querySelector('div.js-quantity-container');
      if (container) {
        debugHtml = container.outerHTML.slice(0, 8000);
      } else {
        debugHtml = 'NO_CONTAINER | body sample: ' + document.body.innerHTML.slice(0, 4000);
      }
    }
    return { tiers, debugHtml };
  });

  return data;
}
`;

async function scrapeImprimaRapido(url: string, token: string): Promise<ScrapeResult> {
  const startedAt = Date.now();
  const base = {
    source_url: url,
    scraped_at: new Date().toISOString(),
    strategy: "function-imprimarapido" as const,
  };
  try {
    const result = await fetchViaBrowserlessFunction<{ tiers: RawTier[]; debugHtml?: string | null }>(
      url,
      token,
      IMPRIMARAPIDO_FN_SOURCE,
    );
    const prices = finalizeTiers(result?.tiers ?? [], url);
    console.log(`[scrape-imprimarapido] ${url} | tiers=${prices.length} | ${Date.now() - startedAt}ms`);
    if (prices.length === 0) {
      console.log(`[scrape-imprimarapido] tiers vazios | url=${url} | debugHtml(len)=${result?.debugHtml?.length ?? 0}`);
      return {
        ...base,
        prices,
        error: "Tabela de preços não encontrada",
        elapsed_ms: Date.now() - startedAt,
        debugHtml: result?.debugHtml ?? null,
      };
    }
    return {
      ...base,
      prices,
      error: null,
      elapsed_ms: Date.now() - startedAt,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[scrape-imprimarapido] ${url} | erro /function: ${msg}`);
    return { ...base, prices: [], error: msg, elapsed_ms: Date.now() - startedAt };
  }
}

// ---------- Atual Card ----------
async function scrapeAtualCard(url: string, token: string): Promise<ScrapeResult> {
  const startedAt = Date.now();
  const base = {
    source_url: url,
    scraped_at: new Date().toISOString(),
    strategy: "function-atualcard" as const,
  };

  try {
    const result = await fetchViaBrowserlessFunction<{
      tiers: RawTier[];
      counts?: Record<string, number>;
    }>(url, token, ATUALCARD_FN_SOURCE);

    console.log(`[atualcard /function] tiers=${result?.tiers?.length ?? 0} counts=${JSON.stringify(result?.counts ?? {})} scoped=${(result as any)?.scoped ?? false} sample=${JSON.stringify((result?.tiers ?? []).slice(0, 3))}`);

    let prices = finalizeTiers(result?.tiers ?? [], url);

    if (prices.length === 0) {
      const fallback = await scrapeAtualCardDataLayerFallback(url, token);
      if (fallback.length > 0) {
        console.warn(`[atualcard fallback dataLayer] tiers=${fallback.length}`);
        prices = fallback;
      }
    }

    console.log(`[scrape-atualcard] ${url} | tiers=${prices.length} | ${Date.now() - startedAt}ms`);
    return {
      ...base,
      prices,
      error: prices.length === 0 ? "Tabela de preços não encontrada" : null,
      elapsed_ms: Date.now() - startedAt,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[scrape-atualcard] ${url} | erro /function: ${msg}`);
    try {
      const prices = await scrapeAtualCardDataLayerFallback(url, token);
      if (prices.length > 0) {
        console.warn(`[atualcard fallback dataLayer pós-erro] tiers=${prices.length}`);
        return { ...base, prices, error: null, elapsed_ms: Date.now() - startedAt };
      }
    } catch (_) { /* ignore */ }
    return { ...base, prices: [], error: msg, elapsed_ms: Date.now() - startedAt };
  }
}

async function scrapeOne(url: string, token: string): Promise<ScrapeResult> {
  // 1) Parse host — se falhar, retorna erro IMEDIATAMENTE (não cai no genérico)
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return {
      source_url: url,
      scraped_at: new Date().toISOString(),
      strategy: "html",
      prices: [],
      error: "URL inválida",
      elapsed_ms: 0,
    };
  }

  // 2) Dispatcher por host — SEM try/catch externo.
  //    Resultado (ou exceção) propaga direto. NUNCA cai no genérico abaixo.
  if (host === "atualcard.com.br" || host.endsWith(".atualcard.com.br")) {
    return await scrapeAtualCard(url, token);
  }
  if (host === "imprimarapido.com.br" || host.endsWith(".imprimarapido.com.br")) {
    return await scrapeImprimaRapido(url, token);
  }

  // 3) Genérico — só para hosts não-especializados

  const startedAt = Date.now();
  let lastErr: string | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const html = await fetchRenderedHtml(url, token);
      const $ = cheerio.load(html);

      // Estratégia 1: tabelas
      let raw = extractFromTables($);
      let strategy: "html" | "html-regex" = "html";

      // Estratégia 2: listas / classes
      if (finalizeTiers(raw, url).length < 2) {
        const fromLists = extractFromLists($);
        raw = [...raw, ...fromLists];
      }

      let prices = finalizeTiers(raw, url);

      // Estratégia 3: regex no texto puro
      if (prices.length < 2) {
        console.warn(`[fallback-regex] ${url}`);
        const fromRegex = extractByRegex(html);
        prices = finalizeTiers([...raw, ...fromRegex], url);
        if (prices.length > 0) strategy = "html-regex";
      }

      console.log(`[scrape] ${url} | tiers=${prices.length} | strategy=${strategy} | ${Date.now() - startedAt}ms`);

      return {
        source_url: url,
        scraped_at: new Date().toISOString(),
        strategy,
        prices,
        error: prices.length === 0 ? "Nenhum tier encontrado" : null,
        elapsed_ms: Date.now() - startedAt,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.warn(`[retry ${attempt}/3] ${url}: ${lastErr}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return {
    source_url: url,
    scraped_at: new Date().toISOString(),
    strategy: "html",
    prices: [],
    error: lastErr || "Falha desconhecida",
    elapsed_ms: Date.now() - startedAt,
  };
}

async function scrapeMany(urls: string[]): Promise<ScrapeResult[]> {
  const token = Deno.env.get("BROWSERLESS_API_KEY");
  if (!token) throw new Error("BROWSERLESS_API_KEY não configurada");

  const results: ScrapeResult[] = [];
  for (const url of urls) {
    try {
      results.push(await scrapeOne(url, token));
    } catch (e) {
      results.push({
        source_url: url,
        scraped_at: new Date().toISOString(),
        strategy: "html",
        prices: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = getAdminClient({
    fnName: "scrape-prices",
    reason: "Persistir resultados de scraping em sites_monitorados/site_precos_tiers (chamadas sem JWT de usuário)",
  });

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payload inválido: informe { site_id: uuid } OU { urls: string[] (1-20 URLs, máx 2000 chars cada) }",
          details: parsed.error.flatten(),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const siteId: string | undefined = "site_id" in parsed.data ? parsed.data.site_id : undefined;
    const urls: string[] | undefined = "urls" in parsed.data ? parsed.data.urls : undefined;

    // ---------- Modo PREVIEW ----------
    if (!siteId && urls && urls.length) {
      const results = await scrapeMany(urls);
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!siteId) {
      return new Response(
        JSON.stringify({ success: false, error: "informe site_id ou urls[]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---------- Modo PERSISTÊNCIA ----------
    const { data: site, error: siteErr } = await supabase
      .from("sites_monitorados")
      .select("id, url_completa, nome_produto")
      .eq("id", siteId)
      .maybeSingle();

    if (siteErr || !site) {
      return new Response(
        JSON.stringify({ success: false, error: "site não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!site.url_completa) {
      await supabase.from("sites_monitorados").update({
        scrape_status: "error",
        scrape_error: "URL vazia",
        scrape_source: "browserless",
        timestamp_check: new Date().toISOString(),
      }).eq("id", site.id);
      return new Response(
        JSON.stringify({ success: false, error: "URL vazia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let results: ScrapeResult[] = [];
    try {
      results = await scrapeMany([site.url_completa]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("sites_monitorados").update({
        scrape_status: "error",
        scrape_error: msg,
        scrape_source: "browserless",
        timestamp_check: new Date().toISOString(),
      }).eq("id", site.id);
      return new Response(
        JSON.stringify({ success: false, error: msg, site_id: site.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = results[0];
    if (!result || !result.prices.length) {
      await supabase.from("sites_monitorados").update({
        scrape_status: "error",
        scrape_error: result?.error || "Nenhum tier encontrado",
        scrape_source: "browserless",
        timestamp_check: new Date().toISOString(),
      }).eq("id", site.id);
      return new Response(
        JSON.stringify({ success: false, error: result?.error || "sem tiers", site_id: site.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Marca tiers existentes como inativos
    await supabase.from("site_precos_tiers").update({ ativo: false }).eq("site_id", site.id);

    const nowIso = new Date().toISOString();
    for (const p of result.prices) {
      const { data: existing } = await supabase
        .from("site_precos_tiers")
        .select("id")
        .eq("site_id", site.id)
        .eq("quantidade", p.quantity)
        .maybeSingle();

      const row = {
        site_id: site.id,
        quantidade: p.quantity,
        preco_total: p.total_price,
        preco_unitario: p.unit_price,
        ativo: true,
        atualizado_em: nowIso,
      };

      if (existing) {
        await supabase.from("site_precos_tiers").update(row).eq("id", existing.id);
      } else {
        await supabase.from("site_precos_tiers").insert(row);
      }
    }

    const minUnit = Math.min(...result.prices.map((p) => p.unit_price));
    await supabase.from("sites_monitorados").update({
      preco_atual: minUnit,
      scrape_status: "ok",
      scrape_error: null,
      scrape_source: "browserless",
      timestamp_check: nowIso,
    }).eq("id", site.id);

    await logAdminOperation(supabase, {
      function_name: "scrape-prices",
      operation: "persist_tiers",
      target_table: "site_precos_tiers",
      target_count: result.prices.length,
      metadata: { site_id: site.id, strategy: result.strategy, elapsed_ms: result.elapsed_ms },
    });

    return new Response(
      JSON.stringify({
        success: true,
        site_id: site.id,
        tiers_count: result.prices.length,
        strategy: result.strategy,
        elapsed_ms: result.elapsed_ms,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("scrape-prices:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
