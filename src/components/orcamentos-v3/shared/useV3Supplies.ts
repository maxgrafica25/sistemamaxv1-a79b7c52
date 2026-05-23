// Hook compartilhado: carrega supplies + pricing_tiers (espelha SupplySearch).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SupplyTier } from "@/lib/quotes/supply-pricing";

export interface V3Supply {
  id: string;
  produto: string;
  fornecedor: string | null;
  valor_unitario: number;
  margem_pct: number | null;
  pricing_tiers: SupplyTier[];
}

export function useV3Supplies() {
  const [supplies, setSupplies] = useState<V3Supply[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [{ data: sups }, { data: tiers }] = await Promise.all([
        supabase
          .from("supplies")
          .select("id, produto, fornecedor, valor_unitario, margem_pct")
          .order("produto"),
        (supabase as any)
          .from("supply_pricing_tiers")
          .select("*")
          .order("min_qty"),
      ]);
      if (cancel) return;
      const tierMap = new Map<string, SupplyTier[]>();
      for (const t of (tiers || []) as any[]) {
        const arr = tierMap.get(t.supply_id) || [];
        arr.push(t as SupplyTier);
        tierMap.set(t.supply_id, arr);
      }
      setSupplies(
        ((sups || []) as any[]).map((s) => ({
          id: s.id,
          produto: s.produto,
          fornecedor: s.fornecedor ?? null,
          valor_unitario: Number(s.valor_unitario) || 0,
          margem_pct: s.margem_pct != null ? Number(s.margem_pct) : null,
          pricing_tiers: tierMap.get(s.id) || [],
        })),
      );
      setLoaded(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  return { supplies, loaded };
}

export function pickSupplyTierPrice(s: V3Supply, qty: number): number {
  const tiers = s.pricing_tiers || [];
  if (tiers.length === 0) return s.valor_unitario;
  const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
  const hit = sorted.find(
    (t) => qty >= t.min_qty && (t.max_qty == null || qty <= t.max_qty),
  );
  return hit ? Number((hit as any).manual_price) : s.valor_unitario;
}
