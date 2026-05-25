// Componente padrão de abas principais do sistema.
// Visual: dot + border-bottom na cor do accent (padrão primary roxo).
// Inativas: dot na cor do accent (saturação reduzida) + texto cinza, sem border-bottom.
// Cada tab pode ter `accent` próprio para diferenciação visual mesmo quando inativa.
import { cn } from "@/lib/utils";

export type DotTabAccent = "primary" | "emerald" | "amber";

export interface DotTab<K extends string = string> {
  key: K;
  label: string;
  accent?: DotTabAccent;
}

interface DotTabsProps<K extends string> {
  tabs: readonly DotTab<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
}

const ACCENT_STYLES: Record<DotTabAccent, {
  activeText: string;
  activeBorder: string;
  activeDot: string;
  inactiveDot: string;
}> = {
  primary: {
    activeText: "text-primary",
    activeBorder: "border-primary",
    activeDot: "bg-primary",
    inactiveDot: "bg-muted-foreground/40",
  },
  emerald: {
    activeText: "text-emerald-600 dark:text-emerald-400",
    activeBorder: "border-emerald-500",
    activeDot: "bg-emerald-500",
    inactiveDot: "bg-emerald-500/50",
  },
  amber: {
    activeText: "text-amber-600 dark:text-amber-400",
    activeBorder: "border-amber-500",
    activeDot: "bg-amber-500",
    inactiveDot: "bg-amber-500/50",
  },
};

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
        const styles = ACCENT_STYLES[t.accent ?? "primary"];
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
                ? cn(styles.activeBorder, styles.activeText)
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                active ? styles.activeDot : styles.inactiveDot,
              )}
            />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
