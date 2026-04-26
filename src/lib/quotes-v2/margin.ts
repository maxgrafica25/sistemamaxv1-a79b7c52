// Profit margin semaphore — color tokens come from index.css.
// Thresholds: <15% red, 15–25% yellow, >25% green.
export type MarginLevel = "low" | "mid" | "high";

export const marginLevel = (pct: number): MarginLevel => {
  if (pct < 15) return "low";
  if (pct <= 25) return "mid";
  return "high";
};

export const marginTextClass = (pct: number): string => {
  const level = marginLevel(pct);
  if (level === "low") return "text-destructive";
  if (level === "mid") return "text-yellow-500";
  return "text-green-500";
};

export const marginLabel = (pct: number): string => {
  const level = marginLevel(pct);
  if (level === "low") return "Baixa";
  if (level === "mid") return "Atenção";
  return "Saudável";
};
