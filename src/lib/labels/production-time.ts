// =============================================================================
// Preditor de Prazo Real (PPR) — estimativa de tempo de plotter
// =============================================================================
// Calcula:
//  - Metragem linear total que a lâmina vai percorrer
//  - Tempo de corte + tempo de setup (troca de folha + leitura ARMS)
//  - Badge de carga (pronta-entrega / padrão / intensa)
//
// Constantes vêm do perfil de hardware (src/lib/labels/hardware.ts).
// Se o perfil não tiver `bladeSpeedMmPerSec`, o PPR retorna null e o card
// não é exibido (evita ruído em hardware genérico).
// =============================================================================

import type { HardwareProfile } from "./hardware";

export type LabelShape = "quadrado" | "retangulo" | "redondo" | "personalizado";

export interface ProductionTimeInput {
  shape: LabelShape;
  /** Largura da etiqueta em mm. Para shape "redondo", representa o diâmetro. */
  labelW: number;
  /** Altura da etiqueta em mm. Ignorada para "redondo". */
  labelH: number;
  /** Total de etiquetas no pedido. */
  totalLabels: number;
  /** Total de folhas a processar. */
  sheets: number;
  hardware: HardwareProfile;
}

export interface ProductionTimeResult {
  /** Metragem linear total que a lâmina vai percorrer (m). */
  totalPerimeterM: number;
  /** Tempo apenas de corte (s). */
  cuttingSec: number;
  /** Tempo apenas de setup/troca (s). */
  setupSec: number;
  /** Tempo total estimado (s). */
  totalSec: number;
  loadBadge: "pronta-entrega" | "padrao" | "intensa";
}

/** Perímetro de UMA etiqueta em mm. */
export function perimeterMm(
  shape: LabelShape,
  labelW: number,
  labelH: number,
  customComplexityFactor = 1.2,
): number {
  switch (shape) {
    case "redondo":
      return Math.PI * labelW; // diâmetro = labelW
    case "personalizado":
      return 2 * (labelW + labelH) * customComplexityFactor;
    case "quadrado":
    case "retangulo":
    default:
      return 2 * (labelW + labelH);
  }
}

function pickBadge(totalSec: number): ProductionTimeResult["loadBadge"] {
  if (totalSec <= 15 * 60) return "pronta-entrega";
  if (totalSec <= 60 * 60) return "padrao";
  return "intensa";
}

/**
 * Estima tempo de produção. Retorna `null` quando o perfil de hardware não
 * tem velocidade configurada (ex.: perfil "genérico").
 */
export function estimateProductionTime(
  i: ProductionTimeInput,
): ProductionTimeResult | null {
  const speed = i.hardware.bladeSpeedMmPerSec;
  const setupPerSheet = i.hardware.sheetSetupSec;
  if (!speed || speed <= 0 || setupPerSheet == null) return null;
  if (i.totalLabels <= 0 || i.sheets <= 0) return null;

  const factor = i.hardware.customComplexityFactor ?? 1.2;
  const perim = perimeterMm(i.shape, i.labelW, i.labelH, factor);
  const totalPerimeterMm = perim * i.totalLabels;

  const cuttingSec = totalPerimeterMm / speed;
  const setupSec = i.sheets * setupPerSheet;
  const totalSec = cuttingSec + setupSec;

  return {
    totalPerimeterM: totalPerimeterMm / 1000,
    cuttingSec,
    setupSec,
    totalSec,
    loadBadge: pickBadge(totalSec),
  };
}

/** Formata segundos em texto curto: "12 min", "1 h 24 min", "45 s". */
export function formatDuration(sec: number): string {
  if (sec < 60) return `${Math.round(sec)} s`;
  const totalMin = Math.round(sec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
