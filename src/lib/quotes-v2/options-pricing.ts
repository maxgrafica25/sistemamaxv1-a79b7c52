// Orquestra o recálculo de um orçamento inteiro para uma nova quantidade,
// somando impressão (motor já existente) + Comunicação Visual (engine CV)
// + acabamentos (já incluídos no motor de CV via área/perímetro/unidade).
//
// Mantém os custos fixos (frete, hiddenExtras) constantes — eles não escalam
// com a quantidade. Aplica desconto/percentual no fim.

import {
  recalculateForQuantity,
  type PricingSnapshot,
} from "./pricing";
import {
  calcular as cvCalcular,
  type Midia as CVMidia,
  type Impressao as CVImpressao,
  type Acabamento as CVAcabamento,
  type AcabamentoAplicado as CVAcabamentoAplicado,
  type MarkupSettings as CVMarkupSettings,
} from "@/lib/cv-calc/engine";
import type { CVItemState } from "@/components/orcamentos-v2/CVItemCard";

export interface CVContext {
  items: CVItemState[];
  midias: CVMidia[];
  impressoes: CVImpressao[];
  acabamentos: CVAcabamento[];
  valorMinimo: number;
  hourRate?: number;
  markup?: CVMarkupSettings;
}

export interface QuoteRecalcResult {
  quantity: number;
  printingTotal: number;
  cvTotal: number;
  extrasTotal: number; // frete + hiddenExtras (já em snapshot)
  total: number;
  unitPrice: number;
}

/** Arredonda para um múltiplo "limpo" próximo, conforme magnitude. */
export const niceRoundQty = (n: number): number => {
  const v = Math.max(1, Math.round(n));
  if (v < 30) return Math.max(1, Math.round(v / 5) * 5);
  if (v < 100) return Math.round(v / 10) * 10;
  if (v < 300) return Math.round(v / 25) * 25;
  if (v < 1000) return Math.round(v / 50) * 50;
  if (v < 5000) return Math.round(v / 100) * 100;
  return Math.round(v / 500) * 500;
};

const buildAplicados = (
  cvItem: CVItemState,
  acabamentosCatalog: CVAcabamento[],
  tipoMidia: CVAcabamento["tipos_midia_compativeis"][number] | undefined,
): CVAcabamentoAplicado[] => {
  return cvItem.acabamentos
    .map((a) => {
      if (a.custom) {
        const synth: CVAcabamento = {
          id: a.finish_id,
          nome: a.custom.nome || "Acabamento avulso",
          familia: "outro" as any,
          tipos_midia_compativeis: tipoMidia ? [tipoMidia] : [],
          custo_fixo: Number(a.custom.valor) || 0,
          lucro_fixo: 0,
          custo_mt2: 0, lucro_mt2: 0,
          custo_perimetro: 0, lucro_perimetro: 0,
          custo_unidade: 0, lucro_unidade: 0,
          largura_max_cm: null,
        } as any;
        return { acabamento: synth, qtd_unidades: 1 };
      }
      const f = acabamentosCatalog.find((x) => x.id === a.finish_id);
      if (!f) return null;
      return { acabamento: f, qtd_unidades: a.quantidade_unidades };
    })
    .filter(Boolean) as CVAcabamentoAplicado[];
};

/**
 * Recalcula o total do orçamento para uma nova quantidade total.
 * - Impressão: usa `recalculateForQuantity` (re-tier + dilução de fixos).
 * - CV: para cada peça, escala `quantidade` proporcionalmente a `newQty/baseQty`
 *   (mínimo 1) e chama o engine CV — isso reescala automaticamente mídia,
 *   impressão e acabamentos por m²/perímetro/unidade.
 */
export const recalculateQuoteForQuantity = (
  snapshot: PricingSnapshot,
  cv: CVContext | null,
  baseQty: number,
  newQty: number,
): QuoteRecalcResult => {
  const qty = Math.max(1, Math.floor(newQty));
  const base = Math.max(1, Math.floor(baseQty));
  const ratio = qty / base;

  const printing = recalculateForQuantity(snapshot, qty);
  const printingTotal = printing.totalToCharge - ((snapshot.hiddenExtrasValue ?? 0) + (snapshot.freightValue ?? 0));
  const extrasTotal = (snapshot.hiddenExtrasValue ?? 0) + (snapshot.freightValue ?? 0);

  let cvTotal = 0;
  if (cv && cv.items.length > 0) {
    for (const it of cv.items) {
      const midia = cv.midias.find((m) => m.id === it.material_id) || null;
      const impressao = cv.impressoes.find((p) => p.id === it.printer_id) || null;
      const aplicados = buildAplicados(it, cv.acabamentos, midia?.tipo_midia);
      const scaledQty = Math.max(1, Math.round((it.quantidade || 1) * ratio));
      const r = cvCalcular({
        largura_cm: it.largura_cm,
        altura_cm: it.altura_cm,
        quantidade: scaledQty,
        midia,
        impressao,
        acabamentos: aplicados,
        acabamentos_pool: cv.acabamentos,
        valor_minimo: cv.valorMinimo,
        hourRate: cv.hourRate,
        markup: cv.markup,
      });
      cvTotal += r.valor_total || 0;
    }
  }

  const total = printingTotal + cvTotal + extrasTotal;
  const unitPrice = qty > 0 ? total / qty : total;
  return { quantity: qty, printingTotal, cvTotal, extrasTotal, total, unitPrice };
};
