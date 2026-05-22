// Hook para carregar e gerenciar produtos recorrentes de um cliente.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClientRecurringProduct {
  id: string;
  client_id: string;
  nome: string;
  quote_preset_id: string | null;
  drive_folder_url: string | null;
  frequencia_dias: number;
  aviso_antecedencia_dias: number;
  ultima_impressao_em: string | null;
  proxima_prevista_em: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export function useClientRecurring(clientId: string | null | undefined) {
  const [items, setItems] = useState<ClientRecurringProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!clientId) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("client_recurring_products" as never)
      .select("*")
      .eq("client_id", clientId)
      .eq("ativo", true)
      .order("proxima_prevista_em", { ascending: true, nullsFirst: false });
    setItems(((data as unknown) as ClientRecurringProduct[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);

  return { items, loading, reload };
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function daysSince(ts: string | null): number | null {
  if (!ts) return null;
  const d = new Date(ts);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}
