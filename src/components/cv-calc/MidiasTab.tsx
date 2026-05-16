import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  tipo_midia: string;
  custo_mt2: number;
  lucro_mt2: number;
  custo_fixo: number;
  lucro_fixo: number;
  ativo: boolean;
  sort_order: number;
}

const empty: Omit<Row, "id"> = {
  nome: "", tipo_midia: "lona", custo_mt2: 0, lucro_mt2: 0,
  custo_fixo: 0, lucro_fixo: 0, ativo: true, sort_order: 0,
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function MidiasTab() {
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
      .from("cv_calc_midias")
      .select("*")
      .order("tipo_midia").order("sort_order").order("nome");
    if (error) handleError(error, "carregar mídias");
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchRows(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (r: Row) => { setEditing(r); setForm({ ...r }); setOpen(true); };

  const save = async () => {
    if (!requireAdmin(editing ? "editar mídia" : "criar mídia")) return;
    if (!form.nome.trim()) return toast.error("Informe o nome");
    const payload = { ...form, nome: form.nome.trim() };
    if (editing) {
      const { error } = await supabase.from("cv_calc_midias").update(payload).eq("id", editing.id);
      if (error) {
        if (error.message?.includes("cv_calc_midias_nome_tipo_unique"))
          return toast.error("Já existe uma mídia com este nome e tipo");
        return handleError(error, "atualizar mídia");
      }
      toast.success("Mídia atualizada!");
    } else {
      const { error } = await supabase.from("cv_calc_midias").insert(payload);
      if (error) {
        if (error.message?.includes("cv_calc_midias_nome_tipo_unique"))
          return toast.error("Já existe uma mídia com este nome e tipo");
        return handleError(error, "criar mídia");
      }
      toast.success("Mídia criada!");
    }
    setOpen(false);
    fetchRows();
  };

  const requestDelete = (r: Row) => { setDelCtx({ id: r.id, name: r.nome }); setConfirmOpen(true); };
  const confirmDelete = async () => {
    if (!delCtx) return;
    if (!requireAdmin("excluir mídia")) { setConfirmOpen(false); setDelCtx(null); return; }
    const { error } = await supabase.from("cv_calc_midias").delete().eq("id", delCtx.id);
    if (error) handleError(error, "excluir mídia"); else toast.success("Excluída!");
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
          <Input placeholder="Buscar mídia..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button onClick={openNew} size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Nova Mídia</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhuma mídia cadastrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Custo/m²</TableHead>
                  <TableHead className="text-right">Lucro/m²</TableHead>
                  <TableHead className="text-right">Custo fixo</TableHead>
                  <TableHead className="text-right">Lucro fixo</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className={!r.ativo ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell><Badge variant="outline">{TIPOS_MIDIA.find(t => t.value === r.tipo_midia)?.label ?? r.tipo_midia}</Badge></TableCell>
                    <TableCell className="text-right">{brl(r.custo_mt2)}</TableCell>
                    <TableCell className="text-right">{brl(r.lucro_mt2)}</TableCell>
                    <TableCell className="text-right">{brl(r.custo_fixo)}</TableCell>
                    <TableCell className="text-right">{brl(r.lucro_fixo)}</TableCell>
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
          <DialogHeader><DialogTitle>{editing ? "Editar Mídia" : "Nova Mídia"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Tipo de mídia</Label>
              <Select value={form.tipo_midia} onValueChange={(v) => setForm({ ...form, tipo_midia: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_MIDIA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
        title="Excluir mídia"
        description={`Excluir "${delCtx?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={confirmDelete}
      />
    </>
  );
}
