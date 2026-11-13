// Lista de fotos com cópias, legenda, filtro e enquadramento: peça comum da Polaroid e das Fotos 3×4.

import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FILTROS, MAX_COPIAS } from "@/lib/preimpressao/polaroid";
import type { ItemFoto } from "./useListaDeFotos";

export function LinhaDeFoto({
  item,
  placeholderLegenda,
  comLegenda = true,
  onMudar,
  onRemover,
  onEnquadrar,
}: {
  item: ItemFoto;
  /** Texto cinza da legenda (o que vale se ficar vazia). */
  placeholderLegenda?: string;
  comLegenda?: boolean;
  onMudar: (p: Partial<ItemFoto>) => void;
  onRemover: () => void;
  onEnquadrar: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-background p-2 ring-1 ring-border/60">
      <img src={item.url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground" title={item.foto.nome}>
            {item.foto.nome}
          </p>
          <button type="button" aria-label={`Remover ${item.foto.nome}`} className="text-muted-foreground hover:text-destructive" onClick={onRemover}>
            <X className="h-4 w-4" />
          </button>
        </div>
        {comLegenda && (
          <input
            value={item.legenda}
            onChange={(e) => onMudar({ legenda: e.target.value.slice(0, 60) })}
            placeholder={placeholderLegenda || "Legenda (opcional)"}
            aria-label={`Legenda de ${item.foto.nome}`}
            className="h-8 w-full rounded-full bg-muted/60 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Menos uma cópia" className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/70 hover:bg-muted" onClick={() => onMudar({ qtd: Math.max(1, item.qtd - 1) })}>
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-16 text-center text-sm font-semibold tabular-nums">
              {item.qtd} cópia{item.qtd > 1 ? "s" : ""}
            </span>
            <button type="button" aria-label="Mais uma cópia" className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/70 hover:bg-muted" onClick={() => onMudar({ qtd: Math.min(MAX_COPIAS, item.qtd + 1) })}>
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <select
              value={item.filtro}
              aria-label={`Filtro de ${item.foto.nome}`}
              onChange={(e) => onMudar({ filtro: e.target.value as ItemFoto["filtro"] })}
              className="h-7 rounded-full bg-muted/70 px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <option value="padrao">Filtro geral</option>
              {FILTROS.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
            <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs" onClick={onEnquadrar}>
              Enquadrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
