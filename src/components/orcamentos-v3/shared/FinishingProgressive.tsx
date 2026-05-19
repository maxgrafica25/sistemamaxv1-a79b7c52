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
