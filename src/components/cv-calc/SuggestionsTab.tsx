import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import { handleError } from "@/lib/handleError";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const TIPOS_MIDIA = ["lona", "adesivo", "chapa", "outro"];
const FAMILIAS = [
  "banner_bastao", "faixa", "bainha_ilhos", "ilhos", "emenda",
  "laminacao", "recorte", "refile", "outro",
];
const ACOES = [
  { value: "alerta", label: "Alerta livre" },
  { value: "sugerir_acabamento", label: "Sugerir acabamento" },
  { value: "sugerir_pergunta", label: "Sugerir pergunta do checklist" },
];
const SEVERIDADES = [
  { value: "info", label: "Info" },
  { value: "aviso", label: "Aviso" },
  { value: "critico", label: "Crítico" },
];

interface Rule {
  id: string;
  nome: string;
  ativo: boolean;
  prioridade: number;
  cond_tipo_midia: string[];
  cond_familia: string[];
  cond_area_min: number | null;
  cond_area_max: number | null;
  cond_altura_min: number | null;
  cond_cliente_tag: string[];
  cond_sempre: boolean;
  acao_tipo: string;
  acao_acab_id: string | null;
  acao_question_id: string | null;
  acao_mensagem: string;
  severidade: string;
}

const emptyRule = (): Partial<Rule> => ({
  nome: "",
  ativo: true,
  prioridade: 0,
  cond_tipo_midia: [],
  cond_familia: [],
  cond_area_min: null,
  cond_area_max: null,
  cond_altura_min: null,
  cond_cliente_tag: [],
  cond_sempre: false,
  acao_tipo: "alerta",
  acao_acab_id: null,
  acao_question_id: null,
  acao_mensagem: "",
  severidade: "info",
});

