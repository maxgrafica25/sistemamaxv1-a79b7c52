# Deep Clone + Remoção da Ancoragem Global

## Parte 1 — Duplicar Item Completo (aprovado)

### `QuoteItemsTable.tsx`
- Em `renderPrint`, ao lado do `X` (excluir), adicionar botão `Copy` (lucide), `variant="ghost" size="icon" h-7 w-7`, com `Tooltip` shadcn: **"Duplicar Item Completo (Ideal para opções de qtde/variação)"**.
- `onClick` → `onDuplicateItem(m.id)`.
- Última coluna do `GRID` muda de `36px` → `72px` para caber dois ícones.
- Adicionar `onDuplicateItem: (id: string) => void` em `Props`.

### `NewQuoteFormV2.tsx`
Novo handler `duplicateItemDeep`:

```ts
const duplicateItemDeep = (id: string) => {
  const parent = materials.find((m) => m.id === id && !m.parentItemId);
  if (!parent) return;
  const newParentId = crypto.randomUUID();
  const clonedParent = { ...parent, id: newParentId, status: "pendente", approvedAt: null, approvedValue: null };
  const childMats = materials
    .filter((m) => m.parentItemId === id)
    .map((c) => ({ ...c, id: crypto.randomUUID(), parentItemId: newParentId }));
  const childLab = labor
    .filter((l) => l.parentItemId === id)
    .map((l) => ({ ...l, id: `lbr-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, parentItemId: newParentId }));
  setMaterials((prev) => [...prev, clonedParent, ...childMats]);
  setLabor((prev) => [...prev, ...childLab]);
  toast.success("Item duplicado com sucesso! Altere a quantidade ou acabamento na nova linha.");
};
```

Passar `onDuplicateItem={duplicateItemDeep}` ao `<QuoteItemsTable>`. O recálculo por tier (effect já existente) cuida do `unitPrice` automaticamente.

## Parte 2 — Remover "Opções de quantidade (ancoragem)"

### `NewQuoteFormV2.tsx`
- **Remover JSX (linhas ~1137–1164):** todo o bloco com `Quantidade desejada`, input de `mainQuantity`, e `<QuoteOptionsBuilder ...>`. Manter o `<Separator>` posterior do bloco de Total intacto.
- **Remover estado e imports:**
  - `const [mainQuantity, setMainQuantity] = useState(...)` (linha 80).
  - `const [options, setOptions] = useState<QuoteOption[]>([])` (linha 103).
  - `import { QuoteOptionsBuilder }` (linha 25).
  - `import type { QuoteOption }` (linha 31).
- **Remover hidratação no edit (linhas ~312, 325–326):** `setMainQuantity(...)` e o `if (Array.isArray(q.options)) setOptions(...)`.
- **Remover do payload de save (linhas ~590, 600):** os campos `main_quantity` e `options` do objeto enviado ao Supabase. (Colunas no DB permanecem, apenas paramos de gravar — sem migração.)

### Arquivo `QuoteOptionsBuilder.tsx`
- Não excluir agora (segurança contra import órfão); apenas deixa de ser referenciado. Pode ser removido em limpeza futura.

## Fora de escopo
- Sem mudanças de schema/RLS, pricing engine ou persistência adicional. Toda variação de quantidade passa a ser feita exclusivamente via clonagem de linhas na tabela.
