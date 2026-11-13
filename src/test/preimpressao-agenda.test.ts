import { describe, it, expect } from "vitest";
import { deflateSync } from "node:zlib";
import { PDFDocument, rgb } from "pdf-lib";
import { chunkPng } from "@/lib/preimpressao/margem";
import { PT_POR_MM } from "@/lib/preimpressao/folha";
import { diaDaSemana, fasesDaLua, feriadosNacionais, gerarCapas, gerarMiolo, miolosEmA4, pascoa, planejarPaginas, semanasDoAno, todosOsFeriados, type Imagem } from "@/lib/preimpressao/agenda";

describe("Páscoa e feriados nacionais", () => {
  it("Páscoa de 2025, 2026 e 2027", () => {
    expect(pascoa(2025)).toEqual({ mes: 4, dia: 20 });
    expect(pascoa(2026)).toEqual({ mes: 4, dia: 5 });
    expect(pascoa(2027)).toEqual({ mes: 3, dia: 28 });
  });

  it("2026: os 14 feriados e dias santificados do calendário impresso, nas datas certas", () => {
    const f = feriadosNacionais(2026).map((x) => `${String(x.dia).padStart(2, "0")}/${String(x.mes).padStart(2, "0")} ${x.nome}`);
    expect(f).toEqual([
      "01/01 Confraternização Universal",
      "17/02 Carnaval",
      "18/02 Quarta-feira de Cinzas",
      "03/04 Sexta-feira Santa",
      "05/04 Páscoa",
      "21/04 Tiradentes",
      "01/05 Dia do Trabalho",
      "04/06 Corpus Christi",
      "07/09 Independência do Brasil",
      "12/10 Nossa Sra. Aparecida",
      "02/11 Finados",
      "15/11 Proclamação da República",
      "20/11 Zumbi e Consciência Negra",
      "25/12 Natal",
    ]);
  });

  it("regionais entram junto, em ordem; data inválida e nome vazio são ignorados", () => {
    const t = todosOsFeriados(2026, [
      { mes: 9, dia: 20, nome: "Revolução Farroupilha" },
      { mes: 2, dia: 30, nome: "Inválido" },
      { mes: 3, dia: 10, nome: "  " },
    ]);
    expect(t).toHaveLength(15);
    const i = t.findIndex((x) => x.nome === "Revolução Farroupilha");
    expect(t[i - 1].nome).toBe("Independência do Brasil");
    expect(t[i + 1].nome).toBe("Nossa Sra. Aparecida");
  });
});

describe("fases da lua", () => {
  it("janeiro de 2026 (horário de Brasília): cheia 3, minguante 10, nova 18, crescente 26", () => {
    const j = fasesDaLua(2026).filter((x) => x.mes === 1);
    expect(j).toEqual([
      { mes: 1, dia: 3, fase: "cheia" },
      { mes: 1, dia: 10, fase: "minguante" },
      { mes: 1, dia: 18, fase: "nova" },
      { mes: 1, dia: 26, fase: "crescente" },
    ]);
  });

  it("lua nova de 17/02/2026 e cheia (eclipse) de 03/03/2026", () => {
    const l = fasesDaLua(2026);
    expect(l).toContainEqual({ mes: 2, dia: 17, fase: "nova" });
    expect(l).toContainEqual({ mes: 3, dia: 3, fase: "cheia" });
  });

  it("o ano tem de 48 a 50 fases", () => {
    expect(fasesDaLua(2026).length).toBeGreaterThanOrEqual(48);
    expect(fasesDaLua(2026).length).toBeLessThanOrEqual(50);
  });
});

