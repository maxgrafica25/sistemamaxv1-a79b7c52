import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Plus, X, Wrench, Check, User,
  Printer, Loader2, Link2, Lock, AlertTriangle, Megaphone, Layers,
  History, ChevronDown, ChevronUp, EyeOff, Tags, FileText, Package,
  Sparkles, RefreshCw,
} from "lucide-react";
import { CVItemCard, type CVItemState } from "@/components/orcamentos-v2/CVItemCard";
import { ClientCombobox } from "@/components/orcamentos-v2/ClientCombobox";
import { ClientDetailsPanel } from "@/components/orcamentos-v2/ClientDetailsPanel";
import { ClientLastSalesPanel } from "@/components/orcamentos-v2/ClientLastSalesPanel";
import type { CVMaterial, CVPrinter, CVFinish, CVCalcResult } from "@/lib/cv-pricing/engine";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import PrintingItemSearch, { type PrintingCatalogItem, type MarkupTier } from "@/components/orcamentos/PrintingItemSearch";
import { StickyFinancialSidebar } from "@/components/orcamentos-v2/StickyFinancialSidebar";
import { DiscountPaymentBlock, type DiscountType, MAX_DISCOUNT_PERCENT } from "@/components/orcamentos-v2/DiscountPaymentBlock";
import { useIsAdmin } from "@/hooks/useIsAdmin";

import {
  recalculateForQuantity,
  type PricingMaterial,
  type PricingSnapshot,
} from "@/lib/quotes-v2/pricing";

import { CreateVersionButton } from "@/components/orcamentos-v2/CreateVersionButton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PrintingItemEditor } from "@/components/orcamentos-v2/PrintingItemEditor";
import { LaborAndSupplySubform, type SubformLabor, type SubformMaterial } from "@/components/orcamentos-v2/LaborAndSupplySubform";
import { buildDynamicTitle } from "@/lib/quotes-v2/item-title";
import { buildSubjectSuggestion } from "@/lib/quotes-v2/subject-suggestion";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { TagInput } from "@/components/ui/TagInput";
import { FreightSelector } from "@/components/orcamentos-v2/FreightSelector";
import { QuoteItemsTable, type ProcessStep, type ProcessGroup } from "@/components/orcamentos-v2/QuoteItemsTable";

interface Props {
  quoteId?: string;
  onDone: () => void;
  onCancel: () => void;
}

interface ThirdParty { id: string; description: string; supplier: string; cost: number; }


const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const isLargerThanA4 = (size: string) => /^(A3|SRA3|A2|A1|A0)/i.test(size);
const roundUp5 = (v: number) => Math.ceil(v * 20 - 1e-9) / 20;

// Pré-preenche dimensões em mm a partir de tamanhos padrão do catálogo.
const STANDARD_SIZE_MM: Record<string, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  SRA3: [320, 450],
  A5: [148, 210],
  A6: [105, 148],
  CARTA: [216, 279],
};
const guessWidthMmFromSize = (size?: string | null): number | null => {
  const k = (size || "").toUpperCase().trim();
  return STANDARD_SIZE_MM[k]?.[0] ?? null;
};
const guessHeightMmFromSize = (size?: string | null): number | null => {
  const k = (size || "").toUpperCase().trim();
  return STANDARD_SIZE_MM[k]?.[1] ?? null;
};

const calcSellingPrice = (baseCost: number, tier: MarkupTier) => {
  const soma = (tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct) / 100;
  const divisor = 1 - soma;
  if (divisor <= 0) return 0;
  return Math.round((baseCost / divisor) * 10) / 10;
};

