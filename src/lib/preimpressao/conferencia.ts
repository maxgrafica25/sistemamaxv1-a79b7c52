// Pré-impressão → "Conferência de arquivo" (preflight simples).
//
// Lê um PDF, PNG ou JPG e aponta, em português simples, o que pode dar problema na
// impressão: tamanho, sangria, resolução das imagens, cores em RGB, fontes não
// incorporadas. Não altera o arquivo. Lógica pura (pdf-lib), testável; a resolução
// efetiva das imagens do PDF vem do pdf.js (./navegador) e entra por parâmetro.

import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFStream, decodePDFRawStream, type PDFObject } from "pdf-lib";
import { PT_POR_CM, normalizarRotacao, type InfoImagem } from "./margem";
import { PT_POR_MM } from "./folha";

export type Nivel = "ok" | "info" | "atencao" | "problema";

export interface Achado {
  nivel: Nivel;
  titulo: string;
  detalhe?: string;
}

export type CorImagem = "rgb" | "cmyk" | "cinza" | "especial" | "outra";

export interface AnalisePdf {
  paginas: number;
  /** Tamanho visível de cada página (pt). */
  tamanhos: { w: number; h: number }[];
  tamanhosIguais: boolean;
  /** Sangria da 1ª página pela TrimBox (mm); null = não informada. */
  sangriaMm: number | null;
  fontes: { nome: string; embutida: boolean }[];
  imagens: { largura: number; altura: number; cor: CorImagem }[];
  /** Cores de vetores/textos escritas direto nas páginas. */
  vetorRgbColorido: boolean;
  vetorRgbNeutro: boolean;
  vetorCmyk: boolean;
  coresEspeciais: string[];
}

const nome = (o: PDFObject | undefined): string | null => (o instanceof PDFName ? o.decodeText() : null);

function classificarCor(ctx: PDFDocument["context"], cs: PDFObject | undefined, nivel = 0): CorImagem {
  const o = cs instanceof PDFRef ? ctx.lookup(cs) : cs;
  const n = nome(o);
  if (n) {
    if (n === "DeviceRGB" || n === "CalRGB" || n === "RGB") return "rgb";
    if (n === "DeviceCMYK" || n === "CMYK") return "cmyk";
    if (n === "DeviceGray" || n === "CalGray" || n === "G") return "cinza";
    return "outra";
  }
  if (o instanceof PDFArray && o.size() > 0 && nivel < 4) {
    const tipo = nome(o.get(0));
    if (tipo === "ICCBased") {
      const st = ctx.lookup(o.get(1));
      const N = st instanceof PDFStream ? st.dict.get(PDFName.of("N")) : undefined;
      const v = N instanceof PDFNumber ? N.asNumber() : 0;
      return v === 3 ? "rgb" : v === 4 ? "cmyk" : v === 1 ? "cinza" : "outra";
    }
    if (tipo === "Indexed" || tipo === "I") return classificarCor(ctx, o.get(1), nivel + 1);
    if (tipo === "Separation" || tipo === "DeviceN") return "especial";
    if (tipo === "CalRGB" || tipo === "Lab") return "rgb";
    if (tipo === "CalGray") return "cinza";
  }
  return "outra";
}

const PROCESSO = new Set(["All", "None", "Cyan", "Magenta", "Yellow", "Black"]);

function nomesEspeciais(ctx: PDFDocument["context"], o: PDFObject | undefined, saida: Set<string>) {
  const a = o instanceof PDFRef ? ctx.lookup(o) : o;
  if (!(a instanceof PDFArray) || a.size() < 2) return;
  const tipo = nome(a.get(0));
  if (tipo === "Separation") {
    const n = nome(a.get(1));
    if (n && !PROCESSO.has(n)) saida.add(n);
  } else if (tipo === "DeviceN") {
    const lista = ctx.lookup(a.get(1));
    if (lista instanceof PDFArray) for (const x of lista.asArray()) {
      const n = nome(x);
      if (n && !PROCESSO.has(n)) saida.add(n);
    }
  }
}

