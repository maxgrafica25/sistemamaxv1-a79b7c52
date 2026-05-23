import { ChevronDown, Sigma } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  PricingBreakdown,
  PricingBreakdownItem,
  PricingBreakdownItemDirectSum,
  PricingBreakdownItemTier,
  DirectSumChildRow,
} from "@/lib/quotes-v2/pricing";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (p: number) => `${p.toFixed(1).replace(".", ",")}%`;

interface ItemProps {
  item: PricingBreakdownItem;
  defaultOpen?: boolean;
}

export function PriceBreakdownItemPanel({ item, defaultOpen = false }: ItemProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isDirect = item.mode === "direct_sum";
  return (
    <div className="rounded-md border border-border/60 bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs"
      >
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Sigma className="h-3.5 w-3.5" />
          {isDirect ? "Resumo por unidade" : "Composição do preço"}
          <span
            className={cn(
              "ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium",
              isDirect
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-primary/15 text-primary",
            )}
          >
            {isDirect ? "Soma direta" : "Markup tier"}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="text-muted-foreground">
            {isDirect
              ? `${formatBRL((item as PricingBreakdownItemDirectSum).sellingPriceDisplayUnit)} / ${(item as PricingBreakdownItemDirectSum).displayUnitLabel}`
              : `${formatBRL(item.sellingPriceUnit)} / un`}
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1 text-xs tabular-nums border-t border-border/60">
          {isDirect ? (
            <DirectSumBody item={item as PricingBreakdownItemDirectSum} />
          ) : (
            <TierBody item={item as PricingBreakdownItemTier} />
          )}
        </div>
      )}
    </div>
  );
}

