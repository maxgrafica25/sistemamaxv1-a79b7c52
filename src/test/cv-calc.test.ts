import { describe, it, expect } from "vitest";
import {
  calcular,
  selecionarBastao,
  type Midia,
  type Impressao,
  type Acabamento,
} from "@/lib/cv-calc/engine";

const lonaBrilho: Midia = {
  id: "m1", nome: "Lona Brilho", tipo_midia: "lona",
  custo_mt2: 9, lucro_mt2: 0, custo_fixo: 0, lucro_fixo: 8,
};

const solventeAlta: Impressao = {
  id: "i1", nome: "Impressão Solvente Alta Resolução",
  custo_mt2: 23, lucro_mt2: 40, custo_fixo: 0, lucro_fixo: 6,
  largura_max_cm: 190, comprimento_max_cm: 5000,
  tipos_midia_compativeis: ["lona", "adesivo"],
};

const bastao105: Acabamento = {
  id: "a1", nome: "Banner bastão até 105cm", familia: "banner_bastao",
  tipos_midia_compativeis: ["lona"],
  custo_fixo: 0, lucro_fixo: 0,
  custo_mt2: 4, lucro_mt2: 4,
  custo_perimetro: 0, lucro_perimetro: 0,
  custo_unidade: 17, lucro_unidade: 14,
  largura_max_cm: 105,
};
const bastao150: Acabamento = { ...bastao105, id: "a2", nome: "Banner bastão até 150cm",
  custo_unidade: 19, lucro_unidade: 16, largura_max_cm: 150 };
const bastao205: Acabamento = { ...bastao105, id: "a3", nome: "Banner bastão até 205cm",
  custo_unidade: 24, lucro_unidade: 20, largura_max_cm: 205 };

const ilhos: Acabamento = {
  id: "il", nome: "Ilhós (un)", familia: "ilhos",
  tipos_midia_compativeis: ["lona"],
  custo_fixo: 0, lucro_fixo: 0,
  custo_mt2: 0, lucro_mt2: 0,
  custo_perimetro: 0, lucro_perimetro: 0,
  custo_unidade: 1, lucro_unidade: 1,
  largura_max_cm: null,
};

const pool = [bastao105, bastao150, bastao205, ilhos];

const calc = (L: number, A: number) =>
  calcular({
    largura_cm: L, altura_cm: A, quantidade: 1,
    midia: lonaBrilho, impressao: solventeAlta, acabamento: bastao105,
    acabamentos_pool: pool, valor_minimo: 35,
  });

describe("Calculadora CV — exemplos da planilha", () => {
  it("90×120  → R$ 132", () => expect(calc(90, 120).valor_unitario).toBe(132));
  it("80×140  → R$ 135", () => expect(calc(80, 140).valor_unitario).toBe(135));
  it("100×200 → R$ 205", () => expect(calc(100, 200).valor_unitario).toBe(205));
  it("100×300 → R$ 285", () => expect(calc(100, 300).valor_unitario).toBe(285));
  it("80×400  → R$ 301", () => expect(calc(80, 400).valor_unitario).toBe(301));
  it("80×500  → R$ 365", () => expect(calc(80, 500).valor_unitario).toBe(365));
});

describe("Valor mínimo", () => {
  it("aplica R$ 35 quando subtotal é menor", () => {
    const r = calcular({
      largura_cm: 5, altura_cm: 5, quantidade: 1,
      midia: lonaBrilho, impressao: null, acabamento: null,
      acabamentos_pool: pool, valor_minimo: 35,
    });
    expect(r.aplicou_minimo).toBe(true);
    expect(r.valor_unitario).toBe(35);
  });
});

describe("Quantidade — modelo job único", () => {
  it("3 unidades de 100×300 (área total 9 m²) = R$ 827", () => {
    // mídia: 9×9 + 8 = 89 | impressão: 63×9 + 6 = 573 | bastão: 8×9 + 31×3 = 165
    // subtotal 827.00 → ceil 827 ; unitário = 827/3
    const r = calcular({
      largura_cm: 100, altura_cm: 300, quantidade: 3,
      midia: lonaBrilho, impressao: solventeAlta, acabamento: bastao105,
      acabamentos_pool: pool, valor_minimo: 35,
    });
    expect(r.valor_total).toBe(827);
  });
});

describe("Seleção automática de bastão", () => {
  it("80cm escolhe bastão 105", () => {
    const r = selecionarBastao(80, pool);
    expect(r?.acab.id).toBe("a1");
    expect(r?.info.tipo).toBe("normal");
  });
  it("130cm escolhe bastão 150", () => expect(selecionarBastao(130, pool)?.acab.id).toBe("a2"));
  it("200cm escolhe bastão 205", () => expect(selecionarBastao(200, pool)?.acab.id).toBe("a3"));
  it("500cm > maior bastão → emenda com qtd=3", () => {
    const r = selecionarBastao(500, pool);
    expect(r?.info.tipo).toBe("emenda");
    expect(r?.info.qtd).toBe(3);
  });
});

describe("Múltiplos acabamentos", () => {
  it("bastão + 4 ilhós soma corretamente", () => {
    const r = calcular({
      largura_cm: 90, altura_cm: 120, quantidade: 1,
      midia: lonaBrilho, impressao: solventeAlta,
      acabamentos: [
        { acabamento: bastao105 },
        { acabamento: ilhos, qtd_unidades: 4 },
      ],
      acabamentos_pool: pool, valor_minimo: 35,
    });
    // 132 (caso 90×120 base) + 4×(1+1) = 8 → 140
    expect(r.valor_unitario).toBe(140);
    expect(r.acabamentos_detalhe).toHaveLength(2);
  });
});

describe("Emenda de impressão", () => {
  it("flag emenda_impressao quando largura > impressora.largura_max_cm", () => {
    const r = calcular({
      largura_cm: 250, altura_cm: 100, quantidade: 1,
      midia: lonaBrilho, impressao: solventeAlta, acabamento: null,
      acabamentos_pool: pool, valor_minimo: 35,
    });
    expect(r.emenda_impressao).toBe(true);
  });
});
