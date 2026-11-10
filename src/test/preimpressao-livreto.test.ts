import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { PT_POR_CM } from "@/lib/preimpressao/margem";
import { arteEmPe } from "@/lib/preimpressao/folha";
import { gerarLivreto, ordemLivreto, paginasDoLivreto, type ConfigLivreto } from "@/lib/preimpressao/livreto";

const cm = (v: number) => v * PT_POR_CM;

async function pdf(paginas: number, wCm = 14.8, hCm = 21): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= paginas; i++) d.addPage([cm(wCm), cm(hCm)]).drawText(`P${i}`, { x: 40, y: 40, size: 30, font: f });
  return arteEmPe(await d.save());
}

const auto: ConfigLivreto = { folhaW: null, folhaH: null, sangriaMm: 0, marcas: false, ajustar: false };

describe("ordem das páginas", () => {
  it("8 páginas: 8|1, 2|7, 6|3, 4|5", () => {
    expect(ordemLivreto(8).map((l) => [l.esquerda, l.direita])).toEqual([
      [8, 1],
      [2, 7],
      [6, 3],
      [4, 5],
    ]);
  });

  it("completa até múltiplo de 4 com páginas em branco no fim", () => {
    expect(paginasDoLivreto(6)).toBe(8);
    expect(paginasDoLivreto(1)).toBe(4);
    expect(ordemLivreto(6).map((l) => [l.esquerda, l.direita])).toEqual([
      [null, 1],
      [2, null],
      [6, 3],
      [4, 5],
    ]);
  });

  it("cada folha dobrada fica na ordem de leitura e cada página aparece uma vez", () => {
    for (const n of [4, 12, 20, 36]) {
      const l = ordemLivreto(n);
      const todas = l.flatMap((x) => [x.esquerda, x.direita]).sort((a, b) => a! - b!);
      expect(todas).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      // frente e verso da mesma folha: direita da frente + 1 = esquerda do verso
      for (let i = 0; i < l.length; i += 2) {
        expect(l[i + 1].esquerda).toBe(l[i].direita! + 1);
        expect(l[i].esquerda).toBe(l[i + 1].direita! + 1);
      }
    }
  });
});

describe("PDF do livreto", () => {
  it("8 páginas A5 → 2 folhas (4 lados) do tamanho de um A4 deitado", async () => {
    const r = await gerarLivreto(await pdf(8), auto);
    expect(r.folhas).toBe(2);
    expect(r.emBranco).toBe(0);
    const doc = await PDFDocument.load(r.bytes);
    expect(doc.getPageCount()).toBe(4);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(cm(29.6), 3);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(cm(21), 3);
  });

  it("com sangria de 3 mm o tamanho fechado desconta a sangria e a dobra não tem sangria", async () => {
    const r = await gerarLivreto(await pdf(4, 15.4, 21.6), { ...auto, sangriaMm: 3 });
    expect(r.fechado.w).toBeCloseTo(cm(14.8), 3);
    expect(r.fechado.h).toBeCloseTo(cm(21), 3);
    // aberto = 2 × 14,8 + 2 × 0,3 de sangria de fora
    expect(r.folha.w).toBeCloseTo(cm(30.2), 3);
  });

  it("folha escolhida: deita a folha, centraliza; se não couber avisa ou ajusta", async () => {
    const sra3 = { folhaW: cm(32), folhaH: cm(45) };
    const ok = await gerarLivreto(await pdf(4), { ...auto, ...sra3, marcas: true });
    expect(ok.folha.w).toBeCloseTo(cm(45), 3); // deitada
    expect(ok.escala).toBe(1);
    const a4 = { folhaW: cm(21), folhaH: cm(29.7) };
    await expect(gerarLivreto(await pdf(4, 21, 29.7), { ...auto, ...a4 })).rejects.toThrow("não cabe");
    const aj = await gerarLivreto(await pdf(4, 21, 29.7), { ...auto, ...a4, ajustar: true });
    expect(aj.escala).toBeCloseTo(29.7 / 42, 3);
  });
});
