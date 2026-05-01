import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PAYMENT_TERM_OPTIONS, PAYMENT_METHOD_OPTIONS,
  generateInstallments, type InstallmentDraft, formatBRL,
} from "@/lib/erp/payment-terms";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  totalValue: number;
  defaultTerm?: string;
  defaultMethod?: string;
  onCreated?: (accountId: string) => void;
}

export function GenerateReceivableDialog({
  open, onOpenChange, orderId, orderNumber, totalValue,
  defaultTerm = "30_60_90", defaultMethod = "pix", onCreated,
}: Props) {
  const [term, setTerm] = useState(defaultTerm);
  const [method, setMethod] = useState(defaultMethod);
  const [installments, setInstallments] = useState<InstallmentDraft[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTerm(defaultTerm);
    setMethod(defaultMethod);
    setInstallments(generateInstallments(totalValue, defaultTerm, defaultMethod));
  }, [open, defaultTerm, defaultMethod, totalValue]);

  const regenerate = (newTerm: string, newMethod: string) => {
    setTerm(newTerm);
    setMethod(newMethod);
    if (newTerm !== "custom") {
      setInstallments(generateInstallments(totalValue, newTerm, newMethod));
    }
  };

  const sumInstallments = installments.reduce((s, p) => s + (p.amount || 0), 0);
  const diff = Math.abs(sumInstallments - totalValue);
  const mismatch = diff > 0.01;

  const updateInst = (idx: number, patch: Partial<InstallmentDraft>) =>
    setInstallments((p) => p.map((i, n) => (n === idx ? { ...i, ...patch } : i)));
  const addInst = () => setInstallments((p) => [
    ...p,
    { due_date: new Date().toISOString().slice(0, 10), amount: 0, payment_method: method },
  ]);
  const removeInst = (idx: number) => setInstallments((p) => p.filter((_, n) => n !== idx));

  const handleConfirm = async () => {
    if (installments.length === 0) { toast.error("Adicione ao menos uma parcela."); return; }
    if (mismatch) {
      const ok = confirm(`A soma das parcelas (${formatBRL(sumInstallments)}) é diferente do total do pedido (${formatBRL(totalValue)}). Deseja continuar mesmo assim?`);
      if (!ok) return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("create_receivable_from_order", {
        p_order_id: orderId,
        p_installments: installments as unknown as any,
      });
      if (error) throw error;
      toast.success(`Conta a receber gerada para ${orderNumber}.`);
      onCreated?.(data as string);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao gerar conta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Conta a Receber</DialogTitle>
          <DialogDescription>
            Pedido <strong>{orderNumber}</strong> · Total {formatBRL(totalValue)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block">Condição</Label>
              <Select value={term} onValueChange={(v) => regenerate(v, method)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_TERM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Forma de recebimento</Label>
              <Select value={method} onValueChange={(v) => regenerate(term, v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Parcelas</Label>
              <Button type="button" variant="outline" size="sm" onClick={addInst}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
              </Button>
            </div>
            <div className="space-y-2">
              {installments.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center rounded-md border border-border bg-muted/20 p-2">
                  <span className="col-span-1 text-xs font-mono text-muted-foreground text-center">{idx + 1}</span>
                  <Input
                    type="date" className="col-span-4"
                    value={it.due_date}
                    onChange={(e) => updateInst(idx, { due_date: e.target.value })}
                  />
                  <Input
                    type="number" step="0.01" min={0} className="col-span-4"
                    value={it.amount}
                    onChange={(e) => updateInst(idx, { amount: Number(e.target.value) || 0 })}
                  />
                  <Select
                    value={it.payment_method ?? method}
                    onValueChange={(v) => updateInst(idx, { payment_method: v })}
                  >
                    <SelectTrigger className="col-span-2 h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHOD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="col-span-1 h-9 w-9 text-destructive"
                    onClick={() => removeInst(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-2 text-right text-sm">
              Soma: <span className="font-semibold">{formatBRL(sumInstallments)}</span>
              {mismatch && (
                <span className="ml-2 text-destructive">
                  (diferença de {formatBRL(diff)})
                </span>
              )}
            </div>
          </div>

          {mismatch && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                A soma das parcelas não bate com o total do pedido. Você pode continuar
                assim mesmo (ex.: desconto), mas confirme o valor.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Gerar conta a receber
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
