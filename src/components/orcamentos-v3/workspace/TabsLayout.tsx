import { Printer, Megaphone, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import type { V3Category } from "../types";

export const TABS: { id: V3Category; label: string; icon: typeof Printer; shortcut: string }[] = [
  { id: "print", label: "Impressão + Acabamentos", icon: Printer, shortcut: "Alt+1" },
  { id: "cv", label: "Comunicação Visual", icon: Megaphone, shortcut: "Alt+2" },
  { id: "third", label: "Materiais Terceirizados", icon: Handshake, shortcut: "Alt+3" },
];

interface Props {
  active: V3Category;
  onChange: (id: V3Category) => void;
}

export function TabsLayout({ active, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Categoria do item"
      className="flex items-end gap-4 md:gap-6 border-b border-border overflow-x-auto"
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative pb-3 pt-2 flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{t.label}</span>
            <kbd
              className={cn(
                "ml-1 hidden md:inline text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60",
                isActive ? "text-foreground/60" : "text-muted-foreground/60",
              )}
            >
              {t.shortcut}
            </kbd>
            <span
              className={cn(
                "absolute left-0 right-0 -bottom-px h-0.5 rounded-t transition-all",
                isActive ? "bg-primary" : "bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
