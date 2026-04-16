import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Save, Info, Loader2, Cog } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export default function Configuracoes() {
  const [hourlyRate, setHourlyRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [invoicePercentage, setInvoicePercentage] = useState("10");
  const [wastePercentage, setWastePercentage] = useState("5");
  const [collectionCostPercentage, setCollectionCostPercentage] = useState("7");
  const [defaultProfitMargin, setDefaultProfitMargin] = useState("33");
  // Composição detalhada do C. Variável (apenas referência interna)
  const [taxPct, setTaxPct] = useState("10");
  const [collectionFeePct, setCollectionFeePct] = useState("5");
  const [creditCardPct, setCreditCardPct] = useState("5");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [expRes, salRes, eqRes, capRes, settingsRes] = await Promise.all([
        supabase.from("monthly_expenses").select("value"),
        supabase.from("salaries").select("salary, is_production"),
        supabase.from("equipment_depreciation").select("purchase_value, useful_life_months, residual_value"),
        supabase.from("productive_capacity").select("*").limit(1).single(),
        supabase.from("global_settings").select("*").limit(1).single(),
      ]);
      const totalExp = (expRes.data || []).reduce((s: number, e: any) => s + e.value, 0);
      const totalSal = (salRes.data || []).reduce((s: number, e: any) => s + e.salary, 0) * 1.45;
      const totalDep = (eqRes.data || []).reduce((s: number, e: any) => s + (e.useful_life_months > 0 ? (e.purchase_value - e.residual_value) / e.useful_life_months : 0), 0);
      const cap = capRes.data;
      const prodCount = (salRes.data || []).filter((s: any) => s.is_production).length;
      const hours = cap ? prodCount * cap.hours_per_month : 0;
      setHourlyRate(hours > 0 ? (totalExp + totalSal + totalDep) / hours : 0);

      if (settingsRes.data) {
        setSettingsId(settingsRes.data.id);
        setInvoicePercentage(String(settingsRes.data.invoice_pct));
        setCollectionCostPercentage(String(settingsRes.data.collection_pct));
        setWastePercentage(String(settingsRes.data.waste_pct));
        setDefaultProfitMargin(String(settingsRes.data.default_margin_pct));
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const data = {
      invoice_pct: parseFloat(invoicePercentage) || 0,
      collection_pct: parseFloat(collectionCostPercentage) || 0,
      waste_pct: parseFloat(wastePercentage) || 0,
      default_margin_pct: parseFloat(defaultProfitMargin) || 0,
    };
    if (settingsId) {
      await supabase.from("global_settings").update(data).eq("id", settingsId);
    } else {
      const { data: newRow } = await supabase.from("global_settings").insert(data).select("id").single();
      if (newRow) setSettingsId(newRow.id);
    }
    setSaving(false);
    toast.success("Configurações salvas com sucesso!");
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const totalIndiretos = (parseFloat(invoicePercentage) || 0) + (parseFloat(collectionCostPercentage) || 0) + (parseFloat(wastePercentage) || 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Cog className="h-6 w-6 text-primary" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure os valores padrão de C. Fixo, C. Variável e Margem — estes valores são sugeridos ao criar novas faixas de preço</p>
      </div>

      <div className="max-w-3xl space-y-6">
        <Card className="shadow-card">
          <CardHeader><CardTitle>Custos Operacionais</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Valor da Hora de Trabalho (R$)</Label>
              <div className="flex items-center gap-3">
                <Input type="text" value={hourlyRate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} disabled className="bg-muted font-semibold" />
                <Link to="/despesas-fixas"><Button variant="outline" size="sm" className="gap-1 whitespace-nowrap"><Info className="h-4 w-4" /> Editar Despesas</Button></Link>
              </div>
              <p className="text-sm text-muted-foreground">Calculado automaticamente a partir do módulo de Despesas Fixas</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle>Custos Padrão para Novas Faixas</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">Estes valores são sugeridos ao criar novas faixas de preço. Cada faixa pode ter seus próprios valores.</p>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>C. Fixo Padrão (%)</Label>
                <Input type="number" step="0.01" value={invoicePercentage} onChange={(e) => setInvoicePercentage(e.target.value)} />
                <p className="text-sm text-muted-foreground">Custos fixos (depreciação, aluguel, etc.) como % do preço</p>
              </div>
              <div className="space-y-2">
                <Label>C. Variável Padrão (%)</Label>
                <Input type="number" step="0.01" value={collectionCostPercentage} onChange={(e) => setCollectionCostPercentage(e.target.value)} />
                <p className="text-sm text-muted-foreground">Custos variáveis (NF, cobrança, perda) como % do preço</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle>Perda e Margem Padrão</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Percentual de Perda Padrão (%)</Label>
                <Input type="number" step="0.01" value={wastePercentage} onChange={(e) => setWastePercentage(e.target.value)} />
                <p className="text-sm text-muted-foreground">Margem de perda de material — sugerido ao criar novas faixas</p>
              </div>
              <div className="space-y-2">
                <Label>Margem de Lucro Padrão (%)</Label>
                <Input type="number" step="0.01" value={defaultProfitMargin} onChange={(e) => setDefaultProfitMargin(e.target.value)} />
                <p className="text-sm text-muted-foreground">Margem padrão sugerida ao criar novas faixas de preço</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-muted/30">
          <CardHeader><CardTitle className="text-base">Resumo dos Valores Padrão</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">C. Fixo Padrão:</span><span className="font-medium">+{invoicePercentage}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">C. Variável Padrão:</span><span className="font-medium">+{collectionCostPercentage}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Perda Padrão:</span><span className="font-medium">+{wastePercentage}%</span></div>
              <Separator className="my-3" />
              <div className="flex justify-between"><span className="text-muted-foreground">Total Custos Indiretos Padrão:</span><span className="font-semibold text-primary">+{totalIndiretos.toFixed(2)}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Margem de Lucro Padrão:</span><span className="font-semibold text-green-600">+{defaultProfitMargin}%</span></div>
              <Separator className="my-3" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Soma total padrão</span>
                <span className="font-semibold">{(totalIndiretos + (parseFloat(defaultProfitMargin) || 0)).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Divisor padrão (1 − soma%)</span>
                <span className="font-semibold">{(1 - (totalIndiretos + (parseFloat(defaultProfitMargin) || 0)) / 100).toFixed(4)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" onClick={handleSave} disabled={saving} className="gap-2 bg-accent hover:bg-accent-hover">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            Salvar Configurações
          </Button>
        </div>
      </div>
    </div>
  );
}
