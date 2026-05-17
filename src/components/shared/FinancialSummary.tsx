import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface FinancialLine {
  label: string;
  value: number;
  type?: "cost" | "profit" | "neutral";
  sub?: string;
  bold?: boolean;
  divider?: boolean;
}

interface Props {
  title?: string;
  lines: FinancialLine[];
  totalLabel?: string;
  totalValue?: number;
  profitValue?: number;
  profitPct?: number;
  className?: string;
}

export function FinancialSummary({
  title = "Resumo Financeiro",
  lines,
  totalLabel,
  totalValue,
  profitValue,
  profitPct,
  className,
}: Props) {
  return (
    <Card className={cn("shadow-card sticky top-4", className)}>
      <CardContent className="p-4 space-y-3">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{title}</div>
        <div className="space-y-1.5">
          {lines.map((l, i) => (
            <div key={i}>
              {l.divider && <div className="border-t border-border/60 my-2" />}
              <div className={cn("flex items-center justify-between text-sm", l.bold && "font-semibold")}>
                <span className={cn(
                  "text-muted-foreground",
                  l.type === "cost" && "text-destructive/80",
                  l.type === "profit" && "text-green-600",
                  l.bold && "text-foreground",
                )}>
                  {l.type === "cost" && <span className="mr-1">(–)</span>}
                  {l.type === "profit" && <span className="mr-1">(+)</span>}
                  {l.label}
                </span>
                <span className={cn(
                  "tabular-nums",
                  l.type === "cost" && "text-destructive",
                  l.type === "profit" && "text-green-600 font-medium",
                  l.bold && "text-foreground",
                )}>
                  {fmt(l.value)}
                </span>
              </div>
              {l.sub && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{l.sub}</div>}
            </div>
          ))}
        </div>
        {totalLabel != null && totalValue != null && (
          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{totalLabel}</span>
              <span className="text-xl font-bold text-primary tabular-nums">{fmt(totalValue)}</span>
            </div>
          </div>
        )}
        {profitValue != null && (
          <div className="rounded-md bg-green-500/10 px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-700 dark:text-green-400 font-medium flex items-center gap-1">
                {profitValue >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                Lucro Líquido
              </span>
              <div className="text-right">
                <div className="text-sm font-bold text-green-700 dark:text-green-400 tabular-nums">{fmt(profitValue)}</div>
                {profitPct != null && (
                  <div className="text-[11px] text-green-700/80 dark:text-green-400/80">
                    {profitPct >= 0 ? "+" : ""}{profitPct.toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
