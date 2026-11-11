// Quadro de atendimentos: uma coluna por etapa, cartões arrastáveis entre colunas.
// A ordem dentro da coluna é a fila (quem espera há mais tempo em cima) — não se arrasta para cima/baixo.
import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CalendarClock, ClipboardList, FileText, Star, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ordenarFila, rotuloCanal, situacaoRetorno } from "@/lib/crm/fila";
import { nomeDoContato, type Atendimento, type Etapa } from "@/lib/crm/dados";
import { EtiquetaChip, RelogioEspera } from "./pecas";

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function ChipRetorno({ retornoEm, agora }: { retornoEm: string | null; agora: Date }) {
  const s = situacaoRetorno(retornoEm, agora);
  if (!s || !retornoEm) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        s === "atrasado" && "bg-rose-500/20 text-rose-700 dark:text-rose-300",
        s === "hoje" && "bg-amber-500/20 text-amber-700 dark:text-amber-300",
        s === "futuro" && "bg-muted text-muted-foreground",
      )}
      title="Retorno (follow-up) marcado"
    >
      <CalendarClock className="h-3 w-3" />
      {s === "atrasado" ? "Retorno atrasado · " : s === "hoje" ? "Retorno hoje · " : "Retorno "}
      {dataCurta(retornoEm)}
    </span>
  );
}

export function CartaoConteudo({ a, agora }: { a: Atendimento; agora: Date }) {
  return (
    <>
      <div className="flex items-start gap-1.5">
        {a.prioridade && <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-rose-500 text-rose-500" />}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{nomeDoContato(a)}</div>
          {a.titulo && <div className="truncate text-xs text-muted-foreground">{a.titulo}</div>}
        </div>
      </div>
      {(a.aguardando_desde || a.retorno_em) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          <RelogioEspera desde={a.aguardando_desde} agora={agora} />
          <ChipRetorno retornoEm={a.retorno_em} agora={agora} />
        </div>
      )}
      {a.etiquetas.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {a.etiquetas.map((e) => <EtiquetaChip key={e.id} etiqueta={e} />)}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>{rotuloCanal(a.canal)}</span>
        {a.pedido_numero && <span className="inline-flex items-center gap-0.5"><ClipboardList className="h-3 w-3" />{a.pedido_numero}</span>}
        {a.orcamento_numero && <span className="inline-flex items-center gap-0.5"><FileText className="h-3 w-3" />{a.orcamento_numero}</span>}
        {a.responsavel_nome && (
          <span className="ml-auto inline-flex min-w-0 items-center gap-0.5">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{a.responsavel_nome.split(" ")[0]}</span>
          </span>
        )}
      </div>
    </>
  );
}

const classeCartao = (a: Atendimento) =>
  cn(
    "rounded-lg border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md select-none",
    a.prioridade ? "border-rose-400/70 ring-1 ring-rose-400/40" : "border-border",
  );

function Cartao({ a, agora, onAbrir }: { a: Atendimento; agora: Date; onAbrir: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: a.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onAbrir}
      className={cn(classeCartao(a), "cursor-grab active:cursor-grabbing", isDragging && "opacity-40")}
    >
      <CartaoConteudo a={a} agora={agora} />
    </div>
  );
}

function Coluna({ etapa, itens, agora, onAbrir }: { etapa: Etapa; itens: Atendimento[]; agora: Date; onAbrir: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  const esperando = itens.filter((i) => i.aguardando_desde).length;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-xl border border-border bg-muted/30 p-2",
        isOver && "bg-primary/5 ring-2 ring-primary",
      )}
    >
      <div className="mb-2 flex items-center gap-2 border-b border-border px-1 pb-2 pt-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: etapa.cor }} />
        <span className="truncate text-sm font-semibold">{etapa.nome}</span>
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{itens.length}</span>
        {esperando > 0 && (
          <span className="ml-auto rounded-full bg-rose-500/15 px-1.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300" title="Aguardando resposta nossa">
            {esperando} esperando
          </span>
        )}
      </div>
      <div className="min-h-[80px] flex-1 space-y-2 overflow-y-auto pr-0.5">
        {itens.map((a) => <Cartao key={a.id} a={a} agora={agora} onAbrir={() => onAbrir(a.id)} />)}
        {itens.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">Arraste um cartão para cá</p>}
      </div>
    </div>
  );
}

export function AtendimentosKanban({
  etapas,
  atendimentos,
  agora,
  onMover,
  onAbrir,
}: {
  etapas: Etapa[];
  atendimentos: Atendimento[];
  agora: Date;
  onMover: (id: string, etapaId: string) => void;
  onAbrir: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [arrastando, setArrastando] = useState<string | null>(null);

  const porEtapa = useMemo(() => {
    const m = new Map<string, Atendimento[]>();
    for (const e of etapas) m.set(e.id, []);
    for (const a of atendimentos) m.get(a.etapa_id)?.push(a);
    for (const [k, v] of m) m.set(k, ordenarFila(v, agora));
    return m;
  }, [etapas, atendimentos, agora]);

  const aoSoltar = (e: DragEndEvent) => {
    setArrastando(null);
    const id = String(e.active.id);
    const etapaId = e.over ? String(e.over.id) : null;
    const a = atendimentos.find((x) => x.id === id);
    if (!etapaId || !a || a.etapa_id === etapaId) return;
    onMover(id, etapaId);
  };

  const emArraste = arrastando ? atendimentos.find((a) => a.id === arrastando) : null;

  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setArrastando(String(e.active.id))} onDragEnd={aoSoltar} onDragCancel={() => setArrastando(null)}>
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
        {etapas.map((et) => (
          <Coluna key={et.id} etapa={et} itens={porEtapa.get(et.id) ?? []} agora={agora} onAbrir={onAbrir} />
        ))}
      </div>
      <DragOverlay>
        {emArraste && (
          <div className={cn(classeCartao(emArraste), "w-[262px] rotate-2 shadow-xl")}>
            <CartaoConteudo a={emArraste} agora={agora} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
