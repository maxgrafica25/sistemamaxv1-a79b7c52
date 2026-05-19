import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Trash2,
  Printer,
  Megaphone,
  Handshake,
  BookOpen,
  Wrench,
  Package,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { V3Item } from "../types";
import { priceOf, fmtBRL } from "../shared/pricing";

interface Props {
  items: V3Item[];
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  highlightId?: string | null;
}

const ICON = {
  print: Printer,
  cv: Megaphone,
  third: Handshake,
  booklet: BookOpen,
  labor: Wrench,
  supply: Package,
};

const LABEL = {
  print: "Impressão",
  cv: "Com. Visual",
  third: "Terceirizado",
  booklet: "Apostila",
  labor: "Mão-de-obra",
  supply: "Suprimento",
};

function cartMeta(it: V3Item): string {
  switch (it.kind) {
    case "labor":
      return `${it.time_minutes} min · margem ${it.margem_pct.toFixed(0)}%`;
    case "booklet":
      return `${it.bookletUnits}× ${it.bookletPages}fl${it.bookletDuplex ? " F/V" : ""}`;
    case "supply":
    case "third":
    case "print":
    case "cv":
      return `qtd ${it.quantidade ?? 1}`;
  }
}



export function UnifiedCart({ items, onDuplicate, onRemove, highlightId }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-6 text-center">
        <ShoppingCart className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          Configure no painel à esquerda e adicione ao orçamento.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((it) => {
        const Icon = ICON[it.kind];
        const price = priceOf(it).preco_total;
        const isNew = highlightId === it.id;
        return (
          <li
            key={it.id}
            className={cn(
              "group rounded-md border border-border/60 bg-card p-3 transition-all",
              isNew && "ring-2 ring-emerald-500/50 animate-in fade-in slide-in-from-right-2",
            )}
          >
            <div className="flex items-start gap-2">
              <div className="rounded bg-primary/10 p-1.5 text-primary shrink-0">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-tight truncate">
                    {(it as { descricao?: string }).descricao || LABEL[it.kind]}
                  </p>
                  <span className="text-sm font-semibold tabular-nums shrink-0">
                    {fmtBRL(price)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                    {LABEL[it.kind]}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">{cartMeta(it)}</span>
                </div>

              </div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => onDuplicate(it.id)}
              >
                <Copy className="h-3 w-3 mr-1" /> Duplicar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => onRemove(it.id)}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Excluir
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
