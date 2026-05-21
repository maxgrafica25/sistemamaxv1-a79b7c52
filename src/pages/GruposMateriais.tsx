import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Loader2, Package, Layers, Link2, Link2Off, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import SupplySearch from "@/components/orcamentos-v2/SupplySearch";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { AdminOnly } from "@/components/AdminOnly";
import { FinancialSummary } from "@/components/shared/FinancialSummary";
import { calcKitPrice, suggestConsumoTipo, KitConsumoTipo, KitPricingMode } from "@/lib/kitPricing";
import { useHourRate } from "@/hooks/useHourRate";
import { useGlobalSettings } from "@/hooks/useGlobalSettings";
import PageLoader from "@/components/PageLoader";

interface MaterialItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  sort_order: number;
  supply_id: string | null;
  consumo_tipo: KitConsumoTipo;
  live_unit_price?: number | null;
}

interface MaterialGroup {
  id: string;
  name: string;
  is_kit: boolean;
  modulo: string[];
  pricing_mode: KitPricingMode;
  labor_minutes: number;
  labor_hour_rate_source: "despesas_fixas" | "manual";
  labor_hour_rate_manual: number;
  margin_pct: number | null;
  notes: string | null;
  items: MaterialItem[];
}

interface DraftItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  supply_id: string | null;
  consumo_tipo: KitConsumoTipo;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CONSUMO_LABELS: Record<KitConsumoTipo, string> = {
  fixo: "Fixo (por peça)",
  por_m2: "Por m²",
  por_perimetro_m: "Por metro de perímetro",
  por_unidade: "Por unidade da peça",
};

