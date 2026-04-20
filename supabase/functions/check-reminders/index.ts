// SERVICE ROLE: necessária — cria notifications para múltiplos usuários
// (bypass RLS user_id = auth.uid()). Cliente via wrapper auditado.
import { getAdminClient, logAdminOperation } from "../_shared/admin-client.ts";

Deno.serve(async (req) => {
  try {
    const supabase = getAdminClient({
      fnName: "check-reminders",
      reason: "Cron: criar notificações para outros usuários a partir de reminders vencidos",
    });
    const now = new Date().toISOString();

    // Find reminders that are due and not completed
    const { data: dueReminders, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("is_completed", false)
      .lte("remind_at", now);

    if (error) {
      console.error("Error fetching reminders:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    let processed = 0;

    for (const reminder of dueReminders) {
      // Check if notification already exists for this reminder (avoid duplicates)
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("source_type", "reminder")
        .eq("source_id", reminder.id)
        .eq("user_id", reminder.user_id)
        .limit(1);

      if (existing && existing.length > 0) {
        // Already notified — handle recurrence or skip
        if (reminder.recurrence !== "none") {
          const next = new Date(reminder.remind_at);
          if (reminder.recurrence === "daily") next.setDate(next.getDate() + 1);
          else if (reminder.recurrence === "weekly") next.setDate(next.getDate() + 7);
          else if (reminder.recurrence === "monthly") next.setMonth(next.getMonth() + 1);

          // Only reschedule if next date is in the future
          if (next > new Date()) {
            await supabase.from("reminders").update({ remind_at: next.toISOString() }).eq("id", reminder.id);
            // Delete old notification so it can fire again
            await supabase.from("notifications").delete().eq("source_type", "reminder").eq("source_id", reminder.id).eq("user_id", reminder.user_id);
          }
        }
        continue;
      }

      // Create notification
      const categoryLabels: Record<string, string> = {
        custom: "Lembrete",
        quote: "Orçamento",
        consumable: "Consumível",
        routine: "Rotina",
      };

      const typeLabel = categoryLabels[reminder.category] || "Lembrete";

      await supabase.from("notifications").insert({
        user_id: reminder.user_id,
        title: `${typeLabel}: ${reminder.title}`,
        message: reminder.description || `Lembrete agendado para agora.`,
        type: "reminder",
        source_type: "reminder",
        source_id: reminder.id,
        due_date: reminder.remind_at,
      });

      // If non-recurring, mark as completed
      if (reminder.recurrence === "none") {
        await supabase.from("reminders").update({ is_completed: true }).eq("id", reminder.id);
      }

      processed++;
    }

    return new Response(JSON.stringify({ processed, total: dueReminders.length }), { status: 200 });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
