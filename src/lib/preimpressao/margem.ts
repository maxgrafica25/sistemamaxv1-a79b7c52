// Pré-impressão → "Margem de acabamento".
//
// Banners e faixas de lona chegam em PDF/PNG/JPG já no tamanho final (1:1).
// Aqui a página é AUMENTADA FORA da arte: a área a mais fica sem preenchimento
// (branca/transparente) e só uma linha fina preto 50% (CMYK 0/0/0/50, 0,5 mm) na
// borda de fora marca onde cortar a lona (decidido com o Juliano em 08/11/2026).
// A arte não muda de tamanho.
//
// Tudo roda no navegador: nenhum arquivo é enviado para servidor.
// Este módulo é só lógica pura (sem React, sem canvas), para poder ser testado.

import { PDFDocument, cmyk, degrees, type PDFPage } from "pdf-lib";

// ─── Medidas ─────────────────────────────────────────────────────────

export type Peca = "banner" | "faixa" | "todos";

export const PECAS: { key: Peca; label: string }[] = [
  { key: "banner", label: "Banner · cima e baixo" },
  { key: "faixa", label: "Faixa · laterais" },
  { key: "todos", label: "Todos os lados" },
];

/** Pontos PDF por centímetro (1 pt = 1/72 pol). */
export const PT_POR_CM = 72 / 2.54;
/** Maior lado de página que o Acrobat aceita: 200 pol = 508 cm. */
export const LIMITE_ACROBAT_CM = 508;
/** Cor da linha de corte em PNG/JPG (equivalente RGB do K50). */
export const COR_LINHA_RGB = "#808080";
/** Espessura da linha de corte, na borda de fora da área a mais (0,5 mm, pedido do Juliano em 10/11; antes 1 mm). */
export const ESPESSURA_LINHA_MM = 0.5;
/** Limites seguros do canvas dos navegadores. */
export const CANVAS_MAX_LADO = 32767;
export const CANVAS_MAX_PIXELS = 250_000_000;

