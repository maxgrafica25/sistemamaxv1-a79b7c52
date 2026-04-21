

# Fix definitivo do scraper Imprima Rápido — 3 correções

## Diagnóstico

Logs confirmam:
- `[scrape-imprimarapido] tiers=0` → estratégia C escopada não matchou (seletores `span.radio_content`/`span.js-qtd-radio` não existem nessa página).
- Fallback para parser genérico capturou lixo (`tiers=10 strategy=html` com qty 1, 10, 21, 30, 40, 50, 100, 130 e preços absurdos como R$ 1,03 e R$ 20).
- `debugHtml(len)=4038` → o `div.js-quantity-container` **existe**, só não tem os spans esperados.

A captura visual do site real mostra a estrutura: `1.000 R$ 130,00`, `2.500 R$ 264,00`, … `100.000 R$ 6.428,00`. Estrutura de `<li>` com qty + preço lado a lado, mas as classes internas variam por template.

## Correções

### 1) Tornar a estratégia C robusta a variações de template

Em vez de depender de classes específicas (`span.radio_content`, `span.js-qtd-radio`), extrair **todo o textContent do `<li>`** e parsear via regex `qty + R$ preço`. Os números 1.000–100.000 e R$ XXX,XX estão sempre presentes no texto do li, independente do template.

```js
// C) Imprima Rápido: escopar ao js-quantity-container, parsear texto do li
const qtyContainer = document.querySelector('div.js-quantity-container, .js-quantity-container, [class*="quantity-container"]');
if (qtyContainer) {
  qtyContainer.querySelectorAll('li').forEach((li) => {
    const txt = (li.textContent || '').replace(/\\s+/g, ' ').trim();
    // qty: primeiro número (com . como milhar), tipicamente 1.000+
    const qtyMatch = txt.match(/(\\d{1,3}(?:\\.\\d{3})+|\\d{3,7})/);
    // preço: R$ XXX,XX
    const priceMatch = txt.match(/R\\$\\s*(\\d{1,3}(?:\\.\\d{3})*(?:,\\d{2})?)/);
    if (!qtyMatch || !priceMatch) return;
    const qty = parseQtyBR(qtyMatch[1]);
    const price = parsePriceBR(priceMatch[1]);
    if (qty && price && qty >= 100) tiers.push({ quantity: qty, total_price: price });
  });
}
```

Mudanças vs versão atual:
- Aceita variações do nome do container (com/sem `div`, com/sem prefixo).
- Lê `textContent` inteiro do `<li>` em vez de spans específicos.
- Filtra `qty >= 100` para evitar lixo (não há tier de Imprima Rápido com qty < 100).

### 2) **NÃO cair no parser genérico** quando `imprimarapido` retorna vazio

Esse é o bug crítico que gerou a tela atual. Em `scrapeOne` (linha 597-601), se o host é `imprimarapido.com.br` e a função especializada falhou, **retornar o resultado vazio com erro claro** em vez de tentar o parser genérico (que pega lixo de toda a página).

```ts
if (host.endsWith("imprimarapido.com.br")) {
  return await scrapeImprimaRapido(url, token);
  // NUNCA cair no genérico — gera tiers lixo
}
```

### 3) Manter `debugHtml` no response para próxima iteração

Se mesmo com a estratégia C robusta o resultado vier vazio (ex.: site mudou estrutura), o `debugHtml` no body do POST permite ver o HTML real sem truncamento de log. Já está implementado (linhas 487-495, 525). Manter.

## Validação

1. POST `/scrape-prices` com a URL do folder A6.
2. Esperar:
   - `prices.length === 9` (tiers 1.000, 2.500, 5.000, 10.000, 20.000, 30.000, 40.000, 50.000, 100.000).
   - Preços batendo com a tela: R$ 130, 264, 357, 663, 1.298, 1.932, 2.574, 3.215, 6.428.
   - `strategy: "function-imprimarapido"`.
3. Atual Card 1 URL → `function-atualcard` intacto, sem regressão.
4. Se ainda vazio → `debugHtml` no response permite ajuste cirúrgico.

## Risco

- Correção 1: isolada a `IMPRIMARAPIDO_FN_SOURCE` estratégia C. A/B/D intactas.
- Correção 2: isolada ao dispatcher `scrapeOne` para host `imprimarapido.com.br`. Atual Card e outros hosts intactos.
- Correção 3: já existe, sem mudança.
- Sem migration, sem schema.

## Fora de escopo

- Cleanup do `debugHtml` (ainda útil pra próxima iteração).
- Estratégias A/B/D do `IMPRIMARAPIDO_FN_SOURCE` (não mexem em nada).
- Parser genérico (`scrapeOne` extractFromTables/Lists/Regex) — funciona pra outros sites, não tocamos.

