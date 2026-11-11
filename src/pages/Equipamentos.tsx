import { PageHeader } from "@/components/PageHeader";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
  Plus, Trash2, Edit2, Printer, Cpu, Gauge, ClipboardList, History, Wrench, AlertTriangle, MailWarning, BarChart3, HelpCircle, type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import ConfirmDialog from "@/components/ConfirmDialog";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import PrinterReadingsTab from "@/components/equipamentos/PrinterReadingsTab";
import ConsumablePriceHistoryTab from "@/components/equipamentos/ConsumablePriceHistoryTab";
import MaintenanceTab from "@/components/equipamentos/MaintenanceTab";
import ProductionLossesTab from "@/components/equipamentos/ProductionLossesTab";
import MaintenanceRequestsTab from "@/components/equipamentos/MaintenanceRequestsTab";
import EquipmentDashboardTab from "@/components/equipamentos/EquipmentDashboardTab";
import PriceHistoryGlobalTab from "@/components/equipamentos/PriceHistoryGlobalTab";
import PageLoader from "@/components/PageLoader";
import { Switch } from "@/components/ui/switch";
import { consumableCost, corNoPb, custosDaMaquina, pareceColorida, type CustosDaMaquina } from "@/lib/equipmentCost";
import { equipmentSchema, consumableSchema, zodErrorsToMap } from "@/lib/schemas/cadastros";

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
  scales_with_coverage: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────
const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmt4 = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4 });

const fmtNum = (v: number) =>
  v.toLocaleString("pt-BR");

// Round to nearest R$ 0.10 (≤0.05 down, >0.05 up)
const roundUp10 = (v: number) => Math.round(v * 10) / 10;

