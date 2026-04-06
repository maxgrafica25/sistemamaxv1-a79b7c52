import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileDown, Copy, X, Package, Wrench, ChevronLeft, ChevronRight, Check, User, Clock, FileText, Layers, ChevronDown, ChevronUp, ShieldAlert, Printer, PenLine } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MaterialCatalogSearch from "./MaterialCatalogSearch";
import PrintingItemSearch, { type PrintingCatalogItem } from "./PrintingItemSearch";
import { supabase } from "@/integrations/supabase/client";
import type { Quote } from "@/pages/Orcamentos";

interface NewQuoteFormProps {
  onSave: () => void;
  onCancel: () => void;
  nextId: string;
  editingQuote?: Quote | null;
  initialStep?: number;
}

interface LaborStep {
  id: string;
  description: string;
  timeMinutes: number;
}

interface MaterialItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

interface ThirdPartyService {
  id: string;
  description: string;
  supplier: string;
  cost: number;
}

interface StepGroup {
  id: string;
  name: string;
  steps: LaborStep[];
}

interface Material {
  id: string;
  name: string;
  unit: string;
  lastPrice: number;
}

interface AvailableStep {
  id: string;
  description: string;
  timeMinutes: number;
}

const STEPS = [
  { id: 0, label: "Informações", icon: User },
  { id: 1, label: "Mão de Obra", icon: Clock },
  { id: 2, label: "Materiais", icon: Package },
  { id: 3, label: "Terceirizados", icon: Wrench },
  { id: 4, label: "Finalizar", icon: FileText },
];