describe("plano de páginas", () => {
  it("1º de janeiro de 2026 é quinta-feira", () => {
    expect(diaDaSemana(2026, 1, 1)).toBe(4);
  });

  it("começa como o miolo impresso: capa, branca, dados, calendário, vizinhos, planejamento de janeiro na página 6 (par)", () => {
    const p = planejarPaginas(2026);
    expect(p.paginas.slice(0, 6).map((x) => x.tipo)).toEqual(["capa", "branca", "dados", "calendarioAno", "calendariosVizinhos", "planejamento"]);
    expect(p.paginaDoMes[0]).toBe(5);
    expect(p.paginas[6]).toEqual({ tipo: "dia", mes: 1, dia: 1 });
    expect(p.paginas[8]).toEqual({ tipo: "fimDeSemana", mes: 1, sabado: 3, domingo: 4 });
  });

  it("todo planejamento fica na página da esquerda (número par), o total é par e cada dia aparece uma vez", () => {
    const p = planejarPaginas(2026);
    p.paginaDoMes.forEach((i) => expect((i + 1) % 2).toBe(0));
    expect(p.paginas.length % 2).toBe(0);
    let dias = 0;
    for (const x of p.paginas) {
      if (x.tipo === "dia") dias++;
      if (x.tipo === "fimDeSemana") dias += (x.sabado ? 1 : 0) + (x.domingo ? 1 : 0);
    }
    expect(dias).toBe(365);
  });

  it("total maior completa com anotações (par); menor que o mínimo vale o mínimo", () => {
    const min = planejarPaginas(2026).minimo;
    expect(planejarPaginas(2026, min + 11).paginas.length).toBe(min + 12);
    expect(planejarPaginas(2026, 10).paginas.length).toBe(min);
  });
});

describe("gerar o PDF", () => {
  it("A5 148 × 210 mm com todas as páginas, e A4 com 2 miolos por folha", async () => {
    const m = await gerarMiolo({ ano: 2026, capa: "AGENDA", regionais: [{ mes: 9, dia: 20, nome: "Revolução Farroupilha" }], total: 350 });
    const d = await PDFDocument.load(m.bytes);
    expect(d.getPageCount()).toBe(Math.max(350, m.plano.minimo));
    expect(d.getPage(0).getWidth()).toBeCloseTo(148 * PT_POR_MM, 1);
    expect(d.getPage(0).getHeight()).toBeCloseTo(210 * PT_POR_MM, 1);
    const a4 = await PDFDocument.load(await miolosEmA4(m.bytes));
    expect(a4.getPageCount()).toBe(d.getPageCount());
    expect(a4.getPage(0).getWidth()).toBeCloseTo(297 * PT_POR_MM, 1);
    expect(a4.getPage(0).getHeight()).toBeCloseTo(210 * PT_POR_MM, 1);
  }, 60000);
});

function pngMini(w: number, h: number): Imagem {
  const sig = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const linhas = new Uint8Array(h * (1 + w * 3));
  for (let y = 0; y < h; y++) for (let x = 0; x < w * 3; x++) linhas[y * (1 + w * 3) + 1 + x] = (x * 7 + y * 13) % 256;
  const partes = [sig, chunkPng("IHDR", ihdr), chunkPng("IDAT", new Uint8Array(deflateSync(linhas))), chunkPng("IEND", new Uint8Array(0))];
  const bytes = new Uint8Array(partes.reduce((t, x) => t + x.length, 0));
  let o = 0;
  for (const x of partes) {
    bytes.set(x, o);
    o += x.length;
  }
  return { bytes, tipo: "png", w, h };
}

