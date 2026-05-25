## Problema

No card de um item do orçamento (ex.: Certificado R$ 7,40), o painel "Custos e Lucro" mostra:

```
Custo material           R$ 2,00
Custo perda (5%)         R$ 0,10   ← 5% de R$ 2,00 (custo)
Imposto (10%)            R$ 0,74   ← 10% de R$ 7,40 (preço de venda)
Taxa cartão / fatura (7%) R$ 0,52  ← 7%  de R$ 7,40 (preço de venda)
Preço de venda           R$ 7,40
Lucro líquido            R$ 4,04 · 54,6%
```

A linha "Custo perda" usa **custo** como base, enquanto imposto e taxa usam **preço de venda**. Resultado: o rótulo "(5%)" engana visualmente e o "Lucro líquido" residual fica inflado.

A fórmula canônica em `src/lib/quotes/pricing.ts` (`losses = valueWithMarkup * wastePct/100`) já trata perda como percentual do preço de venda — junto com imposto, taxa e lucro. O painel da `UnifiedCart` é o único ponto divergente.

## Correção

### Arquivo único: `src/components/orcamentos-v3/cart/UnifiedCart.tsx`

Em `buildFinancials` (~linha 195):

- Trocar `const perda = custo_total * (pcts.wastePct / 100);` por `const perda = preco_total * (pcts.wastePct / 100);`.
- Manter o cálculo de `lucro = preco_total - custo_total - perda - imposto - taxa` (agora consistente com a fórmula global; `lucro%` passará a refletir a margem líquida real).

Isso afeta tanto o painel por item quanto o agregado do carrinho (ambos usam `buildFinancials`).

## Fora de escopo

- `src/lib/kitPricing.ts` — usa um modelo diferente onde a perda entra **dentro** do custo antes do divisor (perda não está em `totalPct`). É internamente coerente e o preço final fecha; não tocar agora para não mexer no pricing dos kits.
- `src/lib/quotes/pricing.ts` — já está correto (`losses = valueWithMarkup * wastePct/100`).
- Nenhuma outra ocorrência foi encontrada no projeto (`rg waste_pct/100` mostra só os 3 pontos acima).

## Validação

Recalcular manualmente o exemplo do Certificado (preço R$ 7,40, custo R$ 2,00, imposto 10%, taxa 7%, perda 5%, margem 20%):

- Perda nova: 7,40 × 5% = **R$ 0,37**
- Imposto: 7,40 × 10% = R$ 0,74
- Taxa: 7,40 × 7% = R$ 0,52
- Lucro: 7,40 − 2,00 − 0,37 − 0,74 − 0,52 = **R$ 3,77** (≈ 50,9%, próximo da margem-alvo após acréscimo de custos não-impressão).
