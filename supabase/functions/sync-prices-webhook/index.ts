// Unified webhook for price coletors (Firecrawl edge function or VPS Playwright worker).
// Accepts: { site_id, tiers: [{quantidade, preco_total, preco_unitario}], origem }
// Auth: Bearer VPS_WORKER_TOKEN  (skipped when called from another edge function via service-role)
//
// SERVICE ROLE: necessária — endpoint público autenticado por token externo (VPS),
// sem JWT de usuário. Escreve em site_precos_tiers/sites_monitorados.
// Cliente via wrapper auditado (_shared/admin-client).
import { z } from "https://esm.sh/zod@3.23.8";
import { getAdminClient, logAdminOperation } from "../_shared/admin-client.ts";
import { sanitizeError } from "../_shared/errorHandler.ts";

const TierSchema = z.object({
  quantidade: z.number().int().positive().max(1_000_000),
  preco_total: z.number().nonnegative().max(10_000_000),
  preco_unitario: z.number().nonnegative().max(10_000_000).optional(),
});
const BodySchema = z.object({
  site_id: z.string().uuid(),
  tiers: z.array(TierSchema).min(1).max(100),
  origem: z.string().max(50).optional(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Etapa 3.5 (item 11) — guard hard: o webhook NÃO pode operar sem o secret de
  // worker provisionado. Mesmo chamadas internas via service-role ficam bloqueadas,
  // porque o endpoint existe exclusivamente para o coletor externo (VPS Playwright).
  const VPS_TOKEN = Deno.env.get("VPS_WORKER_TOKEN");
  if (!VPS_TOKEN) {
    console.error("[sync-prices-webhook] VPS_WORKER_TOKEN ausente — endpoint indisponível");
    return new Response(
      JSON.stringify({ success: false, error: "Serviço temporariamente indisponível" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: aceita service-role (chamada interna) ou bearer VPS_WORKER_TOKEN
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    const isInternal = token === SERVICE_ROLE;
    const isVps = token === VPS_TOKEN;
    if (!isInternal && !isVps) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({
        success: false,
        error: "Payload inválido",
        details: parsed.error.flatten().fieldErrors,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { site_id, tiers, origem } = parsed.data;

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
    const payload = sanitizeError(err, "sync-prices-webhook", {
      publicMessage: "Falha ao processar coleta de preços",
    });
    return new Response(JSON.stringify({ success: false, ...payload }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
