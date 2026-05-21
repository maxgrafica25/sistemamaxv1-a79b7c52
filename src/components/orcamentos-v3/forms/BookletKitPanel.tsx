// Painel "Kit Encadernação" — preview com checkboxes + capa/contracapa personalizada.
import { useMemo, useState } from "react";
import { Wand2, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { buildBookletKit, type KitRow, type KitRowKind } from "../shared/bookletKit";
import { useV3Supplies } from "../shared/useV3Supplies";
import { useV3ProcessCatalog } from "../shared/useV3ProcessCatalog";
import { useV3HourlyRate } from "../shared/useV3HourlyRate";
import { fmtBRL } from "../shared/pricing";
import { CustomCoverEditor } from "./CustomCoverEditor";
import type { V3Item, V3PrintItem } from "../types";

interface Props {
  bookletPages: number;
  bookletUnits: number;
  defaultMarginPct: number;
  /** Callback que recebe os V3Items prontos (sem o miolo). */
  onApply: (items: V3Item[]) => void;
}

type CoverMode = "standard" | "custom";

export function BookletKitPanel({
  bookletPages,
  bookletUnits,
  defaultMarginPct,
  onApply,
}: Props) {
  const { supplies, loaded: supLoaded } = useV3Supplies();
  const { steps, loaded: stLoaded } = useV3ProcessCatalog();
  const { hourlyRate } = useV3HourlyRate();
  const [excluded, setExcluded] = useState<Set<KitRowKind>>(new Set());

  const [coverMode, setCoverMode] = useState<CoverMode>("standard");
  const [backCoverMode, setBackCoverMode] = useState<CoverMode>("standard");
  const [customCover, setCustomCover] = useState<V3PrintItem | null>(null);
  const [customBackCover, setCustomBackCover] = useState<V3PrintItem | null>(null);

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

  const toggleRow = (key: KitRowKind) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const apply = () => {
    const items: V3Item[] = [];
    const fallbacks: string[] = [];

    for (const r of rows) {
      if (excluded.has(r.key)) continue;
      if (r.key === "capa" && coverMode === "custom") {
        if (!customCover) {
          toast.error("Configure a capa personalizada (escolha o papel).");
          return;
        }
        items.push(customCover);
        continue;
      }
      if (r.key === "contracapa" && backCoverMode === "custom") {
        if (!customBackCover) {
          toast.error("Configure a contracapa personalizada (escolha o papel).");
          return;
        }
        items.push(customBackCover);
        continue;
      }
      items.push(r.build() as V3Item);
      if (r.fallback) fallbacks.push(r.label);
    }

    if (items.length === 0) {
      toast.info("Selecione ao menos um item do kit.");
      return;
    }

    onApply(items);
    if (fallbacks.length > 0) {
      toast.warning(`Kit aplicado (${items.length} itens). Preencher: ${fallbacks.join(", ")}`);
    } else {
      toast.success(
        `Kit aplicado (${items.length} itens)${spiralDiameter ? ` · espiral ${spiralDiameter}` : ""}.`,
      );
    }
  };

  const renderRow = (r: KitRow) => {
    const checked = !excluded.has(r.key);
    const isCover = r.key === "capa";
    const isBack = r.key === "contracapa";
    const mode = isCover ? coverMode : isBack ? backCoverMode : "standard";
    const setMode = isCover ? setCoverMode : isBack ? setBackCoverMode : null;
    const showCustomBlock =
      checked && ((isCover && coverMode === "custom") || (isBack && backCoverMode === "custom"));

    return (
      <div key={r.key} className={cn("rounded-sm transition-colors", !checked && "opacity-50")}>
        <label
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer",
            checked ? "bg-background hover:bg-muted/50" : "hover:opacity-75",
          )}
        >
          <Checkbox
            checked={checked}
            onCheckedChange={() => toggleRow(r.key)}
            className="h-3.5 w-3.5"
          />
          <span className="font-medium whitespace-nowrap">{r.label}</span>

          {setMode && (
            <Tabs
              value={mode}
              onValueChange={(v) => setMode(v as CoverMode)}
              className="ml-1"
            >
              <TabsList className="h-6 p-0.5">
                <TabsTrigger value="standard" className="h-5 px-2 text-[10px]">
                  Padrão
                </TabsTrigger>
                <TabsTrigger value="custom" className="h-5 px-2 text-[10px]">
                  Personalizada
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {mode === "standard" && (
            <>
              <span className="flex-1 text-muted-foreground text-[10.5px] truncate hidden sm:inline">
                {r.description}
              </span>
              <span className="text-muted-foreground tabular-nums text-[10.5px]">
                {r.unit === "un" ? `${r.qty} un` : `${r.qty.toFixed(0)} min`}
              </span>
              <span className="font-semibold tabular-nums w-[70px] text-right">
                {fmtBRL(r.cost)}
              </span>
              {r.fallback && (
                <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
              )}
            </>
          )}
          {mode === "custom" && (
            <span className="flex-1 text-[10.5px] text-muted-foreground italic">
              Impressão personalizada (Couchê + laminação, etc.)
            </span>
          )}
        </label>

        {showCustomBlock && (
          <CustomCoverEditor
            units={Math.max(1, bookletUnits)}
            slotLabel={isCover ? "Capa frontal" : "Contracapa"}
            onChange={isCover ? setCustomCover : setCustomBackCover}
          />
        )}
      </div>
    );
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
            Capa/Contracapa podem ser padrão (suprimento) ou personalizadas (impressão + acabamento).
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Carregando catálogo…</p>
      ) : (
        <div className="space-y-1.5">{rows.map(renderRow)}</div>
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
