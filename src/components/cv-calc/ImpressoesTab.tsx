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

interface Row {
  id: string;
  nome: string;
  custo_mt2: number;
  lucro_mt2: number;
  custo_fixo: number;
  lucro_fixo: number;
  largura_max_cm: number | null;
  comprimento_max_cm: number | null;
  tipos_midia_compativeis: string[];
  ativo: boolean;
  sort_order: number;
}

const empty: Omit<Row, "id"> = {
  nome: "", custo_mt2: 0, lucro_mt2: 0, custo_fixo: 0, lucro_fixo: 0,
  largura_max_cm: null, comprimento_max_cm: null, tipos_midia_compativeis: [],
  ativo: true, sort_order: 0,
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ImpressoesTab() {
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
      .from("cv_calc_impressoes")
      .select("*")
      .order("sort_order").order("nome");
    if (error) handleError(error, "carregar impressões");
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
    if (!requireAdmin(editing ? "editar impressão" : "criar impressão")) return;
    if (!form.nome.trim()) return toast.error("Informe o nome");
    if (form.tipos_midia_compativeis.length === 0) return toast.error("Marque ao menos um tipo de mídia compatível");
    const payload = { ...form, nome: form.nome.trim() };
    if (editing) {
      const { error } = await supabase.from("cv_calc_impressoes").update(payload).eq("id", editing.id);
      if (error) return handleError(error, "atualizar impressão");
      toast.success("Impressão atualizada!");
    } else {
      const { error } = await supabase.from("cv_calc_impressoes").insert(payload);
      if (error) return handleError(error, "criar impressão");
      toast.success("Impressão criada!");
    }
    setOpen(false);
    fetchRows();
  };

  const requestDelete = (r: Row) => { setDelCtx({ id: r.id, name: r.nome }); setConfirmOpen(true); };
  const confirmDelete = async () => {
    if (!delCtx) return;
    if (!requireAdmin("excluir impressão")) { setConfirmOpen(false); setDelCtx(null); return; }
    const { error } = await supabase.from("cv_calc_impressoes").delete().eq("id", delCtx.id);
    if (error) handleError(error, "excluir impressão"); else toast.success("Excluída!");
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
          <Input placeholder="Buscar impressão..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Nova Impressão</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhuma impressão cadastrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Custo/m²</TableHead>
                  <TableHead className="text-right">Lucro/m²</TableHead>
                  <TableHead className="text-right">Fixo</TableHead>
                  <TableHead className="text-right">Larg. máx</TableHead>
                  <TableHead>Compatível com</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className={!r.ativo ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right">{brl(r.custo_mt2)}</TableCell>
                    <TableCell className="text-right">{brl(r.lucro_mt2)}</TableCell>
                    <TableCell className="text-right">{brl(r.custo_fixo + r.lucro_fixo)}</TableCell>
                    <TableCell className="text-right">{r.largura_max_cm ? `${r.largura_max_cm} cm` : "—"}</TableCell>
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar Impressão" : "Nova Impressão"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Custo / m² (R$)</Label>
                <Input type="number" step="0.01" value={form.custo_mt2} onChange={(e) => setForm({ ...form, custo_mt2: +e.target.value || 0 })} />
              </div>
              <div>
                <Label>Lucro / m² (R$)</Label>
                <Input type="number" step="0.01" value={form.lucro_mt2} onChange={(e) => setForm({ ...form, lucro_mt2: +e.target.value || 0 })} />
              </div>
              <div>
                <Label>Custo fixo (R$)</Label>
                <Input type="number" step="0.01" value={form.custo_fixo} onChange={(e) => setForm({ ...form, custo_fixo: +e.target.value || 0 })} />
              </div>
              <div>
                <Label>Lucro fixo (R$)</Label>
                <Input type="number" step="0.01" value={form.lucro_fixo} onChange={(e) => setForm({ ...form, lucro_fixo: +e.target.value || 0 })} />
              </div>
              <div>
                <Label>Largura máx (cm)</Label>
                <Input type="number" value={form.largura_max_cm ?? ""} onChange={(e) => setForm({ ...form, largura_max_cm: e.target.value ? +e.target.value : null })} />
              </div>
              <div>
                <Label>Comprimento máx (cm)</Label>
                <Input type="number" value={form.comprimento_max_cm ?? ""} onChange={(e) => setForm({ ...form, comprimento_max_cm: e.target.value ? +e.target.value : null })} />
              </div>
            </div>
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
        title="Excluir impressão"
        description={`Excluir "${delCtx?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={confirmDelete}
      />
    </>
  );
}
