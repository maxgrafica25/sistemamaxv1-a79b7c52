import type { Acabamento as CVAcabamento } from "@/lib/cv-calc/engine";

interface Midia {
  nome: string;
  tipo_midia: string;
}
interface Impressao {
  nome: string;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function shortImpressao(nome: string): string {
  const n = nome.toLowerCase();
  if (n.includes("alta resolu")) return "Alta resolução";
  if (n.includes("baixa resolu")) return "Baixa resolução";
  if (n.includes("média resolu") || n.includes("media resolu")) return "Média resolução";
  return nome;
}

function shortAcabamento(nome: string): string {
  // "Banner (Bastão topo e base até 105cm + ...)" → "Bastão 105cm"
  const m = nome.match(/bast[ãa]o.*?at[ée]\s*(\d+)\s*cm/i);
  if (m) return `Bastão ${m[1]}cm`;
  // Remove parênteses explicativos
  return nome.replace(/\s*\(.*?\)\s*/g, "").trim();
}

export interface BuildCvDescricaoInput {
  midia: Midia | null;
  isLona: boolean;
  isBanner: boolean;
  impressao: Impressao | null;
  largura_cm: number;
  altura_cm: number;
  quantidade: number;
  acabamentos: CVAcabamento[];
}

export function buildCvDescricao(input: BuildCvDescricaoInput): string {
  const { midia, isLona, isBanner, impressao, largura_cm, altura_cm, quantidade, acabamentos } = input;
  if (!midia || largura_cm <= 0 || altura_cm <= 0) return "";

  const tipo = isLona && isBanner ? "Banner" : cap(midia.tipo_midia || "");
  let nomeMidia = midia.nome || "";
  // Evita duplicar tipo no nome (ex: "Lona Brilho" + tipo "Lona")
  if (tipo && nomeMidia.toLowerCase().startsWith(tipo.toLowerCase() + " ")) {
    nomeMidia = nomeMidia.slice(tipo.length).trim();
  }
  // Para banner, se o nome contém "Banner", remove pra não ficar "Banner Banner ..."
  if (tipo === "Banner") {
    nomeMidia = nomeMidia.replace(/banner/gi, "").replace(/\s+/g, " ").trim();
  }

  const head = [tipo, nomeMidia].filter(Boolean).join(" ").trim();
  const dim = `${Math.round(largura_cm)}x${Math.round(altura_cm)}cm`;
  const qtd = `${quantidade}un`;

  const parts: string[] = [`${head} ${dim} — ${qtd}`];

  if (impressao) parts.push(shortImpressao(impressao.nome));

  if (acabamentos.length > 0) {
    parts.push(acabamentos.map((a) => shortAcabamento(a.nome)).join(", "));
  }

  return parts.join(" · ");
}
