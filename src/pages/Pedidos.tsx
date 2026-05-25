import { PageHeader } from "@/components/PageHeader";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, MoreHorizontal, Pencil, CheckCircle2, XCircle, Loader2, ClipboardList, LayoutGrid, List, Receipt, Printer } from "lucide-react";
import { generateProductionOrderPdf } from "@/lib/erp/production-order-pdf";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIsFinanceiro } from "@/hooks/useIsFinanceiro";
import { handleError } from "@/lib/handleError";
import { ORDER_STATUS_META, type SalesOrderStatus } from "@/lib/erp/status";
import { formatBRL } from "@/lib/erp/payment-terms";
import { OrderEditorDialog } from "@/components/pedidos/OrderEditorDialog";
import { GenerateReceivableDialog } from "@/components/pedidos/GenerateReceivableDialog";
import { PedidosKanban, type KanbanOrder } from "@/components/pedidos/PedidosKanban";
import { PostPrintDialog } from "@/components/recorrentes/PostPrintDialog";
import { cn } from "@/lib/utils";

interface SalesOrder {
  id: string;
  order_number: string;
  client_id: string | null;
  client_name: string;
  quote_id: string | null;
  status: SalesOrderStatus;
  total_value: number;
  payment_terms: string | null;
  payment_method: string | null;
  delivery_date: string | null;
  created_at: string;
  recurring_id: string | null;
}

