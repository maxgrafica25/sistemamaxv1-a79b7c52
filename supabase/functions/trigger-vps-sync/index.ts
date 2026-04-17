import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const webhookUrl = Deno.env.get("VPS_WORKER_WEBHOOK_URL");
    const webhookToken = Deno.env.get("VPS_WORKER_TOKEN");

    // Stub: se ainda não há webhook configurado, retorna ok informativo
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({
          success: true,
          stub: true,
          message:
            "Edge Function pronta. Configure os secrets VPS_WORKER_WEBHOOK_URL e VPS_WORKER_TOKEN para acionar o robô da VPS.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch (_) {
      body = {};
    }

    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
      },
      body: JSON.stringify({ trigger: "manual", payload: body, at: new Date().toISOString() }),
    });

    const text = await resp.text();
    return new Response(
      JSON.stringify({ success: resp.ok, status: resp.status, response: text }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: resp.ok ? 200 : 502,
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("trigger-vps-sync error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
