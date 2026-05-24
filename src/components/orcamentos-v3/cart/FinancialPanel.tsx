import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL, type FinancialSummary } from "../shared/pricing";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const regimeLabel = summary.regime === "por_dentro" ? "Por dentro" : "Por fora";
  const regimeTooltip = summary.regime === "por_dentro"
    ? "Impostos, taxas e margem embutidos no preço (divisor). Margem real = margem configurada."
    : "Margem aplicada sobre o custo. Impostos e taxas saem da margem (margem real < nominal).";
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
        <div className="flex items-center justify-between gap-2">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide cursor-help",
                  summary.regime === "por_dentro"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}>
                  <Info className="h-2.5 w-2.5" />
                  {regimeLabel}
                  {summary.regimeFallback ? " ⚠" : ""}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                <p className="font-medium mb-1">Regime: {regimeLabel}</p>
                <p className="text-muted-foreground">{regimeTooltip}</p>
                {summary.regimeFallback && (
                  <p className="mt-1 text-destructive">
                    ⚠ Soma de impostos + taxas + margem ≥ 100%. Caiu para "por fora".
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="text-base font-bold text-primary tabular-nums leading-none">
            {fmtBRL(summary.total)}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-0.5">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Total a cobrar
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
