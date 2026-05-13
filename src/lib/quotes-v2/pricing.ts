// Pure pricing engine — supports two modes per printing item:
//   1. "tier"       — classic markup tiers + global divisor (cards, flyers, etc).
//   2. "direct_sum" — printingCostUnit already includes profit; we only sum
//                     parcels and add sales costs (taxes + collection).
//
// Mode is decided per parent item via isDirectSumItem(): apostilas detected by
// productKind === "apostila" or bookletUnits > 0. Standalone (non-printing)
// materials/labor still flow through the classic global divisor.

import type { MarkupTier } from "@/components/orcamentos/PrintingItemSearch";
import type { SupplyTier } from "./supply-pricing";

export interface PricingMaterial {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  pieces?: number | null;
  baseCost?: number;
  printerCategoryId?: string;
  markupGroupId?: string | null;
  status?: "pendente" | "aprovado" | "recusado";
  approvedAt?: string | null;
  approvedValue?: number | null;
  parentItemId?: string | null;
  productKind?: string | null;
  customName?: string | null;
  reference?: string | null;
  generatedTitle?: string | null;
  paperType?: string | null;
  grammage?: string | null;
  size?: string | null;
  side?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  printColors?: string | null;
  catalogSource?: "printing" | "finishing" | null;
  catalogItemId?: string | null;
  isOptional?: boolean;
  quantityVariations?: Array<{ pieces: number; unit_price: number }>;
  bookletPages?: number | null;
  bookletUnits?: number | null;
  bookletDuplex?: boolean | null;
  paperCost?: number | null;
  printingCostUnit?: number | null;
  /** Margem (%) aplicada APENAS quando o item é filho de um pai direct_sum (apostila). */
  margemPct?: number | null;
  /** ID do suprimento de origem (para resolver tiers manuais em runtime). */
  supplyId?: string | null;
  /** Faixas manuais de preço por quantidade. Quando presente e a faixa
   *  bater na quantidade do filho, o preço manual é o **final ao cliente**
   *  (impostos e cartão já embutidos). Substitui margemPct. */
  pricingTiers?: SupplyTier[] | null;
}

export interface PricingLaborStep {
  timeMinutes: number;
  parentItemId?: string | null;
  isOptional?: boolean;
}

export interface PricingThirdParty {
  cost: number;
}

export interface PricingSettings {
  invoicePct: number;
  wastePct: number;
  collectionPct: number;
  profitMarginPct: number;
  hourlyRate: number;
}

export interface PricingSnapshot {
  laborSteps: PricingLaborStep[];
  materials: PricingMaterial[];
  thirdParty: PricingThirdParty[];
  settings: PricingSettings;
  markupTiers: MarkupTier[];
  categoryDefaultGroupId: Record<string, string | null>;
  baseQuantity: number;
  hiddenExtrasValue?: number;
  freightValue?: number;
}

export interface PricingResult {
  quantity: number;
  printingTotal: number;
  laborTotal: number;
  nonPrintingMaterialsTotal: number;
  thirdPartyTotal: number;
  costsBeforeMarkup: number;
  taxes: number;
  losses: number;
  collection: number;
  profit: number;
  totalToCharge: number;
  unitPrice: number;
  effectiveMarginPct: number;
}

/** Apostila / produtos que vendem clique com lucro embutido. */
export const isDirectSumItem = (m: PricingMaterial): boolean => {
  const kind = (m.productKind || "").toLowerCase();
  if (kind === "apostila" || kind.includes("apostila")) return true;
  if ((m.bookletUnits ?? 0) > 0) return true;
  return false;
};

const findTier = (
  snap: PricingSnapshot,
  categoryId: string,
  qty: number,
  markupGroupId?: string | null,
): MarkupTier | null => {
  const groupId = markupGroupId || snap.categoryDefaultGroupId[categoryId] || null;
  const groupTiers = groupId
    ? snap.markupTiers.filter((t) => t.markup_group_id === groupId)
    : snap.markupTiers.filter((t) => t.printer_category_id === categoryId);
  return (
    groupTiers.find((t) => qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty)) ||
    groupTiers[0] ||
    null
  );
};

