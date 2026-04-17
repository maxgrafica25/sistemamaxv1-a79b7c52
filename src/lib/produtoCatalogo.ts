// Helpers para o catálogo de produtos canônicos.
// A normalização é a MESMA lógica do `productKey` em Monitoramento.tsx,
// extraída aqui para reuso entre matcher (NovoSiteDialog) e tela de catálogo.

import { supabase } from "@/integrations/supabase/client";

const STOPWORDS = new Set([
  "panfleto", "panfletos", "flyer", "flyers", "folder", "folders",
  "cartao", "cartoes", "visita", "impressao", "impressoes",
  "couche", "couché", "papel", "frente", "verso", "fv", "4x4", "4x0", "1x0", "1x1",
  "colorido", "preto", "branco", "pb", "fosco", "brilho", "brilhante",
  "com", "sem", "de", "do", "da", "em", "para", "the", "a", "o",
  "un", "und", "unidade", "unidades", "mil", "milheiro",
]);

export const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const productKey = (rawName: string): string => {
  const name = stripAccents((rawName || "").toLowerCase());

  const gMatch = name.match(/(\d{2,3})\s*g(?:sm|\/m2|\/m²)?/);
  let gramKey = "";
  if (gMatch) {
    const g = parseInt(gMatch[1], 10);
    const bucket2 = Math.round((g + 5) / 15) * 15;
    gramKey = `g${bucket2}`;
  }

  const dimMatch = name.match(/(\d{1,3})\s*x\s*(\d{1,3})\s*(?:cm|mm)?/);
  let dimKey = "";
  if (dimMatch) {
    const a = parseInt(dimMatch[1], 10);
    const b = parseInt(dimMatch[2], 10);
    const ba = Math.floor(a / 2) * 2;
    const bb = Math.floor(b / 2) * 2;
    dimKey = `d${Math.min(ba, bb)}x${Math.max(ba, bb)}`;
  }

  const tokens = name
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t) && !/^\d+(g|cm|mm)?$/.test(t) && !/^\d+x\d+$/.test(t))
    .sort();

  return [...tokens, dimKey, gramKey].filter(Boolean).join("|");
};

export type ProdutoCatalogo = {
  id: string;
  nome_canonico: string;
  categoria: string | null;
  dimensoes: string | null;
  gramatura: string | null;
  observacoes: string | null;
  created_at: string;
};

/**
 * Procura um produto no catálogo cujo `productKey` bata com o do nome informado.
 * Se encontrar, retorna o id. Caso contrário, cria um novo produto canônico
 * usando o nome bruto e retorna o novo id.
 */
export async function findOrCreateCatalogo(
  nomeProduto: string,
  categoria?: string | null,
): Promise<string | null> {
  const trimmed = (nomeProduto || "").trim();
  if (!trimmed) return null;
  const targetKey = productKey(trimmed);
  if (!targetKey) return null;

  const { data: all } = await supabase
    .from("produtos_catalogo")
    .select("id, nome_canonico");

  const match = (all || []).find((p) => productKey(p.nome_canonico) === targetKey);
  if (match) return match.id;

  const { data: created, error } = await supabase
    .from("produtos_catalogo")
    .insert({
      nome_canonico: trimmed,
      categoria: categoria?.trim().toLowerCase() || null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("findOrCreateCatalogo:", error);
    return null;
  }
  return created.id;
}
