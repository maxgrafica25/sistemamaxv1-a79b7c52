import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Trash2,
  Printer,
  Megaphone,
  Handshake,
  BookOpen,
  Wrench,
  Package,
  ShoppingCart,
  Tag,
  Layers,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { V3Item } from "../types";
import { priceOf, fmtBRL } from "../shared/pricing";

interface Props {
  items: V3Item[];
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  highlightId?: string | null;
}

const ICON = {
  print: Printer,
  cv: Megaphone,
  third: Handshake,
  booklet: BookOpen,
  labor: Wrench,
  supply: Package,
  label: Tag,
};

const LABEL = {
  print: "Impressão",
  cv: "Com. Visual",
  third: "Terceirizado",
  booklet: "Apostila",
  labor: "Mão-de-obra",
  supply: "Suprimento",
  label: "Etiqueta",
};

function cartMeta(it: V3Item): string {
  switch (it.kind) {
    case "labor":
      return `${it.time_minutes} min · margem ${it.margem_pct.toFixed(0)}%`;
    case "booklet":
      return `${it.bookletUnits}× ${it.bookletPages}fl${it.bookletDuplex ? " F/V" : ""}`;
    case "label":
      return `${it.labelW_mm}×${it.labelH_mm}mm · ${it.quantidade} un · ${it.sheets_needed} fl`;
    case "supply":
    case "third":
    case "print":
    case "cv":
      return `qtd ${it.quantidade ?? 1}`;
  }
}

function itemQty(it: V3Item): number {
  if (it.kind === "labor") return 1;
  if (it.kind === "booklet") return it.bookletUnits;
  return (it as { quantidade?: number }).quantidade ?? 1;
}

type Entry =
  | { type: "single"; item: V3Item }
  | { type: "group"; groupId: string; items: V3Item[] }
  | { type: "bundle"; bundleId: string; leader: V3Item; items: V3Item[] };

function groupItems(items: V3Item[]): Entry[] {
  const out: Entry[] = [];
  const bundleIdx = new Map<string, number>();
  const tierIdx = new Map<string, number>();
  for (const it of items) {
    const bid = (it as { bundle_id?: string | null }).bundle_id;
    if (bid) {
      const idx = bundleIdx.get(bid);
      if (idx == null) {
        bundleIdx.set(bid, out.length);
        out.push({ type: "bundle", bundleId: bid, leader: it, items: [it] });
      } else {
        const entry = out[idx];
        if (entry.type === "bundle") {
          entry.items.push(it);
          // Líder = primeiro item com bundle_label preenchido
          if (!((entry.leader as { bundle_label?: string | null }).bundle_label) &&
              (it as { bundle_label?: string | null }).bundle_label) {
            entry.leader = it;
          }
        }
      }
      continue;
    }
    const tg = (it as { tier_group_id?: string | null }).tier_group_id;
    if (!tg) {
      out.push({ type: "single", item: it });
      continue;
    }
    const idx = tierIdx.get(tg);
    if (idx == null) {
      tierIdx.set(tg, out.length);
      out.push({ type: "group", groupId: tg, items: [it] });
    } else {
      const entry = out[idx];
      if (entry.type === "group") entry.items.push(it);
    }
  }
  return out;
}

