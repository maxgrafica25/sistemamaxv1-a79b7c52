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
import type { FinishingTier } from "@/lib/labels/finishing-pricing";

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
  /** Faixas de preço por quantidade de folhas. Vazio = preço único base. */
  tiers: FinishingTier[];
}

/**
 * Lista acabamentos ativos filtrando por contexto.
 * `context` undefined = retorna todos.
 *
 * Inclui as `finishing_price_tiers` (faixas por quantidade de folhas) aninhadas
 * para que o caller possa resolver o preço efetivo via
 * `resolveFinishingPricePerSheet`.
 */
export async function listFinishings(
  context?: FinishingContext,
): Promise<FinishingItem[]> {
  let q = (supabase as any)
    .from("finishings_price_items")
    .select(
      "*, finishing_price_tiers(id, finishing_id, label, min_qty, max_qty, price_per_sheet, sort_order)",
    )
    .eq("is_active", true)
    .order("sort_order");

  if (context) {
    q = q.contains("applies_to", [context]);
  }

  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as any[]).map((d) => ({
    ...d,
    tiers: (d.finishing_price_tiers ?? []) as FinishingTier[],
  })) as FinishingItem[];
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

/**
 * Soma seleções de acabamentos para um item com `sheets` folhas.
 * - per_sheet → entra em `perSheet` (somado ao preço por folha)
 * - per_unit  → entra em `perUnitTotal` (rateado fora pelo chamador)
 */
export function sumFinishingsPerSheet(
  selections: {
    pricing_model: FinishingPricingModel;
    price: number;
    units?: number;
  }[],
  sheets: number,
): { perSheet: number; perUnitTotal: number } {
  let perSheet = 0;
  let perUnitTotal = 0;
  for (const s of selections) {
    if (s.pricing_model === "per_sheet") {
      perSheet += s.price;
    } else {
      perUnitTotal += s.price * (s.units ?? sheets);
    }
  }
  return { perSheet, perUnitTotal };
}

