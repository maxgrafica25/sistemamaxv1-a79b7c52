// Simulador de faixas de quantidade (price breaks).
// Fase A: usado em PrintForm e CVForm.
// O form passa uma função `compute(qty)` que retorna { custo_total, preco_total }
// usando sua própria engine — assim o simulador funciona para qualquer tipo de item.

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Plus, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { fmtBRL } from "./pricing";

const STORAGE_KEY = "v3:tier-simulator:tiers";
const DEFAULT_TIERS = [100, 250, 500, 1000];

function loadDefaults(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TIERS;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((n) => typeof n === "number" && n > 0)) {
      return arr.slice(0, 10);
    }
  } catch {
    // ignore
  }
  return DEFAULT_TIERS;
}

function saveDefaults(tiers: number[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tiers));
  } catch {
    // ignore
  }
}

export interface TierResult {
  custo_total: number;
  preco_total: number;
}

interface Props {
  /** Quantidade atual no form — destacada na tabela. */
  currentQty: number;
  /** Função que calcula custo/preço para uma dada quantidade. */
  compute: (qty: number) => TierResult;
  /** Aplica a quantidade selecionada no form pai. */
  onPickQty: (qty: number) => void;
  /** Adiciona todas as faixas como itens agrupados no orçamento. */
  onCloneAsTiers?: (qtys: number[]) => void;
  /** Desabilita o botão (ex.: form incompleto). */
  disabled?: boolean;
  /** Label customizado (default: "Comparar faixas"). */
  label?: string;
}

export function TierSimulator({
  currentQty,
  compute,
  onPickQty,
  onCloneAsTiers,
  disabled,
  label = "Comparar faixas",
}: Props) {
  const [open, setOpen] = useState(false);
  const [tiers, setTiers] = useState<number[]>(() => loadDefaults());
  const [newQty, setNewQty] = useState("");

  useEffect(() => {
    if (open) saveDefaults(tiers);
  }, [tiers, open]);

  const sorted = useMemo(() => [...new Set(tiers)].sort((a, b) => a - b), [tiers]);

  const rows = useMemo(
    () =>
      sorted.map((q, idx) => {
        const r = compute(q);
        const unit = q > 0 ? r.preco_total / q : 0;
        const prevUnit =
          idx > 0
            ? (() => {
                const pq = sorted[idx - 1];
                const pr = compute(pq);
                return pq > 0 ? pr.preco_total / pq : 0;
              })()
            : null;
        const delta = prevUnit && prevUnit > 0 ? ((unit - prevUnit) / prevUnit) * 100 : null;
        return { qty: q, ...r, unit, delta };
      }),
    [sorted, compute],
  );

  const addQty = (q: number) => {
    if (!q || q <= 0) return;
    setTiers((prev) => (prev.includes(q) ? prev : [...prev, q]));
  };

  const removeQty = (q: number) => setTiers((prev) => prev.filter((x) => x !== q));

  const applyMultiplier = (factor: number) => {
    setTiers((prev) =>
      [...new Set(prev.map((q) => Math.max(1, Math.round(q * factor))))].sort(
        (a, b) => a - b,
      ),
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-9 gap-1.5"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[440px] p-0">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-sm font-medium">Comparar faixas de quantidade</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Veja o preço para diferentes volumes sem sair do item.
          </p>
        </div>

        {/* Tabela de faixas */}
        <div className="px-4 py-3 max-h-[320px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-1.5 pr-2">Qtd</th>
                <th className="text-right font-medium py-1.5 px-2">Preço total</th>
                <th className="text-right font-medium py-1.5 px-2">Unitário</th>
                <th className="text-right font-medium py-1.5 pl-2 pr-1">Δ</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isCurrent = r.qty === currentQty;
                return (
                  <tr
                    key={r.qty}
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      isCurrent && "bg-primary/5",
                    )}
                  >
                    <td className="py-1.5 pr-2 font-medium tabular-nums">
                      {r.qty.toLocaleString("pt-BR")}
                      {isCurrent && (
                        <span className="ml-1.5 text-[10px] uppercase text-primary">
                          atual
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {fmtBRL(r.preco_total)}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold">
                      {fmtBRL(r.unit)}
                    </td>
                    <td
                      className={cn(
                        "py-1.5 pl-2 pr-1 text-right tabular-nums",
                        r.delta == null
                          ? "text-muted-foreground"
                          : r.delta < 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : r.delta > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground",
                      )}
                    >
                      {r.delta == null
                        ? "—"
                        : `${r.delta > 0 ? "+" : ""}${r.delta.toFixed(1)}%`}
                    </td>
                    <td className="py-1 pl-1 text-right">
                      <div className="inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            onPickQty(r.qty);
                            setOpen(false);
                          }}
                          className="h-6 px-2 text-[10px] rounded bg-primary text-primary-foreground hover:bg-primary/90"
                          title="Usar esta quantidade"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeQty(r.qty)}
                          className="h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Remover faixa"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-muted-foreground">
                    Nenhuma faixa — adicione abaixo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Adicionar nova faixa */}
        <div className="px-4 py-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addQty(Number(newQty) || 0);
                  setNewQty("");
                }
              }}
              placeholder="Adicionar qtd"
              className="h-8 text-xs"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8"
              onClick={() => {
                addQty(Number(newQty) || 0);
                setNewQty("");
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">
              Presets:
            </span>
            {[
              { label: "Atual", fn: () => addQty(currentQty) },
              { label: "×2", fn: () => applyMultiplier(2) },
              { label: "×5", fn: () => applyMultiplier(5) },
              { label: "+50%", fn: () => applyMultiplier(1.5) },
              { label: "Reset", fn: () => setTiers(DEFAULT_TIERS) },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={p.fn}
                className="text-[10px] px-2 h-6 rounded-full border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
          {onCloneAsTiers && sorted.length >= 2 && (
            <button
              type="button"
              onClick={() => {
                onCloneAsTiers(sorted);
                setOpen(false);
              }}
              className="w-full mt-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold h-8 transition-colors"
              title="Cria um grupo no orçamento com todas as faixas — o cliente escolhe a quantidade no PDF."
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar todas como faixas ({sorted.length})
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
