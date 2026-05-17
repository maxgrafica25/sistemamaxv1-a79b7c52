import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Search, Loader2, Package, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import { useHourRate } from "@/hooks/useHourRate";

const TIPOS_MIDIA = [
  { value: "lona", label: "Lona" },
  { value: "adesivo", label: "Adesivo" },
  { value: "chapa", label: "Chapa" },
  { value: "outro", label: "Outro" },
];

const FAMILIAS = [
  { value: "banner_bastao", label: "Banner com bastão" },
  { value: "faixa", label: "Faixa" },
  { value: "bainha_ilhos", label: "Bainha + Ilhós" },
  { value: "ilhos", label: "Ilhós" },
  { value: "emenda", label: "Emenda" },
  { value: "laminacao", label: "Laminação" },
  { value: "recorte", label: "Recorte" },
  { value: "refile", label: "Refile" },
  { value: "outro", label: "Outro" },
];

const CONSUMO_TIPOS = [
  { value: "por_peca", label: "por peça" },
  { value: "por_perimetro_m", label: "por m de perímetro" },
  { value: "por_mt2", label: "por m²" },
  { value: "por_largura_m", label: "por m de largura" },
  { value: "por_altura_m", label: "por m de altura" },
];

const CONSUMO_TIPOS_LABOR = [
  { value: "fixo", label: "fixo (setup, 1×)" },
  ...CONSUMO_TIPOS,
];

interface Row {
  id: string;
  nome: string;
  familia: string;
  tipos_midia_compativeis: string[];
  custo_fixo: number;
  lucro_fixo: number;
  custo_mt2: number;
  lucro_mt2: number;
  custo_perimetro: number;
  lucro_perimetro: number;
  custo_unidade: number;
  lucro_unidade: number;
  largura_max_cm: number | null;
  ativo: boolean;
  sort_order: number;
  pricing_mode: "manual" | "recipe";
  markup_override_pct: number | null;
  extra_cost_fixo: number;
  extra_cost_mt2: number;
  extra_cost_perimetro: number;
  extra_cost_unidade: number;
}

interface RecipeRow {
  id?: string; // existing DB id (undefined = new)
  supply_id: string;
  consumo_qty: number;
  consumo_tipo: "por_peca" | "por_perimetro_m" | "por_mt2" | "por_largura_m" | "por_altura_m";
  sort_order: number;
}

interface LaborRow {
  id?: string;
  production_step_id: string | null;
  descricao: string;
  time_minutes: number;
  consumo_tipo: "fixo" | "por_peca" | "por_perimetro_m" | "por_mt2" | "por_largura_m" | "por_altura_m";
  consumo_qty: number;
  sort_order: number;
}

interface ProductionStep {
  id: string;
  description: string;
  time_minutes: number;
}

interface Supply {
  id: string;
  produto: string;
  valor_unitario: number;
  unidade: string;
}

