import { useEffect, useMemo, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Package, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface PartSuggestion {
  name: string;
  suggestedPrice?: number;
  source: "catalog" | "history" | "custom";
}

interface Props {
  equipmentId: string;
  value: string[];
  onChange: (parts: string[]) => void;
  /** Disparado quando o usuário adiciona uma peça do catálogo com preço cadastrado. */
  onPriceSuggestion?: (price: number, partName: string) => void;
}

const norm = (s: string) => s.trim().toLowerCase();

export default function PartsMultiSelect({ equipmentId, value, onChange, onPriceSuggestion }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [catalog, setCatalog] = useState<PartSuggestion[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (!equipmentId) return;
    let active = true;

    (async () => {
      const [{ data: cons }, { data: hist }] = await Promise.all([
        supabase
          .from("equipment_consumables")
          .select("name, price")
          .eq("equipment_id", equipmentId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("equipment_maintenances")
          .select("replaced_parts")
          .eq("equipment_id", equipmentId)
          .not("replaced_parts", "is", null)
          .order("date", { ascending: false })
          .limit(30),
      ]);
      if (!active) return;

      const catList: PartSuggestion[] = (cons ?? []).map((c: any) => ({
        name: c.name,
        suggestedPrice: Number(c.price) > 0 ? Number(c.price) : undefined,
        source: "catalog",
      }));

      const seen = new Set(catList.map(c => norm(c.name)));
      const histSet: string[] = [];
      for (const row of hist ?? []) {
        const raw = (row as any).replaced_parts as string | null;
        if (!raw) continue;
        for (const p of raw.split(",").map(s => s.trim()).filter(Boolean)) {
          if (!seen.has(norm(p))) {
            seen.add(norm(p));
            histSet.push(p);
            if (histSet.length >= 20) break;
          }
        }
        if (histSet.length >= 20) break;
      }

      setCatalog(catList);
      setHistory(histSet);
    })();

    return () => { active = false; };
  }, [equipmentId]);

  const selectedSet = useMemo(() => new Set(value.map(norm)), [value]);

  const addPart = (suggestion: PartSuggestion) => {
    const name = suggestion.name.trim();
    if (!name || selectedSet.has(norm(name))) return;
    onChange([...value, name]);
    if (suggestion.source === "catalog" && suggestion.suggestedPrice && onPriceSuggestion) {
      onPriceSuggestion(suggestion.suggestedPrice, name);
    }
    setSearch("");
  };

  const removePart = (name: string) => {
    onChange(value.filter(p => norm(p) !== norm(name)));
  };

  const trimmedSearch = search.trim();
  const canAddCustom =
    trimmedSearch.length > 0 &&
    !selectedSet.has(norm(trimmedSearch)) &&
    !catalog.some(c => norm(c.name) === norm(trimmedSearch)) &&
    !history.some(h => norm(h) === norm(trimmedSearch));

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start font-normal text-muted-foreground h-9"
          >
            <Package className="h-3.5 w-3.5 mr-2" />
            Adicionar peça do catálogo ou nova...
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[300px]" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar peça..."
              value={search}
              onValueChange={setSearch}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAddCustom) {
                  e.preventDefault();
                  addPart({ name: trimmedSearch, source: "custom" });
                }
              }}
            />
            <CommandList className="max-h-64">
              <CommandEmpty>
                {canAddCustom ? (
                  <button
                    type="button"
                    onClick={() => addPart({ name: trimmedSearch, source: "custom" })}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary" />
                    Adicionar <span className="font-medium">"{trimmedSearch}"</span>
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground px-3 py-2 block">Nenhuma peça encontrada</span>
                )}
              </CommandEmpty>

              {catalog.length > 0 && (
                <CommandGroup heading="Catálogo do equipamento">
                  {catalog.map((c) => {
                    const selected = selectedSet.has(norm(c.name));
                    return (
                      <CommandItem
                        key={`cat-${c.name}`}
                        value={c.name}
                        disabled={selected}
                        onSelect={() => addPart(c)}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="truncate">{c.name}</span>
                        </div>
                        {c.suggestedPrice !== undefined && (
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                            R$ {c.suggestedPrice.toFixed(2)}
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {history.length > 0 && (
                <CommandGroup heading="Usadas anteriormente">
                  {history.map((name) => {
                    const selected = selectedSet.has(norm(name));
                    return (
                      <CommandItem
                        key={`hist-${name}`}
                        value={name}
                        disabled={selected}
                        onSelect={() => addPart({ name, source: "history" })}
                      >
                        <span className="truncate">{name}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {canAddCustom && (catalog.length > 0 || history.length > 0) && (
                <CommandGroup heading="Personalizada">
                  <CommandItem
                    value={`__add_${trimmedSearch}`}
                    onSelect={() => addPart({ name: trimmedSearch, source: "custom" })}
                  >
                    <Plus className="h-3.5 w-3.5 text-primary mr-2" />
                    Adicionar <span className="font-medium ml-1">"{trimmedSearch}"</span>
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <Badge
              key={name}
              variant="secondary"
              className="gap-1 pr-1 py-1 text-xs font-normal border border-border/60"
            >
              <Package className="h-3 w-3 text-primary" />
              {name}
              <button
                type="button"
                onClick={() => removePart(name)}
                className="ml-0.5 rounded-sm hover:bg-destructive/20 p-0.5 transition-colors"
                aria-label={`Remover ${name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
