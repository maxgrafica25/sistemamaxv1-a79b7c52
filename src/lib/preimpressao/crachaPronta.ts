// Crachás → "Arte pronta" (do cliente, do Canva ou do Corel).
// A arte já vem pronta (PDF, PNG ou JPG): o sistema só coloca no tamanho do cartão CR80 da Fargo C50,
// confere proporção e resolução, repete as cópias e gera o PDF da frente e o do verso, na mesma ordem.
// Vários arquivos = um cartão para cada um (um PDF de várias páginas = um cartão por página).
// Tudo no navegador, sem IA e sem custo.

import { PDFDocument, concatTransformationMatrix, popGraphicsState, pushGraphicsState, type PDFEmbeddedPage, type PDFImage, type PDFPage } from "pdf-lib";
import type { Imagem } from "./agenda";
import { CARTAO_MM, corParaRgb, dimensoes, type Orientacao } from "./cracha";
import { PT_POR_MM } from "./folha";

const mmPt = (v: number) => v * PT_POR_MM;

export interface ArtePronta {
  id: string;
  nome: string;
  tipo: "pdf" | "imagem";
  /** PDF: o arquivo inteiro. */
  bytes?: Uint8Array;
  /** Imagem (PNG ou JPG já reduzida). */
  img?: Imagem;
  paginas: number;
  /** Largura ÷ altura da 1ª página. */
  aspecto: number;
  /** Só imagens: pixels. */
  px?: { w: number; h: number };
  /** Cópias de cada cartão deste arquivo. */
  copias: number;
}

export type ModoVerso = "nenhum" | "igual" | "alternado";
export type EncaixePronta = "preencher" | "inteira";

export const MAX_COPIAS_PRONTA = 500;
export const MAX_CARTOES_PRONTA = 2000;

/** Deitado se a arte é mais larga que alta. */
export const orientacaoSugerida = (aspecto: number): Orientacao => (aspecto > 1.02 ? "deitado" : "pe");

export interface CartaoPronto {
  frente: { arte: number; pagina: number };
  verso: { arte: number; pagina: number } | null;
  copias: number;
}

export interface EntradaProntas {
  orientacao: Orientacao;
  encaixe: EncaixePronta;
  /** Cor do fundo quando a arte não cobre o cartão (encaixe "inteira"). */
  corFundo: string;
  artes: ArtePronta[];
  modoVerso: ModoVerso;
  /** Arte do verso (modo "igual"): a 1ª página dela vale para todos. */
  versoArte: ArtePronta | null;
  /** Gira o verso 180° (conforme o cartão entra na impressora). */
  girarVerso: boolean;
}

/** Quais páginas viram cartões (e o verso de cada um, se houver). */
export function listarCartoes(artes: ArtePronta[], modoVerso: ModoVerso): { cartoes: CartaoPronto[]; avisos: string[] } {
  const cartoes: CartaoPronto[] = [];
  const avisos: string[] = [];
  artes.forEach((a, ai) => {
    const copias = Math.min(MAX_COPIAS_PRONTA, Math.max(1, a.copias));
    if (modoVerso === "alternado") {
      if (a.paginas % 2 !== 0) avisos.push(`“${a.nome}” tem ${a.paginas} páginas: com frente e verso alternados precisa ser um número par. A última página foi ignorada.`);
      for (let p = 0; p + 1 < a.paginas; p += 2) cartoes.push({ frente: { arte: ai, pagina: p }, verso: { arte: ai, pagina: p + 1 }, copias });
    } else {
      for (let p = 0; p < a.paginas; p++) cartoes.push({ frente: { arte: ai, pagina: p }, verso: null, copias });
    }
  });
  return { cartoes, avisos };
}

interface PaginaEmbutida {
  w: number;
  h: number;
  desenhar: (page: PDFPage, x: number, y: number, escala: number) => void;
}

async function embutir(doc: PDFDocument, a: ArtePronta): Promise<(PaginaEmbutida | null)[]> {
  if (a.tipo === "imagem" && a.img) {
    const emb: PDFImage = a.img.tipo === "jpg" ? await doc.embedJpg(a.img.bytes) : await doc.embedPng(a.img.bytes);
    return [{ w: emb.width, h: emb.height, desenhar: (pg, x, y, e) => pg.drawImage(emb, { x, y, width: emb.width * e, height: emb.height * e }) }];
  }
  if (!a.bytes) return [];
  const origem = await PDFDocument.load(a.bytes);
  const idx: number[] = [];
  origem.getPages().forEach((p, i) => {
    if (p.node.Contents()) idx.push(i);
  });
  const embutidas: PDFEmbeddedPage[] = idx.length ? await doc.embedPdf(origem, idx) : [];
  const saida: (PaginaEmbutida | null)[] = origem.getPages().map(() => null);
  idx.forEach((i, k) => {
    const e = embutidas[k];
    saida[i] = { w: e.width, h: e.height, desenhar: (pg, x, y, esc) => pg.drawPage(e, { x, y, xScale: esc, yScale: esc }) };
  });
  return saida;
}

export interface ProntasGeradas {
  /** PDF das frentes (uma página por cartão, já com as cópias). */
  frente: Uint8Array;
  /** PDF dos versos na mesma ordem (null = sem verso). */
  verso: Uint8Array | null;
  cartoes: number;
  paginas: number;
  avisos: string[];
}

function colocar(page: PDFPage, p: PaginaEmbutida | null, W: number, H: number, encaixe: EncaixePronta) {
  if (!p) return;
  const e = encaixe === "preencher" ? Math.max(W / p.w, H / p.h) : Math.min(W / p.w, H / p.h);
  p.desenhar(page, (W - p.w * e) / 2, (H - p.h * e) / 2, e);
}

