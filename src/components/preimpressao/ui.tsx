// Peças de interface comuns das ferramentas de Pré-impressão (estilo Google/Apple:
// pílulas, botões redondos, rótulos discretos). Use nas próximas ferramentas.

import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Campo({ titulo, ajuda, children }: { titulo: string; ajuda?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      {children}
      {ajuda && <p className="mt-2 text-xs text-muted-foreground">{ajuda}</p>}
    </div>
  );
}

/** Controle segmentado no estilo iOS/Material: trilho cinza e opção escolhida em "pílula" branca. */
export function Segmentado<T extends string>({
  valor,
  opcoes,
  onChange,
}: {
  valor: T;
  opcoes: { valor: T; rotulo: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" className="flex rounded-full bg-muted/70 p-1">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.valor)}
            className={cn(
              "flex-1 rounded-full px-3 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              ativo ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

export function BotaoRedondo({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      {children}
    </button>
  );
}


/** Número com botões − / + e campo no meio (aceita vírgula). */
export function Passo({
  valor,
  onChange,
  passo = 1,
  min = 0,
  max = 1_000_000,
  sufixo,
  rotulo,
  invalido,
  largura = "w-16",
}: {
  valor: string;
  onChange: (v: string) => void;
  passo?: number;
  min?: number;
  max?: number;
  sufixo?: string;
  rotulo: string;
  invalido?: boolean;
  largura?: string;
}) {
  const mudar = (d: number) => {
    const atual = Number.parseFloat(valor.replace(",", "."));
    const base = Number.isFinite(atual) ? atual : min;
    const novo = Math.min(max, Math.max(min, Math.round((base + d) * 100) / 100));
    onChange(String(novo).replace(".", ","));
  };
  return (
    <div className="flex items-center gap-2">
      <BotaoRedondo rotulo={`Diminuir ${rotulo}`} onClick={() => mudar(-passo)}>
        <Minus className="h-4 w-4" />
      </BotaoRedondo>
      <div
        className={cn(
          "flex h-11 flex-1 items-center justify-center rounded-full bg-muted/60 px-3 ring-1 ring-transparent focus-within:ring-primary/40",
          invalido && "ring-destructive/60",
        )}
      >
        <input
          aria-label={rotulo}
          inputMode="decimal"
          className={cn("bg-transparent text-center text-base font-semibold tabular-nums outline-none", largura)}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        />
        {sufixo && <span className="text-sm text-muted-foreground">{sufixo}</span>}
      </div>
      <BotaoRedondo rotulo={`Aumentar ${rotulo}`} onClick={() => mudar(passo)}>
        <Plus className="h-4 w-4" />
      </BotaoRedondo>
    </div>
  );
}

/** Interruptor simples estilo iOS com texto. */
export function Chave({ ligado, onChange, children }: { ligado: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onChange(!ligado)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-muted/50 px-4 py-3 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span className="min-w-0">{children}</span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", ligado ? "bg-primary" : "bg-muted-foreground/30")}>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", ligado ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

/** Cartão branco arredondado das seções. */
export function Painel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-3xl border border-border/60 bg-card p-6 shadow-sm", className)}>{children}</section>;
}
