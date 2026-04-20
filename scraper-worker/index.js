// =====================================================================
// Scraper Worker — Playwright único para todas as URLs.
// Endpoints:
//   GET  /health           → { status: "ok", uptime }
//   POST /scrape           → { results: [...] }   (Bearer auth)
//
// Estratégias por URL (em ordem):
//   1) "api"        → JSON capturado via page.on('response')
//   2) "html"       → Cheerio em <table>, depois ul/li + [class*=preco|tier]
//   3) "html-regex" → fallback regex em texto livre
// =====================================================================

const express = require("express");
const cheerio = require("cheerio");
const { chromium } = require("playwright");

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = parseInt(process.env.PORT || "3000", 10);
const WORKER_SECRET = process.env.WORKER_SECRET || "";

if (!WORKER_SECRET) {
  console.warn("[scraper-worker] WORKER_SECRET ausente — POST /scrape rejeitará todas as chamadas.");
}

// ---------------------------------------------------------------------
// Normalização de números BR (R$ 1.234,56 → 1234.56)
// ---------------------------------------------------------------------
function parsePriceBR(raw) {
  if (raw == null) return 0;
  let s = String(raw).trim().replace(/R\$\s*/gi, "").replace(/\s/g, "");
  if (!s) return 0;
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseQty(raw) {
  if (raw == null) return 0;
  const s = String(raw).replace(/[.\s]/g, "").replace(/,/g, "");
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

function isValidQty(q) {
  return q >= 10 && q <= 1000000;
}
function isValidPrice(p) {
  return p >= 0.01 && p <= 1000000;
}

// ---------------------------------------------------------------------
// Dedupe + ordena tiers; calcula unit_price quando faltar.
// Retorna lista de { quantity, unit_price, unit_price_calculated, total_price }.
// ---------------------------------------------------------------------
function finalizeTiers(rawTiers, urlForLog) {
  const map = new Map();
  for (const t of rawTiers) {
    const qty = parseQty(t.quantity);
    let total = t.total_price != null ? parsePriceBR(t.total_price) : null;
    let unit = t.unit_price != null ? parsePriceBR(t.unit_price) : null;
    if (!isValidQty(qty)) continue;

    let calculated = false;
    if (unit == null && total != null && qty > 0) {
      unit = total / qty;
      calculated = true;
    } else if (total == null && unit != null) {
      total = unit * qty;
    }
    if (unit == null || total == null) continue;
    if (!isValidPrice(unit) || !isValidPrice(total)) continue;

    if (calculated) {
      console.warn(`[scrape] unit_price_calculated=true (qty=${qty}, total=${total}) url=${urlForLog}`);
    }

    const prev = map.get(qty);
    if (!prev || prev.total_price > total) {
      map.set(qty, {
        quantity: qty,
        unit_price: Number(unit.toFixed(6)),
        unit_price_calculated: calculated,
        total_price: Number(total.toFixed(2)),
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.quantity - b.quantity);
}

// ---------------------------------------------------------------------
// Estratégia 1: API. Busca recursiva por chaves quantity/price em JSONs
// capturados via interceptador de respostas.
// ---------------------------------------------------------------------
const QTY_KEYS = /^(qtd|quantidade|quantity|qty|amount|qtde)$/i;
const PRICE_KEYS = /^(preco|price|total|valor|amount|unit|unitario|unitario_total)$/i;
const UNIT_KEYS = /^(unit|unitario|unit_price|preco_unitario|valor_unitario)$/i;
const TOTAL_KEYS = /^(total|preco_total|valor_total|preco|price)$/i;

function findTiersInJson(node) {
  const found = [];
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const it of n) walk(it);
      return;
    }
    const keys = Object.keys(n);
    let qtyKey = null;
    let unitKey = null;
    let totalKey = null;
    for (const k of keys) {
      if (!qtyKey && QTY_KEYS.test(k)) qtyKey = k;
      if (!unitKey && UNIT_KEYS.test(k)) unitKey = k;
      if (!totalKey && TOTAL_KEYS.test(k) && k !== unitKey) totalKey = k;
    }
    if (qtyKey && (unitKey || totalKey)) {
      const q = parseQty(n[qtyKey]);
      const unit = unitKey ? parsePriceBR(n[unitKey]) : null;
      const total = totalKey ? parsePriceBR(n[totalKey]) : null;
      if (isValidQty(q) && (unit || total)) {
        found.push({
          quantity: q,
          unit_price: unit || null,
          total_price: total || null,
        });
      }
    }
    for (const k of keys) walk(n[k]);
  };
  walk(node);
  return found;
}

// ---------------------------------------------------------------------
// Estratégia 2: HTML via Cheerio. Tenta tabelas, depois listas/containers.
// ---------------------------------------------------------------------
function extractFromTables($) {
  const out = [];
  $("table").each((_, table) => {
    $(table).find("tr").each((__, tr) => {
      const cells = $(tr).find("td,th").map((___, c) => $(c).text().trim()).get();
      if (cells.length < 2) return;
      // Heurística: 1 célula tem inteiro "puro" (qty), outra tem "R$..."
      let qty = 0;
      let total = 0;
      let unit = 0;
      for (const c of cells) {
        const intMatch = c.match(/^\s*(\d{1,3}(?:[.,]\d{3})+|\d{2,6})\s*(?:un|unidades?)?\s*$/i);
        if (intMatch && !qty) {
          qty = parseQty(intMatch[1]);
          continue;
        }
        const priceMatches = [...c.matchAll(/R\$\s*([\d.,]+)/gi)].map((m) => parsePriceBR(m[1]));
        if (priceMatches.length) {
          // Primeiro R$ assume total; se houver dois e segundo for menor, segundo = unit.
          const sorted = priceMatches.sort((a, b) => a - b);
          if (!total) total = sorted[sorted.length - 1];
          if (priceMatches.length > 1 && !unit) unit = sorted[0];
        }
      }
      if (qty && (total || unit)) {
        out.push({ quantity: qty, total_price: total || null, unit_price: unit || null });
      }
    });
  });
  return out;
}

function extractFromLists($) {
  const out = [];
  const selectors = [
    "ul li",
    "[class*='preco']",
    "[class*='price']",
    "[class*='tier']",
    "[class*='quantidade']",
  ];
  $(selectors.join(",")).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!text || text.length > 400) return;
    const qtyMatch = text.match(/(\d{1,3}(?:[.,]\d{3})+|\d{2,6})\s*(?:un|unidades?|x)?/i);
    const priceMatch = text.match(/R\$\s*([\d.,]+)/i);
    if (qtyMatch && priceMatch) {
      const qty = parseQty(qtyMatch[1]);
      const price = parsePriceBR(priceMatch[1]);
      if (isValidQty(qty) && isValidPrice(price)) {
        out.push({ quantity: qty, total_price: price, unit_price: null });
      }
    }
  });
  return out;
}

