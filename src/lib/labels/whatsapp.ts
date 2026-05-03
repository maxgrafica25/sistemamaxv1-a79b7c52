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

export type LabelPaperKind = "adesivo" | "papel";

const itemNoun = (kind?: LabelPaperKind) =>
  kind === "papel" ? "impressos" : "etiquetas";

export interface WhatsAppQuoteInput {
  qty: number;
  shape: LabelShape;
  width: number;
  height: number;
  pricing: PricingResult;
  ladder: AnchoringTier[];
  /** Tipo do material (adesivo vs papel) — define o substantivo na mensagem. */
  paperKind?: LabelPaperKind;
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
  const { qty, shape, width, height, pricing, ladder, paperKind } = input;

  const desc = describeLabel(shape, width, height);
  const noun = itemNoun(paperKind);
  const lines: string[] = [
    `Olá! Segue orçamento de ${noun}:`,
    "",
    `📋 Pedido: ${formatInt(qty)} un · ${desc}`,
    `💰 Total: ${formatBRL(pricing.totalPrice)}`,
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
        `• ${formatInt(t.qty)} un — ${formatBRL(t.total)}${economy}`,
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
  /** Quantidade solicitada pelo cliente. */
  qty: number;
  paperKind?: LabelPaperKind;
  sheetSize?: string;
  printingLabel?: string | null;
  finishingLabel?: string | null;
}

/**
 * Monta a mensagem com a quantidade solicitada + 2 sugestões de upgrade
 * (intermediária e ~dobro da solicitada) para reforçar custo-benefício.
 */
export function formatLadderWhatsApp(input: LadderWhatsAppInput): string {
  const { shape, width, height, ladder, qty, paperKind } = input;
  if (!ladder.length) return "";

  // Tier solicitado: match exato ou o mais próximo de qty.
  const requested =
    ladder.find((t) => t.qty === qty) ??
    [...ladder].sort((a, b) => Math.abs(a.qty - qty) - Math.abs(b.qty - qty))[0];

  const larger = ladder.filter((t) => t.qty > requested.qty);
  // Dobro: primeiro tier >= 2x qty (ou o maior disponível).
  const doubleTier =
    larger.find((t) => t.qty >= requested.qty * 2) ??
    larger[larger.length - 1];
  // Intermediário: entre requested e double (exclusivo).
  const between = larger.filter((t) => doubleTier && t.qty < doubleTier.qty);
  const intermediate = between.length
    ? between[Math.floor(between.length / 2)]
    : null;

  const picks: AnchoringTier[] = [requested];
  if (intermediate && intermediate.qty !== requested.qty) picks.push(intermediate);
  if (doubleTier && !picks.some((p) => p.qty === doubleTier.qty)) picks.push(doubleTier);

  const desc = describeLabel(shape, width, height);
  const headNoun = paperKind === "papel" ? "Impresso" : "Etiqueta";
  const lines: string[] = [
    "Olá! Segue o orçamento solicitado e algumas sugestões com melhor custo-benefício:",
    "",
    `📋 ${headNoun}: ${desc}`,
    "",
    `✅ Quantidade solicitada:`,
    `• ${formatInt(requested.qty)} un — ${formatBRL(requested.total)}`,
  ];

  const upgrades = picks.slice(1);
  if (upgrades.length) {
    lines.push("", "💡 Sugestões com melhor custo-benefício:");
    upgrades.forEach((t) => {
      const economy = t.unitDeltaPct < -0.5
        ? ` (${Math.round(Math.abs(t.unitDeltaPct))}% mais barato por unidade)`
        : "";
      lines.push(`• ${formatInt(t.qty)} un — ${formatBRL(t.total)}${economy}`);
    });
  }

  lines.push("", "Quanto maior a quantidade, menor o custo unitário 😉");
  return lines.join("\n");
}

