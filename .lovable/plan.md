## Ocultar busca de papel após seleção

No `PrintForm.tsx`, o campo "Miolo (papel do catálogo)" com o `PrintingItemSearch` fica visível mesmo depois que um item é escolhido, duplicando a função do botão "trocar" no card do item selecionado.

### Mudança

Em `src/components/orcamentos-v3/forms/PrintForm.tsx`, renderizar o bloco `<Field label="Item do catálogo">` (com o `PrintingItemSearch`) **apenas quando `!catalog`**. Quando houver papel selecionado, só o card resumo com o botão "trocar" aparece — clicar em "trocar" zera `catalog` e a busca volta automaticamente.

### Fora de escopo

- Lógica de catálogo, preços, acabamentos ou kits.
- Outros formulários (CV, Terceirizados).
- Comportamento do botão "trocar" em si (já funciona).

### Validação

Em `/orcamentos-v3/novo`: antes de escolher papel → busca visível. Após escolher → só o card. Clicar "trocar" → busca reaparece.