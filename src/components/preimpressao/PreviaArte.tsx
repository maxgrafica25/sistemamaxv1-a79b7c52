// Pré-visualização da arte com a linha de corte e a margem de segurança (lado direito da tela).
// Serve para conferir se o texto está longe do corte; as linhas só aparecem na tela.

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PT_POR_MM } from "@/lib/preimpressao/folha";
import { renderizarPaginaPdf } from "@/lib/preimpressao/navegador";
import type { ConferenciaMargem } from "@/lib/preimpressao/sangria";
import type { SangriaAuto } from "./sangriaAuto";
import { BotaoRedondo, Passo } from "./ui";

/** Abas do painel de pré-visualização (Folha montada | Arte com sangria). */
export type AbaPrevia = "folha" | "arte";

export function PreviaArteComGuias({
  arte,
  sangriaMm,
  sa,
  ocupado,
}: {
  /** Arte já com sangria (a enviada, ou a criada pelo sistema). */
  arte: { emPe: Uint8Array; w: number; h: number; paginas: number } | null;
  sangriaMm: number | null;
  sa: SangriaAuto;
  ocupado: boolean;
}) {
  const [pagina, setPagina] = useState(0);
  const [img, setImg] = useState<string | null>(null);
  const paginas = arte?.paginas ?? 0;
  const atual = Math.min(pagina, Math.max(0, paginas - 1));
  const emPe = arte?.emPe ?? null;

  useEffect(() => {
    if (!emPe) {
      setImg(null);
      return;
    }
    let vivo = true;
    renderizarPaginaPdf(emPe, atual, 1400)
      .then((u) => vivo && setImg(u))
      .catch(() => vivo && setImg(null));
    return () => {
      vivo = false;
    };
  }, [emPe, atual]);

  const sangriaPt = (sangriaMm ?? 0) * PT_POR_MM;
  const margemPt = (sa.margem ?? 0) * PT_POR_MM;
  const pct = useMemo(() => {
    if (!arte) return null;
    const x = (v: number) => `${(v / arte.w) * 100}%`;
    const y = (v: number) => `${(v / arte.h) * 100}%`;
    return {
      corte: { left: x(sangriaPt), right: x(sangriaPt), top: y(sangriaPt), bottom: y(sangriaPt) },
      seguro: { left: x(sangriaPt + margemPt), right: x(sangriaPt + margemPt), top: y(sangriaPt + margemPt), bottom: y(sangriaPt + margemPt) },
    };
  }, [arte, sangriaPt, margemPt]);

  if (!arte || !img || !pct) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground">
        {ocupado || sa.preparando ? <Loader2 className="h-5 w-5 animate-spin" /> : "Envie a arte para ver a sangria"}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-muted/30 p-4">
        <div className="relative mx-auto w-fit max-w-full">
          <img src={img} alt="Arte com sangria" className={cn("block max-h-[46vh] max-w-full rounded-sm bg-white shadow-sm transition-opacity", ocupado && "opacity-50")} />
          <div className="pointer-events-none absolute border border-red-500 shadow-[0_0_0_1px_rgba(255,255,255,0.7)]" style={pct.corte} data-guia="corte" />
          <div className="pointer-events-none absolute border border-dashed border-sky-400 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" style={pct.seguro} data-guia="seguranca" />
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-5 border-t border-red-500" /> Linha de corte
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0 w-5 border-t border-dashed border-sky-500" /> Margem de segurança
          </span>
          <span>Só na tela: não vão para o PDF.</span>
        </div>
      </div>

      {paginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <BotaoRedondo rotulo="Página anterior" onClick={() => setPagina(Math.max(0, atual - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </BotaoRedondo>
          <span className="min-w-[6rem] text-center tabular-nums text-muted-foreground">
            {atual + 1} de {paginas}
          </span>
          <BotaoRedondo rotulo="Próxima página" onClick={() => setPagina(Math.min(paginas - 1, atual + 1))}>
            <ChevronRight className="h-4 w-4" />
          </BotaoRedondo>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Margem de segurança do texto</p>
        <Passo valor={sa.cfg.margem} onChange={(v) => sa.set("margem", v)} passo={0.5} min={1} max={20} sufixo="mm" rotulo="margem de segurança" invalido={sa.margem === null} />
        <p className="mt-2 text-xs text-muted-foreground">Textos e logos devem ficar dentro da linha tracejada, longe do corte, para a guilhotina não pegar.</p>
      </div>

      <ResultadoMargem conferencia={sa.conferencia} margem={sa.margem} criar={sa.criar} />
    </div>
  );
}

function ResultadoMargem({ conferencia, margem, criar }: { conferencia: ConferenciaMargem[] | null; margem: number | null; criar: boolean }) {
  // A conferência automática só roda quando o sistema cria a sangria (a arte original não tem sangria)
  if (!criar) return <p className="text-xs text-muted-foreground">A conferência automática de texto na borda vale quando o sistema cria a sangria. Aqui, confira pela linha tracejada.</p>;
  if (!conferencia || margem === null) return null;
  const mm = margem.toLocaleString("pt-BR");
  const atencao = conferencia.map((c, i) => (c.situacao === "atencao" ? i + 1 : 0)).filter(Boolean);
  const indeterminada = conferencia.some((c) => c.situacao === "indeterminado");
  const caixa = "rounded-2xl px-4 py-3 text-sm";
  if (atencao.length) {
    return (
      <p className={cn(caixa, "bg-amber-500/10 text-amber-800 dark:text-amber-300")}>
        <span className="font-medium">Atenção:</span> há texto ou desenho a menos de {mm} mm da borda
        {conferencia.length > 1 ? ` (página${atencao.length > 1 ? "s" : ""} ${atencao.join(", ")})` : ""}. Confira na pré-visualização: o que passar da linha tracejada pode ser cortado.
      </p>
    );
  }
  if (indeterminada) {
    return <p className={cn(caixa, "bg-muted/60 text-muted-foreground")}>A borda tem foto ou degradê, então o sistema não consegue separar o fundo do texto. Olhe a linha tracejada na pré-visualização.</p>;
  }
  return <p className={cn(caixa, "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300")}>Nada encostado na borda: tudo fica a mais de {mm} mm do corte.</p>;
}
