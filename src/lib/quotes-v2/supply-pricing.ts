// Helper para faixas manuais de preço por quantidade dos suprimentos.
// O `manual_price` cadastrado é o **preço final ao cliente** (impostos e
// taxa de cartão já embutidos). O motor faz engenharia reversa para somar
// coerentemente com os outros parcelos antes do divisor de venda.

export interface SupplyTier {
  id: string;
  supply_id: string;
  label: string;
  min_qty: number;
  max_qty: number | null;
  manual_price: number;
  sort_order?: number;
}

export const pickSupplyTier = (
  tiers: SupplyTier[] | null | undefined,
  qty: number,
): SupplyTier | null => {
  if (!tiers || tiers.length === 0) return null;
  const q = Math.max(1, Math.floor(qty || 1));
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  return (
    sorted.find(
      (t) => q >= t.min_qty && (t.max_qty == null || q <= t.max_qty),
    ) || null
  );
};
