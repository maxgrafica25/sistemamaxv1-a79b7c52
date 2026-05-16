import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Search, Loader2, Megaphone, Layers, Printer as PrinterIcon, Scissors, Calculator } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import { handleError } from "@/lib/handleError";
import { usePermissionGuard } from "@/lib/permissions";
import CalculadoraTab from "@/components/cv-calc/CalculadoraTab";

type Tab = "calculadora" | "materiais" | "impressoras" | "acabamentos";

const CATEGORIAS = [
  { value: "lona", label: "Lona" },
  { value: "adesivo", label: "Adesivo" },
  { value: "chapa", label: "Chapa" },
  { value: "outro", label: "Outro" },
];

const TECNOLOGIAS = ["Eco-solvente", "Solvente", "UV", "Latex", "Outro"];

const TIPOS_CALCULO = [
  { value: "unidade", label: "Por unidade (ex: ilhós, parafuso)" },
  { value: "mt2", label: "Por m² (ex: laminação)" },
  { value: "perimetro_metro", label: "Por metro de perímetro (ex: bainha)" },
  { value: "fixo", label: "Valor fixo (ex: recorte especial)" },
];

interface CVMaterialRow {
  id: string;
  nome: string;
  categoria: string;
  largura_util_cm: number;
  custo_mt2: number;
  margem_mt2_pct: number;
  valor_minimo: number;
  is_active: boolean;
}

interface CVPrinterRow {
  id: string;
  nome: string;
  tecnologia: string;
  largura_max_cm: number;
  custo_mt2_print: number;
  margem_mt2_print_pct: number;
  custo_fixo_setup: number;
  lucro_fixo_setup: number;
  categorias_compativeis: string[];
  is_active: boolean;
}