/** Margens em cm, por lado. */
export interface Margens {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function margensPara(peca: Peca, cm: number): Margens {
  const v = Number.isFinite(cm) && cm > 0 ? cm : 0;
  if (peca === "banner") return { top: v, bottom: v, left: 0, right: 0 };
  if (peca === "faixa") return { top: 0, bottom: 0, left: v, right: v };
  return { top: v, bottom: v, left: v, right: v };
}

export interface TamanhoCm {
  w: number;
  h: number;
}

export function tamanhoComMargens(t: TamanhoCm, m: Margens): TamanhoCm {
  return { w: t.w + m.left + m.right, h: t.h + m.top + m.bottom };
}

export function passaLimiteAcrobat(t: TamanhoCm): boolean {
  return t.w > LIMITE_ACROBAT_CM + 0.01 || t.h > LIMITE_ACROBAT_CM + 0.01;
}

const fmt1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "80,0 × 120,0 cm" */
export function formatarTamanho(t: TamanhoCm): string {
  return `${fmt1.format(t.w)} × ${fmt1.format(t.h)} cm`;
}

/** "80,0 × 120,0 cm → 80,0 × 140,0 cm" */
export function formatarAntesDepois(antes: TamanhoCm, depois: TamanhoCm): string {
  return `${formatarTamanho(antes)} → ${formatarTamanho(depois)}`;
}

/** "banner.final.png" → "banner.final_acabamento.png" (ou .pdf). */
export function nomeResultado(nomeOriginal: string, extSaida?: string): string {
  const i = nomeOriginal.lastIndexOf(".");
  const base = i > 0 ? nomeOriginal.slice(0, i) : nomeOriginal;
  const extOrig = i > 0 ? nomeOriginal.slice(i + 1) : "";
  const ext = extSaida ?? extOrig;
  return ext ? `${base}_acabamento.${ext}` : `${base}_acabamento`;
}

// ─── Tipo do arquivo ─────────────────────────────────────────────────

export type TipoArquivo = "pdf" | "png" | "jpg" | "cdr" | "desconhecido";

export function detectarTipo(bytes: Uint8Array, nome: string): TipoArquivo {
  const ext = nome.toLowerCase().split(".").pop() ?? "";
  if (ext === "cdr") return "cdr";
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  // %PDF pode vir depois de lixo no início (até 1 KB é tolerado pelos leitores)
  if (ext === "pdf" && latin1(bytes.subarray(0, 1024)).includes("%PDF")) return "pdf";
  if (bytes.length >= 8 && PNG_SIG.every((b, i) => bytes[i] === b)) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  // CorelDRAW: RIFF....CDR?
  if (bytes.length >= 12 && latin1(bytes.subarray(0, 4)) === "RIFF" && latin1(bytes.subarray(8, 11)).toUpperCase() === "CDR") return "cdr";
  return "desconhecido";
}

function latin1(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

// ─── PNG: tamanho e DPI (chunk pHYs) ─────────────────────────────────

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface InfoImagem {
  tipo: "png" | "jpg";
  larguraPx: number;
  alturaPx: number;
  /** DPI horizontal lido do arquivo; null se o arquivo não informa. */
  dpi: number | null;
  /** Só JPG: 4 componentes (CMYK/YCCK). */
  cmyk: boolean;
}

/** DPI arredondado quando está a menos de 0,1 de um inteiro (ppm → dpi perde precisão). */
function arredondarDpi(dpi: number): number {
  const r = Math.round(dpi);
  return Math.abs(dpi - r) < 0.1 ? r : dpi;
}

function u32(b: Uint8Array, o: number): number {
  return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
}

function tipoChunk(b: Uint8Array, o: number): string {
  return String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
}

export function lerInfoPng(b: Uint8Array): InfoImagem {
  if (b.length < 33 || !PNG_SIG.every((x, i) => b[i] === x)) throw new Error("PNG inválido ou corrompido.");
  let o = 8;
  let w = 0;
  let h = 0;
  let dpi: number | null = null;
  while (o + 8 <= b.length) {
    const len = u32(b, o);
    const tipo = tipoChunk(b, o + 4);
    const d = o + 8;
    if (tipo === "IHDR") {
      w = u32(b, d);
      h = u32(b, d + 4);
    } else if (tipo === "pHYs" && len >= 9) {
      const ppmX = u32(b, d);
      const unidade = b[d + 8];
      if (unidade === 1 && ppmX > 0) dpi = arredondarDpi(ppmX * 0.0254);
    } else if (tipo === "IDAT" || tipo === "IEND") {
      break; // pHYs tem que vir antes do IDAT
    }
    o = d + len + 4;
  }
  if (!w || !h) throw new Error("PNG inválido: sem cabeçalho IHDR.");
  return { tipo: "png", larguraPx: w, alturaPx: h, dpi, cmyk: false };
}

let CRC_TABLE: Uint32Array | null = null;
export function crc32(b: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function putU32(b: Uint8Array, o: number, v: number) {
  b[o] = (v >>> 24) & 0xff;
  b[o + 1] = (v >>> 16) & 0xff;
  b[o + 2] = (v >>> 8) & 0xff;
  b[o + 3] = v & 0xff;
}

/** Monta um chunk PNG completo (tamanho + tipo + dados + CRC). */
export function chunkPng(tipo: string, dados: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + dados.length);
  putU32(out, 0, dados.length);
  for (let i = 0; i < 4; i++) out[4 + i] = tipo.charCodeAt(i);
  out.set(dados, 8);
  putU32(out, 8 + dados.length, crc32(out.subarray(4, 8 + dados.length)));
  return out;
}

/** Grava o DPI no PNG: remove pHYs antigos e insere um novo logo após o IHDR. */
export function gravarDpiPng(b: Uint8Array, dpi: number): Uint8Array {
  lerInfoPng(b); // valida
  const ppm = Math.round(dpi / 0.0254);
  const dados = new Uint8Array(9);
  putU32(dados, 0, ppm);
  putU32(dados, 4, ppm);
  dados[8] = 1; // metro
  const phys = chunkPng("pHYs", dados);

  const partes: Uint8Array[] = [b.subarray(0, 8)];
  let o = 8;
  while (o + 8 <= b.length) {
    const len = u32(b, o);
    const tipo = tipoChunk(b, o + 4);
    const fim = o + 12 + len;
    if (tipo !== "pHYs") partes.push(b.subarray(o, fim));
    if (tipo === "IHDR") partes.push(phys);
    o = fim;
  }
  return concat(partes);
}

function concat(partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of partes) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ─── JPG: tamanho, DPI (JFIF / EXIF) e CMYK ──────────────────────────

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function u16(b: Uint8Array, o: number): number {
  return (b[o] << 8) | b[o + 1];
}

export function lerInfoJpg(b: Uint8Array): InfoImagem {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) throw new Error("JPG inválido ou corrompido.");
  let o = 2;
  let w = 0;
  let h = 0;
  let comps = 0;
  let dpiJfif: number | null = null;
  let dpiExif: number | null = null;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) {
      o++;
      continue;
    }
    const m = b[o + 1];
    if (m === 0xff) {
      o++; // preenchimento
      continue;
    }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      o += 2;
      continue;
    }
    if (m === 0xd9 || m === 0xda) break; // EOI / início dos dados
    const len = u16(b, o + 2);
    const d = o + 4;
    if (m === 0xe0 && latin1(b.subarray(d, d + 5)) === "JFIF\0") {
      const unid = b[d + 7];
      const xd = u16(b, d + 8);
      if (xd > 0 && unid === 1) dpiJfif = xd;
      else if (xd > 0 && unid === 2) dpiJfif = arredondarDpi(xd * 2.54);
    } else if (m === 0xe1 && latin1(b.subarray(d, d + 6)) === "Exif\0\0") {
      dpiExif = lerDpiExif(b.subarray(d + 6, o + 2 + len));
    } else if (SOF.has(m)) {
      h = u16(b, d + 1);
      w = u16(b, d + 3);
      comps = b[d + 5];
    }
    o += 2 + len;
  }
  if (!w || !h) throw new Error("JPG inválido: não encontrei o tamanho da imagem.");
  return { tipo: "jpg", larguraPx: w, alturaPx: h, dpi: dpiJfif ?? dpiExif, cmyk: comps === 4 };
}

