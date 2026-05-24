// Painel inline de "Faixas de quantidade" — minimalista, sem caixas pesadas.
import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fmtBRL } from "./pricing";


export interface TierFaixasPanelProps {
  currentQty: number;
  compute: (qty: number) => { custo_total: number; preco_total: number };
  disabled?: boolean;
  onExtrasChange?: (extras: number[]) => void;
  /** @deprecated */
  defaultOpen?: boolean;
}

export function TierFaixasPanel({
  currentQty,
  compute,
  disabled,
  onExtrasChange,
}: TierFaixasPanelProps) {
  const [extras, setExtras] = useState<number[]>([]);
  const [newQty, setNewQty] = useState("");

  useEffect(() => {
    onExtrasChange?.(extras);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extras]);

  const sortedExtras = useMemo(
    () => [...new Set(extras)].filter((q) => q !== currentQty).sort((a, b) => a - b),
    [extras, currentQty],
  );

  const rows = useMemo(() => {
    const all = [
      { qty: currentQty, primary: true as const },
      ...sortedExtras.map((q) => ({ qty: q, primary: false as const })),
    ].sort((a, b) => a.qty - b.qty);
    return all.map((r) => {
      const p = compute(r.qty);
      const unit = r.qty > 0 ? p.preco_total / r.qty : 0;
      return { ...r, ...p, unit };
    });
  }, [sortedExtras, compute, currentQty]);

  const addQty = (q: number) => {
    if (!q || q <= 0 || q === currentQty) return;
    setExtras((prev) => (prev.includes(q) ? prev : [...prev, q]));
  };

  const removeQty = (q: number) =>
    setExtras((prev) => prev.filter((x) => x !== q));

  const multipliers = [2, 3, 5, 10];

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border border-primary/30 bg-primary/[0.03] px-3 py-2.5",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
          Faixas de quantidade
        </p>
        {sortedExtras.length > 0 && (
          <button
            type="button"
            onClick={() => setExtras([])}
            className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-destructive"
          >
            Limpar
          </button>
        )}
      </div>

      <ul className="space-y-0.5">
        {rows.map((r, i) => {
          const isFirstSuggestion = !r.primary && rows[i - 1]?.primary;
          return (
            <li
              key={r.qty}
              className={cn(
                "flex items-center gap-3 px-2 py-1.5 text-sm rounded",
                isFirstSuggestion && "mt-0.5",
                r.primary ? "bg-background" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "tabular-nums flex items-center gap-2 min-w-[120px]",
                  r.primary && "font-semibold text-primary",
                )}
              >
                {r.qty.toLocaleString("pt-BR")} un
                {r.primary && (
                  <span className="text-[10px] uppercase tracking-wide text-primary/70 font-medium">
                    · solicitada
                  </span>
                )}
              </span>
              <span className="tabular-nums text-xs flex-1 text-right">
                {fmtBRL(r.unit)} / un
              </span>
              <span
                className={cn(
                  "tabular-nums min-w-[90px] text-right",
                  r.primary ? "font-bold text-foreground" : "font-medium",
                )}
              >
                {fmtBRL(r.preco_total)}
              </span>
              {!r.primary ? (
                <button
                  type="button"
                  onClick={() => removeQty(r.qty)}
                  className="text-muted-foreground/60 hover:text-destructive shrink-0"
                  title="Remover faixa"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="w-3.5 shrink-0" />
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/40">
        {multipliers.map((mult) => {
          const result = currentQty * mult;
          const invalid =
            result < 1 || result === currentQty || extras.includes(result);
          const label = `×${mult}`;
          return (
            <button
              key={mult}
              type="button"
              disabled={invalid}
              onClick={() => addQty(result)}
              className={cn(
                "rounded-full border border-border/60 bg-background px-2.5 py-0.5 text-xs tabular-nums transition-colors",
                invalid
                  ? "opacity-30 cursor-not-allowed"
                  : "text-muted-foreground hover:border-primary/60 hover:text-primary hover:bg-primary/5",
              )}
              title={
                invalid
                  ? "Faixa inválida ou já adicionada"
                  : `Adicionar ${result.toLocaleString("pt-BR")} un`
              }
            >
              {label}
            </button>
          );
        })}

        <span className="h-4 w-px bg-border/60 mx-1" aria-hidden />

        <div className="flex items-center gap-1.5 ml-auto">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Outra:
          </Label>
          <Input
            type="number"
            min={1}
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addQty(Number(newQty) || 0);
                setNewQty("");
              }
            }}
            placeholder="ex: 250"
            className="h-7 w-24 text-xs px-2 bg-background"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-7 px-2"
            onClick={() => {
              addQty(Number(newQty) || 0);
              setNewQty("");
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

