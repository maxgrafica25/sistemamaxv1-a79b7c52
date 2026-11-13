// Uma polaroid grande para colocar adesivos: clique ou arraste para mover o adesivo escolhido.

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Adesivo } from "@/lib/preimpressao/polaroid";
import { renderizarPaginaPdf } from "@/lib/preimpressao/navegador";

export function PolaroidPrevia({
  bytes,
  adesivos,
  selecionado,
  onMover,
  ocupado,
  nome,
}: {
  bytes: Uint8Array | null;
  adesivos: Adesivo[];
  selecionado: string | null;
  onMover: (id: string, p: { x: number; y: number }) => void;
  ocupado: boolean;
  nome: string;
}) {
  const [img, setImg] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bytes) return setImg(null);
    let vivo = true;
    renderizarPaginaPdf(bytes, 0, 900)
      .then((u) => vivo && setImg(u))
      .catch(() => vivo && setImg(null));
    return () => {
      vivo = false;
    };
  }, [bytes]);

  const colocar = (cx: number, cy: number) => {
    const r = caixa.current?.getBoundingClientRect();
    if (!r || !r.width || !selecionado) return;
    let x = ((cx - r.left) / r.width) * 100;
    const y = ((cy - r.top) / r.height) * 100;
    if (Math.abs(x - 50) < 2.5) x = 50;
    onMover(selecionado, { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  };

  return (
    <div className="rounded-2xl bg-muted/30 p-4">
      {img ? (
        <div
          ref={caixa}
          className={cn("relative mx-auto w-fit max-w-full touch-none select-none", selecionado ? (arrastando ? "cursor-grabbing" : "cursor-crosshair") : "")}
          onPointerDown={(e) => {
            if (!selecionado) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setArrastando(true);
            colocar(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => arrastando && colocar(e.clientX, e.clientY)}
          onPointerUp={() => setArrastando(false)}
          onPointerCancel={() => setArrastando(false)}
        >
          <img src={img} alt={`Polaroid de ${nome}`} draggable={false} className={cn("block max-h-[56vh] max-w-full rounded-sm bg-white shadow-md transition-opacity", ocupado && "opacity-60")} />
          {adesivos.map((a) => (
            <span
              key={a.id}
              className={cn("pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow", a.id === selecionado ? "h-3.5 w-3.5 bg-primary" : "h-2 w-2 bg-foreground/40")}
              style={{ left: `${a.x}%`, top: `${a.y}%` }}
            />
          ))}
        </div>
      ) : (
        <div className="flex aspect-[4/5] items-center justify-center text-sm text-muted-foreground">{ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : "A polaroid aparece aqui"}</div>
      )}
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {selecionado ? "O ponto roxo é o adesivo escolhido. Clique ou arraste para mudar de lugar. Vale para todas as polaroids." : "Escolha um adesivo à esquerda para colocá-lo aqui."}
      </p>
    </div>
  );
}
