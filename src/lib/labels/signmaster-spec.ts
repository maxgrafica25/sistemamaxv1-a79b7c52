// =============================================================================
// Layout paramétrico SignMaster — etiquetas circulares em folha retangular
// =============================================================================
// Implementação 1-para-1 da especificação técnica do cliente. Todas as medidas
// internas em MILÍMETROS (a spec usa cm, multiplicamos por 10).
//
// Fórmulas-chave (mm):
//   step             = labelDiameter + 3
//   labelsPerRow     = floor((sheetW − 14 + 3) / step)
//   labelsPerColumn  = floor((sheetH − 14 + 3) / step)
//   offsetX          = (sheetW − totalGridWidth)  / 2
//   offsetY          = (sheetH − totalGridHeight) / 2 − 1
//
// Validação de referência: 320×450 mm + Ø50 mm  →  5 × 8 = 40 etiquetas.
// =============================================================================

// ---------- Constantes (mm) --------------------------------------------------

export const SM_LABEL_SPACING = 3;       // gap entre etiquetas (3 mm)
export const SM_REG_MARK_MARGIN = 7;     // margem das marcas até a borda (7 mm)
export const SM_MARK_LENGTH = 15;        // braço das marcas (15 mm)
export const SM_MARK_THICKNESS = 2;      // espessura das marcas (2 mm)
export const SM_BOTTOM_MARK_TICK = 3;    // tique horizontal das marcas em "T" (3 mm)
export const SM_VERTICAL_NUDGE = -1;     // deslocamento vertical fixo da grade (-1 mm)
export const SM_BOTTOM_MARK_VERTICAL = 15; // comprimento total da haste vertical do "T" inferior (15 mm = 7.5 + 7.5)

// ---------- Tipos públicos ---------------------------------------------------

export interface SignmasterLayoutInput {
  /** Largura da folha em mm. */
  sheetW: number;
  /** Altura da folha em mm. */
  sheetH: number;
  /** Diâmetro da etiqueta circular em mm. */
  labelDiameter: number;
}

export interface SignmasterPosition {
  /** Coluna (0-indexed). */
  col: number;
  /** Linha (0-indexed). */
  row: number;
  /** Canto superior-esquerdo do bounding box, em mm. */
  x: number;
  y: number;
  /** Centro do círculo, em mm. */
  cx: number;
  cy: number;
}

export interface SignmasterLayout {
  labelsPerRow: number;
  labelsPerColumn: number;
  total: number;
  step: number;
  totalGridWidth: number;
  totalGridHeight: number;
  offsetX: number;
  offsetY: number;
  /** Y do final da grade (canto inferior do bbox da última linha). */
  gridBottom: number;
  positions: SignmasterPosition[];
}

export const computeSignmasterLayout = (
  input: SignmasterLayoutInput,
): SignmasterLayout => {
  const { sheetW, sheetH, labelDiameter } = input;

  if (labelDiameter <= 0 || sheetW <= 0 || sheetH <= 0) {
    return {
      labelsPerRow: 0, labelsPerColumn: 0, total: 0, step: 0,
      totalGridWidth: 0, totalGridHeight: 0,
      offsetX: 0, offsetY: 0, gridBottom: 0, positions: [],
    };
  }

  const step = labelDiameter + SM_LABEL_SPACING;
  const usableW = sheetW - 2 * SM_REG_MARK_MARGIN;
  const usableH = sheetH - 2 * SM_REG_MARK_MARGIN;

  const labelsPerRow = Math.max(0, Math.floor((usableW + SM_LABEL_SPACING) / step));
  const labelsPerColumn = Math.max(0, Math.floor((usableH + SM_LABEL_SPACING) / step));
  const total = labelsPerRow * labelsPerColumn;

  const totalGridWidth = labelsPerRow > 0
    ? labelsPerRow * labelDiameter + (labelsPerRow - 1) * SM_LABEL_SPACING
    : 0;
  const totalGridHeight = labelsPerColumn > 0
    ? labelsPerColumn * labelDiameter + (labelsPerColumn - 1) * SM_LABEL_SPACING
    : 0;

  const offsetX = (sheetW - totalGridWidth) / 2;
  const offsetY = (sheetH - totalGridHeight) / 2 + SM_VERTICAL_NUDGE;
  const gridBottom = offsetY + totalGridHeight;

  const positions: SignmasterPosition[] = [];
  for (let row = 0; row < labelsPerColumn; row++) {
    for (let col = 0; col < labelsPerRow; col++) {
      const x = offsetX + col * step;
      const y = offsetY + row * step;
      positions.push({
        col, row, x, y,
        cx: x + labelDiameter / 2,
        cy: y + labelDiameter / 2,
      });
    }
  }

  return {
    labelsPerRow, labelsPerColumn, total, step,
    totalGridWidth, totalGridHeight,
    offsetX, offsetY, gridBottom, positions,
  };
};

