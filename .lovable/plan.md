
**Problema:** Hoje o `ProductPicker` tem dois modos separados (`existing` e `new`) e exige um botão "← Voltar" para alternar. Isso é fricção desnecessária.

**Solução:** Remover os modos. Deixar sempre o combobox visível. Quando o usuário digitar algo na busca que não bate com nenhum produto, oferecer "Criar novo nome: '<texto digitado>'" como item da própria lista. Ao selecionar, vira um produto novo (id=null, name=texto).

**Mudanças em `src/components/monitoramento/ProductPicker.tsx`:**

1. Remover `mode` state, o bloco `mode === "new"` (Input + botão voltar) e a alternância.
2. Manter apenas o `Popover` + `Command`.
3. Capturar o termo digitado no `CommandInput` via state `search`.
4. No `CommandEmpty` e/ou como item fixo no rodapé: "Criar novo nome: '{search}'" — onSelect dispara `onChange({ id: null, name: search })` e fecha popover.
5. Texto do botão (trigger) passa a mostrar `selectedName` quando `selectedId` é null mas há nome digitado (ex: "Panfleto Couché... (novo)"), ou o `nome_canonico` quando vinculado.
6. Remover o `useEffect` que sincroniza modo (não existe mais).

**Resultado:** Um único clique abre a lista, usuário busca, e se não achar cria direto pelo próprio item da lista — sem botões de "voltar".
