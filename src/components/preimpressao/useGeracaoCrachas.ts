// Crachás: gera, em segundo plano, a prévia da pessoa escolhida, o PDF de todos, o verso e a prova.
// Usado na tela "Modelo com dados" e no editor de modelo.

import { useEffect, useMemo, useRef, useState } from "react";
import type { FontesExternas, Imagem } from "@/lib/preimpressao/agenda";
import { carregarFontes } from "@/lib/preimpressao/agendaNavegador";
import {
  AJUSTE_PADRAO,
  aspectoDaFoto,
  conferirCrachas,
  gerarCartoes,
  gerarProva,
  gerarVerso,
  type AjusteFoto,
  type CartoesGerados,
  type ConfigCracha,
  type FotoCarregada,
  type Pessoa,
} from "@/lib/preimpressao/cracha";
import { recortarFoto } from "@/lib/preimpressao/crachaNavegador";
import type { ModeloAtivo } from "./crachaModelos";

export type Aba = "frente" | "verso" | "prova";

export function useGeracaoCrachas(o: {
  modelo: ModeloAtivo;
  /** Quem entra no lote (com as cópias repetidas). */
  pessoas: Pessoa[];
  /** Pessoas sem repetir (para a conferência). */
  unicas: Pessoa[];
  fotoDe: Map<string, FotoCarregada & { tipo?: string }>;
  ajustes: Record<string, AjusteFoto>;
  atual: Pessoa | undefined;
  aba: Aba;
  ordemSetores: string[];
}) {
  const { modelo, pessoas, unicas, fotoDe, ajustes, atual, aba, ordemSetores } = o;
  const [externas, setExternas] = useState<FontesExternas | null>(null);
  const [recortes, setRecortes] = useState<Map<string, Imagem>>(new Map());
  const [completo, setCompleto] = useState<CartoesGerados | null>(null);
  const [previa, setPrevia] = useState<Uint8Array | null>(null);
  const [versoBytes, setVersoBytes] = useState<Uint8Array | null>(null);
  const [provaBytes, setProvaBytes] = useState<Uint8Array | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cache = useRef(new Map<string, Imagem>());

  const cfg = modelo.cfg;
  const fundo = modelo.arte?.fundo ?? null;
  const fundoVerso = modelo.arteVerso?.fundo ?? null;
  const cfgPdf: ConfigCracha = useMemo(
    () => ({ orientacao: cfg.orientacao, corFundo: cfg.corFundo, forma: cfg.forma, elementos: cfg.elementos, faixa: cfg.faixa, coresSetor: cfg.coresSetor, extras: cfg.extras }),
    [cfg.orientacao, cfg.corFundo, cfg.forma, cfg.elementos, cfg.faixa, cfg.coresSetor, cfg.extras],
  );

  useEffect(() => {
    void carregarFontes().then(setExternas);
  }, []);

  // Recorte de cada foto, no tamanho da moldura (em cache)
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(async () => {
      const aspecto = aspectoDaFoto(cfg.forma);
      const novo = new Map<string, Imagem>();
      for (const p of unicas) {
        const f = fotoDe.get(p.id);
        if (!f) continue;
        const aj = ajustes[p.id] ?? AJUSTE_PADRAO;
        const chave = `${p.id}|${f.nome}|${f.bytes.length}|${aspecto}|${aj.zoom}|${aj.x}|${aj.y}`;
        let img = cache.current.get(chave);
        if (!img) {
          try {
            img = await recortarFoto(f, aspecto, aj);
          } catch {
            continue;
          }
          cache.current.set(chave, img);
        }
        if (!vivo) return;
        novo.set(p.id, img);
      }
      if (vivo) setRecortes(novo);
    }, 200);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [unicas, fotoDe, ajustes, cfg.forma]);

  // Prévia da pessoa escolhida (rápida)
  useEffect(() => {
    if (!atual) return setPrevia(null);
    let vivo = true;
    const t = setTimeout(() => {
      gerarCartoes({ cfg: cfgPdf, pessoas: [atual], fotos: recortes, fundo, externas, ordemSetores })
        .then((r) => vivo && setPrevia(r.bytes))
        .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível desenhar o crachá."));
    }, 80);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [atual, cfgPdf, recortes, fundo, externas, ordemSetores]);

  // Todos os cartões (para baixar e para a conferência)
  useEffect(() => {
    if (!pessoas.length) {
      setCompleto(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(() => {
      gerarCartoes({ cfg: cfgPdf, pessoas, fotos: recortes, fundo, externas, ordemSetores })
        .then((r) => {
          if (!vivo) return;
          setCompleto(r);
          setErro(null);
        })
        .catch((e) => vivo && setErro(e instanceof Error ? e.message : "Não foi possível montar os crachás."))
        .finally(() => vivo && setGerando(false));
    }, 700);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [pessoas, cfgPdf, recortes, fundo, externas, ordemSetores]);

  // Verso e prova
  useEffect(() => {
    let vivo = true;
    gerarVerso({ orientacao: cfg.orientacao, corFundo: cfg.corVerso, fundo: fundoVerso, copias: 1, girar: cfg.girarVerso })
      .then((b) => vivo && setVersoBytes(b))
      .catch(() => vivo && setVersoBytes(null));
    return () => {
      vivo = false;
    };
  }, [cfg.orientacao, cfg.corVerso, cfg.girarVerso, fundoVerso]);

  useEffect(() => {
    if (aba !== "prova" || !completo) return;
    let vivo = true;
    gerarProva(completo.bytes, cfg.orientacao)
      .then((b) => vivo && setProvaBytes(b))
      .catch(() => vivo && setProvaBytes(null));
    return () => {
      vivo = false;
    };
  }, [aba, completo, cfg.orientacao]);

  const conferencia = useMemo(() => {
    const fotosInfo = new Map<string, { w: number; h: number; ajuste: AjusteFoto }>();
    for (const p of unicas) {
      const f = fotoDe.get(p.id);
      if (f) fotosInfo.set(p.id, { w: f.w, h: f.h, ajuste: ajustes[p.id] ?? AJUSTE_PADRAO });
    }
    return conferirCrachas({ cfg: cfgPdf, pessoas: unicas, fotos: fotosInfo, avisosDeDesenho: completo?.avisos, arte: modelo.arte ? { aspecto: modelo.arte.aspecto, px: modelo.arte.px } : null });
  }, [unicas, fotoDe, ajustes, cfgPdf, completo, modelo.arte]);

  return { externas, recortes, completo, previa, versoBytes, provaBytes, gerando, erro, setErro, cfgPdf, fundo, fundoVerso, conferencia, ordemSetores };
}
