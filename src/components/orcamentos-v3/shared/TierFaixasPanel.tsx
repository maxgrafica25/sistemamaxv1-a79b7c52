// Painel inline de "Faixas adicionais" — substitui o popover TierSimulator
// quando o usuário quer comparar outras quantidades antes de adicionar ao orçamento.
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fmtBRL } from "./pricing";

const STORAGE_KEY = "v3:tier-simulator:tiers";

function loadDefaults(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((n) => typeof n === "number" && n > 0)) {
      return arr.slice(0, 10);
    }
  } catch {
    // ignore
  }
  return [];
}

function saveDefaults(tiers: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tiers));
  } catch {
    // ignore
  }
}

export interface TierFaixasPanelProps {
  currentQty: number;
  /** Função usada para precificar cada quantidade. */
  compute: (qty: number) => { custo_total: number; preco_total: number };
  /** Disabled when form is incomplete. */
  disabled?: boolean;
  /** Faixas extras selecionadas (sem a principal). Notifica o pai a cada mudança. */
  onExtrasChange?: (extras: number[]) => void;
  /** @deprecated não há mais colapso; mantido para compat. */
  defaultOpen?: boolean;
}

export function TierFaixasPanel({
  currentQty,
  compute,
  disabled,
  onExtrasChange,
}: TierFaixasPanelProps) {
  const [extras, setExtras] = useState<number[]>(() =>
    loadDefaults().filter((q) => q !== currentQty),
  );
  const [newQty, setNewQty] = useState("");

  useEffect(() => {
    saveDefaults(extras);
    onExtrasChange?.(extras);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extras]);

  const sortedExtras = useMemo(
    () => [...new Set(extras)].filter((q) => q !== currentQty).sort((a, b) => a - b),
    [extras, currentQty],
  );

  const primary = useMemo(() => {
    const r = compute(currentQty);
    const unit = currentQty > 0 ? r.preco_total / currentQty : 0;
    return { qty: currentQty, ...r, unit };
  }, [compute, currentQty]);

  const rows = useMemo(
    () =>
      sortedExtras.map((q) => {
        const r = compute(q);
        const unit = q > 0 ? r.preco_total / q : 0;
        return { qty: q, ...r, unit };
      }),
    [sortedExtras, compute],
  );

  const addQty = (q: number) => {
    if (!q || q <= 0 || q === currentQty) return;
    setExtras((prev) => (prev.includes(q) ? prev : [...prev, q]));
  };

  const removeQty = (q: number) => setExtras((prev) => prev.filter((x) => x !== q));


  return (
    <div
      className={cn(
        "rounded-md border border-border bg-muted/20 transition-colors",
        disabled && "opacity-50 pointer-events-none",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60">
        <BarChart3 className="h-3.5 w-3.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Faixas adicionais (opcional)
          </p>
          <p className="text-[11px] text-muted-foreground/80 mt-0.5">
            {sortedExtras.length === 0
              ? "Compare preços para outras quantidades — todas entram no mesmo bloco."
              : `${sortedExtras.length} sugest${sortedExtras.length === 1 ? "ão" : "ões"} selecionada${
                  sortedExtras.length === 1 ? "" : "s"
                }`}
          </p>
        </div>
        {sortedExtras.length > 0 && (
          <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
            +{sortedExtras.length}
          </Badge>
        )}
      </div>

      <div className="px-3 pb-3 pt-3 space-y-3">


          {/* Linha principal */}
          <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-primary/[0.05] px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Badge variant="default" className="text-[10px] py-0 px-1.5 h-4 shrink-0">
                Solicitada
              </Badge>
              <span className="text-sm font-semibold tabular-nums text-primary">
                {primary.qty.toLocaleString("pt-BR")} un
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {fmtBRL(primary.unit)} / un
            </span>
            <span className="text-sm font-bold tabular-nums">{fmtBRL(primary.preco_total)}</span>
          </div>

          {/* Sugestões */}
          {rows.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground px-1">
                Sugestões
              </p>
              <ul className="space-y-0.5">
                {rows.map((r) => (
                  <li
                    key={r.qty}
                    className="flex items-center justify-between gap-2 text-xs rounded px-3 py-1.5 hover:bg-background"
                  >
                    <span className="tabular-nums font-medium min-w-[60px]">
                      {r.qty.toLocaleString("pt-BR")} un
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {fmtBRL(r.unit)} / un
                    </span>
                    <span className="font-semibold tabular-nums">{fmtBRL(r.preco_total)}</span>
                    <button
                      type="button"
                      onClick={() => removeQty(r.qty)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title="Remover faixa"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Adicionar faixa — atalhos + campo livre */}
          <div className="rounded-md border border-border bg-background p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">
                Atalhos{" "}
                <span className="text-muted-foreground font-normal">
                  (a partir de {currentQty.toLocaleString("pt-BR")} un)
                </span>
              </p>
              {sortedExtras.length > 0 && (
                <button
                  type="button"
                  onClick={() => setExtras([])}
                  className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-destructive"
                >
                  Limpar todas
                </button>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[-5, 5, 10, 15].map((delta) => {
                const result = currentQty + delta;
                const invalid = result < 1 || result === currentQty;
                const label = delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
                return (
                  <button
                    key={delta}
                    type="button"
                    disabled={invalid}
                    onClick={() => addQty(result)}
                    className={cn(
                      "h-12 rounded-md border flex flex-col items-center justify-center gap-0.5 transition-colors",
                      invalid
                        ? "border-border/50 opacity-40 cursor-not-allowed"
                        : "border-border bg-background hover:bg-primary/5 hover:border-primary/40",
                    )}
                  >
                    <span className="text-sm font-semibold tabular-nums">{label}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {invalid ? "—" : `${result.toLocaleString("pt-BR")} un`}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-border/60 space-y-1.5">
              <p className="text-[11px] text-muted-foreground">ou digite outra quantidade</p>
              <div className="flex items-center gap-2">
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
                  placeholder="Ex: 100"
                  className="h-9 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-9"
                  onClick={() => {
                    addQty(Number(newQty) || 0);
                    setNewQty("");
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
            </div>
        </div>
      </div>

    </div>
  );
}
