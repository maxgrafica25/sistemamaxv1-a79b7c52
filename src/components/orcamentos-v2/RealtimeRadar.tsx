import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye } from "lucide-react";

const THROTTLE_MS = 30_000;

/**
 * Realtime Radar — listens for UPDATEs on quotes and toasts when last_viewed_at changes,
 * which means a customer just opened the public viewer link. Throttled per quote.
 */
export function RealtimeRadar() {
  const lastNotifiedRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const channel = supabase
      .channel("quotes-radar-v2")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quotes" },
        (payload) => {
          const oldRow = payload.old as { last_viewed_at?: string | null } | null;
          const newRow = payload.new as {
            id: string;
            client: string;
            quote_number: string;
            last_viewed_at?: string | null;
          };

          const changed =
            newRow.last_viewed_at && newRow.last_viewed_at !== oldRow?.last_viewed_at;
          if (!changed) return;

          const now = Date.now();
          const last = lastNotifiedRef.current.get(newRow.id) ?? 0;
          if (now - last < THROTTLE_MS) return;
          lastNotifiedRef.current.set(newRow.id, now);

          toast(
            `👀 Cliente ${newRow.client} está visualizando o Orçamento ${newRow.quote_number} agora!`,
            {
              icon: <Eye className="h-4 w-4 text-primary" />,
              duration: 6000,
            },
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
