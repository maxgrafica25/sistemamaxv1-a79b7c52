import { Button } from "@/components/ui/button";
import { Copy as CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { cloneQuote } from "@/lib/quotes-v2/clone";

interface Props {
  quoteId: string;
  quoteNumber: string;
  onCloned: () => void;
}

export function CloneQuoteButton({ quoteId, quoteNumber: _quoteNumber, onCloned }: Props) {
  const handleClone = async () => {
    try {
      const { newQuoteNumber } = await cloneQuote(quoteId);
      toast.success(`Orçamento clonado como ${newQuoteNumber}`);
      onCloned();
    } catch (e) {
      toast.error(`Erro ao clonar: ${(e as Error).message}`);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={handleClone}
      title="Clonar orçamento"
    >
      <CopyIcon className="h-3.5 w-3.5" />
    </Button>
  );
}
