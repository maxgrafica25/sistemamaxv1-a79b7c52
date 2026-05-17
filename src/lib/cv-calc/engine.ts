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

export type PricingMode = "manual" | "recipe";

export type ConsumoTipo =
  | "por_peca"
  | "por_perimetro_m"
  | "por_mt2"
  | "por_largura_m"
  | "por_altura_m";

export interface RecipeItem {
  supply_id: string;
  /** Custo unitário do suprimento (R$ por unidade do suprimento). */
  supply_custo_unitario: number;
  consumo_qty: number;
  consumo_tipo: ConsumoTipo;
}

export type LaborConsumoTipo = ConsumoTipo | "fixo";

export interface LaborItem {
  /** Etapa de produção vinculada (opcional). */
  production_step_id?: string | null;
  descricao: string;
  /** Tempo em minutos por unidade da escala. */
  time_minutes: number;
  consumo_tipo: LaborConsumoTipo;
  consumo_qty: number;
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
  /** Modo de precificação. Default "manual" (campos custo_* e lucro_*). */
  pricing_mode?: PricingMode;
  /** Margem total (%) que sobrescreve o markup global; null = usa global. */
  markup_override_pct?: number | null;
  /** Custos extras (mão-de-obra, insumos não cadastrados) — modo receita. */
  extra_cost_fixo?: number;
  extra_cost_mt2?: number;
  extra_cost_perimetro?: number;
  extra_cost_unidade?: number;
  /** Receita (lista de suprimentos × consumo) — modo receita. */
  recipe?: RecipeItem[];
  /** Mão-de-obra (etapas de produção × tempo). Calculado em runtime com hourRate. */
  labor?: LaborItem[];
}

/** Markup global do ERP (mesma fórmula do Orçamentos v2). */
export interface MarkupSettings {
  tax_pct: number;
  invoice_pct: number;
  credit_card_pct: number;
  collection_fee_pct: number;
  default_margin_pct: number;
}

/** Acabamento aplicado pode ter quantidade customizada de unidades. */
export interface AcabamentoAplicado {
  acabamento: Acabamento;
  /** Para acabamentos que somam por unidade (ilhós, parafusos, bastões). Default: auto. */
  qtd_unidades?: number;
}

/** Sangria (margem de bleed) em milímetros por tipo de mídia.
 *  Somada a cada dimensão antes do cálculo de área e perímetro,
 *  replicando o comportamento da planilha (CONFIGURACOES!E8..E10).
 */
export type SangriasMm = Partial<Record<TipoMidia, number>>;

export interface CalcInput {
  largura_cm: number;
  altura_cm: number;
  quantidade: number;
  midia: Midia | null;
  impressao: Impressao | null;
  /** Um único acabamento (modo calculadora simples) — mantido para retro-compat. */
  acabamento?: Acabamento | null;
  /** Vários acabamentos (modo orçamento). Se ambos forem informados, este prevalece. */
  acabamentos?: AcabamentoAplicado[];
  /** Pool de acabamentos disponíveis (para seleção automática de bastão). */
  acabamentos_pool?: Acabamento[];
  valor_minimo: number;
  /** Sangria por tipo de mídia (mm). Default: 0 para todos. */
  sangrias_mm?: SangriasMm;
  /** Markup global (impostos + cartão + comissão + margem) — usado no modo "recipe". */
  markup?: MarkupSettings;
  /** Custo/hora produtivo (R$/h) — usado p/ calcular MO via labor items. */
  hourRate?: number;
}

export interface InfoBastao {
  tipo: "normal" | "emenda";
  escolhido: string;
  qtd: number;
}

export interface AcabamentoResult {
  acabamento_id: string;
  nome: string;
  familia: FamiliaAcabamento;
  preco: number;
  custo: number;
  info_bastao?: InfoBastao;
}

export interface CalcResult {
  area_m2: number;
  perim_m: number;
  /** Acabamento principal efetivo (após seleção automática de bastão) — modo simples. */
  acabamento_efetivo: Acabamento | null;
  info_bastao: InfoBastao | null;
  emenda_impressao: boolean;
  preco_midia: number;
  preco_impressao: number;
  preco_acabamento: number;
  /** Quebra por acabamento (modo múltiplo). */
  acabamentos_detalhe: AcabamentoResult[];
  subtotal: number;
  custo_total: number;
  lucro_liquido: number;
  margem_pct: number;
  aplicou_minimo: boolean;
  valor_unitario: number;
  valor_total: number;
  /** Sangria aplicada na peça (mm) — informativo para a UI. */
  sangria_aplicada_mm: number;
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

/** Arredonda para cima ao próximo R$ 0,10 — regra global de preço. */
const roundUpToTenCents = (n: number): number => {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n * 10 - 1e-9) / 10;
};

