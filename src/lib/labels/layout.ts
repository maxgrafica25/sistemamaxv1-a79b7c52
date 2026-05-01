// =============================================================================
// Calculadora de Aproveitamento de Etiquetas
// =============================================================================
// Lógica pura, 100% testável. Sem dependências de React ou Supabase.
//
// Cobre:
//   1. computeLabelLayout      — quantas etiquetas cabem na folha (rotação 0/90)
//   2. computeSheetPricing     — preço total = folhas * preço da folha
//   3. buildAnchoringLadder    — tabela de upsell (qty, 2x qty, qty redonda)
//   4. findShrinkOpportunity   — sugere reduzir 1/2/3mm para caber mais
//
// Convenções:
//   - Todas as dimensões em milímetros, exceto preço (R$).
//   - Margens são DIRECIONAIS (top/bottom/left/right) por causa das marcas
//     de registro, que normalmente afetam só o topo e a base.
//   - Tipo de corte muda os defaults de margem e gap.
// =============================================================================

// ---------- Formato da etiqueta ---------------------------------------------
//
// Para fins de aproveitamento, "redondo" usa o MESMO bounding box quadrado
// que "quadrado" — o cálculo matemático é idêntico. O shape só afeta o
// preview SVG (rect vs. circle) e a descrição no texto do WhatsApp.

export type LabelShape = "quadrado" | "redondo" | "personalizado";

export const SHAPE_LABELS: Record<LabelShape, string> = {
  quadrado: "Quadrado",
  redondo: "Redondo",
  personalizado: "Personalizado",
};

// ---------- Tipo de corte ----------------------------------------------------

export type CutType = "corte_reto" | "plotter_quadrado" | "plotter_redondo";

export interface CutDefaults {
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  gap: number;
}

export const CUT_DEFAULTS: Record<CutType, CutDefaults> = {
  corte_reto: { marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5, gap: 0 },
  plotter_quadrado: { marginTop: 10, marginBottom: 10, marginLeft: 5, marginRight: 5, gap: 2 },
  plotter_redondo: { marginTop: 10, marginBottom: 10, marginLeft: 5, marginRight: 5, gap: 3 },
};

export const CUT_LABELS: Record<CutType, string> = {
  corte_reto: "Corte reto (guilhotina)",
  plotter_quadrado: "Plotter quadrado",
  plotter_redondo: "Plotter redondo",
};

// ---------- Folhas pré-definidas --------------------------------------------

export interface SheetPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const SHEET_PRESETS: SheetPreset[] = [
  { id: "A4", label: "A4 (210 × 297 mm)", width: 210, height: 297 },
  { id: "A3", label: "A3 (297 × 420 mm)", width: 297, height: 420 },
  { id: "SRA3", label: "SRA3 (320 × 450 mm)", width: 320, height: 450 },
  { id: "Carta", label: "Carta (216 × 279 mm)", width: 216, height: 279 },
];

// ---------- 1. Cálculo de aproveitamento ------------------------------------

export interface LayoutInput {
  sheetW: number;
  sheetH: number;
  labelW: number;
  labelH: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  gap: number;
  /** Opcional. Não afeta o cálculo (redondo usa bounding box quadrado). */
  shape?: LabelShape;
  /** Opcional. Quando informado, calcula slots reservados para marcas ARMS. */
  cutType?: CutType;
}

export interface LayoutOption {
  cols: number;
  rows: number;
  total: number;
  rotated: boolean;
}

export interface ReservedSlot {
  col: number;
  row: number;
}

export interface LayoutResult {
  best: LayoutOption;
  optionA: LayoutOption;
  optionB: LayoutOption;
  usableW: number;
  usableH: number;
  utilizationPct: number;
  /** Slots removidos para acomodar marcas de registro. */
  reservedSlots: ReservedSlot[];
  /** Quantas etiquetas vendáveis em cada linha (após reservas). */
  cellsPerRow: number[];
  /** Offset X (mm) do início de cada linha (centralização das linhas reservadas). */
  rowOffsets: number[];
  /** Etiquetas vendáveis = soma de cellsPerRow. */
  effectivePerSheet: number;
}

/**
 * Reservas por FAIXA, conforme padrão SignMaster/Teneth observado:
 * - plotter_redondo: reserva 1 slot na ponta esquerda da linha 0
 * - corte_reto / plotter_quadrado: reserva 1 slot em CADA ponta da linha 0
 *   E 1 slot em cada ponta da última linha
 *
 * Retorna a lista de slots removidos (para uso no preview).
 */