interface CVFinishRow {
  id: string;
  nome: string;
  categoria_compativel: string[];
  tipo_calculo: string;
  custo: number;
  margem_pct: number;
  is_active: boolean;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const labelCategoria = (v: string) =>
  CATEGORIAS.find((c) => c.value === v)?.label || v;

export default function CadastrosCV() {
  const [tab, setTab] = useState<Tab>("calculadora");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [materiais, setMateriais] = useState<CVMaterialRow[]>([]);
  const [impressoras, setImpressoras] = useState<CVPrinterRow[]>([]);
  const [acabamentos, setAcabamentos] = useState<CVFinishRow[]>([]);

  // Dialog state (one per tab)
  const [matOpen, setMatOpen] = useState(false);
  const [matEditing, setMatEditing] = useState<CVMaterialRow | null>(null);
  const [matForm, setMatForm] = useState<Omit<CVMaterialRow, "id">>({
    nome: "", categoria: "lona", largura_util_cm: 0,
    custo_mt2: 0, margem_mt2_pct: 0, valor_minimo: 0, is_active: true,
  });

  const [prtOpen, setPrtOpen] = useState(false);
  const [prtEditing, setPrtEditing] = useState<CVPrinterRow | null>(null);
  const [prtForm, setPrtForm] = useState<Omit<CVPrinterRow, "id">>({
    nome: "", tecnologia: "Eco-solvente", largura_max_cm: 0,
    custo_mt2_print: 0, margem_mt2_print_pct: 0,
    custo_fixo_setup: 0, lucro_fixo_setup: 0,
    categorias_compativeis: [], is_active: true,
  });

  const [finOpen, setFinOpen] = useState(false);
  const [finEditing, setFinEditing] = useState<CVFinishRow | null>(null);
  const [finForm, setFinForm] = useState<Omit<CVFinishRow, "id">>({
    nome: "", categoria_compativel: [], tipo_calculo: "unidade",
    custo: 0, margem_pct: 0, is_active: true,
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteCtx, setDeleteCtx] = useState<{ table: string; id: string; name: string } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    const [mRes, pRes, fRes] = await Promise.all([
      supabase.from("cv_materials" as never).select("*").order("sort_order").order("nome"),
      supabase.from("cv_printers" as never).select("*").order("sort_order").order("nome"),
      supabase.from("cv_finishes" as never).select("*").order("sort_order").order("nome"),
    ]);
    if (mRes.data) setMateriais(mRes.data as never);
    if (pRes.data) setImpressoras(pRes.data as never);
    if (fRes.data) setAcabamentos(fRes.data as never);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ───────── Materiais ─────────
  const openNewMat = () => {
    setMatEditing(null);
    setMatForm({ nome: "", categoria: "lona", largura_util_cm: 0, custo_mt2: 0, margem_mt2_pct: 0, valor_minimo: 0, is_active: true });
    setMatOpen(true);
  };
  const openEditMat = (m: CVMaterialRow) => {
    setMatEditing(m);
    setMatForm({ ...m });
    setMatOpen(true);
  };
  const { requireAdmin } = usePermissionGuard();
  const saveMat = async () => {
    if (!requireAdmin(matEditing ? "editar material" : "criar material")) return;
    if (!matForm.nome.trim()) return toast.error("Informe o nome do material");
    const payload = { ...matForm };
    if (matEditing) {
      const { error } = await supabase.from("cv_materials" as never).update(payload as never).eq("id", matEditing.id);
      if (error) return handleError(error, "atualizar material");
      toast.success("Material atualizado!");
    } else {
      const { error } = await supabase.from("cv_materials" as never).insert(payload as never);
      if (error) return handleError(error, "criar material");
      toast.success("Material criado!");
    }
    setMatOpen(false);
    fetchAll();
  };

  // ───────── Impressoras ─────────
  const openNewPrt = () => {
    setPrtEditing(null);
    setPrtForm({ nome: "", tecnologia: "Eco-solvente", largura_max_cm: 0, custo_mt2_print: 0, margem_mt2_print_pct: 0, custo_fixo_setup: 0, lucro_fixo_setup: 0, categorias_compativeis: [], is_active: true });
    setPrtOpen(true);
  };
  const openEditPrt = (p: CVPrinterRow) => {
    setPrtEditing(p);
    setPrtForm({ ...p });
    setPrtOpen(true);
  };
  const savePrt = async () => {
    if (!requireAdmin(prtEditing ? "editar impressora" : "criar impressora")) return;
    if (!prtForm.nome.trim()) return toast.error("Informe o nome da impressora");
    if (prtForm.categorias_compativeis.length === 0) return toast.error("Marque ao menos uma categoria compatível");
    const payload = { ...prtForm };
    if (prtEditing) {
      const { error } = await supabase.from("cv_printers" as never).update(payload as never).eq("id", prtEditing.id);
      if (error) return handleError(error, "atualizar impressora");
      toast.success("Impressora atualizada!");
    } else {
      const { error } = await supabase.from("cv_printers" as never).insert(payload as never);
      if (error) return handleError(error, "criar impressora");
      toast.success("Impressora criada!");
    }
    setPrtOpen(false);
    fetchAll();
  };

  // ───────── Acabamentos ─────────
  const openNewFin = () => {
    setFinEditing(null);
    setFinForm({ nome: "", categoria_compativel: [], tipo_calculo: "unidade", custo: 0, margem_pct: 0, is_active: true });
    setFinOpen(true);
  };
  const openEditFin = (f: CVFinishRow) => {
    setFinEditing(f);
    setFinForm({ ...f });
    setFinOpen(true);
  };
  const saveFin = async () => {
    if (!requireAdmin(finEditing ? "editar acabamento" : "criar acabamento")) return;
    if (!finForm.nome.trim()) return toast.error("Informe o nome do acabamento");
    if (finForm.categoria_compativel.length === 0) return toast.error("Marque ao menos uma categoria compatível");
    const payload = { ...finForm };
    if (finEditing) {
      const { error } = await supabase.from("cv_finishes" as never).update(payload as never).eq("id", finEditing.id);
      if (error) return handleError(error, "atualizar acabamento");
      toast.success("Acabamento atualizado!");
    } else {
      const { error } = await supabase.from("cv_finishes" as never).insert(payload as never);
      if (error) return handleError(error, "criar acabamento");
      toast.success("Acabamento criado!");
    }
    setFinOpen(false);
    fetchAll();
  };

  // ───────── Delete ─────────
  const requestDelete = (table: string, id: string, name: string) => {
    setDeleteCtx({ table, id, name });
    setConfirmOpen(true);
  };
  const confirmDelete = async () => {
    if (!deleteCtx) return;
    if (!requireAdmin("excluir item")) { setConfirmOpen(false); setDeleteCtx(null); return; }
    const { error } = await supabase.from(deleteCtx.table as never).delete().eq("id", deleteCtx.id);
    if (error) handleError(error, "excluir item");
    else toast.success("Excluído!");
    setConfirmOpen(false);
    setDeleteCtx(null);
    fetchAll();
  };

  const toggleArrayValue = (arr: string[], value: string) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const filteredMat = useMemo(
    () => materiais.filter((m) => m.nome.toLowerCase().includes(search.toLowerCase())),
    [materiais, search],
  );
  const filteredPrt = useMemo(
    () => impressoras.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase())),
    [impressoras, search],
  );
  const filteredFin = useMemo(
    () => acabamentos.filter((f) => f.nome.toLowerCase().includes(search.toLowerCase())),
    [acabamentos, search],
  );

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const tabs: { key: Tab; label: string; count: number | null; icon: typeof Layers }[] = [
    { key: "calculadora", label: "Calculadora", count: null, icon: Calculator },
    { key: "materiais", label: "Materiais", count: materiais.length, icon: Layers },
    { key: "impressoras", label: "Impressoras", count: impressoras.length, icon: PrinterIcon },
    { key: "acabamentos", label: "Acabamentos", count: acabamentos.length, icon: Scissors },
  ];

