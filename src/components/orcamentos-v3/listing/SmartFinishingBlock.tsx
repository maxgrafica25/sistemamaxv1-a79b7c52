import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Sparkles, Search, Clock, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getIdealSpiral, spiralRegex,
  FRONT_COVER_REGEX, BACK_COVER_REGEX, BINDING_LABOR_PATTERNS,
} from "@/lib/quotes/spiral-selector";
import type { SupplyTier } from "@/lib/quotes/supply-pricing";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Popover, PopoverAnchor, PopoverContent,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandItem, CommandList,
} from "@/components/ui/command";
import type { ProcessStep } from "./ProcessPicker";
import type { SubformLabor, SubformMaterial } from "./LaborAndSupplySubform";
import { getFinishingSuggestions } from "@/lib/quotes/finishing-suggestions";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  computeLaborSellingPrice,
  LABOR_SELLING_TOOLTIP,
  type LaborDisplayPcts,
} from "@/lib/quotes/labor-display";

interface Props {
  parentItemId: string;
  productKind?: string | null;
  processSteps: ProcessStep[];
  hourlyRate: number;
  displayPcts: LaborDisplayPcts;
  childLabor: SubformLabor[];
  childMaterials: SubformMaterial[];
  onChildLaborChange: (next: SubformLabor[]) => void;
  onChildMaterialChange: (next: SubformMaterial[]) => void;
  disabled?: boolean;
  /** Quando definido (apostila), multiplica o tempo do passo de encadernação por este valor. */
  bookletUnits?: number | null;
  /** Nº de folhas da apostila — usado para escolher o diâmetro da espiral no kit. */
  bookletPages?: number | null;
  /** Apostila: botão para revelar capa/contracapa impressa (projeto especial). */
  showCoverPaper?: boolean;
  onShowCoverPaper?: () => void;
  /** Slot renderizado abaixo dos botões de ação (apostila). */
  coverPaperSlot?: React.ReactNode;
}

