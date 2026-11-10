// Pré-impressão → peças comuns de MONTAGEM NA FOLHA (imposição), usadas pela
// Numeração de talões, Montagem de impressos e Livreto:
// folhas de impressão da gráfica, encaixe (quantas artes cabem), sangria,
// marcas de corte e aproveitamento. Lógica pura (sem React/canvas), testável.

import { PDFDocument, cmyk, degrees, type PDFEmbeddedPage, type PDFPage } from "pdf-lib";
import { PT_POR_CM, detectarTipo, processarPdf } from "./margem";

export const PT_POR_MM = PT_POR_CM / 10;
const PRETO = cmyk(0, 0, 0, 1);

// ─── Folhas ──────────────────────────────────────────────────────────

/** Folhas de impressão da Max Gráfica (decidido com o Juliano em 09/11). Padrão: Formatão. */
export const FOLHAS_PADRAO: { key: string; rotulo: string; detalhe?: string; wCm: number; hCm: number }[] = [
  { key: "a4", rotulo: "A4", wCm: 21, hCm: 29.7 },
  { key: "sra3", rotulo: "SRA3", wCm: 32, hCm: 45 },
  { key: "32.8x47.8", rotulo: "Formatão", detalhe: "32,8 × 47,8", wCm: 32.8, hCm: 47.8 },
];
export const FOLHA_PADRAO = "32.8x47.8";


// ─── Encaixe na folha ───────────────────────────────────────────────

/** Posição de um talão na folha (pt, origem embaixo à esquerda). */
export interface Celula {
  x: number;
  y: number;
  /** 90 = arte girada 90° no sentido anti-horário para caber melhor. */
  rot: 0 | 90;
  /** Tamanho da ARTE (sem girar). */
  w: number;
  h: number;
}

export interface Encaixe {
  folhaW: number;
  folhaH: number;
  colunas: number;
  linhas: number;
  celulas: Celula[];
}

function cabe(total: number, tam: number, margem: number, espaco: number): number {
  return Math.max(0, Math.floor((total - 2 * margem + espaco) / (tam + espaco) + 1e-9));
}

/**
 * Monta o maior número de talões na folha, testando a arte em pé/deitada e a folha
 * em pé/deitada. Ordem das células: da esquerda para a direita, de cima para baixo.
 */
export function encaixarNaFolha(folhaW: number, folhaH: number, w: number, h: number, margem: number, espaco: number): Encaixe {
  type Op = { W: number; H: number; rot: 0 | 90; cols: number; rows: number };
  const ops: Op[] = [];
  for (const [W, H] of [
    [folhaW, folhaH],
    [folhaH, folhaW],
  ]) {
    for (const rot of [0, 90] as const) {
      const cw = rot ? h : w;
      const ch = rot ? w : h;
      ops.push({ W, H, rot, cols: cabe(W, cw, margem, espaco), rows: cabe(H, ch, margem, espaco) });
    }
  }
  // Mais talões; empate → sem girar a arte; depois folha como foi escolhida
  let melhor = ops[0];
  for (const o of ops) if (o.cols * o.rows > melhor.cols * melhor.rows) melhor = o;
  const { W, H, rot, cols, rows } = melhor;
  const cw = rot ? h : w;
  const ch = rot ? w : h;
  const gridW = cols * cw + Math.max(0, cols - 1) * espaco;
  const gridH = rows * ch + Math.max(0, rows - 1) * espaco;
  const x0 = (W - gridW) / 2;
  const yTopo = (H + gridH) / 2;
  const celulas: Celula[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      celulas.push({ x: x0 + c * (cw + espaco), y: yTopo - (r + 1) * ch - r * espaco, rot, w, h });
    }
  }
  return { folhaW: W, folhaH: H, colunas: cols, linhas: rows, celulas };
}

