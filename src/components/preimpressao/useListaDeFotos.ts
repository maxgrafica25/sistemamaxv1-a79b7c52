// Estado da lista de fotos (Polaroid e Fotos 3×4): receber arquivos, mudar, remover.

import { useCallback, useEffect, useRef, useState } from "react";
import { AJUSTE_PADRAO, type AjusteFoto } from "@/lib/preimpressao/cracha";
import { ehImagem, lerFoto } from "@/lib/preimpressao/crachaNavegador";
import type { FiltroFoto } from "@/lib/preimpressao/polaroid";

export type FotoLida = Awaited<ReturnType<typeof lerFoto>>;

export interface ItemFoto {
  id: string;
  foto: FotoLida;
  /** Endereço temporário para mostrar a miniatura. */
  url: string;
  qtd: number;
  legenda: string;
  ajuste: AjusteFoto;
  /** Filtro só desta foto; "padrao" = o filtro geral. */
  filtro: FiltroFoto | "padrao";
  /** Medida só desta foto (Impressão de fotos); "padrao" = a medida geral. */
  medida: string;
  /** Em pé ou deitada só nesta foto; "padrao" = a orientação geral. */
  orient: "padrao" | "auto" | "retrato" | "paisagem";
}

let seq = 0;
const novoId = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Libera as miniaturas ao sair da tela. */
export function useListaDeFotos() {
  const [itens, setItens] = useState<ItemFoto[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    const guardadas = urls.current;
    return () => guardadas.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const receber = useCallback(async (files: File[]) => {
    const boas = files.filter((f) => ehImagem(f.name) || f.type.startsWith("image/"));
    if (!boas.length) return setErro("Envie fotos em JPG, PNG ou WebP.");
    setErro(null);
    const novos: ItemFoto[] = [];
    let falhas = 0;
    for (const f of boas) {
      try {
        const foto = await lerFoto(f);
        const url = URL.createObjectURL(new Blob([foto.bytes], { type: foto.tipo || "image/jpeg" }));
        urls.current.push(url);
        novos.push({ id: novoId(), foto, url, qtd: 1, legenda: "", ajuste: AJUSTE_PADRAO, filtro: "padrao", medida: "padrao", orient: "padrao" });
      } catch {
        falhas++;
      }
    }
    setItens((p) => [...p, ...novos]);
    if (falhas) setErro(`${falhas} arquivo(s) não abriram como foto.`);
  }, []);

  const mudar = useCallback((id: string, p: Partial<ItemFoto>) => setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i))), []);
  const remover = useCallback((id: string) => setItens((prev) => prev.filter((i) => i.id !== id)), []);
  return { itens, setItens, erro, receber, mudar, remover };
}

