// SERVICE ROLE: necessária — cria notifications para múltiplos usuários
// (bypass RLS user_id = auth.uid()). Cliente via wrapper auditado.
import { getAdminClient, logAdminOperation, isServiceRoleRequest, isCronSecretRequest } from "../_shared/admin-client.ts";

function advanceDate(iso: string, recurrence: string): string {
  const d = new Date(iso);
  if (recurrence === "daily") d.setUTCDate(d.getUTCDate() + 1);
  else if (recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else if (recurrence === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (!isServiceRoleRequest(req) && !isCronSecretRequest(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  try {
    const supabase = getAdminClient({
      fnName: "check-reminders",
      reason: "Cron: criar notificações para outros usuários a partir de reminders vencidos",
    });
    const nowIso = new Date().toISOString();

    const { data: dueReminders, error } = await supabase
      .from("reminders")
      .select("*")
      .eq("is_completed", false)
      .is("cancelled_at", null)
      .lte("remind_at", nowIso);

    if (error) {
      console.error("Error fetching reminders:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!dueReminders || dueReminders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    const categoryLabels: Record<string, string> = {
      custom: "Lembrete",
      quote: "Orçamento",
      consumable: "Consumível",
      routine: "Rotina",
    };

    let processed = 0;

    for (const reminder of dueReminders) {
      // Anti-duplicata por ocorrência: (source_type, source_id, user_id, due_date)
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("source_type", "reminder")
        .eq("source_id", reminder.id)
        .eq("user_id", reminder.user_id)
        .eq("due_date", reminder.remind_at)
        .limit(1);

      if (existing && existing.length > 0) {
        // Já notificado para essa ocorrência exata — ainda assim, se for recorrente
        // e o remind_at não foi avançado, avança agora para destravar.
        if (reminder.recurrence !== "none") {
          let next = reminder.remind_at;
          const nowMs = Date.now();
          do {
            next = advanceDate(next, reminder.recurrence);
          } while (new Date(next).getTime() <= nowMs);
          await supabase
            .from("reminders")
            .update({ remind_at: next, updated_at: new Date().toISOString() })
            .eq("id", reminder.id);
        }
        continue;
      }

      const typeLabel = categoryLabels[reminder.category] || "Lembrete";

      // 1) Criar notificação da ocorrência atual
      const { error: insErr } = await supabase.from("notifications").insert({
        user_id: reminder.user_id,
        title: `${typeLabel}: ${reminder.title}`,
        message: reminder.description || `Lembrete agendado para agora.`,
        type: "reminder",
        source_type: "reminder",
        source_id: reminder.id,
        due_date: reminder.remind_at,
      });

      if (insErr) {
        console.error("Error creating notification for reminder", reminder.id, insErr);
        continue;
      }

      // 2) Atualizar lembrete: completar (não recorrente) ou avançar (recorrente)
      if (reminder.recurrence === "none") {
        await supabase
          .from("reminders")
          .update({ is_completed: true, updated_at: new Date().toISOString() })
          .eq("id", reminder.id);
      } else {
        let next = reminder.remind_at;
        const nowMs = Date.now();
        do {
          next = advanceDate(next, reminder.recurrence);
        } while (new Date(next).getTime() <= nowMs);

        await supabase
          .from("reminders")
          .update({ remind_at: next, updated_at: new Date().toISOString() })
          .eq("id", reminder.id);
      }

      processed++;
    }

    if (processed > 0) {
      await logAdminOperation(supabase, {
        function_name: "check-reminders",
        operation: "create_notifications",
        target_table: "notifications",
        target_count: processed,
        metadata: { total_due: dueReminders.length },
      });
    }

    return new Response(
      JSON.stringify({ processed, total: dueReminders.length }),
      { status: 200 },
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
