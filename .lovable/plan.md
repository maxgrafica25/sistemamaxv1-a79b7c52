
## Problema

Hoje o viewer do cliente (`src/pages/orcamentos-v2/ClientViewer.tsx`) só renderiza o bloco "Escolha a quantidade" quando o orçamento **não tem nenhum item individual** (`materials.length === 0`). A condição atual é:

```ts
const showOptionsMode = hasMultipleOptions && materials.length === 0;
```

Como o orçamento de Apostilas tem 1 item de impressão cadastrado, as opções de quantidade salvas (ex: 100, 250, 500 un) nunca aparecem para o cliente — nem na tela, nem no PDF gerado a partir dela. Por isso o cliente vê apenas o valor único de R$ 2.550,00.

## O que vai mudar

Tornar o bloco de **opções de quantidade** sempre visível quando o orçamento tiver 2+ opções salvas, independentemente de existirem itens individuais. As opções funcionam como **ancoragem comparativa** (mesma lógica do `QuoteOptionsBuilder`), não substituem o fluxo de aprovação por item.

### 1. ClientViewer.tsx — exibição

- Remover a restrição `materials.length === 0` da renderização do bloco de opções. Renderizar a seção `{options.length >= 2 && (...)}` sempre que houver opções.
- Renomear o título conforme o contexto:
  - Sem itens individuais → "Escolha a quantidade" (continua como CTA principal).
  - Com itens individuais → "Outras quantidades para comparar" (rótulo informativo, ancoragem).
- Quando houver itens individuais, os `OptionCard` ficam **somente informativos** (sem seleção/borda primária, sem `onSelect` ativo) — o fluxo de aprovação continua sendo por checkbox de item. Adicionar prop `readOnly?: boolean` no `OptionCard` para suprimir o estado "selecionado" e o cursor de botão.

### 2. Lógica de modo / sticky bar

- A constante `showOptionsMode` continua valendo apenas para o caso "sem itens" (mantém o sticky bar atual, que aprova pela opção escolhida).
- Quando há itens + opções, o sticky bar permanece em `mode="items"` (aprovação por checkbox). As opções são apenas comparativas.

### 3. PDF / impressão

O viewer do cliente é a fonte do PDF (gerado via `Baixar PDF` que imprime a tela). Como o bloco passa a renderizar sempre, o PDF também passará a mostrar as variações automaticamente — sem mudança extra.

## Fora de escopo

- Não vou agrupar variantes do mesmo item (4x4 vs 1x1, 75g vs 90g) — isso foi descartado na pergunta.
- Não vou alterar o `QuoteOptionsBuilder` (editor) nem o cálculo de preços por quantidade.
- Não vou mexer em pedidos/contas a receber.

## Arquivos afetados

- `src/pages/orcamentos-v2/ClientViewer.tsx` — relaxar `showOptionsMode`, renderizar bloco de opções em ambos os casos com título contextual.
- `src/components/orcamentos-v2/client-viewer/OptionCard.tsx` — adicionar prop opcional `readOnly` (oculta check, remove anel/borda primária, usa `<div>` em vez de `<button>`).