const calcSellingPrice = (baseCost: number, tier: MarkupTier): number => {
  const soma = (tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct) / 100;
  const divisor = 1 - soma;
  if (divisor <= 0) return 0;
  return Math.round((baseCost / divisor) * 10) / 10;
};

interface ChildAggregates {
  matTotal: number;
  labTotal: number;
  total: number;
}

const aggregateChildren = (
  parentId: string,
  childMaterialsByParent: Map<string, PricingMaterial[]>,
  childLaborByParent: Map<string, PricingLaborStep[]>,
  hourlyRate: number,
): ChildAggregates => {
  const mats = childMaterialsByParent.get(parentId) ?? [];
  const labs = childLaborByParent.get(parentId) ?? [];
  const matTotal = mats
    .filter((cm) => !cm.isOptional)
    .reduce((s, cm) => s + cm.quantity * cm.unitPrice, 0);
  const labTotal = labs
    .filter((cl) => !cl.isOptional)
    .reduce((s, cl) => s + (cl.timeMinutes / 60) * hourlyRate, 0);
  return { matTotal, labTotal, total: matTotal + labTotal };
};

export const recalculateForQuantity = (
  snap: PricingSnapshot,
  newQuantity: number,
): PricingResult => {
  const qty = Math.max(1, Math.floor(newQuantity));

  const childMaterialsByParent = new Map<string, PricingMaterial[]>();
  const childLaborByParent = new Map<string, PricingLaborStep[]>();
  const standaloneMaterials: PricingMaterial[] = [];
  const standaloneLabor: PricingLaborStep[] = [];

  for (const m of snap.materials) {
    if (m.parentItemId) {
      const arr = childMaterialsByParent.get(m.parentItemId) ?? [];
      arr.push(m);
      childMaterialsByParent.set(m.parentItemId, arr);
    } else {
      standaloneMaterials.push(m);
    }
  }
  for (const l of snap.laborSteps) {
    if (l.parentItemId) {
      const arr = childLaborByParent.get(l.parentItemId) ?? [];
      arr.push(l);
      childLaborByParent.set(l.parentItemId, arr);
    } else {
      standaloneLabor.push(l);
    }
  }

  const laborTotal = standaloneLabor
    .filter((step) => !step.isOptional)
    .reduce((s, step) => s + (step.timeMinutes / 60) * snap.settings.hourlyRate, 0);
  const thirdPartyTotal = snap.thirdParty.reduce((s, t) => s + t.cost, 0);

  let printingTotal = 0;
  let nonPrintingMaterialsTotal = 0;

  const { invoicePct, wastePct, collectionPct, profitMarginPct, hourlyRate } = snap.settings;
  // Apostila/direct_sum:
  //   • Suprimentos filhos (Capa/Mola/etc): divisor HÍBRIDO por item.
  //       baseSalesPct = imposto + cartão + perda
  //       profitPct    = cm.margemPct (se > 0) OU profitMarginPct global
  //       divisor      = 1 − (baseSalesPct + profitPct) / 100
  //   • Mão de obra filha (Furo/Montagem/Encadernação):
  //       laborDivisor = 1 − (imposto + cartão + perda + lucro global) / 100
  const baseSalesPct = invoicePct + collectionPct + wastePct;
  const laborDivisor = 1 - (baseSalesPct + profitMarginPct) / 100;
  const supplySellingUnit = (cm: PricingMaterial): number => {
    const ownMargin = cm.margemPct ?? 0;
    const profitPct = ownMargin > 0 ? ownMargin : profitMarginPct;
    const divisor = 1 - (baseSalesPct + profitPct) / 100;
    if (divisor <= 0) return cm.unitPrice;
    return cm.unitPrice / divisor;
  };

  for (const m of standaloneMaterials) {
    const isPrinting = !!m.baseCost && !!m.printerCategoryId;
    if (!isPrinting) {
      if (!m.isOptional) nonPrintingMaterialsTotal += m.quantity * m.unitPrice;
      continue;
    }

    const itemQty = Math.max(0, m.quantity || 0);

    if (isDirectSumItem(m)) {
      // Apostila: impressão NÃO recebe markup (já vem da tabela Preço Impressão).
      // Filhos (suprimentos + MO) recebem o markup completo (impostos + cartão + perda + lucro).
      const childMats = childMaterialsByParent.get(m.id) ?? [];
      const childLab = childLaborByParent.get(m.id) ?? [];
      const childMatSellingTotal = childMats
        .filter((cm) => !cm.isOptional)
        .reduce((s, cm) => s + cm.quantity * supplySellingUnit(cm), 0);
      const childLabCostTotal = childLab
        .filter((cl) => !cl.isOptional)
        .reduce((s, cl) => s + (cl.timeMinutes / 60) * hourlyRate, 0);
      const childLabSellingTotal =
        laborDivisor > 0 ? childLabCostTotal / laborDivisor : childLabCostTotal;

      const baseCostPerSheet = (m.paperCost ?? 0) + (m.printingCostUnit ?? 0);
      const printingSellingUnit = (m.unitPrice ?? 0) > 0
        ? m.unitPrice
        : baseCostPerSheet;
      const printingSellingTotal = printingSellingUnit * itemQty;
      printingTotal += printingSellingTotal + childMatSellingTotal + childLabSellingTotal;
    } else {
      // Tier clássico — sem margem do insumo (markup do tier cobre).
      const aggCh = aggregateChildren(m.id, childMaterialsByParent, childLaborByParent, hourlyRate);
      const tier = findTier(snap, m.printerCategoryId!, qty, m.markupGroupId);
      const childPerUnit = itemQty > 0 ? aggCh.total / itemQty : 0;
      const baseCostEfetivo = (m.baseCost ?? 0) + childPerUnit;
      const sellingPrice = tier
        ? calcSellingPrice(baseCostEfetivo, tier)
        : baseCostEfetivo;
      printingTotal += sellingPrice * qty;
    }
  }

  const costsBeforeMarkup = laborTotal + nonPrintingMaterialsTotal + thirdPartyTotal;
  const totalPct = (invoicePct + wastePct + collectionPct + profitMarginPct) / 100;
  const divisor = 1 - totalPct;
  const valueWithMarkup = divisor > 0 ? costsBeforeMarkup / divisor : 0;

  const taxes = valueWithMarkup * (invoicePct / 100);
  const losses = valueWithMarkup * (wastePct / 100);
  const collection = valueWithMarkup * (collectionPct / 100);
  const profit = valueWithMarkup * (profitMarginPct / 100);

  const extras = (snap.hiddenExtrasValue ?? 0) + (snap.freightValue ?? 0);
  const totalToCharge = printingTotal + valueWithMarkup + extras;
  const unitPrice = qty > 0 ? totalToCharge / qty : totalToCharge;

  const effectiveMarginPct = totalToCharge > 0 ? (profit / totalToCharge) * 100 : 0;

  return {
    quantity: qty,
    printingTotal,
    laborTotal,
    nonPrintingMaterialsTotal,
    thirdPartyTotal,
    costsBeforeMarkup,
    taxes,
    losses,
    collection,
    profit,
    totalToCharge,
    unitPrice,
    effectiveMarginPct,
  };
};

