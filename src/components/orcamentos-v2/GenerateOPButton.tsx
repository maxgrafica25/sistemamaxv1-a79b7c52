import { PrintOPButton } from "@/components/pedidos/PrintOPButton";

interface Props {
  quoteId: string;
  quoteNumber: string;
  client: string;
}

/**
 * Wrapper de compatibilidade — usa o gerador real de OP em PDF.
 */
export function GenerateOPButton({ quoteId }: Props) {
  return <PrintOPButton quoteId={quoteId} label="Gerar OP" />;
}
