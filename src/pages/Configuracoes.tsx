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
  // Composição detalhada do C. Variável (Imposto + Taxa de Cobrança + Perda)
  const [taxPct, setTaxPct] = useState("10");
  const [collectionFeePct, setCollectionFeePct] = useState("5");

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
        if ((settingsRes.data as any).tax_pct !== undefined) setTaxPct(String((settingsRes.data as any).tax_pct));
        if ((settingsRes.data as any).collection_fee_pct !== undefined) setCollectionFeePct(String((settingsRes.data as any).collection_fee_pct));
      }
      setLoading(false);
    };
    load();
  }, []);

  const composedVariable = (parseFloat(taxPct) || 0) + (parseFloat(collectionFeePct) || 0) + (parseFloat(wastePercentage) || 0);

  const handleSave = async () => {
    setSaving(true);
    const data: any = {
      invoice_pct: parseFloat(invoicePercentage) || 0,
      collection_pct: composedVariable, // C. Variável Padrão = soma (Imposto + Cobrança + Perda)
      waste_pct: parseFloat(wastePercentage) || 0,
      default_margin_pct: parseFloat(defaultProfitMargin) || 0,
      tax_pct: parseFloat(taxPct) || 0,
      collection_fee_pct: parseFloat(collectionFeePct) || 0,
    };
    if (settingsId) {
      await supabase.from("global_settings").update(data).eq("id", settingsId);
    } else {
      const { data: newRow } = await supabase.from("global_settings").insert(data).select("id").single();
      if (newRow) setSettingsId(newRow.id);
    }
    setCollectionCostPercentage(String(composedVariable));
    setSaving(false);
    toast.success("Configurações salvas com sucesso!");
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // C. Variável já inclui a Perda — não somar de novo para evitar duplicidade
  const totalIndiretos = (parseFloat(invoicePercentage) || 0) + composedVariable;

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
          <CardHeader>
            <CardTitle>Composição do Preço de Venda</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Alíquotas padrão sugeridas ao criar novas faixas de preço. Cada faixa pode sobrescrever estes valores.</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Custos Indiretos */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Custos Indiretos</h3>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">C. Fixo (%)</Label>
                  <Input type="number" step="0.01" value={invoicePercentage} onChange={(e) => setInvoicePercentage(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Depreciação, aluguel</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Imposto (%)</Label>
                  <Input type="number" step="0.01" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Sobre nota fiscal</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Taxa de Cobrança (%)</Label>
                  <Input type="number" step="0.01" value={collectionFeePct} onChange={(e) => setCollectionFeePct(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Boleto, PIX, cartão</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Perda (%)</Label>
                  <Input type="number" step="0.01" value={wastePercentage} onChange={(e) => setWastePercentage(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Perda de material</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Margem */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Margem</h3>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Margem de Lucro (%)</Label>
                  <Input type="number" step="0.01" value={defaultProfitMargin} onChange={(e) => setDefaultProfitMargin(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Lucro líquido desejado</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Resumo compacto */}
            <div className="rounded-md bg-muted/40 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">C. Variável (Imposto + Cobrança + Perda):</span><span className="font-medium">{composedVariable.toFixed(2)}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Custos Indiretos (C. Fixo + C. Variável):</span><span className="font-medium">{totalIndiretos.toFixed(2)}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Margem de Lucro:</span><span className="font-medium text-green-600">+{(parseFloat(defaultProfitMargin) || 0).toFixed(2)}%</span></div>
              <Separator className="my-1" />
              <div className="flex justify-between"><span className="text-muted-foreground">Soma total:</span><span className="font-semibold">{(totalIndiretos + (parseFloat(defaultProfitMargin) || 0)).toFixed(2)}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Divisor (1 − soma%):</span><span className="font-semibold text-primary">{(1 - (totalIndiretos + (parseFloat(defaultProfitMargin) || 0)) / 100).toFixed(4)}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-muted/30">
          <CardHeader><CardTitle className="text-base">Resumo dos Valores Padrão</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">C. Fixo Padrão:</span><span className="font-medium">+{invoicePercentage}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">C. Variável Padrão (Imposto + Cobrança + Perda):</span><span className="font-medium">+{composedVariable.toFixed(2)}%</span></div>
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
