// Edge function: convite de novo usuário (apenas admins)
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { checkRateLimit, clientIdentifier, rateLimitResponse } from "../_shared/rate-limit.ts";
import { validateOrigin } from "../_shared/errorHandler.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  email: z.string().trim().email().max(255),
  display_name: z.string().trim().min(2).max(100),
  role: z.enum(["admin", "colaborador"]),
  redirect_to: z.string().url().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const originBlock = validateOrigin(req, corsHeaders);
  if (originBlock) return originBlock;

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1) Cliente "como o usuário" para descobrir quem chamou
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Rate limit: 10 convites por hora por admin (e 20 por IP)
    const rlUser = await checkRateLimit(`user:${userData.user.id}`, "invite_user", 10, 3600);
    if (!rlUser.allowed) return rateLimitResponse(corsHeaders);
    const rlIp = await checkRateLimit(`ip:${clientIdentifier(req)}`, "invite_user_ip", 20, 3600);
    if (!rlIp.allowed) return rateLimitResponse(corsHeaders);

    // 2) Verifica se é admin
    const { data: isAdmin, error: roleErr } = await userClient.rpc("is_profile_admin", {
      _user_id: userData.user.id,
    });
    if (roleErr || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Acesso restrito a administradores" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3) Valida payload
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { email, display_name, role, redirect_to } = parsed.data;

    // 4) Cliente admin (service role)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 5) Envia convite (Supabase cria o usuário em auth.users e dispara o email)
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { display_name },
      redirectTo: redirect_to,
    });

    if (inviteErr || !invited?.user) {
      const msg = inviteErr?.message ?? "Falha ao enviar convite";
      const status = msg.toLowerCase().includes("already") ? 409 : 400;
      return new Response(
        JSON.stringify({ error: msg }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const newUserId = invited.user.id;

    // 6) Atualiza profile (o trigger handle_new_user já criou a linha)
    // Pequeno retry caso o trigger ainda não tenha rodado
    let updated = false;
    for (let i = 0; i < 5 && !updated; i++) {
      const { error: upErr, count } = await admin
        .from("profiles")
        .update({ display_name, role, is_active: true }, { count: "exact" })
        .eq("user_id", newUserId);
      if (!upErr && (count ?? 0) > 0) {
        updated = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    if (!updated) {
      // Fallback: insere
      await admin.from("profiles").insert({
        user_id: newUserId,
        display_name,
        role,
        is_active: true,
      });
    }

    // 7) Auditoria
    await admin.from("audit_logs").insert({
      action: "invite_user",
      entity_type: "profile",
      entity_id: newUserId,
      entity_name: display_name,
      details: `Convite enviado para ${email} com perfil "${role}" por ${userData.user.email}`,
    });

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message ?? "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
