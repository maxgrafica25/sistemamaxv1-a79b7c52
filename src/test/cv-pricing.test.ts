import { describe, it, expect } from "vitest";
import {
  calcularItemCV,
  roundUpToTenCents,
  type CVMaterial,
  type CVPrinter,
  type CVFinish,
} from "@/lib/cv-pricing/engine";

const lona: CVMaterial = {
  id: "m1", nome: "Lona Brilho 440g", categoria: "lona",
  largura_util_cm: 320, custo_mt2: 10, margem_mt2_pct: 50, valor_minimo: 0,
};
const adesivo: CVMaterial = {
  id: "m2", nome: "Adesivo Vinil", categoria: "adesivo",
  largura_util_cm: 150, custo_mt2: 5, margem_mt2_pct: 100, valor_minimo: 50,
};
const printer: CVPrinter = {
  id: "p1", nome: "Mimaki", largura_max_cm: 160,
  custo_mt2_print: 8, margem_mt2_print_pct: 50,
  custo_fixo_setup: 5, lucro_fixo_setup: 5,
  categorias_compativeis: ["lona", "adesivo"],
};

const ilhos: CVFinish = {
  id: "f1", nome: "Ilhós", categoria_compativel: ["lona"],
  tipo_calculo: "unidade", custo: 1, margem_pct: 0,
};
const bainha: CVFinish = {
  id: "f2", nome: "Bainha", categoria_compativel: ["lona"],
  tipo_calculo: "perimetro_metro", custo: 2, margem_pct: 0,
};
const laminacao: CVFinish = {
  id: "f3", nome: "Laminação", categoria_compativel: ["adesivo"],
  tipo_calculo: "mt2", custo: 3, margem_pct: 0,
};
const recorte: CVFinish = {
  id: "f4", nome: "Recorte", categoria_compativel: ["adesivo"],
  tipo_calculo: "fixo", custo: 20, margem_pct: 0,
};

describe("roundUpToTenCents", () => {
  it("rounds up to next R$ 0,10", () => {
    expect(roundUpToTenCents(10.01)).toBe(10.1);
    expect(roundUpToTenCents(10.10)).toBe(10.1);
    expect(roundUpToTenCents(0)).toBe(0);
  });
});

describe("calcularItemCV — base", () => {
  it("calcula área e preço de mídia + impressão", () => {
    const r = calcularItemCV({
      largura_cm: 100, altura_cm: 100, quantidade: 1,
      material: lona, printer, acabamentos: [],
    });
    expect(r.area_total_m2).toBeCloseTo(1);
    expect(r.tem_emenda).toBe(false);
    // mídia: 1 * 10 * 1.5 = 15
    expect(r.preco_midia).toBe(15);
    // impressão: 1*8*1.5 + 5 + 5 = 22
    expect(r.preco_impressao).toBe(22);
    expect(r.preco_total).toBe(37);
  });

  it("detecta emenda quando largura > impressora", () => {
    const r = calcularItemCV({
      largura_cm: 200, altura_cm: 100, quantidade: 1,
      material: lona, printer, acabamentos: [],
    });
    expect(r.tem_emenda).toBe(true);
  });
});

describe("acabamentos por tipo_calculo", () => {
  it("unidade — multiplica por qtd_unidades * quantidade", () => {
    const r = calcularItemCV({
      largura_cm: 100, altura_cm: 100, quantidade: 2,
      material: lona, printer, acabamentos: [{ finish: ilhos, quantidade_unidades: 4 }],
    });
    // 4 ilhós * 2 peças * R$1 = 8
    expect(r.finishes[0].qtd_calculada).toBe(8);
    expect(r.finishes[0].valor).toBe(8);
  });

  it("perimetro_metro — usa perímetro em metros", () => {
    const r = calcularItemCV({
      largura_cm: 100, altura_cm: 100, quantidade: 1,
      material: lona, printer, acabamentos: [{ finish: bainha }],
    });
    // perímetro = 4m * R$2 = 8
    expect(r.finishes[0].qtd_calculada).toBe(4);
    expect(r.finishes[0].valor).toBe(8);
  });

  it("mt2 — usa área total", () => {
    const r = calcularItemCV({
      largura_cm: 100, altura_cm: 50, quantidade: 1,
      material: adesivo, printer, acabamentos: [{ finish: laminacao }],
    });
    expect(r.finishes[0].qtd_calculada).toBeCloseTo(0.5);
    expect(r.finishes[0].valor).toBeCloseTo(1.5);
  });

  it("fixo — independe de área/quantidade", () => {
    const r = calcularItemCV({
      largura_cm: 100, altura_cm: 100, quantidade: 5,
      material: adesivo, printer, acabamentos: [{ finish: recorte }],
    });
    expect(r.finishes[0].valor).toBe(20);
  });
});

describe("valor mínimo e arredondamento", () => {
  it("aplica valor mínimo do material quando preço é menor", () => {
    const r = calcularItemCV({
      largura_cm: 10, altura_cm: 10, quantidade: 1,
      material: adesivo, printer, acabamentos: [],
    });
    expect(r.aplicou_minimo).toBe(true);
    expect(r.preco_total).toBe(50);
  });

  it("arredonda total para cima até R$ 0,10", () => {
    const r = calcularItemCV({
      largura_cm: 33, altura_cm: 33, quantidade: 1,
      material: lona, printer, acabamentos: [],
    });
    // garante múltiplo de 0,10
    expect(Math.round(r.preco_total * 10) / 10).toBe(r.preco_total);
  });
});
