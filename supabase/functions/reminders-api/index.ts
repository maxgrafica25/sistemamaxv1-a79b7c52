// Edge Function: reminders-api
// CRUD de lembretes do usuário autenticado. Reutiliza tabela `reminders` existente.
// JWT validado em código; RLS da tabela garante isolamento por user_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CreateSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(2000).optional().nullable(),
  remind_at: z.string().datetime({ offset: true }),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional().default("none"),
  category: z.string().max(50).optional().default("assistente"),
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Não autorizado" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Token inválido" }, 401);
    }
    const userId = userData.user.id;

    const url = new URL(req.url);

    // POST: criar lembrete
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const parsed = CreateSchema.safeParse(body);
      if (!parsed.success) {
        return jsonResponse(
          { error: "Dados inválidos", details: parsed.error.flatten() },
          400,
        );
      }
      const { title, description, remind_at, recurrence, category } = parsed.data;

      const remindDate = new Date(remind_at);
      if (isNaN(remindDate.getTime()) || remindDate.getTime() <= Date.now()) {
        return jsonResponse({ error: "remind_at deve ser uma data/hora no futuro" }, 400);
      }

      const { data, error } = await userClient
        .from("reminders")
        .insert({
          user_id: userId,
          title,
          description: description ?? null,
          remind_at,
          recurrence: recurrence ?? "none",
          category: category ?? "assistente",
        })
        .select()
        .single();

      if (error) {
        console.error("[reminders-api] insert error:", error);
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse({ reminder: data }, 201);
    }

    // GET: listar
    if (req.method === "GET") {
      const includeCompleted = url.searchParams.get("include_completed") === "1";
      let q = userClient
        .from("reminders")
        .select("id,title,description,remind_at,recurrence,category,is_completed,created_at")
        .eq("user_id", userId)
        .order("remind_at", { ascending: true })
        .limit(100);
      if (!includeCompleted) q = q.eq("is_completed", false);
      const { data, error } = await q;
      if (error) {
        console.error("[reminders-api] list error:", error);
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse({ reminders: data ?? [] }, 200);
    }

    // DELETE: remover por id (?id=<uuid>)
    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) return jsonResponse({ error: "id é obrigatório" }, 400);
      const { error } = await userClient
        .from("reminders")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);
      if (error) {
        console.error("[reminders-api] delete error:", error);
        return jsonResponse({ error: error.message }, 500);
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return jsonResponse({ error: "Método não suportado" }, 405);
  } catch (e) {
    console.error("[reminders-api] error:", e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : "Erro desconhecido" },
      500,
    );
  }
});
