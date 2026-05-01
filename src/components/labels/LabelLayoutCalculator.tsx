import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeLabelLayout,
  computeSheetPricing,
  buildAnchoringLadder,
  findShrinkOpportunity,
  CUT_LABELS,
  SHEET_PRESETS,
  SHAPE_LABELS,
  type LabelShape,
  type LayoutInput,
} from "@/lib/labels/layout";
import {
  loadConfig,
  saveConfig,
  addLabelPreset,
  removeLabelPreset,
  type LabelCalcConfig,
  type LabelPreset,
} from "@/lib/labels/config-storage";
import { fitContain, aspectMismatch } from "@/lib/labels/image-fit";
import { formatWhatsAppQuote, describeLabel } from "@/lib/labels/whatsapp";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Lightbulb,
  RotateCw,
  ArrowRight,
  Sparkles,
  Settings2,
  Star,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  ImagePlus,
  X,
  Save,
  FileDown,
  Crosshair,
} from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { LabelCalcSettingsDialog } from "./LabelCalcSettingsDialog";
import { suggestMarksOffset, buildCornerMarks, markSegments, MARK_ARM_MM } from "@/lib/labels/marks";
import { generateProductionPDF, downloadPDF } from "@/lib/labels/production-pdf";
import { useFolhaPricing } from "@/lib/labels/sheet-pricing";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatPct = (n: number, digits = 1) =>
  `${n >= 0 ? "" : ""}${n.toFixed(digits)}%`;

// ---------- Conversão mm <-> unidade exibida --------------------------------
type LengthUnit = "mm" | "cm";
const toDisplay = (mm: number, unit: LengthUnit) => unit === "cm" ? mm / 10 : mm;
const fromDisplay = (val: number, unit: LengthUnit) => unit === "cm" ? val * 10 : val;
const unitStep = (unit: LengthUnit) => unit === "cm" ? 0.1 : 1;

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

// ---------- Resolve label da folha (preset fixo OU custom) -------------------
function describeSheet(cfg: LabelCalcConfig): string {
  const fixed = SHEET_PRESETS.find((p) => p.id === cfg.sheetPresetId);
  if (fixed) return `${fixed.id} (${fixed.width}×${fixed.height})`;
  const custom = cfg.customSheets.find((s) => s.id === cfg.sheetPresetId);
  if (custom) return `${custom.label} (${custom.width}×${custom.height})`;
  return `${cfg.sheetW}×${cfg.sheetH} mm`;
}

interface NumInputProps {
  value: number;
  onChange: (n: number) => void;
  step?: number;
  className?: string;
}
function NumInput({ value, onChange, step = 1, className }: NumInputProps) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        onChange(Number.isFinite(v) ? v : 0);
      }}
      className={className}
    />
  );
}

export interface LabelLayoutCalculatorProps {
  defaultSheet?: { width: number; height: number };
  defaultLabelW?: number;
  defaultLabelH?: number;
  defaultQty?: number;
  /** Quando definido, mostra botão "Usar X folhas" no card de pricing. */
  onApply?: (folhas: number) => void;
}

