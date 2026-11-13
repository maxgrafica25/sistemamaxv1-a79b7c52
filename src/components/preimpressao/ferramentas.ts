// Cadastro das ferramentas da Pré-impressão.
//
// Para acrescentar uma ferramenta: crie a lógica em src/lib/preimpressao/<nome>.ts
// (pura, com testes), a tela em src/components/preimpressao/<Nome>.tsx (usando as
// peças de ./ui) e adicione uma entrada aqui, no grupo que fizer mais sentido para
// quem usa. Ela aparece sozinha na tela inicial da Pré-impressão (e na busca) e ganha
// o endereço /pre-impressao?tab=<key>. Em `palavras` ponha os nomes que o pessoal
// usa no balcão (ex.: "documento", "3x4"), para a busca achar.
// Regra: tudo roda no navegador, sem servidor e sem custo (ver CLAUDE.md).

import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { BookOpen, CalendarDays, Camera, Contact, Crop, FileSearch, Files, Hash, IdCard, Images, Ruler, LayoutGrid, Scissors, type LucideIcon } from "lucide-react";

export interface Ferramenta {
  key: string;
  nome: string;
  /** Uma linha: o que a pessoa resolve com ela. */
  descricao: string;
  /** O que enviar (aparece no cartão). */
  entrada: string;
  /** Outros nomes pelos quais a pessoa procura (só para a busca). */
  palavras?: string;
  icon: LucideIcon;
  /** Cada ferramenta é baixada só quando é aberta. */
  Componente: LazyExoticComponent<ComponentType>;
}

export interface GrupoFerramentas {
  titulo: string;
  ferramentas: Ferramenta[];
}

export const GRUPOS: GrupoFerramentas[] = [
  {
    titulo: "Fotos e identificação",
    ferramentas: [
      {
        key: "impressao-fotos",
        nome: "Impressão de fotos",
        descricao: "Imprime as fotos do cliente na medida que ele quiser (10×15, 15×20, 20×30 ou outra), em pé ou deitada, encaixadas nas folhas com marcas de corte. Escreve um texto na foto se pedirem.",
        entrada: "Fotos JPG, PNG ou WebP",
        palavras: "foto revelação 10x15 15x20 15x10 20x15 20x30 papel fotográfico balcão imprimir fotos cliente texto na foto legenda aproveitamento",
        icon: Images,
        Componente: lazy(() => import("./ImpressaoFotos")),
      },
      {
        key: "foto-3x4",
        nome: "Fotos 3×4",
        descricao: "Monta fotos de documento (3×4, 5×7 ou outra medida) na folha, no tamanho exato e com linhas de corte. Várias pessoas de uma vez.",
        entrada: "Fotos JPG, PNG ou WebP",
        palavras: "foto documento 3x4 balcão rg cnh passaporte 5x7 carteira revelação",
        icon: Contact,
        Componente: lazy(() => import("./Fotos3x4")),
      },
      {
        key: "polaroid",
        nome: "Fotos Polaroid",
        descricao: "Monta fotos no estilo Polaroid na folha, com moldura colorida, legenda de mão, filtros, adesivos, verso e marcas de corte.",
        entrada: "Fotos JPG, PNG ou WebP",
        palavras: "foto instax mini lembrancinha revelação polaroide",
        icon: Camera,
        Componente: lazy(() => import("./FotosPolaroid")),
      },
      {
        key: "crachas",
        nome: "Crachás",
        descricao: "Crachás para a Fargo C50: imprime a arte pronta do cliente (Canva, Corel), ou usa o modelo da empresa e troca foto, nome, cargo e outros dados de uma ou de várias pessoas.",
        entrada: "Arte pronta, ou foto e dados",
        palavras: "cracha credencial identificação evento fargo cartão pvc dados variáveis canva corel arte pronta modelo tipo sanguíneo aso admissão",
        icon: IdCard,
        Componente: lazy(() => import("./Crachas")),
      },
    ],
  },
  {
    titulo: "Montar para imprimir",
    ferramentas: [
      {
        key: "montagem",
        nome: "Montagem de impressos",
        descricao: "Monta cartões, panfletos, etiquetas e convites diferentes na folha, com frente e verso e marcas de corte. Cria a sangria se a arte não tiver.",
        entrada: "PDF, PNG, JPG ou EPS",
        palavras: "imposição cartão de visita folha sangria frente e verso marcas de corte flyer panfleto",
        icon: LayoutGrid,
        Componente: lazy(() => import("./MontagemImpressos")),
      },
      {
        key: "numeracao",
        nome: "Numeração",
        descricao: "Numera talões, blocos, rifas e ingressos, já montados na folha para cortar e empilhar.",
        entrada: "PDF de uma arte",
        palavras: "talão bloco rifa ingresso numerar sequência",
        icon: Hash,
        Componente: lazy(() => import("./NumeracaoTaloes")),
      },
      {
        key: "livreto",
        nome: "Livreto",
        descricao: "Coloca as páginas na ordem certa para imprimir, dobrar ao meio e grampear.",
        entrada: "PDF na ordem de leitura",
        palavras: "revista apostila caderno canoa grampo dobrar",
        icon: BookOpen,
        Componente: lazy(() => import("./Livreto")),
      },
    ],
  },
  {
    titulo: "Agendas",
    ferramentas: [
      {
        key: "agenda",
        nome: "Miolo de agenda",
        descricao: "Gera o miolo da agenda do ano em A5 (ou A4 com 2 por folha): calendário, fases da lua, feriados nacionais e os da sua região, capa e contracapa.",
        entrada: "Só escolher o ano",
        palavras: "agenda calendário capa contracapa wire-o planner diário semanal",
        icon: CalendarDays,
        Componente: lazy(() => import("./MioloAgenda")),
      },
    ],
  },
  {
    titulo: "Grande formato",
    ferramentas: [
      {
        key: "margem-acabamento",
        nome: "Margem de acabamento",
        descricao: "Aumenta banners e faixas com área para acabamento, linha de corte e marcas de ilhós.",
        entrada: "PDF, PNG ou JPG",
        palavras: "banner faixa lona ilhós bainha acabamento",
        icon: Scissors,
        Componente: lazy(() => import("./MargemAcabamento")),
      },
      {
        key: "emenda",
        nome: "Emenda de adesivo",
        descricao: "Fatia uma arte grande em partes que cabem no rolo, com sobreposição para colar, e sugere o rolo que melhor aproveita.",
        entrada: "PDF, PNG, JPG ou EPS inteiro",
        palavras: "adesivo vinil rolo emendar emenda cortar partes fatiar sobreposição grande formato plotter parede painel fachada vitrine",
        icon: Ruler,
        Componente: lazy(() => import("./EmendaAdesivo")),
      },
    ],
  },
  {
    titulo: "Arquivos",
    ferramentas: [
      {
        key: "conferencia",
        nome: "Conferência de arquivo",
        descricao: "Aponta problemas antes de imprimir: tamanho, sangria, resolução, RGB e fontes.",
        entrada: "PDF, PNG ou JPG",
        palavras: "preflight verificar arquivo cliente resolução rgb cmyk fontes",
        icon: FileSearch,
        Componente: lazy(() => import("./ConferenciaArquivo")),
      },
      {
        key: "redimensionar",
        nome: "Redimensionar e cortar",
        descricao: "Muda o tamanho das páginas (A5, A4, medida livre), corta margens ou tira a folga branca, sem refazer a arte.",
        entrada: "PDF, PNG, JPG ou EPS",
        palavras: "tamanho cortar margem recortar ampliar reduzir",
        icon: Crop,
        Componente: lazy(() => import("./RedimensionarPdf")),
      },
      {
        key: "organizar",
        nome: "Organizar PDF",
        descricao: "Junta, separa, gira e reordena páginas, acha e tira páginas em branco e transforma imagens em PDF.",
        entrada: "PDFs e imagens",
        palavras: "juntar unir separar dividir girar páginas em branco imagem para pdf",
        icon: Files,
        Componente: lazy(() => import("./OrganizarPdf")),
      },
    ],
  },
];

