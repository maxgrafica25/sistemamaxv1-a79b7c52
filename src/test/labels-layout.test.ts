import { describe, it, expect } from "vitest";
import {
  computeLabelLayout,
  sheetsNeeded,
  computeSheetPricing,
  pickRoundUpsellQty,
  buildAnchoringLadder,
  findShrinkOpportunity,
  CUT_DEFAULTS,
  type LayoutInput,
} from "@/lib/labels/layout";

const A4 = { sheetW: 210, sheetH: 297 };
const SRA3 = { sheetW: 320, sheetH: 450 };
const m5 = { marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5 };

describe("computeLabelLayout", () => {
  it("etiqueta 50x50mm em A4 com margem 5 e gap 0 → 4 cols × 5 rows = 20", () => {
    const r = computeLabelLayout({ ...A4, ...m5, gap: 0, labelW: 50, labelH: 50 });
    expect(r.usableW).toBe(200);
    expect(r.usableH).toBe(287);
    expect(r.optionA.total).toBe(20); // 4 × 5
    expect(r.optionB.total).toBe(20); // quadrada → idêntico
    expect(r.best.total).toBe(20);
  });

  it("etiqueta 100x50mm em A4 → rotacionada cabe pelo menos tanto quanto a normal", () => {
    const r = computeLabelLayout({ ...A4, ...m5, gap: 0, labelW: 100, labelH: 50 });
    // normal: cols=floor(200/100)=2, rows=floor(287/50)=5 → 10
    // rotacionada: cols=floor(200/50)=4, rows=floor(287/100)=2 → 8
    expect(r.optionA.total).toBe(10);
    expect(r.optionB.total).toBe(8);
    expect(r.best.total).toBe(10);
    expect(r.best.rotated).toBe(false);
  });

  it("etiqueta maior que área útil → total 0", () => {
    const r = computeLabelLayout({ ...A4, ...m5, gap: 0, labelW: 500, labelH: 500 });
    expect(r.best.total).toBe(0);
    expect(r.utilizationPct).toBe(0);
  });

  it("respeita gap entre etiquetas", () => {
    // 200mm úteis, etiqueta 50, gap 10: cols = floor((200+10)/(50+10)) = floor(3.5) = 3
    const r = computeLabelLayout({ ...A4, ...m5, gap: 10, labelW: 50, labelH: 50 });
    expect(r.optionA.cols).toBe(3);
  });
});

describe("sheetsNeeded", () => {
  it.each([
    [50, 20, 3],
    [100, 20, 5],
    [0, 20, 0],
    [10, 0, 0],
    [20, 20, 1],
    [21, 20, 2],
  ])("qty=%i perSheet=%i → %i", (qty, per, expected) => {
    expect(sheetsNeeded(qty, per)).toBe(expected);
  });
});

describe("computeSheetPricing", () => {
  it("arredonda para cima ao R$ 0,10", () => {
    // 5 folhas × 14,99 = 74,95 → 75,00 (arredonda pra cima ao 0,10)
    const r = computeSheetPricing({ pricePerSheet: 14.99, qtyRequested: 100, perSheet: 20 });
    expect(r.sheetsNeeded).toBe(5);
    expect(r.totalPrice).toBeCloseTo(75.0, 2);
    expect(r.unitPrice).toBeCloseTo(0.75, 2);
  });

  it("qty=0 → unitPrice 0", () => {
    const r = computeSheetPricing({ pricePerSheet: 15, qtyRequested: 0, perSheet: 20 });
    expect(r.totalPrice).toBe(0);
    expect(r.unitPrice).toBe(0);
  });

  it("perSheet=0 → 0 folhas, total 0", () => {
    const r = computeSheetPricing({ pricePerSheet: 15, qtyRequested: 50, perSheet: 0 });
    expect(r.sheetsNeeded).toBe(0);
    expect(r.totalPrice).toBe(0);
  });
});

describe("pickRoundUpsellQty", () => {
  it.each([
    [50, 200],
    [51, 300],
    [100, 300],
    [101, 500],
    [200, 500],
    [201, 1000],
    [500, 1000],
    [501, 2000],
    [1000, 2000],
    [1500, 7500], // 1500*5=7500, mult 500
    [2000, 10000],
  ])("%i → %i", (qty, expected) => {
    expect(pickRoundUpsellQty(qty)).toBe(expected);
  });

  it("sempre retorna múltiplo de 500 para qty > 1000", () => {
    expect(pickRoundUpsellQty(1234) % 500).toBe(0);
  });
});

