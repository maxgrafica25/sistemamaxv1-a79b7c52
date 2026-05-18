import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, Info, AlertCircle, X, ChevronDown, History, Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CVItemState } from "@/components/orcamentos-v2/CVItemCard";

interface HistSuggestion {
  acabamento_id: string;
  nome: string;
  count: number;
  total: number;
  pct: number;
}

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

interface AiSuggestion {
  tipo: "acabamento" | "pergunta" | "alerta";
  alvo_id: string | null;
  mensagem: string;
  justificativa: string;
}

interface Props {
  cvItems: CVItemState[];
  cvMaterials: { id: string; tipo_midia: string }[];
  cvFinishes: { id: string; nome: string; familia: string }[];
  clientTags: string[];
  clientName?: string;
  checklistAnswers?: { pergunta: string; resposta: string }[];
  /** Quando true, esconde o próprio header (usado em cartão unificado com abas). */
  embedded?: boolean;
  /** Notifica o total de sugestões ativas para badges externos. */
  onCountChange?: (count: number) => void;
}

const SEV_ICON: Record<string, any> = {
  info: Info,
  aviso: AlertTriangle,
  critico: AlertCircle,
};
const SEV_COLOR: Record<string, string> = {
  info: "text-primary border-primary/30 bg-primary/5",
  aviso: "text-amber-700 dark:text-amber-300 border-amber-500/40 bg-amber-500/10",
  critico: "text-destructive border-destructive/40 bg-destructive/10",
};

