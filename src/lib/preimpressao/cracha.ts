// Pré-impressão → "Crachás" (dados variáveis para a Fargo C50).
// Lê uma lista (nome, cargo, setor, matrícula, foto) colada do Excel/CSV e gera um PDF com um
// cartão por página no tamanho exato do cartão CR80 (85,6 × 54 mm, em pé ou deitado), com a foto
// recortada em círculo/cantos arredondados, faixa colorida por setor e QR Code. Também gera o
// verso, a folha de prova em A4 e um cartão de teste para descobrir como o cartão entra na
// impressora. Tudo no navegador, sem IA e sem custo. Aqui fica a parte pura e o desenho do PDF;
// as fotos e a tela ficam em ./crachaNavegador e nos componentes.

import {
  PDFDocument,
  StandardFonts,
  appendBezierCurve,
  clip,
  closePath,
  concatTransformationMatrix,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setLineWidth,
  setStrokingColor,
  stroke,
  type PDFEmbeddedPage,
  type PDFFont,
  type PDFImage,
  type PDFOperator,
  type PDFPage,
} from "pdf-lib";
import { qrModulos, type FontesExternas, type Imagem } from "./agenda";
import { PT_POR_MM } from "./folha";

// ─── Tamanhos ───────────────────────────────────────────────────────

/** Cartão CR80 (o da Fargo C50): 85,6 × 54 mm. */
export const CARTAO_MM = { w: 85.6, h: 54 };

export type Orientacao = "pe" | "deitado";

export function dimensoes(o: Orientacao): { w: number; h: number } {
  return o === "pe" ? { w: CARTAO_MM.h, h: CARTAO_MM.w } : { w: CARTAO_MM.w, h: CARTAO_MM.h };
}

// ─── Lista de pessoas ───────────────────────────────────────────────

export interface Pessoa {
  id: string;
  nome: string;
  cargo: string;
  setor: string;
  matricula: string;
  /** Nome do arquivo da foto (opcional; se vazio usa o nome da pessoa). */
  foto: string;
  incluir: boolean;
}

export const LIMITE_PESSOAS = 1000;

export const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** Chave para comparar nomes: sem acento, minúsculas, sem extensão e sem pontuação. */
export const chaveDeNome = (s: string) =>
  semAcento(s.replace(/\.(jpe?g|png|webp|heic|gif|bmp)$/i, ""))
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Lê texto colado do Excel (tabulação) ou de CSV (; ou ,) em linhas e colunas.
 * Aceita campos entre aspas com o separador dentro.
 */
export function lerTabela(texto: string): string[][] {
  const limpo = texto.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const primeira = limpo.split("\n").find((l) => l.trim()) ?? "";
  const cont = (c: string) => primeira.split(c).length - 1;
  const sep = cont("\t") > 0 ? "\t" : cont(";") >= cont(",") && cont(";") > 0 ? ";" : ",";
  const linhas: string[][] = [];
  let campo = "";
  let linha: string[] = [];
  let aspas = false;
  const fechaCampo = () => {
    linha.push(campo.trim());
    campo = "";
  };
  const fechaLinha = () => {
    fechaCampo();
    if (linha.some((c) => c !== "")) linhas.push(linha);
    linha = [];
  };
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (aspas) {
      if (c === '"' && limpo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) fechaCampo();
    else if (c === "\n") fechaLinha();
    else campo += c;
  }
  if (campo !== "" || linha.length) fechaLinha();
  return linhas;
}

type CampoLista = "nome" | "cargo" | "setor" | "matricula" | "foto";

const SINONIMOS: Record<CampoLista, string[]> = {
  nome: ["nome", "name", "colaborador", "funcionario", "participante", "aluno", "pessoa"],
  cargo: ["cargo", "funcao", "profissao", "titulo"],
  setor: ["setor", "departamento", "area", "categoria", "tipo", "grupo", "turma", "equipe"],
  matricula: ["matricula", "id", "codigo", "numero", "registro", "cpf", "inscricao"],
  foto: ["foto", "imagem", "arquivo", "photo", "fotografia"],
};

const ORDEM_PADRAO: CampoLista[] = ["nome", "cargo", "setor", "matricula", "foto"];

export interface ResultadoLista {
  pessoas: Pessoa[];
  /** Colunas reconhecidas, na ordem da tabela (ex.: ["nome", "cargo", "foto"]). */
  colunas: (CampoLista | null)[];
  /** true = a 1ª linha era o cabeçalho. */
  cabecalho: boolean;
  excedeu: boolean;
}

