import { describe, it, expect } from "vitest";
import { corNoPb, custosDaMaquina, pareceColorida } from "@/lib/equipmentCost";

// Epson 5710 do cadastro (tinta a granel)
const epson = [
  { name: "Tinta preta (bulk)", price: 178, yield_pages: 50000, scales_with_coverage: true, mode: "shared" },
  { name: "Tinta ciano (bulk)", price: 204, yield_pages: 40000, scales_with_coverage: true, mode: "color_only" },
  { name: "Tinta magenta (bulk)", price: 204, yield_pages: 40000, scales_with_coverage: true, mode: "color_only" },
  { name: "Tinta amarela (bulk)", price: 204, yield_pages: 40000, scales_with_coverage: true, mode: "color_only" },
  { name: "Almofadas", price: 30, yield_pages: 35000, scales_with_coverage: false, mode: "shared" },
  { name: "Manutenção", price: 500, yield_pages: 90000, scales_with_coverage: false, mode: "shared" },
  { name: "Depreciação", price: 6500, yield_pages: 250000, scales_with_coverage: false, mode: "shared" },
];

describe("custo por página da máquina", () => {
  it("máquina colorida tem custo colorido e P&B (P&B sem ciano, magenta e amarelo)", () => {
    const c = custosDaMaquina("color", epson);
    expect(c.colorida).toBeCloseTo(0.1079, 4);
    expect(c.pb).toBeCloseTo(0.0467, 4);
    expect(c.fabricanteColorida).toBeCloseTo(0.0513, 4);
    expect(c.direto).toBeNull();
  });

  it("máquina P&B só tem custo P&B; ribbon tem custo direto", () => {
    const pb = custosDaMaquina("pb", [{ price: 220, yield_pages: 30000, scales_with_coverage: true }]);
    expect(pb.colorida).toBeNull();
    expect(pb.pb).toBeCloseTo((220 / 30000) * 4, 6);
    const r = custosDaMaquina("ribbon", [{ price: 300, yield_pages: 100, scales_with_coverage: true }]);
    expect(r.direto).toBeCloseTo(3);
  });

  it("avisa cadastro errado: tipo 'outro' com tintas de cor, ou cor entrando no P&B", () => {
    expect(pareceColorida("other", epson)).toBe(true);
    expect(pareceColorida("color", epson)).toBe(false);
    expect(pareceColorida("pb", [{ name: "Toner preto", price: 1, yield_pages: 1 }])).toBe(false);
    const errada = epson.map((c) => ({ ...c, mode: "shared" }));
    expect(corNoPb("color", errada).map((c) => c.name)).toEqual(["Tinta ciano (bulk)", "Tinta magenta (bulk)", "Tinta amarela (bulk)"]);
    expect(corNoPb("color", epson)).toEqual([]);
  });
});
