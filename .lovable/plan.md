## Objetivo
Substituir o clique direito por um botão visível **"Desfavoritar"**, exibido apenas quando um preset favorito está aberto/selecionado, com confirmação explicando o efeito.

## Mudanças
**Arquivo:** `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`

1. **Remover o `ContextMenu`** que envolve cada chip — o chip volta a ser um `<button>` simples com `onClick` para selecionar.
2. **Adicionar um botão "Desfavoritar"** na barra de ações dos chips (mesma linha do "Salvar como favorito"), visível só quando `selectedPreset` existe (um favorito está aberto):
   - Ícone `Trash2` + texto "Desfavoritar"
   - Estilo `ghost` discreto com `text-muted-foreground hover:text-destructive`
   - `title` curto explicando: "Remove este favorito da sua lista"
3. **Manter o `AlertDialog`** já implementado, mas melhorar a descrição para deixar claro:
   - Título: "Desfavoritar este atalho?"
   - Descrição: "O favorito \"{nome}\" será removido da sua lista de atalhos rápidos. Isso não apaga nenhum orçamento já criado e você pode salvá-lo novamente depois."
4. Após remover, voltar para "Personalizado" (`setSelectedPresetId(null)`) — já é o comportamento atual.

## Detalhes técnicos
- Reaproveita `presetToDelete`, `deleting`, `handleConfirmDelete` já existentes.
- Remove imports não usados: `ContextMenu*`.
- Sem mudanças de schema ou hook.

## Fora de escopo
- Renomear favorito inline.
