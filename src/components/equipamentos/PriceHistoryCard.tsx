import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronDown, Building2, Package } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip as RTooltip } from "recharts";

export interface PurchaseRow {
  id: string;
  change_date: string;
  price: number;
  quantity: number;
  unit_price: number | null;
  supplier: string | null;
  invoice_ref: string | null;
  notes: string | null;
}

interface Props {
  consumableName: string;
  equipmentName?: string;
  basePrice: number;
  basePriceLabel?: string;
  purchases: PurchaseRow[];
  defaultOpen?: boolean;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });

export default function PriceHistoryCard({
  consumableName, equipmentName, basePrice, basePriceLabel = "preço base",
  purchases, defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  // Sort newest first for display
  const sorted = [...purchases].sort(
    (a, b) => new Date(b.change_date).getTime() - new Date(a.change_date).getTime(),
  );
  const last = sorted[0];
  const previous = sorted[1];

  const lastUnit = last?.unit_price ?? (last ? last.price / Math.max(last.quantity || 1, 1) : null);
  const prevUnit = previous?.unit_price ?? (previous ? previous.price / Math.max(previous.quantity || 1, 1) : null);

  const variation =
    lastUnit !== null && prevUnit !== null && prevUnit > 0
      ? ((lastUnit - prevUnit) / prevUnit) * 100
      : null;

  // Best (lowest) historical unit price
  const withUnit = sorted.filter(p => (p.unit_price ?? p.price / Math.max(p.quantity || 1, 1)) > 0);
  const best = withUnit.length > 0
    ? withUnit.reduce((a, b) => {
        const ua = a.unit_price ?? a.price / Math.max(a.quantity || 1, 1);
        const ub = b.unit_price ?? b.price / Math.max(b.quantity || 1, 1);
        return ub < ua ? b : a;
      })
    : null;
  const bestUnit = best ? (best.unit_price ?? best.price / Math.max(best.quantity || 1, 1)) : null;

  const currentUnit = lastUnit ?? basePrice;
  const savingsVsBest = bestUnit !== null && currentUnit > bestUnit ? currentUnit - bestUnit : 0;

  // Sparkline data (oldest -> newest, last 12)
  const sparkData = [...sorted]
    .reverse()
    .slice(-12)
    .map(p => ({
      date: p.change_date,
      v: p.unit_price ?? p.price / Math.max(p.quantity || 1, 1),
    }));

  const variationColor =
    variation === null ? "text-muted-foreground"
      : variation > 0.5 ? "text-destructive"
      : variation < -0.5 ? "text-green-600 dark:text-green-500"
      : "text-muted-foreground";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden border-border/60">
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full text-left hover:bg-muted/40 transition-colors">
            <CardContent className="p-3 sm:p-4">
              {/* Header: name + current price + variation */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-medium text-sm truncate">{consumableName}</span>
                    {equipmentName && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal shrink-0">
                        {equipmentName}
                      </Badge>
                    )}
                  </div>
                  {last && (
                    <div className="mt-1 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>Última: {fmtDate(last.change_date)}</span>
                      {last.supplier && <span>· {last.supplier}</span>}
                      <span>· {last.quantity} un · {fmt(last.price)}</span>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-semibold text-base leading-none">
                    {fmt(currentUnit)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">/un</div>
                  {variation !== null && (
                    <div className={`mt-1 text-[11px] font-medium flex items-center justify-end gap-0.5 ${variationColor}`}>
                      {variation > 0.5 ? <TrendingUp className="h-3 w-3" /> :
                       variation < -0.5 ? <TrendingDown className="h-3 w-3" /> :
                       <Minus className="h-3 w-3" />}
                      {variation > 0 ? "+" : ""}{variation.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>

              {/* Best price badge */}
              {bestUnit !== null && best && (
                <div className="mt-2 flex items-start gap-1.5 text-[11px]">
                  <Trophy className="h-3 w-3 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    Menor: <span className="font-mono font-medium text-foreground">{fmt(bestUnit)}</span>
                    {best.supplier && <> · {best.supplier}</>}
                    {savingsVsBest > 0.01 && (
                      <span className="text-amber-600 dark:text-amber-500 ml-1">
                        — barganhe e economize <span className="font-mono">{fmt(savingsVsBest)}</span>/un
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Sparkline */}
              {sparkData.length >= 2 && (
                <div className="mt-2 h-10 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparkData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                      <YAxis hide domain={["dataMin", "dataMax"]} />
                      <RTooltip
                        cursor={false}
                        content={({ active, payload }) => {
                          if (!active || !payload?.[0]) return null;
                          const d = payload[0].payload as any;
                          return (
                            <div className="rounded-md border bg-popover px-2 py-1 text-[10px] shadow-md">
                              <div className="font-mono font-medium">{fmt(d.v)}</div>
                              <div className="text-muted-foreground">{fmtDate(d.date)}</div>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Footer hint */}
              <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{sorted.length} compra{sorted.length === 1 ? "" : "s"} registrada{sorted.length === 1 ? "" : "s"}</span>
                <span className="flex items-center gap-0.5">
                  {open ? "ocultar" : "ver detalhes"}
                  <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
                </span>
              </div>
            </CardContent>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/60 px-3 sm:px-4 py-3 space-y-1.5 bg-muted/20">
            {sorted.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Nenhuma compra registrada para este consumível ainda.
              </p>
            )}
            {sorted.map((p, idx) => {
              const u = p.unit_price ?? p.price / Math.max(p.quantity || 1, 1);
              const next = sorted[idx + 1];
              const nextU = next ? (next.unit_price ?? next.price / Math.max(next.quantity || 1, 1)) : null;
              const v = nextU !== null && nextU > 0 ? ((u - nextU) / nextU) * 100 : null;
              const isBest = best?.id === p.id;
              return (
                <div
                  key={p.id}
                  className="grid grid-cols-[auto,1fr,auto] gap-2 items-center text-[11px] px-2 py-1.5 rounded hover:bg-background/60"
                >
                  <span className="font-mono text-muted-foreground">{fmtDate(p.change_date)}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate">
                      {isBest && <Trophy className="h-3 w-3 text-amber-500 shrink-0" />}
                      <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{p.supplier || "—"}</span>
                      {p.invoice_ref && (
                        <span className="text-muted-foreground text-[10px] shrink-0">NF {p.invoice_ref}</span>
                      )}
                    </div>
                    {p.notes && (
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{p.notes}</div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-medium">{fmt(u)}<span className="text-muted-foreground">/un</span></div>
                    <div className="text-[10px] text-muted-foreground">
                      {p.quantity} un · {fmt(p.price)}
                      {v !== null && (
                        <span className={
                          " ml-1 " +
                          (v > 0.5 ? "text-destructive" : v < -0.5 ? "text-green-600 dark:text-green-500" : "")
                        }>
                          {v > 0 ? "+" : ""}{v.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
