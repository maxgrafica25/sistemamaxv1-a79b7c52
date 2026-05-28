import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { email, password, success } = await req.json();
    const ipAddress = req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for") || "unknown";

    if (success !== undefined) {
      // Record attempt result
      const { error: insertError } = await supabaseClient
        .from("login_attempts")
        .insert({
          email: email?.toLowerCase().trim(),
          ip_address: ipAddress,
          success: success
        });

      if (insertError) throw insertError;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for existing blocks
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    
    // Check by email
    const { count: emailFailures, error: emailError } = await supabaseClient
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("email", email?.toLowerCase().trim())
      .eq("success", false)
      .gt("attempted_at", fifteenMinutesAgo);

    if (emailError) throw emailError;

    // Check by IP
    const { count: ipFailures, error: ipError } = await supabaseClient
      .from("login_attempts")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ipAddress)
      .eq("success", false)
      .gt("attempted_at", fifteenMinutesAgo);

    if (ipError) throw ipError;

    if ((emailFailures || 0) >= 5 || (ipFailures || 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Muitas tentativas. Tente novamente em 15 minutos." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
