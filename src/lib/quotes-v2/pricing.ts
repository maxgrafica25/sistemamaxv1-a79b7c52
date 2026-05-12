// Pure pricing engine — mirrors the V1 NewQuoteForm calculation so the
// anchoring options builder can correctly reprice for any quantity.
//
// Key rule (printing industry): increasing quantity must NOT just multiply
// the unit_price. The selling price per unit drops because (a) the markup
// tier changes, and (b) fixed costs (labor, third-party, manual materials)
// dilute over more units.
//
// V2 reestruturado: cada item de impressão pode ter "filhos vinculados"
// (mão de obra e materiais manuais marcados com parentItemId = id do pai).
// Esses custos vinculados são embutidos no baseCost do pai antes de aplicar
// o tier de markup — ou seja, são tratados como acabamentos que escalam com
// a quantidade do item de impressão. Custos avulsos (parentItemId == null)
// continuam sendo somas absolutas diluídas pela quantidade total.

import type { MarkupTier } from "@/components/orcamentos/PrintingItemSearch";

export interface PricingMaterial {
  id: string;
  description: string;
  quantity: number;       // CHARGEABLE quantity (sheets para itens de impressão com dimensões)
  unitPrice: number;      // current unit price stored in quote (used for non-printing fallback)
  pieces?: number | null; // peças desejadas pelo cliente (apenas exibição/persistência; pricing usa quantity)
  baseCost?: number;      // printing items: paper + printing cost (already accounting for size/side)
  printerCategoryId?: string;
  markupGroupId?: string | null;
  status?: "pendente" | "aprovado" | "recusado";
  approvedAt?: string | null;
  approvedValue?: number | null;
  parentItemId?: string | null; // se preenchido, é filho de um item de impressão
  // Nomenclatura dinâmica (atributos estruturados do catálogo + dados do vendedor)
  productKind?: string | null;
  customName?: string | null;
  reference?: string | null;
  generatedTitle?: string | null;
  paperType?: string | null;
  grammage?: string | null;
  size?: string | null;
  side?: string | null;
  // Dimensões estruturadas em mm (V2.1) — usadas para descrição e cálculo de aproveitamento
  widthMm?: number | null;
  heightMm?: number | null;
  printColors?: string | null; // "4x4" | "4x0" | "1x1" | "1x0"
  // Catálogo (nomenclatura travada)
  catalogSource?: "printing" | "finishing" | null;
  catalogItemId?: string | null;
  /** Acabamento opcional (upsell) — não compõe o preço base do item pai. */
  isOptional?: boolean;
  /** Variações de tiragem para ancoragem de preço (ex: 100/500/1000). */
  quantityVariations?: Array<{ pieces: number; unit_price: number }>;
  /** Apostila: nº de páginas por apostila (entrada do usuário). */
  bookletPages?: number | null;
  /** Apostila: nº de apostilas (entrada do usuário). */
  bookletUnits?: number | null;
  /** Apostila: imprime frente e verso. */
  bookletDuplex?: boolean | null;
  /** Custo do papel por unidade (separado de baseCost para detalhamento). */
  paperCost?: number | null;
  /** Custo de impressão por unidade JÁ multiplicado (size/side). */
  printingCostUnit?: number | null;
}

