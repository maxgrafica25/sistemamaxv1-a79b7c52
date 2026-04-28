import type { EngagementEventType } from "./tracking";

export type Temperature = "cold" | "warm" | "hot" | "live";

export interface EngagementEvent {
  id: string;
  event_type: EngagementEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EngagementStats {
  viewCount: number;
  printedCount: number;
  sharedCount: number;
  copiedCount: number;
  scrolledFully: boolean;
  lastEventAt: Date | null;
  firstEventAt: Date | null;
  favoriteOption?: { id: string; label: string; count: number };
  events: EngagementEvent[]; // ordenados desc, até 15
}

const LIVE_WINDOW_MS = 10 * 60 * 1000;

export function emptyStats(): EngagementStats {
  return {
    viewCount: 0,
    printedCount: 0,
    sharedCount: 0,
    copiedCount: 0,
    scrolledFully: false,
    lastEventAt: null,
    firstEventAt: null,
    events: [],
  };
}

/**
 * Reduz uma lista de eventos (de 1 ou mais orçamentos) em stats por orçamento.
 * Espera input ordenado por created_at DESC.
 */
export function buildStatsMap(
  rows: Array<{
    quote_id: string;
    event_type: EngagementEventType;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>,
): Map<string, EngagementStats> {
  const map = new Map<string, EngagementStats>();

  // Agrupar por quote
  const byQuote = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byQuote.get(r.quote_id) ?? [];
    arr.push(r);
    byQuote.set(r.quote_id, arr);
  }

  for (const [quoteId, evs] of byQuote.entries()) {
    const stats = emptyStats();
    const optionCounts = new Map<string, { id: string; label: string; count: number }>();

    for (const e of evs) {
      const meta = e.metadata ?? {};
      const ts = new Date(e.created_at);
      if (!stats.lastEventAt || ts > stats.lastEventAt) stats.lastEventAt = ts;
      if (!stats.firstEventAt || ts < stats.firstEventAt) stats.firstEventAt = ts;

      switch (e.event_type) {
        case "viewed":
          stats.viewCount++;
          break;
        case "printed":
          stats.printedCount++;
          break;
        case "whatsapp_share":
          stats.sharedCount++;
          break;
        case "link_copied":
          stats.copiedCount++;
          break;
        case "scroll_depth":
          stats.scrolledFully = true;
          break;
        case "option_selected": {
          const id = String(meta.option_id ?? "");
          const label = String(meta.option_label ?? "Opção");
          if (id) {
            const cur = optionCounts.get(id) ?? { id, label, count: 0 };
            cur.count++;
            cur.label = label;
            optionCounts.set(id, cur);
          }
          break;
        }
      }
    }

    if (optionCounts.size > 0) {
      stats.favoriteOption = [...optionCounts.values()].sort((a, b) => b.count - a.count)[0];
    }

    // Manter últimos 15 eventos (entrada já vem desc)
    stats.events = evs.slice(0, 15).map((e, i) => ({
      id: `${quoteId}_${i}_${e.created_at}`,
      event_type: e.event_type,
      metadata: e.metadata ?? {},
      created_at: e.created_at,
    }));

    map.set(quoteId, stats);
  }

  return map;
}

export function computeTemperature(s: EngagementStats | undefined): Temperature {
  if (!s) return "cold";
  if (s.lastEventAt && Date.now() - s.lastEventAt.getTime() < LIVE_WINDOW_MS) return "live";
  if (s.printedCount > 0 || s.sharedCount > 0 || s.viewCount >= 3) return "hot";
  if (s.viewCount >= 1) return "warm";
  return "cold";
}

export function temperatureLabel(t: Temperature): string {
  switch (t) {
    case "live":
      return "Online agora";
    case "hot":
      return "Quente";
    case "warm":
      return "Interesse";
    case "cold":
      return "Frio";
  }
}

/**
 * Mensagens contextuais EXATAS para o follow-up via WhatsApp.
 * Não alterar: foram aprovadas no plano final.
 */
export function buildFollowUpMessage(
  temp: "hot" | "live",
  clientName: string,
  quoteNumber: string,
  favoriteOption?: string,
): string {
  const greeting = `Oi ${clientName.split(" ")[0]}!`;
  if (temp === "live") {
    return `${greeting} Vi que você está com a proposta ${quoteNumber} aberta agora. Posso esclarecer alguma dúvida em tempo real?`;
  }
  const favPart = favoriteOption ? ` Notei seu interesse na ${favoriteOption}.` : "";
  return `${greeting} Tudo bem? Estou passando pra saber se conseguiu analisar nossa proposta ${quoteNumber}.${favPart} Posso ajudar com algo?`;
}
