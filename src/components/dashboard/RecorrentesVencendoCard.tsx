// Card de "Recorrentes vencendo" para o Dashboard.
// Lista somente leitura (sem botões de ação — respeita a regra de design
// do dashboard) que linka para a ficha do cliente. Some quando vazio.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { daysUntil } from "@/hooks/useClientRecurring";

interface Row {
  id: string;
  nome: string;
  proxima_prevista_em: string | null;
  aviso_antecedencia_dias: number;
  client_id: string;
  client_nome: string;
}

export function RecorrentesVencendoCard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("client_recurring_products" as never)
        .select("id, nome, proxima_prevista_em, aviso_antecedencia_dias, client_id, clients(nome)")
        .eq("ativo", true)
        .order("proxima_prevista_em", { ascending: true });
      if (cancel) return;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const mapped: Row[] = ((data as unknown) as Array<{
        id: string; nome: string; proxima_prevista_em: string | null;
        aviso_antecedencia_dias: number; client_id: string; clients: { nome: string } | null;
      }>)
        ?.filter((r) => {
          if (!r.proxima_prevista_em) return false;
          const d = new Date(r.proxima_prevista_em + "T00:00:00");
          const limit = new Date(today);
          limit.setDate(limit.getDate() + r.aviso_antecedencia_dias);
          return d <= limit;
        })
        .slice(0, 8)
        .map((r) => ({
          id: r.id,
          nome: r.nome,
          proxima_prevista_em: r.proxima_prevista_em,
          aviso_antecedencia_dias: r.aviso_antecedencia_dias,
          client_id: r.client_id,
          client_nome: r.clients?.nome ?? "—",
        })) ?? [];
      setRows(mapped);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, []);

  if (loading || rows.length === 0) return null;

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Repeat className="h-4 w-4 text-primary" />
          Recorrentes vencendo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => {
          const until = daysUntil(r.proxima_prevista_em);
          const overdue = until !== null && until < 0;
          return (
            <Link
              key={r.id}
              to="/clientes"
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 hover:bg-muted/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.client_nome}</p>
                <p className="text-[11px] text-muted-foreground truncate">{r.nome}</p>
              </div>
              {overdue ? (
                <Badge className="text-[10px] bg-destructive text-destructive-foreground shrink-0">
                  atrasado {Math.abs(until!)}d
                </Badge>
              ) : (
                <Badge className="text-[10px] bg-amber-500 text-white shrink-0">
                  vence em {until}d
                </Badge>
              )}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
