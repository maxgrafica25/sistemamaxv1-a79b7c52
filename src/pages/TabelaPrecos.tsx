import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import PageLoader from "@/components/PageLoader";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AlertTriangle, Copy, Info, Pencil, Plus, Search, Tags, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { handleError } from "@/lib/handleError";
import { useV3HourlyRate } from "@/components/orcamentos-v3/shared/useV3HourlyRate";
import {
  PREP_MINUTES,
  fmtMoney,
  formatTierRanges,
  itemAttributes,
  matchesSearch,
  orderTotal,
  minUnitPrice,
  parseTierRanges,
  prepCost,
  realProfitPct,
  tierLabel,
  tierProblems,
  unitCost,
  type CalcType,
  type ColorMode,
  type EquipmentInput,
  type ItemAttributes,
  type PaperCostInput,
  type PriceSettings,
  type PriceTableItem,
  type PriceTier,
  type SheetSize,
} from "@/lib/priceTable";

interface Category {
  id: string;
  group_name: string;
  name: string;
  calc_type: CalcType;
  equipment_id: string | null;
  color_mode: ColorMode | null;
  default_tiers: Json;
  sort_order: number;
}

interface Item extends PriceTableItem {
  id: string;
  category_id: string;
  name: string;
  notes: string | null;
  sort_order: number;
}

interface Tier extends PriceTier {
  id: string;
  price_table_id: string;
  sort_order: number;
}

type DraftTier = Partial<Tier> & { _key: string };
const newKey = () => Math.random().toString(36).slice(2);

interface Paper extends PaperCostInput {
  name: string;
  grammage: string | null;
}

const GROUP_ORDER = ["Impressões", "Serviços de balcão", "Personalizados"];
const NONE = "__none__";
const ALL = "__all__";

type FilterKey = keyof ItemAttributes | "status";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "paper", label: "Papel" },
  { key: "grammage", label: "Gramatura" },
  { key: "size", label: "Tamanho" },
  { key: "color", label: "Cor" },
  { key: "sides", label: "Lados" },
  { key: "status", label: "Situação" },
];
const STATUS_LABELS: Record<string, string> = {
  abaixo: "Lucro abaixo da meta (2 un ou mais)",
  sem_custo: "Falta custo",
  erro: "Faixa com erro ou papel sem custo",
};
const EMPTY_FILTERS: Record<FilterKey, string> = { paper: "", grammage: "", size: "", color: "", sides: "", status: "" };
const sortOptions = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true });

