import { useEffect, useMemo, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Building2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

const norm = (s: string) => s.trim().toLowerCase();

export default function ConsumableSupplierCombobox({ value, onChange, placeholder = "Selecionar fornecedor..." }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [suppliers, setSuppliers] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("consumable_price_history")
        .select("supplier")
        .not("supplier", "is", null)
        .limit(500);
      if (!active) return;
      const set = new Set<string>();
      for (const row of data ?? []) {
        const s = (row as any).supplier?.trim();
        if (s) set.add(s);
      }
      setSuppliers(Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR")));
    })();
    return () => { active = false; };
  }, []);

  const trimmed = search.trim();
  const canAddNew =
    trimmed.length > 0 &&
    !suppliers.some(s => norm(s) === norm(trimmed));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9"
        >
          <span className="flex items-center gap-2 min-w-0 truncate">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className={cn("truncate", !value && "text-muted-foreground")}>
              {value || placeholder}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar ou digitar novo..."
            value={search}
            onValueChange={setSearch}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canAddNew) {
                e.preventDefault();
                onChange(trimmed);
                setOpen(false);
                setSearch("");
              }
            }}
          />
          <CommandList className="max-h-56">
            <CommandEmpty>
              {canAddNew ? (
                <button
                  type="button"
                  onClick={() => { onChange(trimmed); setOpen(false); setSearch(""); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded"
                >
                  <Plus className="h-3.5 w-3.5 text-primary" />
                  Usar <span className="font-medium">"{trimmed}"</span>
                </button>
              ) : (
                <span className="text-xs text-muted-foreground px-3 py-2 block">Nenhum fornecedor</span>
              )}
            </CommandEmpty>

            {suppliers.length > 0 && (
              <CommandGroup heading="Já usados">
                {suppliers.map((s) => (
                  <CommandItem
                    key={s}
                    value={s}
                    onSelect={() => { onChange(s); setOpen(false); setSearch(""); }}
                  >
                    <Check className={cn("h-3.5 w-3.5 mr-2", norm(value) === norm(s) ? "opacity-100" : "opacity-0")} />
                    {s}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {canAddNew && suppliers.length > 0 && (
              <CommandGroup heading="Novo">
                <CommandItem
                  value={`__new_${trimmed}`}
                  onSelect={() => { onChange(trimmed); setOpen(false); setSearch(""); }}
                >
                  <Plus className="h-3.5 w-3.5 text-primary mr-2" />
                  Usar <span className="font-medium ml-1">"{trimmed}"</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
