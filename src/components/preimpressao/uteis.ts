// Funções de apoio das telas de Pré-impressão (sem componentes).

import { useCallback, useEffect, useState } from "react";

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
