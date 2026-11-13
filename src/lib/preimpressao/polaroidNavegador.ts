// Polaroid: partes que dependem do navegador (fonte manuscrita, recorte e filtro das fotos).

import type { Imagem } from "./agenda";
import { retanguloDeCorte, type AjusteFoto, type FotoCarregada } from "./cracha";
import { aplicarFiltro, type FiltroFoto, type FontePolaroid } from "./polaroid";

let fontePromise: Promise<FontePolaroid | null> | null = null;

/** Caveat (letra de mão, licença livre OFL), baixada só quando alguém abre a ferramenta. null = não carregou. */
export function carregarFonteManuscrita(): Promise<FontePolaroid | null> {
  if (!fontePromise) {
    fontePromise = (async () => {
      try {
        const [fk, b] = await Promise.all([import("@pdf-lib/fontkit"), import("@fontsource/caveat/files/caveat-latin-700-normal.woff?url")]);
        const bytes = new Uint8Array(await (await fetch(b.default)).arrayBuffer());
        return { fontkit: fk.default, caveat: bytes };
      } catch {
        return null;
      }
    })();
  }
  return fontePromise;
}

/** Recorta como a janela da Polaroid mostra (zoom e deslocamento), aplica o filtro e devolve um JPG de até `maxLado` px. */
export async function prepararFotoPolaroid(foto: FotoCarregada & { tipo?: string }, aspecto: number, ajuste: AjusteFoto, filtro: FiltroFoto, maxLado = 1000): Promise<Imagem> {
  const bmp = await createImageBitmap(new Blob([foto.bytes], { type: foto.tipo || "image/jpeg" }));
  const r = retanguloDeCorte(bmp.width, bmp.height, aspecto, ajuste);
  const f = Math.min(1, maxLado / Math.max(r.sw, r.sh));
  const w = Math.max(1, Math.round(r.sw * f));
  const h = Math.max(1, Math.round(r.sh * f));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: filtro !== "nenhum" });
  if (!ctx) throw new Error("canvas indisponível");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, r.sx, r.sy, r.sw, r.sh, 0, 0, w, h);
  bmp.close();
  if (filtro !== "nenhum") {
    const d = ctx.getImageData(0, 0, w, h);
    aplicarFiltro(d.data, filtro, w, h);
    ctx.putImageData(d, 0, 0);
  }
  const bytes = await new Promise<Uint8Array>((ok, erro) =>
    c.toBlob(async (b) => (b ? ok(new Uint8Array(await b.arrayBuffer())) : erro(new Error("Foto grande demais para o navegador."))), "image/jpeg", 0.92),
  );
  return { bytes, tipo: "jpg", w, h };
}
