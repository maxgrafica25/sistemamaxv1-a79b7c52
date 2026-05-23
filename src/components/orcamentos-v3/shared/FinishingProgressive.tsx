import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ChevronDown, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";

export interface FinishingSubItem {
  description: string;
  time_minutes: number;
}

export interface FinishingDef {
  id: string;
  label: string;
  advanced?: ReactNode;
  hint?: string;
  /**
   * Sub-etapas que compõem esse acabamento (read-only). Quando undefined,
   * o item não é expansível. Quando array vazio + `loadingSubItems` false,
   * mostra mensagem "sem detalhamento".
   */
  subItems?: FinishingSubItem[];
  loadingSubItems?: boolean;
  /** Disparado na primeira expansão para lazy-load. */
  onExpand?: () => void;
  /** Quando true, o item tem grupo vinculado mas sub-itens ainda não foram carregados. */
  hasGroup?: boolean;
}

interface Props {
  items: FinishingDef[];
  enabled: Record<string, boolean>;
  onToggle: (id: string, on: boolean) => void;
}

export function FinishingProgressive({ items, enabled, onToggle }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Nenhum acabamento cadastrado para Impressão.
        </p>
        <a
          href="/acabamentos"
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-1 text-xs font-medium text-primary hover:underline"
        >
          Cadastrar acabamentos →
        </a>
      </div>
    );
  }

  const toggleExpand = (it: FinishingDef) => {
    const wasOpen = !!expanded[it.id];
    setExpanded((m) => ({ ...m, [it.id]: !wasOpen }));
    if (!wasOpen && it.onExpand && !it.subItems && !it.loadingSubItems) {
      it.onExpand();
    }
  };

  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-background">
      {items.map((it) => {
        const on = !!enabled[it.id];
        const isOpen = !!expanded[it.id];
        const canExpand = it.hasGroup || (it.subItems && it.subItems.length > 0);
        return (
          <li key={it.id} className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{it.label}</p>
                {it.hint && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{it.hint}</p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canExpand && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(it)}
                    aria-expanded={isOpen}
                    aria-label={isOpen ? "Recolher detalhamento" : "Ver detalhamento"}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                )}
                <Switch checked={on} onCheckedChange={(v) => onToggle(it.id, !!v)} />
              </div>
            </div>
            {isOpen && canExpand && (
              <div className="mt-2 pt-2 border-t border-border/60">
                {it.loadingSubItems ? (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Carregando detalhamento…
                  </div>
                ) : it.subItems && it.subItems.length > 0 ? (
                  <ul className="space-y-1">
                    {it.subItems.map((s, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between text-[11px] text-muted-foreground"
                      >
                        <span className="truncate">
                          <span className="mr-1.5 text-muted-foreground/60">•</span>
                          {s.description}
                        </span>
                        <span className="ml-2 tabular-nums shrink-0">{s.time_minutes} min</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] italic text-muted-foreground">
                    Nenhum detalhamento cadastrado neste grupo.
                  </p>
                )}
              </div>
            )}
            {on && it.advanced && (
              <div className={cn("mt-2 pt-2 border-t border-border/60")}>{it.advanced}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
