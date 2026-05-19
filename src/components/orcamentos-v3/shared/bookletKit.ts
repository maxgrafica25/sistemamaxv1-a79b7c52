// Monta o Kit Encadernação (V3): Capa + Contracapa + Espiral + Furação + Encadernação.
// Espelha a lógica de SmartFinishingBlock.handleSuggestKit (V2), mas devolve
// V3SupplyItem[] e V3LaborItem[] prontos para empurrar no carrinho flat.
import {
  getIdealSpiral,
  spiralRegex,
  FRONT_COVER_REGEX,
  BACK_COVER_REGEX,
  BINDING_LABOR_PATTERNS,
} from "@/lib/quotes-v2/spiral-selector";
import type { ProcessStep } from "@/components/orcamentos-v2/ProcessPicker";
import { genId, type V3SupplyItem, type V3LaborItem } from "../types";
import {
  pickSupplyTierPrice,
  type V3Supply,
} from "./useV3Supplies";

export type KitRowKind = "capa" | "contracapa" | "espiral" | "furacao" | "encadernacao";

export interface KitRow {
  key: KitRowKind;
  label: string;       // Nome amigável (ex: "Capa frontal")
  description: string; // Nome resolvido (do catálogo) ou fallback
  qty: number;         // Qtd ou tempo total (min) se for mão-de-obra
  unit: "un" | "min";
  unitPrice?: number;  // Para suprimentos
  cost: number;        // Custo total já calculado
  fallback: boolean;   // true → não achou no cadastro
  build: () => V3SupplyItem | V3LaborItem;
}

interface BuildArgs {
  bookletPages: number;
  bookletUnits: number;
  supplies: V3Supply[];
  steps: ProcessStep[];
  hourlyRate: number;
  defaultMarginPct: number;
}

const findSupply = (list: V3Supply[], rx: RegExp): V3Supply | null =>
  list.find((s) => rx.test(s.produto)) || null;

const findStep = (list: ProcessStep[], rx: RegExp): ProcessStep | null =>
  list.find((s) => rx.test(s.description)) || null;

function makeSupplyRow(
  key: KitRowKind,
  friendly: string,
  fallbackName: string,
  rx: RegExp,
  units: number,
  args: BuildArgs,
): KitRow {
  const sup = findSupply(args.supplies, rx);
  if (!sup) {
    return {
      key,
      label: friendly,
      description: `${fallbackName} — preencher`,
      qty: units,
      unit: "un",
      unitPrice: 0,
      cost: 0,
      fallback: true,
      build: () =>
        ({
          id: genId(),
          kind: "supply",
          descricao: `${fallbackName} — preencher`,
          supply_id: null,
          supply_nome: fallbackName,
          fornecedor: null,
          custo_unitario: 0,
          margem_pct: args.defaultMarginPct,
          quantidade: units,
        }) satisfies V3SupplyItem,
    };
  }
  const unitPrice = pickSupplyTierPrice(sup, units);
  return {
    key,
    label: friendly,
    description: sup.produto,
    qty: units,
    unit: "un",
    unitPrice,
    cost: unitPrice * units,
    fallback: false,
    build: () =>
      ({
        id: genId(),
        kind: "supply",
        descricao: sup.produto,
        supply_id: sup.id,
        supply_nome: sup.produto,
        fornecedor: sup.fornecedor,
        custo_unitario: unitPrice,
        margem_pct: sup.margem_pct ?? args.defaultMarginPct,
        quantidade: units,
      }) satisfies V3SupplyItem,
  };
}

function makeLaborRow(
  key: KitRowKind,
  friendly: string,
  fallbackName: string,
  rx: RegExp,
  units: number,
  args: BuildArgs,
): KitRow {
  const step = findStep(args.steps, rx);
  if (!step) {
    return {
      key,
      label: friendly,
      description: `${fallbackName} — preencher`,
      qty: 0,
      unit: "min",
      cost: 0,
      fallback: true,
      build: () =>
        ({
          id: genId(),
          kind: "labor",
          descricao: `${fallbackName} — preencher`,
          time_minutes: 0,
          step_type: "outro",
          hourly_rate: args.hourlyRate,
          margem_pct: args.defaultMarginPct,
        }) satisfies V3LaborItem,
    };
  }
  const totalMin = (step.time_minutes || 0) * units;
  return {
    key,
    label: friendly,
    description: `${step.description} (×${units} apostilas)`,
    qty: totalMin,
    unit: "min",
    cost: (totalMin / 60) * args.hourlyRate,
    fallback: false,
    build: () =>
      ({
        id: genId(),
        kind: "labor",
        descricao: `${step.description} (×${units} apostilas)`,
        time_minutes: totalMin,
        step_type: (step.step_type as any) || "outro",
        hourly_rate: args.hourlyRate,
        margem_pct: args.defaultMarginPct,
      }) satisfies V3LaborItem,
  };
}

export function buildBookletKit(args: BuildArgs): {
  rows: KitRow[];
  spiralDiameter: string | null;
} {
  const units = Math.max(1, Math.floor(args.bookletUnits || 0));
  const sheets = Math.max(0, Math.floor(args.bookletPages || 0));
  const diameter = sheets > 0 ? getIdealSpiral(sheets) : null;

  const rows: KitRow[] = [
    makeSupplyRow("capa", "Capa frontal", "Capa PP Line A4 Incolor", FRONT_COVER_REGEX, units, args),
    makeSupplyRow("contracapa", "Contracapa", "Capa PP Camurça A4 Preta", BACK_COVER_REGEX, units, args),
  ];
  if (diameter) {
    rows.push(
      makeSupplyRow(
        "espiral",
        `Espiral ${diameter}`,
        `Espiral ${diameter}`,
        spiralRegex(diameter),
        units,
        args,
      ),
    );
  }
  // Furação + Encadernação
  rows.push(
    makeLaborRow("furacao", "Furação", "Furação", BINDING_LABOR_PATTERNS[0].rx, units, args),
    makeLaborRow(
      "encadernacao",
      "Encadernação",
      "Encadernação",
      BINDING_LABOR_PATTERNS[1].rx,
      units,
      args,
    ),
  );

  return { rows, spiralDiameter: diameter };
}
