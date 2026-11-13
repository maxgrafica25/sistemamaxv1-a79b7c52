import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { PT_POR_MM } from "@/lib/preimpressao/folha";
import {
  acharFoto,
  ajustarTexto,
  conferirCrachas,
  configCrachaPadrao,
  corDoSetor,
  dimensoes,
  gerarCartaoDeTeste,
  gerarCartoes,
  gerarProva,
  gerarVerso,
  lerTabela,
  ordenarPessoas,
  pessoasDaTabela,
  retanguloDeCorte,
  setoresDaLista,
  LISTA_DE_EXEMPLO,
} from "@/lib/preimpressao/cracha";

// PNG 2×2 vermelho mínimo
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVQIW2P8z8Dwn4EIwEiMwv9//xkAIGUEC8WfNLAAAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
const img = { bytes: PNG, tipo: "png" as const, w: 2, h: 2 };

describe("lista de pessoas", () => {
  it("lê tabulação do Excel com cabeçalho", () => {
    const r = pessoasDaTabela(lerTabela(LISTA_DE_EXEMPLO));
    expect(r.cabecalho).toBe(true);
    expect(r.pessoas).toHaveLength(6);
    expect(r.pessoas[0]).toMatchObject({ nome: "Ana Paula Ribeiro", cargo: "Analista de Marketing", setor: "Comercial", matricula: "1001" });
  });
  it("lê CSV com ponto e vírgula e campo entre aspas", () => {
    const l = lerTabela('Nome;Função;Foto\n"Silva; João";Chefe;joao.jpg\nMaria;"Dona ""M"""');
    expect(l).toEqual([["Nome", "Função", "Foto"], ["Silva; João", "Chefe", "joao.jpg"], ["Maria", 'Dona "M"']]);
    const r = pessoasDaTabela(l);
    expect(r.colunas).toEqual(["nome", "cargo", "foto"]);
    expect(r.pessoas[0].foto).toBe("joao.jpg");
  });
  it("sem cabeçalho usa a ordem nome, cargo, setor, matrícula", () => {
    const r = pessoasDaTabela(lerTabela("Ana\tGerente\tRH\t7\nBia\tDev\tTI\t8"));
    expect(r.cabecalho).toBe(false);
    expect(r.pessoas[1]).toMatchObject({ nome: "Bia", cargo: "Dev", setor: "TI", matricula: "8" });
  });
  it("ordena e acha setores", () => {
    const p = pessoasDaTabela(lerTabela(LISTA_DE_EXEMPLO)).pessoas;
    expect(ordenarPessoas(p, "nome")[0].nome).toBe("Ana Paula Ribeiro");
    expect(ordenarPessoas(p, "setor")[0].setor).toBe("Administrativo");
    expect(setoresDaLista(p).map((s) => s.nome)).toEqual(["Comercial", "Operações", "Criação", "Administrativo"]);
  });
  it("acha a foto pelo nome do arquivo ou pelo nome da pessoa, sem acento", () => {
    const fotos = [{ nome: "joao-pedro almeida.JPG", bytes: PNG, w: 2, h: 2 }, { nome: "x.png", bytes: PNG, w: 2, h: 2 }];
    const p = pessoasDaTabela(lerTabela("Nome\tFoto\nJoão Pedro Almeida\t\nOutro\tx.png")).pessoas;
    expect(acharFoto(p[0], fotos)?.nome).toBe("joao-pedro almeida.JPG");
    expect(acharFoto(p[1], fotos)?.nome).toBe("x.png");
  });
});

describe("recorte da foto", () => {
  it("centraliza e respeita zoom e deslocamento", () => {
    expect(retanguloDeCorte(400, 300, 1)).toEqual({ sx: 50, sy: 0, sw: 300, sh: 300 });
    const z = retanguloDeCorte(400, 300, 1, { zoom: 2, x: 0, y: 0 });
    expect(z).toEqual({ sx: 125, sy: 75, sw: 150, sh: 150 });
    const d = retanguloDeCorte(400, 300, 1, { zoom: 2, x: 1, y: -1 });
    expect(d.sx + d.sw).toBeLessThanOrEqual(400);
    expect(d.sy).toBe(0);
  });
});

