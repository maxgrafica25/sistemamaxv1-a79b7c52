## Ajustes de UX no `PrintingItemEditor.tsx`

Dois ajustes pontuais, isolados ao componente `src/components/orcamentos-v2/PrintingItemEditor.tsx`. Sem alterações no banco, no `calcSheetYield`, nem no fluxo de salvamento.

### 1. Tipo de Material — autocomplete realmente livre

Hoje o `Input` está envolto por `<PopoverTrigger asChild>`, o que faz o Radix interceptar eventos de teclado/clique e travar a digitação contínua (o popover "rouba" o foco e o usuário não consegue digitar texto livre fora das sugestões).

Mudança:
- Tirar o `Input` de dentro do `PopoverTrigger asChild`.
- Renderizar o `Input` normalmente e usar um `PopoverTrigger` invisível/âncora (ou controlar `open` manualmente sem `asChild`), mantendo o popover ancorado no input via `ref`.
- Garantir que `onChange` do input continue chamando `onItemChange({ productKind: e.target.value })` — qualquer texto livre é aceito ("Encarte Especial 3 Dobras" etc.).
- A lista de `PRODUCT_KIND_SUGGESTIONS` filtrada continua aparecendo como sugestão; clicar em uma sugestão preenche o campo, mas não é obrigatório.
- `CommandEmpty` mostra "Usar '<texto digitado>'" para reforçar que o valor livre será aceito.

### 2. Largura/Altura em centímetros (cm) na UI, milímetros (mm) no estado

A interface passa a operar em **cm**, mas o estado (`item.widthMm`, `item.heightMm`) e os cálculos (`calcSheetYield`, `PRODUCTION_SHEET` 328×478 mm) continuam em **mm**.

Mudanças nos dois inputs (largura e altura):
- Label: `Largura (cm)` e `Altura (cm)`.
- Placeholder: `10`, `15` (em vez de `100`, `150`).
- `value`: `item.widthMm != null ? item.widthMm / 10 : ""` (idem para altura).
- `onChange`: ao parsear o número digitado, **multiplicar por 10** antes de chamar `handleDimensionChange({ widthMm: cm * 10 })`. Suportar decimais (ex.: `15.5` → `155 mm`). Aceitar vírgula trocando por ponto antes do `parseFloat`.
- `step="0.1"` no input para facilitar decimais.

Nada muda em `handleDimensionChange`, `calcSheetYield`, no badge de rendimento, nem no `buildDynamicTitle` — todos continuam recebendo mm como hoje. O alerta vermelho de "excede folha de produção (328×478 mm)" continua funcionando inalterado, pois é calculado sobre os mm já convertidos.

### Fora de escopo

- `NewQuoteFormV2.tsx`, `QuoteItemsTable.tsx`, schema do banco, `calcSheetYield`, `buildDynamicTitle`.
- Conversão de itens já salvos (já estão em mm; a UI apenas divide por 10 para exibir).

### Arquivos alterados

- `src/components/orcamentos-v2/PrintingItemEditor.tsx` (único arquivo).
