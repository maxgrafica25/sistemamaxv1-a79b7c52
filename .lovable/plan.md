## Mover "Encadernação espiral" para dentro do picker

Hoje há **dois botões** na barra inferior do diálogo de kit:
- `+ Adicionar acabamentos` → abre o picker em massa (Suprimentos/Processos)
- `+ Encadernação espiral` → atalho que adiciona uma linha com 12 faixas pré-prontas (só faz sentido para Apostila)

Resultado: poluição visual e dúvida sobre quando usar cada um. Solução: **um único ponto de entrada**.

### Mudança

1. **Remover** o botão `+ Encadernação espiral` da barra inferior.
2. **Adicionar dentro do picker** (`AddItemsPicker`, aba **Suprimentos**), no topo, um card destacado:
   > ✨ **Encadernação espiral automática**
   > Adiciona uma linha com 12 faixas (nº de folhas → diâmetro). Você escolhe o suprimento de cada faixa depois.
   > [Adicionar ao kit]
3. Clicar nesse card insere a mesma estrutura de hoje (chama o mesmo `addSpiralByVariant`) e **fecha o picker**.
4. Atualizar o texto de "estado vazio" da lista de itens — hoje diz "...adicionar acabamentos ou encadernação espiral"; passa a dizer apenas "...adicionar acabamentos".
5. Atualizar o popover "Como funciona este kit": o passo 3 (Encadernação espiral) passa a explicar que o atalho fica **dentro** de `+ Adicionar acabamentos`.

### Detalhes técnicos

- Arquivos:
  - `src/components/kits/AddItemsPicker.tsx` — adicionar prop opcional `onAddSpiralShortcut?: () => void`; quando passada, renderiza o card destacado no topo da aba Suprimentos.
  - `src/pages/KitsProduto.tsx` — remover o botão da barra; passar `onAddSpiralShortcut={() => { addSpiralByVariant(); setPickerOpen(false); }}` para o picker; ajustar o texto de empty state.
  - `src/components/kits/KitHowItWorks.tsx` — ajustar o texto do passo 3.
- Nenhuma mudança em schema, backend ou outras telas.
- A função `addSpiralByVariant` continua existindo (só muda quem chama).

### Fora do escopo

- Esconder a opção por tipo de produto (você optou por mantê-la sempre disponível, só dentro do picker).
- Refatorar a lógica de "variant_by_sheets" ou as 12 faixas padrão.
