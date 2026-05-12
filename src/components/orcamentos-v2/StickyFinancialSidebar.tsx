import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PriceBreakdownGlobal } from "@/components/orcamentos-v2/PriceBreakdown";
import type { PricingBreakdown } from "@/lib/quotes-v2/pricing";

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
              <DRELine label="Receita base" value={revenueBase} />
              <DRELine label="(-) Custo de produção" value={-productionCost} />
              <DRELine
                label="(-) Impostos"
                badge={fmtPctRaw(taxPct)}
                value={-taxValue}
              />
              <DRELine
                label={`(-) Cobrança${billingMethod ? ` · ${billingMethod}` : ""}`}
                badge={fmtPctRaw(billingPct)}
                value={-billingValue}
              />
              <DRELine
                label="(-) Margem de perdas"
                badge={fmtPctRaw(lossPct)}
                value={-lossValue}
              />
              <Separator className="my-2" />
              <div className="flex items-center justify-between">
                <span className={cn("font-semibold flex items-center gap-1.5", profitColor)}>
                  = Lucro Líquido
                  {lowMargin && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
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
