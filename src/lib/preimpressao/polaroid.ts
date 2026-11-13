// Pré-impressão → "Fotos Polaroid".
// Monta fotos de clientes no estilo Polaroid (clássica, mini ou quadrada) em folhas A4, com moldura
// colorida, legenda "à mão", filtros, enfeites, verso com mensagem/QR e marcas de corte. Tudo no
// navegador, sem IA e sem custo. Aqui fica a parte pura (folha, filtros, textos) e o desenho do PDF;
// ler/recortar as fotos e a tela ficam em ./polaroidNavegador e nos componentes.

import {
  PDFDocument,
  StandardFonts,
  concatTransformationMatrix,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { qrModulos, type Imagem } from "./agenda";
import { ajustarTexto, corParaRgb, ehClara, soSuportados } from "./cracha";
import { PT_POR_MM } from "./folha";

const mmPt = (v: number) => v * PT_POR_MM;

// ─── Tamanhos ───────────────────────────────────────────────────────

export type TamanhoPolaroid = "classica" | "mini" | "quadrada";

export interface MedidasPolaroid {
  nome: string;
  /** Cartão inteiro, em mm. */
  w: number;
  h: number;
  /** Janela da foto, em mm. */
  foto: { w: number; h: number };
  /** Distância da janela até a borda de cima e dos lados, em mm. */
  topo: number;
  lado: number;
}

export const POLAROIDS: Record<TamanhoPolaroid, MedidasPolaroid> = {
  classica: { nome: "Clássica", w: 88, h: 107, foto: { w: 79, h: 79 }, topo: 4.5, lado: 4.5 },
  mini: { nome: "Mini", w: 54, h: 86, foto: { w: 46, h: 62 }, topo: 4, lado: 4 },
  quadrada: { nome: "Quadrada", w: 72, h: 86, foto: { w: 62, h: 62 }, topo: 5, lado: 5 },
};

/** Proporção (largura ÷ altura) da janela da foto. */
export const aspectoPolaroid = (t: TamanhoPolaroid) => POLAROIDS[t].foto.w / POLAROIDS[t].foto.h;

// ─── Folha A4 ───────────────────────────────────────────────────────

export const A4 = { w: 210, h: 297 };
const MARGEM = 8;
const ESPACO = 6;

export interface PlanoFolha {
  cols: number;
  linhas: number;
  /** true = as polaroids ficam deitadas (giradas 90°) para caber mais. */
  girada: boolean;
  porFolha: number;
  /** Caixa de cada peça na folha (já considerando a rotação), em mm. */
  pecaW: number;
  pecaH: number;
  /** Canto de cima à esquerda da grade, em mm. */
  x0: number;
  y0: number;
  espaco: number;
}

/** Quantas cabem na A4 (em pé ou deitadas, o que render mais) e onde ficam. */
export function planejarFolha(t: TamanhoPolaroid): PlanoFolha {
  const m = POLAROIDS[t];
  const calc = (pw: number, ph: number) => {
    const cols = Math.max(0, Math.floor((A4.w - 2 * MARGEM + ESPACO) / (pw + ESPACO)));
    const linhas = Math.max(0, Math.floor((A4.h - 2 * MARGEM + ESPACO) / (ph + ESPACO)));
    return { cols, linhas, n: cols * linhas, pw, ph };
  };
  const a = calc(m.w, m.h);
  const b = calc(m.h, m.w);
  const girada = b.n > a.n;
  const r = girada ? b : a;
  const gridW = r.cols * r.pw + (r.cols - 1) * ESPACO;
  const gridH = r.linhas * r.ph + (r.linhas - 1) * ESPACO;
  return { cols: r.cols, linhas: r.linhas, girada, porFolha: r.n, pecaW: r.pw, pecaH: r.ph, x0: (A4.w - gridW) / 2, y0: (A4.h - gridH) / 2, espaco: ESPACO };
}

export interface ResumoFolhas {
  pecas: number;
  folhas: number;
  porFolha: number;
  /** Lugares vazios na última folha. */
  sobram: number;
}

export function resumoDeFolhas(t: TamanhoPolaroid, pecas: number): ResumoFolhas {
  const pf = planejarFolha(t).porFolha;
  if (!pf || !pecas) return { pecas, folhas: 0, porFolha: pf, sobram: 0 };
  const folhas = Math.ceil(pecas / pf);
  return { pecas, folhas, porFolha: pf, sobram: folhas * pf - pecas };
}

// ─── Filtros de cor (sem depender do canvas: valem em qualquer navegador) ─

export type FiltroFoto = "nenhum" | "pb" | "vintage" | "quente" | "frio" | "desbotado";

export const FILTROS: { valor: FiltroFoto; rotulo: string }[] = [
  { valor: "nenhum", rotulo: "Original" },
  { valor: "pb", rotulo: "Preto e branco" },
  { valor: "vintage", rotulo: "Vintage" },
  { valor: "quente", rotulo: "Quente" },
  { valor: "frio", rotulo: "Frio" },
  { valor: "desbotado", rotulo: "Desbotado" },
];

const c255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Aplica o filtro nos pixels (RGBA) no próprio vetor. `w` e `h` servem para a vinheta do Vintage. */
export function aplicarFiltro(data: Uint8ClampedArray, filtro: FiltroFoto, w = 0, h = 0): void {
  if (filtro === "nenhum") return;
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (filtro === "pb") {
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = (l - 128) * 1.08 + 128;
    } else if (filtro === "quente") {
      r = r * 1.08 + 8;
      g = g * 1.02 + 2;
      b = b * 0.9;
    } else if (filtro === "frio") {
      r = r * 0.92;
      g = g * 1.0 + 2;
      b = b * 1.1 + 8;
    } else if (filtro === "desbotado") {
      r = (r - 128) * 0.78 + 128 + 22;
      g = (g - 128) * 0.78 + 128 + 22;
      b = (b - 128) * 0.78 + 128 + 26;
    } else if (filtro === "vintage") {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b;
      const sg = 0.349 * r + 0.686 * g + 0.168 * b;
      const sb = 0.272 * r + 0.534 * g + 0.131 * b;
      r = (sr - 128) * 0.85 + 128 + 14;
      g = (sg - 128) * 0.85 + 128 + 8;
      b = (sb - 128) * 0.85 + 128 + 2;
      if (w > 0 && h > 0) {
        const p = i / 4;
        const x = (p % w) / w - 0.5;
        const y = Math.floor(p / w) / h - 0.5;
        const v = 1 - Math.min(0.38, Math.max(0, Math.sqrt(x * x + y * y) - 0.28) * 0.9);
        r *= v;
        g *= v;
        b *= v;
      }
    }
    data[i] = c255(r);
    data[i + 1] = c255(g);
    data[i + 2] = c255(b);
  }
}

