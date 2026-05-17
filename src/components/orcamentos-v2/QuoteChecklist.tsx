import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ListChecks, ChevronDown, ChevronUp, Paperclip, Loader2,
  AlertCircle, CheckCircle2, Image as ImageIcon, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CVItemState } from "@/components/orcamentos-v2/CVItemCard";
import type { Midia as CVMidia, Acabamento as CVAcabamento } from "@/lib/cv-calc/engine";

export interface ChecklistQuestion {
  id: string;
  pergunta: string;
  tipo_resposta: "sim_nao" | "sim_nao_valor" | "texto" | "foto";
  categoria: string;
  hint: string | null;
  ativo: boolean;
  sort_order: number;
  labor_descricao: string | null;
  labor_custo_m2: number;
  labor_custo_fixo: number;
  labor_step_type: string | null;
}

export interface ChecklistTrigger {
  id: string;
  question_id: string;
  tipo_midia: string[];
  familia_acab: string[];
  area_min_m2: number | null;
  area_max_m2: number | null;
  altura_min_m: number | null;
  sempre: boolean;
}

export interface ChecklistAnswerState {
  question_id: string;
  resposta_bool?: boolean | null;
  resposta_num?: number | null;
  resposta_text?: string | null;
  resposta_url?: string | null;
}

interface Props {
  quoteId: string | null;
  cvItems: CVItemState[];
  cvMaterials: CVMidia[];
  cvFinishes: CVAcabamento[];
  onAnswersChange: (answers: ChecklistAnswerState[]) => void;
  /** Quando "Sim" em sim_nao_valor, deve adicionar (ou remover quando "Não") um item de mão de obra avulsa. */
  onAutoLaborChange: (questionId: string, item: { description: string; totalValue: number } | null) => void;
}

