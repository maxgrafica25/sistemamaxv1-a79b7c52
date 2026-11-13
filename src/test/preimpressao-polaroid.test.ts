import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { PT_POR_MM } from "@/lib/preimpressao/folha";
import {
  aplicarFiltro,
  completarFolha,
  conferirPolaroids,
  configPolaroidPadrao,
  gerarPolaroids,
  legendaDoItem,
  legendaDoNomeDeArquivo,
  planejarFolha,
  resumoDeFolhas,
  type ItemPolaroid,
} from "@/lib/preimpressao/polaroid";

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQIW2P8z8Dwn4EIwEiMwv9//xkAIGUEC8WfNLAAAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
const img = { bytes: PNG, tipo: "png" as const, w: 2, h: 2 };
const item = (n: number, qtd = 1, legenda = ""): ItemPolaroid => ({ id: `i${n}`, arquivo: `foto_${n}.jpg`, qtd, legenda });

describe("folha A4", () => {
  it("cabem 4 clássicas, 9 minis e 6 quadradas", () => {
    expect(planejarFolha("classica")).toMatchObject({ cols: 2, linhas: 2, porFolha: 4, girada: false });
    expect(planejarFolha("mini").porFolha).toBe(9);
    expect(planejarFolha("quadrada").porFolha).toBe(6);
  });
  it("resumo de folhas e sobras", () => {
    expect(resumoDeFolhas("classica", 10)).toEqual({ pecas: 10, folhas: 3, porFolha: 4, sobram: 2 });
    expect(resumoDeFolhas("classica", 8).sobram).toBe(0);
  });
  it("completar a folha soma cópias na ordem até fechar a última folha", () => {
    expect(completarFolha([1, 1, 1], 4)).toEqual([1, 0, 0]);
    expect(completarFolha([2, 3], 4)).toEqual([2, 1]);
    expect(completarFolha([2, 2], 4)).toEqual([0, 0]);
    expect(completarFolha([1, 1, 1, 1, 1], 4)).toEqual([1, 1, 1, 0, 0]);
  });
});

describe("legendas e filtros", () => {
  it("legenda própria, padrão ou nome do arquivo", () => {
    expect(legendaDoNomeDeArquivo("Maria_e_Joao-2026.JPG")).toBe("Maria e Joao 2026");
    expect(legendaDoItem(item(1, 1, " Oi "), { legendaPadrao: "x", legendaDoArquivo: true })).toBe("Oi");
    expect(legendaDoItem(item(1), { legendaPadrao: "Verão", legendaDoArquivo: true })).toBe("Verão");
    expect(legendaDoItem(item(1), { legendaPadrao: "", legendaDoArquivo: true })).toBe("foto 1");
    expect(legendaDoItem(item(1), { legendaPadrao: "", legendaDoArquivo: false })).toBe("");
  });
  it("filtros mudam os pixels como esperado", () => {
    const base = () => new Uint8ClampedArray([200, 100, 50, 255]);
    const pb = base();
    aplicarFiltro(pb, "pb");
    expect(pb[0]).toBe(pb[1]);
    expect(pb[1]).toBe(pb[2]);
    const q = base();
    aplicarFiltro(q, "quente");
    expect(q[0]).toBeGreaterThan(200);
    expect(q[2]).toBeLessThan(50);
    const f = base();
    aplicarFiltro(f, "frio");
    expect(f[2]).toBeGreaterThan(50);
    const n = base();
    aplicarFiltro(n, "nenhum");
    expect(Array.from(n)).toEqual([200, 100, 50, 255]);
    expect(base()[3]).toBe(255);
  });
});

