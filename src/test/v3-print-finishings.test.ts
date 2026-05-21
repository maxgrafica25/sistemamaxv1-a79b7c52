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

describe("buildSelections + tiers (Print V3)", () => {
  it("per_sheet sem tier → usa preço base", () => {
    const sel = buildSelections(
      [{ pricing_model: "per_sheet", price_per_sheet: 0.5 }],
      500,
    );
    expect(sel[0].price).toBe(0.5);
  });

  it("per_sheet com tier que cobre a qty → preço da tier", () => {
    const tiers = [tier(1, 99, 0.5), tier(100, 499, 0.35), tier(500, null, 0.2)];
    const sel = buildSelections(
      [{ pricing_model: "per_sheet", price_per_sheet: 0.5, tiers }],
      300,
    );
    expect(sel[0].price).toBe(0.35);
  });

  it("per_sheet com qty abaixo do menor min_qty → primeira tier", () => {
    const tiers = [tier(10, 100, 0.4), tier(101, null, 0.25)];
    const sel = buildSelections(
      [{ pricing_model: "per_sheet", price_per_sheet: 0.5, tiers }],
      5,
    );
    expect(sel[0].price).toBe(0.4);
  });

  it("per_unit ignora tiers (mantém base)", () => {
    const tiers = [tier(1, 1000, 0.1)];
    const sel = buildSelections(
      [{ pricing_model: "per_unit", price_per_sheet: 2, tiers }],
      300,
    );
    expect(sel[0].price).toBe(2);
  });

  it("simulação em qtys diferentes → cada uma resolve sua própria tier", () => {
    const tiers = [tier(1, 99, 0.5), tier(100, 499, 0.35), tier(500, null, 0.2)];
    const f = { pricing_model: "per_sheet" as const, price_per_sheet: 0.5, tiers };
    expect(buildSelections([f], 50)[0].price).toBe(0.5);
    expect(buildSelections([f], 200)[0].price).toBe(0.35);
    expect(buildSelections([f], 1000)[0].price).toBe(0.2);
  });
});
