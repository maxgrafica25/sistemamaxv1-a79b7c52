// Pré-impressão → "Emenda de adesivo" (grande formato).
// A arte inteira é fatiada em partes que cabem na área de impressão do rolo (largura do rolo menos uma
// margem de borda), com sobreposição entre as partes (padrão 2 cm) para colar uma sobre a outra com
// segurança. O sistema compara os rolos cadastrados e sugere o de melhor aproveitamento (menos rolo
// gasto e menos emendas). A arte continua vetorial no PDF. Tudo no navegador, sem IA e sem custo.

import { PDFDocument, StandardFonts, concatTransformationMatrix, degrees, popGraphicsState, pushGraphicsState, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { LIMITE_ACROBAT_CM, PT_POR_CM, normalizarRotacao, origemRotacionada } from "./margem";

// ─── Rolos e plano de corte ─────────────────────────────────────────

/** Larguras de rolo de adesivo (cm) já cadastradas de saída; o atendente pode mudar a lista. */
export const ROLOS_PADRAO_CM = [105, 107, 126, 137, 152];
/** Margem de borda do rolo (total, somando os dois lados), em cm. */
export const MARGEM_ROLO_PADRAO_CM = 3;
/** Sobreposição entre as partes, em cm. */
export const SOBREPOSICAO_PADRAO_CM = 2;

/** colunas = a arte é cortada na largura (partes em pé, lado a lado); linhas = cortada na altura (faixas, a arte gira 90°). */
export type CorteEmenda = "colunas" | "linhas";

export interface ParteEmenda {
  /** Posição da parte ao longo da dimensão cortada (cm, a partir do começo da arte). */
  inicio: number;
  fim: number;
}

export interface PlanoEmenda {
  rolo: number;
  /** Largura de impressão (rolo menos a margem de borda). */
  imprimivel: number;
  corte: CorteEmenda;
  /** Quantidade de partes (1 = sem emenda). */
  partes: number;
  emendas: number;
  /** Largura de cada parte (a medida que atravessa o rolo), em cm. */
  larguraParte: number;
  /** Comprimento de cada parte ao longo do rolo, em cm. */
  comprimentoParte: number;
  faixas: ParteEmenda[];
  /** Rolo gasto (m lineares) e área do rolo gasta (m²), contando a largura inteira do rolo. */
  metrosLineares: number;
  consumidoM2: number;
  /** Parte do rolo gasto que é arte (0–1); o resto é margem, sobra e sobreposição. */
  aproveitamento: number;
  /** Alguma parte passa de 508 cm (o Acrobat não abre). */
  passaLimiteAcrobat: boolean;
}

/**
 * Plano para um rolo e uma direção de corte. `art` = tamanho final da arte (cm).
 * `null` se a sobreposição não cabe (área de impressão menor que a sobreposição).
 */
export function planejarEmenda(art: { w: number; h: number }, rolo: number, margemRolo: number, sobreposicao: number, corte: CorteEmenda): PlanoEmenda | null {
  const imprimivel = rolo - margemRolo;
  const D = corte === "colunas" ? art.w : art.h;
  const L = corte === "colunas" ? art.h : art.w;
  if (!(imprimivel > 0) || !(D > 0) || !(L > 0)) return null;
  let partes = 1;
  if (D > imprimivel + 1e-9) {
    if (imprimivel <= sobreposicao + 1e-9) return null;
    partes = Math.ceil((D - sobreposicao) / (imprimivel - sobreposicao) - 1e-9);
  }
  const larguraParte = (D + (partes - 1) * sobreposicao) / partes;
  const faixas: ParteEmenda[] = Array.from({ length: partes }, (_, k) => {
    const inicio = k * (larguraParte - sobreposicao);
    return { inicio, fim: inicio + larguraParte };
  });
  const metros = (partes * L) / 100;
  return {
    rolo,
    imprimivel,
    corte,
    partes,
    emendas: partes - 1,
    larguraParte,
    comprimentoParte: L,
    faixas,
    metrosLineares: metros,
    consumidoM2: (rolo / 100) * metros,
    aproveitamento: (art.w * art.h) / (rolo * partes * L),
    passaLimiteAcrobat: L > LIMITE_ACROBAT_CM || larguraParte > LIMITE_ACROBAT_CM,
  };
}

/** O melhor corte (colunas ou linhas) para um rolo: o que gasta menos rolo; empate, menos emendas. */
export function melhorCorte(art: { w: number; h: number }, rolo: number, margemRolo: number, sobreposicao: number, direcao: CorteEmenda | "melhor" = "melhor"): PlanoEmenda | null {
  const opcoes: CorteEmenda[] = direcao === "melhor" ? ["colunas", "linhas"] : [direcao];
  const planos = opcoes.map((c) => planejarEmenda(art, rolo, margemRolo, sobreposicao, c)).filter((p): p is PlanoEmenda => !!p);
  planos.sort((a, b) => a.consumidoM2 - b.consumidoM2 || a.partes - b.partes);
  return planos[0] ?? null;
}

/**
 * Compara os rolos cadastrados, do que melhor aproveita para o pior: menos rolo gasto (m²), depois menos
 * emendas, depois o rolo mais estreito.
 */
export function compararRolos(art: { w: number; h: number }, rolos: number[], margemRolo: number, sobreposicao: number, direcao: CorteEmenda | "melhor" = "melhor"): PlanoEmenda[] {
  const unicos = [...new Set(rolos.filter((r) => Number.isFinite(r) && r > 0))];
  const planos = unicos.map((r) => melhorCorte(art, r, margemRolo, sobreposicao, direcao)).filter((p): p is PlanoEmenda => !!p);
  return planos.sort((a, b) => a.consumidoM2 - b.consumidoM2 || a.partes - b.partes || a.rolo - b.rolo);
}

export const formatarCm = (v: number) => `${(Math.round(v * 10) / 10).toString().replace(".", ",")} cm`;

// ─── PDF ────────────────────────────────────────────────────────────


export interface ArteEmenda {
  tipo: "pdf" | "imagem";
  bytes: Uint8Array;
  /** Tipo da imagem (só quando tipo = "imagem"). */
  imagem?: "png" | "jpg";
  /** Tamanho da arte a 100%, em cm. */
  wCm: number;
  hCm: number;
}

export interface OpcoesEmenda {
  /** Escala da arte em % (100 = tamanho real). */
  escalaPct: number;
  sobreposicaoCm: number;
  /** "PARTE 1/3" legível (preto com contorno branco) de pé, a 0,5 cm da borda da direita e da de cima. */
  guias: boolean;
}

export interface EmendaGerada {
  bytes: Uint8Array;
  /** Uma página por parte, na ordem da colagem. */
  paginas: number;
}

/** Tamanho final da arte (cm) depois da escala. */
export const tamanhoFinal = (a: Pick<ArteEmenda, "wCm" | "hCm">, escalaPct: number) => ({ w: (a.wCm * escalaPct) / 100, h: (a.hCm * escalaPct) / 100 });

interface DesenhoArte {
  /** Desenha a arte inteira (já na escala) no sistema de coordenadas dela: origem no canto de baixo à esquerda. */
  desenhar: (page: PDFPage) => void;
}

async function prepararArte(doc: PDFDocument, a: ArteEmenda, escala: number): Promise<DesenhoArte> {
  if (a.tipo === "imagem") {
    const img: PDFImage = a.imagem === "jpg" ? await doc.embedJpg(a.bytes) : await doc.embedPng(a.bytes);
    const w = a.wCm * PT_POR_CM * escala;
    const h = a.hCm * PT_POR_CM * escala;
    return { desenhar: (pg) => pg.drawImage(img, { x: 0, y: 0, width: w, height: h }) };
  }
  const src = await PDFDocument.load(a.bytes, { updateMetadata: false });
  const page = src.getPages()[0];
  if (!page) throw new Error("O PDF não tem páginas.");
  const { x, y, width: w, height: h } = page.getCropBox();
  const rot = normalizarRotacao(page.getRotation().angle);
  const emb = await doc.embedPage(page, { left: x, bottom: y, right: x + w, top: y + h }, [1, 0, 0, 1, -x, -y]);
  const o = origemRotacionada(rot, w * escala, h * escala, 0, 0);
  return { desenhar: (pg) => pg.drawPage(emb, { x: o.x, y: o.y, width: w * escala, height: h * escala, rotate: degrees(-rot) }) };
}

/**
 * "PARTE 2/3" legível (preto com contorno branco, para ler em fundo claro ou em preto chapado), de pé (lido de cima
 * para baixo), a 0,5 cm da borda da direita e da de cima. Na parte 1 até a penúltima essa faixa fica coberta pela
 * parte seguinte; na última é a sobra de borda, que é refilada.
 */
function guias(page: PDFPage, fonte: PDFFont, plano: PlanoEmenda, k: number) {
  const largura = plano.larguraParte * PT_POR_CM;
  const comprimento = plano.comprimentoParte * PT_POR_CM;
  const tam = 18;
  const margem = 0.5 * PT_POR_CM;
  const texto = `PARTE ${k + 1}/${plano.partes}`;
  const x = largura - margem - tam * 0.72;
  const y = comprimento - margem;
  const c = tam * 0.07; // espessura do contorno
  const desenha = (dx: number, dy: number, cor: ReturnType<typeof rgb>) => page.drawText(texto, { x: x + dx, y: y + dy, size: tam, font: fonte, color: cor, rotate: degrees(-90) });
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    desenha(Math.cos(ang) * c, Math.sin(ang) * c, rgb(1, 1, 1));
  }
  desenha(0, 0, rgb(0, 0, 0));
}

