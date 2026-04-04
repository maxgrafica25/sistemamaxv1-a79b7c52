import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus, Trash2, Edit2, Printer, Cpu, Gauge, ClipboardList, History, Wrench, AlertTriangle, MailWarning, BarChart3, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import ConfirmDialog from "@/components/ConfirmDialog";
import PrinterReadingsTab from "@/components/equipamentos/PrinterReadingsTab";
import ConsumablePriceHistoryTab from "@/components/equipamentos/ConsumablePriceHistoryTab";
import MaintenanceTab from "@/components/equipamentos/MaintenanceTab";
import ProductionLossesTab from "@/components/equipamentos/ProductionLossesTab";
import MaintenanceRequestsTab from "@/components/equipamentos/MaintenanceRequestsTab";
import EquipmentDashboardTab from "@/components/equipamentos/EquipmentDashboardTab";

// ─── Types ───────────────────────────────────────────────────────────
interface Equipment {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  printer_type: string;
}

interface Consumable {
  id: string;
  equipment_id: string;
  name: string;
  price: number;
  yield_pages: number;
  sort_order: number;
  mode: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmt4 = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 });

const fmtNum = (v: number) =>
  v.toLocaleString("pt-BR");

// Round up to nearest R$ 0.10
const roundUp10 = (v: number) => Math.ceil(v * 10) / 10;