/** Transforma a tabela em pessoas. Sem cabeçalho reconhecido, a ordem é nome, cargo, setor, matrícula, foto. */
export function pessoasDaTabela(linhas: string[][]): ResultadoLista {
  if (!linhas.length) return { pessoas: [], colunas: [], cabecalho: false, excedeu: false };
  const reconhecer = (t: string): CampoLista | null => {
    const k = semAcento(t).replace(/[^a-z0-9 ]/g, "");
    for (const c of ORDEM_PADRAO) if (SINONIMOS[c].includes(k)) return c;
    return null;
  };
  const cab = linhas[0].map(reconhecer);
  const cabecalho = cab.some((c) => c !== null);
  const colunas: (CampoLista | null)[] = cabecalho ? cab : linhas[0].map((_, i) => ORDEM_PADRAO[i] ?? null);
  const dados = cabecalho ? linhas.slice(1) : linhas;
  const pessoas: Pessoa[] = [];
  dados.slice(0, LIMITE_PESSOAS).forEach((l, i) => {
    const p: Pessoa = { id: `p${i}`, nome: "", cargo: "", setor: "", matricula: "", foto: "", incluir: true };
    colunas.forEach((c, j) => {
      if (c && l[j] !== undefined && !p[c]) p[c] = l[j].trim();
    });
    pessoas.push(p);
  });
  return { pessoas, colunas, cabecalho, excedeu: dados.length > LIMITE_PESSOAS };
}

export type OrdemLista = "lista" | "nome" | "setor" | "matricula";

export function ordenarPessoas(p: Pessoa[], por: OrdemLista): Pessoa[] {
  if (por === "lista") return p;
  const cmp = (a: string, b: string) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
  return [...p].sort((a, b) => (por === "setor" ? cmp(a.setor, b.setor) || cmp(a.nome, b.nome) : cmp(a[por], b[por])));
}

export const LISTA_DE_EXEMPLO = [
  "Nome\tCargo\tSetor\tMatrícula",
  "Ana Paula Ribeiro\tAnalista de Marketing\tComercial\t1001",
  "Carlos Eduardo Lima\tCoordenador de Logística\tOperações\t1002",
  "Mariana Souza\tDesigner\tCriação\t1003",
  "João Pedro Almeida\tTécnico em Segurança do Trabalho\tOperações\t1004",
  "Beatriz Fernandes de Albuquerque Nascimento\tGerente Administrativa\tAdministrativo\t1005",
  "Rafael Gomes\tVendedor\tComercial\t1006",
].join("\n");

// ─── Foto de cada pessoa ────────────────────────────────────────────

export interface FotoCarregada {
  nome: string;
  /** Tipo MIME do arquivo (ex.: image/jpeg). */
  tipo?: string;
  bytes: Uint8Array;
  w: number;
  h: number;
}

/** Acha a foto da pessoa pelo nome do arquivo (coluna "foto") ou pelo nome dela, sem acento nem extensão. */
export function acharFoto(p: Pessoa, fotos: FotoCarregada[]): FotoCarregada | null {
  const alvos = [p.foto, p.nome, p.matricula].filter(Boolean).map(chaveDeNome);
  for (const alvo of alvos) {
    const f = fotos.find((x) => chaveDeNome(x.nome) === alvo);
    if (f) return f;
  }
  return null;
}

/** Posição e zoom da foto dentro da moldura. zoom ≥ 1; x e y vão de −1 a 1 (deslocamento dentro do que sobra). */
export interface AjusteFoto {
  zoom: number;
  x: number;
  y: number;
}

export const AJUSTE_PADRAO: AjusteFoto = { zoom: 1, x: 0, y: 0 };

/** Retângulo (em pixels da foto original) que aparece na moldura. */
export function retanguloDeCorte(w: number, h: number, aspecto: number, a: AjusteFoto = AJUSTE_PADRAO) {
  let bw = w;
  let bh = h;
  if (w / h > aspecto) bw = h * aspecto;
  else bh = w / aspecto;
  const zoom = Math.max(1, a.zoom);
  const sw = bw / zoom;
  const sh = bh / zoom;
  const cx = w / 2 + Math.max(-1, Math.min(1, a.x)) * ((w - sw) / 2);
  const cy = h / 2 + Math.max(-1, Math.min(1, a.y)) * ((h - sh) / 2);
  return { sx: cx - sw / 2, sy: cy - sh / 2, sw, sh };
}

// ─── Modelo do crachá ───────────────────────────────────────────────

export type ElementoCracha = "foto" | "nome" | "cargo" | "setor" | "matricula" | "qr";

export const ELEMENTOS_CRACHA: { chave: ElementoCracha; rotulo: string; unidade: "mm" | "pt" }[] = [
  { chave: "foto", rotulo: "Foto", unidade: "mm" },
  { chave: "nome", rotulo: "Nome", unidade: "pt" },
  { chave: "cargo", rotulo: "Cargo", unidade: "pt" },
  { chave: "setor", rotulo: "Setor", unidade: "pt" },
  { chave: "matricula", rotulo: "Matrícula", unidade: "pt" },
  { chave: "qr", rotulo: "QR Code", unidade: "mm" },
];

export interface LayoutElemento {
  ativo: boolean;
  /** Centro do elemento, em % da largura. */
  x: number;
  /** Centro do elemento, em % da altura. */
  y: number;
  /** Foto e QR: largura em mm. Textos: tamanho da letra em pt. */
  tam: number;
  cor: string;
}

export type FormaFoto = "circulo" | "arredondado" | "quadrado";