const parseNum = (v: string) => {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const parseDecimal = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

function profitClass(v: number | null, target: number) {
  if (v === null) return "text-muted-foreground";
  if (v >= target) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 0) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function TabelaPrecos() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [equipments, setEquipments] = useState<(EquipmentInput & { name: string })[]>([]);
  const [feesPct, setFeesPct] = useState(0.22);
  const [targetPct, setTargetPct] = useState(0.33);
  const { hourlyRate } = useV3HourlyRate();

  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<FilterKey, string>>(EMPTY_FILTERS);
  const [qtyText, setQtyText] = useState("");
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  const [itemDialog, setItemDialog] = useState<{ item: Partial<Item>; tiers: DraftTier[] } | null>(null);
  const [catDialog, setCatDialog] = useState<{ cat: Partial<Category>; ranges: string } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; description: string; action: () => void } | null>(null);

  const minuteRate = hourlyRate / 60;
  const settings: PriceSettings = { feesPct, targetPct, minuteRate };
  const ctx = { papers, equipments, minuteRate };

  const load = async () => {
    const [catRes, itemRes, tierRes, paperRes, eqRes, consRes, gsRes] = await Promise.all([
      supabase.from("price_table_categories").select("*").order("sort_order"),
      supabase.from("price_tables").select("*").order("sort_order").range(0, 4999),
      supabase.from("price_table_tiers").select("*").order("min_qty").range(0, 19999),
      supabase.from("papers").select("id, name, grammage, sheet_qty, pack_price, freight_price, is_cut_size, purchase_sheet_width_mm, purchase_sheet_height_mm").eq("is_active", true).order("name"),
      supabase.from("equipments").select("id, name, printer_type").order("sort_order"),
      supabase.from("equipment_consumables").select("equipment_id, price, yield_pages, scales_with_coverage, mode"),
      supabase.from("global_settings").select("tax_pct, invoice_pct, credit_card_pct, collection_fee_pct, waste_pct, default_margin_pct").limit(1).maybeSingle(),
    ]);
    const err = catRes.error || itemRes.error || tierRes.error;
    if (err) handleError(err, "carregar a tabela de preços");
    setCategories((catRes.data || []) as Category[]);
    setItems((itemRes.data || []) as Item[]);
    setTiers((tierRes.data || []) as Tier[]);
    setPapers((paperRes.data || []) as Paper[]);
    const cons = consRes.data || [];
    setEquipments(
      (eqRes.data || []).map((e) => ({
        id: e.id,
        name: e.name,
        printer_type: e.printer_type,
        consumables: cons.filter((c) => c.equipment_id === e.id).map((c) => ({ ...c, mode: c.mode || "shared" })),
      })),
    );
    const g = gsRes.data;
    if (g) {
      setFeesPct(
        (Number(g.tax_pct || 0) + Number(g.invoice_pct || 0) + Number(g.credit_card_pct || 0) +
          Number(g.collection_fee_pct || 0) + Number(g.waste_pct || 0)) / 100,
      );
      if (Number(g.default_margin_pct) > 0) setTargetPct(Number(g.default_margin_pct) / 100);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const tiersByItem = useMemo(() => {
    const m = new Map<string, Tier[]>();
    for (const t of tiers) {
      const list = m.get(t.price_table_id) || [];
      list.push(t);
      m.set(t.price_table_id, list);
    }
    for (const list of m.values()) list.sort((a, b) => a.min_qty - b.min_qty);
    return m;
  }, [tiers]);

  const groups = useMemo(() => {
    const names = Array.from(new Set(categories.map((c) => c.group_name)));
    names.sort((a, b) => {
      const ia = GROUP_ORDER.indexOf(a), ib = GROUP_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    return names.map((g) => ({ name: g, cats: categories.filter((c) => c.group_name === g) }));
  }, [categories]);

  useEffect(() => {
    if (!selectedCat && categories.length) setSelectedCat(categories[0].id);
  }, [categories, selectedCat]);

  // Características (papel, gramatura…) e situação de cada item, para os filtros.
  const facets = useMemo(() => {
    const m = new Map<string, Record<FilterKey, string[]>>();
    for (const item of items) {
      const a = itemAttributes(item);
      const list = tiersByItem.get(item.id) || [];
      const cost = unitCost(item, { papers, equipments, minuteRate });
      const status: string[] = [];
      if (cost.missing) status.push("sem_custo");
      else if (list.some((t) => t.min_qty >= 2 && (realProfitPct(t.price, t.min_qty, cost.total, { feesPct, targetPct, minuteRate }) ?? 1) < targetPct)) status.push("abaixo");
      const tierErrors = tierProblems(list).some((p) => !p.message.startsWith("Degrau"));
      if (tierErrors || (item.calc_type === "impressao" && cost.paper <= 0)) status.push("erro");
      m.set(item.id, {
        paper: a.paper ? [a.paper] : [],
        grammage: a.grammage ? [a.grammage] : [],
        size: a.size ? [a.size] : [],
        color: a.color ? [a.color] : [],
        sides: a.sides ? [a.sides] : [],
        status,
      });
    }
    return m;
  }, [items, tiersByItem, papers, equipments, minuteRate, feesPct, targetPct]);

  const filtering = !!search.trim() || Object.values(filters).some(Boolean);

  const passes = (item: Item, skip?: FilterKey) => {
    const f = facets.get(item.id);
    for (const { key } of FILTERS) {
      if (key === skip || !filters[key]) continue;
      if (!f?.[key].includes(filters[key])) return false;
    }
    const q = search.trim();
    return !q || matchesSearch(item.name, q) || (tiersByItem.get(item.id) || []).some((t) => t.tiny_sku?.includes(q));
  };

  // Opções de cada filtro com quantos itens sobram se escolhida (considerando os outros filtros).
  const filterOptions = useMemo(() => {
    const out = {} as Record<FilterKey, [string, number][]>;
    for (const { key } of FILTERS) {
      const counts = new Map<string, number>();
      for (const item of items) {
        if (!passes(item, key)) continue;
        for (const v of facets.get(item.id)?.[key] || []) counts.set(v, (counts.get(v) || 0) + 1);
      }
      out[key] = Array.from(counts.entries()).sort((a, b) => sortOptions(a[0], b[0]));
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, facets, filters, search, tiersByItem]);

  const visibleItems = useMemo(() => {
    const list = filtering ? items.filter((i) => passes(i)) : items.filter((i) => i.category_id === selectedCat);
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, filtering, filters, search, selectedCat, tiersByItem, facets]);

  const qty = Math.max(0, Math.floor(parseNum(qtyText) || 0));
  const clearFilters = () => { setSearch(""); setFilters(EMPTY_FILTERS); };
  const pickCategory = (id: string) => { setSelectedCat(id); clearFilters(); };

  const countByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i.category_id, (m.get(i.category_id) || 0) + 1);
    return m;
  }, [items]);

  // ─── Preço direto na tabela ────────────────────────────────────────
  const savePrice = async (tier: Tier) => {
    const draft = priceDrafts[tier.id];
    if (draft === undefined) return;
    const value = parseDecimal(draft);
    setPriceDrafts((d) => { const n = { ...d }; delete n[tier.id]; return n; });
    if (!Number.isFinite(value) || value < 0 || value === tier.price) return;
    const { error } = await supabase.from("price_table_tiers").update({ price: value }).eq("id", tier.id);
    if (error) return handleError(error, "salvar o preço");
    setTiers((list) => list.map((t) => (t.id === tier.id ? { ...t, price: value } : t)));
    toast.success("Preço salvo");
  };

  // ─── Item: novo, editar, duplicar, excluir ─────────────────────────
  const newItem = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    const ranges = Array.isArray(cat?.default_tiers) ? (cat!.default_tiers as unknown as PriceTier[]) : [];
    setItemDialog({
      item: {
        category_id: catId,
        name: "",
        calc_type: cat?.calc_type || "manual",
        equipment_id: cat?.equipment_id || null,
        color_mode: cat?.color_mode || null,
        sheet_size: "A4",
        sides: 1,
        paper_id: null,
        material_cost: 0,
        extra_cost: 0,
        minutes_per_unit: 0,
        notes: null,
      },
      tiers: (ranges.length ? ranges : [{ min_qty: 1, max_qty: null }]).map((r) => ({ _key: newKey(), min_qty: r.min_qty, max_qty: r.max_qty, price: 0, tiny_sku: null })),
    });
  };

  const editItem = (item: Item, copy = false) => {
    setItemDialog({
      item: copy ? { ...item, id: undefined, name: `${item.name} (cópia)` } : { ...item },
      tiers: (tiersByItem.get(item.id) || []).map((t) => ({ ...t, _key: newKey(), id: copy ? undefined : t.id, tiny_sku: copy ? null : t.tiny_sku })),
    });
  };

  const saveItem = async () => {
    if (!itemDialog) return;
    const { item, tiers: draftTiers } = itemDialog;
    if (!item.name?.trim()) return toast.error("Dê um nome ao item");
    if (!item.category_id) return toast.error("Escolha a categoria");
    const clean = draftTiers.map((t, i) => ({
      min_qty: Number(t.min_qty) || 1,
      max_qty: t.max_qty === null || t.max_qty === undefined || String(t.max_qty) === "" ? null : Number(t.max_qty),
      price: Number(t.price) || 0,
      tiny_sku: t.tiny_sku?.toString().trim() || null,
      sort_order: i,
    }));
    if (!clean.length) return toast.error("Inclua pelo menos uma faixa");
    if (clean.some((t) => t.max_qty !== null && t.max_qty < t.min_qty)) return toast.error("Há faixa com 'até' menor que 'de'");

    const row = {
      category_id: item.category_id,
      name: item.name.trim(),
      calc_type: item.calc_type || "manual",
      equipment_id: item.calc_type === "impressao" ? item.equipment_id || null : null,
      color_mode: item.calc_type === "impressao" ? item.color_mode || "color" : null,
      sheet_size: item.sheet_size || "A4",
      sides: item.sides === 2 ? 2 : 1,
      paper_id: item.calc_type === "impressao" ? item.paper_id || null : null,
      material_cost: Number(item.material_cost) || 0,
      extra_cost: Number(item.extra_cost) || 0,
      minutes_per_unit: Number(item.minutes_per_unit) || 0,
      notes: item.notes?.trim() || null,
    };

    let id = item.id;
    if (id) {
      const { error } = await supabase.from("price_tables").update(row).eq("id", id);
      if (error) return handleError(error, "salvar o item");
    } else {
      const sort = items.filter((i) => i.category_id === row.category_id).length;
      const { data, error } = await supabase.from("price_tables").insert({ ...row, sort_order: sort }).select("id").single();
      if (error || !data) return handleError(error, "criar o item");
      id = data.id;
    }
    // Faixas: grava as novas antes de apagar as antigas, para não perder nada se der erro no meio.
    const oldIds = (tiersByItem.get(id) || []).map((t) => t.id);
    const { error: insErr } = await supabase.from("price_table_tiers").insert(clean.map((t) => ({ ...t, price_table_id: id! })));
    if (insErr) return handleError(insErr, "salvar as faixas");
    if (oldIds.length) {
      const { error: delErr } = await supabase.from("price_table_tiers").delete().in("id", oldIds);
      if (delErr) handleError(delErr, "apagar as faixas antigas");
    }
    toast.success("Item salvo");
    setItemDialog(null);
    if (!search) setSelectedCat(row.category_id);
    load();
  };

  const deleteItem = (item: Item) =>
    setConfirm({
      title: `Excluir "${item.name}"?`,
      description: "As faixas e preços deste item saem da Tabela de Preços. O Tiny não é alterado.",
      action: async () => {
        const { error } = await supabase.from("price_tables").delete().eq("id", item.id);
        if (error) return handleError(error, "excluir o item");
        toast.success("Item excluído");
        load();
      },
    });

  // ─── Categoria ─────────────────────────────────────────────────────
  const openCategory = (cat?: Category) => {
    const ranges = cat && Array.isArray(cat.default_tiers) ? formatTierRanges(cat.default_tiers as unknown as PriceTier[]) : "1-20, 21-100, 101-300, 301+";
    setCatDialog({
      cat: cat ? { ...cat } : { name: "", group_name: groups[0]?.name || "Impressões", calc_type: "manual", equipment_id: null, color_mode: null },
      ranges,
    });
  };

  const saveCategory = async () => {
    if (!catDialog) return;
    const { cat, ranges } = catDialog;
    if (!cat.name?.trim()) return toast.error("Dê um nome à categoria");
    const parsed = parseTierRanges(ranges);
    const row = {
      name: cat.name.trim(),
      group_name: cat.group_name?.trim() || "Outros",
      calc_type: cat.calc_type || "manual",
      equipment_id: cat.calc_type === "impressao" ? cat.equipment_id || null : null,
      color_mode: cat.calc_type === "impressao" ? cat.color_mode || "color" : null,
      default_tiers: parsed as unknown as Json,
    };
    const res = cat.id
      ? await supabase.from("price_table_categories").update(row).eq("id", cat.id).select("id").single()
      : await supabase.from("price_table_categories").insert({ ...row, sort_order: categories.length }).select("id").single();
    if (res.error || !res.data) return handleError(res.error, "salvar a categoria");
    toast.success("Categoria salva");
    setCatDialog(null);
    setSelectedCat(res.data.id);
    load();
  };

  const deleteCategory = (cat: Category) => {
    if (countByCat.get(cat.id)) return toast.error("Mova ou exclua os itens desta categoria antes de excluí-la");
    setConfirm({
      title: `Excluir a categoria "${cat.name}"?`,
      description: "Ela está vazia.",
      action: async () => {
        const { error } = await supabase.from("price_table_categories").delete().eq("id", cat.id);
        if (error) return handleError(error, "excluir a categoria");
        setSelectedCat(null);
        load();
      },
    });
  };

  if (loading) return <PageLoader />;

  const currentCat = categories.find((c) => c.id === selectedCat);

  return (
    <div className="p-3 sm:p-4 lg:p-6 xl:p-8 space-y-4 max-w-[1500px] mx-auto">
      <PageHeader
        icon={Tags}
        title="Tabela de Preços"
        description="Preços por faixa de quantidade (os mesmos do Tiny), com custo e lucro real de cada faixa"
      />

      <div className="flex items-center gap-x-6 gap-y-1 text-sm flex-wrap text-muted-foreground">
        <span>Taxas sobre a venda: <strong className="text-foreground">{pct(feesPct)}</strong> (imposto + cartão + perda)</span>
        <span>Meta de lucro: <strong className="text-foreground">{pct(targetPct)}</strong></span>
        <span>Preparação do pedido: <strong className="text-foreground">{PREP_MINUTES.toLocaleString("pt-BR")} min = {fmtMoney(prepCost(minuteRate))}</strong></span>
        <span>Valor do minuto: <strong className="text-foreground">{fmtMoney(minuteRate)}</strong></span>
        <HoverCard>
          <HoverCardTrigger asChild>
            <span className="inline-flex items-center gap-1 cursor-help underline decoration-dotted">Como ler <Info className="h-3.5 w-3.5" /></span>
          </HoverCardTrigger>
          <HoverCardContent className="w-96 text-sm space-y-2">
            <p><strong>Lucro real</strong> = o que sobra de um pedido com a quantidade do início da faixa, depois de tirar as taxas, o custo das unidades e a preparação do pedido.</p>
            <p><span className="text-emerald-600 font-medium">Verde</span>: atinge a meta. <span className="text-amber-600 font-medium">Amarelo</span>: lucro abaixo da meta. <span className="text-red-600 font-medium">Vermelho</span>: prejuízo.</p>
            <p><strong>Preço mínimo</strong> = menor preço por unidade que atinge a meta nessa quantidade.</p>
            <p>Para mudar um preço, clique nele, digite o novo valor e saia do campo — salva sozinho.</p>
          </HoverCardContent>
        </HoverCard>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Categorias */}
        <aside className="md:w-64 shrink-0 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar: couche 300 a3, SKU…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 pr-8" />
            {search && (
              <button className="absolute right-2 top-2.5 text-muted-foreground" onClick={() => setSearch("")} aria-label="Limpar busca">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="md:hidden">
            <Select value={selectedCat || undefined} onValueChange={pickCategory}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.group_name} · {c.name} ({countByCat.get(c.id) || 0})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {groups.map((g) => (
            <div key={g.name} className="hidden md:block">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-2 mb-1">{g.name}</p>
              {g.cats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pickCategory(c.id)}
                  className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted ${!filtering && selectedCat === c.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{countByCat.get(c.id) || 0}</span>
                </button>
              ))}
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full hidden md:flex" onClick={() => openCategory()}>
            <Plus className="h-4 w-4 mr-1" /> Nova categoria
          </Button>
        </aside>

        {/* Itens */}
        <main className="flex-1 min-w-0 space-y-3">
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
              {FILTERS.map(({ key, label }) => (
                <div key={key} className={key === "status" ? "col-span-2 sm:col-span-1 lg:col-span-2" : ""}>
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Select value={filters[key] || ALL} onValueChange={(v) => setFilters((f) => ({ ...f, [key]: v === ALL ? "" : v }))}>
                    <SelectTrigger className={`h-9 ${filters[key] ? "border-primary text-primary" : ""}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>Todos</SelectItem>
                      {filterOptions[key].map(([v, n]) => (
                        <SelectItem key={v} value={v}>{key === "status" ? STATUS_LABELS[v] : v} ({n})</SelectItem>
                      ))}
                      {filters[key] && !filterOptions[key].some(([v]) => v === filters[key]) && (
                        <SelectItem value={filters[key]}>{key === "status" ? STATUS_LABELS[filters[key]] : filters[key]} (0)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <Label htmlFor="sim-qty" className="whitespace-nowrap">Simular quantidade</Label>
                <Input id="sim-qty" inputMode="numeric" placeholder="ex.: 70" className="h-8 w-24" value={qtyText} onChange={(e) => setQtyText(e.target.value)} />
                {qtyText && <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setQtyText("")}><X className="h-4 w-4" /></Button>}
              </div>
              {filtering && (
                <Button variant="outline" size="sm" className="h-8 ml-auto" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" /> Limpar filtros
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">
              {filtering ? `${visibleItems.length} ${visibleItems.length === 1 ? "item encontrado" : "itens encontrados"} em todas as categorias` : currentCat?.name}
            </h2>
            {!filtering && currentCat && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => openCategory(currentCat)}><Pencil className="h-4 w-4 mr-1" /> Categoria</Button>
                {!countByCat.get(currentCat.id) && (
                  <Button variant="ghost" size="sm" onClick={() => deleteCategory(currentCat)}><Trash2 className="h-4 w-4" /></Button>
                )}
                <Button size="sm" onClick={() => newItem(currentCat.id)}><Plus className="h-4 w-4 mr-1" /> Novo item</Button>
              </div>
            )}
          </div>

          {visibleItems.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">{filtering ? "Nenhum item com esses filtros." : "Nenhum item aqui ainda."}</p>
          )}

          {visibleItems.map((item) => {
            const cost = unitCost(item, ctx);
            const list = tiersByItem.get(item.id) || [];
            const problems = tierProblems(list);
            const steps = problems.filter((p) => p.message.startsWith("Degrau"));
            const others = problems.filter((p) => !p.message.startsWith("Degrau"));
            const noPaper = item.calc_type === "impressao" && cost.paper <= 0;
            const eq = equipments.find((e) => e.id === item.equipment_id);
            const paper = papers.find((p) => p.id === item.paper_id);
            return (
              <Card key={item.id}>
                <CardHeader className="py-3 px-4 flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-3 space-y-0">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{item.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {filtering && <Badge variant="outline">{categories.find((c) => c.id === item.category_id)?.name}</Badge>}
                      {item.calc_type === "impressao" && (
                        <>
                          {eq && <Badge variant="secondary">{eq.name}</Badge>}
                          <Badge variant="secondary">{item.color_mode === "pb" ? "P&B" : "Colorida"}</Badge>
                          <Badge variant="secondary">{item.sheet_size} {item.sides === 2 ? "frente e verso" : "só frente"}</Badge>
                          {paper && <Badge variant="secondary">{paper.name} {paper.grammage || ""}</Badge>}
                        </>
                      )}
                    </div>
                    {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                    {qty > 0 && list.length > 0 && (
                      <p className="text-sm mt-1.5">
                        <strong>{qty} un = {fmtMoney(orderTotal(list, qty))}</strong>
                        <span className="text-muted-foreground"> ({fmtMoney(orderTotal(list, qty) / qty)} cada)</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <span className={`text-sm mr-2 cursor-help ${cost.missing ? "text-amber-600" : "text-muted-foreground"}`}>
                          {cost.missing ? "Falta custo" : <>Custo/un <strong className="text-foreground">{fmtMoney(cost.total)}</strong></>}
                        </span>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-72 text-sm space-y-1">
                        {item.calc_type === "impressao" && <div className="flex justify-between"><span>Papel {paper ? "(cadastro)" : "(informado)"}</span><span>{fmtMoney(cost.paper)}</span></div>}
                        {item.calc_type === "impressao" && <div className="flex justify-between"><span>Máquina</span><span>{fmtMoney(cost.machine)}</span></div>}
                        {item.calc_type === "manual" && <div className="flex justify-between"><span>Material</span><span>{fmtMoney(cost.paper)}</span></div>}
                        {cost.extra > 0 && <div className="flex justify-between"><span>Extra (acabamento)</span><span>{fmtMoney(cost.extra)}</span></div>}
                        {cost.labor > 0 && <div className="flex justify-between"><span>Mão de obra ({item.minutes_per_unit} min)</span><span>{fmtMoney(cost.labor)}</span></div>}
                        <div className="flex justify-between font-semibold border-t pt-1"><span>Total por unidade</span><span>{fmtMoney(cost.total)}</span></div>
                        <p className="text-xs text-muted-foreground">+ {fmtMoney(prepCost(minuteRate))} de preparação por pedido</p>
                      </HoverCardContent>
                    </HoverCard>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editItem(item)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => editItem(item, true)} aria-label="Duplicar"><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteItem(item)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-8">Faixa (un)</TableHead>
                          <TableHead className="h-8">SKU Tiny</TableHead>
                          <TableHead className="h-8 w-28">Preço/un</TableHead>
                          <TableHead className="h-8 text-right">Lucro real</TableHead>
                          <TableHead className="h-8 text-right">Preço mínimo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map((t) => {
                          const profit = cost.missing ? null : realProfitPct(t.price, t.min_qty, cost.total, settings);
                          const min = cost.missing ? null : minUnitPrice(t.min_qty, cost.total, settings);
                          return (
                            <TableRow key={t.id} className={qty > 0 && qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty) ? "bg-primary/10 hover:bg-primary/10" : ""}>
                              <TableCell className="py-1.5">{tierLabel(t)}</TableCell>
                              <TableCell className="py-1.5 font-mono text-xs">{t.tiny_sku || "—"}</TableCell>
                              <TableCell className="py-1">
                                <Input
                                  inputMode="decimal"
                                  className="h-8 w-24"
                                  value={priceDrafts[t.id] ?? t.price.toFixed(2).replace(".", ",")}
                                  onChange={(e) => setPriceDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                                  onBlur={() => savePrice(t)}
                                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                />
                              </TableCell>
                              <TableCell className={`py-1.5 text-right font-medium ${profitClass(profit, targetPct)}`}>
                                {pct(profit)}
                                <span className="text-xs text-muted-foreground font-normal ml-1">({t.min_qty} un)</span>
                              </TableCell>
                              <TableCell className="py-1.5 text-right text-muted-foreground">{min === null ? "—" : fmtMoney(min)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {(others.length > 0 || noPaper) && (
                    <ul className="mt-2 space-y-0.5">
                      {noPaper && (
                        <li className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
                          <span>Papel sem custo: escolha o papel do cadastro ou digite o custo da folha (o lucro está aparecendo maior do que é).</span>
                        </li>
                      )}
                      {others.map((p, i) => (
                        <li key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 mt-px shrink-0" />
                          <span>Faixa {tierLabel(list[p.index])}: {p.message}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {steps.length > 0 && (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <p className="mt-1 text-xs text-muted-foreground cursor-help inline-flex items-center gap-1">
                          <Info className="h-3.5 w-3.5" /> Degrau em {steps.map((p) => list[p.index].min_qty).join(", ")} un
                        </p>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-96 text-xs space-y-1">
                        {steps.map((p, i) => <p key={i}>{p.message}</p>)}
                      </HoverCardContent>
                    </HoverCard>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </main>
      </div>

      {itemDialog && (
        <ItemDialog
          state={itemDialog}
          onChange={setItemDialog}
          onSave={saveItem}
          categories={categories}
          equipments={equipments}
          papers={papers}
          ctx={ctx}
          settings={settings}
        />
      )}

      {catDialog && (
        <Dialog open onOpenChange={(o) => !o && setCatDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{catDialog.cat.id ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={catDialog.cat.name || ""} onChange={(e) => setCatDialog({ ...catDialog, cat: { ...catDialog.cat, name: e.target.value } })} />
              </div>
              <div>
                <Label>Grupo</Label>
                <Input list="price-groups" value={catDialog.cat.group_name || ""} onChange={(e) => setCatDialog({ ...catDialog, cat: { ...catDialog.cat, group_name: e.target.value } })} />
                <datalist id="price-groups">{groups.map((g) => <option key={g.name} value={g.name} />)}</datalist>
              </div>
              <p className="text-sm text-muted-foreground">Padrões para itens novos desta categoria:</p>
              <CalcFields
                value={catDialog.cat}
                onChange={(v) => setCatDialog({ ...catDialog, cat: { ...catDialog.cat, ...v } })}
                equipments={equipments}
              />
              <div>
                <Label>Faixas padrão</Label>
                <Input value={catDialog.ranges} onChange={(e) => setCatDialog({ ...catDialog, ranges: e.target.value })} placeholder="1-20, 21-100, 101-300, 301+" />
                <p className="text-xs text-muted-foreground mt-1">Separe por vírgula. "301+" = acima de 300.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCatDialog(null)}>Cancelar</Button>
              <Button onClick={saveCategory}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title}
        description={confirm?.description}
        onConfirm={() => { confirm?.action(); setConfirm(null); }}
      />
    </div>
  );
}

// ─── Campos de cálculo (tipo, máquina, cor) — usados na categoria e no item ─
function CalcFields({
  value,
  onChange,
  equipments,
}: {
  value: { calc_type?: CalcType; equipment_id?: string | null; color_mode?: ColorMode | null };
  onChange: (v: { calc_type?: CalcType; equipment_id?: string | null; color_mode?: ColorMode | null }) => void;
  equipments: { id: string; name: string }[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div>
        <Label>Como calcula o custo</Label>
        <Select value={value.calc_type || "manual"} onValueChange={(v) => onChange({ calc_type: v as CalcType })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="impressao">Impressão (papel + máquina)</SelectItem>
            <SelectItem value="manual">Material + tempo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.calc_type === "impressao" && (
        <>
          <div>
            <Label>Máquina</Label>
            <Select value={value.equipment_id || NONE} onValueChange={(v) => onChange({ equipment_id: v === NONE ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {equipments.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cor</Label>
            <Select value={value.color_mode || "color"} onValueChange={(v) => onChange({ color_mode: v as ColorMode })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="color">Colorida</SelectItem>
                <SelectItem value="pb">Preto e branco</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Janela do item ──────────────────────────────────────────────────
function ItemDialog({
  state,
  onChange,
  onSave,
  categories,
  equipments,
  papers,
  ctx,
  settings,
}: {
  state: { item: Partial<Item>; tiers: DraftTier[] };
  onChange: (s: { item: Partial<Item>; tiers: DraftTier[] } | null) => void;
  onSave: () => void;
  categories: Category[];
  equipments: (EquipmentInput & { name: string })[];
  papers: Paper[];
  ctx: Parameters<typeof unitCost>[1];
  settings: PriceSettings;
}) {
  const { item, tiers } = state;
  const set = (v: Partial<Item>) => onChange({ item: { ...item, ...v }, tiers });
  const setTier = (i: number, v: Partial<Tier>) => onChange({ item, tiers: tiers.map((t, k) => (k === i ? { ...t, ...v } : t)) });
  const cost = unitCost(
    {
      calc_type: item.calc_type || "manual",
      equipment_id: item.equipment_id || null,
      color_mode: item.color_mode || null,
      sheet_size: item.sheet_size || "A4",
      sides: item.sides || 1,
      paper_id: item.paper_id || null,
      material_cost: Number(item.material_cost) || 0,
      extra_cost: Number(item.extra_cost) || 0,
      minutes_per_unit: Number(item.minutes_per_unit) || 0,
    },
    ctx,
  );
  const numField = (key: "material_cost" | "extra_cost" | "minutes_per_unit") => ({
    inputMode: "decimal" as const,
    defaultValue: String(item[key] ?? 0).replace(".", ","),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set({ [key]: parseDecimal(e.target.value) || 0 }),
  });
  const addTier = () => {
    const last = tiers[tiers.length - 1];
    const start = last ? (last.max_qty ? Number(last.max_qty) + 1 : Number(last.min_qty || 1) + 1) : 1;
    onChange({ item, tiers: [...tiers, { _key: newKey(), min_qty: start, max_qty: null, price: 0, tiny_sku: null }] });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onChange(null)}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item.id ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
        <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label>Nome (igual ao Tiny, sem a faixa)</Label>
              <Input value={item.name || ""} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Impressão Color Laser A4 Couchê 120g" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={item.category_id} onValueChange={(v) => set({ category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.group_name} · {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <CalcFields value={item} onChange={(v) => set(v)} equipments={equipments} />

          {item.calc_type === "impressao" ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label>Tamanho</Label>
                <Select value={item.sheet_size || "A4"} onValueChange={(v) => set({ sheet_size: v as SheetSize })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="A4">A4</SelectItem><SelectItem value="A3">A3</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <Label>Lados</Label>
                <Select value={String(item.sides || 1)} onValueChange={(v) => set({ sides: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1">Só frente</SelectItem><SelectItem value="2">Frente e verso</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Papel do cadastro</Label>
                <Select value={item.paper_id || NONE} onValueChange={(v) => set({ paper_id: v === NONE ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>— digitar o custo da folha —</SelectItem>
                    {papers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} {p.grammage || ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {!item.paper_id && (
                <div>
                  <Label>Custo da folha (R$)</Label>
                  <Input {...numField("material_cost")} />
                </div>
              )}
              <div>
                <Label>Extra por folha (R$)</Label>
                <Input {...numField("extra_cost")} />
              </div>
              <div>
                <Label>Minutos por folha</Label>
                <Input {...numField("minutes_per_unit")} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <Label>Material por unidade (R$)</Label>
                <Input {...numField("material_cost")} />
              </div>
              <div>
                <Label>Extra por unidade (R$)</Label>
                <Input {...numField("extra_cost")} />
              </div>
              <div>
                <Label>Minutos por unidade</Label>
                <Input {...numField("minutes_per_unit")} />
              </div>
            </div>
          )}

          <p className="text-sm">
            Custo por unidade: <strong>{cost.missing ? "falta informar" : fmtMoney(cost.total)}</strong>
            {!cost.missing && item.calc_type === "impressao" && (
              <span className="text-muted-foreground"> (papel {fmtMoney(cost.paper)} + máquina {fmtMoney(cost.machine)}{cost.extra ? ` + extra ${fmtMoney(cost.extra)}` : ""}{cost.labor ? ` + tempo ${fmtMoney(cost.labor)}` : ""})</span>
            )}
          </p>

          <div>
            <Label>Faixas e preços</Label>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8">De</TableHead>
                    <TableHead className="h-8">Até (vazio = acima)</TableHead>
                    <TableHead className="h-8">Preço/un</TableHead>
                    <TableHead className="h-8">SKU Tiny</TableHead>
                    <TableHead className="h-8 text-right">Lucro real</TableHead>
                    <TableHead className="h-8 text-right">Preço mínimo</TableHead>
                    <TableHead className="h-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((t, i) => {
                    const minQ = Number(t.min_qty) || 1;
                    const profit = cost.missing ? null : realProfitPct(Number(t.price) || 0, minQ, cost.total, settings);
                    const min = cost.missing ? null : minUnitPrice(minQ, cost.total, settings);
                    return (
                      <TableRow key={t._key}>
                        <TableCell className="py-1"><Input className="h-8 w-20" inputMode="numeric" value={t.min_qty ?? ""} onChange={(e) => setTier(i, { min_qty: parseNum(e.target.value) || 1 })} /></TableCell>
                        <TableCell className="py-1"><Input className="h-8 w-24" inputMode="numeric" value={t.max_qty ?? ""} onChange={(e) => setTier(i, { max_qty: e.target.value.trim() === "" ? null : parseNum(e.target.value) || null })} /></TableCell>
                        <TableCell className="py-1"><Input className="h-8 w-24" inputMode="decimal" defaultValue={String(t.price ?? 0).replace(".", ",")} onChange={(e) => setTier(i, { price: parseDecimal(e.target.value) || 0 })} /></TableCell>
                        <TableCell className="py-1"><Input className="h-8 w-28" value={t.tiny_sku ?? ""} onChange={(e) => setTier(i, { tiny_sku: e.target.value })} /></TableCell>
                        <TableCell className={`py-1 text-right font-medium ${profitClass(profit, settings.targetPct)}`}>{pct(profit)}</TableCell>
                        <TableCell className="py-1 text-right text-muted-foreground">{min === null ? "—" : fmtMoney(min)}</TableCell>
                        <TableCell className="py-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange({ item, tiers: tiers.filter((_, k) => k !== i) })} aria-label="Remover faixa"><X className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Button variant="outline" size="sm" className="mt-2" onClick={addTier}><Plus className="h-4 w-4 mr-1" /> Faixa</Button>
          </div>

          <div>
            <Label>Observação</Label>
            <Textarea rows={2} value={item.notes || ""} onChange={(e) => set({ notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onChange(null)}>Cancelar</Button>
          <Button onClick={onSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
