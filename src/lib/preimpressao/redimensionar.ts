// Pré-impressão → "Redimensionar e cortar": muda o tamanho das páginas de um PDF
// (A5, A4, medida livre…) ou corta margens / a folga branca, sem refazer a arte.
// O desenho continua em vetor: cada página é a página original, desenhada em escala
// e recortada numa janela. Contas puras e testáveis; só a medida da folga branca
// usa o navegador (./navegador).

import { PDFDocument } from "pdf-lib";
import { PT_POR_MM } from "./folha";

/** Tamanhos de página mais usados na gráfica (cm, em pé). */
export const TAMANHOS_PAGINA: { key: string; rotulo: string; wCm: number; hCm: number }[] = [
  { key: "A6", rotulo: "A6", wCm: 10.5, hCm: 14.8 },
  { key: "A5", rotulo: "A5", wCm: 14.8, hCm: 21 },
  { key: "A4", rotulo: "A4", wCm: 21, hCm: 29.7 },
  { key: "A3", rotulo: "A3", wCm: 29.7, hCm: 42 },
  { key: "SRA3", rotulo: "SRA3", wCm: 32, hCm: 45 },
  { key: "formatao", rotulo: "Formatão", wCm: 32.8, hCm: 47.8 },
];

/** Como a arte entra na página nova. */
export type Encaixe = "caber" | "preencher" | "real";

export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** O que fazer com uma página: janela da original que aparece, escala e onde fica na nova. */
export interface PlanoPagina {
  saidaW: number;
  saidaH: number;
  /** Parte da página original que aparece (pt, origem no canto inferior esquerdo). */
  janela: Retangulo;
  escala: number;
  /** Canto inferior esquerdo da janela na página nova. */
  destX: number;
  destY: number;
  /** Quanto da arte original fica de fora (pt): largura e altura da original que foram cortadas. */
  cortadoW: number;
  cortadoH: number;
}

/**
 * Plano para levar uma página (w × h pt) ao tamanho alvo. A página nova segue a
 * orientação da original (em pé continua em pé, deitada continua deitada), a não ser que
 * `seguirOrientacao` seja false (medida livre: vale largura × altura como digitado).
 * caber = reduz/amplia até caber inteira, centralizada; preencher = cobre a página
 * toda e corta o excesso; real = mantém a escala 100% e centraliza (corta o que passar).
 */
export function planejarTamanho(w: number, h: number, alvoWpt: number, alvoHpt: number, encaixe: Encaixe, seguirOrientacao = true): PlanoPagina {
  const emPe = h >= w;
  const lado = Math.min(alvoWpt, alvoHpt);
  const maior = Math.max(alvoWpt, alvoHpt);
  // seguirOrientacao = false: o tamanho vale exatamente como foi pedido (largura × altura)
  const saidaW = !seguirOrientacao ? alvoWpt : emPe ? lado : maior;
  const saidaH = !seguirOrientacao ? alvoHpt : emPe ? maior : lado;
  const escala = encaixe === "real" ? 1 : encaixe === "caber" ? Math.min(saidaW / w, saidaH / h) : Math.max(saidaW / w, saidaH / h);
  // parte da original que aparece (em pt da original) e onde ela fica na página nova
  const visW = Math.min(w, saidaW / escala);
  const visH = Math.min(h, saidaH / escala);
  const janela = { x: (w - visW) / 2, y: (h - visH) / 2, w: visW, h: visH };
  return {
    saidaW,
    saidaH,
    janela,
    escala,
    destX: (saidaW - visW * escala) / 2,
    destY: (saidaH - visH * escala) / 2,
    cortadoW: Math.max(0, w - visW),
    cortadoH: Math.max(0, h - visH),
  };
}

export interface Lados {
  cima: number;
  baixo: number;
  esq: number;
  dir: number;
}

/** Plano que só recorta a página, em tamanho real. Devolve null se não sobra página. */
export function planejarCorte(w: number, h: number, cortePt: Lados): PlanoPagina | null {
  const cw = w - cortePt.esq - cortePt.dir;
  const ch = h - cortePt.cima - cortePt.baixo;
  if (cw < 1 || ch < 1 || cortePt.cima < 0 || cortePt.baixo < 0 || cortePt.esq < 0 || cortePt.dir < 0) return null;
  return {
    saidaW: cw,
    saidaH: ch,
    janela: { x: cortePt.esq, y: cortePt.baixo, w: cw, h: ch },
    escala: 1,
    destX: 0,
    destY: 0,
    cortadoW: w - cw,
    cortadoH: h - ch,
  };
}

/** Caixa de conteúdo em frações da página (0–1), com o topo em y = 0 (como numa imagem). */
export interface CaixaConteudo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const LIMIAR_BRANCO = 235;

/**
 * Menor caixa que contém tudo o que não é branco (luminosidade < 235, fundo branco para
 * transparência). null = página em branco. Ignora uma borda de 1 pixel (serrilhado do desenho).
 */
export function caixaDeTinta(rgba: ArrayLike<number>, w: number, h: number): CaixaConteudo | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const a = rgba[i + 3] / 255;
      const lum = 0.299 * (rgba[i] * a + 255 * (1 - a)) + 0.587 * (rgba[i + 1] * a + 255 * (1 - a)) + 0.114 * (rgba[i + 2] * a + 255 * (1 - a));
      if (lum < LIMIAR_BRANCO) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h };
}

/** Plano que tira a folga branca: corta até o conteúdo e deixa `folgaMm` em volta. Página em branco fica como está. */
export function planejarFolga(w: number, h: number, caixa: CaixaConteudo | null, folgaMm: number): PlanoPagina | null {
  if (!caixa) return planejarCorte(w, h, { cima: 0, baixo: 0, esq: 0, dir: 0 });
  const f = folgaMm * PT_POR_MM;
  const esq = Math.max(0, caixa.x0 * w - f);
  const dir = Math.max(0, w - caixa.x1 * w - f);
  const cima = Math.max(0, caixa.y0 * h - f);
  const baixo = Math.max(0, h - caixa.y1 * h - f);
  return planejarCorte(w, h, { cima, baixo, esq, dir });
}

/** PDF novo: cada página é a original recortada na janela, na escala do plano (vetor preservado). */
export async function gerarRedimensionado(emPe: Uint8Array, planos: (PlanoPagina | null)[]): Promise<Uint8Array> {
  const origem = await PDFDocument.load(emPe);
  const saida = await PDFDocument.create();
  const paginas = origem.getPages();
  for (let i = 0; i < paginas.length; i++) {
    const original = paginas[i];
    const plano = planos[i] ?? planejarCorte(original.getWidth(), original.getHeight(), { cima: 0, baixo: 0, esq: 0, dir: 0 })!;
    const page = saida.addPage([plano.saidaW, plano.saidaH]);
    // Página sem conteúdo não pode ser embutida: sai só o tamanho novo, em branco
    if (!original.node.Contents()) continue;
    const j = plano.janela;
    const embutida = await saida.embedPage(original, { left: j.x, bottom: j.y, right: j.x + j.w, top: j.y + j.h });
    page.drawPage(embutida, { x: plano.destX, y: plano.destY, xScale: plano.escala, yScale: plano.escala });
  }
  return saida.save();
}

/** Tamanho (pt) de cada página do PDF (já em pé, sem /Rotate). */
export async function tamanhosDasPaginas(emPe: Uint8Array): Promise<{ w: number; h: number }[]> {
  const doc = await PDFDocument.load(emPe);
  return doc.getPages().map((p) => ({ w: p.getWidth(), h: p.getHeight() }));
}