// ============================================================
// Breakdown — exposes every cost component so the UI can render
// the "Composição do preço" panel. Per-item mode aware.
// ============================================================

export type BreakdownMode = "tier" | "direct_sum";

export interface PricingBreakdownItemBase {
  id: string;
  description: string;
  quantity: number;
  mode: BreakdownMode;
  sellingPriceUnit: number;
  sellingTotal: number;
}

export interface PricingBreakdownItemTier extends PricingBreakdownItemBase {
  mode: "tier";
  paperCostUnit: number;
  printingCostUnit: number;
  paperTotal: number;
  printingTotal: number;
  childMaterialsTotal: number;
  childLaborTotal: number;
  baseCostUnit: number;
  baseCostTotal: number;
  tierLabel: string | null;
  tierFixedPct: number;
  tierVariablePct: number;
  tierMarginPct: number;
  tierTotalPct: number;
}

export interface DirectSumChildRow {
  id: string;
  description: string;
  category: "covers" | "finishing";
  quantity: number;
  custoUnit: number;
  margemPct: number;
  vendaUnit: number;
  vendaTotal: number;
  /** "manual_tier" = preço final manual (impostos embutidos); "margin" = custo + margem%. */
  priceSource: "manual_tier" | "margin";
  /** Rótulo da faixa (ex: "TP2 · 6–20 un") quando priceSource === "manual_tier". */
  tierLabel?: string | null;
  /** Preço final ao cliente travado pela faixa (apenas em "manual_tier"). */
  finalUnitLocked?: number | null;
}