export const FERRAMENTAS: Ferramenta[] = GRUPOS.flatMap((g) => g.ferramentas);

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Ferramentas que combinam com o que a pessoa digitou (todas as palavras, em qualquer ordem, sem acento). */
export function buscarFerramentas(texto: string): Ferramenta[] {
  const termos = semAcento(texto).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  return FERRAMENTAS.filter((f) => {
    const alvo = semAcento(`${f.nome} ${f.descricao} ${f.entrada} ${f.palavras ?? ""}`);
    return termos.every((t) => alvo.includes(t));
  });
}

// ─── Favoritas e recentes (por usuário) ─────────────────────────────

/** Favoritas de quem nunca escolheu: a Organizar PDF fica em primeiro (o Acrobat Pro saiu dos computadores). */
export const FAVORITAS_PADRAO: string[] = ["organizar"];

/** Lista de favoritas válida (só chaves que existem, sem repetir) ou null se o valor não é uma lista. */
export function normalizarFavoritos(valor: unknown): string[] | null {
  if (!Array.isArray(valor)) return null;
  const conhecidas = new Set(FERRAMENTAS.map((f) => f.key));
  return [...new Set(valor.filter((k): k is string => typeof k === "string" && conhecidas.has(k)))];
}

/** Liga ou desliga uma favorita; a nova vai para o fim da lista. */
export function alternarFavorito(lista: string[], key: string): string[] {
  return lista.includes(key) ? lista.filter((k) => k !== key) : [...lista, key];
}

/** As ferramentas favoritas, na ordem em que foram escolhidas. */
export function ferramentasFavoritas(favoritos: string[]): Ferramenta[] {
  return favoritos.map((k) => FERRAMENTAS.find((f) => f.key === k)).filter((f): f is Ferramenta => !!f);
}

/** Favoritas primeiro (na ordem das favoritas); o resto fica como estava. */
export function favoritasPrimeiro<T extends { key: string }>(itens: T[], favoritos: string[]): T[] {
  const pos = (k: string) => {
    const i = favoritos.indexOf(k);
    return i < 0 ? Infinity : i;
  };
  return [...itens].sort((a, b) => pos(a.key) - pos(b.key));
}

const CHAVE_RECENTES = "preimpressao.recentes.v1";
const chaveRecentes = (usuario?: string | null) => (usuario ? `${CHAVE_RECENTES}.${usuario}` : CHAVE_RECENTES);

/** Últimas ferramentas abertas por este usuário neste computador (a mais recente primeiro). */
export function lerRecentes(max = 3, usuario?: string | null): Ferramenta[] {
  try {
    const keys = JSON.parse(window.localStorage.getItem(chaveRecentes(usuario)) ?? "[]") as string[];
    return keys.map((k) => FERRAMENTAS.find((f) => f.key === k)).filter((f): f is Ferramenta => !!f).slice(0, max);
  } catch {
    return [];
  }
}

export function marcarRecente(key: string, usuario?: string | null) {
  try {
    const c = chaveRecentes(usuario);
    const keys = (JSON.parse(window.localStorage.getItem(c) ?? "[]") as string[]).filter((k) => k !== key);
    window.localStorage.setItem(c, JSON.stringify([key, ...keys].slice(0, 6)));
  } catch {
    /* navegador sem localStorage */
  }
}
