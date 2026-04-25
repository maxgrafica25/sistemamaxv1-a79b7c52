// Edge Function: check-overdue-readings
// Verifica equipamentos com leituras atrasadas e dispara avisos no chat + inbox.
// Acionada por cron diário (Seg–Sex 09:00 BRT) e também manualmente para testes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REMINDER_THRESHOLD = 2; // dias úteis
const CRITICAL_THRESHOLD = 5; // dias úteis
const ALERT_CHANNEL_NAME = "alertas-equipamentos";

interface OverdueGap {
  equipmentId: string;
  equipmentName: string;
  printerType: string;
  lastDate: string; // YYYY-MM-DD
  daysOverdue: number;
  lastOperator: string | null;
  severity: "reminder" | "critical";
}

// ─── Util: dias úteis entre duas datas (exclusive lastDate, inclusive today) ──
function businessDaysBetween(lastDateStr: string, today: Date): number {
  const last = new Date(lastDateStr + "T00:00:00Z");
  let count = 0;
  const cursor = new Date(last);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= today) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

// ─── Detector reaproveitável (Júlia poderá chamar no futuro) ──────────────────
export async function detectOverdueReadings(supabase: any): Promise<OverdueGap[]> {
  const today = new Date();
  // Trabalha em UTC; comparação é por data, não horário.

  const { data: equipments, error: eqErr } = await supabase
    .from("equipments")
    .select("id, name, printer_type")
    .in("printer_type", ["pb", "color"]);
  if (eqErr) throw eqErr;
  if (!equipments?.length) return [];

  const gaps: OverdueGap[] = [];

  for (const eq of equipments) {
    const { data: lastReading } = await supabase
      .from("printer_readings")
      .select("date, operator_name")
      .eq("equipment_id", eq.id)
      .eq("type", "daily")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Equipamentos sem nenhuma leitura são ignorados (regra acordada).
    if (!lastReading) continue;

    const days = businessDaysBetween(lastReading.date, today);
    if (days < REMINDER_THRESHOLD) continue;

    gaps.push({
      equipmentId: eq.id,
      equipmentName: eq.name,
      printerType: eq.printer_type,
      lastDate: lastReading.date,
      daysOverdue: days,
      lastOperator: lastReading.operator_name,
      severity: days >= CRITICAL_THRESHOLD ? "critical" : "reminder",
    });
  }

  return gaps;
}

