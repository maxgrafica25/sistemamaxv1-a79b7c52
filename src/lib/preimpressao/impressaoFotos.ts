// Pré-impressão → "Impressão de fotos" (balcão).
// O cliente traz as fotos; o atendente escolhe a medida de cada uma (10×15, 15×20, 20×30 ou qualquer
// outra, em pé ou deitada) e o sistema encaixa tudo nas folhas com o melhor aproveitamento, com marcas
// de corte, e, se quiser, escreve um texto na foto. Tudo no navegador, sem IA e sem custo.
// Aqui fica a parte pura (medidas, encaixe nas folhas, conferência) e o desenho do PDF.

import {
  PDFDocument,
  StandardFonts,
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type { FontesExternas, Imagem } from "./agenda";
import { ajustarTexto, corParaRgb, soSuportados } from "./cracha";
import { PT_POR_MM } from "./folha";
import type { FiltroFoto, FontePolaroid } from "./polaroid";

const mmPt = (v: number) => v * PT_POR_MM;

// ─── Medidas e folhas ───────────────────────────────────────────────

/** Medida da foto, em mm: `w` é o lado curto e `h` o lado comprido (a orientação vem depois). */
export interface MedidaImpressao {
  nome: string;
  w: number;
  h: number;
}

export const MEDIDAS_IMPRESSAO: Record<string, MedidaImpressao> = {
  "10x15": { nome: "10 × 15", w: 100, h: 150 },
  "15x20": { nome: "15 × 20", w: 150, h: 200 },
  "13x18": { nome: "13 × 18", w: 130, h: 180 },
  "20x25": { nome: "20 × 25", w: 200, h: 250 },
  "20x30": { nome: "20 × 30", w: 200, h: 300 },
  "9x13": { nome: "9 × 13", w: 90, h: 130 },
  "15x21": { nome: "15 × 21 (A5)", w: 150, h: 210 },
  a4: { nome: "A4", w: 210, h: 297 },
  "3x4": { nome: "3 × 4", w: 30, h: 40 },
  "5x7": { nome: "5 × 7", w: 50, h: 70 },
};

export const ORDEM_MEDIDAS = ["10x15", "15x20", "13x18", "20x25", "20x30", "9x13", "15x21", "a4", "3x4", "5x7"];

export interface PapelImpressao {
  nome: string;
  w: number;
  h: number;
  /** Papel fotográfico: sem margem e sem marcas (a impressora imprime sem bordas). */
  foto: boolean;
}

export const PAPEIS_IMPRESSAO: Record<string, PapelImpressao> = {
  a4: { nome: "A4", w: 210, h: 297, foto: false },
  a3: { nome: "A3", w: 297, h: 420, foto: false },
  sra3: { nome: "SRA3", w: 320, h: 450, foto: false },
  formatao: { nome: "Formatão", w: 328, h: 478, foto: false },
  a5: { nome: "A5", w: 148, h: 210, foto: false },
  foto10x15: { nome: "Papel foto 10 × 15", w: 100, h: 150, foto: true },
  foto13x18: { nome: "Papel foto 13 × 18", w: 130, h: 180, foto: true },
  foto15x20: { nome: "Papel foto 15 × 20", w: 150, h: 200, foto: true },
  foto20x25: { nome: "Papel foto 20 × 25", w: 200, h: 250, foto: true },
  foto20x30: { nome: "Papel foto 20 × 30", w: 200, h: 300, foto: true },
};

export const ORDEM_PAPEIS = ["a4", "a3", "sra3", "formatao", "a5", "foto10x15", "foto13x18", "foto15x20", "foto20x25", "foto20x30"];

export type Orientacao = "auto" | "retrato" | "paisagem";
export type AjusteDaFoto = "preencher" | "inteira";
export type CorteFotos = "marcas" | "contorno" | "nenhuma";
export type FonteTexto = "moderna" | "manuscrita" | "classica";
export type EstiloTexto = "sombra" | "faixaEscura" | "faixaClara";
export type PosicaoTexto = "baixo" | "cima" | "centro";

export interface TextoNaFoto {
  /** Texto para as fotos que não têm o seu. */
  padrao: string;
  fonte: FonteTexto;
  estilo: EstiloTexto;
  posicao: PosicaoTexto;
  /** Altura da letra, em mm. */
  tamMm: number;
  /** Cor do texto (só no estilo "sombra"; nas faixas ela é automática). */
  cor: string;
}

export interface ConfigImpressaoFotos {
  /** Medida geral (chave de MEDIDAS_IMPRESSAO ou "outra"). */
  medida: string;
  /** Medida "Outra", em mm. */
  outraW: number;
  outraH: number;
  papel: string;
  orientacao: Orientacao;
  ajuste: AjusteDaFoto;
  corte: CorteFotos;
  /** Margem da folha comum, em mm (papel fotográfico não tem). */
  margem: number;
  filtro: FiltroFoto;
  /** Borda branca ao redor da foto, dentro da medida, em mm. */
  bordaMm: number;
  texto: TextoNaFoto;
}

export const configImpressaoFotosPadrao: ConfigImpressaoFotos = {
  medida: "10x15",
  outraW: 180,
  outraH: 240,
  papel: "a4",
  orientacao: "auto",
  ajuste: "preencher",
  corte: "marcas",
  margem: 6,
  filtro: "nenhum",
  bordaMm: 0,
  texto: { padrao: "", fonte: "moderna", estilo: "sombra", posicao: "baixo", tamMm: 7, cor: "#ffffff" },
};

export const MAX_COPIAS_IMPRESSAO = 99;
export const MAX_PECAS_IMPRESSAO = 500;

/** Medida (lado curto × lado comprido) de uma chave, ou a "Outra" da configuração. */
export function medidaDe(chave: string, cfg: Pick<ConfigImpressaoFotos, "outraW" | "outraH">): MedidaImpressao {
  if (chave === "outra") {
    const a = Math.min(Math.max(10, cfg.outraW), 1000);
    const b = Math.min(Math.max(10, cfg.outraH), 1000);
    return { nome: `${a / 10} × ${b / 10}`.replace(/\./g, ","), w: Math.min(a, b), h: Math.max(a, b) };
  }
  return MEDIDAS_IMPRESSAO[chave] ?? MEDIDAS_IMPRESSAO["10x15"];
}

// ─── Itens e peças ──────────────────────────────────────────────────

export interface ItemImpressao {
  id: string;
  arquivo: string;
  qtd: number;
  /** Texto escrito na foto (se vazio, vale o texto padrão). */
  legenda: string;
  /** "padrao" = a medida geral. */
  medida: string;
  /** "padrao" = a orientação geral. */
  orient: Orientacao | "padrao";
  /** Tamanho da foto original em pixels (para saber se é em pé ou deitada). */
  fw: number;
  fh: number;
}

export interface GeometriaItem {
  /** Peça inteira (com a borda), em mm, na orientação final. */
  pw: number;
  ph: number;
  /** Janela da foto (peça menos a borda), em mm. */
  iw: number;
  ih: number;
  paisagem: boolean;
}

export function geometriaDoItem(cfg: ConfigImpressaoFotos, i: Pick<ItemImpressao, "medida" | "orient" | "fw" | "fh">): GeometriaItem {
  const m = medidaDe(i.medida === "padrao" ? cfg.medida : i.medida, cfg);
  const o: Orientacao = i.orient === "padrao" ? cfg.orientacao : i.orient;
  const paisagem = o === "paisagem" || (o === "auto" && i.fw > i.fh);
  const pw = paisagem ? m.h : m.w;
  const ph = paisagem ? m.w : m.h;
  const b = Math.min(cfg.bordaMm, Math.min(pw, ph) / 4);
  return { pw, ph, iw: pw - 2 * b, ih: ph - 2 * b, paisagem };
}

export function textoDoItem(i: Pick<ItemImpressao, "legenda">, cfg: ConfigImpressaoFotos): string {
  return (i.legenda.trim() || cfg.texto.padrao.trim()).slice(0, 80);
}

export interface Peca {
  itemId: string;
  w: number;
  h: number;
}

export function pecasDoLote(cfg: ConfigImpressaoFotos, itens: ItemImpressao[]): Peca[] {
  const out: Peca[] = [];
  for (const i of itens) {
    const g = geometriaDoItem(cfg, i);
    for (let c = 0; c < Math.min(MAX_COPIAS_IMPRESSAO, Math.max(1, i.qtd)); c++) out.push({ itemId: i.id, w: g.pw, h: g.ph });
  }
  return out.slice(0, MAX_PECAS_IMPRESSAO);
}

// ─── Encaixe nas folhas ─────────────────────────────────────────────

export interface Colocada {
  itemId: string;
  /** Canto de cima à esquerda, em mm (a partir da folha). */
  x: number;
  y: number;
  /** Tamanho ocupado na folha. */
  w: number;
  h: number;
  /** Medidas da peça em pé na sua própria orientação. */
  pw: number;
  ph: number;
  /** true = a peça está girada 90° na folha. */
  girada: boolean;
}

export interface Encaixe {
  folhas: Colocada[][];
  naoCabem: Peca[];
  /** Parte da área das folhas ocupada por fotos (0–1). */
  aproveitamento: number;
}

interface Prateleira {
  y: number;
  h: number;
  x: number;
}

/**
 * Encaixa as peças em folhas por "prateleiras" (fileiras de cima para baixo): serve para a guilhotina,
 * que corta primeiro as fileiras e depois cada foto. Cada peça pode ficar em pé ou deitada, o que
 * aproveitar mais. `variante` escolhe se a fileira prefere o lado curto ou o comprido na altura.
 */
export function empacotar(pecas: Peca[], papel: { w: number; h: number }, margem: number, espaco: number, variante: "curta" | "longa"): Encaixe {
  const W = papel.w - 2 * margem;
  const H = papel.h - 2 * margem;
  const ordenadas = [...pecas].sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h);
  interface Folha {
    prateleiras: Prateleira[];
    usadoY: number;
    itens: Colocada[];
  }
  const folhas: Folha[] = [];
  const naoCabem: Peca[] = [];
  const eps = 1e-6;

  const tenta = (f: Folha, p: Peca): boolean => {
    const opcoes = [{ w: p.w, h: p.h, g: false }];
    if (Math.abs(p.w - p.h) > 0.01) opcoes.push({ w: p.h, h: p.w, g: true });
    opcoes.sort((a, b) => (variante === "curta" ? a.h - b.h : b.h - a.h));
    // 1) uma fileira que já existe (a que sobrar menos altura)
    let melhor: { s: Prateleira; o: (typeof opcoes)[number]; sobra: number } | null = null;
    for (const s of f.prateleiras) {
      for (const o of opcoes) {
        if (s.x + o.w <= W + eps && o.h <= s.h + eps) {
          const sobra = s.h - o.h;
          if (!melhor || sobra < melhor.sobra) melhor = { s, o, sobra };
        }
      }
    }
    if (melhor) {
      f.itens.push({ itemId: p.itemId, x: melhor.s.x, y: melhor.s.y, w: melhor.o.w, h: melhor.o.h, pw: p.w, ph: p.h, girada: melhor.o.g });
      melhor.s.x += melhor.o.w + espaco;
      return true;
    }
    // 2) uma fileira nova
    for (const o of opcoes) {
      if (o.w <= W + eps && f.usadoY + o.h <= H + eps) {
        const s: Prateleira = { y: f.usadoY, h: o.h, x: o.w + espaco };
        f.prateleiras.push(s);
        f.itens.push({ itemId: p.itemId, x: 0, y: f.usadoY, w: o.w, h: o.h, pw: p.w, ph: p.h, girada: o.g });
        f.usadoY += o.h + espaco;
        return true;
      }
    }
    return false;
  };

  for (const p of ordenadas) {
    let ok = false;
    for (const f of folhas) {
      if (tenta(f, p)) {
        ok = true;
        break;
      }
    }
    if (ok) continue;
    const nova: Folha = { prateleiras: [], usadoY: 0, itens: [] };
    if (tenta(nova, p)) folhas.push(nova);
    else naoCabem.push(p);
  }

  // centraliza o bloco de cada folha
  const saida = folhas.map((f) => {
    const maxX = Math.max(...f.itens.map((c) => c.x + c.w));
    const maxY = Math.max(...f.itens.map((c) => c.y + c.h));
    const ox = margem + (W - maxX) / 2;
    const oy = margem + (H - maxY) / 2;
    return f.itens.map((c) => ({ ...c, x: c.x + ox, y: c.y + oy }));
  });
  const usada = saida.reduce((a, f) => a + f.reduce((b, c) => b + c.w * c.h, 0), 0);
  return { folhas: saida, naoCabem, aproveitamento: saida.length ? usada / (saida.length * papel.w * papel.h) : 0 };
}

