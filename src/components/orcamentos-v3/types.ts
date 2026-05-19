export type V3Category = "print" | "cv" | "third";

export interface V3PrintItem {
  id: string;
  kind: "print";
  descricao: string;
  quantidade: number;
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
}

export interface V3CVItem {
  id: string;
  kind: "cv";
  descricao: string;
  midia_id: string | null;
  midia_nome: string;
  custo_mt2: number;
  margem_mt2_pct: number;
  largura_m: number;
  altura_m: number;
  quantidade: number;
  finishings: string[];
}

export interface V3ThirdItem {
  id: string;
  kind: "third";
  descricao: string;
  fornecedor: string;
  custo: number;
  margem_pct: number;
  quantidade: number;
}

export type V3Item = V3PrintItem | V3CVItem | V3ThirdItem;

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