// ─── Modelo ─────────────────────────────────────────────────────────

export type Enfeite = "nenhum" | "fita" | "coracao" | "estrela";

export interface VersoPolaroid {
  ativo: boolean;
  mensagem: string;
  /** Endereço para o QR Code (vazio = sem QR). */
  qr: string;
}

export interface ConfigPolaroid {
  tamanho: TamanhoPolaroid;
  moldura: string;
  filtro: FiltroFoto;
  /** Legenda para quem não tem a sua. */
  legendaPadrao: string;
  /** Usa o nome do arquivo (sem extensão) como legenda de quem não tem a sua. */
  legendaDoArquivo: boolean;
  /** Texto pequeno no canto da borda de baixo (ex.: "15/03/2026"). */
  data: string;
  enfeite: Enfeite;
  verso: VersoPolaroid;
}

export const configPolaroidPadrao: ConfigPolaroid = {
  tamanho: "classica",
  moldura: "#ffffff",
  filtro: "nenhum",
  legendaPadrao: "",
  legendaDoArquivo: false,
  data: "",
  enfeite: "nenhum",
  verso: { ativo: false, mensagem: "", qr: "" },
};

export const MOLDURAS = [
  { nome: "Branca", hex: "#ffffff" },
  { nome: "Creme", hex: "#f6efe0" },
  { nome: "Preta", hex: "#1a1a1a" },
  { nome: "Rosa", hex: "#fbcfe8" },
  { nome: "Azul bebê", hex: "#bfdbfe" },
  { nome: "Menta", hex: "#bbf7d0" },
  { nome: "Amarela", hex: "#fde68a" },
];

