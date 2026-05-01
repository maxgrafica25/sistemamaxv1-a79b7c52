import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, X, Lock, ChevronDown, ChevronRight } from "lucide-react";
import {
  LaborAndSupplySubform,
  type SubformLabor,
  type SubformMaterial,
} from "./LaborAndSupplySubform";
import type { PricingMaterial } from "@/lib/quotes-v2/pricing";

interface Props {
  /** Item de impressão pai (sempre tem baseCost + printerCategoryId). */
  item: PricingMaterial;
  /** Filhos: mão de obra deste item (parentItemId === item.id). */
  childLabor: SubformLabor[];
  /** Filhos: materiais manuais deste item. */
  childMaterials: SubformMaterial[];
  hourlyRate: number;
  onItemChange: (patch: Partial<PricingMaterial>) => void;
  onRemove: () => void;
  onChildLaborChange: (next: SubformLabor[]) => void;
  onChildMaterialChange: (next: SubformMaterial[]) => void;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PrintingItemEditor({
  item,
  childLabor,
  childMaterials,
  hourlyRate,
  onItemChange,
  onRemove,
  onChildLaborChange,
  onChildMaterialChange,
}: Props) {
  const locked = item.status === "aprovado";
  const childCount = childLabor.length + childMaterials.length;
  const [expanded, setExpanded] = useState(childCount > 0);

  return (
    <div
      className={`rounded-lg border ${
        locked ? "border-green-500/40 bg-green-500/5" : "bg-card"
      }`}
    >
      {/* Header — descrição + qty + total + ações */}
      <div className="flex items-center gap-3 p-3">
        {locked ? (
          <Lock className="h-4 w-4 text-green-600 shrink-0" />
        ) : (
          <Printer className="h-4 w-4 text-primary/60 shrink-0" />
        )}
        <div className="flex-1 min-w-0 text-sm font-medium truncate flex items-center gap-2">
          {item.description}
          {locked && (
            <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 border-green-500/30 text-[10px]">
              Aprovado
            </Badge>
          )}
        </div>
        <Input
          type="number"
          value={item.quantity || ""}
          disabled={locked}
          onChange={(e) =>
            onItemChange({ quantity: parseFloat(e.target.value) || 0 })
          }
          className="w-20 h-8 text-sm text-center disabled:opacity-70"
        />
        <span className="text-sm font-semibold text-primary w-28 text-right">
          {formatBRL(item.quantity * item.unitPrice)}
        </span>
        {!locked && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Toggle de acabamentos vinculados */}
      <div className="border-t border-border/60 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          Acabamentos vinculados
          {childCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">
              {childCount}
            </Badge>
          )}
        </button>

        {expanded && (
          <div className="mt-3">
            <LaborAndSupplySubform
              parentItemId={item.id}
              laborItems={childLabor}
              materialItems={childMaterials}
              hourlyRate={hourlyRate}
              onLaborChange={onChildLaborChange}
              onMaterialChange={onChildMaterialChange}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}
