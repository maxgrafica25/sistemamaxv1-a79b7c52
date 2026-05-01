export type SalesOrderStatus = "aberto" | "aprovado" | "em_producao" | "entregue" | "cancelado";

export const ORDER_STATUS_META: Record<
  SalesOrderStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  aberto:      { label: "Aberto",       badgeClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",   dotClass: "bg-slate-500" },
  aprovado:    { label: "Aprovado",     badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",       dotClass: "bg-blue-500" },
  em_producao: { label: "Em Produção",  badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",   dotClass: "bg-amber-500" },
  entregue:    { label: "Entregue",     badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dotClass: "bg-emerald-500" },
  cancelado:   { label: "Cancelado",    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",       dotClass: "bg-rose-500" },
};

export const KANBAN_COLUMNS: SalesOrderStatus[] = ["aberto", "aprovado", "em_producao", "entregue"];

export type ReceivableStatus = "aberto" | "parcial" | "pago" | "cancelado";

/** Status visual da parcela (não persistido — derivado da data) */
export type InstallmentVisualStatus = "pago" | "atrasado" | "a_vencer" | "cancelado";

export function installmentVisualStatus(
  paidAt: string | null | undefined,
  dueDate: string,
  accountStatus: ReceivableStatus,
): InstallmentVisualStatus {
  if (accountStatus === "cancelado") return "cancelado";
  if (paidAt) return "pago";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + "T00:00:00");
  return due < today ? "atrasado" : "a_vencer";
}

export const INSTALLMENT_STATUS_META: Record<
  InstallmentVisualStatus,
  { label: string; rowClass: string; dotClass: string }
> = {
  pago:      { label: "Pago",      rowClass: "border-l-4 border-l-emerald-500", dotClass: "bg-emerald-500" },
  a_vencer:  { label: "A vencer",  rowClass: "border-l-4 border-l-amber-500",   dotClass: "bg-amber-500" },
  atrasado:  { label: "Atrasado",  rowClass: "border-l-4 border-l-rose-500",    dotClass: "bg-rose-500" },
  cancelado: { label: "Cancelado", rowClass: "border-l-4 border-l-slate-400 opacity-60", dotClass: "bg-slate-400" },
};
