// Painel "Kit Encadernação" — preview com checkboxes + capa/contracapa personalizada.
import { useMemo, useState, useEffect } from "react";
import { Wand2, AlertCircle, Sparkles, Pencil, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const [coverCollapsed, setCoverCollapsed] = useState(false);
  const [backCoverCollapsed, setBackCoverCollapsed] = useState(false);

  type ExtraSlot = {
    id: string;
    label: string;
    item: V3PrintItem | null;
    collapsed: boolean;
  };
  const [extraSlots, setExtraSlots] = useState<ExtraSlot[]>([]);

  const updateSlot = (id: string, patch: Partial<ExtraSlot>) =>
    setExtraSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const removeSlot = (id: string) =>
    setExtraSlots((prev) => prev.filter((s) => s.id !== id));
  const addSlot = () =>
    setExtraSlots((prev) => [
      ...prev,
      {
        id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: "",
        item: null,
        collapsed: false,
      },
    ]);

  // Auto-colapsa quando o item personalizado fica pronto
  useEffect(() => {
    if (coverMode === "custom" && customCover) setCoverCollapsed(true);
  }, [customCover, coverMode]);
  useEffect(() => {
    if (backCoverMode === "custom" && customBackCover) setBackCoverCollapsed(true);
  }, [customBackCover, backCoverMode]);
  useEffect(() => {
    setExtraSlots((prev) =>
      prev.map((s) => (s.item && !s.collapsed ? { ...s, collapsed: true } : s)),
    );
  }, [extraSlots.map((s) => (s.item ? s.id : "")).join("|")]);

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

  const hasAnyCustom =
    (coverMode === "custom" && !excluded.has("capa")) ||
    (backCoverMode === "custom" && !excluded.has("contracapa")) ||
    extraSlots.length > 0;



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

    // Slots livres de acabamento personalizado
    for (const s of extraSlots) {
      if (!s.item) {
        toast.error(
          `Configure o acabamento "${s.label.trim() || "personalizado"}" (escolha o papel).`,
        );
        return;
      }
      const labeled = s.label.trim()
        ? { ...s.item, descricao: s.label.trim() }
        : s.item;
      items.push(labeled);
    }

    if (items.length === 0) {
      toast.info("Adicione ao menos um acabamento ou item do kit.");
      return;
    }

    onApply(items);
    const headline = hasAnyCustom ? "Acabamentos aplicados" : "Kit aplicado";
    if (fallbacks.length > 0) {
      toast.warning(`${headline} (${items.length} itens). Preencher: ${fallbacks.join(", ")}`);
    } else {
      toast.success(
        `${headline} (${items.length} itens)${spiralDiameter && !hasAnyCustom ? ` · espiral ${spiralDiameter}` : ""}.`,
      );
    }
  };

  const handleModeChange = (isCover: boolean, v: CoverMode) => {
    if (isCover) {
      setCoverMode(v);
      if (v === "standard") {
        setCustomCover(null);
        setCoverCollapsed(false);
      }
    } else {
      setBackCoverMode(v);
      if (v === "standard") {
        setCustomBackCover(null);
        setBackCoverCollapsed(false);
      }
    }
  };

  const renderCustomSummary = (item: V3PrintItem, onEdit: () => void) => (
    <div className="mt-1.5 ml-6 rounded-md border border-primary/30 bg-primary/[0.05] px-2.5 py-1.5 flex items-center gap-2">
      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
      <span className="text-[11px] text-foreground flex-1 truncate">
        {item.descricao}
      </span>
      <span className="text-[11px] font-semibold text-primary tabular-nums">
        {fmtBRL(item.valor_unitario * item.quantidade)}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={onEdit}
        className="h-6 px-2 text-[10.5px] text-primary hover:text-primary"
      >
        <Pencil className="h-3 w-3 mr-1" /> Editar
      </Button>
    </div>
  );

  const renderRow = (r: KitRow) => {
    const checked = !excluded.has(r.key);
    const isCover = r.key === "capa";
    const isBack = r.key === "contracapa";
    const isCoverLine = isCover || isBack;
    const mode = isCover ? coverMode : isBack ? backCoverMode : "standard";
    const collapsed = isCover ? coverCollapsed : isBack ? backCoverCollapsed : false;
    const customItem = isCover ? customCover : isBack ? customBackCover : null;

    const showEditor = checked && isCoverLine && mode === "custom" && !collapsed;
    const showSummary = checked && isCoverLine && mode === "custom" && collapsed && customItem;

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

          {isCoverLine && (
            <Tabs
              value={mode}
              onValueChange={(v) => handleModeChange(isCover, v as CoverMode)}
              className="ml-1"
              onClick={(e) => e.preventDefault()}
            >
              <TabsList className="h-7 p-0.5">
                <TabsTrigger value="standard" className="h-6 px-2.5 text-[11px]">
                  Padrão
                </TabsTrigger>
                <TabsTrigger
                  value="custom"
                  className={cn(
                    "h-6 px-2.5 text-[11px] gap-1",
                    mode !== "custom" && "text-primary/70 hover:text-primary",
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  Personalizada
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {mode === "standard" && (
            <>
              {isCoverLine ? (
                <span className="flex-1 text-[10px] text-muted-foreground italic hidden md:inline truncate">
                  ← clique em <span className="text-primary/80 not-italic font-medium">Personalizada</span> p/ usar impressão (ex.: Couchê 300g + laminação)
                </span>
              ) : (
                <span className="flex-1 text-muted-foreground text-[10.5px] truncate hidden sm:inline">
                  {r.description}
                </span>
              )}
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
          {mode === "custom" && !collapsed && (
            <span className="flex-1 text-[10.5px] text-amber-600 dark:text-amber-400 italic">
              Configure abaixo ↓
            </span>
          )}
          {mode === "custom" && collapsed && (
            <span className="flex-1 text-[10.5px] text-muted-foreground italic">
              Impressão personalizada
            </span>
          )}
        </label>

        {showEditor && (
          <CustomCoverEditor
            units={Math.max(1, bookletUnits)}
            slotLabel={isCover ? "Capa frontal" : "Contracapa"}
            onChange={isCover ? setCustomCover : setCustomBackCover}
            onDone={() =>
              isCover ? setCoverCollapsed(true) : setBackCoverCollapsed(true)
            }
          />
        )}

        {showSummary && customItem &&
          renderCustomSummary(customItem, () =>
            isCover ? setCoverCollapsed(false) : setBackCoverCollapsed(false),
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
            Use o kit sugerido, troque itens por impressão personalizada, ou desmarque tudo e adicione apenas os acabamentos que precisar.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-[11px] text-muted-foreground">Carregando catálogo…</p>
      ) : (
        <div className="space-y-1.5">{rows.map(renderRow)}</div>
      )}

      {/* Slots livres de acabamento personalizado */}
      {!loading && (
        <div className="space-y-2 pt-1 border-t border-primary/15">
          {extraSlots.map((slot) => (
            <div key={slot.id} className="space-y-1.5">
              <div className="flex items-center gap-2 px-2">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <Input
                  value={slot.label}
                  onChange={(e) => updateSlot(slot.id, { label: e.target.value })}
                  placeholder="Nome do acabamento (ex.: Laminação BOPP, Capa dura)"
                  className="h-7 text-[11px] flex-1"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeSlot(slot.id)}
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  aria-label="Remover acabamento"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {!slot.collapsed && (
                <CustomCoverEditor
                  units={Math.max(1, bookletUnits)}
                  slotLabel={slot.label.trim() || "Acabamento personalizado"}
                  onChange={(item) => updateSlot(slot.id, { item })}
                  onDone={() => updateSlot(slot.id, { collapsed: true })}
                />
              )}
              {slot.collapsed && slot.item &&
                renderCustomSummary(
                  slot.label.trim() ? { ...slot.item, descricao: slot.label.trim() } : slot.item,
                  () => updateSlot(slot.id, { collapsed: false }),
                )}
            </div>
          ))}

          <Button
            size="sm"
            variant="ghost"
            onClick={addSlot}
            className="h-7 text-[11px] text-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar acabamento
          </Button>
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
          {hasAnyCustom ? (
            <>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Aplicar acabamentos
            </>
          ) : (
            <>
              <Wand2 className="h-3.5 w-3.5 mr-1.5" /> Aplicar Kit
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
