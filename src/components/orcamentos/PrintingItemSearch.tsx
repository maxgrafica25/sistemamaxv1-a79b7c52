import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Printer } from "lucide-react";

export interface MarkupTier {
  id: string;
  printer_category_id: string;
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
  totalCostA4: number;
}

interface PrintingItemSearchProps {
  items: PrintingCatalogItem[];
  onSelect: (item: PrintingCatalogItem) => void;
  markupTiers?: MarkupTier[];
}

const roundUp10 = (v: number) => Math.ceil(v * 10) / 10;
const isLargerThanA4 = (size: string) => /^(A3|SRA3|A2|A1|A0)/i.test(size);

const calcSellingPrice = (baseCost: number, tier: MarkupTier) => {
  const soma = (tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct) / 100;
  const divisor = 1 - soma;
  if (divisor <= 0) return 0;
  return Math.round((baseCost / divisor) * 10) / 10;
};

export default function PrintingItemSearch({ items, onSelect }: PrintingItemSearchProps) {
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

  const getSizeLabel = (item: PrintingCatalogItem) => {
    const sizeMult = isLargerThanA4(item.size) ? 2 : 1;
    const sideMult = item.side === "F/V" ? 2 : 1;
    const printCost = roundUp10(item.printing_cost * sizeMult * sideMult);
    const totalPerSheet = item.paper_cost + printCost;
    return totalPerSheet;
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
              const costPerSheet = getSizeLabel(item);
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-accent transition-colors border-b last:border-0"
                >
                  <Printer className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {item.paper_type} {item.grammage && `${item.grammage}`} — {item.size} {item.side}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{item.category_name}</span>
                      {item.equipment_name && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                          {item.equipment_name}{item.equipment_mode === "pb" ? " (PB)" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-primary shrink-0">
                    R$ {costPerSheet.toFixed(2)}/folha
                  </span>
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