/** Calcula o preço de um único acabamento aplicado à peça.
 *  Em modo "manual" usa custo_* e lucro_* exatamente como antes.
 *  Em modo "recipe" soma custo_supply×consumo + extras e aplica o markup
 *  global (ou override), usando engenharia reversa: preço = custo/(1 - markup). */
function precificarAcabamento(
  ac: Acabamento,
  area: number,
  perim_m: number,
  qtd_unidades: number,
  largura_m: number,
  altura_m: number,
  qtd_pecas: number,
  markup?: MarkupSettings,
): { preco: number; custo: number } {
  if (ac.pricing_mode === "recipe") {
    // 1) Soma custos da receita por peça × qtd
    let custo_recipe_por_peca = 0;
    for (const r of ac.recipe ?? []) {
      let consumo_por_peca = 0;
      switch (r.consumo_tipo) {
        case "por_peca":         consumo_por_peca = r.consumo_qty; break;
        case "por_perimetro_m":  consumo_por_peca = r.consumo_qty * (perim_m / Math.max(1, qtd_pecas)); break;
        case "por_mt2":          consumo_por_peca = r.consumo_qty * (area / Math.max(1, qtd_pecas)); break;
        case "por_largura_m":    consumo_por_peca = r.consumo_qty * largura_m; break;
        case "por_altura_m":     consumo_por_peca = r.consumo_qty * altura_m; break;
      }
      custo_recipe_por_peca += consumo_por_peca * safe(r.supply_custo_unitario);
    }
    const custo_recipe = custo_recipe_por_peca * qtd_pecas;

    // 2) Custos extras (mão-de-obra etc.)
    const custo_extras =
      safe(ac.extra_cost_fixo) +
      safe(ac.extra_cost_mt2) * area +
      safe(ac.extra_cost_perimetro) * perim_m +
      safe(ac.extra_cost_unidade) * qtd_unidades;

    const custo = custo_recipe + custo_extras;

    // 3) Markup total (impostos + cartão + comissão + margem) — engenharia reversa
    const totalPct = ac.markup_override_pct != null
      ? safe(ac.markup_override_pct)
      : (markup
          ? safe(markup.tax_pct) + safe(markup.invoice_pct) + safe(markup.credit_card_pct) +
            safe(markup.collection_fee_pct) + safe(markup.default_margin_pct)
          : 0);
    const divisor = Math.max(0.01, 1 - totalPct / 100);
    const preco = roundUpToTenCents(custo / divisor);
    return { preco, custo };
  }

  // Modo manual (default) — comportamento original intacto.
  const preco =
    (ac.custo_mt2 + ac.lucro_mt2) * area +
    (ac.custo_perimetro + ac.lucro_perimetro) * perim_m +
    (ac.custo_unidade + ac.lucro_unidade) * qtd_unidades +
    ac.custo_fixo +
    ac.lucro_fixo;
  const custo =
    ac.custo_mt2 * area +
    ac.custo_perimetro * perim_m +
    ac.custo_unidade * qtd_unidades +
    ac.custo_fixo;
  return { preco, custo };
}