const fmtRound = (v: number) =>
  roundUp10(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Tipos de máquina: toda colorida também imprime preto e branco.
const TIPOS: Record<string, { nome: string; curto: string; grupo: string; ponto: string; ordem: number }> = {
  color: { nome: "Colorida", curto: "colorida", grupo: "Coloridas (fazem P&B também)", ponto: "bg-violet-500", ordem: 0 },
  pb: { nome: "Preto e branco", curto: "P&B", grupo: "Só preto e branco", ponto: "bg-slate-500", ordem: 1 },
  ribbon: { nome: "Ribbon (cartões)", curto: "ribbon", grupo: "Ribbon (cartões)", ponto: "bg-teal-500", ordem: 2 },
  other: { nome: "Outro", curto: "outro", grupo: "Outros (plotter, recorte…)", ponto: "bg-amber-500", ordem: 3 },
};
const tipoInfo = (t: string | null | undefined) => TIPOS[t || "other"] || TIPOS.other;

const abas = (tipo: string): { valor: string; nome: string; icone: LucideIcon }[] => [
  { valor: "consumiveis", nome: "Custos e consumíveis", icone: Gauge },
  ...(tipo === "pb" || tipo === "color" || tipo === "ribbon" ? [{ valor: "contadores", nome: "Contadores", icone: ClipboardList }] : []),
  { valor: "historico", nome: "Histórico de preços", icone: History },
  { valor: "manutencoes", nome: "Manutenções", icone: Wrench },
  { valor: "perdas", nome: "Perdas", icone: AlertTriangle },
  { valor: "solicitacoes", nome: "Solicitar manutenção", icone: MailWarning },
  { valor: "dashboard", nome: "Painel", icone: BarChart3 },
];

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

function CustoTile({ titulo, valor, detalhe, destaque }: { titulo: string; valor: number; detalhe: string; destaque?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${destaque ? "bg-primary/5 border-primary/30" : "bg-card"}`}>
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className={`text-3xl font-semibold tracking-tight tabular-nums mt-1 ${destaque ? "text-primary" : ""}`}>{fmt4(valor)}</p>
      <p className="text-xs text-muted-foreground mt-1">{detalhe}</p>
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${className || ""}`}>{children}</span>;
}

// ─── Component ───────────────────────────────────────────────────────
export default function Equipamentos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { requireAdmin } = usePermissionGuard();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [activeEquipment, setActiveEquipment] = useState<string>("");
  const [activeSubTab, setActiveSubTab] = useState<string>("consumiveis");
  const [topMode, setTopMode] = useState<"equipments" | "price-history">("equipments");
  const [loading, setLoading] = useState(true);
  const [autoOpenQuickFor, setAutoOpenQuickFor] = useState<string | null>(null);
  const [autoOpenTonerFor, setAutoOpenTonerFor] = useState<string | null>(null);

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
  const [consScales, setConsScales] = useState(true);
  const [consColorOnly, setConsColorOnly] = useState(false);

  // Etapa 4b — erros de validação Zod inline
  const [equipErrors, setEquipErrors] = useState<Record<string, string>>({});
  const [consErrors, setConsErrors] = useState<Record<string, string>>({});

  const equipFormValid = useMemo(
    () => equipmentSchema.safeParse({
      name: equipName,
      printer_type: equipType,
      description: equipDesc,
    }).success,
    [equipName, equipType, equipDesc],
  );
  const consFormValid = useMemo(
    () => consumableSchema.safeParse({
      name: consName,
      price: Number(consPrice),
      yield_pages: Number(consYield),
    }).success,
    [consName, consPrice, consYield],
  );


  // ─── Data loading ──────────────────────────────────────────────────
  const fetchAll = async () => {
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

  // Deep link suporta dois formatos:
  //  - Legado da Júlia: ?eq=<id>&quick=1
  //  - Command Palette: ?action=quick-reading|toner-change&equipment=<id>  ou  ?tab=maintenance&action=new
  useEffect(() => {
    if (loading || equipments.length === 0) return;
    const next = new URLSearchParams(searchParams);
    let consumed = false;

    // Formato legado
    const legacyEq = searchParams.get("eq");
    const legacyQuick = searchParams.get("quick");
    if (legacyEq && equipments.find(e => e.id === legacyEq)) {
      setActiveEquipment(legacyEq);
      setActiveSubTab("contadores");
      if (legacyQuick) setAutoOpenQuickFor(legacyEq);
      next.delete("eq"); next.delete("quick");
      consumed = true;
    }

    // Formato Command Palette
    const action = searchParams.get("action");
    const equipmentId = searchParams.get("equipment");
    const tab = searchParams.get("tab");

    if (action === "quick-reading" && equipmentId && equipments.find(e => e.id === equipmentId)) {
      setActiveEquipment(equipmentId);
      setActiveSubTab("contadores");
      setAutoOpenQuickFor(equipmentId);
      next.delete("action"); next.delete("equipment");
      consumed = true;
    } else if (action === "toner-change" && equipmentId && equipments.find(e => e.id === equipmentId)) {
      setActiveEquipment(equipmentId);
      setActiveSubTab("contadores");
      setAutoOpenTonerFor(equipmentId);
      next.delete("action"); next.delete("equipment");
      consumed = true;
    } else if (tab === "maintenance") {
      setActiveSubTab("manutencoes");
      next.delete("tab"); next.delete("action");
      consumed = true;
    }

    if (consumed) setSearchParams(next, { replace: true });
  }, [loading, equipments, searchParams, setSearchParams]);

  // Derived
  const activeEq = equipments.find(e => e.id === activeEquipment);
  const activeConsumables = useMemo(
    () => consumables.filter((c) => c.equipment_id === activeEquipment).sort((a, b) => a.sort_order - b.sort_order),
    [consumables, activeEquipment]
  );

  const isRibbon = activeEq?.printer_type === "ribbon";
  const custosPorMaquina = useMemo(() => {
    const m = new Map<string, CustosDaMaquina>();
    for (const e of equipments) m.set(e.id, custosDaMaquina(e.printer_type, consumables.filter((c) => c.equipment_id === e.id)));
    return m;
  }, [equipments, consumables]);
  const custosAtivos: CustosDaMaquina = custosPorMaquina.get(activeEquipment) ?? custosDaMaquina(activeEq?.printer_type, []);

  const resumoCusto = (e: Equipment) => {
    const c = custosPorMaquina.get(e.id);
    if (!c || !consumables.some((x) => x.equipment_id === e.id)) return "sem consumíveis";
    if (c.direto !== null) return `${fmt4(c.direto)} por impressão`;
    if (c.colorida !== null) return `Colorida ${fmt4(c.colorida)} · P&B ${fmt4(c.pb ?? 0)}`;
    return `${e.printer_type === "other" ? "Por uso" : "P&B"} ${fmt4(c.pb ?? 0)}`;
  };

  const grupos = useMemo(() => {
    const tipos = Array.from(new Set(equipments.map((e) => (TIPOS[e.printer_type] ? e.printer_type : "other"))));
    tipos.sort((a, b) => tipoInfo(a).ordem - tipoInfo(b).ordem);
    return tipos.map((t) => ({
      tipo: t,
      titulo: tipoInfo(t).grupo,
      itens: equipments.filter((e) => (TIPOS[e.printer_type] ? e.printer_type : "other") === t),
    }));
  }, [equipments]);

  const escolherMaquina = (id: string) => {
    setActiveEquipment(id);
    const eq = equipments.find((e) => e.id === id);
    if (!abas(eq?.printer_type || "").some((a) => a.valor === activeSubTab)) setActiveSubTab("consumiveis");
  };

  const marcarComoColorida = async (eq: Equipment) => {
    if (!requireAdmin("editar equipamento")) return;
    const { error } = await supabase.from("equipments").update({ printer_type: "color" }).eq("id", eq.id);
    if (error) return handleError(error, "marcar como colorida");
    await logAudit({ action: "edição", entity_type: "Equipamento", entity_id: eq.id, entity_name: `${eq.name} (tipo: colorida)` });
    toast.success(`${eq.name} agora é colorida`);
    fetchAll();
  };

  const marcarSoColorida = async (itens: Consumable[]) => {
    if (!requireAdmin("editar consumível") || !itens.length) return;
    const { error } = await supabase.from("equipment_consumables").update({ mode: "color_only" }).in("id", itens.map((c) => c.id));
    if (error) return handleError(error, "marcar consumíveis");
    await logAudit({ action: "edição", entity_type: "Consumível", entity_id: itens[0].id, entity_name: `${itens.map((c) => c.name).join(", ")}: só colorida (${activeEq?.name})` });
    toast.success("Pronto: o custo P&B não inclui mais essas cores");
    fetchAll();
  };

  // ─── Equipment CRUD ────────────────────────────────────────────────
  const openEquipDialog = (eq?: Equipment) => {
    setEquipErrors({});
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
    const parsed = equipmentSchema.safeParse({
      name: equipName,
      printer_type: equipType,
      description: equipDesc,
    });
    if (!parsed.success) { setEquipErrors(zodErrorsToMap(parsed.error)); return; }
    setEquipErrors({});
    if (!requireAdmin(editingEquip ? "atualizar equipamento" : "cadastrar equipamento")) return;
    const payload = {
      name: parsed.data.name,
      description: parsed.data.description ? parsed.data.description : null,
      printer_type: parsed.data.printer_type,
    };
    if (editingEquip) {
      const { error } = await supabase.from("equipments").update(payload).eq("id", editingEquip.id);
      if (error) return handleError(error, "atualizar equipamento");
      await logAudit({ action: "edição", entity_type: "Equipamento", entity_id: editingEquip.id, entity_name: payload.name });
    } else {
      const { data, error } = await supabase.from("equipments").insert({
        ...payload, sort_order: equipments.length,
      }).select("id").single();
      if (error) return handleError(error, "cadastrar equipamento");
      await logAudit({ action: "criação", entity_type: "Equipamento", entity_id: data?.id, entity_name: payload.name });
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
    if (!requireAdmin("excluir equipamento")) return;
    const { error } = await supabase.from("equipments").delete().eq("id", deleteEquipId);
    if (error) { setConfirmEquipOpen(false); return handleError(error, "excluir equipamento"); }
    await logAudit({ action: "exclusão", entity_type: "Equipamento", entity_id: deleteEquipId, entity_name: deleteItemName });
    if (activeEquipment === deleteEquipId) setActiveEquipment("");
    toast.success("Equipamento removido!");
    setConfirmEquipOpen(false);
    fetchAll();
  };

  // ─── Consumable CRUD with price history ───────────────────────────
  const openConsDialog = (cons?: Consumable) => {
    setConsErrors({});
    if (cons) {
      setEditingCons(cons);
      setConsName(cons.name);
      setConsPrice(String(cons.price));
      setConsYield(String(cons.yield_pages));
      setConsScales(cons.scales_with_coverage !== false);
      setConsColorOnly(cons.mode === "color_only");
    } else {
      setEditingCons(null);
      setConsName("");
      setConsPrice("0");
      setConsYield("1");
      setConsScales(true);
      setConsColorOnly(false);
    }
    setShowConsDialog(true);
  };

  const saveConsumable = async () => {
    const parsed = consumableSchema.safeParse({
      name: consName,
      price: Number(consPrice),
      yield_pages: Number(consYield),
    });
    if (!parsed.success) { setConsErrors(zodErrorsToMap(parsed.error)); return; }
    setConsErrors({});
    if (!requireAdmin(editingCons ? "atualizar consumível" : "cadastrar consumível")) return;
    const newPrice = parsed.data.price;
    const newYield = parsed.data.yield_pages;

    if (editingCons) {
      if (editingCons.price !== newPrice || editingCons.yield_pages !== newYield) {
        const { error: histErr } = await supabase.from("consumable_price_history").insert({
          consumable_id: editingCons.id,
          price: editingCons.price,
          yield_pages: editingCons.yield_pages,
          change_date: new Date().toISOString().split("T")[0],
          notes: `Preço alterado de ${fmt(editingCons.price)} para ${fmt(newPrice)}`,
        });
        if (histErr) return handleError(histErr, "registrar histórico de preço");
      }
      const { error } = await supabase.from("equipment_consumables").update({
        name: parsed.data.name, price: newPrice, yield_pages: newYield,
        scales_with_coverage: consScales, mode: consColorOnly ? "color_only" : "shared",
      }).eq("id", editingCons.id);
      if (error) return handleError(error, "atualizar consumível");
      await logAudit({ action: "edição", entity_type: "Consumível", entity_id: editingCons.id, entity_name: `${parsed.data.name} (${activeEq?.name})` });
    } else {
      const { data, error } = await supabase.from("equipment_consumables").insert({
        equipment_id: activeEquipment, name: parsed.data.name, price: newPrice, yield_pages: newYield, sort_order: activeConsumables.length,
        scales_with_coverage: consScales, mode: consColorOnly ? "color_only" : "shared",
      }).select("id").single();
      if (error) return handleError(error, "cadastrar consumível");
      await logAudit({ action: "criação", entity_type: "Consumível", entity_id: data?.id, entity_name: `${parsed.data.name} (${activeEq?.name})` });
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
    if (!requireAdmin("excluir consumível")) return;
    const { error } = await supabase.from("equipment_consumables").delete().eq("id", deleteConsId);
    if (error) { setConfirmConsOpen(false); return handleError(error, "excluir consumível"); }
    await logAudit({ action: "exclusão", entity_type: "Consumível", entity_id: deleteConsId, entity_name: `${deleteItemName} (${activeEq?.name})` });
    toast.success("Consumível removido!");
    setConfirmConsOpen(false);
    fetchAll();
  };

  // ─── Render ────────────────────────────────────────────────────────
  if (loading) { return <PageLoader />; }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <PageHeader icon={Cpu} title="Cadastro de Equipamentos" description="Registre impressoras, consumíveis, acompanhe contadores e evolução de preços" />
        <AdminOnly mode="disable" action="cadastrar equipamento">
          <Button onClick={() => openEquipDialog()} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo Equipamento
          </Button>
        </AdminOnly>
      </div>

      {/* Top mode toggle */}
      <div className="inline-flex items-center rounded-full bg-muted/60 p-1 gap-1">
        <button
          type="button"
          onClick={() => setTopMode("equipments")}
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
            topMode === "equipments"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Cpu className="h-3.5 w-3.5" /> Por equipamento
        </button>
        <button
          type="button"
          onClick={() => setTopMode("price-history")}
          title="Visão gerencial de todas as compras e fornecedores"
          className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
            topMode === "price-history"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Compras de todas as máquinas</span>
          <span className="sm:hidden">Global</span>
        </button>
      </div>

      {topMode === "price-history" ? (
        <PriceHistoryGlobalTab
          equipments={equipments.map(e => ({ id: e.id, name: e.name }))}
          consumables={consumables}
          onChanged={fetchAll}
        />
      ) : equipments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Printer className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Nenhum equipamento cadastrado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Cadastre impressoras como "Xerox 252", "Ricoh 5002", etc.
            </p>
            <AdminOnly mode="disable" action="cadastrar equipamento">
              <Button onClick={() => openEquipDialog()} className="gap-1.5">
                <Plus className="h-4 w-4" /> Novo Equipamento
              </Button>
            </AdminOnly>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col md:flex-row gap-4 lg:gap-6">
          {/* Lista de máquinas */}
          <aside className="md:w-72 shrink-0 space-y-3">
            <div className="md:hidden">
              <Select value={activeEquipment} onValueChange={escolherMaquina}>
                <SelectTrigger><SelectValue placeholder="Escolha a máquina" /></SelectTrigger>
                <SelectContent>
                  {equipments.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} · {tipoInfo(e.printer_type).curto}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {grupos.map((g) => (
              <div key={g.tipo} className="hidden md:block">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 mb-1">{g.titulo}</p>
                <div className="space-y-1">
                  {g.itens.map((e) => {
                    const ativo = e.id === activeEquipment;
                    return (
                      <button
                        key={e.id}
                        onClick={() => escolherMaquina(e.id)}
                        className={`w-full text-left rounded-xl px-3 py-2.5 border transition-colors ${ativo ? "border-primary bg-primary/10 shadow-sm" : "border-transparent hover:bg-muted"}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${tipoInfo(e.printer_type).ponto}`} />
                          <span className={`text-sm truncate ${ativo ? "font-semibold text-primary" : "font-medium"}`}>{e.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 pl-4">{resumoCusto(e)}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </aside>

          {/* Máquina escolhida */}
          {activeEq && (
            <main className="flex-1 min-w-0 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-semibold tracking-tight">{activeEq.name}</h2>
                    <Badge variant="secondary" className="rounded-full gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${tipoInfo(activeEq.printer_type).ponto}`} />
                      {tipoInfo(activeEq.printer_type).nome}
                    </Badge>
                  </div>
                  {activeEq.description && <p className="text-sm text-muted-foreground mt-0.5">{activeEq.description}</p>}
                </div>
                <div className="flex gap-1">
                  <AdminOnly mode="disable" action="editar equipamento">
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => openEquipDialog(activeEq)}>
                      <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar máquina
                    </Button>
                  </AdminOnly>
                  <AdminOnly mode="disable" action="excluir equipamento">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive" onClick={() => requestDeleteEquip(activeEq.id)} aria-label="Excluir máquina">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AdminOnly>
                </div>
              </div>

              <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
                <div>
                  <TabsList className="h-auto rounded-2xl bg-muted/60 p-1 gap-1 flex-wrap justify-start">
                    {abas(activeEq.printer_type).map((a) => (
                      <TabsTrigger key={a.valor} value={a.valor} className="rounded-full px-3.5 py-1.5 text-xs sm:text-sm gap-1.5 data-[state=active]:shadow-sm">
                        <a.icone className="h-3.5 w-3.5" /> {a.nome}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {/* ── Custos e consumíveis ── */}
                <TabsContent value="consumiveis" className="space-y-4 mt-4">
                  {pareceColorida(activeEq.printer_type, activeConsumables) && (
                    <Aviso>
                      Esta máquina tem tintas/toners de cor, mas está cadastrada como <strong>{tipoInfo(activeEq.printer_type).nome}</strong>.
                      Por isso aparece só um custo, somando todas as cores.
                      <AdminOnly mode="disable" action="editar equipamento">
                        <Button size="sm" variant="outline" className="ml-2 h-7 rounded-full" onClick={() => marcarComoColorida(activeEq)}>Marcar como colorida</Button>
                      </AdminOnly>
                    </Aviso>
                  )}
                  {corNoPb(activeEq.printer_type, activeConsumables).length > 0 && (
                    <Aviso>
                      {corNoPb(activeEq.printer_type, activeConsumables).map((c) => c.name).join(", ")} {corNoPb(activeEq.printer_type, activeConsumables).length === 1 ? "está entrando" : "estão entrando"} no custo preto e branco.
                      <AdminOnly mode="disable" action="editar consumível">
                        <Button size="sm" variant="outline" className="ml-2 h-7 rounded-full" onClick={() => marcarSoColorida(corNoPb(activeEq.printer_type, activeConsumables) as Consumable[])}>Usar só na colorida</Button>
                      </AdminOnly>
                    </Aviso>
                  )}

                  {/* Custos por página */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {custosAtivos.direto !== null ? (
                      <CustoTile titulo="Custo por impressão" valor={custosAtivos.direto} detalhe="Cartão/ribbon: preço ÷ rendimento. Frente e verso = 2 impressões." destaque />
                    ) : (
                      <>
                        {custosAtivos.colorida !== null && (
                          <CustoTile titulo="Página colorida" valor={custosAtivos.colorida} detalhe={`Pelo fabricante (5%): ${fmt4(custosAtivos.fabricanteColorida ?? 0)}`} destaque />
                        )}
                        <CustoTile
                          titulo={activeEq.printer_type === "other" ? "Custo por uso" : "Página preto e branco"}
                          valor={custosAtivos.pb ?? 0}
                          detalhe={`Pelo fabricante (5%): ${fmt4(custosAtivos.fabricantePb ?? 0)}`}
                          destaque={custosAtivos.colorida === null}
                        />
                      </>
                    )}
                  </div>
                  {custosAtivos.direto === null && (
                    <p className="text-xs text-muted-foreground px-1">
                      Custos com <strong>20% de cobertura</strong> (o que vai para os orçamentos). O rendimento é o da embalagem (5%); só tinta e toner aumentam com a cobertura.
                      {custosAtivos.colorida !== null && " A página preto e branco usa só o que está marcado para as duas."}
                    </p>
                  )}

                  {/* Consumíveis */}
                  <Card className="rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between py-3 px-4 space-y-0">
                      <CardTitle className="text-base">Consumíveis <span className="text-muted-foreground font-normal text-sm">({activeConsumables.length})</span></CardTitle>
                      <AdminOnly mode="disable" action="cadastrar consumível">
                        <Button onClick={() => openConsDialog()} size="sm" className="rounded-full gap-1.5">
                          <Plus className="h-3.5 w-3.5" /> Adicionar
                        </Button>
                      </AdminOnly>
                    </CardHeader>
                    <CardContent className="px-0 pb-2">
                      {activeConsumables.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8 px-4">
                          Adicione o que a máquina gasta: {isRibbon ? "ribbon, cartão, depreciação…" : "toner ou tinta de cada cor, cilindro, fusor, manutenção, depreciação…"}
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="pl-4">Consumível</TableHead>
                                <TableHead className="text-right">Preço</TableHead>
                                <TableHead className="text-right">Rende</TableHead>
                                {custosAtivos.direto !== null ? (
                                  <TableHead className="text-right">Por impressão</TableHead>
                                ) : (
                                  <>
                                    {custosAtivos.colorida !== null && <TableHead className="text-right">Colorida</TableHead>}
                                    <TableHead className="text-right">{custosAtivos.colorida !== null ? "P&B" : "Por página"}</TableHead>
                                  </>
                                )}
                                <TableHead className="w-[84px]" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {activeConsumables.map((c) => {
                                const porPagina = custosAtivos.direto !== null ? (c.yield_pages > 0 ? c.price / c.yield_pages : 0) : consumableCost(c, 20);
                                return (
                                  <TableRow key={c.id}>
                                    <TableCell className="pl-4">
                                      <span className="font-medium">{c.name}</span>
                                      {custosAtivos.direto === null && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {custosAtivos.colorida !== null && (
                                            c.mode === "color_only"
                                              ? <Chip className="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">Só colorida</Chip>
                                              : <Chip className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">Colorida e P&B</Chip>
                                          )}
                                          <Chip className="bg-muted text-muted-foreground">{c.scales_with_coverage === false ? "Custo fixo por página" : "Varia com a cobertura"}</Chip>
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">{fmt(c.price)}</TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtNum(c.yield_pages)} {isRibbon ? "impr." : "pág."}</TableCell>
                                    {custosAtivos.direto !== null ? (
                                      <TableCell className="text-right tabular-nums">{fmt4(porPagina)}</TableCell>
                                    ) : (
                                      <>
                                        {custosAtivos.colorida !== null && <TableCell className="text-right tabular-nums">{fmt4(porPagina)}</TableCell>}
                                        <TableCell className="text-right tabular-nums">
                                          {custosAtivos.colorida !== null && c.mode === "color_only" ? <span className="text-muted-foreground">—</span> : fmt4(porPagina)}
                                        </TableCell>
                                      </>
                                    )}
                                    <TableCell className="pr-3">
                                      <div className="flex gap-0.5 justify-end">
                                        <AdminOnly mode="disable" action="editar consumível">
                                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openConsDialog(c)} aria-label={`Editar ${c.name}`}>
                                            <Edit2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </AdminOnly>
                                        <AdminOnly mode="disable" action="excluir consumível">
                                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive" onClick={() => requestDeleteCons(c.id, c.name)} aria-label={`Excluir ${c.name}`}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </AdminOnly>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              <TableRow className="bg-muted/40 hover:bg-muted/40 font-semibold">
                                <TableCell className="pl-4" colSpan={3}>Total por {isRibbon ? "impressão" : "página"}</TableCell>
                                {custosAtivos.direto !== null ? (
                                  <TableCell className="text-right tabular-nums text-primary">{fmt4(custosAtivos.direto)}</TableCell>
                                ) : (
                                  <>
                                    {custosAtivos.colorida !== null && <TableCell className="text-right tabular-nums text-primary">{fmt4(custosAtivos.colorida)}</TableCell>}
                                    <TableCell className="text-right tabular-nums text-primary">{fmt4(custosAtivos.pb ?? 0)}</TableCell>
                                  </>
                                )}
                                <TableCell />
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="contadores" className="mt-4">
                  <PrinterReadingsTab
                    key={activeEq.id}
                    equipmentId={activeEq.id}
                    equipmentName={activeEq.name}
                    printerType={activeEq.printer_type}
                    autoOpenQuick={autoOpenQuickFor === activeEq.id}
                    autoOpenToner={autoOpenTonerFor === activeEq.id}
                    onAutoOpenHandled={() => {
                      setAutoOpenQuickFor(null);
                      setAutoOpenTonerFor(null);
                    }}
                  />
                </TabsContent>
                <TabsContent value="historico" className="mt-4">
                  <ConsumablePriceHistoryTab key={activeEq.id} equipmentId={activeEq.id} equipmentName={activeEq.name} consumables={activeConsumables} />
                </TabsContent>
                <TabsContent value="manutencoes" className="mt-4">
                  <MaintenanceTab key={activeEq.id} equipmentId={activeEq.id} equipmentName={activeEq.name} printerType={activeEq.printer_type} />
                </TabsContent>
                <TabsContent value="perdas" className="mt-4">
                  <ProductionLossesTab key={activeEq.id} equipmentId={activeEq.id} equipmentName={activeEq.name} />
                </TabsContent>
                <TabsContent value="solicitacoes" className="mt-4">
                  <MaintenanceRequestsTab key={activeEq.id} equipmentId={activeEq.id} equipmentName={activeEq.name} />
                </TabsContent>
                <TabsContent value="dashboard" className="mt-4">
                  <EquipmentDashboardTab key={activeEq.id} equipmentId={activeEq.id} equipmentName={activeEq.name} />
                </TabsContent>
              </Tabs>
            </main>
          )}
        </div>
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
              <Input value={equipName} onChange={(e) => setEquipName(e.target.value)} placeholder="Ex: Xerox 252 Color" maxLength={120} />
              {equipErrors.name && <p className="text-xs text-destructive">{equipErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Tipo de máquina</Label>
              <Select value={equipType} onValueChange={setEquipType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="color">Colorida (faz P&B também)</SelectItem>
                  <SelectItem value="pb">Só preto e branco</SelectItem>
                  <SelectItem value="ribbon">Ribbon / cartões (custo por impressão)</SelectItem>
                  <SelectItem value="other">Outro (plotter, recorte…)</SelectItem>
                </SelectContent>
              </Select>
              {equipErrors.printer_type && <p className="text-xs text-destructive">{equipErrors.printer_type}</p>}
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={equipDesc} onChange={(e) => setEquipDesc(e.target.value)} placeholder="Ex: Impressora laser colorida A3" maxLength={500} />
              {equipErrors.description && <p className="text-xs text-destructive">{equipErrors.description}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEquipDialog(false)}>Cancelar</Button>
            <Button onClick={saveEquipment} disabled={!equipFormValid}>Salvar</Button>
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
              <Input value={consName} onChange={(e) => setConsName(e.target.value)} placeholder={isRibbon ? "Ex: Ribbon, Cartão PVC, Depreciação" : "Ex: Toner Preto"} maxLength={120} />
              {consErrors.name && <p className="text-xs text-destructive">{consErrors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Preço (R$)</Label>
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs">
                        Valor de compra do consumível. <strong>Para Depreciação:</strong> informe o valor pago na impressora menos o valor residual estimado de revenda (ex: pagou R$ 30.000, espera vender por R$ 5.000 → cadastre R$ 25.000). No campo Rendimento, informe o total de páginas previstas na vida útil.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input type="number" step="0.01" value={consPrice} onChange={(e) => setConsPrice(e.target.value)} />
                {consErrors.price && <p className="text-xs text-destructive">{consErrors.price}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>{isRibbon ? "Rendimento (impressões)" : "Rendimento (páginas)"}</Label>
                  {!isRibbon && (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs">
                          Informe o valor que consta na embalagem (cobertura 5%). Se o item varia com a cobertura, o sistema converte para 20% nos cálculos de venda.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <Input type="number" step="1" value={consYield} onChange={(e) => setConsYield(e.target.value)} />
                {consErrors.yield_pages && <p className="text-xs text-destructive">{consErrors.yield_pages}</p>}
              </div>
            </div>
            {!isRibbon && (
              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label>Varia com a cobertura</Label>
                    <p className="text-xs text-muted-foreground">Ligue para toner e tinta. Fusor, belt, cilindro, revelador, manutenção e depreciação custam o mesmo por página.</p>
                  </div>
                  <Switch checked={consScales} onCheckedChange={setConsScales} />
                </div>
                {activeEq?.printer_type === "color" && (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Label>Só na página colorida</Label>
                      <p className="text-xs text-muted-foreground">Ligue para ciano, magenta e amarelo (toner/tinta, revelador, cilindro). Desligado = entra na colorida e no preto e branco (preto, fusor, manutenção, depreciação…).</p>
                    </div>
                    <Switch checked={consColorOnly} onCheckedChange={setConsColorOnly} />
                  </div>
                )}
              </div>
            )}
            {Number(consYield) > 0 && (
              <div className="rounded-lg bg-muted/50 p-3">
                {isRibbon ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custo/Impressão</span>
                    <span className="font-semibold font-mono">{fmt4(Number(consPrice) / Number(consYield))}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Custo/Página (5%)</span>
                      <span className="font-semibold font-mono">{fmt4(Number(consPrice) / Number(consYield))}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Custo/Página (20%)</span>
                      <span className="font-semibold font-mono">{fmt4(consumableCost({ price: Number(consPrice), yield_pages: Number(consYield), scales_with_coverage: consScales }, 20))}</span>
                    </div>
                  </>
                )}
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
            <Button onClick={saveConsumable} disabled={!consFormValid}>Salvar</Button>
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