export interface ItemPolaroid {
  id: string;
  /** Nome do arquivo da foto (para a legenda automática). */
  arquivo: string;
  qtd: number;
  legenda: string;
}

export const MAX_PECAS = 600;
export const MAX_COPIAS = 99;

/** "Maria_e_Joao-2026.jpg" → "Maria e Joao 2026". */
export function legendaDoNomeDeArquivo(arquivo: string): string {
  return arquivo
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Legenda de um item: a dele, ou a padrão, ou o nome do arquivo (se ligado). */
export function legendaDoItem(i: ItemPolaroid, cfg: Pick<ConfigPolaroid, "legendaPadrao" | "legendaDoArquivo">): string {
  if (i.legenda.trim()) return i.legenda.trim();
  if (cfg.legendaPadrao.trim()) return cfg.legendaPadrao.trim();
  return cfg.legendaDoArquivo ? legendaDoNomeDeArquivo(i.arquivo) : "";
}

/**
 * Quantas cópias somar, na ordem, para preencher a última folha (sem passar do limite).
 * Devolve o aumento de cada item (mesma ordem de `qtds`).
 */
export function completarFolha(qtds: number[], porFolha: number): number[] {
  const total = qtds.reduce((a, b) => a + b, 0);
  const aumento = qtds.map(() => 0);
  if (!porFolha || !qtds.length || !total) return aumento;
  let faltam = (porFolha - (total % porFolha)) % porFolha;
  let i = 0;
  while (faltam > 0 && i < qtds.length * 100) {
    const k = i % qtds.length;
    if (qtds[k] + aumento[k] < MAX_COPIAS) {
      aumento[k]++;
      faltam--;
    }
    i++;
  }
  return aumento;
}

// ─── Desenho do PDF ─────────────────────────────────────────────────

export interface FontePolaroid {
  fontkit: unknown;
  /** Fonte manuscrita (Caveat). */
  caveat: Uint8Array;
}

export interface EntradaPolaroid {
  cfg: ConfigPolaroid;
  itens: ItemPolaroid[];
  /** Foto já recortada e com filtro (JPG), pela id do item. */
  fotos: Map<string, Imagem>;
  fonte?: FontePolaroid | null;
}

export interface PolaroidsGeradas {
  bytes: Uint8Array;
  pecas: number;
  folhas: number;
  /** Total de páginas do PDF (com versos, são duas por folha). */
  paginas: number;
  avisos: string[];
}

const PARDO = rgb(0.55, 0.55, 0.55);

/** Executa o desenho de uma peça (em coordenadas locais, em pontos, origem no canto de baixo à esquerda) já posicionada na folha. */
function naFolha(page: PDFPage, bx: number, by: number, pw: number, ph: number, rot: 0 | 90 | -90, desenhar: () => void) {
  page.pushOperators(pushGraphicsState());
  if (rot === 0) page.pushOperators(concatTransformationMatrix(1, 0, 0, 1, bx, by));
  else if (rot === 90) page.pushOperators(concatTransformationMatrix(0, 1, -1, 0, bx + ph, by));
  else page.pushOperators(concatTransformationMatrix(0, -1, 1, 0, bx, by + pw));
  desenhar();
  page.pushOperators(popGraphicsState());
}

function marcas(page: PDFPage, x: number, y: number, w: number, h: number) {
  // x, y = canto de baixo à esquerda (pt); ticks de 3 mm a 1 mm da peça
  const t = mmPt(3);
  const o = mmPt(1);
  const linha = (ax: number, ay: number, bx: number, by: number) => page.drawLine({ start: { x: ax, y: ay }, end: { x: bx, y: by }, thickness: 0.35, color: PARDO });
  for (const [px, py, dx, dy] of [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ] as const) {
    linha(px + dx * o, py, px + dx * (o + t), py);
    linha(px, py + dy * o, px, py + dy * (o + t));
  }
}

async function criarFonteManuscrita(doc: PDFDocument, f?: FontePolaroid | null): Promise<{ fonte: PDFFont; k: number }> {
  if (f) {
    try {
      doc.registerFontkit(f.fontkit as never);
      return { fonte: await doc.embedFont(f.caveat, { subset: true }), k: 1 };
    } catch {
      /* cai na Helvetica */
    }
  }
  return { fonte: await doc.embedFont(StandardFonts.HelveticaOblique), k: 0.8 };
}

/** Texto centralizado que diminui/quebra para caber. Coordenadas em pontos. */
function textoCentrado(page: PDFPage, fonte: PDFFont, texto: string, cx: number, cy: number, tamPt: number, maxLarg: number, cor: ReturnType<typeof rgb>, k = 1) {
  const medir = (s: string, pt: number) => fonte.widthOfTextAtSize(s, pt * k);
  const aj = ajustarTexto(medir, soSuportados(fonte, texto), tamPt, maxLarg);
  const pt = aj.tam * k;
  const entre = pt * 1.05;
  const topo = cy + ((aj.linhas.length - 1) * entre) / 2;
  aj.linhas.forEach((l, i) => page.drawText(l, { x: cx - fonte.widthOfTextAtSize(l, pt) / 2, y: topo - i * entre - pt * 0.3, size: pt, font: fonte, color: cor }));
  return aj;
}

function desenharQr(page: PDFPage, url: string, cx: number, cy: number, tam: number) {
  const m = qrModulos(url);
  const n = m.length;
  const mod = tam / (n + 2);
  const x0 = cx - tam / 2;
  const y0 = cy + tam / 2;
  page.drawRectangle({ x: x0, y: y0 - tam, width: tam, height: tam, color: rgb(1, 1, 1) });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; ) {
      if (!m[r][c]) {
        c++;
        continue;
      }
      let fim = c;
      while (fim + 1 < n && m[r][fim + 1]) fim++;
      page.drawRectangle({ x: x0 + (c + 1) * mod, y: y0 - (r + 2) * mod, width: (fim - c + 1) * mod, height: mod, color: rgb(0, 0, 0), borderWidth: 0 });
      c = fim + 1;
    }
  }
}

