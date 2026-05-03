// =============================================================================
// Motor de aproveitamento — corte em GUILHOTINA
// =============================================================================
// Regras simples e fixas (mm):
//   - Margem de pinça: 5 mm em todas as 4 bordas
//   - Sangria entre peças: 3 mm (horizontal e vertical)
//   - Testa as duas orientações (W×H e H×W) e devolve a que mais rende.
// =============================================================================

export const GUILLOTINE_MARGIN_MM = 5;
export const GUILLOTINE_GAP_MM = 3;

export interface GuillotineInput {
  sheetW: number;
  sheetH: number;
  labelW: number;
  labelH: number;
}

export interface GuillotinePosition {
  col: number;
  row: number;
  x: number;
  y: number;
}

export interface GuillotineLayout {
  cols: number;
  rows: number;
  total: number;
  /** Dimensões efetivas após escolha da melhor orientação. */
  labelW: number;
  labelH: number;
  rotated: boolean;
  usableW: number;
  usableH: number;
  offsetX: number;
  offsetY: number;
  utilizationPct: number;
  positions: GuillotinePosition[];
}

const computeForOrientation = (
  sheetW: number,
  sheetH: number,
  lw: number,
  lh: number,
  rotated: boolean,
): GuillotineLayout => {
  const usableW = Math.max(0, sheetW - 2 * GUILLOTINE_MARGIN_MM);
  const usableH = Math.max(0, sheetH - 2 * GUILLOTINE_MARGIN_MM);

  const cols = lw > 0 ? Math.max(0, Math.floor((usableW + GUILLOTINE_GAP_MM) / (lw + GUILLOTINE_GAP_MM))) : 0;
  const rows = lh > 0 ? Math.max(0, Math.floor((usableH + GUILLOTINE_GAP_MM) / (lh + GUILLOTINE_GAP_MM))) : 0;
  const total = cols * rows;

  const gridW = cols > 0 ? cols * lw + (cols - 1) * GUILLOTINE_GAP_MM : 0;
  const gridH = rows > 0 ? rows * lh + (rows - 1) * GUILLOTINE_GAP_MM : 0;
  const offsetX = GUILLOTINE_MARGIN_MM + Math.max(0, (usableW - gridW) / 2);
  const offsetY = GUILLOTINE_MARGIN_MM + Math.max(0, (usableH - gridH) / 2);

  const positions: GuillotinePosition[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push({
        col: c,
        row: r,
        x: offsetX + c * (lw + GUILLOTINE_GAP_MM),
        y: offsetY + r * (lh + GUILLOTINE_GAP_MM),
      });
    }
  }

  const usedArea = total * lw * lh;
  const utilizationPct = usableW * usableH > 0 ? (usedArea / (usableW * usableH)) * 100 : 0;

  return {
    cols, rows, total,
    labelW: lw, labelH: lh, rotated,
    usableW, usableH,
    offsetX, offsetY,
    utilizationPct,
    positions,
  };
};

export const computeGuillotineLayout = (input: GuillotineInput): GuillotineLayout => {
  const { sheetW, sheetH, labelW, labelH } = input;
  const a = computeForOrientation(sheetW, sheetH, labelW, labelH, false);
  // Não rotaciona quando peça é quadrada (sem ganho).
  if (labelW === labelH) return a;
  const b = computeForOrientation(sheetW, sheetH, labelH, labelW, true);
  if (b.total > a.total) return b;
  if (b.total === a.total && b.utilizationPct > a.utilizationPct) return b;
  return a;
};

// ---------- Sugestões shrink / grow -----------------------------------------

export interface GuillotineShrinkSuggestion {
  newLabelW: number;
  newLabelH: number;
  newPerSheet: number;
  delta: number;
  extraUnitsForSameSheets: number;
  shrinkW: number;
  shrinkH: number;
}

export interface GuillotineGrowSuggestion {
  newLabelW: number;
  newLabelH: number;
  newPerSheet: number;
  areaIncreasePct: number;
  samePerSheet: boolean;
  growW: number;
  growH: number;
}

const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const MIN_SIDE = 5;

export const findGuillotineShrinkOpportunity = (
  base: GuillotineInput,
  originalPerSheet: number,
  sheetsForOriginal: number,
): GuillotineShrinkSuggestion | null => {
  const isSquare = base.labelW === base.labelH;
  let best: GuillotineShrinkSuggestion | null = null;

  for (const d of STEPS) {
    const newW = +(base.labelW - d).toFixed(2);
    const newH = isSquare ? newW : +(base.labelH - d).toFixed(2);
    if (newW < MIN_SIDE || newH < MIN_SIDE) continue;
    const r = computeGuillotineLayout({ ...base, labelW: newW, labelH: newH });
    if (r.total <= originalPerSheet) continue;
    const delta = r.total - originalPerSheet;
    const candidate: GuillotineShrinkSuggestion = {
      newLabelW: newW,
      newLabelH: newH,
      newPerSheet: r.total,
      delta,
      extraUnitsForSameSheets: delta * Math.max(1, sheetsForOriginal),
      shrinkW: +(base.labelW - newW).toFixed(2),
      shrinkH: +(base.labelH - newH).toFixed(2),
    };
    if (!best || candidate.delta > best.delta || (candidate.delta === best.delta && d < best.shrinkW)) {
      best = candidate;
    }
  }
  return best;
};

export const findGuillotineGrowOpportunity = (
  base: GuillotineInput,
  originalPerSheet: number,
): GuillotineGrowSuggestion | null => {
  if (originalPerSheet <= 0) return null;
  const isSquare = base.labelW === base.labelH;
  const baseArea = base.labelW * base.labelH;
  let best: GuillotineGrowSuggestion | null = null;

  for (const d of STEPS) {
    const newW = +(base.labelW + d).toFixed(2);
    const newH = isSquare ? newW : +(base.labelH + d).toFixed(2);
    const r = computeGuillotineLayout({ ...base, labelW: newW, labelH: newH });
    if (r.total < originalPerSheet) continue;
    const newArea = newW * newH;
    const areaIncreasePct = baseArea > 0 ? ((newArea - baseArea) / baseArea) * 100 : 0;
    if (areaIncreasePct <= 0) continue;
    const candidate: GuillotineGrowSuggestion = {
      newLabelW: newW,
      newLabelH: newH,
      newPerSheet: r.total,
      areaIncreasePct,
      samePerSheet: r.total === originalPerSheet,
      growW: +(newW - base.labelW).toFixed(2),
      growH: +(newH - base.labelH).toFixed(2),
    };
    const bestArea = best ? best.newLabelW * best.newLabelH : -Infinity;
    if (!best || newArea > bestArea || (newArea === bestArea && d < best.growW)) {
      best = candidate;
    }
  }
  return best;
};
