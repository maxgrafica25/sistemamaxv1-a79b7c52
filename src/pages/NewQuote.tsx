import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FileDown, Copy, X, Package, Wrench, ChevronLeft, ChevronRight, Check, User, Clock, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function NewQuote() {
  const [currentStep, setCurrentStep] = useState(0);
  const [quoteNumber] = useState("2025-005");
  const [client, setClient] = useState("");
  const [product, setProduct] = useState("");
  const [validity, setValidity] = useState("7");
  
  const [hourlyRate] = useState(80);
  const [invoicePercentage] = useState(10);
  const [wastePercentage] = useState(5);
  const [collectionCostPercentage] = useState(7);
  const [profitMargin, setProfitMargin] = useState("33");
  
  const [laborSteps, setLaborSteps] = useState<LaborStep[]>([]);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [thirdParty, setThirdParty] = useState<ThirdPartyService[]>([]);

  const availableSteps: AvailableStep[] = [
    { id: "1", description: "Preparação de arquivo", timeMinutes: 15 },
    { id: "2", description: "Impressão digital", timeMinutes: 30 },
    { id: "3", description: "Corte", timeMinutes: 20 },
    { id: "4", description: "Dobra", timeMinutes: 15 },
    { id: "5", description: "Laminação", timeMinutes: 25 },
  ];

  const availableGroups: StepGroup[] = [
    {
      id: "1",
      name: "Impressão Digital A3",
      steps: [
        { id: "1-1", description: "Preparação de arquivo", timeMinutes: 15 },
        { id: "1-2", description: "Impressão digital", timeMinutes: 30 },
        { id: "1-3", description: "Verificação de qualidade", timeMinutes: 10 },
      ],
    },
    {
      id: "2",
      name: "Acabamento Folder",
      steps: [
        { id: "2-1", description: "Corte", timeMinutes: 20 },
        { id: "2-2", description: "Dobra", timeMinutes: 15 },
        { id: "2-3", description: "Embalagem", timeMinutes: 10 },
      ],
    },
  ];

  const availableMaterials: Material[] = [
    { id: "1", name: "Papel Couché 300g", unit: "folha", lastPrice: 2.50 },
    { id: "2", name: "Papel Offset 75g", unit: "resma", lastPrice: 45.00 },
    { id: "3", name: "Tinta Ciano CMYK", unit: "litro", lastPrice: 120.00 },
  ];

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

  const addLaborStep = () => {
    setLaborSteps([...laborSteps, { id: Date.now().toString(), description: "", timeMinutes: 0 }]);
  };

  const removeLaborStep = (id: string) => setLaborSteps(laborSteps.filter(step => step.id !== id));

  const updateLaborStep = (id: string, field: keyof LaborStep, value: string | number) => {
    setLaborSteps(laborSteps.map(step => step.id === id ? { ...step, [field]: value } : step));
  };

  const addMaterialFromCatalog = (materialId: string) => {
    const material = availableMaterials.find(m => m.id === materialId);
    if (material) {
      setMaterials([...materials, { id: `${Date.now()}-${material.id}`, description: material.name, quantity: 1, unitPrice: material.lastPrice }]);
      toast.success(`${material.name} adicionado!`);
    }
  };

  const addMaterial = () => {
    setMaterials([...materials, { id: Date.now().toString(), description: "", quantity: 0, unitPrice: 0 }]);
  };

  const removeMaterial = (id: string) => setMaterials(materials.filter(item => item.id !== id));

  const updateMaterial = (id: string, field: keyof MaterialItem, value: string | number) => {
    setMaterials(materials.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addThirdParty = () => {
    setThirdParty([...thirdParty, { id: Date.now().toString(), description: "", supplier: "", cost: 0 }]);
  };

  const removeThirdParty = (id: string) => setThirdParty(thirdParty.filter(service => service.id !== id));

  const [isSaved, setIsSaved] = useState(false);

  const handleSaveQuote = () => {
    if (!client.trim() || !product.trim()) {
      toast.error("Preencha o cliente e o produto antes de salvar");
      return;
    }
    setIsSaved(true);
    toast.success("Orçamento salvo com sucesso!");
  };

  const handleGeneratePDF = () => toast.success("PDF gerado com sucesso!");

  const handleCopyWhatsApp = () => {
    const message = `*Orçamento Gráfico Rápido*\n\n*Proposta Nº:* ${quoteNumber}\n*Cliente:* ${client}\n*Serviço:* ${product}\n*Valor Total:* R$ ${valorACobrar.toFixed(2)}\n*Validade:* ${validity} dias`;
    navigator.clipboard.writeText(message);
    toast.success("Resumo copiado para WhatsApp!");
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  return (
    <div className="flex h-full min-h-screen">
      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Novo Orçamento</h1>
          <p className="text-sm text-muted-foreground">Preencha os dados para criar um novo orçamento</p>
        </div>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === index;
              const isCompleted = currentStep > index;
              return (
                <div key={step.id} className="flex items-center flex-1 last:flex-none">
                  <button
                    onClick={() => setCurrentStep(index)}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md"
                        : isCompleted
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isCompleted ? "bg-primary text-primary-foreground" : ""
                    }`}>
                      {isCompleted ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div className={`mx-2 h-0.5 flex-1 rounded ${
                      currentStep > index ? "bg-primary" : "bg-border"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {/* Step 0: Informações Gerais */}
          {currentStep === 0 && (
            <Card className="shadow-card">
              <CardContent className="p-6 space-y-6">
                <h2 className="text-lg font-semibold text-foreground">Informações Gerais</h2>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quoteNumber">Nº do Orçamento</Label>
                    <Input id="quoteNumber" value={quoteNumber} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client">Cliente</Label>
                    <Input id="client" placeholder="Buscar ou adicionar cliente..." value={client} onChange={(e) => setClient(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="product">Produto/Serviço</Label>
                    <Input id="product" placeholder="Ex: Cartões de Visita 500un" value={product} onChange={(e) => setProduct(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="validity">Validade (dias)</Label>
                    <Input id="validity" type="number" value={validity} onChange={(e) => setValidity(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 1: Mão de Obra */}
          {currentStep === 1 && (
            <Card className="shadow-card">
              <CardContent className="p-6 space-y-5">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Mão de Obra
                </h2>
                <div className="grid gap-3 md:grid-cols-3">
                  <Select onValueChange={addStepFromCatalog}>
                    <SelectTrigger><SelectValue placeholder="Adicionar Etapa..." /></SelectTrigger>
                    <SelectContent>
                      {availableSteps.map((step) => (
                        <SelectItem key={step.id} value={step.id}>{step.description} ({step.timeMinutes} min)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select onValueChange={loadStepGroup}>
                    <SelectTrigger><SelectValue placeholder="Carregar Grupo..." /></SelectTrigger>
                    <SelectContent>
                      {availableGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>{group.name} ({group.steps.reduce((sum, s) => sum + s.timeMinutes, 0)} min)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={addLaborStep} className="gap-2 w-full">
                    <Plus className="h-4 w-4" /> Etapa Manual
                  </Button>
                </div>

                {laborSteps.length > 0 ? (
                  <div className="space-y-2">
                    {laborSteps.map((step) => (
                      <div key={step.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
                        <div className="flex-1">
                          <Input
                            value={step.description}
                            onChange={(e) => updateLaborStep(step.id, "description", e.target.value)}
                            placeholder="Descrição da etapa"
                            className="border-0 bg-transparent p-0 h-auto text-sm font-medium focus-visible:ring-0"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={step.timeMinutes || ""}
                            onChange={(e) => updateLaborStep(step.id, "timeMinutes", parseFloat(e.target.value) || 0)}
                            className="w-20 h-8 text-sm text-center"
                          />
                          <span className="text-xs text-muted-foreground w-6">min</span>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground w-24 text-right">
                          R$ {((step.timeMinutes / 60) * hourlyRate).toFixed(2)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-danger" onClick={() => removeLaborStep(step.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Clock className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">Nenhuma etapa adicionada</p>
                    <p className="text-xs">Use os seletores acima para adicionar etapas</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Matéria-Prima */}
          {currentStep === 2 && (
            <Card className="shadow-card">
              <CardContent className="p-6 space-y-5">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Matéria-Prima e Suprimentos
                </h2>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Select onValueChange={addMaterialFromCatalog}>
                      <SelectTrigger><SelectValue placeholder="Adicionar do Catálogo..." /></SelectTrigger>
                      <SelectContent>
                        {availableMaterials.map((material) => (
                          <SelectItem key={material.id} value={material.id}>{material.name} - R$ {material.lastPrice.toFixed(2)}/{material.unit}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={addMaterial} className="gap-2">
                    <Plus className="h-4 w-4" /> Item Manual
                  </Button>
                </div>

                {materials.length > 0 ? (
                  <div className="space-y-2">
                    {materials.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
                        <div className="flex-1">
                          <Input
                            value={item.description}
                            onChange={(e) => updateMaterial(item.id, "description", e.target.value)}
                            placeholder="Descrição do item"
                            className="border-0 bg-transparent p-0 h-auto text-sm font-medium focus-visible:ring-0"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={item.quantity || ""}
                            onChange={(e) => updateMaterial(item.id, "quantity", parseFloat(e.target.value) || 0)}
                            className="w-16 h-8 text-sm text-center"
                            placeholder="Qtd"
                          />
                          <span className="text-muted-foreground">×</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice || ""}
                            onChange={(e) => updateMaterial(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                            className="w-24 h-8 text-sm text-center"
                            placeholder="R$"
                          />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground w-24 text-right">
                          R$ {(item.quantity * item.unitPrice).toFixed(2)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-danger" onClick={() => removeMaterial(item.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Package className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">Nenhum material adicionado</p>
                    <p className="text-xs">Use o catálogo ou adicione manualmente</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 3: Terceirizados */}
          {currentStep === 3 && (
            <Card className="shadow-card">
              <CardContent className="p-6 space-y-5">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Serviços Terceirizados
                </h2>

                {thirdParty.length > 0 ? (
                  <div className="space-y-3">
                    {thirdParty.map((service, index) => (
                      <div key={service.id} className="rounded-lg border bg-card p-4 space-y-3">
                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Descrição</Label>
                            <Input
                              placeholder="Ex: Corte a laser"
                              value={service.description}
                              onChange={(e) => {
                                const newServices = [...thirdParty];
                                newServices[index].description = e.target.value;
                                setThirdParty(newServices);
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Fornecedor</Label>
                            <Input
                              placeholder="Nome do fornecedor"
                              value={service.supplier}
                              onChange={(e) => {
                                const newServices = [...thirdParty];
                                newServices[index].supplier = e.target.value;
                                setThirdParty(newServices);
                              }}
                            />
                          </div>
                          <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1">
                              <Label className="text-xs text-muted-foreground">Custo (R$)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={service.cost || ""}
                                onChange={(e) => {
                                  const newServices = [...thirdParty];
                                  newServices[index].cost = parseFloat(e.target.value) || 0;
                                  setThirdParty(newServices);
                                }}
                              />
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => removeThirdParty(service.id)} className="text-muted-foreground hover:text-danger">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Wrench className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">Nenhum serviço terceirizado</p>
                    <p className="text-xs">Adicione serviços externos se necessário</p>
                  </div>
                )}

                <Button variant="outline" onClick={addThirdParty} className="w-full gap-2">
                  <Plus className="h-4 w-4" /> Adicionar Terceirizado
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Finalizar */}
          {currentStep === 4 && (
            <Card className="shadow-card">
              <CardContent className="p-6 space-y-5">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Resumo e Finalização
                </h2>

                {/* Despesas Produtivas */}
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Despesas Produtivas</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Mão de Obra:</span>
                    <span className="font-medium">R$ {laborTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Matéria-Prima:</span>
                    <span className="font-medium">R$ {materialsTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Terceirizados:</span>
                    <span className="font-medium">R$ {thirdPartyTotal.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>R$ {totalDespesasProdutivas.toFixed(2)}</span>
                  </div>
                </div>

                {/* Despesas de Venda */}
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Despesas de Venda</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Impostos ({invoicePercentage}%):</span>
                    <span>R$ {impostosCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Perdas ({wastePercentage}%):</span>
                    <span>R$ {perdasCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Custos de Cobrança ({collectionCostPercentage}%):</span>
                    <span>R$ {cobrancaCost.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>R$ {totalDespesasVenda.toFixed(2)}</span>
                  </div>
                </div>

                {/* Margem de Lucro */}
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="profitMargin">Margem de Lucro / BDI (%)</Label>
                    <Input id="profitMargin" type="number" step="0.01" value={profitMargin} onChange={(e) => setProfitMargin(e.target.value)} />
                  </div>
                  <div className="w-48 text-right pb-2">
                    <div className="text-xs text-muted-foreground">Lucro</div>
                    <div className="text-base font-semibold text-primary">+ R$ {lucroValue.toFixed(2)}</div>
                  </div>
                </div>

                {/* Valor Final */}
                <div className="rounded-xl bg-primary/10 p-6 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">VALOR A COBRAR</span>
                    <span className="text-3xl font-bold text-primary">R$ {valorACobrar.toFixed(2)}</span>
                  </div>
                </div>

                {/* Ações */}
                <div className="space-y-3 pt-2">
                  <Button className="w-full gap-2" size="lg" onClick={handleSaveQuote}>
                    <Check className="h-5 w-5" /> Salvar Orçamento
                  </Button>
                  {isSaved && (
                    <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                      <p className="text-sm font-medium text-foreground">Orçamento salvo! Como deseja enviar?</p>
                      <div className="flex gap-3">
                        <Button variant="outline" className="flex-1 gap-2" onClick={handleGeneratePDF}>
                          <FileDown className="h-4 w-4" /> Gerar PDF
                        </Button>
                        <Button variant="outline" className="flex-1 gap-2" onClick={handleCopyWhatsApp}>
                          <Copy className="h-4 w-4" /> Copiar p/ WhatsApp
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 0} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={nextStep} className="gap-2">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Right Sidebar - Financial Summary */}
      <aside className="hidden lg:flex w-72 flex-col border-l bg-card p-5 sticky top-0 h-screen overflow-auto">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Resumo</h3>
        
        {/* Client & Product Info */}
        {(client || product) && (
          <div className="mb-4 pb-4 border-b space-y-1">
            {client && <p className="text-sm font-medium truncate">{client}</p>}
            {product && <p className="text-xs text-muted-foreground truncate">{product}</p>}
          </div>
        )}

        {/* Cost Breakdown */}
        <div className="space-y-3 text-sm flex-1">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Mão de Obra
              </span>
              <span className="font-medium">R$ {laborTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" /> Materiais
              </span>
              <span className="font-medium">R$ {materialsTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5" /> Terceirizados
              </span>
              <span className="font-medium">R$ {thirdPartyTotal.toFixed(2)}</span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between">
            <span className="text-muted-foreground">Custo Produtivo</span>
            <span className="font-medium">R$ {totalDespesasProdutivas.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Desp. Venda</span>
            <span className="font-medium">R$ {totalDespesasVenda.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Lucro ({profitMargin}%)</span>
            <span className="font-medium text-primary">R$ {lucroValue.toFixed(2)}</span>
          </div>
        </div>

        {/* Total */}
        <div className="mt-4 pt-4 border-t">
          <div className="rounded-lg bg-primary/10 p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Valor a Cobrar</p>
            <p className="text-2xl font-bold text-primary">R$ {valorACobrar.toFixed(2)}</p>
          </div>
        </div>

        {/* Step Items Count */}
        <div className="mt-4 pt-4 border-t space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Etapas</span>
            <Badge variant="secondary" className="h-5 px-2 text-xs">{laborSteps.length}</Badge>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Materiais</span>
            <Badge variant="secondary" className="h-5 px-2 text-xs">{materials.length}</Badge>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Terceirizados</span>
            <Badge variant="secondary" className="h-5 px-2 text-xs">{thirdParty.length}</Badge>
          </div>
        </div>
      </aside>
    </div>
  );
}