describe("PDF das polaroids", () => {
  it("gera uma folha A4 com as peças e, com verso, uma página de verso depois de cada folha", async () => {
    const itens = [item(1, 3), item(2, 3, "Verão 2026")];
    const fotos = new Map(itens.map((i) => [i.id, img]));
    const r = await gerarPolaroids({ cfg: { ...configPolaroidPadrao, enfeite: "fita", data: "15/03/2026" }, itens, fotos });
    expect(r).toMatchObject({ pecas: 6, folhas: 2, paginas: 2 });
    const doc = await PDFDocument.load(r.bytes);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(210 * PT_POR_MM, 1);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(297 * PT_POR_MM, 1);
    const v = await gerarPolaroids({ cfg: { ...configPolaroidPadrao, tamanho: "mini", moldura: "#1a1a1a", enfeite: "coracao", verso: { ativo: true, mensagem: "Obrigado pela visita!", qr: "https://exemplo.com.br" } }, itens, fotos });
    expect(v).toMatchObject({ pecas: 6, folhas: 1, paginas: 2 });
    for (const enfeite of ["estrela", "nenhum"] as const) {
      const x = await gerarPolaroids({ cfg: { ...configPolaroidPadrao, tamanho: "quadrada", enfeite }, itens, fotos: new Map() });
      expect(x.pecas).toBe(6);
    }
  }, 60000);
  it("conferência avisa de sobras, foto pequena e verso vazio", () => {
    const r = conferirPolaroids({ cfg: { ...configPolaroidPadrao, verso: { ativo: true, mensagem: "", qr: "" } }, itens: [{ ...item(1, 3), w: 400, h: 300, zoom: 1 }] });
    const t = r.map((i) => i.texto).join("|");
    expect(t).toContain("Sobram 1");
    expect(t).toContain("pouca resolução");
    expect(t).toContain("sem mensagem nem QR");
    const ok = conferirPolaroids({ cfg: configPolaroidPadrao, itens: [{ ...item(1, 4), w: 3000, h: 3000, zoom: 1 }] });
    expect(ok.at(-1)?.nivel).toBe("ok");
  });
});

describe("caracteres que a fonte não tem", () => {
  it("emoji e letras raras não derrubam o PDF (polaroid e crachá)", async () => {
    const r = await gerarPolaroids({ cfg: { ...configPolaroidPadrao, legendaPadrao: "Verão ❤ 2026 😀 Łukasz", data: "15/03 ★" }, itens: [item(1)], fotos: new Map([["i1", img]]) });
    expect(r.pecas).toBe(1);
    const { gerarCartoes, configCrachaPadrao } = await import("@/lib/preimpressao/cracha");
    const c = await gerarCartoes({ cfg: configCrachaPadrao("pe"), pessoas: [{ id: "p1", nome: "Łukasz 😀 Nowak", cargo: "Líder ★", setor: "Ops", matricula: "1", foto: "", incluir: true }], fotos: new Map(), fundo: null });
    expect(c.ids).toHaveLength(1);
  });
});

describe("papéis maiores, adesivos, filtro por foto e peça única", () => {
  it("cabem mais em folhas maiores", () => {
    expect(planejarFolha("classica", "a3").porFolha).toBeGreaterThan(planejarFolha("classica", "a4").porFolha);
    expect(planejarFolha("classica", "sra3")).toMatchObject({ cols: 3 });
    expect(resumoDeFolhas("mini", 16, "a3").folhas).toBe(1);
    expect(resumoDeFolhas("mini", 20, "a3").folhas).toBe(2);
  });
  it("gera todos os tipos de adesivo, em papel A3, e a peça única", async () => {
    const tipos = ["coracao", "estrela", "brilho", "carinha", "flor", "lua", "fita"] as const;
    const adesivos = tipos.map((tipo, n) => ({ id: `a${n}`, tipo, x: 15 + n * 10, y: 20 + n * 8, tam: 10, cor: "#e11d48", giro: n * 15 }));
    const cfg = { ...configPolaroidPadrao, papel: "a3" as const, adesivos };
    const itens = [item(1, 2)];
    const fotos = new Map([["i1", img]]);
    const r = await gerarPolaroids({ cfg, itens, fotos });
    const doc = await PDFDocument.load(r.bytes);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(297 * PT_POR_MM, 1);
    const { gerarPecaUnica } = await import("@/lib/preimpressao/polaroid");
    const um = await PDFDocument.load(await gerarPecaUnica({ cfg, itens, fotos }, itens[0]));
    expect(um.getPage(0).getWidth()).toBeCloseTo(88 * PT_POR_MM, 1);
    const verso = await PDFDocument.load(await gerarPecaUnica({ cfg: { ...cfg, verso: { ativo: true, mensagem: "Oi", qr: "" } }, itens, fotos }, itens[0], "verso"));
    expect(verso.getPageCount()).toBe(1);
  }, 60000);
  it("filtro por foto vence o geral; melhorar estica o contraste", async () => {
    const { filtroDoItem } = await import("@/lib/preimpressao/polaroid");
    expect(filtroDoItem({ filtro: "pb" }, "vintage")).toBe("pb");
    expect(filtroDoItem({ filtro: "padrao" }, "vintage")).toBe("vintage");
    expect(filtroDoItem({}, "frio")).toBe("frio");
    const d = new Uint8ClampedArray(4 * 100);
    for (let i = 0; i < 100; i++) d.set([100 + i, 100 + i, 100 + i, 255], i * 4);
    aplicarFiltro(d, "melhorar");
    expect(d[0]).toBeLessThan(20);
    expect(d[99 * 4]).toBeGreaterThan(240);
  });
});
