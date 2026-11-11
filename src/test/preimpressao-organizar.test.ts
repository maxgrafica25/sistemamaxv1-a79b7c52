import { describe, it, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { PDFDocument, StandardFonts, degrees } from "pdf-lib";
import { PT_POR_CM, chunkPng } from "@/lib/preimpressao/margem";
import { abrirFonte, montarPdf, nomeDaPagina, paginaEmBranco, tamanhoComGiro, tintaDaImagem } from "@/lib/preimpressao/organizar";

const cm = (v: number) => v * PT_POR_CM;

async function pdf(tamanhos: [number, number][], rotate = 0): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  tamanhos.forEach(([w, h], i) => {
    const p = d.addPage([cm(w), cm(h)]);
    p.drawText(`P${i + 1}`, { x: 20, y: 20, size: 20, font: f });
    if (rotate) p.setRotation(degrees(rotate));
  });
  return d.save();
}

function png(w: number, h: number, dpi?: number): Uint8Array {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const partes = [sig, chunkPng("IHDR", ihdr)];
  if (dpi) {
    const d = new Uint8Array(9);
    const v = new DataView(d.buffer);
    v.setUint32(0, Math.round(dpi / 0.0254));
    v.setUint32(4, Math.round(dpi / 0.0254));
    d[8] = 1;
    partes.push(chunkPng("pHYs", d));
  }
  partes.push(chunkPng("IDAT", new Uint8Array(deflateSync(new Uint8Array(h * (1 + w * 3))))), chunkPng("IEND", new Uint8Array(0)));
  const out = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of partes) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

describe("abrir arquivos", () => {
  it("PDF: conta as páginas e mede o tamanho visível (com /Rotate)", async () => {
    const f = await abrirFonte("a", "a.pdf", await pdf([[21, 29.7], [10, 15]], 90));
    expect(f.paginas).toHaveLength(2);
    expect(f.paginas[0].w).toBeCloseTo(cm(29.7), 3);
    expect(f.paginas[0].h).toBeCloseTo(cm(21), 3);
  });

  it("imagem: tamanho pelo DPI; sem DPI entra como 300 dpi", async () => {
    const com = await abrirFonte("i", "foto.png", png(100, 50, 100));
    expect(com.paginas[0].w).toBeCloseTo(72, 1); // 1 polegada
    const sem = await abrirFonte("j", "scan.png", png(300, 600));
    expect(sem.paginas[0].w).toBeCloseTo(72, 3);
    expect(sem.paginas[0].h).toBeCloseTo(144, 3);
  });

  it("erros amigáveis", async () => {
    await expect(abrirFonte("c", "arte.cdr", new Uint8Array([1, 2, 3]))).rejects.toThrow("Corel");
    await expect(abrirFonte("x", "x.txt", new Uint8Array([1, 2, 3]))).rejects.toThrow("Formato não suportado");
  });
});

describe("montar o PDF", () => {
  it("junta dois PDFs e uma imagem, reordena e gira", async () => {
    const a = await abrirFonte("a", "a.pdf", await pdf([[21, 29.7], [21, 29.7], [21, 29.7]]));
    const b = await abrirFonte("b", "b.pdf", await pdf([[10, 15]]));
    const i = await abrirFonte("i", "foto.png", png(300, 600));
    const bytes = await montarPdf([a, b, i], [
      { fonte: "b", pagina: 0, giro: 0 },
      { fonte: "a", pagina: 2, giro: 90 },
      { fonte: "i", pagina: 0, giro: 0 },
      { fonte: "a", pagina: 0, giro: 0 },
    ]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(4);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(cm(10), 3);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
    expect(doc.getPage(2).getHeight()).toBeCloseTo(144, 3);
    expect(doc.getPage(3).getRotation().angle).toBe(0);
  });

  it("o giro soma com o /Rotate que o arquivo já tinha", async () => {
    const a = await abrirFonte("a", "a.pdf", await pdf([[21, 29.7]], 270));
    const doc = await PDFDocument.load(await montarPdf([a], [{ fonte: "a", pagina: 0, giro: 180 }]));
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });

  it("separar: uma página por arquivo", async () => {
    const a = await abrirFonte("a", "a.pdf", await pdf([[21, 29.7], [10, 15]]));
    const so2 = await PDFDocument.load(await montarPdf([a], [{ fonte: "a", pagina: 1, giro: 0 }]));
    expect(so2.getPageCount()).toBe(1);
    expect(so2.getPage(0).getWidth()).toBeCloseTo(cm(10), 3);
    await expect(montarPdf([a], [])).rejects.toThrow("Não há páginas");
  });
});

describe("nomes e tamanhos", () => {
  it("nome de cada página separada", () => {
    expect(nomeDaPagina("catalogo.pdf", 2, 12)).toBe("catalogo_p03.pdf");
    expect(nomeDaPagina("foto.jpg", 0, 1)).toBe("foto.pdf");
  });
  it("tamanho troca largura e altura ao girar 90°", () => {
    const t = tamanhoComGiro({ w: cm(21), h: cm(29.7) }, 90);
    expect(t.w).toBeCloseTo(29.7, 5);
    expect(t.h).toBeCloseTo(21, 5);
  });
});

describe("páginas em branco", () => {
  const W = 100;
  const H = 140;
  /** Imagem branca; `desenhar` pinta retângulos pretos [x, y, w, h]. */
  function imagem(retangulos: [number, number, number, number][] = [], fundo = 255): Uint8ClampedArray {
    const d = new Uint8ClampedArray(W * H * 4).fill(fundo);
    for (let i = 3; i < d.length; i += 4) d[i] = 255;
    for (const [x0, y0, w, h] of retangulos)
      for (let y = y0; y < y0 + h; y++)
        for (let x = x0; x < x0 + w; x++) {
          const i = (y * W + x) * 4;
          d[i] = d[i + 1] = d[i + 2] = 0;
        }
    return d;
  }

  it("página toda branca ou levemente cinza (papel) está em branco", () => {
    expect(paginaEmBranco(tintaDaImagem(imagem(), W, H), false)).toBe(true);
    expect(paginaEmBranco(tintaDaImagem(imagem([], 245), W, H), false)).toBe(true);
  });

  it("um pontinho solto ainda é branco; uma frase curta, não", () => {
    expect(paginaEmBranco(tintaDaImagem(imagem([[50, 70, 1, 1]]), W, H), false)).toBe(true);
    expect(paginaEmBranco(tintaDaImagem(imagem([[10, 30, 30, 2]]), W, H), false)).toBe(false);
    expect(paginaEmBranco(tintaDaImagem(imagem([[10, 30, 80, 6]]), W, H), false)).toBe(false);
  });

  it("sombra na borda do escaner é ignorada", () => {
    expect(paginaEmBranco(tintaDaImagem(imagem([[0, 0, 100, 2], [0, 0, 2, 140]]), W, H), false)).toBe(true);
  });

  it("número de página no rodapé: conta como branco só com 'ignorar cabeçalho e rodapé'", () => {
    const t = tintaDaImagem(imagem([[40, 130, 20, 5]]), W, H);
    expect(paginaEmBranco(t, false)).toBe(false);
    expect(paginaEmBranco(t, true)).toBe(true);
    // conteúdo no meio nunca é ignorado
    expect(paginaEmBranco(tintaDaImagem(imagem([[10, 60, 80, 8]]), W, H), true)).toBe(false);
  });

  it("transparente conta como branco", () => {
    const d = new Uint8ClampedArray(W * H * 4); // tudo 0, inclusive alfa
    expect(paginaEmBranco(tintaDaImagem(d, W, H), false)).toBe(true);
  });
});