/**
 * Gera o PDF com uma página por parte, na ordem da colagem. `indices` escolhe só algumas partes
 * (para mandar uma parte de cada vez ao RIP); sem ele saem todas.
 */
export async function gerarEmenda(arte: ArteEmenda, plano: PlanoEmenda, o: OpcoesEmenda, indices?: number[]): Promise<EmendaGerada> {
  const escala = o.escalaPct / 100;
  const art = tamanhoFinal(arte, o.escalaPct);
  const artHpt = art.h * PT_POR_CM;
  const doc = await PDFDocument.create();
  doc.setProducer("Sistema Max · Pré-impressão");
  doc.setCreator("Sistema Max · Emenda de adesivo");
  const desenho = await prepararArte(doc, arte, escala);
  const fonte = await doc.embedFont(StandardFonts.HelveticaBold);
  const lista = indices ?? plano.faixas.map((_, k) => k);
  for (const k of lista) {
    const parte = plano.faixas[k];
    const largura = plano.larguraParte * PT_POR_CM;
    const comprimento = plano.comprimentoParte * PT_POR_CM;
    const page = doc.addPage([largura, comprimento]);
    page.pushOperators(pushGraphicsState());
    if (plano.corte === "colunas") {
      // coluna k: a arte anda para a esquerda até a coluna ficar no começo da página
      page.pushOperators(concatTransformationMatrix(1, 0, 0, 1, -parte.inicio * PT_POR_CM, 0));
    } else {
      // faixa k (de cima para baixo): a arte gira 90° anti-horário e a faixa vira a largura da página
      page.pushOperators(concatTransformationMatrix(0, 1, -1, 0, artHpt - parte.inicio * PT_POR_CM, 0));
    }
    desenho.desenhar(page);
    page.pushOperators(popGraphicsState());
    if (o.guias) guias(page, fonte, plano, k);
  }
  return { bytes: await doc.save(), paginas: lista.length };
}

