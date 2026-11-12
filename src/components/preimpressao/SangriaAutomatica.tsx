// Pré-impressão → ferramenta "Sangria automática".
// Arte sem sangria (PDF, PNG, JPG ou EPS) → PDF com a faixa de sangria em volta (padrão 3 mm),
// feita com as bordas da própria arte, e conferência da margem de segurança do texto.
// Tudo no navegador, sem IA e sem custo.

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PT_POR_MM, SANGRIA_PADRAO_MM, formatarCm } from "@/lib/preimpressao/folha";
import { baixarBlob, conferirMargensDoPdf, fornecedorDeFaixas, renderizarPaginaPdf } from "@/lib/preimpressao/navegador";
import {
  MARGEM_SEGURANCA_PADRAO_MM,
  corDeHex,
  gerarComSangria,
  type ConferenciaMargem,
  type ModoSangria,
} from "@/lib/preimpressao/sangria";
import { LinhaArquivo } from "./EntradasArte";
import { BotaoRedondo, Campo, Chave, Dado, DuasColunas, NotaPrivacidade, Painel, Passo, Segmentado, SeletorCor, SoltarArquivo } from "./ui";
import { numeroEntre, useConfigSalva, useEntradasArte } from "./uteis";

interface Config {
  sangria: string;
  modo: ModoSangria;
  cor: string;
  margem: string;
  guias: boolean;
}

const PADRAO: Config = {
  sangria: String(SANGRIA_PADRAO_MM).replace(".", ","),
  modo: "espelhar",
  cor: "#ffffff",
  margem: String(MARGEM_SEGURANCA_PADRAO_MM),
  guias: true,
};

const MAX_PAGINAS = 100;
const CORES = [
  { nome: "Branco", hex: "#ffffff" },
  { nome: "Preto", hex: "#000000" },
];

const AJUDA_MODO: Record<ModoSangria, string> = {
  espelhar: "A borda da arte é refletida para fora, como num espelho. Bom para fundos lisos, degradês, texturas e fotos.",
  esticar: "O último pixel da borda é repetido para fora. Bom para fundo de uma cor só ou com listras na vertical e na horizontal.",
  cor: "A faixa de sangria sai de uma cor só. Use quando a borda da arte tem a cor do fundo.",
};

