import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Clock, Package, Scissors } from "lucide-react";
import { LoadFromGroupDialog } from "./LoadFromGroupDialog";
import { STEP_TYPES } from "./StepTypeBadge";
import type { PricingMaterial, PricingLaborStep } from "@/lib/quotes-v2/pricing";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  computeLaborSellingPrice,
  LABOR_SELLING_TOOLTIP,
  type LaborDisplayPcts,
} from "@/lib/quotes-v2/labor-display";

export interface SubformLabor {
  id: string;
  description: string;
  timeMinutes: number;
  stepType: string;
  parentItemId?: string | null;
  /** Acabamento opcional (upsell) — não compõe o preço base do item. */
  isOptional?: boolean;
  /** Tempo bruto por apostila gravado pelo Kit Encadernação (para sincronia dinâmica com bookletUnits). */
  perBookletMinutes?: number | null;
}

export interface SubformMaterial extends PricingMaterial {
  // herda tudo de PricingMaterial; usado aqui apenas como alias semântico
}

interface Props {
  /** ID do item de impressão pai. null = avulsos (Bloco 3). */
  parentItemId: string | null;
  laborItems: SubformLabor[];
  materialItems: SubformMaterial[];
  hourlyRate: number;
  /** Pcts globais para calcular o preço de venda exibido por processo. */
  displayPcts: LaborDisplayPcts;
  onLaborChange: (next: SubformLabor[]) => void;
  onMaterialChange: (next: SubformMaterial[]) => void;
  /** Compacto: usado dentro do PrintingItemEditor (acabamentos vinculados). */
  compact?: boolean;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function LaborAndSupplySubform({
  parentItemId,
  laborItems,
  materialItems,
  hourlyRate,
  displayPcts,
  onLaborChange,
  onMaterialChange,
  compact = false,
}: Props) {
  const addLabor = () => {
    onLaborChange([
      ...laborItems,
      {
        id: `lab-${Date.now()}`,
        description: "",
        timeMinutes: 0,
        stepType: "outro",
        parentItemId,
      },
    ]);
  };

  const addMaterial = (descriptionPrefix = "") => {
    onMaterialChange([
      ...materialItems,
      {
        id: `mat-${Date.now()}`,
        description: descriptionPrefix,
        quantity: 1,
        unitPrice: 0,
        parentItemId,
      },
    ]);
  };

  const updateLabor = (id: string, patch: Partial<SubformLabor>) =>
    onLaborChange(laborItems.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLabor = (id: string) => onLaborChange(laborItems.filter((l) => l.id !== id));

  const updateMaterial = (id: string, patch: Partial<SubformMaterial>) =>
    onMaterialChange(materialItems.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMaterial = (id: string) => onMaterialChange(materialItems.filter((m) => m.id !== id));

  const inputH = compact ? "h-7 text-xs" : "h-8 text-sm";
  const labelH = compact ? "text-xs" : "text-sm";

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={addLabor} className="gap-1.5 h-8">
          <Clock className="h-3.5 w-3.5" /> Mão de obra
        </Button>
        <Button variant="outline" size="sm" onClick={() => addMaterial()} className="gap-1.5 h-8">
          <Package className="h-3.5 w-3.5" /> Material
        </Button>
        {compact && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => addMaterial("Acabamento avulso: ")}
            className="gap-1.5 h-8"
          >
            <Scissors className="h-3.5 w-3.5" /> Acabamento avulso
          </Button>
        )}
        <LoadFromGroupDialog
          kind="labor"
          triggerLabel="Grupo (M.Obra)"
          onLoad={(items) =>
            onLaborChange([
              ...laborItems,
              ...items.map((it) => ({ ...it, parentItemId })),
            ])
          }
        />
        <LoadFromGroupDialog
          kind="materials"
          triggerLabel="Grupo (Material)"
          onLoad={(items) =>
            onMaterialChange([
              ...materialItems,
              ...items.map((it: any) => ({
                id: it.id,
                description: it.description,
                quantity: it.quantity,
                unitPrice: it.unitPrice,
                margemPct: it.margemPct,
                supplyId: it.supplyId,
                pricingTiers: it.pricingTiers,
                parentItemId,
              })),
            ])
          }
        />
      </div>

      {/* Empty state */}
      {laborItems.length === 0 && materialItems.length === 0 && (
        <p className={`${labelH} text-muted-foreground italic py-2`}>
          {parentItemId
            ? "Nenhum acabamento vinculado a este item ainda."
            : "Nenhum item avulso. Use os botões acima para adicionar."}
        </p>
      )}

      {/* Labor list */}
      {laborItems.map((l, idx) => {
        const locked = false; // filhos só travam quando o pai é aprovado — controlado pelo wrapper
        return (
          <div
            key={l.id}
            className={`flex items-center gap-2 rounded-md border bg-background p-2 ${labelH}`}
          >
            <Clock className="h-3.5 w-3.5 text-primary/60 shrink-0" />
            {!compact && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                {idx + 1}
              </span>
            )}
            <Select
              value={l.stepType}
              onValueChange={(v) => updateLabor(l.id, { stepType: v })}
            >
              <SelectTrigger className={`w-28 ${inputH}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STEP_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={l.description}
              onChange={(e) => updateLabor(l.id, { description: e.target.value })}
              placeholder="Descrição"
              className={`flex-1 ${inputH}`}
              disabled={locked}
            />
            <Input
              type="number"
              value={l.timeMinutes || ""}
              onChange={(e) =>
                updateLabor(l.id, { timeMinutes: parseFloat(e.target.value) || 0 })
              }
              className={`w-16 ${inputH} text-center`}
              placeholder="min"
              disabled={locked}
            />
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-20 text-right tabular-nums text-muted-foreground cursor-help">
                    {formatBRL(computeLaborSellingPrice(l.timeMinutes, hourlyRate, displayPcts))}
                  </span>
                </TooltipTrigger>
                <TooltipContent>{LABOR_SELLING_TOOLTIP}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => removeLabor(l.id)}
              disabled={locked}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}

      {/* Material list */}
      {materialItems.map((m) => {
        const locked = m.status === "aprovado";
        return (
          <div
            key={m.id}
            className={`flex items-center gap-2 rounded-md border p-2 ${labelH} ${
              locked ? "border-green-500/40 bg-green-500/5" : "bg-background"
            }`}
          >
            <Package className="h-3.5 w-3.5 text-primary/60 shrink-0" />
            <Input
              value={m.description}
              onChange={(e) => updateMaterial(m.id, { description: e.target.value })}
              placeholder="Material/insumo"
              className={`flex-1 ${inputH}`}
              disabled={locked}
            />
            <Input
              type="number"
              value={m.quantity || ""}
              onChange={(e) =>
                updateMaterial(m.id, { quantity: parseFloat(e.target.value) || 0 })
              }
              placeholder="qtd"
              className={`w-14 ${inputH} text-center`}
              disabled={locked}
            />
            <Input
              type="number"
              step="0.01"
              value={m.unitPrice || ""}
              onChange={(e) =>
                updateMaterial(m.id, { unitPrice: parseFloat(e.target.value) || 0 })
              }
              placeholder="R$"
              className={`w-20 ${inputH} text-center`}
              disabled={locked}
            />
            <span className="w-20 text-right tabular-nums text-muted-foreground">
              {formatBRL(m.quantity * m.unitPrice)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => removeMaterial(m.id)}
              disabled={locked}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
