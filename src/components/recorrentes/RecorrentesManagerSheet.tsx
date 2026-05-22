// Sheet lateral para gerenciar todos os recorrentes de um cliente
// + ver histórico técnico de cada um.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Plus, FolderOpen, Pencil, Trash2, Repeat, Printer, Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";
import { cn } from "@/lib/utils";
import {
  useClientRecurring,
  daysSince,
  daysUntil,
  type ClientRecurringProduct,
} from "@/hooks/useClientRecurring";
import { RecorrenteFormDialog } from "./RecorrenteFormDialog";
import { PostPrintDialog } from "./PostPrintDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName: string;
}

interface HistoryEntry {
  id: string;
  impresso_em: string;
  carga_cor: string | null;
  observacoes: string | null;
  equipment_id: string | null;
  equipment_nome?: string | null;
}

export function RecorrentesManagerSheet({ open, onOpenChange, clientId, clientName }: Props) {
  const { items, loading, reload } = useClientRecurring(open ? clientId : null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRecurringProduct | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printTarget, setPrintTarget] = useState<ClientRecurringProduct | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (it: ClientRecurringProduct) => { setEditing(it); setFormOpen(true); };
  const openPrint = (it: ClientRecurringProduct) => { setPrintTarget(it); setPrintOpen(true); };

  const deleteRec = async (id: string) => {
    if (!confirm("Excluir este recorrente? O histórico também será removido.")) return;
    const { error } = await supabase.from("client_recurring_products" as never).delete().eq("id", id);
    if (error) return handleError(error, "excluir recorrente");
    toast.success("Recorrente excluído");
    reload();
  };

  const toggleHistory = async (it: ClientRecurringProduct) => {
    if (expanded === it.id) { setExpanded(null); return; }
    setExpanded(it.id);
    if (!history[it.id]) {
      const { data } = await supabase
        .from("recurring_print_history" as never)
        .select("id, impresso_em, carga_cor, observacoes, equipment_id, equipments(nome)")
        .eq("recurring_id", it.id)
        .order("impresso_em", { ascending: false });
      const entries: HistoryEntry[] = ((data as unknown) as Array<HistoryEntry & { equipments: { nome: string } | null }>)
        ?.map((r) => ({ ...r, equipment_nome: r.equipments?.nome ?? null })) ?? [];
      setHistory((h) => ({ ...h, [it.id]: entries }));
    }
  };

  const refreshHistoryFor = async (id: string) => {
    const { data } = await supabase
      .from("recurring_print_history" as never)
      .select("id, impresso_em, carga_cor, observacoes, equipment_id, equipments(nome)")
      .eq("recurring_id", id)
      .order("impresso_em", { ascending: false });
    const entries: HistoryEntry[] = ((data as unknown) as Array<HistoryEntry & { equipments: { nome: string } | null }>)
      ?.map((r) => ({ ...r, equipment_nome: r.equipments?.nome ?? null })) ?? [];
    setHistory((h) => ({ ...h, [id]: entries }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            Recorrentes — {clientName}
          </SheetTitle>
        </SheetHeader>

        <div className="flex justify-end mb-3">
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Novo recorrente
          </Button>
        </div>

        {loading && <p className="text-sm text-muted-foreground py-6 text-center">Carregando...</p>}

        {!loading && items.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nenhum produto recorrente cadastrado.<br />
            Clique em <strong>Novo recorrente</strong> para começar.
          </Card>
        )}

        <div className="space-y-3">
          {items.map((it) => {
            const since = daysSince(it.ultima_impressao_em);
            const until = daysUntil(it.proxima_prevista_em);
            const overdue = until !== null && until < 0;
            const soon = until !== null && until >= 0 && until <= it.aviso_antecedencia_dias;
            const isOpen = expanded === it.id;
            const hist = history[it.id] ?? [];

            return (
              <Card key={it.id} className={cn("p-3", overdue && "border-destructive/50", soon && !overdue && "border-amber-500/50")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{it.nome}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[10px]">a cada {it.frequencia_dias}d</Badge>
                      {since !== null && (
                        <Badge variant="secondary" className="text-[10px]">
                          última há {since}d
                        </Badge>
                      )}
                      {overdue && (
                        <Badge className="text-[10px] bg-destructive text-destructive-foreground">
                          atrasado {Math.abs(until!)}d
                        </Badge>
                      )}
                      {soon && !overdue && (
                        <Badge className="text-[10px] bg-amber-500 text-white">
                          vence em {until}d
                        </Badge>
                      )}
                    </div>
                    {it.observacoes && (
                      <p className="text-[11px] text-muted-foreground mt-1.5">{it.observacoes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {it.drive_folder_url && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Abrir pasta no Drive"
                        onClick={() => window.open(it.drive_folder_url!, "_blank", "noopener")}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(it)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteRec(it.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openPrint(it)}>
                    <Printer className="h-3 w-3 mr-1" /> Registrar impressão
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleHistory(it)}>
                    <Clock className="h-3 w-3 mr-1" />
                    Histórico
                    {isOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                  </Button>
                </div>

                {isOpen && (
                  <div className="mt-2 border-t pt-2 space-y-1.5">
                    {hist.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">Sem registros ainda.</p>
                    )}
                    {hist.map((h) => (
                      <div key={h.id} className="text-[11px] bg-muted/30 rounded p-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {new Date(h.impresso_em).toLocaleDateString("pt-BR")} · {h.equipment_nome ?? "—"}
                          </span>
                          {h.carga_cor && <Badge variant="outline" className="text-[10px]">{h.carga_cor}</Badge>}
                        </div>
                        {h.observacoes && <p className="text-muted-foreground mt-0.5">{h.observacoes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <RecorrenteFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          clientId={clientId}
          editing={editing}
          onSaved={reload}
        />
        {printTarget && (
          <PostPrintDialog
            open={printOpen}
            onOpenChange={setPrintOpen}
            recurringId={printTarget.id}
            recurringNome={printTarget.nome}
            onSaved={() => { reload(); refreshHistoryFor(printTarget.id); }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
