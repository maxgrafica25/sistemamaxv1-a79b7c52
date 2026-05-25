import { PageHeader } from "@/components/PageHeader";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Edit, Trash2, Search, History, Copy,
  TrendingUp, TrendingDown, Minus, Package, FileText,
  AlertTriangle, DollarSign, ShoppingCart, Layers, HelpCircle, Truck, CalendarIcon, ArrowUpRight
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import SupplierCombobox from "@/components/SupplierCombobox";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import { SupplyTiersDrawer } from "@/components/materias-primas/SupplyTiersDrawer";
import { DotTabs } from "@/components/ui/dot-tabs";

// ─── Types ───────────────────────────────────────────────────────────
type ActiveTab = "suprimento" | "papel";

interface Material {
  id: string;
  produto: string;
  category: "suprimento";
  finalidade: string;
  quantidade: number;
  valor: number;
  fornecedor: string;
  valorUnitario: number;
  unidade: string;
  data: string;
  contato: string;
  margemPct: number;
  modulo: string[];
}

const UNIDADES_MEDIDA = [
  { value: "un", label: "Unidade (un)" },
  { value: "pç", label: "Peça (pç)" },
  { value: "cx", label: "Caixa (cx)" },
  { value: "pct", label: "Pacote (pct)" },
  { value: "fd", label: "Fardo (fd)" },
  { value: "m", label: "Metro linear (m)" },
  { value: "m²", label: "Metro quadrado (m²)" },
  { value: "kg", label: "Quilo (kg)" },
  { value: "g", label: "Grama (g)" },
  { value: "L", label: "Litro (L)" },
  { value: "mL", label: "Mililitro (mL)" },
];

interface PurchaseHistory {
  id: string;
  materialId: string;
  produto: string;
  quantidade: number;
  valor: number;
  valorUnitario: number;
  fornecedor: string;
  contato: string;
  data: string;
}

interface Paper {
  id: string;
  name: string;
  grammage: string | null;
  sheet_qty: number;
  pack_price: number;
  freight_price: number;
  supplier: string | null;
  contact: string | null;
  quote_date: string | null;
  is_active: boolean;
  sort_order: number;
  is_cut_size?: boolean | null;
  purchase_sheet_width_mm?: number | null;
  purchase_sheet_height_mm?: number | null;
  category?: "comum" | "especial" | "adesivo";
}

const PAPER_CATEGORY_LABEL: Record<string, string> = {
  comum: "Comum",
  especial: "Especial",
  adesivo: "Adesivo",
};

interface PaperHistory {
  id: string;
  paper_id: string;
  sheet_qty: number;
  pack_price: number;
  freight_price: number;
  supplier: string | null;
  contact: string | null;
  quote_date: string | null;
  created_at: string;
}

const FINALIDADES_SUPRIMENTO = ["Encadernação", "Plastificação", "Crachá", "Mídia Crachá", "Ribbon", "Ilhós", "Acabamento"];

const CUTS_MAP: Record<string, number> = { "A4": 9, "A3+ / SRA3": 4 };

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt4 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 });

