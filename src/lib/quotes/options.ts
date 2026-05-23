export interface QuoteOption {
  id: string;
  label: string;        // e.g. "500 unidades"
  quantity: number;
  unit_price: number;   // already recalculated for this quantity
  total: number;
}

export const optionLabel = (qty: number) =>
  `${qty.toLocaleString("pt-BR")} ${qty === 1 ? "unidade" : "unidades"}`;

export const parseOptions = (raw: unknown): QuoteOption[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is QuoteOption =>
      !!o && typeof o === "object" &&
      typeof (o as QuoteOption).quantity === "number" &&
      typeof (o as QuoteOption).total === "number"
    )
    .map((o) => ({
      id: o.id ?? crypto.randomUUID(),
      label: o.label ?? optionLabel(o.quantity),
      quantity: o.quantity,
      unit_price: o.unit_price ?? (o.quantity > 0 ? o.total / o.quantity : 0),
      total: o.total,
    }));
};