export default function Pedidos() {
  const isFinanceiro = useIsFinanceiro();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [receivableOpen, setReceivableOpen] = useState(false);
  const [receivableOrder, setReceivableOrder] = useState<SalesOrder | null>(null);

  const [postPrintOpen, setPostPrintOpen] = useState(false);
  const [postPrintCtx, setPostPrintCtx] = useState<{ recurringId: string; recurringNome?: string; salesOrderId: string } | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales_orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar pedidos.");
    setOrders((data ?? []) as SalesOrder[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("sales_orders_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_orders" }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!o.order_number.toLowerCase().includes(q) && !o.client_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleOpenNew = () => { setEditingId(null); setEditorOpen(true); };
  const handleOpenEdit = (id: string) => { setEditingId(id); setEditorOpen(true); };

  const handleStatusChange = async (id: string, newStatus: SalesOrderStatus) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;

    if (newStatus === "aprovado" && !isFinanceiro) {
      toast.error("Sem permissão", { description: "Apenas o Financeiro pode aprovar pedidos." });
      return;
    }
    if (newStatus === "cancelado" && !isFinanceiro) {
      toast.error("Sem permissão", { description: "Apenas o Financeiro pode cancelar pedidos." });
      return;
    }

    const { error } = await supabase.from("sales_orders").update({ status: newStatus }).eq("id", id);
    if (error) return handleError(error, "alterar status do pedido");
    toast.success(`Pedido ${order.order_number}: ${ORDER_STATUS_META[newStatus].label}`);

    if (newStatus === "aprovado" && isFinanceiro) {
      setReceivableOrder({ ...order, status: newStatus });
      setReceivableOpen(true);
    }

    // Pedido recorrente entregue → abre form rápido pós-impressão
    if (newStatus === "entregue" && order.recurring_id) {
      const { data: rec } = await supabase
        .from("client_recurring_products" as never)
        .select("nome")
        .eq("id", order.recurring_id)
        .maybeSingle();
      const nome = ((rec as unknown) as { nome?: string } | null)?.nome;
      setPostPrintCtx({ recurringId: order.recurring_id, recurringNome: nome, salesOrderId: order.id });
      setPostPrintOpen(true);
    }
  };

  const handleApprove = (order: SalesOrder) => handleStatusChange(order.id, "aprovado");

  const kanbanOrders: KanbanOrder[] = filtered.map((o) => ({
    id: o.id, order_number: o.order_number, client_name: o.client_name,
    total_value: Number(o.total_value), status: o.status,
    delivery_date: o.delivery_date, quote_id: o.quote_id,
  }));

  const stats = {
    total: orders.length,
    aberto: orders.filter((o) => o.status === "aberto").length,
    aprovado: orders.filter((o) => o.status === "aprovado").length,
    em_producao: orders.filter((o) => o.status === "em_producao").length,
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Pedidos de Venda
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestão de pedidos · Em aberto: {stats.aberto} · Em produção: {stats.em_producao}
          </p>
        </div>
        <Button onClick={handleOpenNew}>
          <Plus className="h-4 w-4 mr-1.5" /> Novo Pedido
        </Button>
      </div>

      {/* Filtros + view toggle */}
      <Card className="mb-4">
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por número ou cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="aberto">Aberto</SelectItem>
              <SelectItem value="aprovado">Aprovado</SelectItem>
              <SelectItem value="em_producao">Em Produção</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="list"><List className="h-3.5 w-3.5 mr-1" /> Lista</TabsTrigger>
              <TabsTrigger value="kanban"><LayoutGrid className="h-3.5 w-3.5 mr-1" /> Kanban</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : view === "kanban" ? (
        <PedidosKanban
          orders={kanbanOrders}
          onMove={(id, status) => handleStatusChange(id, status)}
          onOpenOrder={handleOpenEdit}
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left py-2.5 px-4">Número</th>
                  <th className="text-left py-2.5 px-4">Cliente</th>
                  <th className="text-left py-2.5 px-4">Status</th>
                  <th className="text-right py-2.5 px-4">Valor</th>
                  <th className="text-left py-2.5 px-4">Entrega</th>
                  <th className="py-2.5 px-4 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-12">Nenhum pedido encontrado.</td></tr>
                )}
                {filtered.map((o) => {
                  const meta = ORDER_STATUS_META[o.status];
                  return (
                    <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-mono text-xs">{o.order_number}</td>
                      <td className="py-2.5 px-4">{o.client_name}</td>
                      <td className="py-2.5 px-4">
                        <Badge className={cn("border", meta.badgeClass)}>{meta.label}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold">{formatBRL(Number(o.total_value))}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">
                        {o.delivery_date ? new Date(o.delivery_date + "T00:00:00").toLocaleDateString("pt-BR") : "—"}
                      </td>
                      <td className="py-2.5 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(o.id)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                try { await generateProductionOrderPdf({ orderId: o.id }); toast.success("OP gerada."); }
                                catch (e: any) { toast.error(e.message ?? "Erro ao gerar OP."); }
                              }}
                            >
                              <Printer className="h-3.5 w-3.5 mr-2" /> Imprimir OP
                            </DropdownMenuItem>
                            {isFinanceiro && o.status === "aberto" && (
                              <DropdownMenuItem onClick={() => handleApprove(o)}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-blue-600" /> Aprovar / Faturar
                              </DropdownMenuItem>
                            )}
                            {o.status === "aprovado" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(o.id, "em_producao")}>
                                Iniciar produção
                              </DropdownMenuItem>
                            )}
                            {o.status === "em_producao" && (
                              <DropdownMenuItem onClick={() => handleStatusChange(o.id, "entregue")}>
                                Marcar como entregue
                              </DropdownMenuItem>
                            )}
                            {isFinanceiro && o.status === "aprovado" && (
                              <DropdownMenuItem onClick={() => { setReceivableOrder(o); setReceivableOpen(true); }}>
                                <Receipt className="h-3.5 w-3.5 mr-2" /> Gerar conta a receber
                              </DropdownMenuItem>
                            )}
                            {isFinanceiro && o.status !== "cancelado" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleStatusChange(o.id, "cancelado")}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-2" /> Cancelar
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <OrderEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        orderId={editingId}
        onSaved={() => fetchOrders()}
      />

      {receivableOrder && (
        <GenerateReceivableDialog
          open={receivableOpen}
          onOpenChange={setReceivableOpen}
          orderId={receivableOrder.id}
          orderNumber={receivableOrder.order_number}
          totalValue={Number(receivableOrder.total_value)}
          defaultTerm={receivableOrder.payment_terms ?? "30_60_90"}
          defaultMethod={receivableOrder.payment_method ?? "pix"}
        />
      )}

      {postPrintCtx && (
        <PostPrintDialog
          open={postPrintOpen}
          onOpenChange={(v) => { setPostPrintOpen(v); if (!v) setPostPrintCtx(null); }}
          recurringId={postPrintCtx.recurringId}
          recurringNome={postPrintCtx.recurringNome}
          salesOrderId={postPrintCtx.salesOrderId}
        />
      )}
    </div>
  );
}