/** Margem e espaço entre as fotos que valem para um papel e um tipo de corte. */
export function medidasDeCorte(cfg: Pick<ConfigImpressaoFotos, "corte" | "margem">, papel: PapelImpressao): { margem: number; espaco: number; corte: CorteFotos } {
  if (papel.foto) return { margem: 0, espaco: 0, corte: "nenhuma" };
  const espaco = cfg.corte === "marcas" ? 4 : cfg.corte === "contorno" ? 0 : 2;
  return { margem: cfg.corte === "marcas" ? Math.max(5, cfg.margem) : cfg.margem, espaco, corte: cfg.corte };
}

/** Roda o encaixe nas duas variantes e fica com a melhor (menos folhas, depois mais aproveitamento). */
export function encaixarMelhor(cfg: ConfigImpressaoFotos, pecas: Peca[], papelChave = cfg.papel): Encaixe {
  const papel = PAPEIS_IMPRESSAO[papelChave] ?? PAPEIS_IMPRESSAO.a4;
  const { margem, espaco } = medidasDeCorte(cfg, papel);
  const a = empacotar(pecas, papel, margem, espaco, "curta");
  const b = empacotar(pecas, papel, margem, espaco, "longa");
  if (a.naoCabem.length !== b.naoCabem.length) return a.naoCabem.length < b.naoCabem.length ? a : b;
  if (a.folhas.length !== b.folhas.length) return a.folhas.length < b.folhas.length ? a : b;
  return a.aproveitamento >= b.aproveitamento ? a : b;
}

