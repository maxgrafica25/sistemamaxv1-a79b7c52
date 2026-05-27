// Detecta anomalias de volume nas operações privilegiadas registradas em
// admin_operations_log. Cria notificação para todos os admins se uma função
// registrar volume ≥3x acima da baseline (média móvel das últimas 24h).
//
// SERVICE ROLE: necessária — lê tabela auditada (RLS admin-only) e cria
// notifications para múltiplos usuários (bypass user_id = auth.uid()).
import { getAdminClient, isServiceRoleRequest, isCronSecretRequest } from "../_shared/admin-client.ts";

import { corsHeadersFor, sanitizeError, validateOrigin } from "../_shared/errorHandler.ts";

const ANOMALY_MULTIPLIER = 3;
const RECENT_WINDOW_MIN = 60;       // janela "atual" = última hora
const BASELINE_WINDOW_HOURS = 24;   // baseline = últimas 24h

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const originBlock = validateOrigin(req, corsHeaders);
  if (originBlock) return originBlock;
  if (!isServiceRoleRequest(req) && !isCronSecretRequest(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  const supabase = getAdminClient({
    fnName: "monitor-admin-usage",
    reason: "Cron 15min: detectar picos anômalos em admin_operations_log e alertar admins",
  });

  const now = new Date();
  const recentSince = new Date(now.getTime() - RECENT_WINDOW_MIN * 60 * 1000).toISOString();
  const baselineSince = new Date(now.getTime() - BASELINE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  // Volume por função na última hora
  const { data: recent, error: recentErr } = await supabase
    .from("admin_operations_log")
    .select("function_name, target_count")
    .gte("created_at", recentSince);

  if (recentErr) {
    return new Response(JSON.stringify(sanitizeError(recentErr, "monitor-admin-usage/recent")), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Baseline 24h
  const { data: baseline, error: baseErr } = await supabase
    .from("admin_operations_log")
    .select("function_name, target_count, created_at")
    .gte("created_at", baselineSince);

  if (baseErr) {
    return new Response(JSON.stringify(sanitizeError(baseErr, "monitor-admin-usage/baseline")), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Agrega por função
  const recentByFn = new Map<string, number>();
  for (const r of recent ?? []) {
    recentByFn.set(r.function_name, (recentByFn.get(r.function_name) ?? 0) + (r.target_count ?? 0));
  }

  const baselineByFn = new Map<string, number>();
  for (const r of baseline ?? []) {
    baselineByFn.set(r.function_name, (baselineByFn.get(r.function_name) ?? 0) + (r.target_count ?? 0));
  }

  // Para cada função: baseline_per_hour = total_24h / 24
  const anomalies: { fn: string; recent: number; baseline_per_hour: number; ratio: number }[] = [];
  for (const [fn, recentCount] of recentByFn) {
    const baselinePerHour = (baselineByFn.get(fn) ?? 0) / BASELINE_WINDOW_HOURS;
    if (baselinePerHour < 1) continue; // baseline insuficiente — ignora
    const ratio = recentCount / baselinePerHour;
    if (ratio >= ANOMALY_MULTIPLIER) {
      anomalies.push({ fn, recent: recentCount, baseline_per_hour: Math.round(baselinePerHour * 10) / 10, ratio: Math.round(ratio * 10) / 10 });
    }
  }

  if (anomalies.length === 0) {
    return new Response(JSON.stringify({ ok: true, anomalies: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Buscar admins
  const { data: admins } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("role", "admin");

  // Evitar duplicar alerta para a mesma anomalia em janelas próximas
  const lastHour = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("type", "security_alert")
    .gte("created_at", lastHour)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log("[monitor-admin-usage] anomalia detectada mas alerta recente já enviado — pulando");
    return new Response(JSON.stringify({ ok: true, anomalies: anomalies.length, suppressed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const summary = anomalies
    .map(a => `${a.fn}: ${a.recent} ops na última hora (baseline ~${a.baseline_per_hour}/h, ${a.ratio}x acima)`)
    .join(" | ");

  for (const admin of admins ?? []) {
    await supabase.from("notifications").insert({
      user_id: admin.user_id,
      title: "⚠️ Anomalia detectada em operações privilegiadas",
      message: `Volume anormal de operações com chave de serviço: ${summary}. Verifique admin_operations_log e considere o procedimento de incident response.`,
      type: "security_alert",
      source_type: "monitor-admin-usage",
    });
  }

  console.log(`[monitor-admin-usage] alertas enviados a ${admins?.length ?? 0} admins`, anomalies);

  return new Response(JSON.stringify({ ok: true, anomalies, alerted_admins: admins?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
