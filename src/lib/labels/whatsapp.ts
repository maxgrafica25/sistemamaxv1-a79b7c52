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

/** Formata mm como cm (ex.: 50 → "5", 47 → "4,7"). */
const mmToCm = (mm: number): string => {
  const cm = mm / 10;
  const fixed = cm.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed.replace(".", ",");
};

/** Descrição compacta da etiqueta para o WhatsApp. */
export function describeLabel(
  shape: LabelShape,
  width: number,
  height: number,
): string {
  if (shape === "redondo") return `Redonda ${mmToCm(width)}cm`;
  if (shape === "quadrado") return `Quadrado ${mmToCm(width)}×${mmToCm(height)}cm`;
  return `Personalizada ${mmToCm(width)}×${mmToCm(height)}cm`;
}

export interface WhatsAppQuoteInput {
  qty: number;
  shape: LabelShape;
  width: number;
  height: number;
  pricing: PricingResult;
  ladder: AnchoringTier[];
  /** Etiquetas vendáveis por folha (para mostrar composição). */
  perSheet?: number;
  /** Preço por folha (impressão + acabamento). */
  pricePerSheet?: number;
  /** Descrição da impressão escolhida (ex.: "Adesivo Brilho · 210g · SRA3 · F · color"). */
  printingLabel?: string | null;
  /** Descrição do acabamento escolhido (ex.: "Recorte eletrônico R$ 5,00/folha"). */
  finishingLabel?: string | null;
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

  // Demais faixas (ancoragem) — todas exceto a tier solicitada (qty atual).
  const others = ladder.filter((t) => t.qty !== qty);
  if (others.length > 0) {
    lines.push("", "📊 Outras quantidades:");
    others.forEach((t) => {
      const economy = t.unitDeltaPct < -0.5
        ? ` — ${Math.round(Math.abs(t.unitDeltaPct))}% mais barato`
        : "";
      lines.push(
        `• ${formatInt(t.qty)} un — ${formatBRL(t.total)} (${formatBRL(t.unit)}/un)${economy}`,
      );
    });
    lines.push("", "Quanto maior a quantidade, menor o custo unitário 😉");
  }

  return lines.join("\n");
}

export interface LadderWhatsAppInput {
  shape: LabelShape;
  width: number;
  height: number;
  ladder: AnchoringTier[];
  sheetSize?: string;
  printingLabel?: string | null;
  finishingLabel?: string | null;
}

/**
 * Monta uma mensagem com TODAS as faixas (tabela de ancoragem) — útil para
 * mandar opções ao cliente e deixá-lo escolher.
 */
export function formatLadderWhatsApp(input: LadderWhatsAppInput): string {
  const { shape, width, height, ladder } = input;
  if (!ladder.length) return "";
  const desc = describeLabel(shape, width, height);
  const lines: string[] = [
    "Olá! Segue a tabela de preços por quantidade:",
    "",
    `📋 Etiqueta: ${desc}`,
    "",
  ];

  ladder.forEach((t) => {
    const economy = t.unitDeltaPct < -0.5
      ? ` (${Math.round(Math.abs(t.unitDeltaPct))}% mais barato)`
      : "";
    lines.push(
      `• ${formatInt(t.qty)} un — ${formatBRL(t.total)} (${formatBRL(t.unit)}/un)${economy}`,
    );
  });

  lines.push("", "Quanto maior a quantidade, menor o custo unitário 😉");
  return lines.join("\n");
}
