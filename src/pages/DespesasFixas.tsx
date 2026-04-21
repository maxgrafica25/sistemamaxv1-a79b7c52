import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, DollarSign, Users, Monitor, Calculator, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Expense { id?: string; name: string; value: number; }
interface Salary { id?: string; name: string; salary: number; is_production: boolean; }
interface Equipment { id?: string; name: string; purchase_value: number; useful_life_months: number; residual_value: number; }
interface Capacity { id?: string; production_employees: number; hours_per_month: number; }

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type TabKey = "despesas" | "salarios" | "depreciacao" | "capacidade";

const TAB_CONFIG: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "despesas", label: "Despesas Mensais", icon: <DollarSign className="h-3.5 w-3.5" /> },
  { key: "salarios", label: "Folha de Pagamento", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "depreciacao", label: "Depreciação", icon: <Monitor className="h-3.5 w-3.5" /> },
  { key: "capacidade", label: "Capacidade", icon: <Calculator className="h-3.5 w-3.5" /> },
];

export default function DespesasFixas() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [capacity, setCapacity] = useState<Capacity>({ production_employees: 0, hours_per_month: 147 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("despesas");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmItemName, setConfirmItemName] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [expRes, salRes, eqRes, capRes] = await Promise.all([
        supabase.from("monthly_expenses").select("id, name, value").order("created_at"),
        supabase.from("salaries").select("id, name, salary, is_production").order("created_at"),
        supabase.from("equipment_depreciation").select("id, name, purchase_value, residual_value, useful_life_months").order("created_at"),
        supabase.from("productive_capacity").select("id, hours_per_month, production_employees").limit(1).single(),
      ]);
      if (expRes.data) setExpenses(expRes.data);
      if (salRes.data) setSalaries(salRes.data);
      if (eqRes.data) setEquipment(eqRes.data);
      if (capRes.data) setCapacity(capRes.data);
      setLoading(false);
    };
    load();
  }, []);

  // Calculations
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.value, 0), [expenses]);
  const totalSalariesProduction = useMemo(() => salaries.filter(s => s.is_production).reduce((s, e) => s + e.salary, 0), [salaries]);
  const totalSalariesOther = useMemo(() => salaries.filter(s => !s.is_production).reduce((s, e) => s + e.salary, 0), [salaries]);
  const totalSalaries = totalSalariesProduction + totalSalariesOther;
  const PAYROLL_CHARGE_RATE = 1.45;
  const totalSalariesWithCharges = totalSalaries * PAYROLL_CHARGE_RATE;
  const productionEmployeeCount = useMemo(() => salaries.filter(s => s.is_production).length, [salaries]);
  const depreciationItems = useMemo(() => equipment.map(eq => ({
    ...eq, monthly: eq.useful_life_months > 0 ? (eq.purchase_value - eq.residual_value) / eq.useful_life_months : 0,
  })), [equipment]);
  const totalDepreciation = useMemo(() => depreciationItems.reduce((s, e) => s + e.monthly, 0), [depreciationItems]);
  const totalFixedCosts = totalExpenses + totalSalariesWithCharges + totalDepreciation;
  const totalHoursMonth = productionEmployeeCount * capacity.hours_per_month;
  const hourlyRate = totalHoursMonth > 0 ? totalFixedCosts / totalHoursMonth : 0;

  // CRUD
  const addExpense = () => setExpenses([...expenses, { name: "", value: 0 }]);
  const requestRemove = (name: string, fn: () => void) => {
    setConfirmItemName(name); setConfirmAction(() => fn); setConfirmOpen(true);
  };
  const removeExpense = (i: number) => setExpenses(expenses.filter((_, idx) => idx !== i));
  const updateExpense = (i: number, field: keyof Expense, val: string | number) =>
    setExpenses(expenses.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const addSalary = (isProduction: boolean) => setSalaries([...salaries, { name: "", salary: 0, is_production: isProduction }]);
  const removeSalary = (i: number) => setSalaries(salaries.filter((_, idx) => idx !== i));
  const updateSalary = (i: number, field: keyof Salary, val: string | number | boolean) =>
    setSalaries(salaries.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const addEquipment = () => setEquipment([...equipment, { name: "", purchase_value: 0, useful_life_months: 60, residual_value: 0 }]);
  const removeEquipment = (i: number) => setEquipment(equipment.filter((_, idx) => idx !== i));
  const updateEquipment = (i: number, field: keyof Equipment, val: string | number) =>
    setEquipment(equipment.map((e, idx) => idx === i ? { ...e, [field]: val } : e));

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from("monthly_expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("salaries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("equipment_depreciation").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      if (expenses.length > 0) {
        const { error } = await supabase.from("monthly_expenses").insert(expenses.map(e => ({ name: e.name, value: e.value })));
        if (error) throw error;
      }
      if (salaries.length > 0) {
        const { error } = await supabase.from("salaries").insert(salaries.map(s => ({ name: s.name, salary: s.salary, is_production: s.is_production })));
        if (error) throw error;
      }
      if (equipment.length > 0) {
        const { error } = await supabase.from("equipment_depreciation").insert(equipment.map(eq => ({
          name: eq.name, purchase_value: eq.purchase_value, useful_life_months: eq.useful_life_months, residual_value: eq.residual_value,
        })));
        if (error) throw error;
      }
      if (capacity.id) {
        await supabase.from("productive_capacity").update({
          production_employees: productionEmployeeCount, hours_per_month: capacity.hours_per_month,
        }).eq("id", capacity.id);
      }
      toast.success("Despesas fixas salvas! Valor hora: " + formatCurrency(hourlyRate));
    } catch (err) {
      toast.error("Erro ao salvar: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <>
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-primary" />
              Despesas Fixas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Lance despesas para calcular o valor da hora</p>
          </div>
        </div>

        {/* Summary line */}
        <div className="flex items-center gap-6 text-sm flex-wrap">
          <span className="text-muted-foreground">Despesas: <strong className="text-foreground">{formatCurrency(totalExpenses)}</strong></span>
          <span className="text-muted-foreground">Folha c/ encargos: <strong className="text-foreground">{formatCurrency(totalSalariesWithCharges)}</strong></span>
          <span className="text-muted-foreground">Depreciação: <strong className="text-foreground">{formatCurrency(totalDepreciation)}</strong></span>
          <span className="text-muted-foreground">Total: <strong className="text-primary">{formatCurrency(totalFixedCosts)}</strong></span>
          <HoverCard>
            <HoverCardTrigger asChild>
              <span className="ml-auto rounded-md bg-accent/10 border border-accent px-3 py-1 font-semibold text-accent cursor-help flex items-center gap-1.5">
                Valor Hora: {formatCurrency(hourlyRate)} <Info className="h-3.5 w-3.5 opacity-60" />
              </span>
            </HoverCardTrigger>
            <HoverCardContent className="w-80 text-sm" side="bottom" align="end">
              <p className="font-semibold mb-2 text-foreground">Como chegamos ao Valor Hora:</p>
              <div className="space-y-1 text-muted-foreground">
                <div className="flex justify-between"><span>Despesas mensais</span><span className="font-medium text-foreground">{formatCurrency(totalExpenses)}</span></div>
                <div className="flex justify-between"><span>Folha c/ encargos (×1,45)</span><span className="font-medium text-foreground">{formatCurrency(totalSalariesWithCharges)}</span></div>
                <div className="flex justify-between"><span>Depreciação</span><span className="font-medium text-foreground">{formatCurrency(totalDepreciation)}</span></div>
                <Separator className="my-1.5" />
                <div className="flex justify-between font-semibold text-foreground"><span>Total custos fixos</span><span>{formatCurrency(totalFixedCosts)}</span></div>
                <Separator className="my-1.5" />
                <div className="flex justify-between"><span>Func. produção</span><span className="font-medium text-foreground">{productionEmployeeCount}</span></div>
                <div className="flex justify-between"><span>Horas/mês por pessoa</span><span className="font-medium text-foreground">{capacity.hours_per_month}h</span></div>
                <div className="flex justify-between"><span>Total horas/mês</span><span className="font-medium text-foreground">{totalHoursMonth.toFixed(0)}h</span></div>
                <Separator className="my-1.5" />
                <div className="flex justify-between font-bold text-primary"><span>Valor Hora</span><span>{formatCurrency(totalFixedCosts)} ÷ {totalHoursMonth.toFixed(0)}h = {formatCurrency(hourlyRate)}</span></div>
              </div>
            </HoverCardContent>
          </HoverCard>
        </div>

        <div>
          <div className="flex gap-1 border-b border-border mb-4">
            {TAB_CONFIG.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-[3px] -mb-px ${
                  activeTab === tab.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${activeTab === tab.key ? "bg-primary" : "bg-muted-foreground/40"}`} />
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div>
            {activeTab === "despesas" && (
              <Card>
                <CardContent className="pt-4">
                  {expenses.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">Nenhuma despesa cadastrada.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60%]">Descrição</TableHead>
                          <TableHead>Valor (R$)</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.map((exp, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Input value={exp.name} onChange={e => updateExpense(i, "name", e.target.value)} placeholder="Ex: Aluguel, Internet..." />
                            </TableCell>
                            <TableCell>
                              <Input type="number" step="0.01" value={exp.value || ""} onChange={e => updateExpense(i, "value", parseFloat(e.target.value) || 0)} />
                            </TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => requestRemove(exp.name || "Despesa", () => removeExpense(i))} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-medium">
                          <TableCell>Total</TableCell>
                          <TableCell colSpan={2}>{formatCurrency(totalExpenses)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                  <div className="mt-3 flex justify-center">
                    <Button size="sm" variant="outline" onClick={addExpense} className="gap-1">
                      <Plus className="h-4 w-4" /> Adicionar Despesa
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "salarios" && (
              <Card>
                <CardContent className="pt-4">
                  {salaries.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">Nenhum salário cadastrado.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[45%]">Cargo / Nome</TableHead>
                          <TableHead>Salário (R$)</TableHead>
                          <TableHead>Produção?</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salaries.map((sal, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              <Input value={sal.name} onChange={e => updateSalary(i, "name", e.target.value)} placeholder="Ex: Funcionário 1..." />
                            </TableCell>
                            <TableCell>
                              <Input type="number" step="0.01" value={sal.salary || ""} onChange={e => updateSalary(i, "salary", parseFloat(e.target.value) || 0)} />
                            </TableCell>
                            <TableCell>
                              <Switch checked={sal.is_production} onCheckedChange={v => updateSalary(i, "is_production", v)} />
                            </TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => requestRemove(sal.name || "Salário", () => removeSalary(i))} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-medium">
                          <TableCell>Produção</TableCell>
                          <TableCell colSpan={3}>{formatCurrency(totalSalariesProduction)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50 font-medium">
                          <TableCell>Outros</TableCell>
                          <TableCell colSpan={3}>{formatCurrency(totalSalariesOther)}</TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/30 font-semibold">
                          <TableCell>Total c/ Encargos (45%)</TableCell>
                          <TableCell colSpan={3}>{formatCurrency(totalSalariesWithCharges)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                  <div className="mt-3 flex justify-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => addSalary(true)} className="gap-1"><Plus className="h-4 w-4" /> Produção</Button>
                    <Button size="sm" variant="outline" onClick={() => addSalary(false)} className="gap-1"><Plus className="h-4 w-4" /> Outros</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "depreciacao" && (
              <Card>
                <CardContent className="pt-4">
                  {equipment.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">Nenhum equipamento cadastrado.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Equipamento</TableHead>
                          <TableHead>Valor Compra (R$)</TableHead>
                          <TableHead>Vida Útil (meses)</TableHead>
                          <TableHead>Residual (R$)</TableHead>
                          <TableHead>Deprec./mês</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {depreciationItems.map((eq, i) => (
                          <TableRow key={i}>
                            <TableCell><Input value={eq.name} onChange={e => updateEquipment(i, "name", e.target.value)} placeholder="Ex: Plotter..." /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={eq.purchase_value || ""} onChange={e => updateEquipment(i, "purchase_value", parseFloat(e.target.value) || 0)} /></TableCell>
                            <TableCell><Input type="number" value={eq.useful_life_months || ""} onChange={e => updateEquipment(i, "useful_life_months", parseInt(e.target.value) || 0)} /></TableCell>
                            <TableCell><Input type="number" step="0.01" value={eq.residual_value || ""} onChange={e => updateEquipment(i, "residual_value", parseFloat(e.target.value) || 0)} /></TableCell>
                            <TableCell className="font-medium text-sm">{formatCurrency(eq.monthly)}</TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => requestRemove(eq.name || "Equipamento", () => removeEquipment(i))} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 font-medium">
                          <TableCell colSpan={4}>Total Depreciação Mensal</TableCell>
                          <TableCell colSpan={2}>{formatCurrency(totalDepreciation)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                  <div className="mt-3 flex justify-center">
                    <Button size="sm" variant="outline" onClick={addEquipment} className="gap-1"><Plus className="h-4 w-4" /> Adicionar Equipamento</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "capacidade" && (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid gap-6 md:grid-cols-2 max-w-xl">
                    <div className="space-y-2">
                      <Label>Funcionários de Produção</Label>
                      <Input type="number" value={productionEmployeeCount} disabled className="bg-muted font-semibold" />
                      <p className="text-xs text-muted-foreground">Contagem automática da Folha</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Horas / Mês por Pessoa</Label>
                      <Input type="number" step="1" value={capacity.hours_per_month || ""} onChange={e => setCapacity({ ...capacity, hours_per_month: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm max-w-xl">
                    <span className="text-muted-foreground">Total:</span>{" "}
                    <span className="font-semibold">{productionEmployeeCount} func. × {capacity.hours_per_month}h = </span>
                    <span className="font-bold text-primary">{totalHoursMonth.toFixed(0)} horas/mês</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Floating save button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button size="lg" onClick={handleSave} disabled={saving} className="gap-2 shadow-lg rounded-full px-6">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          Salvar Tudo
        </Button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        description={`Deseja realmente excluir "${confirmItemName}"? Esta ação não pode ser desfeita.`}
        onConfirm={() => { confirmAction(); setConfirmOpen(false); }}
      />
    </>
  );
}
