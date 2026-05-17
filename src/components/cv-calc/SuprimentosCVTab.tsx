import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, Pencil, Trash2, Package, Loader2, Info, ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import ConfirmDialog from "@/components/ConfirmDialog";
import SupplierCombobox from "@/components/SupplierCombobox";

interface Supply {
  id: string;
  produto: string;
  finalidade: string;
  quantidade: number;
  valor: number;
  valor_unitario: number;
  unidade: string;
  fornecedor: string;
  contato: string;
  data: string;
  margem_pct: number;
  modulo: string[];
}

const UNIDADES = [
  { value: "un", label: "Unidade (un)" },
  { value: "pç", label: "Peça (pç)" },
  { value: "m", label: "Metro (m)" },
  { value: "m²", label: "Metro² (m²)" },
  { value: "kg", label: "Quilo (kg)" },
  { value: "L", label: "Litro (L)" },
  { value: "rolo", label: "Rolo" },
  { value: "cx", label: "Caixa" },
];

const FINALIDADES_CV = [
  "Lona", "Adesivo", "Chapa/PVC", "Bastão", "Cordinha",
  "Ponteira", "Ilhós", "Laminação", "Fita/Cola", "Outros",
];

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt4 = (v: number) =>
  v.toLocaleString("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 4, maximumFractionDigits: 4,
  });

const today = () => new Date().toISOString().split("T")[0];

type FormState = {
  produto: string;
  finalidade: string;
  unidade: string;
  quantidade: string;
  valor: string;
  fornecedor: string;
  contato: string;
  data: string;
  margem_pct: string;
  modulo_grafica: boolean;
  modulo_cv: boolean;
};

const emptyForm: FormState = {
  produto: "",
  finalidade: "",
  unidade: "un",
  quantidade: "",
  valor: "",
  fornecedor: "",
  contato: "",
  data: today(),
  margem_pct: "0",
  modulo_grafica: false,
  modulo_cv: true,
};

