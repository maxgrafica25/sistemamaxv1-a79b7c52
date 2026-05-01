// =============================================================================
// Marcas de registro (ARMS) para leitura óptica do plotter
// =============================================================================

export interface RegistrationMark {
  /** Posição em mm (canto superior esquerdo da marca). */
  x: number;
  y: number;
  /** Tamanho em mm. */
  size: number;
}

export interface MarksLayout {
  marks: RegistrationMark[];
  /** Quanto o conjunto foi deslocado verticalmente em relação ao default. */
  offsetY: number;
}

export const MARK_SIZE_MM = 5;

/**
 * Calcula posição padrão das 4 marcas de canto, dentro da área útil.
 * Aplica `offsetY` (mm) ao conjunto inteiro.
 */
export function buildCornerMarks(
  sheetW: number,
  sheetH: number,
  marginTop: number,
  marginBottom: number,
  marginLeft: number,
  marginRight: number,
  offsetY = 0,
  size = MARK_SIZE_MM,
): MarksLayout {
  const left = Math.max(0, marginLeft - size - 1);
  const right = sheetW - Math.max(0, marginRight - 1);
  const top = Math.max(0, marginTop - size - 1) + offsetY;
  const bottom = sheetH - Math.max(0, marginBottom - 1) + offsetY;
  return {
    offsetY,
    marks: [
      { x: left, y: top, size },
      { x: right, y: top, size },
      { x: left, y: bottom - size, size },
      { x: right, y: bottom - size, size },
    ],
  };
}

/**
 * Sugere offsetY que centraliza as marcas no gap entre fileiras de etiquetas,
 * evitando sobreposição com a arte. Retorna 0 se não houver ganho claro.
 */
export function suggestMarksOffset(
  marginTop: number,
  labelH: number,
  gap: number,
  rows: number,
): number {
  if (rows <= 0 || gap <= 0) return 0;
  // O ideal é alinhar a marca superior com o meio do primeiro gap (entre row 0 e row 1)
  const firstGapCenter = marginTop + labelH + gap / 2;
  const currentMarkY = marginTop;
  const offset = firstGapCenter - currentMarkY - MARK_SIZE_MM / 2;
  // Limita a um range razoável
  if (offset < -10) return -10;
  if (offset > 10) return 10;
  return Math.round(offset * 10) / 10;
}
