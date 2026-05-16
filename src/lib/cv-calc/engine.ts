// Calculadora de Comunicação Visual — engine puro.
// Replica a fórmula da Planilha_Orçamentos_2026.xlsx.

export type TipoMidia = "lona" | "adesivo" | "chapa" | "outro";

export type FamiliaAcabamento =
  | "banner_bastao"
  | "faixa"
  | "bainha_ilhos"
  | "ilhos"
  | "emenda"
  | "laminacao"
  | "recorte"
  | "refile"
  | "outro";

export interface Midia {
  id: string;
  nome: string;
  tipo_midia: TipoMidia;
  custo_mt2: number;
  lucro_mt2: number;
  custo_fixo: number;
  lucro_fixo: number;
}

export interface Impressao {
  id: string;
  nome: string;
  custo_mt2: number;
  lucro_mt2: number;
  custo_fixo: number;
  lucro_fixo: number;
  largura_max_cm: number | null;
  comprimento_max_cm: number | null;
  tipos_midia_compativeis: TipoMidia[];
}

export interface Acabamento {
  id: string;
  nome: string;
  familia: FamiliaAcabamento;
  tipos_midia_compativeis: TipoMidia[];
  custo_fixo: number;
  lucro_fixo: number;
  custo_mt2: number;
  lucro_mt2: number;
  custo_perimetro: number;
  lucro_perimetro: number;
  custo_unidade: number;
  lucro_unidade: number;
  largura_max_cm: number | null;
}

export interface CalcInput {
  largura_cm: number;
  altura_cm: number;
  quantidade: number;
  midia: Midia | null;
  impressao: Impressao | null;
  acabamento: Acabamento | null;
  /** Todos os acabamentos disponíveis (necessário para seleção automática de bastão). */
  acabamentos_pool?: Acabamento[];
  valor_minimo: number;
}

export interface InfoBastao {
  tipo: "normal" | "emenda";
  escolhido: string;
  qtd: number;
}

export interface CalcResult {
  area_m2: number;
  perim_m: number;
  acabamento_efetivo: Acabamento | null;
  info_bastao: InfoBastao | null;
  emenda_impressao: boolean;
  preco_midia: number;
  preco_impressao: number;
  preco_acabamento: number;
  subtotal: number;
  aplicou_minimo: boolean;
  valor_unitario: number;
  valor_total: number;
}

const safe = (n: unknown, fallback = 0): number => {
  const v = typeof n === "number" ? n : Number(n);
  return Number.isFinite(v) ? v : fallback;
};

/**
 * Seleciona o bastão ideal pela largura da peça.
 * - Se houver bastão cujo `largura_max_cm >= largura`, escolhe o menor que comporta.
 * - Senão (largura > maior bastão), usa o maior + cobra emenda:
 *   QtdBastões = ceil(largura / largura_max_bastão).
 */
export function selecionarBastao(
  largura_cm: number,
  pool: Acabamento[],
): { acab: Acabamento; info: InfoBastao } | null {
  const bastoes = pool
    .filter((a) => a.familia === "banner_bastao" && a.largura_max_cm != null)
    .sort((a, b) => (a.largura_max_cm ?? 0) - (b.largura_max_cm ?? 0));
  if (bastoes.length === 0) return null;

  const ideal = bastoes.find((b) => largura_cm <= (b.largura_max_cm ?? 0));
  if (ideal) {
    return { acab: ideal, info: { tipo: "normal", escolhido: ideal.nome, qtd: 1 } };
  }
  const maior = bastoes[bastoes.length - 1];
  const qtd = Math.max(1, Math.ceil(largura_cm / (maior.largura_max_cm ?? 1)));
  return { acab: maior, info: { tipo: "emenda", escolhido: maior.nome, qtd } };
}

export function calcular(input: CalcInput): CalcResult {
  const largura = Math.max(0, safe(input.largura_cm));
  const altura = Math.max(0, safe(input.altura_cm));
  const qtd = Math.max(1, Math.floor(safe(input.quantidade, 1)));
  const area = (largura * altura) / 10_000;
  const perim_m = ((largura + altura) * 2) / 100;

  // ── Mídia ─────────────────────────────────────────
  const m = input.midia;
  const preco_midia = m
    ? (m.custo_mt2 + m.lucro_mt2) * area + m.custo_fixo + m.lucro_fixo
    : 0;

  // ── Impressão ────────────────────────────────────
  const i = input.impressao;
  const preco_impressao = i
    ? (i.custo_mt2 + i.lucro_mt2) * area + i.custo_fixo + i.lucro_fixo
    : 0;
  const emenda_impressao =
    !!i && i.largura_max_cm != null && largura > i.largura_max_cm;

  // ── Acabamento (com seleção automática de bastão) ─
  let acab = input.acabamento;
  let info_bastao: InfoBastao | null = null;
  let qtd_unidade = 1;
  if (acab?.familia === "banner_bastao" && input.acabamentos_pool) {
    const pick = selecionarBastao(largura, input.acabamentos_pool);
    if (pick) {
      acab = pick.acab;
      info_bastao = pick.info;
      qtd_unidade = pick.info.qtd;
    }
  }
  const preco_acabamento = acab
    ? (acab.custo_mt2 + acab.lucro_mt2) * area +
      (acab.custo_perimetro + acab.lucro_perimetro) * perim_m +
      (acab.custo_unidade + acab.lucro_unidade) * qtd_unidade +
      acab.custo_fixo +
      acab.lucro_fixo
    : 0;

  // ── Totais ────────────────────────────────────────
  const subtotal = preco_midia + preco_impressao + preco_acabamento;
  const valor_minimo = Math.max(0, safe(input.valor_minimo));
  const com_minimo = Math.max(subtotal, valor_minimo);
  const aplicou_minimo = subtotal < valor_minimo;
  // Arredonda subtotal para 2 casas antes do ceil para evitar imprecisão de ponto flutuante
  const valor_unitario = Math.ceil(Math.round(com_minimo * 100) / 100 - 1e-9);
  const valor_total = valor_unitario * qtd;

  return {
    area_m2: area,
    perim_m,
    acabamento_efetivo: acab,
    info_bastao,
    emenda_impressao,
    preco_midia,
    preco_impressao,
    preco_acabamento,
    subtotal,
    aplicou_minimo,
    valor_unitario,
    valor_total,
  };
}

export const formatBRL = (n: number): string =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
