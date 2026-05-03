import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calculator } from "lucide-react";
import { toast } from "sonner";
import {
  recalculateForQuantity,
  type PricingSnapshot,
} from "@/lib/quotes-v2/pricing";
import { optionLabel, type QuoteOption } from "@/lib/quotes-v2/options";

interface Props {
  snapshot: PricingSnapshot;
  options: QuoteOption[];
  onChange: (opts: QuoteOption[]) => void;
  variant?: "full" | "chips";
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function QuoteOptionsBuilder({ snapshot, options, onChange, variant = "full" }: Props) {
  const [newQty, setNewQty] = useState<string>("");

  const addOption = () => {
    const qty = Math.floor(Number(newQty));
    if (!qty || qty < 1) {
      toast.error("Informe uma quantidade válida");
      return;
    }
    if (options.some((o) => o.quantity === qty)) {
      toast.error("Já existe uma opção com essa quantidade");
      return;
    }
    // Reprice via the pure pricing engine (re-tier + dilution of fixed costs)
    const result = recalculateForQuantity(snapshot, qty);
    const opt: QuoteOption = {
      id: crypto.randomUUID(),
      label: optionLabel(qty),
      quantity: qty,
      unit_price: Number(result.unitPrice.toFixed(2)),
      total: Number(result.totalToCharge.toFixed(2)),
    };
    const next = [...options, opt].sort((a, b) => a.quantity - b.quantity);
    onChange(next);
    setNewQty("");
  };

  const removeOption = (id: string) => {
    onChange(options.filter((o) => o.id !== id));
  };

  // Show delta vs smallest option (same logic the buyer perceives)
  const baseUnit = options[0]?.unit_price ?? 0;

  if (variant === "chips") {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          Outras quantidades a cotar (ancoragem)
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          {options.map((opt) => (
            <Badge
              key={opt.id}
              variant="outline"
              className="gap-1.5 py-1 pl-2.5 pr-1 text-xs font-medium"
            >
              {opt.quantity.toLocaleString("pt-BR")} un · {formatBRL(opt.unit_price)}
              <button
                type="button"
                onClick={() => removeOption(opt.id)}
                className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Remover"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="Ex: 500"
              className="h-8 w-24 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption();
                }
              }}
            />
            <Button type="button" size="sm" variant="ghost" onClick={addOption} className="h-8 gap-1 px-2">
              <Plus className="h-3.5 w-3.5" /> add
            </Button>
          </div>
        </div>
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
              O sistema recalcula os custos fixos diluídos e a faixa de markup correta para cada quantidade — o preço unitário cai com volume, como na vida real.
            </p>
          </div>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Nova quantidade</Label>
            <Input
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="Ex: 1000"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption();
                }
              }}
            />
          </div>
          <Button onClick={addOption} className="gap-1.5">
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
