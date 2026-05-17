import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PAYROLL_CHARGE_RATE = 1.45;

interface HourRateData {
  hourRate: number;
  loading: boolean;
}

/**
 * Custo/hora produtivo = (Despesas + Salários×1.45 + Depreciação) / (funcionários_produção × horas_mês)
 * Replica fórmula da página DespesasFixas.
 */
export function useHourRate(): HourRateData {
  const [hourRate, setHourRate] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [expRes, salRes, eqRes, capRes] = await Promise.all([
        supabase.from("monthly_expenses").select("value"),
        supabase.from("salaries").select("salary, is_production"),
        supabase.from("equipment_depreciation").select("purchase_value, residual_value, useful_life_months"),
        supabase.from("productive_capacity").select("hours_per_month, production_employees").limit(1).maybeSingle(),
      ]);
      if (!alive) return;
      const totalExp = (expRes.data || []).reduce((s: number, e: any) => s + Number(e.value || 0), 0);
      const sals = salRes.data || [];
      const totalSal = sals.reduce((s: number, e: any) => s + Number(e.salary || 0), 0) * PAYROLL_CHARGE_RATE;
      const prodCount = sals.filter((s: any) => s.is_production).length;
      const totalDep = (eqRes.data || []).reduce((s: number, e: any) => {
        const life = Number(e.useful_life_months || 0);
        return s + (life > 0 ? (Number(e.purchase_value || 0) - Number(e.residual_value || 0)) / life : 0);
      }, 0);
      const hoursMonth = prodCount * Number(capRes.data?.hours_per_month || 0);
      const total = totalExp + totalSal + totalDep;
      setHourRate(hoursMonth > 0 ? total / hoursMonth : 0);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return { hourRate, loading };
}
