// Unified webhook for price coletors (Firecrawl edge function or VPS Playwright worker).
// Accepts: { site_id, tiers: [{quantidade, preco_total, preco_unitario}], origem }
// Auth: Bearer VPS_WORKER_TOKEN  (skipped when called from another edge function via service-role)
//
// SERVICE ROLE: necessária — endpoint público autenticado por token externo (VPS),
// sem JWT de usuário. Escreve em site_precos_tiers/sites_monitorados.
// Cliente via wrapper auditado (_shared/admin-client).
import { getAdminClient, logAdminOperation } from "../_shared/admin-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VPS_TOKEN = Deno.env.get("VPS_WORKER_TOKEN");

    // Auth: aceita service-role (chamada interna) ou bearer VPS_WORKER_TOKEN
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    const isInternal = token === SERVICE_ROLE;
    const isVps = VPS_TOKEN && token === VPS_TOKEN;
    if (!isInternal && !isVps) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { site_id, tiers, origem } = body || {};
    if (!site_id || !Array.isArray(tiers)) {
      return new Response(JSON.stringify({ success: false, error: "site_id e tiers[] obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getAdminClient({
      fnName: "sync-prices-webhook",
      reason: "Webhook externo (VPS worker) sem JWT — escreve em site_precos_tiers/sites_monitorados",
    });

    // Limpar e validar tiers
    const cleanTiers = tiers
      .map((t: any) => ({
        site_id,
        quantidade: Number(t.quantidade) || 0,
        preco_total: Number(t.preco_total) || 0,
        preco_unitario:
          Number(t.preco_unitario) ||
          (Number(t.quantidade) > 0 ? Number(t.preco_total) / Number(t.quantidade) : 0),
      }))
      .filter((t) => t.quantidade > 0 && t.preco_total > 0);

    if (!cleanTiers.length) {
      return new Response(JSON.stringify({ success: false, error: "Nenhum tier válido recebido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Para cada tier: buscar existente. Se existir e o preço mudou, UPDATE (dispara trigger).
    // Se não existir, INSERT (sem alerta — primeira coleta).
    let updated = 0, inserted = 0, unchanged = 0;
    for (const t of cleanTiers) {
      const { data: existing } = await supabase
        .from("site_precos_tiers")
        .select("id, preco_total")
        .eq("site_id", site_id)
        .eq("quantidade", t.quantidade)
        .maybeSingle();

      if (existing) {
        if (Number(existing.preco_total) !== t.preco_total) {
          await supabase
            .from("site_precos_tiers")
            .update({
              preco_total: t.preco_total,
              preco_unitario: t.preco_unitario,
            })
            .eq("id", existing.id);
          updated++;
        } else {
          unchanged++;
        }
      } else {
        await supabase.from("site_precos_tiers").insert(t);
        inserted++;
      }
    }

    // Atualizar timestamp de checagem do site + preço base (menor faixa)
    const minTier = cleanTiers[0];
    await supabase
      .from("sites_monitorados")
      .update({
        timestamp_check: new Date().toISOString(),
        preco_atual: minTier.preco_total,
      })
      .eq("id", site_id);

    await logAdminOperation(supabase, {
      function_name: "sync-prices-webhook",
      operation: "upsert_tiers",
      target_table: "site_precos_tiers",
      target_count: inserted + updated,
      metadata: { site_id, origem: origem || "unknown", inserted, updated, unchanged },
    });

    return new Response(
      JSON.stringify({ success: true, origem: origem || "unknown", inserted, updated, unchanged }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("sync-prices-webhook:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