describe("modelo semanal e páginas do cliente", () => {
  it("semanas de segunda a domingo: a 1ª começa na quinta (1º de janeiro de 2026) e todo dia aparece uma vez", () => {
    const s = semanasDoAno(2026);
    expect(s[0].dias.map((d) => (d ? `${d.dia}/${d.mes}` : null))).toEqual([null, null, null, "1/1", "2/1", "3/1", "4/1"]);
    expect(s[0].mes).toBe(1);
    expect(s.flatMap((x) => x.dias).filter(Boolean)).toHaveLength(365);
    expect(s[s.length - 1].dias.some((d) => d === null)).toBe(true); // a última semana passa de 31/12
  });

  it("semanal: planejamento na página da direita (ímpar), duas páginas por semana, total par", () => {
    const p = planejarPaginas(2026, null, { modelo: "semanal" });
    p.paginaDoMes.forEach((i) => expect((i + 1) % 2).toBe(1));
    const semanas = p.paginas.filter((x) => x.tipo === "semana");
    expect(semanas).toHaveLength(2 * semanasDoAno(2026).length);
    expect(semanas[0]).toMatchObject({ lado: "esq" });
    expect(semanas[1]).toMatchObject({ lado: "dir" });
    expect(p.paginas.length % 2).toBe(0);
  });

  it("páginas do cliente entram no início, antes de um mês e no fim, sem estragar a regra do planejamento", () => {
    const p = planejarPaginas(2026, null, { extras: [{ posicao: "inicio", paginas: 3 }, { posicao: 3, paginas: 2 }, { posicao: "fim", paginas: 1 }] });
    const idx = (item: number) => p.paginas.map((x, i) => (x.tipo === "extra" && x.item === item ? i : -1)).filter((i) => i >= 0);
    expect(idx(0)).toEqual([5, 6, 7]);
    expect(idx(1)).toHaveLength(2);
    expect(idx(1)[0]).toBeLessThan(p.paginaDoMes[2]);
    expect(idx(1)[0]).toBeGreaterThan(p.paginaDoMes[1]);
    expect(idx(2)[0]).toBeGreaterThan(p.paginaDoMes[11]);
    p.paginaDoMes.forEach((i) => expect((i + 1) % 2).toBe(0));
    expect(p.paginas.length % 2).toBe(0);
  });
});

describe("gerar com a identidade do cliente", () => {
  it("logo, rodapé, marca-d'água (logo e texto), páginas do cliente, semanal e horas diferentes", async () => {
    const outro = await PDFDocument.create();
    outro.addPage([400, 600]).drawRectangle({ x: 20, y: 20, width: 100, height: 100, color: rgb(0.2, 0.4, 0.8) });
    const logo = pngMini(60, 30);
    const base = {
      ano: 2027,
      capa: "PLANNER",
      regionais: [],
      identidade: { logo, rodape: "Padaria do João · (51) 99999-9999", logoNaCapa: true, logoNoVerso: true, rodapeEmTodas: true },
      extras: [
        { nome: "tabela.pdf", bytes: await outro.save(), tipo: "pdf" as const, posicao: "inicio" as const, paginas: 1 },
        { nome: "mapa.png", bytes: pngMini(50, 80).bytes, tipo: "png" as const, posicao: 6, paginas: 1 },
      ],
    };
    const a = await gerarMiolo({ ...base, marcaDagua: { ativa: true, tipo: "logo", logo, opacidade: 0.08, escala: 50, onde: "todas" }, horaInicio: 7, horaFim: 20, estiloDia: "linhas", semanaComeca: "seg", destaque: true, luas: false });
    const da = await PDFDocument.load(a.bytes);
    expect(da.getPageCount()).toBe(a.plano.paginas.length);
    expect(a.plano.paginas.filter((x) => x.tipo === "extra")).toHaveLength(2);
    const b = await gerarMiolo({ ...base, modelo: "semanal", marcaDagua: { ativa: true, tipo: "texto", texto: "PADARIA DO JOÃO", opacidade: 0.06, escala: 70, onde: "dias" } });
    const db = await PDFDocument.load(b.bytes);
    expect(db.getPageCount()).toBe(b.plano.paginas.length);
    expect(b.plano.paginas.some((x) => x.tipo === "semana")).toBe(true);
  }, 60000);

  it("capa e contracapa: 2 páginas A5 com sangria de 1,5 mm e TrimBox no tamanho final", async () => {
    const bytes = await gerarCapas({ ano: 2027, titulo: "AGENDA", cor: "#16325c", linha1: "Padaria do João", linha2: "Sabor de todo dia", contato: "(51) 99999-9999\n@padariadojoao", logo: pngMini(60, 30), usarLogo: true });
    const d = await PDFDocument.load(bytes);
    expect(d.getPageCount()).toBe(2);
    const p = d.getPage(0);
    expect(p.getWidth() / PT_POR_MM).toBeCloseTo(151, 1);
    expect(p.getHeight() / PT_POR_MM).toBeCloseTo(213, 1);
    expect(p.getTrimBox().width / PT_POR_MM).toBeCloseTo(148, 1);
    expect(p.getTrimBox().x / PT_POR_MM).toBeCloseTo(1.5, 1);
  }, 30000);
});

