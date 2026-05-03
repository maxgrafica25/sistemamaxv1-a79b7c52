// Builds the dynamic, structured title for a printing quote item.
// Pure function — no regex, no string parsing of free-text descriptions.
// Sources are the structured catalog attributes already attached to the item.

export const PRODUCT_KIND_OPTIONS = [
  { value: "cartao_visita", label: "Cartão de Visita" },
  { value: "panfleto", label: "Panfleto / Flyer" },
  { value: "folder", label: "Folder" },
  { value: "cartaz", label: "Cartaz" },
  { value: "receituario", label: "Receituário" },
  { value: "tag", label: "Tag" },
  { value: "adesivo", label: "Adesivo" },
  { value: "impresso", label: "Impresso" },
  { value: "outro", label: "Outro (Especificar)" },
] as const;

export type ProductKind = (typeof PRODUCT_KIND_OPTIONS)[number]["value"];

export const productKindLabel = (kind?: string | null): string | undefined => {
  if (!kind) return undefined;
  const o = PRODUCT_KIND_OPTIONS.find((x) => x.value === kind);
  return o?.label;
};

export const colorsFromSide = (side?: string | null): string | undefined => {
  if (!side) return undefined;
  const s = side.trim().toUpperCase();
  if (s === "F/V" || s === "FV" || s === "FRENTE/VERSO") return "4x4";
  if (s === "SIMPLES" || s === "F" || s === "FRENTE") return "4x0";
  return undefined;
};

export interface DynamicTitleParts {
  productKind?: string | null;
  customName?: string | null;
  paperType?: string | null;
  grammage?: string | null;
  size?: string | null;
  side?: string | null;
  finishes?: string[];
}

const cleanPart = (s?: string | null): string | undefined => {
  if (s == null) return undefined;
  const t = String(s).trim();
  return t ? t : undefined;
};

export function buildDynamicTitle(parts: DynamicTitleParts): string {
  const productLabel =
    parts.productKind === "outro"
      ? cleanPart(parts.customName)
      : cleanPart(productKindLabel(parts.productKind));

  const size = cleanPart(parts.size);

  const paperType = cleanPart(parts.paperType);
  const grammage = cleanPart(parts.grammage);
  const paper = paperType && grammage ? `${paperType} ${grammage}` : paperType || grammage;

  const colors = cleanPart(colorsFromSide(parts.side));

  const finishes = (parts.finishes || []).map(cleanPart).filter(Boolean) as string[];
  const finishesPart = finishes.length ? finishes.join(" + ") : undefined;

  return [productLabel, size, paper, colors, finishesPart]
    .filter((p): p is string => Boolean(p))
    .join(" - ");
}