// ---------------------------------------------------------------------
// Estratégia 3: regex em texto livre (último recurso).
// ---------------------------------------------------------------------
function extractByRegex(html) {
  const out = [];
  const rx = /(\d{1,3}(?:[.,]\d{3})+|\d{2,6})[\s\S]{0,200}?R\$\s*([\d.,]+)/gi;
  let m;
  while ((m = rx.exec(html)) !== null) {
    const qty = parseQty(m[1]);
    const price = parsePriceBR(m[2]);
    if (isValidQty(qty) && isValidPrice(price)) {
      out.push({ quantity: qty, total_price: price, unit_price: null });
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Scraping principal de uma URL (Playwright + estratégias).
// ---------------------------------------------------------------------
async function scrapeOne(browser, url) {
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 900 },
    locale: "pt-BR",
  });
  const page = await ctx.newPage();

  const jsonBuffer = [];
  page.on("response", async (resp) => {
    try {
      const req = resp.request();
      const rt = req.resourceType();
      if (rt !== "xhr" && rt !== "fetch") return;
      const ct = (resp.headers()["content-type"] || "").toLowerCase();
      if (!ct.includes("application/json")) return;
      const body = await resp.json().catch(() => null);
      if (body) jsonBuffer.push(body);
    } catch { /* ignore */ }
  });

  try {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    } catch {
      // se networkidle estourar, ainda tenta extrair o que tiver
    }

    // Estratégia 1: API
    let apiTiers = [];
    for (const j of jsonBuffer) {
      const found = findTiersInJson(j);
      if (found.length) apiTiers.push(...found);
    }
    if (apiTiers.length >= 2) {
      const prices = finalizeTiers(apiTiers, url);
      if (prices.length >= 2) {
        return { strategy: "api", prices };
      }
    }

    // Pequena rolagem para forçar lazy-render antes de pegar HTML
    try {
      await page.evaluate(() => window.scrollBy(0, 1500));
      await page.waitForTimeout(600);
    } catch { /* ignore */ }

    const html = await page.content();
    const $ = cheerio.load(html);

    // Estratégia 2a: tabelas
    let htmlTiers = extractFromTables($);
    if (htmlTiers.length >= 2) {
      const prices = finalizeTiers(htmlTiers, url);
      if (prices.length >= 2) return { strategy: "html", prices };
    }

    // Estratégia 2b: listas/containers
    htmlTiers = extractFromLists($);
    if (htmlTiers.length >= 2) {
      const prices = finalizeTiers(htmlTiers, url);
      if (prices.length >= 2) return { strategy: "html", prices };
    }

    // Estratégia 3: regex (fallback)
    console.warn(`[scrape] FALLBACK html-regex acionado url=${url}`);
    const regexTiers = extractByRegex(html);
    const prices = finalizeTiers(regexTiers, url);
    return { strategy: "html-regex", prices };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// Wrapper com retry (3 tentativas, 2s delay) por URL.
async function scrapeWithRetry(browser, url) {
  const startedAt = Date.now();
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await scrapeOne(browser, url);
      return {
        source_url: url,
        scraped_at: new Date().toISOString(),
        strategy: r.strategy,
        prices: r.prices,
        error: r.prices.length ? null : "nenhum tier encontrado",
        elapsed_ms: Date.now() - startedAt,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      console.error(`[scrape] tentativa ${attempt}/3 falhou url=${url} msg=${lastErr}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return {
    source_url: url,
    scraped_at: new Date().toISOString(),
    strategy: "html",
    prices: [],
    error: lastErr || "falha desconhecida",
    elapsed_ms: Date.now() - startedAt,
  };
}

// API exportada (também usada por cli.js)
async function scrapeMany(urls) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const results = [];
    for (const url of urls) {
      const r = await scrapeWithRetry(browser, url);
      results.push(r);
    }
    // Console summary
    console.table(results.map((r) => ({
      url: r.source_url.slice(0, 70),
      tiers: r.prices.length,
      strategy: r.strategy,
      calculated: r.prices.some((p) => p.unit_price_calculated),
      timestamp: r.scraped_at,
    })));
    return results;
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { scrapeMany };

// ---------------------------------------------------------------------
// HTTP routes
// ---------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.post("/scrape", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!WORKER_SECRET || token !== WORKER_SECRET) {
    return res.status(401).json({ error: "unauthorized", results: [] });
  }
  const { urls } = req.body || {};
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "urls (array) obrigatório", results: [] });
  }
  const cleanUrls = urls.filter((u) => typeof u === "string" && /^https?:\/\//i.test(u));
  if (!cleanUrls.length) {
    return res.status(400).json({ error: "nenhuma URL válida", results: [] });
  }
  try {
    const results = await scrapeMany(cleanUrls);
    return res.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[scrape] erro fatal msg=${msg}`);
    return res.status(500).json({ error: msg, results: [] });
  }
});

// Só sobe servidor se invocado diretamente (não em require do cli.js)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[scraper-worker] escutando na porta ${PORT}`);
  });
}
