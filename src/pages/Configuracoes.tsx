import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Save, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

export default function Configuracoes() {
  const [hourlyRate, setHourlyRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [invoicePercentage, setInvoicePercentage] = useState("10");
  const [wastePercentage, setWastePercentage] = useState("5");
  const [collectionCostPercentage, setCollectionCostPercentage] = useState("7");
  const [defaultProfitMargin, setDefaultProfitMargin] = useState("33");

  useEffect(() => {
    const loadHourlyRate = async () => {
      setLoading(true);
      const [expRes, salRes, eqRes, capRes] = await Promise.all([
        supabase.from("monthly_expenses").select("value"),
        supabase.from("salaries").select("salary, is_production"),
        supabase.from("equipment_depreciation").select("purchase_value, useful_life_months, residual_value"),
        supabase.from("productive_capacity").select("*").limit(1).single(),
      ]);
      const totalExp = (expRes.data || []).reduce((s: number, e: any) => s + e.value, 0);
      const totalSal = (salRes.data || []).reduce((s: number, e: any) => s + e.salary, 0) * 1.45;
      const totalDep = (eqRes.data || []).reduce((s: number, e: any) => s + (e.useful_life_months > 0 ? (e.purchase_value - e.residual_value) / e.useful_life_months : 0), 0);
      const cap = capRes.data;
      const prodCount = (salRes.data || []).filter((s: any) => s.is_production).length;
      const hours = cap ? prodCount * cap.hours_per_month : 0;
      setHourlyRate(hours > 0 ? (totalExp + totalSal + totalDep) / hours : 0);
      setLoading(false);
    };
    loadHourlyRate();
  }, []);

  const handleSave = () => {
    toast.success("Configurações salvas com sucesso!");
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure os parâmetros de cálculo dos orçamentos</p>
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
          <CardHeader><CardTitle>Impostos e Taxas</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Percentual da Nota Fiscal (%)</Label>
                <Input type="number" step="0.01" value={invoicePercentage} onChange={(e) => setInvoicePercentage(e.target.value)} />
                <p className="text-sm text-muted-foreground">Impostos sobre a emissão da NF</p>
              </div>
              <div className="space-y-2">
                <Label>Custo de Cobrança (%)</Label>
                <Input type="number" step="0.01" value={collectionCostPercentage} onChange={(e) => setCollectionCostPercentage(e.target.value)} />
                <p className="text-sm text-muted-foreground">Taxas de recebimento e cobrança</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader><CardTitle>Perdas e Margens</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Percentual de Perda (%)</Label>
                <Input type="number" step="0.01" value={wastePercentage} onChange={(e) => setWastePercentage(e.target.value)} />
                <p className="text-sm text-muted-foreground">Margem de perda de material</p>
              </div>
              <div className="space-y-2">
                <Label>Margem de Lucro Padrão (%)</Label>
                <Input type="number" step="0.01" value={defaultProfitMargin} onChange={(e) => setDefaultProfitMargin(e.target.value)} />
                <p className="text-sm text-muted-foreground">Margem aplicada por padrão nos orçamentos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-muted/30">
          <CardHeader><CardTitle className="text-base">Resumo do Impacto nos Cálculos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Percentual da NF:</span><span className="font-medium">+{invoicePercentage}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Custo de Cobrança:</span><span className="font-medium">+{collectionCostPercentage}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Perda de Material:</span><span className="font-medium">+{wastePercentage}%</span></div>
              <Separator className="my-3" />
              <div className="flex justify-between"><span className="text-muted-foreground">Total de Custos Indiretos:</span><span className="font-semibold text-primary">+{(parseFloat(invoicePercentage) + parseFloat(collectionCostPercentage) + parseFloat(wastePercentage)).toFixed(2)}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Margem de Lucro:</span><span className="font-semibold text-green-600">+{defaultProfitMargin}%</span></div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button size="lg" onClick={handleSave} className="gap-2 bg-accent hover:bg-accent-hover"><Save className="h-5 w-5" /> Salvar Configurações</Button>
        </div>
      </div>
    </div>
  );
}
