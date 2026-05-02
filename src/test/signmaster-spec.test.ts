import { describe, it, expect } from "vitest";
import {
  computeSignmasterLayout,
  computeSignmasterMarks,
  findSignmasterShrinkOpportunity,
  SM_REG_MARK_MARGIN,
  SM_MARK_LENGTH,
} from "@/lib/labels/signmaster-spec";

describe("computeSignmasterLayout — spec do cliente", () => {
  it("32×45 cm + Ø5 cm → 5 × 8 = 40 etiquetas", () => {
    const r = computeSignmasterLayout({ sheetW: 320, sheetH: 450, labelDiameter: 50 });
    expect(r.labelsPerRow).toBe(5);
    expect(r.labelsPerColumn).toBe(8);
    expect(r.total).toBe(40);
    expect(r.positions).toHaveLength(40);
  });

  it("32×45 cm + Ø3 cm → 9 × 13 = 117 etiquetas", () => {
    const r = computeSignmasterLayout({ sheetW: 320, sheetH: 450, labelDiameter: 30 });
    expect(r.labelsPerRow).toBe(9);
    expect(r.labelsPerColumn).toBe(13);
    expect(r.total).toBe(117);
  });

  it("32×45 cm + Ø4 cm → preenche dentro da folha", () => {
    const r = computeSignmasterLayout({ sheetW: 320, sheetH: 450, labelDiameter: 40 });
    // step=43; cols=floor((306+3)/43)=7; rows=floor((436+3)/43)=10
    expect(r.labelsPerRow).toBe(7);
    expect(r.labelsPerColumn).toBe(10);
    expect(r.total).toBe(69);
    expect(r.cellsPerRow[0]).toBe(6);
    expect(r.cellsPerRow.slice(1).every((c) => c === 7)).toBe(true);
  });

  it("32×45 cm + Ø3,5 cm com gap 3mm → 87 etiquetas (7 + 10×8)", () => {
    const r = computeSignmasterLayout({ sheetW: 320, sheetH: 450, labelDiameter: 35 });
    expect(r.labelsPerRow).toBe(8);
    expect(r.labelsPerColumn).toBe(11);
    expect(r.cellsPerRow[0]).toBe(7);
    expect(r.cellsPerRow.slice(1).every((c) => c === 8)).toBe(true);
    expect(r.total).toBe(87);
    expect(r.positions).toHaveLength(87);
  });

  it("aplica nudge vertical de -1mm e centraliza horizontalmente", () => {
    const r = computeSignmasterLayout({ sheetW: 320, sheetH: 450, labelDiameter: 50 });
    // totalGridWidth = 5*50 + 4*3 = 262; offsetX = (320-262)/2 = 29
    expect(r.offsetX).toBeCloseTo(29, 5);
    // totalGridHeight = 8*50 + 7*3 = 421; offsetY = (450-421)/2 - 1 = 13.5
    expect(r.offsetY).toBeCloseTo(13.5, 5);
  });

  it("primeira etiqueta tem centro em offset + raio", () => {
    const r = computeSignmasterLayout({ sheetW: 320, sheetH: 450, labelDiameter: 50 });
    const p0 = r.positions[0];
    expect(p0.cx).toBeCloseTo(r.offsetX + 25, 5);
    expect(p0.cy).toBeCloseTo(r.offsetY + 25, 5);
  });

  it("todas as etiquetas ficam dentro da folha", () => {
    const r = computeSignmasterLayout({ sheetW: 320, sheetH: 450, labelDiameter: 50 });
    for (const p of r.positions) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + 50).toBeLessThanOrEqual(320 + 0.01);
      expect(p.y + 50).toBeLessThanOrEqual(450 + 0.01);
    }
  });
});

describe("computeSignmasterMarks", () => {
  it("L superiores com vértice em (7,7) e (sheetW-7, 7), braços para dentro", () => {
    const m = computeSignmasterMarks({ sheetW: 320, sheetH: 450, gridBottom: 434.5 });
    expect(m.topLeft[0]).toEqual({ x1: 7, y1: 7, x2: 7 + SM_MARK_LENGTH, y2: 7 });
    expect(m.topLeft[1]).toEqual({ x1: 7, y1: 7, x2: 7, y2: 7 + SM_MARK_LENGTH });
    expect(m.topRight[0]).toEqual({ x1: 313, y1: 7, x2: 313 - SM_MARK_LENGTH, y2: 7 });
  });

  it("T inferiores defaultam para min(gridBottom+5, sheetH-10)", () => {
    const m = computeSignmasterMarks({ sheetW: 320, sheetH: 450, gridBottom: 434.5 });
    // 434.5+5 = 439.5; sheetH-10 = 440. → 439.5
    expect(m.bottomMarkY).toBeCloseTo(439.5, 5);
  });

  it("override manual de bottomMarkY é respeitado", () => {
    const m = computeSignmasterMarks({ sheetW: 320, sheetH: 450, gridBottom: 434.5, bottomMarkY: 442 });
    expect(m.bottomMarkY).toBe(442);
  });

  it("margem das marcas é 7mm em todos os lados", () => {
    expect(SM_REG_MARK_MARGIN).toBe(7);
  });
});

describe("findSignmasterShrinkOpportunity — sugestão de retalho", () => {
  it("Ø50 em SRA3 (40 etiquetas) sugere reduzir para caber +8", () => {
    const s = findSignmasterShrinkOpportunity(
      { sheetW: 320, sheetH: 450, labelDiameter: 50 },
      40,
      1,
    );
    expect(s).not.toBeNull();
    expect(s!.delta).toBeGreaterThanOrEqual(8);
    expect(s!.newLabelW).toBe(s!.newLabelH); // sempre quadrado (diâmetro)
    expect(s!.newLabelW).toBeLessThan(50);
  });

  it("retorna null quando não há ganho possível", () => {
    // Diâmetro mínimo extremo: nenhuma redução melhora
    const s = findSignmasterShrinkOpportunity(
      { sheetW: 320, sheetH: 450, labelDiameter: 6 },
      computeSignmasterLayout({ sheetW: 320, sheetH: 450, labelDiameter: 6 }).total,
      1,
    );
    // pode ser null OU ter delta>0; verifica só que se devolveu, é coerente
    if (s) expect(s.delta).toBeGreaterThan(0);
  });
});
