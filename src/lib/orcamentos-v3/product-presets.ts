// Favoritos de produto do V3 — chaves usadas para vincular etapas/grupos
// de processos a cada formulário built-in.
export const PRODUCT_PRESETS = [
  { key: "business_card", label: "Cartão de Visita" },
  { key: "flyer", label: "Folheto / Flyer" },
  { key: "booklet", label: "Apostila" },
  { key: "label", label: "Etiqueta" },
  { key: "sticker", label: "Adesivo" },
  { key: "certificate", label: "Certificados 4x0" },
] as const;

export type ProductPresetKey = (typeof PRODUCT_PRESETS)[number]["key"];

export const presetLabel = (key: string) =>
  PRODUCT_PRESETS.find((p) => p.key === key)?.label ?? key;
