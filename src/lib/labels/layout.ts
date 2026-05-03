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

// (marks são consultadas só pelo preview/PDF — o cálculo de risco é físico/determinístico)

// ---------- Formato da etiqueta ---------------------------------------------
//
// Para fins de aproveitamento, "redondo" usa o MESMO bounding box quadrado
// que "quadrado" — o cálculo matemático é idêntico. O shape só afeta o
// preview SVG (rect vs. circle) e a descrição no texto do WhatsApp.

export type LabelShape = "quadrado" | "redondo" | "personalizado";

export const SHAPE_LABELS: Record<LabelShape, string> = {
  redondo: "Redondo",
  quadrado: "Quadrado",
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
  { id: "A4", label: "A4 (21 × 29,7 cm)", width: 210, height: 297 },
  { id: "SRA3", label: "SRA3 (32 × 45 cm)", width: 320, height: 450 },
  { id: "Formatao", label: "Formatão (32,8 × 47,8 cm)", width: 328, height: 478 },
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
 * Zona de Segurança ARMS — análise física do risco real.
 *
 * Geometria das marcas (ver marks.ts):
 *  - Marcas superiores em "L": vértice EXATAMENTE no canto da área útil,
 *    braços de 5mm apontando para FORA (TL: -x/-y, TR: +x/-y). O L NÃO
 *    invade a área útil — só toca o canto da etiqueta no vértice.
 *  - Ticks inferiores: traço horizontal de 10mm centrado no canto da
 *    área útil, dentro da margem inferior.
 *
 * Como o L abre para fora, a primeira etiqueta tocando o canto da área
 * útil em (marginLeft, marginTop) está SEGURA na imensa maioria dos
 * casos. O risco real para o sensor ARMS só aparece quando:
 *   (a) a etiqueta é grande o bastante para que sua arte chegue muito
 *       perto do vértice de leitura — empiricamente, largura > 55mm;
 *   (b) a margem disponível for menor que o braço do L/tick (< 5mm),
 *       fazendo a marca cruzar a área da etiqueta.
 *
 * Regras (all-or-nothing por linha):
 *  - corte_reto: nada é reservado.
 *  - etiqueta redonda: avalia APENAS a 1ª linha (os ticks de base se
 *    encaixam nos vãos entre os círculos → última linha sempre cheia).
 *  - etiqueta quadrada/personalizada: avalia 1ª (vs. L) e última (vs. tick),
 *    mesmo quando o tipo de corte selecionado é "plotter_redondo".
 */
export interface ReservedSlotsInput {
  cutType: CutType;
  /** Formato real da etiqueta. Define se a última linha também precisa da zona de segurança. */
  shape?: LabelShape;
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

/** Folga lateral mínima (mm) entre a borda externa da etiqueta de ponta e a marca ARMS lateral. */
export const SAFETY_ZONE_MM = 10;

export function computeReservedSlots(input: ReservedSlotsInput): ReservedSlot[];
// Overload de compatibilidade para chamadas antigas (cutType, cols, rows)
export function computeReservedSlots(cutType: CutType, cols: number, rows: number): ReservedSlot[];
export function computeReservedSlots(
  a: ReservedSlotsInput | CutType,
  _b?: number,
  _c?: number,
): ReservedSlot[] {
  // Modo legado (sem geometria): impossível medir → vazio.
  if (typeof a === "string") {
    return [];
  }
  const { cutType, shape, cols, rows, labelW, gap, marginLeft, marginRight, sheetW } = a;
  if (cutType === "corte_reto") return [];
  if (cols <= 0 || rows <= 0) return [];

  const isRound = shape ? shape === "redondo" : cutType === "plotter_redondo";
  const usableW = Math.max(0, sheetW - marginLeft - marginRight);
  const slots: ReservedSlot[] = [];

  /**
   * Reduz o número de etiquetas até que a linha caiba com pelo menos
   * SAFETY_ZONE_MM de folga em cada ponta. As marcas ARMS laterais ficam
   * exatamente nos cantos da área útil, então a "folga" é o recuo lateral
   * disponível ao centralizar a linha.
   *
   * Para etiquetas redondas, a remoção é assimétrica (1 por vez) — a
   * própria centralização da linha cuida do visual e maximiza o
   * aproveitamento. Para retangulares, mantém remoção em pares para
   * preservar o alinhamento visual com as demais linhas.
   */
  const step = isRound ? 1 : 2;

  const safeCellsForRow = (startCols: number): number => {
    let n = startCols;
    while (n > 0) {
      const rowWidth = n * labelW + Math.max(0, n - 1) * gap;
      const slack = (usableW - rowWidth) / 2;
      if (slack >= SAFETY_ZONE_MM) return n;
      n -= step;
    }
    return 0;
  };

  const reserveEnds = (row: number, removed: number) => {
    if (removed <= 0) return;
    // Alterna esquerda/direita; a centralização por linha cuida do visual.
    let left = 0;
    let right = cols - 1;
    for (let i = 0; i < removed; i++) {
      if (i % 2 === 0) {
        slots.push({ col: left++, row });
      } else {
        slots.push({ col: right--, row });
      }
    }
  };

  // 1ª linha — sempre avaliada (vs. L superior).
  // Regra ARMS: quando há 2+ linhas, força sempre ≥1 etiqueta a menos que a capacidade bruta.
  // Isso garante monotonicidade do rendimento (etiqueta menor sempre rende ≥ etiqueta maior)
  // e dá folga real para a marca de registro mesmo quando a fórmula de slack não dispara.
  let topSafe = safeCellsForRow(cols);
  if (rows >= 2) topSafe = Math.min(topSafe, cols - 1);
  reserveEnds(0, cols - topSafe);

  // Última linha — só para não-redondo (ticks da base se encaixam entre círculos).
  // Mesma regra forçada por simetria visual com a 1ª linha.
  if (!isRound && rows >= 2) {
    let bottomSafe = safeCellsForRow(cols);
    bottomSafe = Math.min(bottomSafe, cols - 1);
    reserveEnds(rows - 1, cols - bottomSafe);
  }

  return slots;
}

/**
 * Calcula quantas etiquetas cabem na folha, testando orientação normal e
 * rotacionada 90°. Sem rotação livre (NP-hard) — só essas duas opções.
 *
 * Para N peças em uma direção: N*lado + (N-1)*gap ≤ útil
 *   ⇒ N = floor((útil + gap) / (lado + gap))
 *
 * A escolha da melhor orientação considera o total **efetivo** (após
 * reduzir 1ª/última linha pela regra ARMS), não o total bruto. Assim,
 * uma orientação com 5×7=35 efetivos vence outra com 4×8=32 efetivos.
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

  // Distribui as células por linha aplicando a regra de zona de segurança ARMS.
  // Retorna cellsPerRow + offsets já centralizados por linha.
  const buildRowDistribution = (
    cols: number,
    rows: number,
    lblW: number,
    lblH: number,
  ) => {
    const reserved = input.cutType && cols > 0 && rows > 0
      ? computeReservedSlots({
          cutType: input.cutType,
          shape: input.shape,
          cols, rows,
          labelW: lblW, labelH: lblH,
          gap,
          marginTop, marginBottom, marginLeft, marginRight,
          sheetW, sheetH,
        })
      : [];
    const counts = new Map<number, number>();
    for (const s of reserved) counts.set(s.row, (counts.get(s.row) ?? 0) + 1);
    const cellsPerRow: number[] = [];
    const rowOffsets: number[] = [];
    for (let r = 0; r < rows; r++) {
      const removed = counts.get(r) ?? 0;
      const cells = Math.max(0, cols - removed);
      cellsPerRow.push(cells);
      if (cells === 0) {
        rowOffsets.push(marginLeft);
      } else {
        const occupied = cells * lblW + (cells - 1) * gap;
        rowOffsets.push(marginLeft + Math.max(0, (usableW - occupied) / 2));
      }
    }
    const effective = cellsPerRow.reduce((a, b) => a + b, 0);
    return { reserved, cellsPerRow, rowOffsets, effective };
  };

  const optionA = fit(labelW, labelH, false);
  const optionB = fit(labelH, labelW, true);
  const distA = buildRowDistribution(optionA.cols, optionA.rows, labelW, labelH);
  const distB = buildRowDistribution(optionB.cols, optionB.rows, labelH, labelW);

  // Escolha pela soma efetiva (após reservas das linhas extremas).
  // Em empate, prefere a opção com mais total bruto (mais robusta).
  const pickB =
    distB.effective > distA.effective ||
    (distB.effective === distA.effective && optionB.total > optionA.total);
  const best = pickB ? optionB : optionA;
  const dist = pickB ? distB : distA;

  const usedArea = best.total * labelW * labelH;
  const usableArea = usableW * usableH;
  const utilizationPct = usableArea > 0 ? (usedArea / usableArea) * 100 : 0;

  return {
    best,
    optionA,
    optionB,
    usableW,
    usableH,
    utilizationPct,
    reservedSlots: dist.reserved,
    cellsPerRow: dist.cellsPerRow,
    rowOffsets: dist.rowOffsets,
    effectivePerSheet: dist.effective,
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
  label: "solicitada" | "dobro" | "ideal" | "extra";
}

/** Sugestões automáticas adicionais para reforçar a ancoragem. */
export const defaultExtraQtys = (qty: number): number[] => {
  if (qty <= 0) return [];
  const half = Math.max(1, Math.round(qty / 2));
  const x5 = qty * 5;
  const x10 = qty * 10;
  return [half, x5, x10];
};

/**
 * Constrói a escada de ancoragem: qty solicitada, dobro, quantidade redonda
 * e — opcionalmente — quantidades extras (sugeridas pelo sistema ou pelo
 * usuário). Remove duplicatas mantendo ordem crescente.
 */
export const buildAnchoringLadder = (
  qty: number,
  perSheet: number,
  pricePerSheet: number | ((sheets: number) => number),
  extraQtys: number[] = [],
): AnchoringTier[] => {
  if (qty <= 0 || perSheet <= 0) return [];

  const resolvePrice = (sheets: number) =>
    typeof pricePerSheet === "function" ? pricePerSheet(sheets) : pricePerSheet;

  const tier1 = qty;
  const tier2 = qty * 2;
  let tier3 = pickRoundUpsellQty(qty);
  while (tier3 <= tier2) {
    tier3 = pickRoundUpsellQty(tier3 + 1);
  }

  const baseSheets = sheetsNeeded(tier1, perSheet);
  const baseUnit = computeSheetPricing({
    pricePerSheet: resolvePrice(baseSheets),
    qtyRequested: tier1,
    perSheet,
  }).unitPrice;

  const seen = new Set<number>();
  const ladder: AnchoringTier[] = [];

  const push = (q: number, label: AnchoringTier["label"]) => {
    if (q <= 0 || seen.has(q)) return;
    seen.add(q);
    const sheets = sheetsNeeded(q, perSheet);
    const p = computeSheetPricing({
      pricePerSheet: resolvePrice(sheets),
      qtyRequested: q,
      perSheet,
    });
    const unitDeltaPct = baseUnit > 0 ? ((p.unitPrice - baseUnit) / baseUnit) * 100 : 0;
    ladder.push({
      qty: q,
      sheets: p.sheetsNeeded,
      total: p.totalPrice,
      unit: p.unitPrice,
      unitDeltaPct,
      label,
    });
  };

  push(tier1, "solicitada");
  push(tier2, "dobro");
  push(tier3, "ideal");
  extraQtys.forEach((q) => push(Math.floor(q), "extra"));

  ladder.sort((a, b) => a.qty - b.qty);
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
  const reductions = [1, 2, 3, 4, 5];
  const candidates: Array<{ dw: number; dh: number }> = isSquare
    ? reductions.map((d) => ({ dw: d, dh: d }))
    : reductions.flatMap((d) => [
        { dw: d, dh: 0 },
        { dw: 0, dh: d },
        { dw: d, dh: d },
      ]);

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

// ---------- 5. Otimizador de upgrade (entregar etiqueta maior) -------------

export interface GrowSuggestion {
  newLabelW: number;
  newLabelH: number;
  newPerSheet: number;
  /** Crescimento percentual de área vs. etiqueta original. */
  areaIncreasePct: number;
  /** True quando perSheet é exatamente igual ao original (sem perdas). */
  samePerSheet: boolean;
  growW: number;
  growH: number;
}

const MAX_GROW_MM = 5; // mm — incremento máximo por lado

/**
 * Testa pequenos aumentos (+1..+5 mm em W, H ou ambos) e retorna a maior
 * etiqueta que ainda mantém (ou aumenta) o número de unidades por folha.
 *
 * Critério: maior área final. Em empate, menor crescimento total (menor risco
 * visual de mudar muito a etiqueta).
 */
export const findGrowOpportunity = (
  base: LayoutInput,
  originalPerSheet: number,
): GrowSuggestion | null => {
  if (originalPerSheet <= 0) return null;
  const isSquare = base.labelW === base.labelH;
  const increments = [1, 2, 3, 4, 5];
  const candidates: Array<{ dw: number; dh: number }> = isSquare
    ? increments.map((d) => ({ dw: d, dh: d }))
    : increments.flatMap((d) => [
        { dw: d, dh: 0 },
        { dw: 0, dh: d },
        { dw: d, dh: d },
      ]);

  const baseArea = base.labelW * base.labelH;
  let best: GrowSuggestion | null = null;

  for (const c of candidates) {
    if (c.dw > MAX_GROW_MM || c.dh > MAX_GROW_MM) continue;
    // Sem crescimento real → nada a sugerir.
    if (c.dw + c.dh < 1) continue;
    const newW = base.labelW + c.dw;
    const newH = base.labelH + c.dh;
    const r = computeLabelLayout({ ...base, labelW: newW, labelH: newH });
    // Exige manter (ou aumentar) o número de etiquetas/folha.
    if (r.best.total < originalPerSheet) continue;

    const newArea = newW * newH;
    const areaIncreasePct = baseArea > 0 ? ((newArea - baseArea) / baseArea) * 100 : 0;
    // Sem ganho de área não é upgrade — descartar.
    if (areaIncreasePct <= 0) continue;

    const candidate: GrowSuggestion = {
      newLabelW: newW,
      newLabelH: newH,
      newPerSheet: r.best.total,
      areaIncreasePct,
      samePerSheet: r.best.total === originalPerSheet,
      growW: c.dw,
      growH: c.dh,
    };

    const candArea = newArea;
    const bestArea = best ? best.newLabelW * best.newLabelH : -Infinity;
    if (
      !best ||
      candArea > bestArea ||
      (candArea === bestArea && c.dw + c.dh < best.growW + best.growH)
    ) {
      best = candidate;
    }
  }

  return best;
};

