import type {
  V3BookletItem,
  V3CVItem,
  V3Item,
  V3LaborItem,
  V3LabelItem,
  V3PrintItem,
  V3SupplyItem,
  V3ThirdItem,
} from "../types";

export const roundUp10 = (n: number) =>
  !isFinite(n) || n <= 0 ? 0 : Math.ceil(n * 10) / 10;

export interface ItemPrice {
  custo_total: number;
  preco_total: number;
}

export const priceOfPrint = (it: V3PrintItem): ItemPrice => {
  const q = Math.max(1, Math.floor(it.quantidade || 1));
  return {
    custo_total: q * (it.custo_unitario || 0),
    preco_total: roundUp10(q * (it.valor_unitario || 0)),
  };
};

export const priceOfCV = (it: V3CVItem): ItemPrice => {
  if (it.snapshot && it.snapshot.preco_total > 0) {
    return {
      custo_total: it.snapshot.custo_total,
      preco_total: it.snapshot.preco_total,
    };
  }
  const m2 = Math.max(0, it.largura_m) * Math.max(0, it.altura_m);
  const q = Math.max(1, Math.floor(it.quantidade || 1));
  const custo_total = m2 * q * (it.custo_mt2 || 0);
  const preco_total = roundUp10(custo_total * (1 + (it.margem_mt2_pct || 0) / 100));
  return { custo_total, preco_total };
};

export const priceOfThird = (it: V3ThirdItem): ItemPrice => {
  const q = Math.max(1, Math.floor(it.quantidade || 1));
  const custo_total = q * (it.custo || 0);
  const preco_total = roundUp10(custo_total * (1 + (it.margem_pct || 0) / 100));
  return { custo_total, preco_total };
};

export const priceOfBooklet = (it: V3BookletItem): ItemPrice => {
  const physicalSheets = Math.max(
    0,
    Math.floor(it.bookletPages || 0) * Math.floor(it.bookletUnits || 0),
  );
  // Se catálogo é Só frente e usuário marcou F/V, dobra (paridade com PrintingItemEditor).
  const sideMult = it.side === "F/V" ? 1 : it.bookletDuplex ? 2 : 1;
  const custo_total = physicalSheets * (it.custo_unitario || 0) * sideMult;
  const preco_total = roundUp10(
    physicalSheets * (it.valor_unitario || 0) * sideMult,
  );
  return { custo_total, preco_total };
};

export const priceOfLabor = (it: V3LaborItem): ItemPrice => {
  const custo_total = (it.time_minutes / 60) * (it.hourly_rate || 0);
  const preco_total = roundUp10(custo_total * (1 + (it.margem_pct || 0) / 100));
  return { custo_total, preco_total };
};

export const priceOfSupply = (it: V3SupplyItem): ItemPrice => {
  const q = Math.max(1, Math.floor(it.quantidade || 1));
  const custo_total = q * (it.custo_unitario || 0);
  const preco_total = roundUp10(custo_total * (1 + (it.margem_pct || 0) / 100));
  return { custo_total, preco_total };
};

export const priceOfLabel = (it: V3LabelItem): ItemPrice => ({
  custo_total: it.custo_total || 0,
  preco_total: roundUp10(it.preco_total || 0),
});

export const priceOf = (it: V3Item): ItemPrice => {
  switch (it.kind) {
    case "print":
      return priceOfPrint(it);
    case "cv":
      return priceOfCV(it);
    case "third":
      return priceOfThird(it);
    case "booklet":
      return priceOfBooklet(it);
    case "labor":
      return priceOfLabor(it);
    case "supply":
      return priceOfSupply(it);
    case "label":
      return priceOfLabel(it);
  }
};

export interface FinancialSummary {
  subtotal: number;
  cost: number;
  taxValue: number;
  feesValue: number;
  marginValue: number;
  total: number;
  marginPct: number;
}

export const summarize = (
  items: V3Item[],
  taxPct: number,
  feesPct: number,
  marginPct: number,
): FinancialSummary => {
  let subtotal = 0;
  let cost = 0;
  for (const it of items) {
    const p = priceOf(it);
    subtotal += p.preco_total;
    cost += p.custo_total;
  }
  const taxValue = subtotal * (taxPct / 100);
  const feesValue = subtotal * (feesPct / 100);
  const marginValue = subtotal * (marginPct / 100);
  const total = subtotal;
  const profit = total - cost - taxValue - feesValue;
  const marginActualPct = total > 0 ? (profit / total) * 100 : 0;
  return {
    subtotal,
    cost,
    taxValue,
    feesValue,
    marginValue,
    total: roundUp10(total),
    marginPct: marginActualPct,
  };
};

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
