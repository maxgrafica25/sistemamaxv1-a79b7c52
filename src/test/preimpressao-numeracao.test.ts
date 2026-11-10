import { describe, it, expect } from "vitest";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream, degrees, rgb, type PDFPage } from "pdf-lib";
import { PT_POR_CM } from "@/lib/preimpressao/margem";
import {
  COR_PADRAO,
  aproveitamento,
  arteEmPe,
  cmykDaCor,
  corValida,
  encaixarNaFolha,
  formatarNumero,
  gerarNumeracao,
  gradeMontada,
  numeroNaPosicao,
  paginaDaVia,
  planejarNumeracao,
  pontoNaFolha,
  sangriaDoPdf,
  tamanhoFinal,
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
  sangriaMm: 0,
  marcasCorte: true,
  inicio: 1,
  fim: 400,
  porBloco: 50,
  vias: 2,
  digitos: 4,
  prefixo: "Nº ",
  tamanhoPt: 14,
  cor: "#e30613",
  posicao: { x: 0.85, y: 0.1, girar: false },
  ordemInvertida: false,
};

describe("número", () => {
  it("zeros à esquerda e prefixo", () => {
    expect(formatarNumero(7, 4)).toBe("0007");
    expect(formatarNumero(12345, 4, "Nº ")).toBe("Nº 12345");
  });
});

