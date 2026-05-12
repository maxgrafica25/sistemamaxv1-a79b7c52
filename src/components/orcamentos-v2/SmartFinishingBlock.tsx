import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, X, Sparkles, Search, Clock } from "lucide-react";
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
import { getFinishingSuggestions } from "@/lib/quotes-v2/finishing-suggestions";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  computeLaborSellingPrice,
  LABOR_SELLING_TOOLTIP,
  type LaborDisplayPcts,
} from "@/lib/quotes-v2/labor-display";

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
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SmartFinishingBlock({
  parentItemId, productKind, processSteps, hourlyRate,
  childLabor, childMaterials, onChildLaborChange, onChildMaterialChange,
  disabled, bookletUnits,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const focusIdRef = useRef<string | null>(null);

  const suggestions = useMemo(
    () => getFinishingSuggestions(productKind, processSteps),
    [productKind, processSteps],
  );

  // Esconde sugestões já adicionadas (match por descrição case-insensitive).
  const addedDescriptions = useMemo(
    () => new Set(childLabor.map((l) => l.description.trim().toLowerCase())),
    [childLabor],
  );
  const visibleSuggestions = suggestions.filter(
    (s) => !addedDescriptions.has((s.step?.description ?? s.customName ?? s.label).toLowerCase()),
  );

  const filteredSteps = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return processSteps
      .filter((s) => s.description.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, processSteps]);

  const addLaborFromStep = (step: ProcessStep) => {
    const id = `lbr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Apostila + encadernação: tempo cadastrado é por unidade — multiplica pelo nº de apostilas.
    const isBookletBinding =
      bookletUnits && bookletUnits > 0 && /encaderna|espiral/i.test(step.description);
    const minutes = (step.time_minutes || 0) * (isBookletBinding ? bookletUnits! : 1);
    onChildLaborChange([
      ...childLabor,
      {
        id,
        description: isBookletBinding
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
      {/* Camada 1 — chips contextuais */}
      {visibleSuggestions.length > 0 && !disabled && (
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
            const cost = ((l.timeMinutes || 0) / 60) * (hourlyRate || 0);
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
                <span className="w-20 text-right tabular-nums text-muted-foreground">
                  {fmt(cost)}
                </span>
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
