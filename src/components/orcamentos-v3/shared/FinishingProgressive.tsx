import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

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
  /** Disparado para lazy-load das sub-etapas (chamado automaticamente na primeira render). */
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
  const triggered = useRef<Set<string>>(new Set());

  // Auto-dispara lazy-load das sub-etapas para todos os itens com grupo vinculado.
  useEffect(() => {
    items.forEach((it) => {
      if (
        it.hasGroup &&
        it.onExpand &&
        !it.subItems &&
        !it.loadingSubItems &&
        !triggered.current.has(it.id)
      ) {
        triggered.current.add(it.id);
        it.onExpand();
      }
    });
  }, [items]);

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

  return (
    <ul className="divide-y divide-border rounded-md border border-border bg-background">
      {items.map((it) => {
        const on = !!enabled[it.id];
        const showDetails = it.hasGroup || (it.subItems && it.subItems.length > 0);
        return (
          <li key={it.id} className="px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{it.label}</p>
                {it.hint && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{it.hint}</p>
                )}
              </div>
              <Switch checked={on} onCheckedChange={(v) => onToggle(it.id, !!v)} />
            </div>
            {showDetails && (
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
