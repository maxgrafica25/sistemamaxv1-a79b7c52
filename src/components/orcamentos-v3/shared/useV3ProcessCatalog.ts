// Carrega processos individuais + grupos para o ProcessPicker no V3.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  ProcessStep,
  ProcessGroup,
} from "@/components/orcamentos-v2/ProcessPicker";

export function useV3ProcessCatalog() {
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [groups, setGroups] = useState<ProcessGroup[]>([]);
  const [allSteps, setAllSteps] = useState<ProcessStep[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [stepsRes, groupsRes, groupItemsRes] = await Promise.all([
        supabase
          .from("production_steps")
          .select("id, description, time_minutes, step_type")
          .order("description"),
        supabase.from("step_groups").select("id, name").order("name"),
        supabase
          .from("step_group_items")
          .select("step_group_id, description, time_minutes, step_type, production_step_id")
          .order("sort_order"),

      ]);
      if (cancel) return;

      const stepList: ProcessStep[] = (stepsRes.data || []).map((s: any) => {
        const raw = s.time_minutes;
        const n = Number(raw);
        if (raw === null || raw === undefined || !Number.isFinite(n)) {
          console.warn("[useV3ProcessCatalog] etapa sem time_minutes", {
            id: s.id,
            description: s.description,
          });
        }
        return {
          id: s.id,
          description: s.description,
          time_minutes: Number.isFinite(n) ? n : 0,
          step_type: s.step_type || "outro",
        };
      });
      setSteps(stepList);

      const groupNameById = new Map<string, string>(
        (groupsRes.data || []).map((g: any) => [g.id, g.name]),
      );
      const itemsByGroup: Record<string, ProcessGroup["items"]> = {};
      const groupStepsFlat: ProcessStep[] = [];
      (groupItemsRes.data || []).forEach((it: any, idx: number) => {
        const raw = it.time_minutes;
        const n = Number(raw);
        if (raw === null || raw === undefined || !Number.isFinite(n)) {
          console.warn("[useV3ProcessCatalog] item de grupo sem time_minutes", {
            step_group_id: it.step_group_id,
            description: it.description,
          });
        }
        const minutes = Number.isFinite(n) ? n : 0;
        (itemsByGroup[it.step_group_id] ||= []).push({
          description: it.description,
          time_minutes: minutes,
          step_type: it.step_type || "outro",
        });
        groupStepsFlat.push({
          // id sintético: itens de grupo não têm id próprio reaproveitável
          id: `group:${it.step_group_id}:${idx}`,
          description: it.description,
          time_minutes: minutes,
          step_type: it.step_type || "outro",
          // metadados para priorização/desambiguação
          source: "group",
          group_name: groupNameById.get(it.step_group_id) || undefined,
        } as ProcessStep & { source?: "group" | "step"; group_name?: string });
      });

      setGroups(
        (groupsRes.data || []).map((g: any) => ({
          id: g.id,
          name: g.name,
          items: itemsByGroup[g.id] || [],
        })),
      );

      // Fonte unificada: Etapas individuais primeiro (prioridade), depois itens de Grupos
      setAllSteps([
        ...stepList.map((s) => ({ ...s, source: "step" as const })),
        ...groupStepsFlat,
      ]);

      setLoaded(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return { steps, groups, allSteps, loaded };
}

