import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface ItemIn {
  material_id: string | null;
  area_m2: number;
}
interface Body {
  items: ItemIn[];
  current_finish_ids?: string[];
}

function areaBand(a: number): string {
  if (a < 1) return "<1";
  if (a < 3) return "1-3";
  if (a < 6) return "3-6";
  if (a < 12) return "6-12";
  if (a < 30) return "12-30";
  return "30+";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = (await req.json()) as Body;
    const items = Array.isArray(body?.items) ? body.items : [];
    const currentFinishes = new Set(body?.current_finish_ids ?? []);

    if (items.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build signature: sorted (material_id|band) pairs
    const sig = items
      .map((i) => `${i.material_id ?? "null"}|${areaBand(Number(i.area_m2 || 0))}`)
      .sort()
      .join(";");

    // Check cache
    const { data: cached } = await supabase
      .from("historical_suggestion_cache")
      .select("payload, expires_at")
      .eq("signature", sig)
      .maybeSingle();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return new Response(JSON.stringify({ suggestions: cached.payload, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find candidate past items: same material_id + area band, last 12 months
    const materialIds = [...new Set(items.map((i) => i.material_id).filter(Boolean))] as string[];
    if (materialIds.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data: past, error } = await supabase
      .from("cv_quote_items")
      .select("quote_id, material_id, area_total_m2, quantidade, acabamento_id, acabamento_nome, created_at")
      .in("material_id", materialIds)
      .gte("created_at", since)
      .limit(2000);
    if (error) throw error;

    const bandSet = new Set(items.map((i) => areaBand(Number(i.area_m2 || 0))));
    const matSet = new Set(materialIds);

    // Group quotes that match profile; per quote, collect distinct acabamento ids
    const quoteFinishes = new Map<string, { ids: Set<string>; names: Map<string, string> }>();
    for (const row of past ?? []) {
      const areaSingle = Number(row.area_total_m2 || 0) / Math.max(1, Number(row.quantidade || 1));
      if (!matSet.has(row.material_id!)) continue;
      if (!bandSet.has(areaBand(areaSingle))) continue;
      if (!row.acabamento_id) continue;
      const entry = quoteFinishes.get(row.quote_id) ?? { ids: new Set<string>(), names: new Map<string, string>() };
      entry.ids.add(row.acabamento_id);
      if (row.acabamento_nome) entry.names.set(row.acabamento_id, row.acabamento_nome);
      quoteFinishes.set(row.quote_id, entry);
    }

    const totalQuotes = quoteFinishes.size;
    if (totalQuotes < 3) {
      // not enough sample
      await supabase.from("historical_suggestion_cache").upsert({
        signature: sig,
        payload: [],
        computed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });
      return new Response(JSON.stringify({ suggestions: [], sample: totalQuotes }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const freq = new Map<string, { count: number; name: string }>();
    for (const [, ent] of quoteFinishes) {
      for (const id of ent.ids) {
        const cur = freq.get(id) ?? { count: 0, name: ent.names.get(id) ?? "" };
        cur.count += 1;
        if (!cur.name && ent.names.get(id)) cur.name = ent.names.get(id)!;
        freq.set(id, cur);
      }
    }

    const suggestions = [...freq.entries()]
      .map(([id, v]) => ({
        acabamento_id: id,
        nome: v.name,
        count: v.count,
        total: totalQuotes,
        pct: Math.round((v.count / totalQuotes) * 100),
      }))
      .filter((s) => s.pct >= 60 && !currentFinishes.has(s.acabamento_id))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);

    await supabase.from("historical_suggestion_cache").upsert({
      signature: sig,
      payload: suggestions,
      computed_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    return new Response(JSON.stringify({ suggestions, sample: totalQuotes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