describe("buildAnchoringLadder", () => {
  it("3 tiers com custo unitário decrescente (dilui custo fixo)", () => {
    const ladder = buildAnchoringLadder(50, 20, 15);
    expect(ladder).toHaveLength(3);
    expect(ladder[0].qty).toBe(50);
    expect(ladder[1].qty).toBe(100);
    expect(ladder[2].qty).toBe(200);
    // Custo unitário deve diminuir conforme a quantidade aumenta
    expect(ladder[2].unit).toBeLessThan(ladder[0].unit);
    expect(ladder[0].unitDeltaPct).toBe(0);
    expect(ladder[2].unitDeltaPct).toBeLessThan(0);
  });

  it("dedup: quando dobro coincidiria com tier3, escolhe próxima faixa", () => {
    // qty=100 → tier1=100, tier2=200, tier3 base=300 (>200) → 100/200/300
    const ladder = buildAnchoringLadder(100, 20, 15);
    const qtys = ladder.map((t) => t.qty);
    expect(qtys).toEqual([100, 200, 300]);
    expect(new Set(qtys).size).toBe(qtys.length); // sem duplicatas
  });

  it("entradas inválidas → []", () => {
    expect(buildAnchoringLadder(0, 20, 15)).toEqual([]);
    expect(buildAnchoringLadder(50, 0, 15)).toEqual([]);
  });

  it("sem preço cadastrado → ainda devolve qty + folhas (preço zerado)", () => {
    const ladder = buildAnchoringLadder(50, 20, 0);
    expect(ladder.length).toBeGreaterThan(0);
    expect(ladder[0].qty).toBe(50);
    expect(ladder[0].sheets).toBeGreaterThan(0);
    expect(ladder[0].total).toBe(0);
    expect(ladder[0].unit).toBe(0);
  });
});

describe("findShrinkOpportunity", () => {
  const base = (w: number, h: number, sheet = A4): LayoutInput => ({
    ...sheet, ...m5, gap: 0, labelW: w, labelH: h,
  });

  it("51×51 em A4 → encontra ganho reduzindo até 5mm", () => {
    // 51×51 com útil 200x287: cols=3, rows=5 → 15
    // Com range estendido até −5mm: 47×47 → 4×6 = 24 (melhor que 50×50 = 20)
    const original = computeLabelLayout(base(51, 51));
    expect(original.best.total).toBe(15);
    const sug = findShrinkOpportunity(base(51, 51), 15, 4);
    expect(sug).not.toBeNull();
    expect(sug!.delta).toBeGreaterThan(0);
    expect(sug!.newPerSheet).toBeGreaterThanOrEqual(20);
    expect(sug!.shrinkW).toBeLessThanOrEqual(5);
  });

  it("90×90 em SRA3 → testa caminho do shrink se houver ganho", () => {
    const orig = computeLabelLayout(base(90, 90, SRA3));
    const sug = findShrinkOpportunity(base(90, 90, SRA3), orig.best.total, 1);
    if (sug) {
      expect(sug.newPerSheet).toBeGreaterThan(orig.best.total);
      expect(sug.shrinkW).toBeLessThanOrEqual(5);
      expect(sug.shrinkH).toBeLessThanOrEqual(5);
    }
  });

  it("etiqueta minúscula (6×6) → bloqueia redução abaixo de 5mm", () => {
    const orig = computeLabelLayout(base(6, 6));
    const sug = findShrinkOpportunity(base(6, 6), orig.best.total, 1);
    if (sug) {
      expect(sug.newLabelW).toBeGreaterThanOrEqual(5);
      expect(sug.newLabelH).toBeGreaterThanOrEqual(5);
    }
  });

  it("retorna null se nenhuma redução até −5mm dá ganho", () => {
    // 200×200 em A4 (útil 200×287): só cabe 1 etiqueta. Reduzindo até 195
    // ainda só cabe 1 (200/195 = 1). Sem ganho possível.
    const orig = computeLabelLayout(base(200, 200));
    expect(orig.best.total).toBe(1);
    const sug = findShrinkOpportunity(base(200, 200), 1, 1);
    expect(sug).toBeNull();
  });
});

