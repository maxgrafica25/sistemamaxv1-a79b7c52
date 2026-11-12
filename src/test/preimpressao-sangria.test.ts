import { describe, it, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { PDFDocument, rgb } from "pdf-lib";
import { PT_POR_CM, chunkPng } from "@/lib/preimpressao/margem";
import { PT_POR_MM, sangriaDoPdf } from "@/lib/preimpressao/folha";
import {
  conferirMargemSeguranca,
  corDeHex,
  expandirPixels,
  faixasDaSangria,
  gerarComSangria,
  indiceOrigem,
  type Pixels,
} from "@/lib/preimpressao/sangria";

/** Imagem w×h em que o pixel (x, y) recebe cor(x, y). */
function imagem(w: number, h: number, cor: (x: number, y: number) => [number, number, number]): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = cor(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  return { w, h, data };
}
const pix = (p: Pixels, x: number, y: number) => Array.from(p.data.slice((y * p.w + x) * 4, (y * p.w + x) * 4 + 3));

function png(w: number, h: number): Uint8Array {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const partes = [sig, chunkPng("IHDR", ihdr), chunkPng("IDAT", new Uint8Array(deflateSync(new Uint8Array(h * (1 + w * 3))))), chunkPng("IEND", new Uint8Array(0))];
  const out = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of partes) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

describe("pixel de origem da sangria", () => {
  it("espelhar: reflexo na borda, também quando a faixa é maior que a arte", () => {
    expect([-1, -2, -3].map((i) => indiceOrigem(i, 5, "espelhar"))).toEqual([0, 1, 2]);
    expect([5, 6, 7].map((i) => indiceOrigem(i, 5, "espelhar"))).toEqual([4, 3, 2]);
    expect([-6, -7, 10].map((i) => indiceOrigem(i, 5, "espelhar"))).toEqual([4, 3, 0]);
    expect(indiceOrigem(3, 5, "espelhar")).toBe(3);
  });
  it("esticar: repete o pixel da borda", () => {
    expect([-4, -1, 5, 9].map((i) => indiceOrigem(i, 5, "esticar"))).toEqual([0, 0, 4, 4]);
  });
});

describe("expandir pixels", () => {
  // 4×3: cada pixel tem uma cor única (x*40, y*60)
  const arte = imagem(4, 3, (x, y) => [x * 40, y * 60, 7]);

  it("espelhar: tamanho + 2b, centro intacto, bordas refletidas e cantos nos dois eixos", () => {
    const e = expandirPixels(arte, 2, "espelhar");
    expect([e.w, e.h]).toEqual([8, 7]);
    expect(pix(e, 2, 2)).toEqual(pix(arte, 0, 0));
    expect(pix(e, 5, 4)).toEqual(pix(arte, 3, 2));
    expect(pix(e, 1, 2)).toEqual(pix(arte, 0, 0)); // x = -1 → 0
    expect(pix(e, 0, 2)).toEqual(pix(arte, 1, 0)); // x = -2 → 1
    expect(pix(e, 2, 0)).toEqual(pix(arte, 0, 1)); // y = -2 → 1
    expect(pix(e, 0, 0)).toEqual(pix(arte, 1, 1)); // canto
    expect(pix(e, 7, 6)).toEqual(pix(arte, 2, 1)); // canto oposto
  });

  it("esticar: a faixa repete a borda", () => {
    const e = expandirPixels(arte, 2, "esticar");
    expect(pix(e, 0, 3)).toEqual(pix(arte, 0, 1));
    expect(pix(e, 7, 3)).toEqual(pix(arte, 3, 1));
    expect(pix(e, 0, 0)).toEqual(pix(arte, 0, 0));
    expect(pix(e, 7, 6)).toEqual(pix(arte, 3, 2));
  });

  it("cor: só a faixa recebe a cor; o centro continua a arte", () => {
    const e = expandirPixels(arte, 1, "cor", [10, 20, 30]);
    expect(pix(e, 0, 0)).toEqual([10, 20, 30]);
    expect(pix(e, 5, 3)).toEqual([10, 20, 30]);
    expect(pix(e, 1, 1)).toEqual(pix(arte, 0, 0));
    expect(pix(e, 4, 3)).toEqual(pix(arte, 3, 2));
  });

  it("as 4 faixas têm as medidas certas e juntas cobrem todo o contorno", () => {
    const e = expandirPixels(arte, 2, "espelhar");
    const f = faixasDaSangria(e, 2);
    expect([f.topo.w, f.topo.h]).toEqual([8, 2]);
    expect([f.base.w, f.base.h]).toEqual([8, 2]);
    expect([f.esquerda.w, f.esquerda.h]).toEqual([2, 3]);
    expect([f.direita.w, f.direita.h]).toEqual([2, 3]);
    expect(pix(f.esquerda, 1, 0)).toEqual(pix(e, 1, 2));
    expect(pix(f.direita, 0, 2)).toEqual(pix(e, 6, 4));
    expect(pix(f.base, 3, 1)).toEqual(pix(e, 3, 6));
  });

  it("corDeHex", () => {
    expect(corDeHex("#ff8000")).toEqual([255, 128, 0]);
    expect(corDeHex("zzz")).toEqual([128, 128, 128]);
  });
});

describe("conferir a margem de segurança", () => {
  const PX_MM = 4; // 4 px por mm
  const fundo: [number, number, number] = [30, 80, 40];
  const W = 100 * PX_MM;
  const H = 60 * PX_MM;

  it("fundo liso sem nada perto da borda: ok", () => {
    const r = conferirMargemSeguranca(imagem(W, H, () => fundo), PX_MM, 3);
    expect(r.situacao).toBe("ok");
  });

  it("texto a 1 mm da borda: atenção; texto a 5 mm (fora da margem de 3 mm): ok", () => {
    const comTexto = (mm: number) =>
      imagem(W, H, (x, y) => (x >= mm * PX_MM && x < (mm + 20) * PX_MM && y >= 20 * PX_MM && y < 24 * PX_MM ? [255, 255, 255] : fundo));
    expect(conferirMargemSeguranca(comTexto(1), PX_MM, 3).situacao).toBe("atencao");
    expect(conferirMargemSeguranca(comTexto(5), PX_MM, 3).situacao).toBe("ok");
  });

  it("degradê e faixa colorida que chegam até a borda não disparam o aviso", () => {
    const grad = imagem(W, H, (x) => [(x * 255) / W, 90, 200 - (x * 200) / W]);
    expect(conferirMargemSeguranca(grad, PX_MM, 3).situacao).toBe("ok");
    const faixa = imagem(W, H, (_x, y) => (y < 8 * PX_MM ? [255, 204, 0] : fundo));
    expect(conferirMargemSeguranca(faixa, PX_MM, 3).situacao).toBe("ok");
  });

  it("texto colado sobre fundo com faixa continua sendo apontado", () => {
    const img = imagem(W, H, (x, y) => (x >= 1 * PX_MM && x < 21 * PX_MM && y >= 30 * PX_MM && y < 34 * PX_MM ? [255, 255, 255] : y < 8 * PX_MM ? [255, 204, 0] : fundo));
    expect(conferirMargemSeguranca(img, PX_MM, 3).situacao).toBe("atencao");
  });

  it("borda granulada (foto/textura): indeterminado, não dá para separar fundo de texto", () => {
    const r = conferirMargemSeguranca(imagem(W, H, (x, y) => [(x * 7919 + y * 104729) % 256, (x * 31 + y * 17) % 256, (x * 13 + y * 101) % 256]), PX_MM, 3);
    expect(r.situacao).toBe("indeterminado");
  });
});

describe("PDF com sangria", () => {
  it("cada página vira (w + 2b) × (h + 2b), com TrimBox e BleedBox, e a sangria é lida de volta", async () => {
    const d = await PDFDocument.create();
    d.addPage([8.5 * PT_POR_CM, 4.7 * PT_POR_CM]).drawRectangle({ x: 0, y: 0, width: 30, height: 30, color: rgb(1, 0, 0) });
    d.addPage([8.5 * PT_POR_CM, 4.7 * PT_POR_CM]);
    const chamadas: [number, number, number][] = [];
    const out = await gerarComSangria(await d.save(), 3, async (i, w, h) => {
      chamadas.push([i, Math.round(w), Math.round(h)]);
      return { topo: png(4, 1), base: png(4, 1), esquerda: png(1, 3), direita: png(1, 3) };
    });
    const r = await PDFDocument.load(out);
    expect(r.getPageCount()).toBe(2);
    const p = r.getPage(0);
    const b = 3 * PT_POR_MM;
    expect(p.getWidth()).toBeCloseTo(8.5 * PT_POR_CM + 2 * b, 2);
    expect(p.getHeight()).toBeCloseTo(4.7 * PT_POR_CM + 2 * b, 2);
    expect(p.getTrimBox().x).toBeCloseTo(b, 2);
    expect(p.getTrimBox().width).toBeCloseTo(8.5 * PT_POR_CM, 2);
    expect(chamadas.map((c) => c[0])).toEqual([0, 1]);
    expect(chamadas[0][1]).toBe(Math.round(8.5 * PT_POR_CM));
    expect(await sangriaDoPdf(out)).toBe(3);
  });
});

import { arteParaTamanho, orientarTamanhoFinal } from "@/lib/preimpressao/folha";

describe("orientar o tamanho final desejado", () => {
  const arte = { w: 9.1 * PT_POR_CM, h: 5.3 * PT_POR_CM };

  it("cartão 9,1 × 5,3 que deve sair 8,5 × 4,7: usar sangria de 3 mm (e já está certo se o campo é 3)", () => {
    expect(orientarTamanhoFinal(arte, 8.5, 4.7, 1.5)).toEqual({ tipo: "usar", sangriaMm: 3 });
    expect(orientarTamanhoFinal(arte, 8.5, 4.7, 3)).toEqual({ tipo: "ok" });
  });

  it("aceita o tamanho desejado deitado ou em pé", () => {
    expect(orientarTamanhoFinal(arte, 4.7, 8.5, 1.5)).toEqual({ tipo: "usar", sangriaMm: 3 });
  });

  it("medida que não fecha: mostra as duas sangrias; arte menor que o pedido: avisa", () => {
    const r = orientarTamanhoFinal(arte, 8.5, 5, 3);
    expect(r).toEqual({ tipo: "incoerente", sangriaLarguraMm: 3, sangriaAlturaMm: 1.5 });
    expect(orientarTamanhoFinal(arte, 10, 6, 3)).toEqual({ tipo: "menor" });
  });

  it("tamanho de arte necessário para um final e uma sangria", () => {
    const a = arteParaTamanho(8.5, 4.7, 1.5);
    expect(a.w).toBeCloseTo(8.8, 6);
    expect(a.h).toBeCloseTo(5, 6);
  });
});
