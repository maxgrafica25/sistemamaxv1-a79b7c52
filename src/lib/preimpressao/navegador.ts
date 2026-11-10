// Partes da "Margem de acabamento" que dependem do navegador (canvas, pdf.js, download).
// A lógica de medidas/DPI/PDF fica em ./margem.ts (testada).

import {
  COR_LINHA_RGB,
  DIAMETRO_MARCA_ILHOS_MM,
  ESPESSURA_LINHA_MM,
  retangulosLinhaCorte,
  gravarDpiJpg,
  gravarDpiPng,
  posicoesIlhos,
  type Ilhos,
  type InfoImagem,
  type PlanoImagem,
} from "./margem";
import { resolucoesDaPagina } from "./conferencia";
import { tintaDaImagem, type Tinta } from "./organizar";

const MSG_SEMPRE_PDF =
  "Imagem grande demais para o navegador gerar em PNG/JPG. Escolha \"Sempre PDF\" em \"Salvar como\".";

/** Gera PNG/JPG com a área a mais em branco e a linha de corte cinza (#808080), com o DPI regravado. */
export async function imagemMesmoFormato(arquivo: Blob, info: InfoImagem, plano: PlanoImagem, ilhos?: Ilhos | null): Promise<Blob> {
  if (!plano.cabeNoCanvas) throw new Error(MSG_SEMPRE_PDF);

  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(arquivo, { imageOrientation: "none" });
  } catch {
    throw new Error("Não consegui abrir a imagem no navegador. Tente \"Sempre PDF\".");
  }

  const canvas = document.createElement("canvas");
  canvas.width = plano.larguraFinalPx;
  canvas.height = plano.alturaFinalPx;
  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(MSG_SEMPRE_PDF);
    const W = canvas.width;
    const H = canvas.height;
    const { top, bottom, left, right } = plano.px;
    if (info.tipo === "jpg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
    }
    // Área a mais sem preenchimento (JPG: branco; PNG: transparente) + linha de corte na borda de fora
    const espPx = Math.max(1, Math.round((ESPESSURA_LINHA_MM / 25.4) * plano.dpi));
    ctx.fillStyle = COR_LINHA_RGB;
    for (const q of retangulosLinhaCorte(W, H, { top, bottom, left, right }, espPx, true)) ctx.fillRect(q.x, q.y, q.w, q.h);
    ctx.drawImage(bmp, left, top, info.larguraPx, info.alturaPx);
    if (ilhos) {
      // Marcas de ilhós sobre a arte: disco branco com contorno e ponto preto no centro
      const pxPorCm = plano.dpi / 2.54;
      const r = Math.max(2, ((DIAMETRO_MARCA_ILHOS_MM / 20) * pxPorCm));
      for (const p of posicoesIlhos(info.larguraPx, info.alturaPx, ilhos.espacamentoCm * pxPorCm, ilhos.recuoCm * pxPorCm)) {
        const cx = left + p.x;
        const cy = top + p.y;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.lineWidth = Math.max(1, r / 8);
        ctx.strokeStyle = "#000000";
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1, r / 4), 0, Math.PI * 2);
        ctx.fillStyle = "#000000";
        ctx.fill();
      }
    }

    const tipo = info.tipo === "jpg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob | null>((res) => {
      try {
        canvas.toBlob(res, tipo, 0.95);
      } catch {
        res(null);
      }
    });
    if (!blob) throw new Error(MSG_SEMPRE_PDF);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const comDpi = info.tipo === "jpg" ? gravarDpiJpg(bytes, plano.dpi) : gravarDpiPng(bytes, plano.dpi);
    return new Blob([comDpi], { type: tipo });
  } finally {
    bmp.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

const TAM_MINIATURA = 160;

/** Miniatura de imagem (data URL), sem decodificar a imagem inteira em tamanho real quando possível. */
export async function miniaturaImagem(blob: Blob, larguraPx: number, alturaPx: number): Promise<string> {
  const escala = Math.min(1, TAM_MINIATURA / Math.max(larguraPx, alturaPx));
  const w = Math.max(1, Math.round(larguraPx * escala));
  const h = Math.max(1, Math.round(alturaPx * escala));
  const bmp = await createImageBitmap(blob, {
    imageOrientation: "none",
    resizeWidth: w,
    resizeHeight: h,
    resizeQuality: "medium",
  });
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")?.drawImage(bmp, 0, 0);
  bmp.close();
  return c.toDataURL("image/png");
}

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

/** pdf.js só é baixado quando alguém abre um PDF nesta ferramenta. */
function carregarPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]).then(
      ([pdfjs, worker]) => {
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        return pdfjs;
      },
    );
    pdfjsPromise.catch(() => {
      pdfjsPromise = null;
    });
  }
  return pdfjsPromise;
}

