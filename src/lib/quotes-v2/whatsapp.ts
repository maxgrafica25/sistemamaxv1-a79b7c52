// Centralized WhatsApp number for the print shop.
// Override with VITE_WHATSAPP_NUMBER at build time, or edit the fallback below.
const PHONE = (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined) ?? "5511999999999";

const sanitize = (n: string) => n.replace(/\D/g, "");

export const buildWaUrl = (message: string, phoneOverride?: string) => {
  const phone = sanitize(phoneOverride ?? PHONE);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

export const buildApprovalMessage = (params: { quoteNumber: string; optionLabel?: string }) => {
  const opt = params.optionLabel ? `, escolhi a opção de ${params.optionLabel}` : "";
  return `Olá! Analisei o Orçamento ${params.quoteNumber}${opt} e APROVO a produção conforme os detalhes enviados.`;
};

export const buildAdjustMessage = (params: { quoteNumber: string }) =>
  `Olá! Vi o Orçamento ${params.quoteNumber}, mas gostaria de solicitar um ajuste. Podemos falar?`;

export const getShopPhone = () => PHONE;
