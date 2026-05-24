import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Printer, Link2, AlertTriangle } from "lucide-react";

export interface LinkedPaperInfo {
  id: string;
  name: string;
  grammage: string | null;
  sheet_qty: number;
  is_cut_size: boolean;
  unit_cost: number;
  /** Label like "Caixa 5.000 fl" or "Pacote 500 fl". */
  packaging_label: string;
}

export interface MarkupTier {
  id: string;
  printer_category_id: string;
  markup_group_id: string | null;
  label: string;
  min_qty: number;
  max_qty: number | null;
  fixed_cost_pct: number;
  variable_cost_pct: number;
  margin_pct: number;
  sort_order: number;
}

export interface PrintingCatalogItem {
  id: string;
  paper_type: string;
  grammage: string | null;
  size: string;
  side: string;
  paper_cost: number;
  printing_cost: number;
  equipment_name: string | null;
  equipment_mode: string;
  category_name: string;
  printer_category_id: string;
  markup_group_id: string | null;
  totalCostA4: number;
  is_cut_size?: boolean | null;
  purchase_sheet_width_mm?: number | null;
  purchase_sheet_height_mm?: number | null;
  /** Vínculo (implícito por nome+gramatura) com o papel da Matéria-Prima. */
  linkedPaper?: LinkedPaperInfo | null;
}

interface PrintingItemSearchProps {
  items: PrintingCatalogItem[];
  onSelect: (item: PrintingCatalogItem) => void;
  markupTiers?: MarkupTier[];
  globalSettings?: { invoice_pct: number; collection_pct: number; waste_pct: number; default_margin_pct: number };
  placeholder?: string;
}

const roundUp5 = (v: number) => Math.round(v * 10) / 10;
const isLargerThanA4 = (size: string) => /^(A3|SRA3|A2|A1|A0)/i.test(size);

const calcSellingPrice = (baseCost: number, tier: MarkupTier, _globals?: { invoice_pct: number; collection_pct: number; waste_pct: number }) => {
  const soma = (tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct) / 100;
  const divisor = 1 - soma;
  if (divisor <= 0) return 0;
  return Math.round((baseCost / divisor) * 10) / 10;
};

export default function PrintingItemSearch({ items, onSelect, markupTiers, globalSettings }: PrintingItemSearchProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = items.filter(m => {
    const label = `${m.paper_type} ${m.grammage || ""} ${m.size} ${m.side} ${m.equipment_name || ""} ${m.category_name}`.toLowerCase();
    return label.includes(search.toLowerCase());
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (item: PrintingCatalogItem) => {
    onSelect(item);
    setSearch("");
    setIsOpen(false);
  };

  const getItemPrices = (item: PrintingCatalogItem) => {
    const sizeMult = isLargerThanA4(item.size) ? 2 : 1;
    const sideMult = item.side === "F/V" ? 2 : 1;
    const printCost = roundUp5(item.printing_cost * sizeMult * sideMult);
    const baseCost = item.paper_cost + printCost;
    // Find first tier: use item's markup_group_id, fallback to printer_category_id
    const tier = markupTiers?.find(t =>
      item.markup_group_id
        ? t.markup_group_id === item.markup_group_id
        : t.printer_category_id === item.printer_category_id
    );
    const sellingPrice = tier ? calcSellingPrice(baseCost, tier, globalSettings) : baseCost;
    return { baseCost, sellingPrice, tierLabel: tier?.label };
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar item de impressão (papel, tamanho, impressora)..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          className="pl-10"
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-80 overflow-auto">
          {filtered.length > 0 ? (
            filtered.map((item) => {
              const { baseCost, sellingPrice, tierLabel } = getItemPrices(item);
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-0"
                >
                  <Printer className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {item.paper_type} {item.grammage && `${item.grammage}`} — {item.size} {item.side}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground group-hover:text-white/80">{item.category_name}</span>
                      {item.equipment_name && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {item.equipment_name}{item.equipment_mode === "pb" ? " (PB)" : ""}
                        </Badge>
                      )}
                      {tierLabel && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{tierLabel}</Badge>
                      )}
                    </div>
                    {item.linkedPaper ? (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-foreground/80 group-hover:text-white truncate">
                        <Link2 className="h-3 w-3 shrink-0 text-primary group-hover:text-white" />
                        <span className="truncate">
                          <span className="text-muted-foreground group-hover:text-white/80">vinculado a:</span>{" "}
                          <span className="font-medium">
                            {item.linkedPaper.name}
                            {item.linkedPaper.grammage ? ` ${item.linkedPaper.grammage}` : ""}
                          </span>
                          <span className="text-muted-foreground group-hover:text-white/80"> · {item.linkedPaper.packaging_label} · </span>
                          <span className="font-medium">R$ {item.linkedPaper.unit_cost.toFixed(4)}/fl</span>
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 group-hover:text-white truncate">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        sem papel vinculado em Matérias-Primas
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-semibold text-primary group-hover:text-white">
                      R$ {sellingPrice.toFixed(2)}/folha
                    </span>
                    {sellingPrice !== baseCost && (
                      <p className="text-[10px] text-muted-foreground group-hover:text-white/80">custo: R$ {baseCost.toFixed(2)}</p>
                    )}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum item de impressão encontrado
            </div>
          )}
        </div>
      )}
    </div>
  );
}
