## Problema

Na página **Preço de Impressão** (`/preco-impressao`), a tabela principal tem muitas colunas dinâmicas (Cód, Tipo, Gram., Tam., Lado, Impressora, C. Papel, C. Impr., Custo Total + N colunas de faixas de markup + Ações). Em telas menores que ~1400px, o conteúdo é cortado/escondido e o usuário não consegue visualizar todas as informações nem rolar lateralmente.

Causa: o `<Table>` está dentro de um `<div>` simples sem `overflow-x-auto`, e o container pai usa `max-w-[1400px] mx-auto` com `p-6`, sem permitir scroll horizontal interno.

## Solução

Adaptar a tela para diferentes tamanhos sem perder informação, usando scroll horizontal controlado na tabela e ajustes finos no padding/largura do container.

### Mudanças em `src/pages/PrecoImpressao.tsx`

1. **Wrapper de scroll horizontal na tabela** (linha ~960):
   - Trocar o `<div>` que envolve `<Table>` por `<div className="w-full overflow-x-auto rounded-md border">` para que a tabela role lateralmente quando exceder a largura disponível, sem quebrar layout do restante da página.
   - Adicionar `min-w-max` na `<Table>` (ou usar `whitespace-nowrap` em headers críticos) para preservar a leitura das colunas durante o scroll.

2. **Padding responsivo no container principal** (linha 559):
   - `p-6 space-y-6 max-w-[1400px] mx-auto` → `p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-[1400px] mx-auto`
   - Reduz o desperdício horizontal em telas médias, dando mais espaço útil para a tabela.

3. **Cabeçalho de filtros e badges** (acima da tabela):
   - Garantir que a barra com botões de filtro/colunas/contagem use `flex-wrap gap-2` para não estourar em telas estreitas.

4. **Tabs de categorias** (linha ~606):
   - O `TabsList` já usa `whitespace-nowrap`; envolver em um wrapper com `overflow-x-auto` se ainda não estiver, para permitir rolagem das abas em mobile/tablet.

5. **Indicador visual de scroll** (opcional, leve):
   - Sombra sutil nas bordas do wrapper (`shadow-inner` ou gradiente) só quando há overflow, para sinalizar ao usuário que pode rolar lateralmente. Implementação simples via classes Tailwind, sem JS.

### Sem mudanças em

- Lógica de cálculo, queries Supabase, dialogs de edição.
- Estrutura de colunas dinâmicas (`visibleColumns`) — o usuário continua podendo ocultar colunas via o seletor existente, agora complementado pelo scroll quando todas estiverem visíveis.

## Resultado esperado

- Em telas ≥1400px: visual idêntico ao atual.
- Em telas 768–1399px (caso do usuário, 978px): tabela rola horizontalmente dentro do card, todas as colunas acessíveis, demais elementos da página permanecem visíveis.
- Em mobile (<768px): padding reduzido, abas roláveis, tabela com scroll horizontal preservando legibilidade.
