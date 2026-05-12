## Causa

Há **duas fontes da verdade** para o "Valor a cobrar":

| Onde | Fórmula | Resultado |
|---|---|---|
| Card "Valor a cobrar (base)" + rodapé "Salvar" + cabeçalho | `discountedTotal` = `live.totalToCharge + cvTotal` (engine) | **R$ 2.555,42** ✅ |
| `StickyFinancialSidebar` (DRE) | `itemsRevenueGross = Σ (m.unitPrice × m.quantity) + cvTotal + extras + frete` | **R$ 2.550,00** ❌ |

A sidebar foi escrita com um comentário antigo: *"não usar live.totalToCharge, que reprecifica via engine com qty=1 e infla com markup de faixa baixa"*. Esse risco era do mundo só-tier; agora o motor (após o fix de apostilas) é a fonte correta — `Σ unitPrice × quantity` ignora a marcação proporcional aplicada aos filhos via divisor (capa/contracapa/acabamentos), gerando os ~R$ 5,42 a menos.

## Correção (frontend, em `NewQuoteFormV2.tsx`)

Substituir o cálculo local da sidebar por `subtotalBeforeDiscount` / `discountedTotal` que já alimentam o card e o rodapé.

**No bloco `{isAdmin && (...)} `** (linhas ~1591-1655):

- `itemsRevenueGross`  →  `subtotalBeforeDiscount` (= `live.totalToCharge + cvTotal`, já inclui hiddenExtras + freight via engine)
- `proposalTotal`      →  `discountedTotal` (mesma fórmula de desconto já aplicada)
- Manter `approvedRevenue` como está (soma de itens com `status === "aprovado"` usando `unitPrice × quantity` ou `approvedValue`).
- Para `productionCost`, manter `live.costsBeforeMarkup + live.printingTotal + cvCostTotal` — só remover do printingTotal a parcela de venda que não é custo (já é assim hoje, ok).
- Recalcular `revenueBase = hasApproved ? approvedRevenue : proposalTotal` — sem mudança estrutural, só a base nova.
- Remover o comentário obsoleto sobre "qty=1 / faixa baixa".

Resultado: sidebar passa a exibir R$ 2.555,42, idêntico ao card e ao rodapé "Salvar".

## Arredondamento

Não há `Math.round` forçando para baixo no caminho de exibição — o "R$ 2.550,00" vinha da fonte errada, não de truncamento. Após a unificação, a única arredondamento aplicada é o `roundUp5` do preço-base de impressão (já documentado), que continua produzindo R$ 5,10 por folha. Nenhum outro round-down é necessário.

## Validação

1. Apostila da imagem (500 folhas × R$ 5,10 + acabamentos): card, rodapé "Salvar", cabeçalho do orçamento e sidebar passam a exibir **R$ 2.555,42**.
2. Item tier clássico (panfleto 1.000 un): valor segue inalterado (engine já é coerente nesse caminho).
3. Aplicar desconto 10%: todos os locais devem mostrar o mesmo `discountedTotal` com desconto.
4. Item aprovado parcial: "Valor Aprovado" continua com a soma `approvedValue`/`unitPrice × quantity` (não mistura com proposalTotal).

## Escopo

- Único arquivo: `src/components/orcamentos-v2/NewQuoteFormV2.tsx`, dentro do `isAdmin && (...)`.
- Sem mudanças em `pricing.ts`, sem mudanças no componente `StickyFinancialSidebar` em si.