function lerDpiExif(t: Uint8Array): number | null {
  if (t.length < 8) return null;
  const le = t[0] === 0x49 && t[1] === 0x49;
  if (!le && !(t[0] === 0x4d && t[1] === 0x4d)) return null;
  const r16 = (o: number) => (le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1]);
  const r32 = (o: number) =>
    (le ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24)) : (t[o] << 24) | (t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3]) >>> 0;
  const ifd = r32(4);
  if (ifd + 2 > t.length) return null;
  const n = r16(ifd);
  let xres: number | null = null;
  let unidade = 2;
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > t.length) break;
    const tag = r16(e);
    if (tag === 0x011a) {
      const off = r32(e + 8);
      if (off + 8 <= t.length) {
        const num = r32(off);
        const den = r32(off + 4);
        if (den > 0) xres = num / den;
      }
    } else if (tag === 0x0128) {
      unidade = r16(e + 8);
    }
  }
  if (!xres || xres <= 0) return null;
  if (unidade === 3) return arredondarDpi(xres * 2.54);
  if (unidade === 1) return null; // "sem unidade"
  return arredondarDpi(xres);
}

/** Grava o DPI no JPG: ajusta o APP0 JFIF (unidade = dpi) ou insere um novo logo após o SOI. */
export function gravarDpiJpg(b: Uint8Array, dpi: number): Uint8Array {
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error("JPG inválido.");
  const d = Math.max(1, Math.min(65535, Math.round(dpi)));
  if (b[2] === 0xff && b[3] === 0xe0 && latin1(b.subarray(6, 11)) === "JFIF\0") {
    const out = b.slice();
    out[13] = 1;
    out[14] = d >> 8;
    out[15] = d & 0xff;
    out[16] = d >> 8;
    out[17] = d & 0xff;
    return out;
  }
  const app0 = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
    d >> 8, d & 0xff, d >> 8, d & 0xff, 0x00, 0x00,
  ]);
  return concat([b.subarray(0, 2), app0, b.subarray(2)]);
}

