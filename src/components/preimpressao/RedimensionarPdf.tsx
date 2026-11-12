// Pré-impressão → ferramenta "Redimensionar e cortar".
// PDF (ou imagem/EPS) → mesmas páginas em outro tamanho (A5, A4, medida livre), ou com margens
// cortadas, ou sem a folga branca. A arte continua em vetor. Tudo no navegador, sem custo.

import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PT_POR_CM } from "@/lib/preimpressao/margem";
import { PT_POR_MM, formatarCm } from "@/lib/preimpressao/folha";
import { baixarBlob, caixasDoConteudoDoPdf } from "@/lib/preimpressao/navegador";
import {
  TAMANHOS_PAGINA,
  gerarRedimensionado,
  planejarCorte,
  planejarFolga,
  planejarTamanho,
  tamanhosDasPaginas,
  type CaixaConteudo,
  type Encaixe,
  type PlanoPagina,
} from "@/lib/preimpressao/redimensionar";
import { LinhaArquivo } from "./EntradasArte";
import { Campo, Chave, Dado, DuasColunas, Mini, NotaPrivacidade, Painel, Passo, PreviaPdf, Segmentado, SoltarArquivo } from "./ui";
import { numeroEntre, useConfigSalva, useEntradasArte } from "./uteis";

type Modo = "tamanho" | "margens" | "folga";

interface Config {
  modo: Modo;
  tamanho: string;
  larguraCm: string;
  alturaCm: string;
  encaixe: Encaixe;
  iguais: boolean;
  cima: string;
  baixo: string;
  esq: string;
  dir: string;
  folga: string;
}

const PADRAO: Config = {
  modo: "tamanho",
  tamanho: "A5",
  larguraCm: "21",
  alturaCm: "10",
  encaixe: "caber",
  iguais: true,
  cima: "5",
  baixo: "5",
  esq: "5",
  dir: "5",
  folga: "3",
};

const MAX_PAGINAS = 500;
const MAX_PAGINAS_FOLGA = 200;

const AJUDA_ENCAIXE: Record<Encaixe, string> = {
  caber: "A página inteira entra no tamanho novo, sem cortar nada. Pode sobrar branco nas laterais.",
  preencher: "A arte cobre a página toda e o que passar é cortado, igualmente dos dois lados.",
  real: "A arte não muda de tamanho: fica centralizada e o que passar é cortado.",
};

