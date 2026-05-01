import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useIsFinanceiro } from "@/hooks/useIsFinanceiro";

interface Props {
  quoteId: string;
  quoteNumber: string;
  client: string;
  clientId: string | null;
  product: string;
  totalValue: number;
}

/**
 * Converte um Orçamento V2 em um Pedido de Venda (status 'aberto').
 * Sempre cria como Aberto — só Financeiro pode aprovar depois (na tela de Pedidos).
 */
export function GenerateOrderButton({ quoteId, quoteNumber, client, clientId, product, totalValue }: Props) {
  const navigate = useNavigate();
  const isFinanceiro = useIsFinanceiro();
  const [loading, setLoading] = useState(false);
  const [existingOrderId, setExistingOrderId] = useState<string | null>(null);
  const [existingOrderNumber, setExistingOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("id, order_number")
        .eq("quote_id", quoteId)
        .neq("status", "cancelado")
        .maybeSingle();
      if (mounted && data) {
        setExistingOrderId(data.id);
        setExistingOrderNumber(data.order_number);
      }
    })();
    return () => { mounted = false; };
  }, [quoteId]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      // Carrega itens aprovados do orçamento para virar itens do pedido
      const [matsRes, laborRes, tpRes] = await Promise.all([
        supabase.from("quote_materials").select("*").eq("quote_id", quoteId),
        supabase.from("quote_labor_steps").select("*").eq("quote_id", quoteId),
        supabase.from("quote_third_party").select("*").eq("quote_id", quoteId),
      ]);

      const { data: order, error: orderErr } = await supabase
        .from("sales_orders")
        .insert({
          quote_id: quoteId,
          client_id: clientId,
          client_name: client,
          total_value: totalValue,
          status: "aberto",
          internal_notes: `Gerado a partir do orçamento ${quoteNumber} — ${product}`,
          order_number: "", // gerado pelo trigger set_order_number
        } as any)
        .select("id, order_number")
        .single();

      if (orderErr) throw orderErr;

      // Cria itens do pedido a partir dos materiais
      const items = (matsRes.data ?? []).map((m: any, idx: number) => ({
        order_id: order.id,
        description: m.description,
        quantity: Number(m.quantity),
        unit_price: Number(m.unit_price),
        line_total: Number(m.quantity) * Number(m.unit_price),
        sort_order: m.sort_order ?? idx,
      }));

      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from("sales_order_items").insert(items);
        if (itemsErr) throw itemsErr;
      }

      toast.success(`Pedido ${order.order_number} criado!`, {
        action: {
          label: "Abrir",
          onClick: () => navigate("/pedidos"),
        },
      });
      setExistingOrderId(order.id);
      setExistingOrderNumber(order.order_number);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao gerar pedido: " + (err.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  if (existingOrderId) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-8"
        onClick={() => navigate("/pedidos")}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Pedido {existingOrderNumber}
      </Button>
    );
  }

  return (
    <Button
      variant="default"
      size="sm"
      className="gap-1.5 h-8"
      onClick={handleGenerate}
      disabled={loading}
      title={isFinanceiro ? "Gerar Pedido de Venda" : "Gerar Pedido (aguardará aprovação do Financeiro)"}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShoppingCart className="h-3.5 w-3.5" />}
      Gerar Pedido
    </Button>
  );
}