/** Procura operadores de cor (rg/RG = RGB, k/K = CMYK) num content stream já decodificado. */
export function coresDoConteudo(texto: string): { rgbColorido: boolean; rgbNeutro: boolean; cmyk: boolean } {
  // tira textos entre parênteses e <hex> para não confundir letras com operadores
  const limpo = texto.replace(/\((?:\\.|[^\\()])*\)/g, "()").replace(/<[0-9A-Fa-f\s]*>/g, "<>");
  let rgbColorido = false;
  let rgbNeutro = false;
  const num = "(-?\\d*\\.?\\d+)";
  const reRgb = new RegExp(`(?:^|[\\s\\[])${num}\\s+${num}\\s+${num}\\s+(?:rg|RG)(?=\\s|$)`, "g");
  for (const m of limpo.matchAll(reRgb)) {
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (Math.abs(r - g) < 0.004 && Math.abs(g - b) < 0.004) rgbNeutro = true;
    else rgbColorido = true;
  }
  const cmyk = new RegExp(`(?:^|[\\s\\[])${num}\\s+${num}\\s+${num}\\s+${num}\\s+(?:k|K)(?=\\s|$)`).test(limpo);
  return { rgbColorido, rgbNeutro, cmyk };
}

function decodificar(st: PDFObject | undefined): string {
  if (!(st instanceof PDFRawStream)) return "";
  try {
    return new TextDecoder("latin1").decode(decodePDFRawStream(st).decode());
  } catch {
    return "";
  }
}

export async function analisarPdf(bytes: Uint8Array): Promise<AnalisePdf> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(/encrypt/i.test(msg) ? "PDF protegido por senha: não dá para conferir nem imprimir sem a senha." : "Não consegui abrir este PDF (arquivo corrompido?).");
  }
  const ctx = doc.context;
  const pages = doc.getPages();
  if (!pages.length) throw new Error("O PDF não tem páginas.");

  const tamanhos = pages.map((p) => {
    const c = p.getCropBox();
    return normalizarRotacao(p.getRotation().angle) % 180 ? { w: c.height, h: c.width } : { w: c.width, h: c.height };
  });
  const tamanhosIguais = tamanhos.every((t) => Math.abs(t.w - tamanhos[0].w) < 1 && Math.abs(t.h - tamanhos[0].h) < 1);

  let sangriaMm: number | null = null;
  const p0 = pages[0];
  if (p0.node.TrimBox()) {
    const c = p0.getCropBox();
    const t = p0.getTrimBox();
    const lados = [t.x - c.x, t.y - c.y, c.x + c.width - (t.x + t.width), c.y + c.height - (t.y + t.height)].map((v) => v / PT_POR_MM);
    const menor = Math.min(...lados);
    if (menor > 0.05) sangriaMm = Math.round(menor * 10) / 10;
  }

  const fontes = new Map<string, boolean>();
  const imagens: AnalisePdf["imagens"] = [];
  const especiais = new Set<string>();
  const mascaras = new Set<string>();
  let rgbColorido = false;
  let rgbNeutro = false;
  let cmyk = false;
  const somarCores = (texto: string) => {
    if (!texto) return;
    const c = coresDoConteudo(texto);
    rgbColorido ||= c.rgbColorido;
    rgbNeutro ||= c.rgbNeutro;
    cmyk ||= c.cmyk;
  };

  const objetos = ctx.enumerateIndirectObjects();
  for (const [, o] of objetos) {
    const d = o instanceof PDFDict ? o : o instanceof PDFStream ? o.dict : null;
    const sm = d?.get(PDFName.of("SMask"));
    if (sm instanceof PDFRef) mascaras.add(sm.toString());
  }

  for (const [ref, o] of objetos) {
    if (o instanceof PDFArray) {
      nomesEspeciais(ctx, o, especiais);
      continue;
    }
    const d = o instanceof PDFDict ? o : o instanceof PDFStream ? o.dict : null;
    if (!d) continue;
    const tipo = nome(d.get(PDFName.of("Type")));
    const sub = nome(d.get(PDFName.of("Subtype")));

    // espaços de cor nomeados nos recursos
    const csBruto = d.get(PDFName.of("ColorSpace"));
    const csDict = csBruto instanceof PDFRef ? ctx.lookup(csBruto) : csBruto;
    if (csDict instanceof PDFDict) for (const [, v] of csDict.entries()) nomesEspeciais(ctx, v, especiais);

    if (tipo === "Font") {
      if (sub === "CIDFontType0" || sub === "CIDFontType2") continue; // contada pela fonte Type0 que a usa
      let alvo: PDFDict = d;
      if (sub === "Type0") {
        const desc = d.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
        const primeiro = desc && desc.size() ? ctx.lookup(desc.get(0)) : undefined;
        if (primeiro instanceof PDFDict) alvo = primeiro;
      }
      const base = (nome(d.get(PDFName.of("BaseFont"))) ?? "(sem nome)").replace(/^[A-Z]{6}\+/, "");
      const fd = alvo.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
      const embutida = sub === "Type3" || (!!fd && ["FontFile", "FontFile2", "FontFile3"].some((k) => fd.has(PDFName.of(k))));
      fontes.set(base, (fontes.get(base) ?? true) && embutida);
    } else if (sub === "Image" && o instanceof PDFStream) {
      if (mascaras.has(ref.toString())) continue;
      const mask = d.get(PDFName.of("ImageMask"));
      if (mask && mask.toString() === "true") continue;
      const W = d.get(PDFName.of("Width"));
      const H = d.get(PDFName.of("Height"));
      const cs = d.get(PDFName.of("ColorSpace"));
      nomesEspeciais(ctx, cs, especiais);
      imagens.push({
        largura: W instanceof PDFNumber ? W.asNumber() : 0,
        altura: H instanceof PDFNumber ? H.asNumber() : 0,
        cor: classificarCor(ctx, cs),
      });
    } else if (sub === "Form" && o instanceof PDFStream) {
      somarCores(decodificar(o));
    }
  }
  for (const p of pages) {
    const c = p.node.Contents();
    const refs = c instanceof PDFArray ? c.asArray() : c ? [c] : [];
    for (const r of refs) somarCores(decodificar(r instanceof PDFRef ? ctx.lookup(r) : r));
  }

  return {
    paginas: pages.length,
    tamanhos,
    tamanhosIguais,
    sangriaMm,
    fontes: [...fontes].map(([n, e]) => ({ nome: n, embutida: e })).sort((a, b) => a.nome.localeCompare(b.nome)),
    imagens,
    vetorRgbColorido: rgbColorido,
    vetorRgbNeutro: rgbNeutro,
    vetorCmyk: cmyk,
    coresEspeciais: [...especiais].sort(),
  };
}

