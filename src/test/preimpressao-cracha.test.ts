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

import { MAX_EXTRAS, novoCampoExtra } from "@/lib/preimpressao/cracha";
import { conferirProntas, gerarProntas, listarCartoes, orientacaoSugerida, type ArtePronta } from "@/lib/preimpressao/crachaPronta";

describe("campos extras do modelo (tipo sanguíneo, ASO, admissão…)", () => {
  it("a coluna da lista com o nome do campo preenche o campo, com ou sem acento", () => {
    const extra = novoCampoExtra("Tipo sanguíneo", 0, "pe");
    const asso = novoCampoExtra("ASO", 1, "pe");
    const r = pessoasDaTabela(lerTabela("Nome\tTipo sanguineo\tASO\tCargo\nAna\tO+\t12/03/2027\tGerente\nBia\tA-\t\tDev"), [extra, asso]);
    expect(r.cabecalho).toBe(true);
    expect(r.pessoas[0].extras).toEqual({ [extra.id]: "O+", [asso.id]: "12/03/2027" });
    expect(r.pessoas[1].extras?.[extra.id]).toBe("A-");
    expect(r.pessoas[0].cargo).toBe("Gerente");
    expect(MAX_EXTRAS).toBeGreaterThan(3);
  });
  it("o PDF desenha os extras e avisa quando o texto é grande demais", async () => {
    const extra = novoCampoExtra("Admissão", 0, "pe");
    const cfg = { ...configCrachaPadrao("pe"), extras: [extra, { ...novoCampoExtra("Observação", 1, "pe"), mostrarRotulo: false }] };
    const pessoa = { id: "p1", nome: "Ana", cargo: "Dev", setor: "TI", matricula: "1", foto: "", incluir: true, extras: { [extra.id]: "12/03/2027", [cfg.extras[1].id]: "X".repeat(120) } };
    const r = await gerarCartoes({ cfg, pessoas: [pessoa], fotos: new Map(), fundo: null });
    expect(r.ids).toHaveLength(1);
    expect(r.avisos.length).toBeGreaterThan(0);
  }, 60000);
});

describe("arte pronta (do cliente, Canva ou Corel)", () => {
  const art = (n: string, o: Partial<ArtePronta> = {}): ArtePronta => ({ id: n, nome: n, tipo: "imagem", img, paginas: 1, aspecto: 54 / 85.6, px: { w: 638, h: 1011 }, copias: 1, ...o });
  it("sugere a posição do cartão pela proporção da arte", () => {
    expect(orientacaoSugerida(1.58)).toBe("deitado");
    expect(orientacaoSugerida(0.63)).toBe("pe");
  });
  it("lista os cartões: um por arquivo/página, ou frente e verso alternados", () => {
    expect(listarCartoes([art("a"), art("b", { paginas: 3 })], "nenhum").cartoes).toHaveLength(4);
    const alt = listarCartoes([art("c", { paginas: 4 }), art("d", { paginas: 3 })], "alternado");
    expect(alt.cartoes).toHaveLength(3);
    expect(alt.cartoes[0].verso).toEqual({ arte: 0, pagina: 1 });
    expect(alt.avisos[0]).toContain("par");
  });
  it("gera frente e verso com as cópias, nos dois sentidos", async () => {
    for (const orientacao of ["pe", "deitado"] as const) {
      const r = await gerarProntas({ orientacao, encaixe: "preencher", corFundo: "#ffffff", artes: [art("a", { copias: 3 }), art("b", { copias: 2 })], modoVerso: "igual", versoArte: art("v"), girarVerso: true });
      expect(r).toMatchObject({ cartoes: 2, paginas: 5 });
      const f = await PDFDocument.load(r.frente);
      expect(f.getPageCount()).toBe(5);
      const { w, h } = dimensoes(orientacao);
      expect(f.getPage(0).getWidth()).toBeCloseTo(w * PT_POR_MM, 1);
      expect(f.getPage(0).getHeight()).toBeCloseTo(h * PT_POR_MM, 1);
      expect((await PDFDocument.load(r.verso as Uint8Array)).getPageCount()).toBe(5);
    }
    const so = await gerarProntas({ orientacao: "pe", encaixe: "inteira", corFundo: "#000000", artes: [art("a")], modoVerso: "nenhum", versoArte: null, girarVerso: false });
    expect(so.verso).toBeNull();
  }, 60000);
  it("aceita PDF de várias páginas (um cartão por página)", async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 3; i++) doc.addPage([153, 243]).drawText(`Cartão ${i + 1}`, { x: 20, y: 120, size: 14 });
    const bytes = await doc.save();
    const a: ArtePronta = { id: "p", nome: "arte.pdf", tipo: "pdf", bytes, paginas: 3, aspecto: 153 / 243, copias: 2 };
    const r = await gerarProntas({ orientacao: "pe", encaixe: "preencher", corFundo: "#ffffff", artes: [a], modoVerso: "nenhum", versoArte: null, girarVerso: false });
    expect(r).toMatchObject({ cartoes: 3, paginas: 6 });
  }, 60000);
  it("conferência: proporção, posição contrária, arte pequena e verso sem arte", () => {
    const base = { orientacao: "pe" as const, encaixe: "preencher" as const, modoVerso: "nenhum" as const, versoArte: null };
    expect(conferirProntas({ ...base, artes: [] })[0].nivel).toBe("erro");
    const t = (x: ReturnType<typeof conferirProntas>) => x.map((i) => i.texto).join("|");
    expect(t(conferirProntas({ ...base, artes: [art("deitada", { aspecto: 1.58 })] }))).toContain("Troque a posição");
    expect(t(conferirProntas({ ...base, artes: [art("quadrada", { aspecto: 1 })] }))).toContain("vai cortar");
    expect(t(conferirProntas({ ...base, artes: [art("pequena", { px: { w: 300, h: 480 } })] }))).toContain("pequena");
    expect(t(conferirProntas({ ...base, modoVerso: "igual", artes: [art("a")] }))).toContain("verso");
    expect(conferirProntas({ ...base, artes: [art("ok")] }).at(-1)?.texto).toBe("Nenhum problema encontrado.");
  });
});