/** Gera o PDF A4 com as polaroids (e, se ligado, o verso de cada folha logo depois dela). */
export async function gerarPolaroids(e: EntradaPolaroid): Promise<PolaroidsGeradas> {
  const { cfg } = e;
  const med = POLAROIDS[cfg.tamanho];
  const plano = planejarFolha(cfg.tamanho);
  const avisos: string[] = [];
  const pecas: ItemPolaroid[] = [];
  for (const i of e.itens) for (let c = 0; c < Math.min(MAX_COPIAS, Math.max(1, i.qtd)); c++) pecas.push(i);
  if (pecas.length > MAX_PECAS) {
    avisos.push(`Passou de ${MAX_PECAS} polaroids: só as primeiras ${MAX_PECAS} entram no PDF.`);
    pecas.length = MAX_PECAS;
  }
  const doc = await PDFDocument.create();
  const { fonte, k } = await criarFonteManuscrita(doc, e.fonte);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const imagens = new Map<string, PDFImage>();
  const pw = mmPt(med.w);
  const ph = mmPt(med.h);
  const corMoldura = corParaRgb(cfg.moldura);
  const escuro = !ehClara(cfg.moldura);
  const corTexto = escuro ? rgb(0.95, 0.95, 0.95) : rgb(0.17, 0.17, 0.2);
  const rot: 0 | 90 = plano.girada ? 90 : 0;
  const posicao = (k: number, espelhar: boolean) => {
    const c0 = k % plano.cols;
    const c = espelhar ? plano.cols - 1 - c0 : c0;
    const l = Math.floor(k / plano.cols);
    const x = plano.x0 + c * (plano.pecaW + plano.espaco);
    const y = plano.y0 + l * (plano.pecaH + plano.espaco);
    return { bx: mmPt(x), by: mmPt(A4.h - y - plano.pecaH) };
  };

  const frente = (page: PDFPage, p: ItemPolaroid) => {
    page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: corMoldura });
    const fx = mmPt(med.lado);
    const fy = ph - mmPt(med.topo) - mmPt(med.foto.h);
    const img = e.fotos.get(p.id);
    if (img) page.drawImage(imagens.get(p.id) as PDFImage, { x: fx, y: fy, width: mmPt(med.foto.w), height: mmPt(med.foto.h) });
    else page.drawRectangle({ x: fx, y: fy, width: mmPt(med.foto.w), height: mmPt(med.foto.h), color: rgb(0.85, 0.86, 0.88) });
    // área de baixo
    const baixo = fy; // altura da borda de baixo em pt
    const legenda = legendaDoItem(p, cfg);
    const cy = baixo / 2 + mmPt(0.5);
    if (legenda) textoCentrado(page, fonte, legenda, pw / 2, cy, Math.min(20, med.w * 0.24), pw - mmPt(2 * med.lado + 4), corTexto, k);
    if (cfg.data.trim()) {
      const d = soSuportados(negrito, cfg.data.trim());
      const tam = 6.5;
      page.drawText(d, { x: pw - mmPt(med.lado) - negrito.widthOfTextAtSize(d, tam), y: mmPt(2.6), size: tam, font: negrito, color: escuro ? rgb(0.8, 0.8, 0.8) : rgb(0.45, 0.45, 0.5) });
    }
    // enfeites
    if (cfg.enfeite === "fita") {
      const fw = mmPt(24);
      const fh = mmPt(7);
      page.drawRectangle({ x: pw / 2 - fw / 2, y: ph - mmPt(3.5), width: fw, height: fh, color: rgb(0.99, 0.86, 0.45), opacity: 0.8, rotate: degrees(-3), borderWidth: 0 });
    } else if (cfg.enfeite === "coracao" || cfg.enfeite === "estrela") {
      const R = mmPt(2.6);
      const x = mmPt(med.lado) + R;
      const y = baixo / 2;
      if (cfg.enfeite === "coracao") page.drawSvgPath("M 0 -0.35 C -0.5 -1 -1.25 -0.05 0 0.95 C 1.25 -0.05 0.5 -1 0 -0.35 Z", { x, y: y + R * 0.1, scale: R, color: rgb(0.88, 0.11, 0.28), borderWidth: 0 });
      else {
        const pts = Array.from({ length: 10 }, (_, i) => {
          const a = ((-90 + i * 36) * Math.PI) / 180;
          const r = i % 2 === 0 ? 1 : 0.45;
          return `${(Math.cos(a) * r).toFixed(3)} ${(Math.sin(a) * r).toFixed(3)}`;
        });
        page.drawSvgPath(`M ${pts.join(" L ")} Z`, { x, y, scale: R, color: rgb(0.96, 0.62, 0.04), borderWidth: 0 });
      }
    }
  };

  const verso = (page: PDFPage) => {
    page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: corMoldura });
    const msg = cfg.verso.mensagem.trim();
    const qr = cfg.verso.qr.trim();
    const qrTam = qr ? Math.min(pw, ph) * 0.38 : 0;
    const zona = ph - mmPt(14) - (qr ? qrTam + mmPt(6) : 0);
    if (msg) textoCentrado(page, fonte, msg, pw / 2, ph - mmPt(7) - zona / 2, Math.min(18, med.w * 0.22), pw - mmPt(14), corTexto, k);
    if (qr) desenharQr(page, qr, pw / 2, mmPt(7) + qrTam / 2, qrTam);
  };

  let folhas = 0;
  for (let ini = 0; ini < pecas.length; ini += plano.porFolha) {
    const lote = pecas.slice(ini, ini + plano.porFolha);
    // as fotos que ainda não foram embutidas
    for (const p of lote) {
      const img = e.fotos.get(p.id);
      if (img && !imagens.has(p.id)) imagens.set(p.id, img.tipo === "jpg" ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes));
    }
    const page = doc.addPage([mmPt(A4.w), mmPt(A4.h)]);
    lote.forEach((p, i) => {
      const { bx, by } = posicao(i, false);
      naFolha(page, bx, by, pw, ph, rot, () => frente(page, p));
      marcas(page, bx, by, mmPt(plano.pecaW), mmPt(plano.pecaH));
    });
    folhas++;
    if (cfg.verso.ativo && (cfg.verso.mensagem.trim() || cfg.verso.qr.trim())) {
      const pv = doc.addPage([mmPt(A4.w), mmPt(A4.h)]);
      lote.forEach((_, i) => {
        const { bx, by } = posicao(i, true);
        naFolha(pv, bx, by, pw, ph, rot === 90 ? -90 : 0, () => verso(pv));
        marcas(pv, bx, by, mmPt(plano.pecaW), mmPt(plano.pecaH));
      });
    }
  }
  doc.setTitle("Fotos Polaroid");
  return { bytes: await doc.save(), pecas: pecas.length, folhas, paginas: doc.getPageCount(), avisos };
}