export function computeReservedSlots(
  cutType: CutType,
  cols: number,
  rows: number,
): ReservedSlot[] {
  if (cols <= 0 || rows <= 0) return [];
  const slots: ReservedSlot[] = [];
  const push = (c: number, r: number) => {
    if (c < 0 || c >= cols || r < 0 || r >= rows) return;
    if (slots.some((s) => s.col === c && s.row === r)) return;
    slots.push({ col: c, row: r });
  };

  if (cutType === "plotter_redondo") {
    push(0, 0);
    return slots;
  }
  // corte_reto + plotter_quadrado: faixa nas duas pontas da 1ª e da última linha
  push(0, 0);
  push(cols - 1, 0);
  if (rows > 1) {
    push(0, rows - 1);
    push(cols - 1, rows - 1);
  }
  return slots;
}

/**
 * Calcula quantas etiquetas cabem na folha, testando orientação normal e
 * rotacionada 90°. Sem rotação livre (NP-hard) — só essas duas opções.
 *
 * Para N peças em uma direção: N*lado + (N-1)*gap ≤ útil
 *   ⇒ N = floor((útil + gap) / (lado + gap))
 */
export const computeLabelLayout = (input: LayoutInput): LayoutResult => {
  const { sheetW, sheetH, labelW, labelH, marginTop, marginBottom, marginLeft, marginRight, gap } = input;

  const usableW = Math.max(0, sheetW - marginLeft - marginRight);
  const usableH = Math.max(0, sheetH - marginTop - marginBottom);

  const fit = (w: number, h: number, rotated: boolean): LayoutOption => {
    if (w <= 0 || h <= 0 || usableW <= 0 || usableH <= 0) {
      return { cols: 0, rows: 0, total: 0, rotated };
    }
    const cols = Math.floor((usableW + gap) / (w + gap));
    const rows = Math.floor((usableH + gap) / (h + gap));
    const safeCols = Math.max(0, cols);
    const safeRows = Math.max(0, rows);
    return { cols: safeCols, rows: safeRows, total: safeCols * safeRows, rotated };
  };

  const optionA = fit(labelW, labelH, false);
  const optionB = fit(labelH, labelW, true);
  const best = optionB.total > optionA.total ? optionB : optionA;

  const usedArea = best.total * labelW * labelH;
  const usableArea = usableW * usableH;
  const utilizationPct = usableArea > 0 ? (usedArea / usableArea) * 100 : 0;

  const reservedSlots = input.cutType
    ? computeReservedSlots(input.cutType, best.cols, best.rows)
    : [];

  // Conta reservas por linha
  const reservedByRow = new Map<number, number>();
  for (const s of reservedSlots) {
    reservedByRow.set(s.row, (reservedByRow.get(s.row) ?? 0) + s.col >= 0 ? 1 : 0);
    reservedByRow.set(s.row, (reservedByRow.get(s.row) ?? 0));
  }
  // (correção do count acima)
  const counts = new Map<number, number>();
  for (const s of reservedSlots) counts.set(s.row, (counts.get(s.row) ?? 0) + 1);

  // Largura de uma etiqueta na orientação escolhida
  const labelWBest = best.rotated ? labelH : labelW;

  const cellsPerRow: number[] = [];
  const rowOffsets: number[] = [];
  for (let r = 0; r < best.rows; r++) {
    const removed = counts.get(r) ?? 0;
    const cells = Math.max(0, best.cols - removed);
    cellsPerRow.push(cells);
    if (removed === 0 || cells === 0) {
      rowOffsets.push(marginLeft);
    } else {
      const occupied = cells * labelWBest + (cells - 1) * gap;
      const offset = marginLeft + Math.max(0, (usableW - occupied) / 2);
      rowOffsets.push(offset);
    }
  }
  const effectivePerSheet = cellsPerRow.reduce((a, b) => a + b, 0);

  return {
    best,
    optionA,
    optionB,
    usableW,
    usableH,
    utilizationPct,
    reservedSlots,
    cellsPerRow,
    rowOffsets,
    effectivePerSheet,
  };
};

/** Quantas folhas para atender `qty` etiquetas. */
export const sheetsNeeded = (qty: number, perSheet: number): number => {
  if (perSheet <= 0 || qty <= 0) return 0;
  return Math.ceil(qty / perSheet);
};

// ---------- 2. Precificação simples por folha -------------------------------

/** Arredonda para cima ao R$ 0,10 mais próximo (regra global do projeto). */
export const roundUpToTen = (n: number): number => Math.ceil(n * 10) / 10;

export interface PricingInput {
  pricePerSheet: number;
  qtyRequested: number;
  perSheet: number;
}

export interface PricingResult {
  sheetsNeeded: number;
  totalPrice: number;
  unitPrice: number;
}

export const computeSheetPricing = (input: PricingInput): PricingResult => {
  const sheets = sheetsNeeded(input.qtyRequested, input.perSheet);
  const rawTotal = sheets * input.pricePerSheet;
  const totalPrice = roundUpToTen(rawTotal);
  const unitPrice = input.qtyRequested > 0 ? totalPrice / input.qtyRequested : 0;
  return { sheetsNeeded: sheets, totalPrice, unitPrice };
};

// ---------- 3. Tabela de ancoragem (upsell) ---------------------------------