export default function GruposMateriais() {
  const [groups, setGroups] = useState<MaterialGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialGroup | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { requireAdmin } = usePermissionGuard();
  const { hourRate } = useHourRate();
  const { settings } = useGlobalSettings();

  // Form state
  const [name, setName] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [isKit, setIsKit] = useState(false);
  const [moduloGrafica, setModuloGrafica] = useState(true);
  const [moduloCv, setModuloCv] = useState(false);
  const [pricingMode, setPricingMode] = useState<KitPricingMode>("fixo");
  const [laborMinutes, setLaborMinutes] = useState(0);
  const [laborSource, setLaborSource] = useState<"despesas_fixas" | "manual">("despesas_fixas");
  const [laborManual, setLaborManual] = useState(0);
  const [marginPct, setMarginPct] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Preview inputs
  const [previewW, setPreviewW] = useState(100);
  const [previewH, setPreviewH] = useState(100);
  const [previewQ, setPreviewQ] = useState(1);

  const fetchGroups = async () => {
    setLoading(true);
    const [gRes, iRes, sRes] = await Promise.all([
      supabase.from("material_groups").select("*").order("created_at"),
      supabase.from("material_group_items").select("*").order("sort_order"),
      supabase.from("supplies").select("id, valor_unitario"),
    ]);
    if (gRes.data && iRes.data) {
      const supplyMap = new Map<string, number>(
        (sRes.data || []).map((s: any) => [s.id, Number(s.valor_unitario) || 0]),
      );
      setGroups(
        gRes.data.map((g: any) => ({
          id: g.id,
          name: g.name,
          is_kit: !!g.is_kit,
          modulo: Array.isArray(g.modulo) ? g.modulo : ["grafica"],
          pricing_mode: (g.pricing_mode || "fixo") as KitPricingMode,
          labor_minutes: Number(g.labor_minutes || 0),
          labor_hour_rate_source: g.labor_hour_rate_source || "despesas_fixas",
          labor_hour_rate_manual: Number(g.labor_hour_rate_manual || 0),
          margin_pct: g.margin_pct != null ? Number(g.margin_pct) : null,
          notes: g.notes,
          items: iRes.data
            .filter((i: any) => i.material_group_id === g.id)
            .map((i: any) => ({
              ...i,
              supply_id: i.supply_id ?? null,
              consumo_tipo: (i.consumo_tipo || "fixo") as KitConsumoTipo,
              live_unit_price: i.supply_id ? supplyMap.get(i.supply_id) ?? null : null,
            })),
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const blankItem = (): DraftItem => ({
    id: `${Date.now()}-${Math.random()}`,
    description: "",
    quantity: 1,
    unit_price: 0,
    supply_id: null,
    consumo_tipo: "fixo",
  });

  const resetForm = () => {
    setName("");
    setItems([blankItem()]);
    setIsKit(false);
    setModuloGrafica(true);
    setModuloCv(false);
    setPricingMode("fixo");
    setLaborMinutes(0);
    setLaborSource("despesas_fixas");
    setLaborManual(0);
    setMarginPct("");
    setNotes("");
    setPreviewW(100); setPreviewH(100); setPreviewQ(1);
  };

  const openNew = () => {
    setEditing(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (g: MaterialGroup) => {
    setEditing(g);
    setName(g.name);
    setItems(g.items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unit_price: i.supply_id && i.live_unit_price != null ? i.live_unit_price : i.unit_price,
      supply_id: i.supply_id ?? null,
      consumo_tipo: i.consumo_tipo,
    })));
    setIsKit(g.is_kit);
    setModuloGrafica(g.modulo.includes("grafica"));
    setModuloCv(g.modulo.includes("cv"));
    setPricingMode(g.pricing_mode);
    setLaborMinutes(g.labor_minutes);
    setLaborSource(g.labor_hour_rate_source);
    setLaborManual(g.labor_hour_rate_manual);
    setMarginPct(g.margin_pct != null ? String(g.margin_pct) : "");
    setNotes(g.notes || "");
    setIsDialogOpen(true);
  };

  const addItem = () => setItems((prev) => [...prev, blankItem()]);
  const updateItem = (id: string, patch: Partial<DraftItem>) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));

  const effectiveHourRate = laborSource === "manual" ? laborManual : hourRate;

  const previewResult = useMemo(() => {
    return calcKitPrice(
      {
        pricing_mode: pricingMode,
        labor_minutes: laborMinutes,
        margin_pct: marginPct === "" ? null : Number(marginPct),
        items: items.map(i => ({
          id: i.id, description: i.description,
          quantity: i.quantity, unit_price: i.unit_price,
          consumo_tipo: i.consumo_tipo,
        })),
      },
      { largura_cm: previewW, altura_cm: previewH, quantidade: previewQ },
      { hourRate: effectiveHourRate, ...settings },
    );
  }, [items, pricingMode, laborMinutes, marginPct, previewW, previewH, previewQ, effectiveHourRate, settings]);

  const save = async () => {
    if (!name.trim()) { toast.error("Digite um nome para o grupo"); return; }
    if (items.length === 0 || items.some((i) => !i.description.trim())) {
      toast.error("Adicione ao menos um item válido"); return;
    }
    if (isKit && !moduloGrafica && !moduloCv) { toast.error("Selecione ao menos um módulo"); return; }
    if (!requireAdmin(editing ? "atualizar grupo de materiais" : "criar grupo de materiais")) return;

    const modulo: string[] = [];
    if (moduloGrafica || !isKit) modulo.push("grafica");
    if (moduloCv) modulo.push("cv");

    const groupPayload: any = {
      name,
      is_kit: isKit,
      modulo: isKit ? modulo : ["grafica"],
      pricing_mode: pricingMode,
      labor_minutes: laborMinutes,
      labor_hour_rate_source: laborSource,
      labor_hour_rate_manual: laborManual,
      margin_pct: marginPct === "" ? null : Number(marginPct),
      notes: notes || null,
    };

    const itemsPayload = (groupId: string) =>
      items.map((i, idx) => ({
        material_group_id: groupId,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        supply_id: i.supply_id,
        sort_order: idx,
        consumo_tipo: i.consumo_tipo,
      }));

    if (editing) {
      const { error: updErr } = await supabase.from("material_groups").update(groupPayload).eq("id", editing.id);
      if (updErr) return handleError(updErr, "atualizar grupo de materiais");
      const { error: delErr } = await supabase.from("material_group_items").delete().eq("material_group_id", editing.id);
      if (delErr) return handleError(delErr, "atualizar itens do grupo");
      const { error: insErr } = await supabase.from("material_group_items").insert(itemsPayload(editing.id));
      if (insErr) return handleError(insErr, "atualizar itens do grupo");
      toast.success("Grupo atualizado!");
    } else {
      const { data, error } = await supabase.from("material_groups").insert(groupPayload).select("id").single();
      if (error) return handleError(error, "criar grupo de materiais");
      if (data) {
        const { error: insErr } = await supabase.from("material_group_items").insert(itemsPayload(data.id));
        if (insErr) return handleError(insErr, "salvar itens do grupo");
      }
      toast.success("Grupo criado!");
    }
    setIsDialogOpen(false);
    fetchGroups();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    if (!requireAdmin("excluir grupo de materiais")) return;
    const { error } = await supabase.from("material_groups").delete().eq("id", deletingId);
    if (error) { setDeletingId(null); return handleError(error, "excluir grupo de materiais"); }
    toast.success("Grupo excluído!");
    setDeletingId(null);
    fetchGroups();
  };

  const groupTotal = (its: MaterialItem[]) =>
    its.reduce((s, i) => {
      const price = i.supply_id && i.live_unit_price != null ? i.live_unit_price : i.unit_price;
      return s + i.quantity * price;
    }, 0);

  if (loading) { return <PageLoader />; }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          Grupos de Materiais
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Templates reutilizáveis. Ative "Kit calculável" para banners, faixas e outros produtos que envolvem insumos + mão de obra + cobrança por dimensão.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{groups.length} grupo(s) cadastrado(s)</p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <span>
              <AdminOnly mode="disable" action="criar grupo de materiais">
                <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Grupo</Button>
              </AdminOnly>
            </span>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Grupo de Materiais" : "Novo Grupo de Materiais"}</DialogTitle>
            </DialogHeader>
            <div className={`grid gap-6 pt-4 ${isKit ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1"}`}>
              {/* CONFIG */}
              <div className={`space-y-5 ${isKit ? "lg:col-span-2" : ""}`}>
                <div className="space-y-2">
                  <Label>Nome do Grupo *</Label>
                  <Input placeholder="Ex: Banner Bastão Topo" value={name} onChange={(e) => setName(e.target.value)} />
                </div>

                {/* KIT TOGGLE */}
                <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                  <Switch checked={isKit} onCheckedChange={setIsKit} id="is-kit" />
                  <div className="flex-1">
                    <Label htmlFor="is-kit" className="cursor-pointer flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" /> Kit calculável
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Calcula preço por dimensão (banner, faixa, etc.) somando material + mão de obra + margem.
                    </p>
                  </div>
                </div>

                {isKit && (
                  <div className="space-y-4 p-4 rounded-lg border border-primary/30 bg-primary/5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Modo de cobrança</Label>
                        <Select value={pricingMode} onValueChange={(v) => setPricingMode(v as KitPricingMode)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixo">Fixo (por peça)</SelectItem>
                            <SelectItem value="mt2">Por m²</SelectItem>
                            <SelectItem value="perimetro">Por perímetro</SelectItem>
                            <SelectItem value="unidade">Por unidade</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tempo de M.O. (min)</Label>
                        <Input type="number" value={laborMinutes || ""} onChange={(e) => setLaborMinutes(parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Origem do custo/hora</Label>
                        <Select value={laborSource} onValueChange={(v) => setLaborSource(v as any)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="despesas_fixas">Despesas Fixas ({formatBRL(hourRate)}/h)</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {laborSource === "manual" && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Custo/hora (R$)</Label>
                          <Input type="number" step="0.01" value={laborManual || ""} onChange={(e) => setLaborManual(parseFloat(e.target.value) || 0)} />
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Margem específica (%) <span className="text-muted-foreground">opcional</span></Label>
                        <Input type="number" step="0.1" placeholder={`Global: ${settings.default_margin_pct}%`} value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Visível em</Label>
                      <div className="flex gap-4 mt-1.5">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={moduloGrafica} onCheckedChange={(v) => setModuloGrafica(!!v)} /> Gráfica
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={moduloCv} onCheckedChange={(v) => setModuloCv(!!v)} /> Comunicação Visual
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <Separator />

                {/* ITEMS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Itens {isKit ? "(insumos do kit)" : "*"}</Label>
                    <Button variant="outline" size="sm" onClick={addItem} className="gap-2"><Plus className="h-4 w-4" /> Item</Button>
                  </div>
                  {items.map((it, idx) => {
                    const linked = !!it.supply_id;
                    return (
                      <div key={it.id} className="rounded-lg border p-3 space-y-2 bg-muted/20">
                        <div className="flex gap-2 items-center">
                          <span className="flex h-9 w-7 items-center justify-center text-xs font-medium text-muted-foreground">{idx + 1}</span>
                          {linked ? (
                            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md border bg-background">
                              <Link2 className="h-4 w-4 text-primary shrink-0" />
                              <span className="flex-1 truncate text-sm font-medium">{it.description}</span>
                              <Badge variant="secondary" className="text-xs">vinculado</Badge>
                            </div>
                          ) : (
                            <SupplySearch
                              initialLabel={it.description}
                              onSelect={(s) => {
                                const suggested = isKit ? suggestConsumoTipo(s.produto) : "fixo";
                                updateItem(it.id, {
                                  supply_id: s.id,
                                  description: s.produto,
                                  unit_price: Number(s.valor_unitario) || 0,
                                  consumo_tipo: suggested,
                                });
                                if (isKit && suggested !== "fixo") {
                                  toast.success(`Escala sugerida: ${CONSUMO_LABELS[suggested]}`, { duration: 2500 });
                                }
                              }}
                            />
                          )}
                          <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex gap-2 items-end pl-9 flex-wrap">
                          <div className="flex flex-col gap-0.5">
                            <Label className="text-[10px] text-muted-foreground uppercase">Qtd</Label>
                            <Input type="number" value={it.quantity || ""} onChange={(e) => updateItem(it.id, { quantity: parseFloat(e.target.value) || 0 })} className="w-20 h-8" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <Label className="text-[10px] text-muted-foreground uppercase">Preço un.</Label>
                            <Input type="number" step="0.01" value={it.unit_price || ""} onChange={(e) => updateItem(it.id, { unit_price: parseFloat(e.target.value) || 0 })} className="w-32 h-8" disabled={linked} title={linked ? "Vem de Suprimentos" : ""} />
                          </div>
                          {isKit && (
                            <div className="flex flex-col gap-0.5">
                              <Label className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
                                Escala
                                {linked && <Sparkles className="h-2.5 w-2.5 text-primary" />}
                              </Label>
                              <Select value={it.consumo_tipo} onValueChange={(v) => updateItem(it.id, { consumo_tipo: v as KitConsumoTipo })}>
                                <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {(Object.keys(CONSUMO_LABELS) as KitConsumoTipo[]).map(k => (
                                    <SelectItem key={k} value={k} className="text-xs">{CONSUMO_LABELS[k]}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                          <div className="flex flex-col gap-0.5 ml-auto">
                            <Label className="text-[10px] text-muted-foreground uppercase">Subtotal base</Label>
                            <div className="h-8 flex items-center px-2 text-sm font-medium tabular-nums">
                              {formatBRL((it.quantity || 0) * (it.unit_price || 0))}
                            </div>
                          </div>
                          {linked && (
                            <Button variant="ghost" size="sm" onClick={() => updateItem(it.id, { supply_id: null })} className="gap-1 text-xs text-muted-foreground" title="Desvincular">
                              <Link2Off className="h-3.5 w-3.5" /> Desvincular
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">Cancelar</Button>
                  <Button onClick={save} className="flex-1">{editing ? "Atualizar Grupo" : "Criar Grupo"}</Button>
                </div>
              </div>

              {/* PREVIEW SIDEBAR (kit only) */}
              {isKit && (
                <div className="space-y-3">
                  <Card className="shadow-card">
                    <CardContent className="p-4 space-y-3">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Simulação</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[10px]">Larg (cm)</Label>
                          <Input type="number" value={previewW} onChange={(e) => setPreviewW(parseFloat(e.target.value) || 0)} className="h-8" />
                        </div>
                        <div>
                          <Label className="text-[10px]">Alt (cm)</Label>
                          <Input type="number" value={previewH} onChange={(e) => setPreviewH(parseFloat(e.target.value) || 0)} className="h-8" />
                        </div>
                        <div>
                          <Label className="text-[10px]">Qtd</Label>
                          <Input type="number" value={previewQ} onChange={(e) => setPreviewQ(parseInt(e.target.value) || 1)} className="h-8" />
                        </div>
                      </div>
                      {previewResult.breakdown.length > 0 && (
                        <div className="border-t pt-2">
                          <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Insumos</div>
                          <div className="space-y-0.5 text-[11px]">
                            {previewResult.breakdown.map((b, i) => (
                              <div key={i} className="flex justify-between">
                                <span className="truncate mr-2">{b.description || "—"}</span>
                                <span className="tabular-nums text-muted-foreground">
                                  {b.qty_effective.toFixed(2)} × {formatBRL(b.unit_price)} = <span className="text-foreground">{formatBRL(b.subtotal)}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <FinancialSummary
                    lines={[
                      { label: "Custo material", value: previewResult.custoMaterial, type: "cost" },
                      { label: "Custo mão de obra", value: previewResult.custoMO, type: "cost", sub: `${laborMinutes} min × ${formatBRL(effectiveHourRate)}/h × ${previewQ}` },
                      { label: "Perda", value: previewResult.perda, type: "cost" },
                      { label: "Subtotal custo", value: previewResult.custoTotal, bold: true, divider: true },
                      { label: "Impostos", value: previewResult.impostos, type: "cost" },
                      { label: "Taxas", value: previewResult.taxas, type: "cost" },
                      { label: "Margem", value: previewResult.margem, type: "profit" },
                    ]}
                    totalLabel="Preço de venda"
                    totalValue={previewResult.precoVenda}
                    profitValue={previewResult.lucroLiquido}
                    profitPct={previewResult.lucroPct}
                  />
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">Nenhum grupo de materiais cadastrado ainda</p>
            <Button onClick={openNew} className="mt-4 gap-2"><Plus className="h-4 w-4" /> Criar primeiro grupo</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Card key={g.id}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    {g.name}
                    {g.is_kit && <Badge className="bg-primary/15 text-primary border-primary/30 gap-1"><Wrench className="h-3 w-3" /> Kit</Badge>}
                    {g.modulo.map(m => (
                      <Badge key={m} variant="outline" className="text-[10px] uppercase">{m === "cv" ? "CV" : "Gráfica"}</Badge>
                    ))}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {g.items.length} item(ns) · Total base: {formatBRL(groupTotal(g.items))}
                    {g.is_kit && g.labor_minutes > 0 && ` · M.O. ${g.labor_minutes} min`}
                  </p>
                </div>
                <div className="flex gap-1">
                  <AdminOnly mode="disable" action="editar grupo">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(g)} className="h-8 w-8 hover:bg-primary/10 hover:text-primary"><Edit2 className="h-4 w-4" /></Button>
                  </AdminOnly>
                  <AdminOnly mode="disable" action="excluir grupo">
                    <Button variant="ghost" size="icon" onClick={() => setDeletingId(g.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </AdminOnly>
                </div>
              </div>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>Descrição</TableHead>
                      {g.is_kit && <TableHead className="w-44">Escala</TableHead>}
                      <TableHead className="w-24 text-center">Qtd</TableHead>
                      <TableHead className="w-32 text-right">Preço un.</TableHead>
                      <TableHead className="w-32 text-right pr-6">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {g.items.map((it, idx) => {
                      const livePrice = it.supply_id && it.live_unit_price != null ? it.live_unit_price : it.unit_price;
                      return (
                        <TableRow key={it.id}>
                          <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {it.supply_id && <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                              <span>{it.description}</span>
                            </div>
                          </TableCell>
                          {g.is_kit && <TableCell className="text-xs text-muted-foreground">{CONSUMO_LABELS[it.consumo_tipo]}</TableCell>}
                          <TableCell className="text-center">{it.quantity}</TableCell>
                          <TableCell className="text-right">{formatBRL(livePrice)}</TableCell>
                          <TableCell className="text-right pr-6 font-medium">{formatBRL(it.quantity * livePrice)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Excluir Grupo"
        description="Tem certeza que deseja excluir este grupo de materiais?"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
