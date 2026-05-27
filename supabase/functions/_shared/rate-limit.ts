// Shared rate-limit helper for edge functions.
// Calls public.check_rate_limit (SECURITY DEFINER) using service-role client.
// Returns { allowed: boolean }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface RateLimitResult {
  allowed: boolean;
}

let _client: ReturnType<typeof createClient> | null = null;
function getServiceClient() {
  if (_client) return _client;
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/**
 * Best-effort rate limit. On infra error it allows the request (fail-open)
 * to avoid creating self-DoS, but logs the failure to console.
 */
export async function checkRateLimit(
  identifier: string,
  action: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (!identifier) return { allowed: true };
  try {
    const supa = getServiceClient();
    const { data, error } = await supa.rpc("check_rate_limit", {
      p_identifier: identifier,
      p_action: action,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.warn("[rate-limit] rpc error", action, error.message);
      return { allowed: true };
    }
    return { allowed: data === true };
  } catch (e) {
    console.warn("[rate-limit] exception", action, e);
    return { allowed: true };
  }
}

/** Extracts a best-effort client identifier (IP-based) from the request. */
export function clientIdentifier(req: Request, fallback = "anon"): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const ip = fwd.split(",")[0]?.trim();
  return ip || req.headers.get("cf-connecting-ip") || fallback;
}

export function rateLimitResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "Limite de requisições excedido. Tente novamente em alguns instantes.",
    }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
    },
  );
}