export function lerInfoImagem(b: Uint8Array, tipo: "png" | "jpg"): InfoImagem {
  return tipo === "png" ? lerInfoPng(b) : lerInfoJpg(b);
}

// ─── Plano de uma imagem (pixels e cm) ───────────────────────────────

export interface PlanoImagem {
  dpi: number;
  antes: TamanhoCm;
  depois: TamanhoCm;
  /** Margens em pixels (arredondadas). */
  px: { top: number; bottom: number; left: number; right: number };
  larguraFinalPx: number;
  alturaFinalPx: number;
  /** Cabe num canvas do navegador? */
  cabeNoCanvas: boolean;
}

/**
 * DPI efetivo: se o usuário digitou a largura real do banner, ela manda
 * (DPI = pixels ÷ polegadas); senão usa o DPI do arquivo. null = falta a medida.
 */
export function dpiEfetivo(info: InfoImagem, larguraRealCm?: number | null): number | null {
  if (larguraRealCm && larguraRealCm > 0) return info.larguraPx / (larguraRealCm / 2.54);
  return info.dpi;
}

export function planejarImagem(info: InfoImagem, m: Margens, dpi: number): PlanoImagem {
  const pxPorCm = dpi / 2.54;
  const px = {
    top: Math.round(m.top * pxPorCm),
    bottom: Math.round(m.bottom * pxPorCm),
    left: Math.round(m.left * pxPorCm),
    right: Math.round(m.right * pxPorCm),
  };
  const W = info.larguraPx + px.left + px.right;
  const H = info.alturaPx + px.top + px.bottom;
  return {
    dpi,
    antes: { w: info.larguraPx / pxPorCm, h: info.alturaPx / pxPorCm },
    depois: { w: W / pxPorCm, h: H / pxPorCm },
    px,
    larguraFinalPx: W,
    alturaFinalPx: H,
    cabeNoCanvas: W <= CANVAS_MAX_LADO && H <= CANVAS_MAX_LADO && W * H <= CANVAS_MAX_PIXELS,
  };
}

// ─── PDF ─────────────────────────────────────────────────────────────

const K50 = cmyk(0, 0, 0, 0.5);

export interface PaginaResultado {
  antes: TamanhoCm;
  depois: TamanhoCm;
}

export interface ResultadoPdf {
  bytes: Uint8Array;
  paginas: PaginaResultado[];
  passaLimite: boolean;
}

/**
 * Onde desenhar a página embutida (canto do sistema local) para que, depois de
 * girar por -rot graus, ela ocupe exatamente [mx, mx+visW] × [my, my+visH].
 * w,h = tamanho SEM rotação (CropBox). /Rotate gira no sentido horário.
 */
export function origemRotacionada(rot: number, w: number, h: number, mx: number, my: number): { x: number; y: number } {
  switch (rot) {
    case 90:
      return { x: mx, y: my + w };
    case 180:
      return { x: mx + w, y: my + h };
    case 270:
      return { x: mx + h, y: my };
    default:
      return { x: mx, y: my };
  }
}

export function normalizarRotacao(angulo: number): 0 | 90 | 180 | 270 {
  const r = (((Math.round(angulo / 90) * 90) % 360) + 360) % 360;
  return r as 0 | 90 | 180 | 270;
}

