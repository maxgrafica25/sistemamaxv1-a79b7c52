// Pré-impressão → "Numeração de talões e blocos".
//
// Recebe a arte do talão em PDF (1 talão por página, ou já montada com vários
// na folha) e gera o PDF de impressão com a numeração em CORTE E EMPILHA:
// depois de cortar a pilha de folhas, cada monte já sai em sequência
// (monte 1 = talões 1..n, monte 2 = talões n+1.., etc.). Um PDF por via.
//
// Tudo roda no navegador. Este módulo é lógica pura (sem React/canvas), testável.

import { PDFDocument, StandardFonts, cmyk, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import { PT_POR_CM, processarPdf } from "./margem";

export const PT_POR_MM = PT_POR_CM / 10;

// ─── Formato do número ───────────────────────────────────────────────

export function formatarNumero(n: number, digitos: number, prefixo = ""): string {
  return `${prefixo}${String(Math.max(0, Math.floor(n))).padStart(Math.max(1, digitos), "0")}`;
}

// ─── Corte e empilha ────────────────────────────────────────────────

export interface PlanoNumeracao {
  /** Talões por monte (por posição na folha). */
  taloesPorMonte: number;
  /** Folhas por via. */
  folhas: number;
  /** Posições da folha que ficam sem talão nenhum (montes vazios). */
  posicoesVazias: number;
  /** Espaços de talão em branco somando todos os montes (talões que caberiam sem aumentar as folhas). */
  espacosVazios: number;
  primeiro: number;
  ultimo: number;
}

/**
 * porFolha = talões lado a lado na folha (K); taloes = quantidade de talões (B);
 * jogos = números por talão (F); inicio = primeiro número.
 * Cada posição j da folha recebe um monte de `taloesPorMonte` talões inteiros, em sequência.
 */
export function planejarNumeracao(porFolha: number, taloes: number, jogos: number, inicio: number): PlanoNumeracao {
  const K = Math.max(1, Math.floor(porFolha));
  const B = Math.max(1, Math.floor(taloes));
  const F = Math.max(1, Math.floor(jogos));
  const tpm = Math.ceil(B / K);
  const montesUsados = Math.ceil(B / tpm);
  return {
    taloesPorMonte: tpm,
    folhas: tpm * F,
    posicoesVazias: K - montesUsados,
    espacosVazios: K * tpm - B,
    primeiro: inicio,
    ultimo: inicio + B * F - 1,
  };
}

/** Número impresso na posição j da folha s (0 = primeira), ou null se ali não há talão. */
export function numeroNaPosicao(
  plano: PlanoNumeracao,
  j: number,
  s: number,
  taloes: number,
  jogos: number,
  inicio: number,
): number | null {
  const F = Math.max(1, Math.floor(jogos));
  const talao = j * plano.taloesPorMonte + Math.floor(s / F);
  if (talao >= Math.max(1, Math.floor(taloes))) return null;
  return inicio + j * plano.taloesPorMonte * F + s;
}

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

// ─── Geração do PDF ─────────────────────────────────────────────────

/** Onde vai o número: centro do texto em fração da arte (x da esquerda, y do TOPO). */
export interface PosicaoNumero {
  x: number;
  y: number;
  /** Texto em pé (90°), para canhotos. */
  girar: boolean;
}

export type CorNumero = "preto" | "vermelho";

export interface ConfigNumeracao {
  modo: "solto" | "montado";
  /** Só "solto": tamanho da folha de impressão (pt). */
  folhaW: number;
  folhaH: number;
  /** Só "montado": grade da arte. */
  colunas: number;
  linhas: number;
  margemMm: number;
  espacoMm: number;
  marcasCorte: boolean;
  inicio: number;
  taloes: number;
  jogos: number;
  vias: number;
  digitos: number;
  prefixo: string;
  tamanhoPt: number;
  cor: CorNumero;
  posicoes: PosicaoNumero[];
  ordemInvertida: boolean;
}

export interface ResultadoNumeracao {
  /** Um PDF por via. */
  vias: Uint8Array[];
  plano: PlanoNumeracao;
  encaixe: Encaixe;
  porFolha: number;
}

const CORES = { preto: cmyk(0, 0, 0, 1), vermelho: cmyk(0, 1, 1, 0) };
const PRETO = cmyk(0, 0, 0, 1);

/** Página da arte usada em cada via: página k se existir, senão a última. */
export function paginaDaVia(via: number, totalPaginas: number): number {
  return Math.min(Math.max(0, via), Math.max(0, totalPaginas - 1));
}

/** Arte com /Rotate e CropBox "desentortados": cada página fica em pé, do tamanho visível. */
export async function arteEmPe(bytes: Uint8Array): Promise<Uint8Array> {
  const r = await processarPdf(bytes, { top: 0, bottom: 0, left: 0, right: 0 });
  return r.bytes;
}

/** Tamanho (pt) da 1ª página já em pé. */
export async function tamanhoArte(bytesEmPe: Uint8Array): Promise<{ w: number; h: number; paginas: number }> {
  const doc = await PDFDocument.load(bytesEmPe);
  const p = doc.getPage(0);
  return { w: p.getWidth(), h: p.getHeight(), paginas: doc.getPageCount() };
}

function desenharNumero(page: PDFPage, font: PDFFont, c: Celula, pos: PosicaoNumero, texto: string, cfg: ConfigNumeracao) {
  const size = cfg.tamanhoPt;
  const tw = font.widthOfTextAtSize(texto, size);
  const k = size * 0.35; // ~ metade da altura das maiúsculas: centraliza na vertical
  const u = pos.x * c.w;
  const v = (1 - pos.y) * c.h;
  const origemArte = pos.girar ? { u: u + k, v: v - tw / 2 } : { u: u - tw / 2, v: v - k };
  const o = pontoNaFolha(c, origemArte.u, origemArte.v);
  const rot = (pos.girar ? 90 : 0) + c.rot;
  page.drawText(texto, { x: o.x, y: o.y, size, font, color: CORES[cfg.cor], rotate: degrees(rot) });
}

/** Marcas de corte no lado de fora da grade (só quando a margem tem espaço). */
function desenharMarcas(page: PDFPage, e: Encaixe) {
  if (!e.celulas.length) return;
  const xs = new Set<number>();
  const ys = new Set<number>();
  for (const c of e.celulas) {
    const cw = c.rot ? c.h : c.w;
    const ch = c.rot ? c.w : c.h;
    xs.add(+c.x.toFixed(3)).add(+(c.x + cw).toFixed(3));
    ys.add(+c.y.toFixed(3)).add(+(c.y + ch).toFixed(3));
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const afast = 1 * PT_POR_MM;
  const comp = 4 * PT_POR_MM;
  const linha = (x1: number, y1: number, x2: number, y2: number) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.25, color: PRETO });
  if (minY - afast - comp >= 0 && maxY + afast + comp <= e.folhaH) {
    for (const x of xs) {
      linha(x, maxY + afast, x, maxY + afast + comp);
      linha(x, minY - afast, x, minY - afast - comp);
    }
  }
  if (minX - afast - comp >= 0 && maxX + afast + comp <= e.folhaW) {
    for (const y of ys) {
      linha(minX - afast, y, minX - afast - comp, y);
      linha(maxX + afast, y, maxX + afast + comp, y);
    }
  }
}

