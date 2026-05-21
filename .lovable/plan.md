## Objetivo

Eliminar a confusão entre "Espiral automática" (mágica/regex) e "Espiral por folhas" (manual). Deixar **um único caminho óbvio**, com preset já carregado, abertura automática do mapeamento, indicador visual de progresso e botão para copiar de outro kit — sem mudar nada do motor de cálculo.

## Mudanças

### 1. Botão único de espiral
Em `src/pages/KitsProduto.tsx`:
- Renomear o botão `Espiral por folhas` → **`+ Encadernação espiral`** (mesmo ícone `Wand2`).
- Remover qualquer opção/menu que crie itens com `quantity_formula: "auto_spiral"`. O motor continua suportando kits antigos (não quebra dados).
- No `Select` de fórmula (linha ~104), marcar `auto_spiral` apenas como rótulo legível para kits legados (já está como "(legado)"), mas esconder a opção em itens novos.

### 2. Abrir o mapeamento automaticamente após criar
- Em `addSpiralByVariant`, após inserir o item, abrir imediatamente o `VariantsDialog` daquele item (setar `variantsEditingId = novo tmp_id`).
- Toast curto: *"Selecione o suprimento de cada faixa. Você faz isso uma vez e reusa nos próximos kits."*

### 3. Banner explicativo dentro do `VariantsDialog`
Em `src/components/kits/VariantsDialog.tsx`:
- Adicionar banner azul-claro no topo (1 frase): *"O sistema escolhe automaticamente o suprimento certo no orçamento, conforme o nº de folhas do trabalho."*
- Esconder o botão `Preset espirais` (preset já vem carregado) e o botão `+ Faixa` fica como ação secundária.

### 4. Badge de status no item (verde/amarelo)
Na linha do item `variant_by_sheets` em `KitsProduto.tsx` (~linha 959):
- Substituir botão `Editar faixas` por um botão-badge:
  - `✓ 12 faixas mapeadas` (verde) quando todas têm `supply_id`
  - `⚠ N faixas pendentes` (amarelo) quando faltam
- Clicar abre o `VariantsDialog`.

### 5. Copiar mapeamento de outro kit
No `VariantsDialog`:
- Adicionar botão `Copiar de outro kit` (popover com lista de kits que têm item `variant_by_sheets` com pelo menos uma faixa mapeada).
- Ao selecionar, sobrescrever as 12 faixas atuais com os `supply_id`/`supply_label`/`label` do kit escolhido (mantendo min/max).
- Carrega os kits via consulta simples a `product_kits` + `product_kit_items` + `product_kit_item_variants` (filtrando `quantity_formula = 'variant_by_sheets'`).

### 6. Atualizar o tutorial
Em `src/components/kits/KitHowItWorks.tsx`:
- Passo 3 reescrito: *"Encadernação espiral — clique em `+ Encadernação espiral`. As 12 faixas já vêm prontas; basta escolher o suprimento de cada uma (ou copiar de outro kit). O sistema usa a espiral certa para cada nº de folhas no orçamento."*

## Fora do escopo

- Motor de cálculo (`productKit.ts`, `spiral-selector.ts`) — sem alterações; `auto_spiral` continua funcionando para kits antigos.
- Migrações de banco — nenhuma.
- Outros tipos de variante (apenas espiral usa essa UX hoje).

## Resultado de UX

- 1 clique para adicionar espiral → diálogo já aberto com as 12 faixas → o usuário só seleciona suprimentos (ou clica "copiar de outro kit" e termina em 2 cliques).
- Status visível na linha: nunca mais um kit "esquecido" com faixas vazias.
- Zero conceitos invisíveis (regex, nomes que precisam casar) — tudo é WYSIWYG.
