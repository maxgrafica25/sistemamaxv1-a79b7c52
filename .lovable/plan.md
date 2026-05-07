# Três correções no Novo Orçamento (V2)

## 1. Linha em branco já aberta ao entrar

**Onde:** `src/components/orcamentos-v2/QuoteItemsTable.tsx`

Hoje o `useState<DraftRow[]>([])` começa vazio e o usuário precisa clicar em "+ adicionar item". Vou:

- Adicionar um `useEffect` que, quando a tabela monta **vazia** (sem `printingItems`, sem `standaloneLabor`, etc.), cria automaticamente **uma** linha draft.
- Após o usuário escolher uma impressão, **não** abrir nova draft automaticamente — ele clica "+ adicionar item" se quiser outra. Isso evita confusão.

## 2. Tier de markup ignorando a quantidade

**Sintoma:** o sistema usa sempre a primeira faixa, mesmo quando o usuário aumenta a quantidade.

**Causa-raiz:** em `NewQuoteFormV2.tsx > addPrintingItem`, o `unitPrice` do material é calculado com `qty=1` e fica congelado. A `QuoteItemsTable` mostra `total = quantity × unitPrice` — ou seja, o preço unitário da linha nunca consulta o tier de novo quando a quantidade muda. O motor `recalculateForQuantity` (em `pricing.ts`) **já faz** isso corretamente para o total geral (sidebar), mas o **preço unitário visível na linha** continua o do tier inicial.

**Correção em `QuoteItemsTable.tsx > renderPrint`:**

- Receber `markupTiers` e `categoryDefaultGroupId` do pai (markupTiers já é prop; `categoryGroups` ainda não — adicionar).
- Para itens com `baseCost` + `printerCategoryId`, recalcular o `unitPrice` exibido com base no `quantity` atual da linha (mesma fórmula `findTier` + `calcSellingPrice` do engine).
- Quando o usuário altera o campo "Qtde", chamar `onUpdatePrinting(id, { quantity, unitPrice: novoPrecoCalculado })` — assim o valor recalculado é persistido no estado e o total da linha reflete a faixa correta.
- Considerar também os custos dos **filhos vinculados** (mão-de-obra + materiais com `parentItemId === m.id`) somados ao `baseCost` antes de aplicar o tier — espelhando `recalculateForQuantity` para que o preço da linha bata com o total do orçamento.

## 3. Trocar a impressão sem perder os acabamentos

**Sintoma:** se o papel está errado, o usuário precisa apagar o item e seus acabamentos vinculados, depois recadastrar tudo.

**Solução:** botão **"Trocar material"** (ícone `RefreshCw`, ghost discreto) ao lado do `ProductKindButton` em cada linha de impressão, em `QuoteItemsTable.tsx > renderPrint`.

- **Tooltip** "Trocar material" no hover (componente `Tooltip` do shadcn — já disponível) — mantém o ícone limpo e a função clara.
- Ao clicar, abre o mesmo `InlineCatalogCombobox` de impressões (popover).
- Ao escolher a nova impressão:
  - Recalcula `baseCost`, `paperType`, `grammage`, `size`, `side`, `printerCategoryId`, `markupGroupId`, `catalogItemId`, `description` do item — **mantendo o mesmo `id`**.
  - Como o `id` permanece, todos os `childMaterials` e `childLabor` que têm `parentItemId === m.id` continuam vinculados automaticamente.
  - Recalcula `unitPrice` com o tier vigente para o `quantity` atual.
- **Feedback visual:**
  - `toast.success("Material trocado — confira se os acabamentos seguem compatíveis.")` — texto curto que já reforça a conferência operacional.
  - **Flash** rápido na linha trocada: aplicar uma classe CSS por ~600ms (ex: `bg-primary/10 transition-colors`) controlada por estado local `flashId` no `QuoteItemsTable`, que é setado no `onSwapPrinting` e limpo via `setTimeout`. A linha do `renderPrint` recebe a classe condicionalmente.
- Implementação: novo callback `onSwapPrinting(id: string, newItem: PrintingCatalogItem)` no QuoteItemsTable; em `NewQuoteFormV2` é um `setMaterials(prev => prev.map(...))` que substitui os campos do item raiz preservando `id`, `quantity`, `productKind`, `customName`, `reference`, e qualquer status.

UI sugerida na linha:

```text
[Tipo▾] [↻ tooltip:"Trocar material"]  título do item …  [+ acabamento]
```

**Atenção operacional (não vai pro código, é orientação de uso):** o sistema **não bloqueia** combinações inválidas (ex.: troca para uma folha menor que não comporta o formato configurado em laminação/refile). Isso é proposital — agiliza o fluxo. Cabe ao operador conferir visualmente se os acabamentos abaixo continuam fazendo sentido com a nova folha. O toast pós-troca já carrega esse lembrete.

## Fora de escopo

- Sem mudanças no schema, RLS, persistência, ou no `ClientViewer`.
- Sem mexer no fluxo de Comunicação Visual (`CVItemCard`).
- Sem alterar a lógica de pricing engine — apenas consumi-la corretamente na UI da tabela.
- Sem validação automática de compatibilidade impressão↔acabamento (decisão consciente para preservar agilidade).
