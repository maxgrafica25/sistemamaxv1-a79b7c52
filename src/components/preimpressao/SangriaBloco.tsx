// Bloco "Sangria da arte": a arte já tem sangria, ou o sistema cria (espelhar, esticar ou cor)
// e mostra a margem de segurança do texto. Usado pela Montagem e pela Numeração.

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PT_POR_MM } from "@/lib/preimpressao/folha";
import { renderizarPaginaPdf, baixarBlob } from "@/lib/preimpressao/navegador";
import type { ConferenciaMargem, ModoSangria } from "@/lib/preimpressao/sangria";
import { MAX_PAGINAS_SANGRIA, type SangriaAuto } from "./sangriaAuto";
import { BotaoRedondo, Campo, Mini, Passo, Segmentado, SeletorCor } from "./ui";

const CORES = [
  { nome: "Branco", hex: "#ffffff" },
  { nome: "Preto", hex: "#000000" },
];

const AJUDA_MODO: Record<ModoSangria, string> = {
  espelhar: "A borda da arte é refletida para fora, como num espelho. Bom para fundos lisos, degradês, texturas e fotos.",
  esticar: "O último pixel da borda é repetido para fora. Bom para fundo de uma cor só ou com listras na vertical e na horizontal.",
  cor: "A faixa de sangria sai de uma cor só. Use quando a borda da arte tem a cor do fundo.",
};

export function SangriaBloco({
  sa,
  sangriaTxt,
  sangriaMm,
  onSangria,
  sangriaPdf,
  paginas,
  nomeBase,
  larguraArte,
}: {
  sa: SangriaAuto;
  sangriaTxt: string;
  sangriaMm: number | null;
  onSangria: (v: string) => void;
  /** Sangria já gravada no PDF (TrimBox), se houver. */
  sangriaPdf: number | null;
  paginas: number;
  nomeBase: string;
  /** Tamanho da arte enviada (pt), sem a sangria criada. */
  larguraArte: { w: number; h: number };
}) {
  const [verArte, setVerArte] = useState(false);
  return (
    <Campo titulo="A arte já tem sangria?">
      <Segmentado
        valor={sa.criar ? "criar" : "sim"}
        opcoes={[
          { valor: "sim", rotulo: "Já tem" },
          { valor: "criar", rotulo: "Criar automaticamente" },
        ]}
        onChange={(v) => sa.setCriar(v === "criar")}
      />
      {!sa.criar ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {sangriaPdf != null
            ? `Sangria de ${sangriaPdf.toLocaleString("pt-BR")} mm lida do PDF.`
            : "A arte chega com a sangria feita. Se não tiver, escolha \"Criar automaticamente\"."}
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {sangriaPdf != null && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Este PDF já tem {sangriaPdf.toLocaleString("pt-BR")} mm de sangria gravada. Criar outra vai somar à que já existe.
            </p>
          )}
          {sa.grande && <p className="text-xs text-destructive">Para criar a sangria o máximo é {MAX_PAGINAS_SANGRIA} páginas por vez.</p>}

          <Campo titulo="Tamanho da sangria" ajuda="Quanto a arte cresce em cada lado. O padrão da gráfica é 1,5 mm.">
            <Passo valor={sangriaTxt} onChange={onSangria} passo={0.5} min={0.5} max={10} sufixo="mm" rotulo="sangria" invalido={!sa.valida} />
          </Campo>

          <Campo titulo="Como preencher" ajuda={AJUDA_MODO[sa.cfg.modo]}>
            <Segmentado
              valor={sa.cfg.modo}
              opcoes={[
                { valor: "espelhar" as ModoSangria, rotulo: "Espelhar" },
                { valor: "esticar" as ModoSangria, rotulo: "Esticar" },
                { valor: "cor" as ModoSangria, rotulo: "Cor" },
              ]}
              onChange={(v) => sa.set("modo", v)}
            />
            {sa.cfg.modo === "cor" && (
              <div className="mt-3">
                <SeletorCor valor={sa.cfg.cor} sugestoes={CORES} onChange={(hex) => sa.set("cor", hex)} />
              </div>
            )}
          </Campo>

          <Mini
            rotulo="Margem de segurança do texto (mm)"
            valor={sa.cfg.margem}
            onChange={(v) => sa.set("margem", v)}
            erro={sa.margem === null ? "1 a 20 mm" : undefined}
            ajuda="Textos e logos devem ficar longe do corte, para a guilhotina não pegar."
          />

          <ResultadoMargem conferencia={sa.conferencia} margem={sa.margem} />
          {sa.erro && <p className="text-xs text-destructive">{sa.erro}</p>}

          {sa.bytes && (
            <div className="rounded-2xl bg-muted/50">
              <button
                type="button"
                aria-expanded={verArte}
                onClick={() => setVerArte((v) => !v)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <span className="font-medium">Ver a arte com sangria e margem de segurança</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", verArte && "rotate-180")} />
              </button>
              {verArte && (
                <div className="px-4 pb-4">
                  <PreviaComGuias
                    bytes={sa.bytes}
                    paginas={paginas}
                    ocupado={sa.gerando}
                    sangriaPt={(sangriaMm ?? 0) * PT_POR_MM}
                    margemPt={(sa.margem ?? 0) * PT_POR_MM}
                    tamanho={{ w: larguraArte.w + 2 * (sangriaMm ?? 0) * PT_POR_MM, h: larguraArte.h + 2 * (sangriaMm ?? 0) * PT_POR_MM }}
                  />
                </div>
              )}
            </div>
          )}

          {sa.bytes && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => sa.bytes && baixarBlob(new Blob([sa.bytes], { type: "application/pdf" }), `${nomeBase}_com-sangria.pdf`)}
            >
              Baixar só a arte com sangria
            </button>
          )}
          {sa.gerando && !sa.bytes && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Criando a sangria…
            </p>
          )}
        </div>
      )}
    </Campo>
  );
}