export interface FaixaSetor {
  posicao: "base" | "topo" | "nenhuma";
  mm: number;
}

export interface ConfigCracha {
  orientacao: Orientacao;
  corFundo: string;
  forma: FormaFoto;
  elementos: Record<ElementoCracha, LayoutElemento>;
  faixa: FaixaSetor;
  /** Cor da faixa por setor (chave = nome do setor sem acento). O que não estiver aqui usa a paleta. */
  coresSetor: Record<string, string>;
}

const ESCURO = "#111827";
const CLARO = "#ffffff";

export function elementosPadrao(o: Orientacao): Record<ElementoCracha, LayoutElemento> {
  if (o === "pe") {
    return {
      foto: { ativo: true, x: 50, y: 31, tam: 32, cor: CLARO },
      nome: { ativo: true, x: 50, y: 59, tam: 13, cor: ESCURO },
      cargo: { ativo: true, x: 50, y: 67, tam: 8, cor: "#4b5563" },
      setor: { ativo: true, x: 50, y: 93.5, tam: 8.5, cor: CLARO },
      matricula: { ativo: true, x: 50, y: 76, tam: 7.5, cor: "#4b5563" },
      qr: { ativo: false, x: 80, y: 80, tam: 16, cor: ESCURO },
    };
  }
  return {
    foto: { ativo: true, x: 23, y: 45, tam: 30, cor: CLARO },
    nome: { ativo: true, x: 66, y: 32, tam: 13, cor: ESCURO },
    cargo: { ativo: true, x: 66, y: 44, tam: 8, cor: "#4b5563" },
    setor: { ativo: true, x: 50, y: 92, tam: 8.5, cor: CLARO },
    matricula: { ativo: true, x: 66, y: 56, tam: 7.5, cor: "#4b5563" },
    qr: { ativo: false, x: 86, y: 58, tam: 14, cor: ESCURO },
  };
}

export function configCrachaPadrao(o: Orientacao = "pe"): ConfigCracha {
  return {
    orientacao: o,
    corFundo: "#ffffff",
    forma: "circulo",
    elementos: elementosPadrao(o),
    faixa: { posicao: "base", mm: o === "pe" ? 10 : 8 },
    coresSetor: {},
  };
}

/** Cores sugeridas para os setores (na ordem em que aparecem na lista). */
export const PALETA_SETORES = ["#1d4ed8", "#dc2626", "#15803d", "#ea580c", "#7c3aed", "#0e7490", "#be185d", "#4b5563"];

