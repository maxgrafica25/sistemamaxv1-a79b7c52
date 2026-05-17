import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GlobalSettingsData {
  tax_pct: number;
  invoice_pct: number;
  collection_pct: number;
  collection_fee_pct: number;
  credit_card_pct: number;
  waste_pct: number;
  default_margin_pct: number;
}

const DEFAULTS: GlobalSettingsData = {
  tax_pct: 10,
  invoice_pct: 10,
  collection_pct: 7,
  collection_fee_pct: 5,
  credit_card_pct: 5,
  waste_pct: 5,
  default_margin_pct: 33,
};

export function useGlobalSettings() {
  const [settings, setSettings] = useState<GlobalSettingsData>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.from("global_settings").select("*").limit(1).maybeSingle();
      if (!alive) return;
      if (data) {
        setSettings({
          tax_pct: Number(data.tax_pct ?? DEFAULTS.tax_pct),
          invoice_pct: Number(data.invoice_pct ?? DEFAULTS.invoice_pct),
          collection_pct: Number(data.collection_pct ?? DEFAULTS.collection_pct),
          collection_fee_pct: Number(data.collection_fee_pct ?? DEFAULTS.collection_fee_pct),
          credit_card_pct: Number(data.credit_card_pct ?? DEFAULTS.credit_card_pct),
          waste_pct: Number(data.waste_pct ?? DEFAULTS.waste_pct),
          default_margin_pct: Number(data.default_margin_pct ?? DEFAULTS.default_margin_pct),
        });
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return { settings, loading };
}
