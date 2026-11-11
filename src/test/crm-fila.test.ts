import { describe, expect, it } from "vitest";
import {
  atalhoDigitado,
  buscarModelos,
  combinaBusca,
  corDoTexto,
  formatarEspera,
  grupoNaFila,
  minutosDeEspera,
  nivelDeEspera,
  nomeArrumado,
  normalizarAtalho,
  ordenarFila,
  preencherModelo,
  primeiroNome,
  retornoAutomatico,
  situacaoRetorno,
  type ItemFila,
} from "@/lib/crm/fila";

const agora = new Date(2026, 10, 10, 14, 0, 0); // 10/11/2026 14:00 (horário local)
const haMin = (m: number) => new Date(agora.getTime() - m * 60000).toISOString();
const emDias = (d: number) => new Date(agora.getTime() + d * 86400000).toISOString();

const item = (id: string, p: Partial<ItemFila>): ItemFila & { id: string } => ({
  id,
  aguardando_desde: null,
  retorno_em: null,
  ultima_atividade_em: haMin(0),
  prioridade: false,
  ...p,
});

describe("fila de atendimento", () => {
  it("quem espera há mais tempo fica em cima; contato novo não passa na frente", () => {
    const fila = ordenarFila(
      [
        item("novo", { aguardando_desde: haMin(1) }),
        item("antigo", { aguardando_desde: haMin(90) }),
        item("medio", { aguardando_desde: haMin(20) }),
      ],
      agora,
    );
    expect(fila.map((i) => i.id)).toEqual(["antigo", "medio", "novo"]);
  });

  it("mandar mais mensagens não muda o lugar (vale a primeira sem resposta)", () => {
    const fila = ordenarFila(
      [
        item("b", { aguardando_desde: haMin(30), ultima_atividade_em: haMin(30) }),
        item("a", { aguardando_desde: haMin(60), ultima_atividade_em: haMin(1) }),
      ],
      agora,
    );
    expect(fila.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("prioridade passa na frente só dentro do mesmo grupo", () => {
    const fila = ordenarFila(
      [
        item("espera", { aguardando_desde: haMin(120) }),
        item("vip-espera", { aguardando_desde: haMin(2), prioridade: true }),
        item("vip-parado", { prioridade: true, ultima_atividade_em: haMin(5) }),
        item("retorno", { retorno_em: haMin(60) }),
      ],
      agora,
    );
    expect(fila.map((i) => i.id)).toEqual(["vip-espera", "espera", "retorno", "vip-parado"]);
  });

  it("aguardando > retorno de hoje/atrasado > demais (mais recente primeiro)", () => {
    const fila = ordenarFila(
      [
        item("parado-velho", { ultima_atividade_em: haMin(500) }),
        item("retorno-futuro", { retorno_em: emDias(3), ultima_atividade_em: haMin(10) }),
        item("retorno-hoje", { retorno_em: haMin(-120) }),
        item("retorno-atrasado", { retorno_em: emDias(-2) }),
        item("aguardando", { aguardando_desde: haMin(3) }),
      ],
      agora,
    );
    expect(fila.map((i) => i.id)).toEqual(["aguardando", "retorno-atrasado", "retorno-hoje", "retorno-futuro", "parado-velho"]);
    expect(grupoNaFila(item("x", { retorno_em: emDias(3) }), agora)).toBe(2);
  });

  it("situação do retorno", () => {
    expect(situacaoRetorno(null, agora)).toBeNull();
    expect(situacaoRetorno(emDias(-1), agora)).toBe("atrasado");
    expect(situacaoRetorno(new Date(2026, 10, 10, 8, 0).toISOString(), agora)).toBe("hoje");
    expect(situacaoRetorno(new Date(2026, 10, 10, 23, 30).toISOString(), agora)).toBe("hoje");
    expect(situacaoRetorno(new Date(2026, 10, 11, 0, 5).toISOString(), agora)).toBe("futuro");
  });

  it("tempo de espera e cores", () => {
    expect(minutosDeEspera(null, agora)).toBeNull();
    expect(minutosDeEspera(haMin(35), agora)).toBe(35);
    expect(minutosDeEspera(haMin(-5), agora)).toBe(0);
    expect(formatarEspera(0)).toBe("agora");
    expect(formatarEspera(35)).toBe("35 min");
    expect(formatarEspera(120)).toBe("2 h");
    expect(formatarEspera(130)).toBe("2 h 10");
    expect(formatarEspera(3 * 1440 + 50)).toBe("3 d");
    expect(nivelDeEspera(5)).toBe("ok");
    expect(nivelDeEspera(15)).toBe("atencao");
    expect(nivelDeEspera(60)).toBe("atrasado");
  });

  it("retorno automático da etapa: N dias depois às 9h", () => {
    const d = new Date(retornoAutomatico(2, agora));
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([12, 9, 0]);
  });
});

describe("mensagens prontas (atalhos)", () => {
  it("troca nome e pedido", () => {
    const r = preencherModelo("{nome}, seu pedido {pedido} está pronto e já pode ser retirado.", {
      nome: "FULANO DE TAL",
      pedido: "PED-0123",
    });
    expect(r.texto).toBe("Fulano, seu pedido PED-0123 está pronto e já pode ser retirado.");
    expect(r.faltando).toEqual([]);
  });

  it("o que não tem dado fica visível e é avisado", () => {
    const r = preencherModelo("{nome}, pedido {pedido} / {pedido} — {coisa}", { nome: "Ana" });
    expect(r.texto).toBe("Ana, pedido {pedido} / {pedido} — {coisa}");
    expect(r.faltando).toEqual(["{pedido}"]);
  });

  it("saudação pela hora, atendente e empresa", () => {
    const r = preencherModelo(
      "{Saudacao}, {nome_completo}! Aqui é {atendente}, da {empresa}.",
      { nome: "maria da silva", atendente: "Juliano Souza", empresa: "Max Gráfica" },
      new Date(2026, 10, 10, 9, 0),
    );
    expect(r.texto).toBe("Bom dia, Maria da Silva! Aqui é Juliano, da Max Gráfica.");
    expect(preencherModelo("{saudacao}", {}, new Date(2026, 10, 10, 15, 0)).texto).toBe("Boa tarde");
    expect(preencherModelo("{saudacao}", {}, new Date(2026, 10, 10, 19, 0)).texto).toBe("Boa noite");
  });

  it("primeiro nome respeita quem já escreveu certo", () => {
    expect(primeiroNome("McDonald Souza")).toBe("McDonald");
    expect(primeiroNome("  joão  pedro")).toBe("João");
    expect(primeiroNome(null)).toBe("");
    expect(nomeArrumado("Ana Paula DE Souza")).toBe("Ana Paula DE Souza");
  });

  it("reconhece a barra só no começo e sem espaço", () => {
    expect(atalhoDigitado("/")).toBe("");
    expect(atalhoDigitado("/pro")).toBe("pro");
    expect(atalhoDigitado("/pronto agora")).toBeNull();
    expect(atalhoDigitado("oi /pro")).toBeNull();
    expect(atalhoDigitado("1/2")).toBeNull();
  });

  it("busca atalhos: começa igual primeiro, depois contém (sem acento)", () => {
    const modelos = [
      { atalho: "orcamento", titulo: "Orçamento enviado", texto: "" },
      { atalho: "pronto", titulo: "Pedido pronto", texto: "" },
      { atalho: "producao", titulo: "Entrou em produção", texto: "" },
      { atalho: "retorno", titulo: "Cobrar retorno do orçamento", texto: "" },
    ];
    expect(buscarModelos(modelos, "pro").map((m) => m.atalho)).toEqual(["pronto", "producao"]);
    expect(buscarModelos(modelos, "orç").map((m) => m.atalho)).toEqual(["orcamento", "retorno"]);
    expect(buscarModelos(modelos, "")).toHaveLength(4);
  });

  it("normaliza o atalho", () => {
    expect(normalizarAtalho("/Pedido Pronto!")).toBe("pedido-pronto");
    expect(normalizarAtalho("Orçamento")).toBe("orcamento");
  });
});

describe("apoio", () => {
  it("busca sem acento em qualquer ordem", () => {
    expect(combinaBusca("João Antônio — banner", "antonio joao")).toBe(true);
    expect(combinaBusca("João Antônio", "maria")).toBe(false);
  });
  it("cor do texto sobre a etiqueta", () => {
    expect(corDoTexto("#ef4444")).toBe("#ffffff");
    expect(corDoTexto("#fde047")).toBe("#111827");
  });
});
