import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
  ChevronLeft, ChevronRight, Filter, X, SlidersHorizontal, Eye, EyeOff, Zap, CreditCard,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageLoader from "@/components/PageLoader";

// ─── Types ───────────────────────────────────────────────────────────
interface MarkupGroup {
  id: string; name: string;
}
interface PrinterCategory {
  id: string; name: string; description: string | null; sort_order: number;
  default_markup_group_id: string | null;
}
interface MarkupTier {
  id: string; printer_category_id: string; markup_group_id: string | null; label: string;
  min_qty: number; max_qty: number | null;
  fixed_cost_pct: number; variable_cost_pct: number; margin_pct: number;
  sort_order: number;
}
interface PrintingPriceItem {
  id: string; printer_category_id: string; code: string | null;
  paper_type: string; grammage: string | null; size: string; side: string;
  paper_cost: number; printing_cost: number; is_active: boolean;
  sort_order: number; equipment_id: string | null; equipment_mode: string;
  markup_group_id: string | null;
}
interface Equipment { id: string; name: string; printer_type: string; }
interface EquipmentConsumable { equipment_id: string; price: number; yield_pages: number; mode: string; }
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

const isLargerThanA4 = (size: string) => /^(A3|SRA3|A2|A1|A0)/i.test(size);

interface GlobalSettings {
  invoice_pct: number;
  collection_pct: number;
  waste_pct: number;
  default_margin_pct: number;
}

const calcSellingPriceWithGlobals = (baseCost: number, tier: MarkupTier, _globals?: GlobalSettings) => {
  const soma = (tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct) / 100;
  const divisor = 1 - soma;
  if (divisor <= 0) return 0;
  return Math.round((baseCost / divisor) * 10) / 10;
};

const roundUp5 = (v: number) => Math.ceil(v * 20 - 1e-9) / 20;
const paperPriceA4 = (p: PaperRecord) => p.sheet_qty > 0 ? roundUp5((p.pack_price / p.sheet_qty + p.freight_price) / 9) : 0;
const paperPriceSRA3 = (p: PaperRecord) => p.sheet_qty > 0 ? roundUp5((p.pack_price / p.sheet_qty + p.freight_price) / 4) : 0;

