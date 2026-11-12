// Pré-impressão → "Miolo de agenda": gera o miolo de uma agenda anual em A5 (e em A4 com 2 miolos
// por folha) no padrão que a gráfica imprime: capa com o título na borda, dados pessoais, calendário
// do ano com feriados circulados, planejamento do mês com fases da lua e uma página por dia útil
// (sábado e domingo juntos), com horas das 08h às 18h, mini calendário e anotações.
// Tudo calculado e desenhado no navegador (pdf-lib), sem IA e sem custo. Feriados nacionais entram
// sempre; feriados regionais são acrescentados pela pessoa.

import { LineCapStyle, PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { PT_POR_MM } from "./folha";

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

// ─── Plano de páginas ────────────────────────────────────────────────

export type TipoPagina =
  | { tipo: "capa" }
  | { tipo: "branca" }
  | { tipo: "dados" }
  | { tipo: "calendarioAno" }
  | { tipo: "calendariosVizinhos" }
  | { tipo: "planejamento"; mes: number }
  | { tipo: "dia"; mes: number; dia: number }
  | { tipo: "fimDeSemana"; mes: number; sabado: number | null; domingo: number | null }
  | { tipo: "anotacoes" };

export interface Plano {
  paginas: TipoPagina[];
  /** Página (a partir de 0) do planejamento de cada mês. */
  paginaDoMes: number[];
  /** Quantas páginas o miolo precisa no mínimo. */
  minimo: number;
}

/**
 * Ordem das páginas, como no miolo impresso: capa, verso em branco, dados pessoais, calendário do ano,
 * calendários do ano anterior e seguinte; depois, por mês, o planejamento (sempre na página da esquerda,
 * no verso da folha), uma página por dia da semana e uma por sábado + domingo; no fim, anotações.
 * `total` (par) completa com páginas de anotações; menor que o mínimo vale o mínimo.
 */
export function planejarPaginas(ano: number, total?: number | null): Plano {
  const paginas: TipoPagina[] = [{ tipo: "capa" }, { tipo: "branca" }, { tipo: "dados" }, { tipo: "calendarioAno" }, { tipo: "calendariosVizinhos" }];
  const paginaDoMes: number[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    // o planejamento cai na página da esquerda (número par): completa com anotações se preciso
    if ((paginas.length + 1) % 2 !== 0) paginas.push({ tipo: "anotacoes" });
    paginaDoMes.push(paginas.length);
    paginas.push({ tipo: "planejamento", mes });
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
const CINZA_CLARO = rgb(0.78, 0.78, 0.78);

interface Fontes {
  normal: PDFFont;
  negrito: PDFFont;
}

/** Uma página sendo desenhada (medidas em mm a partir do canto superior esquerdo). */
class Folha {
  /** Página da direita (ímpar): a encadernação fica à esquerda. */
  readonly recto: boolean;
  readonly esq: number;
  readonly dir: number;
  constructor(
    readonly page: PDFPage,
    readonly f: Fontes,
    numero: number,
  ) {
    this.recto = numero % 2 === 1;
    this.esq = this.recto ? MARGEM_INTERNA : MARGEM_EXTERNA;
    this.dir = W - (this.recto ? MARGEM_EXTERNA : MARGEM_INTERNA);
  }

  private Y(y: number) {
    return (H - y) * PT_POR_MM;
  }
  private X(x: number) {
    return x * PT_POR_MM;
  }

  texto(s: string, x: number, y: number, tamanho: number, o: { negrito?: boolean; alinhar?: "e" | "c" | "d"; cor?: ReturnType<typeof rgb> } = {}) {
    const fonte = o.negrito ? this.f.negrito : this.f.normal;
    const w = fonte.widthOfTextAtSize(s, tamanho) / PT_POR_MM;
    const xi = o.alinhar === "d" ? x - w : o.alinhar === "c" ? x - w / 2 : x;
    this.page.drawText(s, { x: this.X(xi), y: this.Y(y), size: tamanho, font: fonte, color: o.cor ?? PRETO });
    return w;
  }

  largura(s: string, tamanho: number, negrito = false) {
    return (negrito ? this.f.negrito : this.f.normal).widthOfTextAtSize(s, tamanho) / PT_POR_MM;
  }

  linha(x1: number, y1: number, x2: number, y2: number, espessura = 0.5, cor = PRETO) {
    this.page.drawLine({ start: { x: this.X(x1), y: this.Y(y1) }, end: { x: this.X(x2), y: this.Y(y2) }, thickness: espessura, color: cor });
  }

  /** Grade de pontinhos (uma linha tracejada com pontas redondas por fileira). */
  pontos(x1: number, y1: number, x2: number, y2: number, passo = 2.2) {
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

  /** Cabeçalho "PLANEJAMENTO **JANEIRO**": pontos do lado da encadernação, título do lado de fora. */
  titulo(leve: string, forte: string, y = 14, tamanho = 12) {
    const w1 = this.largura(leve + " ", tamanho);
    const w2 = this.largura(forte, tamanho, true);
    if (this.recto) {
      const x0 = this.dir - w1 - w2;
      this.texto(leve + " ", x0, y, tamanho);
      this.texto(forte, x0 + w1, y, tamanho, { negrito: true });
      this.pontos(this.esq, y - 6, x0 - 3, y + 1);
    } else {
      this.texto(leve + " ", this.esq, y, tamanho);
      this.texto(forte, this.esq + w1, y, tamanho, { negrito: true });
      this.pontos(this.esq + w1 + w2 + 3, y - 6, this.dir, y + 1);
    }
  }
}

function ehFeriado(feriados: Feriado[], mes: number, dia: number) {
  return feriados.some((f) => f.mes === mes && f.dia === dia);
}

/** Um mês em grade (D S T Q Q S S), com os feriados circulados. */
function mesEmGrade(
  fo: Folha,
  ano: number,
  mes: number,
  x: number,
  y: number,
  largura: number,
  feriados: Feriado[],
  o: { nome?: boolean; tamNome?: number; tamNum?: number; passo?: number; tamSem?: number } = {},
) {
  const tamNome = o.tamNome ?? 8;
  const tamNum = o.tamNum ?? 7;
  const tamSem = o.tamSem ?? 7;
  const passo = o.passo ?? 4;
  const celula = largura / 7;
  let yy = y;
  if (o.nome !== false) {
    fo.texto(MESES[mes - 1], x + largura / 2, yy, tamNome, { alinhar: "c" });
    yy += passo * 1.25;
  }
  ["D", "S", "T", "Q", "Q", "S", "S"].forEach((s, i) => fo.texto(s, x + celula * (i + 0.5), yy, tamSem, { negrito: true, alinhar: "c" }));
  yy += passo * 1.05;
  const primeiro = diaDaSemana(ano, mes, 1);
  const n = diasNoMes(ano, mes);
  for (let d = 1; d <= n; d++) {
    const pos = primeiro + d - 1;
    const col = pos % 7;
    const lin = Math.floor(pos / 7);
    const cx = x + celula * (col + 0.5);
    const cy = yy + lin * passo;
    fo.texto(String(d), cx, cy, tamNum, { alinhar: "c" });
    if (ehFeriado(feriados, mes, d)) fo.circulo(cx, cy - tamNum * 0.17, Math.min(celula * 0.5, passo * 0.62));
  }
}

function desenharCapa(fo: Folha, ano: number, texto: string) {
  const tam = 54;
  const leve = texto.toUpperCase();
  const w1 = fo.largura(leve, tam);
  const w2 = fo.largura(String(ano), tam, true);
  const total = w1 + w2;
  const base = fo.dir - 1; // linha de base do texto girado: o corpo das letras fica à esquerda dela
  const y0 = (H + total) / 2; // começa embaixo e lê para cima
  const rotaciona = (s: string, y: number, negrito: boolean) =>
    fo.page.drawText(s, { x: base * PT_POR_MM, y: (H - y) * PT_POR_MM, size: tam, font: negrito ? fo.f.negrito : fo.f.normal, color: PRETO, rotate: degrees(90) });
  rotaciona(leve, y0, false);
  rotaciona(String(ano), y0 - w1, true);
  const alturaLetra = tam * 0.72 / PT_POR_MM;
  const xi = base - alturaLetra;
  fo.pontos(xi, 5, fo.dir, y0 - total - 4, 2.2);
  fo.pontos(xi, y0 + 4, fo.dir, H - 5, 2.2);
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

function desenharCalendarioAno(fo: Folha, ano: number, feriados: Feriado[]) {
  // título
  fo.texto("CALENDÁRIO", fo.esq, 12, 11);
  const wt = fo.largura("CALENDÁRIO ", 11);
  fo.texto(String(ano), fo.esq + wt, 12, 11, { negrito: true });
  fo.pontos(fo.esq + wt + fo.largura(String(ano), 11, true) + 3, 6.5, fo.dir, 13);
  const colW = (fo.dir - fo.esq) / 3;
  const linhaH = 34.5;
  for (let m = 1; m <= 12; m++) {
    const col = (m - 1) % 3;
    const lin = Math.floor((m - 1) / 3);
    const x = fo.esq + col * colW;
    const y = 24 + lin * linhaH;
    mesEmGrade(fo, ano, m, x + 1.5, y, colW - 3, feriados, { tamNome: 8, tamNum: 6.8, passo: 3.9, tamSem: 6.8 });
    if (col > 0) fo.linha(x, y - 4, x, y + 28, 0.4);
    if (col === 0 && lin > 0) fo.linha(fo.esq, y - 4.6, fo.dir, y - 4.6, 0.4);
  }
  // lista de feriados
  const yl = 168;
  fo.texto("FERIADOS E DIAS SANTIFICADOS", fo.esq, yl, 8.5);
  fo.pontos(fo.esq + fo.largura("FERIADOS E DIAS SANTIFICADOS ", 8.5) + 2, yl - 4.5, fo.dir, yl + 0.5, 1.8);
  const colunas = 3;
  const porColuna = Math.ceil(feriados.length / colunas);
  const passo = Math.min(4.6, 28 / Math.max(porColuna, 1));
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

function desenharVizinhos(fo: Folha, ano: number) {
  [ano - 1, ano + 1].forEach((a, i) => {
    const y0 = 12 + i * 100;
    fo.titulo("CALENDÁRIO", String(a), y0, 11);
    const colW = (fo.dir - fo.esq) / 4;
    for (let m = 1; m <= 12; m++) {
      const col = (m - 1) % 4;
      const lin = Math.floor((m - 1) / 4);
      const x = fo.esq + col * colW;
      const y = y0 + 11 + lin * 27.5;
      mesEmGrade(fo, a, m, x + 1, y, colW - 2, [], { tamNome: 6.8, tamNum: 5.6, passo: 3.1, tamSem: 5.6 });
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

function desenharPlanejamento(fo: Folha, ano: number, mes: number, feriados: Feriado[], luas: { mes: number; dia: number; fase: FaseLua }[]) {
  fo.titulo("PLANEJAMENTO", MESES[mes - 1], 13);
  const doMes = luas.filter((l) => l.mes === mes);
  doMes.forEach((l, i) => {
    const cx = fo.esq + 3 + i * 8.5;
    icone(fo, cx, 24.5, l.fase);
    fo.texto(String(l.dia).padStart(2, "0"), cx, 30, 6.3, { alinhar: "c" });
  });
  const xDiv = fo.esq + 3 + Math.max(doMes.length, 4) * 8.5 + 1;
  fo.linha(xDiv, 20, xDiv, 31, 0.5);
  feriados
    .filter((f) => f.mes === mes)
    .slice(0, 3)
    .forEach((f, i) => fo.texto(`${String(f.dia).padStart(2, "0")} ${MESES_CURTOS[mes - 1]}  ${f.nome}`, xDiv + 3, 24.5 + i * 3.6, 6.3));
  const n = diasNoMes(ano, mes);
  const colW = (fo.dir - fo.esq) / 4;
  const linhaH = 20.8;
  for (let d = 1; d <= n; d++) {
    const col = (d - 1) % 4;
    const lin = Math.floor((d - 1) / 4);
    const x = fo.esq + col * colW;
    const y = 36 + lin * linhaH;
    fo.texto(String(d).padStart(2, "0"), x + 0.5, y + 4, 8);
    fo.texto(SEMANA_CURTA[diaDaSemana(ano, mes, d)], x + 0.5 + fo.largura(String(d).padStart(2, "0") + " ", 8), y + 4, 5.2);
    fo.linha(x, y + linhaH - 0.4, x + colW - 0.5, y + linhaH - 0.4, 0.5);
    fo.linha(x + colW - 0.5, y + 7, x + colW - 0.5, y + linhaH - 0.4, 0.5);
  }
}

/** Cabeçalho de um dia: pontos, mês, dia da semana por extenso e o número grande. */
function cabecalhoDia(fo: Folha, ano: number, mes: number, dia: number, y0: number) {
  const num = String(dia).padStart(2, "0");
  const tamNum = 30;
  const wNum = fo.largura(num, tamNum, true);
  const sem = SEMANA_LONGA[diaDaSemana(ano, mes, dia)];
  const wMes = fo.largura(MESES[mes - 1], 11, true);
  const wSem = fo.largura(sem, 6.2);
  const wTexto = Math.max(wMes, wSem);
  const yBase = y0 + 11;
  if (fo.recto) {
    const xNum = fo.dir - wNum;
    fo.texto(num, xNum, yBase, tamNum, { negrito: true });
    const xDiv = xNum - 2.8;
    fo.linha(xDiv, y0, xDiv, y0 + 12.5, 0.6);
    fo.texto(MESES[mes - 1], xDiv - 2.5, y0 + 6.5, 11, { negrito: true, alinhar: "d" });
    fo.texto(sem, xDiv - 2.5, y0 + 11, 6.2, { alinhar: "d" });
    fo.pontos(fo.esq, y0, xDiv - 2.5 - wTexto - 3, y0 + 12);
  } else {
    fo.texto(num, fo.esq, yBase, tamNum, { negrito: true });
    const xDiv = fo.esq + wNum + 2.8;
    fo.linha(xDiv, y0, xDiv, y0 + 12.5, 0.6);
    fo.texto(MESES[mes - 1], xDiv + 2.5, y0 + 6.5, 11, { negrito: true });
    fo.texto(sem, xDiv + 2.5, y0 + 11, 6.2);
    fo.pontos(xDiv + 2.5 + wTexto + 3, y0, fo.dir, y0 + 12);
  }
}

function horas(fo: Folha, yInicio: number, de: number, ate: number) {
  const passo = 14;
  for (let h = de; h <= ate; h++) {
    const y = yInicio + (h - de) * passo;
    fo.texto(String(h).padStart(2, "0") + "h", fo.esq, y - 0.8, 7);
    fo.linha(fo.esq + 6.5, y, fo.dir, y, 0.5);
    fo.linha(fo.esq, y + passo / 2, fo.dir, y + passo / 2, 0.3, CINZA_CLARO);
  }
}

function rodape(fo: Folha, ano: number, mes: number, feriados: Feriado[]) {
  const y = 181;
  const larguraMini = 34;
  const xMini = fo.recto ? fo.esq : fo.dir - larguraMini;
  const xBox = fo.recto ? fo.esq + larguraMini + 4 : fo.esq;
  const wBox = fo.dir - fo.esq - larguraMini - 4;
  mesEmGrade(fo, ano, mes, xMini, y + 2, larguraMini, feriados, { tamNome: 6.3, tamNum: 5.2, passo: 3.1, tamSem: 5.2 });
  fo.retangulo(xBox, y, wBox, 24, 0.5);
  const t = "ANOTAÇÕES";
  const wt = fo.largura(t, 6.5) + 3;
  const xt = fo.recto ? fo.dir - wt - 2 : xBox + 2;
  fo.fundoBranco(xt, y - 0.6, wt, 1.3);
  fo.texto(t, xt + 1.5, y + 0.9, 6.5);
}

function anotarFeriado(fo: Folha, feriados: Feriado[], mes: number, dia: number, y: number) {
  const f = feriados.find((x) => x.mes === mes && x.dia === dia);
  if (!f) return;
  fo.texto(f.nome, fo.recto ? fo.dir : fo.esq, y, 6.3, { alinhar: fo.recto ? "d" : "e", cor: CINZA });
}

function desenharDia(fo: Folha, ano: number, mes: number, dia: number, feriados: Feriado[]) {
  cabecalhoDia(fo, ano, mes, dia, 9);
  anotarFeriado(fo, feriados, mes, dia, 24);
  horas(fo, 29, 8, 18);
  rodape(fo, ano, mes, feriados);
}

function desenharFimDeSemana(fo: Folha, ano: number, mes: number, sabado: number | null, domingo: number | null, feriados: Feriado[]) {
  if (sabado !== null && domingo !== null) {
    cabecalhoDia(fo, ano, mes, sabado, 9);
    anotarFeriado(fo, feriados, mes, sabado, 24);
    horas(fo, 29, 8, 12);
    cabecalhoDia(fo, ano, mes, domingo, 95);
    anotarFeriado(fo, feriados, mes, domingo, 110);
    horas(fo, 115, 8, 12);
    rodape(fo, ano, mes, feriados);
  } else {
    // sábado ou domingo sozinho (virada de mês): página inteira
    desenharDia(fo, ano, mes, (sabado ?? domingo) as number, feriados);
  }
}

function desenharAnotacoes(fo: Folha, titulo = "ANOTAÇÕES") {
  fo.titulo("", titulo, 13);
  for (let y = 26; y <= 200; y += 7.5) fo.linha(fo.esq, y, fo.dir, y, 0.35, CINZA);
}

export interface ConfigAgenda {
  ano: number;
  /** Palavra da capa (padrão AGENDA). */
  capa: string;
  /** Feriados regionais/municipais da pessoa; os nacionais entram sempre. */
  regionais: Feriado[];
  /** Total de páginas (par); vazio = só o necessário. */
  total?: number | null;
}

export interface Miolo {
  /** PDF A5 (148 × 210 mm), uma página por página do miolo. */
  bytes: Uint8Array;
  plano: Plano;
  feriados: Feriado[];
}

/** Gera o miolo em A5. */
export async function gerarMiolo(c: ConfigAgenda): Promise<Miolo> {
  const feriados = todosOsFeriados(c.ano, c.regionais);
  const luas = fasesDaLua(c.ano);
  const plano = planejarPaginas(c.ano, c.total);
  const doc = await PDFDocument.create();
  const f: Fontes = { normal: await doc.embedFont(StandardFonts.Helvetica), negrito: await doc.embedFont(StandardFonts.HelveticaBold) };
  plano.paginas.forEach((p, i) => {
    const page = doc.addPage([W * PT_POR_MM, H * PT_POR_MM]);
    const fo = new Folha(page, f, i + 1);
    switch (p.tipo) {
      case "capa":
        desenharCapa(fo, c.ano, c.capa || "AGENDA");
        break;
      case "dados":
        desenharDados(fo);
        break;
      case "calendarioAno":
        desenharCalendarioAno(fo, c.ano, feriados);
        break;
      case "calendariosVizinhos":
        desenharVizinhos(fo, c.ano);
        break;
      case "planejamento":
        desenharPlanejamento(fo, c.ano, p.mes, feriados, luas);
        break;
      case "dia":
        desenharDia(fo, c.ano, p.mes, p.dia, feriados);
        break;
      case "fimDeSemana":
        desenharFimDeSemana(fo, c.ano, p.mes, p.sabado, p.domingo, feriados);
        break;
      case "anotacoes":
        desenharAnotacoes(fo);
        break;
      default:
        break;
    }
  });
  doc.setTitle(`Miolo de agenda ${c.ano}`);
  return { bytes: await doc.save(), plano, feriados };
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
