import { describe, it, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream, degrees, rgb, type PDFPage } from "pdf-lib";
import {
  PT_POR_CM,
  chunkPng,
  detectarTipo,
  dpiEfetivo,
  formatarAntesDepois,
  gravarDpiJpg,
  gravarDpiPng,
  imagemParaPdf,
  lerInfoJpg,
  lerInfoPng,
  margensPara,
  nomeResultado,
  origemRotacionada,
  posicoesIlhos,
  planejarImagem,
  processarPdf,
  retangulosLinhaCorte,
} from "@/lib/preimpressao/margem";

const cm = (pt: number) => pt / PT_POR_CM;

/** Texto do(s) content stream(s) da página. */
function conteudoPagina(p: PDFPage): string {
  const c = p.node.Contents();
  const refs = c instanceof PDFArray ? c.asArray() : [c];
  return refs
    .map((ref) => p.doc.context.lookup(ref))
    .map((st) => (st instanceof PDFRawStream ? new TextDecoder("latin1").decode(decodePDFRawStream(st).decode()) : ""))
    .join("\n");
}

async function pdfCom(wCm: number, hCm: number, rotate = 0): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const p = doc.addPage([wCm * PT_POR_CM, hCm * PT_POR_CM]);
  p.drawRectangle({ x: 0, y: 0, width: 10, height: 10, color: rgb(1, 0, 0) });
  if (rotate) p.setRotation(degrees(rotate));
  return doc.save();
}

