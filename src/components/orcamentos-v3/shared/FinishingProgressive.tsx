import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface FinishingDef {
  id: string;
  label: string;
  advanced?: ReactNode;
  hint?: string;
}

interface Props {
  items: FinishingDef[];
  enabled: Record<string, boolean>;
  onToggle: (id: string, on: boolean) => void;
}

export function FinishingProgressive({ items, enabled, onToggle }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Nenhum acabamento cadastrado para Impressão.
        </p>
        <a
          href="/acabamentos"
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-1 text-xs font-medium text-primary hover:underline"
        >
          Cadastrar acabamentos →
        </a>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-background">
      {items.map((it) => {
        const on = !!enabled[it.id];
        return (
          <li key={it.id} className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{it.label}</p>
                {it.hint && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{it.hint}</p>
                )}
              </div>
              <Switch checked={on} onCheckedChange={(v) => onToggle(it.id, !!v)} />
            </div>
            {on && it.advanced && (
              <div className={cn("mt-2 pt-2 border-t border-border/60")}>{it.advanced}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
