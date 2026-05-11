## Bug

O badge mostra `(0/3)` mesmo com itens aprovados porque o agregado compara `status === "approved"`, mas no banco os valores estão em português (`"aprovado"` / `"pendente"`).

Confirmado no orçamento `2026-013`: 3 itens raiz, 2 com `status = 'aprovado'`, 1 com `status = 'pendente'`.

## Correção

1. **`src/pages/orcamentos-v2/OrcamentosV2.tsx`** (linha 127) — trocar `row.status === "approved"` por `row.status === "aprovado"` em `refreshAggregates`.

2. **`src/pages/orcamentos-v2/ClientViewer.tsx`** (linha 467) — trocar `m.status === "approved"` por `m.status === "aprovado"` no cálculo do `approved` que alimenta o `QuoteStatusBadge` do header.

Sem mudanças de schema, sem mudanças de UX. Apenas a string comparada.