import { describe, it, expect } from "vitest";
import { PDFDocument, rgb } from "pdf-lib";
import { PT_POR_CM } from "@/lib/preimpressao/margem";
import { PT_POR_MM } from "@/lib/preimpressao/folha";
import { caixaDeTinta, gerarRedimensionado, planejarCorte, planejarFolga, planejarTamanho } from "@/lib/preimpressao/redimensionar";

const cm = (v: number) => v * PT_POR_CM;

describe("redimensionar para um tamanho", () => {
  it("A4 → A5, caber: escala 70,5%, A5 em pé, sem corte", () => {
    const p = planejarTamanho(cm(21), cm(29.7), cm(14.8), cm(21), "caber");
    expect(p.saidaW).toBeCloseTo(cm(14.8), 3);
    expect(p.saidaH).toBeCloseTo(cm(21), 3);
    expect(p.escala).toBeCloseTo(14.8 / 21, 4);
    expect(p.cortadoW + p.cortadoH).toBeCloseTo(0, 3);
    // sobra branca só dos lados da altura (21 × 0,705 = 14,8: a largura é que manda)
    expect(p.destX).toBeCloseTo(0, 3);
    expect(p.destY).toBeGreaterThan(0);
  });

  it("A4 deitado → A5: a página nova também fica deitada (21 × 14,8)", () => {
    const p = planejarTamanho(cm(29.7), cm(21), cm(14.8), cm(21), "caber");
    expect(p.saidaW).toBeCloseTo(cm(21), 3);
    expect(p.saidaH).toBeCloseTo(cm(14.8), 3);
  });

  it("medida livre (sem seguir a orientação): vale largura × altura como pedido, mesmo numa página em pé", () => {
    const p = planejarTamanho(cm(21), cm(29.7), cm(21), cm(10), "caber", false);
    expect(p.saidaW).toBeCloseTo(cm(21), 3);
    expect(p.saidaH).toBeCloseTo(cm(10), 3);
  });

  it("preencher: cobre a página toda e corta o excesso, centralizado", () => {
    const p = planejarTamanho(cm(21), cm(29.7), cm(14.8), cm(21), "preencher");
    expect(p.escala).toBeCloseTo(cm(21) / cm(29.7), 4);
    expect(p.destX).toBeCloseTo(0, 3);
    expect(p.destY).toBeCloseTo(0, 3);
    expect(p.cortadoH).toBeCloseTo(0, 3);
    expect(p.cortadoW).toBeGreaterThan(0);
    expect(p.janela.x).toBeCloseTo(p.cortadoW / 2, 3);
  });

  it("tamanho real: mantém 100%, centraliza; arte maior é cortada, menor ganha margem", () => {
    const grande = planejarTamanho(cm(21), cm(29.7), cm(14.8), cm(21), "real");
    expect(grande.escala).toBe(1);
    expect(grande.cortadoW).toBeCloseTo(cm(21 - 14.8), 3);
    const pequena = planejarTamanho(cm(10.5), cm(14.8), cm(14.8), cm(21), "real");
    expect(pequena.cortadoW + pequena.cortadoH).toBe(0);
    expect(pequena.destX).toBeCloseTo((cm(14.8) - cm(10.5)) / 2, 3);
  });
});

describe("cortar margens e folga", () => {
  it("corta 5 mm de cada lado", () => {
    const l = 5 * PT_POR_MM;
    const p = planejarCorte(cm(21), cm(29.7), { cima: l, baixo: l, esq: l, dir: l })!;
    expect(p.saidaW).toBeCloseTo(cm(21) - 2 * l, 3);
    expect(p.saidaH).toBeCloseTo(cm(29.7) - 2 * l, 3);
    expect(p.janela.x).toBeCloseTo(l, 3);
    expect(p.escala).toBe(1);
  });

  it("corte maior que a página não existe (null)", () => {
    expect(planejarCorte(100, 100, { cima: 60, baixo: 60, esq: 0, dir: 0 })).toBeNull();
    expect(planejarCorte(100, 100, { cima: -1, baixo: 0, esq: 0, dir: 0 })).toBeNull();
  });

  it("caixa de tinta: acha o retângulo preto e ignora o branco; página em branco = null", () => {
    const w = 100;
    const h = 50;
    const px = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let y = 10; y < 30; y++) for (let x = 20; x < 60; x++) px.set([0, 0, 0, 255], (y * w + x) * 4);
    const c = caixaDeTinta(px, w, h)!;
    expect(c).toEqual({ x0: 0.2, y0: 0.2, x1: 0.6, y1: 0.6 });
    expect(caixaDeTinta(new Uint8ClampedArray(w * h * 4).fill(255), w, h)).toBeNull();
  });

  it("folga: corta até o conteúdo e deixa 3 mm", () => {
    const w = cm(10);
    const h = cm(10);
    const f = 3 * PT_POR_MM;
    const p = planejarFolga(w, h, { x0: 0.2, y0: 0.3, x1: 0.8, y1: 0.7 }, 3)!;
    expect(p.janela.x).toBeCloseTo(0.2 * w - f, 3);
    expect(p.saidaW).toBeCloseTo(0.6 * w + 2 * f, 3);
    expect(p.saidaH).toBeCloseTo(0.4 * h + 2 * f, 3);
    // folga maior que a margem existente: não passa da borda
    const q = planejarFolga(w, h, { x0: 0.01, y0: 0.01, x1: 0.99, y1: 0.99 }, 10)!;
    expect(q.saidaW).toBeCloseTo(w, 3);
    // página em branco continua do mesmo tamanho
    const b = planejarFolga(w, h, null, 3)!;
    expect(b.saidaW).toBeCloseTo(w, 3);
  });
});

describe("gerar o PDF novo", () => {
  async function original(paginas: [number, number][], vazia?: number): Promise<Uint8Array> {
    const d = await PDFDocument.create();
    paginas.forEach(([w, h], i) => {
      const p = d.addPage([cm(w), cm(h)]);
      if (i !== vazia) p.drawRectangle({ x: 0, y: 0, width: 30, height: 30, color: rgb(1, 0, 0) });
    });
    return d.save();
  }

  it("cada página sai no tamanho do plano; páginas de tamanhos diferentes e uma página vazia funcionam", async () => {
    const bytes = await original([[21, 29.7], [29.7, 21], [21, 29.7]], 2);
    const planos = [
      planejarTamanho(cm(21), cm(29.7), cm(14.8), cm(21), "caber"),
      planejarTamanho(cm(29.7), cm(21), cm(14.8), cm(21), "caber"),
      planejarTamanho(cm(21), cm(29.7), cm(14.8), cm(21), "preencher"),
    ];
    const r = await PDFDocument.load(await gerarRedimensionado(bytes, planos));
    expect(r.getPageCount()).toBe(3);
    expect(r.getPage(0).getWidth()).toBeCloseTo(cm(14.8), 2);
    expect(r.getPage(1).getWidth()).toBeCloseTo(cm(21), 2);
    expect(r.getPage(1).getHeight()).toBeCloseTo(cm(14.8), 2);
    expect(r.getPage(2).getHeight()).toBeCloseTo(cm(21), 2);
  });

  it("plano ausente (null) mantém a página como está", async () => {
    const bytes = await original([[21, 29.7]]);
    const r = await PDFDocument.load(await gerarRedimensionado(bytes, [null]));
    expect(r.getPage(0).getWidth()).toBeCloseTo(cm(21), 2);
  });
});
