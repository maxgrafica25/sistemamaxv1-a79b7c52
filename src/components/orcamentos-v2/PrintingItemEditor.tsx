import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Printer, X, Lock, ChevronDown, ChevronRight, Ruler } from "lucide-react";
import { LabelLayoutDialog } from "@/components/labels/LabelLayoutDialog";
import {
  LaborAndSupplySubform,
  type SubformLabor,
  type SubformMaterial,
} from "./LaborAndSupplySubform";
import type { PricingMaterial } from "@/lib/quotes-v2/pricing";
import {
  PRODUCT_KIND_OPTIONS,
  buildDynamicTitle,
} from "@/lib/quotes-v2/item-title";

interface Props {
  item: PricingMaterial;
  childLabor: SubformLabor[];
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
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);

  // Título dinâmico — derivado dos atributos estruturados, recomputado em tempo real.
  const dynamicTitle = useMemo(
    () =>
      buildDynamicTitle({
        productKind: item.productKind,
        customName: item.customName,
        paperType: item.paperType,
        grammage: item.grammage,
        size: item.size,
        side: item.side,
        finishes: childMaterials.map((m) => m.description),
      }),
    [
      item.productKind,
      item.customName,
      item.paperType,
      item.grammage,
      item.size,
      item.side,
      childMaterials,
    ],
  );

  const guessSheet = (): { width: number; height: number } | undefined => {
    const s = (item.size || "").toUpperCase();
    if (s === "SRA3") return { width: 320, height: 450 };
    if (s === "A3") return { width: 297, height: 420 };
    if (s === "A4") return { width: 210, height: 297 };
    if (s === "CARTA") return { width: 216, height: 279 };
    return undefined;
  };

  const showCustomName = item.productKind === "outro";

  return (
    <div
      className={`rounded-lg border ${
        locked ? "border-green-500/40 bg-green-500/5" : "bg-card"
      }`}
    >
      {/* Banner do título dinâmico (read-only) */}
      <div className="p-3">
        <div className="text-lg font-bold text-primary bg-primary/5 p-3 rounded-lg border border-primary/10 break-words">
          {dynamicTitle || (
            <span className="text-muted-foreground font-normal text-sm">
              Selecione o tipo de produto para gerar o título técnico do item.
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-1.5 text-xs text-muted-foreground truncate">
            <span className="font-medium">Catálogo:</span> {item.description}
          </p>
        )}
      </div>

      {/* Bloco: Tipo de Produto + Customizado + Referência */}
      {!locked && (
        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className={`space-y-1.5 ${showCustomName ? "sm:col-span-4" : "sm:col-span-6"}`}>
            <Label className="text-xs">Tipo de Produto</Label>
            <Select
              value={item.productKind || ""}
              onValueChange={(v) =>
                onItemChange({
                  productKind: v || null,
                  // limpa customName se sair de "outro"
                  ...(v !== "outro" ? { customName: null } : {}),
                })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_KIND_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showCustomName && (
            <div className="sm:col-span-4 space-y-1.5">
              <Label className="text-xs">Nome customizado</Label>
              <Input
                value={item.customName || ""}
                onChange={(e) => onItemChange({ customName: e.target.value })}
                placeholder="Ex.: Convite, Bloco, Etiqueta..."
                className="h-9 text-sm"
              />
            </div>
          )}

          <div className={`space-y-1.5 ${showCustomName ? "sm:col-span-4" : "sm:col-span-6"}`}>
            <Label className="text-xs">Referência / Campanha (opcional)</Label>
            <Input
              value={item.reference || ""}
              onChange={(e) => onItemChange({ reference: e.target.value })}
              placeholder="Ex.: Promoção Dia das Mães"
              className="h-9 text-sm"
            />
          </div>
        </div>
      )}

      {/* Header — qty + total + ações */}
      <div className="flex items-center gap-3 px-3 pb-3 border-t border-border/60 pt-3">
        {locked ? (
          <Lock className="h-4 w-4 text-green-600 shrink-0" />
        ) : (
          <Printer className="h-4 w-4 text-primary/60 shrink-0" />
        )}
        <div className="flex-1 min-w-0 text-xs text-muted-foreground flex items-center gap-2">
          <span>Quantidade (folhas)</span>
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
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => setLabelDialogOpen(true)}
                  type="button"
                >
                  <Ruler className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Calcular etiquetas por folha
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
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

      <LabelLayoutDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        defaultSheet={guessSheet()}
        defaultQty={item.quantity || 100}
        onApply={(folhas) => onItemChange({ quantity: folhas })}
      />

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
