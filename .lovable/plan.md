
## Diagnóstico do "preço errado"

Antes de qualquer mudança na fórmula, você mesmo pediu: **"mostra o detalhamento primeiro pra eu analisar"**. Faz sentido — abrindo a caixa-preta você consegue identificar exatamente onde o número está fugindo.

Pelo seu exemplo (TP4 = R$ 5,00 por folha), o sistema chegou a R$ 5,10 por folha, ou seja, está só ~2% acima do esperado. Provavelmente uma combinação de:
- arredondamento `roundUp5` (sobe pra próxima R$ 0,10)
- divisor de markup acumulando percentuais globais (impostos + perda + cobrança + margem) **em cima** do tier do printer

Como você ainda não confirmou se TP4 = R$ 5,00 já é o preço final de venda **ou** o custo antes do markup global, eu não vou tocar na fórmula nesse loop. Em vez disso, vou expor cada componente para você comparar com o esperado e me dizer o que ajustar depois.

## O que vai ser construído

### 1. Painel "Composição do preço" no item de impressão

Logo abaixo do bloco de cada item de impressão (e dos acabamentos), uma seção colapsável com:

```text
COMPOSIÇÃO — Apostilas A4 4x4 Sulfite 75g (1.100 folhas)
  Papel ............... 1.100 fls × R$ 0,06    R$    63,58
  Impressão ........... 2.200 cliques × R$ 0,80  R$ 1.752,52
    └ multiplicador F/V (×2) aplicado
  Custo bruto/folha ............. R$ 1,66    Total: R$ 1.816,10
  Markup tier ........ TP4 (qty 1.000+)        R$ 3.793,90
    └ fixo 40% + variável 13% + margem 33% = 86%
    └ divisor 1−0,86 = 0,14
  Subtotal item ..................            R$ 5.610,00
```

Quando houver capa/contracapa, molinha, furação, mão de obra → cada um aparece como linha própria, somando ao subtotal do item. Atualiza em tempo real a cada mudança (papel, cor, quantidade, multiplicador).

### 2. Detalhamento global na barra lateral (abaixo de "VALOR A COBRAR")

Substituir/expandir o accordion atual da `StickyFinancialSidebar` para mostrar a composição agregada do orçamento inteiro:

```text
VALOR A COBRAR ............................. R$ 5.610,00

▼ Composição
  Impressão (1 item) ..................... R$ 5.610,00
  Capa & Contracapa ...................... R$     0,00
  Acabamentos / Encadernação ............. R$     0,00
  Mão de obra avulsa ..................... R$     0,00
  Terceirizados .......................... R$     0,00
  Frete .................................. R$     0,00
  ─────────────────────────────
  Custo bruto de produção ................ R$ 1.816,10
  (+) Impostos (10%) ..................... R$   561,00
  (+) Perda (5%) ......................... R$   280,50
  (+) Cobrança (7%) ...................... R$   392,70
  (+) Margem alvo (33%) .................. R$ 1.851,30
  (+) Markup tier do printer ............. R$   708,40
  ─────────────────────────────
  Total .................................. R$ 5.610,00
```

Os valores vêm dos hooks/cálculos que já existem (`PricingResult`, `computeTierUnitPrice`, `global_settings`) — só preciso expor cada parcela em vez de jogar tudo num divisor único.

### 3. Reatividade

Tudo é puro derivado de `useMemo` em cima do estado já existente (`materials`, `printingItems`, `globalSettings`, `markupTiers`). Não há leitura nova do banco — os custos unitários já estão no objeto `PricingMaterial` (`baseCost`, `paper_cost`, `printing_cost`, `printerCategoryId`, `markupGroupId`). Mudou qualquer parâmetro → recalcula sozinho.

## Detalhes técnicos

**Arquivos editados:**
- `src/components/orcamentos-v2/QuoteItemsTable.tsx` — adicionar `<PriceBreakdown>` colapsável dentro de `renderPrint()`.
- `src/components/orcamentos-v2/StickyFinancialSidebar.tsx` — nova prop `composition` com as parcelas; renderizar dentro do accordion.
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — montar e passar o objeto `composition` via `useMemo`.
- `src/lib/quotes-v2/pricing.ts` — expor função auxiliar `breakdownForQuantity(snap, qty)` que retorna `{ paperCost, printCost, finishingsCost, laborCost, thirdPartyCost, taxes, losses, collection, profit, tierMarkup }` por item e total.

**Componente novo:** `src/components/orcamentos-v2/PriceBreakdown.tsx` (apresentacional puro, recebe um objeto com as linhas e renderiza).

**O que NÃO está no escopo deste loop:**
- Mexer na fórmula de cálculo (sideMult, divisor, tier).
- Trocar a estratégia de tier (folhas vs. apostilas).
- Mudar o cadastro do catálogo.

Depois que você ver o detalhamento ao vivo e me disser onde está o desvio (ex: "o markup tier não devia somar com a margem de 33% global"), aí sim faço a correção da fórmula em um próximo loop, com base em dado concreto.
