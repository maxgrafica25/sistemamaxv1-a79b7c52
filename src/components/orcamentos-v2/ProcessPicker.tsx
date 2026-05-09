import { useMemo, useState } from "react";
import { Plus, Wand2, Clock, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ProcessStep = { id: string; description: string; time_minutes: number; step_type: string };
export type ProcessGroupItem = { description: string; time_minutes: number; step_type: string };
export type ProcessGroup = { id: string; name: string; items: ProcessGroupItem[] };

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  steps: ProcessStep[];
  groups: ProcessGroup[];
  hourlyRate: number;
  onPickStep: (s: ProcessStep) => void;
  onPickGroup: (g: ProcessGroup) => void;
  onPickCustom: (name: string, minutes: number) => void;
  label?: string;
  /** Visual variant. `dashed` = original chip; `outline` = button (used inside accordion). */
  variant?: "dashed" | "outline";
  /** Called right after the popover is opened (before user picks anything). Useful to expand a parent accordion. */
  onOpen?: () => void;
}

export function ProcessPicker({
  steps, groups, hourlyRate, onPickStep, onPickGroup, onPickCustom,
  label = "processo", variant = "dashed", onOpen,
}: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const reset = () => { setCustomMode(false); setQ(""); };
  const fSteps = useMemo(() => {
    const s = q.toLowerCase();
    return steps.filter((x) => x.description.toLowerCase().includes(s)).slice(0, 30);
  }, [q, steps]);
  const fGroups = useMemo(() => {
    const s = q.toLowerCase();
    return groups.filter((x) => x.name.toLowerCase().includes(s)).slice(0, 30);
  }, [q, groups]);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) onOpen?.();
        if (!o) reset();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 shrink-0 transition-colors",
            variant === "dashed"
              ? "px-2 py-1 rounded border border-dashed text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground"
              : "h-8 px-3 rounded-md border border-border text-xs font-medium text-foreground hover:bg-accent hover:text-accent-foreground",
          )}
          title="Adicionar acabamento / processo"
        >
          <Plus className={variant === "dashed" ? "h-3 w-3" : "h-3.5 w-3.5"} /> {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        {customMode ? (
          <CustomFinishForm
            hourlyRate={hourlyRate}
            onSubmit={(name, minutes) => { onPickCustom(name, minutes); setOpen(false); reset(); }}
            onCancel={reset}
          />
        ) : (
          <>
            <Input
              autoFocus
              placeholder="Buscar processo ou grupo…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 text-sm mb-2"
            />
            <button
              type="button"
              onClick={() => setCustomMode(true)}
              className="flex w-full items-center gap-2 rounded-sm border border-dashed border-primary/40 bg-primary/5 px-2 py-1.5 text-left text-sm text-primary hover:bg-primary/10 mb-2"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span className="font-medium">Adicionar acabamento avulso</span>
            </button>
            <div className="max-h-64 overflow-auto">
              {fSteps.length === 0 && fGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">
                  Nenhum processo cadastrado encontrado. Use "Acabamento avulso" acima.
                </p>
              ) : (
                <>
                  {fSteps.length > 0 && (
                    <>
                      <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Processos individuais
                      </div>
                      {fSteps.map((s) => (
                        <button key={s.id} type="button"
                          onClick={() => { onPickStep(s); setOpen(false); reset(); }}
                          className="w-full px-2 py-1.5 text-left hover:bg-accent text-sm flex items-center justify-between gap-2 rounded">
                          <span className="truncate">{s.description}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0 inline-flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />{s.time_minutes} min
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                  {fGroups.length > 0 && (
                    <>
                      <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Grupos de processos
                      </div>
                      {fGroups.map((g) => (
                        <button key={g.id} type="button"
                          onClick={() => { onPickGroup(g); setOpen(false); reset(); }}
                          className="w-full px-2 py-1.5 text-left hover:bg-accent text-sm flex items-center justify-between gap-2 rounded">
                          <span className="truncate inline-flex items-center gap-1.5">
                            <Layers className="h-3 w-3" />{g.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {g.items.length} etapas
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function CustomFinishForm({
  hourlyRate, onSubmit, onCancel,
}: {
  hourlyRate: number;
  onSubmit: (name: string, minutes: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const mins = parseFloat(minutes) || 0;
  const valid = name.trim() && mins > 0;
  const cost = (mins / 60) * (hourlyRate || 0);
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
        <Wand2 className="h-3.5 w-3.5 text-primary" /> Acabamento avulso
      </div>
      <Input autoFocus placeholder="Nome (ex: Corte especial)" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
      <Input type="number" inputMode="decimal" step="1" min="0" placeholder="Tempo (min)" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="h-8 text-sm" />
      <p className="text-[10px] text-muted-foreground">
        ≈ {fmt(cost)} <span className="opacity-70">(custo/hora {fmt(hourlyRate || 0)}/h)</span>
      </p>
      <p className="text-[10px] text-muted-foreground">Válido apenas neste orçamento. Não será salvo no cadastro.</p>
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" className="h-7 text-xs" disabled={!valid}
          onClick={() => onSubmit(name.trim(), mins)}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}
