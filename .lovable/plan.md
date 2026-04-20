

# Corrigir parser de quantidade BR + filtrar seção Quantidade

Os logs mostram `counts={"table":0,"radio":0,"dataAttr":0,"list":12}`. Tudo veio do varrimento genérico de `ul li / [class*="preco"]`, que:

1. Pegou "R$ 20,00" da seção de **Acabamentos Opcionais** como se fosse tier (qty=1, total=20).
2. Leu "1.000" como `1`, "10.000" como `10`, "100.000" como `100`, etc., porque o `parseQty` faz `replace(/\./g, '')` mas a regex `(\d{2,7})` captura só o primeiro grupo de dígitos antes do ponto quando aplicada ao texto cru "1.000 unidades".

## Mudanças em `ATUALCARD_FN_SOURCE` (`supabase/functions/scrape-prices/index.ts`)

### 1) `parseQtyBR` que entende ponto como milhar

Substituir o `parseQty` interno do `page.evaluate` por uma versão que casa o **número inteiro com pontos de milhar** primeiro:

```js
const parseQtyBR = (raw) => {
  if (raw == null) return null;
  const s = String(raw);
  // Padrão BR: 1.000  10.000  100.000  1.000.000  ou simples 2500
  const m = s.match(/(\d{1,3}(?:\.\d{3})+|\d{2,7})/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/\./g, ''), 10);
  return isFinite(n) && n >= 100 ? n : null; // mínimo 100 evita "R$20"→20
};
```

Aplica-se a todos os pontos onde hoje se usa `parseQty` dentro do `page.evaluate`.

### 2) Restringir varrimento à seção "Quantidade"

Antes do loop de `ul li / [class*="preco"]`, localizar o **container da seção Quantidade** e só varrer dentro dele:

```js
// Encontra o título "Quantidade" e pega o container irmão/ancestral relevante
const findQuantidadeRoot = () => {
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,label,strong,legend,div'));
  for (const h of headings) {
    const t = (h.textContent || '').trim().toLowerCase();
    if (t === 'quantidade' || t.startsWith('quantidade ')) {
      // sobe até um container que contenha vários itens com R$
      let node = h;
      for (let i = 0; i < 5 && node; i++) {
        node = node.parentElement;
        if (node && (node.querySelectorAll('R$').length > 5 ||
            (node.textContent.match(/R\$/g) || []).length >= 5)) {
          return node;
        }
      }
    }
  }
  return null;
};
const qtyRoot = findQuantidadeRoot() || document;
```

Trocar `document.querySelectorAll('ul li, ol li, [class*="preco"], …')` por `qtyRoot.querySelectorAll(...)`. Isso elimina tiers fantasma vindos de Acabamentos, Serviços, Frete, etc.

### 3) Fortalecer o regex de quantidade no varrimento de listas

No loop de listas, trocar:

```js
const qm = txt.match(/(\d{2,7})\s*(?:un|unid|unidades|x|pç|pcs|peças)?/i);
```

por (BR-aware + exige unidade explícita ou ≥1000):

```js
const qm = txt.match(/(\d{1,3}(?:\.\d{3})+|\d{3,7})\s*(?:un|unid|unidades|x|pç|pcs|peças)?/i);
```

E após parsear `qty`, descartar valores < 100 e descartar tiers cujo `total < 1` (proteção extra).

### 4) Mesma correção nos demais blocos

Aplicar `parseQtyBR` também:
- no varrimento de `<table>` (caso a tabela JS de Atual Card use "1.000" no `td`).
- nos seletores de `input[type="radio"][name*="quant"]` (lê `value`/`data-quantidade`).
- nos `[data-quantidade]/[data-qtd]/[data-quantity]`.

### 5) Logar `counts` por seção e amostra dos 3 primeiros tiers

Manter `[atualcard /function] tiers=N counts=...` e adicionar um log com os 3 primeiros pares `(qty,total)` retornados, para validar rapidamente que vieram 1000/2500/5000... e não 1/2/5.

## O que não muda

- Fallback `scrapeAtualCardDataLayerFallback` continua igual (rede de segurança).
- `finalizeTiers`, dispatcher por host, demais fornecedores, UI e schema do banco intactos.
- `parsePriceBR` já trata corretamente `R$ 1.234,56` e não precisa mudar.

## Resultado esperado

Após o teste da URL do flyer 14×10 cm:

- Logs: `[atualcard /function] tiers=12 counts={"list":12}` (ou distribuído entre table/radio/list conforme o DOM).
- Banco: 12 tiers com quantidades **1.000, 2.500, 5.000, 10.000, 20.000, 30.000, 40.000, 50.000, 100.000, 250.000, 500.000, 1.000.000**.
- Sem mais "qty=1 total=20" (R$20 de Acabamentos sumiu).
- Sem mais quantidades quebradas (1, 10, 100, 250, 500 → viram 1.000, 10.000, 100.000, 250.000, 500.000).

## Arquivo afetado

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/scrape-prices/index.ts` (substituir `parseQty` por `parseQtyBR` em `ATUALCARD_FN_SOURCE`; adicionar `findQuantidadeRoot` para escopar varrimento; ajustar regex BR de qty no loop de listas; log de amostra dos primeiros tiers) |

