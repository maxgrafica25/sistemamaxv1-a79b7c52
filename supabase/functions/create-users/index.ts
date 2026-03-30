import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const users = [
    { email: "marcelle@maxgraficadigital.com.br", password: "Marcelle123", display_name: "Marcelle", role: "admin" },
    { email: "erika@maxgraficadigital.com.br", password: "Grafica123", display_name: "Erika", role: "colaborador" },
    { email: "rebeca@maxgraficadigital.com.br", password: "Grafica123", display_name: "Rebeca", role: "colaborador" },
  ];

  const results = [];

  for (const u of users) {
    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((eu: any) => eu.email === u.email);
    
    if (existing) {
      // Update profile role
      await supabaseAdmin.from("profiles").update({ role: u.role, display_name: u.display_name }).eq("user_id", existing.id);
      results.push({ email: u.email, status: "already exists, role updated", user_id: existing.id });
      continue;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { display_name: u.display_name },
    });

    if (error) {
      results.push({ email: u.email, status: "error", error: error.message });
    } else {
      // Set role in profiles
      await supabaseAdmin.from("profiles").update({ role: u.role }).eq("user_id", data.user.id);
      results.push({ email: u.email, status: "created", user_id: data.user.id });
    }
  }

  // Also update juliano to admin
  const { data: julianoProfile } = await supabaseAdmin.from("profiles")
    .select("user_id")
    .ilike("display_name", "%juliano%")
    .single();
  
  if (julianoProfile) {
    await supabaseAdmin.from("profiles").update({ role: "admin" }).eq("user_id", julianoProfile.user_id);
    results.push({ email: "juliano@maxgraficadigital.com.br", status: "role updated to admin" });
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
