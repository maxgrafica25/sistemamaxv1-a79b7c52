// Cadastro das ferramentas da Pré-impressão.
//
// Para acrescentar uma ferramenta: crie a lógica em src/lib/preimpressao/<nome>.ts
// (pura, com testes), a tela em src/components/preimpressao/<Nome>.tsx (usando as
// peças de ./ui) e adicione uma entrada aqui. Ela aparece sozinha na tela inicial
// da Pré-impressão e ganha o endereço /pre-impressao?tab=<key>.
// Regra: tudo roda no navegador, sem servidor e sem custo (ver CLAUDE.md).

import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { BookOpen, FileSearch, Files, Hash, LayoutGrid, Scissors, type LucideIcon } from "lucide-react";

export interface Ferramenta {
  key: string;
  nome: string;
  /** Uma linha: o que a pessoa resolve com ela. */
  descricao: string;
  /** O que enviar (aparece no cartão). */
  entrada: string;
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
    titulo: "Impressos",
    ferramentas: [
      {
        key: "montagem",
        nome: "Montagem de impressos",
        descricao: "Monta cartões, panfletos e etiquetas na folha, com o melhor aproveitamento e marcas de corte.",
        entrada: "PDF de uma arte",
        icon: LayoutGrid,
        Componente: lazy(() => import("./MontagemImpressos")),
      },
      {
        key: "numeracao",
        nome: "Numeração",
        descricao: "Numera talões, blocos, rifas e ingressos, já montados na folha para cortar e empilhar.",
        entrada: "PDF de uma arte",
        icon: Hash,
        Componente: lazy(() => import("./NumeracaoTaloes")),
      },
      {
        key: "livreto",
        nome: "Livreto",
        descricao: "Coloca as páginas na ordem certa para imprimir, dobrar ao meio e grampear.",
        entrada: "PDF na ordem de leitura",
        icon: BookOpen,
        Componente: lazy(() => import("./Livreto")),
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
        icon: Scissors,
        Componente: lazy(() => import("./MargemAcabamento")),
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
        icon: FileSearch,
        Componente: lazy(() => import("./ConferenciaArquivo")),
      },
      {
        key: "organizar",
        nome: "Organizar PDF",
        descricao: "Junta, separa, gira e reordena páginas, e transforma imagens em PDF.",
        entrada: "PDFs e imagens",
        icon: Files,
        Componente: lazy(() => import("./OrganizarPdf")),
      },
    ],
  },
];

export const FERRAMENTAS: Ferramenta[] = GRUPOS.flatMap((g) => g.ferramentas);
