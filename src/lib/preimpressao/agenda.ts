// Pré-impressão → "Miolo de agenda": gera o miolo de uma agenda anual em A5 (e em A4 com 2 miolos
// por folha) no padrão que a gráfica imprime: capa com o título na borda, dados pessoais, calendário
// do ano com feriados circulados, planejamento do mês com fases da lua e uma página por dia útil
// (sábado e domingo juntos), com horas das 08h às 18h, mini calendário e anotações.
// Tudo calculado e desenhado no navegador (pdf-lib), sem IA e sem custo. Feriados nacionais entram
// sempre; feriados regionais são acrescentados pela pessoa.

import { LineCapStyle, PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { PT_POR_MM, SANGRIA_PADRAO_MM } from "./folha";
import { planejarTamanho } from "./redimensionar";

// ─── Datas, feriados e fases da lua ──────────────────────────────────

export const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
export const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const SEMANA_CURTA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const SEMANA_LONGA = ["DOMINGO", "SEGUNDA-FEIRA", "TERÇA-FEIRA", "QUARTA-FEIRA", "QUINTA-FEIRA", "SEXTA-FEIRA", "SÁBADO"];

/** Dia da semana (0 = domingo) de uma data. */
export function diaDaSemana(ano: number, mes: number, dia: number): number {
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Domingo de Páscoa (calendário gregoriano). */
export function pascoa(ano: number): { mes: number; dia: number } {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return { mes, dia };
}

function somarDias(ano: number, mes: number, dia: number, n: number): { mes: number; dia: number } {
  const d = new Date(Date.UTC(ano, mes - 1, dia + n));
  return { mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

export interface Feriado {
  mes: number;
  dia: number;
  nome: string;
}

/** Feriados e dias santificados nacionais (os mesmos do calendário impresso), em ordem de data. */
export function feriadosNacionais(ano: number): Feriado[] {
  const p = pascoa(ano);
  const rel = (n: number) => somarDias(ano, p.mes, p.dia, n);
  const lista: Feriado[] = [
    { mes: 1, dia: 1, nome: "Confraternização Universal" },
    { ...rel(-47), nome: "Carnaval" },
    { ...rel(-46), nome: "Quarta-feira de Cinzas" },
    { ...rel(-2), nome: "Sexta-feira Santa" },
    { ...p, nome: "Páscoa" },
    { mes: 4, dia: 21, nome: "Tiradentes" },
    { mes: 5, dia: 1, nome: "Dia do Trabalho" },
    { ...rel(60), nome: "Corpus Christi" },
    { mes: 9, dia: 7, nome: "Independência do Brasil" },
    { mes: 10, dia: 12, nome: "Nossa Sra. Aparecida" },
    { mes: 11, dia: 2, nome: "Finados" },
    { mes: 11, dia: 15, nome: "Proclamação da República" },
    { mes: 11, dia: 20, nome: "Zumbi e Consciência Negra" },
    { mes: 12, dia: 25, nome: "Natal" },
  ];
  return ordenarFeriados(lista);
}

function ordenarFeriados(l: Feriado[]): Feriado[] {
  return [...l].sort((a, b) => a.mes - b.mes || a.dia - b.dia);
}

/** Nacionais + regionais/municipais da pessoa (data válida no ano). */
export function todosOsFeriados(ano: number, regionais: Feriado[]): Feriado[] {
  const extras = regionais.filter((f) => f.mes >= 1 && f.mes <= 12 && f.dia >= 1 && f.dia <= diasNoMes(ano, f.mes) && f.nome.trim() !== "");
  return ordenarFeriados([...feriadosNacionais(ano), ...extras.map((f) => ({ ...f, nome: f.nome.trim() }))]);
}

export type FaseLua = "nova" | "crescente" | "cheia" | "minguante";

const rad = (g: number) => (g * Math.PI) / 180;

/** Instante (dia juliano, tempo dinâmico) de uma fase da lua. k inteiro = nova; +0,25 crescente; +0,5 cheia; +0,75 minguante. */
function jdeDaFase(k: number): number {
  const T = k / 1236.85;
  const jde0 = 2451550.09766 + 29.530588861 * k + 0.00015437 * T * T - 0.00000015 * T ** 3 + 0.00000000073 * T ** 4;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M = rad(2.5534 + 29.1053567 * k - 0.0000014 * T * T - 0.00000011 * T ** 3);
  const Mp = rad(201.5643 + 385.81693528 * k + 0.0107582 * T * T + 0.00001238 * T ** 3 - 0.000000058 * T ** 4);
  const F = rad(160.7108 + 390.67050284 * k - 0.0016118 * T * T - 0.00000227 * T ** 3 + 0.000000011 * T ** 4);
  const Om = rad(124.7746 - 1.56375588 * k + 0.0020672 * T * T + 0.00000215 * T ** 3);
  const frac = Math.round((k - Math.floor(k)) * 4) / 4;
  let c: number;
  if (frac === 0 || frac === 0.5) {
    const n = frac === 0;
    c =
      (n ? -0.4072 : -0.40614) * Math.sin(Mp) +
      (n ? 0.17241 : 0.17302) * E * Math.sin(M) +
      (n ? 0.01608 : 0.01614) * Math.sin(2 * Mp) +
      (n ? 0.01039 : 0.01043) * Math.sin(2 * F) +
      (n ? 0.00739 : 0.00734) * E * Math.sin(Mp - M) +
      (n ? -0.00514 : -0.00515) * E * Math.sin(Mp + M) +
      (n ? 0.00208 : 0.00209) * E * E * Math.sin(2 * M) -
      0.00111 * Math.sin(Mp - 2 * F) -
      0.00057 * Math.sin(Mp + 2 * F) +
      0.00056 * E * Math.sin(2 * Mp + M) -
      0.00042 * Math.sin(3 * Mp) +
      0.00042 * E * Math.sin(M + 2 * F) +
      0.00038 * E * Math.sin(M - 2 * F) -
      0.00024 * E * Math.sin(2 * Mp - M) -
      0.00017 * Math.sin(Om);
  } else {
    c =
      -0.62801 * Math.sin(Mp) +
      0.17172 * E * Math.sin(M) -
      0.01183 * E * Math.sin(Mp + M) +
      0.00862 * Math.sin(2 * Mp) +
      0.00804 * Math.sin(2 * F) +
      0.00454 * E * Math.sin(Mp - M) +
      0.00204 * E * E * Math.sin(2 * M) -
      0.0018 * Math.sin(Mp - 2 * F) -
      0.0007 * Math.sin(Mp + 2 * F) -
      0.0004 * Math.sin(3 * Mp) -
      0.00034 * E * Math.sin(2 * Mp - M) +
      0.00032 * E * Math.sin(M + 2 * F) +
      0.00032 * E * Math.sin(M - 2 * F) -
      0.00028 * E * E * Math.sin(Mp + 2 * M) +
      0.00027 * E * Math.sin(2 * Mp + M) -
      0.00017 * Math.sin(Om);
    const W = 0.00306 - 0.00038 * E * Math.cos(M) + 0.00026 * Math.cos(Mp) - 0.00002 * Math.cos(Mp - M) + 0.00002 * Math.cos(Mp + M) + 0.00002 * Math.cos(2 * F);
    c += frac === 0.25 ? W : -W;
  }
  return jde0 + c;
}

/** Dia juliano (tempo universal) → data civil. */
function dataDoJd(jd: number): { ano: number; mes: number; dia: number } {
  const z = Math.floor(jd + 0.5);
  const alfa = Math.floor((z - 1867216.25) / 36524.25);
  const a = z + 1 + alfa - Math.floor(alfa / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const dia = b - d - Math.floor(30.6001 * e);
  const mes = e < 14 ? e - 1 : e - 13;
  const ano = mes > 2 ? c - 4716 : c - 4715;
  return { ano, mes, dia };
}

const FASES: FaseLua[] = ["nova", "crescente", "cheia", "minguante"];

/**
 * Fases da lua do ano (data no horário de Brasília, UTC−3). Fórmulas de Jean Meeus (erro de
 * poucos minutos), suficientes para dizer em que dia cai cada fase.
 */
export function fasesDaLua(ano: number): { mes: number; dia: number; fase: FaseLua }[] {
  const out: { mes: number; dia: number; fase: FaseLua }[] = [];
  const k0 = Math.floor((ano - 2000) * 12.3685) - 2;
  for (let i = 0; i < 4 * 16; i++) {
    const k = k0 + i / 4;
    const t = (k - 0) / 1236.85;
    const anoAprox = 2000 + t * 100;
    const dT = 62.92 + 0.32217 * (anoAprox - 2000) + 0.005589 * (anoAprox - 2000) ** 2; // segundos
    const jdLocal = jdeDaFase(k) - dT / 86400 - 3 / 24;
    const d = dataDoJd(jdLocal);
    if (d.ano === ano) out.push({ mes: d.mes, dia: Math.floor(d.dia), fase: FASES[i % 4] });
  }
  return out;
}

// ─── Opções do miolo ─────────────────────────────────────────────────

/** Imagem já pronta para entrar no PDF (PNG ou JPG) e o tamanho dela em pixels. */
export interface Imagem {
  bytes: Uint8Array;
  tipo: "png" | "jpg";
  w: number;
  h: number;
}

export type PosicaoExtra = "inicio" | "fim" | number;

/** Páginas do cliente (PDF ou imagem) que entram no miolo: no início, no fim ou antes de um mês (1–12). */
export interface Extra {
  nome: string;
  bytes: Uint8Array;
  tipo: "pdf" | "png" | "jpg";
  posicao: PosicaoExtra;
  paginas: number;
}

export interface Identidade {
  logo: Imagem | null;
  /** Uma linha: nome, telefone, Instagram… */
  rodape: string;
  logoNaCapa: boolean;
  logoNoVerso: boolean;
  rodapeEmTodas: boolean;
}

export interface MarcaDagua {
  ativa: boolean;
  tipo: "logo" | "texto";
  texto: string;
  logo: Imagem | null;
  /** 0,02 a 0,3 (quanto menor, mais clara). */
  opacidade: number;
  /** Largura em % da página. */
  escala: number;
  onde: "todas" | "dias";
}

export interface ConfigAgenda {
  ano: number;
  /** Palavra da capa (padrão AGENDA). */
  capa: string;
  /** Feriados regionais/municipais da pessoa; os nacionais entram sempre. */
  regionais: Feriado[];
  /** Total de páginas (par); vazio = só o necessário. */
  total?: number | null;
  /** diario = uma página por dia; semanal = a semana em duas páginas. */
  modelo?: "diario" | "semanal";
  /** horas = linhas com as horas; linhas = pautado liso. */
  estiloDia?: "horas" | "linhas";
  horaInicio?: number;
  horaFim?: number;
  /** Começo da semana nos calendários pequenos. */
  semanaComeca?: "dom" | "seg";
  luas?: boolean;
  /** Domingos e feriados com o número em cinza. */
  destaque?: boolean;
  identidade?: Partial<Identidade>;
  marcaDagua?: Partial<MarcaDagua>;
  extras?: Extra[];
}

interface Cfg {
  ano: number;
  capa: string;
  regionais: Feriado[];
  total: number | null;
  modelo: "diario" | "semanal";
  estiloDia: "horas" | "linhas";
  horaInicio: number;
  horaFim: number;
  semanaComeca: "dom" | "seg";
  luas: boolean;
  destaque: boolean;
  identidade: Identidade;
  marcaDagua: MarcaDagua;
  extras: Extra[];
}

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function normalizar(c: ConfigAgenda): Cfg {
  const horaInicio = limitar(Math.round(c.horaInicio ?? 8), 5, 21);
  return {
    ano: c.ano,
    capa: c.capa,
    regionais: c.regionais,
    total: c.total ?? null,
    modelo: c.modelo ?? "diario",
    estiloDia: c.estiloDia ?? "horas",
    horaInicio,
    horaFim: limitar(Math.round(c.horaFim ?? 18), horaInicio + 1, 23),
    semanaComeca: c.semanaComeca ?? "dom",
    luas: c.luas ?? true,
    destaque: c.destaque ?? false,
    identidade: { logo: null, rodape: "", logoNaCapa: true, logoNoVerso: true, rodapeEmTodas: true, ...c.identidade },
    marcaDagua: { ativa: false, tipo: "texto", texto: "", logo: null, opacidade: 0.08, escala: 60, onde: "todas", ...c.marcaDagua },
    extras: c.extras ?? [],
  };
}

// ─── Plano de páginas ────────────────────────────────────────────────

export type Dia = { mes: number; dia: number } | null;

export type TipoPagina =
  | { tipo: "capa" }
  | { tipo: "branca" }
  | { tipo: "dados" }
  | { tipo: "calendarioAno" }
  | { tipo: "calendariosVizinhos" }
  | { tipo: "planejamento"; mes: number }
  | { tipo: "dia"; mes: number; dia: number }
  | { tipo: "fimDeSemana"; mes: number; sabado: number | null; domingo: number | null }
  | { tipo: "semana"; mes: number; dias: Dia[]; lado: "esq" | "dir" }
  | { tipo: "anotacoes" }
  | { tipo: "extra"; item: number; pagina: number };

export interface Plano {
  paginas: TipoPagina[];
  /** Página (a partir de 0) do planejamento de cada mês. */
  paginaDoMes: number[];
  /** Quantas páginas o miolo precisa no mínimo. */
  minimo: number;
}

/** Semanas de segunda a domingo do ano; cada uma pertence ao mês da segunda-feira (a 1ª semana, a janeiro). */
export function semanasDoAno(ano: number): { mes: number; dias: Dia[] }[] {
  const jan1 = Date.UTC(ano, 0, 1);
  const volta = (new Date(jan1).getUTCDay() + 6) % 7;
  const out: { mes: number; dias: Dia[] }[] = [];
  for (let ini = jan1 - volta * 86400000; ini <= Date.UTC(ano, 11, 31); ini += 7 * 86400000) {
    const dias: Dia[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(ini + i * 86400000);
      dias.push(d.getUTCFullYear() === ano ? { mes: d.getUTCMonth() + 1, dia: d.getUTCDate() } : null);
    }
    const seg = dias[0];
    out.push({ mes: seg ? seg.mes : 1, dias });
  }
  return out;
}

/**
 * Ordem das páginas, como no miolo impresso: capa, verso em branco, dados pessoais, calendário do ano,
 * calendários do ano anterior e seguinte; depois, por mês, o planejamento e os dias; no fim, anotações.
 * No modelo diário o planejamento fica na página da esquerda (par) e cada dia da semana tem uma página,
 * com sábado + domingo juntos. No semanal o planejamento fica na da direita e cada semana ocupa duas páginas.
 * Páginas do cliente (`extras`) entram no início, no fim ou antes de um mês. `total` (par) completa com
 * páginas de anotações; menor que o mínimo vale o mínimo.
 */
export function planejarPaginas(
  ano: number,
  total?: number | null,
  opc: { modelo?: "diario" | "semanal"; extras?: { posicao: PosicaoExtra; paginas: number }[] } = {},
): Plano {
  const semanal = opc.modelo === "semanal";
  const extras = opc.extras ?? [];
  const paginas: TipoPagina[] = [{ tipo: "capa" }, { tipo: "branca" }, { tipo: "dados" }, { tipo: "calendarioAno" }, { tipo: "calendariosVizinhos" }];
  const inserirExtras = (pos: PosicaoExtra) =>
    extras.forEach((e, item) => {
      if (e.posicao !== pos) return;
      for (let pagina = 0; pagina < e.paginas; pagina++) paginas.push({ tipo: "extra", item, pagina });
    });
  inserirExtras("inicio");
  const semanas = semanal ? semanasDoAno(ano) : [];
  const paginaDoMes: number[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    inserirExtras(mes);
    // número da página do planejamento: par (esquerda) no diário, ímpar (direita) no semanal
    const alvo = semanal ? 1 : 0;
    if ((paginas.length + 1) % 2 !== alvo) paginas.push({ tipo: "anotacoes" });
    paginaDoMes.push(paginas.length);
    paginas.push({ tipo: "planejamento", mes });
    if (semanal) {
      for (const s of semanas.filter((x) => x.mes === mes)) {
        paginas.push({ tipo: "semana", mes, dias: s.dias, lado: "esq" });
        paginas.push({ tipo: "semana", mes, dias: s.dias, lado: "dir" });
      }
      continue;
    }
    const n = diasNoMes(ano, mes);
    for (let dia = 1; dia <= n; dia++) {
      const sem = diaDaSemana(ano, mes, dia);
      if (sem === 6) {
        // sábado + domingo do mesmo mês na mesma página
        const domingo = dia + 1 <= n ? dia + 1 : null;
        paginas.push({ tipo: "fimDeSemana", mes, sabado: dia, domingo });
        if (domingo) dia++;
      } else if (sem === 0) {
        paginas.push({ tipo: "fimDeSemana", mes, sabado: null, domingo: dia });
      } else {
        paginas.push({ tipo: "dia", mes, dia });
      }
    }
  }
  inserirExtras("fim");
  if (paginas.length % 2 !== 0) paginas.push({ tipo: "anotacoes" });
  const minimo = paginas.length;
  const alvo = total && total > minimo ? total + (total % 2) : minimo;
  while (paginas.length < alvo) paginas.push({ tipo: "anotacoes" });
  return { paginas, paginaDoMes, minimo };
}

// ─── Desenho ─────────────────────────────────────────────────────────

const W = 148;
const H = 210;
const MARGEM_INTERNA = 14; // lado da encadernação
const MARGEM_EXTERNA = 8;
const PRETO = rgb(0.07, 0.07, 0.07);
const CINZA = rgb(0.55, 0.55, 0.55);
const CINZA_ESCURO = rgb(0.42, 0.42, 0.42);
const CINZA_CLARO = rgb(0.78, 0.78, 0.78);

type Peso = "leve" | "normal" | "negrito" | "extra";

interface Fontes {
  leve: PDFFont;
  normal: PDFFont;
  negrito: PDFFont;
  extra: PDFFont;
}

/** Fontes embutidas vindas do navegador (Montserrat); sem elas o PDF usa Helvetica. */
export interface FontesExternas {
  fontkit: unknown;
  leve: Uint8Array;
  normal: Uint8Array;
  negrito: Uint8Array;
  extra: Uint8Array;
}

interface Contexto {
  cfg: Cfg;
  feriados: Feriado[];
  luas: { mes: number; dia: number; fase: FaseLua }[];
  f: Fontes;
  /** Fator de tamanho do texto (Montserrat é mais larga que Helvetica). */
  k: number;
  logo: PDFImage | null;
}

/** Uma página sendo desenhada (medidas em mm a partir do canto superior esquerdo). */
class Folha {
  /** Página da direita (ímpar): a encadernação fica à esquerda. */
  readonly recto: boolean;
  readonly esq: number;
  readonly dir: number;
  constructor(
    readonly page: PDFPage,
    readonly ctx: Contexto,
    numero: number,
  ) {
    this.recto = numero % 2 === 1;
    this.esq = this.recto ? MARGEM_INTERNA : MARGEM_EXTERNA;
    this.dir = W - (this.recto ? MARGEM_EXTERNA : MARGEM_INTERNA);
  }

  get ano() {
    return this.ctx.cfg.ano;
  }

  private Y(y: number) {
    return (H - y) * PT_POR_MM;
  }
  private X(x: number) {
    return x * PT_POR_MM;
  }

  fonte(peso: Peso = "normal") {
    return this.ctx.f[peso];
  }

  texto(s: string, x: number, y: number, tamanho: number, o: { peso?: Peso; negrito?: boolean; alinhar?: "e" | "c" | "d"; cor?: ReturnType<typeof rgb> } = {}) {
    const peso: Peso = o.peso ?? (o.negrito ? "negrito" : "normal");
    const t = tamanho * this.ctx.k;
    const w = this.fonte(peso).widthOfTextAtSize(s, t) / PT_POR_MM;
    const xi = o.alinhar === "d" ? x - w : o.alinhar === "c" ? x - w / 2 : x;
    this.page.drawText(s, { x: this.X(xi), y: this.Y(y), size: t, font: this.fonte(peso), color: o.cor ?? PRETO });
    return w;
  }

  largura(s: string, tamanho: number, peso: Peso | boolean = "normal") {
    const p: Peso = peso === true ? "negrito" : peso === false ? "normal" : peso;
    return this.fonte(p).widthOfTextAtSize(s, tamanho * this.ctx.k) / PT_POR_MM;
  }

  linha(x1: number, y1: number, x2: number, y2: number, espessura = 0.5, cor = PRETO) {
    this.page.drawLine({ start: { x: this.X(x1), y: this.Y(y1) }, end: { x: this.X(x2), y: this.Y(y2) }, thickness: espessura, color: cor });
  }

  /** Grade de pontinhos (uma linha tracejada com pontas redondas por fileira). */
  pontos(x1: number, y1: number, x2: number, y2: number, passo = 2.2) {
    if (x2 <= x1) return;
    for (let y = y1; y <= y2 + 0.01; y += passo) {
      this.page.drawLine({
        start: { x: this.X(x1), y: this.Y(y) },
        end: { x: this.X(x2), y: this.Y(y) },
        thickness: 0.8,
        color: PRETO,
        lineCap: LineCapStyle.Round,
        dashArray: [0.01, passo * PT_POR_MM],
      });
    }
  }

  circulo(cx: number, cy: number, r: number, espessura = 0.45) {
    this.page.drawCircle({ x: this.X(cx), y: this.Y(cy), size: r * PT_POR_MM, borderWidth: espessura, borderColor: PRETO });
  }

  retangulo(x: number, y: number, w: number, h: number, espessura = 0.5) {
    this.page.drawRectangle({ x: this.X(x), y: this.Y(y + h), width: w * PT_POR_MM, height: h * PT_POR_MM, borderWidth: espessura, borderColor: PRETO });
  }

  fundoBranco(x: number, y: number, w: number, h: number) {
    this.page.drawRectangle({ x: this.X(x), y: this.Y(y + h), width: w * PT_POR_MM, height: h * PT_POR_MM, color: rgb(1, 1, 1) });
  }

  imagem(img: PDFImage, x: number, y: number, w: number, h: number, opacidade = 1) {
    this.page.drawImage(img, { x: this.X(x), y: this.Y(y + h), width: w * PT_POR_MM, height: h * PT_POR_MM, opacity: opacidade });
  }

  /** Cabeçalho "PLANEJAMENTO **JANEIRO**": pontos do lado da encadernação, título do lado de fora. */
  titulo(leve: string, forte: string, y = 14, tamanho = 12) {
    const w1 = this.largura(leve ? leve + " " : "", tamanho, "leve");
    const w2 = this.largura(forte, tamanho, "negrito");
    if (this.recto) {
      const x0 = this.dir - w1 - w2;
      if (leve) this.texto(leve + " ", x0, y, tamanho, { peso: "leve" });
      this.texto(forte, x0 + w1, y, tamanho, { peso: "negrito" });
      this.pontos(this.esq, y - 6, x0 - 3, y + 1);
    } else {
      if (leve) this.texto(leve + " ", this.esq, y, tamanho, { peso: "leve" });
      this.texto(forte, this.esq + w1, y, tamanho, { peso: "negrito" });
      this.pontos(this.esq + w1 + w2 + 3, y - 6, this.dir, y + 1);
    }
  }
}

function ehFeriado(feriados: Feriado[], mes: number, dia: number) {
  return feriados.some((f) => f.mes === mes && f.dia === dia);
}

/** Um mês em grade (D S T Q Q S S ou S T Q Q S S D), com os feriados circulados. */
function mesEmGrade(
  fo: Folha,
  mes: number,
  x: number,
  y: number,
  largura: number,
  o: { nome?: boolean; tamNome?: number; tamNum?: number; passo?: number; tamSem?: number; ano?: number; semFeriados?: boolean } = {},
) {
  const ano = o.ano ?? fo.ano;
  const tamNome = o.tamNome ?? 8;
  const tamNum = o.tamNum ?? 7;
  const tamSem = o.tamSem ?? 7;
  const passo = o.passo ?? 4;
  const celula = largura / 7;
  const seg = fo.ctx.cfg.semanaComeca === "seg";
  let yy = y;
  if (o.nome !== false) {
    fo.texto(MESES[mes - 1], x + largura / 2, yy, tamNome, { alinhar: "c" });
    yy += passo * 1.25;
  }
  const letras = seg ? ["S", "T", "Q", "Q", "S", "S", "D"] : ["D", "S", "T", "Q", "Q", "S", "S"];
  letras.forEach((s, i) => fo.texto(s, x + celula * (i + 0.5), yy, tamSem, { peso: "negrito", alinhar: "c" }));
  yy += passo * 1.05;
  const primeiro = (diaDaSemana(ano, mes, 1) + (seg ? 6 : 0)) % 7;
  const n = diasNoMes(ano, mes);
  for (let d = 1; d <= n; d++) {
    const pos = primeiro + d - 1;
    const col = pos % 7;
    const lin = Math.floor(pos / 7);
    const cx = x + celula * (col + 0.5);
    const cy = yy + lin * passo;
    fo.texto(String(d), cx, cy, tamNum, { alinhar: "c" });
    if (!o.semFeriados && ehFeriado(fo.ctx.feriados, mes, d)) fo.circulo(cx, cy - tamNum * 0.17, Math.min(celula * 0.5, passo * 0.62));
  }
}

function desenharCapa(fo: Folha) {
  const { cfg, k } = fo.ctx;
  const tam = 54;
  const leve = (cfg.capa || "AGENDA").toUpperCase();
  const w1 = fo.largura(leve, tam, "leve");
  const w2 = fo.largura(String(cfg.ano), tam, "extra");
  const total = w1 + w2;
  const base = fo.dir - 1; // linha de base do texto girado: o corpo das letras fica à esquerda dela
  const y0 = (H + total) / 2; // começa embaixo e lê para cima
  const rotaciona = (s: string, y: number, peso: Peso) =>
    fo.page.drawText(s, { x: base * PT_POR_MM, y: (H - y) * PT_POR_MM, size: tam * k, font: fo.fonte(peso), color: PRETO, rotate: degrees(90) });
  rotaciona(leve, y0, "leve");
  rotaciona(String(cfg.ano), y0 - w1, "extra");
  const alturaLetra = (tam * k * 0.72) / PT_POR_MM;
  const xi = base - alturaLetra;
  fo.pontos(xi, 5, fo.dir, y0 - total - 4, 2.2);
  fo.pontos(xi, y0 + 4, fo.dir, H - 5, 2.2);
  // logo do cliente no canto de baixo, do lado da encadernação
  const logo = fo.ctx.logo;
  const id = cfg.identidade;
  if (logo && id.logo && id.logoNaCapa) {
    const largura = Math.min(44, xi - fo.esq - 8);
    const alt = largura * (id.logo.h / id.logo.w);
    fo.imagem(logo, fo.esq, H - 14 - alt, largura, alt);
  }
}

function desenharVersoDaCapa(fo: Folha) {
  const { cfg } = fo.ctx;
  const id = cfg.identidade;
  const logo = fo.ctx.logo;
  const cx = (fo.esq + fo.dir) / 2;
  if (logo && id.logo && id.logoNoVerso) {
    const largura = Math.min(70, id.logo.w / id.logo.h > 2.2 ? 70 : 46);
    const alt = largura * (id.logo.h / id.logo.w);
    fo.imagem(logo, cx - largura / 2, 88 - alt / 2, largura, alt);
    if (id.rodape.trim()) fo.texto(id.rodape.trim(), cx, 88 + alt / 2 + 9, 7, { alinhar: "c", cor: CINZA_ESCURO });
  } else if (id.logoNoVerso && id.rodape.trim()) {
    fo.texto(id.rodape.trim(), cx, 100, 8, { alinhar: "c", cor: CINZA_ESCURO });
  }
}

/** Logo e/ou texto de contato na base de cada página. */
function rodapeIdentidade(fo: Folha) {
  const id = fo.ctx.cfg.identidade;
  if (!id.rodapeEmTodas) return;
  const logo = fo.ctx.logo;
  const texto = id.rodape.trim();
  if (!logo && !texto) return;
  const altLogo = 4.2;
  const wLogo = logo && id.logo ? altLogo * (id.logo.w / id.logo.h) : 0;
  const wTexto = texto ? fo.largura(texto, 5.6) : 0;
  const total = wLogo + (logo && texto ? 2 : 0) + wTexto;
  let x = (fo.esq + fo.dir) / 2 - total / 2;
  const yBase = 205.4;
  if (logo && id.logo) {
    fo.imagem(logo, x, yBase - 3.4, wLogo, altLogo);
    x += wLogo + 2;
  }
  if (texto) fo.texto(texto, x, yBase, 5.6, { cor: CINZA_ESCURO });
}

/** Marca-d'água no centro da página (por baixo de tudo). */
function marcaDagua(fo: Folha, marcaImg: PDFImage | null) {
  const m = fo.ctx.cfg.marcaDagua;
  if (!m.ativa) return;
  const op = limitar(m.opacidade, 0.02, 0.4);
  const largura = (limitar(m.escala, 10, 100) / 100) * W;
  const cx = W / 2;
  const cy = H / 2;
  if (m.tipo === "logo" && marcaImg && m.logo) {
    const alt = largura * (m.logo.h / m.logo.w);
    fo.imagem(marcaImg, cx - largura / 2, cy - alt / 2, largura, alt, op);
    return;
  }
  const t = m.texto.trim();
  if (m.tipo !== "texto" || !t) return;
  const fonte = fo.fonte("negrito");
  const w1 = fonte.widthOfTextAtSize(t, 100) / PT_POR_MM; // largura em mm a 100 pt
  const ang = 35;
  // o texto na diagonal ocupa, na horizontal, cos(ang) da largura: ajusta para caber em `largura`
  const tam = Math.min(100, ((largura / Math.cos(rad(ang))) / w1) * 100);
  const w = fonte.widthOfTextAtSize(t, tam) / PT_POR_MM;
  const h = (tam * 0.7) / PT_POR_MM;
  // ponto de partida do texto girado para o centro dele ficar no centro da página (y de baixo para cima)
  const x0 = cx - (w / 2) * Math.cos(rad(ang)) + (h / 2) * Math.sin(rad(ang));
  const y0 = H - cy - (w / 2) * Math.sin(rad(ang)) - (h / 2) * Math.cos(rad(ang));
  fo.page.drawText(t, { x: x0 * PT_POR_MM, y: y0 * PT_POR_MM, size: tam, font: fonte, color: PRETO, opacity: op, rotate: degrees(ang) });
}

function campos(fo: Folha, y: number, linhas: ([string] | [string, string])[], passo = 6.9) {
  const meio = (fo.esq + fo.dir) / 2 + 2;
  let yy = y;
  for (const l of linhas) {
    if (l.length === 1) {
      fo.texto(l[0] + ":", fo.esq, yy, 6.5);
      const x0 = fo.esq + fo.largura(l[0] + ": ", 6.5);
      fo.linha(x0, yy + 0.6, fo.dir, yy + 0.6, 0.45);
    } else {
      fo.texto(l[0] + ":", fo.esq, yy, 6.5);
      fo.linha(fo.esq + fo.largura(l[0] + ": ", 6.5), yy + 0.6, meio - 1, yy + 0.6, 0.45);
      fo.texto(l[1] + ":", meio, yy, 6.5);
      fo.linha(meio + fo.largura(l[1] + ": ", 6.5), yy + 0.6, fo.dir, yy + 0.6, 0.45);
    }
    yy += passo;
  }
  return yy;
}

function desenharDados(fo: Folha) {
  fo.titulo("DADOS", "PESSOAIS", 13);
  let y = campos(fo, 22, [["Nome"], ["RG", "CPF"], ["Endereço"], ["Bairro", "CEP"], ["Cidade", "Estado"], ["Tel.", "Cel."], ["Outro"]]);
  fo.titulo("DADOS", "PROFISSIONAIS", y + 5);
  y = campos(fo, y + 14, [["Empresa"], ["CNPJ", "Insc. Estadual"], ["Endereço"], ["Complemento", "CEP"], ["Cidade", "Estado"], ["Telefone", "Whatsapp"], ["E-mail", "Site"], ["Facebook", "Instagram"]]);
  fo.titulo("EM CASO DE", "EMERGÊNCIA", y + 5);
  campos(fo, y + 14, [["Emergência, avisar"], ["Telefone", "Convênio Médico"], ["Grupo Sanguíneo", "Fator RH"], ["Alergias"], ["Medicamentos"], ["Veículo", "Placa"], ["Seguro", "Telefone"]]);
}

function desenharCalendarioAno(fo: Folha) {
  const ano = fo.ano;
  fo.texto("CALENDÁRIO", fo.esq, 12, 11, { peso: "leve" });
  const wt = fo.largura("CALENDÁRIO ", 11, "leve");
  fo.texto(String(ano), fo.esq + wt, 12, 11, { peso: "negrito" });
  fo.pontos(fo.esq + wt + fo.largura(String(ano), 11, "negrito") + 3, 6.5, fo.dir, 13);
  const colW = (fo.dir - fo.esq) / 3;
  const linhaH = 34.5;
  for (let m = 1; m <= 12; m++) {
    const col = (m - 1) % 3;
    const lin = Math.floor((m - 1) / 3);
    const x = fo.esq + col * colW;
    const y = 24 + lin * linhaH;
    mesEmGrade(fo, m, x + 1.5, y, colW - 3, { tamNome: 8, tamNum: 6.8, passo: 3.9, tamSem: 6.8 });
    if (col > 0) fo.linha(x, y - 4, x, y + 28, 0.4);
    if (col === 0 && lin > 0) fo.linha(fo.esq, y - 4.6, fo.dir, y - 4.6, 0.4);
  }
  const feriados = fo.ctx.feriados;
  const yl = 168;
  fo.texto("FERIADOS E DIAS SANTIFICADOS", fo.esq, yl, 8.5, { peso: "leve" });
  fo.pontos(fo.esq + fo.largura("FERIADOS E DIAS SANTIFICADOS ", 8.5, "leve") + 2, yl - 4.5, fo.dir, yl + 0.5, 1.8);
  const colunas = 3;
  const porColuna = Math.ceil(feriados.length / colunas);
  const passo = Math.min(4.6, 25 / Math.max(porColuna, 1));
  const tam = Math.min(6.3, passo * 1.35);
  feriados.forEach((fer, i) => {
    const c = Math.floor(i / porColuna);
    const r = i % porColuna;
    const x = fo.esq + c * colW;
    const y = yl + 6 + r * passo;
    fo.texto(String(fer.dia).padStart(2, "0") + " " + MESES_CURTOS[fer.mes - 1], x, y, tam);
    fo.texto(fer.nome, x + 12, y, tam);
  });
}

function desenharVizinhos(fo: Folha) {
  const ano = fo.ano;
  [ano - 1, ano + 1].forEach((a, i) => {
    const y0 = 12 + i * 100;
    fo.titulo("CALENDÁRIO", String(a), y0, 11);
    const colW = (fo.dir - fo.esq) / 4;
    for (let m = 1; m <= 12; m++) {
      const col = (m - 1) % 4;
      const lin = Math.floor((m - 1) / 4);
      const x = fo.esq + col * colW;
      const y = y0 + 11 + lin * 27.5;
      mesEmGrade(fo, m, x + 1, y, colW - 2, { ano: a, semFeriados: true, tamNome: 6.8, tamNum: 5.6, passo: 3.1, tamSem: 5.6 });
      if (col > 0) fo.linha(x, y - 3.5, x, y + 21, 0.35);
    }
  });
}

function icone(fo: Folha, cx: number, cy: number, fase: FaseLua) {
  const r = 1.7;
  if (fase === "nova") fo.page.drawCircle({ x: cx * PT_POR_MM, y: (H - cy) * PT_POR_MM, size: r * PT_POR_MM, color: PRETO, borderWidth: 0.5, borderColor: PRETO });
  else {
    fo.circulo(cx, cy, r, 0.5);
    if (fase !== "cheia") {
      // meia lua escura: a face voltada para o lado escuro (hemisfério sul)
      const R = r * PT_POR_MM;
      const lado = fase === "crescente" ? 1 : 0;
      fo.page.drawSvgPath(`M 0 ${-R} A ${R} ${R} 0 0 ${lado} 0 ${R} Z`, { x: cx * PT_POR_MM, y: (H - cy) * PT_POR_MM, color: PRETO, borderWidth: 0 });
    }
  }
}

function desenharPlanejamento(fo: Folha, mes: number) {
  const { cfg, feriados, luas } = fo.ctx;
  const ano = cfg.ano;
  fo.titulo("PLANEJAMENTO", MESES[mes - 1], 13);
  let xTexto = fo.esq;
  if (cfg.luas) {
    const doMes = luas.filter((l) => l.mes === mes);
    doMes.forEach((l, i) => {
      const cx = fo.esq + 3 + i * 8.5;
      icone(fo, cx, 24.5, l.fase);
      fo.texto(String(l.dia).padStart(2, "0"), cx, 30, 6.3, { alinhar: "c" });
    });
    const xDiv = fo.esq + 3 + Math.max(doMes.length, 4) * 8.5 + 1;
    fo.linha(xDiv, 20, xDiv, 31, 0.5);
    xTexto = xDiv + 3;
  }
  feriados
    .filter((f) => f.mes === mes)
    .slice(0, 3)
    .forEach((f, i) => fo.texto(`${String(f.dia).padStart(2, "0")} ${MESES_CURTOS[mes - 1]}  ${f.nome}`, xTexto, 24.5 + i * 3.6, 6.3));
  const n = diasNoMes(ano, mes);
  const colW = (fo.dir - fo.esq) / 4;
  const linhaH = 20.3;
  for (let d = 1; d <= n; d++) {
    const col = (d - 1) % 4;
    const lin = Math.floor((d - 1) / 4);
    const x = fo.esq + col * colW;
    const y = 36 + lin * linhaH;
    const sem = diaDaSemana(ano, mes, d);
    const cor = cfg.destaque && (sem === 0 || ehFeriado(feriados, mes, d)) ? CINZA_ESCURO : PRETO;
    fo.texto(String(d).padStart(2, "0"), x + 0.5, y + 4, 8, { cor });
    fo.texto(SEMANA_CURTA[sem], x + 0.5 + fo.largura(String(d).padStart(2, "0") + " ", 8), y + 4, 5.2, { cor });
    fo.linha(x, y + linhaH - 0.4, x + colW - 0.5, y + linhaH - 0.4, 0.5);
    fo.linha(x + colW - 0.5, y + 7, x + colW - 0.5, y + linhaH - 0.4, 0.5);
  }
}

/** Cabeçalho de um dia: pontos, mês, dia da semana por extenso e o número grande. */
function cabecalhoDia(fo: Folha, mes: number, dia: number, y0: number) {
  const { cfg, feriados } = fo.ctx;
  const sem = diaDaSemana(cfg.ano, mes, dia);
  const cor = cfg.destaque && (sem === 0 || ehFeriado(feriados, mes, dia)) ? CINZA_ESCURO : PRETO;
  const num = String(dia).padStart(2, "0");
  const tamNum = 30;
  const wNum = fo.largura(num, tamNum, "extra");
  const nomeSem = SEMANA_LONGA[sem];
  const wMes = fo.largura(MESES[mes - 1], 11, "negrito");
  const wSem = fo.largura(nomeSem, 6.2);
  const wTexto = Math.max(wMes, wSem);
  const yBase = y0 + 11;
  if (fo.recto) {
    const xNum = fo.dir - wNum;
    fo.texto(num, xNum, yBase, tamNum, { peso: "extra", cor });
    const xDiv = xNum - 2.8;
    fo.linha(xDiv, y0, xDiv, y0 + 12.5, 0.6);
    fo.texto(MESES[mes - 1], xDiv - 2.5, y0 + 6.5, 11, { peso: "negrito", alinhar: "d" });
    fo.texto(nomeSem, xDiv - 2.5, y0 + 11, 6.2, { alinhar: "d" });
    fo.pontos(fo.esq, y0, xDiv - 2.5 - wTexto - 3, y0 + 12);
  } else {
    fo.texto(num, fo.esq, yBase, tamNum, { peso: "extra", cor });
    const xDiv = fo.esq + wNum + 2.8;
    fo.linha(xDiv, y0, xDiv, y0 + 12.5, 0.6);
    fo.texto(MESES[mes - 1], xDiv + 2.5, y0 + 6.5, 11, { peso: "negrito" });
    fo.texto(nomeSem, xDiv + 2.5, y0 + 11, 6.2);
    fo.pontos(xDiv + 2.5 + wTexto + 3, y0, fo.dir, y0 + 12);
  }
}

/** Linhas do dia: com as horas (08h…) ou pautado liso. `pitch` = distância entre horas. */
function linhasDoDia(fo: Folha, yInicio: number, de: number, ate: number, pitch: number) {
  if (fo.ctx.cfg.estiloDia === "linhas") {
    const n = ate - de + 1;
    const fim = yInicio + (n - 1) * pitch + pitch / 2;
    for (let y = yInicio; y <= fim + 0.01; y += pitch / 2) fo.linha(fo.esq, y, fo.dir, y, y === yInicio ? 0.5 : 0.35, y === yInicio ? PRETO : CINZA_CLARO);
    return;
  }
  for (let h = de; h <= ate; h++) {
    const y = yInicio + (h - de) * pitch;
    fo.texto(String(h).padStart(2, "0") + "h", fo.esq, y - 0.8, 7);
    fo.linha(fo.esq + 6.5, y, fo.dir, y, 0.5);
    fo.linha(fo.esq, y + pitch / 2, fo.dir, y + pitch / 2, 0.3, CINZA_CLARO);
  }
}

function rodapeDoDia(fo: Folha, mes: number) {
  const y = 176;
  const larguraMini = 34;
  const xMini = fo.recto ? fo.esq : fo.dir - larguraMini;
  const xBox = fo.recto ? fo.esq + larguraMini + 4 : fo.esq;
  const wBox = fo.dir - fo.esq - larguraMini - 4;
  mesEmGrade(fo, mes, xMini, y + 2, larguraMini, { tamNome: 6.3, tamNum: 5.2, passo: 2.9, tamSem: 5.2 });
  fo.retangulo(xBox, y, wBox, 22, 0.5);
  const t = "ANOTAÇÕES";
  const wt = fo.largura(t, 6.5) + 3;
  const xt = fo.recto ? fo.dir - wt - 2 : xBox + 2;
  fo.fundoBranco(xt, y - 0.6, wt, 1.3);
  fo.texto(t, xt + 1.5, y + 0.9, 6.5);
}

function anotarFeriado(fo: Folha, mes: number, dia: number, y: number) {
  const f = fo.ctx.feriados.find((x) => x.mes === mes && x.dia === dia);
  if (!f) return;
  fo.texto(f.nome, fo.recto ? fo.dir : fo.esq, y, 6.3, { alinhar: fo.recto ? "d" : "e", cor: CINZA });
}

function desenharDia(fo: Folha, mes: number, dia: number) {
  const { cfg } = fo.ctx;
  cabecalhoDia(fo, mes, dia, 9);
  anotarFeriado(fo, mes, dia, 24);
  const n = cfg.horaFim - cfg.horaInicio + 1;
  const pitch = Math.min(14, (171 - 29) / (n - 1 + 0.5));
  linhasDoDia(fo, 29, cfg.horaInicio, cfg.horaFim, pitch);
  rodapeDoDia(fo, mes);
}

function desenharFimDeSemana(fo: Folha, mes: number, sabado: number | null, domingo: number | null) {
  const { cfg } = fo.ctx;
  if (sabado !== null && domingo !== null) {
    const ate = Math.min(cfg.horaFim, cfg.horaInicio + 4);
    cabecalhoDia(fo, mes, sabado, 9);
    anotarFeriado(fo, mes, sabado, 24);
    linhasDoDia(fo, 29, cfg.horaInicio, ate, 13.2);
    cabecalhoDia(fo, mes, domingo, 93);
    anotarFeriado(fo, mes, domingo, 108);
    linhasDoDia(fo, 113, cfg.horaInicio, ate, 13.2);
    rodapeDoDia(fo, mes);
  } else {
    // sábado ou domingo sozinho (virada de mês): página inteira
    desenharDia(fo, mes, (sabado ?? domingo) as number);
  }
}

/** Bloco de um dia na agenda semanal: número, dia da semana e linhas para escrever. */
function blocoDia(fo: Folha, d: Dia, x: number, y: number, w: number, h: number) {
  if (!d) return;
  const { cfg, feriados } = fo.ctx;
  const sem = diaDaSemana(cfg.ano, d.mes, d.dia);
  const cor = cfg.destaque && (sem === 0 || ehFeriado(feriados, d.mes, d.dia)) ? CINZA_ESCURO : PRETO;
  const num = String(d.dia).padStart(2, "0");
  fo.texto(num, x, y + 5.5, 12, { peso: "extra", cor });
  const wn = fo.largura(num, 12, "extra");
  fo.texto(`${SEMANA_LONGA[sem]} · ${MESES[d.mes - 1].slice(0, 3)}`, x + wn + 2, y + 5.5, 6.3);
  const fer = feriados.find((f) => f.mes === d.mes && f.dia === d.dia);
  if (fer && w > 60) fo.texto(fer.nome, x + w, y + 5.5, 6, { alinhar: "d", cor: CINZA });
  fo.linha(x, y + 7.5, x + w, y + 7.5, 0.6);
  for (let yy = y + 14.5; yy < y + h - 1; yy += 7) fo.linha(x, yy, x + w, yy, 0.3, CINZA_CLARO);
}

function desenharSemana(fo: Folha, mes: number, dias: Dia[], lado: "esq" | "dir") {
  // 1ª semana do ano começando no meio (ex.: quinta): a página da esquerda ficaria sem nenhum dia, vira anotações
  if (lado === "esq" && dias.slice(0, 3).every((d) => !d)) {
    desenharAnotacoes(fo);
    return;
  }
  const validos = dias.filter((d): d is { mes: number; dia: number } => !!d);
  const a = validos[0];
  const b = validos[validos.length - 1];
  const periodo = `${String(a.dia).padStart(2, "0")} ${MESES_CURTOS[a.mes - 1].toUpperCase()} – ${String(b.dia).padStart(2, "0")} ${MESES_CURTOS[b.mes - 1].toUpperCase()}`;
  fo.titulo("SEMANA", periodo, 13, 11);
  void mes;
  const largura = fo.dir - fo.esq;
  const altura = 56;
  if (lado === "esq") {
    for (let i = 0; i < 3; i++) blocoDia(fo, dias[i], fo.esq, 22 + i * (altura + 2), largura, altura);
  } else {
    blocoDia(fo, dias[3], fo.esq, 22, largura, altura);
    blocoDia(fo, dias[4], fo.esq, 22 + altura + 2, largura, altura);
    const meio = (largura - 4) / 2;
    blocoDia(fo, dias[5], fo.esq, 22 + 2 * (altura + 2), meio, altura);
    blocoDia(fo, dias[6], fo.esq + meio + 4, 22 + 2 * (altura + 2), meio, altura);
  }
}

function desenharAnotacoes(fo: Folha) {
  fo.titulo("", "ANOTAÇÕES", 13);
  for (let y = 26; y <= 200; y += 7.5) fo.linha(fo.esq, y, fo.dir, y, 0.35, CINZA);
}

export interface Miolo {
  /** PDF A5 (148 × 210 mm), uma página por página do miolo. */
  bytes: Uint8Array;
  plano: Plano;
  feriados: Feriado[];
  /** Fonte usada (Montserrat quando as fontes foram carregadas). */
  fonte: "montserrat" | "helvetica";
}

async function embutirImagem(doc: PDFDocument, img: Imagem): Promise<PDFImage> {
  return img.tipo === "jpg" ? doc.embedJpg(img.bytes) : doc.embedPng(img.bytes);
}

async function criarFontes(doc: PDFDocument, externas?: FontesExternas | null): Promise<{ f: Fontes; k: number; nome: "montserrat" | "helvetica" }> {
  if (externas) {
    try {
      doc.registerFontkit(externas.fontkit as never);
      const [leve, normal, negrito, extra] = await Promise.all([
        doc.embedFont(externas.leve, { subset: true }),
        doc.embedFont(externas.normal, { subset: true }),
        doc.embedFont(externas.negrito, { subset: true }),
        doc.embedFont(externas.extra, { subset: true }),
      ]);
      return { f: { leve, normal, negrito, extra }, k: 0.9, nome: "montserrat" };
    } catch {
      /* fonte não abriu: segue com a Helvetica */
    }
  }
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  return { f: { leve: normal, normal, negrito, extra: negrito }, k: 1, nome: "helvetica" };
}

type ExtraEmbutido = { tipo: "pdf"; paginas: (Awaited<ReturnType<PDFDocument["embedPage"]>> | null)[] } | { tipo: "imagem"; img: PDFImage };

/** Gera o miolo em A5. */
export async function gerarMiolo(entrada: ConfigAgenda, externas?: FontesExternas | null): Promise<Miolo> {
  const cfg = normalizar(entrada);
  const feriados = todosOsFeriados(cfg.ano, cfg.regionais);
  const luas = fasesDaLua(cfg.ano);
  const plano = planejarPaginas(cfg.ano, cfg.total, { modelo: cfg.modelo, extras: cfg.extras.map((e) => ({ posicao: e.posicao, paginas: e.paginas })) });
  const doc = await PDFDocument.create();
  const { f, k, nome } = await criarFontes(doc, externas);
  const logo = cfg.identidade.logo ? await embutirImagem(doc, cfg.identidade.logo) : null;
  const marcaImg = cfg.marcaDagua.ativa && cfg.marcaDagua.tipo === "logo" && cfg.marcaDagua.logo ? await embutirImagem(doc, cfg.marcaDagua.logo) : null;
  const extras: ExtraEmbutido[] = [];
  for (const e of cfg.extras) {
    if (e.tipo === "pdf") {
      const origem = await PDFDocument.load(e.bytes);
      const paginas = [];
      for (const p of origem.getPages()) paginas.push(p.node.Contents() ? await doc.embedPage(p) : null);
      extras.push({ tipo: "pdf", paginas });
    } else {
      extras.push({ tipo: "imagem", img: e.tipo === "jpg" ? await doc.embedJpg(e.bytes) : await doc.embedPng(e.bytes) });
    }
  }
  const ctx: Contexto = { cfg, feriados, luas, f, k, logo };
  const larguraPt = W * PT_POR_MM;
  const alturaPt = H * PT_POR_MM;
  const semMarca = new Set(["capa", "branca", "extra"]);
  const comRodape = new Set(["dados", "calendarioAno", "calendariosVizinhos", "planejamento", "dia", "fimDeSemana", "semana", "anotacoes"]);
  const marcaSoDias = new Set(["dia", "fimDeSemana", "semana", "anotacoes"]);
  plano.paginas.forEach((p, i) => {
    const page = doc.addPage([larguraPt, alturaPt]);
    const fo = new Folha(page, ctx, i + 1);
    if (!semMarca.has(p.tipo) && (cfg.marcaDagua.onde === "todas" || marcaSoDias.has(p.tipo))) marcaDagua(fo, marcaImg);
    switch (p.tipo) {
      case "capa":
        desenharCapa(fo);
        break;
      case "branca":
        desenharVersoDaCapa(fo);
        break;
      case "dados":
        desenharDados(fo);
        break;
      case "calendarioAno":
        desenharCalendarioAno(fo);
        break;
      case "calendariosVizinhos":
        desenharVizinhos(fo);
        break;
      case "planejamento":
        desenharPlanejamento(fo, p.mes);
        break;
      case "dia":
        desenharDia(fo, p.mes, p.dia);
        break;
      case "fimDeSemana":
        desenharFimDeSemana(fo, p.mes, p.sabado, p.domingo);
        break;
      case "semana":
        desenharSemana(fo, p.mes, p.dias, p.lado);
        break;
      case "anotacoes":
        desenharAnotacoes(fo);
        break;
      case "extra": {
        const e = extras[p.item];
        if (e.tipo === "pdf") {
          const ep = e.paginas[p.pagina];
          if (ep) {
            const pl = planejarTamanho(ep.width, ep.height, larguraPt, alturaPt, "caber", false);
            page.drawPage(ep, { x: pl.destX, y: pl.destY, xScale: pl.escala, yScale: pl.escala });
          }
        } else {
          const s = Math.min(larguraPt / e.img.width, alturaPt / e.img.height);
          page.drawImage(e.img, { x: (larguraPt - e.img.width * s) / 2, y: (alturaPt - e.img.height * s) / 2, width: e.img.width * s, height: e.img.height * s });
        }
        break;
      }
      default:
        break;
    }
    if (comRodape.has(p.tipo)) rodapeIdentidade(fo);
  });
  doc.setTitle(`Miolo de agenda ${cfg.ano}`);
  return { bytes: await doc.save(), plano, feriados, fonte: nome };
}

/**
 * A4 em paisagem com 2 miolos por folha: cada página do A5 aparece duas vezes, lado a lado.
 * Imprime-se em frente e verso virando pela borda curta e corta-se ao meio na guilhotina.
 */
export async function miolosEmA4(a5: Uint8Array): Promise<Uint8Array> {
  const origem = await PDFDocument.load(a5);
  const saida = await PDFDocument.create();
  const A4W = 297 * PT_POR_MM;
  const A4H = 210 * PT_POR_MM;
  for (const original of origem.getPages()) {
    const page = saida.addPage([A4W, A4H]);
    // página em branco (verso da capa) não tem conteúdo para embutir: fica o A4 em branco
    if (!original.node.Contents()) continue;
    const p = await saida.embedPage(original);
    const x0 = Math.max(0, (A4W / 2 - p.width) / 2); // centraliza cada miolo na sua metade
    page.drawPage(p, { x: x0, y: 0 });
    page.drawPage(p, { x: A4W / 2 + x0, y: 0 });
  }
  return saida.save();
}

// ─── Capa e contracapa ───────────────────────────────────────────────

export interface ConfigCapa {
  ano: number;
  titulo: string;
  /** Cor de fundo, "#rrggbb". */
  cor: string;
  linha1: string;
  linha2: string;
  /** Contato na contracapa (uma linha por linha de texto). */
  contato: string;
  logo: Imagem | null;
  usarLogo: boolean;
}

export function corParaRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m ? Number.parseInt(m[1], 16) : 0x202020;
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

/** Capa e contracapa em A5, com sangria (TrimBox no tamanho final), prontas para a Montagem de impressos. */
export async function gerarCapas(c: ConfigCapa, externas?: FontesExternas | null): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const { f, k } = await criarFontes(doc, externas);
  const b = SANGRIA_PADRAO_MM;
  const [r, g, bl] = corParaRgb(c.cor);
  const claro = 0.299 * r + 0.587 * g + 0.114 * bl > 0.6;
  const cor = claro ? rgb(0.1, 0.1, 0.1) : rgb(1, 1, 1);
  const logo = c.usarLogo && c.logo ? await embutirImagem(doc, c.logo) : null;
  const pw = (W + 2 * b) * PT_POR_MM;
  const ph = (H + 2 * b) * PT_POR_MM;
  const texto = (page: PDFPage, s: string, y: number, tam: number, peso: Peso, opacidade = 1) => {
    if (!s.trim()) return;
    const t = tam * k;
    const w = f[peso].widthOfTextAtSize(s, t) / PT_POR_MM;
    page.drawText(s, { x: (b + W / 2 - w / 2) * PT_POR_MM, y: (H + b - y) * PT_POR_MM, size: t, font: f[peso], color: cor, opacity: opacidade });
  };
  const desenharLogo = (page: PDFPage, larguraMm: number, centroY: number) => {
    if (!logo || !c.logo) return 0;
    const alt = larguraMm * (c.logo.h / c.logo.w);
    page.drawImage(logo, { x: (b + W / 2 - larguraMm / 2) * PT_POR_MM, y: (H + b - centroY - alt / 2) * PT_POR_MM, width: larguraMm * PT_POR_MM, height: alt * PT_POR_MM });
    return alt;
  };
  const fundo = (page: PDFPage) => page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: rgb(r, g, bl) });
  const caixas = (page: PDFPage) => {
    page.setTrimBox(b * PT_POR_MM, b * PT_POR_MM, W * PT_POR_MM, H * PT_POR_MM);
    page.setBleedBox(0, 0, pw, ph);
  };

  const capa = doc.addPage([pw, ph]);
  fundo(capa);
  desenharLogo(capa, Math.min(76, 0.6 * W), 52);
  texto(capa, (c.titulo || "AGENDA").toUpperCase(), 118, 36, "leve");
  texto(capa, String(c.ano), 143, 62, "extra");
  capa.drawLine({ start: { x: (b + W / 2 - 15) * PT_POR_MM, y: (H + b - 156) * PT_POR_MM }, end: { x: (b + W / 2 + 15) * PT_POR_MM, y: (H + b - 156) * PT_POR_MM }, thickness: 1, color: cor });
  texto(capa, c.linha1, 178, 14, "negrito");
  texto(capa, c.linha2, 187, 9, "normal", 0.85);
  caixas(capa);

  const contra = doc.addPage([pw, ph]);
  fundo(contra);
  const alt = desenharLogo(contra, 52, 78);
  c.contato
    .split("\n")
    .slice(0, 6)
    .forEach((l, i) => texto(contra, l, 78 + alt / 2 + 16 + i * 6.5, 8.5, "normal", 0.9));
  caixas(contra);
  doc.setTitle(`Capa e contracapa ${c.ano}`);
  return doc.save();
}
