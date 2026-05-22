
## Objetivo

No preset **Etiquetas** do orçamento V3, deixar disponíveis apenas presets de etiquetas redondas nos diâmetros **35, 40, 50, 60 e 70 mm**, para as duas folhas usadas: **SRA3 (32×45)** e **A4 (21×29,7)**. Ao clicar num chip, o sistema já deixa pronto: folha, diâmetro, papel **adesivo** e acabamento **recorte de papel adesivo**.

## Mudanças

### 1. Seeds de presets de etiqueta (`src/lib/labels/config-storage.ts`)

Substituir `SEED_LABEL_PRESETS` pelos 10 presets pedidos (5 diâmetros × 2 folhas). Adicionar campo opcional `sheetId` ao tipo `LabelPreset` para o chip saber em qual folha aplicar.

```ts
export interface LabelPreset {
  id: string;
  label: string;
  shape: LabelShape;
  width: number;
  height: number;
  sheetId?: "SRA3" | "A4"; // novo, opcional
}

export const SEED_LABEL_PRESETS: LabelPreset[] = [
  { id: "seed-sra3-r35", label: "SRA3 · Ø35", shape: "redondo", width: 35, height: 35, sheetId: "SRA3" },
  { id: "seed-sra3-r40", label: "SRA3 · Ø40", shape: "redondo", width: 40, height: 40, sheetId: "SRA3" },
  { id: "seed-sra3-r50", label: "SRA3 · Ø50", shape: "redondo", width: 50, height: 50, sheetId: "SRA3" },
  { id: "seed-sra3-r60", label: "SRA3 · Ø60", shape: "redondo", width: 60, height: 60, sheetId: "SRA3" },
  { id: "seed-sra3-r70", label: "SRA3 · Ø70", shape: "redondo", width: 70, height: 70, sheetId: "SRA3" },
  { id: "seed-a4-r35",   label: "A4 · Ø35",   shape: "redondo", width: 35, height: 35, sheetId: "A4" },
  { id: "seed-a4-r40",   label: "A4 · Ø40",   shape: "redondo", width: 40, height: 40, sheetId: "A4" },
  { id: "seed-a4-r50",   label: "A4 · Ø50",   shape: "redondo", width: 50, height: 50, sheetId: "A4" },
  { id: "seed-a4-r60",   label: "A4 · Ø60",   shape: "redondo", width: 60, height: 60, sheetId: "A4" },
  { id: "seed-a4-r70",   label: "A4 · Ø70",   shape: "redondo", width: 70, height: 70, sheetId: "A4" },
];
```

Adicionar uma migração one-shot (flag `labelCalc.presetsMigratedV2`) em `loadConfig` para substituir os `labelPresets` antigos pelos novos em usuários existentes — sem mexer em folhas personalizadas nem em outras chaves.

### 2. Form embutido (`src/components/orcamentos-v3/forms/LabelEmbeddedForm.tsx`)

Ajustar `applyPreset` para também trocar a folha e forçar papel adesivo + recorte de adesivo:

- Se `p.sheetId` existir e for diferente do atual → `setSheetId(p.sheetId)`.
- Após aplicar o preset, garantir que `folha.paperKind === "adesivo"` (chama `folha.setPaperKind("adesivo")` se disponível).
- O hook `useFolhaPricing` já roda `pickDefaultFinishing` automaticamente ao trocar o papel, e essa heurística já prioriza o acabamento com nome contendo "adesiv" → resultado: recorte de papel adesivo selecionado sem código extra.
- O ToggleGroup de forma (Redonda/Quadrada/Personalizada) continua disponível para casos fora do preset.

### 3. Diálogo de gestão (`src/components/labels/LabelCalcSettingsDialog.tsx`)

Só exibir/editar `sheetId` opcional nos chips (campo extra no formulário do preset). Não obrigatório — se o usuário criar um preset sem folha, segue como hoje (aplica só shape+tamanho).

## Fora de escopo

- Não muda engine de cálculo (continua SignMaster para redondas).
- Não muda pricing nem UnifiedCart.
- Não toca em outros forms da V3.