// ─── Component ───────────────────────────────────────────────────────
export default function PrecoImpressao() {
  const { isAdmin, requireAdmin } = usePermissionGuard();
  const [categories, setCategories] = useState<PrinterCategory[]>([]);
  const [tiers, setTiers] = useState<MarkupTier[]>([]);
  const [items, setItems] = useState<PrintingPriceItem[]>([]);
  const [markupGroups, setMarkupGroups] = useState<MarkupGroup[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({ invoice_pct: 10, collection_pct: 7, waste_pct: 5, default_margin_pct: 33 });
  const [loading, setLoading] = useState(true);
  const [rulesOpen, setRulesOpen] = useState<boolean>(() => {
    const stored = localStorage.getItem(`rules_open_${""}`);
    return stored === "true";
  });

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [equipConsumables, setEquipConsumables] = useState<EquipmentConsumable[]>([]);
  const [paperRecords, setPaperRecords] = useState<PaperRecord[]>([]);

  // Dialogs
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showTierDialog, setShowTierDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showSyncDialog, setShowSyncDialog] = useState(false);
  const [syncMode, setSyncMode] = useState<"all" | "selected">("all");
  const [syncSelectedTypes, setSyncSelectedTypes] = useState<string[]>([]);
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

  // Item form
  const [itemCode, setItemCode] = useState("");
  const [itemPaperType, setItemPaperType] = useState("");
  const [itemGrammage, setItemGrammage] = useState("");
  const [itemSize, setItemSize] = useState("A4");
  const [itemSide, setItemSide] = useState("F");
  const [itemPaperCost, setItemPaperCost] = useState("0");
  const [itemPrintingCost, setItemPrintingCost] = useState("0");
  const [itemEquipmentId, setItemEquipmentId] = useState<string>("");
  const [itemEquipmentMode, setItemEquipmentMode] = useState<string>("color");
  const [itemPaperSource, setItemPaperSource] = useState<string>("manual");
  const [itemMarkupGroupId, setItemMarkupGroupId] = useState<string>("__default__");
  // Batch creation: multiple sizes/sides
  const [batchSizes, setBatchSizes] = useState<string[]>(["A4"]);
  const [batchSides, setBatchSides] = useState<string[]>(["F"]);
  // Coverage is auto-determined per category
  const activeCategoryObj = categories.find(c => c.id === activeCategory);
  const coveragePct = activeCategoryObj ? getCategoryCoverage(activeCategoryObj.name) : 5;

  // Sync state
  const [syncSize, setSyncSize] = useState<"A4" | "SRA3">("A4");
  const [activePaperType, setActivePaperType] = useState<string>("__all__");
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Filters
  const [filterGrammage, setFilterGrammage] = useState<string>("__all__");
  const [filterSize, setFilterSize] = useState<string>("__all__");
  const [filterSide, setFilterSide] = useState<string>("__all__");
  const [filterEquipment, setFilterEquipment] = useState<string>("__all__");
  const [showFilters, setShowFilters] = useState(false);

  // Column visibility
  type ColumnKey = "code" | "type" | "grammage" | "size" | "side" | "equipment" | "paperCost" | "printCost" | "totalCost";
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>({
    code: true, type: true, grammage: true, size: true, side: true,
    equipment: true, paperCost: true, printCost: true, totalCost: true,
  });
  const columnLabels: Record<ColumnKey, string> = {
    code: "Código", type: "Tipo", grammage: "Gramatura", size: "Tamanho",
    side: "Lado", equipment: "Impressora", paperCost: "C. Papel", printCost: "C. Impressão", totalCost: "Custo Total",
  };
  const toggleColumn = (key: ColumnKey) => setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));

  // ─── Data loading ──────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [catRes, tierRes, itemRes, eqRes, consRes, papRes, groupRes, settingsRes] = await Promise.all([
      supabase.from("printer_categories").select("*").order("sort_order"),
      supabase.from("markup_tiers").select("id, printer_category_id, markup_group_id, label, min_qty, max_qty, fixed_cost_pct, variable_cost_pct, margin_pct, sort_order").order("sort_order"),
      supabase.from("printing_price_items").select("*").order("sort_order"),
      supabase.from("equipments").select("id, name, printer_type").order("sort_order"),
      supabase.from("equipment_consumables").select("equipment_id, price, yield_pages, mode"),
      supabase.from("papers").select("id, name, grammage, sheet_qty, pack_price, freight_price").eq("is_active", true).order("sort_order"),
      supabase.from("markup_groups").select("id, name").order("name"),
      supabase.from("global_settings").select("*").limit(1).single(),
    ]);
    if (catRes.data) setCategories(catRes.data as PrinterCategory[]);
    if (tierRes.data) setTiers(tierRes.data as MarkupTier[]);
    if (itemRes.data) setItems(itemRes.data as PrintingPriceItem[]);
    if (eqRes.data) setEquipments(eqRes.data);
    if (consRes.data) setEquipConsumables(consRes.data);
    if (papRes.data) setPaperRecords(papRes.data as PaperRecord[]);
    if (groupRes.data) setMarkupGroups(groupRes.data as MarkupGroup[]);
    if (settingsRes.data) setGlobalSettings({
      invoice_pct: settingsRes.data.invoice_pct,
      collection_pct: settingsRes.data.collection_pct,
      waste_pct: settingsRes.data.waste_pct,
      default_margin_pct: settingsRes.data.default_margin_pct,
    });
    if (catRes.data?.length && !activeCategory) setActiveCategory(catRes.data[0].id);
    setLoading(false);
  }, [activeCategory]);

  useEffect(() => { fetchAll(); }, []);

  const getEquipmentCostPerPage = (equipmentId: string, categoryCoverage: number = 20, forcePB?: boolean) => {
    const eq = equipments.find(e => e.id === equipmentId);
    const isRibbonPrinter = eq?.printer_type === 'ribbon';
    
    // Ribbon: custo direto sem cobertura
    if (isRibbonPrinter) {
      const cons = equipConsumables.filter(c => c.equipment_id === equipmentId);
      return cons.reduce((sum, c) => c.yield_pages <= 0 ? sum : sum + c.price / c.yield_pages, 0);
    }

    const isColorPrinter = eq?.printer_type === 'color';
    const usePB = forcePB ?? categoryCoverage <= 5;
    const coverage = isColorPrinter ? 20 : 5;
    const cons = equipConsumables.filter(c =>
      c.equipment_id === equipmentId && (usePB ? c.mode === "shared" : true)
    );
    const baseCost = cons.reduce((sum, c) => c.yield_pages <= 0 ? sum : sum + c.price / c.yield_pages, 0);
    return baseCost * (coverage / 5);
  };

  const getEquipmentName = (id: string) => equipments.find(e => e.id === id)?.name || "—";

  const getEffectivePrintingCost = (item: PrintingPriceItem) => {
    if (item.equipment_id) return getEquipmentCostPerPage(item.equipment_id, coveragePct, item.equipment_mode === 'pb');
    return item.printing_cost;
  };

  const activeGroupId = activeCategoryObj?.default_markup_group_id || null;
  // viewingGroupId: grupo atualmente visualizado nas faixas (pode diferir do padrão da categoria)
  const [viewingGroupId, setViewingGroupId] = useState<string | null>(null);
  // Sempre que a categoria mudar (ou o padrão dela mudar), volta a visualizar o grupo padrão
  useEffect(() => { setViewingGroupId(activeGroupId); }, [activeCategory, activeGroupId]);
  const isViewingDefault = viewingGroupId === activeGroupId;
  const activeTiers = useMemo(() => tiers.filter(t => t.markup_group_id === viewingGroupId).sort((a, b) => a.sort_order - b.sort_order), [tiers, viewingGroupId]);
  // Diálogo de confirmação para alterar grupo padrão da categoria
  const [showChangeGroupDialog, setShowChangeGroupDialog] = useState(false);
  const itemsInActiveCategoryCount = useMemo(() => items.filter(i => i.printer_category_id === activeCategory && i.is_active).length, [items, activeCategory]);
  const activeItems = useMemo(() => items.filter(i => i.printer_category_id === activeCategory && i.is_active).sort((a, b) => a.sort_order - b.sort_order), [items, activeCategory]);

  // Get tiers for a specific group
  const getTiersForGroup = useCallback((groupId: string | null) => {
    if (!groupId) return activeTiers;
    return tiers.filter(t => t.markup_group_id === groupId).sort((a, b) => a.sort_order - b.sort_order);
  }, [tiers, activeTiers]);

  // Resolve which tiers apply to a specific item
  const getItemTiers = useCallback((item: PrintingPriceItem) => {
    const groupId = item.markup_group_id || activeGroupId;
    return tiers.filter(t => t.markup_group_id === groupId).sort((a, b) => a.sort_order - b.sort_order);
  }, [tiers, activeGroupId]);

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const paperTypes = useMemo(() => {
    const seen = new Map<string, string>();
    activeItems.forEach(item => {
      const key = normalize(item.paper_type);
      if (!seen.has(key)) seen.set(key, item.paper_type);
    });
    return [...seen.values()];
  }, [activeItems]);

  const uniqueGrammages = useMemo(() => [...new Set(activeItems.map(i => i.grammage || "—"))].sort(), [activeItems]);
  const uniqueSizes = useMemo(() => [...new Set(activeItems.map(i => i.size))].sort(), [activeItems]);
  const uniqueSides = useMemo(() => [...new Set(activeItems.map(i => i.side))].sort(), [activeItems]);
  const uniqueEquipments = useMemo(() => {
    const eqMap = new Map<string, string>();
    activeItems.forEach(i => {
      if (i.equipment_id) {
        const label = getEquipmentName(i.equipment_id) + (i.equipment_mode === 'pb' ? ' (PB)' : '');
        eqMap.set(i.equipment_id + ':' + i.equipment_mode, label);
      }
    });
    return [...eqMap.entries()].map(([key, label]) => ({ key, label }));
  }, [activeItems, equipments]);

  const activeFilterCount = [filterGrammage, filterSize, filterSide, filterEquipment].filter(f => f !== "__all__").length;

  const filteredItems = useMemo(() => {
    let result = activePaperType === "__all__" ? activeItems : activeItems.filter(i => normalize(i.paper_type) === normalize(activePaperType));
    if (filterGrammage !== "__all__") result = result.filter(i => (i.grammage || "—") === filterGrammage);
    if (filterSize !== "__all__") result = result.filter(i => i.size === filterSize);
    if (filterSide !== "__all__") result = result.filter(i => i.side === filterSide);
    if (filterEquipment !== "__all__") {
      if (filterEquipment === "__manual__") result = result.filter(i => !i.equipment_id);
      else {
        const [eqId, eqMode] = filterEquipment.split(':');
        result = result.filter(i => i.equipment_id === eqId && i.equipment_mode === eqMode);
      }
    }
    return result;
  }, [activeItems, activePaperType, filterGrammage, filterSize, filterSide, filterEquipment]);

  useEffect(() => {
    setActivePaperType("__all__"); setFilterGrammage("__all__"); setFilterSize("__all__"); setFilterSide("__all__"); setFilterEquipment("__all__");
    const stored = localStorage.getItem(`rules_open_${activeCategory}`);
    setRulesOpen(stored === "true");
  }, [activeCategory]);

  // ─── Category CRUD ─────────────────────────────────────────────────
  const openCategoryDialog = (cat?: PrinterCategory) => {
    if (cat) { setEditingCategory(cat); setCatName(cat.name); setCatDesc(cat.description || ""); }
    else { setEditingCategory(null); setCatName(""); setCatDesc(""); }
    setShowCategoryDialog(true);
  };
  const saveCategory = async () => {
    if (!catName.trim()) return toast.error("Nome obrigatório");
    if (!requireAdmin(editingCategory ? "editar categoria" : "criar categoria")) return;
    const { error } = editingCategory
      ? await supabase.from("printer_categories").update({ name: catName, description: catDesc || null }).eq("id", editingCategory.id)
      : await supabase.from("printer_categories").insert({ name: catName, description: catDesc || null, sort_order: categories.length });
    if (error) return handleError(error, editingCategory ? "salvar categoria" : "criar categoria");
    setShowCategoryDialog(false); toast.success("Categoria salva!"); fetchAll();
  };
  const deleteCategory = async (id: string) => {
    if (!requireAdmin("excluir categoria")) return;
    const { error } = await supabase.from("printer_categories").delete().eq("id", id);
    if (error) return handleError(error, "excluir categoria");
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
      setTierMaxQty(tier.max_qty ? String(tier.max_qty) : "");
      setTierFixedPct(String(tier.fixed_cost_pct)); setTierVariablePct(String(tier.variable_cost_pct));
      setTierMarginPct(String(tier.margin_pct));
    } else {
      setEditingTier(null);
      const nextIndex = activeTiers.length + 1;
      const lastTier = activeTiers.length > 0 ? activeTiers[activeTiers.length - 1] : null;
      const suggestedLabel = `TP${nextIndex}`;
      const suggestedMin = lastTier?.max_qty ? String(lastTier.max_qty + 1) : "1";
      const lastMargin = lastTier ? String(lastTier.margin_pct) : String(globalSettings.default_margin_pct);
      setTierLabel(suggestedLabel); setTierMinQty(suggestedMin); setTierMaxQty("");
      setTierFixedPct(String(globalSettings.invoice_pct)); setTierVariablePct(String(globalSettings.collection_pct));
      setTierMarginPct(lastMargin);
    }
    setShowTierDialog(true);
  };
  const saveTier = async () => {
    if (!tierLabel.trim()) return toast.error("Rótulo obrigatório");
    if (!activeGroupId) return toast.error("Nenhum grupo de markup vinculado a esta categoria");
    if (!requireAdmin(editingTier ? "editar regra de preço" : "criar regra de preço")) return;
    const data = {
      printer_category_id: activeCategory, markup_group_id: activeGroupId, label: tierLabel,
      min_qty: Number(tierMinQty), max_qty: tierMaxQty ? Number(tierMaxQty) : null,
      fixed_cost_pct: Number(tierFixedPct),
      variable_cost_pct: Number(tierVariablePct),
      margin_pct: Number(tierMarginPct), sort_order: editingTier ? editingTier.sort_order : activeTiers.length,
    };
    const { error } = editingTier
      ? await supabase.from("markup_tiers").update(data).eq("id", editingTier.id)
      : await supabase.from("markup_tiers").insert(data);
    if (error) return handleError(error, editingTier ? "salvar regra" : "criar regra");
    setShowTierDialog(false); toast.success("Regra salva!"); fetchAll();
  };
  const deleteTier = async (id: string) => {
    if (!requireAdmin("excluir regra de preço")) return;
    const { error } = await supabase.from("markup_tiers").delete().eq("id", id);
    if (error) return handleError(error, "excluir regra");
    toast.success("Regra removida!"); fetchAll();
  };
  const requestDeleteTier = (id: string, label: string) => {
    setConfirmItemName(label);
    setConfirmAction(() => () => deleteTier(id));
    setConfirmOpen(true);
  };

  // ─── Markup Group CRUD ────────────────────────────────────────────
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [groupName, setGroupName] = useState("");

  const createMarkupGroup = async () => {
    if (!groupName.trim()) return toast.error("Nome obrigatório");
    if (!requireAdmin("criar grupo de regras")) return;
    const { data, error } = await supabase.from("markup_groups").insert({ name: groupName.trim() }).select("id").single();
    if (error) return handleError(error, "criar grupo de regras");
    if (data) {
      toast.success("Grupo criado!");
      // Auto-assign to current category if it doesn't have one
      if (activeCategoryObj && !activeCategoryObj.default_markup_group_id) {
        const { error: assignError } = await supabase.from("printer_categories").update({ default_markup_group_id: data.id }).eq("id", activeCategory);
        if (assignError) handleError(assignError, "vincular grupo à categoria");
      }
    }
    setShowGroupDialog(false); setGroupName(""); fetchAll();
  };

  const assignGroupToCategory = async (groupId: string) => {
    if (!requireAdmin("vincular grupo à categoria")) return;
    const { error } = await supabase.from("printer_categories").update({ default_markup_group_id: groupId }).eq("id", activeCategory);
    if (error) return handleError(error, "vincular grupo");
    toast.success("Grupo vinculado!"); fetchAll();
  };

  const assignGroupToItem = async (itemId: string, groupId: string | null) => {
    if (!requireAdmin("alterar grupo do item")) return;
    const { error } = await supabase.from("printing_price_items").update({ markup_group_id: groupId }).eq("id", itemId);
    if (error) return handleError(error, "alterar grupo do item");
    toast.success(groupId ? "Grupo personalizado atribuído!" : "Usando grupo padrão da categoria"); fetchAll();
  };

  // ─── Item CRUD ─────────────────────────────────────────────────────
  const openItemDialog = (item?: PrintingPriceItem) => {
    if (item) {
      setEditingItem(item); setItemCode(item.code || ""); setItemPaperType(item.paper_type);
      setItemGrammage(item.grammage || ""); setItemSize(item.size); setItemSide(item.side);
      setItemPaperCost(String(item.paper_cost)); setItemPrintingCost(String(item.printing_cost));
      setItemEquipmentId(item.equipment_id || ""); setItemEquipmentMode(item.equipment_mode || "color"); setItemPaperSource("manual");
      setBatchSizes([item.size]); setBatchSides([item.side]);
      setItemMarkupGroupId(item.markup_group_id || "__default__");
    } else {
      setEditingItem(null); setItemCode(""); setItemPaperType(""); setItemGrammage("");
      setItemSize("A4"); setItemSide("F"); setItemPaperCost("0"); setItemPrintingCost("0");
      setItemEquipmentId(""); setItemEquipmentMode("color"); setItemPaperSource("manual");
      setBatchSizes(["A4"]); setBatchSides(["F"]);
      setItemMarkupGroupId("__default__");
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
        // For batch mode, use first selected size for the preview cost; actual costs computed on save
        const previewSize = editingItem ? itemSize : (batchSizes[0] || "A4");
        const price = previewSize === "A4" || previewSize === "A5" || previewSize === "Carta"
          ? paperPriceA4(paper) : paperPriceSRA3(paper);
        setItemPaperCost(price.toFixed(4));
      }
    }
  }, [itemSize, batchSizes, itemPaperSource, paperRecords, editingItem]);

  const getPaperCostForSize = (size: string) => {
    if (itemPaperSource === "manual") return Number(itemPaperCost);
    const paper = paperRecords.find(p => p.id === itemPaperSource);
    if (!paper) return Number(itemPaperCost);
    return (size === "A4" || size === "A5" || size === "Carta") ? paperPriceA4(paper) : paperPriceSRA3(paper);
  };

  const saveItem = async () => {
    if (!itemPaperType.trim()) return toast.error("Tipo de papel obrigatório");
    if (!requireAdmin(editingItem ? "editar item de impressão" : "cadastrar item de impressão")) return;

    if (editingItem) {
      // Single update
      const effectivePrintingCost = itemEquipmentId ? getEquipmentCostPerPage(itemEquipmentId, coveragePct, itemEquipmentMode === 'pb') : Number(itemPrintingCost);
      const resolvedGroupId = itemMarkupGroupId === "__default__" ? null : itemMarkupGroupId;
      const data = {
        printer_category_id: activeCategory, code: itemCode || null, paper_type: itemPaperType,
        grammage: itemGrammage || null, size: itemSize, side: itemSide,
        paper_cost: Number(itemPaperCost), printing_cost: effectivePrintingCost,
        equipment_id: itemEquipmentId || null, equipment_mode: itemEquipmentMode,
        sort_order: editingItem.sort_order, markup_group_id: resolvedGroupId,
      };
      const { error } = await supabase.from("printing_price_items").update(data).eq("id", editingItem.id);
      if (error) return handleError(error, "salvar item de impressão");
      setShowItemDialog(false); toast.success("Item salvo!"); fetchAll();
    } else {
      // Batch creation
      const sizes = batchSizes.length > 0 ? batchSizes : ["A4"];
      const sides = batchSides.length > 0 ? batchSides : ["F"];
      const effectivePrintingCost = itemEquipmentId ? getEquipmentCostPerPage(itemEquipmentId, coveragePct, itemEquipmentMode === 'pb') : Number(itemPrintingCost);
      const resolvedGroupId = itemMarkupGroupId === "__default__" ? null : itemMarkupGroupId;
      const records = [];
      let sortBase = activeItems.length;
      for (const size of sizes) {
        for (const side of sides) {
          const paperCost = getPaperCostForSize(size);
          records.push({
            printer_category_id: activeCategory, code: itemCode || null, paper_type: itemPaperType,
            grammage: itemGrammage || null, size, side,
            paper_cost: Number(paperCost.toFixed(4)), printing_cost: effectivePrintingCost,
            equipment_id: itemEquipmentId || null, equipment_mode: itemEquipmentMode,
            sort_order: sortBase++, markup_group_id: resolvedGroupId,
          });
        }
      }
      const { error } = await supabase.from("printing_price_items").insert(records);
      if (error) return handleError(error, "cadastrar item de impressão");
      setShowItemDialog(false);
      toast.success(`${records.length} item(ns) criado(s)!`);
      fetchAll();
    }
  };

  const deleteItem = async (id: string) => {
    if (!requireAdmin("excluir item de impressão")) return;
    const { error } = await supabase.from("printing_price_items").delete().eq("id", id);
    if (error) return handleError(error, "excluir item de impressão");
    toast.success("Item removido!"); fetchAll();
  };
  const requestDeleteItem = (id: string, name: string) => {
    setConfirmItemName(name);
    setConfirmAction(() => () => deleteItem(id));
    setConfirmOpen(true);
  };

  // ─── Sync paper prices ────────────────────────────────────────────
  const syncPaperPrices = async () => {
    let updated = 0;
    const itemKey = (i: typeof activeItems[number]) => `${normalize(i.paper_type)}|${(i.grammage || "").toLowerCase().trim()}`;
    const itemsToSync = syncMode === "all"
      ? activeItems
      : activeItems.filter(i => syncSelectedTypes.includes(itemKey(i)));
    if (itemsToSync.length === 0) {
      toast.warning("Selecione ao menos um tipo de papel para atualizar.");
      return;
    }
    for (const item of itemsToSync) {
      const match = paperRecords.find(p => {
        const nameMatch = normalize(p.name) === normalize(item.paper_type);
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

  const tierSoma = Number(tierFixedPct) + Number(tierVariablePct) + Number(tierMarginPct);
  const tierDivisor = 1 - tierSoma / 100;
  const exampleCost = 0.10;
  const examplePrice = tierDivisor > 0 ? exampleCost / tierDivisor : 0;

  if (loading) return <PageLoader />;

  return (
    <>
    <TooltipProvider delayDuration={300}>
      <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-[1400px] mx-auto">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition">
                  <Info className="h-3.5 w-3.5" />
                  Cálculo sempre <span className="text-primary font-semibold">por dentro</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[320px] text-xs">
                Preço de venda calculado por dentro: <code className="rounded bg-muted px-1">custo ÷ (1 − (custo fixo% + custo variável% + margem%) / 100)</code>. Este módulo <strong>não é afetado</strong> pelo toggle "Por fora / Por dentro" das Configurações — esse toggle vale apenas para Orçamentos V3, CV e Etiquetas.
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex gap-2 flex-wrap">
            <AdminOnly mode="disable" action="criar categorias de impressão">
              <Button onClick={() => openCategoryDialog()} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova Categoria
              </Button>
            </AdminOnly>
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
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0 overflow-x-auto">
                <TabsList className="bg-muted/60 h-auto p-1 gap-1 flex flex-wrap">
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
                <Collapsible
                  open={rulesOpen}
                  onOpenChange={(open) => { setRulesOpen(open); if (activeCategory) localStorage.setItem(`rules_open_${activeCategory}`, String(open)); }}
                >
                  <div className="rounded-lg border bg-card">
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-4 py-3 hover:bg-muted/50 transition-colors rounded-lg group">
                        <div className="flex items-center gap-2">
                          <Settings2 className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold text-foreground">Regras de Preço por Quantidade</span>
                          {activeGroupId && (
                            <Badge variant="outline" className="text-[10px] ml-1">
                              {markupGroups.find(g => g.id === activeGroupId)?.name || "Grupo"}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            {activeTiers.length} faixa{activeTiers.length !== 1 ? "s" : ""}
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
                        {/* Group selector + actions — agrupados visualmente */}
                        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Label className="text-xs text-muted-foreground shrink-0">Grupo:</Label>
                            <Select value={viewingGroupId || "__none__"} onValueChange={v => { if (v !== "__none__") setViewingGroupId(v); }}>
                              <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue placeholder="Selecione um grupo" /></SelectTrigger>
                              <SelectContent>
                                {markupGroups.map(g => {
                                  const groupTierCount = tiers.filter(t => t.markup_group_id === g.id).length;
                                  return (
                                    <SelectItem key={g.id} value={g.id}>
                                      {g.name} ({groupTierCount} faixa{groupTierCount !== 1 ? "s" : ""})
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            {isViewingDefault ? (
                              <Badge variant="outline" className="text-[10px] h-6 gap-1 px-1.5 border-primary/30 text-primary">
                                <Check className="h-3 w-3" /> padrão
                              </Badge>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={() => setShowChangeGroupDialog(true)}
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                                    disabled={!viewingGroupId}
                                  >
                                    <Edit2 className="h-3 w-3" /> Definir como padrão
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[260px]">
                                  <p>Você está apenas visualizando este grupo. Clique para torná-lo o grupo padrão da categoria.</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <Button
                              onClick={() => { setGroupName(""); setShowGroupDialog(true); }}
                              size="sm"
                              variant="ghost"
                              className="gap-1 h-8 text-xs text-muted-foreground hover:text-foreground px-2"
                            >
                              <Plus className="h-3 w-3" /> novo
                            </Button>
                            <Tooltip>
                              <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                              <TooltipContent className="max-w-[260px]">
                                <p>Trocar o grupo no seletor apenas <strong>visualiza</strong> as faixas. Para alterar o grupo padrão da categoria, use o botão "Definir como padrão".</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <AdminOnly mode="disable" action="criar regras de preço">
                            <Button onClick={() => openTierDialog()} size="sm" variant="outline" className="gap-1.5 h-8 text-xs" disabled={!viewingGroupId}>
                              <Plus className="h-3.5 w-3.5" /> Nova Regra
                            </Button>
                          </AdminOnly>
                        </div>
                        {activeTiers.length === 0 ? (
                          <div className="text-center py-6 space-y-2">
                            <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>
                            <p className="text-xs text-muted-foreground">Crie regras para definir quanto cobrar em cada faixa de quantidade. Ex: de 1 a 10 cópias, de 11 a 50, etc.</p>
                          </div>
                        ) : (
                          <div className="divide-y rounded-md border bg-background/50">
                            {activeTiers.map(tier => {
                              const soma = tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct;
                              return (
                                <div key={tier.id} className="flex items-center gap-3 px-3 py-1.5 text-xs hover:bg-muted/40 transition-colors">
                                  <Badge variant="secondary" className="font-mono text-[10px] shrink-0 w-12 justify-center">{tier.label}</Badge>
                                  <span className="text-muted-foreground shrink-0 w-24 tabular-nums">
                                    {tier.min_qty}{tier.max_qty ? `–${tier.max_qty}` : "+"} cópias
                                  </span>
                                  <div className="flex items-center gap-3 flex-1 text-muted-foreground tabular-nums">
                                    <span>C.Fixo <span className="text-foreground font-medium">{fmtPct(tier.fixed_cost_pct)}</span></span>
                                    <span className="text-border">·</span>
                                    <span>C.Var <span className="text-foreground font-medium">{fmtPct(tier.variable_cost_pct)}</span></span>
                                    <span className="text-border">·</span>
                                    <span>Margem <span className="text-primary font-semibold">{fmtPct(tier.margin_pct)}</span></span>
                                    <span className="text-border">·</span>
                                    <span>Soma <span className="text-foreground font-semibold">{fmtPct(soma)}</span></span>
                                  </div>
                                  <div className="flex gap-0.5 shrink-0">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openTierDialog(tier)}><Edit2 className="h-3 w-3" /></Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => requestDeleteTier(tier.id, tier.label)}><Trash2 className="h-3 w-3" /></Button>
                                  </div>
                                </div>
                              );
                            })}
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
                    <div className="flex gap-2 items-center">
                      {paperRecords.length > 0 && activeItems.length > 0 && (
                        <Button onClick={() => setShowSyncDialog(true)} size="sm" variant="outline" className="gap-1.5 text-primary border-primary/30 hover:bg-primary/5">
                          <RefreshCw className="h-3.5 w-3.5" /> Atualizar Preços de Papel
                        </Button>
                      )}

                      {/* Filters button */}
                      <Popover open={showFilters} onOpenChange={setShowFilters}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("gap-1.5", activeFilterCount > 0 && "border-primary text-primary")}>
                            <Filter className="h-3.5 w-3.5" />
                            Filtros
                            {activeFilterCount > 0 && <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">{activeFilterCount}</Badge>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 space-y-3" align="end">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm">Filtros</span>
                            {activeFilterCount > 0 && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => { setFilterGrammage("__all__"); setFilterSize("__all__"); setFilterSide("__all__"); setFilterEquipment("__all__"); }}>
                                <X className="h-3 w-3" /> Limpar
                              </Button>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Gramatura</Label>
                            <Select value={filterGrammage} onValueChange={setFilterGrammage}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">Todas</SelectItem>
                                {uniqueGrammages.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Tamanho</Label>
                            <Select value={filterSize} onValueChange={setFilterSize}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">Todos</SelectItem>
                                {uniqueSizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Lado</Label>
                            <Select value={filterSide} onValueChange={setFilterSide}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">Todos</SelectItem>
                                {uniqueSides.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Impressora</Label>
                            <Select value={filterEquipment} onValueChange={setFilterEquipment}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__all__">Todas</SelectItem>
                                <SelectItem value="__manual__">Manual</SelectItem>
                                {uniqueEquipments.map(e => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Column visibility */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" title="Colunas visíveis">
                            <SlidersHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-52 space-y-2" align="end">
                          <span className="font-semibold text-sm">Colunas</span>
                          {(Object.keys(visibleColumns) as ColumnKey[]).map(key => (
                            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                              <Checkbox checked={visibleColumns[key]} onCheckedChange={() => toggleColumn(key)} className="h-4 w-4" />
                              {columnLabels[key]}
                            </label>
                          ))}
                        </PopoverContent>
                      </Popover>

                      <AdminOnly mode="disable" action="cadastrar itens de impressão">
                        <Button onClick={() => openItemDialog()} size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Novo Item</Button>
                      </AdminOnly>
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
                          const count = activeItems.filter(i => normalize(i.paper_type) === normalize(pt)).length;
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

                  {/* Active filters summary */}
                  {activeFilterCount > 0 && (
                    <div className="px-6 pb-2 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                      {filterGrammage !== "__all__" && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          Gram: {filterGrammage}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterGrammage("__all__")} />
                        </Badge>
                      )}
                      {filterSize !== "__all__" && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          Tam: {filterSize}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterSize("__all__")} />
                        </Badge>
                      )}
                      {filterSide !== "__all__" && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          Lado: {filterSide}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterSide("__all__")} />
                        </Badge>
                      )}
                      {filterEquipment !== "__all__" && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          Impr: {filterEquipment === "__manual__" ? "Manual" : uniqueEquipments.find(e => e.key === filterEquipment)?.label || filterEquipment}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => setFilterEquipment("__all__")} />
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-2">{filteredItems.length} resultado(s)</span>
                    </div>
                  )}

                  <CardContent>
                    {activeItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">Adicione itens de papel. O custo pode vir do cadastro de papéis ou ser informado manualmente.</p>
                    ) : (
                      <div className="w-full overflow-x-auto rounded-md border">
                        <Table className="min-w-max">
                          <TableHeader>
                            <TableRow>
                              {visibleColumns.code && <TableHead className="w-[60px]">Cód.</TableHead>}
                              {visibleColumns.type && <TableHead>Tipo</TableHead>}
                              {visibleColumns.grammage && <TableHead>Gram.</TableHead>}
                              {visibleColumns.size && <TableHead>Tam.</TableHead>}
                              {visibleColumns.side && <TableHead>Lado</TableHead>}
                              {visibleColumns.equipment && <TableHead>Impressora</TableHead>}
                              {visibleColumns.paperCost && <TableHead className="text-right">C. Papel</TableHead>}
                              {visibleColumns.printCost && <TableHead className="text-right"><span className="flex items-center gap-1 justify-end">C. Impr.{equipments.length > 0 && <Cpu className="h-3 w-3 text-muted-foreground" />}</span></TableHead>}
                              {visibleColumns.totalCost && <TableHead className="text-right">Custo Total</TableHead>}
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
                              const printCostA4 = getEffectivePrintingCost(item);
                              const sizeMultiplier = isLargerThanA4(item.size) ? 2 : 1;
                              const sideMultiplier = item.side === "F/V" ? 2 : 1;
                              const printCost = roundUp5(printCostA4 * sizeMultiplier * sideMultiplier);
                              const baseCost = item.paper_cost + printCost;
                              return (
                                <TableRow key={item.id}>
                                  {visibleColumns.code && <TableCell className="font-mono text-xs text-muted-foreground">{item.code || "—"}</TableCell>}
                                  {visibleColumns.type && <TableCell className="font-medium">{item.paper_type}</TableCell>}
                                  {visibleColumns.grammage && <TableCell>{item.grammage || "—"}</TableCell>}
                                  {visibleColumns.size && <TableCell>{item.size}</TableCell>}
                                  {visibleColumns.side && <TableCell><Badge variant={item.side === "F/V" ? "default" : "outline"} className="text-[10px]">{item.side}</Badge></TableCell>}
                                  {visibleColumns.equipment && (
                                    <TableCell>
                                      {item.equipment_id ? (() => {
                                        const eq = equipments.find(e => e.id === item.equipment_id);
                                        const isColor = eq?.printer_type === 'color';
                                        const isPB = item.equipment_mode === 'pb';
                                        return (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-xs truncate max-w-[120px]" title={eq?.name}>{eq?.name || "—"}</span>
                                            {isColor && (
                                              <Badge variant={isPB ? "outline" : "secondary"} className="text-[9px] px-1.5 py-0 shrink-0">
                                                {isPB ? "PB" : "Color"}
                                              </Badge>
                                            )}
                                          </div>
                                        );
                                      })() : <span className="text-xs text-muted-foreground">Manual</span>}
                                    </TableCell>
                                  )}
                                  {visibleColumns.paperCost && <TableCell className="text-right font-mono text-xs">{fmt4(item.paper_cost)}</TableCell>}
                                  {visibleColumns.printCost && (
                                    <TableCell className="text-right font-mono text-xs">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center gap-1 justify-end cursor-help">
                                            {fmt4(printCost)}
                                            {(sizeMultiplier > 1 || sideMultiplier > 1) && (
                                              <span className="text-[9px] text-muted-foreground font-normal">
                                                ×{sizeMultiplier * sideMultiplier}
                                              </span>
                                            )}
                                            {item.equipment_id && <Cpu className="h-3 w-3 text-muted-foreground inline shrink-0" />}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-[220px] text-xs">
                                          <p className="font-semibold mb-1">Custo base A4: {fmt4(printCostA4)}</p>
                                          {sizeMultiplier > 1 && <p>× 2 (formato {item.size} = 2× A4)</p>}
                                          {sideMultiplier > 1 && <p>× 2 (frente e verso)</p>}
                                          {sizeMultiplier === 1 && sideMultiplier === 1 && <p>Formato A4, apenas frente</p>}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TableCell>
                                  )}
                                  {visibleColumns.totalCost && <TableCell className="text-right font-mono text-xs font-semibold">{fmt4(baseCost)}</TableCell>}
                                  {(() => {
                                    const itemTiers = getItemTiers(item);
                                    const hasCustomGroup = item.markup_group_id && item.markup_group_id !== activeGroupId;
                                    // Show prices aligned with the header tiers, or custom tiers if different
                                    if (hasCustomGroup) {
                                      // Render each custom tier in its own cell, aligned with header columns
                                      return activeTiers.map((_, idx) => {
                                        const customTier = itemTiers[idx];
                                        if (!customTier) return <TableCell key={idx} className="text-center">—</TableCell>;
                                        return (
                                          <TableCell key={customTier.id} className="text-center font-mono text-sm font-semibold text-primary">
                                            {fmt(calcSellingPriceWithGlobals(baseCost, customTier, globalSettings))}
                                          </TableCell>
                                        );
                                      });
                                    }
                                    return activeTiers.map(tier => (
                                      <TableCell key={tier.id} className="text-center font-mono text-sm font-semibold text-primary">{fmt(calcSellingPriceWithGlobals(baseCost, tier, globalSettings))}</TableCell>
                                    ));
                                  })()}
                                  <TableCell>
                                    <div className="flex gap-1 justify-end">
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Grupo de faixas">
                                            <Layers className={cn("h-3.5 w-3.5", item.markup_group_id && item.markup_group_id !== activeGroupId ? "text-primary" : "text-muted-foreground")} />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 space-y-2" align="end">
                                          <span className="font-semibold text-sm">Grupo de Faixas</span>
                                          <p className="text-xs text-muted-foreground">Selecione um grupo diferente do padrão para este item.</p>
                                          <Select value={item.markup_group_id || "__default__"} onValueChange={v => assignGroupToItem(item.id, v === "__default__" ? null : v)}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="__default__">📋 Padrão da categoria</SelectItem>
                                              {markupGroups.map(g => (
                                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </PopoverContent>
                                      </Popover>
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

              {/* C.Fixo + C.Variável + Margem */}
              <div className="rounded-md border bg-muted/30 p-4 space-y-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Composição do BDI</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">C. Fixo (%)</Label>
                    <Input type="number" step="0.01" className="h-8 text-sm" value={tierFixedPct} onChange={e => setTierFixedPct(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">C. Variável (%)</Label>
                    <Input type="number" step="0.01" className="h-8 text-sm" value={tierVariablePct} onChange={e => setTierVariablePct(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Margem (%)</Label>
                    <Input type="number" step="0.01" className="h-8 text-sm" value={tierMarginPct} onChange={e => setTierMarginPct(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t">
                  <span className="text-muted-foreground">Soma (C.Fixo + C.Var + Margem)</span>
                  <span className="font-semibold text-foreground">{fmtPct(tierSoma)}</span>
                </div>
              </div>

              {/* Visual example */}
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
                    C.Fixo ({fmtPct(Number(tierFixedPct))}) + C.Var ({fmtPct(Number(tierVariablePct))}) + Margem ({fmtPct(Number(tierMarginPct))})
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
              {editingItem ? (
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
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Gramatura</Label>
                    <Input value={itemGrammage} onChange={e => setItemGrammage(e.target.value)} placeholder="75g" readOnly={itemPaperSource !== "manual"} className={itemPaperSource !== "manual" ? "bg-muted" : ""} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">Tamanhos</Label>
                      <div className="space-y-1.5 rounded-md border p-3">
                        {[
                          { value: "A4", label: "A4" },
                          { value: "A3", label: "A3+ / SRA3" },
                          { value: "A5", label: "A5" },
                          { value: "Carta", label: "Carta" },
                        ].map(s => (
                          <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                            <Checkbox
                              checked={batchSizes.includes(s.value)}
                              onCheckedChange={(checked) => {
                                setBatchSizes(prev => checked ? [...prev, s.value] : prev.filter(v => v !== s.value));
                              }}
                              className="h-4 w-4"
                            />
                            {s.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">Lados</Label>
                      <div className="space-y-1.5 rounded-md border p-3">
                        {[
                          { value: "F", label: "Frente" },
                          { value: "F/V", label: "Frente e Verso" },
                        ].map(s => (
                          <label key={s.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                            <Checkbox
                              checked={batchSides.includes(s.value)}
                              onCheckedChange={(checked) => {
                                setBatchSides(prev => checked ? [...prev, s.value] : prev.filter(v => v !== s.value));
                              }}
                              className="h-4 w-4"
                            />
                            {s.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  {batchSizes.length > 0 && batchSides.length > 0 && (
                    <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        Serão criados <strong className="text-foreground">{batchSizes.length * batchSides.length} item(ns)</strong>: {batchSizes.join(", ")} × {batchSides.map(s => s === "F" ? "Frente" : "F/V").join(", ")}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label>Custo do Papel (R$ por folha)</Label>
                {itemPaperSource !== "manual" ? (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Cadastro de papéis → </span>
                      {!editingItem && batchSizes.length > 1 ? (
                        <span className="text-xs">
                          {batchSizes.map(sz => {
                            const cost = getPaperCostForSize(sz);
                            return <span key={sz} className="inline-flex gap-1 mr-3"><strong className="text-primary">{sz}:</strong> {fmt4(cost)}</span>;
                          })}
                        </span>
                      ) : (
                        <>
                          <span className="font-bold text-primary">{fmt4(Number(itemPaperCost))}</span>
                          <span className="text-muted-foreground text-xs ml-1">
                            ({(editingItem ? itemSize : batchSizes[0] || "A4") === "A4" || (editingItem ? itemSize : batchSizes[0] || "A4") === "A5" || (editingItem ? itemSize : batchSizes[0] || "A4") === "Carta" ? "÷9" : "÷4"} da folha 66×96)
                          </span>
                        </>
                      )}
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
                    <Select value={itemEquipmentId ? `${itemEquipmentId}:${itemEquipmentMode}` : "manual"} onValueChange={v => {
                      if (v === "manual") { setItemEquipmentId(""); setItemEquipmentMode("color"); }
                      else {
                        const parts = v.split(":");
                        const mode = parts.pop()!;
                        const id = parts.join(":");
                        setItemEquipmentId(id); setItemEquipmentMode(mode);
                      }
                    }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">✏️ Informar manualmente</SelectItem>
                        {equipments.map(eq => {
                          const isColor = eq.printer_type === 'color';
                          const isRibbon = eq.printer_type === 'ribbon';
                          const dupeCount = equipments.filter(e => e.name === eq.name).length;
                          const showType = dupeCount > 1;
                          const typeLabel = isColor ? 'Laser Color' : isRibbon ? 'Ribbon' : 'Laser PB';
                          if (isColor) {
                            return (
                              <React.Fragment key={eq.id}>
                                <SelectItem value={`${eq.id}:color`}>
                                  <span className="flex items-center gap-2">
                                    <Zap className="h-3.5 w-3.5" style={{ color: 'hsl(280 70% 55%)' }} />
                                    {eq.name}
                                    {showType && <span className="text-[10px] text-muted-foreground">({typeLabel})</span>}
                                    <Badge variant="outline" className="text-[10px] px-1 py-0" style={{ borderColor: 'hsl(280 70% 55%)', color: 'hsl(280 70% 55%)' }}>Color</Badge>
                                    <span className="text-muted-foreground">— {fmt4(getEquipmentCostPerPage(eq.id, 20))}/pág</span>
                                  </span>
                                </SelectItem>
                                <SelectItem value={`${eq.id}:pb`}>
                                  <span className="flex items-center gap-2">
                                    <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                                    {eq.name}
                                    {showType && <span className="text-[10px] text-muted-foreground">({typeLabel})</span>}
                                    <Badge variant="outline" className="text-[10px] px-1 py-0">PB</Badge>
                                    <span className="text-muted-foreground">— {fmt4(getEquipmentCostPerPage(eq.id, 20, true))}/pág</span>
                                  </span>
                                </SelectItem>
                              </React.Fragment>
                            );
                          }
                          if (isRibbon) {
                            return (
                              <SelectItem key={eq.id} value={`${eq.id}:ribbon`}>
                                <span className="flex items-center gap-2">
                                  <CreditCard className="h-3.5 w-3.5" style={{ color: 'hsl(172 66% 40%)' }} />
                                  {eq.name}
                                  {showType && <span className="text-[10px] text-muted-foreground">({typeLabel})</span>}
                                  <Badge variant="outline" className="text-[10px] px-1 py-0" style={{ borderColor: 'hsl(172 66% 40%)', color: 'hsl(172 66% 40%)' }}>Ribbon</Badge>
                                  <span className="text-muted-foreground">— {fmt4(getEquipmentCostPerPage(eq.id))}/imp</span>
                                </span>
                              </SelectItem>
                            );
                          }
                          return (
                            <SelectItem key={eq.id} value={`${eq.id}:pb`}>
                              <span className="flex items-center gap-2">
                                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                                {eq.name}
                                {showType && <span className="text-[10px] text-muted-foreground">({typeLabel})</span>}
                                <Badge variant="outline" className="text-[10px] px-1 py-0">PB</Badge>
                                <span className="text-muted-foreground">— {fmt4(getEquipmentCostPerPage(eq.id, 5))}/pág</span>
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {!itemEquipmentId && (
                      <div className="space-y-1.5">
                        <p className="text-xs text-muted-foreground">Informe o custo por página impressa (tinta/toner + desgaste).</p>
                        <Input type="number" step="0.0001" value={itemPrintingCost} onChange={e => setItemPrintingCost(e.target.value)} placeholder="Ex: 0.0350 — custo por página" />
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

              {/* Configuração "papel já cortado" / folhão custom agora vive no cadastro do papel (Matérias-Primas) */}
              {/* Markup Group selector */}
              {markupGroups.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    Grupo de Regras de Preço
                  </Label>
                  <Select value={itemMarkupGroupId} onValueChange={setItemMarkupGroupId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">
                        📋 Padrão da categoria{activeGroupId ? ` (${markupGroups.find(g => g.id === activeGroupId)?.name || ""})` : ""}
                      </SelectItem>
                      {markupGroups.map(g => {
                        const count = tiers.filter(t => t.markup_group_id === g.id).length;
                        return (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name} ({count} faixa{count !== 1 ? "s" : ""})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Papel + Impressão</span>
                <span className="text-lg font-bold text-foreground">
                  {fmt4(Number(itemPaperCost) + (itemEquipmentId ? getEquipmentCostPerPage(itemEquipmentId, coveragePct, itemEquipmentMode === 'pb') : Number(itemPrintingCost)))}
                </span>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowItemDialog(false)}>Cancelar</Button><Button onClick={saveItem}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Sync Dialog ── */}
        <Dialog open={showSyncDialog} onOpenChange={(open) => {
          setShowSyncDialog(open);
          if (open) { setSyncMode("all"); setSyncSelectedTypes([]); }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" />Atualizar Preços de Papel</DialogTitle>
              <DialogDescription>
                Atualiza o custo do papel nos itens desta categoria usando os preços mais recentes do cadastro de papéis.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">O que atualizar?</Label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer rounded-md border p-3 hover:bg-muted/50 transition-colors" data-state={syncMode === "all" ? "checked" : "unchecked"}>
                    <input type="radio" name="syncMode" checked={syncMode === "all"} onChange={() => setSyncMode("all")} className="mt-0.5 accent-primary" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground">Todos os papéis</p>
                      <p className="text-muted-foreground text-xs">Atualiza todos os {activeItems.length} itens da categoria.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer rounded-md border p-3 hover:bg-muted/50 transition-colors">
                    <input type="radio" name="syncMode" checked={syncMode === "selected"} onChange={() => setSyncMode("selected")} className="mt-0.5 accent-primary" />
                    <div className="text-sm flex-1">
                      <p className="font-medium text-foreground">Tipos específicos</p>
                      <p className="text-muted-foreground text-xs">Escolha quais tipos de papel atualizar.</p>
                    </div>
                  </label>
                </div>
              </div>

              {syncMode === "selected" && (
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-2">
                  {(() => {
                    const typesMap = new Map<string, { label: string; type: string; gram: string }>();
                    activeItems.forEach(i => {
                      const gram = (i.grammage || "").trim();
                      const key = `${normalize(i.paper_type)}|${gram.toLowerCase()}`;
                      if (!typesMap.has(key)) {
                        typesMap.set(key, {
                          label: gram ? `${i.paper_type} ${gram}` : i.paper_type,
                          type: i.paper_type,
                          gram,
                        });
                      }
                    });
                    const types = Array.from(typesMap.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label));
                    if (types.length === 0) return <p className="text-xs text-muted-foreground p-2">Nenhum tipo disponível.</p>;
                    return (
                      <>
                        <label className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 rounded px-2 py-1 border-b mb-1 pb-2">
                          <Checkbox
                            checked={syncSelectedTypes.length === types.length}
                            onCheckedChange={(checked) => setSyncSelectedTypes(checked ? types.map(([k]) => k) : [])}
                            className="h-4 w-4"
                          />
                          <span className="font-medium">Selecionar todos</span>
                        </label>
                        {types.map(([key, info]) => {
                          const count = activeItems.filter(i => `${normalize(i.paper_type)}|${(i.grammage || "").toLowerCase().trim()}` === key).length;
                          return (
                            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                              <Checkbox
                                checked={syncSelectedTypes.includes(key)}
                                onCheckedChange={(checked) => setSyncSelectedTypes(prev => checked ? [...prev, key] : prev.filter(k => k !== key))}
                                className="h-4 w-4"
                              />
                              <span className="flex-1">{info.label}</span>
                              <span className="text-xs text-muted-foreground">{count} {count === 1 ? "item" : "itens"}</span>
                            </label>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="rounded-lg border p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Os preços não são atualizados automaticamente. Você controla quando aplicar os novos custos.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSyncDialog(false)}>Cancelar</Button>
              <Button onClick={syncPaperPrices} className="gap-1.5" disabled={syncMode === "selected" && syncSelectedTypes.length === 0}>
                <Check className="h-4 w-4" /> Atualizar Agora
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ─── Group Dialog ── */}
        <Dialog open={showGroupDialog} onOpenChange={setShowGroupDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Novo Grupo de Faixas</DialogTitle>
              <DialogDescription>Crie um grupo reutilizável de faixas de quantidade. Ex: "Adesivos", "Couchê", "Padrão".</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2"><Label>Nome do grupo</Label><Input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Ex: Adesivos, Couchê..." /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setShowGroupDialog(false)}>Cancelar</Button><Button onClick={createMarkupGroup}>Criar</Button></DialogFooter>
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

      <ConfirmDialog
        open={showChangeGroupDialog}
        onOpenChange={setShowChangeGroupDialog}
        title="Alterar grupo padrão da categoria?"
        description={`O grupo "${markupGroups.find(g => g.id === viewingGroupId)?.name || ""}" passará a ser o padrão da categoria "${activeCategoryObj?.name || ""}". Isso afetará o cálculo de preço de ${itemsInActiveCategoryCount} item(ns) cadastrado(s) — incluindo itens não visíveis no filtro atual. Deseja continuar?`}
        confirmText="Sim, definir como padrão"
        cancelText="Cancelar"
        onConfirm={() => { if (viewingGroupId) assignGroupToCategory(viewingGroupId); setShowChangeGroupDialog(false); }}
      />
    </>
  );
}