// ─── Resolução ───────────────────────────────────────────────────────

/** Mínimos de resolução conforme o tamanho: impressos de perto × grande formato (visto de longe). */
export function limitesResolucao(maiorLadoCm: number): { boa: number; minima: number; grandeFormato: boolean } {
  return maiorLadoCm > 60 ? { boa: 60, minima: 30, grandeFormato: true } : { boa: 250, minima: 150, grandeFormato: false };
}

/**
 * Resolução efetiva (ppi) de cada imagem desenhada numa página, a partir da lista
 * de operadores do pdf.js: acompanha a matriz de transformação (save/restore/
 * transform/form) e mede o tamanho em que a imagem foi colocada.
 * `OPS` = códigos do pdf.js (para não importar o pdf.js aqui).
 */
export function resolucoesDaPagina(
  fnArray: ArrayLike<number>,
  argsArray: ArrayLike<unknown>,
  OPS: { save: number; restore: number; transform: number; paintFormXObjectBegin: number; paintFormXObjectEnd: number; imagens: number[] },
): number[] {
  type M = [number, number, number, number, number, number];
  const mult = (m: M, n: M): M => [
    n[0] * m[0] + n[1] * m[2],
    n[0] * m[1] + n[1] * m[3],
    n[2] * m[0] + n[3] * m[2],
    n[2] * m[1] + n[3] * m[3],
    n[4] * m[0] + n[5] * m[2] + m[4],
    n[4] * m[1] + n[5] * m[3] + m[5],
  ];
  let ctm: M = [1, 0, 0, 1, 0, 0];
  const pilha: M[] = [];
  const ppis: number[] = [];
  const ehM = (a: unknown): a is M => (Array.isArray(a) || ArrayBuffer.isView(a)) && (a as ArrayLike<number>).length >= 6;
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] as unknown[] | null;
    if (fn === OPS.save) pilha.push(ctm);
    else if (fn === OPS.restore) ctm = pilha.pop() ?? ctm;
    else if (fn === OPS.transform && args) {
      const m = (ehM(args) ? args : args[0]) as unknown;
      if (ehM(m)) ctm = mult(ctm, Array.from(m as ArrayLike<number>).slice(0, 6) as M);
    } else if (fn === OPS.paintFormXObjectBegin) {
      pilha.push(ctm);
      const m = args?.[0];
      if (ehM(m)) ctm = mult(ctm, Array.from(m as ArrayLike<number>).slice(0, 6) as M);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = pilha.pop() ?? ctm;
    else if (OPS.imagens.includes(fn) && args) {
      // [id, largura, altura] ou [{ width, height }]
      const a0 = args[0] as { width?: number; height?: number } | string;
      const w = typeof args[1] === "number" ? (args[1] as number) : typeof a0 === "object" ? a0?.width : undefined;
      const h = typeof args[2] === "number" ? (args[2] as number) : typeof a0 === "object" ? a0?.height : undefined;
      const larguraPt = Math.hypot(ctm[0], ctm[1]);
      const alturaPt = Math.hypot(ctm[2], ctm[3]);
      if (w && h && larguraPt > 0.5 && alturaPt > 0.5) ppis.push(Math.min((w / larguraPt) * 72, (h / alturaPt) * 72));
    }
  }
  return ppis;
}

