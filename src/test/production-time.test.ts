import { describe, it, expect } from "vitest";
import {
  estimateProductionTime,
  perimeterMm,
  formatDuration,
} from "@/lib/labels/production-time";
import { HARDWARE_PROFILES } from "@/lib/labels/hardware";

const teneth = HARDWARE_PROFILES.teneth_a3;
const generico = HARDWARE_PROFILES.generico;

describe("perimeterMm", () => {
  it("retângulo 50x50 → 200mm", () => {
    expect(perimeterMm("retangulo", 50, 50)).toBe(200);
    expect(perimeterMm("quadrado", 50, 50)).toBe(200);
  });
  it("redondo Ø50 → π·50", () => {
    expect(perimeterMm("redondo", 50, 50)).toBeCloseTo(Math.PI * 50, 5);
  });
  it("personalizado aplica fator 1.2", () => {
    expect(perimeterMm("personalizado", 50, 50)).toBeCloseTo(2 * 100 * 1.2, 5);
  });
});

describe("estimateProductionTime", () => {
  it("retorna null quando hardware sem velocidade", () => {
    expect(
      estimateProductionTime({
        shape: "quadrado",
        labelW: 50,
        labelH: 50,
        totalLabels: 100,
        sheets: 5,
        hardware: generico,
      }),
    ).toBeNull();
  });

  it("Teneth A3 — 42 etiquetas 50x50 em 1 folha", () => {
    const r = estimateProductionTime({
      shape: "quadrado",
      labelW: 50,
      labelH: 50,
      totalLabels: 42,
      sheets: 1,
      hardware: teneth,
    })!;
    // 42 * 200mm = 8400mm; / 300mm/s = 28s; + 15s setup = 43s
    expect(r.cuttingSec).toBeCloseTo(28, 0);
    expect(r.setupSec).toBe(15);
    expect(r.totalSec).toBeCloseTo(43, 0);
    expect(r.totalPerimeterM).toBeCloseTo(8.4, 2);
    expect(r.loadBadge).toBe("pronta-entrega");
  });

  it("badge intensa quando totalSec > 1h", () => {
    const r = estimateProductionTime({
      shape: "retangulo",
      labelW: 100,
      labelH: 100,
      totalLabels: 6000,
      sheets: 200,
      hardware: teneth,
    })!;
    expect(r.loadBadge).toBe("intensa");
  });
});

describe("formatDuration", () => {
  it("formata segundos/min/hora", () => {
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(125)).toBe("2 min");
    expect(formatDuration(3600)).toBe("1 h");
    expect(formatDuration(3900)).toBe("1 h 5 min");
  });
});
