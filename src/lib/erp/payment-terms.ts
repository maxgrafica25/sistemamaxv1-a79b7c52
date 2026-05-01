/**
 * Geração de parcelas a partir de uma condição de pagamento.
 * Formatos aceitos:
 *  - "a_vista"        → 1 parcela hoje
 *  - "30"             → 1 parcela em 30d
 *  - "30_60"          → 2 parcelas em 30d / 60d
 *  - "30_60_90"       → 3 parcelas em 30d / 60d / 90d
 *  - "Nx_30"          → N parcelas espaçadas 30d
 */

export interface InstallmentDraft {
  due_date: string; // ISO yyyy-mm-dd
  amount: number;
  payment_method?: string;
}

export const PAYMENT_TERM_OPTIONS = [
  { value: "a_vista", label: "À vista" },
  { value: "30", label: "30 dias" },
  { value: "30_60", label: "30/60 dias" },
  { value: "30_60_90", label: "30/60/90 dias" },
  { value: "2x_30", label: "2x (30/60)" },
  { value: "3x_30", label: "3x (30/60/90)" },
  { value: "4x_30", label: "4x mensais" },
  { value: "custom", label: "Personalizado" },
] as const;

export const PAYMENT_METHOD_OPTIONS = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
] as const;

function addDays(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function splitEqually(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rest = cents - base * n;
  return Array.from({ length: n }, (_, i) =>
    ((i < rest ? base + 1 : base) / 100)
  );
}

export function generateInstallments(
  total: number,
  term: string,
  defaultMethod?: string,
  baseDate: Date = new Date(),
): InstallmentDraft[] {
  const method = defaultMethod;

  if (term === "a_vista") {
    return [{ due_date: addDays(baseDate, 0), amount: total, payment_method: method }];
  }
  if (term === "30") {
    return [{ due_date: addDays(baseDate, 30), amount: total, payment_method: method }];
  }
  if (term === "30_60") {
    const parts = splitEqually(total, 2);
    return [
      { due_date: addDays(baseDate, 30), amount: parts[0], payment_method: method },
      { due_date: addDays(baseDate, 60), amount: parts[1], payment_method: method },
    ];
  }
  if (term === "30_60_90") {
    const parts = splitEqually(total, 3);
    return [
      { due_date: addDays(baseDate, 30), amount: parts[0], payment_method: method },
      { due_date: addDays(baseDate, 60), amount: parts[1], payment_method: method },
      { due_date: addDays(baseDate, 90), amount: parts[2], payment_method: method },
    ];
  }
  const m = term.match(/^(\d+)x_30$/);
  if (m) {
    const n = parseInt(m[1], 10);
    const parts = splitEqually(total, n);
    return parts.map((amount, i) => ({
      due_date: addDays(baseDate, 30 * (i + 1)),
      amount,
      payment_method: method,
    }));
  }
  // fallback
  return [{ due_date: addDays(baseDate, 30), amount: total, payment_method: method }];
}

export function formatBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function termLabel(value: string): string {
  return PAYMENT_TERM_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function methodLabel(value?: string | null): string {
  if (!value) return "—";
  return PAYMENT_METHOD_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
