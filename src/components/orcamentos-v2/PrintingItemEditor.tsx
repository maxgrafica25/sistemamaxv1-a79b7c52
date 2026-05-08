import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Printer, X, Lock, ChevronDown, ChevronRight, Ruler, Layers, AlertTriangle,
} from "lucide-react";
import { LabelLayoutDialog } from "@/components/labels/LabelLayoutDialog";
import {
  LaborAndSupplySubform,
  type SubformLabor,
  type SubformMaterial,
} from "./LaborAndSupplySubform";
import type { PricingMaterial } from "@/lib/quotes-v2/pricing";
import type { PrintingCatalogItem } from "@/components/orcamentos/PrintingItemSearch";
import {
  PRODUCT_KIND_SUGGESTIONS,
  PRINT_COLOR_OPTIONS,
  buildDynamicTitle,
  sideFromPrintColors,
} from "@/lib/quotes-v2/item-title";
import { calcSheetYield, PRODUCTION_SHEET } from "@/lib/quotes-v2/sheet-yield";
import { cn } from "@/lib/utils";

interface Props {
  item: PricingMaterial;
  childLabor: SubformLabor[];
  childMaterials: SubformMaterial[];
  hourlyRate: number;
  printingCatalog?: PrintingCatalogItem[];
  onItemChange: (patch: Partial<PricingMaterial>) => void;
  onRemove: () => void;
  onChildLaborChange: (next: SubformLabor[]) => void;
  onChildMaterialChange: (next: SubformMaterial[]) => void;
  onPickPaper?: (catalogItem: PrintingCatalogItem) => void;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PrintingItemEditor({
  item,
  childLabor,
  childMaterials,
  hourlyRate,
  printingCatalog = [],
  onItemChange,
  onRemove,
  onChildLaborChange,
  onChildMaterialChange,
  onPickPaper,
}: Props) {
  const locked = item.status === "aprovado";
  const childCount = childLabor.length + childMaterials.length;
  const [expanded, setExpanded] = useState(childCount > 0);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [kindOpen, setKindOpen] = useState(false);
  const [paperOpen, setPaperOpen] = useState(false);
  const [paperQuery, setPaperQuery] = useState("");

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
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        printColors: item.printColors,
      }),
    [
      item.productKind,
      item.customName,
      item.paperType,
      item.grammage,
      item.size,
      item.side,
      item.widthMm,
      item.heightMm,
      item.printColors,
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

  // Atualiza largura/altura e reflete em `size` (compatibilidade legada).
  const handleDimensionChange = (patch: { widthMm?: number; heightMm?: number }) => {
    const nextW = patch.widthMm ?? item.widthMm ?? null;
    const nextH = patch.heightMm ?? item.heightMm ?? null;
    const nextSize =
      nextW && nextH ? `${nextW}x${nextH}mm` : item.size ?? null;
    onItemChange({ ...patch, size: nextSize });
  };

  // Quando muda a cor de impressão, atualiza também `side` (multiplicadores).
  const handlePrintColorsChange = (pc: string) => {
    const side = sideFromPrintColors(pc) ?? item.side ?? null;
    onItemChange({ printColors: pc, side });
  };

  // Cálculo de aproveitamento por folha (visão interna).
  const yieldInfo = useMemo(
    () => calcSheetYield(item.widthMm || 0, item.heightMm || 0, item.quantity || 0),
    [item.widthMm, item.heightMm, item.quantity],
  );
  const hasDimensions = !!(item.widthMm && item.heightMm);
  const exceedsSheet = hasDimensions && (!yieldInfo || yieldInfo.perSheet <= 0);

  const filteredKinds = (() => {
    const q = (item.productKind || "").toLowerCase().trim();
    if (!q) return PRODUCT_KIND_SUGGESTIONS;
    return PRODUCT_KIND_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q));
  })();

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
              Preencha tipo de material, dimensões, cor e papel para gerar a descrição.
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-1.5 text-xs text-muted-foreground truncate">
            <span className="font-medium">Catálogo:</span> {item.description}
          </p>
        )}
      </div>

      {/* Bloco: Tipo (autocomplete) + Largura + Altura + Cor + Referência */}
      {!locked && (
        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Tipo de Material — autocomplete livre */}
          <div className="sm:col-span-4 space-y-1.5">
            <Label className="text-xs">Tipo de Material</Label>
            <Popover open={kindOpen} onOpenChange={setKindOpen}>
              <PopoverAnchor asChild>
                <Input
                  value={item.productKind || ""}
                  onChange={(e) => {
                    onItemChange({ productKind: e.target.value });
                    if (!kindOpen) setKindOpen(true);
                  }}
                  onFocus={() => setKindOpen(true)}
                  onBlur={() => setTimeout(() => setKindOpen(false), 150)}
                  placeholder="Ex.: Panfleto, Cartão de Visita..."
                  className="h-9 text-sm"
                />
              </PopoverAnchor>
              <PopoverContent
                className="p-0 w-[var(--radix-popover-trigger-width)]"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command shouldFilter={false}>
                  <CommandList>
                    {filteredKinds.length === 0 ? (
                      <CommandEmpty>
                        {item.productKind
                          ? `Usar "${item.productKind}"`
                          : "Digite um tipo de material"}
                      </CommandEmpty>
                    ) : (
                      <CommandGroup heading="Sugestões">
                        {filteredKinds.map((s) => (
                          <CommandItem
                            key={s}
                            value={s}
                            onSelect={() => {
                              onItemChange({ productKind: s });
                              setKindOpen(false);
                            }}
                          >
                            {s}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Largura (cm) */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Largura (cm)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={item.widthMm != null ? item.widthMm / 10 : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".");
                const cm = raw ? parseFloat(raw) : NaN;
                handleDimensionChange({
                  widthMm: Number.isFinite(cm) ? cm * 10 : undefined,
                });
              }}
              placeholder="10"
              className="h-9 text-sm"
            />
          </div>

          {/* Altura (cm) */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Altura (cm)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={item.heightMm != null ? item.heightMm / 10 : ""}
              onChange={(e) => {
                const raw = e.target.value.replace(",", ".");
                const cm = raw ? parseFloat(raw) : NaN;
                handleDimensionChange({
                  heightMm: Number.isFinite(cm) ? cm * 10 : undefined,
                });
              }}
              placeholder="15"
              className="h-9 text-sm"
            />
          </div>

          {/* Cor da Impressão */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Cor da Impressão</Label>
            <Select
              value={item.printColors || ""}
              onValueChange={handlePrintColorsChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="4x4" />
              </SelectTrigger>
              <SelectContent>
                {PRINT_COLOR_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Referência (opcional) */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Referência</Label>
            <Input
              value={item.reference || ""}
              onChange={(e) => onItemChange({ reference: e.target.value })}
              placeholder="Campanha"
              className="h-9 text-sm"
            />
          </div>

          {/* Papel — combobox do catálogo */}
          <div className="sm:col-span-12 space-y-1.5">
            <Label className="text-xs">Papel</Label>
            <Popover open={paperOpen} onOpenChange={(o) => { setPaperOpen(o); if (!o) setPaperQuery(""); }}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "h-9 w-full rounded-md border bg-background px-3 text-sm text-left flex items-center justify-between gap-2",
                    "hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !item.paperType && "text-muted-foreground",
                  )}
                >
                  <span className="truncate">
                    {item.paperType
                      ? `${item.paperType}${item.grammage ? ` ${item.grammage}` : ""}${item.size ? ` — ${item.size}` : ""}${item.side ? ` ${item.side}` : ""}`
                      : "Selecione o papel do catálogo…"}
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0 w-[var(--radix-popover-trigger-width)]"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar papel, gramatura, formato…"
                    value={paperQuery}
                    onValueChange={setPaperQuery}
                  />
                  <CommandList>
                    {(() => {
                      const q = paperQuery.toLowerCase().trim();
                      const filtered = printingCatalog
                        .filter((p) =>
                          !q ||
                          `${p.paper_type} ${p.grammage ?? ""} ${p.size} ${p.side} ${p.equipment_name ?? ""} ${p.category_name}`
                            .toLowerCase()
                            .includes(q),
                        )
                        .slice(0, 50);
                      if (filtered.length === 0) {
                        return <CommandEmpty>Nenhum papel encontrado.</CommandEmpty>;
                      }
                      return (
                        <CommandGroup heading="Catálogo de impressão">
                          {filtered.map((p) => (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => {
                                onPickPaper?.(p);
                                setPaperOpen(false);
                                setPaperQuery("");
                              }}
                            >
                              <div className="flex w-full items-center justify-between gap-2">
                                <span className="truncate">
                                  {p.paper_type}{p.grammage ? ` ${p.grammage}` : ""} — {p.size} {p.side}
                                </span>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {p.equipment_name || p.category_name}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      );
                    })()}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

      {/* Bloco interno: aproveitamento por folha (visível só ao orçamentista) */}
      {hasDimensions && (
        <div className="px-3 pb-3">
          {exceedsSheet ? (
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
                "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="font-medium">
                Atenção: Material excede o tamanho da folha de produção
                <span className="font-normal opacity-80">
                  {" "}
                  ({PRODUCTION_SHEET.widthMm}×{PRODUCTION_SHEET.heightMm} mm)
                </span>
              </span>
            </div>
          ) : (
            yieldInfo && (
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Rendimento:{" "}
                  <span className="font-semibold text-foreground">
                    {yieldInfo.perSheet} un/folha
                  </span>{" "}
                  ({yieldInfo.orientation})
                  {yieldInfo.sheetsNeeded > 0 && (
                    <>
                      {" · "}Total:{" "}
                      <span className="font-semibold text-foreground">
                        {yieldInfo.sheetsNeeded} folha
                        {yieldInfo.sheetsNeeded > 1 ? "s" : ""}
                      </span>{" "}
                      ({PRODUCTION_SHEET.widthMm}×{PRODUCTION_SHEET.heightMm} mm)
                    </>
                  )}
                </span>
              </div>
            )
          )}
        </div>
      )}

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
