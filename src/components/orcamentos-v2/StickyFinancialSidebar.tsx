import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { marginLevel, marginTextClass, marginLabel } from "@/lib/quotes-v2/margin";
import { cn } from "@/lib/utils";

interface Props {
  totalCost: number;
  totalToCharge: number;
  marginPct: number;
  profit: number;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const MarginIcon = ({ pct }: { pct: number }) => {
  const lvl = marginLevel(pct);
  if (lvl === "low") return <TrendingDown className="h-4 w-4" />;
  if (lvl === "mid") return <Minus className="h-4 w-4" />;
  return <TrendingUp className="h-4 w-4" />;
};

/**
 * Sticky financial sidebar.
 * - Desktop: lateral fixed right column (parent layouts as flex)
 * - Mobile: fixed bottom expandable bar
 */
export function StickyFinancialSidebar({ totalCost, totalToCharge, marginPct, profit }: Props) {
  const [open, setOpen] = useState(false);
  const colorCls = marginTextClass(marginPct);

  const Body = (
    <div className="space-y-3 text-sm">
      <Row label="Custo total" value={formatBRL(totalCost)} muted />
      <Row label="Lucro estimado" value={formatBRL(profit)} className={colorCls} />
      <div className="pt-2 border-t border-border">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Margem</p>
        <div className={cn("flex items-center gap-2 text-2xl font-bold", colorCls)}>
          <MarginIcon pct={marginPct} />
          <span>{Math.abs(marginPct) < 0.05 ? "0,0" : marginPct.toFixed(1).replace(".", ",")}%</span>
          <span className="text-xs font-medium ml-auto">{marginLabel(marginPct)}</span>
        </div>
      </div>
      <div className="pt-3 border-t border-border">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
          Valor a cobrar
        </p>
        <p className="text-2xl font-bold text-primary">{formatBRL(totalToCharge)}</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sticky right rail */}
      <aside className="hidden lg:block w-[300px] shrink-0">
        <Card className="sticky top-4 shadow-sm border-border/60">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-4">
              Resumo financeiro
            </p>
            {Body}
          </CardContent>
        </Card>
      </aside>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 gap-3"
        >
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Valor a cobrar
            </span>
            <span className="text-base font-bold text-primary truncate">
              {formatBRL(totalToCharge)}
            </span>
          </div>
          <div className={cn("flex items-center gap-1.5 text-sm font-semibold", colorCls)}>
            <MarginIcon pct={marginPct} />
            <span>{Math.abs(marginPct) < 0.05 ? "0,0" : marginPct.toFixed(1).replace(".", ",")}%</span>
          </div>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {open && <div className="px-4 pb-4">{Body}</div>}
      </div>
    </>
  );
}

function Row({
  label, value, muted, className,
}: { label: string; value: string; muted?: boolean; className?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className={cn("text-xs", muted ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
      <span className={cn("text-sm font-semibold", className)}>{value}</span>
    </div>
  );
}
