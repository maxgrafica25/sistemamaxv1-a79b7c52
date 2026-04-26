// Pure pricing engine — mirrors the V1 NewQuoteForm calculation so the
// anchoring options builder can correctly reprice for any quantity.
//
// Key rule (printing industry): increasing quantity must NOT just multiply
// the unit_price. The selling price per unit drops because (a) the markup
// tier changes, and (b) fixed costs (labor, third-party, manual materials)
// dilute over more units.

import type { MarkupTier } from "@/components/orcamentos/PrintingItemSearch";

export interface PricingMaterial {
  id: string;
  description: string;
  quantity: number;       // qty per unit of final product (kept proportional on rescale)
  unitPrice: number;      // current unit price stored in quote (used for non-printing fallback)
  baseCost?: number;      // printing items: paper + printing cost (already accounting for size/side)
  printerCategoryId?: string;
  markupGroupId?: string | null;
}

export interface PricingLaborStep {
  timeMinutes: number;
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
  // tiers indexed once, used to re-find selling price per quantity
  markupTiers: MarkupTier[];
  categoryDefaultGroupId: Record<string, string | null>;
  // base quantity the snapshot was originally created at (default 1 per unit)
  baseQuantity: number;
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

/**
 * Recalculate the full quote totals for a target final quantity.
 *
 * Behaviour:
 * - Printing items: re-find tier for newQuantity and recompute selling unit
 *   price from baseCost. Total = newSellingPrice * newQuantity.
 * - Labor + third-party + non-printing materials: keep ABSOLUTE totals from
 *   the snapshot (they are setup costs that don't scale linearly with qty).
 *   They get diluted because we divide the final total by newQuantity.
 * - Apply impostos/perdas/cobrança/margem with the same divisor formula as V1.
 */
export const recalculateForQuantity = (
  snap: PricingSnapshot,
  newQuantity: number,
): PricingResult => {
  const qty = Math.max(1, Math.floor(newQuantity));

  // Labor (absolute, doesn't scale)
  const laborTotal = snap.laborSteps.reduce(
    (s, step) => s + (step.timeMinutes / 60) * snap.settings.hourlyRate,
    0,
  );

  // Third-party (absolute)
  const thirdPartyTotal = snap.thirdParty.reduce((s, t) => s + t.cost, 0);

  // Materials split
  let printingTotal = 0;
  let nonPrintingMaterialsTotal = 0;

  for (const m of snap.materials) {
    const isPrinting = !!m.baseCost && !!m.printerCategoryId;
    if (isPrinting) {
      const tier = findTier(snap, m.printerCategoryId!, qty, m.markupGroupId);
      const sellingPrice = tier ? calcSellingPrice(m.baseCost!, tier) : m.baseCost!;
      printingTotal += sellingPrice * qty;
    } else {
      // Non-printing materials: keep the stored absolute total (qty * unitPrice
      // from the snapshot). This represents the setup/raw material cost for
      // the whole job — same logic the V1 wizard applied to the divisor.
      nonPrintingMaterialsTotal += m.quantity * m.unitPrice;
    }
  }

  const costsBeforeMarkup = laborTotal + nonPrintingMaterialsTotal + thirdPartyTotal;
  const { invoicePct, wastePct, collectionPct, profitMarginPct } = snap.settings;
  const totalPct = (invoicePct + wastePct + collectionPct + profitMarginPct) / 100;
  const divisor = 1 - totalPct;
  const valueWithMarkup = divisor > 0 ? costsBeforeMarkup / divisor : 0;

  const taxes = valueWithMarkup * (invoicePct / 100);
  const losses = valueWithMarkup * (wastePct / 100);
  const collection = valueWithMarkup * (collectionPct / 100);
  const profit = valueWithMarkup * (profitMarginPct / 100);

  const totalToCharge = printingTotal + valueWithMarkup;
  const unitPrice = qty > 0 ? totalToCharge / qty : totalToCharge;

  // Effective margin over the whole sale (profit / totalToCharge)
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
