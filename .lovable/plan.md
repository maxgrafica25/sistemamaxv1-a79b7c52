## Unificar criação de orçamento em um botão único com dropdown

Hoje há dois botões separados na página `/orcamentos-v2`: **"Começar com um Modelo"** (outline) e **"Novo Orçamento V2"** (primário). Vamos consolidar em um único botão primário **"Incluir Orçamento"** com um menu dropdown, no mesmo padrão visual do ERP do print enviado (Olist).

### Mudanças de UI

**`src/pages/orcamentos-v2/OrcamentosV2.tsx`** (linhas 188-195)
- Remover os dois botões atuais.
- Substituir por um único `DropdownMenu` (já disponível em `src/components/ui/dropdown-menu.tsx`):
  - Trigger: botão primário **"Incluir Orçamento"** com ícone `Plus` e seta para baixo (`ChevronDown`).
  - Conteúdo do dropdown, com cabeçalho de seção (igual ao print: "a partir do modelo"):
    - **Item 1 — "Orçamento em branco"** (ícone `FileText`) → navega para `/orcamentos-v2/novo` (comportamento atual do botão primário).
    - **Separador** com label `"A partir de modelo"`.
    - **Item 2 — "Escolher modelo pronto..."** (ícone `Sparkles`) → abre o `UseTemplateDialog` existente (estado `useTemplateOpen`).

### Melhorar identificação dos modelos no diálogo

**`src/components/orcamentos-v2/UseTemplateDialog.tsx`**
Atualmente o card mostra `product` em destaque + linha pequena com `client · valor`. Para que o usuário identifique rapidamente "do que se trata" o modelo, vamos:

- **Título do card**: priorizar um nome amigável. Se o produto começa com algum padrão genérico, ainda assim o `product` é a melhor pista — manter como título principal (negrito, maior).
- **Subtítulo (badge ou texto secundário)**: adicionar uma linha clara com:
  - Categoria/tipo inferida do produto (primeiras palavras), OU
  - Indicação de quantos itens/etapas o modelo contém (ex: "3 materiais · 2 etapas · Valor base R$ 343,00") — busca leve em paralelo ao carregar a lista.
- **Remover** a frase "Modelo baseado em: {client}" porque o cliente original raramente ajuda a identificar o tipo de trabalho. Substituir pela contagem de componentes + valor.
- **Manter** badge com `quote_number` discreto (canto/lateral).
- Buscar `count` de `quote_materials` e `quote_labor_steps` por modelo na query inicial (com `count: "exact", head: false` agrupado por `quote_id`, ou um `select` com relação aninhada se disponível nas FKs).

Layout final de cada linha do diálogo:
```text
[Sparkles] Cartão de Visita Premium 4x4                    [#2026-1234]
           3 materiais · 2 etapas · R$ 343,00
                                                  [Usar este modelo →]
```

### Detalhes técnicos

- Usar `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator` do shadcn já presente.
- Importar `ChevronDown`, `FileText` de `lucide-react` (já é usado em outros pontos do projeto).
- Para a contagem de materiais/etapas: ampliar o `select` em `UseTemplateDialog.tsx` para `id, quote_number, client, product, value, quote_materials(count), quote_labor_steps(count)`. Se as FKs estiverem nomeadas, isso retorna `[{ count: N }]`.
- Não há mudança de banco de dados nem de rotas.

### Arquivos editados

- `src/pages/orcamentos-v2/OrcamentosV2.tsx`
- `src/components/orcamentos-v2/UseTemplateDialog.tsx`
