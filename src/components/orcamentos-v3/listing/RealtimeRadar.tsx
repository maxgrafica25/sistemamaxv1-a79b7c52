import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, Flame, Share2 } from "lucide-react";

const VIEW_THROTTLE_MS = 30_000;
const HOT_THROTTLE_MS = 60_000;

interface QuoteCacheEntry {
  client: string;
  quote_number: string;
}

/**
 * Realtime Radar — observa:
 * 1. UPDATEs em quotes (last_viewed_at) → toast "está visualizando agora"
 * 2. INSERTs em quote_engagement_events de alta intenção (printed, whatsapp_share)
 *    → toast 🔥 com nome do cliente e número do orçamento
 */
export function RealtimeRadar() {
  const lastViewedRef = useRef<Map<string, number>>(new Map());
  const lastHotRef = useRef<Map<string, number>>(new Map());
  const quoteCacheRef = useRef<Map<string, QuoteCacheEntry>>(new Map());

  useEffect(() => {
    const fetchQuoteInfo = async (
      quoteId: string,
    ): Promise<QuoteCacheEntry | null> => {
      const cached = quoteCacheRef.current.get(quoteId);
      if (cached) return cached;
      const { data } = await supabase
        .from("quotes")
        .select("client, quote_number")
        .eq("id", quoteId)
        .maybeSingle();
      if (!data) return null;
      const entry: QuoteCacheEntry = {
        client: data.client,
        quote_number: data.quote_number,
      };
      quoteCacheRef.current.set(quoteId, entry);
      return entry;
    };

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

          // mantém cache atualizado
          quoteCacheRef.current.set(newRow.id, {
            client: newRow.client,
            quote_number: newRow.quote_number,
          });

          const now = Date.now();
          const last = lastViewedRef.current.get(newRow.id) ?? 0;
          if (now - last < VIEW_THROTTLE_MS) return;
          lastViewedRef.current.set(newRow.id, now);

          toast(
            `👀 Cliente ${newRow.client} está visualizando o Orçamento ${newRow.quote_number} agora!`,
            {
              icon: <Eye className="h-4 w-4 text-primary" />,
              duration: 6000,
            },
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quote_engagement_events" },
        async (payload) => {
          const row = payload.new as {
            quote_id: string;
            event_type: string;
          };
          if (
            row.event_type !== "printed" &&
            row.event_type !== "whatsapp_share"
          ) {
            return;
          }

          const key = `${row.quote_id}:${row.event_type}`;
          const now = Date.now();
          const last = lastHotRef.current.get(key) ?? 0;
          if (now - last < HOT_THROTTLE_MS) return;
          lastHotRef.current.set(key, now);

          const info = await fetchQuoteInfo(row.quote_id);
          if (!info) return;

          if (row.event_type === "printed") {
            toast(
              `🔥 Cliente ${info.client} acaba de baixar o PDF do Orçamento ${info.quote_number}`,
              {
                icon: <Flame className="h-4 w-4 text-orange-500" />,
                duration: 8000,
              },
            );
          } else {
            toast(
              `🔥 Cliente ${info.client} compartilhou o Orçamento ${info.quote_number} no WhatsApp`,
              {
                icon: <Share2 className="h-4 w-4 text-green-600" />,
                duration: 8000,
              },
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
