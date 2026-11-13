import { describe, it, expect } from "vitest";
import { FERRAMENTAS, GRUPOS, buscarFerramentas } from "@/components/preimpressao/ferramentas";

describe("menu da Pré-impressão", () => {
  it("cada ferramenta tem uma chave única e está em um grupo", () => {
    const keys = FERRAMENTAS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(GRUPOS.every((g) => g.ferramentas.length > 0)).toBe(true);
    expect(keys).toEqual(expect.arrayContaining(["impressao-fotos", "foto-3x4", "polaroid", "crachas", "montagem", "agenda"]));
  });
  it("a busca acha por nome, sem acento e por palavras do balcão", () => {
    expect(buscarFerramentas("foto 3x4").map((f) => f.key)).toContain("foto-3x4");
    expect(buscarFerramentas("CRACHA").map((f) => f.key)).toEqual(["crachas"]);
    expect(buscarFerramentas("documento rg").map((f) => f.key)).toEqual(["foto-3x4"]);
    expect(buscarFerramentas("foto 15x20").map((f) => f.key)).toContain("impressao-fotos");
    expect(buscarFerramentas("revelação").map((f) => f.key)).toContain("impressao-fotos");
    expect(buscarFerramentas("cartão de visita").map((f) => f.key)).toContain("montagem");
    expect(buscarFerramentas("banner").map((f) => f.key)).toContain("margem-acabamento");
    expect(buscarFerramentas("xyzxyz")).toEqual([]);
    expect(buscarFerramentas("   ")).toEqual([]);
  });
});