/** Cor da faixa de um setor: a escolhida pela pessoa ou a da paleta (pela ordem do setor na lista). */
export function corDoSetor(setor: string, cfg: ConfigCracha, ordem: string[]): string {
  const k = semAcento(setor);
  const escolhida = cfg.coresSetor[k];
  if (escolhida && /^#[0-9a-f]{6}$/i.test(escolhida)) return escolhida;
  const i = ordem.indexOf(k);
  return PALETA_SETORES[(i < 0 ? 0 : i) % PALETA_SETORES.length];
}

/** Setores diferentes da lista (sem repetir), na ordem em que aparecem. */
export function setoresDaLista(p: Pessoa[]): { chave: string; nome: string }[] {
  const vistos = new Map<string, string>();
  for (const x of p) {
    const k = semAcento(x.setor);
    if (x.setor.trim() && !vistos.has(k)) vistos.set(k, x.setor.trim());
  }
  return [...vistos].map(([chave, nome]) => ({ chave, nome }));
}

/** Região do furo do cordão (guia só na prévia, não vai para o PDF). */
export function zonaDoFuro(o: Orientacao): { x: number; y: number; w: number; h: number } {
  const { w, h } = dimensoes(o);
  return o === "pe" ? { x: w / 2 - 9, y: 1.5, w: 18, h: 8 } : { x: 1.5, y: h / 2 - 9, w: 8, h: 18 };
}

// ─── Ajuste de texto ────────────────────────────────────────────────

export interface TextoAjustado {
  linhas: string[];
  /** Tamanho final da letra (pt). */
  tam: number;
  /** true = a letra precisou ficar menor que o pedido. */
  reduzido: boolean;
  /** true = o texto não coube nem assim e foi cortado com "…". */
  cortado: boolean;
}

/**
 * Faz o texto caber na largura: primeiro diminui a letra (até 60% do pedido); se ainda não couber,
 * quebra em duas linhas; só em último caso corta com "…".
 */
export function ajustarTexto(medir: (s: string, pt: number) => number, texto: string, tam: number, maxLarg: number): TextoAjustado {
  const t = texto.replace(/\s+/g, " ").trim();
  if (!t) return { linhas: [], tam, reduzido: false, cortado: false };
  const minimo = tam * 0.6;
  if (medir(t, tam) <= maxLarg) return { linhas: [t], tam, reduzido: false, cortado: false };
  // 1) diminui a letra
  for (let pt = tam - 0.5; pt >= minimo - 0.001; pt -= 0.5) {
    if (medir(t, pt) <= maxLarg) return { linhas: [t], tam: pt, reduzido: true, cortado: false };
  }
  // 2) duas linhas
  const palavras = t.split(" ");
  if (palavras.length > 1) {
    for (let pt = tam * 0.85; pt >= minimo - 0.001; pt -= 0.5) {
      let melhor: [string, string] | null = null;
      let pior = Infinity;
      for (let i = 1; i < palavras.length; i++) {
        const a = palavras.slice(0, i).join(" ");
        const b = palavras.slice(i).join(" ");
        const m = Math.max(medir(a, pt), medir(b, pt));
        if (m < pior) {
          pior = m;
          melhor = [a, b];
        }
      }
      if (melhor && pior <= maxLarg) return { linhas: melhor, tam: pt, reduzido: pt < tam, cortado: false };
    }
  }
  // 3) corta
  let corte = t;
  while (corte.length > 1 && medir(corte + "…", minimo) > maxLarg) corte = corte.slice(0, -1);
  return { linhas: [corte.trimEnd() + "…"], tam: minimo, reduzido: true, cortado: true };
}

// ─── Desenho do PDF ─────────────────────────────────────────────────

export type Fundo = { tipo: "imagem"; img: Imagem } | { tipo: "pdf"; bytes: Uint8Array };

interface Fontes {
  normal: PDFFont;
  negrito: PDFFont;
  k: number;
}

async function criarFontes(doc: PDFDocument, externas?: FontesExternas | null): Promise<Fontes> {
  if (externas) {
    try {
      doc.registerFontkit(externas.fontkit as never);
      const [normal, negrito] = await Promise.all([doc.embedFont(externas.normal, { subset: true }), doc.embedFont(externas.negrito, { subset: true })]);
      return { normal, negrito, k: 0.9 };
    } catch {
      /* segue com a Helvetica */
    }
  }
  return { normal: await doc.embedFont(StandardFonts.Helvetica), negrito: await doc.embedFont(StandardFonts.HelveticaBold), k: 1 };
}

const conjuntos = new WeakMap<PDFFont, Set<number>>();

/** Tira do texto o que a fonte não sabe desenhar (emojis, letras raras): evita erro no PDF e quadradinhos. */
export function soSuportados(fonte: PDFFont, texto: string): string {
  let set = conjuntos.get(fonte);
  if (!set) {
    set = new Set(fonte.getCharacterSet());
    conjuntos.set(fonte, set);
  }
  let out = "";
  for (const ch of texto.normalize("NFC")) {
    const cp = ch.codePointAt(0) as number;
    if (set.has(cp)) out += ch;
    else {
      // tenta sem o acento (ex.: ł → l não existe; mas ő → o)
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (base && base !== ch && [...base].every((b) => set.has(b.codePointAt(0) as number))) out += base;
    }
  }
  return out.replace(/\s+/g, " ");
}

export function corParaRgb(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const v = m ? Number.parseInt(m[1], 16) : 0;
  return rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
}

/** Cor clara? (para escolher texto escuro ou claro sobre ela). */
export function ehClara(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true;
  const v = Number.parseInt(m[1], 16);
  const lum = 0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255);
  return lum > 150;
}

const mmPt = (v: number) => v * PT_POR_MM;

/** Caminho (em operadores do PDF) de círculo ou retângulo de cantos arredondados; coordenadas em pontos. */
function caminhoDaForma(forma: FormaFoto, x: number, y: number, w: number, h: number): PDFOperator[] {
  if (forma === "quadrado") return [moveTo(x, y), lineTo(x + w, y), lineTo(x + w, y + h), lineTo(x, y + h), closePath()];
  const K = 0.5523;
  if (forma === "circulo") {
    const rx = w / 2;
    const ry = h / 2;
    const cx = x + rx;
    const cy = y + ry;
    return [
      moveTo(cx + rx, cy),
      appendBezierCurve(cx + rx, cy + ry * K, cx + rx * K, cy + ry, cx, cy + ry),
      appendBezierCurve(cx - rx * K, cy + ry, cx - rx, cy + ry * K, cx - rx, cy),
      appendBezierCurve(cx - rx, cy - ry * K, cx - rx * K, cy - ry, cx, cy - ry),
      appendBezierCurve(cx + rx * K, cy - ry, cx + rx, cy - ry * K, cx + rx, cy),
      closePath(),
    ];
  }
  const r = Math.min(w, h) * 0.14;
  const c = r * K;
  return [
    moveTo(x + r, y),
    lineTo(x + w - r, y),
    appendBezierCurve(x + w - r + c, y, x + w, y + r - c, x + w, y + r),
    lineTo(x + w, y + h - r),
    appendBezierCurve(x + w, y + h - r + c, x + w - r + c, y + h, x + w - r, y + h),
    lineTo(x + r, y + h),
    appendBezierCurve(x + r - c, y + h, x, y + h - r + c, x, y + h - r),
    lineTo(x, y + r),
    appendBezierCurve(x, y + r - c, x + r - c, y, x + r, y),
    closePath(),
  ];
}

