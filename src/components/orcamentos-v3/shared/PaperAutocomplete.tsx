import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface AutocompleteOption {
  id: string;
  label: string;
  hint?: string;
  [extra: string]: unknown;
}

interface Props {
  table: string;
  searchColumns: string[];
  mapRow: (row: Record<string, unknown>) => AutocompleteOption;
  selectColumns?: string;
  placeholder?: string;
  value: AutocompleteOption | null;
  onChange: (opt: AutocompleteOption | null) => void;
  filterEq?: Record<string, string | number | boolean | null>;
}

export function PaperAutocomplete({
  table,
  searchColumns,
  mapRow,
  selectColumns = "*",
  placeholder = "Buscar...",
  value,
  onChange,
  filterEq,
}: Props) {
  const [q, setQ] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<AutocompleteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQ(value?.label ?? "");
  }, [value?.id]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        let req = (supabase as any).from(table).select(selectColumns).limit(20);
        if (filterEq) {
          for (const [k, v] of Object.entries(filterEq)) {
            if (v !== null && v !== undefined) req = req.eq(k, v);
          }
        }
        const term = q.trim();
        if (term.length > 0) {
          const orStr = searchColumns.map((c) => `${c}.ilike.%${term}%`).join(",");
          req = req.or(orStr);
        }
        const { data, error } = await req;
        if (!error && Array.isArray(data)) {
          setResults(data.map((r) => mapRow(r as Record<string, unknown>)));
        }
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, open, table, selectColumns, JSON.stringify(filterEq ?? {})]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              if (value) onChange(null);
            }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className="pl-8 h-9"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {loading && (
              <div className="px-3 py-4 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-3 py-4 text-xs text-muted-foreground">Nenhum resultado.</div>
            )}
            {!loading && results.length > 0 && (
              <CommandGroup>
                {results.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={r.id}
                    onSelect={() => {
                      onChange(r);
                      setQ(r.label);
                      setOpen(false);
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{r.label}</span>
                      {r.hint && (
                        <span className="text-[11px] text-muted-foreground">{r.hint}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
