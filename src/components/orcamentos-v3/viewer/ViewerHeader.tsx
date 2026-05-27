import { Printer, Link2, Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trackEvent } from "@/lib/quotes/tracking";

interface Props {
  quoteNumber: string;
  status: ReactNode;
  publicToken?: string;
}

export function ViewerHeader({ quoteNumber, status, publicToken }: Props) {
  const [copied, setCopied] = useState(false);

  const handlePrint = () => {
    void trackEvent(publicToken, "printed");
    window.print();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copiado!");
      void trackEvent(publicToken, "link_copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <header className="bg-background border-b border-border/60 sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Printer className="h-5 w-5 text-primary" />
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Proposta</p>
            <p className="text-sm font-semibold text-foreground truncate">Nº {quoteNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 sm:h-8 sm:w-auto sm:px-2.5"
            onClick={handleCopyLink}
            title="Copiar link"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            <span className="hidden sm:inline ml-1.5 text-xs">
              {copied ? "Copiado" : "Copiar link"}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 sm:h-8 sm:w-auto sm:px-2.5"
            onClick={handlePrint}
            title="Baixar / imprimir PDF"
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline ml-1.5 text-xs">Baixar PDF</span>
          </Button>
          {status}
        </div>
      </div>
    </header>
  );
}
