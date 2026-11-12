// Cartão de um arquivo de arte (PDF, PNG, JPG, EPS) das ferramentas de Pré-impressão:
// ordem, tamanho lido e largura real para imagens sem DPI. O estado fica em useEntradasArte (./uteis).

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarCm, type DetalheArquivo } from "@/lib/preimpressao/folha";
import { numeroEntre, type Entrada } from "./uteis";

export function LinhaArquivo({
  entrada,
  detalhe,
  rotulo,
  primeiro,
  ultimo,
  onLargura,
  onRemover,
  onMover,
}: {
  entrada: Entrada;
  detalhe?: DetalheArquivo;
  rotulo: string;
  primeiro: boolean;
  ultimo: boolean;
  onLargura: (v: string) => void;
  onRemover: () => void;
  onMover: (delta: number) => void;
}) {
  const imagem = detalhe?.tipo === "png" || detalhe?.tipo === "jpg";
  const acao = "flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30";
  const larguraInvalida = entrada.larguraTxt.trim() !== "" && numeroEntre(entrada.larguraTxt, 0.5, 5000) === null;
  return (
    <li className="rounded-2xl bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-foreground/80 px-2 text-[11px] font-semibold text-background">{rotulo}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={entrada.nome}>{entrada.nome}</p>
          {detalhe && !detalhe.erro && (
            <p className="text-xs text-muted-foreground">
              {detalhe.tipo === "eps" ? "EPS · " : detalhe.tipo === "pdf" ? "" : `${detalhe.tipo.toUpperCase()} · `}
              {detalhe.w !== null && detalhe.h !== null ? `${formatarCm(detalhe.w, detalhe.h)} · ` : ""}
              {detalhe.paginas} {detalhe.paginas === 1 ? "página" : "páginas"}
              {imagem && detalhe.dpi ? ` · ${Math.round(detalhe.dpi)} dpi` : ""}
            </p>
          )}
          {!detalhe && <p className="text-xs text-muted-foreground">Lendo…</p>}
        </div>
        <button type="button" className={acao} disabled={primeiro} aria-label={`Subir ${entrada.nome}`} onClick={() => onMover(-1)}>
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={acao} disabled={ultimo} aria-label={`Descer ${entrada.nome}`} onClick={() => onMover(1)}>
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button type="button" className={acao} aria-label={`Remover ${entrada.nome}`} onClick={onRemover}>
          <X className="h-4 w-4" />
        </button>
      </div>
      {detalhe?.erro && <p className="mt-2 text-xs text-destructive">{detalhe.erro}</p>}
      {imagem && (
        <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {detalhe?.precisaLargura ? "Largura real da arte (cm)" : "Corrigir largura real (cm)"}
          <span
            className={cn(
              "flex h-8 items-center rounded-full bg-background px-3 ring-1 ring-transparent focus-within:ring-primary/40",
              (detalhe?.precisaLargura || larguraInvalida) && "ring-amber-500",
            )}
          >
            <input
              inputMode="decimal"
              aria-label={`Largura real de ${entrada.nome} em centímetros`}
              className="w-20 bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
              placeholder={detalhe?.dpiArquivo ? "do arquivo" : "ex.: 9,1"}
              value={entrada.larguraTxt}
              onChange={(e) => onLargura(e.target.value)}
            />
          </span>
          {detalhe?.precisaLargura && <span className="basis-full text-amber-700 dark:text-amber-400">Este arquivo não informa o tamanho. Digite a largura da arte, com a sangria.</span>}
        </label>
      )}
    </li>
  );
}
