import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trophy, TrendingUp, TrendingDown, Minus, Calculator } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import SupplierCombobox from "./SupplierCombobox";

interface EquipmentLite {
  id: string;
  name: string;
}
interface ConsumableLite {
  id: string;
  equipment_id: string;
  name: string;
  price: number;
  yield_pages: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  equipments: EquipmentLite[];
  consumables: ConsumableLite[];
  /** Pré-seleciona equipamento (visão por equipamento). */
  defaultEquipmentId?: string;
  /** Pré-seleciona consumível. */
  defaultConsumableId?: string;
  onSaved?: () => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface BestPrice {
  unit_price: number;
  supplier: string | null;
  change_date: string;
}

export default function RegisterPurchaseDialog({
  open, onOpenChange, equipments, consumables,
  defaultEquipmentId, defaultConsumableId, onSaved,
}: Props) {
  const [equipmentId, setEquipmentId] = useState("");
  const [consumableId, setConsumableId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [totalPrice, setTotalPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [updateBase, setUpdateBase] = useState(true);
  const [bestPrice, setBestPrice] = useState<BestPrice | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset / preset on open
  useEffect(() => {
    if (!open) return;
    setEquipmentId(defaultEquipmentId || equipments[0]?.id || "");
    setConsumableId(defaultConsumableId || "");
    setQuantity("1");
    setTotalPrice("");
    setSupplier("");
    setInvoiceRef("");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setUpdateBase(true);
  }, [open, defaultEquipmentId, defaultConsumableId, equipments]);

  const equipConsumables = useMemo(
    () => consumables.filter(c => c.equipment_id === equipmentId),
    [consumables, equipmentId],
  );

  const selectedCons = useMemo(
    () => consumables.find(c => c.id === consumableId) || null,
    [consumables, consumableId],
  );

  // Fetch best (lowest) historical unit price for the selected consumable
  useEffect(() => {
    if (!consumableId) { setBestPrice(null); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("consumable_price_history")
        .select("unit_price, supplier, change_date")
        .eq("consumable_id", consumableId)
        .not("unit_price", "is", null)
        .order("unit_price", { ascending: true })
        .limit(1);
      if (!active) return;
      if (data && data.length > 0) {
        setBestPrice(data[0] as BestPrice);
      } else {
        // Fallback: current base price counts as the only known reference
        if (selectedCons && selectedCons.price > 0) {
          setBestPrice({
            unit_price: selectedCons.price,
            supplier: null,
            change_date: new Date().toISOString().split("T")[0],
          });
        } else {
          setBestPrice(null);
        }
      }
    })();
    return () => { active = false; };
  }, [consumableId, selectedCons]);

  const qtyNum = Number(quantity.replace(",", ".")) || 0;
  const totalNum = Number(totalPrice.replace(",", ".")) || 0;
  const unitPrice = qtyNum > 0 ? totalNum / qtyNum : 0;

  const compareBest = useMemo(() => {
    if (!bestPrice || unitPrice <= 0) return null;
    const diff = unitPrice - bestPrice.unit_price;
    const pct = bestPrice.unit_price > 0 ? (diff / bestPrice.unit_price) * 100 : 0;
    return { diff, pct };
  }, [bestPrice, unitPrice]);

  const handleSave = async () => {
    if (!equipmentId) return toast.error("Selecione o equipamento");
    if (!consumableId) return toast.error("Selecione o consumível");
    if (qtyNum <= 0) return toast.error("Quantidade deve ser maior que zero");
    if (totalNum <= 0) return toast.error("Preço total deve ser maior que zero");

    setSaving(true);
    try {
      const payload: any = {
        consumable_id: consumableId,
        price: totalNum,
        quantity: qtyNum,
        yield_pages: selectedCons?.yield_pages ?? 0,
        supplier: supplier.trim() || null,
        invoice_ref: invoiceRef.trim() || null,
        change_date: date,
        notes: notes.trim() || null,
      };
      const { error } = await supabase
        .from("consumable_price_history")
        .insert(payload);
      if (error) throw error;

      if (updateBase && selectedCons && Math.abs(selectedCons.price - unitPrice) > 0.001) {
        await supabase
          .from("equipment_consumables")
          .update({ price: unitPrice })
          .eq("id", consumableId);
      }

      await logAudit({
        action: "criação",
        entity_type: "Compra de Consumível",
        entity_id: consumableId,
        entity_name: `${selectedCons?.name} — ${fmt(totalNum)} (${qtyNum} un)`,
      });

      toast.success("Compra registrada!");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar compra");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar compra</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Equipment + Consumable */}
          <div className="grid grid-cols-1 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Equipamento</Label>
              <Select value={equipmentId} onValueChange={(v) => { setEquipmentId(v); setConsumableId(""); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {equipments.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Consumível</Label>
              <Select value={consumableId} onValueChange={setConsumableId} disabled={!equipmentId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {equipConsumables.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Best price badge */}
          {bestPrice && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 flex items-start gap-2">
              <Trophy className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs leading-tight">
                <div className="font-medium text-foreground">
                  Menor preço já pago: <span className="font-mono">{fmt(bestPrice.unit_price)}</span>/un
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {bestPrice.supplier || "fornecedor não informado"}
                  {" · "}
                  {new Date(bestPrice.change_date).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
          )}

          {/* Qty + Total — 2 cols */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Quantidade</Label>
              <Input
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="h-9 font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preço total (R$)</Label>
              <Input
                inputMode="decimal"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0,00"
                className="h-9 font-mono"
              />
            </div>
          </div>

          {/* Computed unit price */}
          {qtyNum > 0 && totalNum > 0 && (
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5" />
                  Preço unitário
                </span>
                <span className="font-mono text-base font-semibold text-foreground">
                  {fmt(unitPrice)}
                </span>
              </div>
              {compareBest && (
                <div className={
                  "mt-1.5 text-[11px] flex items-center gap-1 " +
                  (compareBest.diff > 0.01
                    ? "text-amber-600 dark:text-amber-500"
                    : compareBest.diff < -0.01
                    ? "text-green-600 dark:text-green-500"
                    : "text-muted-foreground")
                }>
                  {compareBest.diff > 0.01 ? <TrendingUp className="h-3 w-3" /> :
                   compareBest.diff < -0.01 ? <TrendingDown className="h-3 w-3" /> :
                   <Minus className="h-3 w-3" />}
                  {compareBest.diff > 0.01
                    ? `Acima do menor histórico em ${fmt(compareBest.diff)}/un (+${compareBest.pct.toFixed(1)}%)`
                    : compareBest.diff < -0.01
                    ? `🎯 Novo menor preço! ${Math.abs(compareBest.pct).toFixed(1)}% abaixo do anterior`
                    : "Igual ao menor histórico"}
                </div>
              )}
            </div>
          )}

          {/* Supplier */}
          <div className="space-y-1">
            <Label className="text-xs">Fornecedor</Label>
            <SupplierCombobox value={supplier} onChange={setSupplier} />
          </div>

          {/* NF + Date — 2 cols */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">NF / Pedido</Label>
              <Input
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="opcional"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none text-sm"
              placeholder="opcional"
            />
          </div>

          {/* Update base */}
          {selectedCons && unitPrice > 0 && Math.abs(selectedCons.price - unitPrice) > 0.001 && (
            <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={updateBase}
                onCheckedChange={(v) => setUpdateBase(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                Atualizar preço base do consumível para <strong className="text-foreground font-mono">{fmt(unitPrice)}</strong>
                <br />
                <span className="text-[10px] opacity-80">(atual: {fmt(selectedCons.price)})</span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar compra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
