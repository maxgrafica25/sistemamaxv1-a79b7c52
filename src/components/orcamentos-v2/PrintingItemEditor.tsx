import { useEffect, useMemo, useState } from "react";
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
  isApostilaKind,
} from "@/lib/quotes-v2/item-title";
import { calcSheetYield, PRODUCTION_SHEET, A4_SHEET } from "@/lib/quotes-v2/sheet-yield";
import { ProcessPicker, type ProcessStep, type ProcessGroup } from "./ProcessPicker";
import { SmartFinishingBlock } from "./SmartFinishingBlock";
import { cn } from "@/lib/utils";

interface Props {
  item: PricingMaterial;
  childLabor: SubformLabor[];
  childMaterials: SubformMaterial[];
  hourlyRate: number;
  /** Pcts globais para exibir preço de venda dos processos. */
  displayPcts: import("@/lib/quotes-v2/labor-display").LaborDisplayPcts;
  printingCatalog?: PrintingCatalogItem[];
  processSteps?: ProcessStep[];
  processGroups?: ProcessGroup[];
  piecesInput?: string | null;
  onPiecesInputChange?: (value: string | null) => void;
  onItemChange: (patch: Partial<PricingMaterial>) => void;
  onRemove: () => void;
  onChildLaborChange: (next: SubformLabor[]) => void;
  onChildMaterialChange: (next: SubformMaterial[]) => void;
  onPickPaper?: (catalogItem: PrintingCatalogItem) => void;
  onAddProcess?: (step: ProcessStep) => void;
  onExpandStepGroup?: (group: ProcessGroup) => void;
  onAddCustomFinish?: (name: string, minutes: number) => void;
  /** Apostila — definir/limpar papel de capa ou contracapa (cria/remove material filho). */
  onPickCoverPaper?: (kind: "Capa" | "Contracapa", catalogItem: PrintingCatalogItem) => void;
  onClearCoverPaper?: (kind: "Capa" | "Contracapa") => void;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PrintingItemEditor({
  item,
  childLabor,
  childMaterials,
  hourlyRate,
  displayPcts,
  piecesInput,
  onPiecesInputChange,
  printingCatalog = [],
  processSteps = [],
  processGroups = [],
  onItemChange,
  onRemove,
  onChildLaborChange,
  onChildMaterialChange,
  onPickPaper,
  onAddProcess,
  onExpandStepGroup,
  onAddCustomFinish,
  onPickCoverPaper,
  onClearCoverPaper,
}: Props) {
  const locked = item.status === "aprovado";
  const childCount = childLabor.length + childMaterials.length;
  const [expanded, setExpanded] = useState(childCount > 0);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [kindOpen, setKindOpen] = useState(false);
  const [paperOpen, setPaperOpen] = useState(false);
  const [paperQuery, setPaperQuery] = useState("");

  const isApostila = isApostilaKind(item.productKind);
  // Para apostila: unitPrice é o preço FINAL da impressão por folha (vindo
  // direto da faixa de markup da tabela "Preço Impressão"). Não usar
  // printingCostUnit — esse é o custo bruto, não o preço de venda.
  const effectiveUnitPrice = item.unitPrice || 0;
  const bookletPages = item.bookletPages ?? null;
  const bookletUnits = item.bookletUnits ?? null;
  const duplexFromPrintColors = (pc?: string | null): boolean | null => {
    if (pc === "4x4" || pc === "1x1") return true;
    if (pc === "4x0" || pc === "1x0") return false;
    return null;
  };
  const bookletDuplex =
    duplexFromPrintColors(item.printColors) ?? item.bookletDuplex ?? true;

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
        bookletPages: item.bookletPages,
        bookletUnits: item.bookletUnits,
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
      item.bookletPages,
      item.bookletUnits,
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
    // Se já há papel do catálogo selecionado, NUNCA sobrescreve `size`
    // (que guarda o tamanho da FOLHA — A3/A4/SRA3). Dimensões da peça
    // ficam só em widthMm/heightMm.
    if (item.paperType) {
      onItemChange(patch);
      return;
    }
    const nextW = patch.widthMm ?? item.widthMm ?? null;
    const nextH = patch.heightMm ?? item.heightMm ?? null;
    const nextSize =
      nextW && nextH ? `${nextW}x${nextH}mm` : item.size ?? null;
    onItemChange({ ...patch, size: nextSize });
  };

