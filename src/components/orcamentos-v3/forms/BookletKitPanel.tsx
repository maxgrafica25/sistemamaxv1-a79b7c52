// Painel "Kit Encadernação" — preview com checkboxes e botão Aplicar.
import { useMemo, useState } from "react";
import { Wand2, Check, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { buildBookletKit, type KitRow } from "../shared/bookletKit";
import { useV3Supplies } from "../shared/useV3Supplies";
import { useV3ProcessCatalog } from "../shared/useV3ProcessCatalog";
import { useV3HourlyRate } from "../shared/useV3HourlyRate";
import { fmtBRL } from "../shared/pricing";
import type { V3Item } from "../types";

interface Props {
  bookletPages: number;
  bookletUnits: number;
  defaultMarginPct: number;
  /** Callback que recebe os V3Items prontos (sem o miolo). */
  onApply: (items: V3Item[]) => void;
}

export function BookletKitPanel({
  bookletPages,
  bookletUnits,
  defaultMarginPct,
  onApply,
}: Props) {
  const { supplies, loaded: supLoaded } = useV3Supplies();
  const { steps, loaded: stLoaded } = useV3ProcessCatalog();
  const { hourlyRate } = useV3HourlyRate();
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const { rows, spiralDiameter } = useMemo(
    () =>
      buildBookletKit({
        bookletPages,
        bookletUnits,
        supplies,
        steps,
        hourlyRate,
        defaultMarginPct,
      }),
    [bookletPages, bookletUnits, supplies, steps, hourlyRate, defaultMarginPct],
  );

  const loading = !supLoaded || !stLoaded;

  const toggleRow = (key: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const apply = () => {
    const picked = rows.filter((r) => !excluded.has(r.key));
    if (picked.length === 0) {
      toast.info("Selecione ao menos um item do kit.");
      return;
    }
    const items = picked.map((r) => r.build()) as V3Item[];
    onApply(items);
    const fallbacks = picked.filter((r) => r.fallback).map((r) => r.label);
    if (fallbacks.length > 0) {
      toast.warning(`Kit aplicado (${items.length} itens). Preencher: ${fallbacks.join(", ")}`);
    } else {
      toast.success(
        `Kit aplicado (${items.length} itens)${spiralDiameter ? ` · espiral ${spiralDiameter}` : ""}.`,
      );
    }
  };

  return (
    <div className="rounded-md border border-primary/30 bg-primary/[0.03] p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            Kit Encadernação sugerido
            {spiralDiameter && (
              <span className="ml-1.5 text-xs font-normal text-primary">
                · espiral {spiralDiameter}
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Adiciona capa, contracapa, espiral e mão-de-obra ao orçamento.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Carregando catálogo…</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => {
            const checked = !excluded.has(r.key);
            return (
              <label
                key={r.key}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs cursor-pointer transition-colors",
                  checked
                    ? "bg-background hover:bg-muted/50"
                    : "opacity-50 hover:opacity-75",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleRow(r.key)}
                  className="h-3.5 w-3.5"
                />
                <span className="flex-1 min-w-0 truncate font-medium">{r.label}</span>
                <span className="text-muted-foreground text-[10.5px] truncate max-w-[180px] hidden sm:inline">
                  {r.description}
                </span>
                <span className="text-muted-foreground tabular-nums text-[10.5px]">
                  {r.unit === "un"
                    ? `${r.qty} un`
                    : `${r.qty.toFixed(0)} min`}
                </span>
                <span className="font-semibold tabular-nums w-[70px] text-right">
                  {fmtBRL(r.cost)}
                </span>
                {r.fallback && (
                  <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                )}
              </label>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-[10px] text-muted-foreground">
          {rows.some((r) => r.fallback) && (
            <>
              <AlertCircle className="inline h-3 w-3 mr-1 text-amber-500" />
              Itens em amarelo não foram encontrados no cadastro.
            </>
          )}
        </p>
        <Button size="sm" onClick={apply} disabled={loading} className="h-8 text-xs">
          <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Aplicar Kit
        </Button>
      </div>
    </div>
  );
}