const fmtRound = (v: number) =>
  roundUp10(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Visual config per printer type for better distinction
const printerTypeConfig: Record<string, { label: string; shortLabel: string; color: string; bgClass: string; borderClass: string; iconBg: string }> = {
  pb: {
    label: "Preto e Branco",
    shortLabel: "PB",
    color: "hsl(220 13% 46%)",
    bgClass: "bg-slate-100 dark:bg-slate-800",
    borderClass: "border-slate-400",
    iconBg: "bg-slate-500",
  },
  color: {
    label: "Color",
    shortLabel: "Color",
    color: "hsl(262 83% 58%)",
    bgClass: "bg-violet-50 dark:bg-violet-950",
    borderClass: "border-violet-400",
    iconBg: "bg-violet-500",
  },
  other: {
    label: "Outro",
    shortLabel: "Outro",
    color: "hsl(38 92% 50%)",
    bgClass: "bg-amber-50 dark:bg-amber-950",
    borderClass: "border-amber-400",
    iconBg: "bg-amber-500",
  },
};

const getTypeConfig = (t: string) => printerTypeConfig[t] || printerTypeConfig.other;

const printerTypeBadge = (t: string) => {
  const config = getTypeConfig(t);
  return (
    <Badge 
      className="text-[10px] font-bold uppercase tracking-wider text-white border-0"
      style={{ backgroundColor: config.color }}
    >
      {config.shortLabel}
    </Badge>
  );
};

// ─── Component ───────────────────────────────────────────────────────
export default function Equipamentos() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [activeEquipment, setActiveEquipment] = useState<string>("");
  const [activeSubTab, setActiveSubTab] = useState<string>("consumiveis");
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [showEquipDialog, setShowEquipDialog] = useState(false);
  const [editingEquip, setEditingEquip] = useState<Equipment | null>(null);
  const [showConsDialog, setShowConsDialog] = useState(false);
  const [editingCons, setEditingCons] = useState<Consumable | null>(null);

  // Confirm dialogs
  const [confirmEquipOpen, setConfirmEquipOpen] = useState(false);
  const [confirmConsOpen, setConfirmConsOpen] = useState(false);
  const [deleteEquipId, setDeleteEquipId] = useState<string>("");
  const [deleteConsId, setDeleteConsId] = useState<string>("");
  const [deleteItemName, setDeleteItemName] = useState("");

  // Equipment form
  const [equipName, setEquipName] = useState("");
  const [equipDesc, setEquipDesc] = useState("");
  const [equipType, setEquipType] = useState("pb");

  // Consumable form
  const [consName, setConsName] = useState("");
  const [consPrice, setConsPrice] = useState("0");
  const [consYield, setConsYield] = useState("1");


  // ─── Data loading ──────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    const [eqRes, consRes] = await Promise.all([
      supabase.from("equipments").select("*").order("sort_order"),
      supabase.from("equipment_consumables").select("*").order("sort_order"),
    ]);
    if (eqRes.data) {
      setEquipments(eqRes.data as Equipment[]);
      if (eqRes.data.length && !activeEquipment) {
        setActiveEquipment(eqRes.data[0].id);
      }
    }
    if (consRes.data) setConsumables(consRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Derived
  const activeEq = equipments.find(e => e.id === activeEquipment);
  const activeConsumables = useMemo(
    () => consumables.filter((c) => c.equipment_id === activeEquipment).sort((a, b) => a.sort_order - b.sort_order),
    [consumables, activeEquipment]
  );

  const costPerPage = useMemo(() => {
    return activeConsumables.reduce((sum, c) => {
      if (c.yield_pages <= 0) return sum;
      return sum + c.price / c.yield_pages;
    }, 0);
  }, [activeConsumables]);
  // Cost calculations for different coverage scenarios
  const costScenarios = useMemo(() => {
    const isColor = activeEq?.printer_type === "color";
    const sharedCons = activeConsumables.filter(c => c.mode !== "color_only");
    const allCons = activeConsumables;

    const calcCost = (items: Consumable[], coverage: number) =>
      items.reduce((sum, c) => c.yield_pages > 0 ? sum + (c.price / c.yield_pages) * coverage : sum, 0);

    if (isColor) {
      return {
        isColor: true,
        color5: calcCost(allCons, 1),       // 5% base
        color20: calcCost(allCons, 4),      // 20% = 4x
        pb5: calcCost(sharedCons, 1),       // PB 5%
        pb20: calcCost(sharedCons, 4),      // PB 20%
      };
    } else {
      return {
        isColor: false,
        color5: 0,
        color20: 0,
        pb5: calcCost(allCons, 1),
        pb20: calcCost(allCons, 4),
      };
    }
  }, [activeConsumables, activeEq]);

  // ─── Equipment CRUD ────────────────────────────────────────────────
  const openEquipDialog = (eq?: Equipment) => {
    if (eq) {
      setEditingEquip(eq);
      setEquipName(eq.name);
      setEquipDesc(eq.description || "");
      setEquipType(eq.printer_type || "pb");
    } else {
      setEditingEquip(null);
      setEquipName("");
      setEquipDesc("");
      setEquipType("pb");
    }
    setShowEquipDialog(true);
  };

  const saveEquipment = async () => {
    if (!equipName.trim()) return toast.error("Nome obrigatório");
    if (editingEquip) {
      await supabase.from("equipments").update({
        name: equipName, description: equipDesc || null, printer_type: equipType,
      }).eq("id", editingEquip.id);
      await logAudit({ action: "edição", entity_type: "Equipamento", entity_id: editingEquip.id, entity_name: equipName });
    } else {
      const { data } = await supabase.from("equipments").insert({
        name: equipName, description: equipDesc || null, printer_type: equipType, sort_order: equipments.length,
      }).select("id").single();
      await logAudit({ action: "criação", entity_type: "Equipamento", entity_id: data?.id, entity_name: equipName });
    }
    setShowEquipDialog(false);
    toast.success("Equipamento salvo!");
    fetchAll();
  };

  const requestDeleteEquip = (id: string) => {
    const eq = equipments.find(e => e.id === id);
    setDeleteEquipId(id);
    setDeleteItemName(eq?.name || "");
    setConfirmEquipOpen(true);
  };

  const confirmDeleteEquip = async () => {
    await supabase.from("equipments").delete().eq("id", deleteEquipId);
    await logAudit({ action: "exclusão", entity_type: "Equipamento", entity_id: deleteEquipId, entity_name: deleteItemName });
    if (activeEquipment === deleteEquipId) setActiveEquipment("");
    toast.success("Equipamento removido!");
    setConfirmEquipOpen(false);
    fetchAll();
  };

  // ─── Consumable CRUD with price history ───────────────────────────
  const openConsDialog = (cons?: Consumable) => {
    if (cons) {
      setEditingCons(cons);
      setConsName(cons.name);
      setConsPrice(String(cons.price));
      setConsYield(String(cons.yield_pages));
    } else {
      setEditingCons(null);
      setConsName("");
      setConsPrice("0");
      setConsYield("1");
    }
    setShowConsDialog(true);
  };

  const saveConsumable = async () => {
    if (!consName.trim()) return toast.error("Nome obrigatório");
    const newPrice = Number(consPrice);
    const newYield = Number(consYield);

    if (editingCons) {
      if (editingCons.price !== newPrice || editingCons.yield_pages !== newYield) {
        await supabase.from("consumable_price_history").insert({
          consumable_id: editingCons.id,
          price: editingCons.price,
          yield_pages: editingCons.yield_pages,
          change_date: new Date().toISOString().split("T")[0],
          notes: `Preço alterado de ${fmt(editingCons.price)} para ${fmt(newPrice)}`,
        });
      }
      await supabase.from("equipment_consumables").update({
        name: consName, price: newPrice, yield_pages: newYield,
      }).eq("id", editingCons.id);
      await logAudit({ action: "edição", entity_type: "Consumível", entity_id: editingCons.id, entity_name: `${consName} (${activeEq?.name})` });
    } else {
      const { data } = await supabase.from("equipment_consumables").insert({
        equipment_id: activeEquipment, name: consName, price: newPrice, yield_pages: newYield, sort_order: activeConsumables.length,
      }).select("id").single();
      await logAudit({ action: "criação", entity_type: "Consumível", entity_id: data?.id, entity_name: `${consName} (${activeEq?.name})` });
    }
    setShowConsDialog(false);
    toast.success("Consumível salvo!");
    fetchAll();
  };

  const requestDeleteCons = (id: string, name: string) => {
    setDeleteConsId(id);
    setDeleteItemName(name);
    setConfirmConsOpen(true);
  };

  const confirmDeleteCons = async () => {
    await supabase.from("equipment_consumables").delete().eq("id", deleteConsId);
    await logAudit({ action: "exclusão", entity_type: "Consumível", entity_id: deleteConsId, entity_name: `${deleteItemName} (${activeEq?.name})` });
    toast.success("Consumível removido!");
    setConfirmConsOpen(false);
    fetchAll();
  };

  // ─── Render ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Cpu className="h-6 w-6 text-primary" />
            Cadastro de Equipamentos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registre impressoras, consumíveis, acompanhe contadores e evolução de preços
          </p>
        </div>
        <Button onClick={() => openEquipDialog()} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo Equipamento
        </Button>
      </div>

      {/* No equipment state */}
      {equipments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Printer className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum equipamento cadastrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Cadastre impressoras como "Xerox 252", "Ricoh 5002", etc.
            </p>
            <Button onClick={() => openEquipDialog()} className="gap-1.5">
              <Plus className="h-4 w-4" /> Cadastrar primeiro equipamento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeEquipment} onValueChange={(v) => { setActiveEquipment(v); setActiveSubTab("consumiveis"); }}>
          {/* Tab list — visually distinct per printer type */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <TabsList className="bg-muted/60 h-auto p-1 gap-1">
              {equipments.map((eq) => {
                const config = getTypeConfig(eq.printer_type);
                const isActive = activeEquipment === eq.id;
                return (
                  <TabsTrigger 
                    key={eq.id} 
                    value={eq.id} 
                    className="gap-2 text-xs sm:text-sm py-2.5 px-4 data-[state=active]:shadow-md relative"
                    style={isActive ? { 
                      borderBottom: `3px solid ${config.color}`,
                      backgroundColor: `${config.color}12`,
                    } : {}}
                  >
                    <div 
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: isActive ? config.color : 'hsl(var(--muted-foreground) / 0.4)' }}
                    />
                    <div className="text-left">
                      <span className="font-medium block leading-tight">{eq.name}</span>
                      {eq.description && (
                        <span className="text-[10px] text-muted-foreground block leading-tight">{eq.description}</span>
                      )}
                    </div>
                    {isActive && printerTypeBadge(eq.printer_type)}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => {
              const eq = equipments.find((e) => e.id === activeEquipment);
              if (eq) openEquipDialog(eq);
            }}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
              onClick={() => { if (activeEquipment) requestDeleteEquip(activeEquipment); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {equipments.map((eq) => {
            const config = getTypeConfig(eq.printer_type);
            return (
            <TabsContent key={eq.id} value={eq.id} className="space-y-4 mt-4">
              {/* Sub-tabs */}
              <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                <TabsList className="bg-muted/40">
                  <TabsTrigger value="consumiveis" className="gap-1.5 text-xs">
                    <Gauge className="h-3.5 w-3.5" /> Consumíveis
                  </TabsTrigger>
                  {(eq.printer_type === "pb" || eq.printer_type === "color") && (
                    <TabsTrigger value="contadores" className="gap-1.5 text-xs">
                      <ClipboardList className="h-3.5 w-3.5" /> Contadores
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="historico" className="gap-1.5 text-xs">
                    <History className="h-3.5 w-3.5" /> Histórico de Preços
                  </TabsTrigger>
                  <TabsTrigger value="manutencoes" className="gap-1.5 text-xs">
                    <Wrench className="h-3.5 w-3.5" /> Manutenções
                  </TabsTrigger>
                  <TabsTrigger value="perdas" className="gap-1.5 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5" /> Perdas
                  </TabsTrigger>
                  <TabsTrigger value="solicitacoes" className="gap-1.5 text-xs">
                    <MailWarning className="h-3.5 w-3.5" /> Solicitar Manutenção
                  </TabsTrigger>
                  <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
                    <BarChart3 className="h-3.5 w-3.5" /> Dashboard
                  </TabsTrigger>
                </TabsList>

                {/* ── Consumíveis Tab ── */}
                <TabsContent value="consumiveis" className="space-y-6 mt-4">
                  {/* Summary line */}
                  <div className="flex items-center gap-6 text-sm text-muted-foreground px-1">
                    <span><strong className="text-foreground">{activeConsumables.length}</strong> consumíveis</span>
                    <span>Custo/página (5%): <strong className="text-foreground">{fmt4(costPerPage)}</strong></span>
                  </div>

                  {/* Consumables table */}
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Gauge className="h-4 w-4" style={{ color: config.color }} />
                        Consumíveis — {eq.name}
                      </CardTitle>
                      <Button onClick={() => openConsDialog()} size="sm" variant="outline" className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Consumível
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {activeConsumables.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">
                          Adicione consumíveis como Toner, Revelador, Cilindro, Fusão, Belt, Manutenção, Depreciação...
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Consumível</TableHead>
                                <TableHead className="text-right">Preço (R$)</TableHead>
                                <TableHead className="text-right">Rendimento</TableHead>
                                <TableHead className="text-right">Custo/Página</TableHead>
                                <TableHead className="text-right">% Custo</TableHead>
                                <TableHead className="w-[80px]" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {activeConsumables.map((c) => {
                                const cpp = c.yield_pages > 0 ? c.price / c.yield_pages : 0;
                                const pctOfTotal = costPerPage > 0 ? (cpp / costPerPage) * 100 : 0;
                                return (
                                  <TableRow key={c.id}>
                                    <TableCell className="font-medium">{c.name}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{fmt(c.price)}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{fmtNum(c.yield_pages)}</TableCell>
                                    <TableCell className="text-right font-mono text-sm">{fmt4(cpp)}</TableCell>
                                    <TableCell className="text-right">
                                      <Badge variant="outline" className="font-mono text-xs">{pctOfTotal.toFixed(1)}%</Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1 justify-end">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openConsDialog(c)}>
                                          <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDeleteCons(c.id, c.name)}>
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              <TableRow className="bg-muted/30 font-semibold">
                                <TableCell>TOTAL</TableCell>
                                <TableCell className="text-right">—</TableCell>
                                <TableCell className="text-right">—</TableCell>
                                <TableCell className="text-right font-mono">{fmt4(costPerPage)}</TableCell>
                                <TableCell className="text-right"><Badge className="font-mono text-xs">100%</Badge></TableCell>
                                <TableCell />
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Coverage comparison with consumable breakdown */}
                  {activeConsumables.length > 0 && (() => {
                    const sharedCons = activeConsumables.filter(c => c.mode !== "color_only");
                    const allCons = activeConsumables;
                    const colorOnlyCons = activeConsumables.filter(c => c.mode === "color_only");

                    const scenarios = costScenarios.isColor
                      ? [
                          { label: "Color • 5%", value: costScenarios.color5, items: allCons, multiplier: 1, borderClass: "border-violet-200 dark:border-violet-800", bgClass: "bg-violet-50/50 dark:bg-violet-950/30", dotColor: "bg-violet-400" },
                          { label: "Color • 20%", value: costScenarios.color20, items: allCons, multiplier: 4, borderClass: "border-violet-300 dark:border-violet-700", bgClass: "bg-violet-100/60 dark:bg-violet-950/50", dotColor: "bg-violet-500" },
                          { label: "PB • 5%", value: costScenarios.pb5, items: sharedCons, multiplier: 1, borderClass: "border-slate-200 dark:border-slate-700", bgClass: "bg-slate-50/50 dark:bg-slate-900/30", dotColor: "bg-slate-400" },
                          { label: "PB • 20%", value: costScenarios.pb20, items: sharedCons, multiplier: 4, borderClass: "border-slate-300 dark:border-slate-600", bgClass: "bg-slate-100/60 dark:bg-slate-900/50", dotColor: "bg-slate-500" },
                        ]
                      : [
                          { label: "PB • 5%", value: costScenarios.pb5, items: allCons, multiplier: 1, borderClass: "border-slate-200 dark:border-slate-700", bgClass: "bg-slate-50/50 dark:bg-slate-900/30", dotColor: "bg-slate-400" },
                          { label: "PB • 20%", value: costScenarios.pb20, items: allCons, multiplier: 4, borderClass: "border-slate-300 dark:border-slate-600", bgClass: "bg-slate-100/60 dark:bg-slate-900/50", dotColor: "bg-slate-500" },
                        ];

                    return (
                      <div className={`grid gap-3 ${costScenarios.isColor ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
                        {scenarios.map((sc) => (
                          <Collapsible key={sc.label}>
                            <Card className={`${sc.borderClass} ${sc.bgClass}`}>
                              <CollapsibleTrigger className="w-full text-left">
                                <CardContent className="p-4">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{sc.label}</p>
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  </div>
                                  <p className="text-xl font-bold text-foreground">{fmtRound(sc.value)}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{sc.items.length} consumíve{sc.items.length === 1 ? 'l' : 'is'}</p>
                                </CardContent>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="px-4 pb-4 space-y-1.5">
                                  <div className="border-t border-border/50 pt-2" />
                                  {sc.items.map(c => {
                                    const cpp = c.yield_pages > 0 ? (c.price / c.yield_pages) * sc.multiplier : 0;
                                    return (
                                      <div key={c.id} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                          <div className={`h-1.5 w-1.5 rounded-full ${sc.dotColor}`} />
                                          <span className="text-muted-foreground">{c.name}</span>
                                        </div>
                                        <span className="font-mono text-foreground">{fmt4(cpp)}</span>
                                      </div>
                                    );
                                  })}
                                  {costScenarios.isColor && sc.label.startsWith("PB") && colorOnlyCons.length > 0 && (
                                    <div className="pt-1 border-t border-border/30">
                                      <p className="text-[10px] text-muted-foreground italic">
                                        Excluídos: {colorOnlyCons.map(c => c.name).join(", ")}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                        ))}
                      </div>
                    );
                  })()}
                </TabsContent>

                {/* ── Contadores Tab ── */}
                <TabsContent value="contadores" className="mt-4">
                  <PrinterReadingsTab
                    equipmentId={eq.id}
                    equipmentName={eq.name}
                    printerType={eq.printer_type}
                  />
                </TabsContent>

                {/* ── Histórico de Preços Tab ── */}
                <TabsContent value="historico" className="mt-4">
                  <ConsumablePriceHistoryTab
                    equipmentId={eq.id}
                    consumables={activeConsumables}
                  />
                </TabsContent>

                {/* ── Manutenções Tab ── */}
                <TabsContent value="manutencoes" className="mt-4">
                  <MaintenanceTab
                    equipmentId={eq.id}
                    equipmentName={eq.name}
                    printerType={eq.printer_type}
                  />
                </TabsContent>

                {/* ── Perdas Tab ── */}
                <TabsContent value="perdas" className="mt-4">
                  <ProductionLossesTab
                    equipmentId={eq.id}
                    equipmentName={eq.name}
                  />
                </TabsContent>

                {/* ── Solicitações de Manutenção Tab ── */}
                <TabsContent value="solicitacoes" className="mt-4">
                  <MaintenanceRequestsTab
                    equipmentId={eq.id}
                    equipmentName={eq.name}
                  />
                </TabsContent>

                {/* ── Dashboard Tab ── */}
                <TabsContent value="dashboard" className="mt-4">
                  <EquipmentDashboardTab
                    equipmentId={eq.id}
                    equipmentName={eq.name}
                  />
                </TabsContent>
              </Tabs>
            </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* ─── Equipment Dialog ─────────────────────────────────────────── */}
      <Dialog open={showEquipDialog} onOpenChange={setShowEquipDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEquip ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={equipName} onChange={(e) => setEquipName(e.target.value)} placeholder="Ex: Xerox 252 Color" />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Impressora</Label>
              <Select value={equipType} onValueChange={setEquipType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pb">Preto e Branco (PB)</SelectItem>
                  <SelectItem value="color">Color</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={equipDesc} onChange={(e) => setEquipDesc(e.target.value)} placeholder="Ex: Impressora laser colorida A3" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEquipDialog(false)}>Cancelar</Button>
            <Button onClick={saveEquipment}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Consumable Dialog ────────────────────────────────────────── */}
      <Dialog open={showConsDialog} onOpenChange={setShowConsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCons ? "Editar Consumível" : "Novo Consumível"}
              {activeEq && (
                <span className="text-sm font-normal text-muted-foreground ml-2">— {activeEq.name}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={consName} onChange={(e) => setConsName(e.target.value)} placeholder="Ex: Toner Preto" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={consPrice} onChange={(e) => setConsPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rendimento (páginas)</Label>
                <Input type="number" step="1" value={consYield} onChange={(e) => setConsYield(e.target.value)} />
              </div>
            </div>
            {Number(consYield) > 0 && (
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo/Página (5%)</span>
                  <span className="font-semibold font-mono">{fmt4(Number(consPrice) / Number(consYield))}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Custo/Página (20%)</span>
                  <span className="font-semibold font-mono">{fmt4((Number(consPrice) / Number(consYield)) * 4)}</span>
                </div>
              </div>
            )}
            {editingCons && editingCons.price !== Number(consPrice) && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300">
                💡 A alteração de preço será registrada automaticamente no histórico
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConsDialog(false)}>Cancelar</Button>
            <Button onClick={saveConsumable}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmEquipOpen}
        onOpenChange={setConfirmEquipOpen}
        title="Excluir equipamento?"
        description={`Tem certeza que deseja excluir "${deleteItemName}"? Todos os consumíveis, leituras e manutenções associados serão perdidos.`}
        onConfirm={confirmDeleteEquip}
      />
      <ConfirmDialog
        open={confirmConsOpen}
        onOpenChange={setConfirmConsOpen}
        title="Excluir consumível?"
        description={`Tem certeza que deseja excluir "${deleteItemName}"?`}
        onConfirm={confirmDeleteCons}
      />
    </div>
  );
}
