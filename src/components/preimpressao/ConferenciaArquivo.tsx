// Pré-impressão → ferramenta "Conferência de arquivo".
// Solta o arquivo do cliente e o sistema aponta o que pode dar problema na
// impressão (tamanho, sangria, resolução, RGB, fontes). Não altera o arquivo.

import { useCallback, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, Upload, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { detectarTipo, lerInfoImagem } from "@/lib/preimpressao/margem";
import { analisarPdf, relatorioImagem, relatorioPdf, veredito, type Achado, type Nivel } from "@/lib/preimpressao/conferencia";
import { menorResolucaoDoPdf, miniaturaImagem, miniaturaPdf } from "@/lib/preimpressao/navegador";
import { NotaPrivacidade } from "./ui";

interface Item {
  id: string;
  nome: string;
  tipo: string;
  status: "lendo" | "pronto" | "erro";
  erro?: string;
  achados: Achado[];
  thumb?: string;
}

let seq = 0;

async function conferir(file: File): Promise<Pick<Item, "achados" | "tipo">> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipo = detectarTipo(bytes, file.name);
  if (tipo === "cdr") throw new Error("Arquivo do Corel (.cdr) não pode ser lido aqui. No CorelDRAW use Arquivo → Exportar… → PDF e envie o PDF.");
  if (tipo === "desconhecido") throw new Error("Formato não suportado. Envie PDF, PNG ou JPG.");
  if (tipo === "pdf") {
    const a = await analisarPdf(bytes);
    const ppi = a.imagens.length ? await menorResolucaoDoPdf(bytes).catch(() => null) : null;
    return { tipo, achados: relatorioPdf(a, ppi) };
  }
  return { tipo, achados: relatorioImagem(lerInfoImagem(bytes, tipo)) };
}

export default function ConferenciaArquivo() {
  const [items, setItems] = useState<Item[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const atualizar = (id: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const adicionar = useCallback(async (files: File[]) => {
    for (const file of files) {
      const id = `a${Date.now().toString(36)}${(seq++).toString(36)}`;
      setItems((prev) => [...prev, { id, nome: file.name, tipo: "", status: "lendo", achados: [] }]);
      try {
        const r = await conferir(file);
        atualizar(id, { ...r, status: "pronto" });
        // miniatura em segundo plano
        if (r.tipo === "pdf") {
          void file
            .arrayBuffer()
            .then((b) => miniaturaPdf(new Uint8Array(b)))
            .then((thumb) => atualizar(id, { thumb }))
            .catch(() => undefined);
        } else {
          const info = lerInfoImagem(new Uint8Array(await file.arrayBuffer()), r.tipo as "png" | "jpg");
          void miniaturaImagem(file, info.larguraPx, info.alturaPx)
            .then((thumb) => atualizar(id, { thumb }))
            .catch(() => undefined);
        }
      } catch (e) {
        atualizar(id, { status: "erro", erro: e instanceof Error ? e.message : "Não consegui ler o arquivo." });
      }
    }
  }, []);

  const vazio = items.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          void adicionar(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "rounded-3xl border-2 border-dashed text-center transition-all duration-200",
          vazio ? "px-6 py-16" : "px-6 py-5",
          arrastando ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/70 bg-muted/30 hover:bg-muted/50",
        )}
      >
        <div className={cn("mx-auto flex items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border/60", vazio ? "h-14 w-14" : "h-10 w-10")}>
          <Upload className={cn("text-primary", vazio ? "h-6 w-6" : "h-4 w-4")} />
        </div>
        <p className={cn("mt-3 font-semibold tracking-tight", vazio ? "text-xl" : "text-base")}>{vazio ? "Solte aqui o arquivo do cliente" : "Solte mais arquivos aqui"}</p>
        <p className="mt-1 text-sm text-muted-foreground">PDF, PNG ou JPG. O sistema só lê: o arquivo não é alterado.</p>
        <Button type="button" className="mt-4 rounded-full px-6" onClick={() => inputRef.current?.click()}>
          Escolher arquivos
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.cdr,application/pdf,image/png,image/jpeg"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void adicionar(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
        {vazio && (
          <div className="mx-auto mt-8 max-w-md space-y-1 text-xs text-muted-foreground">
            <p>Confere tamanho, sangria, resolução das imagens, cores em RGB e fontes.</p>
            <NotaPrivacidade />
          </div>
        )}
      </div>

      {!vazio && (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{items.length}</span> {items.length === 1 ? "arquivo conferido" : "arquivos conferidos"}
            </p>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setItems([])}>
              Limpar
            </Button>
          </div>
          <ul className="space-y-3">
            {items.map((it) => (
              <Relatorio key={it.id} item={it} onRemover={() => setItems((prev) => prev.filter((x) => x.id !== it.id))} />
            ))}
          </ul>
          <p className="px-1 text-xs text-muted-foreground">
            A conferência é automática e ajuda a pegar os problemas mais comuns; não substitui olhar a prova antes de imprimir.
          </p>
          <NotaPrivacidade />
        </>
      )}
    </div>
  );
}

const ESTILO: Record<Nivel, { icone: typeof Info; cor: string }> = {
  ok: { icone: CheckCircle2, cor: "text-emerald-600" },
  info: { icone: Info, cor: "text-muted-foreground" },
  atencao: { icone: AlertTriangle, cor: "text-amber-600" },
  problema: { icone: XCircle, cor: "text-destructive" },
};

function Relatorio({ item, onRemover }: { item: Item; onRemover: () => void }) {
  const v = item.status === "pronto" ? veredito(item.achados) : null;
  const corVeredito = v?.nivel === "ok" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : v?.nivel === "atencao" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" : "bg-destructive/10 text-destructive";
  return (
    <li className="flex flex-wrap gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:flex-nowrap">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/40 ring-1 ring-border/60">
        {item.thumb ? (
          <img src={item.thumb} alt="" className="max-h-full max-w-full object-contain" />
        ) : item.status === "lendo" ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">{item.tipo || "?"}</span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="max-w-full truncate text-sm font-semibold tracking-tight" title={item.nome}>{item.nome}</span>
          {item.status === "lendo" && <span className="text-xs text-muted-foreground">Conferindo…</span>}
          {v && <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", corVeredito)}>{v.texto}</span>}
          {item.status === "erro" && <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">Não foi possível conferir</span>}
        </div>
        {item.erro && <p className="text-sm text-destructive">{item.erro}</p>}
        {item.achados.length > 0 && (
          <ul className="space-y-2">
            {item.achados.map((a) => {
              const E = ESTILO[a.nivel];
              return (
                <li key={a.titulo} className="flex items-start gap-2 text-sm">
                  <E.icone className={cn("mt-0.5 h-4 w-4 shrink-0", E.cor)} />
                  <span>
                    <span className="font-medium">{a.titulo}</span>
                    {a.detalhe && <span className="block text-xs text-muted-foreground">{a.detalhe}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground" onClick={onRemover} aria-label={`Remover ${item.nome}`}>
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}