export default function SangriaAutomatica() {
  const [config, set] = useConfigSalva("preimpressao.sangria.config.v1", PADRAO);
  const { entradas, detalhes, arte, lendo, adicionar, mudarLargura, remover, mover } = useEntradasArte();
  const [saida, setSaida] = useState<Uint8Array | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conferencia, setConferencia] = useState<ConferenciaMargem[] | null>(null);

  const sangria = numeroEntre(config.sangria, 1, 10);
  const margem = numeroEntre(config.margem, 1, 20);
  const grande = !!arte && arte.paginas > MAX_PAGINAS;
  const jaTem = arte?.sangriaPdf ?? null;

  // PDF com a sangria: refeito sozinho a cada ajuste, depois de uma pausa
  useEffect(() => {
    setErro(null);
    if (!arte || sangria === null || grande) {
      setSaida(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(async () => {
      try {
        const bytes = await gerarComSangria(arte.emPe, sangria, fornecedorDeFaixas(arte.emPe, sangria, config.modo, corDeHex(config.cor)));
        if (vivo) setSaida(bytes);
      } catch (e) {
        if (vivo) {
          setSaida(null);
          setErro(e instanceof Error ? e.message : "Não consegui gerar a sangria.");
        }
      } finally {
        if (vivo) setGerando(false);
      }
    }, 400);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [arte, sangria, config.modo, config.cor, grande]);

  // Confere a margem de segurança (da arte original, antes da sangria)
  useEffect(() => {
    setConferencia(null);
    if (!arte || margem === null || grande) return;
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
  }, [arte, margem, grande]);

  const comSangria = arte && sangria !== null ? { w: arte.w + 2 * sangria * PT_POR_MM, h: arte.h + 2 * sangria * PT_POR_MM } : null;

  return (
    <DuasColunas
      esquerda={
        <>
          <Painel className="space-y-6">
            <Campo titulo="Envie a arte sem sangria">
              {entradas.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {entradas.map((e, i) => (
                    <LinhaArquivo
                      key={e.id}
                      entrada={e}
                      detalhe={detalhes[i]}
                      rotulo={String(i + 1)}
                      primeiro={i === 0}
                      ultimo={i === entradas.length - 1}
                      onLargura={(v) => mudarLargura(e.id, v)}
                      onRemover={() => remover(e.id)}
                      onMover={(d) => mover(i, d)}
                    />
                  ))}
                </ul>
              )}
              <SoltarArquivo
                titulo={entradas.length ? "Adicionar arquivo" : "Solte a arte: PDF, PNG, JPG ou EPS"}
                dica={entradas.length ? "Cada arquivo entra na ordem da lista." : "Com o tamanho final, sem sangria. Imagem sem tamanho gravado: digite a largura real."}
                carregando={lendo}
                aceita=".pdf,.png,.jpg,.jpeg,.eps,.cdr,application/pdf,image/png,image/jpeg,application/postscript"
                multiplo
                onArquivos={(f) => void adicionar(f)}
              />
              {jaTem !== null && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  Este PDF já tem {jaTem.toLocaleString("pt-BR")} mm de sangria gravada. Se for isso mesmo, não precisa desta ferramenta: use direto na Montagem de impressos.
                </p>
              )}
              {grande && <p className="mt-2 text-xs text-destructive">Máximo de {MAX_PAGINAS} páginas por vez.</p>}
            </Campo>

            <Campo titulo="Sangria" ajuda="Quanto a arte cresce em cada lado. O padrão da gráfica é 1,5 mm.">
              <Passo valor={config.sangria} onChange={(v) => set("sangria", v)} passo={0.5} min={1} max={10} sufixo="mm" rotulo="sangria" invalido={sangria === null} />
            </Campo>

            <Campo titulo="Como preencher a sangria" ajuda={AJUDA_MODO[config.modo]}>
              <Segmentado
                valor={config.modo}
                opcoes={[
                  { valor: "espelhar" as ModoSangria, rotulo: "Espelhar" },
                  { valor: "esticar" as ModoSangria, rotulo: "Esticar" },
                  { valor: "cor" as ModoSangria, rotulo: "Cor" },
                ]}
                onChange={(v) => set("modo", v)}
              />
              {config.modo === "cor" && (
                <div className="mt-3">
                  <SeletorCor valor={config.cor} sugestoes={CORES} onChange={(hex) => set("cor", hex)} />
                </div>
              )}
            </Campo>

            <Campo titulo="Margem de segurança" ajuda="Textos, logos e telefones devem ficar dentro da linha tracejada, longe do corte, para a guilhotina não pegar.">
              <Passo valor={config.margem} onChange={(v) => set("margem", v)} passo={0.5} min={1} max={20} sufixo="mm" rotulo="margem de segurança" invalido={margem === null} />
            </Campo>
          </Painel>
        </>
      }
      direita={
        <>
          <Painel className="space-y-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Pré-visualização</h3>
              <p className="text-xs text-muted-foreground">{arte ? "A arte com a sangria que vai ser baixada." : "Envie a arte para ver a sangria."}</p>
            </div>
            <PreviaComGuias
              bytes={saida}
              paginas={arte?.paginas ?? 0}
              ocupado={gerando || lendo}
              guias={config.guias}
              sangriaPt={sangria !== null ? sangria * PT_POR_MM : 0}
              margemPt={margem !== null ? margem * PT_POR_MM : 0}
              tamanho={comSangria}
            />
            <Chave ligado={config.guias} onChange={(v) => set("guias", v)}>
              <span className="font-medium">Mostrar linhas de corte e de segurança</span>
              <span className="block text-xs text-muted-foreground">Só na tela, para conferir. Elas não vão para o PDF.</span>
            </Chave>
          </Painel>

          <Painel className="space-y-4">
            {arte && comSangria ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm xl:grid-cols-3">
                <Dado rotulo="Tamanho final (corte)" valor={formatarCm(arte.w, arte.h)} />
                <Dado rotulo="Com a sangria" valor={formatarCm(comSangria.w, comSangria.h)} />
                <Dado rotulo="Páginas" valor={arte.paginas} />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Envie a arte para ver os tamanhos.</p>
            )}
            <ResultadoMargem conferencia={conferencia} margem={margem} />
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            {saida && <p className="text-xs text-muted-foreground">O PDF já leva a sangria gravada: na Montagem de impressos ela é lida sozinha.</p>}
            <NotaPrivacidade />
          </Painel>
        </>
      }
      rodape={
        <Button
          size="lg"
          className="w-full rounded-full"
          disabled={!saida || gerando}
          onClick={() => saida && arte && baixarBlob(new Blob([saida], { type: "application/pdf" }), arte.nome.replace(/\.[^.]+$/, "") + "_com-sangria.pdf")}
        >
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar PDF com sangria
        </Button>
      }
    />
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
    return (
      <p className={cn(caixa, "bg-muted/60 text-muted-foreground")}>
        A borda tem foto ou degradê, então o sistema não consegue separar o fundo do texto. Olhe a linha tracejada na pré-visualização.
      </p>
    );
  }
  return <p className={cn(caixa, "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300")}>Nada encostado na borda: tudo fica a mais de {mm} mm do corte.</p>;
}

