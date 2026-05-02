import { describe, it, expect } from "vitest";
import {
  pickFinishingTier,
  resolveFinishingPricePerSheet,
  type FinishingTier,
} from "@/lib/labels/finishing-pricing";

const t = (min: number, max: number | null, price: number, id = `${min}`): FinishingTier => ({
  id,
  finishing_id: "x",
  label: `${min}-${max ?? "∞"}`,
  min_qty: min,
  max_qty: max,
  price_per_sheet: price,
  sort_order: 0,
});

describe("pickFinishingTier", () => {
  const tiers = [t(1, 10, 1.8), t(11, 50, 1.4), t(51, null, 1.0)];

  it("retorna null sem tiers", () => {
    expect(pickFinishingTier([], 5)).toBeNull();
  });

  it("escolhe faixa correta nos limites", () => {
    expect(pickFinishingTier(tiers, 1)?.price_per_sheet).toBe(1.8);
    expect(pickFinishingTier(tiers, 10)?.price_per_sheet).toBe(1.8);
    expect(pickFinishingTier(tiers, 11)?.price_per_sheet).toBe(1.4);
    expect(pickFinishingTier(tiers, 50)?.price_per_sheet).toBe(1.4);
    expect(pickFinishingTier(tiers, 51)?.price_per_sheet).toBe(1.0);
    expect(pickFinishingTier(tiers, 5000)?.price_per_sheet).toBe(1.0);
  });

  it("qty abaixo do mínimo cai na primeira tier", () => {
    expect(pickFinishingTier(tiers, 0)?.price_per_sheet).toBe(1.8);
  });
});

describe("resolveFinishingPricePerSheet", () => {
  it("usa base quando sem tiers", () => {
    expect(resolveFinishingPricePerSheet(2.5, [], 100)).toBe(2.5);
  });

  it("aplica tier quando há", () => {
    expect(resolveFinishingPricePerSheet(2.5, [t(1, null, 1.2)], 1)).toBe(1.2);
  });
});
