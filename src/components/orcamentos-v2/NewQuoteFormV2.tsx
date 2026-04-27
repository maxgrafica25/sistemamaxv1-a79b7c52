import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus, X, Package, Wrench, ChevronLeft, ChevronRight, Check, User, Clock,
  FileText, Printer, Loader2, Link2, Lock, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PrintingItemSearch, { type PrintingCatalogItem, type MarkupTier } from "@/components/orcamentos/PrintingItemSearch";
import { StickyFinancialSidebar } from "@/components/orcamentos-v2/StickyFinancialSidebar";
import { DiscountPaymentBlock, type DiscountType } from "@/components/orcamentos-v2/DiscountPaymentBlock";
import { QuoteOptionsBuilder } from "@/components/orcamentos-v2/QuoteOptionsBuilder";
import {
  recalculateForQuantity,
  type PricingMaterial,
  type PricingSnapshot,
} from "@/lib/quotes-v2/pricing";
import type { QuoteOption } from "@/lib/quotes-v2/options";
import { CreateVersionButton } from "@/components/orcamentos-v2/CreateVersionButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  quoteId?: string;
  onDone: () => void;
  onCancel: () => void;
}

interface LaborStep { id: string; description: string; timeMinutes: number; }
interface ThirdParty { id: string; description: string; supplier: string; cost: number; }

const STEPS = [
  { label: "Informações", icon: User },
  { label: "Mão de Obra", icon: Clock },
  { label: "Materiais", icon: Package },
  { label: "Terceirizados", icon: Wrench },
  { label: "Finalizar", icon: FileText },
];

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const isLargerThanA4 = (size: string) => /^(A3|SRA3|A2|A1|A0)/i.test(size);
const roundUp5 = (v: number) => Math.ceil(v * 20 - 1e-9) / 20;

const calcSellingPrice = (baseCost: number, tier: MarkupTier) => {
  const soma = (tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct) / 100;
  const divisor = 1 - soma;
  if (divisor <= 0) return 0;
  return Math.round((baseCost / divisor) * 10) / 10;
};