interface SupplyRow {
  id: string;
  produto: string;
  valor_unitario: number;
  margem_pct: number | null;
  pricing_tiers: SupplyTier[];
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SmartFinishingBlock({
  parentItemId, productKind, processSteps, hourlyRate, displayPcts,
  childLabor, childMaterials, onChildLaborChange, onChildMaterialChange,
  disabled, bookletUnits, bookletPages, showCoverPaper, onShowCoverPaper, coverPaperSlot,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const focusIdRef = useRef<string | null>(null);
  const [supplies, setSupplies] = useState<SupplyRow[] | null>(null);

  const isApostila = !!bookletUnits && bookletUnits > 0;

  // Carrega suprimentos + faixas só quando o item é apostila (pre-load para o Kit).
  useEffect(() => {
    if (!isApostila || supplies !== null) return;
    let cancelled = false;
    (async () => {
      const [{ data: sups }, { data: tiers }] = await Promise.all([
        supabase.from("supplies").select("id, produto, valor_unitario, margem_pct"),
        (supabase as any).from("supply_pricing_tiers").select("*").order("min_qty"),
      ]);
      if (cancelled) return;
      const tierMap = new Map<string, SupplyTier[]>();
      for (const t of (tiers || []) as any[]) {
        const arr = tierMap.get(t.supply_id) || [];
        arr.push(t as SupplyTier);
        tierMap.set(t.supply_id, arr);
      }
      setSupplies(((sups || []) as any[]).map((s) => ({
        id: s.id,
        produto: s.produto,
        valor_unitario: Number(s.valor_unitario) || 0,
        margem_pct: s.margem_pct == null ? null : Number(s.margem_pct),
        pricing_tiers: tierMap.get(s.id) || [],
      })));
    })();
    return () => { cancelled = true; };
  }, [isApostila, supplies]);

  const suggestions = useMemo(
    () => getFinishingSuggestions(productKind, processSteps),
    [productKind, processSteps],
  );

  // Esconde sugestões já adicionadas (match por descrição case-insensitive).
  const addedDescriptions = useMemo(
    () => new Set(childLabor.map((l) => l.description.trim().toLowerCase())),
    [childLabor],
  );
  // Em apostila, o Kit Encadernação cobre Furação/Montagem/Encadernação —
  // remover esses chips redundantes da camada de sugestões.
  const KIT_COVERED_REGEX = /(fura[cç][aã]o|montagem|encaderna)/i;
  const visibleSuggestions = suggestions.filter((s) => {
    const text = (s.step?.description ?? s.customName ?? s.label).toLowerCase();
    if (addedDescriptions.has(text)) return false;
    if (isApostila && KIT_COVERED_REGEX.test(s.label)) return false;
    return true;
  });

  const filteredSteps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return processSteps
      .filter((s) => s.description.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, processSteps]);

  const addLaborFromStep = (step: ProcessStep) => {
    const id = `lbr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Apostila: tempo cadastrado é POR APOSTILA — multiplica pelo nº de apostilas.
    // Exceções (processos de LOTE — somam 1x): Refile, Corte, Setup, Arquivo.
    const isBatchStep = /\b(refile|corte|setup|arquivo)\b/i.test(step.description);
    const isApostila = !!bookletUnits && bookletUnits > 0;
    const multiply = isApostila && !isBatchStep;
    const minutes = (step.time_minutes || 0) * (multiply ? bookletUnits! : 1);
    onChildLaborChange([
      ...childLabor,
      {
        id,
        description: multiply
          ? `${step.description} (×${bookletUnits} apostilas)`
          : step.description,
        timeMinutes: minutes,
        stepType: step.step_type || "outro",
        parentItemId,
        isOptional: false,
      },
    ]);
  };

  const addCustomLabor = (name: string, minutes = 0, focus = true) => {
    const id = `lbr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    onChildLaborChange([
      ...childLabor,
      {
        id,
        description: name,
        timeMinutes: minutes,
        stepType: "outro",
        parentItemId,
        isOptional: false,
      },
    ]);
    if (focus) focusIdRef.current = id;
  };

  const handleSuggestionClick = (s: ReturnType<typeof getFinishingSuggestions>[number]) => {
    if (s.step) addLaborFromStep(s.step);
    else if (s.customName) addCustomLabor(s.customName, 0, true);
  };

  const handleOmniboxSelect = (value: string) => {
    if (value.startsWith("step:")) {
      const step = processSteps.find((s) => s.id === value.slice(5));
      if (step) addLaborFromStep(step);
    } else if (value.startsWith("create:")) {
      addCustomLabor(value.slice(7), 0, true);
    }
    setQuery("");
    setOpen(false);
  };

  // ---- Kit Automático de Encadernação ----------------------------------------
  const findSupply = (rx: RegExp): SupplyRow | null =>
    (supplies || []).find((s) => rx.test(s.produto)) || null;

  const pickTierPrice = (s: SupplyRow, qty: number): number => {
    const tiers = s.pricing_tiers || [];
    if (tiers.length === 0) return s.valor_unitario;
    const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
    const hit = sorted.find((t) => qty >= t.min_qty && (t.max_qty == null || qty <= t.max_qty));
    return hit ? Number(hit.manual_price) : s.valor_unitario;
  };

  const hasChildKind = (kind: string) =>
    childMaterials.some(
      (m) => m.parentItemId === parentItemId &&
        (m.productKind || "").toLowerCase() === kind.toLowerCase(),
    );

  const addKitSupply = (
    out: SubformMaterial[],
    productKindLabel: "Capa" | "Contracapa" | "Mola",
    rx: RegExp,
    fallbackName: string,
    units: number,
  ): { added: boolean; fallback: boolean; label: string } => {
    if (hasChildKind(productKindLabel)) return { added: false, fallback: false, label: productKindLabel };
    const sup = findSupply(rx);
    const id = `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${productKindLabel}`;
    if (sup) {
      const unitPrice = pickTierPrice(sup, units);
      out.push({
        id,
        description: sup.produto,
        quantity: units,
        unitPrice,
        parentItemId,
        productKind: productKindLabel,
        supplyId: sup.id,
        margemPct: sup.margem_pct ?? null,
        pricingTiers: sup.pricing_tiers,
      } as SubformMaterial);
      return { added: true, fallback: false, label: sup.produto };
    }
    out.push({
      id,
      description: `${fallbackName} — preencher`,
      quantity: units,
      unitPrice: 0,
      parentItemId,
      productKind: productKindLabel,
    } as SubformMaterial);
    return { added: true, fallback: true, label: fallbackName };
  };

  const handleSuggestKit = () => {
    if (!isApostila) return;
    if (supplies === null) {
      toast.info("Carregando suprimentos…");
      return;
    }
    const units = bookletUnits!;
    const sheets = bookletPages ?? 0;
    const diameter = sheets > 0 ? getIdealSpiral(sheets) : null;

    const newMats: SubformMaterial[] = [];
    const fallbacks: string[] = [];
    const rCapa = addKitSupply(newMats, "Capa", FRONT_COVER_REGEX, "Capa PP Line A4 Incolor", units);
    const rContra = addKitSupply(newMats, "Contracapa", BACK_COVER_REGEX, "Capa PP Camurça A4 Preta", units);
    let rMola: ReturnType<typeof addKitSupply> = { added: false, fallback: false, label: "Mola" };
    if (diameter) {
      rMola = addKitSupply(newMats, "Mola", spiralRegex(diameter), `Espiral ${diameter}`, units);
    }
    [rCapa, rContra, rMola].forEach((r) => { if (r.added && r.fallback) fallbacks.push(r.label); });
    if (newMats.length > 0) onChildMaterialChange([...childMaterials, ...newMats]);

    const newLabs: SubformLabor[] = [];
    for (const { key, rx } of BINDING_LABOR_PATTERNS) {
      const exists = childLabor.some(
        (l) => l.parentItemId === parentItemId && rx.test(l.description),
      );
      if (exists) continue;
      const step = processSteps.find((s) => rx.test(s.description));
      const id = `lbr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${key}`;
      if (step) {
        // Apostilas usam direct_sum: as linhas filhas devem representar o
        // TOTAL absoluto do lote. Multiplicamos pelo nº de apostilas e
        // guardamos o tempo por unidade em perBookletMinutes para que o
        // observer de bookletUnits possa recalcular proporcionalmente.
        const perUnit = step.time_minutes || 0;
        newLabs.push({
          id,
          description: `${step.description} (×${units} apostilas)`,
          timeMinutes: perUnit * units,
          stepType: step.step_type || "outro",
          parentItemId,
          isOptional: false,
          perBookletMinutes: perUnit,
        });
      } else {
        newLabs.push({
          id,
          description: `${key} — preencher`,
          timeMinutes: 0,
          stepType: "outro",
          parentItemId,
          isOptional: false,
        });
        fallbacks.push(key);
      }
    }
    if (newLabs.length > 0) onChildLaborChange([...childLabor, ...newLabs]);

    const total = newMats.length + newLabs.length;
    if (total === 0) {
      toast.info("Kit já está completo neste item.");
    } else if (fallbacks.length > 0) {
      toast.warning(`Kit aplicado (${total} itens). Preencher manualmente: ${fallbacks.join(", ")}`);
    } else {
      toast.success(`Kit de encadernação aplicado (${total} itens).`);
    }
  };

  const updateLabor = (id: string, patch: Partial<SubformLabor>) =>
    onChildLaborChange(childLabor.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLabor = (id: string) =>
    onChildLaborChange(childLabor.filter((l) => l.id !== id));

  const updateMaterial = (id: string, patch: Partial<SubformMaterial>) =>
    onChildMaterialChange(childMaterials.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMaterial = (id: string) =>
    onChildMaterialChange(childMaterials.filter((m) => m.id !== id));

  // Auto-focus do campo "min" da última linha criada via custom.
  useEffect(() => {
    if (!focusIdRef.current) return;
    const id = focusIdRef.current;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(
        `input[data-finishing-time="${id}"]`,
      );
      el?.focus();
      el?.select();
      focusIdRef.current = null;
    });
  }, [childLabor.length]);

  return (
    <div className="space-y-3">
      {/* Kit Automático + Capa Impressa — lado a lado em apostilas */}
      {isApostila && !disabled && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSuggestKit}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
            title={
              (bookletPages ?? 0) > 0
                ? `Adiciona Capa, Contracapa, Espiral ${getIdealSpiral(bookletPages!)} e mão de obra (Furação + Encadernação)`
                : "Defina o nº de folhas para escolher a espiral ideal"
            }
          >
            <Wand2 className="h-3.5 w-3.5" />
            Sugerir Kit Encadernação
            {(bookletPages ?? 0) > 0 && (
              <span className="text-[10px] text-primary/70 font-normal">
                · espiral {getIdealSpiral(bookletPages!)}
              </span>
            )}
          </button>
          {onShowCoverPaper && !showCoverPaper && (
            <button
              type="button"
              onClick={onShowCoverPaper}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              title="Adicionar capa/contracapa em papel impresso (projeto especial)"
            >
              <span className="text-base leading-none">+</span> Capa Impressa
            </button>
          )}
        </div>
      )}

