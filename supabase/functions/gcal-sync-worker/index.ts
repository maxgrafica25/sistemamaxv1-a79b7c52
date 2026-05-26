// Edge Function: gcal-sync-worker
// Processa fila gcal_sync_queue. Cron a cada 1min.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isServiceRoleRequest, isCronSecretRequest } from "../_shared/admin-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;

interface TokenRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

async function refreshIfNeeded(admin: any, t: TokenRow): Promise<string> {
  const expiresAt = new Date(t.expires_at).getTime();
  if (expiresAt - Date.now() > 60_000) return t.access_token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: t.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`refresh failed: ${await res.text()}`);
  const data = await res.json();
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await admin.from("user_google_tokens").update({
    access_token: data.access_token,
    expires_at: newExpiresAt,
  }).eq("user_id", t.user_id);
  return data.access_token as string;
}

function recurrenceToRRule(rec: string): string[] | undefined {
  switch (rec) {
    case "daily": return ["RRULE:FREQ=DAILY"];
    case "weekly": return ["RRULE:FREQ=WEEKLY"];
    case "monthly": return ["RRULE:FREQ=MONTHLY"];
    default: return undefined;
  }
}

function buildEventBody(reminder: any): Record<string, unknown> {
  // Usa event_at (compromisso real) quando disponível; fallback para remind_at (lembretes antigos / tarefas avulsas)
  const startSrc = reminder.event_at ?? reminder.remind_at;
  const start = new Date(startSrc);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const body: Record<string, unknown> = {
    summary: reminder.title,
    description: reminder.description || "Criado pela Júlia",
    start: { dateTime: start.toISOString(), timeZone: "America/Sao_Paulo" },
    end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
    reminders: { useDefault: true },
  };
  const rrule = recurrenceToRRule(reminder.recurrence);
  if (rrule) body.recurrence = rrule;
  return body;
}

async function processItem(admin: any, item: any): Promise<void> {
  const { data: tokenRow } = await admin
    .from("user_google_tokens").select("*").eq("user_id", item.user_id).maybeSingle();
  if (!tokenRow) {
    // Usuário desconectou; descarta item.
    await admin.from("gcal_sync_queue").update({
      processed_at: new Date().toISOString(), last_error: "no_token",
    }).eq("id", item.id);
    return;
  }
  const accessToken = await refreshIfNeeded(admin, tokenRow as TokenRow);

  if (item.operation === "delete") {
    const eventId = item.payload?.google_event_id;
    if (eventId) {
      const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!r.ok && r.status !== 404 && r.status !== 410) {
        throw new Error(`delete failed: ${r.status} ${await r.text()}`);
      }
    }
    await admin.from("gcal_sync_queue").update({ processed_at: new Date().toISOString() }).eq("id", item.id);
    return;
  }

  // create / update -> precisa do reminder atual
  const { data: reminder } = await admin
    .from("reminders").select("*").eq("id", item.reminder_id).maybeSingle();
  if (!reminder) {
    await admin.from("gcal_sync_queue").update({
      processed_at: new Date().toISOString(), last_error: "reminder_missing",
    }).eq("id", item.id);
    return;
  }

  const body = buildEventBody(reminder);

  if (item.operation === "update" && reminder.google_event_id) {
    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${reminder.google_event_id}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!r.ok) throw new Error(`update failed: ${r.status} ${await r.text()}`);
    await admin.from("reminders").update({ gcal_synced_at: new Date().toISOString() }).eq("id", reminder.id);
    await admin.from("gcal_sync_queue").update({ processed_at: new Date().toISOString() }).eq("id", item.id);
    return;
  }

  // create (ou update sem event_id existente -> trata como create)
  const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`create failed: ${r.status} ${await r.text()}`);
  const created = await r.json();
  await admin.from("reminders").update({
    google_event_id: created.id,
    gcal_synced_at: new Date().toISOString(),
  }).eq("id", reminder.id);
  await admin.from("gcal_sync_queue").update({ processed_at: new Date().toISOString() }).eq("id", item.id);
}

Deno.serve(async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: items, error } = await admin
    .from("gcal_sync_queue")
    .select("*")
    .is("processed_at", null)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let ok = 0, failed = 0;
  for (const item of items || []) {
    try {
      await processItem(admin, item);
      ok++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[gcal-worker] item failed", item.id, msg);
      await admin.from("gcal_sync_queue").update({
        attempts: (item.attempts || 0) + 1,
        last_error: msg.slice(0, 500),
      }).eq("id", item.id);
    }
  }

  return new Response(JSON.stringify({ processed: ok, failed, total: items?.length || 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
