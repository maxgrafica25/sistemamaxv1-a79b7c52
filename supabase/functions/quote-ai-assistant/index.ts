// Edge Function: quote-ai-assistant
// Recebe snapshot do orçamento + catálogo resumido e devolve até 3 sugestões objetivas
// em JSON. Usa Gemini direto (mesma API key da Júlia / assistente-virtual).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY")!;
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const ItemSchema = z.object({
  material_id: z.string().nullable().optional(),
  material_nome: z.string().nullable().optional(),
  tipo_midia: z.string().nullable().optional(),
  largura_cm: z.number().nullable().optional(),
  altura_cm: z.number().nullable().optional(),
  quantidade: z.number().nullable().optional(),
  area_m2: z.number().nullable().optional(),
  acabamentos: z.array(z.string()).default([]),
});

const BodySchema = z.object({
  client_name: z.string().nullable().optional(),
  client_tags: z.array(z.string()).default([]),
  items: z.array(ItemSchema).max(50),
  checklist_answers: z
    .array(z.object({ pergunta: z.string(), resposta: z.string() }))
    .max(40)
    .default([]),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = parsed.data;
    if (body.items.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const [acab, perguntas] = await Promise.all([
      admin.from("cv_calc_acabamentos").select("id, nome, familia").eq("is_active", true).limit(80),
      admin.from("quote_checklist_questions").select("id, pergunta, tipo_resposta").eq("ativo", true).limit(60),
    ]);

    const catalog = {
      acabamentos: (acab.data ?? []).map((a: any) => ({ id: a.id, nome: a.nome, familia: a.familia })),
      perguntas: (perguntas.data ?? []).map((q: any) => ({ id: q.id, pergunta: q.pergunta })),
    };

    const systemPrompt = `Você é um assistente de orçamento de comunicação visual de uma gráfica brasileira. Seu papel é APONTAR riscos e itens potencialmente esquecidos pelo orçamentista — nunca inventar produtos. Responda SEMPRE em JSON puro (sem markdown, sem texto fora do JSON), no formato:

{"suggestions":[{"tipo":"acabamento|pergunta|alerta","alvo_id":"<uuid ou null>","mensagem":"texto curto pt-BR","justificativa":"motivo objetivo em 1 linha"}]}

Regras:
- Máximo 3 sugestões, priorize as mais úteis.
- Só use "alvo_id" se for um id real do catálogo fornecido (acabamentos ou perguntas). Caso contrário use null.
- "tipo": use "acabamento" quando sugerir aplicar um acabamento do catálogo; "pergunta" quando achar útil ativar uma pergunta do checklist; "alerta" para riscos/observações livres.
- Se nada relevante a sugerir, responda {"suggestions":[]}.
- Não repita acabamentos já presentes nos itens.`;

    const userPayload = {
      cliente: { nome: body.client_name ?? null, tags: body.client_tags },
      itens: body.items,
      respostas_checklist: body.checklist_answers,
      catalogo: catalog,
    };

    const resp = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GOOGLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (resp.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited", message: "IA temporariamente sobrecarregada, tente em alguns segundos." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (resp.status === 402) {
      return new Response(JSON.stringify({ error: "credits_exhausted", message: "Sem créditos no Gemini." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: "gemini_error", status: resp.status, body: t.slice(0, 400) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "{}";
    let suggestions: any[] = [];
    try {
      const parsedOut = JSON.parse(content);
      if (Array.isArray(parsedOut?.suggestions)) suggestions = parsedOut.suggestions;
    } catch {
      suggestions = [];
    }

    // Sanitização: limita 3, valida campos, valida alvo_id contra catálogo
    const acabIds = new Set(catalog.acabamentos.map((a) => a.id));
    const pergIds = new Set(catalog.perguntas.map((p) => p.id));
    suggestions = suggestions
      .filter((s) => s && typeof s.mensagem === "string" && ["acabamento", "pergunta", "alerta"].includes(s.tipo))
      .map((s) => {
        let alvo = s.alvo_id && typeof s.alvo_id === "string" ? s.alvo_id : null;
        if (s.tipo === "acabamento" && alvo && !acabIds.has(alvo)) alvo = null;
        if (s.tipo === "pergunta" && alvo && !pergIds.has(alvo)) alvo = null;
        return {
          tipo: s.tipo,
          alvo_id: alvo,
          mensagem: String(s.mensagem).slice(0, 280),
          justificativa: typeof s.justificativa === "string" ? s.justificativa.slice(0, 240) : "",
        };
      })
      .slice(0, 3);

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
