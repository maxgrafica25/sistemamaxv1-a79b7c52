## Ajustes no Orçamento V2

### 1. Exibir itens de Comunicação Visual na página pública

**Arquivo:** `src/pages/orcamentos-v2/ClientViewer.tsx`

- Criar interface `CvItemRow` com os campos: `id, material_nome, printer_nome, largura_cm, altura_cm, quantidade, preco_total, tem_emenda, aplicou_minimo`.
- Adicionar state `cvItems` e buscar em `loadData()` (junto com materials/labor):
  ```ts
  supabase.from("cv_quote_items")
    .select("id, material_nome, printer_nome, largura_cm, altura_cm, quantidade, preco_total, tem_emenda, aplicou_minimo, sort_order")
    .eq("quote_id", quoteRow.id)
    .order("sort_order")
  ```
- Renderizar dentro do mesmo card "O QUE ESTÁ INCLUSO" (bloco pendentes), logo abaixo da lista atual de `pendingItems`, ou — caso não existam materials gráficos — exibir o card mesmo assim.
- Ajustar a condição que mostra o card de "valor único" (linha 600) para também considerar `cvItems.length === 0`, evitando duplicidade.
- Cada linha CV exibe:
  - **Título:** `{material_nome}` (ex: "Lona Front 440g")
  - **Subtítulo (muted, xs):** `{largura}m × {altura}m · {quantidade} un · {printer_nome}` + tags ("Com emenda" / "Mínimo aplicado") se aplicável.
  - **Valor à direita:** `formatBRL(preco_total)`.
- Sem checkbox de aprovação parcial nesta primeira versão (CV entra como item informativo, somando ao subtotal global do quote). Manter ícone `Package` como visual.

### 2. Validações obrigatórias antes de salvar

**Arquivo:** `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — função `handleSave` (linha 557).

Substituir o bloco atual de validação pelas três travas exigidas, **antes** de montar o payload:

```ts
// 1. Cliente obrigatório (ID vinculado, não apenas texto livre)
if (!clientId || !client.trim()) {
  toast.error("Selecione um cliente para continuar.");
  return;
}

// 2. Pelo menos 1 item (gráfico OU comunicação visual)
if (materials.length === 0 && cvItems.length === 0) {
  toast.error("Adicione pelo menos 1 item ao orçamento (gráfico ou comunicação visual).");
  return;
}

// 3. Forma de pagamento obrigatória
if (!paymentMethod) {
  toast.error("Selecione a forma de pagamento.");
  return;
}
```

Manter a checagem existente de `isLocked` no topo. Remover/substituir a validação antiga de `product.trim()` (o produto pode ser derivado dos itens; se necessário manter, transformar em fallback automático em vez de bloquear).

### Notas técnicas
- Tabela `cv_quote_items` já existe com RLS de leitura para autenticados — a página pública é acessada sem auth via `/p/:quoteNumber`. Verificar se a policy SELECT permite anon; caso negativo, ajustar policy em migration separada para liberar leitura pública (mesmo padrão de `quote_materials`). Confirmar antes de implementar; se SELECT for restrito, incluir migration que adiciona `CREATE POLICY "Public can read cv_quote_items" ON cv_quote_items FOR SELECT USING (true);`.
- Não alterar lógica de salvamento de CV items — apenas leitura na página pública e validação no save.