/** Arte já montada: divide a página em colunas × linhas iguais (descontando margem e espaço). */
export function gradeMontada(paginaW: number, paginaH: number, colunas: number, linhas: number, margem: number, espaco: number): Encaixe {
  const cols = Math.max(1, Math.floor(colunas));
  const rows = Math.max(1, Math.floor(linhas));
  const w = (paginaW - 2 * margem - (cols - 1) * espaco) / cols;
  const h = (paginaH - 2 * margem - (rows - 1) * espaco) / rows;
  const celulas: Celula[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      celulas.push({ x: margem + c * (w + espaco), y: paginaH - margem - (r + 1) * h - r * espaco, rot: 0, w, h });
    }
  }
  return { folhaW: paginaW, folhaH: paginaH, colunas: cols, linhas: rows, celulas };
}

/** Ponto da arte (u, v a partir do canto de baixo à esquerda) → ponto na folha. */
export function pontoNaFolha(c: Celula, u: number, v: number): { x: number; y: number } {
  return c.rot === 90 ? { x: c.x + c.h - v, y: c.y + u } : { x: c.x + u, y: c.y + v };
}


/** Giro da arte dentro da célula (graus, anti-horário). */
export type Giro = 0 | 90 | 180 | 270;

/**
 * Desenha a arte ocupando a célula, com o giro pedido (0/90 = o da célula;
 * 180/270 = verso de frente e verso). `caixa` = retângulo da célula na folha.
 */
export function desenharArteNaCelula(page: PDFPage, arte: PDFEmbeddedPage, c: Celula, giro: Giro = c.rot) {
  const cw = c.rot ? c.h : c.w;
  const ch = c.rot ? c.w : c.h;
  const origem =
    giro === 0
      ? { x: c.x, y: c.y }
      : giro === 90
        ? { x: c.x + cw, y: c.y }
        : giro === 180
          ? { x: c.x + cw, y: c.y + ch }
          : { x: c.x, y: c.y + ch };
  page.drawPage(arte, { x: origem.x, y: origem.y, width: c.w, height: c.h, rotate: degrees(giro) });
}

// ─── Arte: /Rotate, sangria e tamanho ───────────────────────────────

/** Arte com /Rotate e CropBox "desentortados": cada página fica em pé, do tamanho visível. */
export async function arteEmPe(bytes: Uint8Array): Promise<Uint8Array> {
  const r = await processarPdf(bytes, { top: 0, bottom: 0, left: 0, right: 0 });
  return r.bytes;
}

/**
 * Sangria gravada no PDF (Corel/Illustrator gravam a TrimBox ao exportar com sangria):
 * diferença entre a área visível (CropBox) e a de corte (TrimBox), em mm, quando é igual
 * nos 4 lados. null = o PDF não informa.
 */
export async function sangriaDoPdf(bytes: Uint8Array): Promise<number | null> {
  try {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const p = doc.getPage(0);
    if (!p.node.TrimBox()) return null;
    const c = p.getCropBox();
    const t = p.getTrimBox();
    const lados = [t.x - c.x, t.y - c.y, c.x + c.width - (t.x + t.width), c.y + c.height - (t.y + t.height)].map((v) => v / PT_POR_MM);
    if (lados.some((v) => v < 0.05)) return null;
    const media = lados.reduce((a, b) => a + b, 0) / 4;
    if (lados.some((v) => Math.abs(v - media) > 0.2)) return null;
    return Math.round(media * 10) / 10;
  } catch {
    return null;
  }
}

/** Tamanho (pt) da 1ª página já em pé. */
export async function tamanhoArte(bytesEmPe: Uint8Array): Promise<{ w: number; h: number; paginas: number }> {
  const doc = await PDFDocument.load(bytesEmPe);
  const p = doc.getPage(0);
  return { w: p.getWidth(), h: p.getHeight(), paginas: doc.getPageCount() };
}


/** Arte pronta para montar: em pé, com tamanho, páginas e sangria lida do arquivo. */
export interface ArteAberta {
  nome: string;
  emPe: Uint8Array;
  /** Tamanho da 1ª página (pt), COM a sangria. */
  w: number;
  h: number;
  paginas: number;
  /** Sangria gravada no PDF (TrimBox), em mm; null = o arquivo não informa. */
  sangriaPdf: number | null;
}

