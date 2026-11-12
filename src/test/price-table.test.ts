import { describe, it, expect } from "vitest";
import {
  chainTiers,
  mergeSales,
  qtyForProfit,
  salesSummary,
  tierProfitRange,
  itemAttributes,
  matchesSearch,
  minUnitPrice,
  paperSheetCost,
  parseTierRanges,
  realProfitPct,
  tierProblems,
  unitCost,
  type EquipmentInput,
  type PriceSettings,
  type PriceTableItem,
} from "@/lib/priceTable";

const s: PriceSettings = { feesPct: 0.22, targetPct: 0.33, minuteRate: 0.816 }; // preparo 2,5 min ≈ R$ 2,04

const ricoh: EquipmentInput = {
  id: "ricoh",
  printer_type: "pb",
  consumables: [
    { price: 220, yield_pages: 30000, scales_with_coverage: true, mode: "shared" },
    { price: 2100, yield_pages: 80000, scales_with_coverage: false, mode: "shared" },
  ],
};
const xerox: EquipmentInput = {
  id: "xerox",
  printer_type: "color",
  consumables: [
    { price: 700, yield_pages: 35000, scales_with_coverage: true, mode: "shared" },
    { price: 700, yield_pages: 35000, scales_with_coverage: true, mode: "color_only" },
  ],
};

const base: PriceTableItem = {
  calc_type: "impressao", equipment_id: "ricoh", color_mode: "pb", sheet_size: "A4", sides: 1,
  paper_id: null, material_cost: 0.038, extra_cost: 0, minutes_per_unit: 0,
};

describe("tabela de preços", () => {
  it("papel 66×96 rende 9 A4 / 4 A3; resma A4 já cortada vale por folha", () => {
    const formatao = { id: "p", sheet_qty: 100, pack_price: 90, freight_price: 0, is_cut_size: false, purchase_sheet_width_mm: 660, purchase_sheet_height_mm: 960 };
    expect(paperSheetCost(formatao, "A4")).toBeCloseTo(0.1);
    expect(paperSheetCost(formatao, "A3")).toBeCloseTo(0.225);
    const resma = { id: "r", sheet_qty: 500, pack_price: 18.91, freight_price: 0, is_cut_size: true, purchase_sheet_width_mm: 210, purchase_sheet_height_mm: 297 };
    expect(paperSheetCost(resma, "A4")).toBeCloseTo(0.0378, 4);
  });

  it("custo = papel + máquina × cliques (A3 e frente e verso dobram a máquina)", () => {
    const ctx = { papers: [], equipments: [ricoh, xerox], minuteRate: s.minuteRate };
    const pb = unitCost(base, ctx);
    expect(pb.machine).toBeCloseTo((220 / 30000) * 4 + 2100 / 80000, 5); // P&B também com 20% de cobertura
    const a3fv = unitCost({ ...base, sheet_size: "A3", sides: 2 }, ctx);
    expect(a3fv.machine).toBeCloseTo(pb.machine * 4, 5);
    // colorida e P&B com 20% de cobertura (toner ×4); P&B sem os itens "só colorida"
    const color = unitCost({ ...base, equipment_id: "xerox", color_mode: "color" }, ctx);
    expect(color.machine).toBeCloseTo((700 / 35000) * 4 * 2, 5);
    const xeroxPb = unitCost({ ...base, equipment_id: "xerox" }, ctx);
    expect(xeroxPb.machine).toBeCloseTo((700 / 35000) * 4, 5);
  });

  it("serviço manual = material + minutos × valor do minuto", () => {
    const c = unitCost({ ...base, calc_type: "manual", material_cost: 1.63, minutes_per_unit: 3 }, { papers: [], equipments: [], minuteRate: 1 });
    expect(c.total).toBeCloseTo(4.63);
    expect(unitCost({ ...base, calc_type: "manual", material_cost: 0 }, { papers: [], equipments: [], minuteRate: 1 }).missing).toBe(true);
  });

  it("lucro real desconta taxas e a preparação do pedido", () => {
    // 1 cópia P&B a R$ 1,00 com custo R$ 0,10: 0,78 − 0,10 − 2,04 = prejuízo
    expect(realProfitPct(1, 1, 0.1, s)!).toBeCloseTo(0.78 - 0.1 - 2.04, 2);
    // 300 cópias a R$ 0,50
    expect(realProfitPct(0.5, 300, 0.1, s)!).toBeCloseTo((117 - 30 - 2.04) / 150, 3);
    // preço mínimo atinge exatamente a meta
    const p = minUnitPrice(20, 0.5, s)!;
    expect(realProfitPct(p, 20, 0.5, s)!).toBeCloseTo(0.33, 6);
  });

  it("aponta degrau, buraco e preço que sobe", () => {
    const probs = tierProblems([
      { min_qty: 1, max_qty: 50, price: 1, tiny_sku: null },
      { min_qty: 51, max_qty: 300, price: 0.5, tiny_sku: null },
      { min_qty: 302, max_qty: null, price: 0.6, tiny_sku: null },
    ]);
    expect(probs.map((p) => p.index)).toEqual([1, 2, 2]);
    expect(probs[0].message).toMatch(/Degrau/);
    expect(probs[1].message).toMatch(/301/);
    expect(probs[2].message).toMatch(/maior/);
  });

  it("lê faixas padrão", () => {
    expect(parseTierRanges("1-20, 21-100, 101 a 300, 301+")).toEqual([
      { min_qty: 1, max_qty: 20 }, { min_qty: 21, max_qty: 100 }, { min_qty: 101, max_qty: 300 }, { min_qty: 301, max_qty: null },
    ]);
    expect(parseTierRanges("1, 2-5")).toEqual([{ min_qty: 1, max_qty: 1 }, { min_qty: 2, max_qty: 5 }]);
  });
});

