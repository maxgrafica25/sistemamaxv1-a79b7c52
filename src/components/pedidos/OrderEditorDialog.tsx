import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClientCombobox } from "@/components/orcamentos-v2/ClientCombobox";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PAYMENT_TERM_OPTIONS, PAYMENT_METHOD_OPTIONS, formatBRL } from "@/lib/erp/payment-terms";

interface OrderItemDraft {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string | null;
  initialFromQuote?: {
    quote_id: string;
    client_id: string | null;
    client_name: string;
    items: OrderItemDraft[];
    total_value: number;
  } | null;
  onSaved?: (orderId: string) => void;
}

export function OrderEditorDialog({ open, onOpenChange, orderId, initialFromQuote, onSaved }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30_60_90");
  const [paymentMethod, setPaymentMethod] = useState("pix");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [productionNotes, setProductionNotes] = useState("");
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [items, setItems] = useState<OrderItemDraft[]>([]);

  const totalValue = items.reduce((sum, it) => sum + (it.quantity * it.unit_price), 0);

  // Hidrata
  useEffect(() => {
    if (!open) return;

    if (orderId) {
      // Editando
      setLoading(true);
      (async () => {
        const [orderRes, itemsRes] = await Promise.all([
          supabase.from("sales_orders").select("*").eq("id", orderId).single(),
          supabase.from("sales_order_items").select("*").eq("order_id", orderId).order("sort_order"),
        ]);
        if (orderRes.data) {
          const o = orderRes.data;
          setClientId(o.client_id);
          setClientName(o.client_name);
          setPaymentTerms(o.payment_terms ?? "30_60_90");
          setPaymentMethod(o.payment_method ?? "pix");
          setDeliveryDate(o.delivery_date ?? "");
          setInternalNotes(o.internal_notes ?? "");
          setProductionNotes(o.production_notes ?? "");
          setQuoteId(o.quote_id);
        }
        setItems((itemsRes.data ?? []).map((it: any) => ({
          id: it.id,
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        })));
        setLoading(false);
      })();
    } else if (initialFromQuote) {
      // Criando a partir de orçamento
      setClientId(initialFromQuote.client_id);
      setClientName(initialFromQuote.client_name);
      setQuoteId(initialFromQuote.quote_id);
      setItems(initialFromQuote.items);
      setPaymentTerms("30_60_90");
      setPaymentMethod("pix");
      setDeliveryDate("");
      setInternalNotes("");
      setProductionNotes("");
    } else {
      // Novo em branco
      setClientId(null);
      setClientName("");
      setQuoteId(null);
      setItems([{ description: "", quantity: 1, unit_price: 0 }]);
      setPaymentTerms("30_60_90");
      setPaymentMethod("pix");
      setDeliveryDate("");
      setInternalNotes("");
      setProductionNotes("");
    }
  }, [open, orderId, initialFromQuote]);

  const addItem = () => setItems((p) => [...p, { description: "", quantity: 1, unit_price: 0 }]);
  const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<OrderItemDraft>) =>
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const handleSave = async () => {
    if (!clientName.trim()) { toast.error("Selecione um cliente."); return; }
    if (items.length === 0 || items.some((it) => !it.description.trim())) {
      toast.error("Preencha a descrição de todos os itens."); return;
    }

    setSaving(true);
    try {
      let savedId = orderId;

      if (orderId) {
        const { error } = await supabase
          .from("sales_orders")
          .update({
            client_id: clientId,
            client_name: clientName,
            total_value: totalValue,
            payment_terms: paymentTerms,
            payment_method: paymentMethod,
            delivery_date: deliveryDate || null,
            internal_notes: internalNotes || null,
            production_notes: productionNotes || null,
          })
          .eq("id", orderId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("sales_orders")
          .insert({
            client_id: clientId ?? undefined,
            client_name: clientName,
            quote_id: quoteId ?? undefined,
            status: "aberto",
            total_value: totalValue,
            payment_terms: paymentTerms,
            payment_method: paymentMethod,
            delivery_date: deliveryDate || undefined,
            internal_notes: internalNotes || undefined,
            production_notes: productionNotes || undefined,
            created_by: user?.id,
            order_number: "", // será preenchido pelo trigger
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        savedId = data.id;
      }

      // Recria itens (estratégia simples: delete + insert)
      if (savedId) {
        await supabase.from("sales_order_items").delete().eq("order_id", savedId);
        for (const [idx, it] of items.entries()) {
          const { error: itemsErr } = await supabase.from("sales_order_items").insert({
            order_id: savedId,
            description: it.description,
            quantity: it.quantity,
            unit_price: it.unit_price,
            line_total: it.quantity * it.unit_price,
            sort_order: idx,
          });
          if (itemsErr) throw itemsErr;
        }
      }

      toast.success(orderId ? "Pedido atualizado." : "Pedido criado.");
      onSaved?.(savedId!);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{orderId ? "Editar Pedido" : "Novo Pedido de Venda"}</DialogTitle>
          <DialogDescription>
            {quoteId ? "Pedido vinculado a um orçamento." : "Preencha os dados do pedido."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 py-2">
            {/* Cliente */}
            <div>
              <Label className="mb-1.5 block">Cliente *</Label>
              <ClientCombobox
                value={{ id: clientId, nome: clientName }}
                onChange={(c) => {
                  setClientId(c.id);
                  setClientName(c.nome);
                }}
              />
            </div>

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Itens *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start rounded-md border border-border bg-muted/20 p-2">
                    <Input
                      className="col-span-12 sm:col-span-6"
                      placeholder="Descrição"
                      value={it.description}
                      onChange={(e) => updateItem(idx, { description: e.target.value })}
                    />
                    <Input
                      type="number" step="0.01" min={0}
                      className="col-span-4 sm:col-span-2"
                      placeholder="Qtd"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                    />
                    <Input
                      type="number" step="0.01" min={0}
                      className="col-span-5 sm:col-span-3"
                      placeholder="Preço unit."
                      value={it.unit_price}
                      onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) || 0 })}
                    />
                    <Button
                      type="button" variant="ghost" size="icon"
                      className="col-span-3 sm:col-span-1 h-9 w-9 text-destructive hover:text-destructive"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-right text-sm font-semibold">
                Total: {formatBRL(totalValue)}
              </div>
            </div>

            {/* Pagamento + entrega */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label className="mb-1.5 block">Condição de pagamento</Label>
                <Select value={paymentTerms} onValueChange={setPaymentTerms}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERM_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Forma prevista</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Data de entrega</Label>
                <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>
            </div>

            {/* Observações */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">Observações internas</Label>
                <Textarea rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">Observações para produção</Label>
                <Textarea rows={3} value={productionNotes} onChange={(e) => setProductionNotes(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