export function UnifiedCart({ items, onDuplicate, onRemove, highlightId }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-6 text-center">
        <ShoppingCart className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          Configure no painel à esquerda e adicione ao orçamento.
        </p>
      </div>
    );
  }
  const entries = groupItems(items);
  return (
    <ul className="space-y-2">
      {entries.map((entry) => {
        if (entry.type === "single") {
          const it = entry.item;
          const Icon = ICON[it.kind];
          const price = priceOf(it).preco_total;
          const isNew = highlightId === it.id;
          return (
            <li
              key={it.id}
              className={cn(
                "group rounded-md border border-border/60 bg-card p-3 transition-all",
                isNew && "ring-2 ring-emerald-500/50 animate-in fade-in slide-in-from-right-2",
              )}
            >
              <div className="flex items-start gap-2">
                <div className="rounded bg-primary/10 p-1.5 text-primary shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight truncate">
                      {(it as { descricao?: string }).descricao || LABEL[it.kind]}
                    </p>
                    <span className="text-sm font-semibold tabular-nums shrink-0">
                      {fmtBRL(price)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                      {LABEL[it.kind]}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">{cartMeta(it)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => onDuplicate(it.id)}
                >
                  <Copy className="h-3 w-3 mr-1" /> Duplicar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => onRemove(it.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Excluir
                </Button>
              </div>
            </li>
          );
        }
        if (entry.type === "bundle") {
          return (
            <BundleCard
              key={entry.bundleId}
              entry={entry}
              highlightId={highlightId}
              onDuplicate={onDuplicate}
              onRemove={onRemove}
            />
          );
        }
        // Group (tiers) rendering
        const primaryItem =
          entry.items.find((i) => (i as { tier_primary?: boolean }).tier_primary) ?? entry.items[0];
        const suggestions = entry.items
          .filter((i) => i.id !== primaryItem.id)
          .sort((a, b) => itemQty(a) - itemQty(b));
        const Icon = ICON[primaryItem.kind];
        const isNew = entry.items.some((i) => i.id === highlightId);
        const descricao =
          (primaryItem as { descricao?: string }).descricao || LABEL[primaryItem.kind];
        const renderTierRow = (it: V3Item, opts: { primary: boolean }) => {
          const price = priceOf(it).preco_total;
          const q = itemQty(it);
          const unit = q > 0 ? price / q : 0;
          return (
            <li
              key={it.id}
              className={cn(
                "flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-background",
                opts.primary ? "text-sm" : "text-xs",
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {opts.primary && (
                  <Badge
                    variant="default"
                    className="text-[10px] py-0 px-1.5 h-4 shrink-0"
                  >
                    Solicitada
                  </Badge>
                )}
                <span
                  className={cn(
                    "tabular-nums",
                    opts.primary ? "font-semibold text-primary" : "font-medium",
                  )}
                >
                  {q.toLocaleString("pt-BR")} un
                </span>
              </div>
              <span className="text-muted-foreground tabular-nums">
                {fmtBRL(unit)} / un
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  opts.primary ? "font-bold" : "font-semibold",
                )}
              >
                {fmtBRL(price)}
              </span>
              <button
                type="button"
                onClick={() => onRemove(it.id)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                title={opts.primary ? "Remover quantidade solicitada" : "Remover sugestão"}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          );
        };
        return (
          <li
            key={entry.groupId}
            className={cn(
              "group rounded-md border-2 border-primary/30 bg-primary/[0.03] p-3 transition-all",
              isNew && "ring-2 ring-emerald-500/50 animate-in fade-in slide-in-from-right-2",
            )}
          >
            <div className="flex items-start gap-2">
              <div className="rounded bg-primary/15 p-1.5 text-primary shrink-0">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-tight truncate">{descricao}</p>
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 shrink-0 gap-1">
                    <Layers className="h-2.5 w-2.5" />
                    Faixas ({entry.items.length})
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Comparativo de quantidades
                </p>
              </div>
            </div>

            <ul className="mt-2.5 space-y-1 border-t border-primary/20 pt-2">
              {renderTierRow(primaryItem, { primary: true })}
            </ul>

            {suggestions.length > 0 && (
              <>
                <p className="mt-2 px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Sugestões
                </p>
                <ul className="space-y-1">
                  {suggestions.map((it) => renderTierRow(it, { primary: false }))}
                </ul>
              </>
            )}

            <div className="mt-2 flex items-center justify-end opacity-60 group-hover:opacity-100 transition-opacity">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                onClick={() => entry.items.forEach((it) => onRemove(it.id))}
              >
                <Trash2 className="h-3 w-3 mr-1" /> Excluir grupo
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

interface BundleCardProps {
  entry: { type: "bundle"; bundleId: string; leader: V3Item; items: V3Item[] };
  highlightId?: string | null;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

function BundleCard({ entry, highlightId, onDuplicate, onRemove }: BundleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const leader = entry.leader;
  const Icon = ICON[leader.kind];
  const isNew = entry.items.some((i) => i.id === highlightId);
  const total = entry.items.reduce((acc, it) => acc + priceOf(it).preco_total, 0);
  const leaderQty = itemQty(leader);
  const title =
    (leader as { bundle_label?: string | null }).bundle_label ||
    (leader as { descricao?: string }).descricao ||
    LABEL[leader.kind];

  return (
    <li
      className={cn(
        "group rounded-md border-2 border-primary/30 bg-primary/[0.03] p-3 transition-all",
        isNew && "ring-2 ring-emerald-500/50 animate-in fade-in slide-in-from-right-2",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="rounded bg-primary/15 p-1.5 text-primary shrink-0">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span className="text-sm font-semibold tabular-nums text-primary shrink-0">
                {leaderQty.toLocaleString("pt-BR")} un
              </span>
              <p className="text-sm font-medium leading-tight">{title}</p>
            </div>
            <span className="text-sm font-semibold tabular-nums shrink-0">
              {fmtBRL(total)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {expanded ? "ocultar detalhes" : "ver detalhes"}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <ul className="mt-2.5 space-y-1 border-t border-primary/20 pt-2">
          {entry.items.map((it) => {
            const price = priceOf(it).preco_total;
            const descr = (it as { descricao?: string }).descricao || LABEL[it.kind];
            return (
              <li
                key={it.id}
                className="flex items-center justify-between gap-2 text-xs rounded px-2 py-1 hover:bg-background"
              >
                <span className="truncate flex-1">{descr}</span>
                <span className="font-semibold tabular-nums shrink-0">{fmtBRL(price)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(it.id)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  title="Remover este item do bundle"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => entry.items.forEach((it) => onDuplicate(it.id))}
        >
          <Copy className="h-3 w-3 mr-1" /> Duplicar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={() => entry.items.forEach((it) => onRemove(it.id))}
        >
          <Trash2 className="h-3 w-3 mr-1" /> Excluir
        </Button>
      </div>
    </li>
  );
}