export interface ComparacaoPapel {
  papel: string;
  nome: string;
  folhas: number;
  aproveitamento: number;
  naoCabem: number;
}

/** Quantas folhas e que aproveitamento cada papel dá para este lote (para o atendente escolher). */
export function compararPapeis(cfg: ConfigImpressaoFotos, pecas: Peca[]): ComparacaoPapel[] {
  if (!pecas.length) return [];
  return ORDEM_PAPEIS.map((k) => {
    const e = encaixarMelhor(cfg, pecas, k);
    return { papel: k, nome: PAPEIS_IMPRESSAO[k].nome, folhas: e.folhas.length, aproveitamento: e.aproveitamento, naoCabem: e.naoCabem.length };
  })
    .filter((c) => c.naoCabem === 0)
    .sort((a, b) => a.folhas - b.folhas || b.aproveitamento - a.aproveitamento);
}

// ─── PDF ────────────────────────────────────────────────────────────

export interface FontesTexto {
  montserrat?: FontesExternas | null;
  caveat?: FontePolaroid | null;
}

export interface EntradaImpressaoFotos {
  cfg: ConfigImpressaoFotos;
  itens: ItemImpressao[];
  /** Foto já preparada (recortada ou inteira, com filtro), pela id do item. */
  fotos: Map<string, Imagem>;
  fontes?: FontesTexto | null;
}

