import { useState, useEffect, useCallback } from "react";
import { Bell, X, Clock, AlertTriangle, Info, Plus, CalendarDays, CheckCircle2, Trash2, AlarmClock, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  source_type: string | null;
  source_id: string | null;
  is_read: boolean;
  created_at: string;
  due_date: string | null;
}

const categoryLabels: Record<string, string> = {
  custom: "Personalizado",
  quote: "Orçamento",
  consumable: "Consumível",
  routine: "Rotina",
};

const recurrenceLabels: Record<string, string> = {
  none: "Sem repetição",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

const snoozeOptions = [
  { label: "30 minutos", minutes: 30 },
  { label: "1 hora", minutes: 60 },
  { label: "3 horas", minutes: 180 },
  { label: "Amanhã 9h", minutes: -1 },
];

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [showNewReminder, setShowNewReminder] = useState(false);

  // New reminder form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newCategory, setNewCategory] = useState("custom");
  const [newRecurrence, setNewRecurrence] = useState("none");

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .or(`due_date.is.null,due_date.lte.${new Date().toISOString()}`)
      .order("is_read", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => fetchNotifications())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const snoozeNotification = async (n: Notification, minutes: number) => {
    let newDue: Date;
    if (minutes === -1) {
      // Tomorrow 9am
      newDue = new Date();
      newDue.setDate(newDue.getDate() + 1);
      newDue.setHours(9, 0, 0, 0);
    } else {
      newDue = new Date(Date.now() + minutes * 60 * 1000);
    }
    await supabase.from("notifications").update({ 
      is_read: true, 
      due_date: newDue.toISOString() 
    }).eq("id", n.id);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
    toast.success("Alerta adiado");
  };

  const completeNotification = async (n: Notification) => {
    // If it came from a reminder, mark that reminder as completed too
    if (n.source_type === "reminder" && n.source_id) {
      await supabase.from("reminders").update({ is_completed: true }).eq("id", n.source_id);
    }
    await supabase.from("notifications").delete().eq("id", n.id);
    setNotifications(prev => prev.filter(x => x.id !== n.id));
    toast.success("Alerta concluído");
  };

  const createReminder = async () => {
    if (!user || !newTitle.trim() || !newDate) return;
    const remindAt = new Date(`${newDate}T${newTime || "09:00"}`);
    await supabase.from("reminders").insert({
      user_id: user.id,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      remind_at: remindAt.toISOString(),
      recurrence: newRecurrence,
      category: newCategory,
    });
    setShowNewReminder(false);
    setNewTitle("");
    setNewDescription("");
    setNewDate("");
    setNewTime("09:00");
    setNewCategory("custom");
    setNewRecurrence("none");
    toast.success("Lembrete criado! Você será alertado no horário definido.");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "reminder": return <Clock className="h-4 w-4 text-blue-500 shrink-0" />;
      case "alert": return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
      default: return <Info className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  const unread = notifications.filter(n => !n.is_read);
  const read = notifications.filter(n => n.is_read);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="end">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Alertas
              {unreadCount > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{unreadCount}</Badge>
              )}
            </h3>
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>
                  Ler todas
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => { setShowNewReminder(true); setOpen(false); }}>
                <Plus className="h-3.5 w-3.5" /> Lembrete
              </Button>
            </div>
          </div>

          <ScrollArea className="max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhum alerta</p>
                <p className="text-xs mt-1">Crie lembretes para receber alertas aqui</p>
              </div>
            ) : (
              <div>
                {/* Unread */}
                {unread.length > 0 && (
                  <div>
                    {unread.map((n) => (
                      <AlertItem key={n.id} notification={n} getIcon={getIcon} onMarkRead={markAsRead} onDelete={deleteNotification} onSnooze={snoozeNotification} onComplete={completeNotification} />
                    ))}
                  </div>
                )}

                {/* Read */}
                {read.length > 0 && (
                  <div>
                    {unread.length > 0 && (
                      <div className="px-4 py-1.5 bg-muted/50 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                        Lidos
                      </div>
                    )}
                    {read.map((n) => (
                      <AlertItem key={n.id} notification={n} getIcon={getIcon} onMarkRead={markAsRead} onDelete={deleteNotification} onSnooze={snoozeNotification} onComplete={completeNotification} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* New Reminder Dialog */}
      <Dialog open={showNewReminder} onOpenChange={setShowNewReminder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Novo Lembrete
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input placeholder="Ex: Cobrar posição do cliente X" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea placeholder="Detalhes adicionais..." value={newDescription} onChange={e => setNewDescription(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hora</Label>
                <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">Personalizado</SelectItem>
                    <SelectItem value="quote">Orçamento</SelectItem>
                    <SelectItem value="consumable">Consumível</SelectItem>
                    <SelectItem value="routine">Rotina</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select value={newRecurrence} onValueChange={setNewRecurrence}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem repetição</SelectItem>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewReminder(false)}>Cancelar</Button>
            <Button onClick={createReminder} disabled={!newTitle.trim() || !newDate}>Criar Lembrete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Alert item with inline actions
function AlertItem({ notification: n, getIcon, onMarkRead, onDelete, onSnooze, onComplete }: {
  notification: Notification;
  getIcon: (type: string) => React.ReactNode;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onSnooze: (n: Notification, minutes: number) => void;
  onComplete: (n: Notification) => void;
}) {
  return (
    <div
      className={`group flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 border-b last:border-b-0 ${!n.is_read ? "bg-primary/5" : ""}`}
      onClick={() => !n.is_read && onMarkRead(n.id)}
    >
      <div className="mt-0.5">{getIcon(n.type)}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${!n.is_read ? "font-semibold" : "font-medium"} text-foreground leading-tight`}>{n.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>

      {/* Action buttons — visible on hover */}
      <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity items-start pt-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
          title="Concluir"
          onClick={(e) => { e.stopPropagation(); onComplete(n); }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              title="Adiar"
              onClick={(e) => e.stopPropagation()}
            >
              <AlarmClock className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {snoozeOptions.map((opt) => (
              <DropdownMenuItem key={opt.label} onClick={(e) => { e.stopPropagation(); onSnooze(n, opt.minutes); }}>
                {opt.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          title="Excluir"
          onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
