// =============================================================================
// Gerador de faca de corte .plt — padrão SignMaster / Sigmaster
// =============================================================================
// - 1016 DPI (40 unidades por mm)
// - Origem no canto INFERIOR-ESQUERDO (Y invertido em relação ao PDF)
// - Círculos aproximados por polígono de 72 segmentos
// - Marcas de registro incluídas para leitura óptica
// - Cabeçalho: TB26,0,maxX,maxY;CT1; + ;:H A L0 ECN U
// =============================================================================

import {
  computeSignmasterMarks,
  type SignmasterLayout,
} from "./signmaster-spec";

const PLT_UNITS_PER_MM = 40; // 1016 DPI
const CIRCLE_SEGMENTS = 72;

/** Converte mm (sistema PDF, origem topo-esquerda) para unidades .plt (origem base-esquerda). */
function toPlt(xMm: number, yMm: number, sheetHmm: number) {
  const xu = Math.round(xMm * PLT_UNITS_PER_MM);
  const yu = Math.round((sheetHmm - yMm) * PLT_UNITS_PER_MM);
  return { xu, yu };
}

export interface PltExportInput {
  sheetW: number;
  sheetH: number;
  labelDiameter: number;
  layout: SignmasterLayout;
  /** Override manual da posição vertical das marcas em "T" (mm). */
  bottomMarkY?: number;
}

export function generateSignmasterPlt(input: PltExportInput): string {
  const { sheetW, sheetH, labelDiameter, layout, bottomMarkY } = input;
  const r = labelDiameter / 2;

  const maxX = Math.round(sheetW * PLT_UNITS_PER_MM);
  const maxY = Math.round(sheetH * PLT_UNITS_PER_MM);

  const lines: string[] = [];
  lines.push(`TB26,0,${maxX},${maxY};CT1;`);
  lines.push(";:H A L0 ECN U");

  // ---- Marcas de registro (impressas para leitura óptica) ------------------
  const marks = computeSignmasterMarks({
    sheetW, sheetH,
    gridBottom: layout.gridBottom,
    bottomMarkY,
  });
  for (const seg of marks.all) {
    const a = toPlt(seg.x1, seg.y1, sheetH);
    const b = toPlt(seg.x2, seg.y2, sheetH);
    lines.push(`U ${a.xu},${a.yu};`);
    lines.push(`D ${b.xu},${b.yu};`);
  }

  // ---- Círculos como polígono de 72 segmentos ------------------------------
  for (const p of layout.positions) {
    for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
      const t = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
      const xMm = p.cx + r * Math.cos(t);
      const yMm = p.cy + r * Math.sin(t);
      const { xu, yu } = toPlt(xMm, yMm, sheetH);
      if (i === 0) {
        lines.push(`U ${xu},${yu};`);
      } else {
        lines.push(`D ${xu},${yu};`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

export function downloadPlt(content: string, filename: string) {
  const blob = new Blob([content], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".plt") ? filename : `${filename}.plt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
