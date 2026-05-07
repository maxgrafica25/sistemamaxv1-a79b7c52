import { useEffect, useMemo, useRef, useState } from "react";
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
import { WhatsAppShareDialog } from "@/components/orcamentos-v2/client-viewer/WhatsAppShareDialog";
import { ApprovalConfirmDialog } from "@/components/orcamentos-v2/client-viewer/ApprovalConfirmDialog";
import { parseOptions, type QuoteOption } from "@/lib/quotes-v2/options";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { trackEvent } from "@/lib/quotes-v2/tracking";
import { useScrollDepthTracking } from "@/lib/quotes-v2/useScrollDepthTracking";
import {
  buildAdjustMessage,
  buildItemAdjustMessage,
  buildPartialApprovalMessage,
} from "@/lib/quotes-v2/whatsapp";
import { APPROVAL_TERMS_VERSION, buildApprovalTermsText } from "@/lib/quotes-v2/approval-terms";

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
  generated_title?: string | null;
  reference?: string | null;
}
interface LaborRow { id: string; description: string; time_minutes: number; parent_item_id: string | null; }
interface CvFinishEntry { finish_id: string; quantidade_unidades?: number; custom?: { nome: string; valor: number } }
interface CvItemRow {
  id: string;
  material_nome: string | null;
  printer_nome: string | null;
  largura_cm: number;
  altura_cm: number;
  quantidade: number;
  preco_total: number;
  tem_emenda: boolean;
  aplicou_minimo: boolean;
  finishes_json: CvFinishEntry[] | null;
}

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
  const { id: routeId, quoteNumber: routeQuoteNumber } = useParams<{ id?: string; quoteNumber?: string }>();
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [labor, setLabor] = useState<LaborRow[]>([]);
  const [cvItems, setCvItems] = useState<CvItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const { whatsappNumber, whatsappDisplay, companyName } = useCompanySettings();
  const [shareDialog, setShareDialog] = useState<{
    open: boolean;
    message: string;
    title: string;
    helper?: string;
  }>({ open: false, message: "", title: "" });
  const [approvalDialog, setApprovalDialog] = useState<{
    open: boolean;
    items: { id: string; description: string; value: number }[];
    total: number;
    isFullApproval: boolean;
  }>({ open: false, items: [], total: 0, isFullApproval: false });

  const openShare = (
    message: string,
    title: string,
    helper?: string,
  ) => {
    if (!whatsappNumber) {
      toast.error("WhatsApp da empresa não configurado.");
      return;
    }
    setShareDialog({ open: true, message, title, helper });
  };


  const loadData = async () => {
    let quoteRow: QuoteRow | null = null;

    if (routeQuoteNumber) {
      // Lookup amigável por número da proposta — pega a versão mais recente
      const q = await supabase
        .from("quotes")
        .select(
          "id, quote_number, client, product, value, status, date, validity, discount_value, discount_type, payment_method, options, version, is_locked",
        )
        .eq("quote_number", routeQuoteNumber)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      quoteRow = (q.data as QuoteRow | null) ?? null;
    } else if (routeId) {
      const q = await supabase
        .from("quotes")
        .select(
          "id, quote_number, client, product, value, status, date, validity, discount_value, discount_type, payment_method, options, version, is_locked",
        )
        .eq("id", routeId)
        .maybeSingle();
      quoteRow = (q.data as QuoteRow | null) ?? null;
    }

    if (!quoteRow) {
      setNotFound(true);
      return;
    }

    const [m, l, cv] = await Promise.all([
      supabase
        .from("quote_materials")
        .select("id, description, quantity, unit_price, sort_order, status, approved_at, approved_value, parent_item_id, generated_title, reference")
        .eq("quote_id", quoteRow.id)
        .is("parent_item_id", null)
        .order("sort_order"),
      supabase
        .from("quote_labor_steps")
        .select("id, description, time_minutes, sort_order, parent_item_id")
        .eq("quote_id", quoteRow.id)
        .order("sort_order"),
      supabase
        .from("cv_quote_items")
        .select("id, material_nome, printer_nome, largura_cm, altura_cm, quantidade, preco_total, tem_emenda, aplicou_minimo, sort_order, finishes_json")
        .eq("quote_id", quoteRow.id)
        .order("sort_order"),
    ]);

    setQuote(quoteRow);
    setMaterials((m.data || []) as MaterialRow[]);
    setLabor((l.data || []) as LaborRow[]);
    setCvItems((cv.data || []) as unknown as CvItemRow[]);
  };

  useEffect(() => {
    if (!routeId && !routeQuoteNumber) return;
    let active = true;
    (async () => {
      setLoading(true);
      await loadData();
      if (!active) return;
      setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, routeQuoteNumber]);

  // Dispara "viewed" assim que sabemos o quote.id real
  useEffect(() => {
    if (quote?.id) void trackEvent(quote.id, "viewed");
  }, [quote?.id]);

  // Scroll depth (1x por sessão, listener passive)
  useScrollDepthTracking(quote?.id);

  const options: QuoteOption[] = useMemo(
    () => (quote ? parseOptions(quote.options) : []),
    [quote],
  );

  // Agrupa etapas de mão de obra (acabamentos/processos) por item de impressão pai
  const laborByParent = useMemo(() => {
    const map = new Map<string, LaborRow[]>();
    for (const l of labor) {
      if (!l.parent_item_id) continue;
      const arr = map.get(l.parent_item_id) ?? [];
      arr.push(l);
      map.set(l.parent_item_id, arr);
    }
    return map;
  }, [labor]);

  useEffect(() => {
    if (options.length >= 2 && !selectedOptionId) {
      setSelectedOptionId(options[0].id);
    }
  }, [options, selectedOptionId]);

  // Pré-seleciona todos os itens pendentes na carga inicial — assim o cliente
  // pode aprovar tudo com 1 clique (e ainda pode desmarcar para aprovação parcial).
  const didPreselectRef = useRef(false);
  useEffect(() => {
    if (didPreselectRef.current) return;
    if (!materials.length) return;
    const pendingIds = materials.filter((m) => m.status === "pendente").map((m) => m.id);
    if (pendingIds.length > 0) {
      setSelectedItemIds(new Set(pendingIds));
      didPreselectRef.current = true;
    }
  }, [materials]);

  // option_selected com debounce de 2s — só registra se permanecer na opção.
  // Se o cliente já tinha confirmado outra opção e mudou, registramos `option_deselected`
  // para a anterior (rastreio de hesitação entre opções).
  const lastConfirmedOptionRef = useRef<{ id: string; label: string } | null>(null);
  useEffect(() => {
    if (!quote?.id || !selectedOptionId) return;
    const opt = options.find((o) => o.id === selectedOptionId);
    if (!opt) return;
    const t = setTimeout(() => {
      const prev = lastConfirmedOptionRef.current;
      if (prev && prev.id !== opt.id) {
        void trackEvent(quote.id, "option_deselected", {
          option_id: prev.id,
          option_label: prev.label,
        });
      }
      void trackEvent(quote.id, "option_selected", {
        option_id: opt.id,
        option_label: opt.label,
      });
      lastConfirmedOptionRef.current = { id: opt.id, label: opt.label };
    }, 2000);
    return () => clearTimeout(t);
  }, [quote?.id, selectedOptionId, options]);

  // Refs para tracking de hesitação por item — declarados ANTES de qualquer return condicional
  const pendingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const sentSelectedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      pendingTimersRef.current.forEach((t) => clearTimeout(t));
      pendingTimersRef.current.clear();
    };
  }, []);

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

  // (refs/cleanup de hesitação foram movidos para o topo do componente — Rules of Hooks)

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      const willBeChecked = !next.has(itemId);
      if (willBeChecked) next.add(itemId);
      else next.delete(itemId);

      // Cancela qualquer timer pendente deste item
      const pending = pendingTimersRef.current.get(itemId);
      if (pending) {
        clearTimeout(pending);
        pendingTimersRef.current.delete(itemId);
      }

      // Só rastreia checkbox de itens quando há aprovação parcial real (>=2 itens).
      // Em orçamento de item único, marcar/desmarcar não tem valor analítico.
      if (materials.length < 2) return next;

      const item = materials.find((m) => m.id === itemId);
      const label = item?.description ?? "Item";

      if (willBeChecked) {
        // Vai disparar item_selected em 2s se não cancelado
        const t = setTimeout(() => {
          pendingTimersRef.current.delete(itemId);
          void trackEvent(quote?.id, "item_selected", {
            item_id: itemId,
            item_label: label,
          });
          sentSelectedRef.current.add(itemId);
        }, 2000);
        pendingTimersRef.current.set(itemId, t);
      } else if (sentSelectedRef.current.has(itemId)) {
        // Já tinha registrado selected → agendar deselected (hesitação)
        const t = setTimeout(() => {
          pendingTimersRef.current.delete(itemId);
          void trackEvent(quote?.id, "item_deselected", {
            item_id: itemId,
            item_label: label,
          });
          sentSelectedRef.current.delete(itemId);
        }, 2000);
        pendingTimersRef.current.set(itemId, t);
      }

      return next;
    });
  };

  // Etapa 1: cliente clica em "Aprovar" → abre o termo de aceite (não aprova ainda).
  const handlePartialApproval = () => {
    if (selectedItemIds.size === 0) return;
    const itemsForApproval = pendingItems
      .filter((m) => selectedItemIds.has(m.id))
      .map((m) => ({
        id: m.id,
        description: m.generated_title || m.description,
        value: m.quantity * m.unit_price,
      }));
    const total = itemsForApproval.reduce((s, i) => s + i.value, 0);
    setApprovalDialog({
      open: true,
      items: itemsForApproval,
      total,
      isFullApproval: selectedItemIds.size === pendingItems.length,
    });
  };

  // Etapa 2: cliente preencheu nome + concordou → grava comprovante e aprova.
  const confirmApproval = async (approverName: string) => {
    if (!quote) return;
    setSubmitting(true);
    try {
      const { items, total, isFullApproval } = approvalDialog;
      const termsText = buildApprovalTermsText(quote.quote_number);

      // 1) Grava o comprovante de aceite (prova legal).
      const { data: receipt, error: receiptError } = await supabase
        .from("quote_approval_receipts")
        .insert({
          quote_id: quote.id,
          quote_number: quote.quote_number,
          quote_version: quote.version,
          approver_name: approverName,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
          items_snapshot: items,
          total_approved: total,
          terms_version: APPROVAL_TERMS_VERSION,
          terms_text: termsText,
        })
        .select("id, approved_at")
        .single();
      if (receiptError) throw receiptError;

      // 2) Aprova os itens via RPC.
      const itemIds = items.map((i) => i.id);
      const { error: rpcError } = await supabase.rpc("approve_quote_items", {
        p_quote_id: quote.id,
        p_item_ids: itemIds,
      });
      if (rpcError) throw rpcError;

      // 3) Monta a mensagem com referência ao comprovante.
      const message = buildPartialApprovalMessage({
        quoteNumber: quote.quote_number,
        items,
        total,
        clientName: quote.client,
        companyName,
        isFullApproval,
        approverName,
        approvedAt: receipt?.approved_at,
        receiptId: receipt?.id,
      });

      await loadData();
      setSelectedItemIds(new Set());
      didPreselectRef.current = false;
      setApprovalDialog((s) => ({ ...s, open: false }));
      toast.success("Aprovação registrada! Avise a gráfica pelo WhatsApp (opcional).");
      if (whatsappNumber) {
        openShare(
          message,
          isFullApproval ? "Avisar a gráfica no WhatsApp" : "Avisar a gráfica sobre os itens aprovados",
          "Sua aprovação já está registrada no sistema com data, hora e seu nome. Esta etapa é apenas para avisar a gráfica.",
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao registrar aprovação.";
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
        quoteId={quote.id}
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
                      <p className="text-foreground font-medium">{m.generated_title || m.description}</p>
                      {(laborByParent.get(m.id)?.length ?? 0) > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          + {laborByParent.get(m.id)!.map((l) => l.description).join(", ")}
                        </p>
                      )}
                      {m.reference && (
                        <p className="text-xs text-muted-foreground italic">Ref.: {m.reference}</p>
                      )}
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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {hasAnyApproved ? "Aguardando sua decisão" : "O que está incluso"}
                </h2>
                {hasMultipleItems && (
                  <div className="flex items-center gap-2">
                    {selectedItemIds.size === pendingItems.length && (
                      <Badge className="bg-green-600 hover:bg-green-600 gap-1 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" />
                        Todos selecionados
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        if (selectedItemIds.size === pendingItems.length) {
                          setSelectedItemIds(new Set());
                        } else {
                          setSelectedItemIds(new Set(pendingItems.map((m) => m.id)));
                        }
                      }}
                    >
                      {selectedItemIds.size === pendingItems.length ? "Limpar seleção" : "Selecionar todos"}
                    </Button>
                  </div>
                )}
              </div>
              <ul className="space-y-2 text-sm">
                {pendingItems.map((m) => {
                  const itemValue = m.quantity * m.unit_price;
                  const checked = selectedItemIds.has(m.id);
                  const handleItemAdjust = () => {
                    openShare(
                      buildItemAdjustMessage({
                        quoteNumber: quote.quote_number,
                        itemDescription: m.description,
                        clientName: quote.client,
                        companyName,
                      }),
                      "Solicitar alteração no item",
                      "Envie a mensagem para a gráfica avaliar a alteração.",
                    );
                  };
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
                        <p className="text-foreground font-medium">{m.generated_title || m.description}</p>
                        {(laborByParent.get(m.id)?.length ?? 0) > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            + {laborByParent.get(m.id)!.map((l) => l.description).join(", ")}
                          </p>
                        )}
                        {m.reference && (
                          <p className="text-xs text-muted-foreground italic">Ref.: {m.reference}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatBRL(itemValue)}
                        </p>
                      </label>
                      {whatsappNumber && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-green-600 shrink-0"
                          title="Solicitar alteração neste item"
                          onClick={handleItemAdjust}
                        >
                          <MessageCircle className="h-3.5 w-3.5 sm:mr-1" />
                          <span className="hidden sm:inline">Alterar</span>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {hasMultipleItems && (
                <p className="text-xs text-muted-foreground pt-1">
                  💡 Todos os itens já estão selecionados para aprovação. Desmarque
                  algum se quiser aprovar parcialmente, ou use <strong>Alterar</strong>{" "}
                  para pedir ajustes em algum item.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Comunicação Visual — itens informativos */}
        {cvItems.length > 0 && (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {hasAnyPending || hasAnyApproved ? "Comunicação Visual" : "O que está incluso"}
              </h2>
              <ul className="space-y-2 text-sm">
                {cvItems.map((cv) => {
                  const dimL = Number(cv.largura_cm) / 100;
                  const dimA = Number(cv.altura_cm) / 100;
                  const dim = `${dimL.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}m × ${dimA.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}m`;
                  return (
                    <li
                      key={cv.id}
                      className="flex items-start gap-3 rounded-md border border-border bg-card p-3"
                    >
                      <Package className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-medium">
                          {cv.material_nome || "Material de comunicação visual"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {dim} · {cv.quantidade} un
                          {cv.printer_nome ? ` · ${cv.printer_nome}` : ""}
                        </p>
                        {(cv.tem_emenda || cv.aplicou_minimo) && (
                          <div className="flex gap-1.5 mt-1">
                            {cv.tem_emenda && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Com emenda</Badge>
                            )}
                            {cv.aplicou_minimo && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Mínimo aplicado</Badge>
                            )}
                          </div>
                        )}
                        {Array.isArray(cv.finishes_json) && cv.finishes_json.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {cv.finishes_json.map((fj, idx) => {
                              const nome = fj.custom?.nome || (fj as any).nome || null;
                              if (!nome) return null;
                              return (
                                <li key={idx} className="text-xs text-muted-foreground">
                                  • {nome}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-foreground shrink-0">
                        {formatBRL(Number(cv.preco_total))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
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
        {!hasMultipleOptions && materials.length === 0 && cvItems.length === 0 && (
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
          quoteId={quote.id}
          quoteNumber={quote.quote_number}
          optionLabel={showOptionsMode ? selectedOption?.label : undefined}
          ctaEnabled={
            showOptionsMode ? !!selectedOption : selectedItemIds.size > 0
          }
          total={stickyTotal}
          clientName={quote.client}
          mode={showOptionsMode ? "option" : "items"}
          selectedItemCount={selectedItemIds.size}
          totalItemCount={pendingItems.length}
          onApproveItems={handlePartialApproval}
          submitting={submitting}
          onRequestAdjust={() =>
            openShare(
              buildAdjustMessage({
                quoteNumber: quote.quote_number,
                clientName: quote.client,
                companyName,
              }),
              "Solicitar alteração no orçamento",
              "Envie a mensagem para a gráfica avaliar a alteração.",
            )
          }
        />
      )}

      <WhatsAppShareDialog
        open={shareDialog.open}
        onOpenChange={(o) => setShareDialog((s) => ({ ...s, open: o }))}
        message={shareDialog.message}
        phone={whatsappNumber}
        phoneDisplay={whatsappDisplay}
        title={shareDialog.title}
        helper={shareDialog.helper}
        onShared={() => {
          if (quote?.id) void trackEvent(quote.id, "whatsapp_share");
        }}
      />

      <ApprovalConfirmDialog
        open={approvalDialog.open}
        onOpenChange={(o) => !submitting && setApprovalDialog((s) => ({ ...s, open: o }))}
        quoteNumber={quote.quote_number}
        items={approvalDialog.items}
        total={approvalDialog.total}
        termsText={buildApprovalTermsText(quote.quote_number)}
        defaultName={quote.client}
        submitting={submitting}
        onConfirm={confirmApproval}
      />
    </div>
  );
}