      {coverPaperSlot}

      {/* Camada 1 — chips contextuais (oculto em apostilas: só Kit Encadernação) */}
      {!isApostila && visibleSuggestions.length > 0 && !disabled && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-primary/60" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1">
            Sugeridos
          </span>
          {visibleSuggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => handleSuggestionClick(s)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 bg-primary/5 px-2.5 py-0.5 text-[11px] text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="h-3 w-3" /> {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Camada 2 — omnibox */}
      {!disabled && (
        <Popover open={open && query.length > 0} onOpenChange={setOpen}>
          <PopoverAnchor asChild>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => query && setOpen(true)}
                placeholder="Buscar ou criar novo acabamento…"
                className="h-8 text-sm pl-8"
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            className="p-0 w-[var(--radix-popover-trigger-width)]"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command shouldFilter={false}>
              <CommandList>
                {filteredSteps.length === 0 ? (
                  <CommandGroup>
                    <CommandItem
                      value={`create:${query}`}
                      onSelect={handleOmniboxSelect}
                      className="gap-2"
                    >
                      <Plus className="h-3.5 w-3.5 text-primary" />
                      <span>
                        Criar <strong>"{query}"</strong>
                      </span>
                    </CommandItem>
                  </CommandGroup>
                ) : (
                  <>
                    <CommandGroup heading="Cadastrados">
                      {filteredSteps.map((s) => (
                        <CommandItem
                          key={s.id}
                          value={`step:${s.id}`}
                          onSelect={handleOmniboxSelect}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="truncate">{s.description}</span>
                          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5 shrink-0">
                            <Clock className="h-3 w-3" /> {s.time_minutes} min
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandGroup>
                      <CommandItem
                        value={`create:${query}`}
                        onSelect={handleOmniboxSelect}
                        className="gap-2"
                      >
                        <Plus className="h-3.5 w-3.5 text-primary" />
                        <span>
                          Criar <strong>"{query}"</strong>
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      {/* Lista de acabamentos vinculados */}
      {(childLabor.length > 0 || childMaterials.length > 0) && (
        <div className="space-y-1.5">
          {childLabor.map((l) => {
            const cost = computeLaborSellingPrice(l.timeMinutes, hourlyRate, displayPcts);
            const optional = !!l.isOptional;
            return (
              <div
                key={l.id}
                className={cn(
                  "flex items-center gap-2 rounded-md border p-2 text-xs",
                  optional
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300/50 dark:border-amber-700/40"
                    : "bg-background",
                )}
              >
                <Clock className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                {optional && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 h-4 border-amber-400 text-amber-700 dark:text-amber-300"
                  >
                    Opcional
                  </Badge>
                )}
                <Input
                  value={l.description}
                  onChange={(e) => updateLabor(l.id, { description: e.target.value })}
                  placeholder="Descrição"
                  className="flex-1 h-7 text-xs bg-transparent"
                />
                <Input
                  type="number"
                  data-finishing-time={l.id}
                  value={l.timeMinutes || ""}
                  onChange={(e) =>
                    updateLabor(l.id, { timeMinutes: parseFloat(e.target.value) || 0 })
                  }
                  className="w-16 h-7 text-xs text-center"
                  placeholder="min"
                />
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="w-20 text-right tabular-nums text-muted-foreground cursor-help">
                        {fmt(cost)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{LABOR_SELLING_TOOLTIP}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground select-none cursor-pointer">
                  <Switch
                    checked={optional}
                    onCheckedChange={(v) => updateLabor(l.id, { isOptional: v })}
                    className="scale-75"
                  />
                  Opcional
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeLabor(l.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}

          {childMaterials.map((m) => {
            const optional = !!m.isOptional;
            const total = (m.quantity || 0) * (m.unitPrice || 0);
            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-center gap-2 rounded-md border p-2 text-xs",
                  optional
                    ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300/50 dark:border-amber-700/40"
                    : "bg-background",
                )}
              >
                {optional && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1 py-0 h-4 border-amber-400 text-amber-700 dark:text-amber-300"
                  >
                    Opcional
                  </Badge>
                )}
                <Input
                  value={m.description}
                  onChange={(e) => updateMaterial(m.id, { description: e.target.value })}
                  placeholder="Material/insumo"
                  className="flex-1 h-7 text-xs"
                />
                <Input
                  type="number"
                  value={m.quantity || ""}
                  onChange={(e) =>
                    updateMaterial(m.id, { quantity: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="qtd"
                  className="w-14 h-7 text-xs text-center"
                />
                <Input
                  type="number"
                  step="0.01"
                  value={m.unitPrice || ""}
                  onChange={(e) =>
                    updateMaterial(m.id, { unitPrice: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="R$"
                  className="w-20 h-7 text-xs text-center"
                />
                <span className="w-20 text-right tabular-nums text-muted-foreground">
                  {fmt(total)}
                </span>
                <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground select-none cursor-pointer">
                  <Switch
                    checked={optional}
                    onCheckedChange={(v) => updateMaterial(m.id, { isOptional: v })}
                    className="scale-75"
                  />
                  Opcional
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeMaterial(m.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {childLabor.length === 0 && childMaterials.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">
          Use os chips ou a busca acima para adicionar acabamentos.
        </p>
      )}
    </div>
  );
}