export default function SuprimentosCVTab() {
  const { requireAdmin } = usePermissionGuard();
  const [items, setItems] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroFinalidade, setFiltroFinalidade] = useState<string>("all");
  const [usageMap, setUsageMap] = useState<Record<string, number>>({});

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supply | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [delCtx, setDelCtx] = useState<{ id: string; name: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [supRes, recipeRes] = await Promise.all([
      supabase
        .from("supplies")
        .select("*")
        .contains("modulo", ["cv"])
        .order("produto"),
      supabase
        .from("cv_calc_acabamento_recipe_items" as never)
        .select("supply_id"),
    ]);
    if (supRes.error) handleError(supRes.error, "carregar suprimentos");
    else setItems((supRes.data as Supply[]) ?? []);

    const counts: Record<string, number> = {};
    ((recipeRes.data as { supply_id: string }[]) ?? []).forEach((r) => {
      counts[r.supply_id] = (counts[r.supply_id] ?? 0) + 1;
    });
    setUsageMap(counts);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filtroFinalidade !== "all" && it.finalidade !== filtroFinalidade) return false;
      if (!q) return true;
      return (
        it.produto.toLowerCase().includes(q) ||
        it.fornecedor.toLowerCase().includes(q) ||
        it.finalidade.toLowerCase().includes(q)
      );
    });
  }, [items, search, filtroFinalidade]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (it: Supply) => {
    setEditing(it);
    setForm({
      produto: it.produto,
      finalidade: it.finalidade,
      unidade: it.unidade || "un",
      quantidade: String(it.quantidade),
      valor: String(it.valor),
      fornecedor: it.fornecedor,
      contato: it.contato,
      data: it.data || today(),
      margem_pct: String(it.margem_pct ?? 0),
      modulo_grafica: it.modulo?.includes("grafica") ?? false,
      modulo_cv: it.modulo?.includes("cv") ?? true,
    });
    setOpen(true);
  };

  const valorUnitarioPreview = useMemo(() => {
    const q = Number(form.quantidade) || 0;
    const v = Number(form.valor) || 0;
    return q > 0 ? v / q : 0;
  }, [form.quantidade, form.valor]);

  const save = async () => {
    if (!form.produto.trim()) return toast.error("Informe o nome do produto");
    if (!form.modulo_cv && !form.modulo_grafica)
      return toast.error("Selecione ao menos um módulo (Gráfica ou CV)");
    if (!requireAdmin(editing ? "editar suprimento" : "cadastrar suprimento")) return;

    const q = Number(form.quantidade) || 0;
    const v = Number(form.valor) || 0;
    const modulo: string[] = [];
    if (form.modulo_grafica) modulo.push("grafica");
    if (form.modulo_cv) modulo.push("cv");

    const payload = {
      produto: form.produto.trim(),
      finalidade: form.finalidade || "",
      unidade: form.unidade || "un",
      quantidade: q,
      valor: v,
      valor_unitario: q > 0 ? v / q : 0,
      fornecedor: form.fornecedor || "",
      contato: form.contato || "",
      data: form.data || today(),
      margem_pct: Number(form.margem_pct) || 0,
      modulo,
    };

    if (editing) {
      const { error } = await supabase.from("supplies").update(payload).eq("id", editing.id);
      if (error) return handleError(error, "atualizar suprimento");
      // grava histórico se preço mudou
      if (Number(editing.valor) !== v || Number(editing.quantidade) !== q) {
        await supabase.from("supply_purchase_history").insert({
          supply_id: editing.id,
          produto: payload.produto,
          quantidade: q,
          valor: v,
          valor_unitario: payload.valor_unitario,
          fornecedor: payload.fornecedor,
          contato: payload.contato,
          data: payload.data,
        });
      }
      toast.success("Suprimento atualizado!");
    } else {
      const { data: ins, error } = await supabase
        .from("supplies").insert(payload).select("id").single();
      if (error) return handleError(error, "cadastrar suprimento");
      if (ins && q > 0) {
        await supabase.from("supply_purchase_history").insert({
          supply_id: ins.id,
          produto: payload.produto,
          quantidade: q,
          valor: v,
          valor_unitario: payload.valor_unitario,
          fornecedor: payload.fornecedor,
          contato: payload.contato,
          data: payload.data,
        });
      }
      toast.success("Suprimento cadastrado!");
    }
    setOpen(false);
    fetchAll();
  };

  const askDelete = (it: Supply) => {
    setDelCtx({ id: it.id, name: it.produto });
    setConfirmOpen(true);
  };

  const doDelete = async () => {
    if (!delCtx) return;
    if (!requireAdmin("excluir suprimento")) return;
    // Se está em uso em receita, só remove do CV (mantém no Gráfica se aplicável)
    const it = items.find((x) => x.id === delCtx.id);
    if (!it) return;
    const inUse = (usageMap[delCtx.id] ?? 0) > 0;
    if (inUse) {
      toast.error(
        "Este item está em uso em receitas de acabamentos CV. Remova das receitas antes de excluir.",
      );
      setConfirmOpen(false);
      return;
    }
    // Se também é Gráfica, só desmarca CV em vez de apagar
    if (it.modulo.includes("grafica") && it.modulo.length > 1) {
      const novo = it.modulo.filter((m) => m !== "cv");
      const { error } = await supabase.from("supplies").update({ modulo: novo }).eq("id", it.id);
      if (error) return handleError(error, "remover do CV");
      toast.success("Removido do módulo CV (mantido em Gráfica)");
    } else {
      const { error } = await supabase.from("supplies").delete().eq("id", it.id);
      if (error) return handleError(error, "excluir suprimento");
      toast.success("Suprimento excluído");
    }
    setConfirmOpen(false);
    fetchAll();
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div>
          Suprimentos exclusivos da Comunicação Visual (bastão, ponteira, cordinha, etc.).
          Itens marcados também como <strong>Gráfica</strong> aparecem em{" "}
          <Link to="/materias-primas" className="text-primary underline inline-flex items-center gap-0.5">
            Matérias-Primas <ExternalLink className="h-3 w-3" />
          </Link>{" "}
          — é o mesmo registro, editado em qualquer um dos dois lugares.
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto, fornecedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={filtroFinalidade} onValueChange={setFiltroFinalidade}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas finalidades</SelectItem>
              {FINALIDADES_CV.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo suprimento
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum suprimento de CV cadastrado.</p>
              <p className="text-xs mt-1">Clique em "Novo suprimento" para começar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Finalidade</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Custo total</TableHead>
                  <TableHead className="text-right">Custo unit.</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Módulos</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((it) => {
                  const used = (usageMap[it.id] ?? 0) > 0;
                  return (
                    <TableRow key={it.id}>
                      <TableCell className="font-medium">
                        {it.produto}
                        {used && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">
                            em receita
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {it.finalidade || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {it.quantidade} {it.unidade}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtBRL(Number(it.valor))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {fmt4(Number(it.valor_unitario))}/{it.unidade}
                      </TableCell>
                      <TableCell className="text-sm">{it.fornecedor || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {it.modulo.includes("cv") && (
                            <Badge variant="default" className="text-[10px]">CV</Badge>
                          )}
                          {it.modulo.includes("grafica") && (
                            <Badge variant="outline" className="text-[10px]">Gráfica</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(it)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => askDelete(it)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar suprimento" : "Novo suprimento CV"}</DialogTitle>
            <DialogDescription>
              O preço unitário é calculado automaticamente (valor total ÷ quantidade) e usado nas receitas dos acabamentos CV.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Produto *</Label>
                <Input
                  value={form.produto}
                  onChange={(e) => setForm((f) => ({ ...f, produto: e.target.value }))}
                  placeholder="Ex.: Bastão de madeira 105cm"
                />
              </div>
              <div>
                <Label>Finalidade</Label>
                <Select
                  value={form.finalidade || "_none"}
                  onValueChange={(v) => setForm((f) => ({ ...f, finalidade: v === "_none" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">—</SelectItem>
                    {FINALIDADES_CV.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unidade</Label>
                <Select value={form.unidade} onValueChange={(v) => setForm((f) => ({ ...f, unidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADES.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Quantidade comprada</Label>
                <Input
                  type="number" step="0.01" min={0}
                  value={form.quantidade}
                  onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
                />
              </div>
              <div>
                <Label>Valor total pago (R$)</Label>
                <Input
                  type="number" step="0.01" min={0}
                  value={form.valor}
                  onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-muted-foreground">Custo unitário</Label>
                <div className="h-9 rounded-md border bg-muted/30 px-3 flex items-center text-sm font-medium tabular-nums">
                  {fmt4(valorUnitarioPreview)}/{form.unidade}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Fornecedor</Label>
                <SupplierCombobox
                  value={form.fornecedor}
                  onChange={(v) => setForm((f) => ({ ...f, fornecedor: v }))}
                />
              </div>
              <div>
                <Label>Contato</Label>
                <Input
                  value={form.contato}
                  onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))}
                  placeholder="Telefone, e-mail..."
                />
              </div>
              <div>
                <Label>Data da compra</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                />
              </div>
              <div>
                <Label>Margem padrão (%)</Label>
                <Input
                  type="number" step="0.1" min={0}
                  value={form.margem_pct}
                  onChange={(e) => setForm((f) => ({ ...f, margem_pct: e.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Visível em quais módulos?
              </Label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.modulo_cv}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, modulo_cv: !!v }))}
                  />
                  <span className="text-sm">Comunicação Visual</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={form.modulo_grafica}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, modulo_grafica: !!v }))}
                  />
                  <span className="text-sm">Gráfica (Matérias-Primas)</span>
                </label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Marcando os dois, o item aparece em ambos os módulos como o <strong>mesmo registro</strong> — preço, fornecedor e histórico ficam sincronizados.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Excluir suprimento?"
        description={`Tem certeza que deseja excluir "${delCtx?.name ?? ""}"? Se também estiver marcado como Gráfica, será apenas removido da listagem CV.`}
        confirmText="Excluir"
        onConfirm={doDelete}
      />
    </div>
  );
}
