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
  safetyMarginMm: number = SAFETY_MARGIN_MM,
): YieldResult | null {
  if (!itemWidthMm || !itemHeightMm || itemWidthMm <= 0 || itemHeightMm <= 0) return null;
  const usableW = sheet.widthMm - 2 * safetyMarginMm;
  const usableH = sheet.heightMm - 2 * safetyMarginMm;

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

/** Mapeia tamanho nominal de papel (A4/A3/SRA3/Carta…) para mm. */
export function sizeToMm(size?: string | null): { widthMm: number; heightMm: number } | null {
  if (!size) return null;
  const s = size.trim().toUpperCase();
  switch (s) {
    case "A4": return { widthMm: 210, heightMm: 297 };
    case "A3": return { widthMm: 297, heightMm: 420 };
    case "SRA3": return { widthMm: 320, heightMm: 450 };
    case "A5": return { widthMm: 148, heightMm: 210 };
    case "A2": return { widthMm: 420, heightMm: 594 };
    case "CARTA": return { widthMm: 216, heightMm: 279 };
    case "33X48": return { widthMm: 330, heightMm: 480 };
    default: {
      // tenta "WxH" ou "WxHmm"
      const m = s.match(/^(\d+(?:\.\d+)?)\s*X\s*(\d+(?:\.\d+)?)/);
      if (m) return { widthMm: Number(m[1]), heightMm: Number(m[2]) };
      return null;
    }
  }
}

export interface PaperSheetSource {
  isCutSize?: boolean | null;
  size?: string | null;
  purchaseSheetWidthMm?: number | null;
  purchaseSheetHeightMm?: number | null;
}

/**
 * Resolve a "folha de produção" a usar para um item de papel:
 * 1. is_cut_size → 1 peça por folha (ignora aproveitamento)
 * 2. purchase_sheet_*_mm preenchido → usa esse folhão custom
 * 3. fallback → PRODUCTION_SHEET global (SRA3)
 */
export function resolvePaperSheet(src: PaperSheetSource): {
  sheet: { widthMm: number; heightMm: number };
  forcePerSheetOne: boolean;
} {
  if (src.isCutSize) {
    const mm = sizeToMm(src.size) ?? PRODUCTION_SHEET;
    return { sheet: mm, forcePerSheetOne: true };
  }
  const w = Number(src.purchaseSheetWidthMm) || 0;
  const h = Number(src.purchaseSheetHeightMm) || 0;
  if (w > 0 && h > 0) {
    return { sheet: { widthMm: w, heightMm: h }, forcePerSheetOne: false };
  }
  return { sheet: PRODUCTION_SHEET, forcePerSheetOne: false };
}
