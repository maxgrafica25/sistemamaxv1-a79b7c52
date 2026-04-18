// Worker Playwright para extrair tiers de preço (quantidade × preço total)
// Usado para PWAs onde o Firecrawl não consegue renderizar o DOM (ex.: Imprima Rápido, Atual Card).

const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = parseInt(process.env.PORT || "3000", 10);
const WORKER_SECRET = process.env.WORKER_SECRET || "";

if (!WORKER_SECRET) {
  console.warn("[scraper-worker] WORKER_SECRET não definido — todas as chamadas serão rejeitadas.");
}

// ---------- Helpers ----------
function parseQty(s) {
  return parseInt(String(s).replace(/[.\s]/g, ""), 10) || 0;
}

function parsePrice(s) {
  let clean = String(s).trim().replace(/R\$\s*/i, "");
  if (/,\d{1,2}$/.test(clean)) {
    // formato brasileiro: 1.234,56
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else {
    clean = clean.replace(/,/g, "");
  }
  return parseFloat(clean) || 0;
}

function extractTiers(html) {
  const out = [];
  // Padrão: "1.000 ... R$ 251,00" (até 200 chars de distância)
  const rx = /(\d{1,3}(?:[.,]\d{3})+|\d{2,6})[\s\S]{0,200}?R\$\s*([\d.,]+)/gi;
  let m;
  while ((m = rx.exec(html)) !== null) {
    const quantidade = parseQty(m[1]);
    const preco = parsePrice(m[2]);
    if (
      quantidade >= 50 &&
      quantidade <= 100000 &&
      preco >= 1 &&
      preco <= 100000
    ) {
      out.push({ quantidade, preco });
    }
  }
  // Dedupe por quantidade — manter menor preço
  const map = new Map();
  for (const t of out) {
    if (!map.has(t.quantidade) || map.get(t.quantidade).preco > t.preco) {
      map.set(t.quantidade, t);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.quantidade - b.quantidade);
}

// ---------- Routes ----------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.post("/scrape", async (req, res) => {
  // Auth
  const auth = req.headers.authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!WORKER_SECRET || token !== WORKER_SECRET) {
    return res.status(401).json({ error: "unauthorized", tiers: [] });
  }

  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url obrigatória", tiers: [] });
  }

  let browser;
  const startedAt = Date.now();
  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 900 },
      locale: "pt-BR",
    });
    const page = await ctx.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Aguarda hidratação real: precisa aparecer "R$" no DOM
    try {
      await page.waitForFunction(
        () => document.body && document.body.innerText.includes("R$"),
        { timeout: 25000 }
      );
    } catch {
      // segue mesmo sem R$, vai falhar na regex e devolver vazio
    }

    // Pequena rolagem para forçar lazy-render
    try {
      await page.evaluate(() => window.scrollBy(0, 1500));
      await page.waitForTimeout(800);
    } catch { /* ignore */ }

    const html = await page.content();
    const tiers = extractTiers(html);
    const elapsedMs = Date.now() - startedAt;

    console.log(`[scrape] url=${url} tiers=${tiers.length} elapsed=${elapsedMs}ms`);

    if (!tiers.length) {
      return res.json({
        error: "nenhuma faixa de preço encontrada",
        tiers: [],
        scraped_at: new Date().toISOString(),
        elapsed_ms: elapsedMs,
      });
    }

    return res.json({
      tiers,
      scraped_at: new Date().toISOString(),
      elapsed_ms: elapsedMs,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[scrape] erro url=${url} msg=${msg}`);
    return res.status(200).json({ error: msg, tiers: [] });
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
});

app.listen(PORT, () => {
  console.log(`[scraper-worker] escutando na porta ${PORT}`);
});
