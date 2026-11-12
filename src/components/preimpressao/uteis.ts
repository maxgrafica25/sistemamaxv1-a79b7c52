// Funções de apoio das telas de Pré-impressão (sem componentes).

import { useCallback, useEffect, useState } from "react";
import { montarArte, type ArteAberta, type DetalheArquivo } from "@/lib/preimpressao/folha";
import { converterEps } from "@/lib/preimpressao/navegador";

/** Guarda a configuração de uma ferramenta no navegador (localStorage), mesclando com o padrão. */
export function useConfigSalva<T extends object>(chave: string, padrao: T): [T, <K extends keyof T>(k: K, v: T[K]) => void] {
  const [config, setConfig] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(chave);
      return raw ? { ...padrao, ...(JSON.parse(raw) as Partial<T>) } : padrao;
    } catch {
      return padrao;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(chave, JSON.stringify(config));
    } catch {
      /* navegador sem localStorage */
    }
  }, [chave, config]);
  const set = useCallback(<K extends keyof T>(k: K, v: T[K]) => setConfig((c) => ({ ...c, [k]: v })), []);
  return [config, set];
}

/** Lê "12,5" ou "12.5"; devolve null fora da faixa. */
export function numeroEntre(s: string, min: number, max: number, inteiro = false): number | null {
  const v = Number.parseFloat(String(s).replace(",", ".").trim());
  if (!Number.isFinite(v) || v < min || v > max) return null;
  if (inteiro && !Number.isInteger(v)) return null;
  return v;
}

/** Arquivo enviado (guardado inteiro na memória; nada sai do computador). */
export interface Entrada {
  id: string;
  nome: string;
  bytes: Uint8Array;
  /** Largura real da arte em cm (só imagens): corrige ou informa o tamanho. */
  larguraTxt: string;
}

const MAX_ARQUIVOS = 20;
let seq = 0;
const novoId = () => `e${Date.now().toString(36)}${(seq++).toString(36)}`;

export function useEntradasArte() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [detalhes, setDetalhes] = useState<DetalheArquivo[]>([]);
  const [arte, setArte] = useState<ArteAberta | null>(null);
  const [lendo, setLendo] = useState(false);

  const adicionar = useCallback(async (files: File[]) => {
    const novas: Entrada[] = [];
    for (const f of files) novas.push({ id: novoId(), nome: f.name, bytes: new Uint8Array(await f.arrayBuffer()), larguraTxt: "" });
    setEntradas((prev) => [...prev, ...novas].slice(0, MAX_ARQUIVOS));
  }, []);

  const mudarLargura = (id: string, v: string) => setEntradas((p) => p.map((e) => (e.id === id ? { ...e, larguraTxt: v } : e)));
  const remover = (id: string) => setEntradas((p) => p.filter((e) => e.id !== id));
  const mover = (i: number, d: number) =>
    setEntradas((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const n = [...p];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  // Junta os arquivos em uma arte sempre que a lista (ou uma largura digitada) muda
  useEffect(() => {
    if (!entradas.length) {
      setArte(null);
      setDetalhes([]);
      return;
    }
    let vivo = true;
    setLendo(true);
    const t = setTimeout(async () => {
      const r = await montarArte(
        entradas.map((e) => ({ nome: e.nome, bytes: e.bytes, larguraCm: numeroEntre(e.larguraTxt, 0.5, 5000) })),
        converterEps,
      );
      if (!vivo) return;
      setDetalhes(r.detalhes);
      setArte(r.arte);
      setLendo(false);
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [entradas]);

  return { entradas, detalhes, arte, lendo, adicionar, mudarLargura, remover, mover };
}

