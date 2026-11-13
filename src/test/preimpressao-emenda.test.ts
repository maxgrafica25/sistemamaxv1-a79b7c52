import { describe, it, expect } from "vitest";
import { PDFDocument, rgb } from "pdf-lib";
import { PT_POR_CM } from "@/lib/preimpressao/margem";
import { compararRolos, conferirEmenda, gerarEmenda, melhorCorte, planejarEmenda, tamanhoFinal, type ArteEmenda } from "@/lib/preimpressao/emenda";

const cm = (pt: number) => pt / PT_POR_CM;

describe("plano de corte", () => {
  it("rolo de 107 cm com 3 cm de borda imprime 104 cm; 250 × 150 cm em colunas = 3 partes de 84,7 cm", () => {
    const p = planejarEmenda({ w: 250, h: 150 }, 107, 3, 2, "colunas")!;
    expect(p.imprimivel).toBe(104);
    expect(p.partes).toBe(3);
    expect(p.emendas).toBe(2);
    expect(p.larguraParte).toBeCloseTo(84.667, 2);
    expect(p.comprimentoParte).toBe(150);
    // as partes cobrem a arte toda e cada uma sobrepõe 2 cm na vizinha
    expect(p.faixas[0].inicio).toBe(0);
    expect(p.faixas[2].fim).toBeCloseTo(250, 6);
    expect(p.faixas[0].fim - p.faixas[1].inicio).toBeCloseTo(2, 6);
    expect(p.faixas[1].fim - p.faixas[2].inicio).toBeCloseTo(2, 6);
    expect(p.faixas.every((f) => f.fim - f.inicio <= 104 + 1e-6)).toBe(true);
    expect(p.metrosLineares).toBeCloseTo(4.5, 6);
    expect(p.consumidoM2).toBeCloseTo(4.815, 3);
  });

  it("cabe inteira: 1 parte, sem emenda; no limite exato também", () => {
    expect(planejarEmenda({ w: 100, h: 300 }, 107, 3, 2, "colunas")).toMatchObject({ partes: 1, emendas: 0, larguraParte: 100 });
    expect(planejarEmenda({ w: 104, h: 300 }, 107, 3, 2, "colunas")?.partes).toBe(1);
    expect(planejarEmenda({ w: 104.5, h: 300 }, 107, 3, 2, "colunas")?.partes).toBe(2);
  });

  it("sobreposição que não cabe na área de impressão = sem plano", () => {
    expect(planejarEmenda({ w: 300, h: 100 }, 5, 3, 2, "colunas")).toBeNull();
  });

  it("escolhe o corte (colunas ou linhas) que gasta menos rolo", () => {
    // 100 × 400: cortar pela largura cabe em 1 parte de 400 cm; pela altura seriam 4 partes
    const c = melhorCorte({ w: 100, h: 400 }, 107, 3, 2)!;
    expect(c.corte).toBe("colunas");
    expect(c.partes).toBe(1);
    // 400 × 100: a altura (100) cabe no rolo → corta em linhas = 1 parte com a arte girada
    const l = melhorCorte({ w: 400, h: 100 }, 107, 3, 2)!;
    expect(l.corte).toBe("linhas");
    expect(l.partes).toBe(1);
    expect(l.comprimentoParte).toBe(400);
  });

  it("compara os rolos: 250 × 150 rende mais no de 137 cm (2 partes); ordena por rolo gasto", () => {
    const r = compararRolos({ w: 250, h: 150 }, [105, 107, 126, 137, 152], 3, 2);
    expect(r[0].rolo).toBe(137);
    expect(r[0].partes).toBe(2);
    expect(r[0].consumidoM2).toBeCloseTo(4.11, 2);
    for (let i = 1; i < r.length; i++) expect(r[i].consumidoM2).toBeGreaterThanOrEqual(r[i - 1].consumidoM2 - 1e-9);
    expect(compararRolos({ w: 250, h: 150 }, [137, 137, -5, NaN], 3, 2)).toHaveLength(1);
  });

  it("empate de rolo gasto: menos emendas, depois rolo mais estreito", () => {
    const r = compararRolos({ w: 100, h: 100 }, [120, 110], 3, 2);
    expect(r[0].rolo).toBe(110);
  });

  it("avisa de parte acima de 508 cm; a escala muda o tamanho final", () => {
    expect(planejarEmenda({ w: 100, h: 600 }, 107, 3, 2, "colunas")?.passaLimiteAcrobat).toBe(true);
    expect(tamanhoFinal({ wCm: 25, hCm: 15 }, 1000)).toEqual({ w: 250, h: 150 });
  });
});

