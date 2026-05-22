// Mini-form rápido pós-impressão: equipamento + carga de cor + observação.
// Aparece quando um pedido vinculado a um recorrente é marcado como "entregue".
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { handleError } from "@/lib/handleError";
import { Loader2, Printer } from "lucide-react";

interface Equipment {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recurringId: string;
  recurringNome?: string;
  salesOrderId?: string | null;
  quoteId?: string | null;
  onSaved?: () => void;
}

const CARGA_SUGS = ["Padrão", "Reduzida", "Aumentada", "Personalizada"];

export function PostPrintDialog({
  open, onOpenChange, recurringId, recurringNome, salesOrderId, quoteId, onSaved,
}: Props) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState<string>("none");
  const [carga, setCarga] = useState("Padrão");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCarga("Padrão");
    setObs("");
    setEquipmentId("none");
    supabase
      .from("equipments" as never)
      .select("id,nome")
      .order("sort_order")
      .then(({ data }) => setEquipments(((data as unknown) as Equipment[]) ?? []));
  }, [open]);

  const handleSave = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("mark_recurring_printed" as never, {
      p_recurring_id: recurringId,
      p_equipment_id: equipmentId === "none" ? null : equipmentId,
      p_carga_cor: carga,
      p_observacoes: obs,
      p_sales_order_id: salesOrderId ?? null,
      p_quote_id: quoteId ?? null,
    } as never);
    setBusy(false);
    if (error) return handleError(error, "registrar impressão");
    toast.success("Impressão registrada no histórico");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4 text-primary" />
            Registrar impressão
          </DialogTitle>
          {recurringNome && (
            <p className="text-xs text-muted-foreground">{recurringNome}</p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Equipamento usado</Label>
            <Select value={equipmentId} onValueChange={setEquipmentId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não informado</SelectItem>
                {equipments.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Carga de cor</Label>
            <Input
              list="carga-sugestoes"
              value={carga}
              onChange={(e) => setCarga(e.target.value)}
              placeholder="Ex: Padrão, Reduzida 10%..."
            />
            <datalist id="carga-sugestoes">
              {CARGA_SUGS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div>
            <Label className="text-xs">Observação (opcional)</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Anote ajustes técnicos, sobras, perfis usados..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Pular
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar histórico
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
