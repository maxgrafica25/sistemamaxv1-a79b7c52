import { describe, it, expect } from "vitest";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream, degrees, rgb, type PDFPage } from "pdf-lib";
import { PT_POR_CM } from "@/lib/preimpressao/margem";
import {
  arteEmPe,
  encaixarNaFolha,
  formatarNumero,
  gerarNumeracao,
  gradeMontada,
  numeroNaPosicao,
  paginaDaVia,
  planejarNumeracao,
  pontoNaFolha,
  type ConfigNumeracao,
} from "@/lib/preimpressao/numeracao";

const cm = (v: number) => v * PT_POR_CM;

function conteudo(p: PDFPage): string {
  const c = p.node.Contents();
  const refs = c instanceof PDFArray ? c.asArray() : [c];
  return refs
    .map((ref) => p.doc.context.lookup(ref))
    .map((st) => (st instanceof PDFRawStream ? new TextDecoder("latin1").decode(decodePDFRawStream(st).decode()) : ""))
    .join("\n");
}

/** Texto como o pdf-lib grava (hex) para procurar no content stream. */
const hex = (s: string) => `<${Array.from(s, (ch) => ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")).join("")}>`;

async function arte(wCm: number, hCm: number, paginas = 1, rotate = 0): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) {
    const p = d.addPage([cm(wCm), cm(hCm)]);
    p.drawRectangle({ x: 0, y: 0, width: 20, height: 20, color: rgb(0, 0, 1) });
    if (rotate) p.setRotation(degrees(rotate));
  }
  return d.save();
}

const base: ConfigNumeracao = {
  modo: "solto",
  folhaW: cm(21),
  folhaH: cm(29.7),
  colunas: 2,
  linhas: 2,
  margemMm: 5,
  espacoMm: 0,
  marcasCorte: true,
  inicio: 1,
  taloes: 8,
  jogos: 50,
  vias: 2,
  digitos: 4,
  prefixo: "Nº ",
  tamanhoPt: 14,
  cor: "vermelho",
  posicoes: [{ x: 0.85, y: 0.1, girar: false }],
  ordemInvertida: false,
};

describe("número", () => {
  it("zeros à esquerda e prefixo", () => {
    expect(formatarNumero(7, 4)).toBe("0007");
    expect(formatarNumero(12345, 4, "Nº ")).toBe("Nº 12345");
  });
});

describe("corte e empilha", () => {
  it("8 talões de 50 em 4 por folha → 100 folhas, montes em sequência", () => {
    const p = planejarNumeracao(4, 8, 50, 1);
    expect(p).toMatchObject({ taloesPorMonte: 2, folhas: 100, posicoesVazias: 0, espacosVazios: 0, primeiro: 1, ultimo: 400 });
    // folha 1: 1, 101, 201, 301
    expect([0, 1, 2, 3].map((j) => numeroNaPosicao(p, j, 0, 8, 50, 1))).toEqual([1, 101, 201, 301]);
    // última folha: 100, 200, 300, 400
    expect([0, 1, 2, 3].map((j) => numeroNaPosicao(p, j, 99, 8, 50, 1))).toEqual([100, 200, 300, 400]);
  });

  it("cada monte cortado fica em sequência sem buracos nem repetição", () => {
    const B = 10;
    const F = 25;
    const p = planejarNumeracao(4, B, F, 1001);
    const vistos: number[] = [];
    for (let j = 0; j < 4; j++) {
      const monte: number[] = [];
      for (let s = 0; s < p.folhas; s++) {
        const n = numeroNaPosicao(p, j, s, B, F, 1001);
        if (n !== null) monte.push(n);
      }
      monte.forEach((n, i) => i && expect(n).toBe(monte[i - 1] + 1));
      vistos.push(...monte);
    }
    expect(vistos.sort((a, b) => a - b)).toEqual(Array.from({ length: B * F }, (_, i) => 1001 + i));
  });

  it("talões que não dividem certo deixam posições em branco no fim", () => {
    const p = planejarNumeracao(4, 5, 50, 1); // 2 por monte → montes 0,1,2 (o 3º com 1 talão), monte 4 vazio
    expect(p.folhas).toBe(100);
    expect(p.posicoesVazias).toBe(1);
    expect(p.espacosVazios).toBe(3); // 4 montes × 2 = 8 espaços, 5 talões
    expect(planejarNumeracao(4, 10, 50, 1)).toMatchObject({ folhas: 150, posicoesVazias: 0, espacosVazios: 2 });
    expect(numeroNaPosicao(p, 3, 0, 5, 50, 1)).toBeNull();
    expect(numeroNaPosicao(p, 2, 50, 5, 50, 1)).toBeNull(); // 3º monte só tem 1 talão
    expect(numeroNaPosicao(p, 2, 49, 5, 50, 1)).toBe(250);
  });
});

