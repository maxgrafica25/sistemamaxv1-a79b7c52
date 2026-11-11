// Pré-impressão → "Montagem de impressos" (aproveitamento sem numeração).
//
// Recebe o PDF de UMA arte (cartão, panfleto, etiqueta…), com sangria, e monta a
// folha de impressão com quantas couberem, marcas de corte e, se o PDF tiver
// frente e verso, a folha do verso já na posição certa para imprimir nos dois lados.
// Usa o mesmo motor de encaixe da Numeração (./folha). Lógica pura, testável.

import { PDFDocument } from "pdf-lib";
import { PT_POR_MM, desenharArteNaCelula, desenharMarcas, encaixarNaFolha, type Encaixe, type Giro } from "./folha";

/** Como a folha é virada para imprimir o verso. */
export type Virada = "lateral" | "vertical";

export interface ConfigMontagem {
  folhaW: number;
  folhaH: number;
  margemMm: number;
  espacoMm: number;
  /** Sangria que a arte já traz em cada lado (mm). */
  sangriaMm: number;
  marcasCorte: boolean;
  /** Páginas do PDF em pares: 1 = frente, 2 = verso, 3 = frente do 2º modelo… */
  frenteVerso: boolean;
  virada: Virada;
  /**
   * "repetir" = a mesma arte enche a folha (cartão, panfleto);
   * "diferentes" = cada página do PDF ocupa um lugar da folha (convites com nome,
   * certificados, cartões de pessoas diferentes…).
   */
  conteudo?: Conteudo;
  /** Só "diferentes": ordem das páginas na folha. */
  ordem?: Ordem;
}

export type Conteudo = "repetir" | "diferentes";
/** "folha" = 1, 2, 3… em cada folha; "empilha" = corte e empilha (cada monte sai em sequência). */
export type Ordem = "folha" | "empilha";

/**
 * Páginas diferentes: quantas folhas e quais peças ficam em branco.
 * `pecas` = páginas do PDF (ou pares frente/verso).
 */
export function planejarDiferentes(porFolha: number, paginas: number, frenteVerso: boolean): { pecas: number; folhas: number; vazias: number } {
  const K = Math.max(1, Math.floor(porFolha));
  const pecas = frenteVerso ? Math.ceil(Math.max(1, paginas) / 2) : Math.max(1, paginas);
  const folhas = Math.ceil(pecas / K);
  return { pecas, folhas, vazias: folhas * K - pecas };
}

/** Peça (0 = primeira) que vai na posição j da folha s, ou null se fica em branco. */
export function pecaNaPosicao(ordem: Ordem, j: number, s: number, porFolha: number, folhas: number, pecas: number): number | null {
  const n = ordem === "empilha" ? j * folhas + s : s * porFolha + j;
  return n < pecas ? n : null;
}

/**
 * Posição, no VERSO, que fica nas costas da posição j da frente:
 * virando pelos lados troca as colunas; de baixo para cima troca as linhas.
 */
export function posicaoNoVerso(j: number, colunas: number, linhas: number, virada: Virada): number {
  const r = Math.floor(j / colunas);
  const c = j % colunas;
  return virada === "lateral" ? r * colunas + (colunas - 1 - c) : (linhas - 1 - r) * colunas + c;
}

/**
 * Giro da arte do VERSO para cair nas costas da frente.
 * lateral = virar a folha como página de livro (esquerda ↔ direita);
 * vertical = virar de baixo para cima (calendário).
 * Como todas as posições têm a mesma arte e a grade é centralizada, só o giro muda.
 */
export function giroDoVerso(rotFrente: 0 | 90, virada: Virada): Giro {
  const g = virada === "lateral" ? (360 - rotFrente) % 360 : (180 - rotFrente + 360) % 360;
  return g as Giro;
}

export interface PlanoMontagem {
  /** Modelos diferentes no PDF (cada um vira uma folha, ou um par frente/verso). */
  modelos: number;
  /** Folhas a imprimir de cada modelo para atingir a quantidade. */
  folhasPorModelo: number;
  /** Unidades a mais que saem em cada modelo. */
  sobra: number;
}

