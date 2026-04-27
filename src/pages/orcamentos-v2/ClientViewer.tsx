import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Loader2, Printer, Package } from "lucide-react";
import { ViewerHeader } from "@/components/orcamentos-v2/client-viewer/ViewerHeader";
import { OptionCard } from "@/components/orcamentos-v2/client-viewer/OptionCard";
import { StickyApprovalBar } from "@/components/orcamentos-v2/client-viewer/StickyApprovalBar";
import { parseOptions, type QuoteOption } from "@/lib/quotes-v2/options";

interface QuoteRow {
  id: string;
  quote_number: string;
  client: string;
  product: string;
  value: number;
  status: string;
  date: string;
  validity: string | null;
  discount_value: number | null;
  discount_type: string | null;
  payment_method: string | null;
  options: unknown;
}
interface MaterialRow { id: string; description: string; quantity: number; unit_price: number; }
interface LaborRow { id: string; description: string; time_minutes: number; }

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusBadge = (status: string) => {
  if (status === "approved")
    return <Badge className="bg-green-600 hover:bg-green-600">Aprovado</Badge>;
  if (status === "rejected")
    return <Badge className="bg-red-600 hover:bg-red-600">Recusado</Badge>;
  return <Badge className="bg-yellow-500 hover:bg-yellow-500">Aguardando aprovação</Badge>;
};

export default function ClientViewer() {
  const { id } = useParams<{ id: string }>();
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [labor, setLabor] = useState<LaborRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [q, m, l] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, quote_number, client, product, value, status, date, validity, discount_value, discount_type, payment_method, options")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("quote_materials")
          .select("id, description, quantity, unit_price, sort_order")
          .eq("quote_id", id)
          .order("sort_order"),
        supabase
          .from("quote_labor_steps")
          .select("id, description, time_minutes, sort_order")
          .eq("quote_id", id)
          .order("sort_order"),
      ]);
      if (!active) return;
      if (!q.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setQuote(q.data as QuoteRow);
      setMaterials((m.data || []) as MaterialRow[]);
      setLabor((l.data || []) as LaborRow[]);
      setLoading(false);

      // Silent tracking via SECURITY DEFINER RPC.
      // Fire-and-forget; do not block render or surface errors to the client.
      supabase.rpc("register_quote_view", { quote_id: id }).then(() => undefined);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const options: QuoteOption[] = useMemo(
    () => (quote ? parseOptions(quote.options) : []),
    [quote],
  );

  // Default-select first option when there are multiple
  useEffect(() => {
    if (options.length >= 2 && !selectedOptionId) {
      setSelectedOptionId(options[0].id);
    }
  }, [options, selectedOptionId]);

  const selectedOption = options.find((o) => o.id === selectedOptionId) || null;
  const hasMultipleOptions = options.length >= 2;
  const ctaEnabled = !hasMultipleOptions || !!selectedOption;

  // SEO
  useEffect(() => {
    if (quote) {
      document.title = `Orçamento ${quote.quote_number} · ${quote.client}`;
      const desc = `Proposta comercial Nº ${quote.quote_number} para ${quote.client}. Veja o detalhamento e aprove pelo WhatsApp.`;
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", desc.slice(0, 160));
    }
  }, [quote]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !quote) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">Orçamento não encontrado</h1>
        <p className="text-muted-foreground">O link pode ter expirado ou estar incorreto.</p>
      </div>
    );
  }

  // The shown total reflects the selected option when present, otherwise the
  // base quote.value (single-option quotes).
  const displayTotal = selectedOption ? selectedOption.total : quote.value;
  const optionLabelForCta = selectedOption?.label;

  // Discount line
  const discountLine = (() => {
    if (!quote.discount_value || quote.discount_value <= 0) return null;
    const isPct = quote.discount_type === "percent";
    return isPct
      ? `${quote.discount_value}%`
      : formatBRL(quote.discount_value);
  })();

  return (
    <div className="min-h-screen bg-muted/30 pb-32">
      <ViewerHeader quoteNumber={quote.quote_number} status={statusBadge(quote.status)} />

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-6 space-y-5">
        {/* Cliente / produto */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</p>
              <p className="text-base font-semibold text-foreground">{quote.client}</p>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Produto / Serviço</p>
              <p className="text-base text-foreground whitespace-pre-line">{quote.product}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Emissão</p>
                <p className="font-medium">{new Date(quote.date).toLocaleDateString("pt-BR")}</p>
              </div>
              {quote.validity && (
                <div>
                  <p className="text-xs text-muted-foreground">Validade</p>
                  <p className="font-medium">{quote.validity} dias</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Itens (commercial summary, no internal cost) */}
        {(materials.length > 0 || labor.length > 0) && (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                O que está incluso
              </h2>
              <ul className="space-y-2 text-sm">
                {materials.map((m) => (
                  <li key={m.id} className="flex items-start gap-2">
                    <Printer className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <span className="text-foreground">{m.description}</span>
                  </li>
                ))}
                {labor.length > 0 && (
                  <li className="flex items-start gap-2">
                    <Package className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <span className="text-foreground">
                      Mão de obra especializada ({labor.length} {labor.length === 1 ? "etapa" : "etapas"})
                    </span>
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Opções de ancoragem */}
        {hasMultipleOptions ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground px-1">
              Escolha a quantidade
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {options.map((opt) => (
                <OptionCard
                  key={opt.id}
                  option={opt}
                  selected={opt.id === selectedOptionId}
                  onSelect={() => setSelectedOptionId(opt.id)}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground px-1">
              Selecione uma opção para liberar a aprovação no WhatsApp.
            </p>
          </section>
        ) : (
          <Card className="border-primary/30 bg-primary/5 shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Valor total
              </p>
              <p className="text-3xl font-bold text-primary">{formatBRL(displayTotal)}</p>
              {discountLine && (
                <p className="text-xs text-green-600 mt-1">Desconto aplicado: {discountLine}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pagamento + desconto (se houver) */}
        {(quote.payment_method || discountLine) && (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-5 sm:p-6 grid grid-cols-2 gap-4 text-sm">
              {quote.payment_method && (
                <div>
                  <p className="text-xs text-muted-foreground">Forma de pagamento</p>
                  <p className="font-medium">{quote.payment_method}</p>
                </div>
              )}
              {discountLine && (
                <div>
                  <p className="text-xs text-muted-foreground">Desconto</p>
                  <p className="font-medium text-green-600">{discountLine}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status banner if already decided */}
        {quote.status === "approved" && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4 flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Este orçamento já foi aprovado. Em caso de dúvida, fale conosco.
            </CardContent>
          </Card>
        )}
      </main>

      <StickyApprovalBar
        quoteNumber={quote.quote_number}
        optionLabel={optionLabelForCta}
        ctaEnabled={ctaEnabled}
        total={displayTotal}
        clientName={quote.client}
      />
    </div>
  );
}
