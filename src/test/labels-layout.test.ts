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
    expect(buildAnchoringLadder(50, 20, 0)).toEqual([]);
  });
});

describe("findShrinkOpportunity", () => {
  const base = (w: number, h: number, sheet = A4): LayoutInput => ({
    ...sheet, ...m5, gap: 0, labelW: w, labelH: h,
  });

  it("51×51 em A4 → −1mm faz caber mais (volta para 50×50)", () => {
    // 51×51 com útil 200x287: cols=3, rows=5 → 15
    // 50×50: cols=4, rows=5 → 20
    const original = computeLabelLayout(base(51, 51));
    expect(original.best.total).toBe(15);
    const sug = findShrinkOpportunity(base(51, 51), 15, 4);
    expect(sug).not.toBeNull();
    expect(sug!.delta).toBeGreaterThan(0);
    expect(sug!.newPerSheet).toBe(20);
    expect(sug!.extraUnitsForSameSheets).toBe(20); // 5 extras × 4 folhas
  });

  it("90×90 em SRA3 → testa caminho do −3mm se houver ganho", () => {
    const orig = computeLabelLayout(base(90, 90, SRA3));
    const sug = findShrinkOpportunity(base(90, 90, SRA3), orig.best.total, 1);
    // Pode ou não ter ganho — só validamos consistência: se houver, o novo é > original.
    if (sug) {
      expect(sug.newPerSheet).toBeGreaterThan(orig.best.total);
      expect(sug.shrinkW).toBeLessThanOrEqual(3);
      expect(sug.shrinkH).toBeLessThanOrEqual(3);
    }
  });

  it("etiqueta minúscula (6×6) → bloqueia redução abaixo de 5mm", () => {
    const orig = computeLabelLayout(base(6, 6));
    // 6×6 com gap 0: cols=33, rows=47 → 1551
    // Reduzir para 5×5: cols=40, rows=57 → 2280 (ganho real, mas dw=1 ok)
    // Reduzir para 4×4: bloqueado (< 5mm)
    const sug = findShrinkOpportunity(base(6, 6), orig.best.total, 1);
    if (sug) {
      expect(sug.newLabelW).toBeGreaterThanOrEqual(5);
      expect(sug.newLabelH).toBeGreaterThanOrEqual(5);
    }
  });

  it("retorna null se não há ganho possível", () => {
    // Etiqueta 100×100 em A4: cols=2, rows=2 → 4. Reduções de 1-3mm não devem aumentar.
    const orig = computeLabelLayout(base(100, 100));
    expect(orig.best.total).toBe(4);
    const sug = findShrinkOpportunity(base(100, 100), 4, 1);
    expect(sug).toBeNull();
  });
});

describe("CUT_DEFAULTS", () => {
  it("plotter redondo tem maior gap que corte reto", () => {
    expect(CUT_DEFAULTS.plotter_redondo.gap).toBeGreaterThan(CUT_DEFAULTS.corte_reto.gap);
  });
  it("plotters têm maior margem top/bottom (marca de registro)", () => {
    expect(CUT_DEFAULTS.plotter_quadrado.marginTop).toBeGreaterThan(CUT_DEFAULTS.corte_reto.marginTop);
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