import { LAYOUT_CAPA_PADRAO, layoutCapaValido } from "@/lib/preimpressao/agenda";

describe("posição dos elementos da capa", () => {
  it("completa com o padrão e limita valores fora da faixa", () => {
    expect(layoutCapaValido(null)).toEqual(LAYOUT_CAPA_PADRAO);
    const l = layoutCapaValido({ capaLogo: { x: 150, y: -20, tam: 5 }, capaNome: { y: 70 } });
    expect(l.capaLogo).toEqual({ x: 100, y: 0, tam: 30 });
    expect(l.capaNome).toEqual({ x: 50, y: 70, tam: 100 });
    expect(l.contraContato).toEqual(LAYOUT_CAPA_PADRAO.contraContato);
  });

  it("a capa é gerada com os elementos em outros lugares e tamanhos", async () => {
    const bytes = await gerarCapas({
      ano: 2027,
      titulo: "AGENDA",
      cor: "#ffffff",
      linha1: "Padaria do João",
      linha2: "Sabor de todo dia",
      contato: "(51) 99999-9999\n@padaria\nCharqueadas - RS\nAv. Principal, 100",
      logo: pngMini(60, 30),
      usarLogo: true,
      layout: {
        capaLogo: { x: 20, y: 10, tam: 50 },
        capaTitulo: { x: 70, y: 40, tam: 150 },
        capaNome: { x: 30, y: 90, tam: 120 },
        contraContato: { x: 25, y: 85, tam: 80 },
        contraLogo: { x: 80, y: 15, tam: 200 },
      },
    });
    const d = await PDFDocument.load(bytes);
    expect(d.getPageCount()).toBe(2);
  }, 30000);
});

import { datasEspeciaisValidas } from "@/lib/preimpressao/agenda";
import { NOMES_DE_EXEMPLO, nomeDeArquivo, nomesDoLote } from "@/components/preimpressao/agendaConfig";

describe("datas do cliente e lista de nomes", () => {
  it("datas válidas: tira data que não existe, nome vazio e repetidas; ordena; ícone desconhecido vira estrela", () => {
    const d = datasEspeciaisValidas(2027, [
      { mes: 3, dia: 14, nome: " Aniversário da empresa ", icone: "coracao" },
      { mes: 2, dia: 30, nome: "Não existe", icone: "estrela" },
      { mes: 1, dia: 5, nome: "Campanha", icone: "ouro" as never },
      { mes: 3, dia: 14, nome: "Aniversário da empresa", icone: "coracao" },
      { mes: 4, dia: 1, nome: "  ", icone: "ponto" },
    ]);
    expect(d).toEqual([
      { mes: 1, dia: 5, nome: "Campanha", icone: "estrela" },
      { mes: 3, dia: 14, nome: "Aniversário da empresa", icone: "coracao" },
    ]);
  });

  it("gera o miolo com datas do cliente de todos os ícones e o nome da pessoa", async () => {
    const m = await gerarMiolo({
      ano: 2027,
      capa: "AGENDA",
      regionais: [],
      pessoa: "Mariana Souza Albuquerque de Oliveira Santos",
      datas: [
        { mes: 1, dia: 5, nome: "Estrela", icone: "estrela" },
        { mes: 1, dia: 6, nome: "Coração", icone: "coracao" },
        { mes: 1, dia: 7, nome: "Losango", icone: "losango" },
        { mes: 1, dia: 8, nome: "Bolinha", icone: "ponto" },
        { mes: 1, dia: 9, nome: "Visto", icone: "visto" },
      ],
    });
    expect(m.plano.paginas.length).toBeGreaterThan(300);
    const sem = await gerarMiolo({ ano: 2027, capa: "AGENDA", regionais: [], modelo: "semanal", datas: [{ mes: 1, dia: 7, nome: "Reunião", icone: "visto" }] });
    expect(sem.bytes.length).toBeGreaterThan(1000);
  }, 60000);

  it("lista de nomes: um por linha, sem vazios nem repetidos, no máximo 100", () => {
    expect(nomesDoLote("  Ana  Paula \n\nana paula\nJoão\r\nMaria  ")).toEqual(["Ana Paula", "João", "Maria"]);
    expect(nomesDoLote(NOMES_DE_EXEMPLO)).toHaveLength(12);
    expect(nomesDoLote(Array.from({ length: 150 }, (_, i) => `Pessoa ${i}`).join("\n"))).toHaveLength(100);
  });

  it("nome de arquivo sem acento nem símbolos", () => {
    expect(nomeDeArquivo("João Pedro d'Ávila")).toBe("Joao_Pedro_d_Avila");
    expect(nomeDeArquivo("???")).toBe("agenda");
  });
});

