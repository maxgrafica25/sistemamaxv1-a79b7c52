// =============================================================================
// PDF de produção 1:1 — Página 1 (impressão) + Página 2 (faca CutContour)
// =============================================================================
// Gera um PDF com tamanho de página em mm exato. Usa pdf-lib (sem deps nativas).
//
// Páginas:
//   1. Impressão: imagem da arte posicionada nas etiquetas + marcas de registro
//      em K100 (preto puro) nos 4 cantos.
//   2. Faca de corte: apenas contornos das etiquetas em magenta (proxy para
//      Spot CutContour) com stroke 0.25pt. Inclui as mesmas marcas de registro
//      pra alinhamento ARMS.
//
// Ambas as páginas têm um quadrado de teste 10×10mm no canto inferior esquerdo
// (fora da área útil padrão) pra conferência de escala.
// =============================================================================

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { LayoutResult, LabelShape } from "./layout";
import { buildCornerMarks, markSegments, MARK_ARM_MM, MARK_STROKE_PT, type RegistrationMark } from "./marks";

// Conversão mm -> pt (PDF usa pontos: 1pt = 1/72 in; 1mm = 2.83465pt)
const MM_TO_PT = 72 / 25.4;
const mm = (v: number) => v * MM_TO_PT;

export interface ProductionPDFInput {
  sheetW: number;
  sheetH: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  gap: number;
  labelW: number;
  labelH: number;
  shape: LabelShape;
  layout: LayoutResult;
  /** DataURL ou null. Se null, página 1 desenha um placeholder. */
  imageDataUrl: string | null;
  imageMime?: "image/png" | "image/jpeg" | "image/webp" | string;
  /** Ajuste vertical das marcas (mm). */
  marksOffsetY: number;
  /** Nome do job (vai no metadata e no rodapé). */
  jobName?: string;
}

const black = rgb(0, 0, 0);
const cutMagenta = rgb(1, 0, 1); // proxy de Spot CutContour
const grayLight = rgb(0.85, 0.85, 0.85);

async function embedImage(pdf: PDFDocument, dataUrl: string) {
  const isPng = dataUrl.startsWith("data:image/png");
  const isJpg = /^data:image\/(jpe?g)/.test(dataUrl);
  if (!isPng && !isJpg) {
    // Tenta converter via canvas pra PNG (suporta WEBP)
    return await convertToPngAndEmbed(pdf, dataUrl);
  }
  const bytes = dataUrlToBytes(dataUrl);
  return isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function convertToPngAndEmbed(pdf: PDFDocument, dataUrl: string) {
  return new Promise<Awaited<ReturnType<typeof pdf.embedPng>>>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2D não disponível"));
      ctx.drawImage(img, 0, 0);
      const png = canvas.toDataURL("image/png");
      try {
        resolve(await pdf.embedPng(dataUrlToBytes(png)));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Falha ao decodificar imagem"));
    img.src = dataUrl;
  });
}

function listLabelPositions(input: ProductionPDFInput) {
  const { layout, marginTop, gap } = input;
  const w = layout.best.rotated ? input.labelH : input.labelW;
  const h = layout.best.rotated ? input.labelW : input.labelH;
  const reserved = new Set(layout.reservedSlots.map((s) => `${s.col},${s.row}`));
  const positions: Array<{ x: number; y: number; w: number; h: number; reserved: boolean }> = [];
  for (let r = 0; r < layout.best.rows; r++) {
    const baseX = layout.rowOffsets[r] ?? input.marginLeft;
    for (let c = 0; c < layout.best.cols; c++) {
      const isReserved = reserved.has(`${c},${r}`);
      // Posições reservadas continuam computadas (espaço em branco), mas
      // marcadas como reserved=true para o renderer pular o desenho.
      positions.push({
        x: baseX + c * (w + gap),
        y: marginTop + r * (h + gap),
        w,
        h,
        reserved: isReserved,
      });
    }
  }
  return positions;
}

