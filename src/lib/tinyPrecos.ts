// Preços do Tiny na Tabela de Preços: a Júlia (que já está conectada ao Tiny) lê e, quando o admin confirma, muda.
// A conversa é direto do navegador com a Júlia, usando o login do sistema (só admin).
import { supabase } from "@/integrations/supabase/client";

export const JULIA_URL = (import.meta.env.VITE_JULIA_URL as string | undefined) || "https://julia.maxgraficadigital.com.br";

/** Quantos preços vão por chamada (o Tiny aceita 30 consultas por minuto). */
export const LOTE_ENVIO = 25;

export interface ProdutoTiny {
  id: number;
  descricao: string | null;
  preco: number | null;
  promocional: number | null;
}

export interface PrecosTiny {
  lido_em: string;
  produtos: Record<string, ProdutoTiny>;
}

export interface ResultadoEnvio {
  sku: string;
  ok: boolean;
  preco_antes?: number | null;
  preco?: number;
  erro?: string;
}

async function chamarJulia<T>(caminho: string, init?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Faça login de novo no sistema.");
  let r: Response;
  try {
    r = await fetch(`${JULIA_URL}${caminho}`, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  } catch {
    throw new Error("Não consegui falar com a Júlia (servidor fora do ar ou sem internet).");
  }
  const corpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error((corpo && typeof corpo.detail === "string" && corpo.detail) || `A Júlia respondeu com erro ${r.status}.`);
  return corpo as T;
}

export const buscarPrecosTiny = (atualizar = false) =>
  chamarJulia<PrecosTiny>(`/api/tiny/precos${atualizar ? "?atualizar=true" : ""}`);

export async function enviarPrecosTiny(itens: { sku: string; preco: number }[], aoAvancar?: (feitos: number) => void): Promise<ResultadoEnvio[]> {
  const out: ResultadoEnvio[] = [];
  for (let i = 0; i < itens.length; i += LOTE_ENVIO) {
    const lote = itens.slice(i, i + LOTE_ENVIO);
    try {
      const r = await chamarJulia<{ resultados: ResultadoEnvio[] }>("/api/tiny/precos", { method: "POST", body: JSON.stringify({ itens: lote }) });
      out.push(...r.resultados);
    } catch (e) {
      // Um lote que falhou não impede os seguintes de aparecerem como erro na tela.
      out.push(...lote.map((x) => ({ sku: x.sku, ok: false, erro: (e as Error).message })));
    }
    aoAvancar?.(Math.min(itens.length, i + LOTE_ENVIO));
  }
  return out;
}

// ─── Comparação (regras puras, com testes) ───────────────────────────

export type SituacaoTiny = "igual" | "diferente" | "sem_sku" | "nao_achado" | "sem_preco" | "conflito";

export interface ComparacaoTiny {
  situacao: SituacaoTiny;
  precoTiny: number | null;
}

interface FaixaComSku {
  id: string;
  tiny_sku: string | null;
  price: number;
}

export const mesmoPreco = (a: number, b: number) => Math.abs(a - b) < 0.005;
const limpaSku = (s: string | null) => (s || "").trim();

/** SKUs que aparecem em mais de uma faixa com preços diferentes: o Tiny só guarda um preço, então não dá para enviar. */
export const skusEmConflito = (faixas: FaixaComSku[]): Set<string> => {
  const precos = new Map<string, number[]>();
  for (const f of faixas) {
    const sku = limpaSku(f.tiny_sku);
    if (sku) precos.set(sku, [...(precos.get(sku) || []), f.price]);
  }
  return new Set([...precos].filter(([, ps]) => ps.some((p) => !mesmoPreco(p, ps[0]))).map(([s]) => s));
};

export const compararFaixa = (f: FaixaComSku, produtos: Record<string, ProdutoTiny>, conflitos: Set<string>): ComparacaoTiny => {
  const sku = limpaSku(f.tiny_sku);
  if (!sku) return { situacao: "sem_sku", precoTiny: null };
  const p = produtos[sku];
  if (!p) return { situacao: "nao_achado", precoTiny: null };
  if (conflitos.has(sku)) return { situacao: "conflito", precoTiny: p.preco };
  if (p.preco === null) return { situacao: "sem_preco", precoTiny: null };
  return { situacao: mesmoPreco(p.preco, f.price) ? "igual" : "diferente", precoTiny: p.preco };
};

/** O que pode ser enviado ao Tiny: preço do sistema diferente (ou Tiny sem preço), SKU achado e sem conflito. */
export const podeEnviar = (c: ComparacaoTiny, preco: number) => (c.situacao === "diferente" || c.situacao === "sem_preco") && preco > 0;

// ─── Vendas reais (últimos 90 dias), baixadas pela Júlia aos poucos ──

export interface VendasTiny {
  inicio: string;
  fim: string;
  dias: number;
  /** Pedidos válidos no período e quantos já tiveram os itens baixados. */
  pedidos: number;
  pedidos_lidos: number;
  atualizado_em: string | null;
  /** Por SKU: [quantidade, valor unitário cobrado, parte do pedido]. */
  skus: Record<string, [number, number, number][]>;
}

export const buscarVendasTiny = () => chamarJulia<VendasTiny>("/api/tiny/vendas");
