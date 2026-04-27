// Pure pricing engine for the Visual Communication module.
// No side effects; safe to call on every keystroke (debounced).

export type CVMaterialCategoria = "lona" | "adesivo" | "chapa" | "outro";
export type CVTipoCalculo = "unidade" | "mt2" | "perimetro_metro" | "fixo";

export interface CVMaterial {
  id: string;
  nome: string;
  categoria: CVMaterialCategoria;
  largura_util_cm: number;
  custo_mt2: number;
  margem_mt2_pct: number;
  valor_minimo: number;
}

export interface CVPrinter {
  id: string;
  nome: string;
  largura_max_cm: number;
  custo_mt2_print: number;
  margem_mt2_print_pct: number;
  custo_fixo_setup: number;
  lucro_fixo_setup: number;
  categorias_compativeis: string[];
}

export interface CVFinish {
  id: string;
  nome: string;
  categoria_compativel: string[];
  tipo_calculo: CVTipoCalculo;
  custo: number;
  margem_pct: number;
}

export interface CVAppliedFinish {
  finish: CVFinish;
  /** Optional: for `unidade` finishes (e.g. ilhós ×4), how many units. Default: 1. */
  quantidade_unidades?: number;
}

export interface CVCalcInput {
  largura_cm: number;
  altura_cm: number;
  quantidade: number;
  material: CVMaterial | null;
  printer: CVPrinter | null;
  acabamentos: CVAppliedFinish[];
}

export interface CVFinishResult {
  finish_id: string;
  nome: string;
  tipo_calculo: CVTipoCalculo;
  qtd_calculada: number;
  custo_unit: number;
  valor: number;
}

export interface CVCalcResult {
  area_total_m2: number;
  tem_emenda: boolean;
  aplicou_minimo: boolean;
  preco_midia: number;
  preco_impressao: number;
  preco_acabamentos: number;
  finishes: CVFinishResult[];
  preco_total: number;
  // Health (Admin only)
  custo_total: number;
  lucro_liquido: number;
  margem_pct: number;
}

/** Round UP to the nearest R$ 0.10 — global pricing rule. */
export const roundUpToTenCents = (n: number): number => {
  if (!isFinite(n) || n <= 0) return 0;
  return Math.ceil(n * 10) / 10;
};

const safeNum = (n: unknown, fallback = 0): number => {
  const v = typeof n === "number" ? n : Number(n);
  return isFinite(v) ? v : fallback;
};

export const calcularItemCV = (input: CVCalcInput): CVCalcResult => {
  const largura = Math.max(0, safeNum(input.largura_cm));
  const altura = Math.max(0, safeNum(input.altura_cm));
  const qtd = Math.max(1, Math.floor(safeNum(input.quantidade, 1)));

  const area_unit_m2 = (largura * altura) / 10000;
  const area_total_m2 = area_unit_m2 * qtd;

  const tem_emenda = !!input.printer && largura > input.printer.largura_max_cm;

  // ── Mídia ────────────────────────────────────────────
  let custo_midia = 0;
  let preco_midia = 0;
  if (input.material) {
    custo_midia = area_total_m2 * input.material.custo_mt2;
    preco_midia = custo_midia * (1 + input.material.margem_mt2_pct / 100);
  }

  // ── Impressão ────────────────────────────────────────
  let custo_impressao = 0;
  let preco_impressao = 0;
  if (input.printer) {
    const variavel = area_total_m2 * input.printer.custo_mt2_print;
    custo_impressao = variavel + input.printer.custo_fixo_setup;
    preco_impressao =
      variavel * (1 + input.printer.margem_mt2_print_pct / 100) +
      input.printer.custo_fixo_setup +
      input.printer.lucro_fixo_setup;
  }

  // ── Acabamentos ──────────────────────────────────────
  const perimetro_m_unit = ((largura * 2 + altura * 2) / 100);
  const finishes: CVFinishResult[] = [];
  let custo_acabamentos = 0;
  let preco_acabamentos = 0;

  for (const ap of input.acabamentos) {
    const f = ap.finish;
    let qtd_calc = 0;
    switch (f.tipo_calculo) {
      case "unidade":
        qtd_calc = Math.max(1, safeNum(ap.quantidade_unidades, 1)) * qtd;
        break;
      case "mt2":
        qtd_calc = area_total_m2;
        break;
      case "perimetro_metro":
        qtd_calc = perimetro_m_unit * qtd;
        break;
      case "fixo":
        qtd_calc = 1;
        break;
    }
    const custo_item = qtd_calc * f.custo;
    const valor_item = custo_item * (1 + f.margem_pct / 100);
    custo_acabamentos += custo_item;
    preco_acabamentos += valor_item;
    finishes.push({
      finish_id: f.id,
      nome: f.nome,
      tipo_calculo: f.tipo_calculo,
      qtd_calculada: qtd_calc,
      custo_unit: f.custo,
      valor: valor_item,
    });
  }

  // ── Totais ───────────────────────────────────────────
  let preco_total = preco_midia + preco_impressao + preco_acabamentos;
  let aplicou_minimo = false;
  const min = input.material?.valor_minimo ?? 0;
  if (min > 0 && preco_total < min) {
    preco_total = min;
    aplicou_minimo = true;
  }
  preco_total = roundUpToTenCents(preco_total);

  const custo_total = custo_midia + custo_impressao + custo_acabamentos;
  const lucro_liquido = preco_total - custo_total;
  const margem_pct = preco_total > 0 ? (lucro_liquido / preco_total) * 100 : 0;

  return {
    area_total_m2,
    tem_emenda,
    aplicou_minimo,
    preco_midia: roundUpToTenCents(preco_midia),
    preco_impressao: roundUpToTenCents(preco_impressao),
    preco_acabamentos: roundUpToTenCents(preco_acabamentos),
    finishes,
    preco_total,
    custo_total,
    lucro_liquido,
    margem_pct,
  };
};

/** Helper: format BRL. */
export const formatBRL = (n: number): string =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