export default function SuggestionsTab() {
  const isAdmin = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [acabamentos, setAcabamentos] = useState<{ id: string; nome: string }[]>([]);
  const [questions, setQuestions] = useState<{ id: string; pergunta: string }[]>([]);
  const [tagSugs, setTagSugs] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Rule>>(emptyRule());
  const [tagInput, setTagInput] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [r, a, q, t] = await Promise.all([
        supabase.from("quote_suggestion_rules").select("*").order("prioridade"),
        supabase.from("cv_calc_acabamentos").select("id, nome").eq("ativo", true).order("nome"),
        supabase.from("quote_checklist_questions").select("id, pergunta").eq("ativo", true).order("sort_order"),
        supabase.from("clients").select("tags").not("tags", "is", null).limit(500),
      ]);
      if (r.error) throw r.error;
      setRules((r.data ?? []) as Rule[]);
      setAcabamentos((a.data ?? []) as any);
      setQuestions((q.data ?? []) as any);
      const tagSet = new Set<string>();
      (t.data ?? []).forEach((row: any) => (row.tags || []).forEach((tg: string) => tg && tagSet.add(tg)));
      setTagSugs(Array.from(tagSet).sort());
    } catch (e) {
      handleError(e, "Erro ao carregar sugestões");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditingId(null); setForm(emptyRule()); setDialogOpen(true); };
  const openEdit = (r: Rule) => { setEditingId(r.id); setForm({ ...r }); setDialogOpen(true); };
  const toggleArr = (arr: string[] | undefined, value: string): string[] => {
    const a = arr ?? [];
    return a.includes(value) ? a.filter((x) => x !== value) : [...a, value];
  };

  const save = async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome"); return; }
    if (!form.acao_mensagem?.trim() && form.acao_tipo === "alerta") {
      toast.error("Mensagem é obrigatória para alertas");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        nome: form.nome!.trim(),
        ativo: form.ativo ?? true,
        prioridade: Number(form.prioridade) || 0,
        cond_tipo_midia: form.cond_tipo_midia ?? [],
        cond_familia: form.cond_familia ?? [],
        cond_area_min: form.cond_area_min ?? null,
        cond_area_max: form.cond_area_max ?? null,
        cond_altura_min: form.cond_altura_min ?? null,
        cond_cliente_tag: form.cond_cliente_tag ?? [],
        cond_sempre: !!form.cond_sempre,
        acao_tipo: form.acao_tipo,
        acao_acab_id: form.acao_tipo === "sugerir_acabamento" ? (form.acao_acab_id ?? null) : null,
        acao_question_id: form.acao_tipo === "sugerir_pergunta" ? (form.acao_question_id ?? null) : null,
        acao_mensagem: form.acao_mensagem ?? "",
        severidade: form.severidade ?? "info",
      };
      if (editingId) {
        const { error } = await supabase.from("quote_suggestion_rules").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quote_suggestion_rules").insert(payload);
        if (error) throw error;
      }
      toast.success("Regra salva");
      setDialogOpen(false);
      load();
    } catch (e) { handleError(e, "Erro ao salvar"); } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase.from("quote_suggestion_rules").delete().eq("id", id);
      if (error) throw error;
      toast.success("Regra removida");
      load();
    } catch (e) { handleError(e, "Erro ao remover"); } finally { setConfirmDel(null); }
  };

  const toggleAtivo = async (r: Rule) => {
    try {
      const { error } = await supabase.from("quote_suggestion_rules").update({ ativo: !r.ativo }).eq("id", r.id);
      if (error) throw error;
      load();
    } catch (e) { handleError(e, "Erro ao atualizar"); }
  };

  const condResumo = (r: Rule) => {
    if (r.cond_sempre) return <Badge variant="secondary">sempre</Badge>;
    const parts: string[] = [];
    if (r.cond_tipo_midia?.length) parts.push(`mídia: ${r.cond_tipo_midia.join(",")}`);
    if (r.cond_familia?.length) parts.push(`fam: ${r.cond_familia.join(",")}`);
    if (r.cond_area_min != null) parts.push(`área≥${r.cond_area_min}m²`);
    if (r.cond_area_max != null) parts.push(`área≤${r.cond_area_max}m²`);
    if (r.cond_altura_min != null) parts.push(`alt≥${r.cond_altura_min}m`);
    if (r.cond_cliente_tag?.length) parts.push(`tag: ${r.cond_cliente_tag.join(",")}`);
    return <span className="text-xs">{parts.join(" · ") || "—"}</span>;
  };

  const sevColor = (s: string) =>
    s === "critico" ? "destructive" : s === "aviso" ? "default" : "outline";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Sugestões do Assistente
              </h2>
              <p className="text-sm text-muted-foreground">
                Regras que o assistente usa para sugerir acabamentos, perguntas ou exibir alertas no orçamento.
              </p>
            </div>
            {isAdmin && (
              <Button onClick={openNew} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova regra
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Prior.</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Condições</TableHead>
                  <TableHead className="w-40">Ação</TableHead>
                  <TableHead className="w-24">Severidade</TableHead>
                  <TableHead className="w-20 text-center">Ativo</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma regra cadastrada.</TableCell></TableRow>
                )}
                {rules.map((r) => (
                  <TableRow key={r.id} className={!r.ativo ? "opacity-50" : ""}>
                    <TableCell>{r.prioridade}</TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>{condResumo(r)}</TableCell>
                    <TableCell className="text-xs">
                      {ACOES.find((a) => a.value === r.acao_tipo)?.label}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sevColor(r.severidade) as any} className="text-xs capitalize">{r.severidade}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} disabled={!isAdmin} />
                    </TableCell>
                    <TableCell>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDel(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar regra" : "Nova regra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input value={form.nome ?? ""} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Input type="number" value={form.prioridade ?? 0} onChange={(e) => setForm((f) => ({ ...f, prioridade: Number(e.target.value) }))} />
              </div>
            </div>

            <Card>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Quando disparar?</div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Sempre</Label>
                    <Switch checked={!!form.cond_sempre} onCheckedChange={(v) => setForm((f) => ({ ...f, cond_sempre: v }))} />
                  </div>
                </div>
                {!form.cond_sempre && (
                  <>
                    <div>
                      <Label className="text-xs">Tipos de mídia</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {TIPOS_MIDIA.map((m) => (
                          <label key={m} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <Checkbox checked={form.cond_tipo_midia?.includes(m) ?? false}
                              onCheckedChange={() => setForm((f) => ({ ...f, cond_tipo_midia: toggleArr(f.cond_tipo_midia, m) }))} />
                            {m}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Famílias de acabamento</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {FAMILIAS.map((fa) => (
                          <label key={fa} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <Checkbox checked={form.cond_familia?.includes(fa) ?? false}
                              onCheckedChange={() => setForm((f) => ({ ...f, cond_familia: toggleArr(f.cond_familia, fa) }))} />
                            {fa}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Área min (m²)</Label>
                        <Input type="number" step="0.1" value={form.cond_area_min ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, cond_area_min: e.target.value === "" ? null : Number(e.target.value) }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Área máx (m²)</Label>
                        <Input type="number" step="0.1" value={form.cond_area_max ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, cond_area_max: e.target.value === "" ? null : Number(e.target.value) }))} />
                      </div>
                      <div>
                        <Label className="text-xs">Altura min (m)</Label>
                        <Input type="number" step="0.1" value={form.cond_altura_min ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, cond_altura_min: e.target.value === "" ? null : Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Tags do cliente</Label>
                      <div className="flex gap-2 mt-1">
                        <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                          placeholder="ex.: construtora"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault();
                            const v = tagInput.trim().toLowerCase();
                            if (v) setForm((f) => ({ ...f, cond_cliente_tag: Array.from(new Set([...(f.cond_cliente_tag ?? []), v])) }));
                            setTagInput("");
                          }}} />
                        <Button type="button" variant="outline" size="sm" onClick={() => {
                          const v = tagInput.trim().toLowerCase();
                          if (v) setForm((f) => ({ ...f, cond_cliente_tag: Array.from(new Set([...(f.cond_cliente_tag ?? []), v])) }));
                          setTagInput("");
                        }}>Add</Button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(form.cond_cliente_tag ?? []).map((t) => (
                          <Badge key={t} variant="secondary" className="cursor-pointer"
                            onClick={() => setForm((f) => ({ ...f, cond_cliente_tag: (f.cond_cliente_tag ?? []).filter((x) => x !== t) }))}>
                            {t} ×
                          </Badge>
                        ))}
                      </div>
                      {tagSugs.length > 0 && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          Sugestões: {tagSugs.slice(0, 12).join(", ")}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-3 space-y-3">
                <div className="text-sm font-medium">Ação</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tipo</Label>
                    <Select value={form.acao_tipo} onValueChange={(v) => setForm((f) => ({ ...f, acao_tipo: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACOES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Severidade</Label>
                    <Select value={form.severidade} onValueChange={(v) => setForm((f) => ({ ...f, severidade: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEVERIDADES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.acao_tipo === "sugerir_acabamento" && (
                  <div>
                    <Label className="text-xs">Acabamento</Label>
                    <Select value={form.acao_acab_id ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, acao_acab_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {acabamentos.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.acao_tipo === "sugerir_pergunta" && (
                  <div>
                    <Label className="text-xs">Pergunta do checklist</Label>
                    <Select value={form.acao_question_id ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, acao_question_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {questions.map((q) => <SelectItem key={q.id} value={q.id}>{q.pergunta}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Mensagem exibida no painel</Label>
                  <Textarea rows={2} value={form.acao_mensagem ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, acao_mensagem: e.target.value }))}
                    placeholder="Ex.: Lona ≥ 6m². Confirme se precisa de Bainha + Ilhós." />
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <Label>Ativo</Label>
              <Switch checked={form.ativo ?? true} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title="Remover regra?"
        description="Esta ação não pode ser desfeita."
        confirmText="Remover"
        onConfirm={() => confirmDel && remove(confirmDel)}
      />
    </div>
  );
}
