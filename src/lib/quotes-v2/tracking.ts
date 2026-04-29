import { supabase } from "@/integrations/supabase/client";

export type EngagementEventType =
  | "viewed"
  | "printed"
  | "whatsapp_share"
  | "link_copied"
  | "option_selected"
  | "option_deselected"
  | "scroll_depth";

const VISITOR_KEY = "qv2_visitor";
const VIEW_THROTTLE_MS = 30_000;

export function getVisitorId(): string {
  try {
    let v = localStorage.getItem(VISITOR_KEY);
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, v);
    }
    return v;
  } catch {
    // localStorage indisponível (modo privado, etc.) — gera id efêmero
    return crypto.randomUUID();
  }
}

export function parseUA(): { device_type: "Mobile" | "Desktop"; os: string; browser: string } {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

  let os = "Unknown";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

  return { device_type: isMobile ? "Mobile" : "Desktop", os, browser };
}

/**
 * Dispara um evento de engajamento. Falha silenciosamente para não quebrar UX.
 * - `viewed` é throttled em 30s por aba (sessionStorage).
 * - A RPC do servidor descarta automaticamente se houver auth.uid() (equipe interna).
 */
export async function trackEvent(
  quoteId: string | undefined,
  eventType: EngagementEventType,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (!quoteId) return;

  if (eventType === "viewed") {
    try {
      const k = `qv2_view_${quoteId}`;
      const last = Number(sessionStorage.getItem(k) || "0");
      if (Date.now() - last < VIEW_THROTTLE_MS) return;
      sessionStorage.setItem(k, String(Date.now()));
    } catch {
      /* ignore */
    }
  }

  const meta = { ...parseUA(), ...extra };
  const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null;

  try {
    await supabase.rpc("register_quote_event", {
      p_quote_id: quoteId,
      p_event_type: eventType,
      p_metadata: meta,
      p_user_agent: ua,
      p_visitor_id: getVisitorId(),
    });
  } catch (e) {
    // tracking nunca deve interromper a UX
    console.warn("[tracking] failed", eventType, e);
  }
}
