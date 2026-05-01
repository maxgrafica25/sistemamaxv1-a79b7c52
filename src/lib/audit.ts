// Centraliza gravação de logs de auditoria.
import { supabase } from "@/integrations/supabase/client";

interface AuditEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  details?: string;
}

export async function logAudit(entry: AuditEntry) {
  try {
    await supabase.from("audit_logs").insert(entry);
  } catch (e) {
    console.error("Audit log error:", e);
  }
}

/** Mascara um e-mail para registro em audit (ex.: jo***@gmail.com). */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "(invalid)";
  const [user, domain] = email.split("@");
  if (user.length <= 2) return `${user[0] ?? "?"}***@${domain}`;
  return `${user.slice(0, 2)}***@${domain}`;
}

/**
 * Registra um evento de autenticação (recuperação de senha) na trilha de
 * auditoria. Funciona mesmo sem usuário autenticado — a policy permite
 * INSERT anônimo apenas para `entity_type='auth'` + `action LIKE 'password_reset_%'`.
 *
 * Nunca falha silenciosamente para o usuário; só loga no console em caso de erro.
 */
export async function logAuthEvent(
  action:
    | "password_reset_requested"
    | "password_reset_succeeded"
    | "password_reset_failed_token_invalid"
    | "password_reset_failed_token_expired",
  options: { email?: string; details?: Record<string, unknown> } = {},
) {
  const payload = {
    action,
    entity_type: "auth",
    entity_name: options.email ? maskEmail(options.email) : undefined,
    details: JSON.stringify({
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      timestamp: new Date().toISOString(),
      ...(options.details ?? {}),
    }),
  };
  try {
    await supabase.from("audit_logs").insert(payload);
  } catch (e) {
    console.error("[logAuthEvent]", action, e);
  }
}