// ---------- Marcas de registro ----------------------------------------------
//
// Formato:
//   - TL/TR: "L" com vértice em (7,7) / (sheetW−7, 7), braços de 15 mm
//     apontando PARA DENTRO da folha.
//   - BL/BR: "T" com haste vertical de 15 mm centrada em x=7 / x=sheetW−7,
//     mais um tique horizontal de 3 mm partindo da haste em direção ao
//     interior da folha, à altura de bottomMarkY.

export interface SignmasterMarksInput {
  sheetW: number;
  sheetH: number;
  /** Y final da grade (mm). Usado para posicionar as marcas inferiores. */
  gridBottom: number;
  /** Override manual da posição Y das marcas em "T" (mm). Default: gridBottom + 5. */
  bottomMarkY?: number;
}

export interface MarkSegment {
  x1: number; y1: number; x2: number; y2: number;
}

export interface SignmasterMarks {
  /** Y efetivamente usado para as marcas em "T". */
  bottomMarkY: number;
  topLeft: MarkSegment[];
  topRight: MarkSegment[];
  bottomLeft: MarkSegment[];
  bottomRight: MarkSegment[];
  /** Todos os segmentos achatados (útil para SVG/.plt). */
  all: MarkSegment[];
}

export const computeSignmasterMarks = (
  input: SignmasterMarksInput,
): SignmasterMarks => {
  const { sheetW, sheetH, gridBottom, bottomMarkY: overrideY } = input;

  const M = SM_REG_MARK_MARGIN;
  const L = SM_MARK_LENGTH;
  const TICK = SM_BOTTOM_MARK_TICK;
  const HALF = SM_BOTTOM_MARK_VERTICAL / 2; // 7.5 mm

  // Marcas em L (vértice no canto interno, braços para dentro)
  const topLeft: MarkSegment[] = [
    { x1: M, y1: M, x2: M + L, y2: M },     // braço horizontal →
    { x1: M, y1: M, x2: M, y2: M + L },     // braço vertical ↓
  ];
  const topRight: MarkSegment[] = [
    { x1: sheetW - M, y1: M, x2: sheetW - M - L, y2: M },
    { x1: sheetW - M, y1: M, x2: sheetW - M, y2: M + L },
  ];

  // Marcas em T inferiores
  const computedY = Math.min(gridBottom + 5, sheetH - 10);
  const bottomMarkY = overrideY != null ? overrideY : computedY;

  const bottomLeft: MarkSegment[] = [
    { x1: M, y1: bottomMarkY - HALF, x2: M, y2: bottomMarkY + HALF }, // haste vertical
    { x1: M, y1: bottomMarkY, x2: M + TICK, y2: bottomMarkY },         // tique →
  ];
  const bottomRight: MarkSegment[] = [
    { x1: sheetW - M, y1: bottomMarkY - HALF, x2: sheetW - M, y2: bottomMarkY + HALF },
    { x1: sheetW - M, y1: bottomMarkY, x2: sheetW - M - TICK, y2: bottomMarkY },
  ];

  return {
    bottomMarkY,
    topLeft, topRight, bottomLeft, bottomRight,
    all: [...topLeft, ...topRight, ...bottomLeft, ...bottomRight],
  };
};

// ---------- Otimizador de retalho (modo paramétrico) ------------------------
//
// Espelha `findShrinkOpportunity` do layout genérico, mas aplicando as
// fórmulas SignMaster. Como o modo paramétrico só vale para etiquetas
// circulares (W = H = diâmetro), só faz sentido reduzir o diâmetro.
// Testa reduções pequenas (0.5 / 1 / 1.5 / 2 / 2.5 / 3 mm) e devolve a
// melhor sugestão se algum diâmetro menor fizer caber MAIS etiquetas/folha.

export interface SignmasterShrinkSuggestion {
  newLabelW: number;
  newLabelH: number;
  newPerSheet: number;
  delta: number;
  extraUnitsForSameSheets: number;
  shrinkW: number;
  shrinkH: number;
}

const SM_MIN_DIAMETER = 5; // mm — trava de segurança

export const findSignmasterShrinkOpportunity = (
  base: SignmasterLayoutInput,
  originalPerSheet: number,
  sheetsForOriginal: number,
): SignmasterShrinkSuggestion | null => {
  const candidates = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

  let best: SignmasterShrinkSuggestion | null = null;
  for (const d of candidates) {
    const newDiameter = +(base.labelDiameter - d).toFixed(2);
    if (newDiameter < SM_MIN_DIAMETER) continue;

    const r = computeSignmasterLayout({
      sheetW: base.sheetW,
      sheetH: base.sheetH,
      labelDiameter: newDiameter,
    });
    if (r.total <= originalPerSheet) continue;

    const delta = r.total - originalPerSheet;
    const candidate: SignmasterShrinkSuggestion = {
      newLabelW: newDiameter,
      newLabelH: newDiameter,
      newPerSheet: r.total,
      delta,
      extraUnitsForSameSheets: delta * Math.max(1, sheetsForOriginal),
      shrinkW: d,
      shrinkH: d,
    };

    if (
      !best ||
      candidate.delta > best.delta ||
      (candidate.delta === best.delta && d < best.shrinkW)
    ) {
      best = candidate;
    }
  }

  return best;
};
