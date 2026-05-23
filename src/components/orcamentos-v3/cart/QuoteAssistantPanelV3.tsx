import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Sparkles, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QuoteAssistant } from "@/components/orcamentos-v3/listing/QuoteAssistant";
import type { CVItemState } from "@/components/orcamentos-v3/listing/CVItemCard";
import type { V3CVItem, V3Item } from "../types";

interface Props {
  items: V3Item[];
  clientId: string | null;
  clientName: string;
  checklistAnswers?: { pergunta: string; resposta: string }[];
}

interface MidiaRow { id: string; tipo_midia: string }
interface AcabRow { id: string; nome: string; familia: string }

/**
 * Adapter: feeds the legacy QuoteAssistant (CV-based) using the V3 cart state.
 * Only CV items contribute to material/area/finish heuristics; other kinds are
 * ignored — assistant rules in DB are CV-centric.
 */
export function QuoteAssistantPanelV3({ items, clientId, clientName }: Props) {
  const [midias, setMidias] = useState<MidiaRow[]>([]);
  const [acabs, setAcabs] = useState<AcabRow[]>([]);
  const [clientTags, setClientTags] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    (async () => {
      const [m, a] = await Promise.all([
        supabase.from("cv_calc_midias").select("id, tipo_midia"),
        supabase.from("cv_calc_acabamentos").select("id, nome, familia"),
      ]);
      setMidias((m.data ?? []) as MidiaRow[]);
      setAcabs((a.data ?? []) as AcabRow[]);
    })();
  }, []);

  useEffect(() => {
    if (!clientId) { setClientTags([]); return; }
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("tags")
        .eq("id", clientId)
        .maybeSingle();
      const tags = (data as any)?.tags;
      setClientTags(Array.isArray(tags) ? tags.filter((t: any) => typeof t === "string") : []);
    })();
  }, [clientId]);

  const cvItems: CVItemState[] = useMemo(() => {
    return items
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
  }, [items]);

  if (cvItems.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-primary/[0.02]">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Assistente</span>
        {count > 0 && <Badge variant="secondary" className="ml-1">{count}</Badge>}
        <ChevronDown className={`h-4 w-4 ml-auto transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      {!collapsed && (
        <div className="px-3 pb-3">
          <QuoteAssistant
            cvItems={cvItems}
            cvMaterials={midias}
            cvFinishes={acabs}
            clientTags={clientTags}
            clientName={clientName}
            embedded
            onCountChange={setCount}
          />
        </div>
      )}
    </Card>
  );
}
