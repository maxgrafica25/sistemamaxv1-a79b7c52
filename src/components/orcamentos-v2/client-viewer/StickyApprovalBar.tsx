import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useAuth } from "@/hooks/useAuth";
import { buildAdjustMessage, buildApprovalMessage, buildWaUrl } from "@/lib/quotes-v2/whatsapp";
import { trackEvent } from "@/lib/quotes-v2/tracking";

interface Props {
  quoteId?: string;
  quoteNumber: string;
  optionLabel?: string;
  ctaEnabled: boolean;
  total: number;
  clientName?: string;
  /** "option" = legado por opção de quantidade; "items" = aprovação parcial por item */
  mode?: "option" | "items";
  selectedItemCount?: number;
  onApproveItems?: () => void | Promise<void>;
  submitting?: boolean;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function StickyApprovalBar({
  quoteId,
  quoteNumber,
  optionLabel,
  ctaEnabled,
  total,
  clientName,
  mode = "option",
  selectedItemCount = 0,
  onApproveItems,
  submitting = false,
}: Props) {
  const handleWaShare = () => {
    void trackEvent(quoteId, "whatsapp_share");
  };
  const { whatsappNumber, companyName, loading } = useCompanySettings();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const hasPhone = !!whatsappNumber;
  const buttonsReady = ctaEnabled && hasPhone && !loading && !submitting;

  // Modo "option" mantém o link wa.me direto. Modo "items" usa callback (RPC + WA)
  const approveUrl =
    mode === "option" && hasPhone
      ? buildWaUrl(
          buildApprovalMessage({ quoteNumber, optionLabel, clientName, companyName }),
          whatsappNumber,
        )
      : "";
  const adjustUrl = hasPhone
    ? buildWaUrl(buildAdjustMessage({ quoteNumber, clientName, companyName }), whatsappNumber)
    : "";

  const totalLabel =
    mode === "items"
      ? selectedItemCount > 0
        ? `Selecionados (${selectedItemCount} ${selectedItemCount === 1 ? "item" : "itens"})`
        : "Selecione os itens para aprovar"
      : "Total da opção selecionada";

  return (
    <div className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{totalLabel}</span>
          <span className="text-base font-bold text-foreground">{formatBRL(total)}</span>
        </div>

        {!loading && !hasPhone && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            WhatsApp da empresa ainda não cadastrado.{" "}
            {isAdmin && (
              <Link to="/configuracoes" className="font-semibold underline">
                Configurar agora
              </Link>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          {mode === "items" ? (
            <Button
              size="lg"
              type="button"
              disabled={!buttonsReady}
              onClick={() => onApproveItems?.()}
              className="bg-green-600 hover:bg-green-700 text-white gap-2 h-12 text-base font-semibold disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Aprovando…
                </>
              ) : !hasPhone ? (
                <>
                  <CheckCircle2 className="h-5 w-5" /> WhatsApp não configurado
                </>
              ) : selectedItemCount === 0 ? (
                <>
                  <CheckCircle2 className="h-5 w-5" /> Selecione um ou mais itens
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" /> Aprovar selecionados via WhatsApp
                </>
              )}
            </Button>
          ) : (
            <Button
              asChild={buttonsReady}
              size="lg"
              disabled={!buttonsReady}
              className="bg-green-600 hover:bg-green-700 text-white gap-2 h-12 text-base font-semibold disabled:opacity-60"
            >
              {buttonsReady ? (
                <a href={approveUrl} target="_blank" rel="noopener noreferrer">
                  <CheckCircle2 className="h-5 w-5" />
                  Aprovar Orçamento
                </a>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
                    </>
                  ) : !hasPhone ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" /> WhatsApp não configurado
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5" /> Selecione uma opção
                    </>
                  )}
                </span>
              )}
            </Button>
          )}

          <Button
            asChild={hasPhone && !loading}
            variant="outline"
            size="lg"
            disabled={!hasPhone || loading}
            className="h-12 gap-2"
          >
            {hasPhone && !loading ? (
              <a href={adjustUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                Solicitar Alteração
              </a>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Solicitar Alteração
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
