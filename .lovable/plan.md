# Correção: exibir o PrintingItemEditor de fato no formulário

## Diagnóstico

O componente `PrintingItemEditor.tsx` já foi reescrito com tudo o que o plano original pedia (autocomplete de Tipo, largura/altura em mm, cor 4x4/4x0/1x1/1x0, badge cinza de rendimento e alerta vermelho). **Porém ele nunca é renderizado.**

O `NewQuoteFormV2` desenha os itens de impressão através do `QuoteItemsTable.renderPrint` (linhas 161-250), que monta uma **linha de tabela compacta** com o `ProductKindButton` legado (Select fixo) e nenhum campo estruturado. O fluxo de criação ainda é o `DraftRowEditor` com a barra `"Busque a impressão pelo nome…"`.

Resultado: o usuário vê só a busca antiga e, após escolher o papel, recebe uma linha de tabela — nunca o card novo.

## O que vou alterar

### 1. `QuoteItemsTable.tsx` — renderizar o card novo
- Em `renderPrint`, substituir todo o `<div className={GRID}>` (linhas ~180-250) por `<PrintingItemEditor item={m} … />`, passando `childLabor`/`childMaterials` filtrados, `hourlyRate`, e os callbacks já existentes (`onUpdatePrinting`, `onRemovePrinting`, `onUpdateChildMaterial` adaptado para `onChildMaterialChange`, etc.).
- Manter o `ProcessPicker` e o botão de duplicar acima/ao lado do card (header de ações), porque o `PrintingItemEditor` não os expõe hoje. Solução: envolver o `PrintingItemEditor` num wrapper que adiciona uma barra superior com `KindBadge`, número da linha, `ProcessPicker` (acabamentos vinculados) e botão `Copy`. Remover do editor a duplicação de funcionalidades já existentes (qty input continua dentro do editor).
- Apagar do `renderPrint` o uso do `ProductKindButton`, `SwapPrintingButton` (a troca de papel passa a viver no combobox de papel dentro do editor) e os `Inputs` legados de qty/preço.
- Os filhos (`childMatsForThis`, `childLaborForThis`) deixam de ser renderizados como linhas separadas — passam a viver dentro do editor (que já tem `LaborAndSupplySubform` no toggle "Acabamentos vinculados"). Isso elimina a duplicação atual.

### 2. `PrintingItemEditor.tsx` — adicionar combobox de Papel
- Adicionar uma 5ª coluna no grid de cabeçalho: **Papel** (Popover + Command com busca, listando `printingCatalog`). Reduzir para grid de `12` colunas: Tipo (4) · Largura (2) · Altura (2) · Cor (2) · Papel (4) · Referência (4) — quebra em 2 linhas no responsive.
- Receber novas props: `printingCatalog: PrintingCatalogItem[]` e `onPickPaper: (item: PrintingCatalogItem) => void`.
- Ao escolher papel, chamar `onPickPaper` (que reaproveita a lógica de `addPrintingItem`/`onSwapPrinting` para recalcular `paperType`, `grammage`, `printerCategoryId`, `markupGroupId`, `baseCost`, `unitPrice`, mantendo `widthMm`/`heightMm`/`productKind`/`printColors` já preenchidos).
- O label do botão mostra `"<paperType> <grammage>"` ou placeholder "Selecione o papel".

### 3. Fluxo de criação (`DraftRowEditor` em `QuoteItemsTable`)
- Substituir o `InlineCatalogCombobox` ("Busque a impressão pelo nome…") por um botão direto **"Adicionar item de impressão"** que cria um `PricingMaterial` vazio via novo callback `onAddEmptyPrinting()` — sem exigir escolha de papel para começar. O usuário preenche Tipo, dimensões, cor e depois escolhe o papel dentro do próprio editor.
- Manter o caminho via `ProcessPicker` para acabamento avulso (sem mudança).

### 4. `NewQuoteFormV2.tsx` — novos handlers
- Adicionar `addEmptyPrintingItem()` que faz `setMaterials(prev => [...prev, { id, quantity: 1, unitPrice: 0, baseCost: 0, ...todos os campos null }])`.
- Adicionar `pickPaperForItem(id, catalogItem)` reutilizando exatamente a lógica de cálculo já presente em `addPrintingItem` (sizeMult/sideMult/tier/sellingPrice), mas fazendo `patch` no item existente em vez de criar novo. Preserva `productKind`, `widthMm`, `heightMm`, `printColors`, `reference`, `customName`.
- Passar `printingCatalog` e os dois novos handlers para `QuoteItemsTable` → `PrintingItemEditor`.
- Confirmar que o `useEffect` que regrava `generated_title` (já existente) continua funcionando: `buildDynamicTitle` já produz o formato `"<Tipo> <L>x<H>cm. Impressão <Cor>, <Papel> <Gramatura>"`. Sem mudanças no banco — só garantir que o save grava `generated_title` com o resultado dessa função.

### 5. Limpeza
- Remover do `QuoteItemsTable` o `ProductKindButton`, o `SwapPrintingButton` e o uso de `PRODUCT_KIND_OPTIONS`/`buildDynamicTitle` no nível da tabela (passam a ser responsabilidade do editor).
- `PRODUCT_KIND_OPTIONS` continua exportado em `item-title.ts` por compatibilidade.

## Fora do escopo
- Sem mudanças no schema do banco (já feito na migração anterior).
- Sem mudanças em `pricing.ts`, `sheet-yield.ts` (já corretos).
- Sem mexer no `ClientViewer` — ele já consome `generated_title`.

## Arquivos a editar
- `src/components/orcamentos-v2/PrintingItemEditor.tsx` (adicionar combobox de Papel + props)
- `src/components/orcamentos-v2/QuoteItemsTable.tsx` (renderizar editor; trocar entry por botão; remover linhas legadas)
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` (novos handlers `addEmptyPrintingItem` e `pickPaperForItem`; passar catálogo)
