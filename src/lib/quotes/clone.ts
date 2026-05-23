import { supabase } from "@/integrations/supabase/client";

const buildNewQuoteNumber = (current: string) => {
  const m = current.match(/^(\d{4})-(\d+)$/);
  if (m) {
    const year = new Date().getFullYear();
    return `${year}-${String(Date.now()).slice(-4)}`;
  }
  return `${current}-CLONE`;
};

export interface CloneResult {
  newQuoteId: string;
  newQuoteNumber: string;
}

/**
 * Clones a quote (and its labor steps, materials, and third-party items)
 * into a fresh "pending" quote. Used by the manual clone button and by the
 * "Começar com um Modelo" (Use Template) flow.
 */
export async function cloneQuote(quoteId: string): Promise<CloneResult> {
  const { data: original, error: qErr } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .single();
  if (qErr || !original) throw qErr || new Error("Orçamento não encontrado");

  const newQuoteNumber = buildNewQuoteNumber(original.quote_number);

  const { data: cloned, error: insErr } = await supabase
    .from("quotes")
    .insert({
      quote_number: newQuoteNumber,
      client: original.client,
      product: `${original.product} (cópia)`,
      value: original.value,
      status: "pending",
      date: new Date().toISOString().split("T")[0],
      validity: original.validity,
      profit_margin: original.profit_margin,
      discount_value: original.discount_value,
      discount_type: original.discount_type,
      payment_method: original.payment_method,
      options: original.options,
      is_template: false,
      view_count: 0,
    })
    .select("id")
    .single();
  if (insErr || !cloned) throw insErr || new Error("Falha ao clonar");

  const [labor, mats, tp] = await Promise.all([
    supabase.from("quote_labor_steps").select("description, time_minutes, sort_order").eq("quote_id", quoteId),
    supabase.from("quote_materials").select("description, quantity, unit_price, sort_order, product_kind, custom_name, reference, generated_title, paper_type, grammage, size, side").eq("quote_id", quoteId),
    supabase.from("quote_third_party").select("description, supplier, cost, sort_order").eq("quote_id", quoteId),
  ]);

  if (labor.data?.length) {
    await supabase.from("quote_labor_steps").insert(
      labor.data.map((s) => ({ ...s, quote_id: cloned.id })),
    );
  }
  if (mats.data?.length) {
    await supabase.from("quote_materials").insert(
      mats.data.map((m) => ({ ...m, quote_id: cloned.id })),
    );
  }
  if (tp.data?.length) {
    await supabase.from("quote_third_party").insert(
      tp.data.map((t) => ({ ...t, quote_id: cloned.id })),
    );
  }

  return { newQuoteId: cloned.id, newQuoteNumber };
}
