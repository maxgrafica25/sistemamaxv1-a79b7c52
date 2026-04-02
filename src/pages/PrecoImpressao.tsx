import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus, Printer, Settings2, Trash2, Edit2, Calculator, Layers, Cpu, Info,
  RefreshCw, FileText, Check, AlertCircle, HelpCircle, ChevronDown, Lightbulb,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";

// ─── Types ───────────────────────────────────────────────────────────
interface PrinterCategory {
  id: string; name: string; description: string | null; sort_order: number;
}
interface MarkupTier {
  id: string; printer_category_id: string; label: string;
  min_qty: number; max_qty: number | null;
  fixed_cost_pct: number; variable_cost_pct: number; margin_pct: number;
  sort_order: number;
}
interface PrintingPriceItem {
  id: string; printer_category_id: string; code: string | null;
  paper_type: string; grammage: string | null; size: string; side: string;
  paper_cost: number; printing_cost: number; is_active: boolean;
  sort_order: number; equipment_id: string | null;
}
interface Equipment { id: string; name: string; }
interface EquipmentConsumable { equipment_id: string; price: number; yield_pages: number; }
interface PaperRecord {
  id: string; name: string; grammage: string | null;
  sheet_qty: number; pack_price: number; freight_price: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt4 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 });
const fmtPct = (v: number) => `${v.toFixed(0)}%`;

const isColorCategory = (name: string) => /color/i.test(name);
const isPBCategory = (name: string) => /p\s*[&e]?\s*b|preto\s*(e|&)\s*branco|mono/i.test(name);
const getCategoryCoverage = (name: string) => isColorCategory(name) ? 20 : 5;

const calcSellingPrice = (baseCost: number, tier: MarkupTier) => {
  const soma = (tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct) / 100;
  const divisor = 1 - soma;
  if (divisor <= 0) return 0;
  // Arredonda ao R$ 0,10 mais próximo (ex: 0,84 → 0,80; 0,85 → 0,90)
  return Math.round((baseCost / divisor) * 10) / 10;
};

const paperPriceA4 = (p: PaperRecord) => p.sheet_qty > 0 ? (p.pack_price / p.sheet_qty + p.freight_price) / 9 : 0;
const paperPriceSRA3 = (p: PaperRecord) => p.sheet_qty > 0 ? (p.pack_price / p.sheet_qty + p.freight_price) / 4 : 0;

