// Builds the dynamic, structured title for a printing quote item.
// Pure function — no regex, no string parsing of free-text descriptions.
// Sources are the structured catalog attributes already attached to the item.

// Sugestões de "Tipo de Material" para o autocomplete. O usuário pode escolher
// uma sugestão padronizada ou digitar o seu próprio nome — o campo é livre.
export const PRODUCT_KIND_SUGGESTIONS = [
  "Panfletos",
  "Cartões de Visita",
  "Tags",
  "Apostilas",
  "Cartazes",
  "Folders",
  "Receituários",
  "Adesivos",
  "Convites",
  "Blocos",
  "Etiquetas",
  "Impressos",
] as const;

// Mantido por compatibilidade com código legado (usado por imports antigos).
// Cada sugestão vira uma opção {value, label} idêntica ao texto.
export const PRODUCT_KIND_OPTIONS = PRODUCT_KIND_SUGGESTIONS.map((s) => ({
  value: s,
  label: s,
}));

export type ProductKind = string;

export const productKindLabel = (kind?: string | null): string | undefined => {
  if (!kind) return undefined;
  return kind.trim() || undefined;
};

export const PRINT_COLOR_OPTIONS = ["4x4", "4x0", "1x1", "1x0"] as const;
export type PrintColors = (typeof PRINT_COLOR_OPTIONS)[number];

export const colorsFromSide = (side?: string | null): string | undefined => {
  if (!side) return undefined;
  const s = side.trim().toUpperCase();
  if (s === "F/V" || s === "FV" || s === "FRENTE/VERSO") return "4x4";
  if (s === "SIMPLES" || s === "F" || s === "FRENTE") return "4x0";
  return undefined;
};

// Frente/verso ou simples derivado da cor de impressão (usado para multiplicadores de preço).
export const sideFromPrintColors = (
  pc?: string | null,
): "F/V" | "Simples" | undefined => {
  if (!pc) return undefined;
  const s = pc.trim().toLowerCase();
  if (s === "4x4" || s === "1x1") return "F/V";
  if (s === "4x0" || s === "1x0") return "Simples";
  return undefined;
};

export interface DynamicTitleParts {
  productKind?: string | null;
  customName?: string | null;
  paperType?: string | null;
  grammage?: string | null;
  size?: string | null;
  side?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  printColors?: string | null;
  finishes?: string[]; // mantido por compatibilidade — ignorado na descrição padronizada
  bookletPages?: number | null;
  bookletUnits?: number | null;
}

export const isApostilaKind = (kind?: string | null): boolean => {
  const k = (kind || "").trim().toLowerCase();
  return k.startsWith("apostila");
};

const cleanPart = (s?: string | null): string | undefined => {
  if (s == null) return undefined;
  const t = String(s).trim();
  return t ? t : undefined;
};

// Converte mm → cm com até 2 decimais, vírgula como separador, sem zeros à direita.
const mmToCmLabel = (mm?: number | null): string | undefined => {
  if (mm == null || !isFinite(mm) || mm <= 0) return undefined;
  const cm = mm / 10;
  const rounded = Math.round(cm * 100) / 100;
  // Remove zeros à direita
  let s = rounded.toFixed(2);
  s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s.replace(".", ",");
};

/**
 * Gera a descrição padronizada que vai para o cliente.
 *
 * Formato: "<Tipo> <L>x<H>cm. Impressão <Cor>, <Papel> <Gramatura>"
 * Exemplo: "Panfleto 10x15cm. Impressão 4x4, Couchê 210g"
 *
 * Acabamentos NÃO entram nesta string — eles continuam sendo listados
 * separadamente abaixo do título no viewer do cliente.
 */
export function buildDynamicTitle(parts: DynamicTitleParts): string {
  const productLabel =
    cleanPart(parts.productKind) || cleanPart(parts.customName);

  const wLabel = mmToCmLabel(parts.widthMm ?? null);
  const hLabel = mmToCmLabel(parts.heightMm ?? null);
  const sizeLabel =
    wLabel && hLabel ? `${wLabel}x${hLabel}cm` : cleanPart(parts.size);

  const colors =
    cleanPart(parts.printColors) || cleanPart(colorsFromSide(parts.side));

  const paperType = cleanPart(parts.paperType);
  const grammage = cleanPart(parts.grammage);
  const paper =
    paperType && grammage ? `${paperType} ${grammage}` : paperType || grammage;

  // Monta "<Tipo> <Tamanho>"
  const head = [productLabel, sizeLabel].filter(Boolean).join(" ");

  // Monta "Impressão <Cor>, <Papel>"
  const tailParts: string[] = [];
  if (colors) tailParts.push(`Impressão ${colors}`);
  if (paper) tailParts.push(paper);
  const tail = tailParts.join(", ");

  let result = head && tail ? `${head}. ${tail}` : head || tail;

  // Sufixo específico de apostila: "· N págs × M un"
  if (isApostilaKind(parts.productKind)) {
    const pgs = parts.bookletPages && parts.bookletPages > 0 ? parts.bookletPages : null;
    const uns = parts.bookletUnits && parts.bookletUnits > 0 ? parts.bookletUnits : null;
    if (pgs && uns) {
      result = result ? `${result} · ${pgs} págs × ${uns} un` : `${pgs} págs × ${uns} un`;
    }
  }

  return result;
}
