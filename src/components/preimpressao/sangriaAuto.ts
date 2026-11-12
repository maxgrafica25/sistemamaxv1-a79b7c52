// "Criar a sangria automaticamente": usado pela Montagem e pela Numeração quando a arte
// chegou sem sangria. Gera (no navegador) um PDF com a faixa em volta e devolve uma arte
// "efetiva" já com a sangria, que as ferramentas usam no lugar da arte enviada.

import { useEffect, useMemo, useState } from "react";
import { PT_POR_MM } from "@/lib/preimpressao/folha";
import { conferirMargensDoPdf, fornecedorDeFaixas } from "@/lib/preimpressao/navegador";
import { corDeHex, gerarComSangria, type ConferenciaMargem, type ModoSangria } from "@/lib/preimpressao/sangria";
import { numeroEntre, useConfigSalva } from "./uteis";

export const MAX_PAGINAS_SANGRIA = 100;

interface ArteBase {
  emPe: Uint8Array;
  w: number;
  h: number;
  paginas: number;
}

interface Gerada {
  origem: Uint8Array;
  bytes: Uint8Array;
  w: number;
  h: number;
}

export function useSangriaAutomatica<T extends ArteBase>(arte: T | null, sangriaMm: number | null) {
  const [cfg, set] = useConfigSalva("preimpressao.sangria.config.v2", { modo: "espelhar" as ModoSangria, cor: "#ffffff", margem: "3" });
  // Não é salvo: cada arte começa em "já tem sangria", o caso normal
  const [criar, setCriar] = useState(false);
  const [gerada, setGerada] = useState<Gerada | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conferencia, setConferencia] = useState<ConferenciaMargem[] | null>(null);

  const margem = numeroEntre(cfg.margem, 1, 20);
  const grande = !!arte && arte.paginas > MAX_PAGINAS_SANGRIA;
  const valida = sangriaMm !== null && sangriaMm >= 0.5 && sangriaMm <= 10;
  const ativa = criar && !!arte && valida && !grande;

  useEffect(() => {
    setErro(null);
    if (!ativa || !arte || sangriaMm === null) {
      setGerada(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(async () => {
      try {
        const bytes = await gerarComSangria(arte.emPe, sangriaMm, fornecedorDeFaixas(arte.emPe, sangriaMm, cfg.modo, corDeHex(cfg.cor)));
        const b = sangriaMm * PT_POR_MM;
        if (vivo) setGerada({ origem: arte.emPe, bytes, w: arte.w + 2 * b, h: arte.h + 2 * b });
      } catch (e) {
        if (vivo) {
          setGerada(null);
          setErro(e instanceof Error ? e.message : "Não consegui criar a sangria.");
        }
      } finally {
        if (vivo) setGerando(false);
      }
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [ativa, arte, sangriaMm, cfg.modo, cfg.cor]);

  // Confere se tem coisa colada na borda (na arte original, antes da sangria)
  useEffect(() => {
    setConferencia(null);
    if (!ativa || !arte || margem === null) return;
    let vivo = true;
    const t = setTimeout(() => {
      conferirMargensDoPdf(arte.emPe, margem)
        .then((r) => vivo && setConferencia(r))
        .catch(() => vivo && setConferencia(null));
    }, 500);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [ativa, arte, margem]);

  const pronta = ativa && !!arte && !!gerada && gerada.origem === arte.emPe;
  // useMemo: as telas usam a arte como dependência de efeitos; um objeto novo a cada render faria o trabalho se repetir
  const arteEfetiva = useMemo<T | null>(
    () => (!criar ? arte : pronta && arte && gerada ? { ...arte, emPe: gerada.bytes, w: gerada.w, h: gerada.h } : null),
    [criar, arte, pronta, gerada],
  );

  return {
    criar,
    setCriar,
    cfg,
    set,
    margem,
    grande,
    valida,
    gerando,
    erro,
    conferencia,
    /** PDF com a sangria (só quando "criar" está ligado e pronto). */
    bytes: pronta && gerada ? gerada.bytes : null,
    arteEfetiva,
    /** Ligado, mas o PDF com sangria ainda não ficou pronto. */
    preparando: criar && !!arte && !arteEfetiva && !erro && valida && !grande,
  };
}

export type SangriaAuto = ReturnType<typeof useSangriaAutomatica>;
