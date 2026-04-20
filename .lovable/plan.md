

# Estratégia específica para `atualcard.com.br` via Browserless `/function`

O site da Atual Card carrega a tabela de preços via JavaScript após o `networkidle2`, então o `/content` (que devolve só o HTML inicial) não enxerga os tiers. A solução é usar o endpoint `/function` do Browserless, que roda JS remoto dentro da página e devolve o resultado já extraído.

## Como funciona

```text
URL recebida
  ↓
host = atualcard.com.br?  ──sim──→  scrapeAtualCard(url) via /function
  ↓ não
fluxo atual (/content + Cheerio)
```

O dispatcher fica no início do `scrapeOne`. Tudo que já funciona pra ANS e FuturaIM **não muda**.

## Mudanças em `supabase/functions/scrape-prices/index.ts`

### 1) Novo helper `scrapeViaBrowserlessFunction`

Chama `POST https://production-sfo.browserless.io/function?token=...` com um payload `{ code, context }`. O `code` é uma função JS executada no contexto da página (já com `page` do Puppeteer disponível). Retorna `{ data, type }` onde `data` é o JSON que a função devolveu.

### 2) Função específica `scrapeAtualCard(url)`

Roda no Browserless:

```js
// pseudocódigo do que vai dentro do /function
export default async ({ page }) => {
  await page.goto(context.url, { waitUntil: 'networkidle2', timeout: 30000 });
  // espera a tabela de preços renderizar
  await page.waitForSelector('table, [class*="preco"], [class*="tier"]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000); // garante render de JS tardio
  // extrai linhas da tabela com qty + preços
  const rows = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('table tr').forEach(tr => {
      const cells = [...tr.querySelectorAll('td,th')].map(c => c.innerText.trim());
      if (cells.length >= 2) out.push(cells);
    });
    return out;
  });
  return { data: rows, type: 'application/json' };
};
```

Devolve as linhas cruas. Em seguida, no Deno, passa pelo mesmo `parsePriceBR` / `parseQty` / `finalizeTiers` já existentes para virar `Price[]`. Reaproveita 100% da normalização BR.

Se mesmo assim vier vazio, faz fallback final com `extractByRegex` no HTML completo (também obtido via `/function` retornando `document.documentElement.outerHTML`).

### 3) Dispatcher em `scrapeOne`

No topo do `scrapeOne(url, token)`:

```ts
const host = new URL(url).hostname.replace(/^www\./, '');
if (host === 'atualcard.com.br') {
  return await scrapeAtualCard(url, token);
}
// ... fluxo atual intacto
```

`scrapeAtualCard` retorna o mesmo shape `ScrapeResult` (com `strategy: "function-atualcard"` adicionado ao tipo).

### 4) Ajuste mínimo no tipo `strategy`

```ts
strategy: "html" | "html-regex" | "function-atualcard"
```

Sem impacto na UI — `NovoSiteDialog` já mostra `strategy` como string genérica.

## O que NÃO muda

- Lógica de extração para ANS, FuturaIM e qualquer outro domínio.
- `extractFromTables`, `extractFromLists`, `extractByRegex`, `finalizeTiers`, `parsePriceBR`.
- Modo PERSISTÊNCIA, modo PREVIEW, retries, mensagens de erro HTTP.
- `NovoSiteDialog.tsx`, schema, `Monitoramento.tsx`.

## Custo Browserless

`/function` consome o mesmo crédito que `/content` (1 unit por execução). Sem mudança de plano.

## Resultado esperado

- Colar URL da Atual Card + URL da FuturaIM no mesmo campo: ambas retornam tiers.
- Logs vão mostrar `strategy=function-atualcard` para Atual Card e `strategy=html` para os outros.
- Se Atual Card mudar o HTML/JS no futuro, a função específica pode ser ajustada sem mexer no resto.

## Arquivo afetado

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/scrape-prices/index.ts` (adicionar `scrapeViaBrowserlessFunction`, `scrapeAtualCard`, dispatcher por host) |

