// Crachás: partes que dependem do navegador (ler e recortar fotos, ler a arte de fundo).

import { PDFDocument } from "pdf-lib";
import type { Imagem } from "./agenda";
import { bytesParaDataUrl, dataUrlParaBytes, prepararImagem } from "./agendaNavegador";
import { retanguloDeCorte, type AjusteFoto, type Fundo, type FotoCarregada } from "./cracha";
import { detectarTipo } from "./margem";
import { renderizarPaginaPdf } from "./navegador";

const EXTENSOES = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

export const ehImagem = (nome: string) => EXTENSOES.test(nome);

/** Lê uma foto (qualquer formato que o navegador abra) e guarda os bytes originais. */
export async function lerFoto(file: File): Promise<FotoCarregada> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const bmp = await createImageBitmap(new Blob([bytes], { type: file.type || "image/jpeg" }));
  const r = { nome: file.name, bytes, w: bmp.width, h: bmp.height, tipo: file.type || "image/jpeg" };
  bmp.close();
  return r;
}

/** Recorta a foto como a moldura mostra (zoom e deslocamento) e devolve um JPG de até `maxLado` px. */
export async function recortarFoto(foto: FotoCarregada & { tipo?: string }, aspecto: number, ajuste: AjusteFoto, maxLado = 560): Promise<Imagem> {
  const bmp = await createImageBitmap(new Blob([foto.bytes], { type: foto.tipo || "image/jpeg" }));
  const r = retanguloDeCorte(bmp.width, bmp.height, aspecto, ajuste);
  const f = Math.min(1, maxLado / Math.max(r.sw, r.sh));
  const w = Math.max(1, Math.round(r.sw * f));
  const h = Math.max(1, Math.round(r.sh * f));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
  bmp.close();
  const bytes = await new Promise<Uint8Array>((ok, erro) =>
    c.toBlob(async (b) => (b ? ok(new Uint8Array(await b.arrayBuffer())) : erro(new Error("Foto grande demais para o navegador."))), "image/jpeg", 0.9),
  );
  return { bytes, tipo: "jpg", w, h };
}

export interface ArteLida {
  nome: string;
  fundo: Fundo;
  /** Largura ÷ altura. */
  aspecto: number;
  /** Só imagens: pixels. */
  px?: { w: number; h: number };
}

/** Lê a arte de fundo: PDF (1ª página, vetor mantido), PNG ou JPG. */
export async function lerArte(file: File): Promise<ArteLida> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const t = detectarTipo(bytes, file.name);
  if (t === "pdf") {
    const doc = await PDFDocument.load(bytes);
    const p = doc.getPage(0);
    return { nome: file.name, fundo: { tipo: "pdf", bytes }, aspecto: p.getWidth() / p.getHeight() };
  }
  if (t === "png" || t === "jpg") {
    const img = await prepararImagem(bytes, file.name, 2400);
    return { nome: file.name, fundo: { tipo: "imagem", img }, aspecto: img.w / img.h, px: { w: img.w, h: img.h } };
  }
  throw new Error("Envie a arte em PDF, PNG ou JPG.");
}

/** Para guardar a arte num modelo salvo: imagem como está; PDF vira imagem de boa qualidade. */
export async function arteParaModelo(f: Fundo): Promise<{ dataUrl: string; tipo: "png" | "jpg"; w: number; h: number } | null> {
  try {
    if (f.tipo === "imagem") return { dataUrl: bytesParaDataUrl(f.img.bytes, f.img.tipo), tipo: f.img.tipo, w: f.img.w, h: f.img.h };
    const url = await renderizarPaginaPdf(f.bytes, 0, 1400);
    const b = dataUrlParaBytes(url);
    const bmp = await createImageBitmap(new Blob([b], { type: "image/png" }));
    const r = { dataUrl: url, tipo: "png" as const, w: bmp.width, h: bmp.height };
    bmp.close();
    return r;
  } catch {
    return null;
  }
}

export function fundoDeModelo(a: { dataUrl: string; tipo: "png" | "jpg"; w: number; h: number }): Fundo {
  return { tipo: "imagem", img: { bytes: dataUrlParaBytes(a.dataUrl), tipo: a.tipo, w: a.w, h: a.h } };
}