export async function generateProductionPDF(input: ProductionPDFInput): Promise<Blob> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(input.jobName ?? "Produção de etiquetas");
  pdf.setProducer("Max Gráfica · Calculadora de Etiquetas");

  const pageW = mm(input.sheetW);
  const pageH = mm(input.sheetH);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const positions = listLabelPositions(input);
  const marks = buildCornerMarks(
    input.sheetW,
    input.sheetH,
    input.marginTop,
    input.marginBottom,
    input.marginLeft,
    input.marginRight,
    input.marksOffsetY,
    MARK_ARM_MM,
  );

  const embedded = input.imageDataUrl ? await embedImage(pdf, input.imageDataUrl) : null;

  // ---------- PÁGINA 1: IMPRESSÃO ------------------------------------------
  const p1 = pdf.addPage([pageW, pageH]);
  // Coordenada Y do PDF começa em baixo. Convertemos top-down → bottom-up.
  const flipY = (yMm: number, hMm = 0) => mm(input.sheetH - yMm - hMm);

  for (const p of positions) {
    if (p.reserved) continue; // espaço em branco real
    if (embedded) {
      // object-fit: contain
      const ratio = embedded.width / embedded.height;
      const boxRatio = p.w / p.h;
      let dw = p.w, dh = p.h;
      if (ratio > boxRatio) { dh = p.w / ratio; } else { dw = p.h * ratio; }
      const dx = p.x + (p.w - dw) / 2;
      const dy = p.y + (p.h - dh) / 2;
      p1.drawImage(embedded, {
        x: mm(dx), y: flipY(dy, dh),
        width: mm(dw), height: mm(dh),
      });
    } else {
      // Placeholder vazio
      p1.drawRectangle({
        x: mm(p.x), y: flipY(p.y, p.h),
        width: mm(p.w), height: mm(p.h),
        borderColor: grayLight, borderWidth: 0.3,
      });
    }
  }

  // Marcas de registro (K100, 0.5pt)
  for (const m of marks.marks) {
    drawMark(p1, m, flipY, black);
  }

  // Quadrado de teste 10×10mm
  drawTestSquare(p1, flipY, input.sheetH, font);

  // Rodapé
  p1.drawText(`IMPRESSAO · ${input.sheetW}x${input.sheetH}mm · ${positions.length} slots (${input.layout.effectivePerSheet} venda)`, {
    x: mm(5), y: 6, size: 6, font, color: black,
  });

  // ---------- PÁGINA 2: FACA DE CORTE (CutContour) -------------------------
  const p2 = pdf.addPage([pageW, pageH]);
  const strokePt = 0.25; // 0.25pt
  for (const p of positions) {
    if (p.reserved) continue;
    if (input.shape === "redondo") {
      const cx = mm(p.x + p.w / 2);
      const cy = flipY(p.y + p.h / 2);
      const r = mm(Math.min(p.w, p.h) / 2);
      p2.drawCircle({ x: cx, y: cy, size: r, borderColor: cutMagenta, borderWidth: strokePt });
    } else {
      p2.drawRectangle({
        x: mm(p.x), y: flipY(p.y, p.h),
        width: mm(p.w), height: mm(p.h),
        borderColor: cutMagenta, borderWidth: strokePt,
      });
    }
  }
  // Mesmas marcas para alinhamento
  for (const m of marks.marks) {
    drawMark(p2, m, flipY, black);
  }
  drawTestSquare(p2, flipY, input.sheetH, font);
  p2.drawText("FACA · CutContour (Magenta 100%) · stroke 0.25pt", {
    x: mm(5), y: 6, size: 6, font, color: cutMagenta,
  });

  const bytes = await pdf.save();
  // Slice the underlying buffer to ensure Blob receives a clean ArrayBuffer
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: "application/pdf" });
}

function drawMark(
  page: any,
  mark: RegistrationMark,
  flipY: (y: number, h?: number) => number,
  color: any,
) {
  const segments = markSegments(mark);
  for (const s of segments) {
    page.drawLine({
      start: { x: mm(s.x1), y: flipY(s.y1) },
      end: { x: mm(s.x2), y: flipY(s.y2) },
      thickness: MARK_STROKE_PT,
      color,
    });
  }
}

function drawTestSquare(page: any, flipY: (y: number, h?: number) => number, sheetH: number, font: any) {
  // 10×10mm, no canto inferior esquerdo, 2mm da borda
  page.drawRectangle({
    x: mm(2), y: flipY(sheetH - 2 - 10, 10),
    width: mm(10), height: mm(10),
    borderColor: rgb(0, 0, 0), borderWidth: 0.5,
  });
  page.drawText("10mm", {
    x: mm(2.5), y: flipY(sheetH - 2 - 10) - 8,
    size: 5, font, color: rgb(0, 0, 0),
  });
}

/** Helper: dispara download no browser. */
export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
