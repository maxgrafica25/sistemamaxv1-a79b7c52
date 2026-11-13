// Ajuste da foto de uma pessoa dentro da moldura do crachá: arrastar para mover, botões − / + para o zoom.

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { aspectoDaFoto, retanguloDeCorte, type AjusteFoto, type FormaFoto, type FotoCarregada } from "@/lib/preimpressao/cracha";
import { Passo } from "./ui";

const LARG = 260;

export function CrachaFotoAjuste({
  aberto,
  nome,
  foto,
  forma,
  aspecto: aspectoPedido,
  guiaRosto,
  ajuste,
  onFechar,
  onSalvar,
}: {
  aberto: boolean;
  nome: string;
  foto: (FotoCarregada & { tipo?: string }) | null;
  forma: FormaFoto;
  /** Proporção da moldura (largura ÷ altura); se faltar, vem da forma. */
  aspecto?: number;
  /** Mostra um oval de apoio para centralizar o rosto (fotos de documento). */
  guiaRosto?: boolean;
  ajuste: AjusteFoto;
  onFechar: () => void;
  onSalvar: (a: AjusteFoto) => void;
}) {
  const [a, setA] = useState<AjusteFoto>(ajuste);
  const [url, setUrl] = useState<string | null>(null);
  const arrasto = useRef<{ x: number; y: number; ax: number; ay: number } | null>(null);

  useEffect(() => {
    if (aberto) setA(ajuste);
  }, [aberto, ajuste]);

  useEffect(() => {
    if (!foto) return setUrl(null);
    const u = URL.createObjectURL(new Blob([foto.bytes], { type: foto.tipo || "image/jpeg" }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [foto]);

  const aspecto = aspectoPedido ?? aspectoDaFoto(forma);
  const altura = Math.round(LARG / aspecto);
  const geo = useMemo(() => {
    if (!foto) return null;
    const r = retanguloDeCorte(foto.w, foto.h, aspecto, a);
    const esc = LARG / r.sw;
    return { r, esc, folgaX: ((foto.w - r.sw) / 2) * esc, folgaY: ((foto.h - r.sh) / 2) * esc };
  }, [foto, aspecto, a]);

  const raio = forma === "circulo" ? "9999px" : forma === "arredondado" ? "14%" : "0";

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle>Ajustar a foto</DialogTitle>
          <DialogDescription>{nome}. Arraste a foto para centralizar o rosto e use + para aproximar.{guiaRosto ? " O rosto deve ficar dentro do oval." : ""}</DialogDescription>
        </DialogHeader>
        {foto && url && geo && (
          <div className="space-y-4">
            <div
              className="mx-auto touch-none select-none overflow-hidden bg-muted ring-1 ring-border"
              style={{
                width: LARG,
                height: altura,
                borderRadius: raio,
                backgroundImage: `url(${url})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${foto.w * geo.esc}px ${foto.h * geo.esc}px`,
                backgroundPosition: `${-geo.r.sx * geo.esc}px ${-geo.r.sy * geo.esc}px`,
                cursor: arrasto.current ? "grabbing" : "grab",
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                arrasto.current = { x: e.clientX, y: e.clientY, ax: a.x, ay: a.y };
              }}
              onPointerMove={(e) => {
                const s = arrasto.current;
                if (!s) return;
                const dx = e.clientX - s.x;
                const dy = e.clientY - s.y;
                // arrastar a foto para a direita mostra mais da esquerda: o deslocamento anda ao contrário
                const nx = geo.folgaX > 0.5 ? s.ax - dx / geo.folgaX : s.ax;
                const ny = geo.folgaY > 0.5 ? s.ay - dy / geo.folgaY : s.ay;
                setA((p) => ({ ...p, x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) }));
              }}
              onPointerUp={() => (arrasto.current = null)}
              onPointerCancel={() => (arrasto.current = null)}
            >
              {guiaRosto && (
                <div className="pointer-events-none relative h-full w-full">
                  <div className="absolute left-1/2 top-[10%] h-[62%] w-[50%] -translate-x-1/2 rounded-[50%] border-2 border-dashed border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
                  <div className="absolute bottom-[8%] left-[14%] right-[14%] h-[14%] rounded-t-[60%] border-2 border-b-0 border-dashed border-white/80" />
                </div>
              )}
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Aproximar</p>
              <Passo
                valor={String(Math.round(a.zoom * 100))}
                onChange={(v) => {
                  const n = Number.parseFloat(v.replace(",", "."));
                  if (Number.isFinite(n)) setA((p) => ({ ...p, zoom: Math.min(4, Math.max(1, n / 100)) }));
                }}
                passo={10}
                min={100}
                max={400}
                sufixo="%"
                rotulo="zoom"
              />
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" className="rounded-full" onClick={() => setA({ zoom: 1, x: 0, y: 0 })}>
                Centralizar
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" className="rounded-full" onClick={onFechar}>
                  Cancelar
                </Button>
                <Button className="rounded-full" onClick={() => onSalvar(a)}>
                  Pronto
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
