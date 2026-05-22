// Painel "Compras recorrentes deste cliente" exibido no fluxo /orcamentos-v3/novo.
// Quando um cliente é selecionado, lista os recorrentes ativos com atalhos
// para abrir Drive, gerar OP direto ou gerar orçamento pré-preenchido.
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/handleError";
import { FolderOpen, Repeat, FileText, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useClientRecurring,
  daysSince,
  daysUntil,
  type ClientRecurringProduct,
} from "@/hooks/useClientRecurring";

interface Props {
  clientId: string | null;
  clientName: string;
  onSelectPreset?: (recurringId: string, presetId: string | null) => void;
}

export function RecorrentesPanel({ clientId, clientName, onSelectPreset }: Props) {
  const navigate = useNavigate();
  const { items } = useClientRecurring(clientId);

  if (!clientId || items.length === 0) return null;

  const generateOP = async (rec: ClientRecurringProduct) => {
    const { data, error } = await supabase
      .from("sales_orders" as never)
      .insert({
        client_id: clientId,
        client_name: clientName,
        status: "aberto",
        total_value: 0,
        recurring_id: rec.id,
        production_notes: `Reimpressão recorrente: ${rec.nome}` +
          (rec.drive_folder_url ? `\nArtes: ${rec.drive_folder_url}` : ""),
      } as never)
      .select("id, order_number")
      .single();
    if (error || !data) return handleError(error, "criar pedido");
    toast.success(`Pedido ${(data as { order_number: string }).order_number} criado`);
    navigate("/pedidos");
  };

  const useInQuote = (rec: ClientRecurringProduct) => {
    onSelectPreset?.(rec.id, rec.quote_preset_id);
    toast.success(`Preset "${rec.nome}" aplicado`);
  };

  return (
    <Card className="p-3 mb-3 border-primary/20 bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <Repeat className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          Compras recorrentes deste cliente
        </p>
      </div>
      <div className="space-y-2">
        {items.map((rec) => {
          const since = daysSince(rec.ultima_impressao_em);
          const until = daysUntil(rec.proxima_prevista_em);
          const overdue = until !== null && until < 0;
          const soon = until !== null && until >= 0 && until <= rec.aviso_antecedencia_dias;
          return (
            <div
              key={rec.id}
              className={cn(
                "flex items-center gap-2 flex-wrap rounded-md border bg-background px-3 py-2",
                overdue && "border-destructive/40",
                soon && !overdue && "border-amber-500/40",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{rec.nome}</p>
                <div className="flex gap-1.5 mt-0.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">a cada {rec.frequencia_dias}d</Badge>
                  {since !== null && <Badge variant="secondary" className="text-[10px]">há {since}d</Badge>}
                  {overdue && <Badge className="text-[10px] bg-destructive text-destructive-foreground">atrasado</Badge>}
                  {soon && !overdue && <Badge className="text-[10px] bg-amber-500 text-white">vence {until}d</Badge>}
                </div>
              </div>
              {rec.drive_folder_url && (
                <Button
                  size="sm" variant="ghost" className="h-7 text-xs"
                  onClick={() => window.open(rec.drive_folder_url!, "_blank", "noopener")}
                >
                  <FolderOpen className="h-3 w-3 mr-1" /> Drive
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => useInQuote(rec)}>
                <FileText className="h-3 w-3 mr-1" /> Usar no orçamento
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => generateOP(rec)}>
                <ShoppingCart className="h-3 w-3 mr-1" /> Gerar OP
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
