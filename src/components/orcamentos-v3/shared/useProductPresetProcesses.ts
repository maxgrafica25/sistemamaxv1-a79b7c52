// Carrega etapas e grupos vinculados a um favorito de produto via
// product_preset_processes.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PresetLinkType = "fixed" | "optional";

export interface PresetStep {
  id: string;
  description: string;
  time_minutes: number;
  link_type: PresetLinkType;
}
export interface PresetGroup {
  id: string;
  name: string;
  items: { description: string; time_minutes: number }[];
  total_minutes: number;
  link_type: PresetLinkType;
}

export function useProductPresetProcesses(presetKey: string) {
  const [steps, setSteps] = useState<PresetStep[]>([]);
  const [groups, setGroups] = useState<PresetGroup[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: links } = await supabase
        .from("product_preset_processes")
        .select("step_id, group_id, sort_order, link_type")
        .eq("preset_key", presetKey)
        .order("sort_order");
      if (cancel) return;
      const linkRows = (links || []) as Array<{
        step_id: string | null;
        group_id: string | null;
        link_type: PresetLinkType | null;
      }>;
      const stepIds = linkRows.map((l) => l.step_id).filter(Boolean) as string[];
      const groupIds = linkRows.map((l) => l.group_id).filter(Boolean) as string[];

      const typeByStep = new Map<string, PresetLinkType>();
      const typeByGroup = new Map<string, PresetLinkType>();
      linkRows.forEach((l) => {
        const t: PresetLinkType = l.link_type === "optional" ? "optional" : "fixed";
        if (l.step_id) typeByStep.set(l.step_id, t);
        if (l.group_id) typeByGroup.set(l.group_id, t);
      });

      const [stepsRes, groupsRes, itemsRes] = await Promise.all([
        stepIds.length
          ? supabase
              .from("production_steps")
              .select("id, description, time_minutes")
              .in("id", stepIds)
          : Promise.resolve({ data: [] as any[] }),
        groupIds.length
          ? supabase.from("step_groups").select("id, name").in("id", groupIds)
          : Promise.resolve({ data: [] as any[] }),
        groupIds.length
          ? supabase
              .from("step_group_items")
              .select("step_group_id, description, time_minutes")
              .in("step_group_id", groupIds)
              .order("sort_order")
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (cancel) return;

      const num = (v: any) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      setSteps(
        (stepsRes.data || []).map((s: any) => ({
          id: s.id,
          description: s.description,
          time_minutes: num(s.time_minutes),
          link_type: typeByStep.get(s.id) || "fixed",
        })),
      );

      const itemsBy: Record<string, { description: string; time_minutes: number }[]> = {};
      (itemsRes.data || []).forEach((it: any) => {
        (itemsBy[it.step_group_id] ||= []).push({
          description: it.description,
          time_minutes: num(it.time_minutes),
        });
      });
      setGroups(
        (groupsRes.data || []).map((g: any) => {
          const items = itemsBy[g.id] || [];
          return {
            id: g.id,
            name: g.name,
            items,
            total_minutes: items.reduce((s, i) => s + i.time_minutes, 0),
            link_type: typeByGroup.get(g.id) || "fixed",
          };
        }),
      );
      setLoaded(true);
    })();
    return () => {
      cancel = true;
    };
  }, [presetKey]);

  return { steps, groups, loaded };
}
