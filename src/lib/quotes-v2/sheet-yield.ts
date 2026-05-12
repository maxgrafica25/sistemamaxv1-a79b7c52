// Cálculo de aproveitamento de folha de produção (visão interna do orçamentista).
// Folha padrão 328×478 mm, margem de segurança 5 mm por lado e sangria de 3 mm
// entre cada unidade do material. Testa as duas orientações e devolve a melhor.

export const PRODUCTION_SHEET = { widthMm: 328, heightMm: 478 } as const;
// Folha A4 — usada para apostilas (nunca impressas em A3).
export const A4_SHEET = { widthMm: 210, heightMm: 297 } as const;
export const SAFETY_MARGIN_MM = 5;
export const GUTTER_MM = 3;

export interface YieldResult {
  perSheet: number;
  orientation: "retrato" | "paisagem";
  sheetsNeeded: number;
  usableWidthMm: number;
  usableHeightMm: number;
}

const fits = (sideW: number, sideH: number, usableW: number, usableH: number) => {
  if (sideW <= 0 || sideH <= 0) return 0;
  const cols = Math.floor((usableW + GUTTER_MM) / (sideW + GUTTER_MM));
  const rows = Math.floor((usableH + GUTTER_MM) / (sideH + GUTTER_MM));
  return Math.max(0, cols) * Math.max(0, rows);
};

export function calcSheetYield(
  itemWidthMm: number,
  itemHeightMm: number,
  totalQty: number,
  sheet: { widthMm: number; heightMm: number } = PRODUCTION_SHEET,
): YieldResult | null {
  if (!itemWidthMm || !itemHeightMm || itemWidthMm <= 0 || itemHeightMm <= 0) return null;
  const usableW = sheet.widthMm - 2 * SAFETY_MARGIN_MM;
  const usableH = sheet.heightMm - 2 * SAFETY_MARGIN_MM;

  const portrait = fits(itemWidthMm, itemHeightMm, usableW, usableH);
  const landscape = fits(itemHeightMm, itemWidthMm, usableW, usableH);

  const perSheet = Math.max(portrait, landscape);
  if (perSheet <= 0) return null;

  const orientation: "retrato" | "paisagem" = portrait >= landscape ? "retrato" : "paisagem";
  const qty = Math.max(0, totalQty || 0);
  const sheetsNeeded = qty > 0 ? Math.ceil(qty / perSheet) : 0;

  return {
    perSheet,
    orientation,
    sheetsNeeded,
    usableWidthMm: usableW,
    usableHeightMm: usableH,
  };
}