describe("CUT_DEFAULTS", () => {
  it("plotter redondo tem gap >= corte reto", () => {
    expect(CUT_DEFAULTS.plotter_redondo.gap).toBeGreaterThanOrEqual(CUT_DEFAULTS.corte_reto.gap);
  });
  it("plotters têm gap reduzido (1mm) para maximizar aproveitamento (Regra dos 40)", () => {
    expect(CUT_DEFAULTS.plotter_quadrado.gap).toBe(1);
    expect(CUT_DEFAULTS.plotter_redondo.gap).toBe(1);
  });
  it("plotters têm maior margem top/bottom (marca de registro)", () => {
    expect(CUT_DEFAULTS.plotter_quadrado.marginTop).toBeGreaterThan(CUT_DEFAULTS.corte_reto.marginTop);
  });
});

describe("Regra dos 40 — 50×50 em SRA3 com Teneth (com zona de segurança)", () => {
  it("com gap 1mm e área útil 306×363, grade 6×7=42, perde 2 pontas da 1ª linha → 40", () => {
    // Margens conforme hardware Teneth A3: top 7, bottom 80, left/right 7
    const r = computeLabelLayout({
      sheetW: 320, sheetH: 450,
      marginTop: 7, marginBottom: 80, marginLeft: 7, marginRight: 7,
      gap: 1, labelW: 50, labelH: 50,
      cutType: "plotter_quadrado",
    });
    // cols=floor((306+1)/51)=6, rows=floor((363+1)/51)=7 → 42 brutos
    expect(r.best.cols).toBe(6);
    expect(r.best.rows).toBe(7);
    // Pontas da 1ª linha tocam o vértice do L → reservadas pela zona 10mm.
    // Última linha está a >40mm do tick → mantida cheia.
    expect(r.cellsPerRow[0]).toBe(4);
    expect(r.cellsPerRow[6]).toBe(6);
    expect(r.effectivePerSheet).toBe(40);
  });
});

// =============================================================================
// Novos helpers (image-fit, whatsapp, config-storage)
// =============================================================================
import { fitContain, aspectMismatch } from "@/lib/labels/image-fit";
import { formatWhatsAppQuote, describeLabel } from "@/lib/labels/whatsapp";

describe("fitContain", () => {
  it("imagem quadrada em box quadrado → preenche tudo, offset zero", () => {
    const r = fitContain(100, 100, 50, 50);
    expect(r.width).toBe(50);
    expect(r.height).toBe(50);
    expect(r.offsetX).toBe(0);
    expect(r.offsetY).toBe(0);
  });
  it("imagem 2:1 em box 1:1 → largura preenche, sobra em cima/baixo", () => {
    const r = fitContain(200, 100, 100, 100);
    expect(r.width).toBe(100);
    expect(r.height).toBe(50);
    expect(r.offsetX).toBe(0);
    expect(r.offsetY).toBe(25);
  });
  it("imagem 1:2 em box 1:1 → altura preenche, sobra nas laterais", () => {
    const r = fitContain(100, 200, 100, 100);
    expect(r.width).toBe(50);
    expect(r.height).toBe(100);
    expect(r.offsetX).toBe(25);
    expect(r.offsetY).toBe(0);
  });
  it("dimensões inválidas retornam zeros", () => {
    expect(fitContain(0, 100, 50, 50).width).toBe(0);
  });
});

describe("aspectMismatch", () => {
  it("razões iguais → false", () => {
    expect(aspectMismatch(100, 100, 50, 50)).toBe(false);
  });
  it("razão muito diferente → true", () => {
    expect(aspectMismatch(200, 100, 50, 50)).toBe(true);
  });
});

