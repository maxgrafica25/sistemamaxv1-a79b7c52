// Configuração do "Miolo de agenda" (o que fica salvo no navegador) e modelos salvos por cliente.

import { ELEMENTOS_CAPA, LAYOUT_CAPA_PADRAO, datasEspeciaisValidas, layoutCapaValido, urlWhatsApp, type DataEspecial, type ElementoCapa, type Feriado, type LayoutCapa, type PosicaoExtra, type QrAgenda } from "@/lib/preimpressao/agenda";

/** Logo guardada no navegador como data URL (já reduzida). */
export interface ImagemSalva {
  dataUrl: string;
  w: number;
  h: number;
  tipo: "png" | "jpg";
}

/** Página de abertura do cliente, como fica guardada na tela e nos modelos. */
export interface AberturaUI {
  id: string;
  titulo: string;
  texto: string;
  modelo: "texto" | "foto" | "lista";
  foto: ImagemSalva | null;
  posicao: PosicaoExtra;
}

export const EXEMPLOS_ABERTURA: Record<AberturaUI["modelo"], { titulo: string; texto: string }> = {
  texto: {
    titulo: "Quem somos",
    texto:
      "Somos uma empresa de família, nascida no bairro e criada com muito trabalho.\n\nHá mais de dez anos cuidamos de cada cliente como se fosse o primeiro: atendimento de perto, prazo cumprido e qualidade que dá para ver.\n\nNossa promessa é simples: resolver o seu problema com honestidade. Venha conversar com a gente!",
  },
  foto: {
    titulo: "Nossa casa",
    texto: "Venha nos visitar! Aqui você encontra atendimento de perto e um café sempre fresquinho.\n\nSegunda a sexta, das 8h às 18h. Sábado, das 8h às 12h.",
  },
  lista: {
    titulo: "Nossos produtos",
    texto: "# Mais pedidos\nProduto exemplo 1 | R$ 25,00\nProduto exemplo 2 | R$ 38,00\nProduto exemplo 3 | R$ 12,50\n\n# Serviços\nServiço exemplo A | R$ 80,00\nServiço exemplo B | R$ 120,00",
  },
};

export type Saida = "a5" | "a4";
export type ModoAgenda = "miolo" | "capa";

export interface ConfigAgendaUI {
  ano: number;
  capa: string;
  regionais: Feriado[];
  total: string;
  saida: Saida;
  modelo: "diario" | "semanal";
  estiloDia: "horas" | "linhas";
  horaInicio: number;
  horaFim: number;
  semanaComeca: "dom" | "seg";
  luas: boolean;
  destaque: boolean;
  estiloCabecalho: "pontos" | "linha" | "limpo";
  marcadores: boolean;
  logo: ImagemSalva | null;
  rodape: string;
  logoNaCapa: boolean;
  logoNoVerso: boolean;
  rodapeEmTodas: boolean;
  marcaAtiva: boolean;
  marcaTipo: "logo" | "texto";
  marcaTexto: string;
  /** Opacidade em % (2 a 30). */
  marcaOpacidade: number;
  /** Largura em % da página. */
  marcaEscala: number;
  marcaOnde: "todas" | "dias";
  /** Usa só o desenho da logo, em preto, na marca-d'água. */
  marcaSilhueta: boolean;
  capaCor: string;
  capaLinha1: string;
  capaLinha2: string;
  capaContato: string;
  capaUsarLogo: boolean;
  /** Posição e tamanho de cada elemento da capa e da contracapa. */
  capaLayout: LayoutCapa;
  /** Datas do cliente (com ícone) que entram no calendário e nas páginas. */
  datas: DataEspecial[];
  /** Nome desta agenda (capa do miolo, verso da capa, "Nome:" dos dados). */
  pessoa: string;
  /** Lista de nomes (um por linha) para gerar uma agenda para cada pessoa. */
  nomes: string;
  lote: "miolo" | "capa" | "ambos";
  /** Páginas de abertura do cliente (até 3). */
  aberturas: AberturaUI[];
  /** Cor de destaque no miolo (pontinhos, círculos, ícones, ano na capa, domingos e feriados). */
  acentoAtivo: boolean;
  acentoCor: string;
  /** Uma mensagem por mês (janeiro a dezembro), no alto do planejamento. */
  mensagens: string[];
  /** QR Code (WhatsApp ou site) no verso da capa do miolo e na contracapa. */
  qrAtivo: boolean;
  qrTipo: "whatsapp" | "link";
  qrNumero: string;
  qrMensagem: string;
  qrLink: string;
  qrRotulo: string;
  qrNoVerso: boolean;
}

