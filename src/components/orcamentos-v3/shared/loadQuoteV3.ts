// Hidratação V3: carrega o snapshot v3_payload (gravado por saveQuoteV3)
// para reabrir o orçamento idêntico no editor.
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_STATE, type V3QuoteState } from "../types";

export interface LoadedQuoteV3 {
  state: V3QuoteState;
  quote_number: string;
  public_token: string | null;
  is_locked: boolean;
  status: string;
}

export async function loadQuoteV3(quoteId: string): Promise<LoadedQuoteV3> {
  const { data, error } = await supabase
    .from("quotes")
    .select("id, quote_number, public_token, status, is_locked, v3_payload, client, client_id, product, profit_margin")
    .eq("id", quoteId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Orçamento não encontrado.");

  const payload = (data as unknown as { v3_payload?: V3QuoteState | null }).v3_payload;
  if (!payload || !Array.isArray((payload as V3QuoteState).items)) {
    throw new Error(
      "Este orçamento foi criado em uma versão anterior do sistema e está disponível apenas para visualização. Use o link público para abri-lo.",
    );
  }

  const state: V3QuoteState = {
    ...DEFAULT_STATE,
    ...payload,
    cliente: payload.cliente ?? {
      id: (data as any).client_id ?? null,
      nome: (data as any).client ?? "Cliente Balcão",
    },
    assunto: payload.assunto ?? (data as any).product ?? "",
    margin_pct:
      typeof payload.margin_pct === "number"
        ? payload.margin_pct
        : Number((data as any).profit_margin ?? 20),
    items: Array.isArray(payload.items) ? payload.items : [],
  };

  return {
    state,
    quote_number: (data as any).quote_number,
    public_token: (data as any).public_token ?? null,
    is_locked: !!(data as any).is_locked,
    status: (data as any).status ?? "pending",
  };
}
