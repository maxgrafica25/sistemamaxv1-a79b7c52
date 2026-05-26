import { toast } from "sonner";
import { buildTeamFollowUpMessage, buildWaUrl } from "@/lib/quotes/whatsapp";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PREVIEW_HOST_PATTERNS = [/lovable\.app$/i, /lovableproject\.com$/i, /^id-preview--/i];

const isPreviewHost = (hostname: string): boolean => {
  // sistemamaxv1.lovable.app é a publicação válida — não tratar como preview.
  if (hostname === "sistemamaxv1.lovable.app") return false;
  return PREVIEW_HOST_PATTERNS.some((re) => re.test(hostname));
};

/**
 * Resolve a base URL pública para links de orçamento.
 * - Se `configuredBaseUrl` (de company_settings) estiver definida, usa ela.
 * - Senão, se estiver rodando em um host de preview/editor do Lovable, retorna null
 *   (o caller deve mostrar erro — link ficaria atrás de login).
 * - Caso contrário usa `window.location.origin` (domínio próprio em produção).
 */
export function resolvePublicBaseUrl(configuredBaseUrl?: string | null): string | null {
  const trimmed = (configuredBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (trimmed) return trimmed;
  if (typeof window === "undefined") return null;
  if (isPreviewHost(window.location.hostname)) return null;
  return window.location.origin;
}

export function buildPublicQuoteUrl(quoteNumber: string, configuredBaseUrl?: string | null): string | null {
  const base = resolvePublicBaseUrl(configuredBaseUrl);
  if (!base) return null;
  return `${base}/p/${quoteNumber}`;
}

export function copyPublicQuoteLink(quoteNumber: string, configuredBaseUrl?: string | null) {
  const url = buildPublicQuoteUrl(quoteNumber, configuredBaseUrl);
  if (!url) {
    toast.error(
      "Configure a URL pública do sistema em Configurações → Empresa para gerar links de orçamento.",
    );
    return;
  }
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

const escapeHtml = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function generateQuotePdf(q: QuotePdfData) {
  const numberSafe = escapeHtml(q.quote_number);
  const clientSafe = escapeHtml(q.client);
  const productSafe = escapeHtml(q.product);
  const dateSafe = escapeHtml(
    new Date(q.date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  );
  const valueSafe = escapeHtml(formatBRL(q.value));
  const html = `<html><head><title>Orçamento ${numberSafe}</title>
    <style>body{font-family:Arial;padding:40px;color:#333}h1{border-bottom:2px solid #ddd;padding-bottom:10px}.total{font-size:24px;font-weight:bold;text-align:right;margin-top:30px}</style></head>
    <body><h1>Orçamento Nº ${numberSafe}</h1>
    <p><strong>Cliente:</strong> ${clientSafe}</p>
    <p><strong>Produto:</strong> ${productSafe}</p>
    <p><strong>Data:</strong> ${dateSafe}</p>
    <div class="total">VALOR: ${valueSafe}</div></body></html>`;
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
