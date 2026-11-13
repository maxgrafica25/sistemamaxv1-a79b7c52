// Pré-impressão → "Fotos 3×4" (fotos de documento no balcão).
// Monta fotos 3 × 4 cm (ou 5 × 7 e medida livre) na folha: A4, papel fotográfico 10 × 15 / 13 × 18, A5 ou A3.
// Várias pessoas ao mesmo tempo, cópias de cada uma, enquadramento do rosto, linhas de corte exatas.
// Tudo no navegador, sem IA e sem custo. Aqui fica a parte pura (grade, conferência) e o PDF.

import { PDFDocument, rgb } from "pdf-lib";
import type { Imagem } from "./agenda";
import { retanguloDeCorte } from "./cracha";
import { PT_POR_MM } from "./folha";
import type { FiltroFoto } from "./polaroid";

const mmPt = (v: number) => v * PT_POR_MM;

export type PapelFoto = "a4" | "a3" | "a5" | "10x15" | "13x18";

export const PAPEIS_FOTO: Record<PapelFoto, { nome: string; w: number; h: number }> = {
  a4: { nome: "A4", w: 210, h: 297 },
  "10x15": { nome: "Foto 10 × 15", w: 100, h: 150 },
  "13x18": { nome: "Foto 13 × 18", w: 130, h: 180 },
  a5: { nome: "A5", w: 148, h: 210 },
  a3: { nome: "A3", w: 297, h: 420 },
};

export type TamanhoFoto = "3x4" | "5x7" | "livre";

export const TAMANHOS_FOTO: Record<Exclude<TamanhoFoto, "livre">, { nome: string; w: number; h: number }> = {
  "3x4": { nome: "3 × 4 cm", w: 30, h: 40 },
  "5x7": { nome: "5 × 7 cm", w: 50, h: 70 },
};

export type LinhasDeCorte = "cantos" | "contorno" | "nenhuma";

export interface ConfigFotoDoc {
  tamanho: TamanhoFoto;
  /** Só para a medida livre, em mm. */
  larguraMm: number;
  alturaMm: number;
  papel: PapelFoto;
  /** Espaço entre as fotos, em mm (0 = encostadas: um corte só entre elas). */
  espaco: number;
  marcas: LinhasDeCorte;
  filtro: FiltroFoto;
  /** Quantas por folha (0 = encher a folha). */
  porFolha: number;
}

export const configFotoDocPadrao: ConfigFotoDoc = {
  tamanho: "3x4",
  larguraMm: 35,
  alturaMm: 45,
  papel: "a4",
  espaco: 0,
  marcas: "cantos",
  filtro: "nenhum",
  porFolha: 0,
};

export const MARGEM_MM = 5;
export const MAX_PECAS_FOTO = 1000;
export const MAX_COPIAS_FOTO = 99;

export function medidaDaFoto(c: Pick<ConfigFotoDoc, "tamanho" | "larguraMm" | "alturaMm">): { w: number; h: number } {
  if (c.tamanho === "livre") return { w: Math.min(150, Math.max(15, c.larguraMm)), h: Math.min(200, Math.max(15, c.alturaMm)) };
  return TAMANHOS_FOTO[c.tamanho];
}

export interface GradeFoto {
  /** Página (já considerando se ficou deitada). */
  paginaW: number;
  paginaH: number;
  deitada: boolean;
  cols: number;
  linhas: number;
  /** Quantas cabem inteiras na folha. */
  capacidade: number;
  /** Quantas vão em cada folha (a escolhida, limitada à capacidade). */
  porFolha: number;
  /** Colunas/linhas do bloco usado (centralizado na folha). */
  colsUsadas: number;
  linhasUsadas: number;
  x0: number;
  y0: number;
  w: number;
  h: number;
  espaco: number;
}