export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Retângulos da linha de corte: uma linha de espessura `esp` na BORDA DE FORA de
 * cada lado que ganhou margem (a área entre a linha e a arte fica sem preenchimento).
 * Unidades livres (pt ou px). `origemEmCima` = sistema do canvas (y cresce para baixo);
 * senão sistema do PDF (y cresce para cima). Se a margem for menor que a linha,
 * a linha fica com a largura da margem (nunca invade a arte).
 */
export function retangulosLinhaCorte(W: number, H: number, m: Margens, esp: number, origemEmCima = false): Retangulo[] {
  const out: Retangulo[] = [];
  const t = Math.min(esp, m.top);
  const b = Math.min(esp, m.bottom);
  const l = Math.min(esp, m.left);
  const r = Math.min(esp, m.right);
  if (t > 0) out.push({ x: 0, y: origemEmCima ? 0 : H - t, w: W, h: t });
  if (b > 0) out.push({ x: 0, y: origemEmCima ? H - b : 0, w: W, h: b });
  if (l > 0) out.push({ x: 0, y: 0, w: l, h: H });
  if (r > 0) out.push({ x: W - r, y: 0, w: r, h: H });
  return out;
}

function desenharLinhaCorte(page: PDFPage, W: number, H: number, mPt: Margens) {
  const esp = (ESPESSURA_LINHA_MM / 10) * PT_POR_CM;
  for (const q of retangulosLinhaCorte(W, H, mPt, esp)) {
    page.drawRectangle({ x: q.x, y: q.y, width: q.w, height: q.h, color: K50, borderWidth: 0 });
  }
}

// ─── Marcas de ilhós ─────────────────────────────────────────────────

/** Marcas de ilhós em volta da arte (medidas em cm). */
export interface Ilhos {
  /** Distância máxima entre dois ilhós (padrão da Max: 30 cm). */
  espacamentoCm: number;
  /** Distância do centro do ilhós até a borda da arte. */
  recuoCm: number;
}

export const ILHOS_PADRAO: Ilhos = { espacamentoCm: 30, recuoCm: 2.5 };
/** Diâmetro da marca (disco branco com ponto preto no centro, visível em qualquer fundo). */
export const DIAMETRO_MARCA_ILHOS_MM = 5;

/**
 * Centros dos ilhós em todo o contorno de uma peça w × h (qualquer unidade, a
 * mesma de `espacamento` e `recuo`; origem num canto): um em cada canto e os
 * demais divididos por igual em cada lado, sem passar do espaçamento máximo.
 */
export function posicoesIlhos(w: number, h: number, espacamento: number, recuo: number): { x: number; y: number }[] {
  const vaoX = w - 2 * recuo;
  const vaoY = h - 2 * recuo;
  if (!(espacamento > 0) || vaoX <= 0 || vaoY <= 0) return [];
  const nx = Math.max(1, Math.ceil(vaoX / espacamento - 1e-9));
  const ny = Math.max(1, Math.ceil(vaoY / espacamento - 1e-9));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= nx; i++) {
    const x = recuo + (vaoX * i) / nx;
    pts.push({ x, y: recuo }, { x, y: h - recuo });
  }
  for (let j = 1; j < ny; j++) {
    const y = recuo + (vaoY * j) / ny;
    pts.push({ x: recuo, y }, { x: w - recuo, y });
  }
  return pts;
}

function desenharIlhos(page: PDFPage, x0: number, y0: number, wPt: number, hPt: number, ilhos?: Ilhos | null) {
  if (!ilhos) return;
  const r = ((DIAMETRO_MARCA_ILHOS_MM / 2) * PT_POR_CM) / 10;
  for (const p of posicoesIlhos(wPt, hPt, ilhos.espacamentoCm * PT_POR_CM, ilhos.recuoCm * PT_POR_CM)) {
    page.drawCircle({ x: x0 + p.x, y: y0 + p.y, size: r, color: cmyk(0, 0, 0, 0), borderColor: cmyk(0, 0, 0, 1), borderWidth: 0.5 });
    page.drawCircle({ x: x0 + p.x, y: y0 + p.y, size: r / 4, color: cmyk(0, 0, 0, 1) });
  }
}

