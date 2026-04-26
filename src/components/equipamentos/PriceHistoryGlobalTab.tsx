import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, DollarSign, TrendingUp, ShoppingCart, Flame, Search, History, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PriceHistoryCard, { PurchaseRow } from "./PriceHistoryCard";
import RegisterPurchaseDialog from "./RegisterPurchaseDialog";

interface Equipment {
  id: string;
  name: string;
}
interface Consumable {
  id: string;
  equipment_id: string;
  name: string;
  price: number;
  yield_pages: number;
}

interface RawHistRow extends PurchaseRow {
  consumable_id: string;
}

interface Props {
  equipments: Equipment[];
  consumables: Consumable[];
  /** Disparado para o pai recarregar consumíveis se preço base for atualizado */
  onChanged?: () => void;
}

type Period = "30" | "90" | "365" | "all";

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PriceHistoryGlobalTab({ equipments, consumables, onChanged }: Props) {
  const [history, setHistory] = useState<RawHistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);

  // Filters
  const [equipFilter, setEquipFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [period, setPeriod] = useState<Period>("90");
  const [search, setSearch] = useState("");

  const consIds = useMemo(() => consumables.map(c => c.id), [consumables]);

  const fetchHistory = useCallback(async () => {
    if (consIds.length === 0) { setHistory([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("consumable_price_history")
      .select("id, consumable_id, change_date, price, quantity, unit_price, supplier, invoice_ref, notes")
      .in("consumable_id", consIds)
      .order("change_date", { ascending: false });
    if (data) setHistory(data as any);
    setLoading(false);
  }, [consIds.join("|")]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("price-history-global")
      .on("postgres_changes", { event: "*", schema: "public", table: "consumable_price_history" },
        () => fetchHistory())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchHistory]);

  // Lookup maps
  const consMap = useMemo(() => {
    const m = new Map<string, Consumable>();
    consumables.forEach(c => m.set(c.id, c));
    return m;
  }, [consumables]);
  const equipMap = useMemo(() => {
    const m = new Map<string, Equipment>();
    equipments.forEach(e => m.set(e.id, e));
    return m;
  }, [equipments]);

  // Distinct suppliers
  const allSuppliers = useMemo(() => {
    const set = new Set<string>();
    history.forEach(h => { if (h.supplier?.trim()) set.add(h.supplier.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [history]);

  // Period cutoff
  const cutoffDate = useMemo(() => {
    if (period === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(period));
    return d;
  }, [period]);

  // Filtered history
  const filtered = useMemo(() => {
    return history.filter(h => {
      if (cutoffDate && new Date(h.change_date) < cutoffDate) return false;
      const cons = consMap.get(h.consumable_id);
      if (!cons) return false;
      if (equipFilter !== "all" && cons.equipment_id !== equipFilter) return false;
      if (supplierFilter !== "all" && (h.supplier || "").trim() !== supplierFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const eqName = equipMap.get(cons.equipment_id)?.name.toLowerCase() || "";
        if (!cons.name.toLowerCase().includes(q) &&
            !eqName.includes(q) &&
            !(h.supplier || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [history, cutoffDate, consMap, equipFilter, supplierFilter, search, equipMap]);

  // KPIs from filtered set
  const kpis = useMemo(() => {
    const spent = filtered.reduce((s, h) => s + (h.price || 0), 0);
    const count = filtered.length;

    // Per-consumable variations on filtered set
    const byCons: Record<string, RawHistRow[]> = {};
    filtered.forEach(h => {
      if (!byCons[h.consumable_id]) byCons[h.consumable_id] = [];
      byCons[h.consumable_id].push(h);
    });
    const vars: Array<{ consId: string; pct: number }> = [];
    Object.entries(byCons).forEach(([cid, rows]) => {
      const sorted = [...rows].sort((a, b) =>
        new Date(b.change_date).getTime() - new Date(a.change_date).getTime());
      if (sorted.length >= 2) {
        const a = sorted[0].unit_price ?? sorted[0].price / Math.max(sorted[0].quantity || 1, 1);
        const b = sorted[1].unit_price ?? sorted[1].price / Math.max(sorted[1].quantity || 1, 1);
        if (b > 0) vars.push({ consId: cid, pct: ((a - b) / b) * 100 });
      }
    });
    const avgVar = vars.length > 0 ? vars.reduce((s, v) => s + v.pct, 0) / vars.length : 0;
    const topRise = vars.length > 0
      ? vars.reduce((a, b) => (b.pct > a.pct ? b : a))
      : null;
    const topRiseName = topRise ? consMap.get(topRise.consId)?.name : null;

    return { spent, count, avgVar, topRise, topRiseName };
  }, [filtered, consMap]);

  // Group filtered by consumable for cards
  const consumableGroups = useMemo(() => {
    const byCons: Record<string, RawHistRow[]> = {};
    filtered.forEach(h => {
      if (!byCons[h.consumable_id]) byCons[h.consumable_id] = [];
      byCons[h.consumable_id].push(h);
    });
    // Sort by most recent purchase
    return Object.entries(byCons)
      .map(([cid, rows]) => ({
        consumable: consMap.get(cid),
        equipmentName: consMap.get(cid) ? equipMap.get(consMap.get(cid)!.equipment_id)?.name : undefined,
        rows,
        lastDate: Math.max(...rows.map(r => new Date(r.change_date).getTime())),
      }))
      .filter(g => g.consumable)
      .sort((a, b) => b.lastDate - a.lastDate);
  }, [filtered, consMap, equipMap]);

  const hasActiveFilters = equipFilter !== "all" || supplierFilter !== "all" || search.trim() !== "" || period !== "90";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiCard
          icon={<ShoppingCart className="h-3.5 w-3.5" />}
          label="Compras"
          value={String(kpis.count)}
        />
        <KpiCard
          icon={<DollarSign className="h-3.5 w-3.5" />}
          label="Gasto"
          value={fmt(kpis.spent)}
        />
        <KpiCard
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Var. média"
          value={`${kpis.avgVar > 0 ? "+" : ""}${kpis.avgVar.toFixed(1)}%`}
          tone={kpis.avgVar > 0.5 ? "danger" : kpis.avgVar < -0.5 ? "success" : "neutral"}
        />
        <KpiCard
          icon={<Flame className="h-3.5 w-3.5" />}
          label="Mais subiu"
          value={kpis.topRiseName ? `${kpis.topRise!.pct > 0 ? "+" : ""}${kpis.topRise!.pct.toFixed(1)}%` : "—"}
          subValue={kpis.topRiseName || undefined}
          tone={kpis.topRise && kpis.topRise.pct > 0 ? "danger" : "neutral"}
        />
      </div>

      {/* Filters bar */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={equipFilter} onValueChange={setEquipFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos equipamentos</SelectItem>
                {equipments.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos fornecedores</SelectItem>
                {allSuppliers.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Últimos 12 meses</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar consumível, fornecedor ou equipamento..."
                className="h-9 pl-8 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button size="sm" onClick={() => setOpenDialog(true)} className="gap-1.5 h-9 shrink-0">
              <Plus className="h-3.5 w-3.5" /> Registrar compra
            </Button>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setEquipFilter("all"); setSupplierFilter("all"); setSearch(""); setPeriod("90"); }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              limpar filtros
            </button>
          )}
        </CardContent>
      </Card>

      {/* Cards by consumable */}
      {consumableGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {history.length === 0
                ? "Nenhuma compra registrada ainda"
                : "Nenhuma compra encontrada para os filtros aplicados"}
            </p>
            {history.length === 0 && (
              <Button variant="outline" size="sm" onClick={() => setOpenDialog(true)} className="mt-3 gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Registrar primeira compra
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {consumableGroups.map(g => (
            <PriceHistoryCard
              key={g.consumable!.id}
              consumableName={g.consumable!.name}
              equipmentName={g.equipmentName}
              basePrice={g.consumable!.price}
              purchases={g.rows}
            />
          ))}
        </div>
      )}

      <RegisterPurchaseDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        equipments={equipments}
        consumables={consumables}
        defaultEquipmentId={equipFilter !== "all" ? equipFilter : undefined}
        onSaved={() => { fetchHistory(); onChanged?.(); }}
      />
    </div>
  );
}

function KpiCard({
  icon, label, value, subValue, tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const valueColor =
    tone === "success" ? "text-green-600 dark:text-green-500"
    : tone === "danger" ? "text-destructive"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
          {icon}
          <span className="truncate">{label}</span>
        </div>
        <div className={`mt-1 font-mono text-base sm:text-lg font-semibold tabular-nums leading-none ${valueColor}`}>
          {value}
        </div>
        {subValue && (
          <div className="mt-1 text-[10px] text-muted-foreground truncate">{subValue}</div>
        )}
      </CardContent>
    </Card>
  );
}