/** Escolhe a folha em pé ou deitada (a que render mais), posiciona o bloco de fotos no centro. */
export function planejarGrade(c: ConfigFotoDoc): GradeFoto {
  const { w, h } = medidaDaFoto(c);
  const P = PAPEIS_FOTO[c.papel];
  const g = c.espaco;
  const calc = (pw: number, ph: number) => {
    const cols = Math.max(0, Math.floor((pw - 2 * MARGEM_MM + g) / (w + g)));
    const linhas = Math.max(0, Math.floor((ph - 2 * MARGEM_MM + g) / (h + g)));
    return { cols, linhas, n: cols * linhas, pw, ph };
  };
  const a = calc(P.w, P.h);
  const b = calc(P.h, P.w);
  const deitada = b.n > a.n;
  const r = deitada ? b : a;
  const porFolha = r.n === 0 ? 0 : c.porFolha > 0 ? Math.min(c.porFolha, r.n) : r.n;
  const colsUsadas = Math.max(0, Math.min(r.cols, porFolha));
  const linhasUsadas = colsUsadas ? Math.ceil(porFolha / colsUsadas) : 0;
  const gridW = colsUsadas * w + Math.max(0, colsUsadas - 1) * g;
  const gridH = linhasUsadas * h + Math.max(0, linhasUsadas - 1) * g;
  return {
    paginaW: r.pw,
    paginaH: r.ph,
    deitada,
    cols: r.cols,
    linhas: r.linhas,
    capacidade: r.n,
    porFolha,
    colsUsadas,
    linhasUsadas,
    x0: (r.pw - gridW) / 2,
    y0: (r.ph - gridH) / 2,
    w,
    h,
    espaco: g,
  };
}

export interface ResumoFoto {
  pecas: number;
  folhas: number;
  porFolha: number;
  sobram: number;
}

export function resumoFoto(c: ConfigFotoDoc, pecas: number): ResumoFoto {
  const pf = planejarGrade(c).porFolha;
  if (!pf || !pecas) return { pecas, folhas: 0, porFolha: pf, sobram: 0 };
  const folhas = Math.ceil(pecas / pf);
  return { pecas, folhas, porFolha: pf, sobram: folhas * pf - pecas };
}

export interface ItemFotoDoc {
  id: string;
  arquivo: string;
  qtd: number;
}

export interface EntradaFotoDoc {
  cfg: ConfigFotoDoc;
  itens: ItemFotoDoc[];
  /** Foto já recortada (e com filtro), pela id do item. */
  fotos: Map<string, Imagem>;
}

export interface FotosGeradas {
  bytes: Uint8Array;
  pecas: number;
  folhas: number;
  avisos: string[];
}

/** Gera o PDF com as fotos na folha, no tamanho exato (imprimir a 100%). */
export async function gerarFotosDoc(e: EntradaFotoDoc): Promise<FotosGeradas> {
  const g = planejarGrade(e.cfg);
  const avisos: string[] = [];
  const pecas: ItemFotoDoc[] = [];
  for (const i of e.itens) for (let c = 0; c < Math.min(MAX_COPIAS_FOTO, Math.max(1, i.qtd)); c++) pecas.push(i);
  if (pecas.length > MAX_PECAS_FOTO) {
    avisos.push(`Passou de ${MAX_PECAS_FOTO} fotos: só as primeiras ${MAX_PECAS_FOTO} entram no PDF.`);
    pecas.length = MAX_PECAS_FOTO;
  }
  const doc = await PDFDocument.create();
  const imagens = new Map<string, Awaited<ReturnType<PDFDocument["embedJpg"]>>>();
  const cinza = rgb(0.45, 0.45, 0.45);
  const W = mmPt(g.paginaW);
  const H = mmPt(g.paginaH);
  let folhas = 0;
  if (!g.porFolha) {
    avisos.push("A foto não cabe nessa folha. Escolha uma folha maior ou uma medida menor.");
    return { bytes: await doc.save(), pecas: 0, folhas: 0, avisos };
  }
  for (let ini = 0; ini < pecas.length; ini += g.porFolha) {
    const lote = pecas.slice(ini, ini + g.porFolha);
    const page = doc.addPage([W, H]);
    folhas++;
    const xs = new Set<number>();
    const ys = new Set<number>();
    for (const [k, p] of lote.entries()) {
      const c = k % g.colsUsadas;
      const l = Math.floor(k / g.colsUsadas);
      const x = g.x0 + c * (g.w + g.espaco);
      const y = g.y0 + l * (g.h + g.espaco);
      const img = e.fotos.get(p.id);
      if (img) {
        let emb = imagens.get(p.id);
        if (!emb) {
          emb = img.tipo === "jpg" ? await doc.embedJpg(img.bytes) : await doc.embedPng(img.bytes);
          imagens.set(p.id, emb);
        }
        page.drawImage(emb, { x: mmPt(x), y: mmPt(g.paginaH - y - g.h), width: mmPt(g.w), height: mmPt(g.h) });
      } else {
        page.drawRectangle({ x: mmPt(x), y: mmPt(g.paginaH - y - g.h), width: mmPt(g.w), height: mmPt(g.h), color: rgb(0.88, 0.89, 0.91) });
      }
      if (e.cfg.marcas === "contorno") {
        page.drawRectangle({ x: mmPt(x), y: mmPt(g.paginaH - y - g.h), width: mmPt(g.w), height: mmPt(g.h), borderColor: cinza, borderWidth: 0.25 });
      }
      xs.add(Math.round(x * 100) / 100);
      xs.add(Math.round((x + g.w) * 100) / 100);
      ys.add(Math.round(y * 100) / 100);
      ys.add(Math.round((y + g.h) * 100) / 100);
    }
    if (e.cfg.marcas === "cantos") {
      // traços nas margens, alinhados com as linhas de corte (3 mm, a 1 mm da foto)
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      const t = 3;
      const o = 1;
      const traco = (ax: number, ay: number, bx: number, by: number) => page.drawLine({ start: { x: mmPt(ax), y: mmPt(g.paginaH - ay) }, end: { x: mmPt(bx), y: mmPt(g.paginaH - by) }, thickness: 0.35, color: cinza });
      for (const x of xs) {
        traco(x, yMin - o, x, yMin - o - t);
        traco(x, yMax + o, x, yMax + o + t);
      }
      for (const y of ys) {
        traco(xMin - o, y, xMin - o - t, y);
        traco(xMax + o, y, xMax + o + t, y);
      }
    }
  }
  doc.setTitle("Fotos 3x4");
  return { bytes: await doc.save(), pecas: pecas.length, folhas, avisos };
}