/** Prévia do PDF com a linha de corte e a de segurança desenhadas por cima (só na tela). */
function PreviaComGuias({
  bytes,
  paginas,
  ocupado,
  guias,
  sangriaPt,
  margemPt,
  tamanho,
}: {
  bytes: Uint8Array | null;
  paginas: number;
  ocupado: boolean;
  guias: boolean;
  sangriaPt: number;
  margemPt: number;
  tamanho: { w: number; h: number } | null;
}) {
  const [pagina, setPagina] = useState(0);
  const [img, setImg] = useState<string | null>(null);
  const atual = Math.min(pagina, Math.max(0, paginas - 1));

  useEffect(() => {
    if (!bytes) {
      setImg(null);
      return;
    }
    let vivo = true;
    renderizarPaginaPdf(bytes, atual, 1400)
      .then((u) => vivo && setImg(u))
      .catch(() => vivo && setImg(null));
    return () => {
      vivo = false;
    };
  }, [bytes, atual]);

  const pct = useMemo(() => {
    if (!tamanho) return null;
    const x = (v: number) => `${(v / tamanho.w) * 100}%`;
    const y = (v: number) => `${(v / tamanho.h) * 100}%`;
    return {
      corte: { left: x(sangriaPt), right: x(sangriaPt), top: y(sangriaPt), bottom: y(sangriaPt) },
      seguro: { left: x(sangriaPt + margemPt), right: x(sangriaPt + margemPt), top: y(sangriaPt + margemPt), bottom: y(sangriaPt + margemPt) },
    };
  }, [tamanho, sangriaPt, margemPt]);

  if (!bytes || !img) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground">
        {ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : "A pré-visualização aparece aqui"}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-muted/30 p-4">
        <div className="relative mx-auto w-fit max-w-full">
          <img src={img} alt="Arte com sangria" className={cn("block max-h-[46vh] max-w-full rounded-sm bg-white shadow-sm transition-opacity", ocupado && "opacity-50")} />
          {guias && pct && (
            <>
              <div className="pointer-events-none absolute border border-red-500 shadow-[0_0_0_1px_rgba(255,255,255,0.7)]" style={pct.corte} data-guia="corte" />
              <div className="pointer-events-none absolute border border-dashed border-sky-400 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" style={pct.seguro} data-guia="seguranca" />
            </>
          )}
        </div>
        {guias && (
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-5 border-t border-red-500" /> Linha de corte
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-5 border-t border-dashed border-sky-500" /> Margem de segurança
            </span>
          </div>
        )}
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
