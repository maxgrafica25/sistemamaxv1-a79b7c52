# Vincular Grupos de Materiais ao cadastro de Suprimentos

## Objetivo

Eliminar a digitação manual de preços no módulo **Grupos de Materiais**. O usuário passa a **buscar e selecionar** um item já cadastrado em **Matérias-Primas → Suprimentos**, e o sistema usa o `valor_unitario` mestre — sempre atualizado.

---

## Mudanças no banco

Tabela `material_group_items`:

- Adicionar coluna `supply_id uuid REFERENCES public.supplies(id) ON DELETE SET NULL` (nullable, para preservar itens "avulsos" antigos).
- Manter `description`, `quantity`, `unit_price` como **fallback / snapshot** (caso o suprimento seja excluído, o item ainda funciona com o último preço conhecido).
- Índice em `supply_id` para joins rápidos.

Sem migração de dados destrutiva — itens existentes continuam funcionando como texto livre.

---

## Mudanças na UI — `src/pages/GruposMateriais.tsx`

No diálogo de criar/editar grupo, cada linha de item passa a ter:

1. **Busca de suprimento** (componente novo `SupplySearch`, baseado no padrão de `MaterialCatalogSearch`):
   - Campo com ícone de lupa, autocomplete sobre `supplies.produto`.
   - Mostra fornecedor + `valor_unitario` atual em cada sugestão.
   - Ao selecionar: preenche `supply_id`, `description` (= `produto`) e `unit_price` (= `valor_unitario`) automaticamente.
2. **Quantidade** (editável, como hoje).
3. **Preço unitário** vira **somente leitura** quando há `supply_id` vinculado, com badge "🔗 vinculado ao cadastro" e botão "desvincular" (volta a ser texto/preço livre).
4. **Subtotal** calculado normalmente.

Ao salvar:
- Se `supply_id` presente → grava o vínculo + snapshot do preço atual.
- Se item livre (sem vínculo) → grava só `description` + `unit_price` digitado (modo legado, ainda suportado).

### Listagem do grupo (cards)

- Ler `valor_unitario` **vivo** da `supplies` via join quando `supply_id` existe (preço sempre atualizado, mesmo que o snapshot esteja velho).
- Itens vinculados mostram um pequeno ícone de link 🔗 ao lado da descrição.

---

## Mudanças no carregamento dentro do orçamento

`src/components/orcamentos-v2/LoadFromGroupDialog.tsx`:
- Ao buscar `material_group_items`, fazer join com `supplies` e usar `supplies.valor_unitario` quando `supply_id` existir.
- Assim, ao carregar um grupo num orçamento, o preço importado já é o **mais recente** do cadastro mestre — exatamente o comportamento que você pediu.
- O usuário continua podendo editar a cópia local livremente (regra atual de "cópia editável" preservada).

---

## Detalhes técnicos

- Componente novo: `src/components/orcamentos-v2/SupplySearch.tsx` (reutilizável, recebe `onSelect(supply)`).
- Query padrão: `supabase.from("supplies").select("id, produto, fornecedor, valor_unitario").order("produto")`.
- Tipo do item no estado local do diálogo ganha `supply_id?: string | null`.
- Persistência: `material_group_items` recebe `supply_id` no `insert`.
- Compatibilidade: itens antigos (sem `supply_id`) seguem funcionando — UI detecta ausência e exibe campos editáveis como hoje.

---

## Fora de escopo (mantido como está)

- Estrutura da tabela `supplies` não muda.
- Página `/materias-primas` não muda.
- Fluxo de Grupos de **Mão de Obra** não muda.