// ─── Relatório ───────────────────────────────────────────────────────

const cm1 = (pt: number) => (pt / PT_POR_CM).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const lista = (itens: string[], max = 4) => (itens.length > max ? `${itens.slice(0, max).join(", ")} e mais ${itens.length - max}` : itens.join(", "));

function achadoResolucao(ppi: number, maiorLadoCm: number, quantas: number): Achado {
  const lim = limitesResolucao(maiorLadoCm);
  const r = Math.round(ppi);
  const de = quantas > 1 ? `A menor das ${quantas} imagens está com ${r} ppi` : `A imagem está com ${r} ppi`;
  const ref = lim.grandeFormato ? `Para grande formato o ideal é ${lim.boa} ppi ou mais.` : `Para impressos o ideal é ${lim.boa} ppi ou mais.`;
  if (ppi >= lim.boa) return { nivel: "ok", titulo: "Resolução boa", detalhe: `${de} no tamanho final.` };
  if (ppi >= lim.minima) return { nivel: "atencao", titulo: "Resolução no limite", detalhe: `${de}. ${ref} Pode perder um pouco de nitidez.` };
  return { nivel: "problema", titulo: "Resolução baixa", detalhe: `${de}. ${ref} Vai sair borrado ou quadriculado.` };
}

/** `ppiMenor` = menor resolução efetiva medida pelo pdf.js (null = não deu para medir). */
export function relatorioPdf(a: AnalisePdf, ppiMenor: number | null): Achado[] {
  const out: Achado[] = [];
  const t = a.tamanhos[0];
  const maiorCm = Math.max(t.w, t.h) / PT_POR_CM;

  out.push({
    nivel: a.tamanhosIguais ? "info" : "atencao",
    titulo: `Tamanho: ${cm1(t.w)} × ${cm1(t.h)} cm`,
    detalhe: `${a.paginas} ${a.paginas === 1 ? "página" : "páginas"}${a.tamanhosIguais ? "" : " com tamanhos diferentes entre si"}${a.sangriaMm ? " (medida com a sangria)" : ""}.`,
  });

  if (a.sangriaMm !== null) {
    const f = { w: t.w - 2 * a.sangriaMm * PT_POR_MM, h: t.h - 2 * a.sangriaMm * PT_POR_MM };
    out.push(
      a.sangriaMm >= 2.9
        ? { nivel: "ok", titulo: `Sangria de ${String(a.sangriaMm).replace(".", ",")} mm`, detalhe: `Tamanho final depois do corte: ${cm1(f.w)} × ${cm1(f.h)} cm.` }
        : { nivel: "atencao", titulo: `Sangria de só ${String(a.sangriaMm).replace(".", ",")} mm`, detalhe: "O padrão da gráfica é 3 mm por lado." },
    );
  } else {
    out.push({
      nivel: "info",
      titulo: "Sangria não informada no arquivo",
      detalhe: "Se a arte vai até a borda, confira se o tamanho acima já inclui 3 mm a mais por lado.",
    });
  }

  if (a.imagens.length === 0) out.push({ nivel: "ok", titulo: "Sem imagens", detalhe: "Arquivo só com vetores e textos: nitidez total em qualquer tamanho." });
  else if (ppiMenor !== null) out.push(achadoResolucao(ppiMenor, maiorCm, a.imagens.length));
  else out.push({ nivel: "info", titulo: `${a.imagens.length} ${a.imagens.length === 1 ? "imagem" : "imagens"}`, detalhe: "Não consegui medir a resolução no tamanho final." });

  const imgRgb = a.imagens.filter((i) => i.cor === "rgb").length;
  if (imgRgb || a.vetorRgbColorido) {
    const onde = [imgRgb ? `${imgRgb} ${imgRgb === 1 ? "imagem" : "imagens"}` : "", a.vetorRgbColorido ? "textos ou desenhos" : ""].filter(Boolean).join(" e ");
    out.push({ nivel: "atencao", titulo: "Cores em RGB", detalhe: `Em ${onde}. As cores podem mudar na impressão (o ideal é CMYK).` });
  } else if (a.vetorRgbNeutro) {
    out.push({ nivel: "atencao", titulo: "Preto ou cinza em RGB", detalhe: "Textos pretos em RGB saem com as 4 cores misturadas; o ideal é preto 100% (K)." });
  } else {
    out.push({ nivel: "ok", titulo: "Cores em CMYK ou escala de cinza" });
  }
  if (a.coresEspeciais.length) out.push({ nivel: "atencao", titulo: "Cores especiais (Pantone)", detalhe: `${lista(a.coresEspeciais)}. Serão convertidas para CMYK na impressão digital.` });

  const fora = a.fontes.filter((f) => !f.embutida).map((f) => f.nome);
  if (fora.length) out.push({ nivel: "problema", titulo: "Fontes não incorporadas", detalhe: `${lista(fora)}. O texto pode trocar de letra. Peça o arquivo com as fontes incorporadas ou convertidas em curvas.` });
  else if (a.fontes.length) out.push({ nivel: "ok", titulo: `Fontes incorporadas (${a.fontes.length})` });
  else out.push({ nivel: "ok", titulo: "Sem fontes", detalhe: "Textos em curvas ou arquivo sem texto." });

  return out;
}

