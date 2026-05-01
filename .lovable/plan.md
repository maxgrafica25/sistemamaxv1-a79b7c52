
# Calculadora de Etiquetas — Refatoração Completa (Final)

Versão final do plano com todos os adendos: split de UI, formato redondo, presets, dialog de configurações, WhatsApp copy e upload de arte com **enquadramento `contain`** (preserva proporção, centraliza, expõe sobras).

---

## 1. `src/lib/labels/layout.ts`

```ts
export type LabelShape = "quadrado" | "redondo" | "personalizado";
export const SHAPE_LABELS: Record<LabelShape, string>;
```

- `LayoutInput.shape?: LabelShape` (opcional, default `quadrado`).
- Matemática inalterada — redondo usa bounding box quadrado. Comentário explicando.

## 2. Novo: `src/lib/labels/config-storage.ts`

Persistência única em `labelCalc:config:v1`:

```ts
interface CustomSheetPreset { id; label; width; height }
interface LabelPreset { id; label; shape; width; height }
interface LabelCalcConfig {
  sheetPresetId; sheetW; sheetH;
  cutType; marginTop; marginBottom; marginLeft; marginRight; gap;
  pricePerSheet;
  customSheets: CustomSheetPreset[];
  labelPresets: LabelPreset[];
}
```

API: `loadConfig`, `saveConfig`, `addLabelPreset`, `removeLabelPreset`, `addCustomSheet`, `removeCustomSheet`. Migra silenciosamente `labelCalc:lastPricePerSheet`. Seeda 3 favoritos (Lacre 40×40, Validade 20×20, Redonda Ø50) na 1ª execução.

## 3. Novo: `src/lib/labels/whatsapp.ts`

Função pura `formatWhatsAppQuote` produzindo:

```
Olá! Segue orçamento de etiquetas:

📋 Pedido: 100 un · Quadrado 50×50mm
💰 Total: R$ 15,00 (R$ 0,15/un)

✨ Sugestão: 1.000 un por R$ 90,00 (R$ 0,09/un — 40% mais barato)
```

Redondo → `Redonda Ø50mm`. Personalizado → `50×30mm`. Tier 3 só entra se existe e `unitDeltaPct < 0`.

## 4. Novo: `src/lib/labels/image-fit.ts`

Helper puro pra calcular o enquadramento `contain` da imagem dentro do bounding box da etiqueta:

```ts
export function fitContain(
  imgW: number, imgH: number,
  boxW: number, boxH: number,
): { width: number; height: number; offsetX: number; offsetY: number } {
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const width = imgW * scale;
  const height = imgH * scale;
  return {
    width, height,
    offsetX: (boxW - width) / 2,   // centraliza horizontal
    offsetY: (boxH - height) / 2,  // centraliza vertical
  };
}
```

Testado isoladamente — o componente só consome.

## 5. Novo: `src/components/labels/LabelCalcSettingsDialog.tsx`

Dialog com 4 seções empilhadas:

1. **Folha** — Select com presets fixos (A4/A3/SRA3/Carta) + customs. Botão `+ Cadastrar nova folha` (mini-form inline). Lixeira ao lado de cada custom.
2. **Tipo de corte** — ToggleGroup; trocar aplica defaults de margens.
3. **Margens direcionais + gap** — 5 campos + botão "Restaurar padrões deste corte".
4. **Preço da folha de produção** — campo R$.

Validação para Salvar: `sheetW>0 && sheetH>0 && marginTop+marginBottom<sheetH && marginLeft+marginRight<sheetW`.

## 6. Refatoração `LabelLayoutCalculator.tsx`

### Coluna esquerda — card único "Simulador"

- **Formato:** ToggleGroup `[Quadrado] [Redondo] [Personalizado]`.
- **⭐ Carregar favorito** — Select compacto com `labelPresets`.
- **Tamanho:** quadrado/redondo → 1 campo (Lado/Diâmetro) que atualiza W e H juntos. Personalizado → 2 campos.
- **Quantidade.**
- **💾 Salvar como favorito** → popover com input → `addLabelPreset` + toast.
- **🖼️ Arte da etiqueta (opcional)** — disponível **nos 3 formatos**:
  - `<input type="file" accept="image/png,image/jpeg,image/webp">`.
  - Validação ≤ 2 MB.
  - Convertido para data URL (`FileReader.readAsDataURL`) — **só em memória**, não persiste.
  - Pré-leitura das dimensões naturais da imagem (`new Image(); .onload → naturalWidth/naturalHeight`) para alimentar `fitContain`.
  - Botão "🗑️ Remover" + nome do arquivo.
  - Disclaimer: *"A imagem é só para visualização — o cálculo usa apenas as medidas informadas."*
  - Aviso âmbar quando a proporção da imagem **diverge** da proporção da etiqueta em mais de ~5%: *"⚠ Sua arte tem proporção diferente da etiqueta — vai sobrar espaço nas laterais (ou topo/base)."*

