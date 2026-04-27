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
