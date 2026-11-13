import { describe, it, expect } from "vitest";
import { FAVORITAS_PADRAO, FERRAMENTAS, GRUPOS, alternarFavorito, buscarFerramentas, favoritasPrimeiro, ferramentasFavoritas, normalizarFavoritos } from "@/components/preimpressao/ferramentas";

describe("menu da Pré-impressão", () => {
  it("cada ferramenta tem uma chave única e está em um grupo", () => {
    const keys = FERRAMENTAS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(GRUPOS.every((g) => g.ferramentas.length > 0)).toBe(true);
    expect(keys).toEqual(expect.arrayContaining(["impressao-fotos", "foto-3x4", "polaroid", "crachas", "montagem", "agenda", "emenda"]));
  });
  it("a busca acha por nome, sem acento e por palavras do balcão", () => {
    expect(buscarFerramentas("foto 3x4").map((f) => f.key)).toContain("foto-3x4");
    expect(buscarFerramentas("CRACHA").map((f) => f.key)).toEqual(["crachas"]);
    expect(buscarFerramentas("documento rg").map((f) => f.key)).toEqual(["foto-3x4"]);
    expect(buscarFerramentas("foto 15x20").map((f) => f.key)).toContain("impressao-fotos");
    expect(buscarFerramentas("revelação").map((f) => f.key)).toContain("impressao-fotos");
    expect(buscarFerramentas("cartão de visita").map((f) => f.key)).toContain("montagem");
    expect(buscarFerramentas("banner").map((f) => f.key)).toContain("margem-acabamento");
    expect(buscarFerramentas("emendar adesivo").map((f) => f.key)).toContain("emenda");
    expect(buscarFerramentas("xyzxyz")).toEqual([]);
    expect(buscarFerramentas("   ")).toEqual([]);
  });
});

describe("favoritas por usuário", () => {
  it("quem nunca escolheu começa com a Organizar PDF em primeiro", () => {
    expect(FAVORITAS_PADRAO).toEqual(["organizar"]);
    expect(ferramentasFavoritas(FAVORITAS_PADRAO)[0].nome).toBe("Organizar PDF");
  });
  it("liga e desliga; a nova vai para o fim", () => {
    expect(alternarFavorito(["organizar"], "crachas")).toEqual(["organizar", "crachas"]);
    expect(alternarFavorito(["organizar", "crachas"], "organizar")).toEqual(["crachas"]);
    expect(alternarFavorito([], "polaroid")).toEqual(["polaroid"]);
  });
  it("lê a lista da conta ignorando o que não existe mais e o que está repetido; outro tipo = null", () => {
    expect(normalizarFavoritos(["crachas", "naoexiste", "crachas", 3, "organizar"])).toEqual(["crachas", "organizar"]);
    expect(normalizarFavoritos([])).toEqual([]);
    expect(normalizarFavoritos(undefined)).toBeNull();
    expect(normalizarFavoritos("organizar")).toBeNull();
  });
  it("na busca as favoritas vêm primeiro, na ordem em que foram escolhidas", () => {
    const achadas = buscarFerramentas("foto");
    expect(achadas.length).toBeGreaterThan(2);
    const ordem = favoritasPrimeiro(achadas, ["crachas", "polaroid", "foto-3x4"]).map((f) => f.key);
    expect(ordem.indexOf("polaroid")).toBeLessThan(ordem.indexOf("foto-3x4"));
    const fav = favoritasPrimeiro(achadas, ["foto-3x4"]);
    expect(fav[0].key).toBe("foto-3x4");
  });
});