/** Ano da próxima agenda: a partir de setembro já se prepara o ano seguinte. */
export function anoPadrao() {
  const h = new Date();
  return h.getFullYear() + (h.getMonth() >= 8 ? 1 : 0);
}

export function configPadrao(): ConfigAgendaUI {
  return {
    ano: anoPadrao(),
    capa: "AGENDA",
    regionais: [],
    total: "",
    saida: "a5",
    modelo: "diario",
    estiloDia: "horas",
    horaInicio: 8,
    horaFim: 18,
    semanaComeca: "dom",
    luas: true,
    destaque: false,
    estiloCabecalho: "pontos",
    marcadores: false,
    logo: null,
    rodape: "",
    logoNaCapa: true,
    logoNoVerso: true,
    rodapeEmTodas: true,
    marcaAtiva: false,
    marcaTipo: "logo",
    marcaTexto: "",
    marcaOpacidade: 8,
    marcaEscala: 60,
    marcaOnde: "todas",
    marcaSilhueta: true,
    capaCor: "#1f1f1f",
    capaLinha1: "",
    capaLinha2: "",
    capaContato: "",
    capaUsarLogo: true,
    capaLayout: structuredClone(LAYOUT_CAPA_PADRAO),
    datas: [],
    pessoa: "",
    nomes: "",
    lote: "ambos",
    aberturas: [],
    acentoAtivo: false,
    acentoCor: "#1d4ed8",
    mensagens: Array.from({ length: 12 }, () => ""),
    qrAtivo: false,
    qrTipo: "whatsapp",
    qrNumero: "",
    qrMensagem: "Olá! Vi a agenda de vocês.",
    qrLink: "",
    qrRotulo: "",
    qrNoVerso: true,
  };
}

// ─── Modelos salvos por cliente ──────────────────────────────────────

const CHAVE_MODELOS = "preimpressao.agenda.modelos.v1";

/** O que um modelo guarda: tudo, menos o ano (muda a cada vez) e o formato de saída. */
export type ModeloAgenda = Omit<ConfigAgendaUI, "ano" | "saida" | "pessoa" | "nomes" | "lote">;

export function paraModelo(c: ConfigAgendaUI): ModeloAgenda {
  const { ano: _ano, saida: _saida, pessoa: _pessoa, nomes: _nomes, lote: _lote, ...resto } = c;
  void _ano;
  void _saida;
  void _pessoa;
  void _nomes;
  void _lote;
  return resto;
}

export function lerModelos(): Record<string, ModeloAgenda> {
  try {
    const raw = window.localStorage.getItem(CHAVE_MODELOS);
    return raw ? (JSON.parse(raw) as Record<string, ModeloAgenda>) : {};
  } catch {
    return {};
  }
}

export function gravarModelos(m: Record<string, ModeloAgenda>): boolean {
  try {
    window.localStorage.setItem(CHAVE_MODELOS, JSON.stringify(m));
    return true;
  } catch {
    return false; // sem espaço no navegador (logo muito grande?)
  }
}

/** Aplica um modelo sobre a configuração atual (mantém o ano e a saída), completando o que faltar com o padrão. */
export function aplicarModelo(atual: ConfigAgendaUI, m: Partial<ModeloAgenda>): ConfigAgendaUI {
  return { ...configPadrao(), ...m, ano: atual.ano, saida: atual.saida };
}

