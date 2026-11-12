// Pré-impressão → "Sangria automática".
// Arte que chegou SEM sangria ganha uma faixa em volta (padrão 3 mm) feita só com as
// bordas da própria arte: espelhando, esticando o último pixel ou com uma cor sólida.
// A arte original continua intacta (vetorial, no PDF); só a faixa nova é imagem.
// Também confere se tem coisa colada na borda (margem de segurança do texto).
// Tudo no navegador, sem IA e sem custo. Contas de pixel puras (testáveis); o desenho
// em canvas e o PDF ficam no ./navegador e aqui embaixo.

import { PDFDocument } from "pdf-lib";
import { PT_POR_MM } from "./folha";

export type ModoSangria = "espelhar" | "esticar" | "cor";

/** Padrões da Max (decididos com o Juliano em 12/11/2026). */
export const SANGRIA_PADRAO_MM = 3;
/** Distância mínima entre o texto/logo e a linha de corte. */
export const MARGEM_SEGURANCA_PADRAO_MM = 3;

/** Imagem em RGBA (4 bytes por pixel), linha a linha. */
export interface Pixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

export type Cor = [number, number, number];

/** "#rrggbb" → [r, g, b] (cinza 128 se inválido). */
export function corDeHex(hex: string): Cor {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [128, 128, 128];
  const v = Number.parseInt(m[1], 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * Qual pixel da arte alimenta a posição `i` (que pode ser negativa ou passar do fim)
 * numa linha de `n` pixels. espelhar = reflexo na borda (-1 → 0, -2 → 1…; repete se a
 * faixa for maior que a arte); esticar = repete o pixel da borda.
 */
export function indiceOrigem(i: number, n: number, modo: "espelhar" | "esticar"): number {
  if (i >= 0 && i < n) return i;
  if (modo === "esticar") return i < 0 ? 0 : n - 1;
  // reflexo com período 2n: ... 1 0 | 0 1 2 ... n-1 | n-1 ... 1 0 | 0 ...
  const periodo = 2 * n;
  const r = ((i % periodo) + periodo) % periodo;
  return r < n ? r : periodo - 1 - r;
}

/** Arte com `b` pixels a mais em cada lado, preenchidos conforme o modo. */
export function expandirPixels(src: Pixels, b: number, modo: ModoSangria, cor: Cor = [255, 255, 255]): Pixels {
  const W = src.w + 2 * b;
  const H = src.h + 2 * b;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    const dentroY = y >= b && y < b + src.h;
    const sy = modo === "cor" ? y - b : indiceOrigem(y - b, src.h, modo);
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const dentro = dentroY && x >= b && x < b + src.w;
      if (modo === "cor" && !dentro) {
        data[o] = cor[0];
        data[o + 1] = cor[1];
        data[o + 2] = cor[2];
        data[o + 3] = 255;
        continue;
      }
      const sx = modo === "cor" ? x - b : indiceOrigem(x - b, src.w, modo);
      const s = (sy * src.w + sx) * 4;
      data[o] = src.data[s];
      data[o + 1] = src.data[s + 1];
      data[o + 2] = src.data[s + 2];
      data[o + 3] = src.data[s + 3];
    }
  }
  return { w: W, h: H, data };
}

/** Recorte retangular. */
export function recortarPixels(src: Pixels, x0: number, y0: number, w: number, h: number): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const de = ((y0 + y) * src.w + x0) * 4;
    data.set(src.data.subarray(de, de + w * 4), y * w * 4);
  }
  return { w, h, data };
}

/** As 4 faixas da sangria (já com os cantos nas de cima e de baixo). */
export interface Faixas {
  topo: Pixels;
  base: Pixels;
  esquerda: Pixels;
  direita: Pixels;
}

export function faixasDaSangria(expandida: Pixels, b: number): Faixas {
  const { w: W, h: H } = expandida;
  return {
    topo: recortarPixels(expandida, 0, 0, W, b),
    base: recortarPixels(expandida, 0, H - b, W, b),
    esquerda: recortarPixels(expandida, 0, b, b, H - 2 * b),
    direita: recortarPixels(expandida, W - b, b, b, H - 2 * b),
  };
}

// ─── Margem de segurança ────────────────────────────────────────────

export interface ConferenciaMargem {
  /**
   * ok = nada diferente da borda dentro da margem; atencao = tem algo (texto, logo,
   * desenho) dentro da margem; indeterminado = a borda tem foto/degradê e não dá para
   * separar fundo de texto (confira na prévia).
   */
  situacao: "ok" | "atencao" | "indeterminado";
  /** Parte (0–1) da faixa de segurança que difere da cor da borda. */
  fracao: number;
}

