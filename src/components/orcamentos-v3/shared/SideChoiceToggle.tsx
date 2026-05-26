import { cn } from "@/lib/utils";
import type { PrintingCatalogItem } from "./PrintingItemSearch";

export type SideChoice = "Frente" | "F/V";

interface Props {
  value: SideChoice;
  onChange: (v: SideChoice) => void;
  className?: string;
  label?: string;
}

/**
 * Toggle "Lado de impressão" reutilizado em todos os forms de impressão V3.
 * Aparece SEMPRE antes da seleção de papel, mesmo sem item escolhido.
 */
export function SideChoiceToggle({
  value,
  onChange,
  className,
  label = "Lado de impressão",
}: Props) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5 text-xs">
        <button
          type="button"
          onClick={() => onChange("Frente")}
          className={cn(
            "px-2.5 py-1 rounded-sm font-medium transition-colors",
            value === "Frente"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          title="Imprimir só na frente"
        >
          Frente
        </button>
        <button
          type="button"
          onClick={() => onChange("F/V")}
          className={cn(
            "px-2.5 py-1 rounded-sm font-medium transition-colors",
            value === "F/V"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          title="Frente e verso (custo ~2x)"
        >
          F/V
        </button>
      </div>
    </div>
  );
}

/**
 * Filtra itens do catálogo de impressão pelo lado escolhido:
 * - "Frente": esconde itens cadastrados como F/V
 * - "F/V":    esconde itens cadastrados como "Frente", exceto os que tenham fv_exception=true
 *
 * Aceita tanto "F" quanto "Frente" como representação do lado "só frente".
 */
export function filterItemsBySideChoice<T extends Pick<PrintingCatalogItem, "side" | "fv_exception">>(
  items: T[],
  side: SideChoice,
): T[] {
  if (side === "Frente") {
    return items.filter((it) => (it.side || "").toUpperCase() !== "F/V");
  }
  // F/V — só papéis F/V do catálogo, mais as exceções marcadas
  return items.filter(
    (it) => (it.side || "").toUpperCase() === "F/V" || it.fv_exception === true,
  );
}

/** Verdadeiro quando o item atualmente selecionado deixa de ser válido para o novo lado. */
export function shouldClearOnSideChange(
  current: Pick<PrintingCatalogItem, "side" | "fv_exception"> | null | undefined,
  newSide: SideChoice,
): boolean {
  if (!current) return false;
  const s = (current.side || "").toUpperCase();
  if (newSide === "Frente") return s === "F/V";
  // F/V
  return s !== "F/V" && current.fv_exception !== true;
}
