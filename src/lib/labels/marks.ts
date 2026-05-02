// =============================================================================
// Marcas de registro (ARMS) — padrão SignMaster / Teneth
// =============================================================================
// Marcas SUPERIORES (TL/TR): "L" abrindo para fora da folha (vértice no
// canto da área útil, dois braços perpendiculares de 5mm).
//
// Marcas INFERIORES (BL/BR): "cruz lateral" — traço vertical longo (10mm)
// cruzado por traço horizontal curto (5mm) no meio. Posicionada FORA da
// área útil (afastada 3mm da margem lateral), na altura do canto inferior.
// É a marca de fim de leitura usada pelo SignMaster/Teneth como referência
// de eixo Y.
//
// Tipo "tick" foi mantido por compatibilidade com chamadas legadas, mas
// não é mais usado por padrão.
//
// Todas em K100 (preto puro), espessura 0.5pt.
// =============================================================================

export type MarkKind = "L" | "tick" | "cross";
export type Corner = "tl" | "tr" | "bl" | "br";

export interface MarkSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RegistrationMark {
  kind: MarkKind;
  corner: Corner;
  /** Vértice (para L) ou ponto central (para tick/cross), em mm. */
  vertexX: number;
  vertexY: number;
  /** Comprimento do braço (L) ou metade do tick. Para "cross" é referência. */
  arm: number;
}

export interface MarksLayout {
  marks: RegistrationMark[];
  offsetY: number;
}

export const MARK_ARM_MM = 5;
export const TICK_LEN_MM = 10;
export const MARK_STROKE_PT = 0.5;

// "Cruz lateral" inferior — dimensões reais do plotter (anexo CorelDRAW)
export const CROSS_VERT_LEN_MM = 10;
export const CROSS_HORIZ_LEN_MM = 5;
export const CROSS_OUTSIDE_GAP_MM = 3;

// Mantido por compatibilidade com chamadas antigas que importam MARK_SIZE_MM.
export const MARK_SIZE_MM = MARK_ARM_MM;

/**
 * Constrói as 4 marcas de canto.
 * - TL e TR: kind="L", vértice no canto da área útil
 * - BL e BR: kind="cross", posicionada FORA da área útil (lateralmente),
 *   na altura do canto inferior da área útil
 *
 * `offsetY` desloca verticalmente o conjunto inteiro (positivo = para baixo).
 * `bottomOffsetY` desloca apenas as marcas inferiores (BL/BR) — somado ao offsetY global.
 */
export function buildCornerMarks(
  sheetW: number,
  sheetH: number,
  marginTop: number,
  marginBottom: number,
  marginLeft: number,
  marginRight: number,
  offsetY = 0,
  arm = MARK_ARM_MM,
  bottomOffsetY = 0,
): MarksLayout {
  // Cantos da área útil
  const left = marginLeft;
  const right = sheetW - marginRight;
  const topY = marginTop + offsetY;
  // Marcas inferiores: alinhadas ao canto inferior da área útil
  const bottomY = (sheetH - marginBottom) + offsetY + bottomOffsetY;
  // Posicionadas fora da área útil, lateralmente
  const crossLeftX = left - CROSS_OUTSIDE_GAP_MM;
  const crossRightX = right + CROSS_OUTSIDE_GAP_MM;

  return {
    offsetY,
    marks: [
      { kind: "L", corner: "tl", vertexX: left, vertexY: topY, arm },
      { kind: "L", corner: "tr", vertexX: right, vertexY: topY, arm },
      { kind: "cross", corner: "bl", vertexX: crossLeftX, vertexY: bottomY, arm },
      { kind: "cross", corner: "br", vertexX: crossRightX, vertexY: bottomY, arm },
    ],
  };
}

/**
 * Bounding box (mm) ocupado pela marca de registro.
 * Útil para detecção de colisão com a grade de etiquetas.
 */
export function markBoundingBox(mark: RegistrationMark): { x: number; y: number; w: number; h: number } {
  const { kind, corner, vertexX: x, vertexY: y, arm } = mark;
  if (kind === "tick") {
    return { x: x - arm, y: y - 0.1, w: arm * 2, h: 0.2 };
  }
  if (kind === "cross") {
    const hh = CROSS_VERT_LEN_MM / 2;
    const inward = corner === "br" ? -1 : 1;
    const xMin = inward > 0 ? x : x - CROSS_HORIZ_LEN_MM;
    return { x: xMin, y: y - hh, w: CROSS_HORIZ_LEN_MM, h: hh * 2 };
  }
  // L: braços apontam para dentro da área útil
  const sx = corner === "tl" || corner === "bl" ? 1 : -1;
  const sy = corner === "tl" || corner === "tr" ? 1 : -1;
  const xMin = sx > 0 ? x : x - arm;
  const yMin = sy > 0 ? y : y - arm;
  return { x: xMin, y: yMin, w: arm, h: arm };
}

/**
 * Retorna os segmentos de linha da marca, em mm.
 * - L: 2 segmentos perpendiculares partindo do vértice
 * - tick: 1 segmento horizontal centrado em vertexX
 * - cross: 2 segmentos cruzados (vertical longo + horizontal curto)
 */
export function markSegments(mark: RegistrationMark): MarkSegment[] {
  const { kind, corner, vertexX: x, vertexY: y, arm } = mark;
  if (kind === "tick") {
    return [{ x1: x - arm, y1: y, x2: x + arm, y2: y }];
  }
  if (kind === "cross") {
    // "T deitado": traço vertical longo + perna horizontal apontando
    // SEMPRE para DENTRO da área útil (BL → para a direita; BR → para a esquerda).
    const hh = CROSS_VERT_LEN_MM / 2;
    const inward = corner === "br" ? -1 : 1; // BL aponta +x, BR aponta -x
    return [
      { x1: x, y1: y - hh, x2: x, y2: y + hh }, // vertical longa
      { x1: x, y1: y, x2: x + inward * CROSS_HORIZ_LEN_MM, y2: y }, // perna p/ dentro
    ];
  }
  // L: braços apontam SEMPRE para DENTRO da área útil (vértice no canto
  // externo da área útil). Padrão CorelDRAW/plotter visto no anexo:
  // TL → arms vão +x (direita) e +y (baixo); TR → -x e +y; etc.
  const sx = corner === "tl" || corner === "bl" ? 1 : -1;
  const sy = corner === "tl" || corner === "tr" ? 1 : -1;
  return [
    { x1: x, y1: y, x2: x + sx * arm, y2: y }, // braço horizontal
    { x1: x, y1: y, x2: x, y2: y + sy * arm }, // braço vertical
  ];
}

/**
 * Mantida por compatibilidade. Com o novo modelo (marcas inferiores como
 * cruz lateral fora da área útil), não há mais colisão a sugerir — o ajuste
 * vertical é decisão do operador, baseada no sensor da impressora.
 */
export function suggestMarksOffset(
  _marginTop: number,
  _labelH: number,
  _gap: number,
  _rows: number,
): number {
  return 0;
}
