## Objetivo

Simplificar a lista de tamanhos de folha da Calculadora de Etiquetas, deixando apenas:

1. **A4** — 210 × 297 mm
2. **SRA3** — 320 × 450 mm
3. **Formatão** — 328 × 478 mm  *(novo nome do antigo "33×48"; ajustado para 32,8 × 47,8 cm conforme pedido)*
4. **Personalizado** — folhas custom criadas pelo usuário

Removidos: **A3** (29,7 × 42) e **Carta** (216 × 279).

## Mudanças

### 1. `src/lib/labels/layout.ts`
Reduzir `SHEET_PRESETS` para 3 entradas fixas (A4, SRA3, Formatão). O array completo passa a ser:

```ts
export const SHEET_PRESETS: SheetPreset[] = [
  { id: "A4",       label: "A4 (21 × 29,7 cm)",      width: 210, height: 297 },
  { id: "SRA3",     label: "SRA3 (32 × 45 cm)",      width: 320, height: 450 },
  { id: "Formatao", label: "Formatão (32,8 × 47,8 cm)", width: 328, height: 478 },
];
```

### 2. `src/components/labels/LabelLayoutCalculator.tsx`
- Atualizar o array local `QUICK_SHEETS` (linhas ~249-254) para refletir a mesma lista (A4, SRA3, Formatão) + a aba "Personalizado/Outro" que abre as Configurações.
- Atualizar o fallback em `sheetSizeKey` (linha 278) — manter `"SRA3"` como default.

### 3. `src/components/labels/LabelCalcSettingsDialog.tsx`
Nenhuma mudança estrutural: o `<Select>` em volta da linha 247 já itera `SHEET_PRESETS.map(...)`, então adota a nova lista automaticamente. Confirmar que o fallback "se a folha removida estava selecionada, volta para A4" (linha 172-174) continua válido.

### 4. Migração de usuários existentes
Em `src/lib/labels/config-storage.ts`, dentro de `loadConfig()`, adicionar uma migração silenciosa: se o `sheetPresetId` salvo for `"A3"`, `"Carta"` ou `"330x480"`, normalizar:
- `"330x480"` → `"Formatao"` com `sheetW: 328, sheetH: 478` (atualiza dimensão também).
- `"A3"` ou `"Carta"` → cair para `"A4"` (210 × 297).

Isso evita que alguém com config antiga fique com uma folha "fantasma" que não aparece mais nos seletores.

### 5. Memória
Atualizar `mem://features/label-calculator` registrando que as folhas suportadas são apenas A4, SRA3, Formatão (32,8 × 47,8) e Personalizado — qualquer tamanho fora disso deve ser cadastrado como folha custom.

## Arquivos a editar

- `src/lib/labels/layout.ts` — reduzir `SHEET_PRESETS` para 3 itens.
- `src/components/labels/LabelLayoutCalculator.tsx` — atualizar `QUICK_SHEETS`.
- `src/lib/labels/config-storage.ts` — migração de IDs antigos.
- `mem://features/label-calculator` — atualizar nota.

## Fora do escopo

- Mexer em `PrecoImpressao` (usa lista própria de tamanhos, independente).
- Adicionar UI para deletar/ocultar folhas standard (não há mais necessidade — só sobram 3 essenciais).
- Renomear/deletar folhas personalizadas (já é possível nas Configurações).