export function relatorioImagem(info: InfoImagem): Achado[] {
  const out: Achado[] = [];
  if (info.dpi) {
    const w = (info.larguraPx / info.dpi) * 2.54;
    const h = (info.alturaPx / info.dpi) * 2.54;
    const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    out.push({ nivel: "info", titulo: `Tamanho: ${f(w)} × ${f(h)} cm`, detalhe: `${info.larguraPx} × ${info.alturaPx} px a ${Math.round(info.dpi)} dpi.` });
    out.push(achadoResolucao(info.dpi, Math.max(w, h), 1));
  } else {
    const f = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    out.push({
      nivel: "atencao",
      titulo: "O arquivo não informa o tamanho",
      detalhe: `${info.larguraPx} × ${info.alturaPx} px, sem DPI. Com boa qualidade (250 ppi) imprime até ${f((info.larguraPx / 250) * 2.54)} × ${f((info.alturaPx / 250) * 2.54)} cm; em banner (60 ppi), até ${f((info.larguraPx / 60) * 2.54)} × ${f((info.alturaPx / 60) * 2.54)} cm.`,
    });
  }
  out.push(
    info.tipo === "jpg" && info.cmyk
      ? { nivel: "ok", titulo: "Cores em CMYK" }
      : { nivel: "atencao", titulo: "Cores em RGB", detalhe: info.tipo === "png" ? "PNG é sempre RGB: as cores podem mudar um pouco na impressão." : "As cores podem mudar um pouco na impressão (o ideal é CMYK)." },
  );
  out.push({ nivel: "info", titulo: "Sangria", detalhe: "Imagem não informa sangria: confira se o tamanho já inclui 3 mm a mais por lado, se a arte vai até a borda." });
  return out;
}

const PESO: Record<Nivel, number> = { ok: 0, info: 0, atencao: 1, problema: 2 };
export function veredito(achados: Achado[]): { nivel: "ok" | "atencao" | "problema"; texto: string } {
  const pior = Math.max(0, ...achados.map((a) => PESO[a.nivel]));
  const n = achados.filter((a) => PESO[a.nivel] > 0).length;
  if (pior === 0) return { nivel: "ok", texto: "Tudo certo para imprimir" };
  if (pior === 1) return { nivel: "atencao", texto: n === 1 ? "1 ponto para conferir" : `${n} pontos para conferir` };
  return { nivel: "problema", texto: n === 1 ? "1 problema" : `${n} pontos, com problema` };
}