export default function NewQuoteForm({ onSave, onCancel, nextId, editingQuote, initialStep }: NewQuoteFormProps) {
  const { profile } = useAuth();
  const isEditing = !!editingQuote;
  const [currentStep, setCurrentStep] = useState(initialStep ?? 0);
  const [quoteNumber] = useState(editingQuote?.quote_number || nextId);
  const [client, setClient] = useState(editingQuote?.client || "");
  const [product, setProduct] = useState(editingQuote?.product || "");
  const [validity, setValidity] = useState(editingQuote?.validity || "7");

  const [hourlyRate, setHourlyRate] = useState(80);
  
  // Exemption toggles (only visible to authorized users)
  const AUTHORIZED_NAMES = ["Marcelle", "Juliano"];
  const canToggleExemptions = AUTHORIZED_NAMES.some(
    name => profile?.display_name?.toLowerCase().includes(name.toLowerCase())
  );
  const [includeInvoice, setIncludeInvoice] = useState(true);
  const [includeWaste, setIncludeWaste] = useState(true);
  const [includeCollection, setIncludeCollection] = useState(true);
  
  const invoicePercentage = includeInvoice ? 10 : 0;
  const wastePercentage = includeWaste ? 5 : 0;
  const collectionCostPercentage = includeCollection ? 7 : 0;
  const hasExemptions = !includeInvoice || !includeWaste || !includeCollection;

  const [profitMargin, setProfitMargin] = useState(editingQuote?.profitMargin || "33");

  const [laborSteps, setLaborSteps] = useState<LaborStep[]>(editingQuote?.laborSteps || []);
  const [materials, setMaterials] = useState<MaterialItem[]>(editingQuote?.materials || []);
  const [thirdParty, setThirdParty] = useState<ThirdPartyService[]>(editingQuote?.thirdParty || []);
  const [isSaved, setIsSaved] = useState(false);

  // Load from DB
  const [availableSteps, setAvailableSteps] = useState<AvailableStep[]>([]);
  const [availableGroups, setAvailableGroups] = useState<StepGroup[]>([]);
  const [availableMaterials, setAvailableMaterials] = useState<Material[]>([]);
  const [printingCatalog, setPrintingCatalog] = useState<PrintingCatalogItem[]>([]);

  const isLargerThanA4 = (size: string) => /^(A3|SRA3|A2|A1|A0)/i.test(size);
  const roundUp10 = (v: number) => Math.ceil(v * 10) / 10;

  const loadCatalogData = useCallback(async () => {
    const [stepsRes, groupsRes, groupItemsRes, suppliesRes, printItemsRes, categoriesRes, eqRes, consRes] = await Promise.all([
      supabase.from("production_steps").select("*").order("created_at"),
      supabase.from("step_groups").select("*").order("created_at"),
      supabase.from("step_group_items").select("*").order("sort_order"),
      supabase.from("supplies").select("*").order("created_at"),
      supabase.from("printing_price_items").select("*").eq("is_active", true).order("sort_order"),
      supabase.from("printer_categories").select("*").order("sort_order"),
      supabase.from("equipments").select("id, name, printer_type").order("sort_order"),
      supabase.from("equipment_consumables").select("equipment_id, price, yield_pages, mode"),
    ]);

    if (stepsRes.data) {
      setAvailableSteps(stepsRes.data.map(s => ({ id: s.id, description: s.description, timeMinutes: s.time_minutes })));
    }

    if (groupsRes.data && groupItemsRes.data) {
      setAvailableGroups(groupsRes.data.map(g => ({
        id: g.id,
        name: g.name,
        steps: groupItemsRes.data
          .filter(i => i.step_group_id === g.id)
          .map(i => ({ id: i.id, description: i.description, timeMinutes: i.time_minutes })),
      })));
    }

    // Suprimentos only (no papers)
    const mats: Material[] = [];
    if (suppliesRes.data) {
      suppliesRes.data.forEach(s => {
        mats.push({ id: `supply-${s.id}`, name: s.produto, unit: "un", lastPrice: s.valor_unitario });
      });
    }
    setAvailableMaterials(mats);

    // Build printing catalog
    const equipmentsList = eqRes.data || [];
    const consumablesList = consRes.data || [];
    const categoriesList = categoriesRes.data || [];

    const getEquipCostPerPage = (equipmentId: string, mode: string) => {
      const eq = equipmentsList.find(e => e.id === equipmentId);
      const isColorPrinter = eq?.printer_type === 'color';
      const usePB = mode === 'pb';
      const coverage = isColorPrinter ? 20 : 5;
      const cons = consumablesList.filter(c =>
        c.equipment_id === equipmentId && (usePB ? c.mode === "shared" : true)
      );
      const baseCost = cons.reduce((sum, c) => c.yield_pages <= 0 ? sum : sum + c.price / c.yield_pages, 0);
      return baseCost * (coverage / 5);
    };

    if (printItemsRes.data) {
      const catalog: PrintingCatalogItem[] = printItemsRes.data.map((item: any) => {
        const cat = categoriesList.find(c => c.id === item.printer_category_id);
        const eq = equipmentsList.find(e => e.id === item.equipment_id);
        const printingCost = item.equipment_id
          ? getEquipCostPerPage(item.equipment_id, item.equipment_mode || 'color')
          : item.printing_cost;
        const roundedPrintCost = roundUp10(printingCost);
        return {
          id: item.id,
          paper_type: item.paper_type,
          grammage: item.grammage,
          size: item.size,
          side: item.side,
          paper_cost: item.paper_cost,
          printing_cost: roundedPrintCost,
          equipment_name: eq?.name || null,
          equipment_mode: item.equipment_mode || 'color',
          category_name: cat?.name || '',
          totalCostA4: item.paper_cost + roundedPrintCost,
        };
      });
      setPrintingCatalog(catalog);
    }

    // Load hourly rate
    const [expRes, salRes, depRes, capRes] = await Promise.all([
      supabase.from("monthly_expenses").select("value"),
      supabase.from("salaries").select("salary, is_production"),
      supabase.from("equipment_depreciation").select("purchase_value, useful_life_months, residual_value"),
      supabase.from("productive_capacity").select("*").limit(1).single(),
    ]);
    const totalExp = (expRes.data || []).reduce((s: number, e: any) => s + e.value, 0);
    const totalSal = (salRes.data || []).reduce((s: number, e: any) => s + e.salary, 0) * 1.45;
    const totalDep = (depRes.data || []).reduce((s: number, e: any) => s + (e.useful_life_months > 0 ? (e.purchase_value - e.residual_value) / e.useful_life_months : 0), 0);
    const cap = capRes.data;
    const prodCount = (salRes.data || []).filter((s: any) => s.is_production).length;
    const hours = cap ? prodCount * cap.hours_per_month : 0;
    if (hours > 0) setHourlyRate((totalExp + totalSal + totalDep) / hours);
  }, []);

  useEffect(() => { loadCatalogData(); }, [loadCatalogData]);

  // Cálculos
  const laborTotal = laborSteps.reduce((sum, step) => sum + (step.timeMinutes / 60) * hourlyRate, 0);
  const materialsTotal = materials.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const thirdPartyTotal = thirdParty.reduce((sum, service) => sum + service.cost, 0);
  const totalDespesasProdutivas = laborTotal + materialsTotal + thirdPartyTotal;

  const profitMarginValue = parseFloat(profitMargin || "0");
  const totalPercent = (invoicePercentage + wastePercentage + collectionCostPercentage + profitMarginValue) / 100;
  const divisor = 1 - totalPercent;
  const valorACobrar = divisor > 0 ? totalDespesasProdutivas / divisor : 0;

  const impostosCost = valorACobrar * (invoicePercentage / 100);
  const perdasCost = valorACobrar * (wastePercentage / 100);
  const cobrancaCost = valorACobrar * (collectionCostPercentage / 100);
  const totalDespesasVenda = impostosCost + perdasCost + cobrancaCost;
  const lucroValue = valorACobrar * (profitMarginValue / 100);

  // Handlers
  const addStepFromCatalog = (stepId: string) => {
    const step = availableSteps.find(s => s.id === stepId);
    if (step) {
      setLaborSteps([...laborSteps, { id: `${Date.now()}-${step.id}`, description: step.description, timeMinutes: step.timeMinutes }]);
      toast.success(`${step.description} adicionada!`);
    }
  };

  const loadStepGroup = (groupId: string) => {
    const group = availableGroups.find(g => g.id === groupId);
    if (group) {
      const newSteps = group.steps.map(step => ({ ...step, id: `${Date.now()}-${step.id}` }));
      setLaborSteps([...laborSteps, ...newSteps]);
      toast.success(`Grupo "${group.name}" adicionado!`);
    }
  };

  const addLaborStep = () => setLaborSteps([...laborSteps, { id: Date.now().toString(), description: "", timeMinutes: 0 }]);
  const removeLaborStep = (id: string) => setLaborSteps(laborSteps.filter(step => step.id !== id));
  const updateLaborStep = (id: string, field: keyof LaborStep, value: string | number) =>
    setLaborSteps(laborSteps.map(step => step.id === id ? { ...step, [field]: value } : step));

  const addPrintingItem = (item: PrintingCatalogItem) => {
    const sizeMult = isLargerThanA4(item.size) ? 2 : 1;
    const sideMult = item.side === "F/V" ? 2 : 1;
    const printCost = roundUp10(item.printing_cost * sizeMult * sideMult);
    const costPerSheet = item.paper_cost + printCost;
    const label = `${item.paper_type}${item.grammage ? ` ${item.grammage}` : ""} ${item.size} ${item.side}${item.equipment_name ? ` — ${item.equipment_name}${item.equipment_mode === 'pb' ? ' (PB)' : ''}` : ''}`;
    setMaterials([...materials, { id: `print-${Date.now()}-${item.id}`, description: label, quantity: 1, unitPrice: costPerSheet }]);
    toast.success(`Impressão adicionada!`);
  };

  const addMaterialFromCatalog = (materialId: string) => {
    const material = availableMaterials.find(m => m.id === materialId);
    if (material) {
      setMaterials([...materials, { id: `supply-${Date.now()}-${material.id}`, description: material.name, quantity: 1, unitPrice: material.lastPrice }]);
      toast.success(`${material.name} adicionado!`);
    }
  };

  const addMaterial = () => setMaterials([...materials, { id: Date.now().toString(), description: "", quantity: 0, unitPrice: 0 }]);
  const removeMaterial = (id: string) => setMaterials(materials.filter(item => item.id !== id));
  const updateMaterial = (id: string, field: keyof MaterialItem, value: string | number) =>
    setMaterials(materials.map(item => item.id === id ? { ...item, [field]: value } : item));

  const addThirdParty = () => setThirdParty([...thirdParty, { id: Date.now().toString(), description: "", supplier: "", cost: 0 }]);
  const removeThirdParty = (id: string) => setThirdParty(thirdParty.filter(service => service.id !== id));

  const handleSaveQuote = async () => {
    if (!client.trim() || !product.trim()) {
      toast.error("Preencha o cliente e o produto antes de salvar");
      return;
    }

    try {
      if (isEditing && editingQuote) {
        // Update quote
        await supabase.from("quotes").update({
          client: client.trim(),
          product: product.trim(),
          value: valorACobrar,
          validity,
          profit_margin: profitMargin,
        }).eq("id", editingQuote.id);

        // Replace sub-items
        await supabase.from("quote_labor_steps").delete().eq("quote_id", editingQuote.id);
        await supabase.from("quote_materials").delete().eq("quote_id", editingQuote.id);
        await supabase.from("quote_third_party").delete().eq("quote_id", editingQuote.id);

        if (laborSteps.length > 0) {
          await supabase.from("quote_labor_steps").insert(
            laborSteps.map((s, i) => ({ quote_id: editingQuote.id, description: s.description, time_minutes: s.timeMinutes, sort_order: i }))
          );
        }
        if (materials.length > 0) {
          await supabase.from("quote_materials").insert(
            materials.map((m, i) => ({ quote_id: editingQuote.id, description: m.description, quantity: m.quantity, unit_price: m.unitPrice, sort_order: i }))
          );
        }
        if (thirdParty.length > 0) {
          await supabase.from("quote_third_party").insert(
            thirdParty.map((t, i) => ({ quote_id: editingQuote.id, description: t.description, supplier: t.supplier, cost: t.cost, sort_order: i }))
          );
        }
        toast.success("Orçamento atualizado!");
      } else {
        // Create new quote
        const { data: newQuote } = await supabase.from("quotes").insert({
          quote_number: quoteNumber,
          client: client.trim(),
          product: product.trim(),
          value: valorACobrar,
          status: "pending",
          date: new Date().toISOString().split("T")[0],
          validity,
          profit_margin: profitMargin,
        }).select("id").single();

        if (newQuote) {
          if (laborSteps.length > 0) {
            await supabase.from("quote_labor_steps").insert(
              laborSteps.map((s, i) => ({ quote_id: newQuote.id, description: s.description, time_minutes: s.timeMinutes, sort_order: i }))
            );
          }
          if (materials.length > 0) {
            await supabase.from("quote_materials").insert(
              materials.map((m, i) => ({ quote_id: newQuote.id, description: m.description, quantity: m.quantity, unit_price: m.unitPrice, sort_order: i }))
            );
          }
          if (thirdParty.length > 0) {
            await supabase.from("quote_third_party").insert(
              thirdParty.map((t, i) => ({ quote_id: newQuote.id, description: t.description, supplier: t.supplier, cost: t.cost, sort_order: i }))
            );
          }
        }
        toast.success("Orçamento salvo com sucesso!");
      }
      setIsSaved(true);
      onSave();
    } catch (err) {
      toast.error("Erro ao salvar: " + (err as Error).message);
    }
  };

  const handleGeneratePDF = () => {
    const pdfContent = `
      <html><head><title>Orçamento ${quoteNumber}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#333}h1{color:#1a1a1a;border-bottom:2px solid #e5e5e5;padding-bottom:10px}.info{margin:20px 0}.info p{margin:4px 0}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}.total{font-size:24px;font-weight:bold;text-align:right;margin-top:30px}</style></head>
      <body><h1>Orçamento Nº ${quoteNumber}</h1>
      <div class="info"><p><strong>Cliente:</strong> ${client}</p><p><strong>Produto/Serviço:</strong> ${product}</p><p><strong>Data:</strong> ${new Date().toLocaleDateString("pt-BR")}</p><p><strong>Validade:</strong> ${validity} dias</p></div>
      ${laborSteps.length > 0 ? `<h3>Mão de Obra</h3><table><tr><th>Etapa</th><th>Tempo</th><th>Valor</th></tr>${laborSteps.map(s => `<tr><td>${s.description}</td><td>${s.timeMinutes} min</td><td>R$ ${((s.timeMinutes / 60) * hourlyRate).toFixed(2)}</td></tr>`).join("")}</table>` : ""}
      ${materials.length > 0 ? `<h3>Materiais</h3><table><tr><th>Material</th><th>Qtd</th><th>Unitário</th><th>Total</th></tr>${materials.map(m => `<tr><td>${m.description}</td><td>${m.quantity}</td><td>R$ ${m.unitPrice.toFixed(2)}</td><td>R$ ${(m.quantity * m.unitPrice).toFixed(2)}</td></tr>`).join("")}</table>` : ""}
      <div class="total">VALOR TOTAL: R$ ${valorACobrar.toFixed(2)}</div></body></html>`;
    const printWindow = window.open("", "_blank");
    if (printWindow) { printWindow.document.write(pdfContent); printWindow.document.close(); printWindow.print(); }
    toast.success("PDF gerado!");
  };

  const handleCopyWhatsApp = () => {
    const message = `*Orçamento Gráfico*\n\n*Proposta Nº:* ${quoteNumber}\n*Cliente:* ${client}\n*Serviço:* ${product}\n*Valor Total:* R$ ${valorACobrar.toFixed(2)}\n*Validade:* ${validity} dias`;
    navigator.clipboard.writeText(message);
    toast.success("Resumo copiado para WhatsApp!");
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  return (
    <div className="flex h-full min-h-screen">
      <div className="flex-1 overflow-auto p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{isEditing ? "Editar Orçamento" : "Novo Orçamento"}</h1>
          <p className="text-sm text-muted-foreground">{isEditing ? `Editando orçamento ${quoteNumber}` : "Preencha os dados para criar um novo orçamento"}</p>
        </div>

        {/* Step Indicator — tab-style like Equipamentos */}
        <div className="mb-8 overflow-x-auto">
          <div className="inline-flex items-center bg-muted/60 rounded-lg p-1 gap-1">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === index;
              const isCompleted = currentStep > index;
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(index)}
                  className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all relative ${isActive ? "bg-background shadow-md" : "hover:bg-background/50"}`}
                  style={isActive ? { borderBottom: '3px solid hsl(var(--primary))' } : {}}
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: isActive ? 'hsl(var(--primary))' : isCompleted ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--muted-foreground) / 0.4)' }}
                  />
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : isCompleted ? "text-primary/60" : "text-muted-foreground"}`} />
                  <span className={`hidden sm:inline ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-[400px]">
          {/* Step 0: Informações */}
          {currentStep === 0 && (
            <Card className="shadow-card">
              <CardContent className="p-6 space-y-6">
                <h2 className="text-lg font-semibold text-foreground">Informações Gerais</h2>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2"><Label>Nº do Orçamento</Label><Input value={quoteNumber} disabled className="bg-muted" /></div>
                  <div className="space-y-2"><Label>Cliente</Label><Input placeholder="Buscar ou adicionar cliente..." value={client} onChange={(e) => setClient(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Produto/Serviço</Label><Input placeholder="Ex: Cartões de Visita 500un" value={product} onChange={(e) => setProduct(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Validade (dias)</Label><Input type="number" value={validity} onChange={(e) => setValidity(e.target.value)} /></div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Mão de Obra */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Grupos de Etapas */}
              {availableGroups.length > 0 && (
                <Card className="shadow-card">
                  <CardContent className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Layers className="h-5 w-5 text-primary" /> Importar Grupo de Etapas
                    </h2>
                    <p className="text-sm text-muted-foreground">Selecione um grupo para importar todas as etapas de uma vez</p>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {availableGroups.map((group) => {
                        const totalMin = group.steps.reduce((sum, s) => sum + s.timeMinutes, 0);
                        return (
                          <button
                            key={group.id}
                            onClick={() => loadStepGroup(group.id)}
                            className="group flex flex-col rounded-xl border-2 border-border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <span className="font-semibold text-foreground text-sm">{group.name}</span>
                              <Badge variant="secondary" className="text-xs shrink-0">{totalMin} min</Badge>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-3">
                              {group.steps.slice(0, 3).map((s, i) => (
                                <span key={i} className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 truncate max-w-[120px]">{s.description}</span>
                              ))}
                              {group.steps.length > 3 && (
                                <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">+{group.steps.length - 3}</span>
                              )}
                            </div>
                            <div className="mt-auto flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="h-3 w-3" /> Importar {group.steps.length} etapas
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Etapas adicionadas + adicionar avulsa */}
              <Card className="shadow-card">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" /> Etapas de Produção
                      {laborSteps.length > 0 && <Badge variant="outline" className="ml-2">{laborSteps.length} etapas</Badge>}
                    </h2>
                    <div className="flex gap-2">
                      <Select onValueChange={addStepFromCatalog}>
                        <SelectTrigger className="w-[200px]"><SelectValue placeholder="+ Etapa avulsa..." /></SelectTrigger>
                        <SelectContent>{availableSteps.map(s => <SelectItem key={s.id} value={s.id}>{s.description} ({s.timeMinutes} min)</SelectItem>)}</SelectContent>
                      </Select>
                      <Button variant="outline" onClick={addLaborStep} className="gap-2"><Plus className="h-4 w-4" /> Manual</Button>
                    </div>
                  </div>
                  {laborSteps.length > 0 ? (
                    <div className="space-y-2">
                      {laborSteps.map((step, index) => (
                        <div key={step.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary shrink-0">{index + 1}</span>
                          <div className="flex-1"><Input value={step.description} onChange={(e) => updateLaborStep(step.id, "description", e.target.value)} placeholder="Descrição da etapa" className="border-0 bg-transparent p-0 h-auto text-sm font-medium focus-visible:ring-0" /></div>
                          <div className="flex items-center gap-2"><Input type="number" value={step.timeMinutes || ""} onChange={(e) => updateLaborStep(step.id, "timeMinutes", parseFloat(e.target.value) || 0)} className="w-20 h-8 text-sm text-center" /><span className="text-xs text-muted-foreground w-6">min</span></div>
                          <span className="text-sm font-medium text-muted-foreground w-24 text-right">R$ {((step.timeMinutes / 60) * hourlyRate).toFixed(2)}</span>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeLaborStep(step.id)}><X className="h-4 w-4" /></Button>
                        </div>
                      ))}
                      <Separator className="my-3" />
                      <div className="flex items-center justify-between text-sm font-semibold px-3">
                        <span className="text-foreground">Total Mão de Obra</span>
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">{laborSteps.reduce((s, st) => s + st.timeMinutes, 0)} min</span>
                          <span className="text-primary">R$ {laborTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Clock className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">Nenhuma etapa adicionada</p>
                      <p className="text-xs">{availableGroups.length > 0 ? "Importe um grupo acima ou adicione etapas avulsas" : "Use os seletores acima para adicionar etapas"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Matéria-Prima */}
          {currentStep === 2 && (
            <Card className="shadow-card">
              <CardContent className="p-6 space-y-5">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Matéria-Prima e Suprimentos</h2>
                <div className="flex gap-3">
                  <MaterialCatalogSearch materials={availableMaterials} onSelect={addMaterialFromCatalog} />
                  <Button variant="outline" onClick={addMaterial} className="gap-2 shrink-0"><Plus className="h-4 w-4" /> Item Manual</Button>
                </div>
                {materials.length > 0 ? (
                  <div className="space-y-2">
                    {materials.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
                        <div className="flex-1"><Input value={item.description} onChange={(e) => updateMaterial(item.id, "description", e.target.value)} placeholder="Descrição do item" className="border-0 bg-transparent p-0 h-auto text-sm font-medium focus-visible:ring-0" /></div>
                        <div className="flex items-center gap-2">
                          <Input type="number" value={item.quantity || ""} onChange={(e) => updateMaterial(item.id, "quantity", parseFloat(e.target.value) || 0)} className="w-16 h-8 text-sm text-center" placeholder="Qtd" />
                          <span className="text-muted-foreground">×</span>
                          <Input type="number" step="0.01" value={item.unitPrice || ""} onChange={(e) => updateMaterial(item.id, "unitPrice", parseFloat(e.target.value) || 0)} className="w-24 h-8 text-sm text-center" placeholder="R$" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground w-24 text-right">R$ {(item.quantity * item.unitPrice).toFixed(2)}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeMaterial(item.id)}><X className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Package className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">Nenhum material adicionado</p><p className="text-xs">Use a busca acima para encontrar materiais do catálogo</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Terceirizados */}
          {currentStep === 3 && (
            <Card className="shadow-card">
              <CardContent className="p-6 space-y-5">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" /> Serviços Terceirizados</h2>
                {thirdParty.length > 0 ? (
                  <div className="space-y-3">
                    {thirdParty.map((service, index) => (
                      <div key={service.id} className="rounded-lg border bg-card p-4 space-y-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Descrição</Label><Input placeholder="Ex: Corte a laser" value={service.description} onChange={(e) => { const n = [...thirdParty]; n[index].description = e.target.value; setThirdParty(n); }} /></div>
                          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Fornecedor</Label><Input placeholder="Nome do fornecedor" value={service.supplier} onChange={(e) => { const n = [...thirdParty]; n[index].supplier = e.target.value; setThirdParty(n); }} /></div>
                          <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1"><Label className="text-xs text-muted-foreground">Custo (R$)</Label><Input type="number" step="0.01" placeholder="0.00" value={service.cost || ""} onChange={(e) => { const n = [...thirdParty]; n[index].cost = parseFloat(e.target.value) || 0; setThirdParty(n); }} /></div>
                            <Button variant="ghost" size="icon" onClick={() => removeThirdParty(service.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Wrench className="h-10 w-10 mb-3 opacity-30" /><p className="text-sm">Nenhum serviço terceirizado</p><p className="text-xs">Adicione serviços externos se necessário</p>
                  </div>
                )}
                <Button variant="outline" onClick={addThirdParty} className="w-full gap-2"><Plus className="h-4 w-4" /> Adicionar Terceirizado</Button>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Finalizar */}
          {currentStep === 4 && (
            <Card className="shadow-card">
              <CardContent className="p-6 space-y-5">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Resumo e Finalização</h2>
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Despesas Produtivas</h3>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Mão de Obra:</span><span className="font-medium">R$ {laborTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Matéria-Prima:</span><span className="font-medium">R$ {materialsTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Terceirizados:</span><span className="font-medium">R$ {thirdPartyTotal.toFixed(2)}</span></div>
                  <Separator /><div className="flex justify-between font-semibold"><span>Total:</span><span>R$ {totalDespesasProdutivas.toFixed(2)}</span></div>
                </div>
                {/* Exemption toggles - only for authorized users */}
                {canToggleExemptions && (
                  <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 space-y-2">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <ShieldAlert className="h-3 w-3" /> Isenções
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Switch checked={!includeInvoice} onCheckedChange={(v) => setIncludeInvoice(!v)} className="scale-75" />
                        <span className={!includeInvoice ? "text-orange-600 font-medium" : "text-muted-foreground"}>S/ Imposto</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Switch checked={!includeWaste} onCheckedChange={(v) => setIncludeWaste(!v)} className="scale-75" />
                        <span className={!includeWaste ? "text-orange-600 font-medium" : "text-muted-foreground"}>S/ Perda</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Switch checked={!includeCollection} onCheckedChange={(v) => setIncludeCollection(!v)} className="scale-75" />
                        <span className={!includeCollection ? "text-orange-600 font-medium" : "text-muted-foreground"}>S/ Cobrança</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Despesas de Venda</h3>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Impostos ({invoicePercentage}%):</span><span>R$ {impostosCost.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Perdas ({wastePercentage}%):</span><span>R$ {perdasCost.toFixed(2)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Custos de Cobrança ({collectionCostPercentage}%):</span><span>R$ {cobrancaCost.toFixed(2)}</span></div>
                  <Separator /><div className="flex justify-between font-semibold"><span>Total:</span><span>R$ {totalDespesasVenda.toFixed(2)}</span></div>
                </div>

                {/* Alert badge when exemptions are active */}
                {hasExemptions && (
                  <div className="flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                    <ShieldAlert className="h-4 w-4 text-orange-600 shrink-0" />
                    <p className="text-xs text-orange-700">
                      <span className="font-semibold">Atenção:</span> Este orçamento possui isenções ativas
                      ({[!includeInvoice && "Imposto", !includeWaste && "Perda", !includeCollection && "Cobrança"].filter(Boolean).join(", ")})
                    </p>
                  </div>
                )}
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2"><Label>Margem de Lucro / BDI (%)</Label><Input type="number" step="0.01" value={profitMargin} onChange={(e) => setProfitMargin(e.target.value)} /></div>
                  <div className="w-48 text-right pb-2"><div className="text-xs text-muted-foreground">Lucro</div><div className="text-base font-semibold text-primary">+ R$ {lucroValue.toFixed(2)}</div></div>
                </div>
                <div className="rounded-xl bg-primary/10 p-6 border border-primary/20">
                  <div className="flex items-center justify-between"><span className="text-lg font-semibold">VALOR A COBRAR</span><span className="text-3xl font-bold text-primary">R$ {valorACobrar.toFixed(2)}</span></div>
                </div>
                <div className="space-y-3 pt-2">
                  {!isSaved ? (
                    <Button className="w-full gap-2" size="lg" onClick={handleSaveQuote}><Check className="h-5 w-5" /> Salvar Orçamento</Button>
                  ) : (
                    <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Orçamento salvo! Como deseja enviar?</p>
                      <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 gap-2" onClick={handleGeneratePDF}><FileDown className="h-4 w-4" /> Gerar PDF</Button>
                        <Button variant="outline" className="flex-1 gap-2" onClick={handleCopyWhatsApp}><Copy className="h-4 w-4" /> Copiar p/ WhatsApp</Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 0} className="gap-2"><ChevronLeft className="h-4 w-4" /> Voltar</Button>
          {currentStep < STEPS.length - 1 && <Button onClick={nextStep} className="gap-2">Próximo <ChevronRight className="h-4 w-4" /></Button>}
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col border-l bg-card p-5 sticky top-0 h-screen overflow-auto">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Resumo</h3>
        {(client || product) && (
          <div className="mb-4 pb-4 border-b space-y-1">
            {client && <p className="text-sm font-medium truncate">{client}</p>}
            {product && <p className="text-xs text-muted-foreground truncate">{product}</p>}
          </div>
        )}
        <div className="space-y-3 text-sm flex-1">
          <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Mão de Obra</span><span className="font-medium">R$ {laborTotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1.5"><Package className="h-3.5 w-3.5" /> Materiais</span><span className="font-medium">R$ {materialsTotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5" /> Terceirizados</span><span className="font-medium">R$ {thirdPartyTotal.toFixed(2)}</span></div>
          <Separator />
          <div className="flex justify-between"><span className="text-muted-foreground">Custo Produtivo</span><span className="font-medium">R$ {totalDespesasProdutivas.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Desp. Venda</span><span className="font-medium">R$ {totalDespesasVenda.toFixed(2)}</span></div>
          {hasExemptions && (
            <div className="flex items-center gap-1 text-[10px] text-orange-600 font-medium">
              <ShieldAlert className="h-3 w-3" />
              Isenções: {[!includeInvoice && "Imp", !includeWaste && "Perda", !includeCollection && "Cobr"].filter(Boolean).join(", ")}
            </div>
          )}
          <div className="flex justify-between"><span className="text-muted-foreground">Lucro ({profitMargin}%)</span><span className="font-medium text-primary">R$ {lucroValue.toFixed(2)}</span></div>
        </div>
        <div className="mt-4 pt-4 border-t">
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Valor a Cobrar</p>
            <p className="text-2xl font-bold text-primary">R$ {valorACobrar.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground"><span>Etapas</span><Badge variant="secondary" className="h-5 px-2 text-xs">{laborSteps.length}</Badge></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>Materiais</span><Badge variant="secondary" className="h-5 px-2 text-xs">{materials.length}</Badge></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>Terceirizados</span><Badge variant="secondary" className="h-5 px-2 text-xs">{thirdParty.length}</Badge></div>
        </div>
      </aside>
    </div>
  );
}
