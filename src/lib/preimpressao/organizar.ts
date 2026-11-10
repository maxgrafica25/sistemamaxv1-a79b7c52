// Pré-impressão → "Organizar PDF": juntar arquivos (PDF, PNG, JPG), reordenar,
// girar e remover páginas, e separar em um arquivo por página.
// As páginas são copiadas como estão (vetor continua vetor; JPG não é recomprimido).
// Lógica pura, testável.

import { PDFDocument, degrees, type PDFImage } from "pdf-lib";
import { PT_POR_CM, detectarTipo, lerInfoImagem, normalizarRotacao, type InfoImagem } from "./margem";

export type Giro = 0 | 90 | 180 | 270;

/** Arquivo enviado. */
export interface Fonte {
  id: string;
  nome: string;
  tipo: "pdf" | "png" | "jpg";
  bytes: Uint8Array;
  /** Só imagens. */
  info?: InfoImagem;
  /** Tamanho visível de cada página em pt (já considerando o /Rotate do arquivo). */
  paginas: { w: number; h: number }[];
}

/** Uma página na ordem final. */
export interface PaginaItem {
  fonte: string;
  /** Índice da página dentro da fonte (0 = primeira). */
  pagina: number;
  /** Giro pedido pelo usuário, no sentido horário, somado ao do arquivo. */
  giro: Giro;
}

/** Imagem sem DPI gravado entra como 300 dpi (padrão de digitalização/impressos). */
export const DPI_SEM_INFO = 300;
export const LIMITE_PAGINAS = 500;

function tamanhoImagemPt(info: InfoImagem): { w: number; h: number } {
  const dpi = info.dpi ?? DPI_SEM_INFO;
  return { w: (info.larguraPx / dpi) * 72, h: (info.alturaPx / dpi) * 72 };
}

