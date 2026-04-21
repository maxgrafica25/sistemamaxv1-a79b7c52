

# Resposta + fix do try/catch que ainda silencia

## Resposta direta

**Você tem razão — o catch ainda silencia.** O código atual (linhas 590-604) é:

```ts
async function scrapeOne(url, token) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "atualcard.com.br") {
      return await scrapeAtualCard(url, token);
    }
    if (host.endsWith("imprimarapido.com.br")) {
      return await scrapeImprimaRapido(url, token);  // ← se ISSO lançar
    }
  } catch (_) {
    // URL inválida cai no fluxo padrão               // ← cai AQUI silenciado
  }
  // …e segue pro parser genérico abaixo               // ← parser genérico roda!
}
```

Hoje `scrapeImprimaRapido` tem seu próprio `try/catch` interno (linhas 511-539) e **sempre retorna** um `ScrapeResult` (com `error` preenchido em caso de falha) — então na prática não lança. Mas o `catch (_)` externo é uma **bomba-relógio**: qualquer exceção futura (ex.: bug no `finalizeTiers`, erro no `URL()`, mudança no `scrapeImprimaRapido`) vai cair no genérico silenciosamente e gerar exatamente o lixo que você viu.

## Fix

Reestruturar `scrapeOne` para que o dispatcher de host fique **fora** do try/catch da URL parsing. URL inválida é o ÚNICO caso que precisa de catch — e mesmo assim deve retornar erro, não cair no genérico.

```ts
async function scrapeOne(url, token) {
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

  // 2) Dispatcher por host — SEM try/catch externo
  if (host === "atualcard.com.br" || host.endsWith(".atualcard.com.br")) {
    return await scrapeAtualCard(url, token);
  }
  if (host === "imprimarapido.com.br" || host.endsWith(".imprimarapido.com.br")) {
    return await scrapeImprimaRapido(url, token);
    // ↑ scrapeImprimaRapido NUNCA lança (catch interno).
    //   Mesmo se lançasse, não há catch aqui — propaga pro handler HTTP.
    //   NUNCA cai no genérico abaixo.
  }

  // 3) Genérico — só para hosts não-especializados
  const startedAt = Date.now();
  // … resto igual …
}
```

Mudanças vs atual:
- Try/catch isolado **só** ao `new URL()`. Se falhar, retorna erro imediato.
- Dispatcher de host fica fora de qualquer try/catch — impossível cair no genérico.
- Se `scrapeImprimaRapido` algum dia lançar (regressão futura), o erro propaga pro handler HTTP do Deno (que já trata e retorna 500 com JSON), em vez de ser silenciado.

## Validação

1. URL Imprima Rápido normal → `function-imprimarapido` com 9 tiers.
2. URL Imprima Rápido inválida (ex.: 404) → `function-imprimarapido` com `prices: []` e `error` preenchido. **Nunca** strategy `html` ou `html-regex`.
3. URL malformada (`htp://x`) → erro "URL inválida" imediato, sem rodar genérico.
4. URL Atual Card → `function-atualcard` intacto.
5. URL de outro host (genérico) → segue funcionando como antes.

## Risco

- Isolado a `scrapeOne`. `scrapeImprimaRapido`/`scrapeAtualCard`/parser genérico intactos.
- Sem migration, sem schema.

## Fora de escopo

- Bug 2 (estratégia C com regex no textContent) — já aprovado, será aplicado junto.
- Estratégias A/B/D do `IMPRIMARAPIDO_FN_SOURCE`.
- Outros scrapers.