export interface PricingLaborStep {
  timeMinutes: number;
  parentItemId?: string | null; // se preenchido, é filho de um item de impressão
  /** Mão-de-obra opcional (upsell) — não compõe o preço base do item pai. */
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
  // tiers indexed once, used to re-find selling price per quantity
  markupTiers: MarkupTier[];
  categoryDefaultGroupId: Record<string, string | null>;
  // base quantity the snapshot was originally created at (default 1 per unit)
  baseQuantity: number;
  // Extras somados ao total final APÓS o markup (não entram na base de cálculo).
  // Aplicados em todas as opções de ancoragem (inclusive na base) para coerência.
  hiddenExtrasValue?: number; // some valor "outros" — não aparece ao cliente
  freightValue?: number;      // valor de frete — aparece ao cliente
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
 * Behaviour (V2 reestruturado):
 * - Para cada item de impressão pai:
 *     baseCostEfetivo = baseCost(papel+impressão) + custosFilhosUnitarios
 *     onde custosFilhosUnitarios = (Σ mão de obra filha + Σ materiais filhos) / qty
 *     O sellingPrice é calculado sobre baseCostEfetivo aplicando o tier do qty.
 *     printingTotal += sellingPrice * qty
 * - Mão de obra e materiais AVULSOS (parentItemId == null): mantém comportamento
 *   anterior — somas absolutas que entram no divisor de markup geral.
 * - Terceirizados: sempre absolutos, no divisor geral.
 */
export const recalculateForQuantity = (
  snap: PricingSnapshot,
  newQuantity: number,
): PricingResult => {
  const qty = Math.max(1, Math.floor(newQuantity));

  // ---- Separa filhos x avulsos ----
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

  // ---- Avulsos (somas absolutas no divisor geral) — opcionais excluídos ----
  const laborTotal = standaloneLabor
    .filter((step) => !step.isOptional)
    .reduce((s, step) => s + (step.timeMinutes / 60) * snap.settings.hourlyRate, 0);
  const thirdPartyTotal = snap.thirdParty.reduce((s, t) => s + t.cost, 0);

  let printingTotal = 0;
  let nonPrintingMaterialsTotal = 0;

  // Materiais avulsos não-impressão (sem baseCost)
  for (const m of standaloneMaterials) {
    const isPrinting = !!m.baseCost && !!m.printerCategoryId;
    if (isPrinting) {
      // Item de impressão raiz (sem filhos)
      const tier = findTier(snap, m.printerCategoryId!, qty, m.markupGroupId);
      const sellingPrice = tier ? calcSellingPrice(m.baseCost!, tier) : m.baseCost!;
      printingTotal += sellingPrice * qty;
    } else if (!m.isOptional) {
      nonPrintingMaterialsTotal += m.quantity * m.unitPrice;
    }
  }

  // ---- Itens de impressão COM filhos vinculados ----
  // Qualquer material com baseCost que aparece como pai precisa ser reprocessado
  // sobrescrevendo o cálculo "raiz" acima. Para simplificar, processamos aqui
  // todos os pais (materials que são chave em childMaterialsByParent OU childLaborByParent).
  const parentIds = new Set<string>([
    ...childMaterialsByParent.keys(),
    ...childLaborByParent.keys(),
  ]);

  if (parentIds.size > 0) {
    // Reseta: re-soma só os pais "puros" (sem filhos) já contabilizados acima.
    // Como o loop anterior já somou pais sem filhos, precisamos descontar os pais
    // que TÊM filhos (pois vamos recomputá-los) — mas o loop anterior só processou
    // standaloneMaterials. Pais com filhos também são standaloneMaterials (pais nunca
    // têm parentItemId). Então precisamos descontar a contribuição deles e refazer.
    for (const m of standaloneMaterials) {
      if (!parentIds.has(m.id)) continue;
      const isPrinting = !!m.baseCost && !!m.printerCategoryId;
      if (!isPrinting) continue;
      const tier = findTier(snap, m.printerCategoryId!, qty, m.markupGroupId);
      const sellingPriceOld = tier ? calcSellingPrice(m.baseCost!, tier) : m.baseCost!;
      printingTotal -= sellingPriceOld * qty;

      // Custo total dos filhos deste pai (excluindo opcionais — upsell)
      const childMats = childMaterialsByParent.get(m.id) ?? [];
      const childLab = childLaborByParent.get(m.id) ?? [];
      const childMatTotal = childMats
        .filter((cm) => !cm.isOptional)
        .reduce((s, cm) => s + cm.quantity * cm.unitPrice, 0);
      const childLabTotal = childLab
        .filter((cl) => !cl.isOptional)
        .reduce((s, cl) => s + (cl.timeMinutes / 60) * snap.settings.hourlyRate, 0);
      const childTotalAbs = childMatTotal + childLabTotal;

      // Diluição: custo dos filhos por unidade do item pai
      const childPerUnit = qty > 0 ? childTotalAbs / qty : 0;
      const baseCostEfetivo = (m.baseCost ?? 0) + childPerUnit;
      const sellingPriceNew = tier
        ? calcSellingPrice(baseCostEfetivo, tier)
        : baseCostEfetivo;
      printingTotal += sellingPriceNew * qty;
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
