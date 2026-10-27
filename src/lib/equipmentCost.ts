// Custo por página dos consumíveis de um equipamento.
// O rendimento cadastrado é o do fabricante (5% de cobertura). Só o que gasta mais
// com mais tinta na folha (toner, tinta) é multiplicado pela cobertura; fusor, belt,
// cilindro, revelador, manutenção e depreciação custam o mesmo por página.

export const COBERTURA_FABRICANTE = 5;

export interface ConsumableCostInput {
  price: number;
  yield_pages: number;
  scales_with_coverage?: boolean | null;
}

export const consumableCost = (c: ConsumableCostInput, coveragePct: number): number => {
  if (!c.yield_pages || c.yield_pages <= 0) return 0;
  const base = c.price / c.yield_pages;
  return c.scales_with_coverage === false ? base : base * (coveragePct / COBERTURA_FABRICANTE);
};

export const equipmentCost = (items: ConsumableCostInput[], coveragePct: number): number =>
  items.reduce((sum, c) => sum + consumableCost(c, coveragePct), 0);