function ResultadoMargem({ conferencia, margem }: { conferencia: ConferenciaMargem[] | null; margem: number | null }) {
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

/** Prévia do PDF com a linha de corte e a de segurança desenhadas por cima (só na tela). */
function PreviaComGuias({
  bytes,
  paginas,
  ocupado,
  sangriaPt,
  margemPt,
  tamanho,
}: {
  bytes: Uint8Array;
  paginas: number;
  ocupado: boolean;
  sangriaPt: number;
  margemPt: number;
  tamanho: { w: number; h: number };
}) {
  const [pagina, setPagina] = useState(0);
  const [img, setImg] = useState<string | null>(null);
  const atual = Math.min(pagina, Math.max(0, paginas - 1));

  useEffect(() => {
    let vivo = true;
    renderizarPaginaPdf(bytes, atual, 1000)
      .then((u) => vivo && setImg(u))
      .catch(() => vivo && setImg(null));
    return () => {
      vivo = false;
    };
  }, [bytes, atual]);

  const pct = useMemo(() => {
    const x = (v: number) => `${(v / tamanho.w) * 100}%`;
    const y = (v: number) => `${(v / tamanho.h) * 100}%`;
    return {
      corte: { left: x(sangriaPt), right: x(sangriaPt), top: y(sangriaPt), bottom: y(sangriaPt) },
      seguro: { left: x(sangriaPt + margemPt), right: x(sangriaPt + margemPt), top: y(sangriaPt + margemPt), bottom: y(sangriaPt + margemPt) },
    };
  }, [tamanho, sangriaPt, margemPt]);

  if (!img) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="relative mx-auto w-fit max-w-full">
        <img src={img} alt="Arte com sangria" className={cn("block max-h-[36vh] max-w-full rounded-sm bg-white shadow-sm transition-opacity", ocupado && "opacity-50")} />
        <div className="pointer-events-none absolute border border-red-500 shadow-[0_0_0_1px_rgba(255,255,255,0.7)]" style={pct.corte} data-guia="corte" />
        <div className="pointer-events-none absolute border border-dashed border-sky-400 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" style={pct.seguro} data-guia="seguranca" />
      </div>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-5 border-t border-red-500" /> Linha de corte
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-5 border-t border-dashed border-sky-500" /> Margem de segurança
        </span>
        <span>Só na tela: não vão para o PDF.</span>
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
    </div>
  );
}
