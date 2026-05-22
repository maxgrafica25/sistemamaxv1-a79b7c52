// Dialog para criar ou editar um produto recorrente de um cliente.
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
import { Loader2, Repeat } from "lucide-react";
import type { ClientRecurringProduct } from "@/hooks/useClientRecurring";

interface PresetOption {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  editing?: ClientRecurringProduct | null;
  onSaved?: () => void;
}

export function RecorrenteFormDialog({ open, onOpenChange, clientId, editing, onSaved }: Props) {
  const [nome, setNome] = useState("");
  const [presetId, setPresetId] = useState<string>("none");
  const [drive, setDrive] = useState("");
  const [freq, setFreq] = useState(30);
  const [aviso, setAviso] = useState(3);
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [presets, setPresets] = useState<PresetOption[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("quote_presets" as never)
      .select("id,nome")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setPresets(((data as unknown) as PresetOption[]) ?? []));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNome(editing.nome);
      setPresetId(editing.quote_preset_id ?? "none");
      setDrive(editing.drive_folder_url ?? "");
      setFreq(editing.frequencia_dias);
      setAviso(editing.aviso_antecedencia_dias);
      setObs(editing.observacoes ?? "");
    } else {
      setNome("");
      setPresetId("none");
      setDrive("");
      setFreq(30);
      setAviso(3);
      setObs("");
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Dê um nome para o produto recorrente");
      return;
    }
    if (freq <= 0) {
      toast.error("Frequência deve ser maior que zero");
      return;
    }
    setBusy(true);
    const payload = {
      client_id: clientId,
      nome: nome.trim(),
      quote_preset_id: presetId === "none" ? null : presetId,
      drive_folder_url: drive.trim() || null,
      frequencia_dias: freq,
      aviso_antecedencia_dias: aviso,
      observacoes: obs.trim() || null,
    };
    const { error } = editing
      ? await supabase
          .from("client_recurring_products" as never)
          .update(payload as never)
          .eq("id", editing.id)
      : await supabase
          .from("client_recurring_products" as never)
          .insert(payload as never);
    setBusy(false);
    if (error) return handleError(error, "salvar recorrente");
    toast.success(editing ? "Recorrente atualizado" : "Recorrente cadastrado");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            {editing ? "Editar produto recorrente" : "Novo produto recorrente"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Nome do produto *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Etiqueta 5x3 fosca"
              autoFocus
            />
          </div>

          <div>
            <Label className="text-xs">Preset de orçamento (opcional)</Label>
            <Select value={presetId} onValueChange={setPresetId}>
              <SelectTrigger><SelectValue placeholder="Sem preset" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem preset</SelectItem>
                {presets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Vincular um preset preenche papel, acabamentos e quantidade ao reimprimir.
            </p>
          </div>

          <div>
            <Label className="text-xs">Pasta Google Drive (URL)</Label>
            <Input
              value={drive}
              onChange={(e) => setDrive(e.target.value)}
              placeholder="https://drive.google.com/drive/folders/..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Frequência (dias) *</Label>
              <Input
                type="number"
                min={1}
                value={freq}
                onChange={(e) => setFreq(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Avisar com (dias)</Label>
              <Input
                type="number"
                min={0}
                value={aviso}
                onChange={(e) => setAviso(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: cliente sempre paga em 30 dias, prefere entrega quinta-feira..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {editing ? "Atualizar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