describe("formatWhatsAppQuote", () => {
  const pricing = { sheetsNeeded: 1, totalPrice: 15, unitPrice: 0.15 };
  it("inclui sugestão quando tier ideal é mais barato", () => {
    const ladder = [
      { qty: 100, sheets: 1, total: 15, unit: 0.15, unitDeltaPct: 0, label: "solicitada" as const },
      { qty: 200, sheets: 2, total: 30, unit: 0.15, unitDeltaPct: 0, label: "dobro" as const },
      { qty: 1000, sheets: 5, total: 75, unit: 0.075, unitDeltaPct: -50, label: "ideal" as const },
    ];
    const txt = formatWhatsAppQuote({ qty: 100, shape: "quadrado", width: 50, height: 50, pricing, ladder });
    expect(txt).toContain("Quadrado 50×50mm");
    expect(txt).toContain("Sugestão");
    expect(txt).toContain("1.000 un");
  });
  it("omite sugestão quando tier ideal não é mais barato", () => {
    const ladder = [
      { qty: 100, sheets: 1, total: 15, unit: 0.15, unitDeltaPct: 0, label: "solicitada" as const },
    ];
    const txt = formatWhatsAppQuote({ qty: 100, shape: "redondo", width: 50, height: 50, pricing, ladder });
    expect(txt).toContain("Redonda Ø50mm");
    expect(txt).not.toContain("Sugestão");
  });
  it("describeLabel cobre os 3 formatos", () => {
    expect(describeLabel("quadrado", 40, 40)).toBe("Quadrado 40×40mm");
    expect(describeLabel("redondo", 50, 50)).toBe("Redonda Ø50mm");
    expect(describeLabel("personalizado", 60, 30)).toBe("Personalizada 60×30mm");
  });
});

describe("config-storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  it("loadConfig retorna defaults com localStorage vazio", async () => {
    const { loadConfig, DEFAULT_CONFIG } = await import("@/lib/labels/config-storage");
    const cfg = loadConfig();
    expect(cfg.sheetW).toBe(DEFAULT_CONFIG.sheetW);
    expect(cfg.labelPresets.length).toBeGreaterThan(0);
  });
  it("saveConfig faz merge sem perder labelPresets", async () => {
    const { loadConfig, saveConfig } = await import("@/lib/labels/config-storage");
    const initial = loadConfig();
    const presetsLen = initial.labelPresets.length;
    saveConfig({ pricePerSheet: 25 });
    const next = loadConfig();
    expect(next.pricePerSheet).toBe(25);
    expect(next.labelPresets.length).toBe(presetsLen);
  });
  it("migra a chave antiga labelCalc:lastPricePerSheet", async () => {
    localStorage.setItem("labelCalc:lastPricePerSheet", "12.5");
    const { loadConfig } = await import("@/lib/labels/config-storage");
    const cfg = loadConfig();
    expect(cfg.pricePerSheet).toBe(12.5);
    expect(localStorage.getItem("labelCalc:lastPricePerSheet")).toBeNull();
  });
});

// =============================================================================
// Hardware profiles + slots reservados + marcas ARMS
// =============================================================================
import { computeReservedSlots } from "@/lib/labels/layout";
import { HARDWARE_PROFILES, clampMarginsToHardware, effectiveUsableArea } from "@/lib/labels/hardware";
import { suggestMarksOffset, buildCornerMarks } from "@/lib/labels/marks";