function emPt(m: Margens): Margens {
  return { top: m.top * PT_POR_CM, bottom: m.bottom * PT_POR_CM, left: m.left * PT_POR_CM, right: m.right * PT_POR_CM };
}

/** Acrescenta as faixas em todas as páginas do PDF. O resultado continua vetorial. */
export async function processarPdf(bytes: Uint8Array, m: Margens, ilhos?: Ilhos | null): Promise<ResultadoPdf> {
  let src: PDFDocument;
  try {
    src = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/encrypt/i.test(msg)) throw new Error("Este PDF está protegido por senha. Exporte de novo sem proteção.");
    throw new Error("Não consegui abrir este PDF (arquivo corrompido ou formato não suportado).");
  }
  const out = await PDFDocument.create();
  out.setProducer("Sistema Max · Pré-impressão");
  out.setCreator("Sistema Max · Margem de acabamento");
  const mPt = emPt(m);
  const paginas: PaginaResultado[] = [];

  for (const page of src.getPages()) {
    const crop = page.getCropBox();
    const { x, y, width: w, height: h } = crop;
    const rot = normalizarRotacao(page.getRotation().angle);
    const gira = rot === 90 || rot === 270;
    const visW = gira ? h : w;
    const visH = gira ? w : h;

    const emb = await out.embedPage(page, { left: x, bottom: y, right: x + w, top: y + h }, [1, 0, 0, 1, -x, -y]);
    const W = visW + mPt.left + mPt.right;
    const H = visH + mPt.top + mPt.bottom;
    const nova = out.addPage([W, H]);
    const o = origemRotacionada(rot, w, h, mPt.left, mPt.bottom);
    nova.drawPage(emb, { x: o.x, y: o.y, width: w, height: h, rotate: degrees(-rot) });
    desenharLinhaCorte(nova, W, H, mPt);
    desenharIlhos(nova, mPt.left, mPt.bottom, visW, visH, ilhos);

    paginas.push({
      antes: { w: visW / PT_POR_CM, h: visH / PT_POR_CM },
      depois: { w: W / PT_POR_CM, h: H / PT_POR_CM },
    });
  }
  if (paginas.length === 0) throw new Error("O PDF não tem páginas.");
  return {
    bytes: await out.save(),
    paginas,
    passaLimite: paginas.some((p) => passaLimiteAcrobat(p.depois)),
  };
}

/**
 * Gera um PDF com a imagem ORIGINAL embutida (sem recomprimir o JPG) no tamanho
 * real pelo DPI, mais a linha de corte K50. Usado para JPG CMYK e para "Sempre PDF".
 */
export async function imagemParaPdf(
  bytes: Uint8Array,
  info: InfoImagem,
  m: Margens,
  dpi: number,
  ilhos?: Ilhos | null,
): Promise<ResultadoPdf> {
  const out = await PDFDocument.create();
  out.setProducer("Sistema Max · Pré-impressão");
  out.setCreator("Sistema Max · Margem de acabamento");
  const img = info.tipo === "jpg" ? await out.embedJpg(bytes) : await out.embedPng(bytes);
  const wPt = (info.larguraPx / dpi) * 72;
  const hPt = (info.alturaPx / dpi) * 72;
  const mPt = emPt(m);
  const W = wPt + mPt.left + mPt.right;
  const H = hPt + mPt.top + mPt.bottom;
  const page = out.addPage([W, H]);
  page.drawImage(img, { x: mPt.left, y: mPt.bottom, width: wPt, height: hPt });
  desenharLinhaCorte(page, W, H, mPt);
  desenharIlhos(page, mPt.left, mPt.bottom, wPt, hPt, ilhos);
  const pag = { antes: { w: wPt / PT_POR_CM, h: hPt / PT_POR_CM }, depois: { w: W / PT_POR_CM, h: H / PT_POR_CM } };
  return { bytes: await out.save(), paginas: [pag], passaLimite: passaLimiteAcrobat(pag.depois) };
}