/** Gera os PDFs do cartão (frente e verso) com a arte pronta encaixada no CR80. */
export async function gerarProntas(e: EntradaProntas): Promise<ProntasGeradas> {
  const { w: Wm, h: Hm } = dimensoes(e.orientacao);
  const W = mmPt(Wm);
  const H = mmPt(Hm);
  const { cartoes, avisos } = listarCartoes(e.artes, e.modoVerso);
  const docF = await PDFDocument.create();
  const embF = await Promise.all(e.artes.map((a) => embutir(docF, a)));
  const temVerso = e.modoVerso !== "nenhum" && (e.modoVerso === "alternado" || !!e.versoArte);
  const docV = temVerso ? await PDFDocument.create() : null;
  const embVerso = docV && e.modoVerso === "igual" && e.versoArte ? (await embutir(docV, e.versoArte))[0] ?? null : null;
  const embV = docV && e.modoVerso === "alternado" ? await Promise.all(e.artes.map((a) => embutir(docV, a))) : null;
  const fundo = corParaRgb(e.corFundo);
  let paginas = 0;
  for (const c of cartoes) {
    for (let k = 0; k < c.copias && paginas < MAX_CARTOES_PRONTA; k++) {
      const pf = docF.addPage([W, H]);
      pf.drawRectangle({ x: 0, y: 0, width: W, height: H, color: fundo });
      colocar(pf, embF[c.frente.arte][c.frente.pagina] ?? null, W, H, e.encaixe);
      if (docV) {
        const pv = docV.addPage([W, H]);
        if (e.girarVerso) pv.pushOperators(...girar180(W, H));
        pv.drawRectangle({ x: 0, y: 0, width: W, height: H, color: fundo });
        const origem = e.modoVerso === "igual" ? embVerso : c.verso && embV ? (embV[c.verso.arte][c.verso.pagina] ?? null) : null;
        colocar(pv, origem, W, H, e.encaixe);
        if (e.girarVerso) pv.pushOperators(...fim180());
      }
      paginas++;
    }
  }
  if (paginas >= MAX_CARTOES_PRONTA) avisos.push(`Passou de ${MAX_CARTOES_PRONTA} cartões: só os primeiros ${MAX_CARTOES_PRONTA} entram no PDF.`);
  docF.setTitle("Crachás");
  docV?.setTitle("Versos dos crachás");
  return { frente: await docF.save(), verso: docV ? await docV.save() : null, cartoes: cartoes.length, paginas, avisos };
}

const girar180 = (W: number, H: number) => [pushGraphicsState(), concatTransformationMatrix(-1, 0, 0, -1, W, H)];
const fim180 = () => [popGraphicsState()];

// ─── Conferência ────────────────────────────────────────────────────

export interface ItemConferenciaPronta {
  nivel: "ok" | "atencao" | "erro";
  texto: string;
}

/** O que merece um olhar antes de gastar cartão e fita. */
export function conferirProntas(e: Pick<EntradaProntas, "orientacao" | "encaixe" | "artes" | "modoVerso" | "versoArte">): ItemConferenciaPronta[] {
  if (!e.artes.length) return [{ nivel: "erro", texto: "Solte a arte do crachá (PDF, PNG ou JPG) para ver a conferência." }];
  const out: ItemConferenciaPronta[] = [];
  const { w, h } = dimensoes(e.orientacao);
  const alvo = w / h;
  const { cartoes, avisos } = listarCartoes(e.artes, e.modoVerso);
  const total = cartoes.reduce((a, c) => a + Math.min(MAX_COPIAS_PRONTA, Math.max(1, c.copias)), 0);
  out.push({ nivel: "ok", texto: `${cartoes.length} cartão(ões), ${total} cópia(s) no total, ${CARTAO_MM.w} × ${CARTAO_MM.h} mm ${e.orientacao === "pe" ? "em pé" : "deitado"}.` });
  for (const a of avisos) out.push({ nivel: "atencao", texto: a });
  const fora: string[] = [];
  const pequenas: string[] = [];
  const contrarias: string[] = [];
  for (const a of e.artes) {
    const desvio = Math.abs(a.aspecto / alvo - 1);
    if (desvio > 0.04) {
      if (Math.abs(1 / a.aspecto / alvo - 1) <= 0.04) contrarias.push(a.nome);
      else fora.push(a.nome);
    }
    if (a.px && a.px.w < (w / 25.4) * 200) pequenas.push(`${a.nome} (${a.px.w} px)`);
  }
  if (contrarias.length) out.push({ nivel: "atencao", texto: `A arte está ${e.orientacao === "pe" ? "deitada" : "em pé"} e o cartão está ${e.orientacao === "pe" ? "em pé" : "deitado"}: ${contrarias.slice(0, 3).join(", ")}. Troque a posição do cartão.` });
  if (fora.length) out.push({ nivel: "atencao", texto: e.encaixe === "preencher" ? `Proporção diferente do cartão (vai cortar nas bordas): ${fora.slice(0, 3).join(", ")}.` : `Proporção diferente do cartão (vão sobrar bordas): ${fora.slice(0, 3).join(", ")}.` });
  if (pequenas.length) out.push({ nivel: "atencao", texto: `Arte pequena para a Fargo (300 dpi pede ${Math.round((w / 25.4) * 300)} px de largura ou mais): ${pequenas.slice(0, 3).join(", ")}.` });
  if (e.modoVerso === "igual" && !e.versoArte) out.push({ nivel: "atencao", texto: "Escolheu verso igual para todos, mas ainda não soltou a arte do verso." });
  if (!out.some((i) => i.nivel === "atencao" || i.nivel === "erro")) out.push({ nivel: "ok", texto: "Nenhum problema encontrado." });
  return out;
}