export function QuoteChecklist({
  quoteId, cvItems, cvMaterials, cvFinishes,
  onAnswersChange, onAutoLaborChange,
}: Props) {
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [triggers, setTriggers] = useState<ChecklistTrigger[]>([]);
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswerState>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  // Carrega perguntas + gatilhos e respostas existentes
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [qRes, tRes, aRes] = await Promise.all([
          supabase.from("quote_checklist_questions").select("*").eq("ativo", true).order("sort_order"),
          supabase.from("quote_checklist_triggers").select("*"),
          quoteId
            ? supabase.from("quote_checklist_answers").select("*").eq("quote_id", quoteId)
            : Promise.resolve({ data: [] as any[] }),
        ]);
        setQuestions((qRes.data ?? []) as ChecklistQuestion[]);
        setTriggers((tRes.data ?? []) as ChecklistTrigger[]);
        const loaded: Record<string, ChecklistAnswerState> = {};
        ((aRes as any).data ?? []).forEach((a: any) => {
          loaded[a.question_id] = {
            question_id: a.question_id,
            resposta_bool: a.resposta_bool,
            resposta_num: a.resposta_num,
            resposta_text: a.resposta_text,
            resposta_url: a.resposta_url,
          };
        });
        setAnswers(loaded);
      } catch (e) {
        // silencioso — checklist é opcional
      } finally {
        setLoading(false);
      }
    })();
  }, [quoteId]);

  // Contexto agregado dos itens CV
  const ctx = useMemo(() => {
    const midiaTipos = new Set<string>();
    let maxAreaM2 = 0;
    let totalAreaM2 = 0;
    let maxAlturaM = 0;
    const familias = new Set<string>();
    cvItems.forEach((it) => {
      const m = cvMaterials.find((x) => x.id === it.material_id);
      if (m?.tipo_midia) midiaTipos.add(m.tipo_midia);
      const area = ((it.largura_cm || 0) * (it.altura_cm || 0)) / 10000 * (it.quantidade || 1);
      const areaSingle = ((it.largura_cm || 0) * (it.altura_cm || 0)) / 10000;
      maxAreaM2 = Math.max(maxAreaM2, areaSingle);
      totalAreaM2 += area;
      maxAlturaM = Math.max(maxAlturaM, (it.altura_cm || 0) / 100);
      it.acabamentos.forEach((a) => {
        const f = cvFinishes.find((x) => x.id === a.finish_id);
        if (f?.familia) familias.add(f.familia);
      });
    });
    return { midiaTipos, maxAreaM2, totalAreaM2, maxAlturaM, familias };
  }, [cvItems, cvMaterials, cvFinishes]);

  const triggerMatches = useCallback((q: ChecklistQuestion): boolean => {
    const ts = triggers.filter((t) => t.question_id === q.id);
    if (ts.length === 0) return false;
    return ts.some((t) => {
      if (t.sempre) return true;
      if (t.tipo_midia?.length && !t.tipo_midia.some((m) => ctx.midiaTipos.has(m))) return false;
      if (t.familia_acab?.length && !t.familia_acab.some((f) => ctx.familias.has(f))) return false;
      if (t.area_min_m2 != null && ctx.maxAreaM2 < Number(t.area_min_m2)) return false;
      if (t.area_max_m2 != null && ctx.maxAreaM2 > Number(t.area_max_m2)) return false;
      if (t.altura_min_m != null && ctx.maxAlturaM < Number(t.altura_min_m)) return false;
      return true;
    });
  }, [triggers, ctx]);

  const relevant = useMemo(
    () => questions.filter(triggerMatches),
    [questions, triggerMatches],
  );

  // Propaga respostas para o pai (apenas perguntas relevantes que têm valor)
  useEffect(() => {
    const list: ChecklistAnswerState[] = relevant
      .map((q) => answers[q.id])
      .filter((a): a is ChecklistAnswerState => {
        if (!a) return false;
        return (
          a.resposta_bool != null ||
          a.resposta_num != null ||
          (a.resposta_text != null && a.resposta_text !== "") ||
          (a.resposta_url != null && a.resposta_url !== "")
        );
      });
    onAnswersChange(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, relevant]);

  // Ao mudar "Sim/Não" em sim_nao_valor, sincroniza mão de obra avulsa
  const syncAutoLabor = (q: ChecklistQuestion, simNao: boolean | null) => {
    if (q.tipo_resposta !== "sim_nao_valor") return;
    if (simNao === true && q.labor_descricao) {
      const total = (Number(q.labor_custo_m2) || 0) * ctx.totalAreaM2 + (Number(q.labor_custo_fixo) || 0);
      onAutoLaborChange(q.id, {
        description: q.labor_descricao + " (checklist)",
        totalValue: Math.max(0, total),
      });
    } else {
      onAutoLaborChange(q.id, null);
    }
  };

  // Sempre que área/quantidade mudar e houver "Sim" em sim_nao_valor, recalcula mão de obra
  useEffect(() => {
    relevant.forEach((q) => {
      if (q.tipo_resposta === "sim_nao_valor" && answers[q.id]?.resposta_bool === true) {
        syncAutoLabor(q, true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.totalAreaM2, relevant]);

  // Quando uma pergunta deixa de ser relevante, remove sua mão de obra automática
  useEffect(() => {
    const ids = new Set(relevant.map((q) => q.id));
    Object.keys(answers).forEach((qid) => {
      if (!ids.has(qid) && answers[qid]?.resposta_bool === true) {
        const q = questions.find((x) => x.id === qid);
        if (q?.tipo_resposta === "sim_nao_valor") onAutoLaborChange(qid, null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevant]);

  const setAns = (qid: string, patch: Partial<ChecklistAnswerState>) =>
    setAnswers((prev) => ({ ...prev, [qid]: { question_id: qid, ...prev[qid], ...patch } }));

  const handleSimNao = (q: ChecklistQuestion, value: boolean) => {
    setAns(q.id, { resposta_bool: value });
    syncAutoLabor(q, value);
  };

  const handleUpload = async (q: ChecklistQuestion, file: File) => {
    setUploadingId(q.id);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${quoteId ?? "draft"}/${q.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("quote-attachments").upload(path, file, { upsert: true });
      if (error) throw error;
      setAns(q.id, { resposta_url: path });
      toast.success("Foto enviada");
    } catch (e: any) {
      toast.error("Falha no upload: " + e.message);
    } finally {
      setUploadingId(null);
    }
  };

  const pending = relevant.filter((q) => {
    const a = answers[q.id];
    if (!a) return true;
    if (q.tipo_resposta === "sim_nao" || q.tipo_resposta === "sim_nao_valor") return a.resposta_bool == null;
    if (q.tipo_resposta === "texto") return !a.resposta_text;
    if (q.tipo_resposta === "foto") return !a.resposta_url;
    return false;
  }).length;

  if (loading) return null;
  if (relevant.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between p-3 hover:bg-primary/10 transition-colors">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Checklist do orçamento</span>
              {pending > 0 ? (
                <Badge variant="destructive" className="h-5 text-xs">{pending} pendente{pending > 1 ? "s" : ""}</Badge>
              ) : (
                <Badge variant="secondary" className="h-5 text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Tudo respondido
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">({relevant.length} pergunta{relevant.length > 1 ? "s" : ""})</span>
            </div>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-3 space-y-2">
            {relevant.map((q) => {
              const a = answers[q.id];
              const answered = a && (
                a.resposta_bool != null ||
                !!a.resposta_text ||
                !!a.resposta_url
              );
              return (
                <div
                  key={q.id}
                  className={`rounded-md border p-3 space-y-2 ${
                    answered ? "bg-background border-border" : "bg-amber-50 dark:bg-amber-950/20 border-amber-300/50"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!answered && <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <div className="text-sm font-medium">{q.pergunta}</div>
                      {q.hint && <div className="text-xs text-muted-foreground mt-0.5">{q.hint}</div>}
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">{q.categoria}</Badge>
                  </div>

                  {(q.tipo_resposta === "sim_nao" || q.tipo_resposta === "sim_nao_valor") && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={a?.resposta_bool === true ? "default" : "outline"}
                        onClick={() => handleSimNao(q, true)}
                        className="h-7"
                      >
                        Sim
                      </Button>
                      <Button
                        size="sm"
                        variant={a?.resposta_bool === false ? "default" : "outline"}
                        onClick={() => handleSimNao(q, false)}
                        className="h-7"
                      >
                        Não
                      </Button>
                      {q.tipo_resposta === "sim_nao_valor" && a?.resposta_bool === true && q.labor_descricao && (
                        <span className="text-xs text-muted-foreground">
                          → mão de obra "<b>{q.labor_descricao}</b>" adicionada automaticamente
                          ({(Number(q.labor_custo_m2) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/m²
                          {q.labor_custo_fixo > 0 && ` + fixo ${q.labor_custo_fixo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`})
                        </span>
                      )}
                    </div>
                  )}

                  {q.tipo_resposta === "texto" && (
                    <Textarea
                      value={a?.resposta_text ?? ""}
                      onChange={(e) => setAns(q.id, { resposta_text: e.target.value })}
                      placeholder="Resposta..."
                      rows={2}
                      className="text-sm"
                    />
                  )}

                  {q.tipo_resposta === "foto" && (
                    <div className="flex items-center gap-2">
                      {a?.resposta_url ? (
                        <>
                          <ImageIcon className="h-4 w-4 text-primary" />
                          <span className="text-xs truncate flex-1">{a.resposta_url}</span>
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => setAns(q.id, { resposta_url: null })}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <label className="cursor-pointer">
                          <Button asChild variant="outline" size="sm" className="h-7 gap-1.5" disabled={uploadingId === q.id}>
                            <span>
                              {uploadingId === q.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Paperclip className="h-3.5 w-3.5" />
                              )}
                              Anexar foto
                            </span>
                          </Button>
                          <input
                            type="file" accept="image/*" className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUpload(q, f);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