  return (
    <div className="p-3 sm:p-4 lg:p-6 xl:p-8 space-y-4 lg:space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-primary" />
          Comunicação Visual
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Materiais, impressoras e acabamentos para grande formato</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-[3px] -mb-px ${
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.count !== null && <span className="text-muted-foreground">({t.count})</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={`Buscar ${tab}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Button
          onClick={tab === "materiais" ? openNewMat : tab === "impressoras" ? openNewPrt : openNewFin}
          size="sm"
          className="gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" />
          {tab === "materiais" ? "Novo Material" : tab === "impressoras" ? "Nova Impressora" : "Novo Acabamento"}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {tab === "materiais" && (
            filteredMat.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Nenhum material cadastrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Largura útil</TableHead>
                    <TableHead className="text-right">Custo/m²</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMat.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nome}</TableCell>
                      <TableCell><Badge variant="outline">{labelCategoria(m.categoria)}</Badge></TableCell>
                      <TableCell className="text-right">{m.largura_util_cm} cm</TableCell>
                      <TableCell className="text-right">{formatBRL(m.custo_mt2)}</TableCell>
                      <TableCell className="text-right">{m.margem_mt2_pct}%</TableCell>
                      <TableCell className="text-right">{formatBRL(m.valor_minimo)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMat(m)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDelete("cv_materials", m.id, m.nome)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}

          {tab === "impressoras" && (
            filteredPrt.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Nenhuma impressora cadastrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tecnologia</TableHead>
                    <TableHead className="text-right">Largura máx.</TableHead>
                    <TableHead className="text-right">Custo/m²</TableHead>
                    <TableHead className="text-right">Setup</TableHead>
                    <TableHead>Categorias</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrt.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome}</TableCell>
                      <TableCell>{p.tecnologia}</TableCell>
                      <TableCell className="text-right">{p.largura_max_cm} cm</TableCell>
                      <TableCell className="text-right">{formatBRL(p.custo_mt2_print)}</TableCell>
                      <TableCell className="text-right">{formatBRL(p.custo_fixo_setup + p.lucro_fixo_setup)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {p.categorias_compativeis.map((c) => (
                            <Badge key={c} variant="secondary" className="text-[10px]">{labelCategoria(c)}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPrt(p)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDelete("cv_printers", p.id, p.nome)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}

          {tab === "acabamentos" && (
            filteredFin.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">Nenhum acabamento cadastrado</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo de cálculo</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead>Compatível com</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFin.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell>{TIPOS_CALCULO.find(t => t.value === f.tipo_calculo)?.label.split(" (")[0] || f.tipo_calculo}</TableCell>
                      <TableCell className="text-right">{formatBRL(f.custo)}</TableCell>
                      <TableCell className="text-right">{f.margem_pct}%</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {f.categoria_compativel.map((c) => (
                            <Badge key={c} variant="secondary" className="text-[10px]">{labelCategoria(c)}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditFin(f)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => requestDelete("cv_finishes", f.id, f.nome)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}
        </CardContent>
      </Card>

      {/* ───────── Material Dialog ───────── */}
      <Dialog open={matOpen} onOpenChange={setMatOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{matEditing ? "Editar Material" : "Novo Material"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={matForm.nome} onChange={(e) => setMatForm({ ...matForm, nome: e.target.value })} placeholder="Ex: Lona Brilho 440g" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={matForm.categoria} onValueChange={(v) => setMatForm({ ...matForm, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Largura útil (cm)</Label>
                <Input type="number" step="0.1" value={matForm.largura_util_cm || ""} onChange={(e) => setMatForm({ ...matForm, largura_util_cm: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Custo / m²</Label>
                <Input type="number" step="0.01" value={matForm.custo_mt2 || ""} onChange={(e) => setMatForm({ ...matForm, custo_mt2: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Margem (%)</Label>
                <Input type="number" step="0.01" value={matForm.margem_mt2_pct || ""} onChange={(e) => setMatForm({ ...matForm, margem_mt2_pct: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Valor mínimo (R$)</Label>
                <Input type="number" step="0.01" value={matForm.valor_minimo || ""} onChange={(e) => setMatForm({ ...matForm, valor_minimo: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMatOpen(false)}>Cancelar</Button>
            <Button onClick={saveMat}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── Printer Dialog ───────── */}
      <Dialog open={prtOpen} onOpenChange={setPrtOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{prtEditing ? "Editar Impressora" : "Nova Impressora"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={prtForm.nome} onChange={(e) => setPrtForm({ ...prtForm, nome: e.target.value })} placeholder="Ex: Mimaki JV150" />
              </div>
              <div className="space-y-2">
                <Label>Tecnologia</Label>
                <Select value={prtForm.tecnologia} onValueChange={(v) => setPrtForm({ ...prtForm, tecnologia: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TECNOLOGIAS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Largura máx. (cm)</Label>
                <Input type="number" step="0.1" value={prtForm.largura_max_cm || ""} onChange={(e) => setPrtForm({ ...prtForm, largura_max_cm: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Custo print/m²</Label>
                <Input type="number" step="0.01" value={prtForm.custo_mt2_print || ""} onChange={(e) => setPrtForm({ ...prtForm, custo_mt2_print: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Margem print (%)</Label>
                <Input type="number" step="0.01" value={prtForm.margem_mt2_print_pct || ""} onChange={(e) => setPrtForm({ ...prtForm, margem_mt2_print_pct: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Custo fixo setup (R$)</Label>
                <Input type="number" step="0.01" value={prtForm.custo_fixo_setup || ""} onChange={(e) => setPrtForm({ ...prtForm, custo_fixo_setup: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Lucro fixo setup (R$)</Label>
                <Input type="number" step="0.01" value={prtForm.lucro_fixo_setup || ""} onChange={(e) => setPrtForm({ ...prtForm, lucro_fixo_setup: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categorias compatíveis *</Label>
              <div className="flex flex-wrap gap-3">
                {CATEGORIAS.map(c => (
                  <label key={c.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={prtForm.categorias_compativeis.includes(c.value)}
                      onCheckedChange={() => setPrtForm({ ...prtForm, categorias_compativeis: toggleArrayValue(prtForm.categorias_compativeis, c.value) })}
                    />
                    <span className="text-sm">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrtOpen(false)}>Cancelar</Button>
            <Button onClick={savePrt}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────── Finish Dialog ───────── */}
      <Dialog open={finOpen} onOpenChange={setFinOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{finEditing ? "Editar Acabamento" : "Novo Acabamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={finForm.nome} onChange={(e) => setFinForm({ ...finForm, nome: e.target.value })} placeholder="Ex: Ilhós, Bainha, Laminação..." />
            </div>
            <div className="space-y-2">
              <Label>Tipo de cálculo *</Label>
              <Select value={finForm.tipo_calculo} onValueChange={(v) => setFinForm({ ...finForm, tipo_calculo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_CALCULO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Custo (R$)</Label>
                <Input type="number" step="0.01" value={finForm.custo || ""} onChange={(e) => setFinForm({ ...finForm, custo: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Margem (%)</Label>
                <Input type="number" step="0.01" value={finForm.margem_pct || ""} onChange={(e) => setFinForm({ ...finForm, margem_pct: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Compatível com *</Label>
              <div className="flex flex-wrap gap-3">
                {CATEGORIAS.map(c => (
                  <label key={c.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={finForm.categoria_compativel.includes(c.value)}
                      onCheckedChange={() => setFinForm({ ...finForm, categoria_compativel: toggleArrayValue(finForm.categoria_compativel, c.value) })}
                    />
                    <span className="text-sm">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinOpen(false)}>Cancelar</Button>
            <Button onClick={saveFin}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={confirmDelete}
        title="Confirmar exclusão"
        description={`Tem certeza que deseja excluir "${deleteCtx?.name}"?`}
      />
    </div>
  );
}
