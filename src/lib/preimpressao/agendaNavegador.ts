// Partes do "Miolo de agenda" que dependem do navegador: carregar a fonte, preparar a logo
// (reduzir, manter o fundo transparente) e fazer a silhueta para marca-d'água.

import { detectarTipo } from "./margem";
import type { FontesExternas, Imagem } from "./agenda";

let fontesPromise: Promise<FontesExternas | null> | null = null;

/** Montserrat (licença livre OFL), baixada só quando alguém abre o miolo de agenda. null = não deu para carregar. */
export function carregarFontes(): Promise<FontesExternas | null> {
  if (!fontesPromise) {
    fontesPromise = (async () => {
      try {
        const [fk, l, n, b, e] = await Promise.all([
          import("@pdf-lib/fontkit"),
          import("@fontsource/montserrat/files/montserrat-latin-300-normal.woff?url"),
          import("@fontsource/montserrat/files/montserrat-latin-400-normal.woff?url"),
          import("@fontsource/montserrat/files/montserrat-latin-700-normal.woff?url"),
          import("@fontsource/montserrat/files/montserrat-latin-800-normal.woff?url"),
        ]);
        const baixar = async (m: { default: string }) => new Uint8Array(await (await fetch(m.default)).arrayBuffer());
        const [leve, normal, negrito, extra] = await Promise.all([baixar(l), baixar(n), baixar(b), baixar(e)]);
        return { fontkit: fk.default, leve, normal, negrito, extra };
      } catch {
        return null;
      }
    })();
  }
  return fontesPromise;
}

const MAX_LADO = 1000;

async function decodificar(bytes: Uint8Array, tipo: "png" | "jpg"): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([bytes], { type: tipo === "png" ? "image/png" : "image/jpeg" }));
}

function canvasParaBytes(c: HTMLCanvasElement, tipo: "png" | "jpg"): Promise<Uint8Array> {
  return new Promise((ok, erro) =>
    c.toBlob(
      async (b) => (b ? ok(new Uint8Array(await b.arrayBuffer())) : erro(new Error("Imagem grande demais para o navegador."))),
      tipo === "png" ? "image/png" : "image/jpeg",
      0.92,
    ),
  );
}

/** Lê PNG ou JPG, reduz para no máximo 1000 px (mantendo a transparência do PNG) e devolve pronto para o PDF. */
export async function prepararImagem(bytes: Uint8Array, nome: string, maxLado = MAX_LADO): Promise<Imagem> {
  const t = detectarTipo(bytes, nome);
  if (t !== "png" && t !== "jpg") throw new Error("Envie a imagem em PNG ou JPG.");
  const bmp = await decodificar(bytes, t);
  const f = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * f));
  const h = Math.max(1, Math.round(bmp.height * f));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")?.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return { bytes: await canvasParaBytes(c, t), tipo: t, w, h };
}

/**
 * Cor do fundo de uma imagem: a que mais aparece ao longo das bordas (4 lados, um pouco para dentro,
 * ignorando cantos arredondados e transparências). null = a borda não tem uma cor dominante (foto,
 * fundo transparente…).
 */
function corDeFundo(px: Uint8ClampedArray, w: number, h: number): [number, number, number] | null {
  const grupos = new Map<number, { n: number; r: number; g: number; b: number }>();
  let opacos = 0;
  const amostra = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    if (px[i + 3] < 200) return;
    opacos++;
    const k = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
    const g = grupos.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    g.n++;
    g.r += px[i];
    g.g += px[i + 1];
    g.b += px[i + 2];
    grupos.set(k, g);
  };
  const inset = Math.min(3, Math.floor(Math.min(w, h) / 4));
  const passoX = Math.max(1, Math.floor(w / 60));
  const passoY = Math.max(1, Math.floor(h / 60));
  for (let x = 0; x < w; x += passoX) {
    amostra(x, inset);
    amostra(x, h - 1 - inset);
  }
  for (let y = 0; y < h; y += passoY) {
    amostra(inset, y);
    amostra(w - 1 - inset, y);
  }
  let melhor: { n: number; r: number; g: number; b: number } | null = null;
  for (const g of grupos.values()) if (!melhor || g.n > melhor.n) melhor = g;
  if (!melhor || opacos < 8 || melhor.n < opacos * 0.6) return null;
  return [melhor.r / melhor.n, melhor.g / melhor.n, melhor.b / melhor.n];
}

async function pixelsDaImagem(img: Imagem) {
  const bmp = await decodificar(img.bytes, img.tipo);
  const c = document.createElement("canvas");
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  return { c, ctx, d: ctx.getImageData(0, 0, c.width, c.height) };
}

/** "#rrggbb" da cor de fundo da logo (para a capa ter a mesma cor); null se a logo não tem fundo de uma cor só. */
export async function corDeFundoDaLogo(img: Imagem): Promise<string | null> {
  const { d } = await pixelsDaImagem(img);
  const cor = corDeFundo(d.data, d.width, d.height);
  if (!cor) return null;
  return "#" + cor.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

/**
 * Silhueta para marca-d'água: tira a cor de fundo e deixa o desenho todo em preto, para a marca
 * clarinha funcionar mesmo com logo de fundo colorido. Logo com fundo transparente só vira preta.
 */
export async function silhuetaDaLogo(img: Imagem): Promise<Imagem> {
  const { c, ctx, d } = await pixelsDaImagem(img);
  const px = d.data;
  const fundo = corDeFundo(px, c.width, c.height);
  for (let i = 0; i < px.length; i += 4) {
    const alfa = px[i + 3] / 255;
    const dist = fundo ? Math.sqrt((px[i] - fundo[0]) ** 2 + (px[i + 1] - fundo[1]) ** 2 + (px[i + 2] - fundo[2]) ** 2) : 255;
    const forca = Math.min(1, dist / 70);
    px[i] = 0;
    px[i + 1] = 0;
    px[i + 2] = 0;
    px[i + 3] = Math.round(255 * alfa * forca);
  }
  ctx.putImageData(d, 0, 0);
  return { bytes: await canvasParaBytes(c, "png"), tipo: "png", w: c.width, h: c.height };
}

export function bytesParaDataUrl(bytes: Uint8Array, tipo: "png" | "jpg"): string {
  let bin = "";
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) bin += String.fromCharCode(...bytes.subarray(i, i + passo));
  return `data:image/${tipo === "png" ? "png" : "jpeg"};base64,${btoa(bin)}`;
}

export function dataUrlParaBytes(url: string): Uint8Array {
  const bin = atob(url.slice(url.indexOf(",") + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
