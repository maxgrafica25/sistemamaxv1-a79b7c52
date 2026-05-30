// Etapa 3 — Helpers compartilhados de CORS restrito e sanitização de erros.
//
// CORS:
//   - ALLOWED_ORIGINS (env, csv) restringe o Origin permitido.
//   - Quando ausente, mantém "*" mas registra warning (compat com clientes legados / cron).
//   - Cron/service-role chamadas server-to-server geralmente não enviam Origin — nesse
//     caso devolvemos "*" (não há browser envolvido, não há risco CSRF).
//
// sanitizeError:
//   - Loga sempre o erro original no console (com contexto + requestId opcional).
//   - Devolve ao cliente uma mensagem genérica, sem stack/details/PII.
//   - Usado em catch finais; validação Zod e mensagens de negócio continuam explícitas.

const ALLOWED_ORIGINS_RAW = Deno.env.get("ALLOWED_ORIGINS") ?? "";
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_RAW
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const BASE_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Vary": "Origin",
};

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";

  // Sem allowlist configurada → mantém comportamento atual (compat) com warning.
  if (ALLOWED_ORIGINS.length === 0) {
    if (origin) {
      console.warn("[cors] ALLOWED_ORIGINS não configurado; permitindo *");
    }
    return { ...BASE_HEADERS, "Access-Control-Allow-Origin": "*" };
  }

  // Sem Origin (server-to-server / cron) → libera (não há browser/CSRF).
  if (!origin) {
    return { ...BASE_HEADERS, "Access-Control-Allow-Origin": "*" };
  }

  if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*") || origin.endsWith(".lovableproject.com") || origin.endsWith(".lovable.app")) {
    return { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin };
  }

  // Origin bloqueado — devolve header vazio para o browser barrar.
  console.warn(`[cors] origin bloqueado: ${origin}`);
  return { ...BASE_HEADERS, "Access-Control-Allow-Origin": "null" };
}

export interface SanitizeOptions {
  /** Mensagem genérica devolvida ao cliente (default: "Erro interno"). */
  publicMessage?: string;
  /** Identificador de requisição p/ correlacionar com logs (opcional). */
  requestId?: string;
}

/**
 * Loga o erro completo no servidor e devolve um payload seguro ao cliente.
 * Nunca expõe stack, código Postgres, mensagens de RLS, paths ou env.
 */
export function sanitizeError(
  err: unknown,
  context: string,
  opts: SanitizeOptions = {},
): { error: string; request_id?: string } {
  const requestId = opts.requestId ?? crypto.randomUUID().slice(0, 8);
  const raw = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[${context}] [${requestId}]`, raw, stack ? `\n${stack}` : "");
  return {
    error: opts.publicMessage ?? "Erro interno ao processar a requisição",
    request_id: requestId,
  };
}

/**
 * Valida o header Origin contra ALLOWED_ORIGINS.
 * - Sem Origin (server-to-server / cron) → passa (retorna null).
 * - ALLOWED_ORIGINS vazio → modo compat, passa (retorna null) com warning.
 * - Origin presente e não listado → retorna Response 403 pronta.
 * - Origin listado (ou allowlist contém "*") → passa (retorna null).
 *
 * Uso típico no início do handler (após OPTIONS):
 *   const blocked = validateOrigin(req, corsHeaders);
 *   if (blocked) return blocked;
 */
export function validateOrigin(
  req: Request,
  corsHeaders: Record<string, string>,
): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  if (ALLOWED_ORIGINS.length === 0) return null;
  if (ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".lovableproject.com") || origin.endsWith(".lovable.app")) return null;
  console.warn(`[validateOrigin] origem bloqueada: ${origin}`);
  return new Response(
    JSON.stringify({ error: "Origem não permitida" }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
