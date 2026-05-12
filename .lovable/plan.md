## Escopo

Dois refinos visuais na sidebar/composição financeira (sem mudar o motor de preço):

1. **Processos de acabamento** passam a exibir **preço de venda unitário** (custo / divisor global) com tooltip explicativo.
2. **Lucro Líquido Estimado** vira uma linha destacada na `StickyFinancialSidebar`, com tooltip de DRE e visível só para admin.

---

## Parte 1 — Processos com preço de venda

### `src/components/orcamentos-v2/LaborAndSupplySubform.tsx`

- Adicionar props com pcts globais: `invoicePct`, `collectionPct`, `profitMarginPct`, `wastePct` (já vêm da mesma `settings` que alimenta o `pricing.ts`).
- Calcular por linha:
  ```
  totalPct       = invoicePct + collectionPct + profitMarginPct + wastePct
  displayDivisor = max(0.01, 1 − totalPct/100)
  sellingLabor   = ((timeMinutes/60) × hourlyRate) / displayDivisor
  ```
- Substituir o `formatBRL((l.timeMinutes/60) * hourlyRate)` (linha ~191) por `formatBRL(sellingLabor)`.
- Envolver o `<span>` em `<Tooltip>`:
  > "Valor de venda unitário (inclui mão de obra, impostos e margem)"

### Caller

`PrintingItemEditor` (e qualquer outro que monte o subform) passa os 4 pcts. Mesma fonte já consumida pelo motor.

### Card colapsado de processos (linhas com `~R$ ...`)

Localizar o componente que renderiza o resumo dos processos vinculados (ex: `Furação Encadernação Espiral · 5 min · ~R$ 4,25`). Aplicar a mesma fórmula de `sellingLabor` e remover o prefixo `~`. Mesmo tooltip.

> Sem arredondar por linha (regra de R$ 0,10 segue só no total).

---

## Parte 2 — Lucro Líquido Estimado (DRE)

### Motor — `src/lib/quotes-v2/pricing.ts`

O retorno final já expõe `totalToCharge`, `taxes`, `profit`. Vamos derivar custos reais a partir do `snap` (sem mudar fórmula de preço):

- `materialsCostReal` = Σ `m.quantity × m.unitPrice` para todos materiais não-opcionais (filhos + standalone).
- `laborCostReal` = Σ `(l.timeMinutes/60) × hourlyRate` para todos labor steps não-opcionais.
- `thirdPartyCostReal` = Σ `t.cost`.
- `cardFeesReal` = `valueWithMarkup × (collectionPct/100)`.
- `taxesReal` = `taxes` (já calculado).
- `netProfit` = `totalToCharge − materialsCostReal − laborCostReal − thirdPartyCostReal − taxesReal − cardFeesReal`.

Adicionar ao retorno: `materialsCostReal`, `laborCostReal`, `thirdPartyCostReal`, `cardFeesReal`, `netProfit`. (Manter `profit` antigo intocado para não quebrar consumidores.)

### `src/components/orcamentos-v2/StickyFinancialSidebar.tsx`

- Importar `useIsAdmin`.
- Renderizar **logo abaixo** da linha "Valor Total a Cobrar":
  - Label: "Lucro Líquido Estimado".
  - Valor: `netProfit`, classe `text-emerald-600` se ≥ 0, `text-destructive` se < 0; usar `font-semibold`.
  - Wrap em `<Tooltip>` com conteúdo:
    ```
    Faturamento Bruto:        R$ {totalToCharge}
    (−) Encargos:             R$ {taxesReal + cardFeesReal}
        ↳ Impostos:           R$ {taxesReal}
        ↳ Taxas de cartão:    R$ {cardFeesReal}
    (−) Custos de produção:   R$ {materialsCostReal + laborCostReal + thirdPartyCostReal}
        ↳ Materiais:          R$ {materialsCostReal}
        ↳ Mão de obra:        R$ {laborCostReal}
        ↳ Terceiros:          R$ {thirdPartyCostReal}  (oculto se 0)
    (=) Lucro Líquido:        R$ {netProfit}
    ```
- Toda a linha + tooltip dentro de `{isAdmin && (...)}` — colaboradores não veem.

---

## Fora do escopo

- `pricing.ts` não ganha nova lógica de preço; só campos derivados para exibição.
- Insumos/materiais — já têm exibição via `manual_tier`/`margemPct`.
- `mem://features/pricing` — atualizar com as duas novas regras de exibição depois que o usuário aprovar.

## Validação

- Apostila com 2 processos: somatório de processos exibidos + insumos + impressão deve aproximar o total da apostila (centavos de diferença OK).
- Hover em "Lucro Líquido": números do tooltip somam exatamente (Faturamento − Encargos − Custos = Lucro).
- Login como colaborador: linha de lucro não aparece.
- Login como admin: aparece com cor correta para casos positivos e negativos (testar desconto agressivo).
