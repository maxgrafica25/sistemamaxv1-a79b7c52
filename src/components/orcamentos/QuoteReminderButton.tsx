import { useState, useEffect } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [recurrence, setRecurrence] = useState("none");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reminders")
      .select("id")
      .eq("source_id", quoteId)
      .eq("user_id", user.id)
      .eq("category", "quote")
      .eq("is_completed", false)
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

    const { data } = await supabase.from("reminders").insert({
      user_id: user.id,
      title: `Cobrar posição: ${quoteNumber}`,
      description: `Pedir posição ao cliente ${clientName} sobre o orçamento ${quoteNumber}`,
      remind_at: nextDate.toISOString(),
      recurrence,
      category: "quote",
      source_id: quoteId,
    }).select("id").single();

    if (data) {
      setHasReminder(true);
      setReminderId(data.id);
    }
    setShowDialog(false);
    toast.success(`Lembrete criado para ${nextDate.toLocaleDateString("pt-BR")}!`);
  };

  const removeReminder = async () => {
    if (!reminderId) return;
    await supabase.from("reminders").delete().eq("id", reminderId);
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
              <Label>Lembrar em (dias)</Label>
              <Input type="number" min={1} value={intervalDays} onChange={(e) => setIntervalDays(parseInt(e.target.value) || 1)} />
            </div>
            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select value={recurrence} onValueChange={setRecurrence}>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={createReminder}>Criar Lembrete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
