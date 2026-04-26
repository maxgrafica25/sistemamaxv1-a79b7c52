import { Button } from "@/components/ui/button";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { buildAdjustMessage, buildApprovalMessage, buildWaUrl } from "@/lib/quotes-v2/whatsapp";

interface Props {
  quoteNumber: string;
  optionLabel?: string;
  ctaEnabled: boolean;
  total: number;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function StickyApprovalBar({ quoteNumber, optionLabel, ctaEnabled, total }: Props) {
  const approveUrl = buildWaUrl(buildApprovalMessage({ quoteNumber, optionLabel }));
  const adjustUrl = buildWaUrl(buildAdjustMessage({ quoteNumber }));

  return (
    <div className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total da opção selecionada</span>
          <span className="text-base font-bold text-foreground">{formatBRL(total)}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <Button
            asChild
            size="lg"
            disabled={!ctaEnabled}
            className="bg-green-600 hover:bg-green-700 text-white gap-2 h-12 text-base font-semibold"
          >
            {ctaEnabled ? (
              <a href={approveUrl} target="_blank" rel="noopener noreferrer">
                <CheckCircle2 className="h-5 w-5" />
                Aprovar Orçamento
              </a>
            ) : (
              <span>
                <CheckCircle2 className="h-5 w-5" />
                Selecione uma opção
              </span>
            )}
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 gap-2">
            <a href={adjustUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Solicitar Alteração
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
