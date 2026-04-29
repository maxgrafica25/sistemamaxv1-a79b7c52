import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Eye, Printer, MessageCircle, Link2, Star, CheckCircle2, MessageSquare, Loader2,
  AlertTriangle, Send,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EngagementBadge } from "./EngagementBadge";
import {
  buildFollowUpMessage,
  buildStatsMap,
  computeTemperature,
  emptyStats,
  temperatureLabel,
  type EngagementEvent,
  type EngagementStats,
} from "@/lib/quotes-v2/temperature";
import type { EngagementEventType } from "@/lib/quotes-v2/tracking";

interface Props {
  quoteId: string;
  quoteNumber: string;
  clientName: string;
  clientPhone?: string | null;
  /** Stats já agregados pela lista (visualizados sem abrir o popover) */
  stats?: EngagementStats;
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay(d, today)) return `Hoje ${time}`;
  if (sameDay(d, yest)) return `Ontem ${time}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
};

const relativeTime = (d: Date) => {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  return `há ${days}d`;
};

const eventLabel = (e: EngagementEvent): string => {
  const meta = e.metadata as Record<string, unknown>;
  switch (e.event_type) {
    case "viewed": {
      const n = Number(meta.visit_number ?? 0);
      if (n > 0) {
        const ord = n === 1 ? "1ª" : `${n}ª`;
        return `Visualizou (${ord} vez)`;
      }
      return "Visualizou";
    }
    case "printed": return "Baixou PDF";
    case "whatsapp_share": return "Compartilhou via WhatsApp";
    case "link_copied": return "Copiou o link";
    case "scroll_depth": return "Leu a proposta integralmente";
    case "option_selected": return `Selecionou ${meta.option_label ?? "uma opção"}`;
  }
};

const deviceLabel = (meta: Record<string, unknown>): string | null => {
  const os = meta.os ? String(meta.os) : null;
  const browser = meta.browser ? String(meta.browser) : null;
  if (!os && !browser) return null;
  return [os, browser].filter(Boolean).join(" · ");
};

export function EngagementPopover({
  quoteId,
  quoteNumber,
  clientName,
  clientPhone,
  stats: stripStats,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullStats, setFullStats] = useState<EngagementStats | undefined>(stripStats);

  // Lazy-load: busca evento detalhados ao abrir pela primeira vez
  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("quote_engagement_events")
        .select("quote_id, event_type, metadata, created_at")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false })
        .limit(50);

      const map = buildStatsMap(
        (data ?? []).map((r) => ({
          quote_id: r.quote_id,
          event_type: r.event_type as EngagementEventType,
          metadata: (r.metadata as Record<string, unknown>) ?? {},
          created_at: r.created_at,
        })),
      );
      setFullStats(map.get(quoteId) ?? emptyStats());
      setLoaded(true);
      setLoading(false);
    })();
  }, [open, loaded, quoteId]);

  const stats = fullStats ?? stripStats;
  const temp = computeTemperature(stats);
  const tempLabel = temperatureLabel(temp);
  const isHotOrLive = temp === "hot" || temp === "live";

  const handleCopyLink = () => {
    const url = `${window.location.origin}/view-quote/${quoteId}`;
    navigator.clipboard.writeText(url);
    toast.success("Link de rastreamento copiado!");
  };

  const handleWhatsApp = () => {
    if (!clientPhone) return;
    const digits = clientPhone.replace(/\D/g, "");
    const msg = buildFollowUpMessage(
      temp as "hot" | "live",
      clientName,
      quoteNumber,
      stats?.favoriteOption?.label,
    );
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="cursor-pointer hover:opacity-80 transition-opacity"
          aria-label="Ver detalhes de engajamento"
        >
          <EngagementBadge stats={stats} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-6 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <EngagementBadge stats={stats} />
                {stats?.lastEventAt && (
                  <span className="text-xs text-muted-foreground">
                    Última: {relativeTime(stats.lastEventAt)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {temp === "cold"
                  ? "Cliente ainda não abriu o link da proposta."
                  : `Temperatura ${tempLabel.toLowerCase()}.`}
              </p>
            </div>

            {temp !== "cold" && stats && (
              <>
                <Separator />

                {/* Counters */}
                <div className="p-4 grid grid-cols-4 gap-2 text-center">
                  <Counter icon={Eye} value={stats.viewCount} label="Views" />
                  <Counter icon={Printer} value={stats.printedCount} label="PDFs" />
                  <Counter icon={MessageCircle} value={stats.sharedCount} label="WhatsApp" />
                  <Counter icon={Link2} value={stats.copiedCount} label="Cópias" />
                </div>

                {/* Insights */}
                {(stats.favoriteOption || stats.scrolledFully) && (
                  <>
                    <Separator />
                    <div className="p-4 space-y-2 text-xs">
                      {stats.favoriteOption && (
                        <div className="flex items-start gap-2">
                          <Star className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                          <span>
                            <span className="font-medium">Opção preferida:</span>{" "}
                            "{stats.favoriteOption.label}"{" "}
                            <span className="text-muted-foreground">
                              (selecionada {stats.favoriteOption.count}x)
                            </span>
                          </span>
                        </div>
                      )}
                      {stats.scrolledFully && (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                          <span>Leu a proposta integralmente</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Timeline */}
                {stats.events.length > 0 && (
                  <>
                    <Separator />
                    <div className="p-4 max-h-72 overflow-y-auto">
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                        Atividade recente
                      </p>
                      <ul className="space-y-2.5">
                        {stats.events.map((e) => {
                          const dev = deviceLabel(e.metadata);
                          return (
                            <li key={e.id} className="text-xs leading-snug">
                              <div className="text-foreground">
                                <span className="text-muted-foreground">
                                  {formatDateTime(e.created_at)}
                                </span>
                                {" — "}
                                {eventLabel(e)}
                              </div>
                              {dev && <div className="text-[11px] text-muted-foreground">{dev}</div>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </>
                )}
              </>
            )}

            <Separator />

            {/* Actions */}
            <div className="p-3 space-y-2">
              {isHotOrLive && clientPhone && (
                <Button
                  size="sm"
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
                  onClick={handleWhatsApp}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp follow-up
                </Button>
              )}
              <Button size="sm" variant="outline" className="w-full gap-2" onClick={handleCopyLink}>
                <Link2 className="h-3.5 w-3.5" />
                Copiar link de rastreamento
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Counter({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Eye;
  value: number;
  label: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-center gap-1 text-foreground">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}