### Faixa-resumo (abaixo do card)

```
Folha A4 (210×297) · Corte reto · R$ 15,00/folha   [⚙ Configurações]
```

Botão abre o `LabelCalcSettingsDialog`. Se `pricePerSheet === 0`, faixa em destaque âmbar.

### Coluna direita — Preview SVG (a parte sensível)

Refatorar `SheetPreview` para suportar shape + imagem com `contain`:

- `quadrado` / `personalizado` → `<rect>` por etiqueta.
- `redondo` → `<circle>` por etiqueta.

**Renderização da imagem (contain + centralizada):**
- Se há `imageDataUrl`:
  1. Calcula `fit = fitContain(imgNaturalW, imgNaturalH, labelW, labelH)`.
  2. Para **cada** etiqueta na grade (cell em coordenada `cx, cy`):
     - Renderiza um `<g>` posicionado em `(cx + fit.offsetX, cy + fit.offsetY)`.
     - Dentro dele, um `<image href={dataUrl} width={fit.width} height={fit.height}>` — **sem** `preserveAspectRatio="slice"`. Como já estamos passando largura/altura calculadas pelo `fitContain`, a imagem entra exatamente proporcional, sem corte e sem distorção.
     - Para `redondo`: aplicar `clipPath` circular único reaproveitado via `<defs><clipPath id="clip-round-${i,j}"><circle .../></clipPath></defs>` — isso esconde a parte da imagem que sobrasse fora do círculo (caso a sobra do `contain` caia em região canto). O bounding box do `contain` é retangular; sem clip, o canto da imagem aparece "fora" do círculo. Com clip, fica perfeito.
  3. **Forma da etiqueta (rect/circle)** continua renderizada *atrás* da imagem com fill leve (`fill-primary/5`) — assim, quando a arte tem proporção diferente, o usuário vê visualmente as "sobras" como áreas claras dentro do contorno da etiqueta. **Esse é o alerta visual exato que você pediu.**
- Se não há imagem: renderiza só a forma com fill leve atual.

**Importante:** `preserveAspectRatio` do `<svg>` raiz não é alterado — a folha continua escalando proporcionalmente no container.

### Pricing principal — adições

Botões lado a lado:
- `📋 Copiar para WhatsApp` — `navigator.clipboard.writeText` + toast.
- `↗ Abrir WhatsApp` — `window.open("https://wa.me/?text=" + encodeURIComponent(text))`.

Otimizador (Lâmpada) e Ancoragem permanecem inalterados.

## 7. Testes — `src/test/labels-layout.test.ts`

- `loadConfig` retorna defaults com localStorage vazio.
- `saveConfig` faz merge sem perder `labelPresets`.
- Migração da chave antiga `labelCalc:lastPricePerSheet`.
- `addLabelPreset` / `removeLabelPreset`.
- `formatWhatsAppQuote` nos 3 formatos + omite tier 3 quando ausente.
- Redondo produz mesmo `perSheet` que quadrado para mesmo lado.
- **`fitContain`**:
  - imagem quadrada em box quadrado → preenche tudo, offset zero.
  - imagem 2:1 em box 1:1 → largura = boxW, altura = boxW/2, `offsetY > 0`, `offsetX === 0`.
  - imagem 1:2 em box 1:1 → altura = boxH, largura = boxH/2, `offsetX > 0`, `offsetY === 0`.
  - imagem maior que o box → escala pra baixo proporcionalmente.

## 8. Arquivos tocados

```text
src/lib/labels/layout.ts                             [+ LabelShape, shape em LayoutInput]
src/lib/labels/config-storage.ts                     [novo]
src/lib/labels/whatsapp.ts                           [novo]
src/lib/labels/image-fit.ts                          [novo]
src/components/labels/LabelCalcSettingsDialog.tsx    [novo]
src/components/labels/LabelLayoutCalculator.tsx      [refatorado + upload + SVG contain + clip redondo]
src/test/labels-layout.test.ts                       [+ casos novos]
```

Sem mudanças em: `LabelLayoutDialog.tsx`, `CalculadoraEtiquetas.tsx`, `PrintingItemEditor.tsx` (prop `onApply` preservada).

---

## 9. Suposições que vou adotar (me corrija antes do "manda bala")

- Upload disponível **nos 3 formatos** (não só personalizado).
- Limite de **2 MB** por imagem.
- **PDF de gabarito fica para uma segunda rodada** (mantém este escopo enxuto).
- Aviso de proporção divergente aparece **automaticamente** quando |razão_arte − razão_etiqueta| > 5%.

Aprova? Se sim, mando bala e implemento tudo de uma vez.
