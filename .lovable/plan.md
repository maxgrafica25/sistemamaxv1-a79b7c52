# Onda 1 — Edição V3 (estratégia mínima)

V2 e V3 gravam na mesma tabela `quotes` + filhas. Vamos **reusar** a listagem V2 e o ClientViewer V2 (sem reescrever) e implementar apenas a **edição nativa em V3**.

## Mudanças

### 1. Rota nova
- `src/App.tsx`: adicionar `/orcamentos-v3/:id/editar` → renderiza `NewQuoteV3` com o `id` como prop.

### 2. Listagem V2 (`OrcamentosV2.tsx`)
- Trocar `navigate(\`/orcamentos-v2/${q.id}\`)` (linha 505 e similares) por `\`/orcamentos-v3/${q.id}/editar\``.
- Mantém todo o resto da tela como está (filtros, kanban, badges, BulkActionBar, RealtimeRadar etc.).

### 3. Hydrator novo (`src/components/orcamentos-v3/shared/loadQuoteV3.ts`)
Carrega um orçamento existente e devolve `V3State` pronto para o formulário:
- `quotes` → cabeçalho (cliente, validade, desconto, frete, notes, attention_to, profit_margin, main_quantity, tags).
- `quote_materials` (parent_item_id IS NULL) → reconstrói cada item conforme `product_kind`:
  - `print` → `V3PrintItem` (com filhos `finishing` e `production_step` agrupados).
  - `cv`, `booklet`, `label`, `bcard`, `product` → respectivos tipos.
- `cv_quote_items` → `V3CVItem` (lê `art_status` que acabamos de persistir).
- `quote_labor_steps` (parent_item_id IS NULL) → `V3LaborItem`.
- `quote_third_party` → `V3ThirdItem`.
- Reaproveita `ArtStatus` de `quote_materials.art_status`.

Limitação assumida: itens com estrutura que o V2 gravou de forma diferente (sem `product_kind` ou com campos faltando) caem em um item "genérico" não-editável (read-only badge) para não corromper. Log no console.

### 4. Save em modo edição (`saveQuoteV3.ts`)
Adicionar parâmetro opcional `editingQuoteId`:
- Se presente:
  - `UPDATE quotes SET ... WHERE id = editingQuoteId` (não cria novo número, mantém versão).
  - `DELETE` em `quote_materials`, `quote_labor_steps`, `quote_third_party`, `cv_quote_items` WHERE `quote_id = editingQuoteId`.
  - `INSERT` tudo de novo com o estado atual (mesmo fluxo já existente).
- Se ausente: comportamento atual (cria).
- Bloqueia edição se `quotes.is_locked = true` (já tem versão filha).

### 5. Página `NewQuoteV3.tsx`
- Lê `useParams().id`. Se houver:
  - Mostra skeleton, chama `loadQuoteV3(id)`, hidrata o draft.
  - Título: "Editar Orçamento Nº {quote_number}".
  - Botão "Salvar" passa `editingQuoteId`.
- Se não houver: comportamento atual ("Novo orçamento").

### 6. Pequenos avisos UX
- Se `is_locked`, banner vermelho "Esta versão foi substituída. Abra a versão mais recente para editar."
- Se status ∈ {approved, partial}, banner amarelo "Edição livre vai sobrescrever um orçamento já com aceite parcial/total — considere criar Nova Versão (Onda 2)." Não bloqueia.

## Fora de escopo (Onda 2+)
- Criar Nova Versão / Clonar a partir do V3.
- PDF OP, gerar Pedido.
- Reescrever listagem ou ClientViewer.
- Migrar opções A/B/C, anexos, tags UI (se hoje não existem no V3 form, ficam para depois — o load preserva os campos no DB).

## Arquivos tocados
- **Novo**: `src/components/orcamentos-v3/shared/loadQuoteV3.ts`
- **Editado**: `src/App.tsx`, `src/pages/orcamentos-v3/NewQuoteV3.tsx`, `src/components/orcamentos-v3/NewQuoteFormV3.tsx`, `src/components/orcamentos-v3/shared/saveQuoteV3.ts`, `src/pages/orcamentos-v2/OrcamentosV2.tsx`.

Sem migrations.