export default function RedimensionarPdf() {
  const [config, set] = useConfigSalva("preimpressao.redimensionar.config.v1", PADRAO);
  const { entradas, detalhes, arte, lendo, adicionar, mudarLargura, remover, mover } = useEntradasArte();
  const [tamanhos, setTamanhos] = useState<{ w: number; h: number }[]>([]);
  const [caixas, setCaixas] = useState<(CaixaConteudo | null)[] | null>(null);
  const [medindo, setMedindo] = useState(false);
  const [saida, setSaida] = useState<Uint8Array | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const larguraLivre = numeroEntre(config.larguraCm, 1, 500);
  const alturaLivre = numeroEntre(config.alturaCm, 1, 500);
  const lados = {
    cima: numeroEntre(config.cima, 0, 500),
    baixo: numeroEntre(config.baixo, 0, 500),
    esq: numeroEntre(config.esq, 0, 500),
    dir: numeroEntre(config.dir, 0, 500),
  };
  const folga = numeroEntre(config.folga, 0, 50);
  const limite = config.modo === "folga" ? MAX_PAGINAS_FOLGA : MAX_PAGINAS;
  const grande = !!arte && arte.paginas > limite;

  // Tamanho de todas as páginas
  useEffect(() => {
    if (!arte) {
      setTamanhos([]);
      return;
    }
    let vivo = true;
    tamanhosDasPaginas(arte.emPe).then((t) => vivo && setTamanhos(t)).catch(() => vivo && setTamanhos([]));
    return () => {
      vivo = false;
    };
  }, [arte]);

  // Folga branca: mede o conteúdo de cada página (só neste modo)
  useEffect(() => {
    setCaixas(null);
    if (!arte || config.modo !== "folga" || grande) return;
    let vivo = true;
    setMedindo(true);
    caixasDoConteudoDoPdf(arte.emPe)
      .then((c) => vivo && setCaixas(c))
      .catch(() => vivo && setCaixas(null))
      .finally(() => vivo && setMedindo(false));
    return () => {
      vivo = false;
    };
  }, [arte, config.modo, grande]);

  const alvo = useMemo(() => {
    if (config.tamanho === "livre") return larguraLivre !== null && alturaLivre !== null ? { w: larguraLivre * PT_POR_CM, h: alturaLivre * PT_POR_CM } : null;
    const t = TAMANHOS_PAGINA.find((x) => x.key === config.tamanho) ?? TAMANHOS_PAGINA[1];
    return { w: t.wCm * PT_POR_CM, h: t.hCm * PT_POR_CM };
  }, [config.tamanho, larguraLivre, alturaLivre]);

  const planos: (PlanoPagina | null)[] | null = useMemo(() => {
    if (!tamanhos.length || grande) return null;
    if (config.modo === "tamanho") return alvo ? tamanhos.map((t) => planejarTamanho(t.w, t.h, alvo.w, alvo.h, config.encaixe, config.tamanho !== "livre")) : null;
    if (config.modo === "margens") {
      const l = config.iguais ? { cima: lados.cima, baixo: lados.cima, esq: lados.cima, dir: lados.cima } : lados;
      if (l.cima === null || l.baixo === null || l.esq === null || l.dir === null) return null;
      const pt = { cima: l.cima * PT_POR_MM, baixo: l.baixo * PT_POR_MM, esq: l.esq * PT_POR_MM, dir: l.dir * PT_POR_MM };
      const p = tamanhos.map((t) => planejarCorte(t.w, t.h, pt));
      return p.some((x) => x === null) ? null : p;
    }
    if (folga === null || !caixas || caixas.length !== tamanhos.length) return null;
    return tamanhos.map((t, i) => planejarFolga(t.w, t.h, caixas[i], folga));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tamanhos, grande, config.modo, config.encaixe, config.tamanho, config.iguais, config.cima, config.baixo, config.esq, config.dir, alvo, folga, caixas]);

  // PDF novo: refeito sozinho a cada ajuste
  useEffect(() => {
    setErro(null);
    if (!arte || !planos) {
      setSaida(null);
      return;
    }
    let vivo = true;
    setGerando(true);
    const t = setTimeout(async () => {
      try {
        const bytes = await gerarRedimensionado(arte.emPe, planos);
        if (vivo) setSaida(bytes);
      } catch (e) {
        if (vivo) {
          setSaida(null);
          setErro(e instanceof Error ? e.message : "Não consegui gerar o PDF.");
        }
      } finally {
        if (vivo) setGerando(false);
      }
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [arte, planos]);

  const p0 = planos?.[0] ?? null;
  const t0 = tamanhos[0] ?? null;
  const mmTxt = (pt: number) => (pt / PT_POR_MM).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  const escalaPct = p0 && config.modo === "tamanho" ? Math.round(p0.escala * 100) : null;
  const diferentes = tamanhos.some((t) => Math.abs(t.w - tamanhos[0].w) > 1 || Math.abs(t.h - tamanhos[0].h) > 1);

  return (
    <DuasColunas
      esquerda={
        <Painel className="space-y-6">
          <Campo titulo="Envie o arquivo">
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
              titulo={entradas.length ? "Adicionar arquivo" : "Solte o PDF, PNG, JPG ou EPS"}
              dica={entradas.length ? "Entram na ordem da lista." : "Todas as páginas são ajustadas de uma vez."}
              carregando={lendo}
              aceita=".pdf,.png,.jpg,.jpeg,.eps,.cdr,application/pdf,image/png,image/jpeg,application/postscript"
              multiplo
              onArquivos={(f) => void adicionar(f)}
            />
            {grande && <p className="mt-2 text-xs text-destructive">Máximo de {limite} páginas neste modo.</p>}
          </Campo>

          <Campo titulo="O que você quer fazer?" ajuda={config.modo === "tamanho" ? "Mudar o tamanho das páginas." : config.modo === "margens" ? "Cortar uma medida das bordas." : "Tirar o branco que sobra em volta do desenho."}>
            <Segmentado
              valor={config.modo}
              opcoes={[
                { valor: "tamanho" as Modo, rotulo: "Tamanho" },
                { valor: "margens" as Modo, rotulo: "Margens" },
                { valor: "folga" as Modo, rotulo: "Folga" },
              ]}
              onChange={(v) => set("modo", v)}
            />
          </Campo>

          {config.modo === "tamanho" && (
            <>
              <Campo titulo="Novo tamanho" ajuda={config.tamanho === "livre" ? "A página nova tem exatamente essa largura e essa altura." : "A página nova fica em pé ou deitada, igual à original."}>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Novo tamanho">
                  {[...TAMANHOS_PAGINA.map((t) => ({ key: t.key, rotulo: t.rotulo })), { key: "livre", rotulo: "Medida livre" }].map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="radio"
                      aria-checked={config.tamanho === t.key}
                      onClick={() => set("tamanho", t.key)}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        config.tamanho === t.key ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t.rotulo}
                    </button>
                  ))}
                </div>
                {config.tamanho === "livre" ? (
                  <div className="mt-3 grid grid-cols-2 gap-x-3">
                    <Mini rotulo="Largura (cm)" valor={config.larguraCm} onChange={(v) => set("larguraCm", v)} erro={larguraLivre === null ? "1 a 500" : undefined} />
                    <Mini rotulo="Altura (cm)" valor={config.alturaCm} onChange={(v) => set("alturaCm", v)} erro={alturaLivre === null ? "1 a 500" : undefined} />
                  </div>
                ) : (
                  (() => {
                    const t = TAMANHOS_PAGINA.find((x) => x.key === config.tamanho);
                    return t ? <p className="mt-2 text-xs text-muted-foreground">{t.wCm.toLocaleString("pt-BR")} × {t.hCm.toLocaleString("pt-BR")} cm</p> : null;
                  })()
                )}
              </Campo>

              <Campo titulo="Como encaixar a arte" ajuda={AJUDA_ENCAIXE[config.encaixe]}>
                <Segmentado
                  valor={config.encaixe}
                  opcoes={[
                    { valor: "caber" as Encaixe, rotulo: "Caber inteira" },
                    { valor: "preencher" as Encaixe, rotulo: "Preencher" },
                    { valor: "real" as Encaixe, rotulo: "Tamanho real" },
                  ]}
                  onChange={(v) => set("encaixe", v)}
                />
              </Campo>
            </>
          )}

          {config.modo === "margens" && (
            <Campo titulo="Cortar de cada lado" ajuda="Tira essa medida das bordas de todas as páginas. O resto não muda de tamanho.">
              <Chave ligado={config.iguais} onChange={(v) => set("iguais", v)}>
                <span className="font-medium">Mesmo valor nos 4 lados</span>
              </Chave>
              <div className="mt-3">
                {config.iguais ? (
                  <Passo valor={config.cima} onChange={(v) => { set("cima", v); set("baixo", v); set("esq", v); set("dir", v); }} passo={1} min={0} max={500} sufixo="mm" rotulo="corte" invalido={lados.cima === null} />
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                    <Mini rotulo="Em cima (mm)" valor={config.cima} onChange={(v) => set("cima", v)} erro={lados.cima === null ? "0 a 500" : undefined} />
                    <Mini rotulo="Embaixo (mm)" valor={config.baixo} onChange={(v) => set("baixo", v)} erro={lados.baixo === null ? "0 a 500" : undefined} />
                    <Mini rotulo="Esquerda (mm)" valor={config.esq} onChange={(v) => set("esq", v)} erro={lados.esq === null ? "0 a 500" : undefined} />
                    <Mini rotulo="Direita (mm)" valor={config.dir} onChange={(v) => set("dir", v)} erro={lados.dir === null ? "0 a 500" : undefined} />
                  </div>
                )}
              </div>
            </Campo>
          )}

          {config.modo === "folga" && (
            <Campo titulo="Folga a deixar em volta" ajuda="O sistema acha o que tem desenho em cada página, corta o branco que sobra e deixa só essa folga. Página toda em branco não muda.">
              <Passo valor={config.folga} onChange={(v) => set("folga", v)} passo={1} min={0} max={50} sufixo="mm" rotulo="folga" invalido={folga === null} />
            </Campo>
          )}
        </Painel>
      }
      direita={
        <>
          <Painel className="space-y-4">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Pré-visualização</h3>
              <p className="text-xs text-muted-foreground">{arte ? "É o PDF que vai ser baixado." : "Envie o arquivo para ver o resultado."}</p>
            </div>
            <PreviaPdf
              bytes={saida}
              paginas={arte?.paginas ?? 0}
              ocupado={gerando || medindo || lendo}
              vazio={medindo ? "Medindo o conteúdo das páginas…" : planos === null && arte ? "Confira os campos marcados em vermelho" : "A pré-visualização aparece aqui"}
            />
          </Painel>

          <Painel className="space-y-4">
            {arte && t0 && p0 ? (
              <>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm xl:grid-cols-3">
                  <Dado rotulo="Páginas" valor={arte.paginas.toLocaleString("pt-BR")} />
                  <Dado rotulo="Tamanho original" valor={formatarCm(t0.w, t0.h)} />
                  <Dado rotulo="Novo tamanho" valor={formatarCm(p0.saidaW, p0.saidaH)} />
                  {escalaPct !== null && <Dado rotulo="Escala da arte" valor={`${escalaPct}%`} />}
                  {(p0.cortadoW > 0.5 || p0.cortadoH > 0.5) && (
                    <Dado rotulo="Cortado da arte" valor={`${mmTxt(p0.cortadoW)} × ${mmTxt(p0.cortadoH)} mm`} />
                  )}
                </dl>
                {diferentes && <p className="text-xs text-amber-700 dark:text-amber-400">As páginas têm tamanhos diferentes entre si. Os números acima são da primeira; cada página é ajustada pelo próprio tamanho.</p>}
                {escalaPct !== null && (escalaPct < 55 || escalaPct > 180) && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    A arte vai ficar bem {escalaPct < 100 ? "menor" : "maior"} ({escalaPct}%). Confira se o texto continua legível e se a imagem aguenta.
                  </p>
                )}
                {config.modo === "tamanho" && config.encaixe !== "caber" && (p0.cortadoW > 0.5 || p0.cortadoH > 0.5) && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Parte da arte fica de fora da página nova. Olhe a pré-visualização para ver se nada importante foi cortado.</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{arte ? "Calculando…" : "Envie o arquivo para ver os tamanhos."}</p>
            )}
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <NotaPrivacidade />
          </Painel>
        </>
      }
      rodape={
        <Button
          size="lg"
          className="w-full rounded-full"
          disabled={!saida || gerando}
          onClick={() => {
            if (!saida || !arte) return;
            const base = arte.nome.replace(/\.[^.]+$/, "");
            const sufixo = config.modo === "tamanho" ? (config.tamanho === "livre" ? "redimensionado" : config.tamanho) : config.modo === "margens" ? "cortado" : "sem-folga";
            baixarBlob(new Blob([saida], { type: "application/pdf" }), `${base}_${sufixo}.pdf`);
          }}
        >
          {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar PDF
        </Button>
      }
    />
  );
}
