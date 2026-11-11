import { describe, it, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { PDFDocument, rgb } from "pdf-lib";
import { PT_POR_CM, chunkPng, detectarTipo, gravarDpiPng } from "@/lib/preimpressao/margem";
import { abrirArte, montarArte } from "@/lib/preimpressao/folha";
import { extrairPostScript, ehEps } from "@/lib/preimpressao/eps";
import { gerarMontagem } from "@/lib/preimpressao/montagem";

const cm = (v: number) => v * PT_POR_CM;

function png(w: number, h: number, dpi?: number): Uint8Array {
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
  return dpi ? gravarDpiPng(out, dpi) : out;
}

async function pdf(paginas: [number, number][], trim3mm = false): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (const [w, h] of paginas) {
    const p = d.addPage([cm(w), cm(h)]);
    p.drawRectangle({ x: 0, y: 0, width: 20, height: 20, color: rgb(0, 0, 1) });
    if (trim3mm) p.setTrimBox(cm(0.3), cm(0.3), cm(w - 0.6), cm(h - 0.6));
  }
  return d.save();
}

const EPS = new TextEncoder().encode("%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 258 150\n0 0 258 150 rectfill\n%%EOF\n");

describe("tipos de arquivo", () => {
  it("reconhece EPS comum e DOS EPS; PDF e imagens continuam como antes", async () => {
    expect(detectarTipo(EPS, "arte.eps")).toBe("eps");
    expect(ehEps(EPS)).toBe(true);
    const dos = new Uint8Array(30 + EPS.length);
    dos.set([0xc5, 0xd0, 0xd3, 0xc6]);
    new DataView(dos.buffer).setUint32(4, 30, true);
    new DataView(dos.buffer).setUint32(8, EPS.length, true);
    dos.set(EPS, 30);
    expect(detectarTipo(dos, "x.eps")).toBe("eps");
    expect(Array.from(extrairPostScript(dos))).toEqual(Array.from(EPS));
    expect(extrairPostScript(EPS)).toBe(EPS);
    expect(detectarTipo(png(2, 2), "a.png")).toBe("png");
    expect(detectarTipo(await pdf([[1, 1]]), "a.pdf")).toBe("pdf");
    expect(detectarTipo(new TextEncoder().encode("%!PS-Adobe-3.0\nnão é encapsulado"), "x.ps")).toBe("desconhecido");
  });
});

