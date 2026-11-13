import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { PT_POR_MM } from "@/lib/preimpressao/folha";
import {
  compararPapeis,
  conferirImpressaoFotos,
  configImpressaoFotosPadrao,
  empacotar,
  encaixarMelhor,
  geometriaDoItem,
  gerarImpressaoFotos,
  medidaDe,
  pecasDoLote,
  type ConfigImpressaoFotos,
  type ItemImpressao,
} from "@/lib/preimpressao/impressaoFotos";

const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQIW2P8z8Dwn4EIwEiMwv9//xkAIGUEC8WfNLAAAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
const img = { bytes: PNG, tipo: "png" as const, w: 2, h: 2 };
const cfg = (p: Partial<ConfigImpressaoFotos> = {}): ConfigImpressaoFotos => ({ ...configImpressaoFotosPadrao, ...p });
const item = (n: number, o: Partial<ItemImpressao> = {}): ItemImpressao => ({ id: `i${n}`, arquivo: `f${n}.jpg`, qtd: 1, legenda: "", medida: "padrao", orient: "padrao", fw: 3000, fh: 4000, ...o });

describe("medidas e orientação", () => {
  it("foto em pé fica em pé, deitada fica deitada; dá para forçar", () => {
    expect(geometriaDoItem(cfg(), item(1))).toMatchObject({ pw: 100, ph: 150, paisagem: false });
    expect(geometriaDoItem(cfg(), item(1, { fw: 4000, fh: 3000 }))).toMatchObject({ pw: 150, ph: 100, paisagem: true });
    expect(geometriaDoItem(cfg(), item(1, { fw: 4000, fh: 3000, orient: "retrato" }))).toMatchObject({ pw: 100, ph: 150 });
    expect(geometriaDoItem(cfg({ orientacao: "paisagem" }), item(1))).toMatchObject({ pw: 150, ph: 100 });
  });
  it("medida de cada foto e medida livre (lado curto sempre w)", () => {
    expect(geometriaDoItem(cfg(), item(1, { medida: "15x20" }))).toMatchObject({ pw: 150, ph: 200 });
    expect(medidaDe("outra", { outraW: 240, outraH: 180 })).toMatchObject({ w: 180, h: 240 });
  });
  it("borda branca diminui a janela da foto", () => {
    expect(geometriaDoItem(cfg({ bordaMm: 5 }), item(1))).toMatchObject({ pw: 100, ph: 150, iw: 90, ih: 140 });
  });
});

describe("encaixe nas folhas", () => {
  it("2 fotos 10×15 em A4 com marcas; 3 já exigem 2 folhas", () => {
    const c = cfg();
    const e2 = encaixarMelhor(c, pecasDoLote(c, [item(1, { qtd: 2 })]));
    expect(e2.folhas).toHaveLength(1);
    const e3 = encaixarMelhor(c, pecasDoLote(c, [item(1, { qtd: 3 })]));
    expect(e3.folhas).toHaveLength(2);
  });
  it("mistura medidas e gira peças para aproveitar", () => {
    const c = cfg({ papel: "a3" });
    const itens = [item(1, { medida: "20x30" }), item(2, { medida: "15x20", qtd: 2 }), item(3, { qtd: 2 })];
    const e = encaixarMelhor(c, pecasDoLote(c, itens));
    expect(e.folhas.length).toBeGreaterThanOrEqual(1);
    expect(e.naoCabem).toHaveLength(0);
    // nada sai da folha nem se sobrepõe
    for (const f of e.folhas) {
      for (const a of f) {
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x + a.w).toBeLessThanOrEqual(297 + 0.01);
        expect(a.y + a.h).toBeLessThanOrEqual(420 + 0.01);
      }
      for (let i = 0; i < f.length; i++)
        for (let j = i + 1; j < f.length; j++) {
          const a = f[i];
          const b = f[j];
          const sobrepoe = a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
          expect(sobrepoe).toBe(false);
        }
    }
  });
  it("o que não cabe na folha vai para naoCabem", () => {
    const e = empacotar([{ itemId: "a", w: 300, h: 400 }], { w: 210, h: 297 }, 5, 4, "curta");
    expect(e.naoCabem).toHaveLength(1);
    expect(e.folhas).toHaveLength(0);
  });
  it("papel fotográfico: uma foto por folha, sem margem, e a foto deitada gira para caber", () => {
    const c = cfg({ papel: "foto10x15" });
    const e = encaixarMelhor(c, pecasDoLote(c, [item(1, { qtd: 2 }), item(2, { fw: 4000, fh: 3000 })]));
    expect(e.folhas).toHaveLength(3);
    expect(e.folhas.flat().some((p) => p.girada)).toBe(true);
    expect(e.aproveitamento).toBeCloseTo(1, 2);
  });
  it("compara papéis e põe os que dão menos folhas primeiro", () => {
    const c = cfg();
    const r = compararPapeis(c, pecasDoLote(c, [item(1, { qtd: 4 })]));
    expect(r[0].folhas).toBeLessThanOrEqual(r[r.length - 1].folhas);
    expect(r.find((x) => x.papel === "a3")?.folhas).toBe(1);
    expect(r.every((x) => x.naoCabem === 0)).toBe(true);
  });
});

describe("PDF e conferência", () => {
  it("gera o PDF no tamanho da folha, com texto nos três estilos e fontes", async () => {
    const itens = [item(1, { qtd: 2, legenda: "Parabéns, Maria ❤ 🎉" }), item(2, { medida: "15x20", fw: 4000, fh: 3000 })];
    const fotos = new Map(itens.map((i) => [i.id, img]));
    for (const estilo of ["sombra", "faixaEscura", "faixaClara"] as const) {
      for (const fonte of ["moderna", "manuscrita", "classica"] as const) {
        const r = await gerarImpressaoFotos({ cfg: cfg({ papel: "a3", ajuste: "inteira", corte: "contorno", texto: { ...configImpressaoFotosPadrao.texto, estilo, fonte, posicao: estilo === "sombra" ? "cima" : "baixo" } }), itens, fotos });
        expect(r.pecas).toBe(3);
        const doc = await PDFDocument.load(r.bytes);
        expect(doc.getPage(0).getWidth()).toBeCloseTo(297 * PT_POR_MM, 1);
      }
    }
  }, 60000);
  it("avisa quando a foto não cabe", async () => {
    const r = await gerarImpressaoFotos({ cfg: cfg({ medida: "20x30", papel: "foto10x15" }), itens: [item(1)], fotos: new Map() });
    expect(r.folhas).toBe(0);
    expect(r.avisos[0]).toContain("não cabem");
  });
  it("conferência: foto pequena, não cabe e medidas misturadas", () => {
    const c = cfg();
    const r = conferirImpressaoFotos({ cfg: c, itens: [{ ...item(1, { fw: 300, fh: 450 }), zoom: 1 }, { ...item(2, { medida: "15x20" }), zoom: 1 }] });
    const t = r.map((x) => x.texto).join("|");
    expect(t).toContain("pequena demais");
    expect(t).toContain("Medidas misturadas");
    const nc = conferirImpressaoFotos({ cfg: cfg({ papel: "a5", medida: "20x30" }), itens: [{ ...item(1), zoom: 1 }] });
    expect(nc.some((x) => x.nivel === "erro" && x.texto.includes("não cabem"))).toBe(true);
    const ok = conferirImpressaoFotos({ cfg: c, itens: [{ ...item(1, { qtd: 2 }), zoom: 1 }] });
    expect(ok.some((x) => x.texto === "Nenhum problema encontrado.")).toBe(true);
  });
});
