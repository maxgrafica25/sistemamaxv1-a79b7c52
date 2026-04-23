// Edge Function: google-oauth-callback
// Recebe code+state do Google, troca por tokens e salva em user_google_tokens.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;
const REDIRECT_URI = Deno.env.get("GOOGLE_OAUTH_REDIRECT_URI")!;
const STATE_SECRET = Deno.env.get("GOOGLE_OAUTH_STATE_SECRET")!;

async function verifyState(state: string): Promise<{ user_id: string } | null> {
  const [data, sig] = state.split(".");
  if (!data || !sig) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(STATE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigBytes = Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(data));
  if (!ok) return null;
  try {
    return JSON.parse(atob(data));
  } catch {
    return null;
  }
}

function originFromRedirect(): string {
  // Tenta derivar a origem do app a partir do referer; fallback p/ raiz publicada.
  return "https://id-preview--667f8a1f-61e4-4274-8da0-fdacd8d61791.lovable.app";
}

function redirectTo(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  const errorParam = u.searchParams.get("error");
  const appOrigin = req.headers.get("referer")?.split("/").slice(0, 3).join("/") || originFromRedirect();

  if (errorParam) {
    return redirectTo(`${appOrigin}/configuracoes?gcal=error&reason=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state) {
    return redirectTo(`${appOrigin}/configuracoes?gcal=error&reason=missing_params`);
  }
  const verified = await verifyState(state);
  if (!verified?.user_id) {
    return redirectTo(`${appOrigin}/configuracoes?gcal=error&reason=invalid_state`);
  }

  // Trocar code por tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    console.error("[gcal-callback] token exchange failed", t);
    return redirectTo(`${appOrigin}/configuracoes?gcal=error&reason=token_exchange`);
  }
  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };

  // Buscar email do usuário Google
  let email = "";
  try {
    const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (ui.ok) {
      const data = await ui.json();
      email = data.email || "";
    }
  } catch (_) { /* ignore */ }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Refresh token só vem na 1ª autorização. Se não vier, preserve o existente.
  const upsertPayload: Record<string, unknown> = {
    user_id: verified.user_id,
    access_token: tokens.access_token,
    expires_at: expiresAt,
    scope: tokens.scope,
    email_google: email || null,
  };
  if (tokens.refresh_token) {
    upsertPayload.refresh_token = tokens.refresh_token;
  } else {
    const { data: existing } = await supabase
      .from("user_google_tokens").select("refresh_token").eq("user_id", verified.user_id).maybeSingle();
    if (!existing?.refresh_token) {
      return redirectTo(`${appOrigin}/configuracoes?gcal=error&reason=no_refresh_token`);
    }
    upsertPayload.refresh_token = existing.refresh_token;
  }

  const { error } = await supabase
    .from("user_google_tokens")
    .upsert(upsertPayload, { onConflict: "user_id" });
  if (error) {
    console.error("[gcal-callback] upsert error", error);
    return redirectTo(`${appOrigin}/configuracoes?gcal=error&reason=db`);
  }

  return redirectTo(`${appOrigin}/configuracoes?gcal=ok`);
});