/** Proporção (largura ÷ altura) da moldura da foto. */
export const aspectoDaFoto = (forma: FormaFoto) => (forma === "arredondado" ? 3 / 4 : 1);

interface Embutidos {
  fundoImg: PDFImage | null;
  fundoPag: PDFEmbeddedPage | null;
}

async function embutirFundo(doc: PDFDocument, fundo: Fundo | null): Promise<Embutidos> {
  if (!fundo) return { fundoImg: null, fundoPag: null };
  if (fundo.tipo === "pdf") {
    const origem = await PDFDocument.load(fundo.bytes);
    const p = origem.getPages()[0];
    if (!p || !p.node.Contents()) return { fundoImg: null, fundoPag: null };
    const [pag] = await doc.embedPdf(fundo.bytes, [0]);
    return { fundoImg: null, fundoPag: pag };
  }
  const img = fundo.img.tipo === "jpg" ? await doc.embedJpg(fundo.img.bytes) : await doc.embedPng(fundo.img.bytes);
  return { fundoImg: img, fundoPag: null };
}

/** Desenha a arte de fundo cobrindo o cartão inteiro (corta o que sobra, centralizado). */
function desenharFundo(page: PDFPage, e: Embutidos, W: number, H: number) {
  if (e.fundoPag) {
    const s = Math.max(W / e.fundoPag.width, H / e.fundoPag.height);
    page.drawPage(e.fundoPag, { x: (W - e.fundoPag.width * s) / 2, y: (H - e.fundoPag.height * s) / 2, xScale: s, yScale: s });
  } else if (e.fundoImg) {
    const s = Math.max(W / e.fundoImg.width, H / e.fundoImg.height);
    page.drawImage(e.fundoImg, { x: (W - e.fundoImg.width * s) / 2, y: (H - e.fundoImg.height * s) / 2, width: e.fundoImg.width * s, height: e.fundoImg.height * s });
  }
}

export interface AvisoCartao {
  pessoaId: string;
  texto: string;
}

export interface EntradaCartoes {
  cfg: ConfigCracha;
  pessoas: Pessoa[];
  /** Foto já recortada (JPG/PNG) de cada pessoa, pela id. */
  fotos: Map<string, Imagem>;
  fundo: Fundo | null;
  externas?: FontesExternas | null;
  /** Ordem dos setores (para as cores da paleta); se faltar, usa a da lista. */
  ordemSetores?: string[];
}

export interface CartoesGerados {
  bytes: Uint8Array;
  /** Pessoa de cada página, na ordem. */
  ids: string[];
  avisos: AvisoCartao[];
}

