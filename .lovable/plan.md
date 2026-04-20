

# Atual Card: extrair preço único + quantidade da URL

## Descoberta

A Atual Card **não tem tabela de tiers escalonados** por página. Cada URL representa um SKU específico para **uma quantidade fixa** que está codificada no próprio path:

```
.../flyer-couche-80g-4x0-sem-verniz-14x10-cm-1000-22533
                                            ^^^^  ^^^^^
                                            qty   sku_id
```

E o preço aparece em **dois lugares estáveis no HTML**, sem precisar de JS render:

1. No `dataLayer` do Google Tag Manager (mais confiável):
   ```js
   item_id: "22533", item_name: "Flyer", ..., price: 93.00, quantity: quantidade
   ```
2. Em `data-price="93.00"` num elemento renderizado.

Os preços dos templates Handlebars (`{{price}}`) são placeholders — o valor real (`93.00`) está hardcoded no script `dataLayer.push(...)` injetado no HTML.

## Estratégia nova para `scrapeAtualCard`

Não precisa mais do `/function` do Browserless. Volta a usar `/content` (mais barato e rápido), e extrai via regex:

1. **Quantidade** vem do path da URL: regex `/-(\d{2,7})-\d+\/?$/` no pathname → `1000`.
2. **Preço unitário total** vem do dataLayer: regex `/item_id:\s*"(\d+)"[^}]*?price:\s*([\d.]+)/` → `93.00`.
3. Calcula `unit_price = total_price / quantity` → `0.093`.
4. Devolve **um único tier** com `{ quantity: 1000, total_price: 93.00, unit_price: 0.093 }`.

Fallback se o dataLayer falhar:
- Procurar `data-price="(\d+\.\d{2})"` no HTML como segunda fonte.
- Se nada funcionar, retorna `error: "Preço não encontrado no HTML da Atual Card"`.

## Mudanças em `supabase/functions/scrape-prices/index.ts`

Substituir a função `scrapeAtualCard` atual (que usa `/function` e devolve 0 tiers) por uma versão simples baseada em `/content` + regex:

```ts
async function scrapeAtualCard(url: string, token: string): Promise<ScrapeResult> {
  const startedAt = Date.now();
  
  // 1) qty da URL
  const qtyMatch = new URL(url).pathname.match(/-(\d{2,7})-\d+\/?$/);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : null;
  
  if (!qty || !isValidQty(qty)) {
    return { ...empty, error: "Quantidade não detectada na URL da Atual Card" };
  }
  
  try {
    const html = await fetchRenderedHtml(url, token);
    
    // 2) preço do dataLayer (fonte primária)
    let total: number | null = null;
    const dlMatch = html.match(/item_id:\s*"\d+"[^}]*?price:\s*([\d.]+)/);
    if (dlMatch) total = parseFloat(dlMatch[1]);
    
    // 3) fallback: data-price=
    if (!total || total <= 0) {
      const dpMatch = html.match(/data-price="(\d+\.\d{1,2})"/);
      if (dpMatch) total = parseFloat(dpMatch[1]);
    }
    
    if (!total || !isValidPrice(total)) {
      return { ...empty, error: "Preço não encontrado no HTML da Atual Card" };
    }
    
    const prices = finalizeTiers([{ quantity: qty, total_price: total }], url);
    return { source_url: url, scraped_at: new Date().toISOString(), strategy: "function-atualcard", prices, error: null, elapsed_ms: Date.now() - startedAt };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }
}
```

A função `scrapeViaBrowserlessFunction` pode ficar no arquivo (sem uso ativo) ou ser removida — vou removê-la para manter o arquivo limpo.

## Comportamento observado pelo usuário

- Colar URL da Atual Card → resultado mostra **1 tier** (qty=1000, R$ 93,00, R$ 0,093/un).
- Estratégia continua aparecendo como `function-atualcard` (badge violeta — sem mudança no UI).
- Mais rápido (~1-2s em vez de ~12s) e sem chamar `/function`.
- ANS, FuturaIM, Imprima Rápido continuam usando o fluxo HTML padrão sem alteração.

## Arquivo afetado

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/scrape-prices/index.ts` (reescrever `scrapeAtualCard`, remover `scrapeViaBrowserlessFunction`) |

