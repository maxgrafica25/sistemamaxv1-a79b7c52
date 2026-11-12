import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { PT_POR_MM } from "@/lib/preimpressao/folha";
import { diaDaSemana, fasesDaLua, feriadosNacionais, gerarMiolo, miolosEmA4, pascoa, planejarPaginas, todosOsFeriados } from "@/lib/preimpressao/agenda";

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
