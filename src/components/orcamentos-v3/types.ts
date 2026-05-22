export type V3Category = "print" | "cv" | "third" | "labor" | "supply";

/** Agrupamento visual no carrinho (ex.: Apostila + Kit em um único card). */
export interface V3BundleFields {
  bundle_id?: string | null;
  /** Preenchido apenas no item líder do bundle. */
  bundle_label?: string | null;
  /** Em um grupo de faixas (tier_group_id), marca o item da quantidade solicitada. */
  tier_primary?: boolean;
}

export interface V3PrintItem extends V3BundleFields {
  id: string;
  kind: "print";
  descricao: string;
  quantidade: number;
  /** Agrupa irmãos como faixas de quantidade de um mesmo produto. */
  tier_group_id?: string | null;
  // Selecionado do catálogo (printing_price_items + markup_tiers).
  catalog_item_id: string | null;
  paper_type: string | null;
  grammage: string | null;
  size: string | null;
  side: string | null;
  printer_category_id: string | null;
  markup_group_id: string | null;
  // Preço por folha (já com multiplicadores e tier aplicados quando vindo do catálogo).
  valor_unitario: number;
  custo_unitario: number;
  // Mantidos para compat com chips legados (entrada manual).
  formato: "A4" | "A3" | "SRA3" | null;
  cores: "4x0" | "4x4" | "1x0" | "1x1" | null;
  face: "frente" | "fv" | null;
  finishings: string[];
  /** Snapshot do catálogo unificado — drive do cálculo extra por folha/unidade. */
  finishing_selections?: {
    id: string;
    name: string;
    pricing_model: "per_sheet" | "per_unit";
    unit_label: string | null;
    price: number;
    cost: number;
    units?: number;
  }[];
}

export interface V3CVItem extends V3BundleFields {
  id: string;
  kind: "cv";
  descricao: string;
  tier_group_id?: string | null;
  midia_id: string | null;
  midia_nome: string;
  // Compat com 5.2 (custo manual); na 5.3 vêm do catálogo cv_calc_midias.
  custo_mt2: number;
  margem_mt2_pct: number;
  // Dimensões mantidas em metros para preservar UI atual.
  largura_m: number;
  altura_m: number;
  quantidade: number;
  // Acabamentos selecionados (chips legados / nomes); na 5.3 mantidos por id.
  finishings: string[];
  // ===== Catálogo CV (Fase 5.3) =====
  impressao_id?: string | null;
  impressao_nome?: string | null;
  acabamento_ids?: string[];
  acabamentos_qtd_unidades?: Record<string, number>;
  // Snapshot do resultado da engine V2 (preferido por priceOf quando presente).
  snapshot?: {
    preco_total: number;
    custo_total: number;
    preco_midia: number;
    preco_impressao: number;
    preco_acabamentos: number;
    area_total_m2: number;
    perim_m: number;
    tem_emenda: boolean;
    aplicou_minimo: boolean;
    acabamento_efetivo_id: string | null;
    acabamento_efetivo_nome: string | null;
  } | null;
}

export interface V3ThirdItem extends V3BundleFields {
  id: string;
  kind: "third";
  descricao: string;
  tier_group_id?: string | null;
  fornecedor: string;
  custo: number;
  margem_pct: number;
  quantidade: number;
}

/** Apostila (Fase 6.1) — derivada de Print com bookletPages × bookletUnits. */
export interface V3BookletItem extends V3BundleFields {
  id: string;
  kind: "booklet";
  descricao: string;
  tier_group_id?: string | null;
  // Miolo (catálogo igual ao Print)
  catalog_item_id: string | null;
  paper_type: string | null;
  grammage: string | null;
  size: string | null;
  side: string | null;
  printer_category_id: string | null;
  markup_group_id: string | null;
  valor_unitario: number; // preço por folha do miolo
  custo_unitario: number; // custo por folha do miolo
  // Configuração da apostila
  bookletPages: number;   // folhas por apostila (lados de papel)
  bookletUnits: number;   // qtde de apostilas
  bookletDuplex: boolean; // F/V no miolo
}

/** Mão-de-obra avulsa (Fase 6.2). Persistida em quote_labor_steps (parent_item_id null). */
export interface V3LaborItem extends V3BundleFields {
  id: string;
  kind: "labor";
  descricao: string;
  time_minutes: number;
  step_type: "impressao" | "acabamento" | "corte" | "outro";
  hourly_rate: number; // snapshot do custo/hora no momento da inserção
  margem_pct: number;  // margem aplicada (default = margem do orçamento)
}

/** Suprimento avulso (Fase 6.3). Persistido em quote_materials product_kind 'Suprimento'. */
export interface V3SupplyItem extends V3BundleFields {
  id: string;
  kind: "supply";
  descricao: string;
  tier_group_id?: string | null;
  supply_id: string | null;
  supply_nome: string;
  fornecedor: string | null;
  custo_unitario: number;
  margem_pct: number;
  quantidade: number;
}

/** Etiqueta (Fase 6.4) — usa engine de layout/folha das libs labels/*. */
export interface V3LabelItem extends V3BundleFields {
  id: string;
  kind: "label";
  descricao: string;
  tier_group_id?: string | null;
  // Etiqueta
  labelW_mm: number;
  labelH_mm: number;
  shape: "quadrado" | "redondo" | "personalizado";
  /** Apenas em redondo (SignMaster). Permite reabrir com o diâmetro original. */
  label_diameter_mm?: number;
  quantidade: number;
  // Folha & impressão (snapshot do useFolhaPricing)
  sheet_size: string;             // ex: "A4" / "SRA3" / "Formatao"
  printing_item_id: string | null;
  paper_type: string | null;
  grammage: string | null;
  side: string | null;
  finishing_id: string | null;
  finishing_nome: string | null;
  // Resultado
  per_sheet: number;
  sheets_needed: number;
  price_per_sheet: number;        // impressão + acabamento
  preco_total: number;            // já arredondado
  custo_total: number;
}

export type V3Item =
  | V3PrintItem
  | V3CVItem
  | V3ThirdItem
  | V3BookletItem
  | V3LaborItem
  | V3SupplyItem
  | V3LabelItem;

export interface V3QuoteState {
  cliente: { id: string | null; nome: string };
  assunto: string;
  items: V3Item[];
  tax_pct: number;
  fees_pct: number;
  margin_pct: number;
}

export const DEFAULT_STATE: V3QuoteState = {
  cliente: { id: null, nome: "Cliente Balcão" },
  assunto: "",
  items: [],
  tax_pct: 0,
  fees_pct: 0,
  margin_pct: 20,
};

export const genId = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
