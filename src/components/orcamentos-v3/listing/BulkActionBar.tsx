import { Button } from "@/components/ui/button";
import { Trash2, X, ArrowUp } from "lucide-react";

interface BulkActionBarProps {
  count: number;
  totalValue: number;
  onClear: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function BulkActionBar({ count, totalValue, onClear, onDelete, canDelete }: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-2.5 shadow-lg">
        <div className="flex items-center gap-2 text-sm">
          <ArrowUp className="h-4 w-4 text-primary" />
          <span className="font-medium">{String(count).padStart(2, "0")}</span>
          <span className="text-muted-foreground">selecionado{count > 1 ? "s" : ""}</span>
        </div>

        <div className="h-5 w-px bg-border" />

        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Excluir orçamentos
          </Button>
        )}

        <Button size="sm" variant="ghost" className="gap-1.5" onClick={onClear}>
          <X className="h-4 w-4" />
          Limpar
        </Button>

        <div className="h-5 w-px bg-border" />

        <div className="flex flex-col text-right text-xs leading-tight">
          <span className="font-semibold text-primary">{formatBRL(totalValue)}</span>
          <span className="text-muted-foreground">valor total</span>
        </div>
      </div>
    </div>
  );
}
