import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, History, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface QuoteRow {
  id: string;
  quote_number: string;
  product: string;
  status: string;
  created_at: string;
}

interface Props {
  clientId: string;
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  approved: { label: "Aprovado", variant: "default" },
  rejected: { label: "Rejeitado", variant: "destructive" },
  expired: { label: "Expirado", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "outline" },
};

export function ClientLastSalesPanel({ clientId }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<QuoteRow[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select("id, quote_number, product, status, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!active) return;
      if (!error && data) setRows(data as QuoteRow[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [clientId]);

  return (
    <Card className="bg-muted/30 border-dashed animate-in fade-in slide-in-from-top-2">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <History className="h-4 w-4 text-primary" />
          Últimos orçamentos deste cliente
          {!loading && <span className="text-xs text-muted-foreground font-normal">({rows.length})</span>}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-sm text-muted-foreground">
            <Inbox className="h-6 w-6 mb-1 opacity-50" />
            Nenhum orçamento registrado para este cliente ainda.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="px-2 py-1.5 font-medium">Nº</th>
                  <th className="px-2 py-1.5 font-medium">Produto</th>
                  <th className="px-2 py-1.5 font-medium">Data</th>
                  <th className="px-2 py-1.5 font-medium">Status</th>
                  <th className="px-2 py-1.5 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => {
                  const s = STATUS_LABEL[q.status] ?? { label: q.status, variant: "outline" as const };
                  return (
                    <tr key={q.id} className="border-b border-border/40 hover:bg-background/60">
                      <td className="px-2 py-2 font-mono text-xs">{q.quote_number}</td>
                      <td className="px-2 py-2 truncate max-w-[200px]">{q.product}</td>
                      <td className="px-2 py-2 text-xs text-muted-foreground">
                        {new Date(q.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <a
                          href={`/orcamentos-v3/${q.id}/editar`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                        >
                          abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-[10px] text-muted-foreground pt-1 px-2">* exibidos os 10 mais recentes</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