// ─── Conferência ────────────────────────────────────────────────────

export interface ItemConferenciaPolaroid {
  nivel: "ok" | "atencao" | "erro";
  texto: string;
}

export interface EntradaConferenciaPolaroid {
  cfg: ConfigPolaroid;
  itens: (ItemPolaroid & { w: number; h: number; zoom: number })[];
}

/** O que merece um olhar antes de imprimir. */
export function conferirPolaroids(e: EntradaConferenciaPolaroid): ItemConferenciaPolaroid[] {
  const out: ItemConferenciaPolaroid[] = [];
  const med = POLAROIDS[e.cfg.tamanho];
  if (!e.itens.length) return [{ nivel: "erro", texto: "Solte as fotos para ver a conferência." }];
  const total = e.itens.reduce((a, i) => a + i.qtd, 0);
  const r = resumoDeFolhas(e.cfg.tamanho, total);
  out.push({ nivel: "ok", texto: `${total} polaroid(s) ${med.nome.toLowerCase()}(s) em ${r.folhas} folha(s) A4, ${r.porFolha} por folha${planejarFolha(e.cfg.tamanho).girada ? " (deitadas)" : ""}.` });
  if (r.sobram > 0) out.push({ nivel: "atencao", texto: `Sobram ${r.sobram} lugar(es) vazio(s) na última folha. Use "Completar a folha" para aproveitar.` });
  if (total > MAX_PECAS) out.push({ nivel: "erro", texto: `Passou de ${MAX_PECAS} polaroids: o PDF só leva as primeiras ${MAX_PECAS}.` });
  const baixa: string[] = [];
  for (const i of e.itens) {
    const ladoMin = Math.min(i.w, i.h * (med.foto.w / med.foto.h)) / Math.max(1, i.zoom);
    const ppi = ladoMin / (med.foto.w / 25.4);
    if (ppi < 150) baixa.push(`${i.arquivo} (${Math.round(ppi)} ppi)`);
  }
  if (baixa.length) out.push({ nivel: "atencao", texto: `Foto com pouca resolução para esse tamanho (o ideal é 200 ppi ou mais): ${baixa.slice(0, 4).join(", ")}${baixa.length > 4 ? ` e mais ${baixa.length - 4}` : ""}.` });
  if (e.cfg.verso.ativo && !e.cfg.verso.mensagem.trim() && !e.cfg.verso.qr.trim()) out.push({ nivel: "atencao", texto: "O verso está ligado, mas sem mensagem nem QR Code: nenhum verso será impresso." });
  if (e.cfg.verso.ativo) out.push({ nivel: "ok", texto: "Verso: imprima em frente e verso virando pela borda longa. Os lugares já saem espelhados." });
  if (!out.some((x) => x.nivel !== "ok")) out.push({ nivel: "ok", texto: "Nenhum problema encontrado." });
  return out;
}