/** Um PDF com um cartão por página, no tamanho exato do CR80. */
export async function gerarCartoes(e: EntradaCartoes): Promise<CartoesGerados> {
  const { cfg } = e;
  const { w: Wm, h: Hm } = dimensoes(cfg.orientacao);
  const W = mmPt(Wm);
  const H = mmPt(Hm);
  const doc = await PDFDocument.create();
  const fontes = await criarFontes(doc, e.externas);
  const fundo = await embutirFundo(doc, e.fundo);
  const ordem = e.ordemSetores ?? setoresDaLista(e.pessoas).map((s) => s.chave);
  const avisos: AvisoCartao[] = [];
  const ids: string[] = [];
  const imgCache = new Map<string, PDFImage>();
  const fotoEmbutida = async (id: string, img: Imagem) => {
    let r = imgCache.get(id);
    if (!r) {
      r = img.tipo === "jpg" ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes);
      imgCache.set(id, r);
    }
    return r;
  };

  for (const p of e.pessoas) {
    const page = doc.addPage([W, H]);
    ids.push(p.id);
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: corParaRgb(cfg.corFundo) });
    desenharFundo(page, fundo, W, H);

    // Faixa colorida do setor
    if (cfg.faixa.posicao !== "nenhuma" && p.setor.trim()) {
      const fh = mmPt(cfg.faixa.mm);
      page.drawRectangle({ x: 0, y: cfg.faixa.posicao === "base" ? 0 : H - fh, width: W, height: fh, color: corParaRgb(corDoSetor(p.setor, cfg, ordem)) });
    }

    // Foto
    const fl = cfg.elementos.foto;
    if (fl.ativo) {
      const img = e.fotos.get(p.id);
      const fw = mmPt(fl.tam);
      const fh = fw / aspectoDaFoto(cfg.forma);
      const x = (W * fl.x) / 100 - fw / 2;
      const y = H - (H * fl.y) / 100 - fh / 2;
      if (img) {
        page.pushOperators(pushGraphicsState(), ...caminhoDaForma(cfg.forma, x, y, fw, fh), clip(), endPath());
        page.drawImage(await fotoEmbutida(p.id, img), { x, y, width: fw, height: fh });
        page.pushOperators(popGraphicsState());
      } else {
        // sem foto: moldura cinza para ficar claro que falta
        page.pushOperators(pushGraphicsState(), ...caminhoDaForma(cfg.forma, x, y, fw, fh), clip(), endPath());
        page.drawRectangle({ x, y, width: fw, height: fh, color: rgb(0.88, 0.89, 0.91) });
        page.pushOperators(popGraphicsState());
      }
      // contorno na cor escolhida (branco por padrão)
      const c = corParaRgb(fl.cor);
      page.pushOperators(pushGraphicsState(), setLineWidth(mmPt(0.7)), setStrokingColor(c), ...caminhoDaForma(cfg.forma, x, y, fw, fh), stroke(), popGraphicsState());
    }

    // Textos
    const texto = (chave: "nome" | "cargo" | "setor" | "matricula", valor: string, fonte: PDFFont, maiusculo = false) => {
      const l = cfg.elementos[chave];
      if (!l.ativo || !valor.trim()) return;
      const v = soSuportados(fonte, maiusculo ? valor.toLocaleUpperCase("pt-BR") : valor);
      if (!v.trim()) return;
      const cx = (W * l.x) / 100;
      const folga = Math.min(cx, W - cx) * 2 - mmPt(5);
      const medir = (s: string, pt: number) => fonte.widthOfTextAtSize(s, pt * fontes.k);
      const aj = ajustarTexto(medir, v, l.tam, Math.max(mmPt(10), folga));
      if (aj.cortado) avisos.push({ pessoaId: p.id, texto: `${chave === "nome" ? "O nome" : chave === "cargo" ? "O cargo" : "O texto"} de ${p.nome || "uma pessoa"} não coube e foi cortado.` });
      else if (aj.reduzido && aj.tam < l.tam * 0.75) avisos.push({ pessoaId: p.id, texto: `${chave === "nome" ? "O nome" : chave === "cargo" ? "O cargo" : "O texto"} de ${p.nome || "uma pessoa"} ficou com a letra bem menor para caber.` });
      const pt = aj.tam * fontes.k;
      const entre = pt * 1.15;
      const cy = H - (H * l.y) / 100;
      const topo = cy + ((aj.linhas.length - 1) * entre) / 2;
      aj.linhas.forEach((linha, i) => {
        const w = fonte.widthOfTextAtSize(linha, pt);
        page.drawText(linha, { x: cx - w / 2, y: topo - i * entre - pt * 0.35, size: pt, font: fonte, color: corParaRgb(l.cor) });
      });
    };
    texto("nome", p.nome, fontes.negrito);
    texto("cargo", p.cargo, fontes.normal);
    texto("setor", p.setor, fontes.negrito, true);
    texto("matricula", p.matricula, fontes.normal);

    // QR Code
    const ql = cfg.elementos.qr;
    if (ql.ativo) {
      const conteudo = (p.matricula || p.nome).trim();
      if (conteudo) {
        const m = qrModulos(conteudo);
        const n = m.length;
        const tam = mmPt(ql.tam);
        const mod = tam / (n + 2);
        const x0 = (W * ql.x) / 100 - tam / 2;
        const y0 = H - (H * ql.y) / 100 + tam / 2;
        page.drawRectangle({ x: x0, y: y0 - tam, width: tam, height: tam, color: rgb(1, 1, 1) });
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; ) {
            if (!m[r][c]) {
              c++;
              continue;
            }
            let fim = c;
            while (fim + 1 < n && m[r][fim + 1]) fim++;
            page.drawRectangle({ x: x0 + (c + 1) * mod, y: y0 - (r + 2) * mod, width: (fim - c + 1) * mod, height: mod, color: corParaRgb(ql.cor), borderWidth: 0 });
            c = fim + 1;
          }
        }
      }
    }
  }
  doc.setTitle("Crachás");
  return { bytes: await doc.save(), ids, avisos };
}

/**
 * Verso: a arte (ou só a cor) em `copias` páginas, uma para cada cartão. Com `girar` o conteúdo
 * sai de cabeça para baixo (para quando o cartão entra na impressora do outro lado).
 */
export async function gerarVerso(o: { orientacao: Orientacao; corFundo: string; fundo: Fundo | null; copias: number; girar: boolean }): Promise<Uint8Array> {
  const { w: Wm, h: Hm } = dimensoes(o.orientacao);
  const W = mmPt(Wm);
  const H = mmPt(Hm);
  const doc = await PDFDocument.create();
  const fundo = await embutirFundo(doc, o.fundo);
  for (let i = 0; i < Math.max(1, o.copias); i++) {
    const page = doc.addPage([W, H]);
    if (o.girar) page.pushOperators(pushGraphicsState(), concatTransformationMatrix(-1, 0, 0, -1, W, H));
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: corParaRgb(o.corFundo) });
    desenharFundo(page, fundo, W, H);
    if (o.girar) page.pushOperators(popGraphicsState());
  }
  doc.setTitle("Versos dos crachás");
  return doc.save();
}

