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
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