// ─── Builder de mensagem (Júlia poderá customizar no futuro) ─────────────────
export function buildChatMessage(gaps: OverdueGap[]): { title: string; body: string } {
  const critical = gaps.filter((g) => g.severity === "critical");
  const reminders = gaps.filter((g) => g.severity === "reminder");

  const hasCritical = critical.length > 0;

  const title = hasCritical
    ? "🚨 ALERTA CRÍTICO — Leituras em atraso grave"
    : "📋 Lembrete de leituras pendentes";

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(`_Olá! Aqui é a Júlia. Encontrei ${gaps.length === 1 ? "1 equipamento" : `${gaps.length} equipamentos`} sem leitura diária:_`);
  lines.push("");

  if (critical.length) {
    lines.push("## 🔴 🚨 CRÍTICO — Esquecimento crônico");
    lines.push("> Estes equipamentos estão **mais de 1 semana** sem leitura. Precisam ser regularizados **HOJE**.");
    lines.push("");
    for (const g of critical) {
      lines.push(`- 😡 **${g.equipmentName}** — última leitura em ${formatDateBR(g.lastDate)} · **${g.daysOverdue} dias úteis de atraso**${g.lastOperator ? ` · último operador: _${g.lastOperator}_` : ""}`);
      lines.push(`  👉 [**Lançar Leitura Agora**](/equipamentos?tab=leituras&quick=${g.equipmentId})`);
    }
    lines.push("");
  }

  if (reminders.length) {
    lines.push("## 🟡 Lembretes");
    lines.push("");
    for (const g of reminders) {
      lines.push(`- **${g.equipmentName}** — última leitura em ${formatDateBR(g.lastDate)} · ${g.daysOverdue} dias úteis sem registro${g.lastOperator ? ` · último operador: _${g.lastOperator}_` : ""}`);
      lines.push(`  👉 [Lançar Leitura Agora](/equipamentos?tab=leituras&quick=${g.equipmentId})`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("_Este aviso será enviado todos os dias úteis até a regularização._ 💛");

  return { title, body: lines.join("\n") };
}

function formatDateBR(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Notificador (Júlia poderá reaproveitar) ──────────────────────────────────
export async function notifyOverdueReadings(supabase: any, gaps: OverdueGap[]) {
  if (!gaps.length) return { posted: 0, notifications: 0, alertsRecorded: 0 };

  const today = new Date().toISOString().slice(0, 10);

  // 1. Filtra gaps que ainda não foram alertados HOJE (idempotência)
  const fresh: OverdueGap[] = [];
  for (const g of gaps) {
    const { data: existing } = await supabase
      .from("reading_alerts_sent")
      .select("id")
      .eq("equipment_id", g.equipmentId)
      .eq("gap_start_date", g.lastDate)
      .eq("alerted_on", today)
      .limit(1)
      .maybeSingle();
    if (!existing) fresh.push(g);
  }

  if (!fresh.length) return { posted: 0, notifications: 0, alertsRecorded: 0, skipped: gaps.length };

  // 2. Verifica se já existe algum alerta crítico no histórico (para marcar o "primeiro")
  const { data: anyCritical } = await supabase
    .from("reading_alerts_sent")
    .select("id")
    .eq("severity", "critical")
    .limit(1)
    .maybeSingle();
  const noCriticalYet = !anyCritical;

  // 3. Posta no chat
  const { data: channel } = await supabase
    .from("channels")
    .select("id")
    .eq("name", ALERT_CHANNEL_NAME)
    .maybeSingle();

  let posted = 0;
  if (channel) {
    // Autor: primeiro admin (perfis reais via FK não permitem usuário "fantasma")
    const { data: authorProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("role", "admin")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (authorProfile) {
      const { body } = buildChatMessage(fresh);
      const { error: msgErr } = await supabase.from("messages").insert({
        channel_id: channel.id,
        user_id: authorProfile.user_id,
        content: body,
      });
      if (!msgErr) posted = 1;
      else console.error("[check-overdue-readings] message insert error:", msgErr);
    }
  }

  // 4. Inbox: notifica admins + alert_recipients ativos
  const { data: admins } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("role", "admin");
  const { data: extras } = await supabase
    .from("alert_recipients")
    .select("user_id, notify_inbox")
    .eq("active", true)
    .eq("notify_inbox", true);

  const recipients = new Set<string>();
  (admins || []).forEach((p: any) => p.user_id && recipients.add(p.user_id));
  (extras || []).forEach((r: any) => r.user_id && recipients.add(r.user_id));

  const hasCritical = fresh.some((g) => g.severity === "critical");
  const totalDays = Math.max(...fresh.map((g) => g.daysOverdue));
  const summary = hasCritical
    ? `🚨 ${fresh.length} equipamento(s) em atraso CRÍTICO (até ${totalDays} dias úteis sem leitura).`
    : `📋 ${fresh.length} equipamento(s) com leituras pendentes (até ${totalDays} dias úteis).`;

  let notifications = 0;
  for (const userId of recipients) {
    // Notificação por equipamento (link individual). Se forem muitos, agrupamos.
    if (fresh.length === 1) {
      const g = fresh[0];
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        title: g.severity === "critical" ? `🚨 ${g.equipmentName} — atraso crítico` : `📋 ${g.equipmentName} — leitura pendente`,
        message: `${g.daysOverdue} dias úteis sem leitura. Último operador: ${g.lastOperator ?? "—"}.`,
        type: g.severity === "critical" ? "warning" : "info",
        source_type: "overdue_reading",
        source_id: g.equipmentId,
      });
      if (!error) notifications++;
    } else {
      // Uma notificação consolidada apontando para o equipamento mais crítico
      const top = fresh.sort((a, b) => b.daysOverdue - a.daysOverdue)[0];
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        title: hasCritical ? "🚨 Leituras em atraso crítico" : "📋 Leituras pendentes",
        message: summary + ` Veja a lista completa no canal #${ALERT_CHANNEL_NAME}.`,
        type: hasCritical ? "warning" : "info",
        source_type: "overdue_reading",
        source_id: top.equipmentId,
      });
      if (!error) notifications++;
    }
  }

  // 5. Registra os disparos em reading_alerts_sent
  let alertsRecorded = 0;
  let firstCriticalUsed = false;
  for (const g of fresh) {
    const isFirst =
      g.severity === "critical" && noCriticalYet && !firstCriticalUsed;
    if (isFirst) firstCriticalUsed = true;

    // Chat
    if (posted) {
      const { error } = await supabase.from("reading_alerts_sent").insert({
        equipment_id: g.equipmentId,
        gap_start_date: g.lastDate,
        days_overdue: g.daysOverdue,
        severity: g.severity,
        is_first_critical: isFirst,
        channel: "chat",
      });
      if (!error) alertsRecorded++;
      else console.warn("[check-overdue-readings] alert chat insert error:", error.message);
    }
    // Inbox
    if (notifications > 0) {
      const { error } = await supabase.from("reading_alerts_sent").insert({
        equipment_id: g.equipmentId,
        gap_start_date: g.lastDate,
        days_overdue: g.daysOverdue,
        severity: g.severity,
        is_first_critical: false, // apenas o do chat carrega a flag
        channel: "inbox",
      });
      if (!error) alertsRecorded++;
      else console.warn("[check-overdue-readings] alert inbox insert error:", error.message);
    }
  }

  return { posted, notifications, alertsRecorded, fresh: fresh.length, total: gaps.length };
}

// ─── Handler principal ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const gaps = await detectOverdueReadings(supabase);
    console.log(`[check-overdue-readings] detected ${gaps.length} gap(s):`,
      gaps.map((g) => `${g.equipmentName}(${g.daysOverdue}d/${g.severity})`).join(", "));

    const result = await notifyOverdueReadings(supabase, gaps);

    return new Response(
      JSON.stringify({ ok: true, gaps: gaps.length, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("[check-overdue-readings] error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message ?? err) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
