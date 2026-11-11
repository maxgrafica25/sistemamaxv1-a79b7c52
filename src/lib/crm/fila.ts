// Regras do CRM de atendimento (sem tela, sem banco — tudo testável):
// ordem da fila, tempo de espera, retornos (follow-up) e mensagens prontas (atalhos).

export type Canal = "whatsapp" | "instagram" | "email" | "balcao" | "telefone" | "outro";

export const CANAIS: { key: Canal; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "instagram", label: "Instagram" },
  { key: "email", label: "E-mail" },
  { key: "balcao", label: "Balcão" },
  { key: "telefone", label: "Telefone" },
  { key: "outro", label: "Outro" },
];

export const rotuloCanal = (c: string) => CANAIS.find((x) => x.key === c)?.label ?? c;

/** O mínimo que a fila precisa saber de um cartão. */
export interface ItemFila {
  /** Cliente esperando resposta desde (ISO); nulo = já respondido. */
  aguardando_desde: string | null;
  /** Retorno (follow-up) marcado (ISO). */
  retorno_em: string | null;
  ultima_atividade_em: string;
  /** Cliente tem etiqueta marcada como prioridade. */
  prioridade: boolean;
}

const fimDoDia = (agora: Date) => {
  const d = new Date(agora);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

export type SituacaoRetorno = "atrasado" | "hoje" | "futuro" | null;

export function situacaoRetorno(retornoEm: string | null, agora = new Date()): SituacaoRetorno {
  if (!retornoEm) return null;
  const t = new Date(retornoEm).getTime();
  if (Number.isNaN(t)) return null;
  if (t > fimDoDia(agora)) return "futuro";
  const inicioHoje = new Date(agora);
  inicioHoje.setHours(0, 0, 0, 0);
  return t < inicioHoje.getTime() ? "atrasado" : "hoje";
}

/** Retorno vencido ou para hoje: precisa de ação. */
export const retornoPendente = (retornoEm: string | null, agora = new Date()) => {
  const s = situacaoRetorno(retornoEm, agora);
  return s === "atrasado" || s === "hoje";
};

/**
 * Grupo do cartão na fila:
 * 0 = cliente aguardando resposta · 1 = retorno vencido/de hoje · 2 = os demais.
 */
export function grupoNaFila(i: ItemFila, agora = new Date()): 0 | 1 | 2 {
  if (i.aguardando_desde) return 0;
  if (retornoPendente(i.retorno_em, agora)) return 1;
  return 2;
}

/**
 * Ordem dentro de uma coluna (de cima para baixo):
 * 1) aguardando resposta — prioridade primeiro, depois QUEM ESPERA HÁ MAIS TEMPO
 *    (conta a primeira mensagem sem resposta: contato novo não passa na frente);
 * 2) retornos vencidos ou de hoje — prioridade primeiro, depois o mais antigo;
 * 3) os demais — prioridade primeiro, depois a atividade mais recente.
 */
export function compararFila(a: ItemFila, b: ItemFila, agora = new Date()): number {
  const ga = grupoNaFila(a, agora);
  const gb = grupoNaFila(b, agora);
  if (ga !== gb) return ga - gb;
  if (a.prioridade !== b.prioridade) return a.prioridade ? -1 : 1;
  const t = (s: string | null) => (s ? new Date(s).getTime() : 0);
  if (ga === 0) return t(a.aguardando_desde) - t(b.aguardando_desde);
  if (ga === 1) return t(a.retorno_em) - t(b.retorno_em);
  return t(b.ultima_atividade_em) - t(a.ultima_atividade_em);
}

export function ordenarFila<T extends ItemFila>(itens: T[], agora = new Date()): T[] {
  return [...itens].sort((a, b) => compararFila(a, b, agora));
}

/** Minutos de espera desde `desde` (nunca negativo). */
export function minutosDeEspera(desde: string | null, agora = new Date()): number | null {
  if (!desde) return null;
  const t = new Date(desde).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((agora.getTime() - t) / 60000));
}

/** "agora", "35 min", "2 h 10", "3 d". */
export function formatarEspera(min: number): string {
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
  }
  return `${Math.floor(min / (24 * 60))} d`;
}

export type NivelEspera = "ok" | "atencao" | "atrasado";

/** Verde até 15 min, amarelo até 1 h, vermelho depois (limites ajustáveis). */
export function nivelDeEspera(min: number, atencaoMin = 15, atrasadoMin = 60): NivelEspera {
  if (min >= atrasadoMin) return "atrasado";
  if (min >= atencaoMin) return "atencao";
  return "ok";
}

