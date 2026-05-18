import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calculator, Zap, Check } from "lucide-react";
import { toast } from "sonner";
import {
  recalculateForQuantity,
  type PricingSnapshot,
} from "@/lib/quotes-v2/pricing";
import { optionLabel, type QuoteOption } from "@/lib/quotes-v2/options";
import { niceRoundQty } from "@/lib/quotes-v2/options-pricing";
import { cn } from "@/lib/utils";

export interface RecalcFn {
  (qty: number): { unitPrice: number; total: number };
}

interface Props {
  snapshot: PricingSnapshot;
  options: QuoteOption[];
  onChange: (opts: QuoteOption[]) => void;
  variant?: "full" | "chips";
  /** Quantidade base do orçamento (para os atalhos ½×, 2×, 3×, 5×). */
  baseQuantity?: number;
  /** Recálculo customizado (impressão + CV + acabamentos). Se ausente, usa só impressão. */
  recalcForQuantity?: RecalcFn;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SHORTCUTS: Array<{ label: string; factor: number }> = [
  { label: "½×", factor: 0.5 },
  { label: "2×", factor: 2 },
  { label: "3×", factor: 3 },
  { label: "5×", factor: 5 },
];

export function QuoteOptionsBuilder({
  snapshot,
  options,
  onChange,
  variant = "full",
  baseQuantity = 1,
  recalcForQuantity,
}: Props) {
  const [newQty, setNewQty] = useState<string>("");

  const recalc: RecalcFn = recalcForQuantity ?? ((qty: number) => {
    const r = recalculateForQuantity(snapshot, qty);
    return { unitPrice: r.unitPrice, total: r.totalToCharge };
  });

  const buildOption = (qty: number): QuoteOption => {
    const r = recalc(qty);
    return {
      id: crypto.randomUUID(),
      label: optionLabel(qty),
      quantity: qty,
      unit_price: Number(r.unitPrice.toFixed(2)),
      total: Number(r.total.toFixed(2)),
    };
  };

  const addOption = (rawQty: number) => {
    const qty = Math.floor(rawQty);
    if (!qty || qty < 1) {
      toast.error("Informe uma quantidade válida");
      return;
    }
    if (options.some((o) => o.quantity === qty)) {
      toast.error(`Já existe uma opção com ${qty} unidades`);
      return;
    }
    const next = [...options, buildOption(qty)].sort((a, b) => a.quantity - b.quantity);
    onChange(next);
  };

  const removeOption = (id: string) => {
    onChange(options.filter((o) => o.id !== id));
  };

  const removeByQuantity = (qty: number) => {
    onChange(options.filter((o) => o.quantity !== qty));
  };

  // Sugestões inteligentes
  const shortcuts = useMemo(() => {
    const base = Math.max(1, Math.floor(baseQuantity));
    return SHORTCUTS.map((s) => {
      const target = niceRoundQty(base * s.factor);
      return { ...s, target };
    }).filter((s, idx, arr) =>
      s.target !== base && arr.findIndex((x) => x.target === s.target) === idx,
    );
  }, [baseQuantity]);

  const isActive = (qty: number) => options.some((o) => o.quantity === qty);

  const baseUnit = options[0]?.unit_price ?? 0;

  if (variant === "chips") {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-primary" />
            Outras quantidades p/ comparar
          </Label>
          {baseQuantity > 0 && (
            <span className="text-[11px] text-muted-foreground">
              · base {baseQuantity.toLocaleString("pt-BR")}
            </span>
          )}
        </div>

        {/* Atalhos ½×, 2×, 3×, 5× */}
        {shortcuts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {shortcuts.map((s) => {
              const active = isActive(s.target);
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => (active ? removeByQuantity(s.target) : addOption(s.target))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-dashed border-border bg-background hover:border-primary hover:bg-primary/5",
                  )}
                  aria-pressed={active}
                >
                  {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  <span className="opacity-70">{s.label}</span>
                  <span>{s.target.toLocaleString("pt-BR")}</span>
                </button>
              );
            })}
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={1}
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
                placeholder="Outra qty"
                className="h-7 w-24 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const q = Math.floor(Number(newQty));
                    if (q > 0) {
                      addOption(q);
                      setNewQty("");
                    }
                  }
                }}
              />
            </div>
          </div>
        )}

        {/* Lista compacta das opções ativas */}
        {options.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {options.map((opt) => {
              const delta = baseUnit > 0 ? ((opt.unit_price - baseUnit) / baseUnit) * 100 : 0;
              const cheaper = delta < -0.5;
              return (
                <Badge
                  key={opt.id}
                  variant="outline"
                  className="gap-1.5 py-1 pl-2.5 pr-1 text-xs font-medium"
                >
                  {opt.quantity.toLocaleString("pt-BR")} un · {formatBRL(opt.unit_price)}
                  {cheaper && (
                    <span className="text-green-600 text-[10px]">{delta.toFixed(0)}%</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeOption(opt.id)}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
        {options.length === 0 && (
          <p className="text-[11px] text-muted-foreground">
            Adicione com 1 clique nos atalhos acima.
          </p>
        )}
      </div>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              Opções de quantidade (ancoragem)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              O sistema recalcula impressão, CV e acabamentos para cada quantidade — o preço unitário cai com volume.
            </p>
          </div>
        </div>

        {/* Atalhos */}
        {shortcuts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {shortcuts.map((s) => {
              const active = isActive(s.target);
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => (active ? removeByQuantity(s.target) : addOption(s.target))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-dashed border-border hover:border-primary hover:bg-primary/5",
                  )}
                >
                  {active ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  <span className="opacity-70">{s.label}</span>
                  <span>{s.target.toLocaleString("pt-BR")}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Quantidade personalizada</Label>
            <Input
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="Ex: 1000"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const q = Math.floor(Number(newQty));
                  if (q > 0) { addOption(q); setNewQty(""); }
                }
              }}
            />
          </div>
          <Button
            onClick={() => {
              const q = Math.floor(Number(newQty));
              if (q > 0) { addOption(q); setNewQty(""); }
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>

        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma opção adicionada. O orçamento será enviado com valor único.
          </p>
        ) : (
          <div className="space-y-2">
            {options.map((opt) => {
              const delta = baseUnit > 0 ? ((opt.unit_price - baseUnit) / baseUnit) * 100 : 0;
              const isCheaper = delta < -0.5;
              return (
                <div
                  key={opt.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                >
                  <Badge variant="outline" className="font-semibold">{opt.label}</Badge>
                  <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Unitário: </span>
                      <span className="font-semibold">{formatBRL(opt.unit_price)}</span>
                      {isCheaper && (
                        <span className="text-green-600 text-xs ml-1">
                          ({delta.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                    <div className="text-right sm:text-left">
                      <span className="text-muted-foreground text-xs">Total: </span>
                      <span className="font-semibold text-primary">{formatBRL(opt.total)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeOption(opt.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