describe("montar a arte a partir de arquivos", () => {
  it("cartão 9,1 × 5,3 em PNG a 300 dpi: tamanho pelo DPI do arquivo", async () => {
    const r = await montarArte([{ nome: "frente.png", bytes: png(1075, 626, 300) }]);
    expect(r.arte).not.toBeNull();
    expect(r.arte!.w / PT_POR_CM).toBeCloseTo(9.1, 1);
    expect(r.arte!.h / PT_POR_CM).toBeCloseTo(5.3, 1);
    expect(r.detalhes[0]).toMatchObject({ tipo: "png", dpi: 300, dpiArquivo: 300, precisaLargura: false });
  });

  it("imagem sem DPI: pede a largura; com a largura digitada (9,1 cm) vira 9,1 cm", async () => {
    const bytes = png(1075, 626);
    const sem = await montarArte([{ nome: "frente.png", bytes }]);
    expect(sem.arte).toBeNull();
    expect(sem.detalhes[0].precisaLargura).toBe(true);
    const com = await montarArte([{ nome: "frente.png", bytes, larguraCm: 9.1 }]);
    expect(com.arte!.w / PT_POR_CM).toBeCloseTo(9.1, 3);
    expect(com.arte!.h / PT_POR_CM).toBeCloseTo((626 / 1075) * 9.1, 3);
  });

  it("largura digitada corrige o DPI do arquivo", async () => {
    const r = await montarArte([{ nome: "a.png", bytes: png(1075, 626, 72), larguraCm: 9.1 }]);
    expect(r.arte!.w / PT_POR_CM).toBeCloseTo(9.1, 3);
    expect(r.detalhes[0].dpi).toBeCloseTo(300, 0);
  });

  it("frente e verso em dois arquivos (PNG + PDF) viram uma arte de 2 páginas, na ordem", async () => {
    const r = await montarArte([
      { nome: "frente.png", bytes: png(1075, 626, 300) },
      { nome: "verso.pdf", bytes: await pdf([[9.1, 5.3]], true) },
    ]);
    expect(r.arte!.paginas).toBe(2);
    expect(r.arte!.nome).toBe("frente + 1");
    expect(r.arte!.tamanhosDiferentes).toBe(false);
    const doc = await PDFDocument.load(r.arte!.emPe);
    expect(doc.getPageCount()).toBe(2);
  });

  it("tamanhos diferentes são avisados; a sangria vem do 1º PDF", async () => {
    const r = await montarArte([
      { nome: "a.pdf", bytes: await pdf([[9.1, 5.3]], true) },
      { nome: "b.pdf", bytes: await pdf([[9.1, 6]]) },
    ]);
    expect(r.arte!.tamanhosDiferentes).toBe(true);
    expect(r.arte!.sangriaPdf).toBe(3);
  });

  it("EPS passa pelo conversor e vira PDF; sem conversor dá erro amigável", async () => {
    const convertido = await pdf([[9.1, 5.3]]);
    let chamadas = 0;
    const r = await montarArte([{ nome: "arte.eps", bytes: EPS }], async (b) => {
      chamadas++;
      expect(b).toBe(EPS);
      return convertido;
    });
    expect(chamadas).toBe(1);
    expect(r.arte!.w / PT_POR_CM).toBeCloseTo(9.1, 3);
    expect(r.detalhes[0].tipo).toBe("eps");
    const sem = await montarArte([{ nome: "arte.eps", bytes: EPS }]);
    expect(sem.arte).toBeNull();
    expect(sem.detalhes[0].erro).toContain("EPS");
  });

  it("erros: .cdr e formato desconhecido; um arquivo com erro impede montar a arte", async () => {
    const cdr = await montarArte([{ nome: "x.cdr", bytes: new Uint8Array([1, 2, 3]) }]);
    expect(cdr.arte).toBeNull();
    expect(cdr.detalhes[0].erro).toContain("Corel");
    const misto = await montarArte([
      { nome: "ok.pdf", bytes: await pdf([[5, 5]]) },
      { nome: "lixo.txt", bytes: new Uint8Array([1, 2, 3, 4]) },
    ]);
    expect(misto.arte).toBeNull();
    expect(misto.detalhes[1].erro).toContain("Formato não suportado");
  });

  it("abrirArte (Livreto) aceita PDF e EPS, mas imagem não", async () => {
    expect((await abrirArte(await pdf([[5, 5]]), "a.pdf")).paginas).toBe(1);
    await expect(abrirArte(png(10, 10, 300), "a.png")).rejects.toThrow("PDF ou EPS");
  });
});

describe("o cartão do Juliano: 9,1 × 5,3 cm (corte 8,5 × 4,7), frente e verso, no Formatão", () => {
  const cfg = {
    folhaW: cm(32.8),
    folhaH: cm(47.8),
    margemMm: 0.6,
    espacoMm: 0,
    sangriaMm: 3,
    marcasCorte: true,
    frenteVerso: true,
    virada: "lateral" as const,
    conteudo: "repetir" as const,
    ordem: "folha" as const,
  };

  it("30 por folha (6 × 5, deitados) e uma folha de frente + uma de verso", async () => {
    const { arte } = await montarArte([
      { nome: "frente.png", bytes: png(1075, 626, 300) },
      { nome: "verso.png", bytes: png(1075, 626, 300) },
    ]);
    const r = await gerarMontagem(arte!.emPe, cfg);
    expect([r.encaixe.colunas, r.encaixe.linhas, r.encaixe.celulas.length, r.encaixe.celulas[0].rot]).toEqual([6, 5, 30, 90]);
    expect(r.paginasSaida).toBe(2);
  });
});
