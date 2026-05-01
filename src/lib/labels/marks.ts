// =============================================================================
// Marcas de registro (ARMS) — padrão SignMaster / Teneth
// =============================================================================
// Marcas SUPERIORES (TL/TR): "L" abrindo para dentro da folha (vértice no
// canto da área útil, dois braços perpendiculares de 5mm).
//
// Marcas INFERIORES (BL/BR): traço horizontal único (~10mm) na base. O
// SignMaster usa esse padrão pra distinguir início de leitura (Ls em cima)
// de fim de leitura (ticks embaixo).
//
// Todas em K100 (preto puro), espessura 0.5pt.
// =============================================================================

export type MarkKind = "L" | "tick";
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
  /** Vértice (para L) ou ponto central (para tick), em mm. */
  vertexX: number;
  vertexY: number;
  /** Comprimento do braço (L) ou metade do tick. */
  arm: number;
}

export interface MarksLayout {
  marks: RegistrationMark[];
  offsetY: number;
}

export const MARK_ARM_MM = 5;
export const TICK_LEN_MM = 10;
export const MARK_STROKE_PT = 0.5;

// Mantido por compatibilidade com chamadas antigas que importam MARK_SIZE_MM.
export const MARK_SIZE_MM = MARK_ARM_MM;

/**
 * Constrói as 4 marcas de canto.
 * - TL e TR: kind="L", vértice no canto da área útil
 * - BL e BR: kind="tick", centrado no eixo X do canto da área útil,
 *   posicionado dentro da margem inferior
 *
 * `offsetY` desloca verticalmente o conjunto inteiro (positivo = para baixo).
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
): MarksLayout {
  // Cantos da área útil
  const left = marginLeft;
  const right = sheetW - marginRight;
  // Vértice do L exatamente no canto da área útil; braços ficam FORA (para
  // cima e para o lado externo), de modo que o L não invade a grade.
  const topY = marginTop + offsetY;
  // Tick na base: posicionado no meio da margem inferior
  const bottomY = sheetH - Math.max(0, marginBottom / 2) + offsetY;

  return {
    offsetY,
    marks: [
      { kind: "L", corner: "tl", vertexX: left, vertexY: topY, arm },
      { kind: "L", corner: "tr", vertexX: right, vertexY: topY, arm },
      { kind: "tick", corner: "bl", vertexX: left, vertexY: bottomY, arm: TICK_LEN_MM / 2 },
      { kind: "tick", corner: "br", vertexX: right, vertexY: bottomY, arm: TICK_LEN_MM / 2 },
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
    // Linha horizontal de 2*arm centrada em vertexX, espessura desprezível (~0.2mm)
    return { x: x - arm, y: y - 0.1, w: arm * 2, h: 0.2 };
  }
  // L: dois braços partindo do vértice
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
 */
export function markSegments(mark: RegistrationMark): MarkSegment[] {
  const { kind, corner, vertexX: x, vertexY: y, arm } = mark;
  if (kind === "tick") {
    return [{ x1: x - arm, y1: y, x2: x + arm, y2: y }];
  }
  // L: braços apontam SEMPRE para fora da área útil (vértice no canto da
  // área útil). Garante que o L não invade a grade de etiquetas.
  // tl: -x e -y    tr: +x e -y    bl: -x e +y    br: +x e +y
  const sx = corner === "tl" || corner === "bl" ? -1 : 1;
  const sy = corner === "tl" || corner === "tr" ? -1 : 1;
  return [
    { x1: x, y1: y, x2: x + sx * arm, y2: y }, // braço horizontal
    { x1: x, y1: y, x2: x, y2: y + sy * arm }, // braço vertical
  ];
}

/**
 * Sugere offsetY que centraliza as marcas no gap entre fileiras de etiquetas.
 * Como agora a primeira linha pode ter "vão" interno (centralizada), a marca
 * em "L" raramente colide; ainda assim, oferecemos o ajuste para casos onde
 * o usuário queira aproximar visualmente a marca da arte.
 */
export function suggestMarksOffset(
  marginTop: number,
  labelH: number,
  gap: number,
  rows: number,
): number {
  if (rows <= 0 || gap <= 0) return 0;
  const firstGapCenter = marginTop + labelH + gap / 2;
  const currentMarkY = marginTop;
  const offset = firstGapCenter - currentMarkY - MARK_ARM_MM / 2;
  if (offset < -10) return -10;
  if (offset > 10) return 10;
  return Math.round(offset * 10) / 10;
}