/** Lê um arquivo enviado e descobre as páginas (erros em português simples). */
export async function abrirFonte(id: string, nome: string, bytes: Uint8Array): Promise<Fonte> {
  const tipo = detectarTipo(bytes, nome);
  if (tipo === "cdr") throw new Error("Arquivo do Corel (.cdr): exporte como PDF antes (Arquivo → Exportar… → PDF).");
  if (tipo === "desconhecido") throw new Error("Formato não suportado. Envie PDF, PNG ou JPG.");
  if (tipo === "pdf") {
    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(bytes, { updateMetadata: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(/encrypt/i.test(msg) ? "PDF protegido por senha. Exporte de novo sem proteção." : "Não consegui abrir este PDF.");
    }
    const paginas = doc.getPages().map((p) => {
      const c = p.getCropBox();
      const deitada = normalizarRotacao(p.getRotation().angle) % 180 !== 0;
      return deitada ? { w: c.height, h: c.width } : { w: c.width, h: c.height };
    });
    if (!paginas.length) throw new Error("O PDF não tem páginas.");
    return { id, nome, tipo, bytes, paginas };
  }
  const info = lerInfoImagem(bytes, tipo);
  return { id, nome, tipo, bytes, info, paginas: [tamanhoImagemPt(info)] };
}

/** Monta um PDF com as páginas na ordem pedida. */
export async function montarPdf(fontes: Fonte[], itens: PaginaItem[]): Promise<Uint8Array> {
  if (!itens.length) throw new Error("Não há páginas para salvar.");
  if (itens.length > LIMITE_PAGINAS) throw new Error(`São ${itens.length} páginas: o máximo é ${LIMITE_PAGINAS}.`);
  const porId = new Map(fontes.map((f) => [f.id, f]));
  const out = await PDFDocument.create();
  out.setProducer("Sistema Max · Pré-impressão");
  out.setCreator("Sistema Max · Organizar PDF");
  const docs = new Map<string, PDFDocument>();
  const imagens = new Map<string, PDFImage>();

  for (const it of itens) {
    const f = porId.get(it.fonte);
    if (!f) throw new Error("Arquivo não encontrado na lista.");
    if (f.tipo === "pdf") {
      let src = docs.get(f.id);
      if (!src) {
        src = await PDFDocument.load(f.bytes, { updateMetadata: false });
        docs.set(f.id, src);
      }
      const [copia] = await out.copyPages(src, [it.pagina]);
      copia.setRotation(degrees((normalizarRotacao(copia.getRotation().angle) + it.giro) % 360));
      out.addPage(copia);
    } else {
      let img = imagens.get(f.id);
      if (!img) {
        img = f.tipo === "jpg" ? await out.embedJpg(f.bytes) : await out.embedPng(f.bytes);
        imagens.set(f.id, img);
      }
      const t = tamanhoImagemPt(f.info!);
      const page = out.addPage([t.w, t.h]);
      page.drawImage(img, { x: 0, y: 0, width: t.w, height: t.h });
      if (it.giro) page.setRotation(degrees(it.giro));
    }
  }
  return out.save();
}

/** "arquivo.pdf" + página 3 de 12 → "arquivo_p03.pdf". */
export function nomeDaPagina(nome: string, pagina: number, total: number): string {
  const base = nome.replace(/\.[^.]+$/, "");
  return total > 1 ? `${base}_p${String(pagina + 1).padStart(String(total).length, "0")}.pdf` : `${base}.pdf`;
}

/** Tamanho visível de uma página depois do giro, em cm. */
export function tamanhoComGiro(t: { w: number; h: number }, giro: Giro): { w: number; h: number } {
  const cm = (v: number) => v / PT_POR_CM;
  return giro % 180 === 0 ? { w: cm(t.w), h: cm(t.h) } : { w: cm(t.h), h: cm(t.w) };
}

// ─── Páginas em branco ───────────────────────────────────────────────

/** Fração da página (0–1) com "tinta": pixels mais escuros que o papel branco. */
export interface Tinta {
  /** Página inteira. */
  total: number;
  /** Sem as faixas de cima e de baixo (onde ficam cabeçalho e número de página). */
  miolo: number;
}

/** Faixa de cima e de baixo ignorada na opção "ignorar cabeçalho e rodapé". */
export const FAIXA_CABECALHO_RODAPE = 0.08;
/**
 * Até 0,01% da página com tinta (meia dúzia de pontinhos) ainda conta como em branco.
 * Apertado de propósito: uma frase curta ou um número de página já passa de 0,03%, e
 * apagar uma página com conteúdo é pior do que deixar uma em branco passar.
 */
export const LIMITE_BRANCO = 0.0001;
/** Pixel "com tinta" = luminosidade abaixo disso (0–255). Papel levemente cinza continua branco. */
export const TOLERANCIA_BRANCO = 235;
/** Borda de 2% ignorada (sombra de escaner, marca de dobra). */
const BORDA_IGNORADA = 0.02;

/** Mede a tinta de uma imagem RGBA (o que o canvas devolve). Pixel transparente conta como branco. */
export function tintaDaImagem(rgba: ArrayLike<number>, w: number, h: number): Tinta {
  const bx = Math.floor(w * BORDA_IGNORADA);
  const by = Math.floor(h * BORDA_IGNORADA);
  const faixa = Math.floor(h * FAIXA_CABECALHO_RODAPE);
  let total = 0;
  let miolo = 0;
  let areaTotal = 0;
  let areaMiolo = 0;
  for (let y = by; y < h - by; y++) {
    const noMiolo = y >= faixa && y < h - faixa;
    for (let x = bx; x < w - bx; x++) {
      const i = (y * w + x) * 4;
      const a = rgba[i + 3] / 255;
      // mistura com fundo branco e calcula a luminosidade
      const lum = 0.299 * (rgba[i] * a + 255 * (1 - a)) + 0.587 * (rgba[i + 1] * a + 255 * (1 - a)) + 0.114 * (rgba[i + 2] * a + 255 * (1 - a));
      const tinta = lum < TOLERANCIA_BRANCO;
      areaTotal++;
      if (tinta) total++;
      if (noMiolo) {
        areaMiolo++;
        if (tinta) miolo++;
      }
    }
  }
  return { total: areaTotal ? total / areaTotal : 0, miolo: areaMiolo ? miolo / areaMiolo : 0 };
}

/** A página está em branco? `ignorarFaixas` desconsidera cabeçalho e rodapé (número de página). */
export function paginaEmBranco(t: Tinta, ignorarFaixas: boolean, limite = LIMITE_BRANCO): boolean {
  return (ignorarFaixas ? t.miolo : t.total) <= limite;
}
