// Cálculos da Tabela de Preços: custo por unidade, lucro real de cada faixa e preço mínimo.
// Lucro real = venda − taxas sobre a venda (imposto + cartão + perda) − custo das unidades − preparação do pedido.
import { equipmentCost, type ConsumableCostInput } from "@/lib/equipmentCost";

/** Tempo médio de preparação de um pedido (atender, abrir o arquivo, conferir) — decidido em 28/10/2026. */
export const PREP_MINUTES = 2.5;

export type CalcType = "impressao" | "manual";
export type ColorMode = "color" | "pb";
export type SheetSize = "A4" | "A3";

export interface PriceTier {
  id?: string;
  min_qty: number;
  max_qty: number | null;
  price: number;
  tiny_sku: string | null;
}

export interface PriceTableItem {
  calc_type: CalcType;
  equipment_id: string | null;
  color_mode: ColorMode | null;
  sheet_size: SheetSize;
  sides: number;
  paper_id: string | null;
  material_cost: number;
  extra_cost: number;
  minutes_per_unit: number;
}

export interface PaperCostInput {
  id: string;
  sheet_qty: number;
  pack_price: number;
  freight_price: number; // por folha
  is_cut_size: boolean;
  purchase_sheet_width_mm: number | null;
  purchase_sheet_height_mm: number | null;
}

export interface EquipmentInput {
  id: string;
  printer_type: string | null;
  consumables: (ConsumableCostInput & { mode: string })[];
}

export interface PriceSettings {
  /** Imposto + cartão + perda, em fração da venda (ex.: 0,22). */
  feesPct: number;
  /** Meta de lucro, em fração da venda (ex.: 0,33). */
  targetPct: number;
  minuteRate: number;
}

const A4_AREA = 210 * 297;

/** Custo de uma folha A4 ou A3 do papel cadastrado (folha de compra 66×96 rende 9 A4 ou 4 A3+). */
export const paperSheetCost = (p: PaperCostInput, size: SheetSize): number => {
  if (!p.sheet_qty || p.sheet_qty <= 0) return 0;
  const perSheet = p.pack_price / p.sheet_qty + (p.freight_price || 0);
  if (!p.is_cut_size) return size === "A3" ? perSheet / 4 : perSheet / 9;
  const area = (p.purchase_sheet_width_mm || 210) * (p.purchase_sheet_height_mm || 297);
  const a4PerSheet = Math.max(1, Math.round(area / A4_AREA));
  const a4 = perSheet / a4PerSheet;
  return size === "A3" ? a4 * 2 : a4;
};

/** Custo da máquina por página A4 de um lado (colorida 20% de cobertura, P&B 5%). */
export const machinePageCost = (eq: EquipmentInput, mode: ColorMode | null): number => {
  if (eq.printer_type === "ribbon") return equipmentCost(eq.consumables.map((c) => ({ ...c, scales_with_coverage: false })), 5);
  if (mode === "pb") return equipmentCost(eq.consumables.filter((c) => c.mode === "shared"), 5);
  return equipmentCost(eq.consumables, 20);
};

export interface UnitCost {
  paper: number;
  machine: number;
  extra: number;
  labor: number;
  total: number;
  /** Sem nenhum custo informado: lucro não pode ser calculado. */
  missing: boolean;
}

export const unitCost = (
  item: PriceTableItem,
  ctx: { papers: PaperCostInput[]; equipments: EquipmentInput[]; minuteRate: number },
): UnitCost => {
  let paper = item.material_cost || 0;
  let machine = 0;
  if (item.calc_type === "impressao") {
    const p = item.paper_id ? ctx.papers.find((x) => x.id === item.paper_id) : undefined;
    if (p) paper = paperSheetCost(p, item.sheet_size);
    const eq = item.equipment_id ? ctx.equipments.find((x) => x.id === item.equipment_id) : undefined;
    if (eq) {
      const clicks = (item.sheet_size === "A3" ? 2 : 1) * (item.sides === 2 ? 2 : 1);
      machine = machinePageCost(eq, item.color_mode) * clicks;
    }
  }
  const extra = item.extra_cost || 0;
  const labor = (item.minutes_per_unit || 0) * ctx.minuteRate;
  const total = paper + machine + extra + labor;
  return { paper, machine, extra, labor, total, missing: total <= 0 };
};

export const prepCost = (minuteRate: number) => PREP_MINUTES * minuteRate;

/** Lucro real (fração da venda) de um pedido de `qty` unidades ao preço unitário `price`. */
export const realProfitPct = (price: number, qty: number, cost: number, s: PriceSettings): number | null => {
  const revenue = price * qty;
  if (revenue <= 0) return null;
  return (revenue * (1 - s.feesPct) - cost * qty - prepCost(s.minuteRate)) / revenue;
};

/** Menor preço unitário que atinge a meta de lucro num pedido de `qty` unidades. */
export const minUnitPrice = (qty: number, cost: number, s: PriceSettings): number | null => {
  const divisor = 1 - s.feesPct - s.targetPct;
  if (divisor <= 0 || qty <= 0) return null;
  return (cost * qty + prepCost(s.minuteRate)) / divisor / qty;
};

export const tierLabel = (t: Pick<PriceTier, "min_qty" | "max_qty">): string => {
  if (t.max_qty === null) return `Acima de ${t.min_qty - 1}`;
  if (t.min_qty === t.max_qty) return `${t.min_qty}`;
  return `${t.min_qty} a ${t.max_qty}`;
};