// ─── Component ───────────────────────────────────────────────────────
export default function PrecoImpressao() {
  const [categories, setCategories] = useState<PrinterCategory[]>([]);
  const [tiers, setTiers] = useState<MarkupTier[]>([]);
  const [items, setItems] = useState<PrintingPriceItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [equipConsumables, setEquipConsumables] = useState<EquipmentConsumable[]>([]);
  const [paperRecords, setPaperRecords] = useState<PaperRecord[]>([]);

  // Dialogs
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showTierDialog, setShowTierDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PrinterCategory | null>(null);
  const [editingTier, setEditingTier] = useState<MarkupTier | null>(null);
  const [editingItem, setEditingItem] = useState<PrintingPriceItem | null>(null);

  // Confirm delete state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmItemName, setConfirmItemName] = useState("");

  // Category form
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  // Tier form
  const [tierLabel, setTierLabel] = useState("");
  const [tierMinQty, setTierMinQty] = useState("1");
  const [tierMaxQty, setTierMaxQty] = useState("");
  const [tierFixedPct, setTierFixedPct] = useState("40");
  const [tierVariablePct, setTierVariablePct] = useState("13");
  const [tierMarginPct, setTierMarginPct] = useState("33");
  // Variable cost breakdown (visual only — stored as single total)
  const [varImpostos, setVarImpostos] = useState("6");
  const [varComissao, setVarComissao] = useState("2");
  const [varPerda, setVarPerda] = useState("5");
  const [varOutros, setVarOutros] = useState("0");
  const [showVarBreakdown, setShowVarBreakdown] = useState(false);

  // Item form
  const [itemCode, setItemCode] = useState("");
  const [itemPaperType, setItemPaperType] = useState("");
  const [itemGrammage, setItemGrammage] = useState("");
  const [itemSize, setItemSize] = useState("A4");
  const [itemSide, setItemSide] = useState("F");
  const [itemPaperCost, setItemPaperCost] = useState("0");
  const [itemPrintingCost, setItemPrintingCost] = useState("0");
  const [itemEquipmentId, setItemEquipmentId] = useState<string>("");
  const [itemPaperSource, setItemPaperSource] = useState<string>("manual");
  // Coverage is auto-determined per category
  const activeCategoryObj = categories.find(c => c.id === activeCategory);
  const coveragePct = activeCategoryObj ? getCategoryCoverage(activeCategoryObj.name) : 5;

  // Sync state
  const [syncSize, setSyncSize] = useState<"A4" | "SRA3">("A4");
  const [activePaperType, setActivePaperType] = useState<string>("__all__");
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // ─── Data loading ──────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [catRes, tierRes, itemRes, eqRes, consRes, papRes] = await Promise.all([
      supabase.from("printer_categories").select("*").order("sort_order"),
      supabase.from("markup_tiers").select("*").order("sort_order"),
      supabase.from("printing_price_items").select("*").order("sort_order"),
      supabase.from("equipments").select("id, name").order("sort_order"),
      supabase.from("equipment_consumables").select("equipment_id, price, yield_pages"),
      supabase.from("papers").select("id, name, grammage, sheet_qty, pack_price, freight_price").eq("is_active", true).order("sort_order"),
    ]);
    if (catRes.data) setCategories(catRes.data);
    if (tierRes.data) setTiers(tierRes.data);
    if (itemRes.data) setItems(itemRes.data as PrintingPriceItem[]);
    if (eqRes.data) setEquipments(eqRes.data);
    if (consRes.data) setEquipConsumables(consRes.data);
    if (papRes.data) setPaperRecords(papRes.data as PaperRecord[]);
    if (catRes.data?.length && !activeCategory) setActiveCategory(catRes.data[0].id);
    setLoading(false);
  }, [activeCategory]);

  useEffect(() => { fetchAll(); }, []);

  const getEquipmentCostPerPage = (equipmentId: string, coverage: number = 20) => {
    const cons = equipConsumables.filter(c => c.equipment_id === equipmentId);
    const baseCost = cons.reduce((sum, c) => c.yield_pages <= 0 ? sum : sum + c.price / c.yield_pages, 0);
    return baseCost * (coverage / 5);
  };

  const getEquipmentName = (id: string) => equipments.find(e => e.id === id)?.name || "—";

  const activeTiers = useMemo(() => tiers.filter(t => t.printer_category_id === activeCategory).sort((a, b) => a.sort_order - b.sort_order), [tiers, activeCategory]);
  const activeItems = useMemo(() => items.filter(i => i.printer_category_id === activeCategory && i.is_active).sort((a, b) => a.sort_order - b.sort_order), [items, activeCategory]);

  // Unique paper types for sub-tabs
  const paperTypes = useMemo(() => {
    const types: string[] = [];
    activeItems.forEach(item => { if (!types.includes(item.paper_type)) types.push(item.paper_type); });
    return types;
  }, [activeItems]);

  // Filtered items by active paper type sub-tab
  const filteredItems = useMemo(() => {
    if (activePaperType === "__all__") return activeItems;
    return activeItems.filter(i => i.paper_type === activePaperType);
  }, [activeItems, activePaperType]);

  // Reset paper type sub-tab when category changes
  useEffect(() => { setActivePaperType("__all__"); }, [activeCategory]);

  const getEffectivePrintingCost = (item: PrintingPriceItem) => {
    if (item.equipment_id) return getEquipmentCostPerPage(item.equipment_id, coveragePct);
    return item.printing_cost;
  };

  // ─── Category CRUD ─────────────────────────────────────────────────
  const openCategoryDialog = (cat?: PrinterCategory) => {
    if (cat) { setEditingCategory(cat); setCatName(cat.name); setCatDesc(cat.description || ""); }
    else { setEditingCategory(null); setCatName(""); setCatDesc(""); }
    setShowCategoryDialog(true);
  };
  const saveCategory = async () => {
    if (!catName.trim()) return toast.error("Nome obrigatório");
    if (editingCategory) await supabase.from("printer_categories").update({ name: catName, description: catDesc || null }).eq("id", editingCategory.id);
    else await supabase.from("printer_categories").insert({ name: catName, description: catDesc || null, sort_order: categories.length });
    setShowCategoryDialog(false); toast.success("Categoria salva!"); fetchAll();
  };
  const deleteCategory = async (id: string) => {
    await supabase.from("printer_categories").delete().eq("id", id);
    if (activeCategory === id) setActiveCategory(""); toast.success("Categoria removida!"); fetchAll();
  };
  const requestDeleteCategory = (id: string, name: string) => {
    setConfirmItemName(name);
    setConfirmAction(() => () => deleteCategory(id));
    setConfirmOpen(true);
  };

  // ─── Tier CRUD ─────────────────────────────────────────────────────
  const openTierDialog = (tier?: MarkupTier) => {
    if (tier) {
      setEditingTier(tier); setTierLabel(tier.label); setTierMinQty(String(tier.min_qty));
      setTierMaxQty(tier.max_qty ? String(tier.max_qty) : ""); setTierFixedPct(String(tier.fixed_cost_pct));
      setTierVariablePct(String(tier.variable_cost_pct)); setTierMarginPct(String(tier.margin_pct));
      const vc = tier.variable_cost_pct;
      setVarImpostos(String(Math.round(vc * 0.46)));
      setVarComissao(String(Math.round(vc * 0.15)));
      setVarPerda(String(Math.round(vc * 0.39)));
      setVarOutros("0");
      setShowVarBreakdown(false);
    } else {
      setEditingTier(null);
      // Smart auto-fill based on existing tiers
      const nextIndex = activeTiers.length + 1;
      const lastTier = activeTiers.length > 0 ? activeTiers[activeTiers.length - 1] : null;
      const suggestedLabel = `TP${nextIndex}`;
      const suggestedMin = lastTier?.max_qty ? String(lastTier.max_qty + 1) : "1";
      // Copy percentages from last tier if available
      const lastFixed = lastTier ? String(lastTier.fixed_cost_pct) : "40";
      const lastVariable = lastTier ? String(lastTier.variable_cost_pct) : "13";
      const lastMargin = lastTier ? String(lastTier.margin_pct) : "33";
      setTierLabel(suggestedLabel); setTierMinQty(suggestedMin); setTierMaxQty("");
      setTierFixedPct(lastFixed); setTierVariablePct(lastVariable); setTierMarginPct(lastMargin);
      setVarImpostos("6"); setVarComissao("2"); setVarPerda("5"); setVarOutros("0");
      setShowVarBreakdown(false);
    }
    setShowTierDialog(true);
  };
  const saveTier = async () => {
    if (!tierLabel.trim()) return toast.error("Rótulo obrigatório");
    const data = {
      printer_category_id: activeCategory, label: tierLabel,
      min_qty: Number(tierMinQty), max_qty: tierMaxQty ? Number(tierMaxQty) : null,
      fixed_cost_pct: Number(tierFixedPct), variable_cost_pct: Number(tierVariablePct),
      margin_pct: Number(tierMarginPct), sort_order: editingTier ? editingTier.sort_order : activeTiers.length,
    };
    if (editingTier) await supabase.from("markup_tiers").update(data).eq("id", editingTier.id);
    else await supabase.from("markup_tiers").insert(data);
    setShowTierDialog(false); toast.success("Regra salva!"); fetchAll();
  };
  const deleteTier = async (id: string) => {
    await supabase.from("markup_tiers").delete().eq("id", id); toast.success("Regra removida!"); fetchAll();
  };
  const requestDeleteTier = (id: string, label: string) => {
    setConfirmItemName(label);
    setConfirmAction(() => () => deleteTier(id));
    setConfirmOpen(true);
  };

  // ─── Item CRUD ─────────────────────────────────────────────────────
  const openItemDialog = (item?: PrintingPriceItem) => {
    if (item) {
      setEditingItem(item); setItemCode(item.code || ""); setItemPaperType(item.paper_type);
      setItemGrammage(item.grammage || ""); setItemSize(item.size); setItemSide(item.side);
      setItemPaperCost(String(item.paper_cost)); setItemPrintingCost(String(item.printing_cost));
      setItemEquipmentId(item.equipment_id || ""); setItemPaperSource("manual");
    } else {
      setEditingItem(null); setItemCode(""); setItemPaperType(""); setItemGrammage("");
      setItemSize("A4"); setItemSide("F"); setItemPaperCost("0"); setItemPrintingCost("0");
      setItemEquipmentId(""); setItemPaperSource("manual");
    }
    setShowItemDialog(true);
  };

  const handlePaperSourceChange = (val: string) => {
    setItemPaperSource(val);
    if (val !== "manual") {
      const paper = paperRecords.find(p => p.id === val);
      if (paper) {
        setItemPaperType(paper.name);
        setItemGrammage(paper.grammage || "");
        const price = itemSize === "A4" || itemSize === "A5" || itemSize === "Carta"
          ? paperPriceA4(paper) : paperPriceSRA3(paper);
        setItemPaperCost(price.toFixed(4));
      }
    }
  };

  useEffect(() => {
    if (itemPaperSource !== "manual") {
      const paper = paperRecords.find(p => p.id === itemPaperSource);
      if (paper) {
        const price = itemSize === "A4" || itemSize === "A5" || itemSize === "Carta"
          ? paperPriceA4(paper) : paperPriceSRA3(paper);
        setItemPaperCost(price.toFixed(4));
      }
    }
  }, [itemSize, itemPaperSource, paperRecords]);

  const saveItem = async () => {
    if (!itemPaperType.trim()) return toast.error("Tipo de papel obrigatório");
    const effectivePrintingCost = itemEquipmentId ? getEquipmentCostPerPage(itemEquipmentId, coveragePct) : Number(itemPrintingCost);
    const data = {
      printer_category_id: activeCategory, code: itemCode || null, paper_type: itemPaperType,
      grammage: itemGrammage || null, size: itemSize, side: itemSide,
      paper_cost: Number(itemPaperCost), printing_cost: effectivePrintingCost,
      equipment_id: itemEquipmentId || null,
      sort_order: editingItem ? editingItem.sort_order : activeItems.length,
    };
    if (editingItem) await supabase.from("printing_price_items").update(data).eq("id", editingItem.id);
    else await supabase.from("printing_price_items").insert([data]);
    setShowItemDialog(false); toast.success("Item salvo!"); fetchAll();
  };

  const deleteItem = async (id: string) => {
    await supabase.from("printing_price_items").delete().eq("id", id); toast.success("Item removido!"); fetchAll();
  };
  const requestDeleteItem = (id: string, name: string) => {
    setConfirmItemName(name);
    setConfirmAction(() => () => deleteItem(id));
    setConfirmOpen(true);
  };

  // ─── Sync paper prices ────────────────────────────────────────────
  const syncPaperPrices = async () => {
    let updated = 0;
    for (const item of activeItems) {
      const match = paperRecords.find(p => {
        const nameMatch = p.name.toLowerCase() === item.paper_type.toLowerCase();
        const gramMatch = !item.grammage || !p.grammage || p.grammage.toLowerCase() === item.grammage.toLowerCase();
        return nameMatch && gramMatch;
      });
      if (match) {
        const newCost = (item.size === "A4" || item.size === "A5" || item.size === "Carta")
          ? paperPriceA4(match) : paperPriceSRA3(match);
        if (Math.abs(newCost - item.paper_cost) > 0.0001) {
          await supabase.from("printing_price_items").update({ paper_cost: Number(newCost.toFixed(4)) }).eq("id", item.id);
          updated++;
        }
      }
    }
    setShowSyncDialog(false);
    if (updated > 0) {
      toast.success(`${updated} item(ns) atualizado(s) com os preços mais recentes!`);
      fetchAll();
    } else {
      toast.info("Nenhuma alteração necessária — preços já estão atualizados.");
    }
  };

  // Summary
  const avgMargin = activeTiers.length ? activeTiers.reduce((s, t) => s + t.margin_pct, 0) / activeTiers.length : 0;

  // Example calculation for tier dialog
  const tierSoma = Number(tierFixedPct) + Number(tierVariablePct) + Number(tierMarginPct);
  const tierDivisor = 1 - tierSoma / 100;
  const exampleCost = 0.10;
  const examplePrice = tierDivisor > 0 ? exampleCost / tierDivisor : 0;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <>
    <TooltipProvider delayDuration={300}>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Printer className="h-6 w-6 text-primary" />
              Preço de Impressão
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monte sua tabela de preços: defina categorias, regras de preço por quantidade e adicione os papéis.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => openCategoryDialog()} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> Nova Categoria
            </Button>
          </div>
        </div>

        {/* Guide banner for first-time users */}
        {categories.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Layers className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma categoria</h3>
              <p className="text-sm text-muted-foreground mb-4">Crie categorias como "Laser Color", "Laser PB", "Workforce".</p>
              <Button onClick={() => openCategoryDialog()} className="gap-1.5"><Plus className="h-4 w-4" /> Criar primeira categoria</Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 shrink-0 border border-border/50"
                onClick={() => {
                  const ref = tabsScrollRef.current;
                  if (ref) ref.scrollBy({ left: -200, behavior: 'smooth' });
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div
                ref={tabsScrollRef}
                className="overflow-x-auto scrollbar-hide flex-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                <TabsList className="bg-muted/60 h-auto p-1 gap-1 w-max">
                  {categories.map(cat => {
                    const isActive = activeCategory === cat.id;
                    const isColor = isColorCategory(cat.name);
                    const catCoverage = getCategoryCoverage(cat.name);
                    const dotColor = isActive
                      ? (isColor ? 'hsl(270 70% 55%)' : 'hsl(var(--muted-foreground))')
                      : (isColor ? 'hsl(270 50% 70% / 0.5)' : 'hsl(var(--muted-foreground) / 0.3)');
                    const activeBorder = isColor ? 'hsl(270 70% 55%)' : 'hsl(var(--muted-foreground))';
                    const activeBg = isColor ? 'hsl(270 70% 55% / 0.08)' : 'hsl(var(--muted-foreground) / 0.06)';
                    return (
                      <TabsTrigger
                        key={cat.id}
                        value={cat.id}
                        className="gap-2 text-xs sm:text-sm py-2.5 px-4 data-[state=active]:shadow-md relative whitespace-nowrap"
                        style={isActive ? {
                          borderBottom: `3px solid ${activeBorder}`,
                          backgroundColor: activeBg,
                        } : {}}
                      >
                        <div
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                        <div className="text-left">
                          <span className="font-medium block leading-tight">{cat.name}</span>
                          <span className="text-[10px] text-muted-foreground block leading-tight">
                            Cobertura {catCoverage}%
                          </span>
                        </div>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 shrink-0 border border-border/50"
                onClick={() => {
                  const ref = tabsScrollRef.current;
                  if (ref) ref.scrollBy({ left: 200, behavior: 'smooth' });
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="flex gap-1 shrink-0 ml-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { const cat = categories.find(c => c.id === activeCategory); if (cat) openCategoryDialog(cat); }}>
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { const cat = categories.find(c => c.id === activeCategory); if (cat) requestDeleteCategory(activeCategory, cat.name); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Orientation banner */}
            {activeTiers.length === 0 && activeItems.length === 0 && (
              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium text-foreground">Como montar sua tabela de preços:</p>
                  <ol className="list-decimal list-inside text-muted-foreground space-y-0.5">
                    <li><strong className="text-foreground">Crie regras de preço</strong> — defina faixas de quantidade (ex: 1-10, 11-50) e quanto cobrar em cada uma</li>
                    <li><strong className="text-foreground">Adicione papéis</strong> — cada papel terá seu custo base (papel + impressão)</li>
                    <li>O sistema calcula automaticamente o <strong className="text-foreground">preço de venda</strong> para cada faixa</li>
                  </ol>
                </div>
              </div>
            )}

            {categories.map(cat => (
              <TabsContent key={cat.id} value={cat.id} className="space-y-6 mt-4">
                {/* Summary line */}
                <div className="flex items-center gap-6 text-sm text-muted-foreground px-1">
                  <span><strong className="text-foreground">{activeItems.length}</strong> itens cadastrados</span>
                  <span><strong className="text-foreground">{activeTiers.length}</strong> regras de preço</span>
                  <span>Margem média: <strong className="text-foreground">{fmtPct(avgMargin)}</strong></span>
                </div>

                {/* Markup tiers → Regras de Preço por Quantidade (Collapsible) */}
                <Collapsible>
                  <div className="rounded-lg border bg-card">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors rounded-lg group">
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold text-foreground">Regras de Preço por Quantidade</span>
                          <Badge variant="secondary" className="text-[10px] ml-1">
                            {activeTiers.length} faixa{activeTiers.length !== 1 ? "s" : ""} configurada{activeTiers.length !== 1 ? "s" : ""}
                          </Badge>
                          {activeTiers.length > 0 && (
                            <span className="text-[10px] text-muted-foreground hidden sm:inline">
                              • Margem média: {fmtPct(avgMargin)}
                            </span>
                          )}
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-1 border-t">
                        <div className="flex justify-end mb-3">
                          <Button onClick={() => openTierDialog()} size="sm" variant="outline" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nova Regra</Button>
                        </div>
                        {activeTiers.length === 0 ? (
                          <div className="text-center py-6 space-y-2">
                            <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>
                            <p className="text-xs text-muted-foreground">Crie regras para definir quanto cobrar em cada faixa de quantidade. Ex: de 1 a 10 cópias, de 11 a 50, etc.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Faixa</TableHead>
                                  <TableHead className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      Custos Fixos
                                      <Tooltip>
                                        <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                                        <TooltipContent><p>Aluguel, contas, salários e outros custos que não mudam com a produção</p></TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TableHead>
                                  <TableHead className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      Custos Variáveis
                                      <Tooltip>
                                        <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                                        <TooltipContent><p>Comissão, impostos e custos que variam conforme o volume vendido</p></TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TableHead>
                                  <TableHead className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      Lucro
                                      <Tooltip>
                                        <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                                        <TooltipContent><p>Sua margem de lucro desejada sobre o preço de venda</p></TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TableHead>
                                  <TableHead className="w-[80px]" />
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {activeTiers.map(tier => (
                                  <TableRow key={tier.id}>
                                    <TableCell>
                                      <div>
                                        <Badge variant="secondary" className="font-mono text-xs">{tier.label}</Badge>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                          {tier.min_qty}{tier.max_qty ? ` a ${tier.max_qty}` : "+"} cópias
                                        </p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">{fmtPct(tier.fixed_cost_pct)}</TableCell>
                                    <TableCell className="text-center">{fmtPct(tier.variable_cost_pct)}</TableCell>
                                    <TableCell className="text-center font-semibold text-primary">{fmtPct(tier.margin_pct)}</TableCell>
                                    <TableCell>
                                      <div className="flex gap-1 justify-end">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openTierDialog(tier)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDeleteTier(tier.id, tier.label)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>

                {/* Price table */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-accent" />
                      Tabela de Preços
                      <Badge variant={isColorCategory(cat.name) ? "default" : "secondary"} className="text-[10px] gap-1 ml-2">
                        Cobertura {coveragePct}%
                      </Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                      {paperRecords.length > 0 && activeItems.length > 0 && (
                        <Button onClick={() => setShowSyncDialog(true)} size="sm" variant="outline" className="gap-1.5 text-primary border-primary/30 hover:bg-primary/5">
                          <RefreshCw className="h-3.5 w-3.5" /> Atualizar Preços de Papel
                        </Button>
                      )}
                      <Button onClick={() => openItemDialog()} size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Novo Item</Button>
                    </div>
                  </CardHeader>

                  {/* Sub-tabs by paper type */}
                  {paperTypes.length > 1 && (
                    <div className="px-6 pb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => setActivePaperType("__all__")}
                          className={cn(
                            "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                            activePaperType === "__all__"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                          )}
                        >
                          Todos ({activeItems.length})
                        </button>
                        {paperTypes.map(pt => {
                          const count = activeItems.filter(i => i.paper_type === pt).length;
                          return (
                            <button
                              key={pt}
                              onClick={() => setActivePaperType(pt)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                                activePaperType === pt
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                              )}
                            >
                              {pt} ({count})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <CardContent>
                    {activeItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Adicione itens de papel. O custo pode vir do cadastro de papéis ou ser informado manualmente.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[60px]">Cód.</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Gram.</TableHead>
                              <TableHead>Tam.</TableHead>
                              <TableHead>Lado</TableHead>
                              <TableHead className="text-right">C. Papel</TableHead>
                              <TableHead className="text-right"><span className="flex items-center gap-1 justify-end">C. Impr.{equipments.length > 0 && <Cpu className="h-3 w-3 text-muted-foreground" />}</span></TableHead>
                              <TableHead className="text-right">Custo Total</TableHead>
                              {activeTiers.map(tier => (
                                <TableHead key={tier.id} className="text-center min-w-[90px]">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary cursor-help">
                                        {tier.label}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Preço de venda para {tier.min_qty}{tier.max_qty ? ` a ${tier.max_qty}` : "+"} cópias</p>
                                      <p className="text-xs text-muted-foreground">Lucro: {fmtPct(tier.margin_pct)}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TableHead>
                              ))}
                              <TableHead className="w-[80px]" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredItems.map(item => {
                              const printCostPerSide = getEffectivePrintingCost(item);
                              const isFV = item.side === "F/V";
                              const printCost = isFV ? printCostPerSide * 2 : printCostPerSide;
                              const baseCost = item.paper_cost + printCost;
                              return (
                                <TableRow key={item.id}>
                                  <TableCell className="font-mono text-xs text-muted-foreground">{item.code || "—"}</TableCell>
                                  <TableCell className="font-medium">{item.paper_type}</TableCell>
                                  <TableCell>{item.grammage || "—"}</TableCell>
                                  <TableCell>{item.size}</TableCell>
                                  <TableCell><Badge variant={item.side === "F/V" ? "default" : "outline"} className="text-[10px]">{item.side}</Badge></TableCell>
                                  <TableCell className="text-right font-mono text-xs">{fmt4(item.paper_cost)}</TableCell>
                                  <TableCell className="text-right font-mono text-xs">
                                    <span className="flex items-center gap-1 justify-end">
                                      {fmt4(printCost)}
                                      {item.equipment_id && <span title={getEquipmentName(item.equipment_id)}><Cpu className="h-3 w-3 text-muted-foreground inline" /></span>}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs font-semibold">{fmt4(baseCost)}</TableCell>
                                  {activeTiers.map(tier => (
                                    <TableCell key={tier.id} className="text-center font-mono text-sm font-semibold text-primary">{fmt(calcSellingPrice(baseCost, tier))}</TableCell>
                                  ))}
                                  <TableCell>
                                    <div className="flex gap-1 justify-end">
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openItemDialog(item)}><Edit2 className="h-3.5 w-3.5" /></Button>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDeleteItem(item.id, item.paper_type)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* ─── Category Dialog ── */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Nome</Label><Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ex: Laser Color" /></div>
              <div className="space-y-2"><Label>Descrição (opcional)</Label><Input value={catDesc} onChange={e => setCatDesc(e.target.value)} placeholder="Ex: Impressões laser coloridas" /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Cancelar</Button><Button onClick={saveCategory}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Tier Dialog ── */}
        <Dialog open={showTierDialog} onOpenChange={setShowTierDialog}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{editingTier ? "Editar Regra de Preço" : "Nova Regra de Preço"}</DialogTitle>
              <DialogDescription>
                Defina uma faixa de quantidade e os percentuais que compõem o preço de venda.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Rótulo da faixa</Label>
                  <Input value={tierLabel} onChange={e => {
                    const val = e.target.value;
                    setTierLabel(val);
                    // Auto-fill min/max when typing pattern like "TP1", "TP2" etc.
                    const match = val.match(/^[A-Za-z]+\s*(\d+)$/);
                    if (match && !editingTier) {
                      const num = parseInt(match[1]);
                      // Check if previous tier exists to derive range
                      const prevTier = activeTiers[num - 2]; // TP2 -> index 0 (TP1)
                      if (prevTier?.max_qty) {
                        setTierMinQty(String(prevTier.max_qty + 1));
                      } else if (num === 1) {
                        setTierMinQty("1");
                      }
                    }
                  }} placeholder="Ex: TP1, TP2..." />
                  {!editingTier && activeTiers.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Sugestão automática: TP{activeTiers.length + 1} (a partir de {activeTiers[activeTiers.length - 1]?.max_qty ? activeTiers[activeTiers.length - 1].max_qty! + 1 : "?"})
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Qtd. Mínima</Label>
                  <Input type="number" value={tierMinQty} onChange={e => setTierMinQty(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Qtd. Máxima</Label>
                  <Input type="number" value={tierMaxQty} onChange={e => setTierMaxQty(e.target.value)} placeholder="Sem limite" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Custos Fixos (%)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                      <TooltipContent className="max-w-[200px]"><p>Aluguel, contas, salários — custos que você tem independente do volume de vendas</p></TooltipContent>
                    </Tooltip>
                  </div>
                  <Input type="number" value={tierFixedPct} onChange={e => setTierFixedPct(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Custos Variáveis (%)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                      <TooltipContent className="max-w-[200px]"><p>Impostos, comissões, perda e outros custos que mudam conforme o valor vendido</p></TooltipContent>
                    </Tooltip>
                  </div>
                  <Input type="number" value={tierVariablePct} onChange={e => setTierVariablePct(e.target.value)} />
                  <button
                    type="button"
                    onClick={() => setShowVarBreakdown(!showVarBreakdown)}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <ChevronDown className={cn("h-3 w-3 transition-transform", showVarBreakdown && "rotate-180")} />
                    {showVarBreakdown ? "Ocultar detalhamento" : "Detalhar composição"}
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label>Lucro (%)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                      <TooltipContent className="max-w-[200px]"><p>Quanto você quer ganhar de lucro sobre o preço de venda</p></TooltipContent>
                    </Tooltip>
                  </div>
                  <Input type="number" value={tierMarginPct} onChange={e => setTierMarginPct(e.target.value)} />
                </div>
              </div>

              {showVarBreakdown && (
                <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Composição dos custos variáveis</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Impostos (%)</Label>
                      <Input type="number" className="h-8 text-sm" value={varImpostos} onChange={e => {
                        setVarImpostos(e.target.value);
                        setTierVariablePct(String(Number(e.target.value) + Number(varComissao) + Number(varPerda) + Number(varOutros)));
                      }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Comissão (%)</Label>
                      <Input type="number" className="h-8 text-sm" value={varComissao} onChange={e => {
                        setVarComissao(e.target.value);
                        setTierVariablePct(String(Number(varImpostos) + Number(e.target.value) + Number(varPerda) + Number(varOutros)));
                      }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">
                        <span className="flex items-center gap-1">
                          Perda (%)
                          <Tooltip>
                            <TooltipTrigger asChild><HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                            <TooltipContent><p>Percentual de perda/desperdício no processo</p></TooltipContent>
                          </Tooltip>
                        </span>
                      </Label>
                      <Input type="number" className="h-8 text-sm" value={varPerda} onChange={e => {
                        setVarPerda(e.target.value);
                        setTierVariablePct(String(Number(varImpostos) + Number(varComissao) + Number(e.target.value) + Number(varOutros)));
                      }} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Outros (%)</Label>
                      <Input type="number" className="h-8 text-sm" value={varOutros} onChange={e => {
                        setVarOutros(e.target.value);
                        setTierVariablePct(String(Number(varImpostos) + Number(varComissao) + Number(varPerda) + Number(e.target.value)));
                      }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs pt-2 border-t">
                    <span className="text-muted-foreground">Total custos variáveis</span>
                    <span className="font-semibold text-foreground">{fmtPct(Number(tierVariablePct))}</span>
                  </div>
                </div>
              )}

              {/* Visual example instead of raw Soma/Divisor */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5" /> Simulação de Preço
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Se o custo for</span>
                  <span className="font-semibold text-foreground">{fmt(exampleCost)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Custos fixos ({fmtPct(Number(tierFixedPct))}) + Variáveis ({fmtPct(Number(tierVariablePct))}) + Lucro ({fmtPct(Number(tierMarginPct))})
                  </span>
                  <span className="font-semibold text-foreground">= {fmtPct(tierSoma)}</span>
                </div>
                <div className="border-t border-border pt-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Preço de venda</span>
                  <span className="text-lg font-bold text-primary">{tierDivisor > 0 ? fmt(examplePrice) : "Inválido"}</span>
                </div>
                {tierDivisor <= 0 && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    A soma dos percentuais não pode ser 100% ou mais
                  </p>
                )}

                {/* Collapsible technical details */}
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronDown className="h-3 w-3" /> Detalhes do cálculo
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between"><span>Soma dos percentuais</span><span className="font-mono">{fmtPct(tierSoma)}</span></div>
                    <div className="flex justify-between"><span>Divisor (1 − soma)</span><span className="font-mono">{tierDivisor.toFixed(4)}</span></div>
                    <div className="flex justify-between"><span>Fórmula: Custo ÷ Divisor</span><span className="font-mono">{fmt(exampleCost)} ÷ {tierDivisor.toFixed(4)} = {tierDivisor > 0 ? fmt(examplePrice) : "—"}</span></div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowTierDialog(false)}>Cancelar</Button><Button onClick={saveTier}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Item Dialog ── */}
        <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{editingItem ? "Editar Item" : "Novo Item de Impressão"}</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              {paperRecords.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    Origem do Papel
                  </Label>
                  <Select value={itemPaperSource} onValueChange={handlePaperSourceChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">✏️ Informar manualmente</SelectItem>
                      {paperRecords.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          📄 {p.name} {p.grammage || ""} — A4: {fmt4(paperPriceA4(p))} | A3+: {fmt4(paperPriceSRA3(p))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Código (opcional)</Label><Input value={itemCode} onChange={e => setItemCode(e.target.value)} placeholder="154" /></div>
                <div className="space-y-2">
                  <Label>Tipo de Papel</Label>
                  <Input value={itemPaperType} onChange={e => setItemPaperType(e.target.value)} placeholder="Sulfite" readOnly={itemPaperSource !== "manual"} className={itemPaperSource !== "manual" ? "bg-muted" : ""} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Gramatura</Label>
                  <Input value={itemGrammage} onChange={e => setItemGrammage(e.target.value)} placeholder="75g" readOnly={itemPaperSource !== "manual"} className={itemPaperSource !== "manual" ? "bg-muted" : ""} />
                </div>
                <div className="space-y-2">
                  <Label>Tamanho</Label>
                  <Select value={itemSize} onValueChange={setItemSize}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="A3">A3+ / SRA3</SelectItem>
                      <SelectItem value="A5">A5</SelectItem>
                      <SelectItem value="Carta">Carta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Lado</Label>
                  <Select value={itemSide} onValueChange={setItemSide}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F">Frente</SelectItem>
                      <SelectItem value="F/V">Frente e Verso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Custo do Papel (R$ por folha)</Label>
                {itemPaperSource !== "manual" ? (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Cadastro de papéis → </span>
                      <span className="font-bold text-primary">{fmt4(Number(itemPaperCost))}</span>
                      <span className="text-muted-foreground text-xs ml-1">
                        ({itemSize === "A4" || itemSize === "A5" || itemSize === "Carta" ? "÷9" : "÷4"} da folha 66×96)
                      </span>
                    </div>
                  </div>
                ) : (
                  <Input type="number" step="0.0001" value={itemPaperCost} onChange={e => setItemPaperCost(e.target.value)} />
                )}
              </div>

              <div className="space-y-2">
                <Label>Custo de Impressão</Label>
                {equipments.length > 0 ? (
                  <div className="space-y-3">
                    <Select value={itemEquipmentId || "manual"} onValueChange={v => setItemEquipmentId(v === "manual" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">✏️ Informar manualmente</SelectItem>
                        {equipments.map(eq => (
                          <SelectItem key={eq.id} value={eq.id}>
                            <span className="flex items-center gap-2"><Cpu className="h-3.5 w-3.5" />{eq.name} — {fmt4(getEquipmentCostPerPage(eq.id, coveragePct))}/pág</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!itemEquipmentId && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">Informe o custo por página impressa (tinta/toner + desgaste).</p>
                        <Input type="number" step="0.0001" value={itemPrintingCost} onChange={e => setItemPrintingCost(e.target.value)} placeholder="Ex: 0.0350 — custo por página" />
                      </div>
                    )}
                    {itemEquipmentId && (
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-primary shrink-0" />
                        <div className="text-sm">
                          <span className="text-muted-foreground">Via </span>
                          <span className="font-medium text-foreground">{getEquipmentName(itemEquipmentId)}</span>
                          <span className="text-muted-foreground"> a {coveragePct}%: </span>
                          <span className="font-bold text-primary">{fmt4(getEquipmentCostPerPage(itemEquipmentId, coveragePct))}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Informe o custo por página impressa (tinta/toner + desgaste da máquina).</p>
                    <Input type="number" step="0.0001" value={itemPrintingCost} onChange={e => setItemPrintingCost(e.target.value)} placeholder="Ex: 0.0350" />
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />Cadastre equipamentos para calcular automaticamente</p>
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Papel + Impressão</span>
                <span className="text-lg font-bold text-foreground">
                  {fmt4(Number(itemPaperCost) + (itemEquipmentId ? getEquipmentCostPerPage(itemEquipmentId, coveragePct) : Number(itemPrintingCost)))}
                </span>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowItemDialog(false)}>Cancelar</Button><Button onClick={saveItem}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Sync Dialog ── */}
        <Dialog open={showSyncDialog} onOpenChange={setShowSyncDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" />Atualizar Preços de Papel</DialogTitle>
              <DialogDescription>
                Esta ação atualiza o custo do papel nos itens desta categoria usando os preços mais recentes do cadastro de papéis. O sistema cruza pelo nome do tipo de papel.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Os preços NÃO são atualizados automaticamente.</p>
                    <p className="text-muted-foreground mt-1">Você controla quando a tabela de preço de impressão deve refletir os novos custos de papel.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <p><strong className="text-foreground">{activeItems.length}</strong> itens na categoria atual</p>
                <p><strong className="text-foreground">{paperRecords.length}</strong> papéis cadastrados disponíveis</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSyncDialog(false)}>Cancelar</Button>
              <Button onClick={syncPaperPrices} className="gap-1.5">
                <Check className="h-4 w-4" /> Atualizar Agora
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        description={`Deseja realmente excluir "${confirmItemName}"? Esta ação não pode ser desfeita.`}
        onConfirm={() => { confirmAction(); setConfirmOpen(false); }}
      />
    </>
  );
}
