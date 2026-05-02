// =============================================================================
// Faixas de preço por quantidade (em FOLHAS) para acabamentos
// =============================================================================
// Espelha a lógica de markup_tiers da impressão: o preço por folha de um
// acabamento (recorte, laminação...) pode variar conforme o volume da tiragem.
//
// Fonte: tabela `finishing_price_tiers` (1:N com finishings_price_items).
// Fallback: se o acabamento não tem nenhuma tier cadastrada, o caller usa o
// `price_per_sheet` base de finishings_price_items — zero regressão.
// =============================================================================

export interface FinishingTier {
  id: string;
  finishing_id: string;
  label: string;
  min_qty: number;          // em FOLHAS (>= 1)
  max_qty: number | null;   // null = sem teto
  price_per_sheet: number;
  sort_order: number;
}

/**
 * Resolve o preço/folha para uma quantidade de folhas, dentro das tiers de um
 * acabamento. Retorna `null` se nenhuma tier cobre a quantidade — nesse caso o
 * caller deve usar o preço base.
 *
 * Regra: tier onde `min_qty <= sheetsQty <= (max_qty ?? +∞)`.
 * Se sheetsQty < menor min_qty, considera a primeira tier (proteção contra
 * tiragens menores que o limite mínimo configurado).
 */
export function pickFinishingTier(
  tiers: FinishingTier[],
  sheetsQty: number,
): FinishingTier | null {
  if (!tiers.length) return null;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  const qty = Math.max(1, Math.floor(sheetsQty));

  for (const t of sorted) {
    const max = t.max_qty ?? Number.POSITIVE_INFINITY;
    if (qty >= t.min_qty && qty <= max) return t;
  }

  // Quantidade abaixo do menor min_qty → usa a primeira tier
  if (qty < sorted[0].min_qty) return sorted[0];
  return null;
}

/**
 * Helper de alto nível: dado o preço base e as tiers, devolve o preço/folha
 * efetivo para a quantidade de folhas.
 */
export function resolveFinishingPricePerSheet(
  basePrice: number,
  tiers: FinishingTier[],
  sheetsQty: number,
): number {
  const t = pickFinishingTier(tiers, sheetsQty);
  return t ? t.price_per_sheet : basePrice;
}