export function NewQuoteFormV2({ quoteId, onDone, onCancel }: Props) {
  const isEditing = !!quoteId;
  const { defaultQuoteValidityDays, defaultTaxRate, defaultLossMargin } = useCompanySettings();
  const [paymentFees, setPaymentFees] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase
      .from("payment_method_fees")
      .select("method, fee_pct")
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, number> = {};
        data.forEach((r: any) => { map[r.method] = Number(r.fee_pct) || 0; });
        setPaymentFees(map);
      });
  }, []);
  
  const [loadingInit, setLoadingInit] = useState(true);

  // form state
  const [quoteNumber, setQuoteNumber] = useState("");
  const [client, setClient] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [showClientData, setShowClientData] = useState(false);
  const [showLastSales, setShowLastSales] = useState(false);
  const [product, setProduct] = useState("");
  const [validity, setValidity] = useState("15");
  const [profitMargin, setProfitMargin] = useState("33");
  
  const [notes, setNotes] = useState("");
  const [attentionTo, setAttentionTo] = useState("");
  const [hiddenExtras, setHiddenExtras] = useState<number>(0);
  const [freightValue, setFreightValue] = useState<number>(0);
  const [freightTypeId, setFreightTypeId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  const [labor, setLabor] = useState<SubformLabor[]>([]);
  const [materials, setMaterials] = useState<SubformMaterial[]>([]);
  const [thirdParty, setThirdParty] = useState<ThirdParty[]>([]);

  // CV (Comunicação Visual)
  const [cvMaterials, setCvMaterials] = useState<CVMaterial[]>([]);
  const [cvPrinters, setCvPrinters] = useState<CVPrinter[]>([]);
  const [cvFinishes, setCvFinishes] = useState<CVFinish[]>([]);
  const [cvItems, setCvItems] = useState<CVItemState[]>([]);
  const [cvResults, setCvResults] = useState<Record<string, CVCalcResult>>({});

  const [discountValue, setDiscountValue] = useState<number | null>(null);
  const [discountType, setDiscountType] = useState<DiscountType>("brl");
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const isAdmin = useIsAdmin();
  

  // catalog
  const [printingCatalog, setPrintingCatalog] = useState<PrintingCatalogItem[]>([]);
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
  const [processGroups, setProcessGroups] = useState<ProcessGroup[]>([]);
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

  // ---------- Splits derivados ----------
  // Um item é "de impressão" (card estruturado novo) se já tem baseCost
  // OU se foi criado pelo fluxo novo (catalogSource === "printing"), mesmo
  // que ainda esteja vazio aguardando o usuário escolher o papel.
  const isPrintingRoot = (m: SubformMaterial) =>
    !m.parentItemId && (!!m.baseCost || (m as any).catalogSource === "printing");
  const printingItems = useMemo(
    () => materials.filter(isPrintingRoot),
    [materials],
  );
  const childMaterials = useMemo(
    () => materials.filter((m) => !!m.parentItemId),
    [materials],
  );
  const standaloneManualMaterials = useMemo(
    () => materials.filter((m) => !m.parentItemId && !isPrintingRoot(m)),
    [materials],
  );
  const standaloneLabor = useMemo(
    () => labor.filter((l) => !l.parentItemId),
    [labor],
  );

  const subjectSuggestion = useMemo(() => buildSubjectSuggestion(materials), [materials]);

  // ---------- Load catalog & quote ----------
  const loadInit = useCallback(async () => {
    setLoadingInit(true);
    const [printRes, catRes, eqRes, consRes, papersRes, tiersRes, settingsRes, expRes, salRes, depRes, capRes, cvMatRes, cvPrtRes, cvFinRes] =
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
        supabase.from("cv_materials").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("cv_printers").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("cv_finishes").select("*").eq("is_active", true).order("sort_order"),
      ]);

    setCvMaterials((cvMatRes.data || []) as unknown as CVMaterial[]);
    setCvPrinters((cvPrtRes.data || []) as unknown as CVPrinter[]);
    setCvFinishes((cvFinRes.data || []) as unknown as CVFinish[]);

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

    // Catálogos: processos individuais e grupos de processos (substitui acabamentos)
    const [stepsRes, groupsRes, groupItemsRes] = await Promise.all([
      supabase.from("production_steps").select("id, description, time_minutes, step_type").order("description"),
      supabase.from("step_groups").select("id, name").order("name"),
      supabase.from("step_group_items").select("step_group_id, description, time_minutes, step_type").order("sort_order"),
    ]);
    setProcessSteps((stepsRes.data || []).map((s: any) => ({
      id: s.id,
      description: s.description,
      time_minutes: Number(s.time_minutes) || 0,
      step_type: s.step_type || "outro",
    })));
    const itemsByGroup: Record<string, ProcessGroup["items"]> = {};
    (groupItemsRes.data || []).forEach((it: any) => {
      const gid = it.step_group_id;
      (itemsByGroup[gid] ||= []).push({
        description: it.description,
        time_minutes: Number(it.time_minutes) || 0,
        step_type: it.step_type || "outro",
      });
    });
    setProcessGroups((groupsRes.data || []).map((g: any) => ({
      id: g.id, name: g.name, items: itemsByGroup[g.id] || [],
    })));

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
      const [qRes, lRes, mRes, tpRes, cvRes] = await Promise.all([
        supabase.from("quotes").select("*").eq("id", quoteId).single(),
        supabase.from("quote_labor_steps").select("*").eq("quote_id", quoteId).order("sort_order"),
        supabase.from("quote_materials").select("*").eq("quote_id", quoteId).order("sort_order"),
        supabase.from("quote_third_party").select("*").eq("quote_id", quoteId).order("sort_order"),
        supabase.from("cv_quote_items").select("*").eq("quote_id", quoteId).order("sort_order"),
      ]);
      if (qRes.data) {
        const q = qRes.data;
        setQuoteNumber(q.quote_number);
        setClient(q.client);
        setClientId((q as any).client_id ?? null);
        setClientPhone((q as any).client_phone ?? null);
        setProduct(q.product);
        setValidity(q.validity || "15");
        setProfitMargin(q.profit_margin || "33");
        
        setNotes((q as any).notes || "");
        setAttentionTo(((q as any).attention_to as string) || "");
        setHiddenExtras(Number((q as any).hidden_extras_value) || 0);
        setFreightValue(Number((q as any).freight_value) || 0);
        setFreightTypeId(((q as any).freight_type_id as string) || null);
        setTags(Array.isArray((q as any).tags) ? ((q as any).tags as string[]) : []);
        setDiscountValue(q.discount_value);
        setDiscountType((q.discount_type as DiscountType) || "brl");
        setPaymentMethod(q.payment_method || "");
        setQuoteVersion(q.version ?? 1);
        setIsLocked(q.is_locked ?? false);
        setParentQuoteId(q.parent_quote_id ?? null);
      }
      setLabor((lRes.data || []).map((s: any) => ({
        id: s.id,
        description: s.description,
        timeMinutes: s.time_minutes,
        stepType: s.step_type || "outro",
        parentItemId: s.parent_item_id || null,
        isOptional: !!s.is_optional,
      })));
      setMaterials((mRes.data || []).map((m: any) => ({
        id: m.id,
        description: m.description,
        quantity: m.quantity,
        unitPrice: m.unit_price,
        pieces: m.pieces_count != null ? Number(m.pieces_count) : (m.quantity ?? null),
        status: m.status as "pendente" | "aprovado" | "recusado",
        approvedAt: m.approved_at,
        approvedValue: m.approved_value,
        parentItemId: m.parent_item_id || null,
        productKind: m.product_kind ?? null,
        customName: m.custom_name ?? null,
        reference: m.reference ?? null,
        generatedTitle: m.generated_title ?? null,
        paperType: m.paper_type ?? null,
        grammage: m.grammage ?? null,
        size: m.size ?? null,
        side: m.side ?? null,
        widthMm: m.width_mm != null ? Number(m.width_mm) : null,
        heightMm: m.height_mm != null ? Number(m.height_mm) : null,
        printColors: m.print_colors ?? null,
        catalogSource: (m.catalog_source as "printing" | "finishing" | null) ?? null,
        catalogItemId: m.catalog_item_id ?? null,
        isOptional: !!m.is_optional,
        quantityVariations: Array.isArray(m.quantity_variations) ? m.quantity_variations : [],
        bookletPages: m.booklet_pages != null ? Number(m.booklet_pages) : null,
        bookletUnits: m.booklet_units != null ? Number(m.booklet_units) : null,
        bookletDuplex: m.booklet_duplex ?? null,
      })));
      setThirdParty((tpRes.data || []).map((t: any) => ({
        id: t.id, description: t.description, supplier: t.supplier, cost: t.cost,
      })));
      setCvItems((cvRes.data || []).map((it: any) => ({
        id: it.id,
        material_id: it.material_id,
        printer_id: it.printer_id,
        largura_cm: Number(it.largura_cm) || 0,
        altura_cm: Number(it.altura_cm) || 0,
        quantidade: it.quantidade || 1,
        acabamentos: Array.isArray(it.finishes_json)
          ? (it.finishes_json as any[]).map((a) => ({
              finish_id: a.finish_id,
              quantidade_unidades: a.quantidade_unidades ?? 1,
              ...(a.custom ? { custom: { nome: String(a.custom.nome ?? ""), valor: Number(a.custom.valor) || 0 } } : {}),
            }))
          : [],
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

      // Validade default puxada das configurações da empresa
      const { data: companyRow } = await supabase
        .from("company_settings")
        .select("default_quote_validity_days")
        .limit(1)
        .maybeSingle();
      const defDays = (companyRow as any)?.default_quote_validity_days ?? defaultQuoteValidityDays ?? 15;
      setValidity(String(defDays));
    }

    // Carrega sugestões de tags já usadas em outros orçamentos
    const { data: tagsData } = await supabase.from("quotes").select("tags").not("tags", "is", null).limit(500);
    const allTags = new Set<string>();
    (tagsData || []).forEach((row: any) => (row.tags || []).forEach((t: string) => t && allTags.add(t)));
    setTagSuggestions(Array.from(allTags).sort());

    setLoadingInit(false);
  }, [quoteId, defaultQuoteValidityDays]);

  useEffect(() => {
    loadInit();
  }, [loadInit]);

  // ---------- Pricing snapshot + live result ----------
  const snapshot: PricingSnapshot = useMemo(() => ({
    laborSteps: labor.map((l) => ({
      timeMinutes: l.timeMinutes,
      parentItemId: l.parentItemId ?? null,
    })),
    materials: materials.map((m) => ({
      ...m,
      parentItemId: m.parentItemId ?? null,
    })),
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
    hiddenExtrasValue: hiddenExtras || 0,
    freightValue: freightValue || 0,
  }), [labor, materials, thirdParty, globalSettings, profitMargin, hourlyRate, markupTiers, categoryGroups, hiddenExtras, freightValue]);

  const live = useMemo(() => recalculateForQuantity(snapshot, 1), [snapshot]);

  const cvTotal = useMemo(
    () => Object.values(cvResults).reduce((s, r) => s + (r?.preco_total || 0), 0),
    [cvResults],
  );
  const cvCostTotal = useMemo(
    () => Object.values(cvResults).reduce((s, r) => s + (r?.custo_total || 0), 0),
    [cvResults],
  );

  const subtotalBeforeDiscount = useMemo(
    () => live.totalToCharge + cvTotal,
    [live.totalToCharge, cvTotal],
  );

  const discountedTotal = useMemo(() => {
    const baseTotal = subtotalBeforeDiscount;
    if (!discountValue || discountValue <= 0) return baseTotal;
    return discountType === "percent"
      ? baseTotal * (1 - discountValue / 100)
      : Math.max(0, baseTotal - discountValue);
  }, [subtotalBeforeDiscount, discountValue, discountType]);

  // Reaplica clamp se subtotal/tipo mudar e desconto vigente exceder o limite
  useEffect(() => {
    if (!discountValue || discountValue <= 0) return;
    if (discountType === "percent" && discountValue > MAX_DISCOUNT_PERCENT) {
      setDiscountValue(MAX_DISCOUNT_PERCENT);
    } else if (discountType === "brl") {
      const max = subtotalBeforeDiscount * MAX_DISCOUNT_PERCENT / 100;
      if (max > 0 && discountValue > max) setDiscountValue(Number(max.toFixed(2)));
    }
  }, [discountType, subtotalBeforeDiscount, discountValue]);


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
      pieces: 1,
      baseCost,
      printerCategoryId: item.printer_category_id,
      markupGroupId: item.markup_group_id,
      parentItemId: null,
      paperType: item.paper_type ?? null,
      grammage: item.grammage ?? null,
      size: item.size ?? null,
      side: item.side ?? null,
      widthMm: guessWidthMmFromSize(item.size),
      heightMm: guessHeightMmFromSize(item.size),
      printColors: item.side === "F/V" ? "4x4" : item.side === "Simples" ? "4x0" : null,
      productKind: null,
      customName: null,
      reference: null,
      generatedTitle: null,
      catalogSource: "printing",
      catalogItemId: item.id,
    }]);
    toast.success("Item de impressão adicionado!");
  };

  const addEmptyPrintingItem = () => {
    setMaterials((prev) => [
      ...prev,
      {
        id: `print-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        description: "",
        quantity: 1,
        unitPrice: 0,
        pieces: 1,
        baseCost: 0,
        printerCategoryId: null,
        markupGroupId: null,
        parentItemId: null,
        paperType: null,
        grammage: null,
        size: null,
        side: null,
        widthMm: null,
        heightMm: null,
        printColors: null,
        productKind: null,
        customName: null,
        reference: null,
        generatedTitle: null,
        catalogSource: "printing",
        catalogItemId: null,
      } as any,
    ]);
  };

  const pickPaperForPrintingItem = (id: string, item: PrintingCatalogItem) => {
    const sizeMult = isLargerThanA4(item.size) ? 2 : 1;
    const sideMult = item.side === "F/V" ? 2 : 1;
    const printCost = roundUp5(item.printing_cost * sizeMult * sideMult);
    const baseCost = item.paper_cost + printCost;
    const groupId = item.markup_group_id || categoryGroups[item.printer_category_id] || null;
    const groupTiers = groupId
      ? markupTiers.filter((t) => t.markup_group_id === groupId)
      : markupTiers.filter((t) => t.printer_category_id === item.printer_category_id);
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const qty = m.quantity || 1;
        const tier =
          groupTiers.find((t) => qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty)) ||
          groupTiers[0] ||
          null;
        const sellingPrice = tier ? calcSellingPrice(baseCost, tier) : baseCost;
        return {
          ...m,
          description: `${item.paper_type}${item.grammage ? ` ${item.grammage}` : ""} ${item.size} ${item.side}${item.equipment_name ? ` — ${item.equipment_name}` : ""}`,
          baseCost,
          unitPrice: sellingPrice,
          printerCategoryId: item.printer_category_id,
          markupGroupId: item.markup_group_id,
          paperType: item.paper_type ?? null,
          grammage: item.grammage ?? null,
          size: item.size ?? null,
          side: item.side ?? null,
          widthMm: m.widthMm ?? guessWidthMmFromSize(item.size),
          heightMm: m.heightMm ?? guessHeightMmFromSize(item.size),
          printColors: m.printColors ?? (item.side === "F/V" ? "4x4" : item.side === "Simples" ? "4x0" : null),
          catalogSource: "printing",
          catalogItemId: item.id,
        };
      }),
    );
  };


  const addProcessStep = (parentId: string | null, step: ProcessStep) => {
    setLabor((prev) => [...prev, {
      id: `lbr-${Date.now()}-${step.id}`,
      description: step.description,
      timeMinutes: step.time_minutes || 0,
      stepType: step.step_type || "outro",
      parentItemId: parentId,
    }]);
    toast.success(parentId ? "Processo vinculado!" : "Processo adicionado!");
  };

  const expandStepGroup = (parentId: string | null, group: ProcessGroup) => {
    if (!group.items.length) {
      toast.error("Grupo sem etapas cadastradas.");
      return;
    }
    const ts = Date.now();
    setLabor((prev) => [
      ...prev,
      ...group.items.map((it, i) => ({
        id: `lbr-${ts}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        description: it.description,
        timeMinutes: it.time_minutes || 0,
        stepType: it.step_type || "outro",
        parentItemId: parentId,
      })),
    ]);
    toast.success(`Grupo "${group.name}" expandido em ${group.items.length} etapas`);
  };

  const removeLaborStep = (id: string) =>
    setLabor((prev) => prev.filter((l) => l.id !== id));

  const updateMaterialPatch = (id: string, patch: Partial<PricingMaterial>) =>
    setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const removeMaterial = (id: string) => {
    // Remover pai cascateia: também remove filhos vinculados (UI e save).
    setMaterials((prev) => prev.filter((m) => m.id !== id && m.parentItemId !== id));
    setLabor((prev) => prev.filter((l) => l.parentItemId !== id));
  };

  const duplicateItemDeep = (id: string) => {
    const parent = materials.find((m) => m.id === id && !m.parentItemId);
    if (!parent) return;
    const newParentId = crypto.randomUUID();
    const clonedParent: SubformMaterial = {
      ...parent,
      id: newParentId,
      status: "pendente" as any,
      approvedAt: null as any,
      approvedValue: null as any,
    };
    const childMats = materials
      .filter((m) => m.parentItemId === id)
      .map((c) => ({ ...c, id: crypto.randomUUID(), parentItemId: newParentId }));
    const childLab = labor
      .filter((l) => l.parentItemId === id)
      .map((l) => ({ ...l, id: `lbr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, parentItemId: newParentId }));
    setMaterials((prev) => [...prev, clonedParent, ...childMats]);
    setLabor((prev) => [...prev, ...childLab]);
    toast.success("Item duplicado com sucesso! Altere a quantidade ou acabamento na nova linha.");
  };

  const setChildLaborFor = (parentId: string, next: SubformLabor[]) => {
    setLabor((prev) => {
      const others = prev.filter((l) => l.parentItemId !== parentId);
      return [...others, ...next];
    });
  };

  const setChildMaterialsFor = (parentId: string, next: SubformMaterial[]) => {
    setMaterials((prev) => {
      const others = prev.filter((m) => m.parentItemId !== parentId);
      return [...others, ...next];
    });
  };

  const setStandaloneLabor = (next: SubformLabor[]) => {
    setLabor((prev) => {
      const childOnly = prev.filter((l) => l.parentItemId);
      return [...next, ...childOnly];
    });
  };

  const setStandaloneManualMaterials = (next: SubformMaterial[]) => {
    setMaterials((prev) => {
      // Mantém: itens de impressão e qualquer filho (com parentItemId)
      const keep = prev.filter((m) => m.baseCost || m.parentItemId);
      return [...keep, ...next];
    });
  };

  const handleSave = async () => {
    if (isLocked) {
      toast.error("Este orçamento está travado. Crie uma nova versão para alterá-lo.");
      return;
    }
    if (!clientId || !client.trim()) {
      toast.error("Selecione um cliente para continuar.");
      return;
    }
    if (materials.length === 0 && cvItems.length === 0) {
      toast.error("Adicione pelo menos 1 item ao orçamento (gráfico ou comunicação visual).");
      return;
    }
    if (!paymentMethod) {
      toast.error("Selecione a forma de pagamento.");
      return;
    }
    if (!product.trim()) {
      toast.error("Preencha a descrição do produto/serviço.");
      return;
    }
    try {
      const payload = {
        quote_number: quoteNumber,
        client: client.trim(),
        client_id: clientId,
        client_phone: clientPhone,
        product: product.trim(),
        value: discountedTotal,
        date: new Date().toISOString().split("T")[0],
        validity,
        profit_margin: profitMargin,
        
        notes: notes.trim() || null,
        attention_to: attentionTo.trim() || null,
        hidden_extras_value: hiddenExtras || 0,
        freight_value: freightValue || 0,
        freight_type_id: freightTypeId,
        tags,
        discount_value: discountValue,
        discount_type: discountValue ? discountType : null,
        payment_method: paymentMethod || null,
        
      };

      let id = savedQuoteId;
      if (isEditing && id) {
        await supabase.from("quotes").update(payload).eq("id", id);

        // Apaga apenas itens NÃO aprovados; mantém aprovados intactos.
        // ON DELETE CASCADE em parent_item_id apaga filhos quando o pai é apagado.
        const approvedIds = materials
          .filter((m) => m.status === "aprovado")
          .map((m) => m.id);
        let delQ = supabase.from("quote_materials").delete().eq("quote_id", id);
        if (approvedIds.length > 0) delQ = delQ.not("id", "in", `(${approvedIds.join(",")})`);
        await delQ;

        await Promise.all([
          supabase.from("quote_labor_steps").delete().eq("quote_id", id),
          supabase.from("quote_third_party").delete().eq("quote_id", id),
          supabase.from("cv_quote_items").delete().eq("quote_id", id),
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
        // ---- FASE 1: Inserir PAIS (materiais raiz: parentItemId == null) que não estão aprovados ----
        // Mapa do id-temporário → id-real do banco para depois reapontar os filhos.
        const tempToReal = new Map<string, string>();

        const rootMaterials = materials
          .map((m, i) => ({ ...m, sortOrder: i }))
          .filter((m) => !m.parentItemId);

        // Helper para computar título dinâmico de um pai com base em seus filhos materiais
        const titleForRoot = (rootId: string, rootMat: PricingMaterial) => {
          const childDesc = materials
            .filter((x) => x.parentItemId === rootId)
            .map((x) => x.description);
          return buildDynamicTitle({
            productKind: rootMat.productKind,
            customName: rootMat.customName,
            paperType: rootMat.paperType,
            grammage: rootMat.grammage,
            size: rootMat.size,
            side: rootMat.side,
            widthMm: rootMat.widthMm,
            heightMm: rootMat.heightMm,
            printColors: rootMat.printColors,
            finishes: childDesc,
          });
        };

        const rootToInsert = rootMaterials.filter((m) => m.status !== "aprovado");
        if (rootToInsert.length > 0) {
          const { data: insertedRoots, error: errRoot } = await supabase
            .from("quote_materials")
            .insert(
              rootToInsert.map((m) => ({
                quote_id: id,
                description: m.description,
                quantity: m.quantity,
                unit_price: m.unitPrice,
                pieces_count: m.pieces ?? null,
                sort_order: m.sortOrder,
                status: "pendente",
                parent_item_id: null,
                product_kind: m.productKind ?? null,
                custom_name: m.customName ?? null,
                reference: m.reference ?? null,
                generated_title: titleForRoot(m.id, m) || null,
                paper_type: m.paperType ?? null,
                grammage: m.grammage ?? null,
                size: m.size ?? null,
                side: m.side ?? null,
                width_mm: m.widthMm ?? null,
                height_mm: m.heightMm ?? null,
                print_colors: m.printColors ?? null,
                catalog_source: m.catalogSource ?? null,
                catalog_item_id: m.catalogItemId ?? null,
                is_optional: !!(m as any).isOptional,
                quantity_variations: (m as any).quantityVariations ?? [],
                booklet_pages: (m as any).bookletPages ?? null,
                booklet_units: (m as any).bookletUnits ?? null,
                booklet_duplex: (m as any).bookletDuplex ?? null,
              })),
            )
            .select("id");
          if (errRoot) throw errRoot;
          (insertedRoots || []).forEach((row, idx) => {
            const original = rootToInsert[idx];
            tempToReal.set(original.id, row.id);
          });
        }

        // Aprovados: mantém id real (já existente no banco)
        rootMaterials
          .filter((m) => m.status === "aprovado")
          .forEach((m) => tempToReal.set(m.id, m.id));

        // Atualiza sort_order + nomenclatura dos aprovados
        for (const m of rootMaterials.filter((x) => x.status === "aprovado")) {
          await supabase
            .from("quote_materials")
            .update({
              sort_order: m.sortOrder,
              product_kind: m.productKind ?? null,
              custom_name: m.customName ?? null,
              reference: m.reference ?? null,
              generated_title: titleForRoot(m.id, m) || null,
              paper_type: m.paperType ?? null,
              grammage: m.grammage ?? null,
              size: m.size ?? null,
              side: m.side ?? null,
              width_mm: m.widthMm ?? null,
              height_mm: m.heightMm ?? null,
              print_colors: m.printColors ?? null,
            })
            .eq("id", m.id);
        }

        // ---- FASE 2: Inserir FILHOS (materials e labor com parentItemId) ----
        const childMaterials = materials
          .map((m, i) => ({ ...m, sortOrder: i }))
          .filter((m) => m.parentItemId && m.status !== "aprovado");
        if (childMaterials.length > 0) {
          await supabase.from("quote_materials").insert(
            childMaterials.map((m) => ({
              quote_id: id,
              description: m.description,
              quantity: m.quantity,
              unit_price: m.unitPrice,
              sort_order: m.sortOrder,
              status: "pendente",
              parent_item_id: tempToReal.get(m.parentItemId!) ?? null,
              catalog_source: m.catalogSource ?? null,
              catalog_item_id: m.catalogItemId ?? null,
              is_optional: !!(m as any).isOptional,
            })),
          );
        }

        // Labor (todos: avulsos + filhos)
        if (labor.length > 0) {
          await supabase.from("quote_labor_steps").insert(
            labor.map((s, i) => ({
              quote_id: id,
              description: s.description,
              time_minutes: s.timeMinutes,
              sort_order: i,
              step_type: s.stepType || "outro",
              parent_item_id: s.parentItemId
                ? tempToReal.get(s.parentItemId) ?? null
                : null,
              is_optional: !!(s as any).isOptional,
            })),
          );
        }

        // Terceirizados
        if (thirdParty.length > 0) {
          await supabase.from("quote_third_party").insert(
            thirdParty.map((t, i) => ({
              quote_id: id, description: t.description, supplier: t.supplier, cost: t.cost, sort_order: i,
            })),
          );
        }

        // CV items
        if (cvItems.length > 0) {
          const cvRows = cvItems.map((it, i) => {
            const r = cvResults[it.id];
            const mat = cvMaterials.find((m) => m.id === it.material_id);
            const prt = cvPrinters.find((p) => p.id === it.printer_id);
            return {
              quote_id: id,
              material_id: it.material_id,
              printer_id: it.printer_id,
              material_nome: mat?.nome ?? null,
              printer_nome: prt?.nome ?? null,
              largura_cm: it.largura_cm,
              altura_cm: it.altura_cm,
              quantidade: it.quantidade,
              area_total_m2: r?.area_total_m2 ?? 0,
              tem_emenda: r?.tem_emenda ?? false,
              aplicou_minimo: r?.aplicou_minimo ?? false,
              preco_midia: r?.preco_midia ?? 0,
              preco_impressao: r?.preco_impressao ?? 0,
              preco_acabamentos: r?.preco_acabamentos ?? 0,
              preco_total: r?.preco_total ?? 0,
              finishes_json: it.acabamentos as never,
              sort_order: i,
            };
          });
          await supabase.from("cv_quote_items").insert(cvRows);
        }
      }

      toast.success(isEditing ? "Orçamento atualizado!" : "Orçamento salvo!");
      onDone();
    } catch (e) {
      toast.error("Erro ao salvar: " + (e as Error).message);
    }
  };

  const copyPublicLink = () => {
    if (!savedQuoteId || !quoteNumber) {
      toast.error("Salve o orçamento primeiro");
      return;
    }
    const url = `${window.location.origin}/p/${quoteNumber}`;
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
    <div className="flex flex-col lg:flex-row gap-6 p-4 sm:p-6 max-w-[1400px] mx-auto pb-32 lg:pb-24">
      {/* Main column */}
      <div className="flex-1 min-w-0 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              Proposta Comercial
              {quoteVersion > 1 && (
                <Badge variant="secondary" className="text-xs">v{quoteVersion}</Badge>
              )}
              {isLocked && (
                <Badge variant="outline" className="gap-1 text-xs">
                  <Lock className="h-3 w-3" /> Travado
                </Badge>
              )}
            </h1>
          </div>
          {isEditing && savedQuoteId && hasApprovedItems && !isLocked && (
            <CreateVersionButton quoteId={savedQuoteId} quoteNumber={quoteNumber} />
          )}
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

        {/* ===== Header Tiny-style: Nº · Cliente · Aos cuidados · Validade ===== */}
        <div className="space-y-4 rounded-lg border bg-card p-4">
          <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr_110px] gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Nº Proposta</Label>
              <Input value={quoteNumber} disabled className="bg-muted h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente *</Label>
              <ClientCombobox
                value={{ id: clientId, nome: client }}
                onChange={(v) => {
                  setClientId(v.id);
                  setClient(v.nome);
                  setClientPhone(v.telefone ?? null);
                  setShowClientData(false);
                  setShowLastSales(false);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Aos cuidados de</Label>
              <Input
                value={attentionTo}
                onChange={(e) => setAttentionTo(e.target.value)}
                placeholder="Nome do contato"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Validade (dias)</Label>
              <Input
                type="number"
                min={1}
                value={validity}
                onChange={(e) => setValidity(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          {clientId && (
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <button
                type="button"
                onClick={() => setShowClientData((v) => !v)}
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                <User className="h-3.5 w-3.5" />
                {showClientData ? "Ocultar dados do cliente" : "Dados do cliente"}
                {showClientData ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={() => setShowLastSales((v) => !v)}
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                <History className="h-3.5 w-3.5" />
                {showLastSales ? "Ocultar últimas vendas" : "Ver últimas vendas"}
                {showLastSales ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>
          )}
          {clientId && showClientData && (
            <ClientDetailsPanel
              clientId={clientId}
              onUpdated={(nome, tel) => { setClient(nome); setClientPhone(tel); }}
            />
          )}
          {clientId && showLastSales && <ClientLastSalesPanel clientId={clientId} />}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 min-h-[20px]">
              <Label className="text-xs">Assunto / Projeto *</Label>
              {subjectSuggestion && !product.trim() && (
                <button
                  type="button"
                  onClick={() => setProduct(subjectSuggestion)}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                  title="Preencher com sugestão (ou pressione Tab no campo vazio)"
                >
                  <Sparkles className="h-3 w-3" />
                  Usar sugestão: <span className="font-medium truncate max-w-[280px]">{subjectSuggestion}</span>
                </button>
              )}
              {subjectSuggestion && product.trim() && product.trim() !== subjectSuggestion && (
                <button
                  type="button"
                  onClick={() => setProduct(subjectSuggestion)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                  title={`Regenerar a partir dos itens: "${subjectSuggestion}"`}
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerar
                </button>
              )}
            </div>
            <Input
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab" && !product.trim() && subjectSuggestion) {
                  e.preventDefault();
                  setProduct(subjectSuggestion);
                  // Após preencher, mover foco manualmente para o próximo elemento focável
                  const form = e.currentTarget.form;
                  if (form) {
                    const focusables = Array.from(
                      form.querySelectorAll<HTMLElement>(
                        'input,select,textarea,button,[tabindex]:not([tabindex="-1"])'
                      )
                    ).filter((el) => !el.hasAttribute("disabled"));
                    const idx = focusables.indexOf(e.currentTarget);
                    if (idx >= 0 && focusables[idx + 1]) focusables[idx + 1].focus();
                  }
                }
              }}
              placeholder={subjectSuggestion || "Ex.: Cartões de visita corporativos – Acme Ltda."}
              className="h-9"
            />
          </div>
        </div>


        {/* ===== Itens (tabela única estilo Tiny) ===== */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" /> Itens de produto ou serviço
          </h2>
          <QuoteItemsTable
            printingCatalog={printingCatalog}
            processSteps={processSteps}
            processGroups={processGroups}
            markupTiers={markupTiers}
            categoryDefaultGroupId={categoryGroups}
            globalSettings={globalSettings}
            hourlyRate={hourlyRate}
            printingItems={printingItems}
            childMaterials={childMaterials}
            childLabor={labor.filter((l) => !!l.parentItemId)}
            standaloneLabor={standaloneLabor}
            standaloneManualMaterials={standaloneManualMaterials}
            thirdParty={thirdParty}
            onAddPrinting={addPrintingItem}
            onSwapPrinting={(id, item) => {
              const sizeMult = isLargerThanA4(item.size) ? 2 : 1;
              const sideMult = item.side === "F/V" ? 2 : 1;
              const printCost = roundUp5(item.printing_cost * sizeMult * sideMult);
              const baseCost = item.paper_cost + printCost;
              setMaterials((prev) =>
                prev.map((m) =>
                  m.id === id
                    ? {
                        ...m,
                        description: `${item.paper_type}${item.grammage ? ` ${item.grammage}` : ""} ${item.size} ${item.side}${item.equipment_name ? ` — ${item.equipment_name}` : ""}`,
                        baseCost,
                        printerCategoryId: item.printer_category_id,
                        markupGroupId: item.markup_group_id,
                        paperType: item.paper_type ?? null,
                        grammage: item.grammage ?? null,
                        size: item.size ?? null,
                        side: item.side ?? null,
                        catalogSource: "printing",
                        catalogItemId: item.id,
                      }
                    : m,
                ),
              );
              toast.success("Material trocado — confira se os acabamentos seguem compatíveis.");
            }}
            onAddProcess={addProcessStep}
            onExpandStepGroup={expandStepGroup}
            onAddCustomFinish={(parentId, name, minutes) => {
              setLabor((prev) => [
                ...prev,
                {
                  id: `lbr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  description: name,
                  timeMinutes: minutes,
                  stepType: "outro",
                  parentItemId: parentId,
                },
              ]);
              toast.success(parentId ? "Acabamento avulso vinculado!" : "Acabamento avulso adicionado!");
            }}
            onAddEmptyPrinting={addEmptyPrintingItem}
            onPickPaperForPrinting={pickPaperForPrintingItem}
            onSetChildLaborForItem={setChildLaborFor}
            onSetChildMaterialsForItem={setChildMaterialsFor}
            onUpdatePrinting={updateMaterialPatch}
            onUpdateChildMaterial={updateMaterialPatch}
            onRemovePrinting={removeMaterial}
            onDuplicateItem={duplicateItemDeep}
            onRemoveChildMaterial={removeMaterial}
            onRemoveLabor={removeLaborStep}
            onChangeStandaloneLabor={setStandaloneLabor}
            onChangeStandaloneMaterials={setStandaloneManualMaterials}
            onChangeThirdParty={setThirdParty}
          />
        </div>

        {/* ===== Comunicação Visual (opcional, recolhido) ===== */}
        {(cvItems.length > 0 || cvMaterials.length > 0) && (
          <details className="rounded-lg border bg-card group">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium flex items-center gap-2 list-none">
              <Megaphone className="h-4 w-4 text-primary" />
              Comunicação Visual
              {cvItems.length > 0 && <Badge variant="outline" className="ml-1">{cvItems.length}</Badge>}
              <ChevronDown className="h-4 w-4 ml-auto group-open:rotate-180 transition-transform" />
            </summary>
            <div className="px-4 pb-4 space-y-3 border-t">
              <div className="flex justify-end pt-3">
                <Button
                  variant="outline" size="sm" className="gap-1.5"
                  disabled={cvMaterials.length === 0}
                  onClick={() => setCvItems((p) => [...p, {
                    id: `cv-${Date.now()}`, material_id: null, printer_id: null,
                    largura_cm: 0, altura_cm: 0, quantidade: 1, acabamentos: [],
                  }])}
                >
                  <Plus className="h-4 w-4" /> Item CV
                </Button>
              </div>
              {cvItems.map((it, idx) => (
                <CVItemCard
                  key={it.id} item={it} index={idx}
                  materiais={cvMaterials} impressoras={cvPrinters} acabamentos={cvFinishes}
                  onChange={(updated) => setCvItems((p) => p.map((x) => (x.id === it.id ? updated : x)))}
                  onRemove={() => {
                    setCvItems((p) => p.filter((x) => x.id !== it.id));
                    setCvResults((p) => { const { [it.id]: _, ...rest } = p; return rest; });
                  }}
                  onResult={(r) =>
                    setCvResults((p) => (p[it.id]?.preco_total === r.preco_total && p[it.id]?.custo_total === r.custo_total ? p : { ...p, [it.id]: r }))
                  }
                />
              ))}
              {cvItems.length > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
                  <span className="text-sm font-medium text-muted-foreground">Subtotal Comunicação Visual</span>
                  <span className="text-lg font-bold text-primary">{formatBRL(cvTotal)}</span>
                </div>
              )}
            </div>
          </details>
        )}

        {/* ===== Descrições complementares ===== */}
        <div className="space-y-2">
          <Label className="text-xs flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Descrições complementares / Observações
          </Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas internas, contexto da proposta, instruções para a produção…"
            rows={4}
          />
        </div>

        {/* ===== Frete & Outros ===== */}
        <Separator className="my-4" />
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Frete & Outros</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FreightSelector
                freightTypeId={freightTypeId}
                freightValue={freightValue}
                onChange={({ freightTypeId: t, freightValue: v }) => {
                  setFreightTypeId(t);
                  setFreightValue(v);
                }}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Cadastre tipos de frete em <strong>Configurações → Empresa</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <EyeOff className="h-3.5 w-3.5" /> Outros valores (oculto no orçamento)
              </Label>
              <Input
                type="number"
                step="0.01"
                value={hiddenExtras || ""}
                onChange={(e) => setHiddenExtras(parseFloat(e.target.value) || 0)}
                placeholder="0,00"
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                Acrescido ao total final mas <strong>não aparece</strong> no PDF do cliente.
              </p>
            </div>
          </div>
        </div>

        {/* ===== Condições Comerciais ===== */}
        <Separator className="my-4" />
        <div className="space-y-4">
          <h2 className="text-base font-semibold">Condições comerciais</h2>
          <DiscountPaymentBlock
            discountValue={discountValue}
            discountType={discountType}
            paymentMethod={paymentMethod}
            subtotal={subtotalBeforeDiscount}
            onDiscountValueChange={setDiscountValue}
            onDiscountTypeChange={setDiscountType}
            onPaymentMethodChange={setPaymentMethod}
          />
        </div>

        {/* ===== Marcadores ===== */}
        <Separator className="my-4" />
        <div className="space-y-2">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Tags className="h-4 w-4 text-primary" /> Marcadores
          </h2>
          <p className="text-xs text-muted-foreground">
            Tags para relatórios e pesquisas futuras (ex.: licitação, recorrente, evento).
          </p>
          <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
        </div>


        {/* ===== Total + ações secundárias ===== */}
        <Separator className="my-4" />
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
          {savedQuoteId && (
            <Button variant="outline" className="w-full gap-2" onClick={copyPublicLink}>
              <Link2 className="h-4 w-4" /> Copiar link público para o cliente
            </Button>
          )}
        </CardContent></Card>
      </div>

      {/* Sticky financial sidebar — DRE (apenas admin) */}
      {isAdmin && (
      <div className="lg:self-start lg:sticky lg:top-6">
        {(() => {
          // Soma direta dos itens raiz exibidos na tabela (não usar live.totalToCharge,
          // que reprecifica via engine com qty=1 e infla com markup de faixa baixa)
          const itemsRevenueGross = materials
            .filter((m) => !m.parentItemId)
            .reduce((s, m) => s + (m.unitPrice * m.quantity), 0)
            + cvTotal
            + (hiddenExtras || 0)
            + (freightValue || 0);

          // Aplica desconto sobre a soma real dos itens
          const proposalTotal = (() => {
            if (!discountValue || discountValue <= 0) return itemsRevenueGross;
            return discountType === "percent"
              ? itemsRevenueGross * (1 - discountValue / 100)
              : Math.max(0, itemsRevenueGross - discountValue);
          })();

          const totalProductionCost = live.costsBeforeMarkup + live.printingTotal + cvCostTotal;

          const approvedRevenue = materials
            .filter((m) => !m.parentItemId && m.status === "aprovado")
            .reduce((s, m) => s + (m.approvedValue ?? (m.unitPrice * m.quantity)), 0);
          const hasApproved = approvedRevenue > 0;

          const revenueBase = hasApproved ? approvedRevenue : proposalTotal;
          const productionCost = hasApproved && itemsRevenueGross > 0
            ? totalProductionCost * (approvedRevenue / itemsRevenueGross)
            : totalProductionCost;

          const taxPct = defaultTaxRate;
          const lossPct = defaultLossMargin;
          const billingPct = paymentMethod ? (paymentFees[paymentMethod] ?? 0) : 0;

          const taxValue = revenueBase * taxPct / 100;
          const lossValue = revenueBase * lossPct / 100;
          const billingValue = revenueBase * billingPct / 100;

          const netProfit = revenueBase - productionCost - taxValue - lossValue - billingValue;
          const netMarginPct = revenueBase > 0 ? (netProfit / revenueBase) * 100 : 0;

          return (
            <StickyFinancialSidebar
              proposalTotal={proposalTotal}
              approvedTotal={approvedRevenue}
              hasApproved={hasApproved}
              productionCost={productionCost}
              taxPct={taxPct}
              taxValue={taxValue}
              billingPct={billingPct}
              billingMethod={paymentMethod}
              billingValue={billingValue}
              lossPct={lossPct}
              lossValue={lossValue}
              netProfit={netProfit}
              netMarginPct={netMarginPct}
              revenueBase={revenueBase}
            />
          );
        })()}
      </div>
      )}

      {/* ===== Rodapé fixo: Salvar / Cancelar ===== */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 pr-20 sm:pr-24 flex items-center justify-end gap-2">
        <div className="hidden sm:flex flex-col mr-auto">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wide">Total</span>
          <span className="text-base font-bold text-primary">{formatBRL(discountedTotal)}</span>
        </div>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave} disabled={isLocked} className="gap-2">
          <Check className="h-4 w-4" /> {isLocked ? "Travado" : (isEditing ? "Atualizar" : "Salvar")}
        </Button>
      </div>
    </div>
  );
}

