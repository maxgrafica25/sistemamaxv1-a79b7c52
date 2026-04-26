import { Check } from "lucide-react";
import type { QuoteOption } from "@/lib/quotes-v2/options";
import { cn } from "@/lib/utils";

interface Props {
  option: QuoteOption;
  selected: boolean;
  onSelect: () => void;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function OptionCard({ option, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative text-left rounded-xl border-2 bg-card p-4 transition-all",
        "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        selected
          ? "border-primary shadow-md ring-1 ring-primary/20"
          : "border-border hover:border-primary/40",
      )}
    >
      {selected && (
        <span className="absolute top-3 right-3 inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground">
          <Check className="h-3.5 w-3.5" />
        </span>
      )}
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Quantidade</p>
      <p className="text-lg font-bold text-foreground mt-0.5">{option.label}</p>

      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-2xl font-bold text-primary">{formatBRL(option.total)}</p>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {formatBRL(option.unit_price)} / un
      </p>
    </button>
  );
}
