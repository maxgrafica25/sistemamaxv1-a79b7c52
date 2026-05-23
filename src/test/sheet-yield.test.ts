import { describe, it, expect } from "vitest";
import { calcSheetYield, resolvePaperSheet, sizeToMm, PRODUCTION_SHEET } from "@/lib/quotes/sheet-yield";

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

describe("resolvePaperSheet", () => {
  it("is_cut_size força 1 peça por folha (folha = size do item)", () => {
    const r = resolvePaperSheet({ isCutSize: true, size: "A4" });
    expect(r.forcePerSheetOne).toBe(true);
    expect(r.sheet).toEqual({ widthMm: 210, heightMm: 297 });
  });

  it("usa folhão custom quando preenchido", () => {
    const r = resolvePaperSheet({
      isCutSize: false,
      size: "A4",
      purchaseSheetWidthMm: 660,
      purchaseSheetHeightMm: 960,
    });
    expect(r.forcePerSheetOne).toBe(false);
    expect(r.sheet).toEqual({ widthMm: 660, heightMm: 960 });
  });

  it("default → folhão de produção (SRA3 ~ 328×478)", () => {
    const r = resolvePaperSheet({ isCutSize: false, size: "A4" });
    expect(r.forcePerSheetOne).toBe(false);
    expect(r.sheet).toEqual(PRODUCTION_SHEET);
  });

  it("sizeToMm mapeia A4/A3/SRA3", () => {
    expect(sizeToMm("A4")).toEqual({ widthMm: 210, heightMm: 297 });
    expect(sizeToMm("a3")).toEqual({ widthMm: 297, heightMm: 420 });
    expect(sizeToMm("SRA3")).toEqual({ widthMm: 320, heightMm: 450 });
    expect(sizeToMm("100x150mm")).toEqual({ widthMm: 100, heightMm: 150 });
    expect(sizeToMm(null)).toBeNull();
  });
});