const empty: Omit<Row, "id"> = {
  nome: "", familia: "outro", tipos_midia_compativeis: [],
  custo_fixo: 0, lucro_fixo: 0,
  custo_mt2: 0, lucro_mt2: 0,
  custo_perimetro: 0, lucro_perimetro: 0,
  custo_unidade: 0, lucro_unidade: 0,
  largura_max_cm: null, ativo: true, sort_order: 0,
  pricing_mode: "manual",
  markup_override_pct: null,
  extra_cost_fixo: 0, extra_cost_mt2: 0, extra_cost_perimetro: 0, extra_cost_unidade: 0,
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AcabamentosTab() {
  const { requireAdmin } = usePermissionGuard();
  const [rows, setRows] = useState<Row[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [globalMarkupPct, setGlobalMarkupPct] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Omit<Row, "id">>(empty);
  const [recipe, setRecipe] = useState<RecipeRow[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delCtx, setDelCtx] = useState<{ id: string; name: string } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [rs, sp, gs] = await Promise.all([
      supabase.from("cv_calc_acabamentos").select("*").order("familia").order("sort_order").order("nome"),
      supabase.from("supplies").select("id, produto, valor_unitario, unidade").contains("modulo", ["cv"]).order("produto"),
      supabase.from("global_settings" as never).select("tax_pct, invoice_pct, credit_card_pct, collection_fee_pct, default_margin_pct").maybeSingle(),
    ]);
    if (rs.error) handleError(rs.error, "carregar acabamentos");
    else setRows((rs.data as Row[]) ?? []);
    setSupplies((sp.data as Supply[]) ?? []);
    const g = (gs as { data: Record<string, number> | null }).data;
    if (g) {
      setGlobalMarkupPct(
        Number(g.tax_pct ?? 0) + Number(g.invoice_pct ?? 0) +
        Number(g.credit_card_pct ?? 0) + Number(g.collection_fee_pct ?? 0) +
        Number(g.default_margin_pct ?? 0)
      );
    }
    setLoading(false);
  };
  useEffect(() => { fetchAll(); }, []);

  const loadRecipe = async (acabamentoId: string) => {
    const { data } = await supabase
      .from("cv_calc_acabamento_recipe_items" as never)
      .select("id, supply_id, consumo_qty, consumo_tipo, sort_order")
      .eq("acabamento_id", acabamentoId)
      .order("sort_order");
    setRecipe(((data as RecipeRow[]) ?? []).map((r) => ({ ...r, consumo_qty: Number(r.consumo_qty) })));
  };

  const openNew = () => { setEditing(null); setForm(empty); setRecipe([]); setOpen(true); };
  const openEdit = async (r: Row) => {
    setEditing(r);
    setForm({ ...r });
    setRecipe([]);
    setOpen(true);
    await loadRecipe(r.id);
  };

  const toggleTipo = (v: string) =>
    setForm((f) => ({
      ...f,
      tipos_midia_compativeis: f.tipos_midia_compativeis.includes(v)
        ? f.tipos_midia_compativeis.filter((x) => x !== v)
        : [...f.tipos_midia_compativeis, v],
    }));

  const addRecipeRow = () => setRecipe((r) => [...r, {
    supply_id: supplies[0]?.id ?? "",
    consumo_qty: 1,
    consumo_tipo: "por_peca",
    sort_order: r.length,
  }]);
  const patchRecipeRow = (idx: number, patch: Partial<RecipeRow>) =>
    setRecipe((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const removeRecipeRow = (idx: number) =>
    setRecipe((r) => r.filter((_, i) => i !== idx));

  // Custo "por peça" da receita — útil pra preview
  const custoReceitaPorPeca = useMemo(() => {
    return recipe.reduce((s, r) => {
      const sup = supplies.find((x) => x.id === r.supply_id);
      const custoUn = sup?.valor_unitario ?? 0;
      // assume 1m² / 1m perím / 1m largura / 1m altura na "peça base" para o preview
      return s + custoUn * (r.consumo_qty || 0);
    }, 0);
  }, [recipe, supplies]);

  const usedMarkupPct = form.markup_override_pct ?? globalMarkupPct;
  const previewPrecoPorPeca = useMemo(() => {
    const totalCusto = custoReceitaPorPeca + (form.extra_cost_fixo || 0);
    const divisor = Math.max(0.01, 1 - usedMarkupPct / 100);
    return totalCusto / divisor;
  }, [custoReceitaPorPeca, form.extra_cost_fixo, usedMarkupPct]);

  const save = async () => {
    if (!requireAdmin(editing ? "editar acabamento" : "criar acabamento")) return;
    if (!form.nome.trim()) return toast.error("Informe o nome");
    if (form.tipos_midia_compativeis.length === 0) return toast.error("Marque ao menos um tipo de mídia compatível");
    if (form.pricing_mode === "recipe" && recipe.length === 0 && form.extra_cost_fixo === 0
        && form.extra_cost_mt2 === 0 && form.extra_cost_perimetro === 0 && form.extra_cost_unidade === 0) {
      return toast.error("No modo Receita, adicione ao menos um suprimento ou custo extra");
    }

    const payload = { ...form, nome: form.nome.trim() };
    let acabamentoId: string | null = editing?.id ?? null;

    if (editing) {
      const { error } = await supabase.from("cv_calc_acabamentos").update(payload).eq("id", editing.id);
      if (error) return handleError(error, "atualizar acabamento");
    } else {
      const { data, error } = await supabase.from("cv_calc_acabamentos").insert(payload).select("id").single();
      if (error) return handleError(error, "criar acabamento");
      acabamentoId = (data as { id: string }).id;
    }

    // Sincroniza receita
    if (acabamentoId) {
      // delete tudo e re-inserir é mais simples e robusto
      await supabase.from("cv_calc_acabamento_recipe_items" as never)
        .delete().eq("acabamento_id", acabamentoId);
      if (form.pricing_mode === "recipe" && recipe.length > 0) {
        const valid = recipe.filter((r) => r.supply_id && r.consumo_qty > 0);
        if (valid.length > 0) {
          const { error: rErr } = await (supabase
            .from("cv_calc_acabamento_recipe_items" as never) as unknown as { insert: (rows: unknown[]) => Promise<{ error: unknown }> })
            .insert(valid.map((r, i) => ({
              acabamento_id: acabamentoId,
              supply_id: r.supply_id,
              consumo_qty: r.consumo_qty,
              consumo_tipo: r.consumo_tipo,
              sort_order: i,
            })));
          if (rErr) return handleError(rErr, "salvar receita");
        }
      }
    }

    toast.success(editing ? "Acabamento atualizado!" : "Acabamento criado!");
    setOpen(false);
    fetchAll();
  };

  const requestDelete = (r: Row) => { setDelCtx({ id: r.id, name: r.nome }); setConfirmOpen(true); };
  const confirmDelete = async () => {
    if (!delCtx) return;
    if (!requireAdmin("excluir acabamento")) { setConfirmOpen(false); setDelCtx(null); return; }
    const { error } = await supabase.from("cv_calc_acabamentos").delete().eq("id", delCtx.id);
    if (error) handleError(error, "excluir acabamento"); else toast.success("Excluído!");
    setConfirmOpen(false); setDelCtx(null); fetchAll();
  };

  const filtered = useMemo(
    () => rows.filter((r) => r.nome.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  );

  if (loading) return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar acabamento..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Novo Acabamento</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum acabamento cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Família</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead className="text-right">Fixo</TableHead>
                  <TableHead className="text-right">/m²</TableHead>
                  <TableHead className="text-right">/perím.</TableHead>
                  <TableHead className="text-right">/un.</TableHead>
                  <TableHead>Compatível</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className={!r.ativo ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{FAMILIAS.find(f => f.value === r.familia)?.label ?? r.familia}</Badge></TableCell>
                    <TableCell>
                      {r.pricing_mode === "recipe" ? (
                        <Badge className="bg-primary/15 text-primary gap-1 text-[10px]">
                          <Package className="h-3 w-3" /> Receita
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Manual</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{brl(r.custo_fixo + r.lucro_fixo)}</TableCell>
                    <TableCell className="text-right">{brl(r.custo_mt2 + r.lucro_mt2)}</TableCell>
                    <TableCell className="text-right">{brl(r.custo_perimetro + r.lucro_perimetro)}</TableCell>
                    <TableCell className="text-right">{brl(r.custo_unidade + r.lucro_unidade)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.tipos_midia_compativeis.map((c) => (
                          <Badge key={c} variant="secondary" className="text-[10px]">
                            {TIPOS_MIDIA.find((t) => t.value === c)?.label ?? c}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{r.ativo ? <Badge className="bg-emerald-500/15 text-emerald-700">Sim</Badge> : <Badge variant="secondary">Não</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDelete(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Acabamento" : "Novo Acabamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div>
                <Label>Família</Label>
                <Select value={form.familia} onValueChange={(v) => setForm({ ...form, familia: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FAMILIAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Modo de precificação */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Modo de precificação</Label>
                  <p className="text-xs text-muted-foreground">
                    {form.pricing_mode === "manual"
                      ? "Manual — digite custo + lucro de cada componente (como hoje)."
                      : "Receita — vincule suprimentos da base de matérias-primas. Custo atualiza sozinho."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${form.pricing_mode === "manual" ? "font-semibold" : "text-muted-foreground"}`}>Manual</span>
                  <Switch
                    checked={form.pricing_mode === "recipe"}
                    onCheckedChange={(v) => setForm({ ...form, pricing_mode: v ? "recipe" : "manual" })}
                  />
                  <span className={`text-xs ${form.pricing_mode === "recipe" ? "font-semibold text-primary" : "text-muted-foreground"}`}>Receita</span>
                </div>
              </div>
            </div>

            {form.pricing_mode === "manual" ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Preço = (custo + lucro) × dimensão correspondente. Use 0 nos componentes que não se aplicam.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Custo fixo (R$)</Label>
                    <Input type="number" step="0.01" value={form.custo_fixo} onChange={(e) => setForm({ ...form, custo_fixo: +e.target.value || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lucro fixo (R$)</Label>
                    <Input type="number" step="0.01" value={form.lucro_fixo} onChange={(e) => setForm({ ...form, lucro_fixo: +e.target.value || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Custo / m² (R$)</Label>
                    <Input type="number" step="0.01" value={form.custo_mt2} onChange={(e) => setForm({ ...form, custo_mt2: +e.target.value || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lucro / m² (R$)</Label>
                    <Input type="number" step="0.01" value={form.lucro_mt2} onChange={(e) => setForm({ ...form, lucro_mt2: +e.target.value || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Custo / m perím. (R$)</Label>
                    <Input type="number" step="0.01" value={form.custo_perimetro} onChange={(e) => setForm({ ...form, custo_perimetro: +e.target.value || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lucro / m perím. (R$)</Label>
                    <Input type="number" step="0.01" value={form.lucro_perimetro} onChange={(e) => setForm({ ...form, lucro_perimetro: +e.target.value || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Custo / unidade (R$)</Label>
                    <Input type="number" step="0.01" value={form.custo_unidade} onChange={(e) => setForm({ ...form, custo_unidade: +e.target.value || 0 })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lucro / unidade (R$)</Label>
                    <Input type="number" step="0.01" value={form.lucro_unidade} onChange={(e) => setForm({ ...form, lucro_unidade: +e.target.value || 0 })} />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {/* Receita */}
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm flex items-center gap-1.5"><Package className="h-4 w-4 text-primary" /> Suprimentos da receita</Label>
                    <Button size="sm" variant="outline" onClick={addRecipeRow}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                    </Button>
                  </div>
                  {recipe.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-3 text-center">
                      Nenhum suprimento na receita. Adicione bastão, ponteira, cordinha etc.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {recipe.map((r, idx) => {
                        const sup = supplies.find((s) => s.id === r.supply_id);
                        return (
                          <div key={idx} className="grid grid-cols-[1fr_90px_160px_auto] gap-2 items-end">
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Suprimento</Label>
                              <Select value={r.supply_id} onValueChange={(v) => patchRecipeRow(idx, { supply_id: v })}>
                                <SelectTrigger className="h-9"><SelectValue placeholder="Escolha…" /></SelectTrigger>
                                <SelectContent>
                                  {supplies.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.produto} — {brl(s.valor_unitario)}/{s.unidade}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Qtd</Label>
                              <Input type="number" step="0.01" className="h-9"
                                value={r.consumo_qty}
                                onChange={(e) => patchRecipeRow(idx, { consumo_qty: +e.target.value || 0 })} />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Consumo</Label>
                              <Select value={r.consumo_tipo} onValueChange={(v) => patchRecipeRow(idx, { consumo_tipo: v as RecipeRow["consumo_tipo"] })}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {CONSUMO_TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive"
                              onClick={() => removeRecipeRow(idx)}>
                              <X className="h-4 w-4" />
                            </Button>
                            {sup && (
                              <div className="col-span-4 -mt-1 text-[10px] text-muted-foreground">
                                = {brl((sup.valor_unitario || 0) * (r.consumo_qty || 0))} por peça (base)
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custos extras / mão-de-obra */}
                <div className="rounded-md border p-3 space-y-2">
                  <Label className="text-sm">Custos extras (mão-de-obra, insumos não cadastrados)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Custo extra fixo / peça (R$)</Label>
                      <Input type="number" step="0.01" value={form.extra_cost_fixo}
                        onChange={(e) => setForm({ ...form, extra_cost_fixo: +e.target.value || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Custo extra / m² (R$)</Label>
                      <Input type="number" step="0.01" value={form.extra_cost_mt2}
                        onChange={(e) => setForm({ ...form, extra_cost_mt2: +e.target.value || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Custo extra / m perím. (R$)</Label>
                      <Input type="number" step="0.01" value={form.extra_cost_perimetro}
                        onChange={(e) => setForm({ ...form, extra_cost_perimetro: +e.target.value || 0 })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Custo extra / unidade (R$)</Label>
                      <Input type="number" step="0.01" value={form.extra_cost_unidade}
                        onChange={(e) => setForm({ ...form, extra_cost_unidade: +e.target.value || 0 })} />
                    </div>
                  </div>
                </div>

                {/* Markup */}
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Margem aplicada</Label>
                    <span className="text-xs text-muted-foreground">
                      {form.markup_override_pct == null
                        ? `Global: ${globalMarkupPct.toFixed(1)}%`
                        : `Override: ${form.markup_override_pct.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <Label className="text-xs">Sobrescrever margem total (%)</Label>
                      <Input type="number" step="0.1" placeholder={`Vazio = global (${globalMarkupPct.toFixed(1)}%)`}
                        value={form.markup_override_pct ?? ""}
                        onChange={(e) => setForm({ ...form, markup_override_pct: e.target.value === "" ? null : +e.target.value })} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Soma de impostos + cartão + comissão + margem. Engenharia reversa: <code>preço = custo / (1 − %)</code>.
                    </p>
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-md bg-primary/5 border border-primary/30 p-3">
                  <div className="text-xs text-muted-foreground mb-1">Preview (base: 1 m², 1 m perím., 1 peça)</div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Custo da receita + extra fixo</span>
                    <span className="font-mono">{brl(custoReceitaPorPeca + (form.extra_cost_fixo || 0))}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Margem aplicada</span>
                    <span className="font-mono">{usedMarkupPct.toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-semibold text-primary mt-1 pt-1 border-t border-primary/20">
                    <span>Preço de venda estimado</span>
                    <span className="font-mono">{brl(previewPrecoPorPeca)}</span>
                  </div>
                </div>
              </div>
            )}

            {form.familia === "banner_bastao" && (
              <div>
                <Label>Largura máx do bastão (cm)</Label>
                <Input type="number" value={form.largura_max_cm ?? ""} onChange={(e) => setForm({ ...form, largura_max_cm: e.target.value ? +e.target.value : null })} />
                <p className="text-xs text-muted-foreground mt-1">Usado pela seleção automática de bastão na calculadora.</p>
              </div>
            )}

            <div>
              <Label>Tipos de mídia compatíveis</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {TIPOS_MIDIA.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.tipos_midia_compativeis.includes(t.value)} onCheckedChange={() => toggleTipo(t.value)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ordem</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value || 0 })} />
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                <Label>Ativo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir acabamento"
        description={`Excluir "${delCtx?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={confirmDelete}
      />
    </>
  );
}
