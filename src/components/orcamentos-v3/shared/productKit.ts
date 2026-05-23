// Motor genérico de Kits de Produto (cadastráveis em product_kits/product_kit_items).
// Resolve fórmulas de quantidade e produz V3SupplyItem/V3LaborItem prontos para o carrinho.
import { getIdealSpiral, spiralRegex } from "@/lib/quotes/spiral-selector";
import type { ProcessStep } from "@/components/orcamentos-v3/shared/ProcessPicker";
import { genId, type V3SupplyItem, type V3LaborItem } from "../types";
import { pickSupplyTierPrice, type V3Supply } from "./useV3Supplies";

export type KitItemRole = "required" | "optional" | "alternative";
export type KitQuantityFormula =
  | "per_unit"
  | "per_sheet"
  | "per_x_sheets"
  | "per_perimeter_m"
  | "per_m2"
  | "fixed"
  | "auto_spiral"
  | "variant_by_sheets";

export interface ProductKitItemVariantDB {
  id: string;
  item_id: string;
  min_value: number;
  max_value: number | null;
  supply_id: string | null;
  label: string | null;
  position: number;
}

export interface ProductKitItemDB {
  id: string;
  kit_id: string;
  position: number;
  item_type: "supply" | "process";
  supply_id: string | null;
  process_step_id: string | null;
  role: KitItemRole;
  alternative_group: string | null;
  quantity_formula: KitQuantityFormula;
  quantity_value: number;
  auto_select_default: boolean;
  notes: string | null;
  variants?: ProductKitItemVariantDB[];
}

export interface ProductKitDB {
  id: string;
  name: string;
  product_kind: string;
  description: string | null;
  is_active: boolean;
  items: ProductKitItemDB[];
}

export interface ProductKitRow {
  itemId: string;
  role: KitItemRole;
  alternativeGroup: string | null;
  autoSelectDefault: boolean;
  label: string;
  description: string;
  qty: number;
  unit: "un" | "min";
  unitPrice?: number;
  cost: number;
  fallback: boolean;
  build: () => V3SupplyItem | V3LaborItem;
}

interface BuildArgs {
  kit: ProductKitDB;
  units: number;
  sheets?: number;
  perimeterM?: number;
  areaM2?: number;
  supplies: V3Supply[];
  steps: ProcessStep[];
  hourlyRate: number;
  defaultMarginPct: number;
}

function resolveQty(
  formula: KitQuantityFormula,
  value: number,
  ctx: { units: number; sheets: number; perimeterM: number; areaM2: number },
): number {
  const v = Number(value) || 0;
  switch (formula) {
    case "per_unit":
      return ctx.units * v;
    case "per_sheet":
      return ctx.units * ctx.sheets * v;
    case "per_x_sheets":
      return v > 0 ? ctx.units * Math.ceil(ctx.sheets / v) : 0;
    case "per_perimeter_m":
      return ctx.units * ctx.perimeterM * v;
    case "per_m2":
      return ctx.units * ctx.areaM2 * v;
    case "fixed":
      return v;
    case "auto_spiral":
      return ctx.units; // 1 espiral por apostila
    case "variant_by_sheets":
      return ctx.units * (v > 0 ? v : 1);
    default:
      return ctx.units;
  }
}

function pickVariant(
  variants: ProductKitItemVariantDB[] | undefined,
  value: number,
): ProductKitItemVariantDB | null {
  if (!variants || variants.length === 0) return null;
  const sorted = [...variants].sort((a, b) => a.min_value - b.min_value);
  for (const v of sorted) {
    const min = Number(v.min_value) || 0;
    const max = v.max_value == null ? Infinity : Number(v.max_value);
    if (value >= min && value <= max) return v;
  }
  return sorted[sorted.length - 1] ?? null;
}

