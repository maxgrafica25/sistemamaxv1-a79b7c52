import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { NewQuoteFormV2 } from "@/components/orcamentos-v2/NewQuoteFormV2";
import { GenerateOrderButton } from "@/components/orcamentos-v2/GenerateOrderButton";
import { supabase } from "@/integrations/supabase/client";

export default function EditQuoteV2() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [meta, setMeta] = useState<{
    quote_number: string;
    client: string;
    client_id: string | null;
    product: string;
    value: number;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("quotes")
        .select("quote_number, client, client_id, product, value")
        .eq("id", id)
        .maybeSingle();
      if (data) {
        setMeta({
          quote_number: data.quote_number,
          client: data.client,
          client_id: data.client_id,
          product: data.product ?? "",
          value: Number(data.value ?? 0),
        });
      }
      // Marca aprovações parciais como vistas pela equipe
      await supabase
        .from("quotes")
        .update({ last_partial_seen_at: new Date().toISOString() })
        .eq("id", id);
    })();
  }, [id]);

  return (
    <div>
      {id && meta && (
        <div className="sticky top-0 z-30 -mx-4 mb-2 flex justify-end gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <GenerateOrderButton
            quoteId={id}
            quoteNumber={meta.quote_number}
            client={meta.client}
            clientId={meta.client_id}
            product={meta.product}
            totalValue={meta.value}
          />
        </div>
      )}
      <NewQuoteFormV2
        quoteId={id}
        onDone={() => navigate("/orcamentos-v2")}
        onCancel={() => navigate("/orcamentos-v2")}
      />
    </div>
  );
}
