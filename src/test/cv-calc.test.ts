import { describe, it, expect } from "vitest";
import {
  calcular,
  selecionarBastao,
  areaRoloPorPeca,
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

describe("Sangria por tipo de mídia (planilha AK15)", () => {
  const adesivoBrilho: Midia = {
    id: "ad1", nome: "Adesivo Brilho", tipo_midia: "adesivo",
    custo_mt2: 11, lucro_mt2: 12, custo_fixo: 0, lucro_fixo: 6,
  };
  const recorteCartelas: Acabamento = {
    id: "rc", nome: "Recorte Eletrônico + Entregue em Cartelas", familia: "recorte",
    tipos_midia_compativeis: ["adesivo"],
    custo_fixo: 14, lucro_fixo: 0,
    custo_mt2: 50, lucro_mt2: 50,
    custo_perimetro: 0, lucro_perimetro: 0,
    custo_unidade: 0, lucro_unidade: 0,
    largura_max_cm: null,
  };

  it("6×6 cm × 100 un, Adesivo (sangria 3 mm) → área 0,3969 m²", () => {
    const r = calcular({
      largura_cm: 6, altura_cm: 6, quantidade: 100,
      midia: adesivoBrilho, impressao: solventeAlta, acabamento: recorteCartelas,
      acabamentos_pool: [], valor_minimo: 35,
      sangrias_mm: { adesivo: 3 },
    });
    expect(r.area_m2).toBeCloseTo(0.3969, 4);
    expect(r.sangria_aplicada_mm).toBe(3);
  });

  it("sangria 0 mantém a área crua (6×6×100 = 0,36 m²)", () => {
    const r = calcular({
      largura_cm: 6, altura_cm: 6, quantidade: 100,
      midia: adesivoBrilho, impressao: null, acabamento: null,
      acabamentos_pool: [], valor_minimo: 35,
      sangrias_mm: { adesivo: 0 },
    });
    expect(r.area_m2).toBeCloseTo(0.36, 4);
  });
});

describe("mídia cobrada pela largura do rolo", () => {
  const lonaTerceirizado: Midia = {
    id: "mt", nome: "Lona Sem Impressão (Terceirizado)", tipo_midia: "lona",
    custo_mt2: 10, lucro_mt2: 10, custo_fixo: 0, lucro_fixo: 0, largura_rolo_cm: 190,
  };
  const base = { midia: lonaTerceirizado, impressao: null, valor_minimo: 35 };

  it("areaRoloPorPeca escolhe o sentido que gasta menos rolo", () => {
    expect(areaRoloPorPeca(300, 180, 190)).toBeCloseTo(5.7, 6);
    expect(areaRoloPorPeca(180, 300, 190)).toBeCloseTo(5.7, 6);
    // 3 × 1 m: peça inteira (1,90 × 3,00), nunca duas faixas emendadas
    expect(areaRoloPorPeca(300, 100, 190)).toBeCloseTo(5.7, 6);
    // os dois lados cabem: atravessa o maior (1,90 × 1,00)
    expect(areaRoloPorPeca(100, 150, 190)).toBeCloseTo(1.9, 6);
    // não cabe em nenhum sentido: 2 faixas de 190 × 250
    expect(areaRoloPorPeca(300, 250, 190)).toBeCloseTo(9.5, 6);
  });

  it("2 lonas 3 × 1,8 m = 11,4 m² × R$ 20 = R$ 228", () => {
    const r = calcular({ ...base, largura_cm: 300, altura_cm: 180, quantidade: 2 });
    expect(r.area_m2).toBeCloseTo(10.8, 6);
    expect(r.area_midia_m2).toBeCloseTo(11.4, 6);
    expect(r.valor_total).toBe(228);
    expect(r.custo_total).toBeCloseTo(114, 6);
  });

  it("sem largura de rolo continua cobrando só a área da peça", () => {
    const r = calcular({ ...base, midia: { ...lonaTerceirizado, largura_rolo_cm: null },
      largura_cm: 300, altura_cm: 180, quantidade: 2 });
    expect(r.area_midia_m2).toBeCloseTo(10.8, 6);
    expect(r.valor_total).toBe(216);
  });
});

describe("mídia com impressão já no preço (terceirizado)", () => {
  const lonaImpressaTerc: Midia = {
    id: "mti", nome: "Lona Impressa (Terceirizado)", tipo_midia: "lona",
    custo_mt2: 22.3, lucro_mt2: 22.7, custo_fixo: 0, lucro_fixo: 0, sem_impressao_separada: true,
  };
  it("ignora a impressão escolhida: 1 × 1 m = R$ 45", () => {
    const r = calcular({ largura_cm: 100, altura_cm: 100, quantidade: 1,
      midia: lonaImpressaTerc, impressao: solventeAlta, valor_minimo: 35 });
    expect(r.preco_impressao).toBe(0);
    expect(r.valor_total).toBe(45);
  });
});

describe("acabamentos de terceirizado (custo ÷ 0,62)", () => {
  const lona: Midia = { id: "l", nome: "Lona Impressa (Terceirizado)", tipo_midia: "lona",
    custo_mt2: 22.3, lucro_mt2: 22.7, custo_fixo: 0, lucro_fixo: 0, sem_impressao_separada: true };
  const base: Omit<Acabamento, "id" | "nome" | "familia"> = {
    tipos_midia_compativeis: ["lona"], custo_fixo: 0, lucro_fixo: 0, custo_mt2: 0, lucro_mt2: 0,
    custo_perimetro: 0, lucro_perimetro: 0, custo_unidade: 0, lucro_unidade: 0, largura_max_cm: null,
    pricing_mode: "recipe", markup_override_pct: 38,
  };
  const banner105: Acabamento = { ...base, id: "b", nome: "Banner até 1,05 m (Terceirizado)", familia: "outro",
    extra_cost_unidade: 6.3, labor: [
      { descricao: "Refile", time_minutes: 1.6, consumo_tipo: "por_mt2", consumo_qty: 1 },
      { descricao: "Solda", time_minutes: 2.1, consumo_tipo: "por_peca", consumo_qty: 1 },
      { descricao: "Bastão", time_minutes: 2.8, consumo_tipo: "por_peca", consumo_qty: 1 },
    ] };
  const bainha: Acabamento = { ...base, id: "bi", nome: "Bainha e Ilhós (Terceirizado)", familia: "bainha_ilhos",
    extra_cost_perimetro: 0.93, labor: [
      { descricao: "Refile", time_minutes: 1.6, consumo_tipo: "por_mt2", consumo_qty: 1 },
      { descricao: "Bainha + ilhós", time_minutes: 5.4, consumo_tipo: "por_perimetro_m", consumo_qty: 1 },
    ] };
  const hourRate = 48.6; // R$ 0,81/min
  const acab = (ac: Acabamento, l: number, a: number) =>
    calcular({ largura_cm: l, altura_cm: a, quantidade: 1, midia: lona, impressao: null,
      acabamentos: [{ acabamento: ac }], valor_minimo: 0, hourRate }).preco_acabamento;

  it("banner 90×120: (6,30 + 6,63 min × 0,81) ÷ 0,62 ≈ R$ 18,90", () => {
    expect(acab(banner105, 90, 120)).toBeCloseTo(18.9, 1);
  });
  it("lona 300×180 com bainha e ilhós ≈ R$ 93", () => {
    expect(acab(bainha, 300, 180)).toBeGreaterThan(90);
    expect(acab(bainha, 300, 180)).toBeLessThan(96);
  });
});
