## Mostrar número do orçamento sempre

Hoje, quando o usuário cria um orçamento novo, o badge no topo do editor fica vazio (só aparece "Editar Nº XXXX-XXX" ao editar). O número real só é gerado ao salvar.

### Mudança

No `NewQuoteFormV3.tsx`:

1. Ao montar (modo criação), chamar `nextQuoteNumber()` (já existe em `saveQuoteV3.ts`) para calcular o próximo número disponível e guardar em estado local como `previewNumber`.
2. Renderizar o badge sempre:
   - Editando → `Editar Nº {quote_number}`
   - Criando → `Nº {previewNumber}` (provisório, confirmado no save)
3. Expor `nextQuoteNumber` como export nomeado em `saveQuoteV3.ts` para poder importar no formulário.

### Observação

O número é provisório até salvar (race condition possível se outro usuário salvar antes). Na hora do save, a função `nextQuoteNumber()` é re-executada e o número definitivo é gravado — o badge é apenas visual. Isso atende ao requisito "todo orçamento tem um número" sem precisar criar linha rascunho no banco.
