import { describe, it, expect } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream, rgb, type PDFPage } from "pdf-lib";
import { PT_POR_CM } from "@/lib/preimpressao/margem";
import { arteEmPe } from "@/lib/preimpressao/folha";
import { gerarMontagem, giroDoVerso, planejarMontagem, type ConfigMontagem } from "@/lib/preimpressao/montagem";

const cm = (v: number) => v * PT_POR_CM;

function conteudo(p: PDFPage): string {
  const c = p.node.Contents();
  const refs = c instanceof PDFArray ? c.asArray() : [c];
  return refs
    .map((ref) => p.doc.context.lookup(ref))
    .map((st) => (st instanceof PDFRawStream ? new TextDecoder("latin1").decode(decodePDFRawStream(st).decode()) : ""))
    .join("\n");
}

async function arte(wCm: number, hCm: number, paginas = 1): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) {
    const p = d.addPage([cm(wCm), cm(hCm)]);
    p.drawRectangle({ x: 0, y: 0, width: 20, height: 20, color: rgb(0, 0, 1) });
  }
  return arteEmPe(await d.save());
}

// Formatão, sangria 3 mm, borda 0,6 mm (padrão da Max)
const base: ConfigMontagem = {
  folhaW: cm(32.8),
  folhaH: cm(47.8),
  margemMm: 0.6,
  espacoMm: 0,
  sangriaMm: 3,
  marcasCorte: true,
  frenteVerso: false,
  virada: "lateral",
};

describe("plano", () => {
  it("1000 cartões em 24 por folha → 42 folhas, sobram 8", () => {
    expect(planejarMontagem(24, 1000, 1, false)).toEqual({ modelos: 1, folhasPorModelo: 42, sobra: 8 });
  });
  it("frente e verso: 2 páginas = 1 modelo; 3 páginas = 2 modelos; sem f/v cada página é um modelo", () => {
    expect(planejarMontagem(4, 100, 2, true).modelos).toBe(1);
    expect(planejarMontagem(4, 100, 3, true).modelos).toBe(2);
    expect(planejarMontagem(4, 100, 3, false).modelos).toBe(3);
  });
});

describe("giro do verso", () => {
  it("virando pelos lados (livro): em pé continua em pé; deitada inverte", () => {
    expect(giroDoVerso(0, "lateral")).toBe(0);
    expect(giroDoVerso(90, "lateral")).toBe(270);
  });
  it("virando de baixo para cima: em pé vira de ponta-cabeça; deitada fica igual", () => {
    expect(giroDoVerso(0, "vertical")).toBe(180);
    expect(giroDoVerso(90, "vertical")).toBe(90);
  });
});

describe("PDF montado", () => {
  it("cartão 9×5 (arte 9,6×5,6 com sangria) no Formatão → 24 por folha, 1 página", async () => {
    const r = await gerarMontagem(await arte(9.6, 5.6), base);
    expect(r.encaixe.celulas.length).toBe(24);
    expect(r.paginasSaida).toBe(1);
    const p = (await PDFDocument.load(r.bytes)).getPage(0);
    expect(p.getWidth()).toBeCloseTo(r.encaixe.folhaW, 3);
    expect(conteudo(p).split(" Do").length - 1).toBe(24);
  });

  it("frente e verso: 2 páginas → frente e verso; a arte do verso é a página 2", async () => {
    const r = await gerarMontagem(await arte(10.6, 14.6, 2), { ...base, frenteVerso: true });
    expect(r.paginasSaida).toBe(2);
    const doc = await PDFDocument.load(r.bytes);
    // objetos (XObject) usados em cada folha: 1 só por lado, e diferentes entre frente e verso
    const nomes = (i: number) => {
      const xo = doc.getPage(i).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);
      return new Set(xo.entries().map(([, ref]) => ref.toString()));
    };
    const frente = nomes(0);
    const verso = nomes(1);
    expect(frente.size).toBe(1);
    expect(verso.size).toBe(1);
    expect([...frente][0]).not.toBe([...verso][0]);
  });

  it("sem frente e verso, cada página do PDF vira uma folha", async () => {
    const r = await gerarMontagem(await arte(10.6, 14.6, 3), base);
    expect(r.paginasSaida).toBe(3);
  });

  it("arte maior que a folha → erro amigável", async () => {
    await expect(gerarMontagem(await arte(50, 50), base)).rejects.toThrow("não cabe");
  });
});