/** Data do retorno automático da etapa: N dias depois, às 9h. */
export function retornoAutomatico(dias: number, agora = new Date()): string {
  const d = new Date(agora);
  d.setDate(d.getDate() + dias);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

// ───────────── Mensagens prontas (atalhos) ─────────────

export interface DadosModelo {
  /** Nome completo do cliente. */
  nome?: string | null;
  /** Número do pedido (ex.: PED-0123). */
  pedido?: string | null;
  /** Número do orçamento. */
  orcamento?: string | null;
  /** Nome de quem está atendendo. */
  atendente?: string | null;
  /** Nome da gráfica. */
  empresa?: string | null;
}

export const VARIAVEIS_MODELO: { chave: string; descricao: string }[] = [
  { chave: "{nome}", descricao: "primeiro nome do cliente" },
  { chave: "{nome_completo}", descricao: "nome completo do cliente" },
  { chave: "{pedido}", descricao: "número do pedido ligado ao atendimento" },
  { chave: "{orcamento}", descricao: "número do orçamento ligado ao atendimento" },
  { chave: "{atendente}", descricao: "seu nome" },
  { chave: "{empresa}", descricao: "nome da gráfica" },
  { chave: "{saudacao}", descricao: "Bom dia / Boa tarde / Boa noite" },
];

const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** "MARIA DA SILVA" → "Maria"; "gráfica max ltda" → "Gráfica". */
export function primeiroNome(nome: string | null | undefined): string {
  const p = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!p) return "";
  // só arruma quando veio tudo em maiúsculas ou tudo em minúsculas
  if (p === p.toUpperCase() || p === p.toLowerCase()) {
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }
  return p;
}

export function nomeArrumado(nome: string | null | undefined): string {
  const n = (nome ?? "").trim().replace(/\s+/g, " ");
  if (!n) return "";
  if (n !== n.toUpperCase() && n !== n.toLowerCase()) return n;
  return n
    .toLowerCase()
    .split(" ")
    .map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(" ");
}

export function saudacao(agora = new Date()): string {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export interface ModeloPreenchido {
  texto: string;
  /** Variáveis usadas no texto que ficaram sem dado (ex.: {pedido} sem pedido ligado). */
  faltando: string[];
}

/**
 * Troca {nome}, {pedido}… pelos dados do atendimento. O que não tem dado continua
 * escrito como {variavel} para a pessoa ver e completar antes de enviar.
 */
export function preencherModelo(texto: string, dados: DadosModelo, agora = new Date()): ModeloPreenchido {
  const valores: Record<string, string> = {
    nome: primeiroNome(dados.nome),
    nome_completo: nomeArrumado(dados.nome),
    pedido: (dados.pedido ?? "").trim(),
    orcamento: (dados.orcamento ?? "").trim(),
    atendente: primeiroNome(dados.atendente),
    empresa: (dados.empresa ?? "").trim(),
    saudacao: saudacao(agora),
  };
  const faltando: string[] = [];
  const saida = texto.replace(/\{([a-z_]+)\}/gi, (inteiro, chave: string) => {
    const k = chave.toLowerCase();
    if (!(k in valores)) return inteiro;
    if (!valores[k]) {
      if (!faltando.includes(`{${k}}`)) faltando.push(`{${k}}`);
      return `{${k}}`;
    }
    return valores[k];
  });
  return { texto: saida, faltando };
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface ModeloBusca {
  atalho: string;
  titulo: string;
  texto: string;
}

/**
 * Se o texto digitado é um atalho ("/pro"), devolve o que vem depois da barra; senão null.
 * Só vale quando a barra é a primeira coisa da caixa e ainda não há espaço.
 */
export function atalhoDigitado(texto: string): string | null {
  const m = /^\/([^\s/]*)$/.exec(texto);
  return m ? m[1] : null;
}

/** Atalhos que combinam com o que foi digitado: primeiro os que começam igual, depois os que contêm. */
export function buscarModelos<T extends ModeloBusca>(modelos: T[], busca: string): T[] {
  const b = semAcento(busca.trim());
  if (!b) return modelos;
  const comeca: T[] = [];
  const contem: T[] = [];
  for (const m of modelos) {
    if (semAcento(m.atalho).startsWith(b)) comeca.push(m);
    else if (semAcento(m.atalho).includes(b) || semAcento(m.titulo).includes(b)) contem.push(m);
  }
  return [...comeca, ...contem];
}

/** Deixa o atalho no formato aceito: minúsculas, sem acento, só letras, números, - e _. */
export function normalizarAtalho(s: string): string {
  return semAcento(s).replace(/^\/+/, "").replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "").slice(0, 30);
}

/** Busca de cliente/título sem acento, palavras em qualquer ordem. */
export function combinaBusca(alvo: string, busca: string): boolean {
  const a = semAcento(alvo);
  return semAcento(busca).split(/\s+/).filter(Boolean).every((p) => a.includes(p));
}

/** Texto legível sobre fundo da cor da etiqueta. */
export function corDoTexto(hex: string): "#ffffff" | "#111827" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#111827" : "#ffffff";
}
