import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ListChecks, ChevronDown } from "lucide-react";
import {
  QuoteChecklist,
  type ChecklistAnswerState,
} from "@/components/orcamentos-v3/listing/QuoteChecklist";
import type { CVItemState } from "@/components/orcamentos-v3/listing/CVItemCard";
import type { Midia as CVMidia, Acabamento as CVAcabamento } from "@/lib/cv-calc/engine";
import { genId, type V3CVItem, type V3Item, type V3LaborItem } from "../types";

interface Props {
  items: V3Item[];
  quoteId: string | null;
  onItemsChange: (next: V3Item[]) => void;
  /** Notifica respostas pra ser usado por outros panels (Assistant). */
  onAnswersChange?: (answers: { pergunta: string; resposta: string }[]) => void;
}

const BUNDLE_PREFIX = "checklist:";

export function QuoteChecklistPanelV3({ items, quoteId, onItemsChange, onAnswersChange }: Props) {
  const [midias, setMidias] = useState<CVMidia[]>([]);
  const [acabs, setAcabs] = useState<CVAcabamento[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [pending, setPending] = useState(0);
  const [questions, setQuestions] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const [m, a, q] = await Promise.all([
        supabase.from("cv_calc_midias").select("*"),
        supabase.from("cv_calc_acabamentos").select("*"),
        supabase.from("quote_checklist_questions").select("id, pergunta"),
      ]);
      setMidias((m.data ?? []) as unknown as CVMidia[]);
      setAcabs((a.data ?? []) as unknown as CVAcabamento[]);
      const qm: Record<string, string> = {};
      (q.data ?? []).forEach((x: any) => { qm[x.id] = x.pergunta; });
      setQuestions(qm);
    })();
  }, []);

  const cvItems: CVItemState[] = items
    .filter((it): it is V3CVItem => it.kind === "cv")
    .map((it) => ({
      id: it.id,
      material_id: it.midia_id ?? null,
      printer_id: it.impressao_id ?? null,
      largura_cm: (it.largura_m || 0) * 100,
      altura_cm: (it.altura_m || 0) * 100,
      quantidade: it.quantidade || 1,
      acabamentos: (it.acabamento_ids ?? []).map((fid) => ({
        finish_id: fid,
        quantidade_unidades: it.acabamentos_qtd_unidades?.[fid] ?? 1,
      })),
    }));

  const handleAnswersChange = (answers: ChecklistAnswerState[]) => {
    if (!onAnswersChange) return;
    const list = answers.map((a) => ({
      pergunta: questions[a.question_id] ?? a.question_id,
      resposta:
        a.resposta_bool != null ? (a.resposta_bool ? "Sim" : "Não") :
        a.resposta_num != null ? String(a.resposta_num) :
        a.resposta_text ?? a.resposta_url ?? "",
    }));
    onAnswersChange(list);
  };

  const handleAutoLabor = (questionId: string, payload: { description: string; totalValue: number } | null) => {
    const bundleId = BUNDLE_PREFIX + questionId;
    const filtered = items.filter((it) => it.bundle_id !== bundleId);
    if (payload && payload.totalValue > 0) {
      const labor: V3LaborItem = {
        id: genId(),
        kind: "labor",
        descricao: payload.description,
        time_minutes: 60,
        step_type: "outro",
        hourly_rate: payload.totalValue,
        margem_pct: 0,
        bundle_id: bundleId,
        bundle_label: "Checklist",
      };
      onItemsChange([...filtered, labor]);
    } else if (filtered.length !== items.length) {
      onItemsChange(filtered);
    }
  };

  if (cvItems.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/[0.02]">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium"
      >
        <ListChecks className="h-4 w-4 text-primary" />
        <span>Checklist</span>
        {pending > 0 ? (
          <Badge variant="destructive" className="ml-1 h-5">{pending}</Badge>
        ) : null}
        <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      {!collapsed && (
        <div className="px-3 pb-3">
          <QuoteChecklist
            quoteId={quoteId}
            cvItems={cvItems}
            cvMaterials={midias}
            cvFinishes={acabs}
            onAnswersChange={handleAnswersChange}
            onAutoLaborChange={handleAutoLabor}
            onPendingChange={setPending}
            embedded
          />
        </div>
      )}
    </Card>
  );
}