export function calcular(input: CalcInput): CalcResult {
  const largura_in = Math.max(0, safe(input.largura_cm));
  const altura_in = Math.max(0, safe(input.altura_cm));
  const qtd = Math.max(1, Math.floor(safe(input.quantidade, 1)));

  // Sangria por tipo de mídia (mm → cm). Somada a cada dimensão,
  // replicando AK15 da planilha: (W + sangria) × (H + sangria).
  const tipo = input.midia?.tipo_midia;
  const sangria_mm = Math.max(0, safe(tipo ? input.sangrias_mm?.[tipo] : 0));
  const sangria_cm = sangria_mm / 10;
  const largura = largura_in > 0 ? largura_in + sangria_cm : 0;
  const altura = altura_in > 0 ? altura_in + sangria_cm : 0;

  // Modelo "job único": área/perímetro escalam com a quantidade;
  // custos fixos (setup) permanecem únicos.
  const area_un = (largura * altura) / 10_000;
  const perim_un_m = ((largura + altura) * 2) / 100;
  const area = area_un * qtd;
  const perim_m = perim_un_m * qtd;

  // ── Mídia ─────────────────────────────────────────
  const m = input.midia;
  const preco_midia = m
    ? (m.custo_mt2 + m.lucro_mt2) * area + m.custo_fixo + m.lucro_fixo
    : 0;
  const custo_midia = m ? m.custo_mt2 * area + m.custo_fixo : 0;

  // ── Impressão ────────────────────────────────────
  const i = input.impressao;
  const preco_impressao = i
    ? (i.custo_mt2 + i.lucro_mt2) * area + i.custo_fixo + i.lucro_fixo
    : 0;
  const custo_impressao = i ? i.custo_mt2 * area + i.custo_fixo : 0;
  const emenda_impressao =
    !!i && i.largura_max_cm != null && largura_in > i.largura_max_cm;

  // ── Acabamento(s) ─────────────────────────────────
  // Modo múltiplo (orçamento) tem prioridade sobre modo simples (calculadora).
  const acabamentos_detalhe: AcabamentoResult[] = [];
  let preco_acabamento = 0;
  let custo_acabamento = 0;
  let acabamento_efetivo: Acabamento | null = null;
  let info_bastao: InfoBastao | null = null;

  const aplicados: AcabamentoAplicado[] = (() => {
    if (input.acabamentos && input.acabamentos.length > 0) return input.acabamentos;
    if (input.acabamento) return [{ acabamento: input.acabamento }];
    return [];
  })();

  for (const ap of aplicados) {
    let ac = ap.acabamento;
    // Por unidade (ilhós ×4 = 4 por peça). Total no job = qtd_un_por_peca × qtd.
    let qtd_un_por_peca = ap.qtd_unidades ?? 1;
    let inf: InfoBastao | undefined;

    // Auto-seleção de bastão na família banner_bastao
    if (ac.familia === "banner_bastao" && input.acabamentos_pool) {
      const pick = selecionarBastao(largura_in, input.acabamentos_pool);
      if (pick) {
        ac = pick.acab;
        inf = pick.info;
        qtd_un_por_peca = pick.info.qtd; // 1 bastão por peça (ou N em caso de emenda)
        if (!acabamento_efetivo) {
          acabamento_efetivo = ac;
          info_bastao = pick.info;
        }
      }
    } else if (!acabamento_efetivo) {
      acabamento_efetivo = ac;
    }

    const qtd_unidades_total = qtd_un_por_peca * qtd;
    const { preco, custo } = precificarAcabamento(
      ac, area, perim_m, qtd_unidades_total,
      largura / 100, altura / 100, qtd, input.markup,
    );
    preco_acabamento += preco;
    custo_acabamento += custo;
    acabamentos_detalhe.push({
      acabamento_id: ac.id,
      nome: ac.nome,
      familia: ac.familia,
      preco,
      custo,
      info_bastao: inf,
    });
  }

  // ── Totais (já são o total do job) ────────────────
  const subtotal = preco_midia + preco_impressao + preco_acabamento;
  const valor_minimo = Math.max(0, safe(input.valor_minimo));
  const com_minimo = Math.max(subtotal, valor_minimo);
  const aplicou_minimo = subtotal < valor_minimo;
  // Arredonda para 2 casas antes do ceil para evitar imprecisão de ponto flutuante
  const valor_total = Math.ceil(Math.round(com_minimo * 100) / 100 - 1e-9);
  const valor_unitario = qtd > 0 ? valor_total / qtd : valor_total;
  const custo_total = custo_midia + custo_impressao + custo_acabamento;
  const lucro_liquido = subtotal - custo_total;
  const margem_pct = subtotal > 0 ? (lucro_liquido / subtotal) * 100 : 0;

  return {
    area_m2: area,
    perim_m,
    acabamento_efetivo,
    info_bastao,
    emenda_impressao,
    preco_midia,
    preco_impressao,
    preco_acabamento,
    acabamentos_detalhe,
    subtotal,
    custo_total,
    lucro_liquido,
    margem_pct,
    aplicou_minimo,
    valor_unitario,
    valor_total,
    sangria_aplicada_mm: sangria_mm,
  };
}

export const formatBRL = (n: number): string =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ────────────────────────────────────────────────────────────
 * Nomenclatura inteligente do item (Lona / Banner / Faixa)
 * ────────────────────────────────────────────────────────── */

export type TipoProduto = "banner" | "faixa" | "lona" | "outro";

export interface TipoProdutoInfo {
  tipo: TipoProduto;
  /** Nome sugerido para exibir no header do item. */
  nome: string;
}

/** Heurística simples baseada em palavras-chave no nome do acabamento bastão. */
const isFaixa = (nomeAcab: string): boolean =>
  /faixa|lateral|laterais/i.test(nomeAcab);

/**
 * Detecta o tipo de produto a partir da mídia + acabamentos aplicados.
 * - Mídia lona + bastão (topo/base) → Banner
 * - Mídia lona + bastão lateral/faixa → Faixa
 * - Mídia lona sem bastão → Lona
 * - Outras mídias → usa o nome da mídia
 */
export function detectarTipoProduto(
  midia: Midia | null,
  acabamentosAplicados: Array<Pick<Acabamento, "familia" | "nome">>,
): TipoProdutoInfo {
  if (!midia) return { tipo: "outro", nome: "Sem mídia" };

  if (midia.tipo_midia === "lona") {
    const bastao = acabamentosAplicados.find((a) => a.familia === "banner_bastao");
    if (bastao) {
      if (isFaixa(bastao.nome)) return { tipo: "faixa", nome: "Faixa" };
      return { tipo: "banner", nome: "Banner" };
    }
    return { tipo: "lona", nome: "Lona" };
  }

  return { tipo: "outro", nome: midia.nome };
}
