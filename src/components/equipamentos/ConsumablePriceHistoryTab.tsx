import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Plus, DollarSign, TrendingUp, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PriceHistoryCard, { PurchaseRow } from "./PriceHistoryCard";
import RegisterPurchaseDialog from "./RegisterPurchaseDialog";

interface Consumable {
  id: string;
  equipment_id: string;
  name: string;
  price: number;
  yield_pages: number;
}

interface Equipment {
  id: string;
  name: string;
}

interface Props {
  equipmentId: string;
  equipmentName?: string;
  consumables: Consumable[];
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ConsumablePriceHistoryTab({ equipmentId, equipmentName, consumables }: Props) {
  const [history, setHistory] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);

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

  // KPIs (last 90 days)
  const { spent90, purchases90, avgVar } = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const recent = history.filter(h => new Date(h.change_date) >= cutoff);
    const spent = recent.reduce((s, h) => s + (h.price || 0), 0);

    // Avg variation: per consumable, compare last vs previous unit price
    const byCons: Record<string, PurchaseRow[]> = {};
    for (const h of history) {
      const cid = (h as any).consumable_id;
      if (!byCons[cid]) byCons[cid] = [];
      byCons[cid].push(h);
    }
    const variations: number[] = [];
    Object.values(byCons).forEach(rows => {
      const sorted = [...rows].sort((a, b) =>
        new Date(b.change_date).getTime() - new Date(a.change_date).getTime());
      if (sorted.length >= 2) {
        const a = sorted[0].unit_price ?? sorted[0].price / Math.max(sorted[0].quantity || 1, 1);
        const b = sorted[1].unit_price ?? sorted[1].price / Math.max(sorted[1].quantity || 1, 1);
        if (b > 0) variations.push(((a - b) / b) * 100);
      }
    });
    const avg = variations.length > 0 ? variations.reduce((s, v) => s + v, 0) / variations.length : 0;

    return { spent90: spent, purchases90: recent.length, avgVar: avg };
  }, [history]);

  const equipments: Equipment[] = useMemo(
    () => (equipmentId ? [{ id: equipmentId, name: equipmentName || "Equipamento" }] : []),
    [equipmentId, equipmentName],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* KPIs + action */}
      <div className="grid grid-cols-3 gap-2">
        <KpiMini icon={<DollarSign className="h-3.5 w-3.5" />} label="Gasto 90d" value={fmt(spent90)} />
        <KpiMini
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="Var. média"
          value={`${avgVar > 0 ? "+" : ""}${avgVar.toFixed(1)}%`}
          tone={avgVar > 0.5 ? "danger" : avgVar < -0.5 ? "success" : "neutral"}
        />
        <KpiMini icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Compras 90d" value={String(purchases90)} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {consumables.length} consumíve{consumables.length === 1 ? "l" : "is"} · {history.length} compra{history.length === 1 ? "" : "s"} no total
        </p>
        <Button size="sm" onClick={() => setOpenDialog(true)} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" /> Registrar compra
        </Button>
      </div>

      {/* Cards per consumable */}
      {consumables.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Cadastre consumíveis primeiro para começar a registrar compras</p>
        </div>
      ) : (
        <div className="space-y-2">
          {consumables.map(c => {
            const purchases = history.filter(h => (h as any).consumable_id === c.id);
            return (
              <PriceHistoryCard
                key={c.id}
                consumableName={c.name}
                basePrice={c.price}
                purchases={purchases}
              />
            );
          })}
        </div>
      )}

      <RegisterPurchaseDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        equipments={equipments}
        consumables={consumables}
        defaultEquipmentId={equipmentId}
        onSaved={fetchHistory}
      />
    </div>
  );
}

function KpiMini({
  icon, label, value, tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const valueColor =
    tone === "success" ? "text-green-600 dark:text-green-500"
    : tone === "danger" ? "text-destructive"
    : "text-foreground";
  return (
    <div className="rounded-md border bg-card px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${valueColor}`}>{value}</div>
    </div>
  );
}
