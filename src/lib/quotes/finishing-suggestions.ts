// Sugestões contextuais de acabamentos por tipo de produto.
// Mapa simples: keyword (case-insensitive, substring) → descrições sugeridas.
// Resolvidas contra `processSteps` reais (matching por substring na descrição).

import type { ProcessStep } from "@/components/orcamentos-v3/listing/ProcessPicker";

const RULES: Array<{ match: RegExp; suggest: string[] }> = [
  { match: /apostila/i,                         suggest: ["Furação", "Montagem", "Encadernação espiral", "Refile"] },
  { match: /panfleto|folder|flyer/i,            suggest: ["Refile", "Vinco", "Dobra"] },
  { match: /cart[aã]o|cart[oõ]es/i,             suggest: ["Refile", "Lamina", "Cantos arredondados"] },
  { match: /adesivo|etiqueta/i,                 suggest: ["Refile", "Recorte"] },
  { match: /bloco|tal[aã]o|talao/i,             suggest: ["Colagem", "Numera", "Picote"] },
  { match: /banner|lona/i,                      suggest: ["Acabamento de bordas", "Ilh[óo]s"] },
  { match: /convite|certificado/i,              suggest: ["Refile", "Lamina", "Vinco"] },
  { match: /imã|imagem-?im|imã geladeira/i,     suggest: ["Refile"] },
  { match: /caixa|embalagem/i,                  suggest: ["Vinco", "Faca", "Colagem"] },
];

const DEFAULT_SUGGEST = ["Refile", "Colagem", "Embalagem"];

export interface FinishingSuggestion {
  /** Nome amigável exibido no chip. */
  label: string;
  /** ProcessStep encontrado no cadastro (preferido). */
  step?: ProcessStep;
  /** Quando não há cadastro, é uma sugestão "custom" (cria avulso com 0 min). */
  customName?: string;
}

export function getFinishingSuggestions(
  productKind: string | null | undefined,
  processSteps: ProcessStep[],
): FinishingSuggestion[] {
  const kind = (productKind || "").trim();
  const rule = RULES.find((r) => r.match.test(kind));
  const wanted = rule?.suggest ?? DEFAULT_SUGGEST;

  return wanted.map((label) => {
    const norm = label.toLowerCase();
    const step = processSteps.find((s) => s.description.toLowerCase().includes(norm));
    return step ? { label, step } : { label, customName: label };
  });
}