/**
 * Procura coisa colada na borda. Cada ponto da faixa entre a borda e a margem de segurança
 * é comparado com o ponto da borda que está logo "ao lado" dele (na direção do corte): se a
 * cor mudou muito, tem algo ali (texto, logo, desenho). Fundo liso, degradê e listras que
 * chegam até a borda não disparam o aviso. Se a própria borda é "suja" (foto, textura
 * granulada) o sistema não consegue separar fundo de texto e devolve "indeterminado".
 * É um aviso, não uma garantia: o certo é olhar a prévia com a linha tracejada.
 */
export function conferirMargemSeguranca(src: Pixels, pxPorMm: number, margemMm: number): ConferenciaMargem {
  const faixa = Math.round(margemMm * pxPorMm);
  if (faixa < 2 || src.w <= 2 * faixa || src.h <= 2 * faixa) return { situacao: "indeterminado", fracao: 0 };

  const canal = (x: number, y: number, c: number) => src.data[(y * src.w + x) * 4 + c];
  const dif = (x1: number, y1: number, x2: number, y2: number) =>
    (Math.abs(canal(x1, y1, 0) - canal(x2, y2, 0)) + Math.abs(canal(x1, y1, 1) - canal(x2, y2, 1)) + Math.abs(canal(x1, y1, 2) - canal(x2, y2, 2))) / 3;

  // A borda é "limpa"? Poucos saltos de cor entre pontos vizinhos ao longo dos 4 lados.
  let saltos = 0;
  let pares = 0;
  const passo = Math.max(1, Math.floor(Math.max(src.w, src.h) / 1000));
  for (let x = 0; x + 1 < src.w; x += passo) {
    for (const y of [0, src.h - 1]) {
      pares++;
      if (dif(x, y, x + 1, y) > 15) saltos++;
    }
  }
  for (let y = 0; y + 1 < src.h; y += passo) {
    for (const x of [0, src.w - 1]) {
      pares++;
      if (dif(x, y, x, y + 1) > 15) saltos++;
    }
  }
  if (!pares || saltos / pares > 0.08) return { situacao: "indeterminado", fracao: 0 };

  let total = 0;
  let diferentes = 0;
  const passoB = Math.max(1, Math.floor(Math.min(src.w, src.h) / 800));
  for (let y = 0; y < src.h; y += passoB) {
    for (let x = 0; x < src.w; x += passoB) {
      const dEsq = x;
      const dDir = src.w - 1 - x;
      const dTopo = y;
      const dBase = src.h - 1 - y;
      const d = Math.min(dEsq, dDir, dTopo, dBase);
      if (d < 1 || d >= faixa) continue;
      // ponto da borda na direção do lado mais próximo
      let rx = x;
      let ry = y;
      if (d === dEsq) rx = 0;
      else if (d === dDir) rx = src.w - 1;
      else if (d === dTopo) ry = 0;
      else ry = src.h - 1;
      total++;
      if (dif(x, y, rx, ry) > 40) diferentes++;
    }
  }
  const fracao = total ? diferentes / total : 0;
  // 0,3%: um traço de letra encostado já passa disso; ruído de JPG não
  return { situacao: fracao > 0.003 ? "atencao" : "ok", fracao };
}

// ─── PDF com sangria ────────────────────────────────────────────────

/** Entrega as 4 faixas (PNG) de uma página: o navegador desenha e codifica. */
export type FornecedorFaixas = (pagina: number, wPt: number, hPt: number) => Promise<{ topo: Uint8Array; base: Uint8Array; esquerda: Uint8Array; direita: Uint8Array }>;

/**
 * Novo PDF em que cada página é a arte original (vetor intacto) centralizada numa página
 * maior, com as faixas da sangria em volta. Grava TrimBox = tamanho original e BleedBox =
 * página inteira, então a Montagem lê a sangria sozinha.
 */
export async function gerarComSangria(emPe: Uint8Array, sangriaMm: number, faixas: FornecedorFaixas): Promise<Uint8Array> {
  const b = sangriaMm * PT_POR_MM;
  const origem = await PDFDocument.load(emPe);
  const saida = await PDFDocument.create();
  for (const [i, original] of origem.getPages().entries()) {
    const w = original.getWidth();
    const h = original.getHeight();
    const W = w + 2 * b;
    const H = h + 2 * b;
    // Página sem conteúdo nenhum não pode ser embutida: fica só a sangria (em branco)
    const embutida = original.node.Contents() ? await saida.embedPage(original) : null;
    const f = await faixas(i, w, h);
    const page = saida.addPage([W, H]);
    page.drawImage(await saida.embedPng(f.topo), { x: 0, y: H - b, width: W, height: b });
    page.drawImage(await saida.embedPng(f.base), { x: 0, y: 0, width: W, height: b });
    page.drawImage(await saida.embedPng(f.esquerda), { x: 0, y: b, width: b, height: h });
    page.drawImage(await saida.embedPng(f.direita), { x: W - b, y: b, width: b, height: h });
    if (embutida) page.drawPage(embutida, { x: b, y: b });
    page.setTrimBox(b, b, w, h);
    page.setBleedBox(0, 0, W, H);
  }
  return saida.save();
}
