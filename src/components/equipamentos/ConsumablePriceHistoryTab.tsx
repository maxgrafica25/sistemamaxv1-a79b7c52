import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Consumable {
  id: string;
  name: string;
  price: number;
  yield_pages: number;
}

interface PriceHistory {
  id: string;
  consumable_id: string;
  price: number;
  yield_pages: number;
  change_date: string;
  notes: string | null;
  created_at: string;
}

interface ConsumablePriceHistoryTabProps {
  equipmentId: string;
  consumables: Consumable[];
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtNum = (v: number) => v.toLocaleString("pt-BR");

export default function ConsumablePriceHistoryTab({ equipmentId, consumables }: ConsumablePriceHistoryTabProps) {
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const consIds = consumables.map(c => c.id);

  const fetchHistory = async () => {
    if (consIds.length === 0) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("consumable_price_history")
      .select("*")
      .in("consumable_id", consIds)
      .order("change_date", { ascending: false });
    if (data) setHistory(data as PriceHistory[]);
    setLoading(false);
  };

  useEffect(() => { fetchHistory(); }, [equipmentId, consumables.length]);

  const getConsumableName = (id: string) => consumables.find(c => c.id === id)?.name || "—";

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhum histórico de preço registrado</p>
        <p className="text-xs mt-1">O histórico será criado automaticamente quando você editar o preço de um consumível</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Consumível</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Rendimento</TableHead>
            <TableHead>Observações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((h, idx) => {
            const prevSame = history.filter(x => x.consumable_id === h.consumable_id);
            const prevIdx = prevSame.indexOf(h);
            const prev = prevSame[prevIdx + 1];
            const priceDiff = prev ? h.price - prev.price : 0;

            return (
              <TableRow key={h.id}>
                <TableCell className="text-sm">{new Date(h.change_date).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-sm font-medium">{getConsumableName(h.consumable_id)}</TableCell>
                <TableCell className="text-right font-mono text-sm">
                  <div className="flex items-center justify-end gap-1.5">
                    {fmt(h.price)}
                    {priceDiff > 0 && <TrendingUp className="h-3 w-3 text-destructive" />}
                    {priceDiff < 0 && <TrendingDown className="h-3 w-3 text-green-500" />}
                    {priceDiff === 0 && prev && <Minus className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{fmtNum(h.yield_pages)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{h.notes || "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
