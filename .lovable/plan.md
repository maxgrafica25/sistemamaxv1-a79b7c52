## UX: Formato preset no Modo Apostila

Reduzir poluição visual no `PrintingItemEditor` quando `productKind` for "Apostila(s)" usando revelação progressiva dos campos de dimensão.

### Comportamento

Quando `isApostilaKind(productKind)` for verdadeiro:

1. **Ocultar** os inputs `Largura (cm)` e `Altura (cm)`.
2. Exibir, no mesmo slot, um `<Select>` rotulado **"Formato"** com 3 opções:
   - `A4` → 210 × 297 mm (default)
   - `A5` → 148 × 210 mm
   - `Personalizado` → revela os inputs manuais de Largura/Altura
3. Ao trocar a opção (exceto `Personalizado`), gravar imediatamente `widthMm` e `heightMm` do preset no item via `onItemChange`. Isso alimenta `calcSheetYield` normalmente — sem mudanças no engine.
4. Quando `Personalizado` for selecionado, mostrar os inputs de Largura/Altura abaixo do select, editáveis livremente (mesmo comportamento atual em cm, convertendo para mm internamente).

### Detecção do formato atual ao abrir

Ao montar/atualizar o editor, derivar o valor inicial do select a partir de `widthMm/heightMm`:
- 210×297 ou 297×210 → `A4`
- 148×210 ou 210×148 → `A5`
- Qualquer outro (ou ausente) → `Personalizado`

Isso garante que orçamentos salvos com A5 reabram já no preset correto, sem mostrar os inputs.

### Fora do escopo

- Tipos de produto não-apostila (mantêm os campos de dimensão visíveis como hoje).
- `calcSheetYield`, `pricing.ts`, schema do banco — nenhuma mudança.
- Catálogo de papéis continua sem filtro (A4/A3/SRA3 todos disponíveis).

### Arquivo afetado

- `src/components/orcamentos-v2/PrintingItemEditor.tsx` — único arquivo editado. Adiciona estado local `formatoPreset` ('a4' | 'a5' | 'custom'), bloco condicional substituindo os dois inputs de dimensão quando `isApostilaKind`, e handler que sincroniza `widthMm/heightMm` ao trocar preset.
