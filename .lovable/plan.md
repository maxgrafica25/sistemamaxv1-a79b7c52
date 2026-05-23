## Objetivo
Unificar hierarquia visual, padronizar abas e melhorar UX da tela `/insumos`, integrando a visualização rápida (accordion) já implementada nos cards de Kits — sem mexer em regras de negócio nem em schema.

## 1. Hierarquia da página `/insumos` (Insumos.tsx)

Hoje: as 3 abas (Materiais / Grupos / Kits) ficam no topo e cada subpágina renderiza seu próprio header logo abaixo. Para espelhar "Processos de Produção" (header → DotTabs → conteúdo), vou:

- Mover o **header da página para `Insumos.tsx`** (título + subtítulo + botão primário), com conteúdo dinâmico por aba:
  - "Materiais" — título "Materiais", subtítulo "Papéis e suprimentos", ação "+ Novo Material".
  - "Grupos" — título "Grupos", subtítulo "Agrupamentos por finalidade", ação "+ Novo Grupo".
  - "Kits de Produto" — título "Kits de Produto", subtítulo atual, ação "+ Novo Kit".
- Para evitar acoplamento entre Insumos.tsx e o estado interno das subpáginas, expor o botão "+ Novo X" via um pequeno padrão simples: cada subpágina recebe uma prop opcional `hideHeader?: boolean` e a action de "novo" é disparada via um event bus leve (`window.dispatchEvent(new CustomEvent("insumos:new-kit"))`) que a subpágina escuta. Alternativa mais limpa: cada subpágina expõe `imperativeHandle` via `forwardRef` para o pai chamar `openNew()`. Vou usar a **abordagem `forwardRef + useImperativeHandle`** (idiomática React, sem event bus).
- A ordem visual em `Insumos.tsx` passa a ser:
  1. Page header (h1 + subtítulo à esquerda, botão "+ Novo X" à direita)
  2. `<DotTabs>`
  3. Conteúdo da aba (sem header próprio)
- Subpáginas (`MateriasPrimas.tsx`, `GruposMateriais.tsx`, `KitsProduto.tsx`) passam a aceitar `hideHeader` e, quando true, escondem o bloco de header próprio. A action de "novo" continua dentro do componente; o pai dispara via ref.
- A busca global (CommandPalette no Layout) já está acima de tudo — nenhuma mudança ali.

## 2. Padronização das abas em `Insumos.tsx`

- Remover ícones (`Package`, `Layers`, `Sparkles`) das abas superiores.
- Substituir a implementação custom atual por `<DotTabs>` (já existente em `src/components/ui/dot-tabs.tsx`), mesmo padrão de "Processos de Produção" (dot roxo + border-b roxo na ativa, dot cinza na inativa).
- Mantém o `?tab=` na URL.

## 3. UI dos cards de Kit (KitsProduto.tsx)

- **Divisor por categoria:** abaixo do rótulo "CARTÃO DE VISITA" + contador, adicionar `<Separator className="my-3" />` (100% da largura do grupo) antes da grade de cards.
- **Hierarquia do card:** título + contador "N itens" à esquerda; `Switch` (ativo/inativo) movido para a extremidade direita do header do card (já está, mas vou garantir alinhamento `justify-between` no header sem competir com o chevron — chevron fica colado ao contador, switch fica isolado à direita).
- **Rodapé:** "Editar" + "Duplicar" agrupados à esquerda; **"Excluir" empurrado para a extremidade direita** via `ml-auto`.
- **AlertDialog para excluir:** substituir o `ConfirmDialog` atual por `<AlertDialog>` da shadcn/ui:
  - Title: "Excluir Kit?"
  - Description: "Tem certeza que deseja excluir este kit? Esta ação não pode ser desfeita."
  - Botões: "Cancelar" + "Excluir" (`variant="destructive"`).

## 4. UX do accordion (já implementado — revisar)

Já está em produção:
- Header do card clicável com `ChevronDown` que gira 180°.
- Lista compacta read-only com ícone (`Package`/`Cog`), label, badges `ROLE_SHORT` e `formulaBadge`.
- Fallback "Nenhum item cadastrado" quando `item_count === 0`.
- Botões do rodapé fora do accordion.

Ajuste: confirmar que o chevron permanece dentro do botão de toggle, sem conflitar com o `Switch` (que agora estará na extrema direita, fora do botão).

## 5. Lazy-load (já implementado — manter)

Mantido tal como está:
- `expandedKits: Set<string>`, `kitItemsCache`, `loadingKits`, `erroredKits`.
- Fetch único por kit ao expandir; resolve `supply_label` em lote e `process_label` via `processes` em memória.
- `Loader2` durante o fetch; mensagem destrutiva discreta em erro.
- `fetchAll()` zera `kitItemsCache` e `erroredKits` para forçar refetch após salvar/editar/excluir.

## 6. Implementação e limites

- Arquivos tocados:
  - `src/pages/Insumos.tsx` — hoist do header, DotTabs, refs para subpáginas.
  - `src/pages/KitsProduto.tsx` — `hideHeader`, expor `openNew` via ref, Separator por categoria, AlertDialog, ajustes finos no card.
  - `src/pages/MateriasPrimas.tsx` e `src/pages/GruposMateriais.tsx` — receber `hideHeader` e expor `openNew` via ref (mudanças mínimas, só apresentação).
- Sem mudanças de schema, RLS, hooks de negócio ou outros módulos.
- Sem alteração no Dialog de edição de Kit nem em outros cards do sistema.

## Pequena exceção ao escopo declarado pelo usuário
O usuário pediu "concentrar mudanças apenas em `KitsProduto.tsx`", mas a hierarquia "header → tabs → conteúdo" exige tocar `Insumos.tsx` (e mínimas adaptações em `MateriasPrimas.tsx` e `GruposMateriais.tsx` para suportar `hideHeader` + ref). É a forma correta de obter a hierarquia pedida; sigo nesse caminho salvo orientação contrária.