/** Total de um pedido pela faixa em que a quantidade cai. */
export const orderTotal = (tiers: PriceTier[], qty: number): number => {
  const t = tiers.find((x) => qty >= x.min_qty && (x.max_qty === null || qty <= x.max_qty)) ?? tiers[tiers.length - 1];
  return t ? t.price * qty : 0;
};

export interface TierProblem {
  index: number;
  message: string;
}

/** Faixas fora de ordem, com buraco, preço que sobe e degrau (pedido maior saindo mais barato). */
export const tierProblems = (tiers: PriceTier[]): TierProblem[] => {
  const out: TierProblem[] = [];
  tiers.forEach((t, i) => {
    if (t.price <= 0) out.push({ index: i, message: "Sem preço" });
    if (i === 0) return;
    const prev = tiers[i - 1];
    if (prev.max_qty === null) out.push({ index: i, message: "Faixa anterior não tem limite" });
    else if (t.min_qty !== prev.max_qty + 1) out.push({ index: i, message: `Deveria começar em ${prev.max_qty + 1}` });
    if (t.price > prev.price) out.push({ index: i, message: "Preço maior que o da faixa anterior" });
    else if (prev.max_qty !== null && t.price * t.min_qty < prev.price * prev.max_qty) {
      out.push({
        index: i,
        message: `Degrau: ${t.min_qty} un saem por ${fmtMoney(t.price * t.min_qty)}, menos que ${prev.max_qty} un (${fmtMoney(prev.price * prev.max_qty)})`,
      });
    }
  });
  return out;
};

/** Converte "1-20, 21-100, 101+" em faixas sem preço (usado nos padrões da categoria). */
export const parseTierRanges = (text: string): Pick<PriceTier, "min_qty" | "max_qty">[] =>
  text
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const plus = p.match(/^(\d+)\s*\+$/);
      if (plus) return { min_qty: Number(plus[1]), max_qty: null };
      const range = p.match(/^(\d+)\s*(?:-|a)\s*(\d+)$/);
      if (range) return { min_qty: Number(range[1]), max_qty: Number(range[2]) };
      const one = p.match(/^(\d+)$/);
      if (one) return { min_qty: Number(one[1]), max_qty: Number(one[1]) };
      return null;
    })
    .filter((x): x is Pick<PriceTier, "min_qty" | "max_qty"> => x !== null);

export const formatTierRanges = (tiers: Pick<PriceTier, "min_qty" | "max_qty">[]): string =>
  tiers.map((t) => (t.max_qty === null ? `${t.min_qty}+` : t.min_qty === t.max_qty ? `${t.min_qty}` : `${t.min_qty}-${t.max_qty}`)).join(", ");

export const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ─── Filtros e busca ─────────────────────────────────────────────────

/** Minúsculas e sem acento, para comparar "couchê" com "couche". */
export const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Todas as palavras da busca aparecem no texto, em qualquer ordem ("couche 300 a3"). */
export const matchesSearch = (text: string, query: string) => {
  const t = normalize(text);
  return normalize(query).split(/\s+/).filter(Boolean).every((w) => t.includes(w));
};

// Ordem importa: o primeiro que aparecer no nome vence ("Vinil Adesivo" é vinil, não adesivo).
const PAPER_KEYS: [string, string][] = [
  ["envelope", "Envelope"], ["colorplus", "Colorplus"], ["vinil", "Vinil"], ["transfer", "Transfer"],
  ["pvc", "PVC"], ["autocopiativo", "Autocopiativo"], ["couche", "Couchê"], ["sulfite", "Sulfite"],
  ["reciclato", "Reciclato"], ["cartolina", "Cartolina"], ["kraft", "Kraft"], ["superbond", "Superbond"],
  ["verge", "Vergê"], ["supremo", "Supremo"], ["adesivo", "Adesivo"],
];

export interface ItemAttributes {
  paper: string | null;
  grammage: string | null;
  size: string | null;
  color: "Colorida" | "P&B" | null;
  sides: "Só frente" | "Frente e verso" | null;
}

/** Características do item tiradas do nome (que vem do Tiny) e dos campos de impressão. */
export const itemAttributes = (item: Pick<PriceTableItem, "calc_type" | "color_mode" | "sheet_size" | "sides"> & { name: string }): ItemAttributes => {
  const n = normalize(item.name);
  const paper = PAPER_KEYS.find(([k]) => n.includes(k))?.[1] ?? null;
  const g = n.match(/(\d{2,3})\s*g(?:r|rs|ramas)?\b/);
  const isPrint = item.calc_type === "impressao";
  const size = isPrint ? item.sheet_size : n.match(/\ba[345]\b/)?.[0].toUpperCase() ?? null;
  const color = isPrint ? (item.color_mode === "pb" ? "P&B" : "Colorida") : null;
  const sides = isPrint ? (item.sides === 2 ? "Frente e verso" : "Só frente") : null;
  return { paper, grammage: g ? `${g[1]}g` : null, size, color, sides };
};

/** Encadeia as faixas: cada uma começa logo depois do "até" da anterior (sem buraco nem sobreposição). */
export const chainTiers = <T extends Pick<PriceTier, "min_qty" | "max_qty">>(tiers: T[]): T[] =>
  tiers.reduce<T[]>((out, t, i) => {
    const prev = out[i - 1];
    const min = prev ? (prev.max_qty !== null && prev.max_qty !== undefined ? prev.max_qty + 1 : prev.min_qty + 1) : t.min_qty;
    out.push({ ...t, min_qty: min }); // "até" menor que o "de" fica como está (a pessoa pode estar digitando)
    return out;
  }, []);
