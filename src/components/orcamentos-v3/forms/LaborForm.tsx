// Mão-de-obra avulsa V3 — usa ProcessPicker do V2 (mesmo catálogo).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Check, Plus, Clock, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProcessPicker } from "@/components/orcamentos-v2/ProcessPicker";
import { useV3ProcessCatalog } from "../shared/useV3ProcessCatalog";
import { useV3HourlyRate } from "../shared/useV3HourlyRate";
import { fmtBRL } from "../shared/pricing";
import { genId, type V3LaborItem } from "../types";

interface Props {
  defaultMarginPct: number;
  onAdd: (item: V3LaborItem) => void;
}

interface Draft {
  descricao: string;
  time_minutes: number;
  step_type: V3LaborItem["step_type"];
}

export function LaborForm({ defaultMarginPct, onAdd }: Props) {
  const { steps, groups, loaded } = useV3ProcessCatalog();
  const { hourlyRate } = useV3HourlyRate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [margem, setMargem] = useState<number>(defaultMarginPct || 20);
  const [pulse, setPulse] = useState(false);

  const cost = draft ? (draft.time_minutes / 60) * hourlyRate : 0;
  const preco = cost * (1 + margem / 100);
  const canAdd = !!draft && draft.time_minutes > 0;

  const submit = () => {
    if (!draft || !canAdd) return;
    onAdd({
      id: genId(),
      kind: "labor",
      descricao: draft.descricao,
      time_minutes: draft.time_minutes,
      step_type: draft.step_type,
      hourly_rate: hourlyRate,
      margem_pct: margem,
    });
    setDraft(null);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Adicionar processo
        </Label>
        <div className="flex items-center gap-2">
          <ProcessPicker
            label="processo / acabamento"
            variant="outline"
            steps={steps}
            groups={groups}
            hourlyRate={hourlyRate}
            onPickStep={(s) =>
              setDraft({
                descricao: s.description,
                time_minutes: s.time_minutes,
                step_type: (s.step_type as V3LaborItem["step_type"]) || "outro",
              })
            }
            onPickGroup={(g) => {
              const total = g.items.reduce(
                (sum, it) => sum + (it.time_minutes || 0),
                0,
              );
              setDraft({
                descricao: `Grupo: ${g.name}`,
                time_minutes: total,
                step_type: "outro",
              });
            }}
            onPickCustom={(name, minutes) =>
              setDraft({
                descricao: name,
                time_minutes: minutes,
                step_type: "outro",
              })
            }
          />
          {!loaded && (
            <span className="text-[11px] text-muted-foreground">
              Carregando catálogo…
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Custo/hora atual: <span className="font-medium">{fmtBRL(hourlyRate)}/h</span>
        </p>
      </div>

      {draft && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-3 space-y-3">
          <div className="flex items-start gap-2">
            <div className="rounded bg-primary/10 p-1.5 text-primary shrink-0">
              <Wrench className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <Input
                value={draft.descricao}
                onChange={(e) =>
                  setDraft({ ...draft, descricao: e.target.value })
                }
                className="h-8 text-sm font-medium"
              />
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wide">
                Tipo: {draft.step_type}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              trocar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Tempo (minutos)
              </Label>
              <Input
                type="number"
                min={0}
                value={draft.time_minutes || ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    time_minutes: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                Margem ({margem.toFixed(0)}%)
              </Label>
              <Slider
                min={0}
                max={200}
                step={1}
                value={[margem]}
                onValueChange={(v) => setMargem(v[0] ?? 0)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
            <span className="text-muted-foreground">
              Custo {fmtBRL(cost)} · Margem {margem.toFixed(0)}%
            </span>
            <span className="text-sm font-semibold text-primary tabular-nums">
              {fmtBRL(preco)}
            </span>
          </div>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 mt-2 bg-background/95 backdrop-blur border-t border-border flex items-center justify-end gap-3">
        <Button
          onClick={submit}
          disabled={!canAdd}
          className={cn(
            "min-w-[200px] transition-colors",
            pulse && "bg-emerald-600 hover:bg-emerald-600",
          )}
        >
          {pulse ? (
            <>
              <Check className="h-4 w-4 mr-2" /> Adicionado!
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" /> Adicionar mão-de-obra
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
