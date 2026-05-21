import { describe, it, expect } from "vitest";
import { sumFinishingsPerSheet } from "@/lib/finishings/catalog";

describe("sumFinishingsPerSheet", () => {
  it("sem seleções → zero", () => {
    expect(sumFinishingsPerSheet([], 100)).toEqual({ perSheet: 0, perUnitTotal: 0 });
  });

  it("apenas per_sheet soma direto", () => {
    const r = sumFinishingsPerSheet(
      [
        { pricing_model: "per_sheet", price: 0.5 },
        { pricing_model: "per_sheet", price: 0.3 },
      ],
      100,
    );
    expect(r.perSheet).toBeCloseTo(0.8);
    expect(r.perUnitTotal).toBe(0);
  });

  it("per_unit com units padrão = sheets → rateado volta ao valor da unidade", () => {
    const r = sumFinishingsPerSheet(
      [{ pricing_model: "per_unit", price: 1.2 }],
      50,
    );
    expect(r.perSheet).toBe(0);
    expect(r.perUnitTotal).toBe(60); // 1.2 × 50
    // rateio por folha = perUnitTotal / sheets = 1.2 (= preço unitário)
    expect(r.perUnitTotal / 50).toBeCloseTo(1.2);
  });

  it("per_unit com units explícito", () => {
    const r = sumFinishingsPerSheet(
      [{ pricing_model: "per_unit", price: 2, units: 4 }],
      100,
    );
    expect(r.perUnitTotal).toBe(8);
  });

  it("mistura: per_sheet + per_unit", () => {
    const r = sumFinishingsPerSheet(
      [
        { pricing_model: "per_sheet", price: 0.5 },
        { pricing_model: "per_unit", price: 1, units: 10 },
      ],
      100,
    );
    expect(r.perSheet).toBe(0.5);
    expect(r.perUnitTotal).toBe(10);
  });
});