export const LIMITE_FOLHAS = 10_000;

/** Calcula encaixe e plano sem gerar o PDF (para mostrar o resumo na tela). */
export function calcularEncaixe(cfg: ConfigNumeracao, arte: { w: number; h: number }): Encaixe {
  const m = cfg.margemMm * PT_POR_MM;
  const e = cfg.espacoMm * PT_POR_MM;
  return cfg.modo === "solto"
    ? encaixarNaFolha(cfg.folhaW, cfg.folhaH, arte.w, arte.h, m, e)
    : gradeMontada(arte.w, arte.h, cfg.colunas, cfg.linhas, m, e);
}

export async function gerarNumeracao(bytesEmPe: Uint8Array, cfg: ConfigNumeracao): Promise<ResultadoNumeracao> {
  const fonte = await PDFDocument.load(bytesEmPe);
  const totalPaginas = fonte.getPageCount();
  const p0 = fonte.getPage(0);
  const encaixe = calcularEncaixe(cfg, { w: p0.getWidth(), h: p0.getHeight() });
  const K = encaixe.celulas.length;
  if (!K || encaixe.celulas[0].w <= 0 || encaixe.celulas[0].h <= 0) {
    throw new Error(cfg.modo === "solto" ? "A arte não cabe na folha escolhida." : "Colunas, linhas ou margem não batem com a página.");
  }
  if (!cfg.posicoes.length) throw new Error("Clique na prévia para escolher onde vai o número.");
  const plano = planejarNumeracao(K, cfg.taloes, cfg.jogos, cfg.inicio);
  if (plano.folhas > LIMITE_FOLHAS) throw new Error(`São ${plano.folhas} folhas por via: divida o pedido (máximo ${LIMITE_FOLHAS}).`);

  const vias: Uint8Array[] = [];
  const nVias = Math.max(1, Math.min(4, Math.floor(cfg.vias)));
  for (let via = 0; via < nVias; via++) {
    const out = await PDFDocument.create();
    out.setProducer("Sistema Max · Pré-impressão");
    out.setCreator("Sistema Max · Numeração de talões");
    out.setTitle(`Numeração ${formatarNumero(plano.primeiro, cfg.digitos)}–${formatarNumero(plano.ultimo, cfg.digitos)} · via ${via + 1}`);
    const [arte] = await out.embedPdf(bytesEmPe, [paginaDaVia(via, totalPaginas)]);
    const font = await out.embedFont(StandardFonts.HelveticaBold);

    for (let i = 0; i < plano.folhas; i++) {
      const s = cfg.ordemInvertida ? plano.folhas - 1 - i : i;
      const page = out.addPage([encaixe.folhaW, encaixe.folhaH]);
      if (cfg.modo === "montado") page.drawPage(arte, { x: 0, y: 0 });
      encaixe.celulas.forEach((c, j) => {
        const n = numeroNaPosicao(plano, j, s, cfg.taloes, cfg.jogos, cfg.inicio);
        if (n === null) return; // posição sem talão: fica em branco
        if (cfg.modo === "solto") {
          const o = pontoNaFolha(c, 0, 0);
          page.drawPage(arte, { x: o.x, y: o.y, width: c.w, height: c.h, rotate: degrees(c.rot) });
        }
        const texto = formatarNumero(n, cfg.digitos, cfg.prefixo);
        for (const pos of cfg.posicoes) desenharNumero(page, font, c, pos, texto, cfg);
      });
      if (cfg.modo === "solto" && cfg.marcasCorte) desenharMarcas(page, encaixe);
    }
    vias.push(await out.save());
  }
  return { vias, plano, encaixe, porFolha: K };
}

export const FOLHAS_PADRAO: { key: string; rotulo: string; wCm: number; hCm: number }[] = [
  { key: "a4", rotulo: "A4", wCm: 21, hCm: 29.7 },
  { key: "a3", rotulo: "A3", wCm: 29.7, hCm: 42 },
  { key: "sra3", rotulo: "SRA3", wCm: 32, hCm: 45 },
  { key: "33x48", rotulo: "33 × 48", wCm: 33, hCm: 48 },
];