describe("páginas de abertura do cliente e cor de destaque", () => {
  it("as páginas de abertura entram nos lugares escolhidos, antes das páginas enviadas, sem estragar a regra do planejamento", () => {
    const p = planejarPaginas(2026, null, {
      aberturas: [{ posicao: "inicio" }, { posicao: "inicio" }, { posicao: 4 }],
      extras: [{ posicao: "inicio", paginas: 1 }],
    });
    expect(p.paginas.slice(5, 8)).toEqual([{ tipo: "abertura", item: 0 }, { tipo: "abertura", item: 1 }, { tipo: "extra", item: 0, pagina: 0 }]);
    const antesDeAbril = p.paginas.findIndex((x) => x.tipo === "abertura" && x.item === 2);
    expect(antesDeAbril).toBeGreaterThan(p.paginaDoMes[2]);
    expect(antesDeAbril).toBeLessThan(p.paginaDoMes[3]);
    p.paginaDoMes.forEach((i) => expect((i + 1) % 2).toBe(0));
    expect(p.paginas.length % 2).toBe(0);
  });

  it("gera com os 3 modelos de abertura (texto longo demais não estoura), cor de destaque e domingos em destaque", async () => {
    const longo = Array.from({ length: 80 }, (_, i) => `Linha ${i} do texto bem comprido que não cabe na página inteira de jeito nenhum`).join("\n");
    const m = await gerarMiolo({
      ano: 2027,
      capa: "AGENDA",
      regionais: [],
      corDestaque: "#dc2626",
      destaque: true,
      aberturas: [
        { titulo: "Quem somos", texto: "Primeiro parágrafo.\n\nSegundo parágrafo com mais palavras para quebrar em mais de uma linha dentro da página.", modelo: "foto", foto: pngMini(63, 40), posicao: "inicio" },
        { titulo: "Cardápio", texto: "# Pizzas\nMargherita | R$ 42,00\nCalabresa com cebola e azeitonas pretas e um nome grande demais para caber | R$ 48,00\n\n" + longo, modelo: "lista", foto: null, posicao: "fim" },
        { titulo: "", texto: longo, modelo: "texto", foto: null, posicao: 6 },
        { titulo: "  ", texto: "   ", modelo: "texto", foto: null, posicao: 1 },
      ],
    });
    expect(m.plano.paginas.filter((x) => x.tipo === "abertura")).toHaveLength(3);
    const d = await PDFDocument.load(m.bytes);
    expect(d.getPageCount()).toBe(m.plano.paginas.length);
  }, 60000);

  it("cor de destaque inválida é ignorada", async () => {
    const m = await gerarMiolo({ ano: 2027, capa: "AGENDA", regionais: [], corDestaque: "vermelho" });
    expect(m.bytes.length).toBeGreaterThan(1000);
  }, 60000);
});