function ChildMarginTooltip({ rows, children }: { rows: DirectSumChildRow[]; children: React.ReactNode }) {
  if (rows.length === 0) return <>{children}</>;
  const hasDetail = rows.some(r => r.margemPct > 0 || r.priceSource === "manual_tier");
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("cursor-help", hasDetail && "underline decoration-dotted decoration-muted-foreground/40 underline-offset-2")}>
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            {rows.map(r => (
              <div key={r.id} className="space-y-0.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate">{r.description}</span>
                  <span className="tabular-nums shrink-0">
                    {r.priceSource === "manual_tier" && r.finalUnitLocked != null ? (
                      <strong>{formatBRL(r.finalUnitLocked)}</strong>
                    ) : (
                      <>
                        {formatBRL(r.custoUnit)}
                        {r.margemPct > 0 && (
                          <> + {r.margemPct.toFixed(0)}% = <strong>{formatBRL(r.vendaUnit)}</strong></>
                        )}
                      </>
                    )}
                  </span>
                </div>
                {r.priceSource === "manual_tier" && (
                  <div className="text-[10px] text-muted-foreground">
                    Faixa {r.tierLabel} · imposto e cartão já incluso · custo {formatBRL(r.custoUnit)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DirectSumBody({ item }: { item: PricingBreakdownItemDirectSum }) {
  const coversRows = item.childRows.filter(r => r.category === "covers");
  const finishingRows = item.childRows.filter(r => r.category === "finishing");
  const unit = item.displayUnitLabel;
  const units = Math.max(1, item.displayUnits);
  return (
    <>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground pt-1">
        Por 1 {unit}
      </div>
      <Line label={item.printingLabel} value={item.printingPerDisplayUnit} />
      {item.coversPerDisplayUnit > 0 && (
        <ChildMarginTooltip rows={coversRows}>
          <Line label="Capas" value={item.coversPerDisplayUnit} />
        </ChildMarginTooltip>
      )}
      {item.finishingPerDisplayUnit > 0 && (
        <ChildMarginTooltip rows={finishingRows}>
          <Line label="Acabamento (Mola, furação, etc)" value={item.finishingPerDisplayUnit} />
        </ChildMarginTooltip>
      )}
      {item.laborPerDisplayUnit > 0 && (
        <Line label="Montagem / Mão de obra" value={item.laborPerDisplayUnit} />
      )}
      <div className="border-t border-border/60 my-1" />
      <Line label={`Subtotal por ${unit}`} value={item.subtotalPerDisplayUnit} bold />
      <Line label={`Preço por ${unit}`} value={item.sellingPriceDisplayUnit} bold highlight />
      <div className="border-t border-border/60 my-1" />
      <Line
        label={`Total (${units.toLocaleString("pt-BR")} ${unit}${units > 1 ? "s" : ""})`}
        value={item.sellingTotal}
        bold
      />
    </>
  );
}

function TierBody({ item }: { item: PricingBreakdownItemTier }) {
  const qty = Math.max(1, item.quantity);
  return (
    <>
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
    </>
  );
}

/**
 * Composição GLOBAL renderizada na sidebar.
 * Para cada item de impressão pai, mostra um bloco específico do modo (soma
 * direta = "resumo por apostila"; tier = composição clássica). Avulsos /
 * frete / extras são listados ao final.
 */
export function PriceBreakdownGlobal({ data }: { data: PricingBreakdown }) {
  return (
    <div className="space-y-3 text-xs tabular-nums">
      {data.items.map((it) =>
        it.mode === "direct_sum" ? (
          <DirectSumBlock key={it.id} item={it} />
        ) : (
          <TierBlock key={it.id} item={it} />
        ),
      )}

      {(data.nonPrintingMaterialsTotal > 0 ||
        data.laborTotal > 0 ||
        data.thirdPartyTotal > 0 ||
        data.freight > 0 ||
        data.hiddenExtras > 0) && (
        <div className="rounded-md border border-border/60 bg-muted/20 p-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Custos avulsos
          </div>
          {data.nonPrintingMaterialsTotal > 0 && (
            <Line label="Materiais avulsos" value={data.nonPrintingMaterialsTotal} />
          )}
          {data.laborTotal > 0 && <Line label="Mão de obra avulsa" value={data.laborTotal} />}
          {data.thirdPartyTotal > 0 && (
            <Line label="Terceirizados" value={data.thirdPartyTotal} />
          )}
          {data.freight > 0 && <Line label="Frete" value={data.freight} />}
          {data.hiddenExtras > 0 && <Line label="Outros (ocultos)" value={data.hiddenExtras} />}
          {data.costsBeforeMarkup > 0 && (
            <>
              <div className="border-t border-border/60 my-1" />
              <div className="text-[10px] text-muted-foreground italic pb-0.5">
                Acréscimos sobre os custos avulsos (não passam pelos preços de cada item)
              </div>
              <Line label={`(+) Impostos ${fmtPct(data.invoicePct)}`} value={data.taxes} className="text-amber-600 dark:text-amber-400" />
              <Line label={`(+) Perda ${fmtPct(data.wastePct)}`} value={data.losses} className="text-amber-600 dark:text-amber-400" />
              <Line
                label={`(+) Cobrança ${fmtPct(data.collectionPct)}`}
                value={data.collection}
                className="text-amber-600 dark:text-amber-400"
              />
              <Line
                label={`(+) Margem ${fmtPct(data.profitMarginPct)}`}
                value={data.profit}
                className="text-amber-600 dark:text-amber-400"
              />
            </>
          )}
        </div>
      )}

      <div className="border-t border-border/60 my-1" />
      <Line label="Total a cobrar" value={data.totalToCharge} bold highlight />
    </div>
  );
}

function DirectSumBlock({ item }: { item: PricingBreakdownItemDirectSum }) {
  const coversRows = item.childRows.filter(r => r.category === "covers");
  const finishingRows = item.childRows.filter(r => r.category === "finishing");
  const unit = item.displayUnitLabel;
  const units = Math.max(1, item.displayUnits);
  return (
    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-400 font-medium">
            Resumo por {unit} · Soma direta
          </div>
          <div className="text-[11px] font-medium truncate">{item.description}</div>
        </div>
      </div>
      <Line label={item.printingLabel} value={item.printingPerDisplayUnit} />
      {item.coversPerDisplayUnit > 0 && (
        <ChildMarginTooltip rows={coversRows}>
          <Line label="Capas" value={item.coversPerDisplayUnit} />
        </ChildMarginTooltip>
      )}
      {item.finishingPerDisplayUnit > 0 && (
        <ChildMarginTooltip rows={finishingRows}>
          <Line label="Acabamento" value={item.finishingPerDisplayUnit} />
        </ChildMarginTooltip>
      )}
      {item.laborPerDisplayUnit > 0 && (
        <Line label="Montagem / Mão de obra" value={item.laborPerDisplayUnit} />
      )}
      <div className="border-t border-emerald-500/20 my-1" />
      <Line label={`Preço por ${unit}`} value={item.sellingPriceDisplayUnit} bold highlight />
      <Line
        label={`Total do pedido (${units.toLocaleString("pt-BR")} ${unit}${units > 1 ? "s" : ""})`}
        value={item.sellingTotal}
        bold
      />
    </div>
  );
}

function TierBlock({ item }: { item: PricingBreakdownItemTier }) {
  return (
    <div className="rounded-md border border-primary/25 bg-primary/5 p-2 space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-primary font-medium">
        Markup tier {item.tierLabel ? `· ${item.tierLabel}` : ""}
      </div>
      <div className="text-[11px] font-medium truncate">{item.description}</div>
      {item.paperTotal > 0 && <Line label="Papel" value={item.paperTotal} />}
      {item.printingTotal > 0 && <Line label="Impressão" value={item.printingTotal} />}
      {item.childMaterialsTotal > 0 && (
        <Line label="Materiais vinculados" value={item.childMaterialsTotal} />
      )}
      {item.childLaborTotal > 0 && (
        <Line label="Mão de obra vinculada" value={item.childLaborTotal} />
      )}
      <div className="border-t border-primary/20 my-1" />
      <Line label="Custo bruto" value={item.baseCostTotal} muted />
      <Line
        label={`Markup (${fmtPct(item.tierTotalPct)})`}
        value={item.sellingTotal - item.baseCostTotal}
        muted
      />
      <Line label="Subtotal do item" value={item.sellingTotal} bold highlight />
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
  className,
}: {
  label: string;
  sub?: string;
  value: number;
  bold?: boolean;
  highlight?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className="flex justify-between items-start gap-3">
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "leading-tight",
            bold && "font-semibold",
            muted ? "text-muted-foreground" : "text-foreground",
            className,
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
          className,
        )}
      >
        {formatBRL(value)}
      </div>
    </div>
  );
}