describe("corte e empilha", () => {
  it("numeração solta (rifa): de 0501 a 0600 em 4 por folha, sem blocos", () => {
    const p = planejarNumeracao(4, 501, 600);
    expect(p).toMatchObject({ folhas: 25, primeiro: 501, ultimo: 600, blocoDividido: false, espacosVazios: 0 });
    expect([0, 1, 2, 3].map((j) => numeroNaPosicao(p, j, 0))).toEqual([501, 526, 551, 576]);
    expect(numeroNaPosicao(p, 3, 24)).toBe(600);
  });

  it("8 talões de 50 em 4 por folha → 100 folhas, montes em sequência", () => {
    const p = planejarNumeracao(4, 1, 400, 50);
    expect(p).toMatchObject({ folhas: 100, posicoesVazias: 0, espacosVazios: 0, blocoDividido: false, primeiro: 1, ultimo: 400 });
    // folha 1: 1, 101, 201, 301
    expect([0, 1, 2, 3].map((j) => numeroNaPosicao(p, j, 0))).toEqual([1, 101, 201, 301]);
    // última folha: 100, 200, 300, 400
    expect([0, 1, 2, 3].map((j) => numeroNaPosicao(p, j, 99))).toEqual([100, 200, 300, 400]);
  });

  it("cada monte cortado fica em sequência sem buracos nem repetição", () => {
    const B = 10;
    const F = 25;
    const p = planejarNumeracao(4, 1001, 1000 + B * F, F);
    const vistos: number[] = [];
    for (let j = 0; j < 4; j++) {
      const monte: number[] = [];
      for (let s = 0; s < p.folhas; s++) {
        const n = numeroNaPosicao(p, j, s);
        if (n !== null) monte.push(n);
      }
      monte.forEach((n, i) => i && expect(n).toBe(monte[i - 1] + 1));
      vistos.push(...monte);
    }
    expect(vistos.sort((a, b) => a - b)).toEqual(Array.from({ length: B * F }, (_, i) => 1001 + i));
  });

  it("2 talões de 50 em 4 por folha → 25 folhas, as 4 posições usadas (caso do Juliano em 09/11)", () => {
    const p = planejarNumeracao(4, 1, 100, 50);
    expect(p).toMatchObject({ folhas: 25, posicoesVazias: 0, espacosVazios: 0, blocoDividido: true, ultimo: 100 });
    expect([0, 1, 2, 3].map((j) => numeroNaPosicao(p, j, 0))).toEqual([1, 26, 51, 76]);
    expect([0, 1, 2, 3].map((j) => numeroNaPosicao(p, j, 24))).toEqual([25, 50, 75, 100]);
  });

  it("quando não divide certo, sobra só no fim do último monte", () => {
    const p = planejarNumeracao(4, 1, 250, 50); // 250 números ÷ 4 → 63 folhas
    expect(p).toMatchObject({ folhas: 63, posicoesVazias: 0, espacosVazios: 2 });
    expect(numeroNaPosicao(p, 3, 60)).toBe(250);
    expect(numeroNaPosicao(p, 3, 61)).toBeNull();
    expect(numeroNaPosicao(p, 3, 62)).toBeNull();
    // menos números que posições: posições vazias
    expect(planejarNumeracao(9, 1, 5)).toMatchObject({ folhas: 1, posicoesVazias: 4 });
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

describe("padrão da Max: folha 32,8 × 47,8, sangria 3 mm, borda 0,6 mm", () => {
  const mm = (v: number) => (v / 10) * PT_POR_CM;

  it("talão 10×14 (arte 10,6×14,6 com sangria) → 9 por folha (3 × 3), sangrias encostadas", () => {
    const e = encaixarNaFolha(cm(32.8), cm(47.8), cm(10.6), cm(14.6), mm(0.6), 0);
    expect([e.colunas, e.linhas, e.celulas[0].rot]).toEqual([3, 3, 0]);
    // vizinhos encostados (espaço 0)
    const [a, b] = e.celulas;
    expect(b.x - (a.x + a.w)).toBeCloseTo(0, 6);
    // nada a menos de 0,6 mm da beirada
    for (const c of e.celulas) {
      expect(c.x).toBeGreaterThanOrEqual(mm(0.6) - 1e-6);
      expect(c.y).toBeGreaterThanOrEqual(mm(0.6) - 1e-6);
    }
    expect(tamanhoFinal({ w: cm(10.6), h: cm(14.6) }, mm(3)).w).toBeCloseTo(cm(10), 6);
    // 9 × (10 × 14) ÷ (32,8 × 47,8) ≈ 80,4%
    expect(aproveitamento(e, mm(3))).toBeCloseTo((9 * 140) / (32.8 * 47.8), 4);
  });

  it("lê a sangria da TrimBox do PDF", async () => {
    const d = await PDFDocument.create();
    const p = d.addPage([cm(10.6), cm(14.6)]);
    p.setTrimBox(mm(3), mm(3), cm(10), cm(14));
    expect(await sangriaDoPdf(await d.save())).toBe(3);
    expect(await sangriaDoPdf(await arte(10, 14))).toBeNull();
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

  it("arte já montada 2×2 com 2 páginas (1 por via), número em pé", async () => {
    const cfg: ConfigNumeracao = {
      ...base,
      modo: "montado",
      margemMm: 0,
      fim: 40,
      porBloco: 10,
      posicao: { x: 0.05, y: 0.5, girar: true },
    };
    const r = await gerarNumeracao(await arteEmPe(await arte(21, 29.7, 2)), cfg);
    const doc = await PDFDocument.load(r.vias[1]);
    expect(doc.getPageCount()).toBe(10);
    const txt = conteudo(doc.getPage(0));
    expect(txt.split(hex("Nº 0001")).length - 1).toBe(1); // cada número aparece uma vez só
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
  });
});

describe("um número só por talão", () => {
  it("cada número aparece exatamente uma vez na folha e nenhum se repete no arquivo", async () => {
    const r = await gerarNumeracao(await arteEmPe(await arte(10, 14)), { ...base, vias: 1, fim: 400 });
    const doc = await PDFDocument.load(r.vias[0]);
    const vistos = new Map<string, number>();
    for (let i = 0; i < doc.getPageCount(); i++) {
      for (const m of conteudo(doc.getPage(i)).matchAll(/<([0-9A-F]+)> Tj/g)) vistos.set(m[1], (vistos.get(m[1]) ?? 0) + 1);
    }
    expect(vistos.size).toBe(400);
    expect([...vistos.values()].every((n) => n === 1)).toBe(true);
  });
});

describe("cor do número", () => {
  it("preto é o padrão e usa só a tinta preta (K100)", async () => {
    expect(COR_PADRAO).toBe("#000000");
    expect(cmykDaCor("#000000")).toEqual([0, 0, 0, 100]);
    const r = await gerarNumeracao(await arteEmPe(await arte(10, 14)), { ...base, vias: 1, cor: COR_PADRAO });
    const txt = conteudo((await PDFDocument.load(r.vias[0])).getPage(0));
    expect(txt).toContain("0 0 0 1 k");
    expect(txt).not.toContain("0 1 1 0 k");
  });

  it("cores sugeridas têm tinta fixa; qualquer outra cor é convertida de RGB", () => {
    expect(cmykDaCor("#e30613")).toEqual([0, 100, 100, 0]);
    expect(cmykDaCor("#E30613")).toEqual([0, 100, 100, 0]); // maiúsculas
    expect(cmykDaCor("#ffffff")).toEqual([0, 0, 0, 0]);
    expect(cmykDaCor("#ff0000")).toEqual([0, 100, 100, 0]);
    expect(cmykDaCor("#808080")).toEqual([0, 0, 0, 50]);
    expect(cmykDaCor("isso não é cor")).toEqual([0, 0, 0, 100]); // inválida cai no preto
  });

  it("cor escolhida vai para o PDF", async () => {
    const r = await gerarNumeracao(await arteEmPe(await arte(10, 14)), { ...base, vias: 1, cor: "#0066b3" });
    expect(conteudo((await PDFDocument.load(r.vias[0])).getPage(0))).toContain("1 0.6 0 0 k");
  });

  it("valida o formato #RRGGBB", () => {
    expect(corValida("#00FF7f")).toBe("#00ff7f");
    expect(corValida("vermelho")).toBeNull();
    expect(corValida("#fff")).toBeNull();
    expect(corValida(undefined)).toBeNull();
  });
});
