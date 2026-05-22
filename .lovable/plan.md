## Objetivo

Quando o usuário expande "detalhes" de um item no carrinho do Orçamento V3, em vez (ou além) das infos atuais de configuração, mostrar a quebra financeira do item: custo do material, custo da mão de obra, custo de perda, imposto, taxa do cartão e **lucro líquido**.

## Escopo

- Apenas o painel expandido de cada item no carrinho (`UnifiedCart` → `SingleCard` / `BundleCard`).
- Sem mudanças em motor de preço, banco de dados ou no resumo financeiro do orçamento.
- Cabeçalho do item (título, subtítulo, total à direita) permanece igual.

## O que será exibido

Para cada item, calculado a partir do `preco_total` e `custo_total` (já produzidos por `priceOf`) + percentuais globais:

```
Custo material         R$ X,XX     (custo_total do item; para mão-de-obra vira "Custo MO")
Custo mão de obra      R$ X,XX     (somente itens "labor"; nos demais aparece "—" ou some)
Custo perda            R$ X,XX     (custo_total × waste_pct)
Imposto                R$ X,XX     (preco_total × tax_pct do orçamento)
Taxa cartão / fatura   R$ X,XX     (preco_total × fees_pct do orçamento)
─────────────────────
Preço de venda         R$ X,XX
Lucro líquido          R$ X,XX  (XX,X%)   ← colorido pelo semáforo de margem
```

Notas:
- Tributos/taxas/perda usam os mesmos percentuais já mostrados no Resumo Financeiro do orçamento — assim cada linha bate proporcionalmente com o total.
- Perda usa `waste_pct` do `useGlobalSettings` (não está no estado do orçamento).
- Lucro líquido = `preco_total − custo_total − perda − imposto − taxa`.
- Cor do lucro %: reaproveita `marginTextClass` de `src/lib/quotes-v2/margin.ts` (vermelho <15, amarelo 15-25, verde >25).

## Mudanças técnicas

**`src/components/orcamentos-v3/cart/UnifiedCart.tsx`**
- `Props`: aceitar `taxPct: number`, `feesPct: number`, `wastePct: number`.
- Repassar essas props para `SingleCard` e `BundleCard`.
- Nova função `itemFinancials(it, { taxPct, feesPct, wastePct })` que devolve as linhas acima.
- No painel expandido, substituir a lista atual de `itemDetails` por:
  1. Bloco compacto com 1–2 linhas de configuração essencial (papel/dimensão/quantidade — mantém contexto sem poluir).
  2. Bloco "Custos e lucro" com as linhas financeiras acima.
- Linha de "Lucro líquido" destacada (fonte semibold + cor do semáforo).

**`src/components/orcamentos-v3/NewQuoteFormV3.tsx`**
- Importar `useGlobalSettings` (se ainda não), pegar `waste_pct`.
- Passar `taxPct={state.tax_pct}`, `feesPct={state.fees_pct}`, `wastePct={settings.waste_pct}` ao `<UnifiedCart />`.

Nada mais é alterado.

## Fora de escopo

- Mudar como o preço é calculado.
- Editar percentuais a partir do card.
- Alterar o painel "Resumo financeiro" do orçamento.
- Itens agrupados por faixa (tier) — manter como hoje; a quebra financeira aparece somente no painel expandido de cards single/bundle (que é onde o usuário clicou no exemplo do print).
