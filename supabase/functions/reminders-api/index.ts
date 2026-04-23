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
  event_at: z.string().datetime({ offset: true }).optional().nullable(),
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

    // GET /conflicts: detectar lembretes próximos a um horário proposto
    if (req.method === "GET" && url.pathname.endsWith("/conflicts")) {
      const remindAtParam = url.searchParams.get("remind_at");
      const windowParam = url.searchParams.get("window_minutes");
      const excludeId = url.searchParams.get("exclude_id");

      const ConflictSchema = z.object({
        remind_at: z.string().datetime({ offset: true }),
        window_minutes: z.number().int().min(0).max(1440).default(15),
      });
      const parsed = ConflictSchema.safeParse({
        remind_at: remindAtParam,
        window_minutes: windowParam ? Number(windowParam) : 15,
      });
      if (!parsed.success) {
        return jsonResponse(
          { error: "Parâmetros inválidos", details: parsed.error.flatten() },
          400,
        );
      }
      const center = new Date(parsed.data.remind_at).getTime();
      const windowMs = parsed.data.window_minutes * 60_000;
      const startIso = new Date(center - windowMs).toISOString();
      const endIso = new Date(center + windowMs).toISOString();

      let q = userClient
        .from("reminders")
        .select("id,title,remind_at,event_at,recurrence,description")
        .eq("user_id", userId)
        .eq("is_completed", false)
        .is("cancelled_at", null)
        .gte("event_at", startIso)
        .lte("event_at", endIso)
        .order("event_at", { ascending: true })
        .limit(20);
      if (excludeId) q = q.neq("id", excludeId);

      const { data, error } = await q;
      if (error) {
        console.error("[reminders-api] conflicts error:", error);
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse({ conflicts: data ?? [] }, 200);
    }

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
      const { title, description, remind_at, event_at, recurrence, category } = parsed.data;

      const remindDate = new Date(remind_at);
      if (isNaN(remindDate.getTime()) || remindDate.getTime() <= Date.now()) {
        return jsonResponse({ error: "remind_at deve ser uma data/hora no futuro" }, 400);
      }
      // event_at default = remind_at; se vier, deve ser >= remind_at
      const finalEventAt = event_at ?? remind_at;
      if (event_at) {
        const eventDate = new Date(event_at);
        if (isNaN(eventDate.getTime())) {
          return jsonResponse({ error: "event_at inválido" }, 400);
        }
        if (eventDate.getTime() < remindDate.getTime()) {
          return jsonResponse(
            { error: "event_at deve ser igual ou posterior a remind_at (avise antes do evento)." },
            400,
          );
        }
      }

      const { data, error } = await userClient
        .from("reminders")
        .insert({
          user_id: userId,
          title,
          description: description ?? null,
          remind_at,
          event_at: finalEventAt,
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
      const includeCancelled = url.searchParams.get("include_cancelled") === "1";
      const fromParam = url.searchParams.get("from");
      const toParam = url.searchParams.get("to");

      let q = userClient
        .from("reminders")
        .select(
          "id,title,description,remind_at,event_at,recurrence,category,is_completed,cancelled_at,cancelled_reason,created_at",
        )
        .eq("user_id", userId)
        .order("remind_at", { ascending: true })
        .limit(200);
      if (!includeCompleted) q = q.eq("is_completed", false);
      if (!includeCancelled) q = q.is("cancelled_at", null);
      if (fromParam) q = q.gte("remind_at", fromParam);
      if (toParam) q = q.lte("remind_at", toParam);

      const { data, error } = await q;
      if (error) {
        console.error("[reminders-api] list error:", error);
        return jsonResponse({ error: error.message }, 500);
      }
      return jsonResponse({ reminders: data ?? [] }, 200);
    }

    // DELETE: soft-delete por id (?id=<uuid>) — marca cancelled_at em vez de apagar
    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      const UuidSchema = z.string().uuid();
      const idParsed = UuidSchema.safeParse(id);
      if (!idParsed.success) {
        return jsonResponse({ error: "id inválido (UUID esperado)" }, 400);
      }
      const { data: cancelled, error } = await userClient
        .from("reminders")
        .update({
          cancelled_at: new Date().toISOString(),
          cancelled_reason: "user_cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", idParsed.data)
        .eq("user_id", userId)
        .is("cancelled_at", null)
        .select("id")
        .maybeSingle();
      if (error) {
        console.error("[reminders-api] cancel error:", error, "id:", idParsed.data);
        return jsonResponse({ error: error.message }, 500);
      }
      if (!cancelled) {
        console.warn("[reminders-api] cancel not found / already cancelled id:", idParsed.data);
        return jsonResponse(
          { error: "Lembrete não encontrado", id: idParsed.data },
          404,
        );
      }
      return jsonResponse({ ok: true, deleted_id: cancelled.id }, 200);
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