export function QuoteAssistant({ cvItems, cvMaterials, cvFinishes, clientTags, clientName, checklistAnswers, embedded, onCountChange }: Props) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [acabNames, setAcabNames] = useState<Record<string, string>>({});
  const [questionNames, setQuestionNames] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const [hist, setHist] = useState<HistSuggestion[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histDismissed, setHistDismissed] = useState<Set<string>>(new Set());
  const histTimer = useRef<number | null>(null);

  const [ai, setAi] = useState<AiSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDismissed, setAiDismissed] = useState<Set<number>>(new Set());
  const [aiRanAt, setAiRanAt] = useState<number | null>(null);
  const aiTimer = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const [r, a, q] = await Promise.all([
        supabase.from("quote_suggestion_rules").select("*").eq("ativo", true).order("prioridade"),
        supabase.from("cv_calc_acabamentos").select("id, nome"),
        supabase.from("quote_checklist_questions").select("id, pergunta"),
      ]);
      setRules((r.data ?? []) as Rule[]);
      const am: Record<string, string> = {};
      (a.data ?? []).forEach((x: any) => { am[x.id] = x.nome; });
      setAcabNames(am);
      const qm: Record<string, string> = {};
      (q.data ?? []).forEach((x: any) => { qm[x.id] = x.pergunta; });
      setQuestionNames(qm);
    })();
  }, []);

  const ctx = useMemo(() => {
    const midiaTipos = new Set<string>();
    let maxAreaM2 = 0;
    let maxAlturaM = 0;
    const familias = new Set<string>();
    cvItems.forEach((it) => {
      const m = cvMaterials.find((x) => x.id === it.material_id);
      if (m?.tipo_midia) midiaTipos.add(m.tipo_midia);
      const areaSingle = ((it.largura_cm || 0) * (it.altura_cm || 0)) / 10000;
      maxAreaM2 = Math.max(maxAreaM2, areaSingle);
      maxAlturaM = Math.max(maxAlturaM, (it.altura_cm || 0) / 100);
      it.acabamentos.forEach((a) => {
        const f = cvFinishes.find((x) => x.id === a.finish_id);
        if (f?.familia) familias.add(f.familia);
      });
    });
    const tagsLower = new Set(clientTags.map((t) => t.toLowerCase()));
    return { midiaTipos, maxAreaM2, maxAlturaM, familias, tagsLower };
  }, [cvItems, cvMaterials, cvFinishes, clientTags]);

  const matches = (r: Rule): boolean => {
    if (r.cond_sempre) return true;
    if (r.cond_tipo_midia?.length && !r.cond_tipo_midia.some((m) => ctx.midiaTipos.has(m))) return false;
    if (r.cond_familia?.length && !r.cond_familia.some((f) => ctx.familias.has(f))) return false;
    if (r.cond_area_min != null && ctx.maxAreaM2 < Number(r.cond_area_min)) return false;
    if (r.cond_area_max != null && ctx.maxAreaM2 > Number(r.cond_area_max)) return false;
    if (r.cond_altura_min != null && ctx.maxAlturaM < Number(r.cond_altura_min)) return false;
    if (r.cond_cliente_tag?.length && !r.cond_cliente_tag.some((t) => ctx.tagsLower.has(t.toLowerCase()))) return false;
    const hasAnyCond =
      r.cond_tipo_midia?.length || r.cond_familia?.length ||
      r.cond_area_min != null || r.cond_area_max != null ||
      r.cond_altura_min != null || r.cond_cliente_tag?.length;
    if (!hasAnyCond) return false;
    return true;
  };

  const ativas = useMemo(
    () => rules.filter((r) => !dismissed.has(r.id) && matches(r)),
    [rules, ctx, dismissed],
  );

  // Phase 3b: padrão histórico (debounced)
  const histPayload = useMemo(() => {
    const items = cvItems
      .filter((it) => it.material_id)
      .map((it) => ({
        material_id: it.material_id,
        area_m2: ((it.largura_cm || 0) * (it.altura_cm || 0)) / 10000,
      }));
    const current_finish_ids = [
      ...new Set(cvItems.flatMap((it) => it.acabamentos.map((a) => a.finish_id))),
    ];
    return { items, current_finish_ids };
  }, [cvItems]);

  useEffect(() => {
    if (histTimer.current) window.clearTimeout(histTimer.current);
    if (histPayload.items.length === 0) {
      setHist([]);
      return;
    }
    histTimer.current = window.setTimeout(async () => {
      try {
        setHistLoading(true);
        const { data, error } = await supabase.functions.invoke("historical-suggestions", {
          body: histPayload,
        });
        if (error) throw error;
        setHist((data?.suggestions ?? []) as HistSuggestion[]);
      } catch {
        setHist([]);
      } finally {
        setHistLoading(false);
      }
    }, 800) as unknown as number;
    return () => {
      if (histTimer.current) window.clearTimeout(histTimer.current);
    };
  }, [histPayload]);

  const histVisible = hist.filter((h) => !histDismissed.has(h.acabamento_id));

  // Phase 3c: IA contextual (Gemini)
  const aiPayload = useMemo(() => {
    const items = cvItems
      .filter((it) => it.material_id)
      .map((it) => {
        const m = cvMaterials.find((x) => x.id === it.material_id);
        const acabs = it.acabamentos
          .map((a) => cvFinishes.find((f) => f.id === a.finish_id)?.nome)
          .filter(Boolean) as string[];
        return {
          material_id: it.material_id,
          material_nome: m ? (m as any).nome ?? null : null,
          tipo_midia: m?.tipo_midia ?? null,
          largura_cm: it.largura_cm || 0,
          altura_cm: it.altura_cm || 0,
          quantidade: it.quantidade || 1,
          area_m2: ((it.largura_cm || 0) * (it.altura_cm || 0)) / 10000,
          acabamentos: acabs,
        };
      });
    return {
      client_name: clientName ?? null,
      client_tags: clientTags,
      items,
      checklist_answers: checklistAnswers ?? [],
    };
  }, [cvItems, cvMaterials, cvFinishes, clientName, clientTags, checklistAnswers]);

  const runAi = async (manual = false) => {
    if (aiPayload.items.length === 0) return;
    try {
      setAiLoading(true);
      const { data, error } = await supabase.functions.invoke("quote-ai-assistant", {
        body: aiPayload,
      });
      if (error) throw error;
      if ((data as any)?.error === "rate_limited") {
        if (manual) toast.error("IA sobrecarregada. Tente em alguns segundos.");
        return;
      }
      if ((data as any)?.error === "credits_exhausted") {
        if (manual) toast.error("Sem créditos no Gemini.");
        return;
      }
      setAi(((data as any)?.suggestions ?? []) as AiSuggestion[]);
      setAiDismissed(new Set());
      setAiRanAt(Date.now());
    } catch (e) {
      if (manual) toast.error("Erro ao consultar IA: " + (e as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-run debounced 4s após estabilizar
  useEffect(() => {
    if (aiTimer.current) window.clearTimeout(aiTimer.current);
    if (aiPayload.items.length === 0) {
      setAi([]);
      return;
    }
    aiTimer.current = window.setTimeout(() => {
      runAi(false);
    }, 4000) as unknown as number;
    return () => {
      if (aiTimer.current) window.clearTimeout(aiTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPayload]);

  const aiVisible = ai.filter((_, i) => !aiDismissed.has(i));

  const totalCount = ativas.length + histVisible.length + aiVisible.length;
  useEffect(() => {
    onCountChange?.(totalCount);
  }, [totalCount, onCountChange]);

  if (rules.length === 0 && cvItems.length === 0 && !embedded) return null;

  const body = (
    <CardContent className={embedded ? "p-0 space-y-2" : "p-3 space-y-2"}>
      {!embedded && (
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 text-sm font-medium"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span>Assistente do orçamento</span>
          {totalCount > 0 && (
            <Badge variant="secondary" className="ml-1">{totalCount}</Badge>
          )}
          <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${collapsed ? "-rotate-90" : ""}`} />
        </button>
      )}

      {(embedded || !collapsed) && (
          <div className="space-y-2 pt-1">
            {ativas.length === 0 && histVisible.length === 0 && aiVisible.length === 0 && !histLoading && !aiLoading ? (
              <p className="text-xs text-muted-foreground px-1">
                {cvItems.length === 0
                  ? "Adicione itens CV para receber sugestões."
                  : "Nenhuma sugestão para este orçamento. 👍"}
              </p>
            ) : (
              <>
                {ativas.map((r) => {
                  const Icon = SEV_ICON[r.severidade] ?? Info;
                  const extra =
                    r.acao_tipo === "sugerir_acabamento" && r.acao_acab_id
                      ? `Acabamento sugerido: ${acabNames[r.acao_acab_id] ?? "—"}`
                      : r.acao_tipo === "sugerir_pergunta" && r.acao_question_id
                      ? `Pergunta: ${questionNames[r.acao_question_id] ?? "—"}`
                      : null;
                  return (
                    <div key={r.id} className={`rounded-md border px-3 py-2 flex gap-2 ${SEV_COLOR[r.severidade] ?? ""}`}>
                      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold flex items-center gap-1">
                          <span className="opacity-60">🔧</span>{r.nome}
                        </div>
                        {r.acao_mensagem && (
                          <div className="text-xs opacity-90 mt-0.5">{r.acao_mensagem}</div>
                        )}
                        {extra && <div className="text-[11px] opacity-75 mt-0.5">{extra}</div>}
                      </div>
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="h-6 w-6 shrink-0 hover:bg-foreground/10"
                        onClick={() => setDismissed((d) => new Set(d).add(r.id))}
                        title="Dispensar nesta sessão"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}

                {histVisible.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 pb-1 flex items-center gap-1">
                      <History className="h-3 w-3" /> Padrão histórico
                    </div>
                    {histVisible.map((h) => (
                      <div key={h.acabamento_id} className="rounded-md border border-primary/20 bg-primary/[0.04] px-3 py-2 flex gap-2 mb-1">
                        <span className="text-base leading-none">📊</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold">{h.nome || "Acabamento"}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Incluso em {h.count} de {h.total} orçamentos parecidos ({h.pct}%).
                          </div>
                        </div>
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="h-6 w-6 shrink-0 hover:bg-foreground/10"
                          onClick={() => setHistDismissed((d) => new Set(d).add(h.acabamento_id))}
                          title="Dispensar nesta sessão"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {aiVisible.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 pb-1 flex items-center gap-1">
                      <Bot className="h-3 w-3" /> IA contextual {aiRanAt && <span className="opacity-60">· Gemini</span>}
                    </div>
                    {aiVisible.map((s, i) => (
                      <div key={i} className="rounded-md border border-primary/30 bg-primary/[0.06] px-3 py-2 flex gap-2 mb-1">
                        <span className="text-base leading-none">🤖</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold">{s.mensagem}</div>
                          {s.justificativa && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">{s.justificativa}</div>
                          )}
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mt-1">
                            {s.tipo}
                            {s.alvo_id && s.tipo === "acabamento" && acabNames[s.alvo_id] ? ` · ${acabNames[s.alvo_id]}` : ""}
                            {s.alvo_id && s.tipo === "pergunta" && questionNames[s.alvo_id] ? ` · ${questionNames[s.alvo_id]}` : ""}
                          </div>
                        </div>
                        <Button
                          type="button" variant="ghost" size="icon"
                          className="h-6 w-6 shrink-0 hover:bg-foreground/10"
                          onClick={() => setAiDismissed((d) => new Set(d).add(ai.indexOf(s)))}
                          title="Dispensar nesta sessão"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {histLoading && histVisible.length === 0 && ativas.length === 0 && (
                  <p className="text-[11px] text-muted-foreground px-1">Buscando padrões…</p>
                )}
              </>
            )}

            {cvItems.length > 0 && (
              <div className="pt-1 flex items-center justify-between gap-2">
                <Button
                  type="button" variant="outline" size="sm"
                  className="h-7 text-xs"
                  disabled={aiLoading}
                  onClick={() => runAi(true)}
                >
                  {aiLoading ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Consultando IA…</>
                  ) : (
                    <><Bot className="h-3 w-3 mr-1" /> Pedir opinião da IA</>
                  )}
                </Button>
                {aiRanAt && !aiLoading && (
                  <span className="text-[10px] text-muted-foreground">
                    Última: {new Date(aiRanAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
    </CardContent>
  );

  if (embedded) return body;
  return <Card className="border-primary/30 bg-primary/[0.02]">{body}</Card>;
}
