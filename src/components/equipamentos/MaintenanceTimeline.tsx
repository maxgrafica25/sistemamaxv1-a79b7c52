import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, Shield, ChevronDown, Copy, Edit2, Trash2, Paperclip, FileVideo, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineRecord {
  id: string;
  date: string;
  maintenance_type: string;
  technician: string;
  total_counter: number | null;
  hours_spent: number;
  cost: number;
  replaced_parts: string | null;
  service_description: string;
  notes: string | null;
  attachments: string[] | null;
}

interface Props {
  records: TimelineRecord[];
  hasCounter: boolean;
  onCopy: (r: TimelineRecord) => void;
  onEdit: (r: TimelineRecord) => void;
  onDelete: (id: string) => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDateShort = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
};
const fmtDateFull = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR");

function firstPart(parts: string | null): { primary: string | null; extra: number } {
  if (!parts) return { primary: null, extra: 0 };
  const arr = parts.split(",").map(s => s.trim()).filter(Boolean);
  if (arr.length === 0) return { primary: null, extra: 0 };
  return { primary: arr[0], extra: arr.length - 1 };
}

const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
const isVideo = (url: string) => /\.(mp4|mov|avi|webm|mkv)$/i.test(url);

export default function MaintenanceTimeline({ records, hasCounter, onCopy, onEdit, onDelete }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (records.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
        <Wrench className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Nenhuma manutenção registrada</p>
        <p className="text-xs mt-1 opacity-70">
          Pressione{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono border">M</kbd>{" "}
          para registrar a primeira
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card divide-y divide-border/40 overflow-hidden">
      {records.map((r) => {
        const isPreventive = r.maintenance_type === "preventiva";
        const Icon = isPreventive ? Shield : Wrench;
        const { primary, extra } = firstPart(r.replaced_parts);
        const expanded = expandedId === r.id;

        return (
          <Collapsible
            key={r.id}
            open={expanded}
            onOpenChange={(o) => setExpandedId(o ? r.id : null)}
          >
            <div className="relative">
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-[3px] bg-primary transition-opacity",
                  expanded ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "w-full h-12 flex items-center gap-3 px-3 text-left hover:bg-muted/40 transition-colors",
                    expanded && "bg-muted/30",
                  )}
                >
                  <div
                    className={cn(
                      "h-7 w-7 rounded-md flex items-center justify-center shrink-0 border",
                      isPreventive
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground w-10 shrink-0">{fmtDateShort(r.date)}</span>
                  <span className="text-sm font-medium text-foreground truncate min-w-0 flex-1">{r.technician}</span>
                  {primary && (
                    <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[180px]">
                      {primary}
                      {extra > 0 && <span className="ml-1 opacity-70">+{extra}</span>}
                    </span>
                  )}
                  <Badge
                    variant="outline"
                    className="font-mono text-[11px] border-border/60 shrink-0 tabular-nums"
                  >
                    {fmt(Number(r.cost))}
                  </Badge>
                  {(r.attachments?.length ?? 0) > 0 && (
                    <span className="hidden sm:flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                      <Paperclip className="h-3 w-3" />
                      {r.attachments!.length}
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </button>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-3 pb-4 pt-1 space-y-3 bg-muted/10">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Data</p>
                      <p className="font-mono">{fmtDateFull(r.date)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tipo</p>
                      <p className="font-medium">{isPreventive ? "Preventiva" : "Corretiva"}</p>
                    </div>
                    {hasCounter && r.total_counter != null && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Contador</p>
                        <p className="font-mono">{r.total_counter.toLocaleString("pt-BR")}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Horas</p>
                      <p className="font-mono">{Number(r.hours_spent).toFixed(1)}h</p>
                    </div>
                  </div>

                  {r.replaced_parts && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Peças</p>
                      <div className="flex flex-wrap gap-1">
                        {r.replaced_parts.split(",").map(s => s.trim()).filter(Boolean).map((p) => (
                          <Badge key={p} variant="secondary" className="text-[10px] font-normal border border-border/60">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Descrição</p>
                    <p className="text-sm whitespace-pre-wrap leading-snug">{r.service_description}</p>
                  </div>

                  {r.notes && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Observações</p>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-snug">{r.notes}</p>
                    </div>
                  )}

                  {r.attachments && r.attachments.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                        Anexos ({r.attachments.length})
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {r.attachments.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative block rounded-md overflow-hidden border border-border/60 bg-muted/30 hover:border-primary transition-colors aspect-square"
                          >
                            {isImage(url) ? (
                              <img src={url} alt={`Anexo ${i + 1}`} className="w-full h-full object-cover" />
                            ) : isVideo(url) ? (
                              <div className="w-full h-full flex items-center justify-center bg-muted">
                                <FileVideo className="h-6 w-6 text-muted-foreground" />
                              </div>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted">
                                <Paperclip className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => onCopy(r)}>
                      <Copy className="h-3 w-3" /> Copiar p/ técnico
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => onEdit(r)}>
                      <Edit2 className="h-3 w-3" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                      onClick={() => onDelete(r.id)}
                    >
                      <Trash2 className="h-3 w-3" /> Excluir
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );
}
