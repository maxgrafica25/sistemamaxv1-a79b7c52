// Posição dos elementos da capa e da contracapa: escolher o elemento e arrastar na prévia
// (ou ajustar pelos botões). Tudo em % da página final, então vale em qualquer tamanho.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ELEMENTOS_CAPA, LAYOUT_CAPA_PADRAO, type ElementoCapa, type LayoutCapa, type PosicaoElemento } from "@/lib/preimpressao/agenda";
import { SANGRIA_PADRAO_MM } from "@/lib/preimpressao/folha";
import { renderizarPaginaPdf } from "@/lib/preimpressao/navegador";
import { BotaoRedondo, Campo, Passo } from "./ui";

const W = 148;
const H = 210;
const B = SANGRIA_PADRAO_MM;

export function PosicaoElementos({
  layout,
  pagina,
  selecionado,
  onSelecionar,
  onMudar,
}: {
  layout: LayoutCapa;
  pagina: 0 | 1;
  selecionado: ElementoCapa;
  onSelecionar: (e: ElementoCapa) => void;
  onMudar: (e: ElementoCapa, p: Partial<PosicaoElemento>) => void;
}) {
  const lista = ELEMENTOS_CAPA.filter((e) => e.pagina === pagina);
  const sel = layout[selecionado];
  const num = (v: string, atual: number, min: number, max: number) => {
    const n = Number.parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : atual;
  };
  return (
    <Campo titulo={pagina === 0 ? "Posição na capa" : "Posição na contracapa"} ajuda="Escolha o elemento e clique ou arraste na prévia ao lado. Perto do meio ele gruda no centro.">
      <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Elemento">
        {lista.map((e) => (
          <button
            key={e.chave}
            type="button"
            role="radio"
            aria-checked={selecionado === e.chave}
            onClick={() => onSelecionar(e.chave)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              selecionado === e.chave ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground",
            )}
          >
            {e.rotulo}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Da esquerda para a direita</p>
          <Passo valor={String(Math.round(sel.x))} onChange={(v) => onMudar(selecionado, { x: num(v, sel.x, 0, 100) })} passo={1} min={0} max={100} sufixo="%" rotulo="posição na horizontal" />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">De cima para baixo</p>
          <Passo valor={String(Math.round(sel.y))} onChange={(v) => onMudar(selecionado, { y: num(v, sel.y, 0, 100) })} passo={1} min={0} max={100} sufixo="%" rotulo="posição na vertical" />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Tamanho</p>
          <Passo valor={String(Math.round(sel.tam))} onChange={(v) => onMudar(selecionado, { tam: num(v, sel.tam, 30, 300) })} passo={5} min={30} max={300} sufixo="%" rotulo="tamanho" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" className="rounded-full" onClick={() => onMudar(selecionado, { x: 50 })}>
          Centralizar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full"
          onClick={() => lista.forEach((e) => onMudar(e.chave, { ...LAYOUT_CAPA_PADRAO[e.chave] }))}
        >
          Voltar ao padrão desta página
        </Button>
      </div>
    </Campo>
  );
}

/** Prévia da capa/contracapa: clique ou arraste para colocar o elemento escolhido onde você quiser. */
export function PreviaCapaEditavel({
  bytes,
  pagina,
  onPagina,
  layout,
  selecionado,
  onMover,
  ocupado,
}: {
  bytes: Uint8Array | null;
  pagina: 0 | 1;
  onPagina: (p: 0 | 1) => void;
  layout: LayoutCapa;
  selecionado: ElementoCapa;
  onMover: (e: ElementoCapa, p: { x: number; y: number }) => void;
  ocupado: boolean;
}) {
  const [img, setImg] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [gruda, setGruda] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bytes) {
      setImg(null);
      return;
    }
    let vivo = true;
    renderizarPaginaPdf(bytes, pagina, 1000)
      .then((u) => vivo && setImg(u))
      .catch(() => vivo && setImg(null));
    return () => {
      vivo = false;
    };
  }, [bytes, pagina]);

  /** Ponto do ponteiro → % da página final (a sangria fica fora dos 0–100). */
  const colocar = (clientX: number, clientY: number) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    const x = (((clientX - r.left) / r.width) * (W + 2 * B) - B) / W * 100;
    const y = (((clientY - r.top) / r.height) * (H + 2 * B) - B) / H * 100;
    const colado = Math.abs(x - 50) < 2.5;
    setGruda(colado);
    onMover(selecionado, { x: Math.min(100, Math.max(0, colado ? 50 : x)), y: Math.min(100, Math.max(0, y)) });
  };

  const pos = (e: { x: number; y: number }) => ({ left: `${((B + (W * e.x) / 100) / (W + 2 * B)) * 100}%`, top: `${((B + (H * e.y) / 100) / (H + 2 * B)) * 100}%` });
  const daPagina = ELEMENTOS_CAPA.filter((e) => e.pagina === pagina);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-muted/30 p-4">
        {img ? (
          <div
            ref={caixa}
            className={cn("relative mx-auto w-fit max-w-full touch-none select-none", arrastando ? "cursor-grabbing" : "cursor-crosshair")}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setArrastando(true);
              colocar(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => arrastando && colocar(e.clientX, e.clientY)}
            onPointerUp={() => {
              setArrastando(false);
              setGruda(false);
            }}
            onPointerCancel={() => setArrastando(false)}
          >
            <img src={img} alt={pagina === 0 ? "Capa" : "Contracapa"} draggable={false} className={cn("block max-h-[52vh] max-w-full rounded-sm bg-white shadow-sm transition-opacity", ocupado && "opacity-60")} />
            {arrastando && gruda && <div className="pointer-events-none absolute inset-y-0 border-l border-dashed border-sky-400" style={{ left: `${((B + W / 2) / (W + 2 * B)) * 100}%` }} />}
            {daPagina.map((e) => {
              const ativo = e.chave === selecionado;
              return (
                <span
                  key={e.chave}
                  data-elemento={e.chave}
                  className={cn(
                    "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow",
                    ativo ? "h-4 w-4 bg-primary" : "h-2.5 w-2.5 bg-foreground/50",
                  )}
                  style={pos(layout[e.chave])}
                />
              );
            })}
          </div>
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center text-sm text-muted-foreground">
            {ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : "A pré-visualização aparece aqui"}
          </div>
        )}
        <p className="mt-3 text-center text-xs text-muted-foreground">O ponto roxo é o elemento escolhido. Clique ou arraste para mudar de lugar.</p>
      </div>
      <div className="flex items-center justify-center gap-3 text-sm">
        <BotaoRedondo rotulo="Ver a capa" onClick={() => onPagina(0)}>
          <ChevronLeft className="h-4 w-4" />
        </BotaoRedondo>
        <span className="min-w-[9rem] text-center tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{pagina === 0 ? "Capa" : "Contracapa"}</span> · {pagina + 1} de 2
        </span>
        <BotaoRedondo rotulo="Ver a contracapa" onClick={() => onPagina(1)}>
          <ChevronRight className="h-4 w-4" />
        </BotaoRedondo>
      </div>
    </div>
  );
}
