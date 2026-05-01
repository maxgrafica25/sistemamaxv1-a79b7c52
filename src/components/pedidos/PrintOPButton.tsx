import { Button } from "@/components/ui/button";
import { Printer, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { generateProductionOrderPdf } from "@/lib/erp/production-order-pdf";

interface Props {
  orderId?: string;
  quoteId?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  label?: string;
}

export function PrintOPButton({ orderId, quoteId, variant = "outline", size = "sm", label = "Imprimir OP" }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await generateProductionOrderPdf({ orderId, quoteId });
      toast.success("Ordem de Produção gerada.");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao gerar OP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} className="gap-1.5 h-8" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
      {label}
    </Button>
  );
}
