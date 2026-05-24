import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
      <CardContent className="p-3 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Resumo financeiro
        </p>
        <Row label="Subtotal" value={fmtBRL(summary.subtotal)} />
        <Row label="Impostos" value={fmtBRL(summary.taxValue)} muted />
        <Row label="Taxas" value={fmtBRL(summary.feesValue)} muted />
        <div className="flex items-center justify-between border-t border-border/60 pt-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Total a cobrar
          </span>
          <span className="text-xl font-bold text-primary tabular-nums">
            {fmtBRL(summary.total)}
          </span>
        </div>
        <div
          className={cn(
            "rounded-md border border-border/60 bg-muted/30 px-3 py-1.5 flex items-center justify-between text-xs",
            color,
          )}
        >
          <span className="flex items-center gap-1.5 font-medium">
            {positive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            Margem
          </span>
          <span className="font-bold tabular-nums">
            {summary.marginPct.toFixed(1).replace(".", ",")}%
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={cn("text-xs", muted ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