export interface FotosImpressas {
  bytes: Uint8Array;
  pecas: number;
  folhas: number;
  aproveitamento: number;
  avisos: string[];
}

async function criarFonte(doc: PDFDocument, fonte: FonteTexto, f?: FontesTexto | null): Promise<{ fonte: PDFFont; k: number }> {
  try {
    if (fonte === "moderna" && f?.montserrat) {
      doc.registerFontkit(f.montserrat.fontkit as never);
      return { fonte: await doc.embedFont(f.montserrat.negrito, { subset: true }), k: 0.9 };
    }
    if (fonte === "manuscrita" && f?.caveat) {
      doc.registerFontkit(f.caveat.fontkit as never);
      return { fonte: await doc.embedFont(f.caveat.caveat, { subset: true }), k: 1.3 };
    }
  } catch {
    /* cai na fonte padrão */
  }
  if (fonte === "manuscrita") return { fonte: await doc.embedFont(StandardFonts.HelveticaOblique), k: 1 };
  if (fonte === "classica") return { fonte: await doc.embedFont(StandardFonts.TimesRomanBold), k: 1 };
  return { fonte: await doc.embedFont(StandardFonts.HelveticaBold), k: 1 };
}

/** Gera o PDF: uma página por folha, no tamanho do papel. */
export async function gerarImpressaoFotos(e: EntradaImpressaoFotos): Promise<FotosImpressas> {
  const { cfg } = e;
  const papel = PAPEIS_IMPRESSAO[cfg.papel] ?? PAPEIS_IMPRESSAO.a4;
  const pecas = pecasDoLote(cfg, e.itens);
  const enc = encaixarMelhor(cfg, pecas);
  const { espaco, corte } = medidasDeCorte(cfg, papel);
  const avisos: string[] = [];
  if (enc.naoCabem.length) avisos.push(`${enc.naoCabem.length} foto(s) não cabem em ${papel.nome} nessa medida: escolha uma folha maior.`);
  const doc = await PDFDocument.create();
  const itemPorId = new Map(e.itens.map((i) => [i.id, i]));
  const imagens = new Map<string, PDFImage>();
  const usaTexto = e.itens.some((i) => textoDoItem(i, cfg));
  const tf = usaTexto ? await criarFonte(doc, cfg.texto.fonte, e.fontes) : null;
  const cinza = rgb(0.45, 0.45, 0.45);
  const W = mmPt(papel.w);
  const H = mmPt(papel.h);

  const desenharPeca = async (page: PDFPage, c: Colocada) => {
    const item = itemPorId.get(c.itemId);
    if (!item) return;
    const g = geometriaDoItem(cfg, item);
    const pw = mmPt(g.pw);
    const ph = mmPt(g.ph);
    const b = (pw - mmPt(g.iw)) / 2;
    const img = e.fotos.get(item.id);
    let emb = imagens.get(item.id);
    if (img && !emb) {
      emb = img.tipo === "jpg" ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes);
      imagens.set(item.id, emb);
    }
    const bx = mmPt(c.x);
    const by = H - mmPt(c.y) - mmPt(c.h);
    page.pushOperators(pushGraphicsState());
    if (c.girada) page.pushOperators(concatTransformationMatrix(0, 1, -1, 0, bx + ph, by));
    else page.pushOperators(concatTransformationMatrix(1, 0, 0, 1, bx, by));
    // fundo branco (e a borda)
    page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: rgb(1, 1, 1) });
    const iw = pw - 2 * b;
    const ih = ph - 2 * b;
    if (emb) {
      if (cfg.ajuste === "preencher") page.drawImage(emb, { x: b, y: b, width: iw, height: ih });
      else {
        const s = Math.min(iw / emb.width, ih / emb.height);
        page.drawImage(emb, { x: b + (iw - emb.width * s) / 2, y: b + (ih - emb.height * s) / 2, width: emb.width * s, height: emb.height * s });
      }
    } else {
      page.drawRectangle({ x: b, y: b, width: iw, height: ih, color: rgb(0.88, 0.89, 0.91) });
    }
    // texto na foto
    const txt = tf ? soSuportados(tf.fonte, textoDoItem(item, cfg)) : "";
    if (tf && txt) {
      const tam = mmPt(cfg.texto.tamMm);
      const medir = (s: string, pt: number) => tf.fonte.widthOfTextAtSize(s, pt * tf.k);
      const aj = ajustarTexto(medir, txt, tam, iw * 0.92);
      const pt = aj.tam * tf.k;
      const entre = pt * 1.1;
      const altura = aj.linhas.length * entre;
      const faixa = cfg.texto.estilo !== "sombra";
      const margemV = faixa ? pt * 0.5 : pt * 0.9;
      const bandaH = altura + pt * 0.9;
      let topoTexto: number; // y do centro do bloco de texto
      if (cfg.texto.posicao === "baixo") topoTexto = b + (faixa ? bandaH / 2 : margemV + altura / 2);
      else if (cfg.texto.posicao === "cima") topoTexto = ph - b - (faixa ? bandaH / 2 : margemV + altura / 2);
      else topoTexto = ph / 2;
      if (faixa) {
        const claro = cfg.texto.estilo === "faixaClara";
        page.drawRectangle({ x: b, y: topoTexto - bandaH / 2, width: iw, height: bandaH, color: claro ? rgb(1, 1, 1) : rgb(0, 0, 0), opacity: claro ? 0.8 : 0.55 });
      }
      const cor = cfg.texto.estilo === "faixaClara" ? rgb(0.1, 0.1, 0.12) : cfg.texto.estilo === "faixaEscura" ? rgb(1, 1, 1) : corParaRgb(cfg.texto.cor);
      aj.linhas.forEach((l, i) => {
        const w = tf.fonte.widthOfTextAtSize(l, pt);
        const x = pw / 2 - w / 2;
        const y = topoTexto + altura / 2 - (i + 0.75) * entre;
        if (!faixa) page.drawText(l, { x: x + pt * 0.05, y: y - pt * 0.05, size: pt, font: tf.fonte, color: rgb(0, 0, 0), opacity: 0.55 });
        page.drawText(l, { x, y, size: pt, font: tf.fonte, color: cor });
      });
    }
    page.pushOperators(popGraphicsState());
    // linhas de corte (no espaço da folha, fora da foto)
    const x0 = mmPt(c.x);
    const y0 = by;
    const w = mmPt(c.w);
    const h = mmPt(c.h);
    if (corte === "contorno") {
      page.drawRectangle({ x: x0, y: y0, width: w, height: h, borderColor: cinza, borderWidth: 0.25 });
    } else if (corte === "marcas") {
      const len = mmPt(Math.min(3, Math.max(1, espaco - 1)));
      const off = mmPt(0.5);
      const traco = (ax: number, ay: number, bx2: number, by2: number) => page.drawLine({ start: { x: ax, y: ay }, end: { x: bx2, y: by2 }, thickness: 0.35, color: cinza });
      for (const [px, py, dx, dy] of [
        [x0, y0, -1, -1],
        [x0 + w, y0, 1, -1],
        [x0, y0 + h, -1, 1],
        [x0 + w, y0 + h, 1, 1],
      ] as const) {
        traco(px + dx * off, py, px + dx * (off + len), py);
        traco(px, py + dy * off, px, py + dy * (off + len));
      }
    }
  };

  for (const f of enc.folhas) {
    const page = doc.addPage([W, H]);
    for (const c of f) await desenharPeca(page, c);
  }
  doc.setTitle("Impressão de fotos");
  return { bytes: await doc.save(), pecas: pecas.length - enc.naoCabem.length, folhas: enc.folhas.length, aproveitamento: enc.aproveitamento, avisos };
}

