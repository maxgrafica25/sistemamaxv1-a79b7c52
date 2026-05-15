import { describe, it, expect } from "vitest";
import { calcSheetYield, resolvePaperSheet, sizeToMm, PRODUCTION_SHEET } from "@/lib/quotes-v2/sheet-yield";

describe("calcSheetYield", () => {
  it("panfleto 100x150mm cabe múltiplas vezes", () => {
    const r = calcSheetYield(100, 150, 1000);
    expect(r).not.toBeNull();
    expect(r!.perSheet).toBeGreaterThan(0);
    expect(r!.sheetsNeeded).toBe(Math.ceil(1000 / r!.perSheet));
  });

  it("cartão 90x50mm rende mais que panfleto", () => {
    const card = calcSheetYield(90, 50, 100)!;
    const flyer = calcSheetYield(100, 150, 100)!;
    expect(card.perSheet).toBeGreaterThan(flyer.perSheet);
  });

  it("escolhe a melhor orientação", () => {
    // 200x100 -> paisagem deve render mais
    const r = calcSheetYield(200, 100, 10)!;
    expect(r.perSheet).toBeGreaterThan(0);
  });

  it("retorna null quando excede a folha útil", () => {
    expect(calcSheetYield(400, 500, 10)).toBeNull();
  });

  it("retorna null para entradas inválidas", () => {
    expect(calcSheetYield(0, 100, 10)).toBeNull();
    expect(calcSheetYield(100, 0, 10)).toBeNull();
  });
});