export interface ItemConferenciaFoto {
  nivel: "ok" | "atencao" | "erro";
  texto: string;
}

export interface EntradaConferenciaFoto {
  cfg: ConfigFotoDoc;
  itens: (ItemFotoDoc & { w: number; h: number; zoom: number })[];
}

export function conferirFotosDoc(e: EntradaConferenciaFoto): ItemConferenciaFoto[] {
  const out: ItemConferenciaFoto[] = [];
  if (!e.itens.length) return [{ nivel: "erro", texto: "Solte as fotos para ver a conferência." }];
  const { w, h } = medidaDaFoto(e.cfg);
  const g = planejarGrade(e.cfg);
  if (!g.capacidade) return [{ nivel: "erro", texto: `Uma foto de ${w / 10} × ${h / 10} cm não cabe em ${PAPEIS_FOTO[e.cfg.papel].nome}. Escolha uma folha maior ou uma medida menor.` }];
  const total = e.itens.reduce((a, i) => a + i.qtd, 0);
  const r = resumoFoto(e.cfg, total);
  out.push({ nivel: "ok", texto: `${total} foto(s) de ${w / 10} × ${h / 10} cm em ${r.folhas} folha(s) ${PAPEIS_FOTO[e.cfg.papel].nome}, ${r.porFolha} por folha${g.deitada ? " (folha deitada)" : ""}.` });
  if (r.sobram > 0) out.push({ nivel: "atencao", texto: `Sobram ${r.sobram} lugar(es) vazio(s) na última folha. Use "Completar a folha" para aproveitar.` });
  const baixa: string[] = [];
  const asp = w / h;
  for (const i of e.itens) {
    const lado = Math.min(i.w, i.h * asp) / Math.max(1, i.zoom);
    const ppi = lado / (w / 25.4);
    if (ppi < 150) baixa.push(`${i.arquivo} (${Math.round(ppi)} ppi)`);
  }
  if (baixa.length) out.push({ nivel: "atencao", texto: `Foto com pouca resolução para esse tamanho (o ideal é 250 ppi ou mais): ${baixa.slice(0, 4).join(", ")}${baixa.length > 4 ? ` e mais ${baixa.length - 4}` : ""}.` });
  if (total > MAX_PECAS_FOTO) out.push({ nivel: "erro", texto: `Passou de ${MAX_PECAS_FOTO} fotos: o PDF só leva as primeiras ${MAX_PECAS_FOTO}.` });
  if (!out.some((x) => x.nivel !== "ok")) out.push({ nivel: "ok", texto: "Nenhum problema encontrado." });
  out.push({ nivel: "ok", texto: "Imprima em tamanho real (100%): se a impressora reduzir, a foto deixa de ter 3 × 4 cm." });
  return out;
}

/** Retângulo (em pixels da foto) que fica na moldura: usado também pela tela. */
export { retanguloDeCorte };