export interface PricingBreakdownItemDirectSum extends PricingBreakdownItemBase {
  mode: "direct_sum";
  /** R$ por unidade (apostila) — vem do clique de venda. */
  printingPerUnit: number;
  /** Filhos categorizados (R$ totais — já com margem aplicada). */
  coversTotal: number;
  finishingTotal: number;
  laborTotal: number;
  /** Por unidade (= total / qty). */
  coversPerUnit: number;
  finishingPerUnit: number;
  laborPerUnit: number;
  /** Linhas detalhadas (custo + margem + venda) para tooltip. */
  childRows: DirectSumChildRow[];
  /** Soma das parcelas antes dos custos de venda. */
  subtotalPerUnit: number;
  subtotalTotal: number;
  /** Custos de venda (impostos + cartão). */
  salesCostPct: number;
  salesCostPerUnit: number;
  salesCostTotal: number;
  /** Detalhe das linhas para o "Resumo por unidade". */
  printingLabel: string;
  /**
   * Base de exibição amigável: para apostilas, "1 apostila" (não "1 folha").
   * Para itens normais, espelha os campos *PerUnit.
   */
  displayUnits: number;
  displayUnitLabel: string; // ex: "apostila" | "un"
  pagesPerDisplayUnit: number; // multiplicador (folhas por apostila)
  printingPerDisplayUnit: number;
  coversPerDisplayUnit: number;
  finishingPerDisplayUnit: number;
  laborPerDisplayUnit: number;
  subtotalPerDisplayUnit: number;
  salesCostPerDisplayUnit: number;
  sellingPriceDisplayUnit: number;
}

export type PricingBreakdownItem =
  | PricingBreakdownItemTier
  | PricingBreakdownItemDirectSum;

export interface PricingBreakdown {
  items: PricingBreakdownItem[];
  hasDirectSumItems: boolean;
  hasTierItems: boolean;
  printingTotal: number;
  laborTotal: number;
  nonPrintingMaterialsTotal: number;
  thirdPartyTotal: number;
  costsBeforeMarkup: number;
  invoicePct: number;
  wastePct: number;
  collectionPct: number;
  profitMarginPct: number;
  taxes: number;
  losses: number;
  collection: number;
  profit: number;
  hiddenExtras: number;
  freight: number;
  totalToCharge: number;
}

const classifyChildMaterial = (cm: PricingMaterial): "covers" | "finishing" => {
  const txt = `${cm.productKind ?? ""} ${cm.description ?? ""}`.toLowerCase();
  if (txt.includes("capa") || txt.includes("contracapa")) return "covers";
  return "finishing";
};

