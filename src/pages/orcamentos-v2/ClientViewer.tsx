import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  Printer,
  Package,
  MessageCircle,
  Lock,
} from "lucide-react";
import { ViewerHeader } from "@/components/orcamentos-v2/client-viewer/ViewerHeader";
import { OptionCard } from "@/components/orcamentos-v2/client-viewer/OptionCard";
import { StickyApprovalBar } from "@/components/orcamentos-v2/client-viewer/StickyApprovalBar";
import { parseOptions, type QuoteOption } from "@/lib/quotes-v2/options";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import {
  buildItemAdjustMessage,
  buildPartialApprovalMessage,
  buildWaUrl,
} from "@/lib/quotes-v2/whatsapp";

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
  version: number;
  is_locked: boolean;
}
interface MaterialRow {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  status: string;
  approved_at: string | null;
  approved_value: number | null;
}
interface LaborRow { id: string; description: string; time_minutes: number; }

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

const statusBadge = (status: string) => {
  if (status === "approved")
    return <Badge className="bg-green-600 hover:bg-green-600">Aprovado</Badge>;
  if (status === "partial")
    return <Badge className="bg-blue-600 hover:bg-blue-600">Aprovação parcial</Badge>;
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
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const { whatsappNumber, companyName } = useCompanySettings();

  const loadData = async () => {
    if (!id) return;
    const [q, m, l] = await Promise.all([
      supabase
        .from("quotes")
        .select(
          "id, quote_number, client, product, value, status, date, validity, discount_value, discount_type, payment_method, options, version, is_locked",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("quote_materials")
        .select("id, description, quantity, unit_price, sort_order, status, approved_at, approved_value")
        .eq("quote_id", id)
        .order("sort_order"),
      supabase
        .from("quote_labor_steps")
        .select("id, description, time_minutes, sort_order")
        .eq("quote_id", id)
        .order("sort_order"),
    ]);
    if (!q.data) {
      setNotFound(true);
      return;
    }
    setQuote(q.data as QuoteRow);
    setMaterials((m.data || []) as MaterialRow[]);
    setLabor((l.data || []) as LaborRow[]);
  };

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      setLoading(true);
      await loadData();
      if (!active) return;
      setLoading(false);
      supabase.rpc("register_quote_view", { quote_id: id }).then(() => undefined);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const options: QuoteOption[] = useMemo(
    () => (quote ? parseOptions(quote.options) : []),
    [quote],
  );

  useEffect(() => {
    if (options.length >= 2 && !selectedOptionId) {
      setSelectedOptionId(options[0].id);
    }
  }, [options, selectedOptionId]);

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

  const approvedItems = materials.filter((m) => m.status === "aprovado");
  const pendingItems = materials.filter((m) => m.status === "pendente");
  const hasAnyApproved = approvedItems.length > 0;
  const hasAnyPending = pendingItems.length > 0;
  const hasMultipleItems = materials.length >= 2;

  const subtotalApproved = approvedItems.reduce(
    (sum, m) => sum + Number(m.approved_value ?? m.quantity * m.unit_price),
    0,
  );
  const subtotalSelected = pendingItems
    .filter((m) => selectedItemIds.has(m.id))
    .reduce((sum, m) => sum + m.quantity * m.unit_price, 0);

  const selectedOption = options.find((o) => o.id === selectedOptionId) || null;
  const hasMultipleOptions = options.length >= 2;

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handlePartialApproval = async () => {
    if (selectedItemIds.size === 0) return;
    if (!whatsappNumber) {
      toast.error("WhatsApp da empresa não configurado.");
      return;
    }
    setSubmitting(true);
    try {
      const itemIds = Array.from(selectedItemIds);
      const { error } = await supabase.rpc("approve_quote_items", {
        p_quote_id: quote.id,
        p_item_ids: itemIds,
      });
      if (error) throw error;

      // Snapshot antes do reload (para a mensagem)
      const itemsForMessage = pendingItems
        .filter((m) => selectedItemIds.has(m.id))
        .map((m) => ({
          description: m.description,
          value: m.quantity * m.unit_price,
        }));
      const totalForMessage = itemsForMessage.reduce((s, i) => s + i.value, 0);

      const url = buildWaUrl(
        buildPartialApprovalMessage({
          quoteNumber: quote.quote_number,
          items: itemsForMessage,
          total: totalForMessage,
          clientName: quote.client,
          companyName,
        }),
        whatsappNumber,
      );

      // Recarrega dados para refletir o novo status
      await loadData();
      setSelectedItemIds(new Set());
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Itens aprovados! Continue no WhatsApp para confirmar.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao aprovar itens.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Modo "opções de quantidade" (legado): mantém o fluxo antigo se o orçamento tiver opções
  // e nenhum material individual aprovável
  const showOptionsMode = hasMultipleOptions && materials.length === 0;

  // Total a exibir no rodapé sticky
  const stickyTotal = showOptionsMode
    ? selectedOption?.total ?? quote.value
    : subtotalSelected;

  // Discount line
  const discountLine = (() => {
    if (!quote.discount_value || quote.discount_value <= 0) return null;
    const isPct = quote.discount_type === "percent";
    return isPct ? `${quote.discount_value}%` : formatBRL(quote.discount_value);
  })();

  return (
    <div className="min-h-screen bg-muted/30 pb-32">
      <ViewerHeader
        quoteNumber={
          quote.version > 1
            ? `${quote.quote_number} · v${quote.version}`
            : quote.quote_number
        }
        status={statusBadge(quote.status)}
      />

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-6 space-y-5">
        {quote.is_locked && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="p-4 flex items-start gap-2 text-amber-800 text-sm">
              <Lock className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                Este orçamento foi <strong>substituído por uma versão mais nova</strong>.
                Entre em contato conosco para receber o link atualizado.
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* APROVADOS — bloco superior, fechado */}
        {hasAnyApproved && (
          <Card className="border-green-300 bg-green-50/60 shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Itens já aprovados
                </h2>
                <span className="text-xs text-green-700">
                  {approvedItems.length} {approvedItems.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <ul className="space-y-2 text-sm">
                {approvedItems.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start gap-2 bg-white rounded-md border border-green-200 p-3"
                  >
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground">{m.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Aprovado em {m.approved_at ? formatDate(m.approved_at) : "—"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-green-700 shrink-0">
                      {formatBRL(Number(m.approved_value ?? m.quantity * m.unit_price))}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between items-center pt-2 border-t border-green-200">
                <span className="text-xs uppercase tracking-wide text-green-700">
                  Subtotal aprovado
                </span>
                <span className="text-lg font-bold text-green-700">
                  {formatBRL(subtotalApproved)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PENDENTES — com checkbox para aprovação parcial */}
        {hasAnyPending && !quote.is_locked && (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {hasAnyApproved ? "Aguardando sua decisão" : "O que está incluso"}
              </h2>
              <ul className="space-y-2 text-sm">
                {pendingItems.map((m) => {
                  const itemValue = m.quantity * m.unit_price;
                  const checked = selectedItemIds.has(m.id);
                  const itemAdjustUrl = whatsappNumber
                    ? buildWaUrl(
                        buildItemAdjustMessage({
                          quoteNumber: quote.quote_number,
                          itemDescription: m.description,
                          clientName: quote.client,
                          companyName,
                        }),
                        whatsappNumber,
                      )
                    : "";
                  return (
                    <li
                      key={m.id}
                      className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${
                        checked
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card"
                      }`}
                    >
                      {hasMultipleItems ? (
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleItem(m.id)}
                          className="mt-0.5"
                          id={`item-${m.id}`}
                        />
                      ) : (
                        <Printer className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      )}
                      <label
                        htmlFor={hasMultipleItems ? `item-${m.id}` : undefined}
                        className="flex-1 min-w-0 cursor-pointer"
                      >
                        <p className="text-foreground">{m.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatBRL(itemValue)}
                        </p>
                      </label>
                      {itemAdjustUrl && (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-green-600 shrink-0"
                          title="Solicitar alteração neste item"
                        >
                          <a href={itemAdjustUrl} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="h-3.5 w-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Alterar</span>
                          </a>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {labor.length > 0 && (
                <p className="text-xs text-muted-foreground pt-2 border-t border-border/50 flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  Inclui mão de obra especializada ({labor.length}{" "}
                  {labor.length === 1 ? "etapa" : "etapas"})
                </p>
              )}
              {hasMultipleItems && (
                <p className="text-xs text-muted-foreground pt-1">
                  💡 Marque os itens que deseja aprovar agora. Use{" "}
                  <strong>Alterar</strong> para pedir ajustes em algum item.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Modo legado: opções de quantidade (orçamentos antigos sem materials) */}
        {showOptionsMode && (
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
          </section>
        )}

        {/* Sem itens nem opções — exibe valor único */}
        {!hasMultipleOptions && materials.length === 0 && (
          <Card className="border-primary/30 bg-primary/5 shadow-sm">
            <CardContent className="p-5 sm:p-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Valor total
              </p>
              <p className="text-3xl font-bold text-primary">{formatBRL(quote.value)}</p>
              {discountLine && (
                <p className="text-xs text-green-600 mt-1">Desconto aplicado: {discountLine}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pagamento + desconto */}
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

        {/* Status final */}
        {!hasAnyPending && hasAnyApproved && (
          <Card className="border-green-300 bg-green-50">
            <CardContent className="p-4 flex items-center gap-2 text-green-700 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              Todos os itens deste orçamento foram aprovados. Obrigado!
            </CardContent>
          </Card>
        )}
      </main>

      {/* Sticky bar — só aparece se há algo pra fazer */}
      {!quote.is_locked && (hasAnyPending || showOptionsMode) && (
        <StickyApprovalBar
          quoteNumber={quote.quote_number}
          optionLabel={showOptionsMode ? selectedOption?.label : undefined}
          ctaEnabled={
            showOptionsMode ? !!selectedOption : selectedItemIds.size > 0
          }
          total={stickyTotal}
          clientName={quote.client}
          mode={showOptionsMode ? "option" : "items"}
          selectedItemCount={selectedItemIds.size}
          onApproveItems={handlePartialApproval}
          submitting={submitting}
        />
      )}
    </div>
  );
}
