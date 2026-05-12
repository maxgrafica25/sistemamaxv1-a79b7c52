/**
 * Helpers de exibição para mão de obra (processos de acabamento).
 *
 * O motor de preço (`pricing.ts`) calcula custos brutos por linha e só aplica
 * impostos / cartão / margem / perdas no agregado do item-pai. Para que a UI
 * mostre valores coerentes com o "Valor de venda unitário" exibido nos
 * insumos, usamos o mesmo divisor global aqui — apenas para apresentação.
 */

export interface LaborDisplayPcts {
  invoicePct: number;
  collectionPct: number;
  profitMarginPct: number;
  wastePct: number;
}

export const LABOR_SELLING_TOOLTIP =
  "Valor de venda unitário (inclui mão de obra, impostos e margem)";

export function laborDisplayDivisor(pcts: LaborDisplayPcts): number {
  const totalPct =
    pcts.invoicePct + pcts.collectionPct + pcts.profitMarginPct + pcts.wastePct;
  return Math.max(0.01, 1 - totalPct / 100);
}

export function computeLaborSellingPrice(
  timeMinutes: number,
  hourlyRate: number,
  pcts: LaborDisplayPcts,
): number {
  const cost = ((timeMinutes || 0) / 60) * (hourlyRate || 0);
  return cost / laborDisplayDivisor(pcts);
}
