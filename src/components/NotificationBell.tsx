import { useState, useEffect, useCallback } from "react";
import { Bell, X, Clock, AlertTriangle, Info, Plus, CalendarDays, CheckCircle2, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow, format, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface Reminder {
  id: string;
  title: string;
  description: string | null;
  remind_at: string;
  recurrence: string;
  is_completed: boolean;
  category: string;
  source_id: string | null;
}

const categoryLabels: Record<string, string> = {
  custom: "Personalizado",
  quote: "Orçamento",
  consumable: "Consumível",
  routine: "Rotina",
};

const categoryColors: Record<string, string> = {
  custom: "bg-blue-500",
  quote: "bg-amber-500",
  consumable: "bg-purple-500",
  routine: "bg-green-500",
};

const recurrenceLabels: Record<string, string> = {
  none: "Sem repetição",
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const [showNewReminder, setShowNewReminder] = useState(false);
  const [tab, setTab] = useState("notifications");

  // New reminder form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("09:00");
  const [newCategory, setNewCategory] = useState("custom");
  const [newRecurrence, setNewRecurrence] = useState("none");

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    // Only fetch notifications for today or past (not future)
    const today = startOfDay(new Date()).toISOString();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .or(`due_date.is.null,due_date.lte.${new Date().toISOString()}`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setNotifications(data as Notification[]);
  }, [user]);

  const fetchReminders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .order("remind_at", { ascending: true })
      .limit(100);
    if (data) setReminders(data as Reminder[]);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    fetchReminders();
  }, [fetchNotifications, fetchReminders]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const ch1 = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => fetchNotifications())
      .subscribe();
    const ch2 = supabase
      .channel("reminders-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "reminders", filter: `user_id=eq.${user.id}` }, () => fetchReminders())
      .subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [user, fetchNotifications, fetchReminders]);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const todayReminders = reminders.filter(r => isToday(new Date(r.remind_at)) || isBefore(new Date(r.remind_at), new Date()));
  const totalBadge = unreadCount + todayReminders.length;

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

  const completeReminder = async (r: Reminder) => {
    if (r.recurrence !== "none") {
      // Reschedule
      const next = new Date(r.remind_at);
      if (r.recurrence === "daily") next.setDate(next.getDate() + 1);
      else if (r.recurrence === "weekly") next.setDate(next.getDate() + 7);
      else if (r.recurrence === "monthly") next.setMonth(next.getMonth() + 1);
      await supabase.from("reminders").update({ remind_at: next.toISOString() }).eq("id", r.id);
    } else {
      await supabase.from("reminders").update({ is_completed: true }).eq("id", r.id);
    }
    fetchReminders();
  };

  const deleteReminder = async (id: string) => {
    await supabase.from("reminders").delete().eq("id", id);
    setReminders(prev => prev.filter(r => r.id !== id));
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
    fetchReminders();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "reminder": return <Clock className="h-4 w-4 text-blue-500 shrink-0" />;
      case "alert": return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
      default: return <Info className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  // Group reminders: today/overdue vs upcoming
  const overdueOrToday = reminders.filter(r => isBefore(new Date(r.remind_at), new Date()) || isToday(new Date(r.remind_at)));
  const upcoming = reminders.filter(r => !isBefore(new Date(r.remind_at), new Date()) && !isToday(new Date(r.remind_at)));

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-5 w-5" />
            {totalBadge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {totalBadge > 9 ? "9+" : totalBadge}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="end">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="border-b px-3 pt-3 pb-0">
              <TabsList className="w-full grid grid-cols-2 h-9">
                <TabsTrigger value="notifications" className="text-xs gap-1.5">
                  <Bell className="h-3.5 w-3.5" />
                  Notificações
                  {unreadCount > 0 && <Badge variant="destructive" className="h-4 px-1 text-[10px]">{unreadCount}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="reminders" className="text-xs gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Lembretes
                  {todayReminders.length > 0 && <Badge variant="destructive" className="h-4 px-1 text-[10px]">{todayReminders.length}</Badge>}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* NOTIFICATIONS TAB */}
            <TabsContent value="notifications" className="m-0">
              {unreadCount > 0 && (
                <div className="flex justify-end px-4 py-2 border-b">
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllRead}>Marcar todas como lidas</Button>
                </div>
              )}
              <ScrollArea className="max-h-[360px]">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Bell className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma notificação</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map((n) => (
                      <div key={n.id} className={`flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${!n.is_read ? "bg-primary/5" : ""}`} onClick={() => !n.is_read && markAsRead(n.id)}>
                        {getIcon(n.type)}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${!n.is_read ? "font-semibold" : "font-medium"} text-foreground`}>{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* REMINDERS TAB */}
            <TabsContent value="reminders" className="m-0">
              <div className="flex justify-end px-4 py-2 border-b">
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => { setShowNewReminder(true); setOpen(false); }}>
                  <Plus className="h-3.5 w-3.5" /> Novo Lembrete
                </Button>
              </div>
              <ScrollArea className="max-h-[360px]">
                {reminders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <CalendarDays className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">Nenhum lembrete agendado</p>
                  </div>
                ) : (
                  <div>
                    {/* Overdue / Today */}
                    {overdueOrToday.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-destructive/10 text-xs font-semibold text-destructive">
                          Hoje / Atrasados ({overdueOrToday.length})
                        </div>
                        <div className="divide-y">
                          {overdueOrToday.map((r) => (
                            <ReminderItem key={r.id} reminder={r} onComplete={completeReminder} onDelete={deleteReminder} isOverdue />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Upcoming */}
                    {upcoming.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground">
                          Próximos ({upcoming.length})
                        </div>
                        <div className="divide-y">
                          {upcoming.map((r) => (
                            <ReminderItem key={r.id} reminder={r} onComplete={completeReminder} onDelete={deleteReminder} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
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

// Sub-component for reminder items
function ReminderItem({ reminder: r, onComplete, onDelete, isOverdue }: {
  reminder: Reminder;
  onComplete: (r: Reminder) => void;
  onDelete: (id: string) => void;
  isOverdue?: boolean;
}) {
  return (
    <div className={`flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${isOverdue ? "bg-destructive/5" : ""}`}>
      <Badge className={`${categoryColors[r.category] || "bg-blue-500"} h-5 px-1.5 text-[10px] shrink-0 mt-0.5`}>
        {categoryLabels[r.category] || r.category}
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{r.title}</p>
        {r.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.description}</p>}
        <div className="flex items-center gap-2 mt-1">
          <p className="text-[10px] text-muted-foreground/70">
            {format(new Date(r.remind_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
          {r.recurrence !== "none" && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
              <RotateCcw className="h-2.5 w-2.5" /> {recurrenceLabels[r.recurrence]}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-0.5 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50" title="Concluir" onClick={() => onComplete(r)}>
          <CheckCircle2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" title="Excluir" onClick={() => onDelete(r.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