export function buildProductKitRows(args: BuildArgs): ProductKitRow[] {
  const units = Math.max(1, Math.floor(args.units || 0));
  const sheets = Math.max(0, Math.floor(args.sheets ?? 0));
  const perimeterM = Math.max(0, args.perimeterM ?? 0);
  const areaM2 = Math.max(0, args.areaM2 ?? 0);
  const ctx = { units, sheets, perimeterM, areaM2 };

  const spiralDiameter =
    args.kit.items.some((i) => i.quantity_formula === "auto_spiral") && sheets > 0
      ? getIdealSpiral(sheets)
      : null;

  const rows: ProductKitRow[] = [];
  for (const it of [...args.kit.items].sort((a, b) => a.position - b.position)) {
    const qty = resolveQty(it.quantity_formula, it.quantity_value, ctx);

    if (it.item_type === "supply") {
      // auto_spiral: tenta achar espiral do diâmetro ideal; senão usa o supply cadastrado
      let sup: V3Supply | undefined;
      let displayName = "";
      let variantLabel = "";
      if (it.quantity_formula === "auto_spiral" && spiralDiameter) {
        const rx = spiralRegex(spiralDiameter);
        sup = args.supplies.find((s) => rx.test(s.produto));
        displayName = sup?.produto ?? `Espiral ${spiralDiameter}`;
        variantLabel = spiralDiameter;
      } else if (it.quantity_formula === "variant_by_sheets") {
        const v = pickVariant(it.variants, sheets);
        if (v?.supply_id) {
          sup = args.supplies.find((s) => s.id === v.supply_id);
        }
        variantLabel =
          v?.label ||
          (v
            ? `${v.min_value}-${v.max_value ?? "∞"} folhas`
            : "");
        displayName = sup?.produto ?? (variantLabel ? `Variante ${variantLabel}` : "Suprimento");
      }
      if (!sup && it.supply_id) {
        sup = args.supplies.find((s) => s.id === it.supply_id);
        displayName = sup?.produto ?? "Suprimento";
      }
      if (!sup) {
        rows.push({
          itemId: it.id,
          role: it.role,
          alternativeGroup: it.alternative_group,
          autoSelectDefault: it.auto_select_default,
          label: displayName || "Suprimento",
          description: `${displayName || "Suprimento"} — preencher`,
          qty,
          unit: "un",
          unitPrice: 0,
          cost: 0,
          fallback: true,
          build: () =>
            ({
              id: genId(),
              kind: "supply",
              descricao: `${displayName || "Suprimento"} — preencher`,
              supply_id: null,
              supply_nome: displayName || "Suprimento",
              fornecedor: null,
              custo_unitario: 0,
              margem_pct: args.defaultMarginPct,
              quantidade: qty,
            }) satisfies V3SupplyItem,
        });
        continue;
      }
      const unitPrice = pickSupplyTierPrice(sup, qty);
      const supRef = sup;
      rows.push({
        itemId: it.id,
        role: it.role,
        alternativeGroup: it.alternative_group,
        autoSelectDefault: it.auto_select_default,
        label: supRef.produto,
        description: variantLabel ? `${supRef.produto} · ${variantLabel}` : supRef.produto,
        qty,
        unit: "un",
        unitPrice,
        cost: unitPrice * qty,
        fallback: false,
        build: () =>
          ({
            id: genId(),
            kind: "supply",
            descricao: supRef.produto,
            supply_id: supRef.id,
            supply_nome: supRef.produto,
            fornecedor: supRef.fornecedor,
            custo_unitario: unitPrice,
            margem_pct: supRef.margem_pct ?? args.defaultMarginPct,
            quantidade: qty,
          }) satisfies V3SupplyItem,
      });
    } else {
      // process
      const step = args.steps.find((s) => s.id === it.process_step_id);
      if (!step) {
        rows.push({
          itemId: it.id,
          role: it.role,
          alternativeGroup: it.alternative_group,
          autoSelectDefault: it.auto_select_default,
          label: "Processo",
          description: "Processo — preencher",
          qty: 0,
          unit: "min",
          cost: 0,
          fallback: true,
          build: () =>
            ({
              id: genId(),
              kind: "labor",
              descricao: "Processo — preencher",
              time_minutes: 0,
              step_type: "outro",
              hourly_rate: args.hourlyRate,
              margem_pct: args.defaultMarginPct,
            }) satisfies V3LaborItem,
        });
        continue;
      }
      const totalMin = (step.time_minutes || 0) * qty;
      rows.push({
        itemId: it.id,
        role: it.role,
        alternativeGroup: it.alternative_group,
        autoSelectDefault: it.auto_select_default,
        label: step.description,
        description: `${step.description} (×${qty})`,
        qty: totalMin,
        unit: "min",
        cost: (totalMin / 60) * args.hourlyRate,
        fallback: false,
        build: () =>
          ({
            id: genId(),
            kind: "labor",
            descricao: `${step.description} (×${qty})`,
            time_minutes: totalMin,
            step_type: (step.step_type as any) || "outro",
            hourly_rate: args.hourlyRate,
            margem_pct: args.defaultMarginPct,
          }) satisfies V3LaborItem,
      });
    }
  }
  return rows;
}

/** Carrega kits ativos (com itens) para um product_kind, ordenado por nome. */
export async function fetchActiveKitsForProduct(
  supabaseClient: any,
  productKind: string,
): Promise<ProductKitDB[]> {
  const { data: kits, error } = await supabaseClient
    .from("product_kits")
    .select("id, name, product_kind, description, is_active")
    .eq("product_kind", productKind)
    .eq("is_active", true)
    .order("name");
  if (error || !kits || kits.length === 0) return [];
  const ids = kits.map((k: any) => k.id);
  const { data: items } = await supabaseClient
    .from("product_kit_items")
    .select("*")
    .in("kit_id", ids)
    .order("position");
  const itemList = (items || []) as ProductKitItemDB[];
  const itemIds = itemList.map((i) => i.id);
  let variantsByItem = new Map<string, ProductKitItemVariantDB[]>();
  if (itemIds.length > 0) {
    const { data: vars } = await supabaseClient
      .from("product_kit_item_variants")
      .select("*")
      .in("item_id", itemIds)
      .order("position");
    for (const v of (vars || []) as ProductKitItemVariantDB[]) {
      const arr = variantsByItem.get(v.item_id) || [];
      arr.push(v);
      variantsByItem.set(v.item_id, arr);
    }
  }
  const byKit = new Map<string, ProductKitItemDB[]>();
  for (const it of itemList) {
    it.variants = variantsByItem.get(it.id) || [];
    const arr = byKit.get(it.kit_id) || [];
    arr.push(it);
    byKit.set(it.kit_id, arr);
  }
  return kits.map((k: any) => ({
    ...k,
    items: byKit.get(k.id) || [],
  }));
}

/** Preset de espirais padrão (apostilas) — usar como atalho ao cadastrar variant_by_sheets. */
export const SPIRAL_VARIANT_PRESET: Array<{ min: number; max: number | null; label: string }> = [
  { min: 1, max: 25, label: "7mm" },
  { min: 26, max: 50, label: "9mm" },
  { min: 51, max: 70, label: "12mm" },
  { min: 71, max: 85, label: "14mm" },
  { min: 86, max: 100, label: "17mm" },
  { min: 101, max: 120, label: "20mm" },
  { min: 121, max: 140, label: "23mm" },
  { min: 141, max: 160, label: "25mm" },
  { min: 161, max: 200, label: "29mm" },
  { min: 201, max: 250, label: "33mm" },
  { min: 251, max: 350, label: "40mm" },
  { min: 351, max: null, label: "45mm" },
];
