import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useAuth } from "@/hooks/useAuth";
import { buildAdjustMessage, buildApprovalMessage, buildWaUrl } from "@/lib/quotes-v2/whatsapp";

interface Props {
  quoteNumber: string;
  optionLabel?: string;
  ctaEnabled: boolean;
  total: number;
  clientName?: string;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function StickyApprovalBar({ quoteNumber, optionLabel, ctaEnabled, total, clientName }: Props) {
  const { whatsappNumber, companyName, loading } = useCompanySettings();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const hasPhone = !!whatsappNumber;
  const buttonsReady = ctaEnabled && hasPhone && !loading;

  const approveUrl = hasPhone
    ? buildWaUrl(buildApprovalMessage({ quoteNumber, optionLabel, clientName, companyName }), whatsappNumber)
    : "";
  const adjustUrl = hasPhone
    ? buildWaUrl(buildAdjustMessage({ quoteNumber, clientName, companyName }), whatsappNumber)
    : "";

  return (
    <div className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total da opção selecionada</span>
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
