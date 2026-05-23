import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, ChevronDown, Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { priceOf, roundUp10 } from "../shared/pricing";
import { cn } from "@/lib/utils";
import { genId, type QuoteOptionV3, type V3Item } from "../types";

interface Props {
  items: V3Item[];
  mainQuantity: number | null | undefined;
  options: QuoteOptionV3[] | undefined;
  onChange: (next: { main_quantity: number; options: QuoteOptionV3[] }) => void;
}

const SHORTCUTS: Array<{ label: string; factor: number }> = [
  { label: "½×", factor: 0.5 },
  { label: "2×", factor: 2 },
  { label: "3×", factor: 3 },
  { label: "5×", factor: 5 },
];

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const niceRound = (n: number) => {
  if (n < 10) return Math.max(1, Math.round(n));
  if (n < 100) return Math.round(n / 5) * 5;
  if (n < 1000) return Math.round(n / 50) * 50;
  return Math.round(n / 100) * 100;
};

/** Multiplica a quantidade efetiva de cada item por `factor` e soma priceOf(item). */
const totalForFactor = (items: V3Item[], factor: number): number => {
  if (factor === 1) {
    return roundUp10(items.reduce((s, it) => s + priceOf(it).preco_total, 0));
  }
  let sum = 0;
  for (const it of items) {
    if (it.kind === "labor") {
      sum += priceOf(it).preco_total;
      continue;
    }
    if (it.kind === "cv" && it.snapshot && it.snapshot.preco_total > 0) {
      // Aproximação linear (CV tem mínimos; bom o bastante p/ ancoragem).
      sum += it.snapshot.preco_total * factor;
      continue;
    }
    if (it.kind === "label") {
      sum += (it.preco_total || 0) * factor;
      continue;
    }
    const scaled: V3Item = (() => {
      switch (it.kind) {
        case "print":
        case "cv":
        case "third":
        case "supply":
          return { ...it, quantidade: Math.max(1, Math.round((it.quantidade || 1) * factor)) };
        case "booklet":
          return { ...it, bookletUnits: Math.max(1, Math.round((it.bookletUnits || 1) * factor)) };
        default:
          return it;
      }
    })();
    sum += priceOf(scaled).preco_total;
  }
  return roundUp10(sum);
};

export function QuoteOptionsBuilderV3({ items, mainQuantity, options, onChange }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [newQty, setNewQty] = useState("");

  // Auto-detecta main_quantity quando não está definida (maior qty dos itens).
  const detectedBase = useMemo(() => {
    let max = 1;
    for (const it of items) {
      const q =
        it.kind === "labor" ? 0 :
        it.kind === "booklet" ? (it.bookletUnits || 0) :
        it.kind === "label" ? (it.quantidade || 0) :
        (it as { quantidade?: number }).quantidade || 0;
      if (q > max) max = q;
    }
    return max;
  }, [items]);

  const base = mainQuantity && mainQuantity > 0 ? mainQuantity : detectedBase;
  const opts = options ?? [];

  // Recalcula totais das opções existentes quando os itens mudam.
  useEffect(() => {
    if (opts.length === 0) return;
    let dirty = false;
    const next = opts.map((o) => {
      const factor = base > 0 ? o.quantity / base : 1;
      const total = totalForFactor(items, factor);
      const unit_price = o.quantity > 0 ? roundUp10(total / o.quantity) : 0;
      if (Math.abs(total - o.total) > 0.001 || Math.abs(unit_price - o.unit_price) > 0.001) {
        dirty = true;
        return { ...o, total, unit_price };
      }
      return o;
    });
    if (dirty) onChange({ main_quantity: base, options: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, base]);

  const buildOption = (qty: number): QuoteOptionV3 => {
    const factor = base > 0 ? qty / base : 1;
    const total = totalForFactor(items, factor);
    return {
      id: genId(),
      label: `${qty.toLocaleString("pt-BR")} ${qty === 1 ? "unidade" : "unidades"}`,
      quantity: qty,
      unit_price: qty > 0 ? roundUp10(total / qty) : 0,
      total,
    };
  };

  const addOption = (rawQty: number) => {
    const qty = Math.floor(rawQty);
    if (!qty || qty < 1) return toast.error("Informe uma quantidade válida.");
    if (opts.some((o) => o.quantity === qty)) return toast.error(`Já existe opção de ${qty}.`);
    const next = [...opts, buildOption(qty)].sort((a, b) => a.quantity - b.quantity);
    onChange({ main_quantity: base, options: next });
  };

  const removeOption = (id: string) =>
    onChange({ main_quantity: base, options: opts.filter((o) => o.id !== id) });
  const removeByQty = (qty: number) =>
    onChange({ main_quantity: base, options: opts.filter((o) => o.quantity !== qty) });

  const shortcuts = useMemo(() => {
    return SHORTCUTS.map((s) => ({ ...s, target: niceRound(base * s.factor) }))
      .filter((s, idx, arr) =>
        s.target !== base && arr.findIndex((x) => x.target === s.target) === idx,
      );
  }, [base]);

  const isActive = (qty: number) => opts.some((o) => o.quantity === qty);

  if (items.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/[0.02]">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium"
      >
        <Layers className="h-4 w-4 text-primary" />
        <span>Opções A/B/C</span>
        {opts.length > 0 && <Badge variant="secondary" className="ml-1">{opts.length}</Badge>}
        <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Base atual: <b>{base.toLocaleString("pt-BR")}</b>. As opções recalculam o total proporcionalmente.
          </p>

          {shortcuts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {shortcuts.map((s) => {
                const active = isActive(s.target);
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => (active ? removeByQty(s.target) : addOption(s.target))}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-dashed border-border hover:border-primary hover:bg-primary/5",
                    )}
                  >
                    {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    <span className="opacity-70">{s.label}</span>
                    <span>{s.target.toLocaleString("pt-BR")}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-1.5">
            <Input
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="Outra qty"
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const q = Math.floor(Number(newQty));
                  if (q > 0) { addOption(q); setNewQty(""); }
                }
              }}
            />
            <Button
              size="sm"
              className="h-8"
              onClick={() => {
                const q = Math.floor(Number(newQty));
                if (q > 0) { addOption(q); setNewQty(""); }
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          {opts.length > 0 && (
            <div className="space-y-1.5">
              {opts.map((o) => {
                const baseUnit = opts[0]?.unit_price ?? 0;
                const delta = baseUnit > 0 ? ((o.unit_price - baseUnit) / baseUnit) * 100 : 0;
                return (
                  <div key={o.id} className="flex items-center gap-2 rounded-md border bg-background p-2 text-xs">
                    <Badge variant="outline" className="font-semibold">{o.quantity.toLocaleString("pt-BR")}</Badge>
                    <div className="flex-1 min-w-0">
                      <div>
                        <span className="text-muted-foreground">Un: </span>
                        <span className="font-semibold">{fmtBRL(o.unit_price)}</span>
                        {delta < -0.5 && (
                          <span className="text-green-600 ml-1">({delta.toFixed(0)}%)</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total: </span>
                        <span className="font-semibold text-primary">{fmtBRL(o.total)}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeOption(o.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