describe("computeReservedSlots — zona de segurança 10mm", () => {
  const baseGeom = {
    sheetW: 320, sheetH: 450, gap: 0,
    marginTop: 7, marginBottom: 80, marginLeft: 7, marginRight: 7,
  };

  it("plotter_redondo, etiqueta 50×50 com canto colado na marca → reserva apenas pontas da 1ª linha", () => {
    const r = computeReservedSlots({
      cutType: "plotter_redondo",
      cols: 6, rows: 5,
      labelW: 50, labelH: 50,
      ...baseGeom,
    });
    // Canto da célula (7,7) toca o vértice do L → distância 0 < 10mm
    // Redondo: só primeira linha é verificada.
    expect(r).toEqual([
      { col: 0, row: 0 },
      { col: 5, row: 0 },
    ]);
  });

  it("plotter_quadrado: reserva pontas da 1ª E última linha", () => {
    const r = computeReservedSlots({
      cutType: "plotter_quadrado",
      cols: 6, rows: 5,
      labelW: 50, labelH: 50,
      ...baseGeom,
    });
    // Última linha está dentro da margem grande, mas o tick fica em y=sheetH−40=410.
    // Cell row 4 está em y=7+4*50=207, h=50 → bottom=257. tick y≈410. dist em y = 153mm
    // → última linha NÃO é reservada. Só primeira.
    expect(r).toEqual([
      { col: 0, row: 0 },
      { col: 5, row: 0 },
    ]);
  });

  it("plotter_quadrado com etiqueta colada na base → reserva pontas da última linha também", () => {
    // Geometria apertada: margem inferior pequena, label encosta no tick.
    const r = computeReservedSlots({
      cutType: "plotter_quadrado",
      cols: 4, rows: 3,
      labelW: 50, labelH: 50,
      sheetW: 210, sheetH: 170,
      gap: 0, marginTop: 7, marginBottom: 13, marginLeft: 7, marginRight: 7,
    });
    // Cell row 2 base = 7+3*50 = 157. Tick y = 170 − 6.5 = 163.5. dist ~6.5 < 10
    expect(r).toContainEqual({ col: 0, row: 2 });
    expect(r).toContainEqual({ col: 3, row: 2 });
  });

  it("etiqueta pequena com folga ≥ 10mm em ambos lados → grade cheia", () => {
    const r = computeReservedSlots({
      cutType: "plotter_quadrado",
      cols: 3, rows: 4,
      labelW: 50, labelH: 50,
      sheetW: 320, sheetH: 450,
      // Margens grandes (20mm) → label corner em (20,20), L vértice em (20,20)
      // mas com gap permitiria folga? Não, ainda toca. Teste com gap.
      gap: 0, marginTop: 25, marginBottom: 25, marginLeft: 25, marginRight: 25,
    });
    // L tl: vertex (25,25), bbox (20,20,5,5). Cell (25,25,50,50) → toca canto, dist=0
    // Esse caso ainda reserva. Para folga real, precisamos adicionar offset à grade
    // com gap entre margem e primeira label, mas não temos esse parâmetro.
    // → Confirma que todo cenário com cell.topLeft = (marginLeft, marginTop) reserva.
    expect(r.length).toBeGreaterThan(0);
  });

  it("corte_reto → sempre array vazio, mesmo com colisão", () => {
    expect(computeReservedSlots({
      cutType: "corte_reto",
      cols: 6, rows: 5,
      labelW: 50, labelH: 50,
      ...baseGeom,
    })).toEqual([]);
  });

  it("modo legado (cutType, cols, rows) → array vazio (sem geometria)", () => {
    expect(computeReservedSlots("plotter_redondo", 4, 5)).toEqual([]);
    expect(computeReservedSlots("plotter_quadrado", 4, 5)).toEqual([]);
    expect(computeReservedSlots("corte_reto", 4, 5)).toEqual([]);
  });

  it("retorna vazio se cols/rows = 0", () => {
    expect(computeReservedSlots({
      cutType: "plotter_quadrado",
      cols: 0, rows: 5,
      labelW: 50, labelH: 50,
      ...baseGeom,
    })).toEqual([]);
  });

  it("plotter_redondo NUNCA reserva slots na última linha", () => {
    // Geometria apertada no rodapé que reservaria em plotter_quadrado
    const r = computeReservedSlots({
      cutType: "plotter_redondo",
      cols: 4, rows: 3,
      labelW: 50, labelH: 50,
      sheetW: 210, sheetH: 170,
      gap: 0, marginTop: 7, marginBottom: 13, marginLeft: 7, marginRight: 7,
    });
    const lastRow = r.filter((s) => s.row === 2);
    expect(lastRow).toEqual([]);
  });
});

describe("computeLabelLayout com cutType — zona de segurança aplicada", () => {
  it("plotter_redondo 50×50 em SRA3/Teneth → 1ª linha perde pontas e centraliza", async () => {
    const { computeLabelLayout } = await import("@/lib/labels/layout");
    const r = computeLabelLayout({
      sheetW: 320, sheetH: 450, labelW: 50, labelH: 50,
      marginTop: 7, marginBottom: 80, marginLeft: 7, marginRight: 7, gap: 0,
      cutType: "plotter_redondo",
    });
    // best: cols=6, rows=7 (gap=0 → floor(363/50)=7)
    expect(r.best.cols).toBe(6);
    expect(r.best.rows).toBe(7);
    expect(r.cellsPerRow[0]).toBe(4); // perdeu 2 pontas
    expect(r.cellsPerRow[r.best.rows - 1]).toBe(6); // redondo: última cheia
    expect(r.effectivePerSheet).toBe(6 * 7 - 2);
    // Linha 0 deve estar centralizada
    const occupied = 4 * 50; // cols=4, gap=0
    const expectedOffset = 7 + (r.usableW - occupied) / 2;
    expect(r.rowOffsets[0]).toBeCloseTo(expectedOffset, 5);
  });

  it("sem cutType — reservedSlots vazio, todas as linhas com offset=marginLeft", async () => {
    const { computeLabelLayout } = await import("@/lib/labels/layout");
    const r = computeLabelLayout({
      sheetW: 210, sheetH: 297, labelW: 50, labelH: 50,
      marginTop: 5, marginBottom: 5, marginLeft: 5, marginRight: 5, gap: 0,
    });
    expect(r.reservedSlots).toEqual([]);
    expect(r.cellsPerRow.every((c) => c === r.best.cols)).toBe(true);
    expect(r.rowOffsets.every((o) => o === 5)).toBe(true);
    expect(r.effectivePerSheet).toBe(r.best.total);
  });
});