/** Valida um modelo vindo de arquivo: só campos conhecidos, com o tipo certo. */
export function modeloDeArquivo(json: unknown): Partial<ModeloAgenda> | null {
  if (!json || typeof json !== "object") return null;
  const padrao = configPadrao() as unknown as Record<string, unknown>;
  const origem = json as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(padrao)) {
    if (k === "ano" || k === "saida" || k === "pessoa" || k === "nomes" || k === "lote") continue;
    const v = origem[k];
    if (v === undefined) continue;
    if (k === "logo") {
      const l = v as ImagemSalva | null;
      if (l === null || (typeof l === "object" && typeof l.dataUrl === "string" && l.dataUrl.startsWith("data:image/") && typeof l.w === "number" && typeof l.h === "number")) out[k] = l;
    } else if (k === "capaLayout") {
      if (v && typeof v === "object") out[k] = layoutCapaValido(v as Partial<Record<string, never>>);
    } else if (k === "mensagens") {
      if (Array.isArray(v)) out[k] = Array.from({ length: 12 }, (_, i) => (typeof v[i] === "string" ? (v[i] as string).slice(0, 90) : ""));
    } else if (k === "aberturas") {
      if (Array.isArray(v)) {
        out[k] = v
          .filter((a) => a && typeof a.titulo === "string" && typeof a.texto === "string" && ["texto", "foto", "lista"].includes(a.modelo))
          .slice(0, 3)
          .map((a, i) => ({
            id: typeof a.id === "string" ? a.id : `ab${i}`,
            titulo: a.titulo.slice(0, 40),
            texto: a.texto.slice(0, 1600),
            modelo: a.modelo,
            foto: a.foto && typeof a.foto.dataUrl === "string" && a.foto.dataUrl.startsWith("data:image/") ? a.foto : null,
            posicao: a.posicao === "fim" || (typeof a.posicao === "number" && a.posicao >= 1 && a.posicao <= 12) ? a.posicao : "inicio",
          }));
      }
    } else if (k === "datas") {
      if (Array.isArray(v)) out[k] = datasEspeciaisValidas(2024, v as DataEspecial[]);
    } else if (k === "regionais") {
      if (Array.isArray(v)) out[k] = v.filter((f) => f && typeof f.dia === "number" && typeof f.mes === "number" && typeof f.nome === "string").slice(0, 12);
    } else if (typeof v === typeof padrao[k]) out[k] = v;
  }
  return Object.keys(out).length ? (out as Partial<ModeloAgenda>) : null;
}

/** Elemento que aparece na página: o primeiro da lista se o escolhido é da outra página. */
export function elementoDaPagina(pagina: 0 | 1, atual: ElementoCapa): ElementoCapa {
  const daPagina = ELEMENTOS_CAPA.filter((e) => e.pagina === pagina);
  return daPagina.some((e) => e.chave === atual) ? atual : daPagina[0].chave;
}

/** Nomes da lista (um por linha): sem vazios nem repetidos, até 100, cada um com no máximo 40 letras. */
export function nomesDoLote(texto: string): string[] {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const l of texto.split(/\r?\n/)) {
    const n = l.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!n || vistos.has(n.toLowerCase())) continue;
    vistos.add(n.toLowerCase());
    out.push(n);
  }
  return out.slice(0, 100);
}

/** Nome de arquivo seguro: sem acento nem símbolos. */
export function nomeDeArquivo(nome: string): string {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "agenda";
}

export const NOMES_DE_EXEMPLO = [
  "Ana Paula Ribeiro",
  "Carlos Eduardo Lima",
  "Mariana Souza",
  "João Pedro Almeida",
  "Fernanda Costa",
  "Ricardo Santos",
  "Juliana Martins",
  "Pedro Henrique Rocha",
  "Camila Ferreira",
  "Lucas Oliveira",
  "Patrícia Gomes",
  "Rafael Mendes",
].join("\n");

/** QR Code da configuração: o endereço e o texto embaixo; null se estiver desligado ou o número/endereço não servir. */
export function qrDaConfig(c: Pick<ConfigAgendaUI, "qrAtivo" | "qrTipo" | "qrNumero" | "qrMensagem" | "qrLink" | "qrRotulo">): QrAgenda | null {
  if (!c.qrAtivo) return null;
  if (c.qrTipo === "whatsapp") {
    const url = urlWhatsApp(c.qrNumero, c.qrMensagem);
    return url ? { url, rotulo: c.qrRotulo.trim() || "Chame no WhatsApp" } : null;
  }
  const bruto = c.qrLink.trim();
  if (!bruto || !/\./.test(bruto)) return null;
  return { url: /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`, rotulo: c.qrRotulo.trim() || "Visite nosso site" };
}

/** Mensagens de exemplo para os 12 meses (texto original, curto e sem assunto polêmico). */
export const MENSAGENS_SUGERIDAS = [
  "Comece o ano com um passo de cada vez.",
  "Pequenas decisões de hoje constroem o resultado de amanhã.",
  "Quem planeja com carinho colhe com folga.",
  "Organização é o caminho mais curto para o descanso.",
  "Cada dia bem vivido é um passo a mais rumo ao que importa.",
  "Metade do ano é história: o que falta ainda cabe no tempo.",
  "Pare um minuto: agradecer também é produtividade.",
  "Persistência vence quando o talento descansa.",
  "Chegou a primavera: hora de florescer o que você plantou.",
  "Foco no que importa, calma no que não depende de você.",
  "O ano está acabando, mas ainda dá tempo de surpreender.",
  "Feche o ano com gratidão e abra o próximo com coragem.",
];
