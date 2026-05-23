## Objetivo
Transformar cada card de kit (em `/insumos?tab=kits`) num accordion que, ao expandir, lista os itens do kit em modo leitura — sem precisar abrir o dialog de edição.

## UX

- Adicionar um botão chevron (`ChevronDown`) à direita do contador "N itens" em cada card.
- Toda a área do header (nome + "N itens") fica clicável para expandir/recolher; chevron gira 180° quando aberto.
- Quando expandido, abaixo da descrição aparece uma lista compacta dos itens, somente leitura:
  - Ícone (`Package` para suprimento, `Cog` para processo)
  - Nome do suprimento ou descrição do processo
  - Badge pequeno com o papel (Obrig. / Opc. / Alt.) — reutiliza `ROLE_SHORT`
  - Badge pequeno com a fórmula/quantidade — reutiliza `formulaBadge(it)`
- Se o kit tiver 0 itens, mostrar "Nenhum item cadastrado" em vez do chevron.
- Os botões Editar / Duplicar / Excluir continuam visíveis no rodapé do card (não dentro do accordion).

## Carregamento

- Lazy-load: a lista atual só tem `item_count`. Ao expandir um kit pela primeira vez, fazer um único fetch:
  - `supabase.from("product_kit_items").select("item_type, supply_id, process_step_id, role, quantity_formula, quantity_value").eq("kit_id", k.id).order("position")`
  - Resolver `supply_label` via uma busca em lote de `supplies(id, produto)` (cachear no estado).
  - Resolver `process_label` via o `processes` já carregado.
- Estado novo no componente:
  - `expandedKits: Set<string>` — quais cards estão abertos.
  - `kitItemsCache: Record<string, ReadonlyKitItem[]>` — itens já carregados.
  - `loadingKits: Set<string>` — mostra um `Loader2` enquanto carrega.
- Exibir spinner pequeno enquanto carrega; em caso de erro, mostrar texto vermelho discreto "Falha ao carregar itens".
- Após salvar/editar/excluir um kit (`fetchAll`), limpar o cache do(s) kit(s) afetado(s) para que a próxima expansão refaça o fetch.

## Implementação

- Usar `<Collapsible>` / `<CollapsibleTrigger>` / `<CollapsibleContent>` (já importado no arquivo) envolvendo o conteúdo do card. Isso dá animação de abrir/fechar pronta.
- Tipo local `ReadonlyKitItem { kind: "supply"|"process"; label: string; role: KitItemRole; formula: string }`.
- Toda mudança fica em `src/pages/KitsProduto.tsx` (arquivo único, apresentação). Sem mudança de schema, sem mudança de regras de negócio.

## Fora do escopo

- Edição inline dos itens (continua só via "Editar").
- Mudança no dialog de edição.
- Mudança nos outros cards do sistema.