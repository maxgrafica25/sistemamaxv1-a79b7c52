// Editor inline de capa/contracapa personalizada para Apostila.
// Permite escolher um item de impressão do catálogo + F/V + acabamentos,
// devolvendo um V3PrintItem pronto para o Kit.
import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Info, Printer, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import PrintingItemSearch, {
  type PrintingCatalogItem,
} from "@/components/orcamentos-v3/shared/PrintingItemSearch";
import { useV3Catalog, pricePerSheet } from "../shared/useV3Catalog";
import { fmtBRL } from "../shared/pricing";
import { listFinishings, sumFinishingsPerSheet, type FinishingItem } from "@/lib/finishings/catalog";
import { resolveFinishingPricePerSheet } from "@/lib/labels/finishing-pricing";
import { genId, type V3PrintItem } from "../types";

interface Props {
  units: number;
  /** Rótulo (Capa frontal / Contracapa) usado na descrição do item. */
  slotLabel: string;
  /** Notifica o pai com o V3PrintItem atual (ou null se incompleto). */
  onChange: (item: V3PrintItem | null) => void;
  /** Callback opcional para fechar/colapsar o editor (botão Concluir). */
  onDone?: () => void;
}

export function CustomCoverEditor({ units, slotLabel, onChange, onDone }: Props) {
  const { items, tiers } = useV3Catalog();
  const [catalog, setCatalog] = useState<PrintingCatalogItem | null>(null);
  const [sideChoice, setSideChoice] = useState<"Frente" | "F/V">("Frente");
  const [pickerOpen, setPickerOpen] = useState(false);
  const duplex = sideChoice === "F/V";
  const [finishings, setFinishings] = useState<FinishingItem[]>([]);
  const [finEnabled, setFinEnabled] = useState<Record<string, boolean>>({});

  useEffect(() => {
    listFinishings("impressao").then(setFinishings).catch(() => setFinishings([]));
  }, []);

  // Capa = 1 folha física por apostila. Se F/V e catálogo "Só frente", x2.
  const sheetsPerUnit = catalog?.side === "F/V" ? 1 : duplex ? 2 : 1;
  const totalSheets = Math.max(1, units * sheetsPerUnit);

  const selections = useMemo(() => {
    return finishings
      .filter((f) => finEnabled[f.id])
      .map((f) => {
        const effective =
          f.pricing_model === "per_sheet"
            ? resolveFinishingPricePerSheet(f.price_per_sheet, f.tiers ?? [], totalSheets)
            : f.price_per_sheet;
        return {
          id: f.id,
          name: f.name,
          pricing_model: f.pricing_model,
          unit_label: f.unit_label,
          price: effective,
          cost: effective,
        };
      });
  }, [finishings, finEnabled, totalSheets]);

  const item = useMemo<V3PrintItem | null>(() => {
    if (!catalog || units <= 0) return null;
    const pr = pricePerSheet(catalog, tiers, totalSheets);
    const { perSheet, perUnitTotal } = sumFinishingsPerSheet(selections, totalSheets);
    const extra = perSheet + (totalSheets > 0 ? perUnitTotal / totalSheets : 0);
    const finLabels = finishings.filter((f) => finEnabled[f.id]).map((f) => f.name);
    const desc = `${slotLabel} — ${catalog.paper_type}${catalog.grammage ? ` ${catalog.grammage}` : ""} ${catalog.size}${finLabels.length ? ` + ${finLabels.join(" + ")}` : ""}`;
    return {
      id: genId(),
      kind: "print",
      descricao: desc,
      quantidade: totalSheets,
      tier_group_id: null,
      catalog_item_id: catalog.id,
      paper_type: catalog.paper_type,
      grammage: catalog.grammage,
      size: catalog.size,
      side: catalog.side,
      printer_category_id: catalog.printer_category_id,
      markup_group_id: catalog.markup_group_id,
      valor_unitario: pr.sellingPrice + extra,
      custo_unitario: pr.baseCost + extra,
      formato: null,
      cores: null,
      face: catalog.side === "F/V" || duplex ? "fv" : "frente",
      finishings: finLabels,
      finishing_selections: selections,
    };
  }, [catalog, tiers, units, totalSheets, selections, duplex, slotLabel, finishings, finEnabled]);

  useEffect(() => {
    onChange(item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const subtotal = item ? item.valor_unitario * item.quantidade : 0;

  return (
    <div className="mt-2 ml-6 p-2.5 rounded-md border border-border bg-background space-y-2.5">
      <div>
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Papel da {slotLabel.toLowerCase()}
        </Label>
        
        <div className="mt-1 flex items-center gap-2 mb-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            Lado
          </span>
          <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setSideChoice("Frente");
                if (catalog?.side === "F/V") setCatalog(null);
              }}
              className={cn(
                "px-2 py-0.5 rounded-sm font-medium transition-colors",
                (catalog?.side === "F/V" ? "F/V" : sideChoice) === "Frente"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Frente
            </button>
            <button
              type="button"
              onClick={() => setSideChoice("F/V")}
              className={cn(
                "px-2 py-0.5 rounded-sm font-medium transition-colors",
                (catalog?.side === "F/V" ? "F/V" : sideChoice) === "F/V"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              F/V
            </button>
          </div>
        </div>

        {/* Papel selecionado */}
        <div className="rounded-md border border-border bg-muted/20 px-3 py-2 flex items-center gap-3">
          {catalog ? (
            <>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Printer className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-foreground truncate">
                  {catalog.paper_type} {catalog.grammage && `${catalog.grammage}g`}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {catalog.size} · {catalog.side === "F/V" ? "F/V" : sideChoice} · {catalog.category_name}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Printer className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate text-muted-foreground leading-none">
                  Selecionar papel
                </p>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            {catalog ? "Trocar" : "Escolher"}
          </button>
        </div>

        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-w-3xl w-[95vw] h-[90vh] sm:h-[80vh] flex flex-col p-0 overflow-hidden gap-0">
            <DialogHeader className="px-6 py-4 border-b bg-muted/20 shrink-0">
              <div className="flex items-center justify-between gap-4">
                <DialogTitle className="inline-flex items-center gap-2 text-base">
                  <Printer className="h-4 w-4 text-primary" />
                  Papel da {slotLabel.toLowerCase()}
                </DialogTitle>
                
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-background/50 px-2 py-1 rounded border border-border/50">
                  <Info className="h-3 w-3" />
                  Lado: <span className="font-bold text-primary uppercase">{sideChoice}</span>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-hidden flex flex-col p-6 pt-4">
              <PrintingItemSearch
                items={sideChoice === "Frente" ? items.filter((it) => it.side !== "F/V") : items}
                markupTiers={tiers}
                globalSettings={{
                  invoice_pct: 0,
                  collection_pct: 0,
                  waste_pct: 0,
                  default_margin_pct: 20,
                }}
                inline
                onSelect={(it) => {
                  setCatalog(it);
                  setPickerOpen(false);
                }}
                placeholder="Buscar papel..."
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>


      {finishings.length > 0 && (
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Acabamentos (ex.: Laminação BOPP)
          </Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {finishings.map((f) => {
              const on = !!finEnabled[f.id];
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    setFinEnabled((prev) => ({ ...prev, [f.id]: !prev[f.id] }))
                  }
                  className={
                    "px-2 py-0.5 rounded-full text-[10.5px] border transition-colors " +
                    (on
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "bg-background border-border text-muted-foreground hover:border-primary/30")
                  }
                >
                  {f.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {item && (
        <div className="flex items-center justify-between gap-2 text-[11px] pt-1 border-t border-border/40">
          <span className="text-muted-foreground">
            {totalSheets} folha{totalSheets > 1 ? "s" : ""} de impressão
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-semibold tabular-nums">
              {fmtBRL(subtotal)}
            </Badge>
            {onDone && (
              <Button size="sm" onClick={onDone} className="h-7 text-[11px]">
                <Check className="h-3.5 w-3.5 mr-1" /> Concluir
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