/** Abre o PDF de uma arte para as ferramentas de montagem (erros já em português simples). */
export async function abrirArte(bytes: Uint8Array, nome: string): Promise<ArteAberta> {
  const tipo = detectarTipo(bytes, nome);
  if (tipo === "cdr") throw new Error("Arquivo do Corel (.cdr): no CorelDRAW use Arquivo → Exportar… → PDF e envie o PDF.");
  if (tipo !== "pdf") throw new Error("Envie a arte em PDF.");
  const emPe = await arteEmPe(bytes);
  const t = await tamanhoArte(emPe);
  return { nome, emPe, w: t.w, h: t.h, paginas: t.paginas, sangriaPdf: await sangriaDoPdf(bytes) };
}

/** "21,1 × 14,9 cm" a partir de pontos. */
export function formatarCm(wPt: number, hPt: number): string {
  const f = (pt: number) => (pt / PT_POR_CM).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${f(wPt)} × ${f(hPt)} cm`;
}

// ─── Marcas de corte e aproveitamento ───────────────────────────────

/**
 * Marcas de corte no lado de fora da grade, alinhadas com a LINHA DE CORTE de cada
 * talão (sangria para dentro). Só desenha onde sobra espaço entre a grade e a beirada.
 */
export function desenharMarcas(page: PDFPage, e: Encaixe, sangria: number) {
  if (!e.celulas.length) return;
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const c of e.celulas) {
    const cw = c.rot ? c.h : c.w;
    const ch = c.rot ? c.w : c.h;
    xs.add(+(c.x + sangria).toFixed(3)).add(+(c.x + cw - sangria).toFixed(3));
    ys.add(+(c.y + sangria).toFixed(3)).add(+(c.y + ch - sangria).toFixed(3));
  }
  const g = limitesGrade(e);
  const afast = 1 * PT_POR_MM;
  const MAX = 4 * PT_POR_MM;
  const MIN = 1.5 * PT_POR_MM;
  const linha = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.25, color: PRETO });
  // Comprimento da marca: até 4 mm, encurtando para caber no espaço livre (mínimo 1,5 mm)
  const vert = Math.min(MAX, g.y0 - afast, e.folhaH - g.y1 - afast);
  const horiz = Math.min(MAX, g.x0 - afast, e.folhaW - g.x1 - afast);
  if (vert >= MIN) {
    for (const x of xs) {
      linha(x, g.y1 + afast, x, g.y1 + afast + vert);
      linha(x, g.y0 - afast, x, g.y0 - afast - vert);
    }
  }
  if (horiz >= MIN) {
    for (const y of ys) {
      linha(g.x0 - afast, y, g.x0 - afast - horiz, y);
      linha(g.x1 + afast, y, g.x1 + afast + horiz, y);
    }
  }
}

/** Retângulo ocupado pela grade de talões (com sangria). */
export function limitesGrade(e: Encaixe): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of e.celulas) {
    const cw = c.rot ? c.h : c.w;
    const ch = c.rot ? c.w : c.h;
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x + cw);
    y1 = Math.max(y1, c.y + ch);
  }
  return { x0, y0, x1, y1 };
}

/** Tamanho final do talão (sem a sangria). */
export function tamanhoFinal(arte: { w: number; h: number }, sangriaPt: number): { w: number; h: number } {
  return { w: arte.w - 2 * sangriaPt, h: arte.h - 2 * sangriaPt };
}

/** Aproveitamento da folha: área final (sem sangria) dos talões ÷ área da folha, de 0 a 1. */
export function aproveitamento(e: Encaixe, sangriaPt: number): number {
  if (!e.celulas.length) return 0;
  const c = e.celulas[0];
  const f = tamanhoFinal(c, sangriaPt);
  return (Math.max(0, f.w) * Math.max(0, f.h) * e.celulas.length) / (e.folhaW * e.folhaH);
}

