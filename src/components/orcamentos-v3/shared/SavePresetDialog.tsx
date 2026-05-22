// Diálogo compacto para salvar a configuração atual do orçamento como preset.
// Recebe um payload parcial já montado pelo formulário pai (Impressão ou CV)
// e cuida apenas do nome/ícone + insert + toast.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Loader2, Star } from "lucide-react";
import { handleError } from "@/lib/handleError";
import { PRESET_ICONS, PRESET_ICON_NAMES } from "./presetIcons";

export type SavePresetPayload = {
  modulo: "cv" | "impressao";
  form_tipo?: "print" | "booklet" | "label" | null;
  largura_cm?: number | null;
  altura_cm?: number | null;
  is_banner?: boolean;
  midia_tipo?: "lona" | "adesivo" | "chapa" | null;
  midia_nome_match?: string | null;
  papel_inclui?: string[];
  papel_exclui?: string[];
  acabamentos_sugeridos?: string[];
  /** Quantidade atualmente digitada no item — opcional. Usuário decide se salva. */
  quantidade_atual?: number | null;
  /** Resumo legível para mostrar no diálogo (o que o preset vai filtrar/sugerir). */
  resumo: { label: string; value: string }[];
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payload: SavePresetPayload;
  onSaved?: () => void;
}

export function SavePresetDialog({ open, onOpenChange, payload, onSaved }: Props) {
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("Star");
  const [incluirQtd, setIncluirQtd] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    const n = nome.trim();
    if (!n) {
      toast.error("Dê um nome para o preset");
      return;
    }
    setBusy(true);
    const insert = {
      nome: n,
      icone: PRESET_ICONS[icone] ? icone : "Wand2",
      modulo: payload.modulo,
      form_tipo: payload.form_tipo ?? (payload.modulo === "cv" ? null : "print"),
      ordem: 100,
      ativo: true,
      largura_cm: payload.largura_cm ?? null,
      altura_cm: payload.altura_cm ?? null,
      quantidade_padrao: incluirQtd ? payload.quantidade_atual ?? null : null,
      is_banner: !!payload.is_banner,
      midia_tipo: payload.midia_tipo ?? null,
      midia_nome_match: payload.midia_nome_match ?? null,
      papel_inclui: payload.papel_inclui ?? [],
      papel_exclui: payload.papel_exclui ?? [],
      acabamentos_sugeridos: payload.acabamentos_sugeridos ?? [],
    };
    const { error } = await supabase
      .from("quote_presets" as never)
      .insert(insert as never);
    setBusy(false);
    if (error) {
      handleError(error, "salvar preset");
      return;
    }
    toast.success(`Preset "${n}" salvo`);
    setNome("");
    setIcone("Star");
    setIncluirQtd(false);
    onOpenChange(false);
    onSaved?.();
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setNome("");
      setIcone("Star");
      setIncluirQtd(false);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            Salvar como preset
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_140px] gap-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Folder couchê 90g"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Ícone</Label>
              <Select value={icone} onValueChange={setIcone}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRESET_ICON_NAMES.map((n) => {
                    const I = PRESET_ICONS[n];
                    return (
                      <SelectItem key={n} value={n}>
                        <span className="inline-flex items-center gap-2">
                          <I className="h-4 w-4" /> {n}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {payload.resumo.length > 0 && (
            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                O preset vai aplicar
              </p>
              {payload.resumo.map((r) => (
                <p key={r.label} className="text-xs">
                  <span className="text-muted-foreground">{r.label}:</span>{" "}
                  <span className="font-medium">{r.value}</span>
                </p>
              ))}
            </div>
          )}

          {payload.quantidade_atual != null && payload.quantidade_atual > 0 && (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={incluirQtd}
                onCheckedChange={(v) => setIncluirQtd(v === true)}
              />
              <span>
                Usar <strong>{payload.quantidade_atual}</strong> como quantidade
                padrão deste preset
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar preset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
