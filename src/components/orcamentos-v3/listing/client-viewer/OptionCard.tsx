import { Check, Sparkles, TrendingDown } from "lucide-react";
import type { QuoteOption } from "@/lib/quotes-v2/options";
import { cn } from "@/lib/utils";

interface Props {
  option: QuoteOption;
  selected: boolean;
  onSelect: () => void;
  readOnly?: boolean;
  /** Marca a opção como "melhor custo-benefício" (menor preço unitário). */
  isBest?: boolean;
  /** Preço unitário da opção mais cara — usado para calcular a economia exibida. */
  reference_unit_price?: number;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function OptionCard({
  option,
  selected,
  onSelect,
  readOnly = false,
  isBest = false,
  reference_unit_price,
}: Props) {
  const savingsPct =
    reference_unit_price && reference_unit_price > option.unit_price
      ? ((reference_unit_price - option.unit_price) / reference_unit_price) * 100
      : 0;
  const hasSavings = savingsPct >= 1;

  const containerClass = cn(
    "relative text-left rounded-xl border-2 bg-card p-4 transition-all",
    !readOnly && "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
    selected
      ? "border-primary shadow-md ring-1 ring-primary/20"
      : isBest
        ? "border-primary/60 shadow-sm"
        : "border-border",
    !readOnly && !selected && !isBest && "hover:border-primary/40",
  );

  const inner = (
    <>
      {isBest && (
        <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
          <Sparkles className="h-3 w-3" />
          Melhor custo-benefício
        </span>
      )}
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

      {hasSavings && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-green-500/10 px-1.5 py-0.5 text-[11px] font-medium text-green-700 dark:text-green-400">
          <TrendingDown className="h-3 w-3" />
          {savingsPct.toFixed(0)}% mais barato por unidade
        </p>
      )}
    </>
  );

  if (readOnly) {
    return <div className={containerClass}>{inner}</div>;
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={containerClass}
    >
      {inner}
    </button>
  );
}
