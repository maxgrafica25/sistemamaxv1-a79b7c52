## Mudanças na tela de Acabamentos

### 1. Remover "Aplicável em" (Etiquetas / Impressão)
Como etiqueta também é impressão, o seletor não agrega. No banco, todo acabamento passa a ser salvo com `applies_to = ['etiqueta','impressao']` automaticamente. O toggle de filtro no topo da listagem (Todos / Etiquetas / Impressão) também sai. Nenhum consumidor quebra — todos os filtros que usam `applies_to.includes(...)` continuam encontrando ambos.

### 2. Remover "Unidade de cobrança"
O campo `unit_label` some do formulário. Para acabamentos em `per_unit`, o sistema salva automaticamente `unit_label = 'unidade'` (mantém o validador feliz e o pricing intacto). Na coluna **Preço** da tabela, em vez de `/ilhós`, `/dobra`, etc., passa a mostrar simplesmente `/unidade` ou `/serviço` quando `price = 0`.

> Observação: registros existentes com unit_label customizado ("ilhós", "dobra", "serviço") **continuam exibindo o label salvo** — só novos cadastros usam "unidade". Se preferir uniformizar tudo agora, podemos rodar um UPDATE em massa; me avise.

### 3. Remover "Ordem" e implementar drag-and-drop
Campo "Ordem" sai do formulário. Na tabela, adiciono uma alça (`GripVertical`) na primeira coluna que permite arrastar a linha para reordenar (uso `@dnd-kit/sortable` que já está no projeto). Ao soltar, persisto o novo `sort_order` de todas as linhas afetadas em uma só transação (upsert). Drag só fica disponível para admin e quando não há filtros/busca ativos (para evitar reordenar uma visão parcial).

### Resumo do novo formulário
```
┌─ Novo acabamento ──────────────┐
│ Nome              [_________]  │
│ Categoria  [▼]  Modelo  [▼]    │
│ Tamanho    [▼]  Preço  [____]  │   (Tamanho só se "Por folha")
│ Tempo (min)     [____]         │
│ Ativo           [●]            │
└────────────────────────────────┘
```

### Arquivos afetados
- `src/pages/Acabamentos.tsx` — única tela tocada (form, tabela, filtros).
