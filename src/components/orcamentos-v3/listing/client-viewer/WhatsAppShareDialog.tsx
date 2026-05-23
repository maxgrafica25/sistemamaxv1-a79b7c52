import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, Smartphone, Monitor, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { buildWaUrl, buildWaWebUrl } from "@/lib/quotes-v2/whatsapp";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  phone: string;          // só dígitos
  phoneDisplay?: string;  // formatado
  /** Texto do título — varia se é aprovação ou pedido de alteração. */
  title?: string;
  /** Texto explicativo no topo (ex.: "Sua aprovação já foi registrada..."). */
  helper?: string;
  onShared?: (channel: "web" | "app" | "copy") => void;
}

const isMobile = () =>
  typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function WhatsAppShareDialog({
  open,
  onOpenChange,
  message,
  phone,
  phoneDisplay,
  title = "Enviar confirmação no WhatsApp",
  helper,
  onShared,
}: Props) {
  const mobile = useMemo(isMobile, []);
  const [copied, setCopied] = useState(false);

  const webUrl = buildWaWebUrl(message, phone);
  const appUrl = buildWaUrl(message, phone);

  const handleCopy = async () => {
    const text = phoneDisplay
      ? `${message}\n\n— Envie para o WhatsApp: ${phoneDisplay}`
      : message;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast.success("Mensagem copiada! Cole no seu WhatsApp.");
    onShared?.("copy");
    setTimeout(() => setCopied(false), 2500);
  };

  const open_ = (url: string, channel: "web" | "app") => {
    if (!url) return;
    onShared?.(channel);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            {title}
          </DialogTitle>
          {helper && (
            <DialogDescription className="text-sm">{helper}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
              Mensagem
            </p>
            <pre className="text-xs whitespace-pre-wrap font-sans text-foreground max-h-40 overflow-y-auto">
              {message}
            </pre>
          </div>

          {phoneDisplay && (
            <div className="text-xs text-muted-foreground">
              WhatsApp da gráfica: <span className="font-medium text-foreground">{phoneDisplay}</span>
            </div>
          )}

          <div className="grid gap-2">
            <Button
              type="button"
              onClick={() => open_(webUrl, "web")}
              className="bg-green-600 hover:bg-green-700 text-white h-11 justify-start gap-2"
            >
              <Monitor className="h-4 w-4" />
              <span className="flex-1 text-left">WhatsApp Web (computador)</span>
              {!mobile && <Badge className="bg-white/20 text-white hover:bg-white/20">Recomendado</Badge>}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => open_(appUrl, "app")}
              className="h-11 justify-start gap-2 border-green-600/50 text-green-700 hover:bg-green-50 hover:text-green-700"
            >
              <Smartphone className="h-4 w-4" />
              <span className="flex-1 text-left">Abrir no app do celular</span>
              {mobile && <Badge variant="secondary">Recomendado</Badge>}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="h-11 justify-start gap-2"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              <span className="flex-1 text-left">
                {copied ? "Mensagem copiada" : "Copiar mensagem"}
              </span>
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Não consegue abrir? Copie a mensagem e cole manualmente no WhatsApp.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
