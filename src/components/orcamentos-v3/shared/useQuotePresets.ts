// Hook que carrega os presets cadastrados em `quote_presets` para uso
// nos módulos de orçamento (CV e Impressão + Acabamentos).
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PresetModulo = "cv" | "impressao" | "ambos";
export type PresetFormTipo = "print" | "booklet" | "label";

export interface QuotePreset {
  id: string;
  nome: string;
  icone: string;
  modulo: PresetModulo;
  form_tipo: PresetFormTipo | null;
  ordem: number;
  ativo: boolean;
  largura_cm: number | null;
  altura_cm: number | null;
  quantidade_padrao: number | null;
  is_banner: boolean;
  midia_tipo: "lona" | "adesivo" | "chapa" | null;
  midia_nome_match: string | null;
  papel_inclui: string[];
  papel_exclui: string[];
  acabamentos_sugeridos: string[];
}

export function useQuotePresets(modulo: "cv" | "impressao") {
  const [presets, setPresets] = useState<QuotePreset[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("quote_presets" as never)
      .select("*")
      .eq("ativo", true)
      .in("modulo", [modulo, "ambos"])
      .order("ordem");
    setPresets(((data as unknown) as QuotePreset[]) ?? []);
    setLoading(false);
  }, [modulo]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("quote_presets" as never)
        .select("*")
        .eq("ativo", true)
        .in("modulo", [modulo, "ambos"])
        .order("ordem");
      if (cancel) return;
      setPresets(((data as unknown) as QuotePreset[]) ?? []);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [modulo]);

  return { presets, loading, reload };
}
