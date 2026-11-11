// Pré-impressão → "Livreto" (revista/caderno grampeado no meio).
//
// Recebe o PDF com as páginas NA ORDEM DE LEITURA (1, 2, 3…) e gera as folhas de
// impressão: duas páginas lado a lado por lado de folha, na ordem certa para
// dobrar ao meio e grampear (canoa). Lógica pura, testável.

import { PDFDocument, cmyk, type PDFEmbeddedPage, type PDFPage } from "pdf-lib";
import { PT_POR_MM } from "./folha";

/** Um lado de uma folha: página da esquerda e da direita (1 = primeira; null = em branco). */
export interface LadoLivreto {
  folha: number;
  lado: "frente" | "verso";
  esquerda: number | null;
  direita: number | null;
}

/** Páginas arredondadas para múltiplo de 4 (as que faltam ficam em branco no fim). */
export function paginasDoLivreto(paginas: number): number {
  return Math.max(4, Math.ceil(Math.max(1, paginas) / 4) * 4);
}

/**
 * Ordem de impressão do livreto grampeado. Folha 1 (a de fora): frente = última | 1,
 * verso = 2 | penúltima; e assim por diante até o miolo.
 */
export function ordemLivreto(paginas: number): LadoLivreto[] {
  const n = paginasDoLivreto(paginas);
  const pg = (p: number) => (p <= paginas ? p : null);
  const lados: LadoLivreto[] = [];
  for (let i = 0; i < n / 4; i++) {
    lados.push({ folha: i + 1, lado: "frente", esquerda: pg(n - 2 * i), direita: pg(2 * i + 1) });
    lados.push({ folha: i + 1, lado: "verso", esquerda: pg(2 * i + 2), direita: pg(n - 2 * i - 1) });
  }
  return lados;
}

export interface ConfigLivreto {
  /** Folha de impressão (pt). null = folha do tamanho exato de duas páginas (mais as marcas). */
  folhaW: number | null;
  folhaH: number | null;
  /** Sangria que cada página já traz por lado (mm). A do lado da dobra é cortada fora. */
  sangriaMm: number;
  marcas: boolean;
  /** Diminui para caber na folha escolhida (senão dá erro se não couber). */
  ajustar: boolean;
}

export interface ResultadoLivreto {
  bytes: Uint8Array;
  lados: LadoLivreto[];
  folhas: number;
  emBranco: number;
  /** Tamanho da página fechada, sem sangria (pt). */
  fechado: { w: number; h: number };
  folha: { w: number; h: number };
  /** Escala aplicada (1 = tamanho real). */
  escala: number;
}

const PRETO = cmyk(0, 0, 0, 1);
export const LIMITE_PAGINAS_LIVRETO = 400;

