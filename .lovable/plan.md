

# Opção A — Handler dedicado para `imprimarapido.com.br` (com waitForSelector)

## Mudanças em `supabase/functions/scrape-prices/index.ts`

### 1) Nova constante `IMPRIMARAPIDO_FN_SOURCE`

Função JS executada via Browserless `/function`. Substitui `waitForTimeout(2500)` por `waitForSelector` com fallback try/catch:

```js
module.exports = async ({ page, context }) => {
  await page.goto(context.url, { waitUntil: "networkidle2", timeout: 45000 });

  // Espera ativa: aparecer um indicador de tier renderizado.
  // Cobre os 3 padrões esperados: select de qty, [data-quantidade], radio de qty.
  const tierSelector = [
    'select[name*="quant" i] option[value]:not([value=""])',
    'select[name*="qtd" i] option[value]:not([value=""])',
    '[data-quantidade]',
    '[data-qtd]',
    '[data-quantity]',
    'input[type="radio"][name*="quant" i]',
    'input[type="radio"][name*="qtd" i]',
  ].join(", ");

  try {
    await page.waitForSelector(tierSelector, { timeout: 8000 });
  } catch {
    // não achou nada em 8s — segue mesmo assim; estratégias abaixo podem
    // pegar dataLayer ou retornar vazio (fallback genérico no dispatcher).
  }

  const data = await page.evaluate(() => {
    const parsePriceBR = (s) => {
      const m = String(s).replace(/\s|\u00a0/g, "").match(/(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/);
      if (!m) return null;
      const n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      return isFinite(n) && n > 0 ? n : null;
    };
    const parseQtyBR = (s) => {
      const m = String(s).replace(/\s|\u00a0/g, "").match(/(\d{1,3}(?:\.\d{3})+|\d{2,7})/);
      if (!m) return null;
      const n = parseInt(m[1].replace(/\./g, ""), 10);
      return isFinite(n) && n >= 10 && n <= 1_000_000 ? n : null;
    };

    const tiers = [];

    // A) <select><option> com qty no value/texto e preço em data-attr ou texto
    document.querySelectorAll("select option").forEach((opt) => {
      const txt = (opt.textContent || "").trim();
      const qty = parseQtyBR(opt.value) ?? parseQtyBR(txt);
      const priceAttr = opt.getAttribute("data-preco") || opt.getAttribute("data-price") || opt.getAttribute("data-valor");
      const price = priceAttr ? parsePriceBR(priceAttr) : (txt.includes("R$") ? parsePriceBR(txt.split("R$")[1]) : null);
      if (qty && price) tiers.push({ quantity: qty, total_price: price });
    });

    // B) [data-quantidade] / [data-qtd] / [data-quantity]
    document.querySelectorAll("[data-quantidade], [data-qtd], [data-quantity]").forEach((el) => {
      const qty = parseQtyBR(el.getAttribute("data-quantidade") || el.getAttribute("data-qtd") || el.getAttribute("data-quantity"));
      const price = parsePriceBR(el.getAttribute("data-preco") || el.getAttribute("data-price") || el.getAttribute("data-valor") || el.textContent || "");
      if (qty && price) tiers.push({ quantity: qty, total_price: price });
    });

    // C) Radios de quantidade + label próximo com preço
    document.querySelectorAll('input[type="radio"][name*="quant" i], input[type="radio"][name*="qtd" i]').forEach((r) => {
      const qty = parseQtyBR(r.value);
      const label = r.closest("label") || document.querySelector(`label[for="${r.id}"]`);
      const price = label ? parsePriceBR(label.textContent || "") : null;
      if (qty && price) tiers.push({ quantity: qty, total_price: price });
    });

    // D) dataLayer (GTM) — último recurso
    try {
      const dl = (window.dataLayer || []).flatMap(o => o?.ecommerce?.detail?.products || o?.ecommerce?.items || []);
      dl.forEach((p) => {
        const qty = parseQtyBR(p.quantity || p.variant);
        const price = parsePriceBR(p.price);
        if (qty && price) tiers.push({ quantity: qty, total_price: price });
      });
    } catch {}

    return { tiers };
  });

  return { data, type: "application/json" };
};
```

### 2) Nova função `scrapeImprimaRapido(url, token)`

Espelha `scrapeAtualCard`: chama `fetchViaBrowserlessFunction(url, token, IMPRIMARAPIDO_FN_SOURCE)`, passa o array de tiers brutos por `finalizeTiers` (mesma validação do resto do projeto), retorna `ScrapeResult` com `strategy: "function-imprimarapido"`. Em caso de erro do Browserless ou `tiers.length === 0`, **retorna ScrapeResult vazio** — o dispatcher faz fallback.

### 3) Branch no dispatcher `scrapeOne` (~linha 459)

```ts
if (host.endsWith("imprimarapido.com.br")) {
  const r = await scrapeImprimaRapido(url, token);
  if (r.prices.length > 0) return r;
  // se vazio, cai no parser genérico abaixo
}
```

### 4) Badge no `NovoSiteDialog.tsx` (cosmético)

Adicionar entrada no mapa `strategyBadge` (linha ~60):
```ts
"function-imprimarapido": { label: "function", cls: "bg-violet-100 text-violet-800 ..." }
```

## Validação pós-deploy

1. `supabase--curl_edge_functions` POST `/scrape-prices` com a URL do folder A6 que falhou hoje → esperar `prices.length > 0` + `strategy: "function-imprimarapido"`.
2. Mesma chamada com 1 URL do Atual Card → confirmar `strategy: "function-atualcard"` (zero regressão).
3. `supabase--edge_function_logs scrape-prices` → confirmar tempo total <15s (8s de waitForSelector no pior caso + render).

## Risco

- **Isolamento total** ao host `imprimarapido.com.br`.
- **Fallback duplo:** waitForSelector com try/catch + fallback do dispatcher pro parser genérico.
- **Sem migration, sem mudança de schema.**

## Fora de escopo

- Não refatoro `ATUALCARD_FN_SOURCE` para extrair helpers compartilhados.
- Não adiciono testes (runtime remoto Browserless, mock seria frágil).
- Se a URL exigir clique em variação antes de renderizar tiers, trato como follow-up só se a validação 1 falhar.

