import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}

export function ModeButton({ active, onClick, icon: Icon, label }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium cursor-pointer transition-all",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground hover:bg-background/60",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", active && "text-primary")} />
      {label}
    </button>
  );
}