describe("filtros da tabela de preços", () => {
  const print = { calc_type: "impressao" as const, color_mode: "color" as const, sheet_size: "A3" as const, sides: 2 };
  it("tira papel, gramatura, tamanho, cor e lados do item", () => {
    expect(itemAttributes({ ...print, name: "Impressão Color Laser A3 Couchê 300g Frente x Verso" })).toEqual({
      process: "Laser", paper: "Couchê", grammage: "300g", size: "A3", color: "Colorida", sides: "Frente e verso",
    });
    expect(itemAttributes({ ...print, name: "Impressão color em Vinil Adesivo A4" }).paper).toBe("Vinil");
    expect(itemAttributes({ ...print, name: "Impressão PB ENVELOPE OFÍCIO - 11,4X22,9cm" }).paper).toBe("Envelope");
    const servico = itemAttributes({ calc_type: "manual", color_mode: null, sheet_size: "A4", sides: 1, name: "Plastificação A3 0.5mm" });
    expect(servico).toEqual({ process: null, paper: null, grammage: null, size: "A3", color: null, sides: null });
    expect(itemAttributes({ ...print, name: "Impressão Color Inkjet A4 Sulfite 75g" }).process).toBe("Jato de tinta");
  });

  it("busca por palavras em qualquer ordem e sem acento", () => {
    expect(matchesSearch("Impressão Color Laser A3 Couchê 300g", "couche 300 a3")).toBe(true);
    expect(matchesSearch("Impressão Color Laser A3 Couchê 300g", "couche a4")).toBe(false);
  });
});

describe("faixas encadeadas", () => {
  it("cada faixa começa logo depois do 'até' da anterior", () => {
    expect(chainTiers([
      { min_qty: 1, max_qty: 100 }, { min_qty: 51, max_qty: 300 }, { min_qty: 999, max_qty: null },
    ])).toEqual([
      { min_qty: 1, max_qty: 100 }, { min_qty: 101, max_qty: 300 }, { min_qty: 301, max_qty: null },
    ]);
  });
});

describe("lucro dentro da faixa e nas vendas reais", () => {
  // Impressão PB Inkjet A4 Sulfite 75g: custo ≈ R$ 0,085, faixa 1 a 50 a R$ 0,60
  const c = 0.085;
  it("mostra o lucro do começo ao fim da faixa e de quantas unidades bate a meta", () => {
    const r = tierProfitRange({ min_qty: 1, max_qty: 50, price: 0.6 }, c, s);
    expect(r.from!).toBeLessThan(-2.5);
    expect(r.to!).toBeCloseTo((30 * 0.78 - 50 * c - 2.04) / 30, 2);
    expect(qtyForProfit(0.6, c, s, 0)).toBe(6); // a partir de 6 cópias não dá prejuízo
    expect(qtyForProfit(0.6, c, s, 0.33)).toBe(12);
    expect(realProfitPct(0.6, 12, c, s)!).toBeGreaterThanOrEqual(0.33);
    expect(realProfitPct(0.6, 11, c, s)!).toBeLessThan(0.33);
    expect(qtyForProfit(0.1, c, s, 0.33)).toBeNull(); // preço abaixo do custo: nunca
    const aberta = tierProfitRange({ min_qty: 1001, max_qty: null, price: 0.2 }, c, s);
    expect(aberta.to!).toBeCloseTo((0.2 * 0.78 - c) / 0.2, 6);
  });

  it("soma o lucro das vendas reais, dividindo a preparação entre os itens do pedido", () => {
    const v = salesSummary([[1, 0.6, 1], [20, 0.6, 0.5]], c, s);
    expect(v.orders).toBe(2);
    expect(v.units).toBe(21);
    expect(v.revenue).toBeCloseTo(12.6);
    const esperado = (0.6 * 0.78 - c - 2.04) + (12 * 0.78 - 20 * c - 2.04 * 0.5);
    expect(v.profit).toBeCloseTo(esperado, 6);
    expect(v.lossOrders).toBe(1);
    expect(mergeSales([v, v]).profitPct).toBeCloseTo(v.profitPct!, 9);
  });
});