/** Folha A4 de prova: vários cartões com marcas de corte, para o cliente aprovar em papel comum. */
export async function gerarProva(cartoes: Uint8Array, orientacao: Orientacao, maxCartoes = 200): Promise<Uint8Array> {
  const { w, h } = dimensoes(orientacao);
  const margem = 10;
  const gap = 5;
  const cols = Math.max(1, Math.floor((210 - 2 * margem + gap) / (w + gap)));
  const linhas = Math.max(1, Math.floor((297 - 2 * margem + gap) / (h + gap)));
  const porFolha = cols * linhas;
  const origem = await PDFDocument.load(cartoes);
  const total = Math.min(origem.getPageCount(), maxCartoes);
  const doc = await PDFDocument.create();
  const paginas = await doc.embedPdf(cartoes, Array.from({ length: total }, (_, i) => i));
  const gridW = cols * w + (cols - 1) * gap;
  const gridH = linhas * h + (linhas - 1) * gap;
  const x0 = (210 - gridW) / 2;
  const y0 = (297 - gridH) / 2;
  const cinza = rgb(0.45, 0.45, 0.45);
  for (let i = 0; i < total; i += porFolha) {
    const page = doc.addPage([mmPt(210), mmPt(297)]);
    for (let k = 0; k < porFolha && i + k < total; k++) {
      const c = k % cols;
      const l = Math.floor(k / cols);
      const x = x0 + c * (w + gap);
      const yTopo = y0 + l * (h + gap);
      const yBase = 297 - yTopo - h;
      page.drawPage(paginas[i + k], { x: mmPt(x), y: mmPt(yBase), width: mmPt(w), height: mmPt(h) });
      // marcas de corte nos 4 cantos (fora do cartão)
      const t = 2.5;
      const o = 1;
      const linha = (ax: number, ay: number, bx: number, by: number) => page.drawLine({ start: { x: mmPt(ax), y: mmPt(ay) }, end: { x: mmPt(bx), y: mmPt(by) }, thickness: 0.4, color: cinza });
      for (const [px, py, dx, dy] of [
        [x, yBase, -1, -1],
        [x + w, yBase, 1, -1],
        [x, yBase + h, -1, 1],
        [x + w, yBase + h, 1, 1],
      ] as const) {
        linha(px + dx * o, py, px + dx * (o + t), py);
        linha(px, py + dy * o, px, py + dy * (o + t));
      }
    }
  }
  doc.setTitle("Prova dos crachás");
  return doc.save();
}

/**
 * Cartão de teste (frente e verso) para descobrir como o cartão entra na Fargo: cada lado tem
 * o topo marcado com uma seta e um quadrado preto no canto superior esquerdo.
 */
export async function gerarCartaoDeTeste(orientacao: Orientacao, girarVerso: boolean): Promise<Uint8Array> {
  const { w: Wm, h: Hm } = dimensoes(orientacao);
  const W = mmPt(Wm);
  const H = mmPt(Hm);
  const doc = await PDFDocument.create();
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const lado = (titulo: string, dica: string, girar: boolean, cor: ReturnType<typeof rgb>) => {
    const page = doc.addPage([W, H]);
    if (girar) page.pushOperators(pushGraphicsState(), concatTransformationMatrix(-1, 0, 0, -1, W, H));
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(1, 1, 1) });
    page.drawRectangle({ x: mmPt(1), y: mmPt(1), width: W - mmPt(2), height: H - mmPt(2), borderColor: cor, borderWidth: 1.2 });
    page.drawRectangle({ x: mmPt(3), y: H - mmPt(8), width: mmPt(5), height: mmPt(5), color: rgb(0, 0, 0) });
    const tam = Math.min(W, H) * 0.2;
    const tw = negrito.widthOfTextAtSize(titulo, tam);
    page.drawText(titulo, { x: (W - tw) / 2, y: H / 2 - tam * 0.2, size: tam, font: negrito, color: cor });
    const seta = mmPt(5);
    const cx = W / 2;
    const ty = H - mmPt(3);
    page.drawSvgPath(`M 0 0 L ${-seta} ${seta * 1.4} L ${-seta * 0.35} ${seta * 1.4} L ${-seta * 0.35} ${seta * 2.8} L ${seta * 0.35} ${seta * 2.8} L ${seta * 0.35} ${seta * 1.4} L ${seta} ${seta * 1.4} Z`, { x: cx, y: ty, color: cor, borderWidth: 0 });
    const d = Math.min(W, H) * 0.055;
    const dw = normal.widthOfTextAtSize(dica, d);
    page.drawText(dica, { x: (W - dw) / 2, y: mmPt(4), size: d, font: normal, color: rgb(0.3, 0.3, 0.3) });
    if (girar) page.pushOperators(popGraphicsState());
  };
  lado("FRENTE", "seta = topo; quadrado preto = canto de cima", false, rgb(0.11, 0.3, 0.85));
  lado("VERSO", "seta = topo; quadrado preto = canto de cima", girarVerso, rgb(0.8, 0.15, 0.15));
  doc.setTitle("Cartão de teste");
  return doc.save();
}

// ─── Conferência ────────────────────────────────────────────────────

export interface ItemConferenciaCracha {
  nivel: "ok" | "atencao" | "erro";
  texto: string;
}

