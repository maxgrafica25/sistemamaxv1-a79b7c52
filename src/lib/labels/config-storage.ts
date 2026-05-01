// =============================================================================
// Persistência local (localStorage) da Calculadora de Etiquetas
// =============================================================================
// Centraliza tudo numa chave única `labelCalc:config:v1`. Migra silenciosamente
// a chave antiga `labelCalc:lastPricePerSheet` se existir.
//
// SSR-safe: todos os acessos a `window.localStorage` são guardados.
// =============================================================================

import { CUT_DEFAULTS, type CutType, type LabelShape } from "./layout";
import { DEFAULT_HARDWARE_ID, HARDWARE_PROFILES, clampMarginsToHardware } from "./hardware";

export const CONFIG_STORAGE_KEY = "labelCalc:config:v1";
const LEGACY_PRICE_KEY = "labelCalc:lastPricePerSheet";

// ---------- Tipos públicos ---------------------------------------------------

export interface CustomSheetPreset {
  id: string;
  label: string;
  width: number;
  height: number;
}

export interface LabelPreset {
  id: string;
  label: string;
  shape: LabelShape;
  width: number;
  height: number;
}

export interface LabelCalcConfig {
  // Folha
  sheetPresetId: string;
  sheetW: number;
  sheetH: number;
  // Hardware
  hardwareProfileId: string;
  /** Quando true, usuário destravou margens manualmente (override do hardware). */
  marginsUnlocked: boolean;
  // Corte + margens
  cutType: CutType;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  gap: number;
  // Preço
  pricePerSheet: number;
  // Catálogos do usuário
  customSheets: CustomSheetPreset[];
  labelPresets: LabelPreset[];
}

// ---------- Defaults & seeds -------------------------------------------------

export const SEED_LABEL_PRESETS: LabelPreset[] = [
  { id: "seed-lacre-40", label: "Lacre 40×40", shape: "quadrado", width: 40, height: 40 },
  { id: "seed-validade-20", label: "Validade 20×20", shape: "quadrado", width: 20, height: 20 },
  { id: "seed-redonda-50", label: "Redonda Ø50", shape: "redondo", width: 50, height: 50 },
];

export const DEFAULT_CONFIG: LabelCalcConfig = {
  sheetPresetId: "A4",
  sheetW: 210,
  sheetH: 297,
  cutType: "corte_reto",
  marginTop: CUT_DEFAULTS.corte_reto.marginTop,
  marginBottom: CUT_DEFAULTS.corte_reto.marginBottom,
  marginLeft: CUT_DEFAULTS.corte_reto.marginLeft,
  marginRight: CUT_DEFAULTS.corte_reto.marginRight,
  gap: CUT_DEFAULTS.corte_reto.gap,
  pricePerSheet: 0,
  customSheets: [],
  labelPresets: SEED_LABEL_PRESETS,
};

// ---------- Helpers internos -------------------------------------------------

const isBrowser = () => typeof window !== "undefined" && !!window.localStorage;

const safeUUID = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
};

function readRaw(): Partial<LabelCalcConfig> | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function writeRaw(config: LabelCalcConfig) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn("[label-calc] failed to persist config", err);
  }
}

function migrateLegacy(base: LabelCalcConfig): LabelCalcConfig {
  if (!isBrowser()) return base;
  try {
    const legacy = window.localStorage.getItem(LEGACY_PRICE_KEY);
    if (legacy != null) {
      const v = parseFloat(legacy);
      if (Number.isFinite(v) && v > 0 && base.pricePerSheet === 0) {
        base = { ...base, pricePerSheet: v };
      }
      window.localStorage.removeItem(LEGACY_PRICE_KEY);
    }
  } catch {
    /* ignore */
  }
  return base;
}

// ---------- API pública ------------------------------------------------------

/**
 * Carrega configuração merged com defaults. Se for primeira execução,
 * seeda labelPresets e migra a chave antiga de preço.
 */
export function loadConfig(): LabelCalcConfig {
  const stored = readRaw();
  if (!stored) {
    const seeded = migrateLegacy({ ...DEFAULT_CONFIG });
    writeRaw(seeded);
    return seeded;
  }
  const merged: LabelCalcConfig = {
    ...DEFAULT_CONFIG,
    ...stored,
    // Garante que arrays nunca venham como undefined depois do merge
    customSheets: Array.isArray(stored.customSheets) ? stored.customSheets : DEFAULT_CONFIG.customSheets,
    labelPresets: Array.isArray(stored.labelPresets) && stored.labelPresets.length > 0
      ? stored.labelPresets
      : SEED_LABEL_PRESETS,
  };
  return merged;
}

/** Merge raso e persiste. Retorna a config final aplicada. */
export function saveConfig(partial: Partial<LabelCalcConfig>): LabelCalcConfig {
  const current = loadConfig();
  const next: LabelCalcConfig = { ...current, ...partial };
  writeRaw(next);
  return next;
}

// ---------- Catálogos --------------------------------------------------------

export function addLabelPreset(p: Omit<LabelPreset, "id">): LabelPreset {
  const preset: LabelPreset = { ...p, id: safeUUID() };
  const cfg = loadConfig();
  saveConfig({ labelPresets: [...cfg.labelPresets, preset] });
  return preset;
}

export function removeLabelPreset(id: string): void {
  const cfg = loadConfig();
  saveConfig({ labelPresets: cfg.labelPresets.filter((p) => p.id !== id) });
}

export function addCustomSheet(s: Omit<CustomSheetPreset, "id">): CustomSheetPreset {
  const preset: CustomSheetPreset = { ...s, id: safeUUID() };
  const cfg = loadConfig();
  saveConfig({ customSheets: [...cfg.customSheets, preset] });
  return preset;
}

export function removeCustomSheet(id: string): void {
  const cfg = loadConfig();
  saveConfig({ customSheets: cfg.customSheets.filter((s) => s.id !== id) });
}
