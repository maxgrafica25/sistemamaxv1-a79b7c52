import {
  Printer,
  Megaphone,
  Handshake,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { V3Category } from "../types";

export interface TabDef {
  id: V3Category;
  label: string;
  icon: LucideIcon;
  shortcut: string;
  description: string;
}

export const TABS: TabDef[] = [
  {
    id: "print",
    label: "Impressão + Acabamentos",
    icon: Printer,
    shortcut: "Alt+1",
    description: "Itens impressos no parque próprio (folhetos, apostilas, etiquetas).",
  },
  {
    id: "cv",
    label: "Com. Visual",
    icon: Megaphone,
    shortcut: "Alt+2",
    description: "Mídia em grande formato, lonas, adesivos e aplicação.",
  },
  {
    id: "third",
    label: "Terceirizados",
    icon: Handshake,
    shortcut: "Alt+3",
    description: "Serviços e produtos executados por fornecedores externos.",
  },
];

export function getTab(id: V3Category): TabDef {
  return TABS.find((t) => t.id === id) ?? TABS[0];
}

interface Props {
  active: V3Category;
  onChange: (id: V3Category) => void;
}

export function TabsLayout({ active, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Categoria do item"
      className="flex items-end gap-1 md:gap-2 border-b border-border overflow-x-auto"
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
              "relative px-3 md:px-4 pt-2 pb-3 flex items-center gap-2 text-sm font-medium whitespace-nowrap rounded-t-md transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            />
            <span>{t.label}</span>
            <kbd
              className={cn(
                "ml-1 hidden lg:inline text-[10px] font-mono px-1.5 py-0.5 rounded border",
                isActive
                  ? "border-primary/30 text-primary/70"
                  : "border-border/60 text-muted-foreground/60",
              )}
            >
              {t.shortcut}
            </kbd>
            <span
              className={cn(
                "absolute left-1 right-1 -bottom-px rounded-t transition-all",
                isActive ? "h-1 bg-primary" : "h-0 bg-transparent",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
