import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL, type FinancialSummary } from "../shared/pricing";

interface Props {
  summary: FinancialSummary;
}

export function FinancialPanel({ summary }: Props) {
  const positive = summary.marginPct >= 0;
  const color =
    summary.marginPct < 0
      ? "text-destructive"
      : summary.marginPct < 10
        ? "text-amber-500"
        : "text-emerald-600";
  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-2 space-y-1">
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span>
            Sub {fmtBRL(summary.subtotal)} · Imp {fmtBRL(summary.taxValue)} · Tx {fmtBRL(summary.feesValue)}
          </span>
          <span className={cn("flex items-center gap-0.5 font-medium tabular-nums", color)}>
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {summary.marginPct.toFixed(1).replace(".", ",")}%
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total a cobrar
          </span>
          <span className="text-base font-bold text-primary tabular-nums leading-none">
            {fmtBRL(summary.total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
