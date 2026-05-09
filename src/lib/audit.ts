// Centraliza gravação de logs de auditoria.
//
// Estratégia de migração (Fase 1 / item 02):
//   - Tenta primeiro a RPC `log_audit_event` / `log_auth_event` (que existirá
//     após aplicar 02_audit_logs_lockdown.sql em staging/prod).
//   - Se a RPC não existir ainda (PGRST202 / 404), faz fallback para INSERT
//     direto na tabela. Isso permite shipar este código ANTES da migration,
//     sem quebrar logging.
//   - Após a migration aplicada em prod, o INSERT direto começará a falhar
//     com RLS — e o caminho RPC já estará funcionando.
import { supabase } from "@/integrations/supabase/client";

interface AuditEntry {
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  details?: string;
}

/** True se o erro indica que a função RPC não existe (ainda) no banco. */
function isRpcMissing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "PGRST202") return true;
  return /(could not find function|function .* does not exist)/i.test(err.message ?? "");
}

export async function logAudit(entry: AuditEntry) {
  try {
    const { error } = await supabase.rpc("log_audit_event", {
      p_action: entry.action,
      p_entity_type: entry.entity_type,
      p_entity_id: entry.entity_id ?? null,
      p_entity_name: entry.entity_name ?? null,
      p_details: entry.details ?? null,
    });
    if (!error) return;

    if (isRpcMissing(error)) {
      // Fallback durante a janela de migração
      await supabase.from("audit_logs").insert(entry);
      return;
    }
    console.error("[logAudit] rpc error:", error);
  } catch (e) {
    console.error("[logAudit] exception:", e);
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
 * auditoria. Funciona mesmo sem usuário autenticado.
 *
 * Pós-migração: usa RPC `log_auth_event` (SECURITY DEFINER, valida prefixo
 * `password_reset_*`). Pré-migração: INSERT direto via policy `anon`.
 */
export async function logAuthEvent(
  action:
    | "password_reset_requested"
    | "password_reset_succeeded"
    | "password_reset_failed_token_invalid"
    | "password_reset_failed_token_expired",
  options: { email?: string; details?: Record<string, unknown> } = {},
) {
  const entityName = options.email ? maskEmail(options.email) : null;
  const details = JSON.stringify({
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    timestamp: new Date().toISOString(),
    ...(options.details ?? {}),
  });

  try {
    const { error } = await supabase.rpc("log_auth_event", {
      p_action: action,
      p_entity_name: entityName,
      p_details: details,
    });
    if (!error) return;

    if (isRpcMissing(error)) {
      await supabase.from("audit_logs").insert({
        action,
        entity_type: "auth",
        entity_name: entityName ?? undefined,
        details,
      });
      return;
    }
    console.error("[logAuthEvent] rpc error:", action, error);
  } catch (e) {
    console.error("[logAuthEvent] exception:", action, e);
  }
}