/** `bytesEmPe` = PDF já passado por `arteEmPe` (sem /Rotate). */
export async function gerarLivreto(bytesEmPe: Uint8Array, cfg: ConfigLivreto): Promise<ResultadoLivreto> {
  const fonte = await PDFDocument.load(bytesEmPe);
  const total = fonte.getPageCount();
  if (total > LIMITE_PAGINAS_LIVRETO) throw new Error(`O PDF tem ${total} páginas: o máximo para livreto é ${LIMITE_PAGINAS_LIVRETO}.`);
  const p0 = fonte.getPage(0);
  const W = p0.getWidth();
  const H = p0.getHeight();
  const s = cfg.sangriaMm * PT_POR_MM;
  const fw = W - 2 * s; // página fechada
  const fh = H - 2 * s;
  if (fw <= 0 || fh <= 0) throw new Error("A sangria é maior que a página.");

  // Área impressa de um lado: sangria de fora + 2 páginas + sangria de fora
  const abertoW = 2 * fw + 2 * s;
  const abertoH = H;
  const folga = cfg.marcas ? 6 * PT_POR_MM : 0;
  let folhaW = cfg.folhaW ?? abertoW + 2 * folga;
  let folhaH = cfg.folhaH ?? abertoH + 2 * folga;
  // Folha escolhida: deitar se o livreto aberto for mais largo que alto
  if (cfg.folhaW && cfg.folhaH && abertoW > abertoH !== folhaW > folhaH) [folhaW, folhaH] = [folhaH, folhaW];
  let escala = 1;
  if (abertoW > folhaW + 0.01 || abertoH > folhaH + 0.01) {
    if (!cfg.ajustar) throw new Error("O livreto aberto não cabe nesta folha. Escolha uma folha maior ou ligue \"Ajustar para caber\".");
    escala = Math.min(folhaW / abertoW, folhaH / abertoH);
  }

  const out = await PDFDocument.create();
  out.setProducer("Sistema Max · Pré-impressão");
  out.setCreator("Sistema Max · Livreto");
  const paginas = fonte.getPages();
  // Cada página é embutida sem a sangria do lado da dobra (esquerda perde a direita; direita perde a esquerda)
  const cache = new Map<string, PDFEmbeddedPage>();
  const embutir = async (num: number, lado: "esq" | "dir") => {
    const k = `${num}${lado}`;
    let e = cache.get(k);
    if (!e) {
      const caixa = lado === "esq" ? { left: 0, bottom: 0, right: W - s, top: H } : { left: s, bottom: 0, right: W, top: H };
      e = await out.embedPage(paginas[num - 1], caixa, [1, 0, 0, 1, -caixa.left, 0]);
      cache.set(k, e);
    }
    return e;
  };

  const lados = ordemLivreto(total);
  const x0 = (folhaW - abertoW * escala) / 2;
  const y0 = (folhaH - abertoH * escala) / 2;
  const meio = x0 + (s + fw) * escala;
  for (const l of lados) {
    const page = out.addPage([folhaW, folhaH]);
    if (l.esquerda) page.drawPage(await embutir(l.esquerda, "esq"), { x: x0, y: y0, xScale: escala, yScale: escala });
    if (l.direita) page.drawPage(await embutir(l.direita, "dir"), { x: meio, y: y0, xScale: escala, yScale: escala });
    if (cfg.marcas) desenharMarcasLivreto(page, { x0, y0, meio, s: s * escala, fw: fw * escala, fh: fh * escala, folhaW, folhaH });
  }

  return {
    bytes: await out.save(),
    lados,
    folhas: lados.length / 2,
    emBranco: paginasDoLivreto(total) - total,
    fechado: { w: fw, h: fh },
    folha: { w: folhaW, h: folhaH },
    escala,
  };
}

/** Marcas de corte nos 4 cantos do livreto aberto e marca de dobra no meio (em cima e embaixo). */
function desenharMarcasLivreto(
  page: PDFPage,
  g: { x0: number; y0: number; meio: number; s: number; fw: number; fh: number; folhaW: number; folhaH: number },
) {
  const esq = g.x0 + g.s;
  const dir = g.meio + g.fw;
  const baixo = g.y0 + g.s;
  const cima = baixo + g.fh;
  const afast = 1 * PT_POR_MM;
  const linha = (x1: number, y1: number, x2: number, y2: number, traco?: number[]) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.25, color: PRETO, dashArray: traco });
  // comprimento conforme o espaço livre fora da área impressa
  const v = Math.min(4 * PT_POR_MM, g.y0 - afast, g.folhaH - (cima + g.s) - afast);
  const h = Math.min(4 * PT_POR_MM, g.x0 - afast, g.folhaW - (dir + g.s) - afast);
  if (v >= 1.5 * PT_POR_MM) {
    for (const x of [esq, dir]) {
      linha(x, cima + g.s + afast, x, cima + g.s + afast + v);
      linha(x, baixo - g.s - afast, x, baixo - g.s - afast - v);
    }
    // dobra: tracejada
    linha(g.meio, cima + g.s + afast, g.meio, cima + g.s + afast + v, [2, 2]);
    linha(g.meio, baixo - g.s - afast, g.meio, baixo - g.s - afast - v, [2, 2]);
  }
  if (h >= 1.5 * PT_POR_MM) {
    for (const y of [baixo, cima]) {
      linha(esq - g.s - afast, y, esq - g.s - afast - h, y);
      linha(dir + g.s + afast, y, dir + g.s + afast + h, y);
    }
  }
}