/**
 * Próxima quantidade "redonda" relevante para upsell.
 *
 * | Faixa de qty | Sugestão |
 * |--------------|----------|
 * | ≤ 50         | 200      |
 * | 51–100       | 300      |
 * | 101–200      | 500      |
 * | 201–500      | 1000     |
 * | 501–1000     | 2000     |
 * | > 1000       | qty * 5 (mult. 500) |
 */
export const pickRoundUpsellQty = (qty: number): number => {
  if (qty <= 50) return 200;
  if (qty <= 100) return 300;
  if (qty <= 200) return 500;
  if (qty <= 500) return 1000;
  if (qty <= 1000) return 2000;
  return Math.ceil((qty * 5) / 500) * 500;
};

export interface AnchoringTier {
  qty: number;
  sheets: number;
  total: number;
  unit: number;
  /** Variação % do custo unitário vs. tier 1 (negativo = mais barato). */
  unitDeltaPct: number;
  label: "solicitada" | "dobro" | "ideal";
}

/**
 * Constrói a escada de ancoragem: qty solicitada, dobro, e quantidade redonda.
 * Remove duplicatas mantendo ordem crescente; garante tier3 > tier2.
 */
export const buildAnchoringLadder = (
  qty: number,
  perSheet: number,
  pricePerSheet: number,
): AnchoringTier[] => {
  if (qty <= 0 || perSheet <= 0 || pricePerSheet <= 0) return [];

  const tier1 = qty;
  const tier2 = qty * 2;
  let tier3 = pickRoundUpsellQty(qty);
  while (tier3 <= tier2) {
    tier3 = pickRoundUpsellQty(tier3 + 1);
  }

  const labels: AnchoringTier["label"][] = ["solicitada", "dobro", "ideal"];
  const raw = [tier1, tier2, tier3];

  const baseUnit = computeSheetPricing({ pricePerSheet, qtyRequested: tier1, perSheet }).unitPrice;

  const seen = new Set<number>();
  const ladder: AnchoringTier[] = [];
  raw.forEach((q, idx) => {
    if (seen.has(q)) return;
    seen.add(q);
    const p = computeSheetPricing({ pricePerSheet, qtyRequested: q, perSheet });
    const unitDeltaPct = baseUnit > 0 ? ((p.unitPrice - baseUnit) / baseUnit) * 100 : 0;
    ladder.push({
      qty: q,
      sheets: p.sheetsNeeded,
      total: p.totalPrice,
      unit: p.unitPrice,
      unitDeltaPct,
      label: labels[idx],
    });
  });

  return ladder;
};

// ---------- 4. Otimizador de retalho ----------------------------------------

export interface ShrinkSuggestion {
  newLabelW: number;
  newLabelH: number;
  newPerSheet: number;
  /** Ganho de etiquetas por folha vs. layout original. */
  delta: number;
  /** Etiquetas extras mantendo o mesmo número de folhas. */
  extraUnitsForSameSheets: number;
  shrinkW: number;
  shrinkH: number;
}

const MIN_LABEL_DIMENSION = 5; // mm — trava de segurança

/**
 * Testa pequenas reduções (−1, −2, −3 mm em W, H ou ambos) e retorna a
 * melhor sugestão se alguma fizer caber mais etiquetas por folha.
 *
 * Critério: maior `delta`. Em empate, menor encolhimento total (dw+dh).
 */
export const findShrinkOpportunity = (
  base: LayoutInput,
  originalPerSheet: number,
  sheetsForOriginal: number,
): ShrinkSuggestion | null => {
  const candidates: Array<{ dw: number; dh: number }> = [
    { dw: 1, dh: 0 }, { dw: 0, dh: 1 }, { dw: 1, dh: 1 },
    { dw: 2, dh: 0 }, { dw: 0, dh: 2 }, { dw: 2, dh: 2 },
    { dw: 3, dh: 0 }, { dw: 0, dh: 3 }, { dw: 3, dh: 3 },
  ];

  let best: ShrinkSuggestion | null = null;
  for (const c of candidates) {
    const newW = base.labelW - c.dw;
    const newH = base.labelH - c.dh;
    if (newW < MIN_LABEL_DIMENSION || newH < MIN_LABEL_DIMENSION) continue;

    const r = computeLabelLayout({ ...base, labelW: newW, labelH: newH });
    if (r.best.total <= originalPerSheet) continue;

    const delta = r.best.total - originalPerSheet;
    const candidate: ShrinkSuggestion = {
      newLabelW: newW,
      newLabelH: newH,
      newPerSheet: r.best.total,
      delta,
      extraUnitsForSameSheets: delta * Math.max(1, sheetsForOriginal),
      shrinkW: c.dw,
      shrinkH: c.dh,
    };

    if (
      !best ||
      candidate.delta > best.delta ||
      (candidate.delta === best.delta && c.dw + c.dh < best.shrinkW + best.shrinkH)
    ) {
      best = candidate;
    }
  }

  return best;
};
