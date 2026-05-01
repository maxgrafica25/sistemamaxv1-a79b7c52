import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUS_META, KANBAN_COLUMNS, type SalesOrderStatus } from "@/lib/erp/status";
import { formatBRL } from "@/lib/erp/payment-terms";
import { Calendar, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KanbanOrder {
  id: string;
  order_number: string;
  client_name: string;
  total_value: number;
  status: SalesOrderStatus;
  delivery_date: string | null;
  quote_id: string | null;
}

interface Props {
  orders: KanbanOrder[];
  onMove: (orderId: string, newStatus: SalesOrderStatus) => Promise<void>;
  onOpenOrder: (orderId: string) => void;
}

function OrderCard({ order, onOpen }: { order: KanbanOrder; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: order.id });
  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      className={cn(
        "p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all border-l-4 select-none",
        ORDER_STATUS_META[order.status].badgeClass,
        isDragging && "opacity-40",
      )}
      style={{ borderLeftColor: undefined }}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-mono font-semibold">{order.order_number}</span>
        {order.quote_id && <FileText className="h-3 w-3 text-muted-foreground" />}
      </div>
      <div className="text-sm font-medium text-foreground truncate mb-1">{order.client_name}</div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{formatBRL(order.total_value)}</span>
        {order.delivery_date && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(order.delivery_date + "T00:00:00").toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
    </Card>
  );
}

function Column({ status, orders, onOpenOrder }: { status: SalesOrderStatus; orders: KanbanOrder[]; onOpenOrder: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = ORDER_STATUS_META[status];
  const total = orders.reduce((s, o) => s + o.total_value, 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg border border-border bg-muted/20 p-2 min-w-[260px] flex-1",
        isOver && "ring-2 ring-primary bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between px-1 py-2 mb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", meta.dotClass)} />
          <span className="text-sm font-semibold">{meta.label}</span>
          <Badge variant="secondary" className="text-[10px] py-0 h-4">{orders.length}</Badge>
        </div>
        <span className="text-xs text-muted-foreground">{formatBRL(total)}</span>
      </div>
      <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
        {orders.map((o) => (
          <OrderCard key={o.id} order={o} onOpen={() => onOpenOrder(o.id)} />
        ))}
        {orders.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">Nenhum pedido</p>
        )}
      </div>
    </div>
  );
}

export function PedidosKanban({ orders, onMove, onOpenOrder }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const handleStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const handleEnd = async (e: DragEndEvent) => {
    setDraggingId(null);
    const orderId = String(e.active.id);
    const newStatus = e.over?.id as SalesOrderStatus | undefined;
    if (!newStatus) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === newStatus) return;
    await onMove(orderId, newStatus);
  };

  const draggingOrder = draggingId ? orders.find((o) => o.id === draggingId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {KANBAN_COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            orders={orders.filter((o) => o.status === status)}
            onOpenOrder={onOpenOrder}
          />
        ))}
      </div>
      <DragOverlay>
        {draggingOrder && (
          <Card className="p-3 shadow-lg border-l-4 bg-card cursor-grabbing">
            <div className="text-xs font-mono font-semibold mb-1">{draggingOrder.order_number}</div>
            <div className="text-sm font-medium">{draggingOrder.client_name}</div>
            <div className="text-xs font-semibold mt-1">{formatBRL(draggingOrder.total_value)}</div>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}
