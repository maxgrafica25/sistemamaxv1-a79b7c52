// =============================================================================
// WhatsApp Quote Formatter
// =============================================================================
// Função pura que monta o texto pronto para colar no WhatsApp a partir do
// resultado da calculadora. Sem dependências de React/UI.
// =============================================================================

import type { LabelShape } from "./layout";
import type { PricingResult } from "./layout";
import type { AnchoringTier } from "./layout";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatInt = (n: number) => n.toLocaleString("pt-BR");

/** Descrição compacta da etiqueta para o WhatsApp. */
export function describeLabel(
  shape: LabelShape,
  width: number,
  height: number,
): string {
  if (shape === "redondo") return `Redonda Ø${width}mm`;
  if (shape === "quadrado") return `Quadrado ${width}×${height}mm`;
  return `Personalizada ${width}×${height}mm`;
}

export interface WhatsAppQuoteInput {
  qty: number;
  shape: LabelShape;
  width: number;
  height: number;
  pricing: PricingResult;
  ladder: AnchoringTier[];
}

/**
 * Monta a mensagem completa. O tier "ideal" só entra se existir e for
 * efetivamente mais barato (unitDeltaPct < 0).
 */
export function formatWhatsAppQuote(input: WhatsAppQuoteInput): string {
  const { qty, shape, width, height, pricing, ladder } = input;

  const desc = describeLabel(shape, width, height);
  const lines: string[] = [
    "Olá! Segue orçamento de etiquetas:",
    "",
    `📋 Pedido: ${formatInt(qty)} un · ${desc}`,
    `💰 Total: ${formatBRL(pricing.totalPrice)} (${formatBRL(pricing.unitPrice)}/un)`,
  ];

  const ideal = ladder.find((t) => t.label === "ideal");
  if (ideal && ideal.unitDeltaPct < 0) {
    const economyPct = Math.round(Math.abs(ideal.unitDeltaPct));
    lines.push(
      "",
      `✨ Sugestão: ${formatInt(ideal.qty)} un por ${formatBRL(ideal.total)} (${formatBRL(ideal.unit)}/un — ${economyPct}% mais barato)`,
    );
  }

  return lines.join("\n");
}