describe("ajuste de texto", () => {
  const medir = (s: string, pt: number) => s.length * pt * 0.5;
  it("cabe, reduz, quebra e corta", () => {
    expect(ajustarTexto(medir, "Ana", 12, 100)).toMatchObject({ linhas: ["Ana"], tam: 12, reduzido: false });
    const r = ajustarTexto(medir, "Ana Paula Ribeiro", 12, 90);
    expect(r.reduzido).toBe(true);
    expect(r.linhas).toHaveLength(1);
    const q = ajustarTexto(medir, "Beatriz Fernandes de Albuquerque Nascimento", 12, 90);
    expect(q.linhas.length).toBe(2);
    expect(q.cortado).toBe(false);
    const c = ajustarTexto(medir, "Supercalifragilisticexpialidocious", 12, 30);
    expect(c.cortado).toBe(true);
    expect(c.linhas[0].endsWith("…")).toBe(true);
  });
});

describe("PDF dos crachás", () => {
  const pessoas = pessoasDaTabela(lerTabela(LISTA_DE_EXEMPLO)).pessoas;
  it("gera uma página por pessoa no tamanho exato do CR80, em pé e deitado", async () => {
    for (const o of ["pe", "deitado"] as const) {
      const cfg = { ...configCrachaPadrao(o) };
      cfg.elementos = { ...cfg.elementos, qr: { ...cfg.elementos.qr, ativo: true } };
      const fotos = new Map(pessoas.slice(0, 3).map((p) => [p.id, img]));
      const r = await gerarCartoes({ cfg, pessoas, fotos, fundo: { tipo: "imagem", img } });
      const doc = await PDFDocument.load(r.bytes);
      expect(doc.getPageCount()).toBe(6);
      const { w, h } = dimensoes(o);
      const pg = doc.getPage(0);
      expect(pg.getWidth()).toBeCloseTo(w * PT_POR_MM, 1);
      expect(pg.getHeight()).toBeCloseTo(h * PT_POR_MM, 1);
      expect(r.ids).toHaveLength(6);
    }
  }, 60000);
  it("avisa quando o nome não cabe e gera verso, prova e cartão de teste", async () => {
    const cfg = configCrachaPadrao("pe");
    const r = await gerarCartoes({ cfg, pessoas: [{ ...pessoas[0], nome: "X".repeat(80) }], fotos: new Map(), fundo: null });
    expect(r.avisos.length).toBeGreaterThan(0);
    const verso = await gerarVerso({ orientacao: "pe", corFundo: "#112233", fundo: { tipo: "imagem", img }, copias: 3, girar: true });
    expect((await PDFDocument.load(verso)).getPageCount()).toBe(3);
    const todos = await gerarCartoes({ cfg, pessoas, fotos: new Map(), fundo: null });
    const prova = await gerarProva(todos.bytes, "pe");
    expect((await PDFDocument.load(prova)).getPageCount()).toBe(1);
    const teste = await gerarCartaoDeTeste("deitado", true);
    expect((await PDFDocument.load(teste)).getPageCount()).toBe(2);
  }, 60000);
  it("usa a cor escolhida do setor ou a da paleta", () => {
    const cfg = { ...configCrachaPadrao(), coresSetor: { comercial: "#ff0000" } };
    expect(corDoSetor("Comercial", cfg, ["comercial"])).toBe("#ff0000");
    expect(corDoSetor("Operações", cfg, ["comercial", "operacoes"])).toBe("#dc2626");
  });
});

describe("conferência dos crachás", () => {
  it("avisa de foto faltando, nome em branco, repetido e arte com proporção errada", () => {
    const cfg = configCrachaPadrao("pe");
    const p = pessoasDaTabela(lerTabela("Nome\tSetor\nAna\tRH\nAna\tRH\n\tTI")).pessoas;
    const fotos = new Map([[p[0].id, { w: 100, h: 100, ajuste: { zoom: 1, x: 0, y: 0 } }]]);
    const r = conferirCrachas({ cfg, pessoas: p, fotos, arte: { aspecto: 1.58, px: { w: 500, h: 316 } } });
    const t = r.map((i) => i.texto).join("|");
    expect(t).toContain("sem nome");
    expect(t).toContain("repetido");
    expect(t).toContain("Sem foto");
    expect(t).toContain("pouca resolução");
    expect(t).toContain("outra proporção");
    const ok = conferirCrachas({ cfg: { ...cfg, elementos: { ...cfg.elementos, foto: { ...cfg.elementos.foto, ativo: false } } }, pessoas: [p[0]], fotos });
    expect(ok.at(-1)?.nivel).toBe("ok");
  });
});
