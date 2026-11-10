// Peças de interface comuns das ferramentas de Pré-impressão (estilo Google/Apple:
// pílulas, botões redondos, rótulos discretos). Use nas próximas ferramentas.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, FileText, Loader2, Lock, Minus, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FOLHAS_PADRAO } from "@/lib/preimpressao/folha";
import { renderizarPaginaPdf } from "@/lib/preimpressao/navegador";

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

/**
 * Layout padrão das ferramentas com pré-visualização: ajustes à esquerda, prévia +
 * resumo à direita. No computador as duas colunas ocupam a altura que sobra da tela,
 * cada uma com a sua barra de rolagem (rolar os ajustes não tira a prévia da tela).
 * No celular vira uma coluna só.
 */
export function DuasColunas({ esquerda, direita, rodape }: { esquerda: ReactNode; direita: ReactNode; rodape?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState(700);
  useEffect(() => {
    const medir = () => {
      const el = ref.current;
      if (!el) return;
      const topo = el.getBoundingClientRect().top;
      setAltura(Math.max(520, Math.round(window.innerHeight - Math.max(0, topo) - 16)));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);
  return (
    <div
      ref={ref}
      className="grid gap-6 lg:grid-cols-[minmax(320px,400px)_1fr] lg:grid-rows-[minmax(0,1fr)] lg:h-[var(--altura-ferramenta)]"
      style={{ ["--altura-ferramenta" as string]: `${altura}px` }}
    >
      <div className="min-h-0 space-y-6 lg:h-full lg:overflow-y-auto lg:pr-2 lg:pb-2 [scrollbar-gutter:stable]">{esquerda}</div>
      {/* Direita: o conteúdo rola e o rodapé (botão principal) fica sempre visível embaixo */}
      <div className="flex min-h-0 min-w-0 flex-col gap-4 lg:h-full">
        <div className="min-h-0 space-y-6 lg:flex-1 lg:overflow-y-auto lg:pb-1">{direita}</div>
        {rodape && <div className="sticky bottom-2 z-10 rounded-full bg-card/95 p-2 shadow-lg ring-1 ring-border/60 backdrop-blur lg:static lg:shadow-sm">{rodape}</div>}
      </div>
    </div>
  );
}

export function NotaPrivacidade({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center justify-center gap-1 text-xs text-muted-foreground", className)}>
      <Lock className="h-3 w-3 shrink-0" /> Tudo é feito aqui no seu computador. Nada é enviado para a internet.
    </p>
  );
}

/** Campo pequeno em pílula (número com vírgula ou texto), com erro ou dica embaixo. */
export function Mini({
  rotulo,
  valor,
  onChange,
  erro,
  ajuda,
  texto,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
  ajuda?: string;
  texto?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs text-muted-foreground">{rotulo}</span>
      <input
        inputMode={texto ? "text" : "decimal"}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 w-full rounded-full bg-muted/60 px-4 text-sm font-semibold tabular-nums outline-none ring-1 ring-transparent focus:ring-primary/40",
          erro && "ring-destructive/60",
        )}
      />
      {(erro || ajuda) && <span className={cn("mt-1 block text-[11px]", erro ? "text-destructive" : "text-muted-foreground")}>{erro ?? ajuda}</span>}
    </label>
  );
}

/** Item de resumo: rótulo pequeno + valor em destaque (usar dentro de <dl>). */
export function Dado({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="font-semibold tabular-nums">{valor}</dd>
    </div>
  );
}

/** Folhas de impressão da gráfica (A4, SRA3, Formatão) em pílulas. */
export function SeletorFolha({ valor, onChange }: { valor: string; onChange: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FOLHAS_PADRAO.map((f) => (
        <button
          key={f.key}
          type="button"
          aria-pressed={valor === f.key}
          onClick={() => onChange(f.key)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            valor === f.key ? "bg-foreground text-background" : "bg-muted/70 text-muted-foreground hover:text-foreground",
          )}
        >
          {f.rotulo}
          {f.detalhe && <span className="ml-1 text-xs opacity-70">{f.detalhe}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * Área compacta de soltar/escolher arquivo (uma linha). Com `arquivo` mostra o
 * nome e o detalhe e o botão vira "Trocar".
 */
export function SoltarArquivo({
  titulo,
  dica,
  arquivo,
  carregando,
  erro,
  aceita = ".pdf,application/pdf,.cdr",
  multiplo,
  onArquivos,
}: {
  titulo: string;
  dica?: string;
  arquivo?: { nome: string; detalhe?: string } | null;
  carregando?: boolean;
  erro?: string | null;
  aceita?: string;
  multiplo?: boolean;
  onArquivos: (files: File[]) => void;
}) {
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          onArquivos(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "flex items-center gap-3 rounded-2xl border-2 border-dashed p-4 transition-colors",
          arrastando ? "border-primary bg-primary/5" : "border-border/70 bg-muted/30",
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border/60">
          {carregando ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : arquivo ? (
            <FileText className="h-4 w-4 text-primary" />
          ) : (
            <Upload className="h-4 w-4 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={arquivo?.nome}>{arquivo ? arquivo.nome : titulo}</p>
          {(arquivo?.detalhe ?? dica) && <p className="text-xs text-muted-foreground">{arquivo ? arquivo.detalhe : dica}</p>}
        </div>
        <Button size="sm" variant={arquivo ? "ghost" : "default"} className="rounded-full" onClick={() => inputRef.current?.click()}>
          {arquivo ? "Trocar" : "Escolher"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={aceita}
          multiple={multiplo}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onArquivos(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>
      {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}
    </div>
  );
}

/**
 * Pré-visualização de um PDF gerado: desenha a página escolhida e, se houver mais
 * de uma, mostra as setas ‹ 1 / 2 ›. `rotulos` dá nome às páginas (ex.: "Frente", "Verso").
 */
export function PreviaPdf({
  bytes,
  paginas,
  rotulos,
  vazio = "A pré-visualização aparece aqui",
  ocupado,
}: {
  bytes: Uint8Array | null;
  paginas: number;
  rotulos?: (i: number) => string;
  vazio?: string;
  ocupado?: boolean;
}) {
  const [pagina, setPagina] = useState(0);
  const [img, setImg] = useState<string | null>(null);
  const [desenhando, setDesenhando] = useState(false);
  const atual = Math.min(pagina, Math.max(0, paginas - 1));

  useEffect(() => {
    if (!bytes) {
      setImg(null);
      return;
    }
    let vivo = true;
    setDesenhando(true);
    renderizarPaginaPdf(bytes, atual, 1400)
      .then((u) => vivo && setImg(u))
      .catch(() => vivo && setImg(null))
      .finally(() => vivo && setDesenhando(false));
    return () => {
      vivo = false;
    };
  }, [bytes, atual]);

  if (!bytes || !img) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-muted/30 text-sm text-muted-foreground">
        {ocupado || desenhando ? <Loader2 className="h-5 w-5 animate-spin" /> : vazio}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-muted/30 p-4">
        <img
          src={img}
          alt="Pré-visualização da folha"
          className={cn("mx-auto max-h-[46vh] max-w-full rounded-md bg-white shadow-sm transition-opacity", (ocupado || desenhando) && "opacity-50")}
        />
      </div>
      {paginas > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <BotaoRedondo rotulo="Página anterior" onClick={() => setPagina(Math.max(0, atual - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </BotaoRedondo>
          <span className="min-w-[9rem] text-center tabular-nums text-muted-foreground">
            {rotulos ? <span className="font-medium text-foreground">{rotulos(atual)} · </span> : null}
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

/**
 * Escolha de cor em bolinhas: as cores da gráfica (já com a tinta CMYK certa) e
 * "Outra cor" para qualquer cor. Mostra a tinta que vai para a impressão.
 */
export function SeletorCor({
  valor,
  sugestoes,
  onChange,
  tinta,
}: {
  valor: string;
  sugestoes: { nome: string; hex: string }[];
  onChange: (hex: string) => void;
  /** Texto com a tinta, ex.: "C 0 · M 100 · Y 100 · K 0". */
  tinta?: string;
}) {
  const ehSugestao = sugestoes.some((c) => c.hex === valor);
  const atual = sugestoes.find((c) => c.hex === valor)?.nome ?? "Cor personalizada";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Cor do número">
        {sugestoes.map((c) => (
          <button
            key={c.hex}
            type="button"
            role="radio"
            aria-checked={valor === c.hex}
            aria-label={c.nome}
            title={c.nome}
            onClick={() => onChange(c.hex)}
            className={cn(
              "h-9 w-9 rounded-full ring-offset-2 ring-offset-card transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              valor === c.hex ? "ring-2 ring-primary" : "ring-1 ring-border hover:ring-2 hover:ring-primary/40",
            )}
            style={{ background: c.hex }}
          />
        ))}
        <label
          title="Outra cor"
          className={cn(
            "relative flex h-9 cursor-pointer items-center gap-2 rounded-full bg-muted/70 pl-1 pr-3 text-xs font-medium text-muted-foreground ring-offset-2 ring-offset-card transition-shadow focus-within:ring-2 focus-within:ring-primary/60 hover:text-foreground",
            !ehSugestao && "ring-2 ring-primary",
          )}
        >
          <span
            className="h-7 w-7 rounded-full ring-1 ring-border"
            style={{ background: ehSugestao ? "conic-gradient(#e30613, #ffd400, #009640, #0066b3, #8a2be2, #e30613)" : valor }}
          />
          Outra cor
          <input
            type="color"
            aria-label="Escolher outra cor"
            value={valor}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{atual}</span>
        {tinta ? ` · ${tinta}` : ""}
      </p>
    </div>
  );
}
