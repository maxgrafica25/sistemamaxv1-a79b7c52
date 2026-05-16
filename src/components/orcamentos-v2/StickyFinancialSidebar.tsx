import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ChevronUp, ChevronDown, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PriceBreakdownGlobal } from "@/components/orcamentos-v2/PriceBreakdown";
import type { PricingBreakdown } from "@/lib/quotes-v2/pricing";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsAdmin } from "@/hooks/useIsAdmin";

interface Props {
  proposalTotal: number;
  approvedTotal: number;
  hasApproved: boolean;
  productionCost: number;
  taxPct: number;
  taxValue: number;
  billingPct: number;
  billingMethod: string;
  billingValue: number;
  lossPct: number;
  lossValue: number;
  netProfit: number;
  netMarginPct: number;
  revenueBase: number;
  composition?: PricingBreakdown | null;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatPct = (pct: number) => {
  if (Math.abs(pct) < 0.05) return "0,0%";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1).replace(".", ",")}%`;
};

const fmtPctRaw = (p: number) => `${p.toFixed(1).replace(".", ",")}%`;

export function StickyFinancialSidebar(props: Props) {
  const {
    proposalTotal, approvedTotal, hasApproved,
    productionCost, taxPct, taxValue, billingPct, billingMethod, billingValue,
    lossPct, lossValue, netProfit, netMarginPct, revenueBase, composition,
  } = props;

  const [open, setOpen] = useState(false);
  const isAdmin = useIsAdmin();
  const encargosTotal = taxValue + billingValue;
  const profitPositive = netProfit >= 0;

  const profitColor =
    netProfit < 0 ? "text-destructive" :
    netMarginPct < 10 ? "text-amber-500" :
    "text-emerald-600";

  const lowMargin = netMarginPct > 0 && netMarginPct < 10;

  const Body = (
    <div className="space-y-3 text-sm">
      <Row label="Valor da Proposta" value={formatBRL(proposalTotal)} muted />
      {hasApproved && (
        <Row
          label="Valor Aprovado"
          value={formatBRL(approvedTotal)}
          className="text-emerald-600 font-semibold"
        />
      )}

      {(() => {
        if (!isAdmin) return null;
        const onlyDirectSum =
          composition?.hasDirectSumItems && !composition?.hasTierItems;
        if (onlyDirectSum) return null;
        return (
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="dre" className="border-t border-border">
          <AccordionTrigger className="py-2 text-xs uppercase tracking-wide text-muted-foreground hover:no-underline">
            Ver detalhamento de custos e lucro
          </AccordionTrigger>
          <AccordionContent className="pb-2">
            <div className="space-y-1.5 text-xs">
              <DRELine label="Valor Total da Venda" value={revenueBase} />
              <DRELine
                label="(-) Impostos"
                badge={fmtPctRaw(taxPct)}
                value={-taxValue}
              />
              <DRELine
                label={`(-) Taxas de Venda/Cartão${billingMethod ? ` · ${billingMethod}` : ""}`}
                badge={fmtPctRaw(billingPct)}
                value={-billingValue}
              />
              <DRELine
                label="(-) Margem de Perda"
                badge={fmtPctRaw(lossPct)}
                value={-lossValue}
              />
              <Separator className="my-2" />
              <DRELine label="(=) Custo Bruto de Produção" value={-productionCost} />
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className={cn("font-semibold flex items-center gap-1.5", profitColor)}>
                  (=) Lucro Líquido
                  {lowMargin && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                </span>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px]", profitColor)}>
                    {formatPct(netMarginPct)}
                  </span>
                  <span className={cn("font-bold", profitColor)}>
                    {formatBRL(netProfit)}
                  </span>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
        );
      })()}


      {composition && (
        <Accordion type="single" collapsible className="w-full" defaultValue="composition">
          <AccordionItem value="composition" className="border-t border-border">
            <AccordionTrigger className="py-2 text-xs uppercase tracking-wide text-muted-foreground hover:no-underline">
              Composição do preço
            </AccordionTrigger>
            <AccordionContent className="pb-2">
              <PriceBreakdownGlobal data={composition} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      <div className="pt-2 border-t border-border">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
          Valor a cobrar
        </p>
        <p className="text-2xl font-bold text-primary">{formatBRL(revenueBase)}</p>
      </div>

      {isAdmin && (
        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-between gap-2 cursor-help">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    {profitPositive ? (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    )}
                    Lucro Líquido Estimado
                  </span>
                  <span
                    className={cn(
                      "text-base font-bold tabular-nums",
                      profitPositive ? "text-emerald-600" : "text-destructive",
                    )}
                  >
                    {formatBRL(netProfit)}{" "}
                    <span className="text-xs font-semibold">
                      ({formatPct(netMarginPct)})
                    </span>
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-[280px] text-xs">
                <div className="space-y-1">
                  <DRETooltipLine label="Faturamento Bruto" value={revenueBase} />
                  <DRETooltipLine label="(−) Encargos (Impostos + Cartão)" value={-encargosTotal} muted />
                  <div className="pl-3 text-[10px] text-muted-foreground space-y-0.5">
                    <DRETooltipLine label={`Impostos (${fmtPctRaw(taxPct)})`} value={-taxValue} tiny />
                    <DRETooltipLine
                      label={`Taxa de cartão${billingMethod ? ` · ${billingMethod}` : ""}`}
                      value={-billingValue}
                      tiny
                    />
                  </div>
                  <DRETooltipLine
                    label="(−) Custos de Produção"
                    value={-(productionCost + lossValue)}
                    muted
                  />
                  <Separator className="my-1" />
                  <DRETooltipLine
                    label="(=) Lucro Real"
                    value={netProfit}
                    bold
                    color={profitPositive ? "emerald" : "destructive"}
                  />
                  <p className="text-[10px] text-muted-foreground italic pt-1">
                    Visível apenas para administradores.
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {isAdmin && (
        <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
            Composição do Resultado
          </p>
          <div className="space-y-1.5 text-xs">
            <DRELine label="Custo Total do Produto/Serviço" value={productionCost} />
            <DRELine label="Impostos" badge={fmtPctRaw(taxPct)} value={taxValue} />
            <DRELine label="Perdas/Desperdícios" badge={fmtPctRaw(lossPct)} value={lossValue} />
            <DRELine
              label={`Taxas de Cartão${billingMethod ? ` · ${billingMethod}` : ""}`}
              badge={fmtPctRaw(billingPct)}
              value={billingValue}
            />
            <Separator className="my-2" />
            <div className="flex justify-between items-center">
              <span className="font-semibold text-foreground">Lucro Bruto</span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatBRL(revenueBase - productionCost)}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-center">
              <span className={cn("font-semibold flex items-center gap-1.5", profitColor)}>
                Lucro Líquido Final
                {lowMargin && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
              </span>
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted", profitColor)}>
                  {formatPct(netMarginPct)}
                </span>
                <span className={cn("font-bold tabular-nums", profitColor)}>
                  {formatBRL(netProfit)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sticky right rail */}
      <aside className="hidden lg:block w-[300px] shrink-0">
        <Card className="sticky top-4 shadow-sm border-border/60">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-4">
              Resumo financeiro
            </p>
            {Body}
          </CardContent>
        </Card>
      </aside>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 gap-3"
        >
          <div className="flex flex-col items-start min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Valor a cobrar
            </span>
            <span className="text-base font-bold text-primary truncate">
              {formatBRL(revenueBase)}
            </span>
          </div>
          <div className={cn("flex items-center gap-1.5 text-sm font-semibold", profitColor)}>
            {lowMargin && <AlertTriangle className="h-4 w-4" />}
            <span>{formatPct(netMarginPct)}</span>
          </div>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {open && <div className="px-4 pb-4">{Body}</div>}
      </div>
    </>
  );
}

function Row({
  label, value, muted, className,
}: { label: string; value: string; muted?: boolean; className?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className={cn("text-xs", muted ? "text-muted-foreground" : "text-foreground")}>
        {label}
      </span>
      <span className={cn("text-sm font-semibold", className)}>{value}</span>
    </div>
  );
}

function DRELine({ label, value, badge }: { label: string; value: number; badge?: string }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-muted-foreground flex items-center gap-1.5 min-w-0">
        <span className="truncate">{label}</span>
        {badge && (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {badge}
          </span>
        )}
      </span>
      <span className={cn("font-medium tabular-nums", value < 0 ? "text-foreground" : "text-foreground")}>
        {formatBRL(value)}
      </span>
    </div>
  );
}

function DRETooltipLine({
  label, value, muted, bold, tiny, color,
}: {
  label: string;
  value: number;
  muted?: boolean;
  bold?: boolean;
  tiny?: boolean;
  color?: "emerald" | "destructive";
}) {
  const colorCls =
    color === "emerald"
      ? "text-emerald-600"
      : color === "destructive"
        ? "text-destructive"
        : muted
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className={cn("flex justify-between items-center gap-3", tiny && "text-[10px]")}>
      <span className={cn("truncate", muted && "text-muted-foreground")}>{label}</span>
      <span className={cn("tabular-nums", bold && "font-bold", colorCls)}>
        {formatBRL(value)}
      </span>
    </div>
  );
}
