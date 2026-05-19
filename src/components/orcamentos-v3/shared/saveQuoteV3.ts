// Persistência V3 (Fase 5.1).
// Estratégia híbrida: itens minimalistas do V3 entram em quote_materials
// (kind print/cv) e quote_third_party (kind third) como itens manuais,
// preservando os campos disponíveis. A engine completa de catálogo
// (markup tiers + paper costs) será plugada na Fase 5.2.
import { supabase } from "@/integrations/supabase/client";
import type { V3QuoteState, V3Item, V3PrintItem, V3CVItem, V3ThirdItem } from "../types";
import { priceOf, roundUp10 } from "./pricing";

const nextQuoteNumber = async () => {
  const { data } = await supabase
    .from("quotes")
    .select("quote_number")
    .order("created_at", { ascending: false })
    .limit(50);
  const year = new Date().getFullYear();
  const count = (data || []).filter((q: any) =>
    String(q.quote_number || "").startsWith(String(year)),
  ).length;
  return `${year}-${String(count + 1).padStart(3, "0")}`;
};

const describePrint = (it: V3PrintItem) => {
  if (it.catalog_item_id) {
    const head = `${it.paper_type ?? ""}${it.grammage ? ` ${it.grammage}` : ""} — ${it.size ?? ""} ${it.side ?? ""}`.trim();
    return [it.descricao?.trim(), head, it.finishings.length ? `Acab.: ${it.finishings.join(", ")}` : null]
      .filter(Boolean)
      .join(" · ");
  }
  return [
    it.descricao?.trim(),
    it.formato,
    it.cores,
    it.face === "fv" ? "Frente/Verso" : it.face === "frente" ? "Só frente" : null,
    it.finishings.length ? `Acab.: ${it.finishings.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
};

const describeCV = (it: V3CVItem) => {
  const m2 = (it.largura_m * it.altura_m).toFixed(2);
  return [
    it.descricao?.trim() || it.midia_nome || "Comunicação Visual",
    `${it.largura_m}m × ${it.altura_m}m (${m2} m²)`,
    it.finishings.length ? `Acab.: ${it.finishings.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
};

const totalValue = (items: V3Item[]) =>
  roundUp10(items.reduce((sum, it) => sum + priceOf(it).preco_total, 0));

export interface SaveResult {
  id: string;
  quote_number: string;
}

export async function saveQuoteV3(state: V3QuoteState): Promise<SaveResult> {
  if (!state.cliente.id) throw new Error("Selecione um cliente válido antes de salvar.");
  if (state.items.length === 0) throw new Error("Adicione pelo menos 1 item.");

  const quote_number = await nextQuoteNumber();
  const value = totalValue(state.items);

  // Validade default da empresa (fallback 15 dias)
  const { data: companyRow } = await supabase
    .from("company_settings")
    .select("default_quote_validity_days")
    .limit(1)
    .maybeSingle();
  const validity = String((companyRow as any)?.default_quote_validity_days ?? 15);

  const payload = {
    quote_number,
    client: state.cliente.nome.trim(),
    client_id: state.cliente.id,
    product: state.assunto.trim() || "Orçamento rápido (V3)",
    value,
    status: "pending" as const,
    date: new Date().toISOString().split("T")[0],
    validity,
    profit_margin: String(state.margin_pct ?? 33),
    payment_method: null,
    tags: ["v3"],
  };

  const { data: inserted, error } = await supabase
    .from("quotes")
    .insert([payload])
    .select("id, quote_number")
    .single();
  if (error || !inserted) throw error || new Error("Falha ao criar orçamento.");

  const quoteId = inserted.id as string;

  // Materiais: print + cv como rows manuais (sem catalog_source).
  const materialRows = state.items
    .map((it, i) => ({ it, sort: i }))
    .filter(({ it }) => it.kind !== "third")
    .map(({ it, sort }) => {
      const p = priceOf(it);
      const qty = Math.max(1, Math.floor((it as any).quantidade || 1));
      const unit = qty > 0 ? roundUp10(p.preco_total / qty) : p.preco_total;
      if (it.kind === "print") {
        return {
          quote_id: quoteId,
          description: describePrint(it) || "Impressão",
          quantity: qty,
          unit_price: unit,
          sort_order: sort,
          status: "pendente" as const,
          parent_item_id: null,
          product_kind: "impressao",
          custom_name: it.descricao || null,
          paper_type: it.paper_type,
          grammage: it.grammage,
          size: it.size ?? it.formato,
          side: it.side ?? (it.face === "fv" ? "F/V" : it.face === "frente" ? "Só frente" : null),
          print_colors: it.cores,
          catalog_source: it.catalog_item_id ? "printing" : null,
          catalog_item_id: it.catalog_item_id ?? null,
        };
      }
      const cv = it as V3CVItem;
      return {
        quote_id: quoteId,
        description: describeCV(cv),
        quantity: qty,
        unit_price: unit,
        sort_order: sort,
        status: "pendente" as const,
        parent_item_id: null,
        product_kind: "comunicacao_visual",
        custom_name: cv.descricao || cv.midia_nome || null,
        width_mm: Math.round(cv.largura_m * 1000) || null,
        height_mm: Math.round(cv.altura_m * 1000) || null,
        catalog_source: null,
        catalog_item_id: null,
      };
    });

  if (materialRows.length > 0) {
    const { error: matErr } = await supabase.from("quote_materials").insert(materialRows);
    if (matErr) throw matErr;
  }

  // Terceiros
  const thirdRows = state.items
    .map((it, i) => ({ it, sort: i }))
    .filter(({ it }) => it.kind === "third")
    .map(({ it, sort }) => {
      const t = it as V3ThirdItem;
      const p = priceOf(t);
      return {
        quote_id: quoteId,
        description:
          [t.descricao?.trim(), t.fornecedor && `Fornecedor: ${t.fornecedor}`]
            .filter(Boolean)
            .join(" · ") || "Material terceirizado",
        supplier: t.fornecedor || null,
        cost: p.preco_total,
        sort_order: sort,
      };
    });

  if (thirdRows.length > 0) {
    const { error: tpErr } = await supabase.from("quote_third_party").insert(thirdRows);
    if (tpErr) throw tpErr;
  }

  return { id: quoteId, quote_number: inserted.quote_number as string };
}
