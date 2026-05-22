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

type Detail = { label: string; value: string; muted?: boolean };

function itemDetails(it: V3Item): Detail[] {
  const p = priceOf(it);
  const qty = itemQty(it);
  const unit = qty > 0 ? p.preco_total / qty : 0;
  const rows: Detail[] = [];
  switch (it.kind) {
    case "print": {
      if (it.paper_type) rows.push({ label: "Papel", value: `${it.paper_type}${it.grammage ? ` ${it.grammage}g` : ""}` });
      if (it.size) rows.push({ label: "Formato", value: it.size });
      if (it.side) rows.push({ label: "Lado", value: it.side });
      rows.push({ label: "Quantidade", value: `${qty.toLocaleString("pt-BR")} un` });
      rows.push({ label: "Custo unitário", value: fmtBRL(it.custo_unitario), muted: true });
      rows.push({ label: "Preço unitário", value: fmtBRL(it.valor_unitario), muted: true });
      if (it.finishing_selections?.length) {
        rows.push({ label: "Acabamentos", value: it.finishing_selections.map((f) => f.name).join(", ") });
        const totalAcab = it.finishing_selections.reduce((a, f) => a + f.price * (f.units ?? 1), 0);
        if (totalAcab > 0) rows.push({ label: "Total acabamentos", value: fmtBRL(totalAcab), muted: true });
      } else if (it.finishings?.length) {
        rows.push({ label: "Acabamentos", value: it.finishings.join(", ") });
      }
      break;
    }
    case "cv": {
      rows.push({ label: "Mídia", value: it.midia_nome });
      if (it.impressao_nome) rows.push({ label: "Impressão", value: it.impressao_nome });
      const area = (it.largura_m * it.altura_m * qty).toFixed(2).replace(".", ",");
      rows.push({ label: "Dimensão", value: `${(it.largura_m * 100).toFixed(0)}×${(it.altura_m * 100).toFixed(0)} cm · ${qty} un` });
      rows.push({ label: "Área total", value: `${area} m²` });
      if (it.finishings?.length) rows.push({ label: "Acabamentos", value: it.finishings.join(", ") });
      if (it.snapshot) {
        rows.push({ label: "Mídia (preço)", value: fmtBRL(it.snapshot.preco_midia), muted: true });
        rows.push({ label: "Impressão", value: fmtBRL(it.snapshot.preco_impressao), muted: true });
        rows.push({ label: "Acabamentos", value: fmtBRL(it.snapshot.preco_acabamentos), muted: true });
        rows.push({ label: "Custo total", value: fmtBRL(it.snapshot.custo_total), muted: true });
        if (it.snapshot.aplicou_minimo) rows.push({ label: "Atenção", value: "Mínimo aplicado" });
      }
      break;
    }
    case "third": {
      rows.push({ label: "Fornecedor", value: it.fornecedor || "—" });
      rows.push({ label: "Quantidade", value: `${qty} un` });
      rows.push({ label: "Custo unitário", value: fmtBRL(it.custo), muted: true });
      rows.push({ label: "Margem", value: `${it.margem_pct.toFixed(0)}%`, muted: true });
      rows.push({ label: "Custo total", value: fmtBRL(it.custo * qty), muted: true });
      break;
    }
    case "booklet": {
      if (it.paper_type) rows.push({ label: "Miolo", value: `${it.paper_type}${it.grammage ? ` ${it.grammage}g` : ""}${it.bookletDuplex ? " · F/V" : ""}` });
      rows.push({ label: "Folhas por apostila", value: `${it.bookletPages}` });
      rows.push({ label: "Apostilas", value: `${it.bookletUnits} un` });
      rows.push({ label: "Custo / folha", value: fmtBRL(it.custo_unitario), muted: true });
      rows.push({ label: "Preço / folha", value: fmtBRL(it.valor_unitario), muted: true });
      break;
    }
    case "labor": {
      rows.push({ label: "Etapa", value: it.step_type });
      rows.push({ label: "Tempo", value: `${it.time_minutes} min` });
      rows.push({ label: "Custo/hora", value: fmtBRL(it.hourly_rate), muted: true });
      rows.push({ label: "Margem", value: `${it.margem_pct.toFixed(0)}%`, muted: true });
      break;
    }
    case "supply": {
      rows.push({ label: "Suprimento", value: it.supply_nome });
      if (it.fornecedor) rows.push({ label: "Fornecedor", value: it.fornecedor });
      rows.push({ label: "Quantidade", value: `${qty} un` });
      rows.push({ label: "Custo unitário", value: fmtBRL(it.custo_unitario), muted: true });
      rows.push({ label: "Margem", value: `${it.margem_pct.toFixed(0)}%`, muted: true });
      break;
    }
    case "label": {
      rows.push({ label: "Etiqueta", value: `${it.labelW_mm}×${it.labelH_mm} mm · ${it.shape}` });
      rows.push({ label: "Quantidade", value: `${qty.toLocaleString("pt-BR")} un` });
      if (it.paper_type) rows.push({ label: "Papel", value: `${it.paper_type}${it.grammage ? ` ${it.grammage}g` : ""}` });
      rows.push({ label: "Folha", value: `${it.sheet_size} · ${it.per_sheet}/folha · ${it.sheets_needed} fl` });
      if (it.finishing_nome) rows.push({ label: "Acabamento", value: it.finishing_nome });
      rows.push({ label: "Preço / folha", value: fmtBRL(it.price_per_sheet), muted: true });
      rows.push({ label: "Custo total", value: fmtBRL(it.custo_total), muted: true });
      break;
    }
  }
  rows.push({ label: "Unitário", value: `${fmtBRL(unit)} / un`, muted: true });
  rows.push({ label: "Total", value: fmtBRL(p.preco_total) });
  return rows;
}