export function NewQuoteFormV2({ quoteId, onDone, onCancel }: Props) {
  const isEditing = !!quoteId;
  const [step, setStep] = useState(0);
  const [loadingInit, setLoadingInit] = useState(true);

  // form state
  const [quoteNumber, setQuoteNumber] = useState("");
  const [client, setClient] = useState("");
  const [product, setProduct] = useState("");
  const [validity, setValidity] = useState("7");
  const [profitMargin, setProfitMargin] = useState("33");

  const [labor, setLabor] = useState<LaborStep[]>([]);
  const [materials, setMaterials] = useState<PricingMaterial[]>([]);
  const [thirdParty, setThirdParty] = useState<ThirdParty[]>([]);

  const [discountValue, setDiscountValue] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<DiscountType>("brl");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [options, setOptions] = useState<QuoteOption[]>([]);

  // catalog
  const [printingCatalog, setPrintingCatalog] = useState<PrintingCatalogItem[]>([]);
  const [markupTiers, setMarkupTiers] = useState<MarkupTier[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<Record<string, string | null>>({});
  const [hourlyRate, setHourlyRate] = useState(80);
  const [globalSettings, setGlobalSettings] = useState({
    invoice_pct: 10, collection_pct: 7, waste_pct: 5, default_margin_pct: 33,
  });

  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(quoteId ?? null);
  const [quoteVersion, setQuoteVersion] = useState<number>(1);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [parentQuoteId, setParentQuoteId] = useState<string | null>(null);

  const hasApprovedItems = useMemo(
    () => materials.some((m) => m.status === "aprovado"),
    [materials],
  );

  // ---------- Load catalog & quote ----------
  const loadInit = useCallback(async () => {
    setLoadingInit(true);
    const [printRes, catRes, eqRes, consRes, papersRes, tiersRes, settingsRes, expRes, salRes, depRes, capRes] =
      await Promise.all([
        supabase.from("printing_price_items").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("printer_categories").select("*").order("sort_order"),
        supabase.from("equipments").select("id, name, printer_type").order("sort_order"),
        supabase.from("equipment_consumables").select("equipment_id, price, yield_pages, mode"),
        supabase.from("papers").select("id, name, grammage, pack_price, freight_price, sheet_qty").eq("is_active", true),
        supabase.from("markup_tiers").select("*").order("sort_order"),
        supabase.from("global_settings").select("*").limit(1).single(),
        supabase.from("monthly_expenses").select("value"),
        supabase.from("salaries").select("salary, is_production"),
        supabase.from("equipment_depreciation").select("purchase_value, useful_life_months, residual_value"),
        supabase.from("productive_capacity").select("hours_per_month, production_employees").limit(1).single(),
      ]);

    const tiers: MarkupTier[] = (tiersRes.data || []).map((t: any) => ({
      id: t.id,
      printer_category_id: t.printer_category_id,
      markup_group_id: t.markup_group_id || null,
      label: t.label,
      min_qty: t.min_qty,
      max_qty: t.max_qty,
      fixed_cost_pct: t.fixed_cost_pct,
      variable_cost_pct: t.variable_cost_pct,
      margin_pct: t.margin_pct,
      sort_order: t.sort_order,
    }));
    setMarkupTiers(tiers);

    if (settingsRes.data) {
      setGlobalSettings({
        invoice_pct: settingsRes.data.invoice_pct,
        collection_pct: settingsRes.data.collection_pct,
        waste_pct: settingsRes.data.waste_pct,
        default_margin_pct: settingsRes.data.default_margin_pct,
      });
    }

    const catGroupMap: Record<string, string | null> = {};
    (catRes.data || []).forEach((c: any) => { catGroupMap[c.id] = c.default_markup_group_id || null; });
    setCategoryGroups(catGroupMap);

    // Build live printing catalog (mirrors V1)
    const equipmentsList = eqRes.data || [];
    const consumablesList = consRes.data || [];
    const categoriesList = catRes.data || [];
    const papersList = papersRes.data || [];

    const paperPriceA4 = (p: any) => p.sheet_qty > 0 ? roundUp5((p.pack_price / p.sheet_qty + p.freight_price) / 9) : 0;
    const paperPriceSRA3 = (p: any) => p.sheet_qty > 0 ? roundUp5((p.pack_price / p.sheet_qty + p.freight_price) / 4) : 0;
    const getLivePaperCost = (paperType: string, grammage: string | null, size: string) => {
      const m = papersList.find((p) => {
        const nm = p.name.toLowerCase() === paperType.toLowerCase();
        const gm = !grammage || !p.grammage || p.grammage.toLowerCase() === grammage.toLowerCase();
        return nm && gm;
      });
      if (!m) return null;
      const small = size === "A4" || size === "A5" || size === "Carta";
      return small ? paperPriceA4(m) : paperPriceSRA3(m);
    };
    const getEquipCostPerPage = (equipmentId: string, mode: string) => {
      const eq = equipmentsList.find((e) => e.id === equipmentId);
      if (eq?.printer_type === "ribbon") {
        const cons = consumablesList.filter((c) => c.equipment_id === equipmentId);
        return cons.reduce((s, c) => c.yield_pages <= 0 ? s : s + c.price / c.yield_pages, 0);
      }
      const isColor = eq?.printer_type === "color";
      const usePB = mode === "pb";
      const coverage = isColor ? 20 : 5;
      const cons = consumablesList.filter((c) =>
        c.equipment_id === equipmentId && (usePB ? c.mode === "shared" : true),
      );
      const base = cons.reduce((s, c) => c.yield_pages <= 0 ? s : s + c.price / c.yield_pages, 0);
      return base * (coverage / 5);
    };

    const catalog: PrintingCatalogItem[] = (printRes.data || []).map((item: any) => {
      const cat = categoriesList.find((c) => c.id === item.printer_category_id);
      const eq = equipmentsList.find((e) => e.id === item.equipment_id);
      const printingCost = item.equipment_id
        ? getEquipCostPerPage(item.equipment_id, item.equipment_mode || "color")
        : item.printing_cost;
      const roundedPrintCost = roundUp5(printingCost);
      const livePaperCost = getLivePaperCost(item.paper_type, item.grammage, item.size);
      const paperCost = livePaperCost !== null ? Number(livePaperCost.toFixed(4)) : item.paper_cost;
      return {
        id: item.id,
        paper_type: item.paper_type,
        grammage: item.grammage,
        size: item.size,
        side: item.side,
        paper_cost: paperCost,
        printing_cost: roundedPrintCost,
        equipment_name: eq?.name || null,
        equipment_mode: item.equipment_mode || "color",
        category_name: cat?.name || "",
        printer_category_id: item.printer_category_id,
        markup_group_id: item.markup_group_id || null,
        totalCostA4: paperCost + roundedPrintCost,
      };
    });
    setPrintingCatalog(catalog);

    // hourly rate
    const totalExp = (expRes.data || []).reduce((s: number, e: any) => s + e.value, 0);
    const totalSal = (salRes.data || []).reduce((s: number, e: any) => s + e.salary, 0) * 1.45;
    const totalDep = (depRes.data || []).reduce(
      (s: number, e: any) => s + (e.useful_life_months > 0 ? (e.purchase_value - e.residual_value) / e.useful_life_months : 0),
      0,
    );
    const cap = capRes.data;
    const prodCount = (salRes.data || []).filter((s: any) => s.is_production).length;
    const hours = cap ? prodCount * cap.hours_per_month : 0;
    if (hours > 0) setHourlyRate((totalExp + totalSal + totalDep) / hours);

    // Load existing quote if editing or generate next quote number
    if (quoteId) {
      const [qRes, lRes, mRes, tpRes] = await Promise.all([
        supabase.from("quotes").select("*").eq("id", quoteId).single(),
        supabase.from("quote_labor_steps").select("*").eq("quote_id", quoteId).order("sort_order"),
        supabase.from("quote_materials").select("*").eq("quote_id", quoteId).order("sort_order"),
        supabase.from("quote_third_party").select("*").eq("quote_id", quoteId).order("sort_order"),
      ]);
      if (qRes.data) {
        const q = qRes.data;
        setQuoteNumber(q.quote_number);
        setClient(q.client);
        setProduct(q.product);
        setValidity(q.validity || "7");
        setProfitMargin(q.profit_margin || "33");
        setDiscountValue(q.discount_value);
        setDiscountType((q.discount_type as DiscountType) || "brl");
        setPaymentMethod(q.payment_method || "");
        setQuoteVersion(q.version ?? 1);
        setIsLocked(q.is_locked ?? false);
        setParentQuoteId(q.parent_quote_id ?? null);
        if (Array.isArray(q.options)) {
          setOptions(q.options as unknown as QuoteOption[]);
        }
      }
      setLabor((lRes.data || []).map((s: any) => ({
        id: s.id, description: s.description, timeMinutes: s.time_minutes,
      })));
      setMaterials((mRes.data || []).map((m: any) => ({
        id: m.id,
        description: m.description,
        quantity: m.quantity,
        unitPrice: m.unit_price,
        status: m.status as "pendente" | "aprovado" | "recusado",
        approvedAt: m.approved_at,
        approvedValue: m.approved_value,
      })));
      setThirdParty((tpRes.data || []).map((t: any) => ({
        id: t.id, description: t.description, supplier: t.supplier, cost: t.cost,
      })));
    } else {
      const { data: existing } = await supabase
        .from("quotes")
        .select("quote_number")
        .order("created_at", { ascending: false })
        .limit(50);
      const year = new Date().getFullYear();
      const count = (existing || []).filter((q: any) => q.quote_number.startsWith(String(year))).length;
      setQuoteNumber(`${year}-${String(count + 1).padStart(3, "0")}`);
      setProfitMargin(String(settingsRes.data?.default_margin_pct ?? 33));
    }

    setLoadingInit(false);
  }, [quoteId]);

  useEffect(() => {
    loadInit();
  }, [loadInit]);

  // ---------- Pricing snapshot + live result ----------
  const snapshot: PricingSnapshot = useMemo(() => ({
    laborSteps: labor.map((l) => ({ timeMinutes: l.timeMinutes })),
    materials,
    thirdParty: thirdParty.map((t) => ({ cost: t.cost })),
    settings: {
      invoicePct: globalSettings.invoice_pct,
      wastePct: globalSettings.waste_pct,
      collectionPct: globalSettings.collection_pct,
      profitMarginPct: parseFloat(profitMargin || "0"),
      hourlyRate,
    },
    markupTiers,
    categoryDefaultGroupId: categoryGroups,
    baseQuantity: 1,
  }), [labor, materials, thirdParty, globalSettings, profitMargin, hourlyRate, markupTiers, categoryGroups]);

  // Base price uses qty=1 (single-shot) for the live sidebar; options builder explores other quantities
  const live = useMemo(() => recalculateForQuantity(snapshot, 1), [snapshot]);

  // Apply discount on top of live total (for sidebar feedback only; persisted separately)
  const discountedTotal = useMemo(() => {
    if (!discountValue || discountValue <= 0) return live.totalToCharge;
    return discountType === "percent"
      ? live.totalToCharge * (1 - discountValue / 100)
      : Math.max(0, live.totalToCharge - discountValue);
  }, [live.totalToCharge, discountValue, discountType]);

  // ---------- Handlers ----------
  const addPrintingItem = (item: PrintingCatalogItem) => {
    const sizeMult = isLargerThanA4(item.size) ? 2 : 1;
    const sideMult = item.side === "F/V" ? 2 : 1;
    const printCost = roundUp5(item.printing_cost * sizeMult * sideMult);
    const baseCost = item.paper_cost + printCost;
    const groupId = item.markup_group_id || categoryGroups[item.printer_category_id] || null;
    const groupTiers = groupId
      ? markupTiers.filter((t) => t.markup_group_id === groupId)
      : markupTiers.filter((t) => t.printer_category_id === item.printer_category_id);
    const tier = groupTiers.find((t) => 1 >= t.min_qty && (t.max_qty === null || 1 <= t.max_qty)) || groupTiers[0] || null;
    const sellingPrice = tier ? calcSellingPrice(baseCost, tier) : baseCost;
    setMaterials((prev) => [...prev, {
      id: `print-${Date.now()}-${item.id}`,
      description: `${item.paper_type}${item.grammage ? ` ${item.grammage}` : ""} ${item.size} ${item.side}${item.equipment_name ? ` — ${item.equipment_name}` : ""}`,
      quantity: 1,
      unitPrice: sellingPrice,
      baseCost,
      printerCategoryId: item.printer_category_id,
      markupGroupId: item.markup_group_id,
    }]);
    toast.success("Item de impressão adicionado!");
  };

  const handleSave = async () => {
    if (isLocked) {
      toast.error("Este orçamento está travado. Crie uma nova versão para alterá-lo.");
      return;
    }
    if (!client.trim() || !product.trim()) {
      toast.error("Preencha o cliente e o produto");
      return;
    }
    try {
      const payload = {
        quote_number: quoteNumber,
        client: client.trim(),
        product: product.trim(),
        value: discountedTotal,
        date: new Date().toISOString().split("T")[0],
        validity,
        profit_margin: profitMargin,
        discount_value: discountValue,
        discount_type: discountValue ? discountType : null,
        payment_method: paymentMethod || null,
        options: (options.length > 0 ? options : null) as never,
      };

      let id = savedQuoteId;
      if (isEditing && id) {
        // Preserva status global se houver aprovados
        await supabase.from("quotes").update(payload).eq("id", id);

        // Apaga apenas itens pendentes/recusados; mantém os aprovados intactos
        const approvedIds = materials
          .filter((m) => m.status === "aprovado")
          .map((m) => m.id);
        let delQ = supabase.from("quote_materials").delete().eq("quote_id", id);
        if (approvedIds.length > 0) delQ = delQ.not("id", "in", `(${approvedIds.join(",")})`);
        await delQ;

        await Promise.all([
          supabase.from("quote_labor_steps").delete().eq("quote_id", id),
          supabase.from("quote_third_party").delete().eq("quote_id", id),
        ]);
      } else {
        const { data, error } = await supabase
          .from("quotes")
          .insert([{ ...payload, status: "pending" }])
          .select("id")
          .single();
        if (error || !data) throw error || new Error("Falha ao salvar");
        id = data.id;
        setSavedQuoteId(id);
      }

      if (id) {
        if (labor.length > 0) {
          await supabase.from("quote_labor_steps").insert(
            labor.map((s, i) => ({ quote_id: id, description: s.description, time_minutes: s.timeMinutes, sort_order: i })),
          );
        }
        // Insere apenas itens NÃO aprovados (aprovados continuam no banco)
        const toInsert = materials
          .map((m, i) => ({ ...m, sortOrder: i }))
          .filter((m) => m.status !== "aprovado");
        if (toInsert.length > 0) {
          await supabase.from("quote_materials").insert(
            toInsert.map((m) => ({
              quote_id: id,
              description: m.description,
              quantity: m.quantity,
              unit_price: m.unitPrice,
              sort_order: m.sortOrder,
              status: "pendente",
            })),
          );
        }
        // Atualiza sort_order dos aprovados (caso ordem visual tenha mudado)
        const approvedSorted = materials
          .map((m, i) => ({ ...m, sortOrder: i }))
          .filter((m) => m.status === "aprovado");
        for (const m of approvedSorted) {
          await supabase.from("quote_materials").update({ sort_order: m.sortOrder }).eq("id", m.id);
        }
        if (thirdParty.length > 0) {
          await supabase.from("quote_third_party").insert(
            thirdParty.map((t, i) => ({ quote_id: id, description: t.description, supplier: t.supplier, cost: t.cost, sort_order: i })),
          );
        }
      }

      toast.success(isEditing ? "Orçamento atualizado!" : "Orçamento salvo!");
      onDone();
    } catch (e) {
      toast.error("Erro ao salvar: " + (e as Error).message);
    }
  };

  const copyPublicLink = () => {
    if (!savedQuoteId) {
      toast.error("Salve o orçamento primeiro");
      return;
    }
    const url = `${window.location.origin}/view-quote/${savedQuoteId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link público copiado!");
  };

  if (loadingInit) {
    return (
      <div className="flex h-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 sm:p-6 max-w-[1400px] mx-auto pb-24 lg:pb-6">
      {/* Main column */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {isEditing ? "Editar Orçamento V2" : "Novo Orçamento V2"}
              {quoteVersion > 1 && (
                <Badge variant="secondary" className="text-xs">v{quoteVersion}</Badge>
              )}
              {isLocked && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Lock className="h-3 w-3" /> Travado
                </Badge>
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{quoteNumber}</p>
          </div>
          <div className="flex gap-2">
            {isEditing && savedQuoteId && hasApprovedItems && !isLocked && (
              <CreateVersionButton quoteId={savedQuoteId} quoteNumber={quoteNumber} />
            )}
            <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
          </div>
        </div>

        {isLocked && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Orçamento travado</AlertTitle>
            <AlertDescription>
              Este orçamento foi substituído por uma versão mais nova e não pode ser
              alterado. Localize a versão atual para continuar trabalhando.
            </AlertDescription>
          </Alert>
        )}

        {!isLocked && hasApprovedItems && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>Itens aprovados estão travados</AlertTitle>
            <AlertDescription>
              Para alterar valor ou quantidade de um item já aprovado pelo cliente,
              clique em <strong>Nova versão</strong> no topo. O item aprovado é
              preservado e você edita o restante sem confusão.
            </AlertDescription>
          </Alert>
        )}

        {/* Steps */}
        <div className="overflow-x-auto">
          <div className="inline-flex bg-muted/60 rounded-lg p-1 gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = step === i;
              return (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                    active ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:bg-background/50"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {step === 0 && (
            <Card><CardContent className="p-5 sm:p-6 space-y-5">
              <h2 className="text-lg font-semibold">Informações Gerais</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Nº Orçamento</Label><Input value={quoteNumber} disabled className="bg-muted" /></div>
                <div className="space-y-2"><Label>Cliente</Label><Input value={client} onChange={(e) => setClient(e.target.value)} placeholder="Nome do cliente" /></div>
                <div className="space-y-2 md:col-span-2"><Label>Produto / Serviço</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Ex: Cartões de visita" /></div>
                <div className="space-y-2"><Label>Validade (dias)</Label><Input type="number" value={validity} onChange={(e) => setValidity(e.target.value)} /></div>
                <div className="space-y-2"><Label>Margem de lucro (%)</Label><Input type="number" step="0.01" value={profitMargin} onChange={(e) => setProfitMargin(e.target.value)} /></div>
              </div>
            </CardContent></Card>
          )}

          {step === 1 && (
            <Card><CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" /> Mão de Obra
                  {labor.length > 0 && <Badge variant="outline">{labor.length} etapas</Badge>}
                </h2>
                <Button variant="outline" size="sm" onClick={() => setLabor((p) => [...p, { id: Date.now().toString(), description: "", timeMinutes: 0 }])} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Etapa
                </Button>
              </div>
              {labor.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma etapa adicionada</p>
              ) : (
                <div className="space-y-2">
                  {labor.map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">{idx + 1}</span>
                      <Input value={s.description} onChange={(e) => setLabor((p) => p.map((x) => x.id === s.id ? { ...x, description: e.target.value } : x))} placeholder="Descrição" className="flex-1 border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0" />
                      <Input type="number" value={s.timeMinutes || ""} onChange={(e) => setLabor((p) => p.map((x) => x.id === s.id ? { ...x, timeMinutes: parseFloat(e.target.value) || 0 } : x))} className="w-20 h-8 text-sm text-center" placeholder="min" />
                      <span className="text-sm font-medium text-muted-foreground w-24 text-right">{formatBRL((s.timeMinutes / 60) * hourlyRate)}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLabor((p) => p.filter((x) => x.id !== s.id))}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Card className="border-l-4 border-l-primary/60"><CardContent className="p-5 sm:p-6 space-y-4">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Printer className="h-5 w-5 text-primary" /> Impressão</h2>
                <PrintingItemSearch items={printingCatalog} onSelect={addPrintingItem} markupTiers={markupTiers} globalSettings={globalSettings} />
                {materials.filter((m) => m.baseCost).length > 0 && (
                  <div className="space-y-2">
                    {materials.filter((m) => m.baseCost).map((m) => {
                      const locked = m.status === "aprovado";
                      return (
                        <div
                          key={m.id}
                          className={`flex items-center gap-3 rounded-lg border p-3 ${
                            locked ? "border-green-500/40 bg-green-500/5" : "bg-card"
                          }`}
                        >
                          {locked
                            ? <Lock className="h-4 w-4 text-green-600" />
                            : <Printer className="h-4 w-4 text-primary/60" />}
                          <div className="flex-1 min-w-0 text-sm font-medium truncate flex items-center gap-2">
                            {m.description}
                            {locked && <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 border-green-500/30 text-[10px]">Aprovado</Badge>}
                          </div>
                          <Input
                            type="number"
                            value={m.quantity || ""}
                            disabled={locked}
                            onChange={(e) => setMaterials((p) => p.map((x) => x.id === m.id ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x))}
                            className="w-20 h-8 text-sm text-center disabled:opacity-70"
                          />
                          <span className="text-sm font-semibold text-primary w-28 text-right">{formatBRL(m.quantity * m.unitPrice)}</span>
                          {locked
                            ? <span className="w-8" />
                            : <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMaterials((p) => p.filter((x) => x.id !== m.id))}><X className="h-4 w-4" /></Button>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent></Card>

              <Card><CardContent className="p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">Materiais Manuais</h3>
                  <Button variant="outline" size="sm" onClick={() => setMaterials((p) => [...p, { id: `manual-${Date.now()}`, description: "", quantity: 1, unitPrice: 0 }])} className="gap-1.5">
                    <Plus className="h-4 w-4" /> Item
                  </Button>
                </div>
                {materials.filter((m) => !m.baseCost).map((m) => {
                  const locked = m.status === "aprovado";
                  return (
                    <div
                      key={m.id}
                      className={`flex items-center gap-2 rounded-lg border p-3 ${
                        locked ? "border-green-500/40 bg-green-500/5" : "bg-card"
                      }`}
                    >
                      {locked && <Lock className="h-4 w-4 text-green-600 shrink-0" />}
                      <Input value={m.description} disabled={locked} onChange={(e) => setMaterials((p) => p.map((x) => x.id === m.id ? { ...x, description: e.target.value } : x))} placeholder="Descrição" className="flex-1 border-0 bg-transparent p-0 h-auto text-sm focus-visible:ring-0 disabled:opacity-70" />
                      {locked && <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 border-green-500/30 text-[10px]">Aprovado</Badge>}
                      <Input type="number" value={m.quantity || ""} disabled={locked} onChange={(e) => setMaterials((p) => p.map((x) => x.id === m.id ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x))} className="w-16 h-8 text-sm text-center disabled:opacity-70" placeholder="qtd" />
                      <Input type="number" step="0.01" value={m.unitPrice || ""} disabled={locked} onChange={(e) => setMaterials((p) => p.map((x) => x.id === m.id ? { ...x, unitPrice: parseFloat(e.target.value) || 0 } : x))} className="w-24 h-8 text-sm text-center disabled:opacity-70" placeholder="R$" />
                      {locked
                        ? <span className="w-8" />
                        : <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMaterials((p) => p.filter((x) => x.id !== m.id))}><X className="h-4 w-4" /></Button>}
                    </div>
                  );
                })}
              </CardContent></Card>
            </div>
          )}

          {step === 3 && (
            <Card><CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2"><Wrench className="h-5 w-5 text-primary" /> Terceirizados</h2>
                <Button variant="outline" size="sm" onClick={() => setThirdParty((p) => [...p, { id: Date.now().toString(), description: "", supplier: "", cost: 0 }])} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Serviço
                </Button>
              </div>
              {thirdParty.map((t) => (
                <div key={t.id} className="grid grid-cols-12 gap-2 rounded-lg border bg-card p-3 items-center">
                  <Input value={t.description} onChange={(e) => setThirdParty((p) => p.map((x) => x.id === t.id ? { ...x, description: e.target.value } : x))} placeholder="Serviço" className="col-span-5 h-9 text-sm" />
                  <Input value={t.supplier} onChange={(e) => setThirdParty((p) => p.map((x) => x.id === t.id ? { ...x, supplier: e.target.value } : x))} placeholder="Fornecedor" className="col-span-4 h-9 text-sm" />
                  <Input type="number" step="0.01" value={t.cost || ""} onChange={(e) => setThirdParty((p) => p.map((x) => x.id === t.id ? { ...x, cost: parseFloat(e.target.value) || 0 } : x))} placeholder="R$" className="col-span-2 h-9 text-sm text-center" />
                  <Button variant="ghost" size="icon" className="h-8 w-8 col-span-1" onClick={() => setThirdParty((p) => p.filter((x) => x.id !== t.id))}><X className="h-4 w-4" /></Button>
                </div>
              ))}
            </CardContent></Card>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <Card><CardContent className="p-5 sm:p-6 space-y-5">
                <h2 className="text-lg font-semibold">Desconto e Pagamento</h2>
                <DiscountPaymentBlock
                  discountValue={discountValue}
                  discountType={discountType}
                  paymentMethod={paymentMethod}
                  onDiscountValueChange={setDiscountValue}
                  onDiscountTypeChange={setDiscountType}
                  onPaymentMethodChange={setPaymentMethod}
                />
              </CardContent></Card>

              <QuoteOptionsBuilder
                snapshot={snapshot}
                options={options}
                onChange={setOptions}
              />

              <Card><CardContent className="p-5 sm:p-6 space-y-4">
                <div className="rounded-xl bg-primary/10 p-5 border border-primary/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor a cobrar (base)</p>
                    <p className="text-2xl font-bold text-primary">{formatBRL(discountedTotal)}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Margem efetiva: {live.effectiveMarginPct.toFixed(1)}%
                  </Badge>
                </div>

                <Button className="w-full gap-2 h-11" onClick={handleSave}>
                  <Check className="h-4 w-4" /> {isEditing ? "Atualizar" : "Salvar"} Orçamento
                </Button>

                {savedQuoteId && (
                  <>
                    <Separator />
                    <Button variant="outline" className="w-full gap-2" onClick={copyPublicLink}>
                      <Link2 className="h-4 w-4" /> Copiar link público para o cliente
                    </Button>
                  </>
                )}
              </CardContent></Card>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          {step < STEPS.length - 1 && (
            <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className="gap-2">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Sticky financial sidebar — visible at all steps */}
      <StickyFinancialSidebar
        totalCost={live.costsBeforeMarkup + live.printingTotal}
        totalToCharge={discountedTotal}
        marginPct={live.effectiveMarginPct}
        profit={live.profit}
      />
    </div>
  );
}
