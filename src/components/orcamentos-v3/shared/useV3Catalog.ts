// Carrega catálogo de impressão + tiers + settings exatamente como o V2 faz,
// para que o PrintForm V3 calcule preços por folha idênticos ao V2.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PrintingCatalogItem, MarkupTier } from "@/components/orcamentos-v3/shared/PrintingItemSearch";

export interface V3GlobalSettings {
  invoice_pct: number;
  collection_pct: number;
  waste_pct: number;
  default_margin_pct: number;
  tax_pct: number;
  credit_card_pct: number;
}

interface PaperRow {
  id: string;
  name: string;
  grammage: string | null;
  pack_price: number | null;
  freight_price: number | null;
  sheet_qty: number | null;
  is_cut_size: boolean | null;
  category: string | null;
}


const buildLinkedPaper = (
  paperType: string,
  grammage: string | null,
  papers: PaperRow[],
) => {
  const match = papers.find(
    (p) =>
      p.name?.toLowerCase().trim() === paperType?.toLowerCase().trim() &&
      (p.grammage || "").trim() === (grammage || "").trim(),
  );
  if (!match || !match.sheet_qty || match.sheet_qty <= 0) return null;
  const unit = ((match.pack_price || 0) + (match.freight_price || 0)) / match.sheet_qty;
  return {
    id: match.id,
    name: match.name,
    grammage: match.grammage,
    sheet_qty: match.sheet_qty,
    is_cut_size: !!match.is_cut_size,
    unit_cost: unit,
    packaging_label: `Pacote ${match.sheet_qty} fl`,
  };
};

export function useV3Catalog() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PrintingCatalogItem[]>([]);
  const [tiers, setTiers] = useState<MarkupTier[]>([]);
  const [settings, setSettings] = useState<V3GlobalSettings>({
    invoice_pct: 0,
    collection_pct: 0,
    waste_pct: 0,
    default_margin_pct: 20,
    tax_pct: 0,
    credit_card_pct: 0,
  });

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [printRes, catRes, tiersRes, settingsRes, papersRes] = await Promise.all([
        supabase
          .from("printing_price_items")
          .select("*")
          .eq("is_active", true)
          .order("sort_order"),
        supabase.from("printer_categories").select("id, name").order("sort_order"),
        supabase.from("markup_tiers").select("*").order("sort_order"),
        supabase.from("global_settings").select("*").limit(1).single(),
        supabase
          .from("papers")
          .select("id, name, grammage, pack_price, freight_price, sheet_qty, is_cut_size, category")
          .eq("is_active", true),
      ]);

      if (cancel) return;

      const cats = new Map<string, string>();
      (catRes.data || []).forEach((c: any) => cats.set(c.id, c.name));
      const papers: PaperRow[] = (papersRes.data || []) as any;

      const findPaperCategory = (paperType: string, grammage: string | null): "comum" | "especial" | "adesivo" | null => {
        const m = papers.find(
          (p) =>
            p.name?.toLowerCase().trim() === paperType?.toLowerCase().trim() &&
            (p.grammage || "").trim() === (grammage || "").trim(),
        );
        const c = (m?.category || "").toLowerCase();
        if (c === "comum" || c === "especial" || c === "adesivo") return c;
        return null;
      };

      const built: PrintingCatalogItem[] = (printRes.data || []).map((r: any) => ({
        id: r.id,
        paper_type: r.paper_type,
        grammage: r.grammage,
        size: r.size,
        side: r.side,
        paper_cost: Number(r.paper_cost || 0),
        printing_cost: Number(r.printing_cost || 0),
        equipment_name: r.equipment_name || null,
        equipment_mode: r.equipment_mode || "color",
        category_name: cats.get(r.printer_category_id) || "—",
        printer_category_id: r.printer_category_id,
        markup_group_id: r.markup_group_id ?? null,
        totalCostA4: Number(r.paper_cost || 0) + Number(r.printing_cost || 0),
        is_cut_size: r.is_cut_size ?? null,
        purchase_sheet_width_mm: r.purchase_sheet_width_mm ?? null,
        purchase_sheet_height_mm: r.purchase_sheet_height_mm ?? null,
        linkedPaper: buildLinkedPaper(r.paper_type, r.grammage, papers),
        paper_category: findPaperCategory(r.paper_type, r.grammage),
      }));


      setItems(built);
      setTiers(
        (tiersRes.data || []).map((t: any) => ({
          id: t.id,
          printer_category_id: t.printer_category_id,
          markup_group_id: t.markup_group_id || null,
          label: t.label,
          min_qty: t.min_qty,
          max_qty: t.max_qty,
          fixed_cost_pct: t.fixed_cost_pct,
          variable_cost_pct: t.variable_cost_pct,
          margin_pct: t.margin_pct,
          sort_order: t.sort_order,
        })),
      );

      const s: any = settingsRes.data || {};
      setSettings({
        invoice_pct: Number(s.invoice_pct ?? 0),
        collection_pct: Number(s.collection_pct ?? 0),
        waste_pct: Number(s.waste_pct ?? 0),
        default_margin_pct: Number(s.default_margin_pct ?? 20),
        tax_pct: Number(s.tax_pct ?? 0),
        credit_card_pct: Number(s.credit_card_pct ?? 0),
      });
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return { loading, items, tiers, settings };
}

const roundUp10 = (v: number) => Math.round(v * 10) / 10;
const isLargerThanA4 = (size: string) => /^(A3|SRA3|A2|A1|A0)/i.test(size || "");

/** Espelha a lógica de PrintingItemSearch.calcSellingPrice + multiplicadores. */
export function pricePerSheet(
  item: PrintingCatalogItem,
  tiers: MarkupTier[],
  qty: number,
) {
  const sizeMult = isLargerThanA4(item.size) ? 2 : 1;
  const sideMult = item.side === "F/V" ? 2 : 1;
  const printCost = roundUp10(item.printing_cost * sizeMult * sideMult);
  const baseCost = item.paper_cost * sizeMult * sideMult + printCost;

  const groupTiers = item.markup_group_id
    ? tiers.filter((t) => t.markup_group_id === item.markup_group_id)
    : tiers.filter((t) => t.printer_category_id === item.printer_category_id);
  const tier =
    groupTiers.find((t) => qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty)) ||
    groupTiers[0] ||
    null;

  if (!tier) return { baseCost, sellingPrice: baseCost, tierLabel: null as string | null };

  const soma = (tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct) / 100;
  const divisor = 1 - soma;
  const sellingPrice = divisor > 0 ? Math.round((baseCost / divisor) * 10) / 10 : 0;
  return { baseCost, sellingPrice, tierLabel: tier.label };
}
