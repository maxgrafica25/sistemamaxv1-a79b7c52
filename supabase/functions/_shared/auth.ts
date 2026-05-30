import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Obtém o empresa_id do perfil do usuário autenticado.
 * Essencial para garantir isolamento em Edge Functions que usam service_role.
 */
export async function getUserEmpresaId(authHeader: string): Promise<string | null> {
  try {
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    
    if (userError || !user) return null;

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) return null;

    return profile.empresa_id;
  } catch (err) {
    console.error("[auth] Erro ao obter empresa_id:", err);
    return null;
  }
}
