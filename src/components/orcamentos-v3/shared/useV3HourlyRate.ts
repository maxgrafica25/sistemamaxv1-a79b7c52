// Calcula custo/hora idêntico ao V2:
// (despesas_mensais + salários*1.45 + depreciações) / (funcionários_produção × horas/mês).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useV3HourlyRate() {
  const [hourlyRate, setHourlyRate] = useState<number>(80);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [expRes, salRes, depRes, capRes] = await Promise.all([
        supabase.from("monthly_expenses").select("value"),
        supabase.from("salaries").select("salary, is_production"),
        supabase
          .from("equipment_depreciation")
          .select("purchase_value, useful_life_months, residual_value"),
        supabase
          .from("productive_capacity")
          .select("hours_per_month, production_employees")
          .limit(1)
          .single(),
      ]);
      if (cancel) return;

      const totalExp = (expRes.data || []).reduce(
        (s: number, e: any) => s + Number(e.value || 0),
        0,
      );
      const totalSal =
        (salRes.data || []).reduce(
          (s: number, e: any) => s + Number(e.salary || 0),
          0,
        ) * 1.45;
      const totalDep = (depRes.data || []).reduce(
        (s: number, e: any) =>
          s +
          (Number(e.useful_life_months) > 0
            ? (Number(e.purchase_value || 0) - Number(e.residual_value || 0)) /
              Number(e.useful_life_months)
            : 0),
        0,
      );
      const cap: any = capRes.data;
      const prodCount = (salRes.data || []).filter(
        (s: any) => s.is_production,
      ).length;
      const hours = cap ? prodCount * Number(cap.hours_per_month || 0) : 0;
      if (hours > 0) setHourlyRate((totalExp + totalSal + totalDep) / hours);
      setLoaded(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return { hourlyRate, loaded };
}
