// Sugestão de bastão para banners de lona.
// Tamanhos disponíveis e regra de sobra de 1cm por lado para ponteiras.

export const BASTOES_CM = [105, 150, 200] as const;
export const SOBRA_CM = 1;

export interface SugestaoBastao {
  bastao: number;        // tamanho do bastão sugerido (cm)
  quantidade: number;    // quantos bastões serão usados na largura
  emenda: boolean;       // true se a largura exigir emenda
  necessarioCm: number;  // largura útil necessária (largura + 2*sobra)
}

export function sugerirBastao(larguraCm: number): SugestaoBastao | null {
  if (!larguraCm || larguraCm <= 0) return null;
  const necessario = larguraCm + 2 * SOBRA_CM;
  const candidatos = BASTOES_CM.filter((b) => b >= necessario);
  if (candidatos.length > 0) {
    return {
      bastao: Math.min(...candidatos),
      quantidade: 1,
      emenda: false,
      necessarioCm: necessario,
    };
  }
  const maior = BASTOES_CM[BASTOES_CM.length - 1];
  const util = maior - 2 * SOBRA_CM;
  const qtd = Math.max(2, Math.ceil(necessario / util));
  return { bastao: maior, quantidade: qtd, emenda: true, necessarioCm: necessario };
}
