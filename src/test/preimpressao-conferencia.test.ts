import { describe, it, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { PDFDocument, StandardFonts, cmyk, rgb } from "pdf-lib";
import { PT_POR_CM, chunkPng } from "@/lib/preimpressao/margem";
import {
  analisarPdf,
  coresDoConteudo,
  limitesResolucao,
  relatorioImagem,
  relatorioPdf,
  resolucoesDaPagina,
  veredito,
} from "@/lib/preimpressao/conferencia";

const cm = (v: number) => v * PT_POR_CM;
const mm = (v: number) => (v / 10) * PT_POR_CM;

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

/** JPG só com cabeçalho (o pdf-lib não decodifica): `comps` 3 = RGB, 4 = CMYK. */
function jpg(w: number, h: number, comps: number): Uint8Array {
  const b: number[] = [0xff, 0xd8];
  const len = 8 + comps * 3;
  b.push(0xff, 0xc0, len >> 8, len & 0xff, 8, h >> 8, h & 0xff, w >> 8, w & 0xff, comps);
  for (let i = 1; i <= comps; i++) b.push(i, 0x11, 0);
  b.push(0xff, 0xd9);
  return new Uint8Array(b);
}

describe("cores no conteúdo", () => {
  it("separa RGB colorido, preto em RGB e CMYK; ignora letras dentro de textos", () => {
    expect(coresDoConteudo("1 0 0 rg 0 0 10 10 re f")).toEqual({ rgbColorido: true, rgbNeutro: false, cmyk: false });
    expect(coresDoConteudo("0 0 0 rg\n0.5 0.5 0.5 RG")).toEqual({ rgbColorido: false, rgbNeutro: true, cmyk: false });
    expect(coresDoConteudo("0 0 0 1 k\n0 1 1 0 K")).toEqual({ rgbColorido: false, rgbNeutro: false, cmyk: true });
    expect(coresDoConteudo("BT (1 0 0 rg) Tj ET")).toEqual({ rgbColorido: false, rgbNeutro: false, cmyk: false });
  });
});

describe("análise do PDF", () => {
  it("arquivo bom: CMYK, sangria de 3 mm, fonte incorporada não é exigida para curvas", async () => {
    const d = await PDFDocument.create();
    const p = d.addPage([cm(9.6), cm(5.6)]);
    p.setTrimBox(mm(3), mm(3), cm(9), cm(5));
    p.drawRectangle({ x: 0, y: 0, width: 50, height: 50, color: cmyk(1, 0, 0, 0) });
    const a = await analisarPdf(await d.save());
    expect(a).toMatchObject({ paginas: 1, sangriaMm: 3, vetorCmyk: true, vetorRgbColorido: false, vetorRgbNeutro: false, imagens: [], fontes: [] });
    const r = relatorioPdf(a, null);
    expect(veredito(r).nivel).toBe("ok");
    expect(r.find((x) => x.titulo.startsWith("Sangria"))!.detalhe).toContain("9 × 5 cm");
  });

  it("aponta RGB, fonte não incorporada, imagem RGB e páginas de tamanhos diferentes", async () => {
    const d = await PDFDocument.create();
    const f = await d.embedFont(StandardFonts.Helvetica); // padrão: NÃO incorporada
    const p = d.addPage([cm(21), cm(29.7)]);
    p.drawText("Oi", { x: 50, y: 50, size: 20, font: f, color: rgb(1, 0, 0) });
    p.drawImage(await d.embedPng(png(100, 100)), { x: 0, y: 0, width: 72, height: 72 });
    d.addPage([cm(10), cm(15)]);
    const a = await analisarPdf(await d.save());
    expect(a.tamanhosIguais).toBe(false);
    expect(a.vetorRgbColorido).toBe(true);
    expect(a.fontes).toEqual([{ nome: "Helvetica", embutida: false }]);
    expect(a.imagens).toEqual([{ largura: 100, altura: 100, cor: "rgb" }]);
    const r = relatorioPdf(a, 100);
    expect(veredito(r).nivel).toBe("problema");
    expect(r.some((x) => x.titulo === "Fontes não incorporadas")).toBe(true);
    expect(r.some((x) => x.titulo === "Cores em RGB")).toBe(true);
    expect(r.some((x) => x.titulo === "Resolução baixa")).toBe(true);
    expect(r.find((x) => x.titulo.startsWith("Sangria"))!.nivel).toBe("info");
  });

  it("imagem CMYK não gera aviso de RGB; máscara de transparência não conta como imagem", async () => {
    const d = await PDFDocument.create();
    const p = d.addPage([cm(10), cm(10)]);
    p.drawImage(await d.embedJpg(jpg(600, 600, 4)), { x: 0, y: 0, width: cm(5), height: cm(5) });
    const a = await analisarPdf(await d.save());
    expect(a.imagens).toEqual([{ largura: 600, altura: 600, cor: "cmyk" }]);
    expect(relatorioPdf(a, 300).some((x) => x.titulo === "Cores em RGB")).toBe(false);
  });

  it("PDF inválido → mensagem amigável", async () => {
    await expect(analisarPdf(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow("Não consegui abrir");
  });
});

describe("resolução", () => {
  it("limites: impressos 250/150 ppi; grande formato (lado > 60 cm) 60/30 ppi", () => {
    expect(limitesResolucao(30)).toMatchObject({ boa: 250, minima: 150 });
    expect(limitesResolucao(120)).toMatchObject({ boa: 60, minima: 30, grandeFormato: true });
  });

  it("mede o ppi pela matriz: imagem de 600 px colocada com 2 polegadas = 300 ppi", () => {
    const OPS = { save: 1, restore: 2, transform: 3, paintFormXObjectBegin: 4, paintFormXObjectEnd: 5, imagens: [6] };
    const fn = [1, 3, 6, 2, 1, 3, 3, 6, 2];
    const args = [
      null,
      [144, 0, 0, 144, 10, 10], // 2 pol × 2 pol
      ["img1", 600, 600],
      null,
      null,
      [0.5, 0, 0, 0.5, 0, 0], // escala acumulada
      [288, 0, 0, 144, 0, 0], // → 144 × 72 pt
      ["img2", 300, 300],
      null,
    ];
    const ppis = resolucoesDaPagina(fn, args, OPS);
    expect(ppis[0]).toBeCloseTo(300, 5);
    expect(ppis[1]).toBeCloseTo(150, 5); // 300 px em 2 pol (o menor dos dois lados)
  });
});

describe("imagens soltas", () => {
  it("PNG com DPI: tamanho, resolução e aviso de RGB", () => {
    const r = relatorioImagem({ tipo: "png", larguraPx: 3000, alturaPx: 2000, dpi: 300, cmyk: false });
    expect(r[0].titulo).toBe("Tamanho: 25,4 × 16,9 cm");
    expect(r.some((x) => x.titulo === "Resolução boa")).toBe(true);
    expect(veredito(r).nivel).toBe("atencao"); // RGB
  });
  it("banner em JPG CMYK a 50 dpi (3 m): resolução no limite para grande formato", () => {
    const r = relatorioImagem({ tipo: "jpg", larguraPx: 5906, alturaPx: 1378, dpi: 50, cmyk: true });
    expect(r.some((x) => x.titulo === "Resolução no limite")).toBe(true);
    expect(r.some((x) => x.titulo === "Cores em CMYK")).toBe(true);
  });
  it("sem DPI: diz até que tamanho dá para imprimir", () => {
    const r = relatorioImagem({ tipo: "jpg", larguraPx: 2500, alturaPx: 2500, dpi: null, cmyk: false });
    expect(r[0].detalhe).toContain("25,4 × 25,4 cm");
  });
});