async function pdfArte(wCm: number, hCm: number): Promise<ArteEmenda> {
  const doc = await PDFDocument.create();
  const p = doc.addPage([wCm * PT_POR_CM, hCm * PT_POR_CM]);
  p.drawRectangle({ x: 0, y: 0, width: wCm * PT_POR_CM, height: hCm * PT_POR_CM, color: rgb(0.9, 0.9, 0.5) });
  p.drawText("ARTE", { x: 20, y: 20, size: 40 });
  return { tipo: "pdf", bytes: await doc.save(), wCm, hCm };
}

describe("PDF das partes", () => {
  it("colunas: uma página por parte, do tamanho da parte (largura × comprimento)", async () => {
    const arte = await pdfArte(250, 150);
    const plano = planejarEmenda({ w: 250, h: 150 }, 107, 3, 2, "colunas")!;
    const r = await gerarEmenda(arte, plano, { escalaPct: 100, sobreposicaoCm: 2, guias: true });
    expect(r.paginas).toBe(3);
    const doc = await PDFDocument.load(r.bytes);
    expect(doc.getPageCount()).toBe(3);
    expect(cm(doc.getPage(0).getWidth())).toBeCloseTo(84.667, 2);
    expect(cm(doc.getPage(0).getHeight())).toBeCloseTo(150, 3);
    const so = await gerarEmenda(arte, plano, { escalaPct: 100, sobreposicaoCm: 2, guias: true }, [1]);
    expect(so.paginas).toBe(1);
    expect((await PDFDocument.load(so.bytes)).getPageCount()).toBe(1);
  }, 60000);

  it("linhas: a página tem a altura da faixa como largura e a largura da arte como comprimento", async () => {
    const arte = await pdfArte(300, 200);
    const plano = planejarEmenda({ w: 300, h: 200 }, 107, 3, 2, "linhas")!;
    expect(plano.partes).toBe(2);
    const r = await gerarEmenda(arte, plano, { escalaPct: 100, sobreposicaoCm: 2, guias: false });
    const doc = await PDFDocument.load(r.bytes);
    expect(cm(doc.getPage(0).getWidth())).toBeCloseTo(101, 3);
    expect(cm(doc.getPage(0).getHeight())).toBeCloseTo(300, 3);
  }, 60000);

  it("imagem PNG/JPG e escala 1:10", async () => {
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQIW2P8z8Dwn4EIwEiMwv9//xkAIGUEC8WfNLAAAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
    const arte: ArteEmenda = { tipo: "imagem", imagem: "png", bytes: png, wCm: 25, hCm: 15 };
    const art = tamanhoFinal(arte, 1000);
    const plano = melhorCorte(art, 137, 3, 2)!;
    const r = await gerarEmenda(arte, plano, { escalaPct: 1000, sobreposicaoCm: 2, guias: true });
    expect(r.paginas).toBe(2);
  }, 60000);

  it("conferência: rolo que não serve, sem emenda, com emendas e parte grande", () => {
    expect(conferirEmenda({ w: 100, h: 100 }, null, { escalaPct: 100, sobreposicaoCm: 2, margemRolo: 3 })[0].nivel).toBe("erro");
    const sem = conferirEmenda({ w: 100, h: 200 }, planejarEmenda({ w: 100, h: 200 }, 107, 3, 2, "colunas"), { escalaPct: 100, sobreposicaoCm: 2, margemRolo: 3 });
    expect(sem.map((i) => i.texto).join("|")).toContain("não precisa de emenda");
    const com = conferirEmenda({ w: 250, h: 600 }, planejarEmenda({ w: 250, h: 600 }, 107, 3, 2, "colunas"), { escalaPct: 100, sobreposicaoCm: 2, margemRolo: 3 });
    const t = com.map((i) => i.texto).join("|");
    expect(t).toContain("3 partes");
    expect(t).toContain("508");
  });
});

describe("direção forçada e arte exportada em escala", () => {
  it("vertical forçada corta em colunas mesmo quando linhas gastaria menos", () => {
    const livre = melhorCorte({ w: 400, h: 100 }, 107, 3, 2);
    const vert = melhorCorte({ w: 400, h: 100 }, 107, 3, 2, "colunas");
    expect(livre?.corte).toBe("linhas");
    expect(vert?.corte).toBe("colunas");
    expect(compararRolos({ w: 400, h: 100 }, [107, 137], 3, 2, "colunas").every((p) => p.corte === "colunas")).toBe(true);
  });
  it("arte exportada a 50% (125×75) sai no tamanho final 250×150", () => {
    const f = tamanhoFinal({ wCm: 125, hCm: 75 }, 200);
    expect(f.w).toBeCloseTo(250, 5);
    expect(f.h).toBeCloseTo(150, 5);
  });
});