// ─── Conferência ────────────────────────────────────────────────────

export interface ItemConferenciaEmenda {
  nivel: "ok" | "atencao" | "erro";
  texto: string;
}

export function conferirEmenda(art: { w: number; h: number }, plano: PlanoEmenda | null, o: { escalaPct: number; sobreposicaoCm: number; margemRolo: number }): ItemConferenciaEmenda[] {
  if (!plano) return [{ nivel: "erro", texto: "Esse rolo não serve: a área de impressão fica menor que a sobreposição. Escolha outro rolo ou diminua a margem." }];
  const out: ItemConferenciaEmenda[] = [];
  out.push({ nivel: "ok", texto: `Arte de ${formatarCm(art.w)} × ${formatarCm(art.h)}${o.escalaPct !== 100 ? ` (escala ${o.escalaPct}%)` : ""}. Rolo de ${plano.rolo} cm com ${formatarCm(o.margemRolo)} de borda: imprime até ${formatarCm(plano.imprimivel)}.` });
  if (plano.partes === 1) out.push({ nivel: "ok", texto: "Cabe inteira no rolo: não precisa de emenda." });
  else out.push({ nivel: "ok", texto: `${plano.partes} partes de ${formatarCm(plano.larguraParte)} × ${formatarCm(plano.comprimentoParte)}, ${plano.emendas} emenda(s) com ${formatarCm(o.sobreposicaoCm)} de sobreposição.` });
  if (plano.corte === "linhas" && plano.partes > 1) out.push({ nivel: "ok", texto: "Emendas na horizontal: a arte gira 90° em cada parte (a arte fica como no mapa)." });
  if (plano.passaLimiteAcrobat) out.push({ nivel: "atencao", texto: `Alguma parte passa de ${LIMITE_ACROBAT_CM} cm: o Acrobat não abre páginas maiores (o RIP pode abrir).` });
  if (plano.partes > 1 && plano.larguraParte < 2 * o.sobreposicaoCm + 5) out.push({ nivel: "atencao", texto: "As partes ficaram muito estreitas perto da sobreposição. Confira se vale usar um rolo mais largo." });
  return out;
}
