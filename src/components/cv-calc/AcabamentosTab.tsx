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
import { Plus, Edit, Trash2, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";

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
}

const empty: Omit<Row, "id"> = {
  nome: "", familia: "outro", tipos_midia_compativeis: [],
  custo_fixo: 0, lucro_fixo: 0,
  custo_mt2: 0, lucro_mt2: 0,
  custo_perimetro: 0, lucro_perimetro: 0,
  custo_unidade: 0, lucro_unidade: 0,
  largura_max_cm: null, ativo: true, sort_order: 0,
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AcabamentosTab() {
  const { requireAdmin } = usePermissionGuard();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Omit<Row, "id">>(empty);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delCtx, setDelCtx] = useState<{ id: string; name: string } | null>(null);

  const fetchRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cv_calc_acabamentos")
      .select("*")
      .order("familia").order("sort_order").order("nome");
    if (error) handleError(error, "carregar acabamentos");
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { fetchRows(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r: Row) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  const toggleTipo = (v: string) =>
    setForm((f) => ({
      ...f,
      tipos_midia_compativeis: f.tipos_midia_compativeis.includes(v)
        ? f.tipos_midia_compativeis.filter((x) => x !== v)
        : [...f.tipos_midia_compativeis, v],
    }));

  const save = async () => {
    if (!requireAdmin(editing ? "editar acabamento" : "criar acabamento")) return;
    if (!form.nome.trim()) return toast.error("Informe o nome");
    if (form.tipos_midia_compativeis.length === 0) return toast.error("Marque ao menos um tipo de mídia compatível");
    const payload = { ...form, nome: form.nome.trim() };
    if (editing) {
      const { error } = await supabase.from("cv_calc_acabamentos").update(payload).eq("id", editing.id);
      if (error) return handleError(error, "atualizar acabamento");
      toast.success("Acabamento atualizado!");
    } else {
      const { error } = await supabase.from("cv_calc_acabamentos").insert(payload);
      if (error) return handleError(error, "criar acabamento");
      toast.success("Acabamento criado!");
    }
    setOpen(false);
    fetchRows();
  };

  const requestDelete = (r: Row) => { setDelCtx({ id: r.id, name: r.nome }); setConfirmOpen(true); };
  const confirmDelete = async () => {
    if (!delCtx) return;
    if (!requireAdmin("excluir acabamento")) { setConfirmOpen(false); setDelCtx(null); return; }
    const { error } = await supabase.from("cv_calc_acabamentos").delete().eq("id", delCtx.id);
    if (error) handleError(error, "excluir acabamento"); else toast.success("Excluído!");
    setConfirmOpen(false); setDelCtx(null); fetchRows();
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Acabamento" : "Novo Acabamento"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
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

            <div>
              <Label className="text-xs text-muted-foreground">Preço = (custo + lucro) × dimensão correspondente. Use 0 nos componentes que não se aplicam.</Label>
            </div>

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
