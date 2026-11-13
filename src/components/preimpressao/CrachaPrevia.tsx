// Prévia do crachá: o cartão desenhado, com o elemento escolhido marcado por um ponto.
// Clique ou arraste para colocar o elemento onde quiser. Perto do meio ele gruda no centro.
// Sem `onMover` é só para olhar.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { dimensoes, zonaDoFuro, type Orientacao } from "@/lib/preimpressao/cracha";
import { renderizarPaginaPdf } from "@/lib/preimpressao/navegador";
import { BotaoRedondo } from "./ui";

export interface PontoCracha {
  chave: string;
  x: number;
  y: number;
}

export function CrachaPrevia({
  bytes,
  orientacao,
  pontos = [],
  selecionado,
  onMover,
  ocupado,
  nome,
  indice,
  total,
  onIndice,
  mostrarFuro,
  dica,
}: {
  bytes: Uint8Array | null;
  orientacao: Orientacao;
  pontos?: PontoCracha[];
  selecionado?: string;
  onMover?: (chave: string, p: { x: number; y: number }) => void;
  ocupado: boolean;
  nome: string;
  indice: number;
  total: number;
  onIndice: (i: number) => void;
  mostrarFuro: boolean;
  dica?: string;
}) {
  const [img, setImg] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const { w, h } = dimensoes(orientacao);
  const editavel = !!onMover && !!selecionado;

  useEffect(() => {
    if (!bytes) return setImg(null);
    let vivo = true;
    renderizarPaginaPdf(bytes, 0, 1000)
      .then((u) => vivo && setImg(u))
      .catch(() => vivo && setImg(null));
    return () => {
      vivo = false;
    };
  }, [bytes]);

  const colocar = (cx: number, cy: number) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r || !r.width || !onMover || !selecionado) return;
    let x = ((cx - r.left) / r.width) * 100;
    const y = ((cy - r.top) / r.height) * 100;
    if (Math.abs(x - 50) < 2.5) x = 50;
    onMover(selecionado, { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  };

  const furo = zonaDoFuro(orientacao);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-muted/30 p-4">
        {img ? (
          <div
            ref={caixa}
            className={cn("relative mx-auto w-fit max-w-full touch-none select-none", editavel && (arrastando ? "cursor-grabbing" : "cursor-crosshair"))}
            onPointerDown={(e) => {
              if (!editavel) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              setArrastando(true);
              colocar(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => arrastando && colocar(e.clientX, e.clientY)}
            onPointerUp={() => setArrastando(false)}
            onPointerCancel={() => setArrastando(false)}
          >
            <img src={img} alt={`Crachá de ${nome}`} draggable={false} className={cn("block max-h-[52vh] max-w-full rounded-lg bg-white shadow-md transition-opacity", ocupado && "opacity-60")} />
            {mostrarFuro && (
              <div
                className="pointer-events-none absolute rounded-lg border-2 border-dashed border-rose-400 bg-rose-400/15"
                style={{ left: `${(furo.x / w) * 100}%`, top: `${(furo.y / h) * 100}%`, width: `${(furo.w / w) * 100}%`, height: `${(furo.h / h) * 100}%` }}
                title="Região do furo do cordão: evite texto aqui"
              />
            )}
            {editavel &&
              pontos.map((p) => (
                <span
                  key={p.chave}
                  data-elemento={p.chave}
                  className={cn("pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow", p.chave === selecionado ? "h-4 w-4 bg-primary" : "h-2.5 w-2.5 bg-foreground/50")}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                />
              ))}
          </div>
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center text-sm text-muted-foreground">{ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : "A pré-visualização aparece aqui"}</div>
        )}
        {(dica || editavel) && <p className="mt-3 text-center text-xs text-muted-foreground">{dica ?? "O ponto roxo é o elemento escolhido. Clique ou arraste para mudar de lugar."}</p>}
      </div>
      {total > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <BotaoRedondo rotulo="Pessoa anterior" onClick={() => onIndice(Math.max(0, indice - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </BotaoRedondo>
          <span className="min-w-[12rem] truncate text-center tabular-nums text-muted-foreground">
            <span className="font-medium text-foreground">{nome || "Sem nome"}</span> · {indice + 1} de {total}
          </span>
          <BotaoRedondo rotulo="Próxima pessoa" onClick={() => onIndice(Math.min(total - 1, indice + 1))}>
            <ChevronRight className="h-4 w-4" />
          </BotaoRedondo>
        </div>
      )}
    </div>
  );
}
