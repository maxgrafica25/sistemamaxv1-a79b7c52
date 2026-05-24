# Sugerir todos acabamentos no modo Personalizado

No formulário de impressão, quando "Personalizado" está selecionado (chip padrão de "Produtos favoritos"), o card de Acabamentos hoje mostra todas as opções **desligadas**. O catálogo já filtra por `applies_to: ["impressao"]`, então acabamentos de CV (tabela própria `cv_calc_acabamentos`) não entram nessa lista.

## Mudança

1. `src/components/orcamentos-v3/forms/PrintForm.tsx`
   - Aceitar nova prop `suggestAllFinishings?: boolean`.
   - Quando `true` e o catálogo `printFinishings` carregar, **pré-ligar todos os chips** (`setFinEnabled` com cada `id: true`) na primeira carga.
   - Garante que o filtro existente (`hideArtFinishings`) continua removendo acabamentos de Arte se aplicável.

2. `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`
   - Passar `suggestAllFinishings={isCustom}` na instância do `PrintForm` usada no modo Personalizado (linhas 284-296).

Resultado: ao abrir Personalizado, todos os acabamentos de impressão vêm marcados como sugestão. O usuário pode desmarcar o que não quiser. Acabamentos de CV continuam fora porque pertencem a outro catálogo.

## Arquivos

- `src/components/orcamentos-v3/forms/PrintForm.tsx`
- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`
