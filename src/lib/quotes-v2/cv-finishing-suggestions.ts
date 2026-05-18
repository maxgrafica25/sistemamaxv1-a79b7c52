import type { Acabamento, FamiliaAcabamento, TipoMidia } from "@/lib/cv-calc/engine";
import { filterAndSortForMidia } from "@/lib/cv-calc/media-order";

/**
 * Famílias prioritárias por tipo de mídia.
 * A ordem importa: aparecem como chips "Sugeridos" nessa sequência.
 */
const PRIORITY_BY_TIPO: Record<TipoMidia, FamiliaAcabamento[]> = {
  lona: ["bainha_ilhos", "ilhos", "banner_bastao", "faixa"],
  adesivo: ["recorte", "laminacao", "refile"],
  chapa: ["recorte", "refile"],
  outro: ["refile", "recorte", "laminacao"],
};

export interface CvFinishingSuggestion {
  acabamento: Acabamento;
  label: string;
}

/**
 * Devolve chips de "Sugeridos" para acabamentos CV.
 * - Filtra acabamentos compatíveis com a mídia (via filterAndSortForMidia).
 * - Esconde os já aplicados.
 * - Prioriza famílias típicas do tipo de mídia; preenche com top-N por sort_order.
 */
export function getCvFinishingSuggestions(
  tipo: TipoMidia | null,
  acabamentos: Acabamento[],
  appliedIds: string[],
  maxSuggestions = 4,
): CvFinishingSuggestion[] {
  if (!tipo) return [];
  const applied = new Set(appliedIds);
  const compat = filterAndSortForMidia(acabamentos, tipo).filter((a) => !applied.has(a.id));

  const priorities = PRIORITY_BY_TIPO[tipo] ?? [];
  const picked: Acabamento[] = [];
  const seen = new Set<string>();

  // 1) Por família prioritária (1 por família)
  for (const fam of priorities) {
    const match = compat.find((a) => a.familia === fam && !seen.has(a.id));
    if (match) {
      picked.push(match);
      seen.add(match.id);
      if (picked.length >= maxSuggestions) break;
    }
  }

  // 2) Preenche com primeiros compatíveis restantes
  for (const a of compat) {
    if (picked.length >= maxSuggestions) break;
    if (seen.has(a.id)) continue;
    picked.push(a);
    seen.add(a.id);
  }

  return picked.map((a) => ({ acabamento: a, label: a.nome }));
}
