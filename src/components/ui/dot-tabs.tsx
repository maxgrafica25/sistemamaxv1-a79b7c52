// Componente padrão de abas principais do sistema.
// Visual: dot + border-bottom roxos quando ativa; texto roxo na ativa.
// Inativas: dot e texto em cinza (muted), sem border-bottom.
// Cada tab pode ter um ícone opcional para diferenciação visual.
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface DotTab<K extends string = string> {
  key: K;
  label: string;
  icon?: LucideIcon;
}

interface DotTabsProps<K extends string> {
  tabs: readonly DotTab<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}

export function DotTabs<K extends string>({
  tabs,
  value,
  onChange,
  className,
}: DotTabsProps<K>) {
  return (
    <div
      className={cn(
        "flex gap-1 border-b border-border overflow-x-auto",
        className,
      )}
      role="tablist"
    >
      {tabs.map((t) => {
        const active = t.key === value;
        const Icon = t.icon;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-[3px] -mb-px shrink-0 transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon ? (
              <Icon
                className={cn(
                  "h-4 w-4 transition-colors",
                  active ? "text-primary" : "text-muted-foreground/70",
                )}
              />
            ) : (
              <span
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  active ? "bg-primary" : "bg-muted-foreground/40",
                )}
              />
            )}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
