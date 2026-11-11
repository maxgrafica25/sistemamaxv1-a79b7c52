// Custo por página dos consumíveis de um equipamento.
// O rendimento cadastrado é o do fabricante (5% de cobertura). Só o que gasta mais
// com mais tinta na folha (toner, tinta) é multiplicado pela cobertura; fusor, belt,
// cilindro, revelador, manutenção e depreciação custam o mesmo por página.

export const COBERTURA_FABRICANTE = 5;

export interface ConsumableCostInput {
  price: number;
  yield_pages: number;
  scales_with_coverage?: boolean | null;
}

export const consumableCost = (c: ConsumableCostInput, coveragePct: number): number => {
  if (!c.yield_pages || c.yield_pages <= 0) return 0;
  const base = c.price / c.yield_pages;
  return c.scales_with_coverage === false ? base : base * (coveragePct / COBERTURA_FABRICANTE);
};

export const equipmentCost = (items: ConsumableCostInput[], coveragePct: number): number =>
  items.reduce((sum, c) => sum + consumableCost(c, coveragePct), 0);

/** Cobertura usada nos orçamentos (custo de produção). */
export const COBERTURA_PRODUCAO = 20;

export interface ConsumivelDaMaquina extends ConsumableCostInput {
  name?: string | null;
  /** "color_only" = só entra na página colorida (ciano, magenta, amarelo…); o resto entra nas duas. */
  mode?: string | null;
}

export interface CustosDaMaquina {
  /** Página colorida (só máquina colorida), com 20% de cobertura. */
  colorida: number | null;
  /** Página preto e branco, com 20% de cobertura (toda máquina colorida também faz P&B). */
  pb: number | null;
  /** Os mesmos custos pela cobertura do fabricante (5%), só como referência. */
  fabricanteColorida: number | null;
  fabricantePb: number | null;
  /** Ribbon (cartões): custo direto por impressão, sem cobertura. */
  direto: number | null;
}

export const entraNoPb = (c: ConsumivelDaMaquina) => c.mode !== "color_only";

/** Custo por página de uma máquina, separado em colorida e preto e branco. */
export const custosDaMaquina = (tipo: string | null | undefined, itens: ConsumivelDaMaquina[]): CustosDaMaquina => {
  if (tipo === "ribbon") {
    const direto = itens.reduce((s, c) => (c.yield_pages > 0 ? s + c.price / c.yield_pages : s), 0);
    return { colorida: null, pb: null, fabricanteColorida: null, fabricantePb: null, direto };
  }
  const pbItens = itens.filter(entraNoPb);
  const pb = equipmentCost(pbItens, COBERTURA_PRODUCAO);
  const fabricantePb = equipmentCost(pbItens, COBERTURA_FABRICANTE);
  if (tipo === "color") {
    return {
      colorida: equipmentCost(itens, COBERTURA_PRODUCAO),
      fabricanteColorida: equipmentCost(itens, COBERTURA_FABRICANTE),
      pb,
      fabricantePb,
      direto: null,
    };
  }
  return { colorida: null, pb, fabricanteColorida: null, fabricantePb, direto: null };
};

const NOME_DE_COR = /\b(ciano|cyan|magenta|amarel[oa]|yellow)\b/i;

/** Consumível que, pelo nome, só é usado na impressão colorida. */
export const nomeDeCor = (nome: string | null | undefined) => NOME_DE_COR.test(nome || "");

/** Máquina que não está como colorida mas tem consumíveis de cor (cadastro provavelmente errado). */
export const pareceColorida = (tipo: string | null | undefined, itens: ConsumivelDaMaquina[]) =>
  tipo !== "color" && tipo !== "ribbon" && itens.some((c) => c.mode === "color_only" || nomeDeCor(c.name));

/** Máquina colorida com consumível de cor que entra no P&B (o P&B fica caro demais). */
export const corNoPb = (tipo: string | null | undefined, itens: ConsumivelDaMaquina[]) =>
  tipo === "color" ? itens.filter((c) => entraNoPb(c) && nomeDeCor(c.name)) : [];