export const breakdownForQuantity = (
  snap: PricingSnapshot,
  newQuantity = 1,
): PricingBreakdown => {
  const qty = Math.max(1, Math.floor(newQuantity));

  const childMaterialsByParent = new Map<string, PricingMaterial[]>();
  const childLaborByParent = new Map<string, PricingLaborStep[]>();
  const standaloneMaterials: PricingMaterial[] = [];
  const standaloneLabor: PricingLaborStep[] = [];

  for (const m of snap.materials) {
    if (m.parentItemId) {
      const arr = childMaterialsByParent.get(m.parentItemId) ?? [];
      arr.push(m);
      childMaterialsByParent.set(m.parentItemId, arr);
    } else {
      standaloneMaterials.push(m);
    }
  }
  for (const l of snap.laborSteps) {
    if (l.parentItemId) {
      const arr = childLaborByParent.get(l.parentItemId) ?? [];
      arr.push(l);
      childLaborByParent.set(l.parentItemId, arr);
    } else {
      standaloneLabor.push(l);
    }
  }

  const { invoicePct, wastePct, collectionPct, profitMarginPct, hourlyRate } = snap.settings;
  // Apostila/direct_sum:
  //   • Suprimentos filhos: divisor HÍBRIDO por item.
  //       baseSalesPct = imposto + cartão + perda
  //       profitPct    = cm.margemPct (se > 0) OU profitMarginPct global
  //   • Mão de obra filha: laborDivisor (imposto + cartão + perda + lucro global)
  const baseSalesPct = invoicePct + collectionPct + wastePct;
  const laborDivisor = 1 - (baseSalesPct + profitMarginPct) / 100;
  // Exibição: cobertura mínima (sem lucro) — para o badge "salesCostPct".
  const salesCostPct = baseSalesPct;
  const supplyProfitPct = (cm: PricingMaterial): number => {
    const own = cm.margemPct ?? 0;
    return own > 0 ? own : profitMarginPct;
  };
  const supplyDivisorFor = (cm: PricingMaterial): number =>
    1 - (baseSalesPct + supplyProfitPct(cm)) / 100;

  const laborTotal = standaloneLabor
    .filter((s) => !s.isOptional)
    .reduce((s, step) => s + (step.timeMinutes / 60) * hourlyRate, 0);
  const thirdPartyTotal = snap.thirdParty.reduce((s, t) => s + t.cost, 0);

  let nonPrintingMaterialsTotal = 0;
  let printingTotal = 0;
  let hasDirectSumItems = false;
  let hasTierItems = false;
  const items: PricingBreakdownItem[] = [];

  for (const m of standaloneMaterials) {
    const isPrinting = !!m.baseCost && !!m.printerCategoryId;
    if (!isPrinting) {
      if (!m.isOptional) nonPrintingMaterialsTotal += m.quantity * m.unitPrice;
      continue;
    }
    const itemQty = Math.max(0, m.quantity || 0);
    const safeQty = itemQty || 1;

    const childMats = childMaterialsByParent.get(m.id) ?? [];
    const childLab = childLaborByParent.get(m.id) ?? [];

    if (isDirectSumItem(m)) {
      hasDirectSumItems = true;

      // Apostila: impressão é a venda final da tabela (sem markup).
      // Filhos sempre passam por divisor (custo bruto → venda).
      const baseCostPerSheet = (m.paperCost ?? 0) + (m.printingCostUnit ?? 0);
      const printingUnit = (m.unitPrice ?? 0) > 0
        ? m.unitPrice
        : baseCostPerSheet;

      // Acumuladores: BRUTO (custo) e VENDA (com markup).
      let coversCostAbs = 0;
      let coversSellingAbs = 0;
      let finishingCostAbs = 0;
      let finishingSellingAbs = 0;
      const childRows: DirectSumChildRow[] = [];
      for (const cm of childMats) {
        if (cm.isOptional) continue;
        const profitPct = supplyProfitPct(cm);
        const divisor = supplyDivisorFor(cm);
        const vendaUnit = divisor > 0 ? cm.unitPrice / divisor : cm.unitPrice;
        const vendaTotal = cm.quantity * vendaUnit;
        const custoTotal = cm.quantity * cm.unitPrice;
        const cat = classifyChildMaterial(cm);
        if (cat === "covers") {
          coversCostAbs += custoTotal;
          coversSellingAbs += vendaTotal;
        } else {
          finishingCostAbs += custoTotal;
          finishingSellingAbs += vendaTotal;
        }
        childRows.push({
          id: cm.id,
          description: cm.description || "Insumo",
          category: cat,
          quantity: cm.quantity,
          custoUnit: cm.unitPrice,
          margemPct: profitPct,
          vendaUnit,
          vendaTotal,
          priceSource: "margin",
          tierLabel: null,
          finalUnitLocked: null,
        });
      }
      const laborCostAbs = childLab
        .filter((cl) => !cl.isOptional)
        .reduce((s, cl) => s + (cl.timeMinutes / 60) * hourlyRate, 0);
      const laborSellingAbs =
        laborDivisor > 0 ? laborCostAbs / laborDivisor : laborCostAbs;

      // Por unidade (folha) — usado pelo motor recalculate.
      const coversPerUnit = coversSellingAbs / safeQty;
      const finishingPerUnit = finishingSellingAbs / safeQty;
      const laborPerUnit = laborSellingAbs / safeQty;
      // Custo bruto (sem markup) por unidade.
      const childMatCostPerUnit = (coversCostAbs + finishingCostAbs) / safeQty;
      const childLabCostPerUnit = laborCostAbs / safeQty;
      const subtotalPerUnit = printingUnit + childMatCostPerUnit + childLabCostPerUnit;
      const sellingPriceUnit = printingUnit + coversPerUnit + finishingPerUnit + laborPerUnit;
      const salesCostPerUnit = sellingPriceUnit - subtotalPerUnit;

      const sellingTotal = sellingPriceUnit * itemQty;
      const subtotalTotal = subtotalPerUnit * itemQty;
      const salesCostTotal = salesCostPerUnit * itemQty;
      printingTotal += sellingTotal;

      const pages = m.bookletPages ?? null;
      const printingLabel = pages
        ? `Impressão (${pages} folhas)`
        : "Impressão";

      // Base de exibição: 1 apostila (não 1 folha) quando bookletUnits > 0.
      const bookletUnits = Math.max(0, Math.floor(m.bookletUnits ?? 0));
      const isApostila = bookletUnits > 0;
      const displayUnits = isApostila ? bookletUnits : itemQty;
      const displayUnitLabel = isApostila ? "apostila" : "un";
      const pagesPerDisplayUnit = isApostila && displayUnits > 0
        ? itemQty / displayUnits
        : 1;

      const printingPerDisplayUnit = printingUnit * pagesPerDisplayUnit;
      const coversPerDisplayUnit =
        displayUnits > 0 ? coversSellingAbs / displayUnits : coversPerUnit;
      const finishingPerDisplayUnit =
        displayUnits > 0 ? finishingSellingAbs / displayUnits : finishingPerUnit;
      const laborPerDisplayUnit =
        displayUnits > 0 ? laborSellingAbs / displayUnits : laborPerUnit;
      const sellingPriceDisplayUnit =
        printingPerDisplayUnit +
        coversPerDisplayUnit +
        finishingPerDisplayUnit +
        laborPerDisplayUnit;
      const childCostPerDisplayUnit =
        displayUnits > 0
          ? (coversCostAbs + finishingCostAbs + laborCostAbs) / displayUnits
          : childMatCostPerUnit + childLabCostPerUnit;
      const subtotalPerDisplayUnit = printingPerDisplayUnit + childCostPerDisplayUnit;
      const salesCostPerDisplayUnit = sellingPriceDisplayUnit - subtotalPerDisplayUnit;

      items.push({
        id: m.id,
        description: m.generatedTitle || m.description || "Item",
        quantity: itemQty,
        mode: "direct_sum",
        sellingPriceUnit,
        sellingTotal,
        printingPerUnit: printingUnit,
        coversTotal: coversSellingAbs,
        finishingTotal: finishingSellingAbs,
        laborTotal: laborSellingAbs,
        coversPerUnit,
        finishingPerUnit,
        laborPerUnit,
        childRows,
        subtotalPerUnit,
        subtotalTotal,
        salesCostPct,
        salesCostPerUnit,
        salesCostTotal,
        printingLabel,
        displayUnits,
        displayUnitLabel,
        pagesPerDisplayUnit,
        printingPerDisplayUnit,
        coversPerDisplayUnit,
        finishingPerDisplayUnit,
        laborPerDisplayUnit,
        subtotalPerDisplayUnit,
        salesCostPerDisplayUnit,
        sellingPriceDisplayUnit,
      });
      continue;
    }

    // ---- Caminho clássico tier ----
    hasTierItems = true;
    const tier = findTier(snap, m.printerCategoryId!, itemQty || 1, m.markupGroupId);
    const childMatTotal = childMats
      .filter((cm) => !cm.isOptional)
      .reduce((s, cm) => s + cm.quantity * cm.unitPrice, 0);
    const childLabTotal = childLab
      .filter((cl) => !cl.isOptional)
      .reduce((s, cl) => s + (cl.timeMinutes / 60) * hourlyRate, 0);
    const childTotalAbs = childMatTotal + childLabTotal;
    const childPerUnit = itemQty > 0 ? childTotalAbs / itemQty : 0;
    const baseCostUnit = (m.baseCost ?? 0) + childPerUnit;

    const sellingPriceUnit = tier ? calcSellingPrice(baseCostUnit, tier) : baseCostUnit;
    const sellingTotal = sellingPriceUnit * itemQty;
    printingTotal += sellingTotal;

    const paperCostUnit = m.paperCost ?? 0;
    const printingCostUnit = m.printingCostUnit ?? Math.max(0, (m.baseCost ?? 0) - paperCostUnit);

    const tierFixedPct = tier?.fixed_cost_pct ?? 0;
    const tierVariablePct = tier?.variable_cost_pct ?? 0;
    const tierMarginPct = tier?.margin_pct ?? 0;
    const tierTotalPct = tierFixedPct + tierVariablePct + tierMarginPct;

    items.push({
      id: m.id,
      description: m.generatedTitle || m.description || "Item",
      quantity: itemQty,
      mode: "tier",
      paperCostUnit,
      printingCostUnit,
      paperTotal: paperCostUnit * itemQty,
      printingTotal: printingCostUnit * itemQty,
      childMaterialsTotal: childMatTotal,
      childLaborTotal: childLabTotal,
      baseCostUnit,
      baseCostTotal: baseCostUnit * itemQty,
      tierLabel: tier?.label ?? null,
      tierFixedPct,
      tierVariablePct,
      tierMarginPct,
      tierTotalPct,
      sellingPriceUnit,
      sellingTotal,
    });
  }

  const costsBeforeMarkup = laborTotal + nonPrintingMaterialsTotal + thirdPartyTotal;
  const totalPct = (invoicePct + wastePct + collectionPct + profitMarginPct) / 100;
  const divisor = 1 - totalPct;
  const valueWithMarkup = divisor > 0 ? costsBeforeMarkup / divisor : 0;

  const taxes = valueWithMarkup * (invoicePct / 100);
  const losses = valueWithMarkup * (wastePct / 100);
  const collection = valueWithMarkup * (collectionPct / 100);
  const profit = valueWithMarkup * (profitMarginPct / 100);

  const hiddenExtras = snap.hiddenExtrasValue ?? 0;
  const freight = snap.freightValue ?? 0;
  const totalToCharge = printingTotal + valueWithMarkup + hiddenExtras + freight;

  return {
    items,
    hasDirectSumItems,
    hasTierItems,
    printingTotal,
    laborTotal,
    nonPrintingMaterialsTotal,
    thirdPartyTotal,
    costsBeforeMarkup,
    invoicePct,
    wastePct,
    collectionPct,
    profitMarginPct,
    taxes,
    losses,
    collection,
    profit,
    hiddenExtras,
    freight,
    totalToCharge,
  };
};