  // Quando muda a cor de impressão, atualiza também `side` (multiplicadores).
  const handlePrintColorsChange = (pc: string) => {
    const side = sideFromPrintColors(pc) ?? item.side ?? null;
    const dup = duplexFromPrintColors(pc);
    const patch: Record<string, unknown> = { printColors: pc, side };
    if (isApostila && dup !== null) patch.bookletDuplex = dup;
    onItemChange(patch as Parameters<typeof onItemChange>[0]);
  };

  // Cálculo de aproveitamento por folha (visão interna).
  // Usa as PEÇAS DESEJADAS para sugerir folhas necessárias. Quantity é "folhas cobradas".
  const piecesValue = (item.pieces ?? item.quantity ?? 0) || 0;
  const yieldInfo = useMemo(
    () =>
      calcSheetYield(
        item.widthMm || 0,
        item.heightMm || 0,
        piecesValue,
        isApostila ? A4_SHEET : PRODUCTION_SHEET,
        isApostila ? 0 : undefined,
      ),
    [item.widthMm, item.heightMm, piecesValue, isApostila],
  );
  const hasDimensions = !!(item.widthMm && item.heightMm);

  // Modo Apostila: preset de formato (A4 / A5 / Personalizado).
  const APOSTILA_PRESETS = { a4: { w: 210, h: 297 }, a5: { w: 148, h: 210 } } as const;
  const detectApostilaPreset = (): "a4" | "a5" | "custom" => {
    const w = item.widthMm, h = item.heightMm;
    if (!w || !h) return "a4";
    const eq = (a: number, b: number) => Math.abs(a - b) < 0.5;
    if ((eq(w, 210) && eq(h, 297)) || (eq(w, 297) && eq(h, 210))) return "a4";
    if ((eq(w, 148) && eq(h, 210)) || (eq(w, 210) && eq(h, 148))) return "a5";
    return "custom";
  };
  const [apostilaPreset, setApostilaPreset] = useState<"a4" | "a5" | "custom">(detectApostilaPreset);
  // Resync preset quando o item muda externamente (ex.: reabrir orçamento).
  useEffect(() => {
    if (!isApostila) return;
    setApostilaPreset(detectApostilaPreset());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApostila, item.widthMm, item.heightMm]);
  // Quando vira apostila sem dimensões, semeia A4.
  useEffect(() => {
    if (locked) return;
    if (!isApostila) return;
    if (!item.widthMm || !item.heightMm) {
      handleDimensionChange({ widthMm: APOSTILA_PRESETS.a4.w, heightMm: APOSTILA_PRESETS.a4.h });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApostila]);
  const handleApostilaPresetChange = (val: "a4" | "a5" | "custom") => {
    setApostilaPreset(val);
    if (val === "custom") return;
    const p = APOSTILA_PRESETS[val];
    handleDimensionChange({ widthMm: p.w, heightMm: p.h });
  };
  const exceedsSheet = hasDimensions && (!yieldInfo || yieldInfo.perSheet <= 0);

  // Mantém quantity (folhas cobradas) sincronizado com pieces e perSheet.
  const perSheetForSync = yieldInfo?.perSheet ?? 0;
  const expectedQuantity = perSheetForSync > 0
    ? (piecesValue > 0 ? Math.ceil(piecesValue / perSheetForSync) : 0)
    : piecesValue;
  useEffect(() => {
    if (locked) return;
    if (item.pieces == null) return;
    if (expectedQuantity > 0 && expectedQuantity !== item.quantity) {
      onItemChange({ quantity: expectedQuantity });
    }
  }, [expectedQuantity, item.pieces, item.quantity, locked]);

  const filteredKinds = (() => {
    const q = (item.productKind || "").toLowerCase().trim();
    if (!q) return PRODUCT_KIND_SUGGESTIONS;
    return PRODUCT_KIND_SUGGESTIONS.filter((s) => s.toLowerCase().includes(q));
  })();

  // Identifica se é etiqueta/adesivo (singular ou plural, qualquer caso).
  const isLabelKind = (kind?: string | null): boolean => {
    const k = (kind || "").trim().toLowerCase();
    return k.startsWith("etiqueta") || k.startsWith("adesivo");
  };
  const isLabel = isLabelKind(item.productKind);

  // Normaliza printColors quando o item ainda não tem valor definido.
  // Sem isso, o usuário vê "4x4" no Select (placeholder) mas o estado real é
  // null — o filtro de papel por F/V deixa de funcionar.
  useEffect(() => {
    if (item.printColors) return;
    if (locked) return;
    if (isLabel) {
      onItemChange({ printColors: "4x0", side: "Simples" } as Parameters<typeof onItemChange>[0]);
    } else {
      onItemChange({ printColors: "4x4", side: "F/V" } as Parameters<typeof onItemChange>[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.printColors, isLabel, locked]);

  // Atualiza productKind aplicando regras automáticas para etiquetas/adesivos.
  const handleProductKindChange = (kind: string) => {
    const patch: Partial<PricingMaterial> = { productKind: kind };
    if (isLabelKind(kind)) {
      patch.printColors = "4x0";
      patch.side = "Simples";
    }
    onItemChange(patch);

    // Pré-seleciona Adesivo A3 (ou A4 como fallback) quando entra em etiqueta
    // e o papel atual não é adesivo.
    if (isLabelKind(kind) && onPickPaper) {
      const currentIsAdhesive = (item.paperType || "").toLowerCase().includes("adesivo");
      if (!currentIsAdhesive) {
        const adhesives = printingCatalog.filter((p) =>
          (p.paper_type || "").toLowerCase().includes("adesivo"),
        );
        const a3 = adhesives.find((p) => (p.size || "").toUpperCase() === "A3");
        const a4 = adhesives.find((p) => (p.size || "").toUpperCase() === "A4");
        const pick = a3 || a4;
        if (pick) onPickPaper(pick);
      }
    }
  };

  return (
    <div
      className={`rounded-lg border ${
        locked ? "border-green-500/40 bg-green-500/5" : "bg-card"
      }`}
    >
      {/* Banner do título dinâmico (read-only, minimalista) */}
      <div className="p-3">
        <div className="text-base font-semibold text-foreground bg-muted/30 px-3 py-2 rounded-md border border-border/40 break-words">
          {dynamicTitle || (
            <span className="text-muted-foreground font-normal text-xs">
              Título gerado automaticamente
            </span>
          )}
        </div>
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
                    handleProductKindChange(e.target.value);
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
                              handleProductKindChange(s);
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

          {isApostila ? (
            <>
              {/* Formato (apostila) */}
              <div className="sm:col-span-4 space-y-1.5">
                <Label className="text-xs">Formato</Label>
                <Select
                  value={apostilaPreset}
                  onValueChange={(v) => handleApostilaPresetChange(v as "a4" | "a5" | "custom")}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4 (21 × 29,7 cm)</SelectItem>
                    <SelectItem value="a5">A5 (14,8 × 21 cm)</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {apostilaPreset === "custom" && (
                <>
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
                      placeholder="21"
                      className="h-9 text-sm"
                    />
                  </div>
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
                      placeholder="29.7"
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
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
            </>
          )}

          {/* Cor da Impressão */}
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Cor da Impressão</Label>
            <Select
              value={item.printColors || ""}
              onValueChange={handlePrintColorsChange}
              disabled={isLabel}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="4x4" />
              </SelectTrigger>
              <SelectContent>
                {(isLabel ? (["4x0", "1x0"] as const) : PRINT_COLOR_OPTIONS).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isLabel && (
              <p className="text-[10px] text-muted-foreground">Adesivo não tem verso</p>
            )}
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

          {/* Papel — autocomplete (input + lista filtrada) */}
          <div className="sm:col-span-12 space-y-1.5">
            <Label className="text-xs">Papel</Label>
            <Popover open={paperOpen} onOpenChange={setPaperOpen}>
              <PopoverAnchor asChild>
                <div className="relative">
                  <Input
                    value={
                      paperOpen
                        ? paperQuery
                        : item.paperType
                          ? `${item.paperType}${item.grammage ? ` ${item.grammage}` : ""}${item.size ? ` — ${item.size}` : ""}${item.side ? ` ${item.side}` : ""}`
                          : ""
                    }
                    placeholder="Buscar papel, gramatura, formato…"
                    onFocus={() => { setPaperOpen(true); setPaperQuery(""); }}
                    onChange={(e) => { setPaperQuery(e.target.value); setPaperOpen(true); }}
                    onBlur={() => setTimeout(() => setPaperOpen(false), 150)}
                    className="h-9 text-sm pr-8"
                  />
                  {item.paperType && !paperOpen && (
                    <button
                      type="button"
                      onClick={() => {
                        onItemChange({
                          paperType: null, grammage: null, size: null, side: null,
                          baseCost: 0, printerCategoryId: null, markupGroupId: null,
                          catalogItemId: null,
                        } as any);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </PopoverAnchor>
              <PopoverContent
                className="p-0 w-[var(--radix-popover-trigger-width)]"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command shouldFilter={false}>
                  <CommandList>
                    {(() => {
                      const q = paperQuery.toLowerCase().trim();
                      const base = isLabel
                        ? printingCatalog.filter((p) => {
                            const isAdh = (p.paper_type || "")
                              .toLowerCase()
                              .includes("adesivo");
                            const sz = (p.size || "").toUpperCase();
                            return isAdh && (sz === "A3" || sz === "A4");
                          })
                        : printingCatalog;
                      const wantedSide = sideFromPrintColors(item.printColors);
                      const matchesSide = (p: PrintingCatalogItem) => {
                        if (!wantedSide) return true;
                        const s = (p.side || "").toUpperCase();
                        if (wantedSide === "F/V") return s === "F/V" || s === "FV";
                        return s === "F" || s === "FRENTE" || s === "SIMPLES";
                      };
                      const baseBySide = base.filter(matchesSide);
                      const filtered = baseBySide
                        .filter((p) =>
                          !q ||
                          `${p.paper_type} ${p.grammage ?? ""} ${p.size} ${p.side} ${p.equipment_name ?? ""} ${p.category_name}`
                            .toLowerCase()
                            .includes(q),
                        )
                        .slice(0, 50);
                      if (filtered.length === 0) {
                        if (wantedSide && baseBySide.length === 0) {
                          return (
                            <CommandEmpty>
                              Nenhum papel cadastrado para impressão {item.printColors}. Verifique a Cor da Impressão ou cadastre essa variante.
                            </CommandEmpty>
                          );
                        }
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

      {/* Apostila — Capa e Contracapa (sub-itens automáticos) */}
      {isApostila && !locked && (
        <div className="px-3 pb-3 border-t border-border/60 pt-3 space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Capa & Contracapa
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <CoverPaperPicker
              kind="Capa"
              printingCatalog={printingCatalog}
              printColors={item.printColors}
              current={childMaterials.find((c) => c.productKind === "Capa") || null}
              onPick={(it) => onPickCoverPaper?.("Capa", it)}
              onClear={() => onClearCoverPaper?.("Capa")}
            />
            <CoverPaperPicker
              kind="Contracapa"
              printingCatalog={printingCatalog}
              printColors={item.printColors}
              current={childMaterials.find((c) => c.productKind === "Contracapa") || null}
              onPick={(it) => onPickCoverPaper?.("Contracapa", it)}
              onClear={() => onClearCoverPaper?.("Contracapa")}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            A quantidade segue automaticamente o nº de apostilas.
          </p>
        </div>
      )}

      {/* Apostila — bloco dedicado de configuração (folhas × apostilas + impressão) */}
      {isApostila && (
        <div className="px-3 pb-3 border-t border-border/60 pt-3 space-y-3">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Configuração da Apostila
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Folhas por apostila</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={bookletPages ?? ""}
                disabled={locked}
                placeholder="Ex.: 50"
                onChange={(e) => {
                  const sheets = parseInt(e.target.value) || 0;
                  const pieces = Math.max(0, sheets * (bookletUnits ?? 0));
                  const folhas = perSheetForSync > 0
                    ? (pieces > 0 ? Math.ceil(pieces / perSheetForSync) : 0)
                    : pieces;
                  onPiecesInputChange?.(String(pieces));
                  onItemChange({ bookletPages: sheets, pieces, quantity: folhas });
                }}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantidade de apostilas</Label>
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={bookletUnits ?? ""}
                disabled={locked}
                placeholder="Ex.: 10"
                onChange={(e) => {
                  const uns = parseInt(e.target.value) || 0;
                  const pieces = Math.max(0, (bookletPages ?? 0) * uns);
                  const folhas = perSheetForSync > 0
                    ? (pieces > 0 ? Math.ceil(pieces / perSheetForSync) : 0)
                    : pieces;
                  onPiecesInputChange?.(String(pieces));
                  onItemChange({ bookletUnits: uns, pieces, quantity: folhas });
                }}
                className="h-9 text-sm"
              />
            </div>
          </div>
          {(bookletPages ?? 0) > 0 && (bookletUnits ?? 0) > 0 && (
            <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-md px-2.5 py-1.5">
              Resumo:{" "}
              <span className="text-foreground font-medium">
                {bookletPages} folhas × {bookletUnits} apostilas
              </span>{" "}
              · {bookletDuplex ? "F/V" : "Frente"} →{" "}
              <span className="text-foreground font-medium">
                {(bookletPages ?? 0) * (bookletUnits ?? 0)} folhas físicas
              </span>{" "}
              ·{" "}
              <span className="text-foreground font-medium">
                {(bookletPages ?? 0) * (bookletUnits ?? 0) * (bookletDuplex ? 2 : 1)} impressões
              </span>
            </div>
          )}
        </div>
      )}

      {/* Quantidade — entrada única em peças; folhas é derivado */}
      <div className="px-3 pb-3 border-t border-border/60 pt-3 space-y-2">
        {exceedsSheet && (
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
        )}

        <div className="flex items-center gap-3">
          {locked ? (
            <Lock className="h-4 w-4 text-green-600 shrink-0" />
          ) : (
            <Layers className="h-4 w-4 text-primary/60 shrink-0" />
          )}
          <div className="flex-1 min-w-0 text-xs text-muted-foreground flex items-center gap-2">
            <span>{isApostila ? "Folhas a imprimir" : "Peças desejadas"}</span>
            {locked && (
              <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 border-green-500/30 text-[10px]">
                Aprovado
              </Badge>
            )}
          </div>
          {isApostila ? (
            <div className="w-28 h-8 flex items-center justify-center text-sm font-medium tabular-nums rounded-md border border-border/60 bg-muted/40 text-foreground">
              {(item.pieces ?? 0).toLocaleString("pt-BR")}
            </div>
          ) : (
            (() => {
              const displayValue = piecesInput ?? (piecesValue || "");
              return (
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={displayValue}
                  disabled={locked}
                  placeholder="100"
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    onPiecesInputChange?.(raw);
                    const pieces = raw ? Number(raw) : 0;
                    const folhas = perSheetForSync > 0
                      ? (pieces > 0 ? Math.ceil(pieces / perSheetForSync) : 0)
                      : pieces;
                    onItemChange({ pieces, quantity: folhas });
                  }}
                  className="w-28 h-8 text-sm text-center disabled:opacity-70"
                />
              );
            })()
          )}
          <span className="text-sm font-semibold text-primary w-28 text-right">
            {formatBRL((item.quantity || 0) * effectiveUnitPrice)}
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

        {/* Linha derivada: folhas usadas + rendimento + sobra */}
        {yieldInfo && !exceedsSheet && (
          (() => {
            const perSheet = yieldInfo.perSheet;
            const pieces = piecesValue;
            const folhas = pieces > 0 ? Math.ceil(pieces / perSheet) : 0;
            const sobra = folhas > 0 ? folhas * perSheet - pieces : 0;
            return (
              <div className="flex items-center gap-2 pl-7 text-[11px] text-muted-foreground">
                <span>
                  Usa{" "}
                  <span className="font-semibold text-foreground">
                    {folhas} {folhas === 1 ? "folha" : "folhas"}
                  </span>{" "}
                  ({perSheet} un/folha · {yieldInfo.orientation})
                  {sobra > 0 ? ` · sobra ${sobra} un` : ""}
                </span>
              </div>
            );
          })()
        )}

        {/* Variações de tiragem (ancoragem de preço) */}
        {!locked && (
          <QuantityVariationsRow
            unitPrice={effectiveUnitPrice}
            variations={item.quantityVariations || []}
            onChange={(next) => onItemChange({ quantityVariations: next })}
          />
        )}
      </div>

      <LabelLayoutDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        defaultSheet={guessSheet()}
        defaultQty={piecesValue || 100}
        onApply={(folhas) => {
          const perSheet = yieldInfo?.perSheet ?? 1;
          const pieces = folhas * perSheet;
          onPiecesInputChange?.(String(pieces));
          onItemChange({ pieces, quantity: folhas });
        }}
      />

      {/* Acabamentos inteligentes (chips + omnibox) */}
      <div className="border-t border-border/60 px-3 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
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
            Acabamentos
            {childCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">
                {childCount}
              </Badge>
            )}
          </button>
        </div>

        {expanded && (
          <SmartFinishingBlock
            parentItemId={item.id}
            productKind={item.productKind}
            processSteps={processSteps}
            hourlyRate={hourlyRate}
            displayPcts={displayPcts}
            childLabor={childLabor}
            childMaterials={childMaterials}
            onChildLaborChange={onChildLaborChange}
            onChildMaterialChange={onChildMaterialChange}
            disabled={locked}
            bookletUnits={isApostila ? item.bookletUnits ?? null : null}
            bookletPages={isApostila ? item.bookletPages ?? null : null}
          />
        )}
      </div>
    </div>
  );
}

function QuantityVariationsRow({
  unitPrice, variations, onChange,
}: {
  unitPrice: number;
  variations: Array<{ pieces: number; unit_price: number }>;
  onChange: (next: Array<{ pieces: number; unit_price: number }>) => void;
}) {
  const addVariation = () =>
    onChange([...variations, { pieces: 0, unit_price: unitPrice }]);
  const updateVariation = (i: number, patch: Partial<{ pieces: number; unit_price: number }>) =>
    onChange(variations.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const removeVariation = (i: number) =>
    onChange(variations.filter((_, idx) => idx !== i));

  return (
    <div className="pl-7 space-y-1.5">
      {variations.map((v, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground w-20">Variação {i + 1}</span>
          <Input
            type="number"
            min={0}
            value={v.pieces || ""}
            onChange={(e) => updateVariation(i, { pieces: parseInt(e.target.value) || 0 })}
            placeholder="peças"
            className="w-24 h-7 text-xs text-center"
          />
          <Input
            type="number"
            step="0.01"
            min={0}
            value={v.unit_price || ""}
            onChange={(e) => updateVariation(i, { unit_price: parseFloat(e.target.value) || 0 })}
            placeholder="R$ unit."
            className="w-28 h-7 text-xs text-center"
          />
          <span className="text-muted-foreground tabular-nums">
            = {formatBRL((v.pieces || 0) * (v.unit_price || 0))}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 ml-auto"
            onClick={() => removeVariation(i)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addVariation}
        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-primary gap-1"
      >
        <span className="text-base leading-none">+</span> Adicionar variação
      </Button>
    </div>
  );
}

interface CoverPaperPickerProps {
  kind: "Capa" | "Contracapa";
  printingCatalog: PrintingCatalogItem[];
  printColors?: string | null;
  current: PricingMaterial | null;
  onPick: (item: PrintingCatalogItem) => void;
  onClear: () => void;
}

function CoverPaperPicker({
  kind, printingCatalog, printColors, current, onPick, onClear,
}: CoverPaperPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const label =
    current?.paperType
      ? `${current.paperType}${current.grammage ? ` ${current.grammage}` : ""}${current.size ? ` — ${current.size}` : ""}${current.side ? ` ${current.side}` : ""}`
      : "";

  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{kind}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative">
            <Input
              value={open ? query : label}
              placeholder={`Selecionar papel para ${kind.toLowerCase()}…`}
              onFocus={() => { setOpen(true); setQuery(""); }}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              className="h-9 text-sm pr-8"
            />
            {current && !open && (
              <button
                type="button"
                onClick={onClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
                title={`Remover ${kind}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="p-0 w-[var(--radix-popover-trigger-width)]"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {(() => {
                const q = query.toLowerCase().trim();
                const wantedSide = sideFromPrintColors(printColors);
                const matchesSide = (p: PrintingCatalogItem) => {
                  if (!wantedSide) return true;
                  const s = (p.side || "").toUpperCase();
                  if (wantedSide === "F/V") return s === "F/V" || s === "FV";
                  return s === "F" || s === "FRENTE" || s === "SIMPLES";
                };
                const baseBySide = printingCatalog.filter(matchesSide);
                const filtered = baseBySide
                  .filter((p) =>
                    !q ||
                    `${p.paper_type} ${p.grammage ?? ""} ${p.size} ${p.side} ${p.equipment_name ?? ""} ${p.category_name}`
                      .toLowerCase()
                      .includes(q),
                  )
                  .slice(0, 50);
                if (filtered.length === 0) {
                  if (wantedSide && baseBySide.length === 0) {
                    return (
                      <CommandEmpty>
                        Nenhum papel cadastrado para impressão {printColors}. Verifique a Cor da Impressão ou cadastre essa variante.
                      </CommandEmpty>
                    );
                  }
                  return <CommandEmpty>Nenhum papel encontrado.</CommandEmpty>;
                }
                return (
                  <CommandGroup heading={`Papel para ${kind}`}>
                    {filtered.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.id}
                        onSelect={() => {
                          onPick(p);
                          setOpen(false);
                          setQuery("");
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
  );
}
