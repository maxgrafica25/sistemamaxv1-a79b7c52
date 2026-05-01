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

import { buildCornerMarks, markBoundingBox } from "./marks";

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
  plotter_quadrado: { marginTop: 10, marginBottom: 10, marginLeft: 5, marginRight: 5, gap: 1 },
  plotter_redondo: { marginTop: 10, marginBottom: 10, marginLeft: 5, marginRight: 5, gap: 1 },
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
  { id: "SRA3", label: "32 × 45 cm (SRA3)", width: 320, height: 450 },
  { id: "A4", label: "A4 (21 × 29.7 cm)", width: 210, height: 297 },
  { id: "A3", label: "A3 (29.7 × 42 cm)", width: 297, height: 420 },
  { id: "330x480", label: "33 × 48 cm", width: 330, height: 480 },
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
 * Reservas por COLISÃO REAL: só remove um slot da grade se o bbox físico de
 * alguma marca de registro (L superior ou tick inferior) intersecta o bbox
 * da célula. Padrão SignMaster/Teneth — máximo aproveitamento.
 *
 * Como o vértice do L fica no canto da área útil e o tick fica na margem
 * inferior, na maioria dos layouts NENHUM slot é removido.
 */
export interface ReservedSlotsInput {
  cutType: CutType;
  cols: number;
  rows: number;
  /** Largura da etiqueta na orientação escolhida (mm). */
  labelW: number;
  /** Altura da etiqueta na orientação escolhida (mm). */
  labelH: number;
  gap: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  sheetW: number;
  sheetH: number;
}

export function computeReservedSlots(input: ReservedSlotsInput): ReservedSlot[];
// Overload de compatibilidade para chamadas antigas (cutType, cols, rows)
export function computeReservedSlots(cutType: CutType, cols: number, rows: number): ReservedSlot[];
export function computeReservedSlots(
  a: ReservedSlotsInput | CutType,
  b?: number,
  c?: number,
): ReservedSlot[] {
  // Modo legado (sem geometria): nenhum slot é reservado preventivamente.
  // A detecção de colisão real depende da geometria, então sem ela não há
  // como saber se houve colisão.
  if (typeof a === "string") {
    return [];
  }
  const { cols, rows, labelW, labelH, gap, marginTop, marginBottom, marginLeft, marginRight, sheetW, sheetH } = a;
  if (cols <= 0 || rows <= 0) return [];

  // Importação dinâmica evita ciclo: marks → layout não é necessário.
  // Como marks.ts não importa layout, podemos importar diretamente.
  // (feito no topo do arquivo)
  const marks = buildCornerMarks(sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight, 0);
  const markBoxes = marks.marks.map(markBoundingBox);

  const TOL = 0.5; // tolerância em mm
  const slots: ReservedSlot[] = [];

  const intersects = (
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number,
  ) => ax < bx + bw - TOL && ax + aw > bx + TOL && ay < by + bh - TOL && ay + ah > by + TOL;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const cellX = marginLeft + col * (labelW + gap);
      const cellY = marginTop + r * (labelH + gap);
      for (const m of markBoxes) {
        if (intersects(cellX, cellY, labelW, labelH, m.x, m.y, m.w, m.h)) {
          slots.push({ col, row: r });
          break;
        }
      }
    }
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

  const labelWBest = best.rotated ? labelH : labelW;
  const labelHBest = best.rotated ? labelW : labelH;

  const reservedSlots = input.cutType && best.cols > 0 && best.rows > 0
    ? computeReservedSlots({
        cutType: input.cutType,
        cols: best.cols,
        rows: best.rows,
        labelW: labelWBest,
        labelH: labelHBest,
        gap,
        marginTop, marginBottom, marginLeft, marginRight,
        sheetW, sheetH,
      })
    : [];

  // Conta reservas por linha
  const counts = new Map<number, number>();
  for (const s of reservedSlots) counts.set(s.row, (counts.get(s.row) ?? 0) + 1);

  // (labelWBest já declarada acima)

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
  if (qty <= 0 || perSheet <= 0) return [];

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
  // Quando a etiqueta original é quadrada, só consideramos reduções
  // simétricas — não faz sentido sugerir transformá-la em retangular
  // só pra ganhar etiquetas (o cliente pediu quadrada).
  const isSquare = base.labelW === base.labelH;
  const candidates: Array<{ dw: number; dh: number }> = isSquare
    ? [
        { dw: 1, dh: 1 },
        { dw: 2, dh: 2 },
        { dw: 3, dh: 3 },
      ]
    : [
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
