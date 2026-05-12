// Pure pricing engine — supports two modes per printing item:
//   1. "tier"       — classic markup tiers + global divisor (cards, flyers, etc).
//   2. "direct_sum" — printingCostUnit already includes profit; we only sum
//                     parcels and add sales costs (taxes + collection).
//
// Mode is decided per parent item via isDirectSumItem(): apostilas detected by
// productKind === "apostila" or bookletUnits > 0. Standalone (non-printing)
// materials/labor still flow through the classic global divisor.

import type { MarkupTier } from "@/components/orcamentos/PrintingItemSearch";
import { pickSupplyTier, type SupplyTier } from "./supply-pricing";

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
  const directSumDivisor = 1 - (invoicePct + collectionPct) / 100;

  for (const m of standaloneMaterials) {
    const isPrinting = !!m.baseCost && !!m.printerCategoryId;
    if (!isPrinting) {
      if (!m.isOptional) nonPrintingMaterialsTotal += m.quantity * m.unitPrice;
      continue;
    }

    const itemQty = Math.max(0, m.quantity || 0);

    if (isDirectSumItem(m)) {
      // Soma direta: printingCostUnit já é venda c/ lucro embutido.
      // Filhos materiais: tier manual (preço final) > margem_pct > custo.
      const childMats = childMaterialsByParent.get(m.id) ?? [];
      const childLab = childLaborByParent.get(m.id) ?? [];
      const childMatTotal = childMats
        .filter((cm) => !cm.isOptional)
        .reduce((s, cm) => {
          const tier = pickSupplyTier(cm.pricingTiers, cm.quantity);
          if (tier) {
            // manual_price É o preço final ao cliente. Removemos o custo de
            // venda (1 - imp - cartão) para que, ao reaplicar o divisor no
            // final, o cliente veja exatamente o valor cadastrado.
            const preDivUnit = tier.manual_price * directSumDivisor;
            return s + cm.quantity * preDivUnit;
          }
          const venda = cm.unitPrice * (1 + (cm.margemPct ?? 0) / 100);
          return s + cm.quantity * venda;
        }, 0);
      const childLabTotal = childLab
        .filter((cl) => !cl.isOptional)
        .reduce((s, cl) => s + (cl.timeMinutes / 60) * hourlyRate, 0);

      // Impressão: usar unitPrice (preço de venda/folha já com tier de markup
      // embutido). Não reaplicar divisor aqui — só sobre os filhos.
      const printingSellingUnit = m.unitPrice ?? m.printingCostUnit ?? m.baseCost ?? 0;
      const childSubtotalUn = itemQty > 0 ? (childMatTotal + childLabTotal) / itemQty : 0;
      const childSellingUn =
        directSumDivisor > 0 ? childSubtotalUn / directSumDivisor : childSubtotalUn;
      const sellingUn = printingSellingUnit + childSellingUn;
      printingTotal += sellingUn * itemQty;
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
  const salesCostPct = invoicePct + collectionPct;
  const directSumDivisor = 1 - salesCostPct / 100;

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

      // Preço de venda por folha (já com tier markup); fallback ao custo
      // se não houver unitPrice (cenário legado).
      const printingUnit = m.unitPrice ?? m.printingCostUnit ?? m.baseCost ?? 0;
      let coversTotalAbs = 0;
      let finishingTotalAbs = 0;
      const childRows: DirectSumChildRow[] = [];
      for (const cm of childMats) {
        if (cm.isOptional) continue;
        const tier = pickSupplyTier(cm.pricingTiers, cm.quantity);
        let vendaUnit: number;
        let margemPct = 0;
        let priceSource: "manual_tier" | "margin" = "margin";
        let tierLabel: string | null = null;
        let finalUnitLocked: number | null = null;
        if (tier) {
          // Engenharia reversa: o pricing engine reaplica o divisor no
          // total — para o cliente ver tier.manual_price exato, somamos
          // (manual_price * divisor) no subtotal pré-divisor.
          vendaUnit = tier.manual_price * directSumDivisor;
          priceSource = "manual_tier";
          finalUnitLocked = tier.manual_price;
          const maxLabel =
            tier.max_qty == null ? `${tier.min_qty}+ un` : `${tier.min_qty}–${tier.max_qty} un`;
          tierLabel = `${tier.label} · ${maxLabel}`;
        } else {
          margemPct = cm.margemPct ?? 0;
          vendaUnit = cm.unitPrice * (1 + margemPct / 100);
        }
        const vendaTotal = cm.quantity * vendaUnit;
        const cat = classifyChildMaterial(cm);
        if (cat === "covers") coversTotalAbs += vendaTotal;
        else finishingTotalAbs += vendaTotal;
        childRows.push({
          id: cm.id,
          description: cm.description || "Insumo",
          category: cat,
          quantity: cm.quantity,
          custoUnit: cm.unitPrice,
          margemPct,
          vendaUnit,
          vendaTotal,
          priceSource,
          tierLabel,
          finalUnitLocked,
        });
      }
      const laborTotalAbs = childLab
        .filter((cl) => !cl.isOptional)
        .reduce((s, cl) => s + (cl.timeMinutes / 60) * hourlyRate, 0);

      const coversPerUnit = coversTotalAbs / safeQty;
      const finishingPerUnit = finishingTotalAbs / safeQty;
      const laborPerUnit = laborTotalAbs / safeQty;
      const childrenPerUnit = coversPerUnit + finishingPerUnit + laborPerUnit;
      const childrenSellingPerUnit =
        directSumDivisor > 0 ? childrenPerUnit / directSumDivisor : childrenPerUnit;
      const subtotalPerUnit = printingUnit + childrenPerUnit;
      const sellingPriceUnit = printingUnit + childrenSellingPerUnit;
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
      const coversPerDisplayUnit = displayUnits > 0 ? coversTotalAbs / displayUnits : coversPerUnit;
      const finishingPerDisplayUnit = displayUnits > 0 ? finishingTotalAbs / displayUnits : finishingPerUnit;
      const laborPerDisplayUnit = displayUnits > 0 ? laborTotalAbs / displayUnits : laborPerUnit;
      const childrenPerDisplayUnit =
        coversPerDisplayUnit + finishingPerDisplayUnit + laborPerDisplayUnit;
      const childrenSellingPerDisplayUnit =
        directSumDivisor > 0 ? childrenPerDisplayUnit / directSumDivisor : childrenPerDisplayUnit;
      const subtotalPerDisplayUnit = printingPerDisplayUnit + childrenPerDisplayUnit;
      const sellingPriceDisplayUnit = printingPerDisplayUnit + childrenSellingPerDisplayUnit;
      const salesCostPerDisplayUnit = sellingPriceDisplayUnit - subtotalPerDisplayUnit;

      items.push({
        id: m.id,
        description: m.generatedTitle || m.description || "Item",
        quantity: itemQty,
        mode: "direct_sum",
        sellingPriceUnit,
        sellingTotal,
        printingPerUnit: printingUnit,
        coversTotal: coversTotalAbs,
        finishingTotal: finishingTotalAbs,
        laborTotal: laborTotalAbs,
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