/** PNG RGB válido (pixels de verdade), opcionalmente com pHYs. */
function png(w: number, h: number, dpi?: number): Uint8Array {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array(h * (1 + w * 3)); // filtro 0 + pixels pretos
  const idat = new Uint8Array(deflateSync(raw));
  const partes = [sig, chunkPng("IHDR", ihdr)];
  if (dpi) {
    const d = new Uint8Array(9);
    const v = new DataView(d.buffer);
    const ppm = Math.round(dpi / 0.0254);
    v.setUint32(0, ppm);
    v.setUint32(4, ppm);
    d[8] = 1;
    partes.push(chunkPng("pHYs", d));
  }
  partes.push(chunkPng("IDAT", idat), chunkPng("IEND", new Uint8Array(0)));
  const out = new Uint8Array(partes.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of partes) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Cabeçalho de JPG (SOI + APP0 opcional + SOF0 + EOI) — o pdf-lib só lê o cabeçalho. */
function jpg(w: number, h: number, comps: number, dpi?: number): Uint8Array {
  const b: number[] = [0xff, 0xd8];
  if (dpi) b.push(0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, dpi >> 8, dpi & 0xff, dpi >> 8, dpi & 0xff, 0, 0);
  const sofLen = 8 + comps * 3;
  b.push(0xff, 0xc0, sofLen >> 8, sofLen & 0xff, 8, h >> 8, h & 0xff, w >> 8, w & 0xff, comps);
  for (let i = 1; i <= comps; i++) b.push(i, 0x11, 0);
  b.push(0xff, 0xd9);
  return new Uint8Array(b);
}

describe("margens", () => {
  it("banner = cima e baixo, faixa = laterais, todos = 4 lados", () => {
    expect(margensPara("banner", 10)).toEqual({ top: 10, bottom: 10, left: 0, right: 0 });
    expect(margensPara("faixa", 5)).toEqual({ top: 0, bottom: 0, left: 5, right: 5 });
    expect(margensPara("todos", 2)).toEqual({ top: 2, bottom: 2, left: 2, right: 2 });
  });

  it("nome do arquivo de saída", () => {
    expect(nomeResultado("lona.cliente.png")).toBe("lona.cliente_acabamento.png");
    expect(nomeResultado("banner.JPG", "pdf")).toBe("banner_acabamento.pdf");
  });

  it("formata antes → depois em cm", () => {
    expect(formatarAntesDepois({ w: 80, h: 120 }, { w: 80, h: 140 })).toBe("80,0 × 120,0 cm → 80,0 × 140,0 cm");
  });

  it("detecta tipo pelo conteúdo e reconhece .cdr", () => {
    expect(detectarTipo(new TextEncoder().encode("%PDF-1.7"), "a.pdf")).toBe("pdf");
    expect(detectarTipo(png(1, 1), "x.bin")).toBe("png");
    expect(detectarTipo(jpg(1, 1, 3), "x")).toBe("jpg");
    expect(detectarTipo(new Uint8Array([0x52, 0x49, 0x46, 0x46]), "arte.CDR")).toBe("cdr");
  });
});

describe("linha de corte (borda de fora, área a mais sem preenchimento)", () => {
  it("banner: linha de 1 só no topo e na base, pela largura toda", () => {
    const m = margensPara("banner", 10);
    expect(retangulosLinhaCorte(80, 140, m, 0.1)).toEqual([
      { x: 0, y: 139.9, w: 80, h: 0.1 },
      { x: 0, y: 0, w: 80, h: 0.1 },
    ]);
    // canvas: y cresce para baixo
    expect(retangulosLinhaCorte(800, 1400, margensPara("banner", 100), 4, true)).toEqual([
      { x: 0, y: 0, w: 800, h: 4 },
      { x: 0, y: 1396, w: 800, h: 4 },
    ]);
  });

  it("faixa: só nas laterais; todos: 4 lados; nunca mais grossa que a margem", () => {
    expect(retangulosLinhaCorte(320, 70, margensPara("faixa", 10), 0.1)).toEqual([
      { x: 0, y: 0, w: 0.1, h: 70 },
      { x: 319.9, y: 0, w: 0.1, h: 70 },
    ]);
    expect(retangulosLinhaCorte(10, 10, margensPara("todos", 1), 0.1)).toHaveLength(4);
    expect(retangulosLinhaCorte(10, 10, margensPara("todos", 0.05), 0.1)[0].h).toBe(0.05);
  });

  it("no PDF a área a mais não é pintada: só retângulos de 0,5 mm em K50", async () => {
    const r = await processarPdf(await pdfCom(80, 120), margensPara("banner", 10));
    const pagina = conteudoPagina((await PDFDocument.load(r.bytes)).getPage(0));
    expect(pagina).toBeTruthy();
    const meioMm = (0.05 * PT_POR_CM).toString();
    // as duas linhas (topo e base) têm 0,5 mm de altura; nenhuma faixa de 10 cm
    expect(pagina.split("0 0 0 0.5 k").length - 1).toBe(2);
    expect(pagina).toContain(meioMm);
    expect(pagina).not.toContain((10 * PT_POR_CM).toString() + " l");
  });
});

describe("marcas de ilhós", () => {
  it("lona 300×100 cm, a cada 30 cm, 2,5 cm da borda → 28 ilhós, cantos incluídos", () => {
    const pts = posicoesIlhos(300, 100, 30, 2.5);
    expect(pts).toHaveLength(28);
    for (const c of [[2.5, 2.5], [297.5, 2.5], [2.5, 97.5], [297.5, 97.5]]) {
      expect(pts.some((p) => Math.abs(p.x - c[0]) < 1e-9 && Math.abs(p.y - c[1]) < 1e-9)).toBe(true);
    }
    // vizinhos no lado de baixo nunca passam de 30 cm
    const baixo = pts.filter((p) => p.y === 2.5).map((p) => p.x).sort((a, b) => a - b);
    baixo.forEach((x, i) => i && expect(x - baixo[i - 1]).toBeLessThanOrEqual(30 + 1e-9));
    expect(baixo).toHaveLength(11);
  });

  it("peça pequena: só os 4 cantos; menor que o recuo: nenhum", () => {
    expect(posicoesIlhos(20, 20, 30, 2.5)).toHaveLength(4);
    expect(posicoesIlhos(4, 20, 30, 2.5)).toHaveLength(0);
  });

  it("no PDF as marcas ficam sobre a arte e o tamanho não muda", async () => {
    const sem = await processarPdf(await pdfCom(80, 120), margensPara("todos", 10));
    const com = await processarPdf(await pdfCom(80, 120), margensPara("todos", 10), { espacamentoCm: 30, recuoCm: 2.5 });
    expect(com.paginas[0].depois).toEqual(sem.paginas[0].depois);
    const txt = conteudoPagina((await PDFDocument.load(com.bytes)).getPage(0));
    // 80 → 3 vãos (4 ilhós), 120 → 4 vãos: 2×4 + 2×3 = 14 ilhós, 2 círculos cada; K100 no ponto central
    expect(txt.split("0 0 0 1 k").length - 1).toBe(14);
  });
});

describe("PDF", () => {
  it("80×120 cm como banner → 80×140 cm", async () => {
    const r = await processarPdf(await pdfCom(80, 120), margensPara("banner", 10));
    expect(formatarAntesDepois(r.paginas[0].antes, r.paginas[0].depois)).toBe("80,0 × 120,0 cm → 80,0 × 140,0 cm");
    const out = await PDFDocument.load(r.bytes);
    const p = out.getPage(0);
    expect(cm(p.getWidth())).toBeCloseTo(80, 3);
    expect(cm(p.getHeight())).toBeCloseTo(140, 3);
    expect(p.getRotation().angle).toBe(0);
    expect(r.passaLimite).toBe(false);
  });

  it("/Rotate 90 de 100×50 → visível 50×100 → 50×120", async () => {
    const r = await processarPdf(await pdfCom(100, 50, 90), margensPara("banner", 10));
    expect(r.paginas[0].antes.w).toBeCloseTo(50, 3);
    expect(r.paginas[0].antes.h).toBeCloseTo(100, 3);
    const p = (await PDFDocument.load(r.bytes)).getPage(0);
    expect(cm(p.getWidth())).toBeCloseTo(50, 3);
    expect(cm(p.getHeight())).toBeCloseTo(120, 3);
  });

  it("origem da arte girada fica dentro da área da arte", () => {
    // w=100, h=50 (sem rotação), margem 10 embaixo
    expect(origemRotacionada(0, 100, 50, 0, 10)).toEqual({ x: 0, y: 10 });
    expect(origemRotacionada(90, 100, 50, 0, 10)).toEqual({ x: 0, y: 110 });
    expect(origemRotacionada(180, 100, 50, 0, 10)).toEqual({ x: 100, y: 60 });
    expect(origemRotacionada(270, 100, 50, 0, 10)).toEqual({ x: 50, y: 10 });
  });

  it("avisa quando passa de 508 cm", async () => {
    const r = await processarPdf(await pdfCom(80, 500), margensPara("banner", 10));
    expect(r.passaLimite).toBe(true);
  });
});

describe("PNG", () => {
  it("lê e grava o DPI (pHYs)", () => {
    const semDpi = png(4, 3);
    expect(lerInfoPng(semDpi).dpi).toBeNull();
    const com = gravarDpiPng(semDpi, 150);
    const info = lerInfoPng(com);
    expect(info.dpi).toBe(150);
    expect(info.larguraPx).toBe(4);
    // regravar não duplica o chunk
    const de2 = gravarDpiPng(com, 72);
    expect(lerInfoPng(de2).dpi).toBe(72);
    expect(de2.length).toBe(com.length);
  });

  it("300×70 cm a 50 dpi como faixa → 320×70 cm, DPI preservado", () => {
    const arq = png(5906, 1378, 50);
    const info = lerInfoPng(arq);
    expect(info.dpi).toBe(50);
    const plano = planejarImagem(info, margensPara("faixa", 10), dpiEfetivo(info)!);
    expect(formatarAntesDepois(plano.antes, plano.depois)).toBe("300,0 × 70,0 cm → 320,0 × 70,0 cm");
    expect(plano.px.left).toBe(197);
    expect(plano.cabeNoCanvas).toBe(true);
    expect(lerInfoPng(gravarDpiPng(png(2, 2), plano.dpi)).dpi).toBe(50);
  });

  it("sem DPI: falta a medida até digitar a largura real (90 cm)", () => {
    const info = lerInfoPng(png(1800, 2400));
    expect(dpiEfetivo(info)).toBeNull();
    const dpi = dpiEfetivo(info, 90)!;
    const plano = planejarImagem(info, margensPara("banner", 10), dpi);
    expect(plano.antes.w).toBeCloseTo(90, 5);
    expect(plano.antes.h).toBeCloseTo(120, 5);
    expect(plano.depois.h).toBeCloseTo(140, 1);
  });

  it("Sempre PDF a partir de PNG", async () => {
    const arq = png(90, 120, 254); // 254 dpi = 100 px/cm → 0,9 × 1,2 cm
    const info = lerInfoPng(arq);
    const r = await imagemParaPdf(arq, info, margensPara("todos", 1), info.dpi!);
    const p = (await PDFDocument.load(r.bytes)).getPage(0);
    expect(cm(p.getWidth())).toBeCloseTo(2.9, 3);
    expect(cm(p.getHeight())).toBeCloseTo(3.2, 3);
  });

  it("canvas grande demais é detectado", () => {
    const info = lerInfoPng(png(32600, 10, 50)); // + 2 × 197 px passa de 32767 px
    expect(planejarImagem(info, margensPara("faixa", 10), 50).cabeNoCanvas).toBe(false);
  });
});

describe("JPG", () => {
  it("lê DPI do JFIF e detecta CMYK", () => {
    const i = lerInfoJpg(jpg(100, 50, 4, 300));
    expect(i).toMatchObject({ larguraPx: 100, alturaPx: 50, dpi: 300, cmyk: true });
    expect(lerInfoJpg(jpg(10, 10, 3)).cmyk).toBe(false);
    expect(lerInfoJpg(jpg(10, 10, 3)).dpi).toBeNull();
  });

  it("grava DPI no JFIF existente ou insere um novo", () => {
    expect(lerInfoJpg(gravarDpiJpg(jpg(10, 10, 3), 120)).dpi).toBe(120);
    expect(lerInfoJpg(gravarDpiJpg(jpg(10, 10, 3, 72), 50)).dpi).toBe(50);
  });

  it("lê DPI do EXIF quando não há JFIF", () => {
    // TIFF little-endian, 2 entradas: XResolution (RATIONAL → offset 38) e ResolutionUnit = 2
    const tiff = new Uint8Array(46);
    const v = new DataView(tiff.buffer);
    tiff.set([0x49, 0x49, 0x2a, 0x00]);
    v.setUint32(4, 8, true);
    v.setUint16(8, 2, true);
    v.setUint16(10, 0x011a, true);
    v.setUint16(12, 5, true);
    v.setUint32(14, 1, true);
    v.setUint32(18, 38, true);
    v.setUint16(22, 0x0128, true);
    v.setUint16(24, 3, true);
    v.setUint32(26, 1, true);
    v.setUint16(30, 2, true);
    v.setUint32(38, 200, true);
    v.setUint32(42, 1, true);
    const exif = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff]);
    const len = exif.length + 2;
    const base = jpg(10, 10, 3);
    const arq = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 0xff, ...exif, ...base.subarray(2)]);
    expect(lerInfoJpg(arq).dpi).toBe(200);
  });

  it("JPG CMYK 60×90 cm → PDF 60×110 cm", async () => {
    const arq = jpg(2362, 3543, 4, 100); // 60,0 × 90,0 cm a 100 dpi
    const info = lerInfoJpg(arq);
    const r = await imagemParaPdf(arq, info, margensPara("banner", 10), info.dpi!);
    expect(formatarAntesDepois(r.paginas[0].antes, r.paginas[0].depois)).toBe("60,0 × 90,0 cm → 60,0 × 110,0 cm");
    const p = (await PDFDocument.load(r.bytes)).getPage(0);
    expect(cm(p.getWidth())).toBeCloseTo(60, 1);
    expect(cm(p.getHeight())).toBeCloseTo(110, 1);
  });
});
