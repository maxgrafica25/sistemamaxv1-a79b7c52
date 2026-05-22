// Aproveitamento de cartões em folha (engine puro).
// Todas as dimensões em milímetros.

export interface YieldInput {
  /** Largura da folha (mm). */
  sheetW: number;
  /** Altura da folha (mm). */
  sheetH: number;
  /** Margem em todas as bordas (mm). */
  marginMm: number;
  /** Espaço entre cartões (mm). */
  gapMm: number;
  /** Largura do cartão (mm). */
  cardW: number;
  /** Altura do cartão (mm). */
  cardH: number;
}

export interface YieldResult {
  perSheet: number;
  cols: number;
  rows: number;
  orientation: "vertical" | "horizontal";
}

function fit(usable: number, card: number, gap: number): number {
  if (card <= 0 || usable < card) return 0;
  return Math.floor((usable + gap) / (card + gap));
}

export function calcCardsPerSheet(i: YieldInput): YieldResult {
  const usableW = Math.max(0, i.sheetW - 2 * i.marginMm);
  const usableH = Math.max(0, i.sheetH - 2 * i.marginMm);

  const vCols = fit(usableW, i.cardW, i.gapMm);
  const vRows = fit(usableH, i.cardH, i.gapMm);
  const vertical = vCols * vRows;

  const hCols = fit(usableW, i.cardH, i.gapMm);
  const hRows = fit(usableH, i.cardW, i.gapMm);
  const horizontal = hCols * hRows;

  if (horizontal > vertical) {
    return { perSheet: horizontal, cols: hCols, rows: hRows, orientation: "horizontal" };
  }
  return { perSheet: vertical, cols: vCols, rows: vRows, orientation: "vertical" };
}

export function sheetsNeeded(qtyCards: number, perSheet: number): number {
  if (perSheet <= 0 || qtyCards <= 0) return 0;
  return Math.ceil(qtyCards / perSheet);
}