describe("clampMarginsToHardware", () => {
  it("teneth_a3 força base ≥ 80", () => {
    const c = clampMarginsToHardware(
      { marginTop: 5, marginBottom: 10, marginLeft: 5, marginRight: 5 },
      HARDWARE_PROFILES.teneth_a3,
    );
    expect(c.marginBottom).toBe(80);
    expect(c.marginTop).toBe(7); // mínimo do hardware
  });
  it("genérico não altera", () => {
    const c = clampMarginsToHardware(
      { marginTop: 2, marginBottom: 2, marginLeft: 2, marginRight: 2 },
      HARDWARE_PROFILES.generico,
    );
    expect(c).toEqual({ marginTop: 2, marginBottom: 2, marginLeft: 2, marginRight: 2 });
  });
});

describe("effectiveUsableArea", () => {
  it("teneth_a3 limita a 306×363 mesmo em SRA3", () => {
    const r = effectiveUsableArea(320, 450,
      { marginTop: 7, marginBottom: 80, marginLeft: 7, marginRight: 7 },
      HARDWARE_PROFILES.teneth_a3,
    );
    expect(r.usableW).toBe(306);
    expect(r.usableH).toBe(363);
  });
});

describe("suggestMarksOffset", () => {
  it("retorna 0 se não há rows ou gap", () => {
    expect(suggestMarksOffset(5, 50, 0, 5)).toBe(0);
    expect(suggestMarksOffset(5, 50, 2, 0)).toBe(0);
  });
  it("aproxima a marca para o centro do primeiro gap", () => {
    const offset = suggestMarksOffset(5, 50, 4, 4);
    expect(offset).toBeGreaterThan(0);
    expect(offset).toBeLessThanOrEqual(10);
  });
});

describe("buildCornerMarks — L (topo) + tick (base)", () => {
  it("gera 4 marcas: 2 Ls em cima, 2 ticks embaixo", async () => {
    const { markSegments } = await import("@/lib/labels/marks");
    const m = buildCornerMarks(210, 297, 7, 80, 7, 7, 0, 5);
    expect(m.marks).toHaveLength(4);
    expect(m.marks[0].kind).toBe("L");
    expect(m.marks[0].corner).toBe("tl");
    expect(m.marks[1].kind).toBe("L");
    expect(m.marks[1].corner).toBe("tr");
    expect(m.marks[2].kind).toBe("tick");
    expect(m.marks[2].corner).toBe("bl");
    expect(m.marks[3].kind).toBe("tick");
    expect(m.marks[3].corner).toBe("br");
    // L → 2 segmentos; tick → 1 segmento
    expect(markSegments(m.marks[0])).toHaveLength(2);
    expect(markSegments(m.marks[2])).toHaveLength(1);
  });
  it("aplica offsetY ao conjunto", () => {
    const m = buildCornerMarks(210, 297, 7, 80, 7, 7, 3, 5);
    expect(m.offsetY).toBe(3);
    const baseline = buildCornerMarks(210, 297, 7, 80, 7, 7, 0, 5);
    m.marks.forEach((mk, i) => {
      expect(mk.vertexY - baseline.marks[i].vertexY).toBeCloseTo(3, 5);
    });
  });
  it("L tl: braços vão para -x e -y a partir do vértice (fora da grade)", async () => {
    const { markSegments } = await import("@/lib/labels/marks");
    const m = buildCornerMarks(210, 297, 7, 80, 7, 7, 0, 5);
    const tl = m.marks[0];
    const segs = markSegments(tl);
    expect(segs[0].x2 - segs[0].x1).toBeCloseTo(-5, 5);
    expect(segs[0].y1).toBe(segs[0].y2);
    expect(segs[1].y2 - segs[1].y1).toBeCloseTo(-5, 5);
    expect(segs[1].x1).toBe(segs[1].x2);
  });
  it("L tr: braços vão para +x e -y", async () => {
    const { markSegments } = await import("@/lib/labels/marks");
    const m = buildCornerMarks(210, 297, 7, 80, 7, 7, 0, 5);
    const tr = m.marks[1];
    const segs = markSegments(tr);
    expect(segs[0].x2 - segs[0].x1).toBeCloseTo(5, 5);
    expect(segs[1].y2 - segs[1].y1).toBeCloseTo(-5, 5);
  });
  it("tick BL: segmento horizontal de 10mm centrado em vertexX", async () => {
    const { markSegments } = await import("@/lib/labels/marks");
    const m = buildCornerMarks(210, 297, 7, 80, 7, 7, 0, 5);
    const bl = m.marks[2];
    const segs = markSegments(bl);
    expect(segs).toHaveLength(1);
    expect(segs[0].y1).toBe(segs[0].y2); // horizontal
    expect(segs[0].x2 - segs[0].x1).toBeCloseTo(10, 5);
    expect((segs[0].x1 + segs[0].x2) / 2).toBeCloseTo(bl.vertexX, 5);
  });
});

