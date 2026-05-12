import { ChevronDown, Sigma } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PricingBreakdown, PricingBreakdownItem } from "@/lib/quotes-v2/pricing";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (p: number) => `${p.toFixed(1).replace(".", ",")}%`;

interface ItemProps {
  item: PricingBreakdownItem;
  defaultOpen?: boolean;
}

/**
 * Composição de custo de UM item de impressão.
 * Mostra papel + impressão + acabamentos vinculados + markup tier.
 */
export function PriceBreakdownItemPanel({ item, defaultOpen = false }: ItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  const qty = Math.max(1, item.quantity);
  return (
    <div className="rounded-md border border-border/60 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs"
      >
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Sigma className="h-3.5 w-3.5" />
          Composição do preço
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {formatBRL(item.sellingPriceUnit)} / un
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1 text-xs tabular-nums border-t border-border/60">
          <Line
            label="Papel"
            sub={`${qty.toLocaleString("pt-BR")} × ${formatBRL(item.paperCostUnit)}`}
            value={item.paperTotal}
          />
          <Line
            label="Impressão"
            sub={`${qty.toLocaleString("pt-BR")} × ${formatBRL(item.printingCostUnit)} (já com multiplicadores)`}
            value={item.printingTotal}
          />
          {item.childMaterialsTotal > 0 && (
            <Line label="Materiais vinculados (capa, contracapa…)" value={item.childMaterialsTotal} />
          )}
          {item.childLaborTotal > 0 && (
            <Line label="Mão de obra vinculada" value={item.childLaborTotal} />
          )}
          <div className="border-t border-border/60 my-1" />
          <Line label="Custo bruto do item" value={item.baseCostTotal} bold />
          {item.tierLabel ? (
            <>
              <Line
                label={`Markup tier · ${item.tierLabel}`}
                sub={`fixo ${fmtPct(item.tierFixedPct)} + variável ${fmtPct(item.tierVariablePct)} + margem ${fmtPct(item.tierMarginPct)} = ${fmtPct(item.tierTotalPct)}`}
                value={item.sellingTotal - item.baseCostTotal}
              />
              <div className="text-[10px] text-muted-foreground pl-1">
                Divisor 1 − {fmtPct(item.tierTotalPct)} = {(1 - item.tierTotalPct / 100).toFixed(3).replace(".", ",")}
              </div>
            </>
          ) : (
            <div className="text-[10px] text-amber-600">Sem tier de markup configurado.</div>
          )}
          <div className="border-t border-border/60 my-1" />
          <Line label="Subtotal do item" value={item.sellingTotal} bold highlight />
        </div>
      )}
    </div>
  );
}

/**
 * Composição GLOBAL — quebra todo o "Valor a cobrar".
 * Renderizado dentro da StickyFinancialSidebar.
 */
export function PriceBreakdownGlobal({ data }: { data: PricingBreakdown }) {
  return (
    <div className="space-y-1 text-xs tabular-nums">
      {data.items.map((it) => (
        <Line key={it.id} label={truncate(it.description, 32)} value={it.sellingTotal} />
      ))}
      {data.nonPrintingMaterialsTotal > 0 && (
        <Line label="Materiais avulsos" value={data.nonPrintingMaterialsTotal} />
      )}
      {data.laborTotal > 0 && (
        <Line label="Mão de obra avulsa" value={data.laborTotal} />
      )}
      {data.thirdPartyTotal > 0 && (
        <Line label="Terceirizados" value={data.thirdPartyTotal} />
      )}
      {data.freight > 0 && <Line label="Frete" value={data.freight} />}
      {data.hiddenExtras > 0 && <Line label="Outros (ocultos)" value={data.hiddenExtras} />}

      {data.costsBeforeMarkup > 0 && (
        <>
          <div className="border-t border-border/60 my-1" />
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground pt-1">
            Markup global sobre custos avulsos
          </div>
          <Line label="Custos antes do markup" value={data.costsBeforeMarkup} muted />
          <Line label={`(+) Impostos ${fmtPct(data.invoicePct)}`} value={data.taxes} muted />
          <Line label={`(+) Perda ${fmtPct(data.wastePct)}`} value={data.losses} muted />
          <Line label={`(+) Cobrança ${fmtPct(data.collectionPct)}`} value={data.collection} muted />
          <Line label={`(+) Margem ${fmtPct(data.profitMarginPct)}`} value={data.profit} muted />
        </>
      )}

      <div className="border-t border-border/60 my-1" />
      <Line label="Total a cobrar" value={data.totalToCharge} bold highlight />
    </div>
  );
}

function Line({
  label,
  sub,
  value,
  bold,
  highlight,
  muted,
}: {
  label: string;
  sub?: string;
  value: number;
  bold?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between items-start gap-3">
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "leading-tight",
            bold && "font-semibold",
            muted ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {label}
        </div>
        {sub && <div className="text-[10px] text-muted-foreground leading-tight">{sub}</div>}
      </div>
      <div
        className={cn(
          "shrink-0 tabular-nums",
          bold && "font-semibold",
          highlight && "text-primary",
          muted && !bold && "text-muted-foreground",
        )}
      >
        {formatBRL(value)}
      </div>
    </div>
  );
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