export function planejarMontagem(porFolha: number, quantidade: number, paginas: number, frenteVerso: boolean): PlanoMontagem {
  const K = Math.max(1, Math.floor(porFolha));
  const q = Math.max(1, Math.floor(quantidade));
  const folhas = Math.ceil(q / K);
  return {
    modelos: frenteVerso ? Math.ceil(Math.max(1, paginas) / 2) : Math.max(1, paginas),
    folhasPorModelo: folhas,
    sobra: folhas * K - q,
  };
}

export function encaixeMontagem(cfg: ConfigMontagem, arte: { w: number; h: number }): Encaixe {
  return encaixarNaFolha(cfg.folhaW, cfg.folhaH, arte.w, arte.h, cfg.margemMm * PT_POR_MM, cfg.espacoMm * PT_POR_MM);
}

export interface ResultadoMontagem {
  bytes: Uint8Array;
  encaixe: Encaixe;
  /** Páginas do PDF gerado (folhas de frente + folhas de verso). */
  paginasSaida: number;
}

export const LIMITE_MODELOS = 200;
export const LIMITE_PAGINAS_DIFERENTES = 2000;

/** `bytesEmPe` = arte já passada por `arteEmPe` (sem /Rotate). */
export async function gerarMontagem(bytesEmPe: Uint8Array, cfg: ConfigMontagem): Promise<ResultadoMontagem> {
  const fonte = await PDFDocument.load(bytesEmPe);
  const total = fonte.getPageCount();
  const diferentes = cfg.conteudo === "diferentes";
  const limite = diferentes ? LIMITE_PAGINAS_DIFERENTES : LIMITE_MODELOS;
  if (total > limite) throw new Error(`O PDF tem ${total} páginas: o máximo é ${limite}.`);
  const p0 = fonte.getPage(0);
  const encaixe = encaixeMontagem(cfg, { w: p0.getWidth(), h: p0.getHeight() });
  if (!encaixe.celulas.length) throw new Error("A arte não cabe na folha escolhida.");

  const out = await PDFDocument.create();
  out.setProducer("Sistema Max · Pré-impressão");
  out.setCreator("Sistema Max · Montagem de impressos");
  const artes = await out.embedPdf(bytesEmPe, Array.from({ length: total }, (_, i) => i));
  const sangria = cfg.sangriaMm * PT_POR_MM;
  const rot = encaixe.celulas[0].rot;

  const folha = (indice: number, giro: Giro) => {
    const page = out.addPage([encaixe.folhaW, encaixe.folhaH]);
    for (const c of encaixe.celulas) desenharArteNaCelula(page, artes[indice], c, giro);
    if (cfg.marcasCorte) desenharMarcas(page, encaixe, sangria);
  };

  if (diferentes) {
    const K = encaixe.celulas.length;
    const plano = planejarDiferentes(K, total, cfg.frenteVerso);
    const ordem = cfg.ordem ?? "folha";
    const giroVerso = giroDoVerso(rot, cfg.virada);
    for (let s = 0; s < plano.folhas; s++) {
      const frente = out.addPage([encaixe.folhaW, encaixe.folhaH]);
      const verso = cfg.frenteVerso ? out.addPage([encaixe.folhaW, encaixe.folhaH]) : null;
      encaixe.celulas.forEach((c, j) => {
        const peca = pecaNaPosicao(ordem, j, s, K, plano.folhas, plano.pecas);
        if (peca === null) return;
        const pagFrente = cfg.frenteVerso ? peca * 2 : peca;
        desenharArteNaCelula(frente, artes[pagFrente], c, rot);
        if (verso && pagFrente + 1 < total) {
          const cv = encaixe.celulas[posicaoNoVerso(j, encaixe.colunas, encaixe.linhas, cfg.virada)];
          desenharArteNaCelula(verso, artes[pagFrente + 1], cv, giroVerso);
        }
      });
      if (cfg.marcasCorte) {
        desenharMarcas(frente, encaixe, sangria);
        if (verso) desenharMarcas(verso, encaixe, sangria);
      }
    }
  } else if (cfg.frenteVerso) {
    for (let i = 0; i < total; i += 2) {
      folha(i, rot);
      if (i + 1 < total) folha(i + 1, giroDoVerso(rot, cfg.virada));
    }
  } else {
    for (let i = 0; i < total; i++) folha(i, rot);
  }
  return { bytes: await out.save(), encaixe, paginasSaida: out.getPageCount() };
}
