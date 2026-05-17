// Engine de cálculo de Kits (Grupos de Materiais com is_kit=true).
// Espelha planilha Excel: combina insumos + mão de obra + modo de cobrança por dimensão.

export type KitPricingMode = "fixo" | "mt2" | "perimetro" | "unidade";
export type KitConsumoTipo = "fixo" | "por_m2" | "por_perimetro_m" | "por_unidade";

export interface KitItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  consumo_tipo: KitConsumoTipo;
}

export interface KitDef {
  id?: string;
  name?: string;
  pricing_mode: KitPricingMode;
  labor_minutes: number;
  margin_pct: number | null;
  items: KitItem[];
}

export interface KitDimensions {
  largura_cm: number;
  altura_cm: number;
  quantidade: number;
}

export interface KitGlobals {
  hourRate: number;
  tax_pct: number;
  invoice_pct: number;
  collection_pct: number;
  collection_fee_pct: number;
  credit_card_pct: number;
  waste_pct: number;
  default_margin_pct: number;
}

export interface KitBreakdownRow {
  description: string;
  consumo_tipo: KitConsumoTipo;
  qty_effective: number;
  unit_price: number;
  subtotal: number;
}

export interface KitPriceResult {
  custoMaterial: number;
  custoMO: number;
  custoTotal: number;
  precoVenda: number;
  lucroLiquido: number;
  lucroPct: number;
  breakdown: KitBreakdownRow[];
  // Detalhes financeiros (para Resumo Financeiro)
  impostos: number;
  taxas: number;
  margem: number;
  perda: number;
}

export const roundUpToTenCents = (n: number): number => Math.ceil(n * 10 - 1e-9) / 10;

const computeScale = (tipo: KitConsumoTipo, dims: KitDimensions): number => {
  const w = Math.max(0, dims.largura_cm) / 100;
  const h = Math.max(0, dims.altura_cm) / 100;
  switch (tipo) {
    case "fixo":
      return 1;
    case "por_m2":
      return w * h;
    case "por_perimetro_m":
      return 2 * (w + h);
    case "por_unidade":
      return 1; // já é "por peça"; quantidade multiplica fora
    default:
      return 1;
  }
};

export function calcKitPrice(
  kit: KitDef,
  dims: KitDimensions,
  globals: KitGlobals,
): KitPriceResult {
  const qty = Math.max(1, dims.quantidade || 1);

  // 1) Custo material por peça
  let custoMaterialPorPeca = 0;
  const breakdown: KitBreakdownRow[] = [];
  for (const it of kit.items) {
    const scale = computeScale(it.consumo_tipo, dims);
    const qtyEff = (Number(it.quantity) || 0) * scale;
    const subtotal = qtyEff * (Number(it.unit_price) || 0);
    custoMaterialPorPeca += subtotal;
    breakdown.push({
      description: it.description,
      consumo_tipo: it.consumo_tipo,
      qty_effective: qtyEff,
      unit_price: Number(it.unit_price) || 0,
      subtotal,
    });
  }

  // 2) Multiplicador por modo de cobrança do kit
  // (Para a maioria dos casos os itens já carregam a escala individual;
  // o pricing_mode serve quando o kit é cobrado de forma uniforme sem itens detalhados.)
  let scaleKit = 1;
  if (kit.items.length === 0) {
    scaleKit = computeScale(
      kit.pricing_mode === "mt2"
        ? "por_m2"
        : kit.pricing_mode === "perimetro"
          ? "por_perimetro_m"
          : "fixo",
      dims,
    );
  }
  const custoMaterial = custoMaterialPorPeca * scaleKit * qty;

  // 3) Mão de obra
  const custoMO = ((Number(kit.labor_minutes) || 0) / 60) * globals.hourRate * qty;

  // 4) Perda sobre custo
  const perda = (custoMaterial + custoMO) * ((globals.waste_pct || 0) / 100);
  const custoTotal = custoMaterial + custoMO + perda;

  // 5) Preço de venda — fórmula divisor
  const margin = kit.margin_pct ?? globals.default_margin_pct ?? 0;
  const totalPct =
    (globals.tax_pct || 0) +
    (globals.invoice_pct || 0) +
    (globals.collection_pct || 0) +
    (globals.collection_fee_pct || 0) +
    (globals.credit_card_pct || 0) +
    (margin || 0);

  const divisor = Math.max(0.0001, 1 - totalPct / 100);
  const precoBruto = custoTotal / divisor;
  const precoVenda = roundUpToTenCents(precoBruto);

  const impostos = precoVenda * ((globals.tax_pct || 0) / 100);
  const taxas =
    precoVenda *
    (((globals.invoice_pct || 0) +
      (globals.collection_pct || 0) +
      (globals.collection_fee_pct || 0) +
      (globals.credit_card_pct || 0)) /
      100);
  const margem = precoVenda * (margin / 100);
  const lucroLiquido = precoVenda - custoTotal - impostos - taxas;
  const lucroPct = precoVenda > 0 ? (lucroLiquido / precoVenda) * 100 : 0;

  return {
    custoMaterial,
    custoMO,
    custoTotal,
    precoVenda,
    lucroLiquido,
    lucroPct,
    breakdown,
    impostos,
    taxas,
    margem,
    perda,
  };
}

// Heurística: sugere escala de consumo a partir do nome do suprimento.
export function suggestConsumoTipo(name: string): KitConsumoTipo {
  const s = (name || "").toLowerCase();
  if (/(bast[aã]o|barra|perfil|tubo|sarrafo)/.test(s)) return "por_perimetro_m";
  if (/(cordinha|cord[ãa]o|fita|el[áa]stico|corda)/.test(s)) return "por_perimetro_m";
  if (/(ponteira|olhal|ilh[óo]s|rebite|gancho|parafuso|presilha)/.test(s)) return "por_unidade";
  if (/(lona|adesivo|vinil|chapa|tecido|papel)/.test(s)) return "por_m2";
  return "fixo";
}