// ─── Conferência ────────────────────────────────────────────────────

export interface ItemConferenciaImpressao {
  nivel: "ok" | "atencao" | "erro";
  texto: string;
}

export interface EntradaConferenciaImpressao {
  cfg: ConfigImpressaoFotos;
  itens: (ItemImpressao & { zoom: number })[];
}

const cm = (mm: number) => `${Math.round((mm / 10) * 10) / 10}`.replace(".", ",");

/** O que merece um olhar antes de imprimir. */
export function conferirImpressaoFotos(e: EntradaConferenciaImpressao): ItemConferenciaImpressao[] {
  const { cfg, itens } = e;
  if (!itens.length) return [{ nivel: "erro", texto: "Solte as fotos para ver a conferência." }];
  const out: ItemConferenciaImpressao[] = [];
  const papel = PAPEIS_IMPRESSAO[cfg.papel] ?? PAPEIS_IMPRESSAO.a4;
  const pecas = pecasDoLote(cfg, itens);
  const enc = encaixarMelhor(cfg, pecas);
  const total = itens.reduce((a, i) => a + i.qtd, 0);
  if (enc.naoCabem.length) {
    out.push({ nivel: "erro", texto: `${enc.naoCabem.length} foto(s) não cabem em ${papel.nome}. Escolha uma folha maior ou uma medida menor.` });
  }
  if (enc.folhas.length) {
    out.push({ nivel: "ok", texto: `${total} foto(s) em ${enc.folhas.length} folha(s) ${papel.nome}, aproveitamento de ${Math.round(enc.aproveitamento * 100)}%.` });
  }
  if (total > MAX_PECAS_IMPRESSAO) out.push({ nivel: "erro", texto: `Passou de ${MAX_PECAS_IMPRESSAO} fotos: o PDF só leva as primeiras ${MAX_PECAS_IMPRESSAO}.` });
  const baixa: string[] = [];
  const muitoBaixa: string[] = [];
  for (const i of itens) {
    const g = geometriaDoItem(cfg, i);
    const lado = cfg.ajuste === "preencher" ? Math.max(i.fw, i.fh) / Math.max(1, i.zoom) : Math.max(i.fw, i.fh);
    const ppi = lado / (Math.max(g.iw, g.ih) / 25.4);
    if (ppi < 100) muitoBaixa.push(`${i.arquivo} (${Math.round(ppi)} ppi)`);
    else if (ppi < 150) baixa.push(`${i.arquivo} (${Math.round(ppi)} ppi)`);
  }
  if (muitoBaixa.length) out.push({ nivel: "erro", texto: `Foto pequena demais para essa medida (vai sair borrada): ${muitoBaixa.slice(0, 4).join(", ")}${muitoBaixa.length > 4 ? ` e mais ${muitoBaixa.length - 4}` : ""}.` });
  if (baixa.length) out.push({ nivel: "atencao", texto: `Foto com pouca resolução para essa medida (o ideal é 200 ppi ou mais): ${baixa.slice(0, 4).join(", ")}${baixa.length > 4 ? ` e mais ${baixa.length - 4}` : ""}.` });
  if (cfg.ajuste === "inteira") out.push({ nivel: "atencao", texto: "Com “Foto inteira”, quando a proporção da foto é diferente da medida sobram bordas brancas." });
  const distintas = new Set(itens.map((i) => (i.medida === "padrao" ? cfg.medida : i.medida)));
  if (distintas.size > 1) out.push({ nivel: "ok", texto: `Medidas misturadas: ${[...distintas].map((k) => medidaDe(k, cfg).nome).join(", ")}. O sistema encaixa todas juntas.` });
  if (papel.foto) out.push({ nivel: "ok", texto: `Papel fotográfico: imprima sem bordas, tamanho real (100%). Cada foto sai em uma folha de ${cm(papel.w)} × ${cm(papel.h)} cm.` });
  else out.push({ nivel: "ok", texto: "Imprima em tamanho real (100%), sem “ajustar à página”. Cada foto leva o tamanho exato escolhido." });
  if (!out.some((x) => x.nivel === "erro" || x.nivel === "atencao")) out.splice(1, 0, { nivel: "ok", texto: "Nenhum problema encontrado." });
  return out;
}