// Ícones de ação no canto superior direito — sempre visíveis com opacity-40,
// passam para opacity-100 em hover/active (touch-friendly para tablets).
interface CardActionsProps {
  onDuplicate?: () => void;
  onRemove: () => void;
  removeTitle?: string;
}
function CardActions({ onDuplicate, onRemove, removeTitle = "Excluir" }: CardActionsProps) {
  return (
    <div className="flex items-center gap-0.5 shrink-0 opacity-40 hover:opacity-100 active:opacity-100 focus-within:opacity-100 transition-opacity">
      {onDuplicate && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onDuplicate}
          title="Duplicar"
        >
          <Copy className="h-3 w-3" />
        </Button>
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-destructive hover:text-destructive"
        onClick={onRemove}
        title={removeTitle}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
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
      <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-4 text-center">
        <ShoppingCart className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum item ainda.</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          Configure no painel à esquerda e adicione ao orçamento.
        </p>
      </div>
    );
  }
  const entries = groupItems(items);
  return (
    <ul className="space-y-1">
      {entries.map((entry) => {
        if (entry.type === "single") {
          return (
            <SingleCard
              key={entry.item.id}
              item={entry.item}
              isNew={highlightId === entry.item.id}
              onDuplicate={onDuplicate}
              onRemove={onRemove}
            />
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
        const primaryQty = itemQty(primaryItem);
        const primaryPrice = priceOf(primaryItem).preco_total;
        const primaryUnit = primaryQty > 0 ? primaryPrice / primaryQty : 0;

        const sortedAll = [...entry.items].sort((a, b) => itemQty(a) - itemQty(b));
        const Icon = ICON[primaryItem.kind];
        const isNew = entry.items.some((i) => i.id === highlightId);
        const descricao =
          (primaryItem as { descricao?: string }).descricao || LABEL[primaryItem.kind];

        const renderTierRow = (it: V3Item, opts: { primary: boolean; showDivider: boolean }) => {
          const price = priceOf(it).preco_total;
          const q = itemQty(it);
          const unit = q > 0 ? price / q : 0;
          const economiaPct =
            !opts.primary && primaryUnit > 0
              ? ((primaryUnit - unit) / primaryUnit) * 100
              : 0;
          return (
            <li
              key={it.id}
              className={cn(
                "flex items-center gap-2 px-1 py-0.5 text-[11px]",
                opts.showDivider && "border-t border-border/40 mt-0.5 pt-1",
                !opts.primary && "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "tabular-nums flex items-center gap-1.5 min-w-[110px]",
                  opts.primary && "text-[13px] font-semibold text-primary",
                )}
              >
                {q.toLocaleString("pt-BR")} un
                {opts.primary && (
                  <span className="text-[9px] uppercase tracking-wide text-primary/70 font-medium">
                    · solicitada
                  </span>
                )}
              </span>
              <span className="tabular-nums flex-1 text-right">
                {fmtBRL(unit)} / un
              </span>
              <span
                className={cn(
                  "tabular-nums min-w-[80px] text-right",
                  opts.primary ? "text-[13px] font-bold text-foreground" : "font-medium",
                )}
              >
                {fmtBRL(price)}
              </span>
              {economiaPct > 0.5 ? (
                <span className="inline-flex rounded px-1.5 py-0 text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 tabular-nums">
                  −{economiaPct.toFixed(0)}% un
                </span>
              ) : (
                <span className="w-[48px]" />
              )}
              <button
                type="button"
                onClick={() => onRemove(it.id)}
                className="text-muted-foreground/60 hover:text-destructive shrink-0 opacity-40 hover:opacity-100 active:opacity-100 transition-opacity"
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
              "rounded-md border border-border/60 bg-card px-2 py-1.5 transition-all",
              isNew && "ring-2 ring-emerald-500/50 animate-in fade-in slide-in-from-right-2",
            )}
          >
            <div className="flex items-start gap-1.5">
              <div className="rounded bg-primary/10 p-0.5 text-primary shrink-0">
                <Icon className="h-3 w-3" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-tight truncate">{descricao}</p>
              </div>
              <CardActions
                onRemove={() => entry.items.forEach((it) => onRemove(it.id))}
                removeTitle="Excluir grupo"
              />
            </div>

            <ul className="mt-1 space-y-0">
              {sortedAll.map((it, i) => {
                const isPrimary = it.id === primaryItem.id;
                const prev = sortedAll[i - 1];
                const showDivider =
                  i > 0 && (isPrimary || (prev && prev.id === primaryItem.id));
                return renderTierRow(it, { primary: isPrimary, showDivider });
              })}
            </ul>
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
        "rounded-md border border-border/60 bg-card px-2 py-1.5 transition-all",
        isNew && "ring-2 ring-emerald-500/50 animate-in fade-in slide-in-from-right-2",
      )}
    >
      <div className="flex items-start gap-1.5">
        <div className="rounded bg-primary/10 p-0.5 text-primary shrink-0">
          <Icon className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <span className="text-[13px] font-semibold tabular-nums text-primary shrink-0 whitespace-nowrap">
                {leaderQty.toLocaleString("pt-BR")} un
              </span>
              <p className="text-[13px] font-medium leading-tight truncate min-w-0">{title}</p>
            </div>
            <span className="text-[13px] font-semibold tabular-nums shrink-0 whitespace-nowrap">
              {fmtBRL(total)}
            </span>
          </div>
          <div className="mt-0">
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
        <CardActions
          onDuplicate={() => entry.items.forEach((it) => onDuplicate(it.id))}
          onRemove={() => entry.items.forEach((it) => onRemove(it.id))}
        />
      </div>

      {expanded && (
        <ul className="mt-1 space-y-0 border-t border-border/40 pt-1">
          {entry.items.map((it) => {
            const price = priceOf(it).preco_total;
            const descr = (it as { descricao?: string }).descricao || LABEL[it.kind];
            return (
              <li
                key={it.id}
                className="flex items-center justify-between gap-2 text-[11px] px-1 py-0.5"
              >
                <span className="truncate flex-1 text-muted-foreground">{descr}</span>
                <span className="font-medium tabular-nums shrink-0">{fmtBRL(price)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(it.id)}
                  className="text-muted-foreground/60 hover:text-destructive shrink-0 opacity-40 hover:opacity-100 active:opacity-100 transition-opacity"
                  title="Remover este item do bundle"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

interface SingleCardProps {
  item: V3Item;
  isNew: boolean;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

function SingleCard({ item, isNew, onDuplicate, onRemove }: SingleCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICON[item.kind];
  const price = priceOf(item).preco_total;
  const details = expanded ? itemDetails(item) : [];
  return (
    <li
      className={cn(
        "rounded-md border border-border/60 bg-card px-2 py-1.5 transition-all",
        isNew && "ring-2 ring-emerald-500/50 animate-in fade-in slide-in-from-right-2",
      )}
    >
      <div className="flex items-start gap-1.5">
        <div className="rounded bg-primary/10 p-0.5 text-primary shrink-0">
          <Icon className="h-3 w-3" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-medium leading-tight truncate">
              {(item as { descricao?: string }).descricao || LABEL[item.kind]}
            </p>
            <span className="text-[13px] font-semibold tabular-nums shrink-0">
              {fmtBRL(price)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
              {LABEL[item.kind]}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{cartMeta(item)}</span>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="ml-auto inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "ocultar" : "detalhes"}
            </button>
          </div>
        </div>
        <CardActions
          onDuplicate={() => onDuplicate(item.id)}
          onRemove={() => onRemove(item.id)}
        />
      </div>

      {expanded && (
        <ul className="mt-1 space-y-0 border-t border-border/40 pt-1">
          {details.map((d, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-[10px] px-1">
              <span className={cn("text-muted-foreground", d.muted && "opacity-80")}>{d.label}</span>
              <span className={cn("tabular-nums", d.muted ? "text-muted-foreground" : "font-medium")}>
                {d.value}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