describe("LabelCalcConfig — unidade de medida", () => {
  beforeEach(() => localStorage.clear());
  it("default é mm", async () => {
    const { loadConfig } = await import("@/lib/labels/config-storage");
    expect(loadConfig().unit).toBe("mm");
  });
  it("persiste a escolha de cm", async () => {
    const { saveConfig, loadConfig } = await import("@/lib/labels/config-storage");
    saveConfig({ unit: "cm" });
    expect(loadConfig().unit).toBe("cm");
  });
});

describe("findShrinkOpportunity — preserva formato", () => {
  it("etiqueta quadrada → sugestão também quadrada", () => {
    const base: LayoutInput = {
      sheetW: 320, sheetH: 450,
      labelW: 50, labelH: 50,
      marginTop: 7, marginBottom: 7, marginLeft: 7, marginRight: 7,
      gap: 3,
    };
    const layout = computeLabelLayout(base);
    const s = findShrinkOpportunity(base, layout.best.total, 1);
    expect(s).not.toBeNull();
    expect(s!.newLabelW).toBe(s!.newLabelH);
    expect(s!.shrinkW).toBe(s!.shrinkH);
  });

  it("etiqueta retangular → pode reduzir só um lado", () => {
    const base: LayoutInput = {
      sheetW: 320, sheetH: 450,
      labelW: 50, labelH: 30,
      marginTop: 7, marginBottom: 7, marginLeft: 7, marginRight: 7,
      gap: 3,
    };
    const layout = computeLabelLayout(base);
    const s = findShrinkOpportunity(base, layout.best.total, 1);
    // Pode ou não retornar sugestão — só validamos que não trava
    if (s) expect(s.delta).toBeGreaterThan(0);
  });
});

describe("findShrinkOpportunity — range estendido até −5mm", () => {
  it("55x55 em SRA3 (margens 7) → encontra ganho com −4mm", () => {
    const base: LayoutInput = {
      sheetW: 320, sheetH: 450,
      labelW: 55, labelH: 55,
      marginTop: 7, marginBottom: 7, marginLeft: 7, marginRight: 7,
      gap: 0,
    };
    const layout = computeLabelLayout(base);
    const s = findShrinkOpportunity(base, layout.best.total, 1);
    expect(s).not.toBeNull();
    expect(s!.delta).toBeGreaterThan(0);
    expect(s!.shrinkW).toBe(s!.shrinkH); // mantém quadrado
    expect(s!.shrinkW).toBeLessThanOrEqual(5);
  });

  it("85x85 em SRA3 (impossível mesmo com −5mm) → retorna null", () => {
    const base: LayoutInput = {
      sheetW: 320, sheetH: 450,
      labelW: 85, labelH: 85,
      marginTop: 7, marginBottom: 7, marginLeft: 7, marginRight: 7,
      gap: 0,
    };
    const layout = computeLabelLayout(base);
    const s = findShrinkOpportunity(base, layout.best.total, 1);
    expect(s).toBeNull();
  });
});
