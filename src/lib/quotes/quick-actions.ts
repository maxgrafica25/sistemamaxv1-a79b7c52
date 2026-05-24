import { toast } from "sonner";
import { buildTeamFollowUpMessage, buildWaUrl } from "@/lib/quotes/whatsapp";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function copyPublicQuoteLink(quoteNumber: string) {
  const url = `${window.location.origin}/p/${quoteNumber}`;
  navigator.clipboard.writeText(url);
  toast.success("Link público copiado!");
}

export interface QuotePdfData {
  quote_number: string;
  client: string;
  product: string;
  date: string | Date;
  value: number;
}

export function generateQuotePdf(q: QuotePdfData) {
  const html = `<html><head><title>Orçamento ${q.quote_number}</title>
    <style>body{font-family:Arial;padding:40px;color:#333}h1{border-bottom:2px solid #ddd;padding-bottom:10px}.total{font-size:24px;font-weight:bold;text-align:right;margin-top:30px}</style></head>
    <body><h1>Orçamento Nº ${q.quote_number}</h1>
    <p><strong>Cliente:</strong> ${q.client}</p>
    <p><strong>Produto:</strong> ${q.product}</p>
    <p><strong>Data:</strong> ${new Date(q.date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
    <div class="total">VALOR: ${formatBRL(q.value)}</div></body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); w.print(); }
}

export interface QuoteWhatsAppData {
  quoteNumber: string;
  status: string;
  clientName?: string;
  clientPhone?: string | null;
  companyName?: string;
}

export function openWhatsAppForClient(q: QuoteWhatsAppData) {
  if (!q.clientPhone) {
    toast.error("Cliente sem telefone cadastrado.");
    return;
  }
  const message = buildTeamFollowUpMessage({
    quoteNumber: q.quoteNumber,
    status: q.status,
    clientName: q.clientName,
    companyName: q.companyName,
  });
  const url = buildWaUrl(message, q.clientPhone);
  if (!url) {
    toast.error("Telefone do cliente inválido.");
    return;
  }
  window.open(url, "_blank");
}
