// Sugestão inteligente de produto a partir do catálogo + acabamentos.
// Regras simples e determinísticas — sem ML. Retorna no máximo 1 sugestão.

import type { ProductPresetId } from "./productPresets";

const norm = (s: string | null | undefined) =>
  (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const sizeMaxSide = (size: string | null | undefined): number => {
  const m = norm(size).match(/(\d+)\s*[x×]\s*(\d+)/);
  if (!m) return 0;
  return Math.max(parseInt(m[1], 10) || 0, parseInt(m[2], 10) || 0);
};

const grammageNum = (g: string | null | undefined): number => {
  const m = norm(g).match(/(\d{2,4})/);
  return m ? parseInt(m[1], 10) : 0;
};

export interface SuggestInput {
  paper_type: string | null;
  size: string | null;
  grammage: string | null;
  finishings: string[]; // ids dos chips ligados em PrintForm
}

export interface SuggestResult {
  productId: ProductPresetId;
  reason: string;
}

export function suggestProduct(input: SuggestInput): SuggestResult | null {
  const paper = norm(input.paper_type);
  const fins = input.finishings.map(norm);
  const max = sizeMaxSide(input.size);
  const g = grammageNum(input.grammage);

  // Banner: lona/vinil grande
  if (
    (paper.includes("lona") || paper.includes("banner") || paper.includes("vinil")) &&
    (max >= 400 || fins.some((f) => f.includes("ilhos") || f.includes("bastao")))
  ) {
    return { productId: "banner", reason: "Lona com tamanho/acabamento de banner." };
  }

  // Apostila: wire-o / espiral
  if (fins.some((f) => f.includes("wire") || f.includes("espiral"))) {
    return { productId: "apostila", reason: "Acabamento de encadernação detectado." };
  }

  // Adesivo
  if (paper.includes("adesivo")) {
    return { productId: "adesivo", reason: "Papel adesivo selecionado." };
  }

  // Etiqueta: corte especial em formato pequeno
  if (fins.some((f) => f.includes("corte"))) {
    return { productId: "etiqueta", reason: "Corte especial sugere etiqueta." };
  }

  // Cartão de visita: couchê/supremo 250+ em A4
  if (
    (paper.includes("couche") || paper.includes("supremo") || paper.includes("triplex")) &&
    g >= 250
  ) {
    return { productId: "cartao", reason: "Papel rígido típico de cartão de visita." };
  }

  return null;
}
