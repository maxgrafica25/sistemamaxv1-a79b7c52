import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "./payment-terms";

interface OPSource {
  orderId?: string;
  quoteId?: string;
}

/**
 * Gera a Ordem de Produção (PDF) a partir de um Pedido OU de um Orçamento.
 * Layout focado no chão de fábrica: pouco texto, dados grandes, sem valores financeiros.
 */
export async function generateProductionOrderPdf(source: OPSource): Promise<void> {
  let header = {
    op_number: "",
    client: "",
    delivery: "",
    notes: "",
    reference: "",
  };
  let items: Array<{ description: string; quantity: number; notes?: string }> = [];
  let companyName = "Max Gráfica";

  // Carrega dados de empresa
  const { data: comp } = await supabase
    .from("company_settings")
    .select("company_name")
    .maybeSingle();
  if (comp?.company_name) companyName = comp.company_name;

  if (source.orderId) {
    const [orderRes, itemsRes] = await Promise.all([
      supabase.from("sales_orders").select("*").eq("id", source.orderId).single(),
      supabase.from("sales_order_items").select("*").eq("order_id", source.orderId).order("sort_order"),
    ]);
    const o = orderRes.data;
    if (!o) throw new Error("Pedido não encontrado.");
    header = {
      op_number: `OP-${o.order_number}`,
      client: o.client_name,
      delivery: o.delivery_date
        ? new Date(o.delivery_date + "T00:00:00").toLocaleDateString("pt-BR")
        : "—",
      notes: o.production_notes ?? "",
      reference: `Pedido ${o.order_number}`,
    };
    items = (itemsRes.data ?? []).map((it: any) => ({
      description: it.description,
      quantity: Number(it.quantity),
    }));
  } else if (source.quoteId) {
    const [quoteRes, matsRes, laborRes] = await Promise.all([
      supabase.from("quotes").select("*").eq("id", source.quoteId).single(),
      supabase.from("quote_materials").select("*").eq("quote_id", source.quoteId),
      supabase.from("quote_labor_steps").select("*").eq("quote_id", source.quoteId),
    ]);
    const q: any = quoteRes.data;
    if (!q) throw new Error("Orçamento não encontrado.");
    header = {
      op_number: `OP-${q.quote_number ?? q.id.slice(0, 6)}`,
      client: q.client_name ?? q.client ?? "—",
      delivery: q.delivery_date
        ? new Date(q.delivery_date + "T00:00:00").toLocaleDateString("pt-BR")
        : "—",
      notes: q.production_notes ?? q.notes ?? "",
      reference: `Orçamento ${q.quote_number ?? ""}`,
    };
    items = (matsRes.data ?? []).map((m: any) => ({
      description: [m.generated_title || m.description, m.reference ? `Ref.: ${m.reference}` : null]
        .filter(Boolean)
        .join("\n"),
      quantity: Number(m.quantity),
    }));
    if ((laborRes.data ?? []).length > 0) {
      items.push(
        ...(laborRes.data ?? []).map((s: any) => ({
          description: `[Etapa] ${s.step_name ?? s.description ?? ""}`,
          quantity: Number(s.quantity ?? 1),
        })),
      );
    }
  } else {
    throw new Error("Informe orderId ou quoteId.");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ORDEM DE PRODUÇÃO", pageW / 2, 18, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(companyName, pageW / 2, 25, { align: "center" });

  // Faixa do número
  doc.setFillColor(30, 30, 30);
  doc.rect(10, 32, pageW - 20, 12, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(header.op_number, 14, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(header.reference, pageW - 14, 40, { align: "right" });
  doc.setTextColor(0);

  // Bloco cliente / entrega
  let y = 52;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Cliente:", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(header.client, 35, y);

  doc.setFont("helvetica", "bold");
  doc.text("Entrega:", pageW - 60, y);
  doc.setFont("helvetica", "normal");
  doc.text(header.delivery, pageW - 38, y);

  doc.setFont("helvetica", "bold");
  doc.text("Emitido em:", 14, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleString("pt-BR"), 38, y + 6);

  // Tabela de itens (sem valores)
  autoTable(doc, {
    startY: y + 12,
    head: [["#", "Item / Descrição", "Qtd"]],
    body: items.map((it, i) => [String(i + 1), it.description, String(it.quantity)]),
    theme: "grid",
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      2: { cellWidth: 25, halign: "right", fontStyle: "bold" },
    },
  });

  // Observações
  let endY = (doc as any).lastAutoTable?.finalY ?? y + 50;
  endY += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Observações para produção", 14, endY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const notesText = header.notes?.trim() || "—";
  const wrapped = doc.splitTextToSize(notesText, pageW - 28);
  doc.text(wrapped, 14, endY + 6);

  // Rodapé com assinaturas
  const footerY = doc.internal.pageSize.getHeight() - 30;
  doc.setDrawColor(120);
  doc.line(20, footerY, 90, footerY);
  doc.line(pageW - 90, footerY, pageW - 20, footerY);
  doc.setFontSize(9);
  doc.text("Operador", 55, footerY + 5, { align: "center" });
  doc.text("Conferência / Saída", pageW - 55, footerY + 5, { align: "center" });

  doc.save(`${header.op_number}.pdf`);

  // Sem valor financeiro — não disparar formatBRL (mantém import limpo)
  void formatBRL;
}
