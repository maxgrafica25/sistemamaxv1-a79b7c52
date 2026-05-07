// WhatsApp link builders. The shop phone number now lives in the
// `company_settings` table (read via `useCompanySettings`). No global
// fallback — callers MUST pass an explicit phone, otherwise the link
// returns empty (so callers can disable the CTA).

const sanitize = (n: string) => (n || "").replace(/\D/g, "");

export const buildWaUrl = (message: string, phone: string): string => {
  const clean = sanitize(phone);
  if (!clean) return "";
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
};

/** Link direto para WhatsApp Web (desktop). Não passa pelo prompt "abrir app". */
export const buildWaWebUrl = (message: string, phone: string): string => {
  const clean = sanitize(phone);
  if (!clean) return "";
  return `https://web.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(message)}`;
};

export const buildApprovalMessage = (params: {
  quoteNumber: string;
  optionLabel?: string;
  clientName?: string;
  companyName?: string;
}) => {
  const greeting = params.companyName ? `Olá ${params.companyName}!` : "Olá!";
  const who = params.clientName ? ` Aqui é ${params.clientName}.` : "";
  const opt = params.optionLabel ? `, escolhi a opção de ${params.optionLabel}` : "";
  return `${greeting}${who} Analisei o Orçamento ${params.quoteNumber}${opt} e APROVO a produção conforme os detalhes enviados.`;
};

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const buildPartialApprovalMessage = (params: {
  quoteNumber: string;
  items: Array<{ description: string; value: number }>;
  total: number;
  clientName?: string;
  companyName?: string;
  /** Quando true, gera mensagem de aprovação integral (todos os itens pendentes). */
  isFullApproval?: boolean;
}) => {
  const greeting = params.companyName ? `Olá ${params.companyName}!` : "Olá!";
  const who = params.clientName ? ` Aqui é ${params.clientName}.` : "";
  if (params.isFullApproval) {
    return `${greeting}${who} Analisei o Orçamento ${params.quoteNumber} e APROVO a produção na íntegra, conforme os detalhes enviados.\n\n*Total aprovado: ${formatBRL(params.total)}*\n\nPodem dar andamento.`;
  }
  const itemsList = params.items
    .map((it, i) => `${i + 1}. ${it.description} — ${formatBRL(it.value)}`)
    .join("\n");
  return `${greeting}${who} Aprovo os seguintes itens do Orçamento ${params.quoteNumber}:\n\n${itemsList}\n\n*Total aprovado: ${formatBRL(params.total)}*\n\nPodem dar andamento à produção destes itens.`;
};

export const buildAdjustMessage = (params: {
  quoteNumber: string;
  clientName?: string;
  companyName?: string;
}) => {
  const greeting = params.companyName ? `Olá ${params.companyName}!` : "Olá!";
  const who = params.clientName ? ` Aqui é ${params.clientName}.` : "";
  return `${greeting}${who} Vi o Orçamento ${params.quoteNumber}, mas gostaria de solicitar um ajuste. Podemos falar?`;
};

export const buildItemAdjustMessage = (params: {
  quoteNumber: string;
  itemDescription: string;
  clientName?: string;
  companyName?: string;
}) => {
  const greeting = params.companyName ? `Olá ${params.companyName}!` : "Olá!";
  const who = params.clientName ? ` Aqui é ${params.clientName}.` : "";
  return `${greeting}${who} Sobre o item "${params.itemDescription}" do Orçamento ${params.quoteNumber}, gostaria de solicitar uma alteração. Podemos falar?`;
};

// ─── Comunicação Visual ────────────────────────────────
export interface CVProposalItem {
  description: string;   // Ex: "Lona Brilho 440g (90×120cm) c/ Ilhós ×4"
  value: number;
}

export const buildCVProposalMessage = (params: {
  quoteNumber: string;
  items: CVProposalItem[];
  total: number;
  clientName?: string;
  companyName?: string;
}) => {
  const greeting = params.companyName ? `Olá ${params.companyName}!` : "Olá!";
  const who = params.clientName ? ` Aqui é ${params.clientName}.` : "";
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const lines = params.items
    .map((it, i) => `📦 *Item ${i + 1}:* ${it.description} — *${fmt(it.value)}*`)
    .join("\n");
  return `${greeting}${who} Segue a proposta de Comunicação Visual ${params.quoteNumber}:\n\n${lines}\n─────────────\n💰 *Total: ${fmt(params.total)}*`;
};
