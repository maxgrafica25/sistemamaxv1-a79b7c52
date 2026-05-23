// Helpers para o Kit Automático de Encadernação (apostilas).
// - getIdealSpiral: escolhe o diâmetro ideal pelo nº de folhas.
// - spiralRegex / FRONT_COVER_REGEX / BACK_COVER_REGEX / BINDING_LABOR_REGEX:
//   padrões para casar suprimentos/processos pelo nome no cadastro.

export function getIdealSpiral(sheets: number): string {
  const s = Math.max(1, Math.floor(sheets || 1));
  if (s <= 25) return "7mm";
  if (s <= 50) return "9mm";
  if (s <= 70) return "12mm";
  if (s <= 85) return "14mm";
  if (s <= 100) return "17mm";
  if (s <= 120) return "20mm";
  if (s <= 140) return "23mm";
  if (s <= 160) return "25mm";
  if (s <= 200) return "29mm";
  if (s <= 250) return "33mm";
  if (s <= 350) return "40mm";
  return "45mm";
}

/** Regex que casa "espiral ... 12 mm" / "12mm" / "012mm". */
export function spiralRegex(diameter: string): RegExp {
  const num = diameter.replace(/[^\d]/g, "");
  // aceita 0 à frente (ex.: 09mm) e espaço opcional antes de "mm"
  return new RegExp(`espiral.*\\b0?${num}\\s*mm\\b`, "i");
}

export const FRONT_COVER_REGEX = /capa\s*pp.*(line|incolor)/i;
export const BACK_COVER_REGEX  = /capa\s*pp.*(camur[cç]a|preta)/i;

export const BINDING_LABOR_PATTERNS: Array<{ key: "Furação" | "Encadernação"; rx: RegExp }> = [
  { key: "Furação",     rx: /fura[cç][aã]o/i },
  { key: "Encadernação", rx: /encaderna/i },
];
