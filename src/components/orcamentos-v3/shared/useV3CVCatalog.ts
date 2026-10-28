// Catálogo CV (Fase 5.3) — espelha exatamente o que o V2 carrega para
// alimentar a engine `calcular()` de @/lib/cv-calc/engine.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  Midia as CVMidia,
  Impressao as CVImpressao,
  Acabamento as CVAcabamento,
  MarkupSettings as CVMarkupSettings,
  RecipeItem as CVRecipeItem,
  LaborItem as CVLaborItem,
} from "@/lib/cv-calc/engine";
import { attachMediaOrder, type MediaOrderRow } from "@/lib/cv-calc/media-order";

export interface V3CVCatalog {
  loading: boolean;
  midias: CVMidia[];
  impressoes: CVImpressao[];
  acabamentos: CVAcabamento[];
  valorMinimo: number;
  markup: CVMarkupSettings;
  hourRate: number;
}

const EMPTY_MARKUP: CVMarkupSettings = {
  tax_pct: 0,
  invoice_pct: 0,
  credit_card_pct: 0,
  collection_fee_pct: 0,
  default_margin_pct: 0,
};

export function useV3CVCatalog(): V3CVCatalog {
  const [state, setState] = useState<V3CVCatalog>({
    loading: true,
    midias: [],
    impressoes: [],
    acabamentos: [],
    valorMinimo: 0,
    markup: EMPTY_MARKUP,
    hourRate: 0,
  });

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [
        mRes, iRes, aRes, cfgRes, recRes, labRes, supRes, ordRes,
        settingsRes, expRes, salRes, depRes, capRes,
      ] = await Promise.all([
        supabase.from("cv_calc_midias" as never).select("*").eq("ativo", true).order("sort_order"),
        supabase.from("cv_calc_impressoes" as never).select("*").eq("ativo", true).order("sort_order"),
        supabase.from("cv_calc_acabamentos" as never).select("*").eq("ativo", true).order("sort_order"),
        supabase.from("cv_calc_config" as never).select("valor_minimo").maybeSingle(),
        supabase.from("cv_calc_acabamento_recipe_items" as never)
          .select("acabamento_id, supply_id, consumo_qty, consumo_tipo"),
        supabase.from("cv_calc_acabamento_labor_items" as never)
          .select("acabamento_id, descricao, time_minutes, consumo_tipo, consumo_qty, production_step_id"),
        supabase.from("supplies").select("id, valor_unitario"),
        supabase.from("cv_calc_acabamento_media_order" as never)
          .select("acabamento_id, tipo_midia, sort_order, visivel"),
        supabase.from("global_settings").select("*").limit(1).maybeSingle(),
        supabase.from("monthly_expenses").select("value"),
        supabase.from("salaries").select("salary, is_production"),
        supabase.from("equipment_depreciation").select("purchase_value, useful_life_months, residual_value"),
        supabase.from("productive_capacity").select("hours_per_month, production_employees").limit(1).maybeSingle(),
      ]);
      if (cancel) return;

      const supplyCost = new Map<string, number>();
      ((supRes.data || []) as { id: string; valor_unitario: number }[]).forEach((s) =>
        supplyCost.set(s.id, Number(s.valor_unitario) || 0),
      );

      const recipeByAc = new Map<string, CVRecipeItem[]>();
      (((recRes as { data: Array<{ acabamento_id: string; supply_id: string; consumo_qty: number; consumo_tipo: CVRecipeItem["consumo_tipo"] }> | null }).data) ?? [])
        .forEach((r) => {
          const arr = recipeByAc.get(r.acabamento_id) ?? [];
          arr.push({
            supply_id: r.supply_id,
            supply_custo_unitario: supplyCost.get(r.supply_id) ?? 0,
            consumo_qty: Number(r.consumo_qty) || 0,
            consumo_tipo: r.consumo_tipo,
          });
          recipeByAc.set(r.acabamento_id, arr);
        });

      const laborByAc = new Map<string, CVLaborItem[]>();
      (((labRes as { data: Array<{ acabamento_id: string; descricao: string; time_minutes: number; consumo_tipo: string; consumo_qty: number; production_step_id: string | null }> | null }).data) ?? [])
        .forEach((l) => {
          const arr = laborByAc.get(l.acabamento_id) ?? [];
          arr.push({
            production_step_id: l.production_step_id,
            descricao: l.descricao,
            time_minutes: Number(l.time_minutes) || 0,
            consumo_tipo: l.consumo_tipo as CVLaborItem["consumo_tipo"],
            consumo_qty: Number(l.consumo_qty) || 1,
          });
          laborByAc.set(l.acabamento_id, arr);
        });

      const enrichedRaw = (((aRes as { data: CVAcabamento[] | null }).data) ?? []).map((ac) => ({
        ...ac,
        recipe: recipeByAc.get(ac.id) ?? [],
        labor: laborByAc.get(ac.id) ?? [],
      }));
      const acabamentos = attachMediaOrder(
        enrichedRaw,
        ((ordRes as { data: MediaOrderRow[] | null }).data ?? []) as MediaOrderRow[],
      );

      // Hourly rate (mesma fórmula do V2)
      const totalExp = (expRes.data || []).reduce((s: number, e: any) => s + Number(e.value || 0), 0);
      const totalSal = (salRes.data || []).reduce((s: number, e: any) => s + Number(e.salary || 0), 0) * 1.45;
      const totalDep = (depRes.data || []).reduce(
        (s: number, e: any) =>
          s + (e.useful_life_months > 0 ? (e.purchase_value - e.residual_value) / e.useful_life_months : 0),
        0,
      );
      const cap = capRes.data as { hours_per_month: number; production_employees: number } | null;
      const prodCount = (salRes.data || []).filter((s: any) => s.is_production).length;
      const hours = cap ? prodCount * cap.hours_per_month : 0;
      const hourRate = hours > 0 ? (totalExp + totalSal + totalDep) / hours : 80;

      const s: any = settingsRes.data || {};
      const markup: CVMarkupSettings = {
        tax_pct: Number(s.tax_pct ?? 0),
        invoice_pct: Number(s.invoice_pct ?? 0),
        credit_card_pct: Number(s.credit_card_pct ?? 0),
        collection_fee_pct: Number(s.collection_fee_pct ?? 0),
        default_margin_pct: Number(s.default_margin_pct ?? 0),
        waste_pct: Number(s.waste_pct ?? 0),
      };

      setState({
        loading: false,
        midias: ((mRes.data || []) as unknown) as CVMidia[],
        impressoes: ((iRes.data || []) as unknown) as CVImpressao[],
        acabamentos,
        valorMinimo: Number((cfgRes as { data: { valor_minimo?: number } | null }).data?.valor_minimo ?? 0),
        markup,
        hourRate,
      });
    })();
    return () => { cancel = true; };
  }, []);

  return state;
}
