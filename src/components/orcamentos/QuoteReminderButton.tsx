import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface QuoteReminderButtonProps {
  quoteId: string;
  quoteNumber: string;
  clientName: string;
}

export default function QuoteReminderButton({ quoteId, quoteNumber, clientName }: QuoteReminderButtonProps) {
  const { user } = useAuth();
  const [hasReminder, setHasReminder] = useState(false);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [intervalDays, setIntervalDays] = useState(3);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("quote_reminders")
      .select("id, is_active")
      .eq("quote_id", quoteId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setHasReminder(true);
          setReminderId(data.id);
        }
      });
  }, [quoteId, user]);

  const createReminder = async () => {
    if (!user) return;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);

    const { data } = await supabase.from("quote_reminders").insert({
      quote_id: quoteId,
      user_id: user.id,
      interval_days: intervalDays,
      next_reminder_at: nextDate.toISOString(),
    }).select("id").single();

    // Also create the first notification
    await supabase.from("notifications").insert({
      user_id: user.id,
      title: `Lembrete: Orçamento ${quoteNumber}`,
      message: `Pedir posição ao cliente ${clientName} sobre o orçamento ${quoteNumber}`,
      type: "reminder",
      source_type: "quote",
      source_id: quoteId,
      due_date: nextDate.toISOString(),
    });

    if (data) {
      setHasReminder(true);
      setReminderId(data.id);
    }
    setShowDialog(false);
    toast.success(`Lembrete criado! Você será notificado a cada ${intervalDays} dias.`);
  };

  const removeReminder = async () => {
    if (!reminderId) return;
    await supabase.from("quote_reminders").update({ is_active: false }).eq("id", reminderId);
    setHasReminder(false);
    setReminderId(null);
    toast.success("Lembrete removido");
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={`h-8 w-8 ${hasReminder ? "text-amber-500 hover:text-amber-600" : ""}`}
        title={hasReminder ? "Remover lembrete" : "Criar lembrete"}
        onClick={(e) => {
          e.stopPropagation();
          if (hasReminder) removeReminder();
          else setShowDialog(true);
        }}
      >
        {hasReminder ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Criar Lembrete</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Lembrete para pedir posição ao cliente <strong>{clientName}</strong> sobre o orçamento <strong>{quoteNumber}</strong>.
            </p>
            <div className="space-y-2">
              <Label>Intervalo (dias)</Label>
              <Input
                type="number"
                min={1}
                value={intervalDays}
                onChange={(e) => setIntervalDays(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">Você será notificado a cada {intervalDays} dia(s)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={createReminder}>Criar Lembrete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
