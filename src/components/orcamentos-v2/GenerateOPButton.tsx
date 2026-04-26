import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  quoteId: string;
  quoteNumber: string;
  client: string;
}

/**
 * Mock OP generator — validates the payload that would be sent to the
 * production table when wired up. For now: console.log + toast.
 */
export function GenerateOPButton({ quoteId, quoteNumber, client }: Props) {
  const handleClick = async () => {
    const [labor, mats, tp, quote] = await Promise.all([
      supabase.from("quote_labor_steps").select("*").eq("quote_id", quoteId),
      supabase.from("quote_materials").select("*").eq("quote_id", quoteId),
      supabase.from("quote_third_party").select("*").eq("quote_id", quoteId),
      supabase.from("quotes").select("*").eq("id", quoteId).single(),
    ]);

    const payload = {
      op_number: `OP-${quoteNumber}`,
      generated_at: new Date().toISOString(),
      quote: quote.data,
      client,
      labor_steps: labor.data ?? [],
      materials: mats.data ?? [],
      third_party: tp.data ?? [],
    };

    console.log("[GenerateOP mock] payload pronto para integração futura:", payload);
    toast.success(`OP ${payload.op_number} gerada (mock). Veja o console para o payload.`);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 h-8"
      onClick={handleClick}
      title="Gerar Ordem de Produção (mock)"
    >
      <ClipboardCheck className="h-3.5 w-3.5" />
      Gerar OP
    </Button>
  );
}
