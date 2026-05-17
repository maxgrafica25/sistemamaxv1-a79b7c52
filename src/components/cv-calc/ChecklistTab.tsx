import { useEffect, useState } from "react";
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
import { Plus, Edit, Trash2, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ConfirmDialog from "@/components/ConfirmDialog";
import { handleError } from "@/lib/handleError";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const TIPOS_RESPOSTA = [
  { value: "sim_nao", label: "Sim / Não" },
  { value: "sim_nao_valor", label: "Sim / Não + mão de obra" },
  { value: "texto", label: "Texto livre" },
  { value: "foto", label: "Foto" },
];

const CATEGORIAS = [
  { value: "instalacao", label: "Instalação" },
  { value: "remocao", label: "Remoção" },
  { value: "logistica", label: "Logística" },
  { value: "arte", label: "Arte" },
  { value: "outro", label: "Outro" },
];

const TIPOS_MIDIA = ["lona", "adesivo", "chapa", "outro"];
const FAMILIAS_ACAB = [
  "banner_bastao", "faixa", "bainha_ilhos", "ilhos", "emenda",
  "laminacao", "recorte", "refile", "outro",
];

const STEP_TYPES = [
  { value: "outro", label: "Outro" },
  { value: "instalacao", label: "Instalação" },
  { value: "arte", label: "Arte" },
  { value: "acabamento", label: "Acabamento" },
  { value: "impressao", label: "Impressão" },
];

interface Question {
  id: string;
  pergunta: string;
  tipo_resposta: string;
  categoria: string;
  hint: string | null;
  ativo: boolean;
  sort_order: number;
  labor_descricao: string | null;
  labor_custo_m2: number;
  labor_custo_fixo: number;
  labor_step_type: string | null;
}

interface Trigger {
  id: string;
  question_id: string;
  tipo_midia: string[];
  familia_acab: string[];
  area_min_m2: number | null;
  area_max_m2: number | null;
  altura_min_m: number | null;
  sempre: boolean;
}

interface FormState {
  question: Partial<Question>;
  trigger: Partial<Trigger>;
}

const emptyForm = (): FormState => ({
  question: {
    pergunta: "",
    tipo_resposta: "sim_nao",
    categoria: "outro",
    hint: "",
    ativo: true,
    sort_order: 0,
    labor_descricao: "",
    labor_custo_m2: 0,
    labor_custo_fixo: 0,
    labor_step_type: "outro",
  },
  trigger: {
    tipo_midia: [],
    familia_acab: [],
    area_min_m2: null,
    area_max_m2: null,
    altura_min_m: null,
    sempre: false,
  },
});

export default function ChecklistTab() {
  const isAdmin = useIsAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: q, error: e1 }, { data: t, error: e2 }] = await Promise.all([
        supabase.from("quote_checklist_questions").select("*").order("sort_order"),
        supabase.from("quote_checklist_triggers").select("*"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setQuestions((q ?? []) as Question[]);
      setTriggers((t ?? []) as Trigger[]);
    } catch (e) {
      handleError(e, "Erro ao carregar checklist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (q: Question) => {
    const trig = triggers.find((t) => t.question_id === q.id);
    setEditingId(q.id);
    setForm({
      question: { ...q },
      trigger: trig ? { ...trig } : emptyForm().trigger,
    });
    setDialogOpen(true);
  };

  const toggleArr = (arr: string[] | undefined, value: string): string[] => {
    const a = arr ?? [];
    return a.includes(value) ? a.filter((x) => x !== value) : [...a, value];
  };

  const save = async () => {
    if (!form.question.pergunta?.trim()) {
      toast.error("Informe a pergunta");
      return;
    }
    setSaving(true);
    try {
      const qPayload = {
        pergunta: form.question.pergunta!.trim(),
        tipo_resposta: form.question.tipo_resposta!,
        categoria: form.question.categoria!,
        hint: form.question.hint || null,
        ativo: form.question.ativo ?? true,
        sort_order: Number(form.question.sort_order) || 0,
        labor_descricao: form.question.labor_descricao || null,
        labor_custo_m2: Number(form.question.labor_custo_m2) || 0,
        labor_custo_fixo: Number(form.question.labor_custo_fixo) || 0,
        labor_step_type: form.question.labor_step_type || null,
      };

      let questionId = editingId;
      if (editingId) {
        const { error } = await supabase
          .from("quote_checklist_questions")
          .update(qPayload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("quote_checklist_questions")
          .insert(qPayload)
          .select("id")
          .single();
        if (error) throw error;
        questionId = data.id;
      }

      // Replace trigger row (1:1)
      if (questionId) {
        const { error: delErr } = await supabase
          .from("quote_checklist_triggers")
          .delete()
          .eq("question_id", questionId);
        if (delErr) throw delErr;

        const tPayload = {
          question_id: questionId,
          tipo_midia: form.trigger.tipo_midia ?? [],
          familia_acab: form.trigger.familia_acab ?? [],
          area_min_m2: form.trigger.area_min_m2 != null ? Number(form.trigger.area_min_m2) : null,
          area_max_m2: form.trigger.area_max_m2 != null ? Number(form.trigger.area_max_m2) : null,
          altura_min_m: form.trigger.altura_min_m != null ? Number(form.trigger.altura_min_m) : null,
          sempre: !!form.trigger.sempre,
        };
        const { error: insErr } = await supabase
          .from("quote_checklist_triggers")
          .insert(tPayload);
        if (insErr) throw insErr;
      }

      toast.success("Pergunta salva");
      setDialogOpen(false);
      load();
    } catch (e) {
      handleError(e, "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const { error } = await supabase
        .from("quote_checklist_questions")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Pergunta removida");
      load();
    } catch (e) {
      handleError(e, "Erro ao remover");
    } finally {
      setConfirmDel(null);
    }
  };

  const toggleAtivo = async (q: Question) => {
    try {
      const { error } = await supabase
        .from("quote_checklist_questions")
        .update({ ativo: !q.ativo })
        .eq("id", q.id);
      if (error) throw error;
      load();
    } catch (e) {
      handleError(e, "Erro ao atualizar");
    }
  };

  const triggerLabel = (qid: string) => {
    const t = triggers.find((x) => x.question_id === qid);
    if (!t) return <span className="text-muted-foreground italic">sem gatilho</span>;
    if (t.sempre) return <Badge variant="secondary">sempre</Badge>;
    const parts: string[] = [];
    if (t.tipo_midia?.length) parts.push(`mídia: ${t.tipo_midia.join(", ")}`);
    if (t.familia_acab?.length) parts.push(`fam: ${t.familia_acab.join(", ")}`);
    if (t.area_min_m2) parts.push(`área≥${t.area_min_m2}m²`);
    if (t.area_max_m2) parts.push(`área≤${t.area_max_m2}m²`);
    if (t.altura_min_m) parts.push(`altura≥${t.altura_min_m}m`);
    return <span className="text-xs">{parts.join(" · ") || "—"}</span>;
  };

  const fq = form.question;
  const ft = form.trigger;
  const showLabor = fq.tipo_resposta === "sim_nao_valor";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ListChecks className="h-5 w-5 text-primary" />
                Checklist de Orçamento
              </h2>
              <p className="text-sm text-muted-foreground">
                Perguntas-chave que aparecem no orçamento quando determinadas condições são atendidas.
              </p>
            </div>
            {isAdmin && (
              <Button onClick={openNew} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova pergunta
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ordem</TableHead>
                  <TableHead>Pergunta</TableHead>
                  <TableHead className="w-32">Tipo</TableHead>
                  <TableHead className="w-32">Categoria</TableHead>
                  <TableHead>Gatilho</TableHead>
                  <TableHead className="w-20 text-center">Ativo</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      Nenhuma pergunta cadastrada.
                    </TableCell>
                  </TableRow>
                )}
                {questions.map((q) => (
                  <TableRow key={q.id} className={!q.ativo ? "opacity-50" : ""}>
                    <TableCell>{q.sort_order}</TableCell>
                    <TableCell className="font-medium">{q.pergunta}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {TIPOS_RESPOSTA.find((t) => t.value === q.tipo_resposta)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{q.categoria}</TableCell>
                    <TableCell>{triggerLabel(q.id)}</TableCell>
                    <TableCell className="text-center">
                      <Switch checked={q.ativo} onCheckedChange={() => toggleAtivo(q)} disabled={!isAdmin} />
                    </TableCell>
                    <TableCell>
                      {isAdmin && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDel(q.id)}>
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
            <DialogTitle>{editingId ? "Editar pergunta" : "Nova pergunta"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Pergunta *</Label>
              <Input
                value={fq.pergunta ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, question: { ...f.question, pergunta: e.target.value } }))}
                placeholder="Ex.: Necessita desinstalar a lona antiga?"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tipo de resposta</Label>
                <Select
                  value={fq.tipo_resposta}
                  onValueChange={(v) => setForm((f) => ({ ...f, question: { ...f.question, tipo_resposta: v } }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_RESPOSTA.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select
                  value={fq.categoria}
                  onValueChange={(v) => setForm((f) => ({ ...f, question: { ...f.question, categoria: v } }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={fq.sort_order ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, question: { ...f.question, sort_order: Number(e.target.value) } }))}
                />
              </div>
            </div>

            <div>
              <Label>Dica / contexto (opcional)</Label>
              <Textarea
                value={fq.hint ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, question: { ...f.question, hint: e.target.value } }))}
                rows={2}
                placeholder="Explicação curta para a equipe de orçamento"
              />
            </div>

            {showLabor && (
              <Card className="bg-muted/30">
                <CardContent className="p-3 space-y-3">
                  <div className="text-sm font-medium">Mão de obra automática (quando "Sim")</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Descrição</Label>
                      <Input
                        value={fq.labor_descricao ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, question: { ...f.question, labor_descricao: e.target.value } }))}
                        placeholder="Ex.: Desinstalação de lona antiga"
                      />
                    </div>
                    <div>
                      <Label>Custo por m² (R$)</Label>
                      <Input
                        type="number" step="0.01"
                        value={fq.labor_custo_m2 ?? 0}
                        onChange={(e) => setForm((f) => ({ ...f, question: { ...f.question, labor_custo_m2: Number(e.target.value) } }))}
                      />
                    </div>
                    <div>
                      <Label>Custo fixo (R$)</Label>
                      <Input
                        type="number" step="0.01"
                        value={fq.labor_custo_fixo ?? 0}
                        onChange={(e) => setForm((f) => ({ ...f, question: { ...f.question, labor_custo_fixo: Number(e.target.value) } }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Tipo de etapa</Label>
                      <Select
                        value={fq.labor_step_type ?? "outro"}
                        onValueChange={(v) => setForm((f) => ({ ...f, question: { ...f.question, labor_step_type: v } }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STEP_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Quando esta pergunta deve aparecer?</div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Sempre</Label>
                    <Switch
                      checked={!!ft.sempre}
                      onCheckedChange={(v) => setForm((f) => ({ ...f, trigger: { ...f.trigger, sempre: v } }))}
                    />
                  </div>
                </div>

                {!ft.sempre && (
                  <>
                    <div>
                      <Label className="text-xs">Tipos de mídia</Label>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {TIPOS_MIDIA.map((m) => (
                          <label key={m} className="flex items-center gap-1.5 text-sm capitalize cursor-pointer">
                            <Checkbox
                              checked={ft.tipo_midia?.includes(m) ?? false}
                              onCheckedChange={() => setForm((f) => ({ ...f, trigger: { ...f.trigger, tipo_midia: toggleArr(f.trigger.tipo_midia, m) } }))}
                            />
                            {m}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Famílias de acabamento (opcional)</Label>
                      <div className="flex flex-wrap gap-3 mt-1">
                        {FAMILIAS_ACAB.map((fa) => (
                          <label key={fa} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <Checkbox
                              checked={ft.familia_acab?.includes(fa) ?? false}
                              onCheckedChange={() => setForm((f) => ({ ...f, trigger: { ...f.trigger, familia_acab: toggleArr(f.trigger.familia_acab, fa) } }))}
                            />
                            {fa}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs">Área mín (m²)</Label>
                        <Input
                          type="number" step="0.1"
                          value={ft.area_min_m2 ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, trigger: { ...f.trigger, area_min_m2: e.target.value ? Number(e.target.value) : null } }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Área máx (m²)</Label>
                        <Input
                          type="number" step="0.1"
                          value={ft.area_max_m2 ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, trigger: { ...f.trigger, area_max_m2: e.target.value ? Number(e.target.value) : null } }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Altura mín (m)</Label>
                        <Input
                          type="number" step="0.1"
                          value={ft.altura_min_m ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, trigger: { ...f.trigger, altura_min_m: e.target.value ? Number(e.target.value) : null } }))}
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center gap-2">
              <Switch
                checked={fq.ativo ?? true}
                onCheckedChange={(v) => setForm((f) => ({ ...f, question: { ...f.question, ativo: v } }))}
              />
              <Label>Pergunta ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title="Remover pergunta?"
        description="As respostas já registradas nos orçamentos serão apagadas."
        onConfirm={() => confirmDel && remove(confirmDel)}
      />
    </div>
  );
}