export function LabelLayoutCalculator({
  defaultSheet,
  defaultLabelW = 50,
  defaultLabelH = 50,
  defaultQty = 100,
  onApply,
}: LabelLayoutCalculatorProps) {
  // ---- Config persistida (folha, corte, margens, preço) -------------------
  const [config, setConfig] = useState<LabelCalcConfig>(() => {
    const cfg = loadConfig();
    // Se veio defaultSheet por prop, sobrepõe a folha SOMENTE para esta sessão
    if (defaultSheet) {
      const match = SHEET_PRESETS.find(
        (p) => p.width === defaultSheet.width && p.height === defaultSheet.height,
      );
      return {
        ...cfg,
        sheetW: defaultSheet.width,
        sheetH: defaultSheet.height,
        sheetPresetId: match?.id ?? "__custom__",
      };
    }
    return cfg;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ---- Simulador (não persiste) -------------------------------------------
  const inferShape = (w: number, h: number): LabelShape =>
    w === h ? "quadrado" : "personalizado";
  const [shape, setShape] = useState<LabelShape>(() =>
    inferShape(defaultLabelW, defaultLabelH),
  );
  const [labelW, setLabelW] = useState(defaultLabelW);
  const [labelH, setLabelH] = useState(defaultLabelH);
  const [qty, setQty] = useState(defaultQty);

  // ---- Imagem opcional (só em memória) ------------------------------------
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Salvar como favorito (popover) -------------------------------------
  const [favPopoverOpen, setFavPopoverOpen] = useState(false);
  const [favName, setFavName] = useState("");

  // ---- Ajuste fino das marcas ARMS (não persiste — por job) ---------------
  const [marksOffsetY, setMarksOffsetY] = useState(0);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Quando troca de formato, mantém medidas coerentes
  const handleShapeChange = (next: string) => {
    if (!next) return;
    const s = next as LabelShape;
    setShape(s);
    if (s === "quadrado" || s === "redondo") {
      // força W = H usando o W atual
      setLabelH(labelW);
    }
  };

  const handleSideChange = (v: number) => {
    setLabelW(v);
    setLabelH(v);
  };

  const handleLoadPreset = (id: string) => {
    if (id === "__none__") return;
    const preset = config.labelPresets.find((p) => p.id === id);
    if (!preset) return;
    setShape(preset.shape);
    setLabelW(preset.width);
    setLabelH(preset.height);
    toast.success(`Carregado: ${preset.label}`);
  };

  const handleSaveFavorite = () => {
    const name = favName.trim();
    if (!name) {
      toast.error("Dê um nome para o favorito");
      return;
    }
    addLabelPreset({ label: name, shape, width: labelW, height: labelH });
    setConfig(loadConfig());
    setFavPopoverOpen(false);
    setFavName("");
    toast.success("Favorito salvo");
  };

  const handleRemoveFavorite = (id: string, label: string) => {
    removeLabelPreset(id);
    setConfig(loadConfig());
    toast.success(`Removido: ${label}`);
  };

  // ---- Troca rápida de folha (Tabs) ----------------------------------------
  const QUICK_SHEETS: Array<{ id: string; label: string; w: number; h: number }> = [
    { id: "SRA3", label: "32×45 (SRA3)", w: 320, h: 450 },
    { id: "A4", label: "A4 21×29.7", w: 210, h: 297 },
    { id: "A3", label: "A3 29.7×42", w: 297, h: 420 },
    { id: "330x480", label: "33×48", w: 330, h: 480 },
  ];
  const currentSheetTab = useMemo(() => {
    const m = QUICK_SHEETS.find(
      (s) => s.w === config.sheetW && s.h === config.sheetH,
    );
    return m?.id ?? "__other__";
  }, [config.sheetW, config.sheetH]);

  const handleQuickSheet = (id: string) => {
    if (id === "__other__") {
      setSettingsOpen(true);
      return;
    }
    const s = QUICK_SHEETS.find((x) => x.id === id);
    if (!s) return;
    const next = saveConfig({ sheetPresetId: s.id, sheetW: s.w, sheetH: s.h });
    setConfig(next);
    setMarksOffsetY(0);
    toast.success(`Folha alterada para ${s.label} — cálculo atualizado`);
  };

  // Mapeia o tamanho da folha para a chave usada nas tabelas de preço.
  const sheetSizeKey = useMemo(() => {
    const m = QUICK_SHEETS.find((x) => x.w === config.sheetW && x.h === config.sheetH);
    return m?.id ?? "SRA3";
  }, [config.sheetW, config.sheetH]);

  const folhaPricing = useFolhaPricing(sheetSizeKey);
  const pricePerSheet = folhaPricing.total;

  // ---- Imagem upload -------------------------------------------------------
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      toast.error("Formato inválido. Use PNG, JPG ou WEBP.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Imagem muito grande. Máximo 2 MB.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        setImageDataUrl(dataUrl);
        setImageName(file.name);
        setImageDims({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => toast.error("Não consegui ler essa imagem.");
      img.src = dataUrl;
    };
    reader.onerror = () => toast.error("Falha ao carregar a imagem.");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removeImage = () => {
    setImageDataUrl(null);
    setImageName(null);
    setImageDims(null);
  };

  // ---- Cálculos ------------------------------------------------------------
  const layoutInput: LayoutInput = {
    sheetW: config.sheetW,
    sheetH: config.sheetH,
    labelW,
    labelH,
    marginTop: config.marginTop,
    marginBottom: config.marginBottom,
    marginLeft: config.marginLeft,
    marginRight: config.marginRight,
    gap: config.gap,
    shape,
    cutType: config.cutType,
  };
  const layout = computeLabelLayout(layoutInput);
  const perSheet = layout.effectivePerSheet;
  const pricing = computeSheetPricing({
    pricePerSheet,
    qtyRequested: qty,
    perSheet,
  });
  const ladder = buildAnchoringLadder(qty, perSheet, pricePerSheet);
  const shrink = perSheet > 0
    ? findShrinkOpportunity(layoutInput, perSheet, pricing.sheetsNeeded || 1)
    : null;

  const applyShrink = () => {
    if (!shrink) return;
    setLabelW(shrink.newLabelW);
    setLabelH(shrink.newLabelH);
    if (shape === "quadrado" || shape === "redondo") {
      if (shrink.newLabelW !== shrink.newLabelH) setShape("personalizado");
    }
  };

  // ---- Aviso de proporção divergente --------------------------------------
  const showAspectWarning = useMemo(() => {
    if (!imageDims) return false;
    return aspectMismatch(imageDims.w, imageDims.h, labelW, labelH, 0.05);
  }, [imageDims, labelW, labelH]);

  // ---- WhatsApp ------------------------------------------------------------
  const whatsappText = useMemo(() => {
    if (pricePerSheet <= 0 || qty <= 0 || perSheet <= 0) return "";
    return formatWhatsAppQuote({
      qty,
      shape,
      width: labelW,
      height: labelH,
      pricing,
      ladder,
    });
  }, [pricePerSheet, qty, perSheet, shape, labelW, labelH, pricing, ladder]);


  const handleCopyWhats = async () => {
    if (!whatsappText) return;
    try {
      await navigator.clipboard.writeText(whatsappText);
      toast.success("Copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar. Tente abrir o WhatsApp.");
    }
  };

  const handleOpenWhats = () => {
    if (!whatsappText) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappText)}`, "_blank", "noopener,noreferrer");
  };

  // ---- Sugestão de offset das marcas + geração de PDF --------------------
  const suggestedOffset = useMemo(
    () => suggestMarksOffset(config.marginTop, layout.best.rotated ? labelW : labelH, config.gap, layout.best.rows),
    [config.marginTop, config.gap, layout.best.rows, layout.best.rotated, labelW, labelH],
  );

  const applySuggestedOffset = () => {
    setMarksOffsetY(suggestedOffset);
    toast.success(`Offset aplicado: ${suggestedOffset > 0 ? "+" : ""}${suggestedOffset}mm`);
  };

  const handleGeneratePDF = async () => {
    if (perSheet <= 0) {
      toast.error("Nenhuma etiqueta cabe na folha — ajuste antes de gerar o PDF.");
      return;
    }
    setGeneratingPdf(true);
    try {
      const blob = await generateProductionPDF({
        sheetW: config.sheetW,
        sheetH: config.sheetH,
        marginTop: config.marginTop,
        marginBottom: config.marginBottom,
        marginLeft: config.marginLeft,
        marginRight: config.marginRight,
        gap: config.gap,
        labelW,
        labelH,
        shape,
        layout,
        imageDataUrl,
        marksOffsetY,
        jobName: `Etiqueta ${describeLabel(shape, labelW, labelH)} · ${qty}un`,
      });
      const slug = describeLabel(shape, labelW, labelH).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      downloadPDF(blob, `producao-${slug}.pdf`);
      toast.success("PDF gerado — abra no SignMaster para o corte.");
    } catch (e) {
      console.error("[label-pdf]", e);
      toast.error("Falha ao gerar PDF. Veja o console.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ---- Render --------------------------------------------------------------
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
      {/* ============================== SIMULADOR ============================== */}
      <div className="space-y-4">
        {/* Seleção rápida de folha — Tabs */}
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Label className="text-xs text-muted-foreground">Folha:</Label>
            <span className="text-xs font-medium">{describeSheet(config)}</span>
          </div>
          <ToggleGroup
            type="single"
            value={currentSheetTab}
            onValueChange={(v) => v && handleQuickSheet(v)}
            className="grid grid-cols-2 sm:grid-cols-5 gap-1.5"
          >
            {QUICK_SHEETS.map((s) => (
              <ToggleGroupItem
                key={s.id}
                value={s.id}
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border h-9 text-xs"
              >
                {s.label}
              </ToggleGroupItem>
            ))}
            <ToggleGroupItem
              value="__other__"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border h-9 text-xs"
            >
              Outro…
            </ToggleGroupItem>
          </ToggleGroup>
        </Card>

        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Simulador</h3>
            {/* Carregar favorito */}
            {config.labelPresets.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-amber-500" />
                <Select onValueChange={handleLoadPreset} value="__none__">
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue placeholder="Carregar favorito…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" disabled>
                      Carregar favorito…
                    </SelectItem>
                    {config.labelPresets.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label} · {SHAPE_LABELS[p.shape]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Formato */}
          <div className="space-y-1.5">
            <Label className="text-xs">Formato da etiqueta</Label>
            <ToggleGroup
              type="single"
              value={shape}
              onValueChange={handleShapeChange}
              className="grid grid-cols-3 gap-2"
            >
              {(Object.keys(SHAPE_LABELS) as LabelShape[]).map((s) => (
                <ToggleGroupItem
                  key={s}
                  value={s}
                  className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border h-9 text-xs"
                >
                  {SHAPE_LABELS[s]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Tamanho */}
          {shape === "personalizado" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Largura ({config.unit})</Label>
                <NumInput
                  value={toDisplay(labelW, config.unit)}
                  step={unitStep(config.unit)}
                  onChange={(v) => setLabelW(fromDisplay(v, config.unit))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Altura ({config.unit})</Label>
                <NumInput
                  value={toDisplay(labelH, config.unit)}
                  step={unitStep(config.unit)}
                  onChange={(v) => setLabelH(fromDisplay(v, config.unit))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 sm:max-w-[200px]">
              <Label className="text-xs">
                {shape === "redondo" ? `Diâmetro (${config.unit})` : `Lado (${config.unit})`}
              </Label>
              <NumInput
                value={toDisplay(labelW, config.unit)}
                step={unitStep(config.unit)}
                onChange={(v) => handleSideChange(fromDisplay(v, config.unit))}
              />
            </div>
          )}

          {/* Quantidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Quantidade desejada</Label>
              <NumInput value={qty} onChange={setQty} />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <Popover open={favPopoverOpen} onOpenChange={setFavPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Salvar como favorito
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 space-y-2">
                  <Label className="text-xs">Nome do favorito</Label>
                  <Input
                    value={favName}
                    onChange={(e) => setFavName(e.target.value)}
                    placeholder={`Ex.: ${describeLabel(shape, labelW, labelH)}`}
                    autoFocus
                  />
                  <Button size="sm" className="w-full" onClick={handleSaveFavorite}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Salvar
                  </Button>
                  {config.labelPresets.length > 0 && (
                    <>
                      <div className="border-t pt-2 mt-2 space-y-1 max-h-40 overflow-y-auto">
                        <p className="text-[11px] text-muted-foreground">
                          Favoritos salvos:
                        </p>
                        {config.labelPresets.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-xs gap-2"
                          >
                            <span className="truncate">
                              {p.label} · {p.width}×{p.height}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-destructive"
                              onClick={() => handleRemoveFavorite(p.id, p.label)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Imagem opcional */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs flex items-center gap-1.5">
              <ImagePlus className="h-3.5 w-3.5 text-primary" />
              Arte da etiqueta (opcional)
            </Label>
            {!imageDataUrl ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleImageChange}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
                  Carregar imagem (PNG/JPG/WEBP, até 2 MB)
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs max-w-[260px] truncate">
                  {imageName}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={removeImage}
                  className="h-7 text-xs text-destructive"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Remover
                </Button>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              A imagem é só para visualização — o cálculo usa apenas as medidas informadas.
            </p>
            {showAspectWarning && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                ⚠ Sua arte tem proporção diferente da etiqueta — vai sobrar espaço nas laterais (ou topo/base).
              </p>
            )}
          </div>
        </Card>

        {/* Faixa-resumo das configurações */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Alterar configurações de folha, corte e preço"
          className={
            "w-full text-left rounded-md border px-3 py-2.5 text-xs flex items-center justify-between gap-3 transition-colors hover:bg-muted/50 " +
            (config.pricePerSheet <= 0
              ? "border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20"
              : "border-border bg-card")
          }
        >
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
            <span>
              <span className="text-muted-foreground">Folha:</span>{" "}
              <strong>{describeSheet(config)}</strong>
            </span>
            <span>
              <span className="text-muted-foreground">Corte:</span>{" "}
              <strong>{CUT_LABELS[config.cutType]}</strong>
            </span>
            <span>
              <span className="text-muted-foreground">Preço:</span>{" "}
              {config.pricePerSheet > 0 ? (
                <strong>{formatBRL(config.pricePerSheet)}/folha</strong>
              ) : (
                <strong className="text-amber-700 dark:text-amber-400">
                  configurar →
                </strong>
              )}
            </span>
          </span>
          <span className="flex items-center gap-1 text-primary shrink-0">
            <Settings2 className="h-3.5 w-3.5" />
            Configurações
          </span>
        </button>
      </div>

      {/* ============================== RESULTADOS ============================== */}
      <div className="space-y-4">
        {/* Aproveitamento */}
        <Card className="p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-3xl font-bold text-primary leading-none">
                {perSheet}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                etiquetas por folha
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">
                {layout.utilizationPct.toFixed(1)}%
              </p>
              <p className="text-[11px] text-muted-foreground">aproveitamento</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="secondary">
              {layout.best.cols} × {layout.best.rows}
            </Badge>
            <Badge variant={layout.best.rotated ? "default" : "outline"} className="gap-1">
              {layout.best.rotated && <RotateCw className="h-3 w-3" />}
              {layout.best.rotated ? "Etiqueta rotacionada 90°" : "Etiqueta em pé"}
            </Badge>
            {layout.reservedSlots.length > 0 && (
              <Badge variant="outline" className="gap-1 text-amber-700 dark:text-amber-400 border-amber-400/60">
                <Crosshair className="h-3 w-3" />
                −{layout.reservedSlots.length} p/ marcas ARMS
              </Badge>
            )}
            <span className="text-muted-foreground">
              área útil {layout.usableW}×{layout.usableH}mm
            </span>
          </div>

          <SheetPreview
            sheetW={config.sheetW}
            sheetH={config.sheetH}
            marginTop={config.marginTop}
            marginBottom={config.marginBottom}
            marginLeft={config.marginLeft}
            marginRight={config.marginRight}
            gap={config.gap}
            labelW={layout.best.rotated ? labelH : labelW}
            labelH={layout.best.rotated ? labelW : labelH}
            cols={layout.best.cols}
            rows={layout.best.rows}
            shape={shape}
            imageDataUrl={imageDataUrl}
            imageNaturalW={imageDims?.w ?? null}
            imageNaturalH={imageDims?.h ?? null}
            reservedSlots={layout.reservedSlots}
            rowOffsets={layout.rowOffsets}
            cellsPerRow={layout.cellsPerRow}
            marksOffsetY={marksOffsetY}
          />

          {/* Slider de ajuste das marcas ARMS */}
          {layout.reservedSlots.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <Crosshair className="h-3.5 w-3.5 text-primary" />
                  Ajuste vertical das marcas: <strong>{marksOffsetY > 0 ? "+" : ""}{marksOffsetY}mm</strong>
                </Label>
                {Math.abs(suggestedOffset) > 0.1 && Math.abs(suggestedOffset - marksOffsetY) > 0.1 && (
                  <Button size="sm" variant="ghost" className="h-6 text-[11px]" onClick={applySuggestedOffset}>
                    Sugerir {suggestedOffset > 0 ? "+" : ""}{suggestedOffset}mm
                  </Button>
                )}
              </div>
              <Slider
                value={[marksOffsetY]}
                onValueChange={([v]) => setMarksOffsetY(v)}
                min={-10}
                max={10}
                step={0.5}
              />
              <p className="text-[10px] text-muted-foreground">
                Move o conjunto das marcas pra cima/baixo evitando sobreposição com a arte.
              </p>
            </div>
          )}
        </Card>

        {/* Otimizador */}
        {shrink && (
          <Alert className="border-amber-400/50 bg-amber-50 dark:bg-amber-950/20">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-sm">Dica de aproveitamento</AlertTitle>
            <AlertDescription className="text-xs space-y-2">
              <p>
                Reduzindo a etiqueta para{" "}
                <strong>{shrink.newLabelW}×{shrink.newLabelH}mm</strong>{" "}
                {shrink.shrinkW || shrink.shrinkH ? (
                  <span className="text-muted-foreground">
                    (−{shrink.shrinkW}mm × −{shrink.shrinkH}mm)
                  </span>
                ) : null}{" "}
                cabem <strong>+{shrink.delta} etiquetas por folha</strong>.
                {pricing.sheetsNeeded > 0 && (
                  <> Pelo mesmo custo de produção ({pricing.sheetsNeeded}{" "}
                  {pricing.sheetsNeeded === 1 ? "folha" : "folhas"}), o cliente leva{" "}
                  <strong>+{shrink.extraUnitsForSameSheets} etiquetas</strong>.</>
                )}
              </p>
              <Button size="sm" variant="outline" onClick={applyShrink} className="h-7 text-xs">
                <ArrowRight className="h-3 w-3 mr-1" />
                Aplicar sugestão
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Pricing principal */}
        {config.pricePerSheet > 0 && qty > 0 && perSheet > 0 && (
          <Card className="p-4 space-y-3 border-primary/40 bg-primary/5">
            <h3 className="text-sm font-semibold">Cálculo do orçamento</h3>
            <div className="text-sm">
              <span className="text-muted-foreground">{qty} un ÷ {perSheet}/folha = </span>
              <strong>{pricing.sheetsNeeded} {pricing.sheetsNeeded === 1 ? "folha" : "folhas"}</strong>
              <span className="text-muted-foreground"> × {formatBRL(config.pricePerSheet)} = </span>
            </div>
            <div className="flex items-baseline justify-between">
              <p className="text-2xl font-bold text-primary">
                {formatBRL(pricing.totalPrice)}
              </p>
              <p className="text-xs text-muted-foreground">
                custo unitário <strong>{formatBRL(pricing.unitPrice)}</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={handleCopyWhats}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copiar WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={handleOpenWhats}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Abrir WhatsApp
              </Button>
            </div>

            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={handleGeneratePDF}
              disabled={generatingPdf}
              title="Gera PDF 1:1 com página de impressão (K100) + página de faca CutContour (M100, 0.25pt)"
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              {generatingPdf ? "Gerando…" : "Gerar PDF de produção (Impressão + Faca)"}
            </Button>

            {onApply && (
              <Button
                size="sm"
                className="w-full"
                onClick={() => onApply(pricing.sheetsNeeded)}
              >
                Usar {pricing.sheetsNeeded} {pricing.sheetsNeeded === 1 ? "folha" : "folhas"} no orçamento
              </Button>
            )}
          </Card>
        )}

        {/* Ancoragem */}
        {ladder.length > 0 && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-sm font-semibold">Sugestões de venda</h3>
            </div>
            <div className="space-y-1.5 text-xs">
              {ladder.map((tier) => {
                const isBase = tier.label === "solicitada";
                return (
                  <div
                    key={tier.qty}
                    className={
                      "grid grid-cols-[auto_1fr_auto] gap-2 items-center px-2 py-1.5 rounded-md " +
                      (isBase ? "bg-muted/60" : "")
                    }
                  >
                    <div className="font-semibold tabular-nums w-16">
                      {tier.qty} un
                    </div>
                    <div className="text-muted-foreground tabular-nums">
                      {tier.sheets} {tier.sheets === 1 ? "folha" : "folhas"} · {formatBRL(tier.unit)}/un
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <span className="font-semibold tabular-nums">{formatBRL(tier.total)}</span>
                      {!isBase && tier.unitDeltaPct < 0 && (
                        <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 border-green-500/30 text-[10px]">
                          {formatPct(tier.unitDeltaPct, 0)}
                        </Badge>
                      )}
                      {!isBase && tier.unitDeltaPct === 0 && (
                        <Badge variant="outline" className="text-[10px]">0%</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Argumento de venda: o custo unitário cai conforme a quantidade aumenta,
              porque o custo fixo por folha é diluído.
            </p>
          </Card>
        )}
      </div>

      {/* Settings dialog */}
      <LabelCalcSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={(cfg) => setConfig(cfg)}
      />
    </div>
  );
}

// =============================================================================
// Preview SVG da folha + grade de etiquetas (com suporte a shape + imagem)
// =============================================================================

interface SheetPreviewProps {
  sheetW: number;
  sheetH: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  gap: number;
  labelW: number;
  labelH: number;
  cols: number;
  rows: number;
  shape: LabelShape;
  imageDataUrl: string | null;
  imageNaturalW: number | null;
  imageNaturalH: number | null;
  reservedSlots: Array<{ col: number; row: number }>;
  rowOffsets: number[];
  cellsPerRow: number[];
  marksOffsetY: number;
}

function SheetPreview({
  sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight,
  gap, labelW, labelH, cols, rows,
  shape, imageDataUrl, imageNaturalW, imageNaturalH,
  reservedSlots, rowOffsets, cellsPerRow, marksOffsetY,
}: SheetPreviewProps) {
  const MAX = 320;
  const scale = Math.min(MAX / sheetW, MAX / sheetH);
  const w = sheetW * scale;
  const h = sheetH * scale;

  const isRound = shape === "redondo";
  const labelWPx = labelW * scale;
  const labelHPx = labelH * scale;

  const fit = imageDataUrl && imageNaturalW && imageNaturalH
    ? fitContain(imageNaturalW, imageNaturalH, labelWPx, labelHPx)
    : null;

  // Posições efetivas (apenas etiquetas vendáveis), respeitando rowOffsets
  const labels: Array<{ x: number; y: number }> = [];
  for (let r = 0; r < rows; r++) {
    const cellsInRow = cellsPerRow[r] ?? cols;
    const baseX = (rowOffsets[r] ?? marginLeft) * scale;
    const yPx = (marginTop + r * (labelH + gap)) * scale;
    for (let c = 0; c < cellsInRow; c++) {
      labels.push({
        x: baseX + c * (labelW + gap) * scale,
        y: yPx,
      });
    }
  }

  const marks = buildCornerMarks(sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight, marksOffsetY, MARK_ARM_MM);
  const totalSellable = cellsPerRow.reduce((a, b) => a + b, 0);

  return (
    <div className="flex justify-center bg-muted/30 rounded-md p-3">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="border border-border bg-background shadow-sm"
        role="img"
        aria-label={`Preview de ${totalSellable} etiquetas vendáveis na folha`}
      >
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.15" strokeWidth="2" />
          </pattern>
          {isRound && (
            <clipPath id="label-circle-clip" clipPathUnits="userSpaceOnUse">
              <circle cx={labelWPx / 2} cy={labelHPx / 2} r={Math.min(labelWPx, labelHPx) / 2} />
            </clipPath>
          )}
        </defs>

        <rect x="0" y="0" width={w} height={h} fill="url(#hatch)" />
        <rect
          x={marginLeft * scale}
          y={marginTop * scale}
          width={(sheetW - marginLeft - marginRight) * scale}
          height={(sheetH - marginTop - marginBottom) * scale}
          fill="hsl(var(--background))"
          stroke="hsl(var(--border))"
          strokeDasharray="3 3"
        />

        {labels.map((l, i) => (
          <g key={i} transform={`translate(${l.x} ${l.y})`}>
            {isRound ? (
              <circle
                cx={labelWPx / 2}
                cy={labelHPx / 2}
                r={Math.min(labelWPx, labelHPx) / 2}
                fill="hsl(var(--primary) / 0.10)"
                stroke="hsl(var(--primary))"
                strokeWidth="0.8"
              />
            ) : (
              <rect
                x={0}
                y={0}
                width={labelWPx}
                height={labelHPx}
                fill="hsl(var(--primary) / 0.10)"
                stroke="hsl(var(--primary))"
                strokeWidth="0.8"
                rx="1"
              />
            )}
            {fit && (
              <image
                href={imageDataUrl ?? ""}
                x={fit.offsetX}
                y={fit.offsetY}
                width={fit.width}
                height={fit.height}
                preserveAspectRatio="xMidYMid meet"
                clipPath={isRound ? "url(#label-circle-clip)" : undefined}
              />
            )}
          </g>
        ))}

        {/* Marcas de registro: L (TL/TR) + tick (BL/BR) — K100 0.5pt */}
        {marks.marks.map((m, i) => {
          const segs = markSegments(m);
          return (
            <g key={`mark-${i}`} stroke="black" strokeWidth="1" strokeLinecap="round" fill="none">
              {segs.map((s, j) => (
                <line
                  key={j}
                  x1={s.x1 * scale}
                  y1={s.y1 * scale}
                  x2={s.x2 * scale}
                  y2={s.y2 * scale}
                />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
