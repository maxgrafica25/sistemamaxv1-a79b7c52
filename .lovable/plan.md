## Objetivo

Restringir os blocos de custo/lucro do **Resumo Financeiro** a administradores e ajustar o DRE para refletir o cálculo reverso pedido, sem tocar no `pricing.ts`.

## Arquivo afetado

`src/components/orcamentos-v2/StickyFinancialSidebar.tsx` (único arquivo). `PriceBreakdown.tsx` continua exibindo apenas a "Composição do preço" com preços de venda — já é seguro para operadores comuns.

## Mudanças

### 1. Gate de role (RBAC)

- Já existe `useIsAdmin()` importado no arquivo.
- Envolver com `{isAdmin && (...)}`:
  - O `<Accordion>` "Ver detalhamento de custos e lucro" (linhas ~76-117).
  - O card inferior "Lucro Líquido Estimado" (linhas ~159-217) — já está gated, manter.
- Operador comum verá apenas: Valor da Proposta, Valor Aprovado, Composição do preço, Valor a cobrar.

### 2. DRE reverso (somente admin)

Reescrever o conteúdo do accordion para a ordem exata pedida, partindo do **Valor Total** e revelando o **Custo Bruto** como linha derivada:

```text
Valor Total da Venda                  R$ X
(-) Impostos (X%)                     R$ X
(-) Taxas de Venda/Cartão (X%)        R$ X
(-) Margem de Perda (X%)              R$ X
─────────────────────────────────────
(=) Custo Bruto de Produção           R$ X     ← productionCost (já vem como prop)
(=) Lucro Líquido                     R$ X     (Y,Y%)
```

- Todos os valores já chegam como props (`revenueBase`, `taxValue`, `taxPct`, `billingValue`, `billingPct`, `lossValue`, `lossPct`, `productionCost`, `netProfit`, `netMarginPct`). Nenhuma chamada ao engine.
- Label de "Cobrança" passa a ser "Taxas de Venda/Cartão" (mantendo o método entre parênteses se existir).
- Remover a linha redundante "Receita base" no topo (já aparece como "Valor da Proposta" acima do accordion) — substituir por "Valor Total da Venda" só dentro do DRE para deixar a conta clara.

### 3. Lucratividade no card inferior

No card "Lucro Líquido Estimado" (já admin-only), exibir o valor com a `%` ao lado:

```text
Lucro Líquido Estimado     R$ 328,76 (9,0%)
```

- Reaproveitar `formatPct(netMarginPct)` já existente no arquivo.
- Cor da % acompanha a cor do valor (emerald/destructive).

## Fora do escopo

- `pricing.ts`, schema de banco, RLS, edge functions.
- `PriceBreakdown.tsx` (continua público — só mostra preços de venda, sem custo).
- Tooltip detalhado já existente no card de Lucro: mantido como está.
