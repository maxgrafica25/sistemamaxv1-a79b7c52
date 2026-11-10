// Pré-impressão → "Numeração de talões e blocos".
//
// Recebe a arte do talão em PDF (1 talão por página, ou já montada com vários
// na folha) e gera o PDF de impressão com a numeração em CORTE E EMPILHA:
// depois de cortar a pilha de folhas, cada monte já sai em sequência
// (monte 1 = talões 1..n, monte 2 = talões n+1.., etc.). Um PDF por via.
//
// Tudo roda no navegador. Este módulo é lógica pura (sem React/canvas), testável.

import { PDFDocument, StandardFonts, cmyk, degrees, type PDFFont, type PDFPage } from "pdf-lib";

export * from "./folha";
import {
  PT_POR_MM,
  desenharArteNaCelula,
  desenharMarcas,
  encaixarNaFolha,
  gradeMontada,
  pontoNaFolha,
  type Celula,
  type Encaixe,
} from "./folha";

// ─── Formato do número ───────────────────────────────────────────────

export function formatarNumero(n: number, digitos: number, prefixo = ""): string {
  return `${prefixo}${String(Math.max(0, Math.floor(n))).padStart(Math.max(1, digitos), "0")}`;
}

// ─── Corte e empilha ────────────────────────────────────────────────

export interface PlanoNumeracao {
  /** Folhas por via = números em cada monte (posição da folha). */
  folhas: number;
  /** Posições da folha que ficam sem número nenhum (só quando há menos números que posições). */
  posicoesVazias: number;
  /** Espaços em branco no fim do último monte (K × folhas − total de números). */
  espacosVazios: number;
  /** Algum talão fica dividido entre dois montes (é só empilhar os montes na ordem). */
  talaoDividido: boolean;
  primeiro: number;
  ultimo: number;
}

/**
 * Corte e empilha com SEQUÊNCIA CONTÍNUA (regra corrigida em 09/11 com o Juliano):
 * o total de números (talões × jogos) é dividido igualmente entre as K posições da
 * folha. Monte j = números [inicio + j·folhas, inicio + (j+1)·folhas). Depois de
 * cortar, empilhar os montes na ordem 1, 2, 3… dá a sequência inteira; separar os
 * talões a cada `jogos` folhas. Ex.: 2 talões de 50 em 4 por folha → 25 folhas,
 * montes 1–25, 26–50, 51–75, 76–100 (antes ficavam 2 posições vazias e 50 folhas).
 */
export function planejarNumeracao(porFolha: number, taloes: number, jogos: number, inicio: number): PlanoNumeracao {
  const K = Math.max(1, Math.floor(porFolha));
  const B = Math.max(1, Math.floor(taloes));
  const F = Math.max(1, Math.floor(jogos));
  const total = B * F;
  const folhas = Math.ceil(total / K);
  return {
    folhas,
    posicoesVazias: K - Math.ceil(total / folhas),
    espacosVazios: K * folhas - total,
    talaoDividido: folhas % F !== 0,
    primeiro: inicio,
    ultimo: inicio + total - 1,
  };
}

/** Número impresso na posição j da folha s (0 = primeira), ou null se ali fica em branco. */
export function numeroNaPosicao(
  plano: PlanoNumeracao,
  j: number,
  s: number,
  taloes: number,
  jogos: number,
  inicio: number,
): number | null {
  const total = Math.max(1, Math.floor(taloes)) * Math.max(1, Math.floor(jogos));
  const indice = j * plano.folhas + s;
  return indice < total ? inicio + indice : null;
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
  /** Sangria que a arte JÁ TRAZ em cada lado (mm). O corte fica essa medida para dentro. */
  sangriaMm: number;
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

/** Página da arte usada em cada via: página k se existir, senão a última. */
export function paginaDaVia(via: number, totalPaginas: number): number {
  return Math.min(Math.max(0, via), Math.max(0, totalPaginas - 1));
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
          desenharArteNaCelula(page, arte, c);
        }
        const texto = formatarNumero(n, cfg.digitos, cfg.prefixo);
        for (const pos of cfg.posicoes) desenharNumero(page, font, c, pos, texto, cfg);
      });
      if (cfg.modo === "solto" && cfg.marcasCorte) desenharMarcas(page, encaixe, cfg.sangriaMm * PT_POR_MM);
    }
    vias.push(await out.save());
  }
  return { vias, plano, encaixe, porFolha: K };
}

