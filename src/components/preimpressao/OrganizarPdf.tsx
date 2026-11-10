// Pré-impressão → ferramenta "Organizar PDF".
// Junta PDFs e imagens, mostra todas as páginas em miniatura para arrastar,
// girar ou remover, e baixa tudo em um PDF ou uma página por arquivo. No navegador.

import { useCallback, useRef, useState } from "react";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, ChevronRight, Download, FileArchive, FileX2, Loader2, RotateCw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LIMITE_PAGINAS, abrirFonte, montarPdf, nomeDaPagina, paginaEmBranco, tamanhoComGiro, type Fonte, type Giro, type Tinta } from "@/lib/preimpressao/organizar";
import { baixarBlob, baixarZip, converterEps, medirTintaDoPdf, miniaturaImagem, miniaturasDoPdf } from "@/lib/preimpressao/navegador";
import { Chave, NotaPrivacidade } from "./ui";

interface Cartao {
  /** Identidade do cartão na tela (a mesma página pode ser enviada duas vezes). */
  id: string;
  fonte: string;
  pagina: number;
  giro: Giro;
}

let seq = 0;
const novoId = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;
const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default function OrganizarPdf() {
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [erros, setErros] = useState<string[]>([]);
  const [abrindo, setAbrindo] = useState(false);
  const [salvando, setSalvando] = useState<"pdf" | "zip" | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Páginas em branco: medida de cada página (guardada por arquivo/página) e o resultado da busca
  const tintas = useRef(new Map<string, Tinta>());
  const [procurando, setProcurando] = useState<{ pagina: number; total: number } | null>(null);
  /** null = ainda não procurou; senão, ids dos cartões marcados como "em branco" (editável). */
  const [brancas, setBrancas] = useState<Set<string> | null>(null);
  const [ignorarFaixas, setIgnorarFaixas] = useState(false);
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const adicionar = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setAbrindo(true);
    const novosErros: string[] = [];
    for (const f of files) {
      try {
        const fonte = await abrirFonte(novoId("f"), f.name, new Uint8Array(await f.arrayBuffer()), converterEps);
        setFontes((prev) => [...prev, fonte]);
        setCartoes((prev) => [...prev, ...fonte.paginas.map((_, i) => ({ id: novoId("c"), fonte: fonte.id, pagina: i, giro: 0 as Giro }))]);
        // miniaturas em segundo plano
        const chave = (i: number) => `${fonte.id}:${i}`;
        if (fonte.tipo === "pdf") {
          void miniaturasDoPdf(fonte.bytes, 220, (i, url) => setThumbs((t) => ({ ...t, [chave(i)]: url }))).catch(() => undefined);
        } else if (fonte.info) {
          void miniaturaImagem(f, fonte.info.larguraPx, fonte.info.alturaPx)
            .then((url) => setThumbs((t) => ({ ...t, [chave(0)]: url })))
            .catch(() => undefined);
        }
      } catch (e) {
        novosErros.push(`${f.name}: ${e instanceof Error ? e.message : "não consegui abrir."}`);
      }
    }
    setErros(novosErros);
    setAbrindo(false);
  }, []);

  const marcarBrancas = useCallback(
    (lista: Cartao[], ignorar: boolean) => {
      const novas = new Set<string>();
      for (const c of lista) {
        const t = tintas.current.get(`${c.fonte}:${c.pagina}`);
        if (t && paginaEmBranco(t, ignorar)) novas.add(c.id);
      }
      setBrancas(novas);
    },
    [],
  );

  const procurarBrancas = async () => {
    setErros([]);
    try {
      const pdfs = fontes.filter((f) => f.tipo === "pdf" && cartoes.some((c) => c.fonte === f.id));
      let feitas = 0;
      const total = pdfs.reduce((n, f) => n + f.paginas.length, 0);
      setProcurando({ pagina: 0, total });
      for (const f of pdfs) {
        if (f.paginas.every((_, i) => tintas.current.has(`${f.id}:${i}`))) {
          feitas += f.paginas.length;
          continue;
        }
        const base = feitas;
        const medidas = await medirTintaDoPdf(f.bytes, (p) => setProcurando({ pagina: base + p, total }));
        medidas.forEach((t, i) => tintas.current.set(`${f.id}:${i}`, t));
        feitas += f.paginas.length;
      }
      marcarBrancas(cartoes, ignorarFaixas);
    } catch (e) {
      setErros([e instanceof Error ? e.message : "Não consegui conferir as páginas."]);
    } finally {
      setProcurando(null);
    }
  };

  const mudarIgnorarFaixas = (v: boolean) => {
    setIgnorarFaixas(v);
    if (brancas) marcarBrancas(cartoes, v);
  };

  const manterPagina = (id: string) =>
    setBrancas((b) => {
      if (!b) return b;
      const n = new Set(b);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const removerBrancas = () => {
    if (!brancas) return;
    setCartoes((c) => c.filter((x) => !brancas.has(x.id)));
    setBrancas(null);
  };

  const mover = (de: number, para: number) => setCartoes((c) => (para < 0 || para >= c.length ? c : arrayMove(c, de, para)));
  const girar = (id: string) => setCartoes((c) => c.map((x) => (x.id === id ? { ...x, giro: ((x.giro + 90) % 360) as Giro } : x)));
  const remover = (id: string) => setCartoes((c) => c.filter((x) => x.id !== id));
  const girarTodas = () => setCartoes((c) => c.map((x) => ({ ...x, giro: ((x.giro + 90) % 360) as Giro })));
  const limpar = () => {
    setFontes([]);
    setCartoes([]);
    setThumbs({});
    setErros([]);
    tintas.current.clear();
    setBrancas(null);
  };

  const aoSoltar = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setCartoes((c) => arrayMove(c, c.findIndex((x) => x.id === e.active.id), c.findIndex((x) => x.id === e.over!.id)));
  };

  const nomeBase = () => {
    const usadas = new Set(cartoes.map((c) => c.fonte));
    const unica = usadas.size === 1 ? fontes.find((f) => usadas.has(f.id)) : null;
    return unica ? unica.nome.replace(/\.[^.]+$/, "") + "_organizado" : "pdf_organizado";
  };

  const salvar = async (modo: "pdf" | "zip") => {
    setSalvando(modo);
    setErros([]);
    try {
      await new Promise((r) => setTimeout(r, 30));
      if (modo === "pdf") {
        const bytes = await montarPdf(fontes, cartoes);
        baixarBlob(new Blob([bytes], { type: "application/pdf" }), `${nomeBase()}.pdf`);
      } else {
        const arquivos: { nome: string; blob: Blob }[] = [];
        for (let i = 0; i < cartoes.length; i++) {
          const bytes = await montarPdf(fontes, [cartoes[i]]);
          arquivos.push({ nome: nomeDaPagina(`${nomeBase()}.pdf`, i, cartoes.length), blob: new Blob([bytes], { type: "application/pdf" }) });
        }
        await baixarZip(arquivos, `${nomeBase()}_paginas.zip`);
      }
    } catch (e) {
      setErros([e instanceof Error ? e.message : "Erro ao salvar."]);
    } finally {
      setSalvando(null);
    }
  };

  const vazio = cartoes.length === 0;
  const demais = cartoes.length > LIMITE_PAGINAS;

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
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
          {abrindo ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <Upload className={cn("text-primary", vazio ? "h-6 w-6" : "h-4 w-4")} />}
        </div>
        <p className={cn("mt-3 font-semibold tracking-tight", vazio ? "text-xl" : "text-base")}>{vazio ? "Solte aqui os PDFs e as imagens" : "Solte mais arquivos aqui"}</p>
        <p className="mt-1 text-sm text-muted-foreground">PDF, PNG, JPG ou EPS. Vários de uma vez: entram na ordem em que você soltar.</p>
        <Button type="button" className="mt-4 rounded-full px-6" onClick={() => inputRef.current?.click()}>
          Escolher arquivos
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.eps,.cdr,application/pdf,image/png,image/jpeg,application/postscript"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void adicionar(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
        {vazio && (
          <div className="mx-auto mt-8 max-w-md space-y-1 text-xs text-muted-foreground">
            <p>Depois é só arrastar as páginas para mudar a ordem, girar ou tirar as que não quer.</p>
            <NotaPrivacidade />
          </div>
        )}
      </div>

      {erros.map((e) => (
        <p key={e} className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">{e}</p>
      ))}

      {!vazio && (
        <>
          <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-background/90 px-1 py-2 backdrop-blur">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{cartoes.length}</span> {cartoes.length === 1 ? "página" : "páginas"} · arraste para mudar a ordem
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" className="rounded-full" onClick={limpar}>
                Limpar
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full" disabled={!!procurando} onClick={() => void procurarBrancas()}>
                {procurando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileX2 className="h-4 w-4" />}
                {procurando ? `Conferindo ${procurando.pagina}/${procurando.total}` : "Achar páginas em branco"}
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={girarTodas}>
                <RotateCw className="h-4 w-4" /> Girar todas
              </Button>
              <Button size="sm" variant="outline" className="rounded-full" disabled={!!salvando || demais || cartoes.length < 2} onClick={() => void salvar("zip")}>
                {salvando === "zip" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                Separar: uma por arquivo (.zip)
              </Button>
              <Button size="sm" className="rounded-full" disabled={!!salvando || demais} onClick={() => void salvar("pdf")}>
                {salvando === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Baixar em um PDF
              </Button>
            </div>
          </div>
          {demais && <p className="text-sm text-destructive">São {cartoes.length} páginas: o máximo é {LIMITE_PAGINAS}. Remova algumas.</p>}

          {brancas && (
            <div className="space-y-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/30">
              {brancas.size > 0 ? (
                <>
                  <p className="text-sm">
                    <span className="font-semibold">
                      Achei {brancas.size} {brancas.size === 1 ? "página em branco" : "páginas em branco"}:
                    </span>{" "}
                    <span className="tabular-nums text-muted-foreground">
                      {cartoes.flatMap((c, i) => (brancas.has(c.id) ? [i + 1] : [])).join(", ")}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">Elas estão marcadas abaixo. Clique em "Em branco" no cartão para manter uma página.</p>
                </>
              ) : (
                <p className="text-sm font-medium">Nenhuma página em branco. Está tudo certo.</p>
              )}
              <Chave ligado={ignorarFaixas} onChange={mudarIgnorarFaixas}>
                <span className="font-medium">Ignorar cabeçalho e rodapé</span>
                <span className="block text-xs text-muted-foreground">Páginas só com número ou título no alto ou embaixo contam como em branco.</span>
              </Chave>
              <div className="flex flex-wrap gap-2">
                {brancas.size > 0 && (
                  <Button size="sm" className="rounded-full" onClick={removerBrancas}>
                    Remover {brancas.size === 1 ? "a página" : `as ${brancas.size} páginas`}
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setBrancas(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}

          <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
            <SortableContext items={cartoes.map((c) => c.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {cartoes.map((c, i) => {
                  const f = fontes.find((x) => x.id === c.fonte);
                  if (!f) return null;
                  return (
                    <CartaoPagina
                      key={c.id}
                      cartao={c}
                      numero={i + 1}
                      fonte={f}
                      thumb={thumbs[`${c.fonte}:${c.pagina}`]}
                      emBranco={brancas?.has(c.id) ?? false}
                      onManter={() => manterPagina(c.id)}
                      primeiro={i === 0}
                      ultimo={i === cartoes.length - 1}
                      onGirar={() => girar(c.id)}
                      onRemover={() => remover(c.id)}
                      onMover={(d) => mover(i, i + d)}
                    />
                  );
                })}
              </ul>
            </SortableContext>
          </DndContext>
          <NotaPrivacidade className="pt-2" />
        </>
      )}
    </div>
  );
}

function CartaoPagina({
  cartao,
  numero,
  fonte,
  thumb,
  emBranco,
  onManter,
  primeiro,
  ultimo,
  onGirar,
  onRemover,
  onMover,
}: {
  cartao: Cartao;
  numero: number;
  fonte: Fonte;
  thumb?: string;
  emBranco: boolean;
  onManter: () => void;
  primeiro: boolean;
  ultimo: boolean;
  onGirar: () => void;
  onRemover: () => void;
  onMover: (delta: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cartao.id });
  const t = tamanhoComGiro(fonte.paginas[cartao.pagina], cartao.giro);
  const acao = "flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30";
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-2 shadow-sm",
        emBranco && "border-amber-400 ring-2 ring-amber-300",
        isDragging && "z-20 opacity-80 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        aria-label={`Página ${numero}: arraste para mudar a ordem`}
        className="relative flex aspect-square cursor-grab touch-none items-center justify-center overflow-hidden rounded-xl bg-muted/40 active:cursor-grabbing"
      >
        {thumb ? (
          <img
            src={thumb}
            alt=""
            draggable={false}
            className="max-h-[88%] max-w-[88%] bg-white shadow-sm transition-transform duration-200"
            style={{ transform: `rotate(${cartao.giro}deg)` }}
          />
        ) : (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-foreground/80 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-background">{numero}</span>
        {emBranco && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onManter}
            title="Clique para manter esta página"
            className="absolute bottom-1.5 left-1.5 right-1.5 rounded-full bg-amber-500 px-2 py-1 text-[11px] font-semibold text-white shadow hover:bg-amber-600"
          >
            Em branco · manter?
          </button>
        )}
      </div>
      <p className="mt-2 truncate px-1 text-xs font-medium" title={fonte.nome}>
        {fonte.nome}
        {fonte.paginas.length > 1 && <span className="text-muted-foreground"> · p. {cartao.pagina + 1}</span>}
      </p>
      <p className="px-1 text-[11px] tabular-nums text-muted-foreground">
        {fmt(t.w)} × {fmt(t.h)} cm
      </p>
      <div className="mt-1 flex items-center justify-between">
        <div className="flex">
          <button type="button" className={acao} disabled={primeiro} aria-label={`Mover a página ${numero} para antes`} onClick={() => onMover(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className={acao} disabled={ultimo} aria-label={`Mover a página ${numero} para depois`} onClick={() => onMover(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex">
          <button type="button" className={acao} aria-label={`Girar a página ${numero}`} title="Girar" onClick={onGirar}>
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={acao} aria-label={`Remover a página ${numero}`} title="Remover" onClick={onRemover}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
