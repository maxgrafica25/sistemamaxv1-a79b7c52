// Multi-seleção em chips, com suporte a agrupamento por categoria
// e atalhos "Selecionar todos" / "Limpar" / "+ Todos deste tipo".
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

export interface ChipOption {
  value: string;
  group?: string;
}

interface Props {
  label: string;
  options: ChipOption[];
  value: string[];
  onChange: (next: string[]) => void;
  groupLabels?: Record<string, string>;
  groupOrder?: string[];
  emptyHint?: string;
  helpText?: string;
}

const DEFAULT_GROUP = "__default__";

export function ChipMultiPicker({
  label,
  options,
  value,
  onChange,
  groupLabels,
  groupOrder,
  emptyHint,
  helpText,
}: Props) {
  const grouped = useMemo(() => {
    const map = new Map<string, ChipOption[]>();
    for (const opt of options) {
      const g = opt.group ?? DEFAULT_GROUP;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(opt);
    }
    const keys = Array.from(map.keys());
    if (groupOrder) {
      keys.sort((a, b) => {
        const ia = groupOrder.indexOf(a);
        const ib = groupOrder.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });
    }
    return keys.map((k) => ({ key: k, items: map.get(k)! }));
  }, [options, groupOrder]);

  const knownValues = useMemo(() => new Set(options.map((o) => o.value)), [options]);
  const orphans = value.filter((v) => !knownValues.has(v));

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  const selectAll = () => onChange(Array.from(new Set([...value, ...options.map((o) => o.value)])));
  const clear = () => onChange([]);
  const addGroup = (key: string) => {
    const groupVals = grouped.find((g) => g.key === key)?.items.map((i) => i.value) ?? [];
    onChange(Array.from(new Set([...value, ...groupVals])));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">{label}</Label>
          {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
        </div>
        {options.length > 0 && (
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAll}>
              Selecionar todos
            </Button>
            {value.length > 0 && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={clear}>
                Limpar
              </Button>
            )}
          </div>
        )}
      </div>

      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyHint ?? "Nada cadastrado."}</p>
      ) : (
        <div className="space-y-2">
          {grouped.map(({ key, items }) => (
            <div key={key} className="space-y-1.5">
              {key !== DEFAULT_GROUP && (
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {groupLabels?.[key] ?? key}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] text-primary hover:text-primary"
                    onClick={() => addGroup(key)}
                  >
                    + Todos deste tipo
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {items.map((opt) => {
                  const active = value.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
                      )}
                    >
                      {opt.value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {orphans.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-dashed border-border">
          <p className="text-[11px] text-muted-foreground">
            Valores antigos não encontrados no catálogo:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {orphans.map((v) => (
              <Badge key={v} variant="outline" className="gap-1 text-xs font-normal opacity-70">
                {v}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== v))}
                  aria-label={`Remover ${v}`}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
