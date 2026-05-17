import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";

export default function ConfiguracaoTab() {
  const { requireAdmin } = usePermissionGuard();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [valorMinimo, setValorMinimo] = useState<number>(35);
  const [sangriaAdesivo, setSangriaAdesivo] = useState<number>(3);
  const [sangriaLona, setSangriaLona] = useState<number>(0);
  const [sangriaChapa, setSangriaChapa] = useState<number>(0);
  const [sangriaOutro, setSangriaOutro] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("cv_calc_config").select("*").maybeSingle();
      if (error) handleError(error, "carregar configuração");
      else if (data) {
        setId(data.id);
        setValorMinimo(Number(data.valor_minimo) || 35);
        const d = data as unknown as Record<string, number | null>;
        setSangriaAdesivo(Number(d.sangria_adesivo_mm ?? 3));
        setSangriaLona(Number(d.sangria_lona_mm ?? 0));
        setSangriaChapa(Number(d.sangria_chapa_mm ?? 0));
        setSangriaOutro(Number(d.sangria_outro_mm ?? 0));
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!requireAdmin("editar configuração")) return;
    setSaving(true);
    const payload = {
      valor_minimo: valorMinimo,
      sangria_adesivo_mm: sangriaAdesivo,
      sangria_lona_mm: sangriaLona,
      sangria_chapa_mm: sangriaChapa,
      sangria_outro_mm: sangriaOutro,
    };
    if (id) {
      const { error } = await supabase.from("cv_calc_config").update(payload).eq("id", id);
      if (error) { handleError(error, "salvar"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("cv_calc_config").insert(payload).select().single();
      if (error) { handleError(error, "salvar"); setSaving(false); return; }
      setId(data.id);
    }
    toast.success("Configuração salva!");
    setSaving(false);
  };

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <Card className="max-w-xl">
      <CardContent className="pt-6 space-y-6">
        <div>
          <h3 className="font-semibold text-foreground">Configurações globais — Comunicação Visual</h3>
          <p className="text-sm text-muted-foreground">Aplica-se a todos os orçamentos e à calculadora.</p>
        </div>

        <div>
          <Label>Valor mínimo do item (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={valorMinimo}
            onChange={(e) => setValorMinimo(+e.target.value || 0)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Valor mínimo de venda para peças muito pequenas (ex.: adesivo 10×10 cm). Não aparece para o cliente — é apenas um piso de cálculo.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-foreground">Sangrias (mm)</h4>
            <p className="text-xs text-muted-foreground">
              Margem somada a cada dimensão da peça antes do cálculo de área. Replica o comportamento da planilha.
              Ex.: peça 6×6 cm com sangria 3 mm vira (6,3 × 6,3) cm na cobrança.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Adesivo</Label>
              <Input type="number" step="0.1" min={0} value={sangriaAdesivo}
                onChange={(e) => setSangriaAdesivo(+e.target.value || 0)} />
            </div>
            <div>
              <Label>Lona</Label>
              <Input type="number" step="0.1" min={0} value={sangriaLona}
                onChange={(e) => setSangriaLona(+e.target.value || 0)} />
            </div>
            <div>
              <Label>Chapa</Label>
              <Input type="number" step="0.1" min={0} value={sangriaChapa}
                onChange={(e) => setSangriaChapa(+e.target.value || 0)} />
            </div>
            <div>
              <Label>Outro</Label>
              <Input type="number" step="0.1" min={0} value={sangriaOutro}
                onChange={(e) => setSangriaOutro(+e.target.value || 0)} />
            </div>
          </div>
        </div>

        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
