## Objetivo

Tiers Manuais por Suprimento, com **preço final ao cliente** travado: o `manual_price` cadastrado é exatamente o que o cliente vê (espelha a tabela do Tiny ERP). Demais regras (`margem_pct`, modo tier clássico) permanecem inalteradas.

---

## 1. Banco de Dados

Nova tabela `supply_pricing_tiers`:

```sql
CREATE TABLE public.supply_pricing_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_id uuid NOT NULL REFERENCES public.supplies(id) ON DELETE CASCADE,
  label text NOT NULL,
  min_qty integer NOT NULL CHECK (min_qty >= 1),
  max_qty integer CHECK (max_qty IS NULL OR max_qty >= min_qty),
  manual_price numeric NOT NULL CHECK (manual_price >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.supply_pricing_tiers (supply_id, min_qty);
ALTER TABLE public.supply_pricing_tiers ENABLE ROW LEVEL SECURITY;
```

RLS: read `authenticated`, write admin (mesmo padrão de `finishing_price_tiers`). Trigger anti-sobreposição entre faixas do mesmo `supply_id`.

---

## 2. Helper (`src/lib/quotes-v2/supply-pricing.ts`)

```ts
export interface SupplyTier { id; supply_id; min_qty; max_qty; manual_price; label; }
export function pickSupplyTier(tiers, qty): SupplyTier | null
```

---

## 3. Snapshot

- `PricingMaterial` ganha `pricingTiers?: SupplyTier[] | null`.
- `SupplySearch.tsx` e `LoadFromGroupDialog.tsx` carregam `supply_pricing_tiers` junto com o suprimento.
- `NewQuoteFormV2.tsx` propaga no snapshot. Tiers resolvidas em runtime; orçamentos aprovados continuam congelados via `approved_value`.

---

## 4. Motor de Preço — **Tier manual = preço final ao cliente**

No ramo `isDirectSumItem`:

```ts
const tier = cm.pricingTiers ? pickSupplyTier(cm.pricingTiers, cm.quantity) : null;

if (tier) {
  // manual_price JÁ é o preço final (impostos + cartão embutidos).
  // Engenharia reversa: removemos o custo de venda para somar com os
  // demais filhos no subtotal pré-divisor.
  const finalUnit   = tier.manual_price;
  const preDivUnit  = finalUnit * salesCostDivisor; // divisor < 1
  rows.push({
    ...,
    priceSource: "manual_tier",
    tierLabel: tier.label,
    vendaUnit: preDivUnit,           // entra no subtotal pré-divisor
    finalUnitLocked: finalUnit,      // referência exibida na UI
  });
} else {
  const vendaUnit = cm.unitPrice * (1 + (cm.margemPct ?? 0) / 100);
  rows.push({ ..., priceSource: "margin", vendaUnit });
}
```

Onde `salesCostDivisor = 1 - (impostos% + cartão%) / 100` (já existe nas configurações).

Resultado: ao multiplicar de volta pelo divisor no final do cálculo do item, o componente do filho com tier volta a `tier.manual_price` exato. Ou seja, o cliente vê **R$ 7,50** quando cadastrei R$ 7,50, independentemente das alíquotas.

Aplicar em `recalculateForQuantity` e `breakdownForQuantity`. `DirectSumChildRow` ganha `priceSource`, `tierLabel`, `finalUnitLocked` para o tooltip.

Modo tier clássico (cartões/banners): inalterado. Precedência: **tier manual > margem_pct > custo puro**.

---

## 5. UI — `MateriasPrimas.tsx`

- Coluna "Faixas" com botão **Gerenciar Faixas** (ícone `Layers`) por linha.
- Badge "X faixas" quando há tiers cadastradas.
- Tooltip do header: *"Faixas substituem margem em apostilas. O valor cadastrado é o preço final ao cliente (impostos e cartão embutidos)."*

---

## 6. Drawer `SupplyTiersDrawer.tsx` (novo)

Espelho de `FinishingTiersDrawer.tsx`:

- Sheet lateral.
- Linhas: Rótulo / Mín / Máx / **R$ final ao cliente** / lixeira.
- Auto-rótulo `TP1`, `TP2`… e auto-encadeamento min/max.
- Validação: min ≥ 1, max ≥ min ou ∞, sem sobreposição.
- Save: delete + reinsert (3–5 tiers por suprimento).
- Header: *"Preço final ao cliente por quantidade. Impostos e taxa de cartão já estão embutidos — substitui margem em apostilas."*

---

## 7. `PriceBreakdown.tsx`

Tooltip dos filhos por origem:

- **Margem:** `Custo R$ 0,19 + 50% margem = R$ 0,29` (entra no subtotal e recebe divisor).
- **Tier manual:** `Preço final R$ 7,50 (TP2 · 6–20 un)` + linha auxiliar *"Custo: R$ 4,00 · imposto/cartão já incluso"*.

---

## 8. Rótulo do item no orçamento

`QuoteItemsTable.tsx`: linha principal de apostila exibe `sellingTotal` (impressão + acabamentos + custos de venda) em vez de só `printingTotal`. Tooltip: *"Inclui impressão, acabamentos e impostos."*

---

## 9. Memória

Atualizar `mem://features/inventory` e `mem://features/pricing` com:

- Tier manual = preço final ao cliente (impostos + cartão embutidos).
- Engenharia reversa via divisor para somar coerentemente no subtotal.
- Precedência: tier manual > margem_pct > custo puro.

---

## Arquivos alterados

- migration nova
- `src/lib/quotes-v2/supply-pricing.ts` (novo)
- `src/lib/quotes-v2/pricing.ts`
- `src/components/orcamentos-v2/SupplySearch.tsx`
- `src/components/orcamentos-v2/LoadFromGroupDialog.tsx`
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx`
- `src/components/orcamentos-v2/PriceBreakdown.tsx`
- `src/components/orcamentos-v2/QuoteItemsTable.tsx`
- `src/pages/MateriasPrimas.tsx`
- `src/components/materias-primas/SupplyTiersDrawer.tsx` (novo)
- atualização de `mem://features/inventory` e `mem://features/pricing`
