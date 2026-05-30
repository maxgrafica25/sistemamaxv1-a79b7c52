import { useState, useRef, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Printer, Link2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

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

export type PaperCategory = "comum" | "especial" | "adesivo";

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
  /** Categoria derivada de `papers.category` (null quando não há match). */
  paper_category?: PaperCategory | null;
  /** Quando true, este papel "Frente" também aparece quando o usuário escolhe F/V. */
  fv_exception?: boolean;
}

interface PrintingItemSearchProps {
  items: PrintingCatalogItem[];
  onSelect: (item: PrintingCatalogItem) => void;
  markupTiers?: MarkupTier[];
  globalSettings?: { invoice_pct: number; collection_pct: number; waste_pct: number; default_margin_pct: number };
  placeholder?: string;
  /** Pré-seleção opcional do chip de categoria (vindo de um produto favorito). */
  defaultCategory?: PaperCategory | null;
}

const roundUp5 = (v: number) => Math.round(v * 10) / 10;
const isLargerThanA4 = (size: string) => /^(A3|SRA3|A2|A1|A0)/i.test(size);

const CATEGORY_ORDER: PaperCategory[] = ["especial", "comum", "adesivo"];
const CATEGORY_LABEL: Record<PaperCategory, string> = {
  comum: "Comum",
  especial: "Especial",
  adesivo: "Adesivo",
};

const calcSellingPrice = (baseCost: number, tier: MarkupTier, _globals?: { invoice_pct: number; collection_pct: number; waste_pct: number }) => {
  const soma = (tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct) / 100;
  const divisor = 1 - soma;
  if (divisor <= 0) return 0;
  return Math.round((baseCost / divisor) * 10) / 10;
};

