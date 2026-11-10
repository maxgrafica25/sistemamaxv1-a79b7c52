// Abre um PDF dentro do sistema (sem baixar nem abrir outro programa).
// Usa o pdf.js que já existe na Pré-impressão; cada página só é desenhada quando aparece na tela.
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Loader2, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { carregarPdfJs } from "@/lib/preimpressao/navegador";

type PdfDoc = Awaited<ReturnType<Awaited<ReturnType<typeof carregarPdfJs>>["getDocument"]>["promise"]>;

export interface PdfParaAbrir {
  nome: string;
  /** Devolve o link do arquivo (gerado na hora, porque os links têm validade). */
  obterUrl: () => Promise<string>;
}

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const MAX_PX = 16_000_000; // limite de área do desenho, para não travar em página gigante (lona)

function Pagina({ doc, numero, largura }: { doc: PdfDoc; numero: number; largura: number }) {
  const caixa = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visivel, setVisivel] = useState(false);
  const [proporcao, setProporcao] = useState(1.414); // A4 em pé até conhecer a página

  useEffect(() => {
    let vivo = true;
    doc.getPage(numero).then((p) => {
      const v = p.getViewport({ scale: 1 });
      if (vivo) setProporcao(v.height / v.width);
    }).catch(() => undefined);
    return () => { vivo = false; };
  }, [doc, numero]);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setVisivel(e.isIntersecting), { rootMargin: "600px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visivel) return;
    let cancelado = false;
    let tarefa: { cancel: () => void; promise: Promise<unknown> } | null = null;
    (async () => {
      const pagina = await doc.getPage(numero);
      if (cancelado || !canvas.current) return;
      const base = pagina.getViewport({ scale: 1 });
      let escala = (largura / base.width) * Math.min(window.devicePixelRatio || 1, 2);
      const area = base.width * base.height * escala * escala;
      if (area > MAX_PX) escala *= Math.sqrt(MAX_PX / area);
      const vp = pagina.getViewport({ scale: escala });
      const c = canvas.current;
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      tarefa = pagina.render({ canvasContext: ctx, viewport: vp, canvas: c } as Parameters<typeof pagina.render>[0]);
      await tarefa.promise.catch(() => undefined);
    })().catch(() => undefined);
    return () => {
      cancelado = true;
      tarefa?.cancel();
    };
  }, [doc, numero, largura, visivel]);

  return (
    <div
      ref={caixa}
      className="mx-auto bg-white shadow-md"
      style={{ width: largura, height: Math.round(largura * proporcao) }}
      aria-label={`Página ${numero}`}
    >
      <canvas ref={canvas} className="block h-full w-full" />
    </div>
  );
}

export function VisualizadorPdf({ arquivo, onClose }: { arquivo: PdfParaAbrir | null; onClose: () => void }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [larguraBase, setLarguraBase] = useState(800);
  const area = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDoc(null);
    setUrl(null);
    setErro(null);
    setZoom(1);
    if (!arquivo) return;
    let cancelado = false;
    let tarefa: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const link = await arquivo.obterUrl();
        if (cancelado) return;
        setUrl(link);
        const resp = await fetch(link);
        if (!resp.ok) throw new Error(`Arquivo não encontrado (${resp.status})`);
        const bytes = new Uint8Array(await resp.arrayBuffer());
        const pdfjs = await carregarPdfJs();
        tarefa = pdfjs.getDocument({ data: bytes });
        const d = await (tarefa as ReturnType<typeof pdfjs.getDocument>).promise;
        if (cancelado) return;
        setDoc(d);
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Não foi possível abrir o PDF");
      }
    })();
    return () => {
      cancelado = true;
      void tarefa?.destroy().catch(() => undefined);
    };
  }, [arquivo]);

  // largura disponível (para "caber na largura" = 100%)
  const medir = useCallback((el: HTMLDivElement | null) => {
    area.current = el;
    if (el) setLarguraBase(Math.max(280, Math.min(el.clientWidth - 32, 1100)));
  }, []);
  useEffect(() => {
    const aoRedimensionar = () => medir(area.current);
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, [medir]);

  const mudarZoom = (dir: 1 | -1) => {
    const i = ZOOMS.indexOf(zoom);
    setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + dir))]);
  };

  return (
    <Dialog open={!!arquivo} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border px-4 py-3 pr-12">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">{arquivo?.nome || "PDF"}</DialogTitle>
            <DialogDescription className="text-xs">
              {doc ? `${doc.numPages} página${doc.numPages > 1 ? "s" : ""}` : erro ? "Erro ao abrir" : "Abrindo…"}
            </DialogDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => mudarZoom(-1)} disabled={zoom === ZOOMS[0]} title="Diminuir">
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => mudarZoom(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} title="Aumentar">
              <Plus className="h-4 w-4" />
            </Button>
            {url && (
              <>
                <Button asChild variant="outline" size="sm" className="ml-2 h-8 gap-1.5">
                  <a href={`${url}${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(arquivo?.nome || "arquivo.pdf")}`}><Download className="h-3.5 w-3.5" /> Baixar</a>
                </Button>
                <Button asChild variant="ghost" size="icon" className="h-8 w-8" title="Abrir em outra aba">
                  <a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                </Button>
              </>
            )}
          </div>
        </DialogHeader>

        <div ref={medir} className="flex-1 overflow-auto bg-muted/40 p-4">
          {erro ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <p>Não foi possível mostrar este PDF aqui.</p>
              <p className="text-xs">{erro}</p>
              {url && (
                <Button asChild variant="outline" size="sm">
                  <a href={url} target="_blank" rel="noopener noreferrer">Abrir em outra aba</a>
                </Button>
              )}
            </div>
          ) : !doc ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4" style={{ width: "max-content", minWidth: "100%" }}>
              {Array.from({ length: doc.numPages }, (_, i) => (
                <Pagina key={i} doc={doc} numero={i + 1} largura={Math.round(larguraBase * zoom)} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
