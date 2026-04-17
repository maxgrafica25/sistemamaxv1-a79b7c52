
**Mudança em `src/components/monitoramento/ProductPicker.tsx`:**

Mover o botão "Cadastrar novo" para **dentro do `CommandList`**, como um `CommandItem` no topo (ou em um `CommandGroup` próprio "Criar novo"), assim ele aparece visualmente como uma opção da lista — o que é o comportamento natural esperado.

**Lógica:**
1. Remover o `<div className="border-t p-2">` do rodapé.
2. Dentro de `<CommandList>`, antes do `CommandGroup` dos produtos, adicionar:
   - Quando `trimmedSearch && !hasExactMatch`: um `CommandGroup heading="Criar novo"` com um `CommandItem` "➕ Cadastrar: '{trimmedSearch}'" que chama `handleCreateNew`.
3. Atualizar o placeholder do `CommandInput` para deixar mais claro: "Digite o nome do produto..." (já indica ação).
4. Atualizar o `CommandEmpty` para algo mais sutil, já que o item de criação aparecerá acima dele.

**Por que isso resolve:** o usuário vê a opção de cadastrar **junto** com os resultados de busca, no mesmo fluxo visual de seleção, sem rodapé separado. Funciona exatamente como combobox de criação do GitHub/Linear.

**Detalhe técnico cmdk:** o `CommandItem` precisa de um `value` único que **inclua o texto digitado** (ex: `value={\`__create__${trimmedSearch}\`}`) para o filtro fuzzy do cmdk não escondê-lo, e `forceMount` ou um `value` que sempre case com o input.
