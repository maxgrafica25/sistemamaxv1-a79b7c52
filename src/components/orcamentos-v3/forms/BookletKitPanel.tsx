// Painel "Kit Encadernação" — preview com checkboxes + capa/contracapa personalizada.
import { useMemo, useState, useEffect } from "react";
import { Wand2, AlertCircle, Sparkles, Pencil, Plus, Trash2, Package, Clock } from "lucide-react";
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
import SupplySearch, { type SupplyOption } from "@/components/orcamentos-v2/SupplySearch";
import { genId, type V3Item, type V3PrintItem, type V3SupplyItem } from "../types";


export interface BookletKitApplyMeta {
  coverMode: "standard" | "custom";
  backCoverMode: "standard" | "custom";
  customCoverDescr: string | null;
  customBackCoverDescr: string | null;
  spiralDiameter: string | null;
}

interface Props {
  bookletPages: number;
  bookletUnits: number;
  defaultMarginPct: number;
  /** Callback que recebe os V3Items prontos (sem o miolo) + metadados do kit. */
  onApply: (items: V3Item[], meta: BookletKitApplyMeta) => void;
}

type CoverMode = "standard" | "custom";

export function BookletKitPanel({
  bookletPages,
  bookletUnits,
  defaultMarginPct,
  onApply,
}: Props) {
  const { supplies, loaded: supLoaded } = useV3Supplies();
  const { allSteps, loaded: stLoaded } = useV3ProcessCatalog();
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
    supply: SupplyOption | null;
    qty: number;
    margemPct: number;
    collapsed: boolean;
    enabled: boolean;
  };
  const [extraSlots, setExtraSlots] = useState<ExtraSlot[]>([]);

  // Overrides: troca de suprimento sugerido (capa/contracapa/espiral) por outro escolhido manualmente.
  type SupplyOverrideKey = "capa" | "contracapa" | "espiral";
  const [overrides, setOverrides] = useState<Partial<Record<SupplyOverrideKey, SupplyOption>>>({});
  const [swapOpen, setSwapOpen] = useState<Partial<Record<SupplyOverrideKey, boolean>>>({});
  const setOverride = (key: SupplyOverrideKey, s: SupplyOption | null) =>
    setOverrides((prev) => {
      const next = { ...prev };
      if (s) next[key] = s;
      else delete next[key];
      return next;
    });

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
        supply: null,
        qty: Math.max(1, bookletUnits || 1),
        margemPct: defaultMarginPct || 20,
        collapsed: false,
        enabled: true,
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
      prev.map((s) => (s.supply && !s.collapsed ? { ...s, collapsed: true } : s)),
    );
  }, [extraSlots.map((s) => (s.supply ? s.id : "")).join("|")]);


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
    coverMode === "custom" ||
    backCoverMode === "custom" ||
    excluded.size > 0 ||
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
      const override =
        (r.key === "capa" || r.key === "contracapa" || r.key === "espiral")
          ? overrides[r.key as SupplyOverrideKey]
          : undefined;
      if (override) {
        const units = Math.max(1, Math.floor(bookletUnits || 1));
        const overrideItem: V3SupplyItem = {
          id: genId(),
          kind: "supply",
          descricao: override.produto,
          tier_group_id: null,
          supply_id: override.id,
          supply_nome: override.produto,
          fornecedor: override.fornecedor || null,
          custo_unitario: Number(override.valor_unitario) || 0,
          margem_pct:
            override.margem_pct != null
              ? Number(override.margem_pct)
              : defaultMarginPct,
          quantidade: units,
        };
        items.push(overrideItem);
        continue;
      }
      items.push(r.build() as V3Item);
      if (r.fallback) fallbacks.push(r.label);
    }

    // Slots livres de acabamento (suprimentos)
    for (const s of extraSlots) {
      if (!s.enabled) continue;
      if (!s.supply) {

        toast.error(
          `Selecione o suprimento do acabamento "${s.label.trim() || "personalizado"}".`,
        );
        return;
      }
      const qty = Math.max(1, Math.floor(s.qty || 1));
      const item: V3SupplyItem = {
        id: genId(),
        kind: "supply",
        descricao: s.label.trim() || s.supply.produto,
        tier_group_id: null,
        supply_id: s.supply.id,
        supply_nome: s.supply.produto,
        fornecedor: s.supply.fornecedor || null,
        custo_unitario: Number(s.supply.valor_unitario) || 0,
        margem_pct: s.margemPct,
        quantidade: qty,
      };
      items.push(item);
    }


    if (items.length === 0) {
      toast.info("Adicione ao menos um acabamento ou item do kit.");
      return;
    }

    onApply(items, {
      coverMode,
      backCoverMode,
      customCoverDescr: customCover?.descricao ?? null,
      customBackCoverDescr: customBackCover?.descricao ?? null,
      spiralDiameter: spiralDiameter ?? null,
    });
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
      if (v === "custom") setOverride("capa", null);
      if (v === "standard") {
        setCustomCover(null);
        setCoverCollapsed(false);
      }
    } else {
      setBackCoverMode(v);
      if (v === "custom") setOverride("contracapa", null);
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
    const isSwappable = r.key === "capa" || r.key === "contracapa" || r.key === "espiral";
    const mode = isCover ? coverMode : isBack ? backCoverMode : "standard";
    const collapsed = isCover ? coverCollapsed : isBack ? backCoverCollapsed : false;
    const customItem = isCover ? customCover : isBack ? customBackCover : null;
    const override = isSwappable ? overrides[r.key as SupplyOverrideKey] : undefined;
    const swapVisible = isSwappable && !!swapOpen[r.key as SupplyOverrideKey];

    const showEditor = checked && isCoverLine && mode === "custom" && !collapsed;
    const showSummary = checked && isCoverLine && mode === "custom" && collapsed && customItem;
    const canSwap = checked && isSwappable && mode === "standard";

    const units = Math.max(1, Math.floor(bookletUnits || 1));
    const overrideCost = override ? (Number(override.valor_unitario) || 0) * units : 0;

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
          {r.unit === "min" ? (
            <Clock className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          ) : (
            <Package className="h-3 w-3 text-muted-foreground/60 shrink-0" />
          )}
          <span className="font-medium whitespace-nowrap">{r.label}</span>


          {mode === "standard" && (
            <>
              {override ? (
                <span className="flex-1 text-[10.5px] truncate flex items-center gap-1.5 min-w-0">
                  <span className="text-foreground font-medium truncate">{override.produto}</span>
                  <span className="text-[9.5px] uppercase tracking-wider text-primary/80 font-semibold shrink-0">
                    trocado
                  </span>
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
                {fmtBRL(override ? overrideCost : r.cost)}
              </span>
              {r.fallback && !override && (
                <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
              )}
              {canSwap && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    setSwapOpen((p) => ({ ...p, [r.key]: !p[r.key as SupplyOverrideKey] }));
                  }}
                  className="h-6 px-2 text-[10.5px] text-primary hover:text-primary"
                >
                  {swapVisible ? "Fechar" : override ? "Trocar" : "Trocar"}
                </Button>
              )}
              {override && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    setOverride(r.key as SupplyOverrideKey, null);
                    setSwapOpen((p) => ({ ...p, [r.key]: false }));
                  }}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground shrink-0"
                  aria-label="Restaurar sugestão"
                  title="Restaurar sugestão"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
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

        {canSwap && swapVisible && (
          <div className="ml-6 mr-2 mt-1.5 rounded-md border border-primary/20 bg-background p-2">
            <SupplySearch
              initialLabel={
                r.key === "espiral"
                  ? "espiral"
                  : r.key === "capa" || r.key === "contracapa"
                    ? "capa"
                    : ""
              }
              placeholder={`Buscar outro ${r.label.toLowerCase()} (ex.: ${r.key === "espiral" ? "Espiral 9mm" : "Capa Couchê"})...`}
              onSelect={(s) => {
                setOverride(r.key as SupplyOverrideKey, s);
                setSwapOpen((p) => ({ ...p, [r.key]: false }));
              }}
            />
          </div>
        )}


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
        <div className="space-y-3">
          {/* Grupo: Insumos */}
          <div>
            <div className="px-2 pb-1 text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-medium">
              Insumos
            </div>
            <div className="space-y-1.5">
              {rows.filter((r) => r.unit === "un").map(renderRow)}

              {/* Slots livres de acabamento personalizado (sempre insumos) */}
              {extraSlots.map((slot) => {
                // Modo COLAPSADO: linha única alinhada com os itens do kit acima
                if (slot.collapsed && slot.supply) {
                  const total =
                    (Number(slot.supply.valor_unitario) || 0) *
                    slot.qty *
                    (1 + slot.margemPct / 100);
                  return (
                    <div
                      key={slot.id}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm bg-background hover:bg-muted/50",
                        !slot.enabled && "opacity-50",
                      )}
                    >
                      <Checkbox
                        checked={slot.enabled}
                        onCheckedChange={(v) => updateSlot(slot.id, { enabled: !!v })}
                        className="h-3.5 w-3.5"
                      />
                      <Package className="h-3 w-3 text-muted-foreground/60 shrink-0" />

                      <span className="font-medium whitespace-nowrap">
                        {slot.label.trim() || slot.supply.produto}
                      </span>
                      <span className="flex-1 text-muted-foreground text-[10.5px] truncate hidden sm:inline">
                        {slot.supply.produto}
                        {slot.supply.fornecedor ? ` · ${slot.supply.fornecedor}` : ""}
                      </span>
                      <span className="text-muted-foreground tabular-nums text-[10.5px]">
                        {slot.qty} un
                      </span>
                      <span className="font-semibold tabular-nums w-[70px] text-right">
                        {fmtBRL(total)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateSlot(slot.id, { collapsed: false })}
                        className="h-6 px-2 text-[10.5px] text-primary hover:text-primary"
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Editar
                      </Button>
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
                  );
                }

                // Modo EDIÇÃO: nome + busca + qtd
                return (
                  <div key={slot.id} className="space-y-1.5">
                    <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-background p-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-2" />
                      <div className="flex-1 space-y-2">
                        <SupplySearch
                          placeholder="Buscar suprimento (ex.: Espiral, Wire-o, Laminação BOPP)..."
                          onSelect={(s) =>
                            updateSlot(slot.id, {
                              supply: s,
                              label: s.produto,
                              margemPct:
                                s.margem_pct != null
                                  ? Number(s.margem_pct)
                                  : slot.margemPct,
                            })
                          }
                        />
                        <div className="flex items-center gap-2">
                          <label className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
                            Qtd
                          </label>
                          <Input
                            type="number"
                            min={1}
                            value={slot.qty || ""}
                            onChange={(e) =>
                              updateSlot(slot.id, {
                                qty: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="h-7 w-20 text-xs"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateSlot(slot.id, { collapsed: true })}
                            disabled={!slot.supply || slot.qty <= 0}
                            className="h-7 px-2 text-[11px] ml-auto"
                          >
                            Ok
                          </Button>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSlot(slot.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
                        aria-label="Remover acabamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grupo: Mão de obra */}
          {rows.some((r) => r.unit === "min") && (
            <div>
              <div className="px-2 pb-1 text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-medium">
                Mão de obra
              </div>
              <div className="space-y-1.5">
                {rows.filter((r) => r.unit === "min").map(renderRow)}
              </div>
            </div>
          )}
        </div>
      )}



      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Button
            size="sm"
            variant="outline"
            onClick={addSlot}
            disabled={loading}
            className="h-8 text-xs border-primary/30 text-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar acabamento
          </Button>
          {rows.some((r) => r.fallback) && (
            <p className="text-[10px] text-muted-foreground">
              <AlertCircle className="inline h-3 w-3 mr-1 text-amber-500" />
              Itens em amarelo não foram encontrados no cadastro.
            </p>
          )}
        </div>
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