describe("encaixe na folha", () => {
  it("talão 10×14 cm em A4 com 5 mm de margem → 2 × 2", () => {
    const e = encaixarNaFolha(cm(21), cm(29.7), cm(10), cm(14), cm(0.5), 0);
    expect([e.colunas, e.linhas, e.celulas[0].rot]).toEqual([2, 2, 0]);
    // primeira célula em cima à esquerda
    expect(e.celulas[0].y).toBeGreaterThan(e.celulas[2].y);
    expect(e.celulas[0].x).toBeLessThan(e.celulas[1].x);
  });

  it("gira a arte quando cabe mais (A6 deitado 14,8×10,5 em A4 → 4)", () => {
    const e = encaixarNaFolha(cm(21), cm(29.7), cm(14.8), cm(10.5), 0, 0);
    expect(e.celulas.length).toBe(4);
    expect(e.celulas[0].rot).toBe(90);
  });

  it("arte girada: ponto da arte cai dentro da célula", () => {
    const c = { x: 100, y: 50, rot: 90 as const, w: 40, h: 30 };
    expect(pontoNaFolha(c, 0, 0)).toEqual({ x: 130, y: 50 });
    expect(pontoNaFolha(c, 40, 30)).toEqual({ x: 100, y: 90 });
  });

  it("grade da arte já montada divide a página", () => {
    const g = gradeMontada(cm(21), cm(29.7), 2, 3, 0, 0);
    expect(g.celulas.length).toBe(6);
    expect(g.celulas[0].w).toBeCloseTo(cm(10.5), 5);
    expect(g.celulas[0].h).toBeCloseTo(cm(9.9), 5);
  });

  it("página de cada via", () => {
    expect([0, 1, 2].map((v) => paginaDaVia(v, 1))).toEqual([0, 0, 0]);
    expect([0, 1, 2].map((v) => paginaDaVia(v, 2))).toEqual([0, 1, 1]);
  });
});

describe("PDF numerado", () => {
  it("talão solto 10×14 em A4: 2 vias, 100 folhas, números certos na 1ª folha", async () => {
    const r = await gerarNumeracao(await arteEmPe(await arte(10, 14)), base);
    expect(r.porFolha).toBe(4);
    expect(r.vias).toHaveLength(2);
    const doc = await PDFDocument.load(r.vias[0]);
    expect(doc.getPageCount()).toBe(100);
    const p = doc.getPage(0);
    expect(p.getWidth()).toBeCloseTo(cm(21), 3);
    const txt = conteudo(p);
    for (const n of ["Nº 0001", "Nº 0101", "Nº 0201", "Nº 0301"]) expect(txt).toContain(hex(n));
    expect(txt).toContain("0 1 1 0 k"); // vermelho CMYK
    expect(conteudo(doc.getPage(99))).toContain(hex("Nº 0400"));
  });

  it("ordem invertida começa pela última folha", async () => {
    const r = await gerarNumeracao(await arteEmPe(await arte(10, 14)), { ...base, vias: 1, ordemInvertida: true });
    const doc = await PDFDocument.load(r.vias[0]);
    expect(conteudo(doc.getPage(0))).toContain(hex("Nº 0100"));
  });

  it("arte já montada 2×2 com 2 páginas (1 por via) e duas posições do número", async () => {
    const cfg: ConfigNumeracao = {
      ...base,
      modo: "montado",
      margemMm: 0,
      taloes: 4,
      jogos: 10,
      posicoes: [
        { x: 0.8, y: 0.1, girar: false },
        { x: 0.05, y: 0.5, girar: true },
      ],
    };
    const r = await gerarNumeracao(await arteEmPe(await arte(21, 29.7, 2)), cfg);
    const doc = await PDFDocument.load(r.vias[1]);
    expect(doc.getPageCount()).toBe(10);
    const txt = conteudo(doc.getPage(0));
    expect(txt.split(hex("Nº 0001")).length - 1).toBe(2);
    expect(txt).toContain(hex("Nº 0031"));
  });

  it("arte com /Rotate 90 é usada em pé", async () => {
    const emPe = await arteEmPe(await arte(14, 10, 1, 90));
    const p = (await PDFDocument.load(emPe)).getPage(0);
    expect(p.getWidth()).toBeCloseTo(cm(10), 3);
    expect(p.getHeight()).toBeCloseTo(cm(14), 3);
  });

  it("erros amigáveis", async () => {
    const emPe = await arteEmPe(await arte(40, 40));
    await expect(gerarNumeracao(emPe, base)).rejects.toThrow("não cabe");
    await expect(gerarNumeracao(await arteEmPe(await arte(10, 14)), { ...base, posicoes: [] })).rejects.toThrow("Clique na prévia");
  });
});
