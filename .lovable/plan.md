## Objetivo

Evitar duplicidade entre **Acabamentos** (cadastro precificado) e os itens do **Kit de Produto**. Hoje a aba "Processos" do picker lista todos os `production_steps` (granulares, sem preço), permitindo selecionar etapas avulsas que duplicam acabamentos já cadastrados (ex.: "Corte de 100 Cartões de visita" vs. "Corte reto").

## Mudanças

### 1. Picker (`src/components/kits/AddItemsPicker.tsx`)

Renomear a aba **Processos → Acabamentos** e trocar a fonte:

- Entrada: nova prop `finishings: { id, name, production_step_id }[]` em vez de `processes`.
- Lista somente registros de `finishings_price_items` que tenham `production_step_id` vinculado (os sem vínculo são ocultados — não podem ser usados no kit).
- Ao confirmar, devolve `PickedProcess` com `id = production_step_id` e `label = finishing.name`, mantendo o contrato atual com o restante do código.
- Sugestões automáticas e filtro de busca usam o `name` do acabamento.
- Ícone `Cog` → `Scissors` (Lucide) para reforçar "Acabamento".

### 2. Página do kit (`src/pages/KitsProduto.tsx`)

- Carregar `finishings_price_items` (`id, name, production_step_id, is_active`) junto dos dados iniciais e passar `finishings` (apenas ativos com `production_step_id`) para o picker, no lugar de `processes`.
- Em `CompactItemRow`, quando `item.item_type === "process"`, o select de "Processo" passa a se chamar **Acabamento** e lista os mesmos `finishings` ativos. O valor salvo continua sendo `process_step_id` (o `production_step_id` do acabamento) e `process_label` recebe o nome do acabamento.
- Cabeçalhos e textos auxiliares: "Adicionar acabamentos" mantém; troca "Selecionar processo…" → "Selecionar acabamento…"; rótulos "Processos" → "Acabamentos" onde aparecem.

### 3. Suprimentos (aba Suprimentos)

Sem mudanças funcionais — segue puxando de `useV3Supplies`. Mantém o atalho de Encadernação Espiral.

### 4. Compatibilidade com kits antigos

- Não há migração de dados. Itens já salvos com `process_step_id` que não correspondam a um `finishings_price_items.production_step_id` ainda aparecem no kit (mostrando o `process_label` salvo), mas o select de troca só oferecerá acabamentos cadastrados — forçando a normalização ao editar.
- Se quiser, adicionar badge "fora do cadastro" nesses casos para o admin migrar manualmente (opcional, posso incluir).

## Detalhes técnicos

- Tipos no picker:
  ```ts
  interface FinishingOption { id: string; name: string; production_step_id: string; }
  ```
  `PickedProcess.id` permanece sendo `production_step_id` (sem mudança de schema).
- Query nova em `KitsProduto.tsx`:
  ```ts
  supabase.from("finishings_price_items")
    .select("id, name, production_step_id, is_active")
    .eq("is_active", true)
    .not("production_step_id", "is", null)
    .order("name");
  ```
- Sem alteração de tabelas/RLS.

## Arquivos afetados

- `src/components/kits/AddItemsPicker.tsx`
- `src/pages/KitsProduto.tsx`
