import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Palette } from "lucide-react";
import type { ArtStatus } from "../types";
import { ART_LABEL } from "./artStatus";

interface Props {
  value: ArtStatus | null;
  onChange: (v: ArtStatus | null) => void;
  terceirizadaValue: number;
  onTerceirizadaValueChange: (v: number) => void;
}

const TIERS: { id: ArtStatus; label: string; hint: string }[] = [
  { id: "ajuste",     label: "Ajuste",    hint: "até 5min" },
  { id: "facil",      label: "Fácil",     hint: "5–10min" },
  { id: "moderada",   label: "Moderada",  hint: "10–20min" },
  { id: "elaborada",  label: "Elaborada", hint: "20–30min" },
];

export function ArtePromptBlock({
  value,
  onChange,
  terceirizadaValue,
  onTerceirizadaValueChange,
}: Props) {
  const isReady = value === "ready";
  const isCreate = value !== null && value !== "ready";
  const isTerc = value === "terceirizada";

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
          Tem arte pronta?
        </p>
        {value && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-emerald-600">
            <Check className="h-3 w-3" /> respondido
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange("ready")}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            isReady
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
          )}
        >
          Sim — cliente envia pronta
        </button>
        <button
          type="button"
          onClick={() => {
            // Se já está em modo "criar", não muda. Se vai entrar agora, escolhe Ajuste por default.
            if (!isCreate) onChange("ajuste");
          }}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            isCreate
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
          )}
        >
          Não — precisamos criar
        </button>
      </div>

      {isCreate && (
        <div className="space-y-2 pt-1 border-t border-border/40">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Complexidade
          </p>
          <div className="flex flex-wrap gap-2">
            {TIERS.map((t) => {
              const active = value === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onChange(t.id)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                  title={ART_LABEL[t.id]}
                >
                  <span className="font-medium">{t.label}</span>
                  <span className="ml-1 text-[10px] opacity-70">{t.hint}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onChange("terceirizada")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                isTerc
                  ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold"
                  : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
              )}
              title="Para artes acima de 30min — discutir com diretor"
            >
              +30min — terceirizada
            </button>
          </div>

          {isTerc && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 space-y-2">
              <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Confirmar com diretor antes de enviar. Lance abaixo o valor cobrado pela arte terceirizada.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">R$</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  value={terceirizadaValue === 0 ? "" : terceirizadaValue}
                  onChange={(e) => {
                    const raw = e.target.value;
                    onTerceirizadaValueChange(raw === "" ? 0 : Number(raw) || 0);
                  }}
                  className="h-8 max-w-[140px]"
                />
                <span className="text-[11px] text-muted-foreground">valor da arte (custo)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