// ─── Component ───────────────────────────────────────────────────────
export default function MateriasPrimas() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("papel");
  const { requireAdmin } = usePermissionGuard();

  // ── Suprimentos (DB-backed) ──
  const [materials, setMaterials] = useState<Material[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [loadingSupplies, setLoadingSupplies] = useState(true);

  // ── Papéis (DB-backed) ──
  const [papers, setPapers] = useState<Paper[]>([]);
  const [paperHistory, setPaperHistory] = useState<PaperHistory[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(true);

  // Dialogs
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [duplicatingFromId, setDuplicatingFromId] = useState<string | null>(null);
  const [isPaperDialogOpen, setIsPaperDialogOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [showPaperHistoryDialog, setShowPaperHistoryDialog] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);

  // Confirm delete state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmItemName, setConfirmItemName] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterFinalidade, setFilterFinalidade] = useState<string>("all");
  const [filterSupplier, setFilterSupplier] = useState<string>("all");
  const [moduloFiltro, setModuloFiltro] = useState<"todos" | "grafica" | "cv">("todos");
  const [paperSortBy, setPaperSortBy] = useState<"name" | "grammage" | "priceA4" | "date" | "supplier">("name");
  const [paperCategoryFilter, setPaperCategoryFilter] = useState<"all" | "comum" | "especial" | "adesivo">("all");
  const [paperFormatFilter, setPaperFormatFilter] = useState<"all" | "cut" | "large">("all");
  const [paperSupplierFilter, setPaperSupplierFilter] = useState<string>("all");

  // Suprimento form
  const [produto, setProduto] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [valor, setValor] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [data, setData] = useState("");
  const [contato, setContato] = useState("");
  const [margemPct, setMargemPct] = useState("0");
  const [moduloGrafica, setModuloGrafica] = useState(true);
  const [moduloCv, setModuloCv] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMargem, setBulkMargem] = useState("0");

  // Tiers drawer
  const [tiersOpen, setTiersOpen] = useState(false);
  const [tiersSupply, setTiersSupply] = useState<Material | null>(null);
  const [tierCounts, setTierCounts] = useState<Record<string, number>>({});

  // Paper form
  const [paperName, setPaperName] = useState("");
  const [paperGrammage, setPaperGrammage] = useState("");
  const [paperSheetQty, setPaperSheetQty] = useState("");
  const [paperPackPrice, setPaperPackPrice] = useState("");
  const [paperFreightTotal, setPaperFreightTotal] = useState("0");
  const [paperFreightDivideBy, setPaperFreightDivideBy] = useState("1");
  const [paperSupplier, setPaperSupplier] = useState("");
  const [paperContact, setPaperContact] = useState("");
  const [paperDate, setPaperDate] = useState("");
  const [paperIsCutSize, setPaperIsCutSize] = useState(false);
  const [paperPurchaseSheetW, setPaperPurchaseSheetW] = useState("");
  const [paperPurchaseSheetH, setPaperPurchaseSheetH] = useState("");
  const [paperCategory, setPaperCategory] = useState<"comum" | "especial" | "adesivo">("comum");
  const [selectedExistingPaper, setSelectedExistingPaper] = useState<Paper | null>(null);
  // ── Modo embalagem (UI helper p/ papel cortado) ──
  const [pkgMode, setPkgMode] = useState(false);
  const [pkgBoxes, setPkgBoxes] = useState("1");
  const [pkgPacks, setPkgPacks] = useState("1");
  const [pkgSheetsPerPack, setPkgSheetsPerPack] = useState("500");

  // Quando em modo embalagem, sincroniza Qtd. Folhas = caixas × pacotes × folhas/pct
  useEffect(() => {
    if (!pkgMode) return;
    const b = Number(pkgBoxes) || 0;
    const p = Number(pkgPacks) || 0;
    const s = Number(pkgSheetsPerPack) || 0;
    const total = b * p * s;
    setPaperSheetQty(total > 0 ? String(total) : "");
  }, [pkgMode, pkgBoxes, pkgPacks, pkgSheetsPerPack]);

  // Computed freight per sheet (66x96)
  const computedFreightPerSheet = useMemo(() => {
    const total = Number(paperFreightTotal) || 0;
    const divideBy = Number(paperFreightDivideBy) || 1;
    const sheetQty = Number(paperSheetQty) || 0;
    if (divideBy <= 0 || sheetQty <= 0) return 0;
    return total / divideBy / sheetQty;
  }, [paperFreightTotal, paperFreightDivideBy, paperSheetQty]);

  // ── Fetch supplies ──
  const fetchSupplies = useCallback(async () => {
    setLoadingSupplies(true);
    const [supRes, histRes, tiersRes] = await Promise.all([
      supabase.from("supplies").select("*").order("created_at", { ascending: false }),
      supabase.from("supply_purchase_history").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("supply_pricing_tiers").select("supply_id"),
    ]);
    if (tiersRes?.data) {
      const counts: Record<string, number> = {};
      for (const t of tiersRes.data as any[]) {
        counts[t.supply_id] = (counts[t.supply_id] || 0) + 1;
      }
      setTierCounts(counts);
    }
    if (supRes.data) {
      setMaterials(supRes.data.map((s: any) => ({
        id: s.id,
        produto: s.produto,
        category: "suprimento" as const,
        finalidade: s.finalidade,
        quantidade: Number(s.quantidade),
        valor: Number(s.valor),
        fornecedor: s.fornecedor,
        valorUnitario: Number(s.valor_unitario),
        unidade: s.unidade || "un",
        data: s.data,
        contato: s.contato,
        margemPct: Number(s.margem_pct ?? 0),
        modulo: Array.isArray(s.modulo) ? s.modulo : ["grafica"],
      })));
    }
    if (histRes.data) {
      setPurchaseHistory(histRes.data.map((h) => ({
        id: h.id,
        materialId: h.supply_id,
        produto: h.produto,
        quantidade: Number(h.quantidade),
        valor: Number(h.valor),
        valorUnitario: Number(h.valor_unitario),
        fornecedor: h.fornecedor,
        contato: h.contato,
        data: h.data,
      })));
    }
    setLoadingSupplies(false);
  }, []);

  // ── Fetch papers ──
  const fetchPapers = useCallback(async () => {
    setLoadingPapers(true);
    const [papRes, histRes] = await Promise.all([
      supabase.from("papers").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("paper_price_history").select("*").order("created_at", { ascending: false }),
    ]);
    if (papRes.data) setPapers(papRes.data as Paper[]);
    if (histRes.data) setPaperHistory(histRes.data as PaperHistory[]);
    setLoadingPapers(false);
  }, []);

  useEffect(() => { fetchPapers(); fetchSupplies(); }, [fetchPapers, fetchSupplies]);

  // ── Paper calculations ──
  const roundUp5 = (v: number) => Math.round(v * 10) / 10;
  const calcPricePerSheet = (p: Paper) => p.sheet_qty > 0 ? p.pack_price / p.sheet_qty : 0;
  const calcPriceWithFreight = (p: Paper) => calcPricePerSheet(p) + p.freight_price;
  const calcPriceA4 = (p: Paper) => roundUp5(calcPriceWithFreight(p) / 9);
  const calcPriceSRA3 = (p: Paper) => roundUp5(calcPriceWithFreight(p) / 4);

  // ── Paper history variation ──
  const getPaperVariation = (paperId: string) => {
    const hist = paperHistory.filter(h => h.paper_id === paperId);
    if (hist.length < 2) return null;
    const calcUnit = (h: PaperHistory) => h.sheet_qty > 0 ? h.pack_price / h.sheet_qty + h.freight_price : 0;
    const latest = calcUnit(hist[0]);
    const prev = calcUnit(hist[1]);
    if (prev === 0) return null;
    return ((latest - prev) / prev) * 100;
  };

  // ── Paper CRUD ──
  const resetPaperForm = () => {
    setPaperName(""); setPaperGrammage(""); setPaperSheetQty(""); setPaperPackPrice("");
    setPaperFreightTotal("0"); setPaperFreightDivideBy("1"); setPaperSupplier(""); setPaperContact("");
    setPaperDate(new Date().toISOString().split("T")[0]);
    setPaperIsCutSize(false);
    setPaperPurchaseSheetW("");
    setPaperPurchaseSheetH("");
    setPaperCategory("comum");
    setSelectedExistingPaper(null);
    setPkgMode(false);
    setPkgBoxes("1");
    setPkgPacks("1");
    setPkgSheetsPerPack("500");
  };

  const openPaperDialog = (paper?: Paper) => {
    if (paper) {
      // Editing existing paper — "update price" mode
      setEditingPaper(paper);
      setSelectedExistingPaper(paper);
      setPaperName(paper.name);
      setPaperGrammage(paper.grammage || "");
      setPaperSheetQty(String(paper.sheet_qty));
      setPaperPackPrice(String(paper.pack_price));
      setPaperFreightTotal(String(paper.freight_price * paper.sheet_qty));
      setPaperFreightDivideBy("1");
      setPaperSupplier(paper.supplier || "");
      setPaperContact(paper.contact || "");
      setPaperDate(new Date().toISOString().split("T")[0]);
      setPaperIsCutSize(!!paper.is_cut_size);
      setPaperPurchaseSheetW(paper.purchase_sheet_width_mm != null ? String(paper.purchase_sheet_width_mm) : "");
      setPaperPurchaseSheetH(paper.purchase_sheet_height_mm != null ? String(paper.purchase_sheet_height_mm) : "");
      setPaperCategory((paper.category as any) || "comum");
    } else {
      setEditingPaper(null);
      resetPaperForm();
    }
    setIsPaperDialogOpen(true);
  };

  // When user selects an existing paper name from autocomplete in "new" mode
  const handleSelectExistingPaper = (paper: Paper) => {
    setSelectedExistingPaper(paper);
    setEditingPaper(paper);
    setPaperName(paper.name);
    setPaperGrammage(paper.grammage || "");
    setPaperSheetQty(String(paper.sheet_qty));
    setPaperSupplier(paper.supplier || "");
    setPaperContact(paper.contact || "");
    setPaperDate(new Date().toISOString().split("T")[0]);
    // Clear price fields for fresh entry
    setPaperPackPrice("");
    setPaperFreightTotal("0");
    setPaperFreightDivideBy("1");
    setPaperIsCutSize(!!paper.is_cut_size);
    setPaperPurchaseSheetW(paper.purchase_sheet_width_mm != null ? String(paper.purchase_sheet_width_mm) : "");
    setPaperPurchaseSheetH(paper.purchase_sheet_height_mm != null ? String(paper.purchase_sheet_height_mm) : "");
    setPaperCategory((paper.category as any) || "comum");
  };

  // When user clears the paper name / types a new name
  const handlePaperNameChange = (name: string) => {
    setPaperName(name);
    // If user changed the name away from the selected paper, reset to "new" mode
    if (selectedExistingPaper && name !== selectedExistingPaper.name) {
      setSelectedExistingPaper(null);
      setEditingPaper(null);
    }
  };

  const isUpdateMode = !!selectedExistingPaper;

  const savePaper = async () => {
    if (!paperName.trim() || !paperSheetQty || !paperPackPrice) {
      toast.error("Preencha Nome, Qtd. Folhas e Preço do Pacote");
      return;
    }
    if (!requireAdmin(editingPaper ? "atualizar papel" : "cadastrar papel")) return;
    const quoteDate = paperDate || new Date().toISOString().split("T")[0];
    const freightPerSheet = computedFreightPerSheet;
    const saveData = {
      name: paperName,
      grammage: paperGrammage || null,
      sheet_qty: Number(paperSheetQty),
      pack_price: Number(paperPackPrice),
      freight_price: Number(freightPerSheet.toFixed(6)),
      supplier: paperSupplier || null,
      contact: paperContact || null,
      quote_date: quoteDate,
      sort_order: editingPaper ? editingPaper.sort_order : papers.length,
      is_cut_size: paperIsCutSize,
      purchase_sheet_width_mm: paperIsCutSize ? null : (paperPurchaseSheetW.trim() ? Number(paperPurchaseSheetW) : null),
      purchase_sheet_height_mm: paperIsCutSize ? null : (paperPurchaseSheetH.trim() ? Number(paperPurchaseSheetH) : null),
      category: paperCategory,
    };

    if (editingPaper) {
      const { error: updErr } = await supabase.from("papers").update(saveData).eq("id", editingPaper.id);
      if (updErr) return handleError(updErr, "atualizar papel");
      const { error: histErr } = await supabase.from("paper_price_history").insert({
        paper_id: editingPaper.id,
        sheet_qty: saveData.sheet_qty,
        pack_price: saveData.pack_price,
        freight_price: saveData.freight_price,
        supplier: saveData.supplier,
        contact: saveData.contact,
        quote_date: quoteDate,
      });
      if (histErr) return handleError(histErr, "registrar histórico de papel");
      toast.success("Papel atualizado!");
    } else {
      const { data: inserted, error: insErr } = await supabase.from("papers").insert(saveData).select("id").single();
      if (insErr) return handleError(insErr, "cadastrar papel");
      if (inserted) {
        const { error: histErr } = await supabase.from("paper_price_history").insert({
          paper_id: inserted.id,
          sheet_qty: saveData.sheet_qty,
          pack_price: saveData.pack_price,
          freight_price: saveData.freight_price,
          supplier: saveData.supplier,
          contact: saveData.contact,
          quote_date: quoteDate,
        });
        if (histErr) return handleError(histErr, "registrar histórico de papel");
      }
      toast.success("Papel cadastrado!");
    }
    setIsPaperDialogOpen(false);
    fetchPapers();
  };

  const deletePaper = async (id: string) => {
    if (!requireAdmin("excluir papel")) return;
    const { error } = await supabase.from("papers").delete().eq("id", id);
    if (error) return handleError(error, "excluir papel");
    toast.success("Papel excluído!");
    fetchPapers();
  };

  const requestDeletePaper = (id: string, name: string) => {
    setConfirmItemName(name);
    setConfirmAction(() => () => deletePaper(id));
    setConfirmOpen(true);
  };

  // ── Suprimento logic (DB-backed) ──
  const resetForm = () => { setProduto(""); setFinalidade(""); setQuantidade(""); setUnidade("un"); setValor(""); setFornecedor(""); setData(""); setContato(""); setMargemPct("0"); setModuloGrafica(true); setModuloCv(false); };
  const openNewDialog = () => { setEditingMaterial(null); setDuplicatingFromId(null); resetForm(); setIsDialogOpen(true); };
  const openEditDialog = (m: Material) => {
    setEditingMaterial(m); setDuplicatingFromId(null); setProduto(m.produto); setFinalidade(m.finalidade);
    setQuantidade(m.quantidade.toString()); setUnidade(m.unidade || "un"); setValor(m.valor.toString());
    setFornecedor(m.fornecedor); setData(m.data); setContato(m.contato);
    setMargemPct(String(m.margemPct ?? 0));
    setModuloGrafica(m.modulo?.includes("grafica") ?? true);
    setModuloCv(m.modulo?.includes("cv") ?? false);
    setIsDialogOpen(true);
  };
  const duplicateMaterial = (m: Material) => {
    setEditingMaterial(null);
    setDuplicatingFromId(m.id);
    setProduto(`${m.produto} (cópia)`);
    setFinalidade(m.finalidade);
    setQuantidade(m.quantidade.toString());
    setUnidade(m.unidade || "un");
    setValor(m.valor.toString());
    setFornecedor(m.fornecedor);
    setContato(m.contato);
    setMargemPct(String(m.margemPct ?? 0));
    setData(new Date().toISOString().split("T")[0]);
    setIsDialogOpen(true);
  };
  const duplicatePaper = (p: Paper) => {
    setEditingPaper(null);
    setSelectedExistingPaper(null);
    setPaperName(`${p.name} (cópia)`);
    setPaperGrammage(p.grammage || "");
    setPaperSheetQty(String(p.sheet_qty));
    setPaperPackPrice(String(p.pack_price));
    setPaperFreightTotal(String(p.freight_price * p.sheet_qty));
    setPaperFreightDivideBy("1");
    setPaperSupplier(p.supplier || "");
    setPaperContact(p.contact || "");
    setPaperDate(new Date().toISOString().split("T")[0]);
    setPaperIsCutSize(!!p.is_cut_size);
    setPaperPurchaseSheetW(p.purchase_sheet_width_mm != null ? String(p.purchase_sheet_width_mm) : "");
    setPaperPurchaseSheetH(p.purchase_sheet_height_mm != null ? String(p.purchase_sheet_height_mm) : "");
    setPaperCategory((p.category as any) || "comum");
    setIsPaperDialogOpen(true);
  };
  const saveMaterial = async () => {
    if (!produto.trim() || !quantidade || !valor) { toast.error("Preencha Produto, Quantidade e Valor"); return; }
    if (!requireAdmin(editingMaterial ? "atualizar suprimento" : "cadastrar suprimento")) return;
    const qtd = parseFloat(quantidade); const val = parseFloat(valor);
    const unitario = qtd > 0 ? val / qtd : 0;
    const dt = data || new Date().toISOString().split("T")[0];
    const margemNum = Math.max(0, Math.min(500, parseFloat(margemPct) || 0));
    const modulo: string[] = [];
    if (moduloGrafica) modulo.push("grafica");
    if (moduloCv) modulo.push("cv");
    if (modulo.length === 0) { toast.error("Selecione ao menos um módulo"); return; }
    const saveData = {
      produto,
      finalidade,
      quantidade: qtd,
      unidade,
      valor: val,
      valor_unitario: unitario,
      fornecedor,
      contato,
      data: dt,
      margem_pct: margemNum,
      modulo,
    };
    if (editingMaterial) {
      const { error: updErr } = await supabase.from("supplies").update(saveData).eq("id", editingMaterial.id);
      if (updErr) return handleError(updErr, "atualizar suprimento");
      const { error: histErr } = await supabase.from("supply_purchase_history").insert({
        supply_id: editingMaterial.id,
        produto,
        quantidade: qtd,
        valor: val,
        valor_unitario: unitario,
        fornecedor,
        contato,
        data: dt,
      });
      if (histErr) return handleError(histErr, "registrar histórico de compra");
      toast.success("Item atualizado!");
    } else {
      const { data: inserted, error: insErr } = await supabase.from("supplies").insert(saveData).select("id").single();
      if (insErr) return handleError(insErr, "cadastrar suprimento");
      if (inserted) {
        const { error: histErr } = await supabase.from("supply_purchase_history").insert({
          supply_id: inserted.id,
          produto,
          quantidade: qtd,
          valor: val,
          valor_unitario: unitario,
          fornecedor,
          contato,
          data: dt,
        });
        if (histErr) return handleError(histErr, "registrar histórico de compra");

        if (duplicatingFromId) {
          const { data: srcTiers, error: tiersErr } = await (supabase as any)
            .from("supply_pricing_tiers")
            .select("label, min_qty, max_qty, manual_price, sort_order")
            .eq("supply_id", duplicatingFromId);
          if (tiersErr) {
            toast.warning("Suprimento criado, mas falhou ao copiar faixas de preço");
          } else if (srcTiers && srcTiers.length > 0) {
            const payload = srcTiers.map((t: any) => ({ ...t, supply_id: inserted.id }));
            const { error: copyErr } = await (supabase as any).from("supply_pricing_tiers").insert(payload);
            if (copyErr) toast.warning("Suprimento criado, mas falhou ao copiar faixas de preço");
            else toast.success(`${srcTiers.length} faixa(s) de preço copiada(s)`);
          }
        }
      }
      toast.success("Item cadastrado!");
    }
    setDuplicatingFromId(null);
    setIsDialogOpen(false);
    fetchSupplies();
  };
  const deleteMaterial = async (id: string) => {
    if (!requireAdmin("excluir suprimento")) return;
    const { error: histErr } = await supabase.from("supply_purchase_history").delete().eq("supply_id", id);
    if (histErr) return handleError(histErr, "excluir histórico de compra");
    const { error } = await supabase.from("supplies").delete().eq("id", id);
    if (error) return handleError(error, "excluir suprimento");
    toast.success("Item excluído!");
    fetchSupplies();
  };

  const requestDeleteMaterial = (id: string, name: string) => {
    setConfirmItemName(name);
    setConfirmAction(() => () => deleteMaterial(id));
    setConfirmOpen(true);
  };

  const applyBulkMargin = async () => {
    if (!requireAdmin("atualizar margem em massa")) return;
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const m = Math.max(0, Math.min(500, parseFloat(bulkMargem) || 0));
    const { error } = await supabase.from("supplies").update({ margem_pct: m }).in("id", ids);
    if (error) return handleError(error, "atualizar margem");
    toast.success(`Margem ${m}% aplicada em ${ids.length} item(ns).`);
    setSelectedIds(new Set());
    setBulkOpen(false);
    fetchSupplies();
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getVariation = (materialId: string) => {
    const h = purchaseHistory.filter(x => x.materialId === materialId).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    if (h.length < 2) return null;
    return ((h[0].valorUnitario - h[1].valorUnitario) / h[1].valorUnitario) * 100;
  };

  // ── Filtered data ──
  const filteredMaterials = useMemo(() =>
    materials.filter(m => {
      if (searchTerm && !m.produto.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (filterFinalidade !== "all" && m.finalidade !== filterFinalidade) return false;
      if (moduloFiltro !== "todos" && !(m.modulo || []).includes(moduloFiltro)) return false;
      return true;
    }), [materials, searchTerm, filterFinalidade, moduloFiltro]);

  const moduloCounts = useMemo(() => ({
    todos: materials.length,
    grafica: materials.filter(m => (m.modulo || []).includes("grafica")).length,
    cv: materials.filter(m => (m.modulo || []).includes("cv")).length,
  }), [materials]);

  const filteredPapers = useMemo(() => {
    const filtered = papers.filter(p => {
      const search = searchTerm.toLowerCase();
      if (search && !p.name.toLowerCase().includes(search) && !(p.grammage || "").toLowerCase().includes(search)) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      switch (paperSortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "grammage": return (a.grammage || "").localeCompare(b.grammage || "");
        case "priceA4": return calcPriceA4(a) - calcPriceA4(b);
        case "date": return (b.quote_date || "").localeCompare(a.quote_date || "");
        default: return 0;
      }
    });
  }, [papers, searchTerm, paperSortBy]);

  const uniqueFinalidades = useMemo(() => {
    const set = new Set(materials.map(m => m.finalidade));
    return Array.from(set).sort();
  }, [materials]);

  // ── Stats ──
  const paperAlertCount = papers.filter(p => { const v = getPaperVariation(p.id); return v !== null && v > 10; }).length;
  const supAlertCount = materials.filter(m => { const v = getVariation(m.id); return v !== null && v > 10; }).length;
  const alertCount = activeTab === "papel" ? paperAlertCount : supAlertCount;
  const totalItems = activeTab === "papel" ? filteredPapers.length : filteredMaterials.length;

  return (
    <>
    <TooltipProvider delayDuration={300}>
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 space-y-4 lg:space-y-6">
        <PageHeader icon={Package} title="Suprimentos & Papéis" description="Acompanhamento de preços e cadastro de insumos" />

        <div>
          <DotTabs
            tabs={[
              { key: "papel", label: "Papéis" },
              { key: "suprimento", label: "Suprimentos" },
            ]}
            value={activeTab}
            onChange={(k) => { setActiveTab(k as ActiveTab); setSearchTerm(""); setFilterFinalidade("all"); }}
          />

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
            <Card className="shadow-card">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-primary/10 p-2.5"><ShoppingCart className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Itens Cadastrados</p>
                  <p className="text-xl font-bold text-foreground">{totalItems}</p>
                </div>
              </CardContent>
            </Card>
            {activeTab === "papel" && (
              <Card className="shadow-card">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-lg bg-accent/10 p-2.5"><Layers className="h-5 w-5 text-accent" /></div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Formato Base</p>
                    <p className="text-xl font-bold text-foreground">66×96cm</p>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card className="shadow-card">
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`rounded-lg p-2.5 ${alertCount > 0 ? "bg-destructive/10" : "bg-green-500/10"}`}>
                  <AlertTriangle className={`h-5 w-5 ${alertCount > 0 ? "text-destructive" : "text-green-600"}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Alertas de Preço</p>
                  <p className="text-xl font-bold text-foreground">{alertCount > 0 ? `${alertCount} item(ns) +10%` : "Nenhum"}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filters — sticky no topo do main */}
          <div className="sticky top-0 z-20 -mx-8 px-8 py-3 mt-5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder={`Buscar ${activeTab === "papel" ? "papel por nome ou gramatura" : "suprimento"}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              {activeTab === "papel" && (
                <Select value={paperSortBy} onValueChange={(v) => setPaperSortBy(v as typeof paperSortBy)}>
                  <SelectTrigger className="w-[180px] shrink-0"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Nome A-Z</SelectItem>
                    <SelectItem value="grammage">Gramatura</SelectItem>
                    <SelectItem value="priceA4">Preço A4</SelectItem>
                    <SelectItem value="date">Data mais recente</SelectItem>
                  </SelectContent>
                </Select>
              )}
              {activeTab === "suprimento" && (
                <>
                  <div className="flex items-center gap-1 shrink-0">
                    {([
                      { k: "todos" as const, label: "Todos" },
                      { k: "grafica" as const, label: "Gráfica" },
                      { k: "cv" as const, label: "CV" },
                    ]).map(c => (
                      <button
                        key={c.k}
                        onClick={() => setModuloFiltro(c.k)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          moduloFiltro === c.k
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/40"
                        }`}
                      >
                        {c.label} <span className="opacity-70">· {moduloCounts[c.k]}</span>
                      </button>
                    ))}
                  </div>
                  <Select value={filterFinalidade} onValueChange={setFilterFinalidade}>
                    <SelectTrigger className="w-[200px] shrink-0"><SelectValue placeholder="Filtrar finalidade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas finalidades</SelectItem>
                      {uniqueFinalidades.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </>
              )}
              <AdminOnly mode="disable" action={`cadastrar ${activeTab === "papel" ? "papel" : "suprimento"}`}>
                <Button
                  onClick={() => activeTab === "papel" ? openPaperDialog() : openNewDialog()}
                  className="gap-2 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Novo {activeTab === "papel" ? "Papel" : "Suprimento"}
                </Button>
              </AdminOnly>
            </div>
          </div>

          {/* ── PAPÉIS TAB ── */}
          {activeTab === "papel" && (
            loadingPapers ? (
              <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
            ) : filteredPapers.length === 0 ? (
              <Card className="shadow-card mt-4">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 rounded-full bg-muted p-4 w-fit"><FileText className="h-8 w-8 text-muted-foreground" /></div>
                  <p className="text-muted-foreground">{searchTerm ? "Nenhum papel encontrado" : "Nenhum papel cadastrado"}</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-card mt-4 overflow-hidden">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="font-semibold">Tipo de Papel</TableHead>
                          <TableHead className="text-center font-semibold">Folhas<br/><span className="text-[10px] font-normal text-muted-foreground">(66×96)</span></TableHead>
                          <TableHead className="text-right font-semibold">Preço Pacote</TableHead>
                          <TableHead className="text-right font-semibold">
                            <div className="flex items-center justify-end gap-1">
                              Frete/Folha
                              <Tooltip>
                                <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                                <TooltipContent><p>Frete total rateado por folha (66×96)</p></TooltipContent>
                              </Tooltip>
                            </div>
                          </TableHead>
                          <TableHead className="text-right font-semibold">Preço<br/><span className="text-[10px] font-normal text-muted-foreground">66×96</span></TableHead>
                          <TableHead className="text-right font-semibold text-primary">
                            <div className="flex items-center justify-end gap-1">
                              Preço A4<br/><span className="text-[10px] font-normal">(÷9)</span>
                              <Tooltip>
                                <TooltipTrigger asChild><ArrowUpRight className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                                <TooltipContent><p>Arredondado para cima a cada R$ 0,05</p></TooltipContent>
                              </Tooltip>
                            </div>
                          </TableHead>
                          <TableHead className="text-right font-semibold text-primary">
                            <div className="flex items-center justify-end gap-1">
                              Preço A3+<br/><span className="text-[10px] font-normal">(÷4)</span>
                              <Tooltip>
                                <TooltipTrigger asChild><ArrowUpRight className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                                <TooltipContent><p>Arredondado para cima a cada R$ 0,05</p></TooltipContent>
                              </Tooltip>
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold">Fornecedor</TableHead>
                          <TableHead className="font-semibold">Data</TableHead>
                          <TableHead className="text-center font-semibold">Var.</TableHead>
                          <TableHead className="text-right font-semibold">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPapers.map(paper => {
                          const priceSheet = calcPricePerSheet(paper);
                          const priceWithFreight = calcPriceWithFreight(paper);
                          const priceA4 = calcPriceA4(paper);
                          const priceSRA3 = calcPriceSRA3(paper);
                          const variation = getPaperVariation(paper.id);
                          return (
                            <TableRow key={paper.id} className="group">
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>{paper.name}</span>
                                  {paper.grammage && <span className="text-muted-foreground text-xs">{paper.grammage}</span>}
                                  {paper.category && (
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                      {PAPER_CATEGORY_LABEL[paper.category] ?? paper.category}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center tabular-nums">{paper.sheet_qty}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatCurrency(paper.pack_price)}</TableCell>
                              <TableCell className="text-right tabular-nums font-mono text-xs">{fmt4(paper.freight_price)}</TableCell>
                              <TableCell className="text-right tabular-nums font-mono text-xs">{fmt4(priceWithFreight)}</TableCell>
                              <TableCell className="text-right tabular-nums font-semibold text-primary">{fmt4(priceA4)}</TableCell>
                              <TableCell className="text-right tabular-nums font-semibold text-primary">{fmt4(priceSRA3)}</TableCell>
                              <TableCell className="text-muted-foreground">{paper.supplier || "—"}</TableCell>
                              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                {paper.quote_date ? new Date(paper.quote_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                              </TableCell>
                              <TableCell className="text-center"><VariationBadge variation={variation} /></TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedPaper(paper); setShowPaperHistoryDialog(true); }} title="Histórico">
                                    <History className="h-4 w-4" />
                                  </Button>
                                  <AdminOnly mode="disable" action="editar papel">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPaperDialog(paper)} title="Editar">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </AdminOnly>
                                  <AdminOnly mode="disable" action="duplicar papel">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicatePaper(paper)} title="Duplicar">
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </AdminOnly>
                                  <AdminOnly mode="disable" action="excluir papel">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => requestDeletePaper(paper.id, paper.name)} title="Excluir">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AdminOnly>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )
          )}

          {/* ── SUPRIMENTOS TAB ── */}
          {activeTab === "suprimento" && (
            filteredMaterials.length === 0 ? (
              <Card className="shadow-card mt-4">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-4 rounded-full bg-muted p-4 w-fit"><Package className="h-8 w-8 text-muted-foreground" /></div>
                  <p className="text-muted-foreground">{searchTerm ? "Nenhum item encontrado" : "Nenhum suprimento cadastrado"}</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-card mt-4 overflow-hidden">
                {selectedIds.size > 0 && (
                  <div className="flex items-center justify-between gap-3 px-4 py-2 bg-primary/5 border-b border-border">
                    <span className="text-sm font-medium">
                      {selectedIds.size} item(ns) selecionado(s)
                    </span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                        Limpar seleção
                      </Button>
                      <AdminOnly mode="disable" action="atualizar margem em massa">
                        <Button size="sm" onClick={() => setBulkOpen(true)} className="gap-2">
                          <DollarSign className="h-4 w-4" />
                          Aplicar margem em massa
                        </Button>
                      </AdminOnly>
                    </div>
                  </div>
                )}
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-10">
                          <Checkbox
                            checked={
                              filteredMaterials.length > 0 &&
                              filteredMaterials.every(m => selectedIds.has(m.id))
                            }
                            onCheckedChange={(v) => {
                              if (v) setSelectedIds(new Set(filteredMaterials.map(m => m.id)));
                              else setSelectedIds(new Set());
                            }}
                            aria-label="Selecionar todos"
                          />
                        </TableHead>
                        <TableHead className="font-semibold">Produto</TableHead>
                        <TableHead className="font-semibold">Finalidade</TableHead>
                        <TableHead className="font-semibold text-right">Qtd</TableHead>
                        <TableHead className="font-semibold text-right">Valor</TableHead>
                        <TableHead className="font-semibold text-right">Unit.</TableHead>
                        <TableHead className="font-semibold text-right">
                          <div className="flex items-center justify-end gap-1">
                            Margem
                            <Tooltip>
                              <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Aplicada apenas em itens de apostila (capa, mola, acabamento). Itens em modo "tier" (banner, cartão) ignoram esta margem.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-center">
                          <div className="flex items-center justify-center gap-1">
                            Faixas
                            <Tooltip>
                              <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Faixas manuais de preço por quantidade. O valor cadastrado é o <strong>preço final ao cliente</strong> (impostos e cartão já embutidos) e <strong>substitui a margem</strong> em apostilas.</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold">Fornecedor</TableHead>
                        <TableHead className="font-semibold text-center">Variação</TableHead>
                        <TableHead className="font-semibold text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMaterials.map(material => {
                        const variation = getVariation(material.id);
                        const vendaUnit = material.valorUnitario * (1 + (material.margemPct ?? 0) / 100);
                        return (
                          <TableRow key={material.id} className="group" data-state={selectedIds.has(material.id) ? "selected" : undefined}>
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(material.id)}
                                onCheckedChange={() => toggleSelected(material.id)}
                                aria-label={`Selecionar ${material.produto}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium max-w-[250px] truncate">{material.produto}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs font-normal">{material.finalidade || "—"}</Badge></TableCell>
                            <TableCell className="text-right tabular-nums">{material.quantidade} <span className="text-xs text-muted-foreground">{material.unidade || "un"}</span></TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(material.valor)}</TableCell>
                            <TableCell className="text-right tabular-nums font-medium">{formatCurrency(material.valorUnitario)} <span className="text-xs text-muted-foreground font-normal">/ {material.unidade || "un"}</span></TableCell>
                            <TableCell className="text-right tabular-nums">
                              <div className="flex flex-col items-end leading-tight">
                                <span className={cn("font-medium", (material.margemPct ?? 0) === 0 && "text-muted-foreground")}>
                                  {(material.margemPct ?? 0).toFixed(0)}%
                                </span>
                                {(material.margemPct ?? 0) > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    = {formatCurrency(vendaUnit)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant={tierCounts[material.id] ? "secondary" : "outline"}
                                size="sm"
                                className="h-7 gap-1.5 text-xs"
                                onClick={() => { setTiersSupply(material); setTiersOpen(true); }}
                                title="Gerenciar faixas"
                              >
                                <Layers className="h-3 w-3" />
                                {tierCounts[material.id]
                                  ? `${tierCounts[material.id]} faixa${tierCounts[material.id] > 1 ? "s" : ""}`
                                  : "Adicionar"}
                              </Button>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{material.fornecedor || "—"}</TableCell>
                            <TableCell className="text-center"><VariationBadge variation={variation} /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedMaterial(material); setShowHistoryDialog(true); }} title="Histórico"><History className="h-4 w-4" /></Button>
                                <AdminOnly mode="disable" action="editar suprimento">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(material)} title="Editar"><Edit className="h-4 w-4" /></Button>
                                </AdminOnly>
                                <AdminOnly mode="disable" action="duplicar suprimento">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateMaterial(material)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                                </AdminOnly>
                                <AdminOnly mode="disable" action="excluir suprimento">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => requestDeleteMaterial(material.id, material.produto)} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                                </AdminOnly>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )
          )}
        </div>

        <Dialog open={isPaperDialogOpen} onOpenChange={setIsPaperDialogOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPaper && selectedExistingPaper
                  ? "Atualizar Preço"
                  : editingPaper
                  ? "Editar Papel"
                  : "Novo Papel"}
              </DialogTitle>
              {isUpdateMode && (
                <p className="text-xs text-muted-foreground mt-1">
                  Atualizando cotação de <span className="font-medium text-foreground">{selectedExistingPaper?.name} {selectedExistingPaper?.grammage}</span>
                </p>
              )}
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {/* Paper identity - Name & Grammage */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Papel *</Label>
                  <PaperNameCombobox
                    value={paperName}
                    onChange={handlePaperNameChange}
                    papers={papers}
                    onSelectPaper={handleSelectExistingPaper}
                    disabled={!!editingPaper && !!selectedExistingPaper}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gramatura</Label>
                  <Input
                    placeholder="Ex: 75g"
                    value={paperGrammage}
                    onChange={(e) => setPaperGrammage(e.target.value)}
                    disabled={isUpdateMode}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={paperCategory} onValueChange={(v) => setPaperCategory(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comum">Papel Comum</SelectItem>
                    <SelectItem value="especial">Especial (couchê, supremo, cartão/PVC…)</SelectItem>
                    <SelectItem value="adesivo">Adesivo</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Usada para agrupar e pré-selecionar em massa nos Produtos Favoritos.
                </p>
              </div>

              {/* Formato de compra — papel já cortado / folhão custom */}
              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="paper-is-cut-size"
                    checked={paperIsCutSize}
                    onCheckedChange={(v) => setPaperIsCutSize(v === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5 flex-1">
                    <Label htmlFor="paper-is-cut-size" className="text-sm cursor-pointer">
                      Comprado já cortado no formato final
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Marque se a resma já vem no tamanho final (ex.: Sulfite A4). O campo
                      <strong> Qtd. Folhas</strong> abaixo passa a representar quantas folhas
                      vêm na resma, e o motor de preço considera <strong>1 folha = 1 peça</strong>
                      (sem cálculo de aproveitamento de folhão).
                    </p>
                  </div>
                </div>
                {!paperIsCutSize && (
                  <div className="space-y-2 pt-1 border-t">
                    <p className="text-xs text-muted-foreground">
                      <strong>Folha de produção customizada (opcional)</strong> — deixe vazio
                      para usar o folhão padrão (SRA3 ~ 328×478&nbsp;mm). Preencha se você
                      compra outro formato (ex.: 660×960).
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Largura (mm)</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="328"
                          value={paperPurchaseSheetW}
                          onChange={(e) => setPaperPurchaseSheetW(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Altura (mm)</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="478"
                          value={paperPurchaseSheetH}
                          onChange={(e) => setPaperPurchaseSheetH(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modo embalagem — atalho p/ caixas × pacotes × folhas (somente papel cortado) */}
              {paperIsCutSize && (
                <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="paper-pkg-mode"
                      checked={pkgMode}
                      onCheckedChange={(v) => setPkgMode(v === true)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="paper-pkg-mode" className="text-sm cursor-pointer flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        Comprei em caixas / pacotes
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Ative para informar a embalagem (ex.: 1 caixa × 10 pacotes × 500 folhas) e calcular o total automaticamente.
                      </p>
                    </div>
                  </div>
                  {pkgMode && (
                    <div className="space-y-2 pt-1 border-t">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Caixas</Label>
                          <Input type="number" min="1" inputMode="numeric" value={pkgBoxes} onChange={(e) => setPkgBoxes(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Pacotes / caixa</Label>
                          <Input type="number" min="1" inputMode="numeric" value={pkgPacks} onChange={(e) => setPkgPacks(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Folhas / pacote</Label>
                          <Input type="number" min="1" inputMode="numeric" value={pkgSheetsPerPack} onChange={(e) => setPkgSheetsPerPack(e.target.value)} />
                        </div>
                      </div>
                      {(() => {
                        const b = Number(pkgBoxes) || 0;
                        const p = Number(pkgPacks) || 0;
                        const s = Number(pkgSheetsPerPack) || 0;
                        const total = b * p * s;
                        const price = Number(paperPackPrice) || 0;
                        return (
                          <div className="text-xs bg-muted/50 rounded-md p-2 space-y-0.5">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{b} cx × {p} pct × {s} fl</span>
                              <span className="font-semibold text-foreground">{total.toLocaleString("pt-BR")} folhas</span>
                            </div>
                            {total > 0 && price > 0 && (
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Custo por folha (sem frete)</span>
                                <span className="font-semibold text-primary">{fmt4(price / total)}</span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Pricing fields - always visible */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    {paperIsCutSize
                      ? (pkgMode ? "Qtd. Folhas (calculado)" : "Qtd. Folhas na resma *")
                      : "Qtd. Folhas (66×96) *"}
                  </Label>
                  <Input
                    type="number"
                    placeholder={paperIsCutSize ? "Ex: 500" : "500"}
                    value={paperSheetQty}
                    onChange={(e) => setPaperSheetQty(e.target.value)}
                    readOnly={pkgMode}
                    className={pkgMode ? "bg-muted/40" : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{pkgMode ? "Preço total da compra (R$) *" : "Preço do Pacote (R$) *"}</Label>
                  <Input type="number" step="0.01" placeholder="0,00" value={paperPackPrice} onChange={(e) => setPaperPackPrice(e.target.value)} autoFocus={isUpdateMode} />
                </div>
              </div>

              {/* Frete section */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">Frete</span>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  Informe o valor total do frete e entre quantos itens ele será dividido.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valor total do frete (R$)</Label>
                    <Input type="number" step="0.01" placeholder="0,00" value={paperFreightTotal} onChange={(e) => setPaperFreightTotal(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Dividir entre quantos itens?</Label>
                    <Input type="number" min="1" placeholder="1" value={paperFreightDivideBy} onChange={(e) => setPaperFreightDivideBy(e.target.value)} />
                  </div>
                </div>
                {Number(paperFreightTotal) > 0 && Number(paperSheetQty) > 0 && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Frete por item</span>
                      <span className="font-medium text-foreground">{formatCurrency(Number(paperFreightTotal) / (Number(paperFreightDivideBy) || 1))}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{paperIsCutSize ? "Frete por folha" : "Frete por folha (66×96)"}</span>
                      <span className="font-medium text-foreground">{fmt4(computedFreightPerSheet)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Auto-calc preview */}
              {paperSheetQty && paperPackPrice && Number(paperSheetQty) > 0 && (
                <div className="rounded-lg bg-muted p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{paperIsCutSize ? "Custo por folha" : "Preço por folha (66×96)"}</span>
                    <span className="font-semibold">{fmt4(Number(paperPackPrice) / Number(paperSheetQty) + computedFreightPerSheet)}</span>
                  </div>
                  {!paperIsCutSize && (
                    <>
                      <div className="border-t border-border pt-2 flex justify-between text-sm">
                        <span className="text-muted-foreground">Preço A4 <span className="text-xs">(÷ 9)</span></span>
                        <span className="font-bold text-primary">{fmt4((Number(paperPackPrice) / Number(paperSheetQty) + computedFreightPerSheet) / 9)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Preço A3+ / SRA3 <span className="text-xs">(÷ 4)</span></span>
                        <span className="font-bold text-primary">{fmt4((Number(paperPackPrice) / Number(paperSheetQty) + computedFreightPerSheet) / 4)}</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Supplier & Date */}
              <div className="grid grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <SupplierCombobox value={paperSupplier} onChange={setPaperSupplier} onSelectSupplier={(s) => { setPaperSupplier(s.nome); if (!paperContact) setPaperContact(s.empresa || ""); }} />
                </div>
                <div className="space-y-2">
                  <Label>Data Cotação</Label>
                  <HybridDateField value={paperDate} onChange={setPaperDate} />
                </div>
                <div className="space-y-2">
                  <Label>Contato</Label>
                  <Input placeholder="Nome" value={paperContact} onChange={(e) => setPaperContact(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsPaperDialogOpen(false)}>Cancelar</Button>
              <Button onClick={savePaper}>{isUpdateMode ? "Atualizar Preço" : editingPaper ? "Atualizar" : "Cadastrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Suprimento Dialog ── */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{editingMaterial ? "Editar Suprimento" : "Novo Suprimento"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2"><Label>Produto *</Label><Input placeholder="Nome do produto" value={produto} onChange={(e) => setProduto(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Finalidade</Label>
                  <Select value={finalidade} onValueChange={setFinalidade}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{FINALIDADES_SUPRIMENTO.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-2"><Label>Fornecedor</Label><SupplierCombobox value={fornecedor} onChange={setFornecedor} onSelectSupplier={(s) => { setFornecedor(s.nome); if (!contato) setContato(s.empresa || ""); }} /></div>
              </div>
              <div className="grid grid-cols-[1fr_140px_1fr] gap-4">
                <div className="space-y-2"><Label>Quantidade *</Label><Input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></div>
                <div className="space-y-2">
                  <Label>Unidade *</Label>
                  <Select value={unidade} onValueChange={setUnidade}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNIDADES_MEDIDA.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Valor Total (R$) *</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
              </div>
              {quantidade && valor && parseFloat(quantidade) > 0 && (
                <div className="rounded-lg bg-muted p-3 text-center">
                  <span className="text-sm text-muted-foreground">Valor Unitário: </span>
                  <span className="font-bold text-foreground">{formatCurrency(parseFloat(valor) / parseFloat(quantidade))}</span>
                  <span className="text-sm text-muted-foreground"> / {unidade}</span>
                </div>
              )}
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <Label className="text-sm font-medium">Margem de Lucro (%)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Margem aplicada quando o item é usado em <strong>apostilas (modo soma direta)</strong>. Em itens com markup tier (banner, cartão), a margem da tabela de tiers é usada.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  type="number"
                  min="0"
                  max="500"
                  step="1"
                  placeholder="Ex: 50"
                  value={margemPct}
                  onChange={(e) => setMargemPct(e.target.value)}
                />
                {quantidade && valor && parseFloat(quantidade) > 0 && parseFloat(margemPct) > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Custo {formatCurrency(parseFloat(valor) / parseFloat(quantidade))} + {parseFloat(margemPct).toFixed(0)}% ={" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency((parseFloat(valor) / parseFloat(quantidade)) * (1 + parseFloat(margemPct) / 100))}
                    </span>{" "}
                    / {unidade}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <div className="space-y-2"><Label>Data Cotação</Label><DatePickerField value={data} onChange={setData} /></div>
                <div className="space-y-2"><Label>Contato</Label><Input placeholder="Nome" value={contato} onChange={(e) => setContato(e.target.value)} /></div>
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Visível em quais módulos?</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={moduloGrafica} onCheckedChange={(v) => setModuloGrafica(!!v)} />
                    <span className="text-sm">Gráfica</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={moduloCv} onCheckedChange={(v) => setModuloCv(!!v)} />
                    <span className="text-sm">Comunicação Visual</span>
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={saveMaterial}>{editingMaterial ? "Atualizar" : "Cadastrar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Paper History Dialog ── */}
        <Dialog open={showPaperHistoryDialog} onOpenChange={setShowPaperHistoryDialog}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico — {selectedPaper?.name} {selectedPaper?.grammage}
              </DialogTitle>
            </DialogHeader>
            {selectedPaper && <PaperHistoryContent paper={selectedPaper} history={paperHistory.filter(h => h.paper_id === selectedPaper.id)} />}
          </DialogContent>
        </Dialog>

        {/* ── Suprimento History Dialog ── */}
        <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Histórico — {selectedMaterial?.produto}
              </DialogTitle>
            </DialogHeader>
            {selectedMaterial && (
              <SupplyHistoryContent
                history={purchaseHistory.filter(h => h.materialId === selectedMaterial.id).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())}
              />
            )}
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

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar margem em massa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta margem será aplicada a <strong>{selectedIds.size} suprimento(s)</strong> selecionado(s).
              Lembre-se: a margem só vale em itens usados em apostilas (modo soma direta).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Margem (%)</Label>
            <Input
              type="number"
              min="0"
              max="500"
              step="1"
              value={bulkMargem}
              onChange={(e) => setBulkMargem(e.target.value)}
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyBulkMargin}>
              Aplicar a {selectedIds.size} item(ns)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SupplyTiersDrawer
        open={tiersOpen}
        onOpenChange={(o) => { setTiersOpen(o); if (!o) setTiersSupply(null); }}
        supplyId={tiersSupply?.id ?? null}
        supplyName={tiersSupply?.produto ?? ""}
        baseUnitPrice={tiersSupply?.valorUnitario ?? 0}
        marginPct={tiersSupply?.margemPct ?? 0}
        onSaved={() => fetchSupplies()}
      />
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────
function VariationBadge({ variation }: { variation: number | null }) {
  if (variation === null) return <span className="text-xs text-muted-foreground">—</span>;
  const isUp = variation > 0;
  const isDown = variation < 0;
  const isAlert = variation > 10;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums
      ${isAlert ? "bg-destructive/10 text-destructive" : isUp ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : isDown ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
      {isUp ? <TrendingUp className="h-3 w-3" /> : isDown ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {isUp ? "+" : ""}{variation.toFixed(1)}%
    </span>
  );
}

function PaperHistoryContent({ paper, history }: { paper: Paper; history: PaperHistory[] }) {
  if (history.length === 0) return <p className="py-8 text-center text-muted-foreground">Nenhum registro encontrado</p>;

  const calcUnit = (h: PaperHistory) => h.sheet_qty > 0 ? h.pack_price / h.sheet_qty + h.freight_price : 0;
  const fmt4 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // Sort by quote_date descending to find the most recent quote
  const sorted = [...history].sort((a, b) => (b.quote_date || "").localeCompare(a.quote_date || ""));
  const mostRecentId = sorted[0]?.id;

  return (
    <div className="overflow-y-auto max-h-[60vh] rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Data</TableHead>
            <TableHead className="text-center">Folhas</TableHead>
            <TableHead className="text-right">Pacote</TableHead>
            <TableHead className="text-right">66×96</TableHead>
            <TableHead className="text-right">A4</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead className="text-center">Var.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((h, idx) => {
            const unit = calcUnit(h);
            const prev = sorted[idx + 1] ? calcUnit(sorted[idx + 1]) : null;
            const change = prev && prev > 0 ? ((unit - prev) / prev) * 100 : null;
            const isCurrent = h.id === mostRecentId;
            return (
              <TableRow key={h.id} className={isCurrent ? "bg-primary/5" : ""}>
                <TableCell className="whitespace-nowrap text-sm">
                  {h.quote_date ? new Date(h.quote_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                  {isCurrent && <Badge className="ml-2 bg-primary text-primary-foreground text-[10px] px-1.5">Atual</Badge>}
                </TableCell>
                <TableCell className="text-center tabular-nums">{h.sheet_qty}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(h.pack_price)}</TableCell>
                <TableCell className="text-right tabular-nums font-mono text-xs">{fmt4(unit)}</TableCell>
                <TableCell className="text-right tabular-nums font-mono text-xs font-semibold text-primary">{fmt4(unit / 9)}</TableCell>
                <TableCell className="text-muted-foreground">{h.supplier || "—"}</TableCell>
                <TableCell className="text-center"><VariationBadge variation={change} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SupplyHistoryContent({ history }: { history: PurchaseHistory[] }) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (history.length === 0) return <p className="py-8 text-center text-muted-foreground">Nenhum registro</p>;
  return (
    <div className="overflow-y-auto max-h-[60vh] rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Qtd</TableHead>
            <TableHead className="text-right">Unit.</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Fornecedor</TableHead>
            <TableHead className="text-center">Var.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((h, idx) => {
            const prev = history[idx + 1];
            const change = prev ? ((h.valorUnitario - prev.valorUnitario) / prev.valorUnitario) * 100 : null;
            return (
              <TableRow key={h.id} className={idx === 0 ? "bg-primary/5" : ""}>
                <TableCell className="whitespace-nowrap">{new Date(h.data).toLocaleDateString("pt-BR")}{idx === 0 && <Badge className="ml-2 bg-primary text-primary-foreground text-[10px] px-1.5">Atual</Badge>}</TableCell>
                <TableCell className="text-right tabular-nums">{h.quantidade}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{fmt(h.valorUnitario)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(h.valor)}</TableCell>
                <TableCell className="text-muted-foreground">{h.fornecedor}</TableCell>
                <TableCell className="text-center"><VariationBadge variation={change} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── DatePicker Field (used by Suprimentos) ─────────────────────────
function DatePickerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-10 px-3",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{date ? format(date, "dd/MM/yyyy") : "Selecionar data"}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (d) {
              onChange(format(d, "yyyy-MM-dd"));
            }
            setOpen(false);
          }}
          defaultMonth={date || new Date()}
          locale={ptBR}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Hybrid Date Field (typed DD/MM/YYYY + calendar) ─────────────────
function HybridDateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // value is yyyy-MM-dd
  const date = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const [open, setOpen] = useState(false);
  const [textValue, setTextValue] = useState(() =>
    date ? format(date, "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy")
  );

  // Sync text when value changes externally
  useEffect(() => {
    if (value) {
      const d = parse(value, "yyyy-MM-dd", new Date());
      if (!isNaN(d.getTime())) {
        setTextValue(format(d, "dd/MM/yyyy"));
      }
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, "");
    if (raw.length > 8) raw = raw.slice(0, 8);
    // Auto-format with slashes
    let formatted = "";
    if (raw.length > 0) formatted += raw.slice(0, 2);
    if (raw.length > 2) formatted += "/" + raw.slice(2, 4);
    if (raw.length > 4) formatted += "/" + raw.slice(4, 8);
    setTextValue(formatted);

    // Parse when complete
    if (raw.length === 8) {
      const parsed = parse(formatted, "dd/MM/yyyy", new Date());
      if (!isNaN(parsed.getTime())) {
        onChange(format(parsed, "yyyy-MM-dd"));
      }
    }
  };

  const handleCalendarSelect = (d: Date | undefined) => {
    if (d) {
      onChange(format(d, "yyyy-MM-dd"));
      setTextValue(format(d, "dd/MM/yyyy"));
    }
    setOpen(false);
  };

  return (
    <div className="flex gap-1">
      <Input
        placeholder="DD/MM/AAAA"
        value={textValue}
        onChange={handleTextChange}
        className="flex-1"
        maxLength={10}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleCalendarSelect}
            defaultMonth={date || new Date()}
            locale={ptBR}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Paper Name Combobox (with full paper selection) ─────────────────
function PaperNameCombobox({
  value,
  onChange,
  papers,
  onSelectPaper,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  papers: Paper[];
  onSelectPaper: (paper: Paper) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Group papers by name+grammage for unique entries
  const uniquePapers = useMemo(() => {
    const seen = new Map<string, Paper>();
    papers.forEach(p => {
      const key = `${p.name}|${p.grammage || ""}`;
      if (!seen.has(key)) seen.set(key, p);
    });
    return Array.from(seen.values());
  }, [papers]);

  const filtered = useMemo(() => {
    if (!value.trim()) return uniquePapers;
    const search = value.toLowerCase();
    return uniquePapers.filter(p =>
      p.name.toLowerCase().includes(search) ||
      (p.grammage || "").toLowerCase().includes(search)
    );
  }, [value, uniquePapers]);

  const isExact = uniquePapers.some(p => p.name === value);
  const showSuggestions = open && filtered.length > 0 && !isExact;

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        placeholder="Ex: Sulfite"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled}
      />
      {showSuggestions && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-md max-h-[200px] overflow-y-auto">
          {filtered.map((paper) => (
            <button
              key={paper.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors flex justify-between items-center"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectPaper(paper);
                setOpen(false);
              }}
            >
              <span>{paper.name} {paper.grammage && <span className="text-muted-foreground text-xs">{paper.grammage}</span>}</span>
              <Badge variant="secondary" className="text-[10px] ml-2">Atualizar</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
