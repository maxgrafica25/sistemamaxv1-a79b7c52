// =============================================================================
// Perfis de hardware — define limites físicos da impressora/plotter
// =============================================================================

export interface HardwareProfile {
  id: string;
  label: string;
  /** Margens mínimas obrigatórias (mm). */
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  /** Área útil máxima absoluta (mm). null = sem limite extra. */
  maxUsableW: number | null;
  maxUsableH: number | null;
  description: string;
  // ---- Preditor de Prazo Real (PPR) -----------------------------------------
  /** Velocidade média de corte da lâmina (mm/s). null/undefined = sem PPR. */
  bladeSpeedMmPerSec?: number;
  /** Tempo de setup por folha em s (troca + leitura ARMS). */
  sheetSetupSec?: number;
  /** Fator de complexidade extra para shape "personalizado" sobre o bbox. */
  customComplexityFactor?: number;
}

export const HARDWARE_PROFILES: Record<string, HardwareProfile> = {
  generico: {
    id: "generico",
    label: "Genérico (sem restrição)",
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    maxUsableW: null,
    maxUsableH: null,
    description: "Use as margens livremente.",
  },
  signmaster_param: {
    id: "signmaster_param",
    label: "SignMaster paramétrico (folha solta)",
    marginTop: 7,
    marginBottom: 7,
    marginLeft: 7,
    marginRight: 7,
    maxUsableW: null,
    maxUsableH: null,
    description:
      "Spec SignMaster: margens 7mm em todos os lados, gap 3mm, marcas L (topo) + T (base). Para folhas soltas alimentadas manualmente, sem tração contínua.",
    bladeSpeedMmPerSec: 300,
    sheetSetupSec: 12,
    customComplexityFactor: 1.2,
  },
  teneth_a3: {
    id: "teneth_a3",
    label: "Plotter Teneth A3 (rolo / tração)",
    marginTop: 7,
    marginLeft: 7,
    marginRight: 7,
    marginBottom: 80, // tração dos roletes
    maxUsableW: 306,
    maxUsableH: 363,
    description:
      "Margens reais da Teneth A3 em rolo: 7mm topo/laterais, 80mm base (tração dos roletes). Área útil máx 306×363mm na SRA3.",
    bladeSpeedMmPerSec: 300,
    sheetSetupSec: 15,
    customComplexityFactor: 1.2,
  },
};

export const DEFAULT_HARDWARE_ID = "signmaster_param";

/**
 * Aplica restrições do perfil de hardware sobre as margens informadas.
 * Sempre usa o MAIOR valor entre o desejado e o mínimo do hardware.
 */
export function clampMarginsToHardware(
  margins: { marginTop: number; marginBottom: number; marginLeft: number; marginRight: number },
  profile: HardwareProfile,
) {
  return {
    marginTop: Math.max(margins.marginTop, profile.marginTop),
    marginBottom: Math.max(margins.marginBottom, profile.marginBottom),
    marginLeft: Math.max(margins.marginLeft, profile.marginLeft),
    marginRight: Math.max(margins.marginRight, profile.marginRight),
  };
}

/**
 * Calcula área útil efetiva considerando margens E limite máximo do hardware.
 * Retorna a área útil real (mm) que o equipamento consegue trabalhar.
 */
export function effectiveUsableArea(
  sheetW: number,
  sheetH: number,
  margins: { marginTop: number; marginBottom: number; marginLeft: number; marginRight: number },
  profile: HardwareProfile,
) {
  const m = clampMarginsToHardware(margins, profile);
  let usableW = sheetW - m.marginLeft - m.marginRight;
  let usableH = sheetH - m.marginTop - m.marginBottom;
  if (profile.maxUsableW != null) usableW = Math.min(usableW, profile.maxUsableW);
  if (profile.maxUsableH != null) usableH = Math.min(usableH, profile.maxUsableH);
  return { usableW: Math.max(0, usableW), usableH: Math.max(0, usableH), margins: m };
}
