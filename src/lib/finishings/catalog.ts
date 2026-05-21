// =============================================================================
// Catálogo unificado de acabamentos (Etiquetas + Impressão V3)
// =============================================================================
// Fonte única: tabela `finishings_price_items`.
//
// Cada acabamento pode:
//  - aplicar-se a Etiquetas, Impressão, ou ambos (applies_to: text[])
//  - cobrar por folha (R$/folha em um size específico) ou por unidade
//    (R$/un de algo — ilhós, dobra, etc.)
//
// Comunicação Visual (cv_calc_acabamentos) e Processos de Produção
// (production_steps) seguem caminhos próprios e não passam por aqui.
// =============================================================================

import { supabase } from "@/integrations/supabase/client";

export type FinishingContext = "etiqueta" | "impressao";
export type FinishingPricingModel = "per_sheet" | "per_unit";

export interface FinishingItem {
  id: string;
  name: string;
  category: string;
  size: string | null;
  price_per_sheet: number;
  pricing_model: FinishingPricingModel;
  applies_to: FinishingContext[];
  unit_label: string | null;
  is_active: boolean;
  sort_order: number;
}

/**
 * Lista acabamentos ativos filtrando por contexto.
 * `context` undefined = retorna todos.
 */
export async function listFinishings(
  context?: FinishingContext,
): Promise<FinishingItem[]> {
  let q = (supabase as any)
    .from("finishings_price_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  if (context) {
    q = q.contains("applies_to", [context]);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as FinishingItem[];
}

/**
 * Calcula o custo de um acabamento.
 * - per_sheet → preço × folhas
 * - per_unit  → preço × quantidade
 *
 * Para tiers por quantidade (faixas), use resolveFinishingPricePerSheet
 * de `@/lib/labels/finishing-pricing` antes de chamar este helper.
 */
export function calcFinishingCost(
  item: Pick<FinishingItem, "pricing_model" | "price_per_sheet">,
  opts: { sheets?: number; units?: number },
): number {
  if (item.pricing_model === "per_sheet") {
    return item.price_per_sheet * (opts.sheets ?? 0);
  }
  return item.price_per_sheet * (opts.units ?? 0);
}
