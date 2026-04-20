// Wrapper auditado para criação de clientes Supabase com SERVICE_ROLE_KEY.
// Toda função que precisa de privilégios elevados (bypass de RLS) deve usar este módulo
// em vez de criar o cliente diretamente. Isso garante:
//   1) Log estruturado de cada criação (rastreável em Cloud → Edge Functions logs).
//   2) Registro opcional na tabela admin_operations_log para forensics.
//
// Por que existe: a SERVICE_ROLE_KEY bypassa todas as RLS policies. Se vazar, todo o
// banco fica exposto. Centralizar o uso reduz a superfície e permite detectar abuso.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export interface AdminClientContext {
  /** Nome da edge function chamadora (ex: "scrape-prices"). */
  fnName: string;
  /** Justificativa em uma frase do porquê precisa de service role. */
  reason: string;
}

/**
 * Cria um cliente Supabase com SERVICE_ROLE_KEY (bypass RLS).
 * Loga a criação em formato JSON estruturado (filtrável nos logs do Cloud).
 */
export function getAdminClient(ctx: AdminClientContext): SupabaseClient {
  console.log(JSON.stringify({
    type: "admin_client_created",
    fn: ctx.fnName,
    reason: ctx.reason,
    timestamp: new Date().toISOString(),
  }));
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface AdminOperationLog {
  function_name: string;
  operation: string;
  target_table?: string;
  target_count?: number;
  invoked_by?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Registra uma operação privilegiada na tabela admin_operations_log.
 * Falha silenciosamente (apenas loga) — auditoria nunca deve quebrar a operação principal.
 */
export async function logAdminOperation(
  client: SupabaseClient,
  entry: AdminOperationLog,
): Promise<void> {
  try {
    const { error } = await client.from("admin_operations_log").insert({
      function_name: entry.function_name,
      operation: entry.operation,
      target_table: entry.target_table ?? null,
      target_count: entry.target_count ?? 0,
      invoked_by: entry.invoked_by ?? null,
      metadata: entry.metadata ?? {},
    });
    if (error) {
      console.error("[admin-client] logAdminOperation failed:", error.message);
    }
  } catch (e) {
    console.error("[admin-client] logAdminOperation threw:", e);
  }
}
