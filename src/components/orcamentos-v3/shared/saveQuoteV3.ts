// Persistência V3 (Fase 5.1).
// Estratégia híbrida: itens minimalistas do V3 entram em quote_materials
// (kind print/cv) e quote_third_party (kind third) como itens manuais,
// preservando os campos disponíveis. A engine completa de catálogo
// (markup tiers + paper costs) será plugada na Fase 5.2.
import { supabase } from "@/integrations/supabase/client";
import type {
  V3QuoteState,
  V3Item,
  V3PrintItem,
  V3CVItem,
  V3ThirdItem,
  V3BookletItem,
  V3LaborItem,
  V3SupplyItem,
  V3LabelItem,
} from "../types";
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

// CV: descrição derivada apenas para fins de log/debug — não usada no insert.


const totalValue = (items: V3Item[]) =>
  roundUp10(items.reduce((sum, it) => sum + priceOf(it).preco_total, 0));

export interface SaveResult {
  id: string;
  quote_number: string;
}

export async function saveQuoteV3(
  state: V3QuoteState,
  editingQuoteId?: string,
): Promise<SaveResult> {
  if (!state.cliente.id) throw new Error("Selecione um cliente válido antes de salvar.");
  if (state.items.length === 0) throw new Error("Adicione pelo menos 1 item.");

  const value = totalValue(state.items);
  const v3_payload = state as unknown as Record<string, unknown>;

  let quoteId: string;
  let quote_number: string;

  if (editingQuoteId) {
    // Bloqueia edição de versão travada (já tem versão filha)
    const { data: existing, error: exErr } = await supabase
      .from("quotes")
      .select("id, quote_number, is_locked")
      .eq("id", editingQuoteId)
      .maybeSingle();
    if (exErr) throw exErr;
    if (!existing) throw new Error("Orçamento não encontrado.");
    if ((existing as { is_locked?: boolean }).is_locked) {
      throw new Error("Esta versão foi substituída e não pode ser editada.");
    }
    quoteId = (existing as { id: string }).id;
    quote_number = (existing as { quote_number: string }).quote_number;

    const updPayload = {
      client: state.cliente.nome.trim(),
      client_id: state.cliente.id,
      product: state.assunto.trim() || "Orçamento rápido (V3)",
      value,
      profit_margin: String(state.margin_pct ?? 33),
      v3_payload: v3_payload as never,
      updated_at: new Date().toISOString(),
    };
    const { error: updErr } = await supabase
      .from("quotes")
      .update(updPayload as never)
      .eq("id", quoteId);
    if (updErr) throw updErr;

    // Limpa filhos antes de reinserir
    await Promise.all([
      supabase.from("quote_materials").delete().eq("quote_id", quoteId),
      supabase.from("quote_labor_steps").delete().eq("quote_id", quoteId),
      supabase.from("quote_third_party").delete().eq("quote_id", quoteId),
      supabase.from("cv_quote_items").delete().eq("quote_id", quoteId),
    ]);
  } else {
    quote_number = await nextQuoteNumber();

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
      v3_payload: v3_payload as never,
    };

    const { data: inserted, error } = await supabase
      .from("quotes")
      .insert([payload as never])
      .select("id, quote_number")
      .single();
    if (error || !inserted) throw error || new Error("Falha ao criar orçamento.");
    quoteId = (inserted as { id: string }).id;
    quote_number = (inserted as { quote_number: string }).quote_number;
  }

  // Materiais de IMPRESSÃO em quote_materials (CV vai em cv_quote_items).
  const materialRows = state.items
    .map((it, i) => ({ it, sort: i }))
    .filter(({ it }) => it.kind === "print")
    .map(({ it, sort }) => {
      const p = priceOf(it);
      const printIt = it as V3PrintItem;
      const qty = Math.max(1, Math.floor(printIt.quantidade || 1));
      const unit = qty > 0 ? roundUp10(p.preco_total / qty) : p.preco_total;
      return {
        quote_id: quoteId,
        description: describePrint(printIt) || "Impressão",
        quantity: qty,
        unit_price: unit,
        sort_order: sort,
        status: "pendente" as const,
        parent_item_id: null,
        product_kind: "impressao",
        custom_name: printIt.descricao || null,
        paper_type: printIt.paper_type,
        grammage: printIt.grammage,
        size: printIt.size ?? printIt.formato,
        side: printIt.side ?? (printIt.face === "fv" ? "F/V" : printIt.face === "frente" ? "Só frente" : null),
        print_colors: printIt.cores,
        catalog_source: printIt.catalog_item_id ? "printing" : null,
        catalog_item_id: printIt.catalog_item_id ?? null,
        tier_group_id: printIt.tier_group_id ?? null,
        art_status: printIt.art_status ?? null,
      };
    });

  if (materialRows.length > 0) {
    const { error: matErr } = await supabase.from("quote_materials").insert(materialRows);
    if (matErr) throw matErr;
  }

  // CV → cv_quote_items (paridade com V2)
  const cvRows = state.items
    .map((it, i) => ({ it, sort: i }))
    .filter(({ it }) => it.kind === "cv")
    .map(({ it, sort }) => {
      const cv = it as V3CVItem;
      const snap = cv.snapshot;
      return {
        quote_id: quoteId,
        material_id: cv.midia_id,
        printer_id: cv.impressao_id ?? null,
        material_nome: cv.midia_nome || null,
        printer_nome: cv.impressao_nome ?? null,
        acabamento_id: snap?.acabamento_efetivo_id ?? null,
        acabamento_nome: snap?.acabamento_efetivo_nome ?? null,
        largura_cm: cv.largura_m * 100,
        altura_cm: cv.altura_m * 100,
        quantidade: cv.quantidade,
        area_total_m2: snap?.area_total_m2 ?? (cv.largura_m * cv.altura_m * cv.quantidade),
        perimetro_m: snap?.perim_m ?? 0,
        tem_emenda: snap?.tem_emenda ?? false,
        aplicou_minimo: snap?.aplicou_minimo ?? false,
        preco_midia: snap?.preco_midia ?? 0,
        preco_impressao: snap?.preco_impressao ?? 0,
        preco_acabamentos: snap?.preco_acabamentos ?? 0,
        preco_total: snap?.preco_total ?? priceOf(cv).preco_total,
        finishes_json: (cv.acabamento_ids ?? []) as never,
        sort_order: sort,
        tier_group_id: cv.tier_group_id ?? null,
        art_status: cv.art_status ?? null,
      };
    });

  if (cvRows.length > 0) {
    const { error: cvErr } = await supabase.from("cv_quote_items").insert(cvRows as never);
    if (cvErr) throw cvErr;
  }


  // Terceiros — paridade com V2: armazena CUSTO BRUTO (cost),
  // o markup/margem é aplicado pela engine financeira do quote.
  const thirdRows = state.items
    .map((it, i) => ({ it, sort: i }))
    .filter(({ it }) => it.kind === "third")
    .map(({ it, sort }) => {
      const t = it as V3ThirdItem;
      const qty = Math.max(1, Math.floor(t.quantidade || 1));
      const rawCost = qty * (t.custo || 0);
      return {
        quote_id: quoteId,
        description: t.descricao?.trim() || "Material terceirizado",
        supplier: t.fornecedor || null,
        cost: rawCost,
        sort_order: sort,
        tier_group_id: t.tier_group_id ?? null,
      };
    });

  if (thirdRows.length > 0) {
    const { error: tpErr } = await supabase.from("quote_third_party").insert(thirdRows);
    if (tpErr) throw tpErr;
  }

  // ===== Fase 6 — Apostila / Mão-de-obra / Suprimento =====

  // Apostila → quote_materials com booklet_pages / booklet_units / booklet_duplex
  const bookletRows = state.items
    .map((it, i) => ({ it, sort: i }))
    .filter(({ it }) => it.kind === "booklet")
    .map(({ it, sort }) => {
      const b = it as V3BookletItem;
      const p = priceOf(b);
      const physical = Math.max(1, b.bookletPages * b.bookletUnits);
      const sideMult = b.side === "F/V" ? 1 : b.bookletDuplex ? 2 : 1;
      const totalImpressions = Math.max(1, physical * sideMult);
      const unit = roundUp10(p.preco_total / totalImpressions);
      return {
        quote_id: quoteId,
        description: b.descricao || "Apostila",
        quantity: totalImpressions,
        unit_price: unit,
        sort_order: 1000 + sort,
        status: "pendente" as const,
        parent_item_id: null,
        product_kind: "Apostilas",
        custom_name: b.descricao || null,
        paper_type: b.paper_type,
        grammage: b.grammage,
        size: b.size,
        side: b.side ?? (b.bookletDuplex ? "F/V" : "Só frente"),
        catalog_source: b.catalog_item_id ? "printing" : null,
        catalog_item_id: b.catalog_item_id ?? null,
        booklet_pages: b.bookletPages,
        booklet_units: b.bookletUnits,
        booklet_duplex: b.bookletDuplex,
        tier_group_id: b.tier_group_id ?? null,
        art_status: b.art_status ?? null,
      };
    });
  if (bookletRows.length > 0) {
    const { error: bErr } = await supabase
      .from("quote_materials")
      .insert(bookletRows as never);
    if (bErr) throw bErr;
  }

  // Suprimento avulso → quote_materials product_kind 'Suprimento'
  const supplyRows = state.items
    .map((it, i) => ({ it, sort: i }))
    .filter(({ it }) => it.kind === "supply")
    .map(({ it, sort }) => {
      const s = it as V3SupplyItem;
      const qty = Math.max(1, Math.floor(s.quantidade || 1));
      const unit = roundUp10(s.custo_unitario * (1 + (s.margem_pct || 0) / 100));
      return {
        quote_id: quoteId,
        description: s.descricao || s.supply_nome || "Suprimento",
        quantity: qty,
        unit_price: unit,
        sort_order: 2000 + sort,
        status: "pendente" as const,
        parent_item_id: null,
        product_kind: "Suprimento",
        custom_name: s.descricao || s.supply_nome || null,
        tier_group_id: s.tier_group_id ?? null,
      };
    });
  if (supplyRows.length > 0) {
    const { error: sErr } = await supabase
      .from("quote_materials")
      .insert(supplyRows as never);
    if (sErr) throw sErr;
  }

  // Mão-de-obra avulsa → quote_labor_steps (parent_item_id null)
  const laborRows = state.items
    .map((it, i) => ({ it, sort: i }))
    .filter(({ it }) => it.kind === "labor")
    .map(({ it, sort }) => {
      const l = it as V3LaborItem;
      return {
        quote_id: quoteId,
        description: l.descricao || "Mão-de-obra",
        time_minutes: l.time_minutes,
        step_type: l.step_type,
        sort_order: sort,
        parent_item_id: null,
      };
    });
  if (laborRows.length > 0) {
    const { error: lErr } = await supabase
      .from("quote_labor_steps")
      .insert(laborRows as never);
    if (lErr) throw lErr;
  }

  // Etiqueta → quote_materials product_kind 'Etiquetas'
  const labelRows = state.items
    .map((it, i) => ({ it, sort: i }))
    .filter(({ it }) => it.kind === "label")
    .map(({ it, sort }) => {
      const l = it as V3LabelItem;
      const qty = Math.max(1, Math.floor(l.quantidade || 1));
      const unit = qty > 0 ? roundUp10(l.preco_total / qty) : l.preco_total;
      return {
        quote_id: quoteId,
        description:
          l.descricao ||
          `Etiqueta ${l.labelW_mm}×${l.labelH_mm}mm — ${qty} un`,
        quantity: qty,
        unit_price: unit,
        sort_order: 3000 + sort,
        status: "pendente" as const,
        parent_item_id: null,
        product_kind: "Etiquetas",
        custom_name: l.descricao || null,
        paper_type: l.paper_type,
        grammage: l.grammage,
        size: l.sheet_size,
        side: l.side,
        catalog_source: l.printing_item_id ? "printing" : null,
        catalog_item_id: l.printing_item_id ?? null,
        tier_group_id: l.tier_group_id ?? null,
        art_status: l.art_status ?? null,
      };
    });
  if (labelRows.length > 0) {
    const { error: labErr } = await supabase
      .from("quote_materials")
      .insert(labelRows as never);
    if (labErr) throw labErr;
  }

  return { id: quoteId, quote_number };
}


