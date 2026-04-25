import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UrgentAlert {
  equipment_id: string;
  equipment_name: string;
  days_overdue: number;
}

/**
 * Carrega alertas críticos não-resolvidos da tabela `reading_alerts_sent`,
 * deduplicando por equipamento (mantém o pior dias_overdue).
 * Atualiza em tempo real via Postgres Changes.
 *
 * Só efetivamente busca/escuta quando `enabled` é true (ex: quando a paleta abre)
 * para não desperdiçar conexões realtime.
 */
export function useUrgentAlerts(enabled: boolean) {
  const [alerts, setAlerts] = useState<UrgentAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let active = true;

    const fetchAlerts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("reading_alerts_sent")
        .select("equipment_id, days_overdue, alerted_at, equipments!inner(name)")
        .is("resolved_at", null)
        .eq("severity", "critical")
        .order("days_overdue", { ascending: false })
        .order("alerted_at", { ascending: false });

      if (!active) return;
      if (error || !data) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      // Deduplicar por equipment_id (já vem ordenado pelo pior)
      const seen = new Set<string>();
      const list: UrgentAlert[] = [];
      for (const row of data as any[]) {
        if (!row.equipment_id || seen.has(row.equipment_id)) continue;
        seen.add(row.equipment_id);
        list.push({
          equipment_id: row.equipment_id,
          equipment_name: row.equipments?.name ?? "Equipamento",
          days_overdue: row.days_overdue ?? 0,
        });
      }
      setAlerts(list);
      setLoading(false);
    };

    fetchAlerts();

    const channel = supabase
      .channel("urgent-alerts-palette")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reading_alerts_sent" },
        () => fetchAlerts(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return { alerts, loading };
}
