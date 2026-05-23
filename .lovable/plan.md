## Objetivo
Permitir remover um favorito direto do chip no formulário de orçamento, via clique direito.

## Mudanças
**Arquivo:** `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`

1. Em cada chip renderizado a partir de `presets`, adicionar `onContextMenu` que:
   - Previne o menu nativo do navegador.
   - Abre um pequeno menu (shadcn `DropdownMenu` em modo controlado, ou `ContextMenu` do shadcn) ancorado no chip com a opção **"Remover favorito"**.
2. Ao confirmar (via `AlertDialog`), chamar a função de remoção do hook `useQuotePresets` (verificar se já existe `deletePreset`; se não, adicionar wrapper que faz `DELETE` em `quote_presets` pelo id e dá refetch).
3. Após remover, mostrar `toast` de sucesso e atualizar a lista de chips.

## Detalhes técnicos
- Usar `ContextMenu` do shadcn (`@/components/ui/context-menu`) envolvendo o `<Button>` do chip — é o componente mais natural para clique direito e já está no design system.
- Só presets do usuário recebem o context menu; chip built-in ("Cartão de Visita" embutido) não.
- Deleção respeita RLS já existente em `quote_presets` (usuário só apaga os próprios).
- Sem mudanças de schema.

## Fora de escopo
- Renomear favorito inline (pode ser feito depois pela página Produtos Favoritos).
- Atalho para favoritos compartilhados entre usuários.
