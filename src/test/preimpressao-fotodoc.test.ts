import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { PT_POR_MM } from "@/lib/preimpressao/folha";
import { conferirFotosDoc, configFotoDocPadrao, gerarFotosDoc, medidaDaFoto, planejarGrade, resumoFoto } from "@/lib/preimpressao/fotoDoc";

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQIW2P8z8Dwn4EIwEiMwv9//xkAIGUEC8WfNLAAAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
const img = { bytes: PNG, tipo: "png" as const, w: 2, h: 2 };

describe("grade das fotos 3×4", () => {
  it("cabem 45 em A4 deitada (9 × 5), com margem de 5 mm; em pé seriam só 30", () => {
    const g = planejarGrade(configFotoDocPadrao);
    expect(g).toMatchObject({ cols: 9, linhas: 5, capacidade: 45, porFolha: 45, deitada: true, paginaW: 297 });
    expect(g.x0).toBeCloseTo(13.5, 1);
  });
  it("em papel fotográfico 10×15 fica em pé (3 × 3 = 9)", () => {
    const g = planejarGrade({ ...configFotoDocPadrao, papel: "10x15" });
    expect(g).toMatchObject({ deitada: false, capacidade: 9, paginaW: 100 });
  });
  it("espaço entre as fotos reduz o que cabe; porFolha limita e centraliza o bloco", () => {
    expect(planejarGrade({ ...configFotoDocPadrao, espaco: 3 }).capacidade).toBeLessThan(45);
    const g = planejarGrade({ ...configFotoDocPadrao, porFolha: 6 });
    expect(g).toMatchObject({ porFolha: 6, colsUsadas: 6, linhasUsadas: 1 });
    expect(g.y0).toBeCloseTo((210 - 40) / 2, 1);
    expect(planejarGrade({ ...configFotoDocPadrao, porFolha: 500 }).porFolha).toBe(45);
  });
  it("medida livre e 5 × 7", () => {
    expect(medidaDaFoto({ tamanho: "5x7", larguraMm: 1, alturaMm: 1 })).toMatchObject({ w: 50, h: 70 });
    expect(medidaDaFoto({ tamanho: "livre", larguraMm: 35, alturaMm: 45 })).toEqual({ w: 35, h: 45 });
    expect(medidaDaFoto({ tamanho: "livre", larguraMm: 2, alturaMm: 999 })).toEqual({ w: 15, h: 200 });
    expect(resumoFoto(configFotoDocPadrao, 50)).toEqual({ pecas: 50, folhas: 2, porFolha: 45, sobram: 40 });
  });
});

describe("PDF das fotos 3×4", () => {
  it("gera folhas no tamanho do papel, com cada linha de corte", async () => {
    const itens = [{ id: "a", arquivo: "ana.jpg", qtd: 6 }, { id: "b", arquivo: "bia.jpg", qtd: 40 }];
    const fotos = new Map([["a", img]]);
    for (const marcas of ["cantos", "contorno", "nenhuma"] as const) {
      const r = await gerarFotosDoc({ cfg: { ...configFotoDocPadrao, marcas }, itens, fotos });
      expect(r).toMatchObject({ pecas: 46, folhas: 2 });
      const doc = await PDFDocument.load(r.bytes);
      expect(doc.getPageCount()).toBe(2);
      expect(doc.getPage(0).getWidth()).toBeCloseTo(297 * PT_POR_MM, 1);
    }
    const f = await gerarFotosDoc({ cfg: { ...configFotoDocPadrao, papel: "10x15" }, itens: [{ id: "a", arquivo: "ana.jpg", qtd: 3 }], fotos });
    expect((await PDFDocument.load(f.bytes)).getPage(0).getWidth()).toBeCloseTo(100 * PT_POR_MM, 1);
  }, 60000);
  it("avisa quando a foto não cabe na folha", async () => {
    const r = await gerarFotosDoc({ cfg: { ...configFotoDocPadrao, papel: "10x15", tamanho: "livre", larguraMm: 150, alturaMm: 200 }, itens: [{ id: "a", arquivo: "a.jpg", qtd: 1 }], fotos: new Map() });
    expect(r.folhas).toBe(0);
    expect(r.avisos[0]).toContain("não cabe");
  });
  it("conferência: sobras, resolução e aviso do tamanho real", () => {
    const c = conferirFotosDoc({ cfg: configFotoDocPadrao, itens: [{ id: "a", arquivo: "a.jpg", qtd: 5, w: 120, h: 160, zoom: 1 }] });
    const t = c.map((i) => i.texto).join("|");
    expect(t).toContain("Sobram 40");
    expect(t).toContain("pouca resolução");
    expect(t).toContain("tamanho real");
  });
});
