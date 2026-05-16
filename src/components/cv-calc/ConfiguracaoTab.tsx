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

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("cv_calc_config").select("*").maybeSingle();
      if (error) handleError(error, "carregar configuração");
      else if (data) { setId(data.id); setValorMinimo(Number(data.valor_minimo) || 35); }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!requireAdmin("editar configuração")) return;
    setSaving(true);
    if (id) {
      const { error } = await supabase.from("cv_calc_config").update({ valor_minimo: valorMinimo }).eq("id", id);
      if (error) { handleError(error, "salvar"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("cv_calc_config").insert({ valor_minimo: valorMinimo }).select().single();
      if (error) { handleError(error, "salvar"); setSaving(false); return; }
      setId(data.id);
    }
    toast.success("Configuração salva!");
    setSaving(false);
  };

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <Card className="max-w-xl">
      <CardContent className="pt-6 space-y-4">
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
            Quando o cálculo final ficar abaixo deste valor, o sistema aplica este mínimo automaticamente.
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