export interface EntradaConferencia {
  cfg: ConfigCracha;
  /** Só quem vai ser impresso. */
  pessoas: Pessoa[];
  /** Foto achada (e o ajuste) de cada pessoa, pela id. */
  fotos: Map<string, { w: number; h: number; ajuste: AjusteFoto }>;
  /** Avisos do desenho (texto cortado ou muito reduzido). */
  avisosDeDesenho?: AvisoCartao[];
  /** Tamanho da arte de fundo em pixels (imagem) e proporção (imagem ou PDF). */
  arte?: { aspecto: number; px?: { w: number; h: number } } | null;
}

const lista = (nomes: string[], max = 4) => (nomes.length > max ? `${nomes.slice(0, max).join(", ")} e mais ${nomes.length - max}` : nomes.join(", "));

/** O que merece um olhar antes de gastar cartão e fita. */
export function conferirCrachas(e: EntradaConferencia): ItemConferenciaCracha[] {
  const out: ItemConferenciaCracha[] = [];
  const { cfg, pessoas } = e;
  if (!pessoas.length) {
    return [{ nivel: "erro", texto: "Cole a lista de pessoas (ou use o exemplo) para ver a conferência." }];
  }
  const semNome = pessoas.filter((p) => !p.nome.trim());
  if (semNome.length) out.push({ nivel: "erro", texto: `${semNome.length} linha(s) sem nome. O cartão sairia sem identificação.` });

  const contagem = new Map<string, string[]>();
  for (const p of pessoas) {
    if (!p.nome.trim()) continue;
    const k = semAcento(p.nome) + "|" + semAcento(p.matricula);
    contagem.set(k, [...(contagem.get(k) ?? []), p.nome]);
  }
  const repetidos = [...contagem.values()].filter((v) => v.length > 1).map((v) => v[0]);
  if (repetidos.length) out.push({ nivel: "atencao", texto: `Nome repetido (e mesma matrícula): ${lista(repetidos)}. Confira se não é a mesma pessoa duas vezes.` });

  if (cfg.elementos.foto.ativo) {
    const sem = pessoas.filter((p) => !e.fotos.has(p.id));
    if (sem.length) out.push({ nivel: "atencao", texto: `Sem foto: ${lista(sem.map((p) => p.nome || "(sem nome)"))}. O cartão sai com uma moldura cinza.` });
    const mmFoto = cfg.elementos.foto.tam;
    const baixa: string[] = [];
    for (const p of pessoas) {
      const f = e.fotos.get(p.id);
      if (!f) continue;
      const r = retanguloDeCorte(f.w, f.h, aspectoDaFoto(cfg.forma), f.ajuste);
      const ppi = Math.min(r.sw, r.sh * aspectoDaFoto(cfg.forma)) / (mmFoto / 25.4);
      if (ppi < 150) baixa.push(`${p.nome || "(sem nome)"} (${Math.round(ppi)} ppi)`);
    }
    if (baixa.length) out.push({ nivel: "atencao", texto: `Foto com pouca resolução (o ideal é 200 ppi ou mais): ${lista(baixa)}.` });
  }

  const cortes = (e.avisosDeDesenho ?? []).map((a) => a.texto);
  if (cortes.length) for (const t of [...new Set(cortes)].slice(0, 6)) out.push({ nivel: "atencao", texto: t });

  if (cfg.elementos.setor.ativo && cfg.faixa.posicao !== "nenhuma") {
    const sem = pessoas.filter((p) => !p.setor.trim());
    if (sem.length) out.push({ nivel: "atencao", texto: `${sem.length} pessoa(s) sem setor: ficam sem a faixa colorida.` });
  }
  if (cfg.elementos.qr.ativo) {
    const sem = pessoas.filter((p) => !(p.matricula || p.nome).trim());
    if (sem.length) out.push({ nivel: "atencao", texto: `${sem.length} pessoa(s) sem matrícula nem nome: sem QR Code.` });
  }
  if (e.arte) {
    const { w, h } = dimensoes(cfg.orientacao);
    const desvio = Math.abs(e.arte.aspecto / (w / h) - 1);
    if (desvio > 0.04) out.push({ nivel: "atencao", texto: "A arte de fundo tem outra proporção que o cartão: ela será cortada nas bordas. Confira na prévia." });
    if (e.arte.px && e.arte.px.w < (w / 25.4) * 200) out.push({ nivel: "atencao", texto: `A arte de fundo é pequena (${e.arte.px.w} px de largura). Para a Fargo (300 dpi) o ideal é ${Math.round((w / 25.4) * 300)} px ou mais.` });
  }
  if (!out.some((i) => i.nivel === "erro" || i.nivel === "atencao")) out.push({ nivel: "ok", texto: "Nenhum problema encontrado." });
  out.unshift({ nivel: "ok", texto: `${pessoas.length} cartão(ões) de ${dimensoes(cfg.orientacao).w} × ${dimensoes(cfg.orientacao).h} mm, ${cfg.orientacao === "pe" ? "em pé" : "deitado"}.` });
  return out;
}
