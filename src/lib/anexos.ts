// Links de arquivos guardados em pastas privadas do Supabase Storage.
// O link assinado tem validade; por isso o link é sempre gerado na hora de abrir.
import { supabase } from "@/integrations/supabase/client";

const VALIDADE_S = 60 * 60; // 1 hora

/** Link temporário para um arquivo (pasta + caminho). */
export async function linkDoArquivo(bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, VALIDADE_S);
  if (error || !data?.signedUrl) throw error ?? new Error("Não foi possível abrir o arquivo");
  return data.signedUrl;
}

/**
 * Descobre pasta e caminho a partir de um link assinado antigo
 * (…/storage/v1/object/sign/<bucket>/<caminho>?token=…). Devolve null se não for um link desses.
 */
export function partesDoLinkAssinado(url: string): { bucket: string; path: string } | null {
  try {
    const u = new URL(url, "https://x.invalid");
    const m = /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/.exec(u.pathname);
    if (!m) return null;
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

/**
 * Renova um link guardado no banco (os anexos do chat interno guardavam o link com
 * validade de 1 ano; depois disso o arquivo "sumia"). Se não der para renovar, devolve o original.
 */
export async function renovarLink(url: string): Promise<string> {
  const p = partesDoLinkAssinado(url);
  if (!p) return url;
  try {
    return await linkDoArquivo(p.bucket, p.path);
  } catch {
    return url;
  }
}

export const ehPdf = (nome: string | null | undefined) => /\.pdf$/i.test((nome ?? "").trim());
export const ehImagem = (nome: string | null | undefined) => /\.(jpe?g|png|gif|webp|bmp)$/i.test((nome ?? "").trim());

/** Nome de arquivo seguro para usar no caminho do Storage. */
export function nomeSeguro(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (limpo || "arquivo").slice(-120);
}
