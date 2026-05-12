## Objetivo

Adicionar margem de lucro por insumo em **Suprimentos**, aplicada **apenas** no modo `direct_sum` (apostilas), para evitar markup-sobre-markup nos itens tier.

---

## 1. Banco de Dados

Migração única em `supplies`:

```sql
ALTER TABLE public.supplies
  ADD COLUMN margem_pct numeric NOT NULL DEFAULT 0
  CHECK (margem_pct >= 0 AND margem_pct <= 500);
```

Sem mudança em RLS (herda as policies existentes). O `CHECK` de 0–500% é trava contra erro de digitação.

---

## 2. UI — Cadastro de Suprimentos (`src/pages/MateriasPrimas.tsx`)

- Novo campo **"Margem (%)"** no formulário de criar/editar suprimento, ao lado de `valor_unitario`.
- Nova coluna **"Margem"** na tabela, exibindo o valor + o "Preço de venda calculado" entre parênteses (ex.: `50% → R$ 0,29`) — elimina conta mental no balcão.
- **Ação em massa:**
  - Cada linha da tabela ganha um **`<Checkbox>`** do Shadcn/Radix (já usado no projeto: `src/components/ui/checkbox.tsx`).
  - Checkbox no header para "selecionar todos" (com estado `indeterminate` quando seleção parcial).
  - Quando ≥1 item selecionado, aparece uma toolbar/`BulkActionBar` no topo com: contador de selecionados, input de "Nova margem (%)" e botão "Aplicar".
  - Clicar em "Aplicar" abre um **`<AlertDialog>`** de confirmação com texto explícito:
    > "Atualizar margem para **X%** em **N suprimentos**? Esta ação afeta o preço de venda em apostilas imediatamente."
  - Só após o "Confirmar" o `UPDATE` no Supabase é disparado (1 query com `.in('id', ids)`).
- Tooltip no header da coluna: *"Margem aplicada apenas em apostilas (modo soma direta). Não afeta cartão/banner/etc."*

---

## 3. Motor de Preço (`src/lib/quotes-v2/pricing.ts`)

- Adicionar `margemPct?: number | null` em `PricingMaterial`.
- No ramo `isDirectSumItem`, ao iterar `childMats` para `coversTotalAbs` e `finishingTotalAbs`:

  ```ts
  const venda = cm.unitPrice * (1 + (cm.margemPct ?? 0) / 100);
  const v = cm.quantity * venda;
  ```

- No ramo tier: **nada muda** (segue usando `unitPrice` puro). Garantia de que banners/cartões continuam competitivos.
- `breakdownForQuantity` propaga o valor já com margem; sem alteração estrutural.

---

## 4. Snapshot do Orçamento (`SupplySearch.tsx` + `NewQuoteFormV2.tsx`)

- `SupplySearch` passa a retornar `margem_pct` junto com `valor_unitario`.
- Ao adicionar suprimento como filho, gravar `margem_pct` no item local e incluir no snapshot que vai pro `pricing.ts`.
- Ao salvar em `quote_materials`: **não** persistir a margem (o `unit_price` salvo continua sendo o custo). A margem é resolvida em runtime via lookup. Evita orçamentos antigos quebrarem se a margem mudar; e a rota direct_sum recalcula tudo.

---

## 5. Visualização (`src/components/orcamentos-v2/PriceBreakdown.tsx`)

No painel "Resumo por unidade" (modo direct_sum), em cada linha de Capa/Acabamento adicionar tooltip:

> Custo R$ 0,19 + 50% margem = **R$ 0,29**

Sem alteração visual nos itens tier.

---

## Detalhes técnicos

- Sem migração de dados: `DEFAULT 0` mantém comportamento atual até o usuário ajustar.
- Margem resolvida em runtime → orçamentos **rascunho** recalculam ao reabrir, **aprovados** ficam intactos (status `aprovado` congela `approved_value`).
- Categoria de suprimento fica para v2.

---

## Arquivos alterados

- migration nova
- `src/pages/MateriasPrimas.tsx`
- `src/components/orcamentos-v2/SupplySearch.tsx`
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` (+ `LaborAndSupplySubform.tsx` se for onde o suprimento entra como filho)
- `src/lib/quotes-v2/pricing.ts`
- `src/components/orcamentos-v2/PriceBreakdown.tsx`
- atualizar `mem://features/inventory` com a nova regra
