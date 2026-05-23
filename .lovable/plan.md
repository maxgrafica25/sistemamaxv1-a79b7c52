## Remover o builder de Opções A/B/C do orçamento

A funcionalidade de "Opções de orçamento" (A, B, C com quantidades alternativas) está duplicando o que já é resolvido de forma mais fluida pelas **Faixas de Quantidade**. Vou removê-la apenas da tela de criação/edição.

### Mudanças

1. **`src/components/orcamentos-v3/NewQuoteFormV3.tsx`**
   - Remover a renderização de `<QuoteOptionsBuilderV3 …>` (linhas 351-358) da sidebar do carrinho.
   - Remover o import de `QuoteOptionsBuilderV3`.

### O que NÃO muda

- **Modelo de dados** (`types.ts` mantém `main_quantity`/`options`, default `null`/`[]`).
- **Persistência** (`saveQuoteV3.ts` continua gravando os campos — novos orçamentos simplesmente salvam `options: []`).
- **Visualização**: `ClientViewerV3.tsx` e a listagem `OrcamentosV3.tsx` continuam lendo/renderizando `options` para orçamentos antigos que já tenham opções salvas (compatibilidade retroativa).
- O componente `QuoteOptionsBuilderV3.tsx` fica no repositório, sem uso ativo (não vou deletar para não derrubar histórico/referências), mas pode ser removido depois se confirmar que ninguém mais usa.
