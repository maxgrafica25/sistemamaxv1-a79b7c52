// Carrega os PROCESSOS de produção de um Kit de Produto ativo, classificados
// como obrigatórios (role=required) ou opcionais (role=optional + alternative).
// Substitui o antigo useProductPresetProcesses — agora a fonte da verdade é o
// próprio Kit (Insumos → Kits de Produto).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type KitProcLinkType = "fixed" | "optional";

export interface KitProcStep {
  id: string;             // process_step_id
  kit_item_id: string;
  description: string;
  time_minutes: number;
  link_type: KitProcLinkType;
  default_on: boolean;    // vem do auto_select_default do item do kit
  step_group_id: string | null;
}

/**
 * @param productKind valor do Kit.product_kind (ex.: "cartao_visita", "apostila")
 */
export function useProductKitProcesses(productKind: string) {
  const [steps, setSteps] = useState<KitProcStep[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      // 1) Kits ativos do product_kind
      const { data: kits } = await supabase
        .from("product_kits")
        .select("id")
        .eq("product_kind", productKind)
        .eq("is_active", true);

      if (cancel) return;
      const kitIds = (kits || []).map((k: any) => k.id);
      if (kitIds.length === 0) {
        setSteps([]);
        setLoaded(true);
        return;
      }

      // 2) Itens de processo dos kits ativos
      const { data: items } = await supabase
        .from("product_kit_items")
        .select("id, kit_id, position, item_type, process_step_id, role, auto_select_default")
        .in("kit_id", kitIds)
        .eq("item_type", "process")
        .order("position");

      if (cancel) return;
      const procItems = (items || []) as Array<{
        id: string;
        process_step_id: string;
        role: "required" | "optional" | "alternative";
        auto_select_default: boolean;
      }>;
      const stepIds = Array.from(
        new Set(procItems.map((i) => i.process_step_id).filter(Boolean)),
      );
      if (stepIds.length === 0) {
        setSteps([]);
        setLoaded(true);
        return;
      }

      // 3) Dados das etapas
      const { data: stepsData } = await supabase
        .from("production_steps")
        .select("id, description, time_minutes")
        .in("id", stepIds);

      if (cancel) return;
      const byId = new Map<string, { description: string; time_minutes: number }>();
      (stepsData || []).forEach((s: any) =>
        byId.set(s.id, {
          description: s.description,
          time_minutes: Number(s.time_minutes) || 0,
        }),
      );

      const seen = new Set<string>();
      const out: KitProcStep[] = [];
      for (const it of procItems) {
        if (!it.process_step_id) continue;
        if (seen.has(it.process_step_id)) continue;
        seen.add(it.process_step_id);
        const s = byId.get(it.process_step_id);
        if (!s) continue;
        out.push({
          id: it.process_step_id,
          kit_item_id: it.id,
          description: s.description,
          time_minutes: s.time_minutes,
          link_type: it.role === "required" ? "fixed" : "optional",
          default_on: !!it.auto_select_default,
        });
      }
      setSteps(out);
      setLoaded(true);
    })();
    return () => {
      cancel = true;
    };
  }, [productKind]);

  return { steps, loaded };
}