/** Desenha uma página do PDF numa imagem (data URL) com o maior lado = `maiorLadoPx`. */
export async function renderizarPaginaPdf(bytes: Uint8Array, pagina = 0, maiorLadoPx = TAM_MINIATURA): Promise<string> {
  const pdfjs = await carregarPdfJs();
  // pdf.js transfere o buffer para o worker: passa uma cópia
  const tarefa = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await tarefa.promise;
  try {
    const page = await doc.getPage(pagina + 1);
    const vp1 = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: maiorLadoPx / Math.max(vp1.width, vp1.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas indisponível");
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/png");
  } finally {
    await tarefa.destroy();
  }
}

/**
 * Menor resolução efetiva (ppi) entre as imagens do PDF, no tamanho em que foram
 * colocadas na página. Confere até `maxPaginas` páginas. null = sem imagens medidas.
 */
export async function menorResolucaoDoPdf(bytes: Uint8Array, maxPaginas = 30): Promise<number | null> {
  const pdfjs = await carregarPdfJs();
  const O = pdfjs.OPS;
  const OPS = {
    save: O.save,
    restore: O.restore,
    transform: O.transform,
    paintFormXObjectBegin: O.paintFormXObjectBegin,
    paintFormXObjectEnd: O.paintFormXObjectEnd,
    imagens: [O.paintImageXObject, O.paintInlineImageXObject, O.paintImageXObjectRepeat].filter((n) => typeof n === "number"),
  };
  const tarefa = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await tarefa.promise;
  try {
    let menor: number | null = null;
    for (let i = 1; i <= Math.min(doc.numPages, maxPaginas); i++) {
      const page = await doc.getPage(i);
      const ops = await page.getOperatorList();
      for (const ppi of resolucoesDaPagina(ops.fnArray, ops.argsArray, OPS)) menor = menor === null ? ppi : Math.min(menor, ppi);
      page.cleanup();
    }
    return menor;
  } finally {
    await tarefa.destroy();
  }
}

/**
 * Mede a "tinta" de cada página de um PDF (para achar páginas em branco). Cada página é
 * desenhada pequena (maior lado 300 px) sobre fundo branco; `aCada` informa o andamento.
 */
export async function medirTintaDoPdf(bytes: Uint8Array, aCada?: (pagina: number, total: number) => void): Promise<Tinta[]> {
  const pdfjs = await carregarPdfJs();
  const tarefa = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await tarefa.promise;
  try {
    const out: Tinta[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp1 = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 300 / Math.max(vp1.width, vp1.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("canvas indisponível");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport, background: "rgb(255,255,255)" }).promise;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      out.push(tintaDaImagem(img.data, canvas.width, canvas.height));
      page.cleanup();
      aCada?.(i, doc.numPages);
    }
    return out;
  } finally {
    await tarefa.destroy();
  }
}

/**
 * Miniaturas de TODAS as páginas de um PDF, abrindo o arquivo uma vez só.
 * `aCada` é chamado quando cada página fica pronta (para a tela ir preenchendo).
 */
export async function miniaturasDoPdf(bytes: Uint8Array, maiorLadoPx: number, aCada: (pagina: number, url: string) => void): Promise<void> {
  const pdfjs = await carregarPdfJs();
  const tarefa = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await tarefa.promise;
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp1 = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: maiorLadoPx / Math.max(vp1.width, vp1.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      aCada(i - 1, canvas.toDataURL("image/jpeg", 0.8));
      page.cleanup();
    }
  } finally {
    await tarefa.destroy();
  }
}

/** Miniatura da 1ª página de um PDF (data URL). */
export function miniaturaPdf(bytes: Uint8Array): Promise<string> {
  return renderizarPaginaPdf(bytes, 0, TAM_MINIATURA);
}

/** EPS → PDF (Ghostscript no navegador, baixado só na primeira vez que alguém usa). */
export const converterEps = (bytes: Uint8Array): Promise<Uint8Array> => import("./eps").then((m) => m.epsParaPdf(bytes));

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Junta vários arquivos num .zip (sem recompactar: PDF/PNG/JPG já são compactados). */
export async function baixarZip(arquivos: { nome: string; blob: Blob }[], nomeZip: string) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const usados = new Set<string>();
  for (const a of arquivos) {
    let nome = a.nome;
    let n = 2;
    while (usados.has(nome.toLowerCase())) {
      const i = a.nome.lastIndexOf(".");
      nome = i > 0 ? `${a.nome.slice(0, i)} (${n})${a.nome.slice(i)}` : `${a.nome} (${n})`;
      n++;
    }
    usados.add(nome.toLowerCase());
    zip.file(nome, a.blob);
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  baixarBlob(blob, nomeZip);
}
