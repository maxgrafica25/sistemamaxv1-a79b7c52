import { describe, it, expect } from "vitest";
import { sumFinishingsPerSheet } from "@/lib/finishings/catalog";
import {
  resolveFinishingPricePerSheet,
  type FinishingTier,
} from "@/lib/labels/finishing-pricing";

// Helper para simular o que PrintForm.buildSelections faz por trás dos panos:
// resolve preço efetivo (tier) para per_sheet, mantém base para per_unit.
function buildSelections(
  fins: {
    pricing_model: "per_sheet" | "per_unit";
    price_per_sheet: number;
    tiers?: FinishingTier[];
  }[],
  qty: number,
) {
  return fins.map((f) => ({
    pricing_model: f.pricing_model,
    price:
      f.pricing_model === "per_sheet"
        ? resolveFinishingPricePerSheet(f.price_per_sheet, f.tiers ?? [], qty)
        : f.price_per_sheet,
  }));
}

const tier = (
  min: number,
  max: number | null,
  price: number,
): FinishingTier => ({
  id: `t${min}`,
  finishing_id: "f1",
  label: `${min}-${max ?? "+"}`,
  min_qty: min,
  max_qty: max,
  price_per_sheet: price,
  sort_order: min,
});


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
