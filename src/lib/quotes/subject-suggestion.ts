import type { PricingMaterial } from "./pricing";

/**
 * Coleta os productKinds dos itens raiz (sem parentItemId), na ordem,
 * removendo nulos/vazios e duplicatas (case-insensitive).
 */
export function pickProductKinds(materials: PricingMaterial[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of materials) {
    if (m.parentItemId) continue;
    const kind = (m.productKind ?? "").trim();
    if (!kind) continue;
    const key = kind.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kind);
  }
  return out;
}

const MAX_LEN = 80;

function truncate(s: string): string {
  if (s.length <= MAX_LEN) return s;
  return s.slice(0, MAX_LEN - 1).trimEnd() + "…";
}

/**
 * Gera sugestão de Assunto/Projeto a partir dos productKinds dos itens raiz.
 * Formato: só produto(s).
 *  - 1 tipo  → "Cartão de visita"
 *  - 2 tipos → "Cartão de visita + Panfleto"
 *  - 3+      → "Cartão de visita + Panfleto + N outros"
 *  - vazio   → "" (sem sugestão)
 */
export function buildSubjectSuggestion(materials: PricingMaterial[]): string {
  const kinds = pickProductKinds(materials);
  if (kinds.length === 0) return "";
  if (kinds.length === 1) return truncate(kinds[0]);
  if (kinds.length === 2) return truncate(`${kinds[0]} + ${kinds[1]}`);
  const rest = kinds.length - 2;
  return truncate(`${kinds[0]} + ${kinds[1]} + ${rest} ${rest === 1 ? "outro" : "outros"}`);
}