export default function PrintingItemSearch({ items, onSelect, markupTiers, globalSettings, placeholder, defaultCategory }: PrintingItemSearchProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<"all" | PaperCategory>("all");
  const containerRef = useRef<HTMLDivElement>(null);

  // Aplica pré-seleção quando muda (ex.: usuário troca de favorito).
  useEffect(() => {
    if (defaultCategory) setCategoryFilter(defaultCategory);
    else setCategoryFilter("all");
  }, [defaultCategory]);

  const matchesText = (m: PrintingCatalogItem) => {
    const label = `${m.paper_type} ${m.grammage || ""} ${m.size} ${m.side} ${m.equipment_name || ""} ${m.category_name}`.toLowerCase();
    return label.includes(search.toLowerCase());
  };

  const textMatches = useMemo(() => items.filter(matchesText), [items, search]);

  const counts = useMemo(() => {
    const c: Record<PaperCategory, number> = { comum: 0, especial: 0, adesivo: 0 };
    for (const it of items) {
      if (it.paper_category) c[it.paper_category]++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return textMatches;
    return textMatches.filter((m) => m.paper_category === categoryFilter);
  }, [textMatches, categoryFilter]);

  const otherCategoriesCount = useMemo(() => {
    if (categoryFilter === "all" || !search.trim()) return 0;
    return textMatches.length - filtered.length;
  }, [textMatches, filtered, categoryFilter, search]);

  // Agrupamento por categoria quando "Todos" está ativo.
  const grouped = useMemo(() => {
    if (categoryFilter !== "all") return null;
    const map = new Map<PaperCategory | "outros", PrintingCatalogItem[]>();
    for (const it of filtered) {
      const k = (it.paper_category ?? "outros") as PaperCategory | "outros";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    const order: (PaperCategory | "outros")[] = [...CATEGORY_ORDER, "outros"];
    return order.filter((k) => map.has(k) && map.get(k)!.length > 0).map((k) => ({ key: k, items: map.get(k)! }));
  }, [filtered, categoryFilter]);

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
    const tier = markupTiers?.find(t =>
      item.markup_group_id
        ? t.markup_group_id === item.markup_group_id
        : t.printer_category_id === item.printer_category_id
    );
    const sellingPrice = tier ? calcSellingPrice(baseCost, tier, globalSettings) : baseCost;
    return { baseCost, sellingPrice, tierLabel: tier?.label };
  };

  const totalCount = items.length;
  const chips: { key: "all" | PaperCategory; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: totalCount },
    { key: "comum", label: "Comum", count: counts.comum },
    { key: "especial", label: "Especial", count: counts.especial },
    { key: "adesivo", label: "Adesivo", count: counts.adesivo },
  ];

  const renderItem = (item: PrintingCatalogItem) => {
    const { baseCost, sellingPrice, tierLabel } = getItemPrices(item);
    return (
      <button
        key={item.id}
        onClick={() => handleSelect(item)}
        className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-all hover:bg-primary/5 active:scale-[0.98]"
      >
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
          <Printer className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="font-bold text-sm text-foreground truncate">
              {item.paper_type} {item.grammage && `${item.grammage}`}
            </p>
            <span className="text-[10px] font-medium text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
              {item.size} · {item.side}
            </span>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] font-medium text-primary/80">{item.category_name}</span>
            {item.equipment_name && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                via {item.equipment_name}{item.equipment_mode === "pb" ? " (PB)" : ""}
              </span>
            )}
            {tierLabel && (
              <Badge variant="secondary" className="text-[9px] h-3.5 px-1 uppercase tracking-tighter">{tierLabel}</Badge>
            )}
          </div>

          {item.linkedPaper ? (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/90 bg-muted/30 px-2 py-1 rounded-md w-fit max-w-full">
              <Link2 className="h-3 w-3 shrink-0 text-primary/60" />
              <span className="truncate leading-none">
                Estoque: <span className="font-semibold text-foreground/70">{item.linkedPaper.name} {item.linkedPaper.grammage ?? ""}</span>
                <span className="mx-1 opacity-30">|</span>
                <span className="font-medium">R$ {item.linkedPaper.unit_cost.toFixed(2)}/fl</span>
              </span>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-amber-600/80 italic">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Papel não vinculado ao estoque
            </div>
          )}
        </div>

        <div className="text-right shrink-0 border-l border-border/50 pl-4">
          <div className="text-sm font-black text-primary">
            R$ {sellingPrice.toFixed(2)}
            <span className="text-[10px] font-normal text-muted-foreground ml-0.5">/fl</span>
          </div>
          {sellingPrice !== baseCost && (
            <p className="text-[9px] font-medium text-muted-foreground/60 uppercase">Custo: {baseCost.toFixed(2)}</p>
          )}
        </div>
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      {/* Chips de categoria */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {chips.map((c) => {
          const active = categoryFilter === c.key;
          const disabled = c.key !== "all" && c.count === 0;
          return (
            <button
              key={c.key}
              type="button"
              disabled={disabled}
              onClick={() => setCategoryFilter(c.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm scale-105"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50",
                disabled && "opacity-30 cursor-not-allowed",
              )}
            >
              {c.label}
              <span className={cn(
                "flex items-center justify-center rounded-full h-4 min-w-[16px] px-1 text-[9px] font-black",
                active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              )}>
                {c.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={placeholder ?? "Buscar item de impressão (papel, tamanho, impressora)..."}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          className="pl-10"
        />
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-80 overflow-auto">
          {filtered.length > 0 ? (
            grouped ? (
              grouped.map((g) => (
                <div key={g.key}>
                  <div className="sticky top-0 z-10 bg-muted/80 backdrop-blur px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground border-b">
                    {g.key === "outros" ? "Outros" : CATEGORY_LABEL[g.key as PaperCategory]} · {g.items.length}
                  </div>
                  {g.items.map(renderItem)}
                </div>
              ))
            ) : (
              filtered.map(renderItem)
            )
          ) : (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum item de impressão encontrado{categoryFilter !== "all" ? ` em "${CATEGORY_LABEL[categoryFilter]}"` : ""}
            </div>
          )}
          {otherCategoriesCount > 0 && (
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className="w-full border-t bg-muted/40 px-3 py-2 text-left text-xs text-primary hover:bg-muted/60"
            >
              +{otherCategoriesCount} resultado{otherCategoriesCount > 1 ? "s" : ""} em outras categorias — ver todos
            </button>
          )}
          {filtered.length > 0 && (
            <div className="sticky bottom-0 border-t bg-muted/60 px-3 py-1.5 flex items-start gap-1.5 text-[10px] text-muted-foreground">
              <Info className="h-3 w-3 shrink-0 mt-0.5" />
              <span>Preço/folha calculado <strong>por dentro</strong> via faixa de markup da categoria (custo fixo + variável + margem embutidos). Não afetado pelo regime global.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
