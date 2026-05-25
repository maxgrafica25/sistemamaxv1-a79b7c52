import { useState } from "react";
import { Button } from "@/components/ui/button";

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
import type { ArtStatus, V3Item } from "../types";
import { ART_SHORT } from "../shared/artStatus";
import { priceOf, fmtBRL } from "../shared/pricing";
import { marginTextClass } from "@/lib/quotes/margin";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export interface CartPcts {
  taxPct: number;
  feesPct: number;
  wastePct: number;
}

interface Props extends CartPcts {
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

function itemQty(it: V3Item): number {
  if (it.kind === "labor") return 1;
  if (it.kind === "booklet") return it.bookletUnits;
  return (it as { quantidade?: number }).quantidade ?? 1;
}

function sideLabel(side?: string): string {
  if (!side) return "";
  const s = side.toLowerCase();
  if (s.includes("f/v") || s.includes("verso") || s.includes("duplex")) return "Frente/Verso";
  return "Frente";
}

function itemSubtitle(it: V3Item): string {
  const parts: string[] = [];
  switch (it.kind) {
    case "print": {
      if (it.paper_type) parts.push(`${it.paper_type}${it.grammage ? ` ${it.grammage}g` : ""}`);
      const side = sideLabel(it.side);
      if (side) parts.push(side);
      const finNames = it.finishing_selections?.map((f) => f.name).filter(Boolean) ?? it.finishings ?? [];
      finNames.forEach((n) => parts.push(n));
      break;
    }
    case "booklet": {
      if (it.paper_type) parts.push(`${it.paper_type}${it.grammage ? ` ${it.grammage}g` : ""}`);
      parts.push(it.bookletDuplex ? "Frente/Verso" : "Frente");
      break;
    }
    case "label": {
      if (it.paper_type) parts.push(`${it.paper_type}${it.grammage ? ` ${it.grammage}g` : ""}`);
      if (it.finishing_nome) parts.push(it.finishing_nome);
      break;
    }

    case "cv": {
      if (it.midia_nome) parts.push(it.midia_nome);
      if (it.impressao_nome) parts.push(it.impressao_nome);
      (it.finishings ?? []).forEach((n) => parts.push(n));
      break;
    }
    case "third": {
      if (it.fornecedor) parts.push(it.fornecedor);
      break;
    }
    case "supply": {
      if (it.supply_nome) parts.push(it.supply_nome);
      break;
    }
    case "labor": {
      parts.push(`${it.time_minutes} min`);
      if (it.step_type) parts.push(it.step_type);
      break;
    }
  }
  return parts.join(" | ");
}


const DEFAULT_NAME: Record<V3Item["kind"], string> = {
  print: "Impresso personalizado",
  booklet: "Apostila",
  label: "Etiqueta",
  cv: "Comunicação visual",
  third: "Serviço terceirizado",
  supply: "Suprimento",
  labor: "Mão-de-obra",
};

function pluralizeWord(w: string): string {
  if (!w) return w;
  // preserva caixa simples
  const lower = w.toLowerCase();
  // já no plural?
  if (/(s|ns|es|is|ões)$/.test(lower) && lower.length > 3) return w;
  if (lower.endsWith("ão")) return w.slice(0, -2) + "ões";
  if (lower.endsWith("m")) return w.slice(0, -1) + "ns";
  if (lower.endsWith("l")) return w.slice(0, -1) + "is";
  if (/[rsz]$/.test(lower)) return w + "es";
  if (/[aeiouáéíóúâêôãõn]$/.test(lower)) return w + "s";
  return w + "s";
}

function pluralizePt(name: string, qty: number): string {
  if (qty <= 1) return name;
  const tokens = name.split(/\s+/);
  if (tokens.length === 0) return name;
  // pluraliza primeira palavra (substantivo) e última (provável adjetivo) se diferente
  tokens[0] = pluralizeWord(tokens[0]);
  if (tokens.length > 1) {
    const last = tokens.length - 1;
    tokens[last] = pluralizeWord(tokens[last]);
  }
  return tokens.join(" ");
}

function rawName(it: V3Item): string {
  const bundleLabel = (it as { bundle_label?: string | null }).bundle_label;
  if (bundleLabel && bundleLabel.trim()) return bundleLabel.trim();
  const descr = (it as { descricao?: string }).descricao;
  if (descr && descr.trim()) return descr.trim();
  return DEFAULT_NAME[it.kind];
}

function itemSize(it: V3Item): string {
  switch (it.kind) {
    case "label": {
      const fmt = (mm: number) => (mm / 10).toFixed(1).replace(".", ",").replace(/,0$/, "");
      return `${fmt(it.labelW_mm)}×${fmt(it.labelH_mm)} cm`;
    }
    case "cv":
      return `${(it.largura_m * 100).toFixed(0)}×${(it.altura_m * 100).toFixed(0)} cm`;
    case "print":
      return (it as { formato?: string | null }).formato ?? "";
    case "booklet":
      return it.bookletPages ? `${it.bookletPages} pág.` : "";
    default:
      return "";
  }
}

function itemTitle(it: V3Item): string {
  const qty = itemQty(it);
  const name = pluralizePt(rawName(it), qty);
  const size = itemSize(it);
  return `${qty.toLocaleString("pt-BR")} un. - ${name}${size ? ` ${size}` : ""}`;
}



type FinRow = { label: string; value: string; tone?: "muted" | "default" | "strong"; className?: string };

interface FinancialBreakdown {
  rows: FinRow[];
  profitPct: number;
}

function buildFinancials(
  custo_total: number,
  preco_total: number,
  pcts: CartPcts,
  opts: { laborCost?: number } = {},
): FinancialBreakdown {
  const perda = preco_total * (pcts.wastePct / 100);
  const imposto = preco_total * (pcts.taxPct / 100);
  const taxa = preco_total * (pcts.feesPct / 100);
  const lucro = preco_total - custo_total - perda - imposto - taxa;
  const lucroPct = preco_total > 0 ? (lucro / preco_total) * 100 : 0;

  const rows: FinRow[] = [];
  if (opts.laborCost != null) {
    rows.push({ label: "Custo mão de obra", value: fmtBRL(opts.laborCost), tone: "muted", className: "text-destructive" });
  } else {
    rows.push({ label: "Custo material", value: fmtBRL(custo_total), tone: "muted", className: "text-destructive" });
  }
  rows.push({ label: `Custo perda (${pcts.wastePct.toFixed(0)}%)`, value: fmtBRL(perda), tone: "muted", className: "text-destructive" });
  rows.push({ label: `Imposto (${pcts.taxPct.toFixed(0)}%)`, value: fmtBRL(imposto), tone: "muted", className: "text-destructive" });
  rows.push({ label: `Taxa cartão / fatura (${pcts.feesPct.toFixed(0)}%)`, value: fmtBRL(taxa), tone: "muted", className: "text-destructive" });
  rows.push({ label: "Preço de venda", value: fmtBRL(preco_total), tone: "default" });
  rows.push({
    label: "Lucro líquido",
    value: `${fmtBRL(lucro)} · ${lucroPct.toFixed(1).replace(".", ",")}%`,
    tone: "strong",
    className: marginTextClass(lucroPct),
  });
  return { rows, profitPct: lucroPct };
}

function itemFinancials(it: V3Item, pcts: CartPcts): FinancialBreakdown {
  const p = priceOf(it);
  return buildFinancials(
    p.custo_total,
    p.preco_total,
    pcts,
    it.kind === "labor" ? { laborCost: p.custo_total } : {},
  );
}

function itemContext(it: V3Item): { label: string; value: string }[] {
  const qty = itemQty(it);
  const ctx: { label: string; value: string }[] = [];
  const art = (it as { art_status?: ArtStatus | null }).art_status;
  if (art) ctx.push({ label: "Arte", value: ART_SHORT[art] });
  switch (it.kind) {
    case "print":
      if (it.paper_type) ctx.push({ label: "Papel", value: `${it.paper_type}${it.grammage ? ` ${it.grammage}g` : ""}${it.size ? ` · ${it.size}` : ""}${it.side ? ` · ${it.side}` : ""}` });
      ctx.push({ label: "Quantidade", value: `${qty.toLocaleString("pt-BR")} folhas` });
      if (it.finishing_selections?.length) {
        ctx.push({ label: "Acabamentos", value: it.finishing_selections.map((f) => f.name).join(", ") });
      } else if (it.finishings?.length) {
        ctx.push({ label: "Acabamentos", value: it.finishings.join(", ") });
      }
      break;
    case "cv":
      ctx.push({ label: "Mídia", value: it.midia_nome });
      ctx.push({ label: "Dimensão", value: `${(it.largura_m * 100).toFixed(0)}×${(it.altura_m * 100).toFixed(0)} cm · ${qty} un` });
      if (it.impressao_nome) ctx.push({ label: "Impressão", value: it.impressao_nome });
      if (it.finishings?.length) ctx.push({ label: "Acabamentos", value: it.finishings.join(", ") });
      break;
    case "third":
      ctx.push({ label: "Fornecedor", value: it.fornecedor || "—" });
      ctx.push({ label: "Quantidade", value: `${qty} un` });
      break;
    case "booklet":
      if (it.paper_type) ctx.push({ label: "Miolo", value: `${it.paper_type}${it.grammage ? ` ${it.grammage}g` : ""}${it.bookletDuplex ? " · F/V" : ""}` });
      ctx.push({ label: "Apostilas", value: `${it.bookletUnits} un · ${it.bookletPages} fl` });
      break;
    case "labor":
      ctx.push({ label: "Etapa", value: it.step_type });
      ctx.push({ label: "Tempo", value: `${it.time_minutes} min · ${fmtBRL(it.hourly_rate)}/h` });
      break;
    case "supply":
      ctx.push({ label: "Suprimento", value: it.supply_nome });
      ctx.push({ label: "Quantidade", value: `${qty} un` });
      break;
    case "label":
      ctx.push({ label: "Etiqueta", value: `${it.labelW_mm}×${it.labelH_mm} mm · ${it.shape} · ${qty} un` });
      if (it.paper_type) ctx.push({ label: "Papel", value: `${it.paper_type}${it.grammage ? ` ${it.grammage}g` : ""}` });
      if (it.finishing_nome) ctx.push({ label: "Acabamento", value: it.finishing_nome });
      break;
  }
  return ctx;
}

function ExpandedDetails({
  context,
  breakdown,
}: {
  context: { label: string; value: string }[];
  breakdown: FinancialBreakdown | null;
}) {
  return (
    <div className="mt-1 border-t border-border/40 pt-1 space-y-1">
      {context.length > 0 && (
        <ul className="space-y-0">
          {context.map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-[10px] px-1">
              <span className="text-muted-foreground">{c.label}</span>
              <span className="tabular-nums text-foreground/80 truncate max-w-[60%] text-right">{c.value}</span>
            </li>
          ))}
        </ul>
      )}
      {breakdown && (
        <div className="rounded bg-muted/30 px-1.5 py-1">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
            Custos e lucro
          </p>
          <ul className="space-y-0">
            {breakdown.rows.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-[10px] px-1">
                <span className={cn(
                  r.tone === "strong" && "font-semibold",
                  r.className ?? (r.tone === "muted" ? "text-muted-foreground" : undefined),
                )}>
                  {r.label}
                </span>
                <span className={cn(
                  "tabular-nums",
                  r.tone === "default" && "font-medium",
                  r.tone === "strong" && "font-semibold",
                  r.className ?? (r.tone === "muted" ? "text-muted-foreground" : undefined),
                )}>
                  {r.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


// Ícones de ação no canto superior direito — sempre visíveis com opacity-40,
// passam para opacity-100 em hover/active (touch-friendly para tablets).
interface CardActionsProps {
  onDuplicate?: () => void;
  onRemove: () => void;
  removeTitle?: string;
  onToggleExpand?: () => void;
  expanded?: boolean;
}
function CardActions({ onDuplicate, onRemove, removeTitle = "Excluir", onToggleExpand, expanded }: CardActionsProps) {
  return (
    <div className="flex items-center gap-0.5 shrink-0 opacity-40 hover:opacity-100 active:opacity-100 focus-within:opacity-100 transition-opacity">
      {onToggleExpand && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 mr-1"
          onClick={onToggleExpand}
          title={expanded ? "Ocultar detalhes" : "Ver detalhes"}
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
      )}
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

export function UnifiedCart({ items, onDuplicate, onRemove, highlightId, taxPct, feesPct, wastePct }: Props) {
  const pcts: CartPcts = { taxPct, feesPct, wastePct };
  const showFinancials = useIsAdmin();
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
    <ul className="space-y-1 min-w-0">
      {entries.map((entry) => {
        if (entry.type === "single") {
          return (
            <SingleCard
              key={entry.item.id}
              item={entry.item}
              isNew={highlightId === entry.item.id}
              onDuplicate={onDuplicate}
              onRemove={onRemove}
              pcts={pcts}
              showFinancials={showFinancials}
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
              pcts={pcts}
              showFinancials={showFinancials}
            />
          );
        }

        return (
          <GroupCard
            key={entry.groupId}
            entry={entry}
            highlightId={highlightId}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
            pcts={pcts}
            showFinancials={showFinancials}
          />
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
  pcts: CartPcts;
  showFinancials: boolean;
}

function BundleCard({ entry, highlightId, onDuplicate, onRemove, pcts, showFinancials }: BundleCardProps) {
  const [expanded, setExpanded] = useState(showFinancials);
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
            <p className="text-[13px] font-medium leading-tight truncate min-w-0 flex-1" title={title}>
              {itemTitle(leader)}
            </p>
            <span className="text-[13px] font-semibold tabular-nums shrink-0 whitespace-nowrap">
              {fmtBRL(total)}
            </span>
          </div>
          {itemSubtitle(leader) && (
            <p className="text-[11px] text-muted-foreground truncate">{itemSubtitle(leader)}</p>
          )}
        </div>
        <CardActions
          onToggleExpand={() => setExpanded((v) => !v)}
          expanded={expanded}
          onDuplicate={() => entry.items.forEach((it) => onDuplicate(it.id))}
          onRemove={() => entry.items.forEach((it) => onRemove(it.id))}
        />
      </div>

      {expanded && (
        <>
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
          {showFinancials && (
            <ExpandedDetails
              context={[]}
              breakdown={buildFinancials(
                entry.items.reduce((a, it) => a + priceOf(it).custo_total, 0),
                entry.items.reduce((a, it) => a + priceOf(it).preco_total, 0),
                pcts,
              )}
            />
          )}
        </>
      )}
    </li>
  );
}

interface SingleCardProps {
  item: V3Item;
  isNew: boolean;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  pcts: CartPcts;
  showFinancials: boolean;
}

function SingleCard({ item, isNew, onDuplicate, onRemove, pcts, showFinancials }: SingleCardProps) {
  const [expanded, setExpanded] = useState(showFinancials);
  const Icon = ICON[item.kind];
  const price = priceOf(item).preco_total;
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
          <p className="text-[13px] font-medium leading-tight truncate">
            {itemTitle(item)}
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{itemSubtitle(item)}</p>
        </div>
        <CardActions
          onToggleExpand={() => setExpanded((v) => !v)}
          expanded={expanded}
          onDuplicate={() => onDuplicate(item.id)}
          onRemove={() => onRemove(item.id)}
        />
      </div>

      <div className="mt-1 text-right text-[13px] font-semibold tabular-nums whitespace-nowrap">
        {fmtBRL(price)}
      </div>

      {expanded && (
        <ExpandedDetails
          context={itemContext(item)}
          breakdown={showFinancials ? itemFinancials(item, pcts) : null}
        />
      )}
    </li>
  );
}

interface GroupCardProps {
  entry: { type: "group"; groupId: string; items: V3Item[] };
  highlightId?: string | null;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  pcts: CartPcts;
  showFinancials: boolean;
}

function GroupCard({ entry, highlightId, onDuplicate, onRemove, pcts, showFinancials }: GroupCardProps) {
  const [expanded, setExpanded] = useState(showFinancials);
  const primaryItem =
    entry.items.find((i) => (i as { tier_primary?: boolean }).tier_primary) ?? entry.items[0];
  const primaryPrice = priceOf(primaryItem).preco_total;
  const extraTiers = entry.items.length - 1;
  const Icon = ICON[primaryItem.kind];
  const isNew = entry.items.some((i) => i.id === highlightId);

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
          <p className="text-[13px] font-medium leading-tight truncate">
            {itemTitle(primaryItem)}
          </p>
          {itemSubtitle(primaryItem) && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{itemSubtitle(primaryItem)}</p>
          )}
          {extraTiers > 0 && (
            <p className="text-[10px] text-muted-foreground/80 italic mt-0.5">
              + {extraTiers} {extraTiers === 1 ? "faixa sugerida" : "faixas sugeridas"} ao cliente
            </p>
          )}
        </div>
        <CardActions
          onToggleExpand={() => setExpanded((v) => !v)}
          expanded={expanded}
          onDuplicate={() => onDuplicate(primaryItem.id)}
          onRemove={() => entry.items.forEach((it) => onRemove(it.id))}
          removeTitle="Excluir grupo (todas as faixas)"
        />
      </div>

      <div className="mt-1 text-right text-[13px] font-semibold tabular-nums whitespace-nowrap">
        {fmtBRL(primaryPrice)}
      </div>


      {expanded && (
        <ExpandedDetails
          context={itemContext(primaryItem)}
          breakdown={showFinancials ? itemFinancials(primaryItem, pcts) : null}
        />
      )}
    </li>
  );
}
