import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeLabelLayout,
  computeSheetPricing,
  buildAnchoringLadder,
  findShrinkOpportunity,
  findGrowOpportunity,
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
import { suggestMarksOffset, buildCornerMarks, markSegments, MARK_ARM_MM, CROSS_VERT_LEN_MM } from "@/lib/labels/marks";
import { computeSignmasterLayout, computeSignmasterMarks, findSignmasterShrinkOpportunity, SM_REG_MARK_MARGIN, SM_LABEL_SPACING } from "@/lib/labels/signmaster-spec";
import { generateSignmasterPlt, downloadPlt } from "@/lib/labels/plt-export";
import { generateProductionPDF, downloadPDF } from "@/lib/labels/production-pdf";
import { useFolhaPricing } from "@/lib/labels/sheet-pricing";

const RECTANGULAR_SIGNMASTER_GAP_MM = 0;

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
/**
 * Input numérico que NÃO força "0" enquanto o usuário digita.
 * Mantém estado interno de string para permitir campo vazio temporariamente;
 * só propaga `onChange` quando há um número válido. Sincroniza com `value`
 * externo quando ele muda fora do componente (ex.: presets, troca de shape).
 */
function NumInput({ value, onChange, step = 1, className }: NumInputProps) {
  const [text, setText] = useState<string>(() =>
    Number.isFinite(value) && value !== 0 ? String(value) : Number.isFinite(value) ? String(value) : "",
  );
  const lastEmittedRef = useRef<number>(value);

  // Sincroniza quando `value` externo mudou (e não foi nós que emitimos)
  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      setText(Number.isFinite(value) ? String(value) : "");
      lastEmittedRef.current = value;
    }
  }, [value]);

  return (
    <Input
      type="number"
      inputMode="decimal"
      step={step}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === "" || raw === "-" || raw === ".") return; // estados intermediários
        const v = parseFloat(raw);
        if (Number.isFinite(v) && v >= 0) {
          lastEmittedRef.current = v;
          onChange(v);
        }
      }}
      onBlur={() => {
        if (text === "" || !Number.isFinite(parseFloat(text))) {
          // Ao sair do campo vazio, restaura o último valor válido
          setText(String(lastEmittedRef.current));
        }
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
    { id: "A4", label: "A4 21×29,7", w: 210, h: 297 },
    { id: "SRA3", label: "SRA3 32×45", w: 320, h: 450 },
    { id: "Formatao", label: "Formatão 32,8×47,8", w: 328, h: 478 },
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

  // ---- Detecta modo paramétrico SignMaster --------------------------------
  // A spec paramétrica (gap fixo de 3mm, sem regra ARMS) só é ativada
  // quando o usuário NÃO mexeu no gap padrão da spec. Se o usuário definiu
  // gap diferente de 3mm, caímos no caminho genérico (que respeita o gap
  // real e aplica a regra de remoção da 1ª linha para maximizar o
  // aproveitamento — ex.: Ø38mm gap 0 → 87 etiquetas).
  const isParametric =
    config.hardwareProfileId === "signmaster_param" &&
    config.cutType === "plotter_redondo" &&
    shape === "redondo" &&
    labelW === labelH &&
    config.gap === SM_LABEL_SPACING;

  const paramLayout = useMemo(
    () => isParametric
      ? computeSignmasterLayout({ sheetW: config.sheetW, sheetH: config.sheetH, labelDiameter: labelW })
      : null,
    [isParametric, config.sheetW, config.sheetH, labelW],
  );

  // ---- Cálculos ------------------------------------------------------------
  const effectiveGap =
    config.hardwareProfileId === "signmaster_param" && shape !== "redondo"
      ? RECTANGULAR_SIGNMASTER_GAP_MM
      : config.gap;

  const layoutInput: LayoutInput = {
    sheetW: config.sheetW,
    sheetH: config.sheetH,
    labelW,
    labelH,
    marginTop: config.marginTop,
    marginBottom: config.marginBottom,
    marginLeft: config.marginLeft,
    marginRight: config.marginRight,
    gap: effectiveGap,
    shape,
    cutType: config.cutType,
  };
  const layoutGeneric = computeLabelLayout(layoutInput);

  // No modo paramétrico, sobrescrevemos o resultado do layout genérico
  // mantendo a mesma forma de objeto para reuso do código abaixo.
  const layout = useMemo(() => {
    if (!paramLayout) return layoutGeneric;
    const cols = paramLayout.labelsPerRow;
    const rows = paramLayout.labelsPerColumn;
    const cellsPerRow = paramLayout.cellsPerRow;
    const rowOffsets = paramLayout.rowOffsets;
    const usedArea = paramLayout.total * labelW * labelH;
    const usableW = config.sheetW - 2 * SM_REG_MARK_MARGIN;
    const usableH = config.sheetH - 2 * SM_REG_MARK_MARGIN;
    const utilizationPct = usableW * usableH > 0 ? (usedArea / (usableW * usableH)) * 100 : 0;
    return {
      ...layoutGeneric,
      best: { cols, rows, total: paramLayout.total, rotated: false },
      optionA: { cols, rows, total: paramLayout.total, rotated: false },
      optionB: { cols: 0, rows: 0, total: 0, rotated: true },
      usableW,
      usableH,
      utilizationPct,
      reservedSlots: [],
      cellsPerRow,
      rowOffsets,
      effectivePerSheet: paramLayout.total,
    };
  }, [paramLayout, layoutGeneric, labelW, labelH, config.sheetW, config.sheetH]);

  const perSheet = layout.effectivePerSheet;
  const pricing = computeSheetPricing({
    pricePerSheet,
    qtyRequested: qty,
    perSheet,
  });
  const ladder = buildAnchoringLadder(qty, perSheet, pricePerSheet);
  const shrink = perSheet > 0
    ? (isParametric
        ? findSignmasterShrinkOpportunity(
            { sheetW: config.sheetW, sheetH: config.sheetH, labelDiameter: labelW },
            perSheet,
            pricing.sheetsNeeded || 1,
          )
        : findShrinkOpportunity(layoutInput, perSheet, pricing.sheetsNeeded || 1))
    : null;

  const applyShrink = () => {
    if (!shrink) return;
    setLabelW(shrink.newLabelW);
    setLabelH(shrink.newLabelH);
    if (shape === "quadrado" || shape === "redondo") {
      if (shrink.newLabelW !== shrink.newLabelH) setShape("personalizado");
    }
  };

  // ---- Aviso de "quase cabe +1 coluna" ------------------------------------
  // Quando sobra muito espaço lateral mas não o suficiente pra encaixar uma
  // coluna inteira, ajuda o usuário a entender por que reduzir o gap (ou a
  // etiqueta em poucos mm) destrava uma coluna nova.
  const nearMissColumn = useMemo(() => {
    const cols = layout.best.cols;
    if (cols <= 0 || perSheet <= 0) return null;
    const lblW = layout.best.rotated ? labelH : labelW;
    if (lblW <= 0) return null;
    // Em modo paramétrico, usableW vem do SignMaster (margens 7/7).
    const usableW = isParametric
      ? config.sheetW - 2 * SM_REG_MARK_MARGIN
      : layout.usableW;
    const usedW = cols * lblW + Math.max(0, cols - 1) * effectiveGap;
    const slack = usableW - usedW; // sobra lateral total (mm)
    const stepW = lblW + effectiveGap; // espaço necessário pra +1 coluna
    if (stepW <= 0) return null;
    const missingMm = stepW - slack; // quanto falta pra caber +1
    // Só mostra se REALMENTE falta pouco (<= 30% do passo) e o gap atual > 0
    // (se gap=0, não tem o que reduzir sem encolher a etiqueta).
    if (missingMm <= 0 || missingMm > stepW * 0.3) return null;
    if (effectiveGap <= 0) return null;
    // Quanto reduzir do gap pra liberar a coluna extra:
    //   novo passo: lblW + gap'  ; precisa que (cols+1)*lblW + cols*gap' <= usableW
    //   gap' <= (usableW - (cols+1)*lblW) / cols
    const newGap = Math.max(0, (usableW - (cols + 1) * lblW) / cols);
    if (newGap >= effectiveGap) return null;
    const extraRows = layout.best.rows;
    return {
      slackMm: Math.round(slack * 10) / 10,
      missingMm: Math.round(missingMm * 10) / 10,
      currentGap: effectiveGap,
      suggestedGap: Math.floor(newGap * 10) / 10, // arredonda PARA BAIXO
      extraPerSheet: extraRows, // +1 coluna × n linhas
    };
  }, [layout.best.cols, layout.best.rows, layout.best.rotated, layout.usableW, labelW, labelH, effectiveGap, perSheet, isParametric, config.sheetW]);

  const applyNearMissGap = () => {
    if (!nearMissColumn) return;
    const next = saveConfig({ gap: nearMissColumn.suggestedGap });
    setConfig(next);
    toast.success(
      `Gap reduzido para ${nearMissColumn.suggestedGap}mm — uma coluna a mais por folha`,
    );
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
      perSheet,
      pricePerSheet,
      printingLabel: folhaPricing.selectedPrinting
        ? `${folhaPricing.selectedPrinting.label}`
        : null,
      finishingLabel: folhaPricing.selectedFinishing.id
        ? folhaPricing.selectedFinishing.label
        : null,
    });
  }, [pricePerSheet, qty, perSheet, shape, labelW, labelH, pricing, ladder, folhaPricing.selectedPrinting, folhaPricing.selectedFinishing]);


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
    () => suggestMarksOffset(config.marginTop, layout.best.rotated ? labelW : labelH, effectiveGap, layout.best.rows),
    [config.marginTop, effectiveGap, layout.best.rows, layout.best.rotated, labelW, labelH],
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
        gap: effectiveGap,
        labelW,
        labelH,
        shape,
        layout,
        imageDataUrl,
        marksOffsetY: marksOffsetY - (config.sheetH / 2 - config.marginBottom),
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

  const handleExportPlt = () => {
    if (!paramLayout || paramLayout.total <= 0) {
      toast.error("Modo paramétrico não está ativo ou não cabem etiquetas.");
      return;
    }
    try {
      const plt = generateSignmasterPlt({
        sheetW: config.sheetW,
        sheetH: config.sheetH,
        labelDiameter: labelW,
        layout: paramLayout,
      });
      const slug = `redonda-${labelW}mm-${config.sheetW}x${config.sheetH}`;
      downloadPlt(plt, `faca-${slug}.plt`);
      toast.success("Faca .plt gerada — abra no SignMaster.");
    } catch (e) {
      console.error("[label-plt]", e);
      toast.error("Falha ao gerar .plt. Veja o console.");
    }
  };
  // Favoritos visíveis (até 6) + restantes em popover
  const FAV_VISIBLE = 6;
  const visibleFavs = config.labelPresets.slice(0, FAV_VISIBLE);
  const overflowFavs = config.labelPresets.slice(FAV_VISIBLE);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
      {/* ============================== SIMULADOR ============================== */}
      <div className="space-y-4">
        {/* 1. Faixa-resumo das configurações — TOPO da página */}
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Alterar configurações de folha e corte"
          className="w-full text-left rounded-md border border-border bg-card px-3 py-2.5 text-xs flex items-center justify-between gap-3 transition-colors hover:bg-muted/50"
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
          </span>
          <span className="flex items-center gap-1 text-primary shrink-0">
            <Settings2 className="h-3.5 w-3.5" />
            Configurações
          </span>
        </button>

        {/* 2. Seleção rápida de folha — Tabs */}
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
          <h3 className="text-sm font-semibold">Simulador</h3>

          {/* Favoritos sempre visíveis (até 6) */}
          {visibleFavs.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  Favoritos
                </Label>
                {overflowFavs.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 text-[11px]">
                        Ver todos ({config.labelPresets.length})
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-72 p-2">
                      <p className="text-[11px] text-muted-foreground px-2 pb-1.5">
                        Clique para carregar · lixeira para excluir
                      </p>
                      <div className="space-y-0.5 max-h-60 overflow-y-auto">
                        {config.labelPresets.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-1 rounded hover:bg-muted/60"
                          >
                            <button
                              type="button"
                              onClick={() => handleLoadPreset(p.id)}
                              className="flex-1 text-left text-xs px-2 py-1.5 truncate"
                            >
                              <span className="font-medium">{p.label}</span>
                              <span className="text-muted-foreground">
                                {" · "}{SHAPE_LABELS[p.shape]} · {p.width}×{p.height}mm
                              </span>
                            </button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive shrink-0"
                              onClick={() => handleRemoveFavorite(p.id, p.label)}
                              title={`Excluir "${p.label}"`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                {visibleFavs.map((p) => (
                  <div
                    key={p.id}
                    className="group relative rounded-md border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handleLoadPreset(p.id)}
                      className="w-full text-left px-2 py-1.5 pr-6"
                      title={`${p.label} — ${SHAPE_LABELS[p.shape]} ${p.width}×${p.height}mm`}
                    >
                      <div className="text-[11px] font-medium truncate leading-tight">
                        {p.label}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {p.width}×{p.height}mm
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFavorite(p.id, p.label);
                      }}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      title={`Excluir "${p.label}"`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                −{layout.reservedSlots.length} (zona de segurança 10mm)
              </Badge>
            )}
            <span className="text-muted-foreground">
              área útil {layout.usableW}×{layout.usableH}mm
            </span>
            <Badge
              variant="outline"
              className="gap-1 border-primary/40 text-primary"
              title={
                isParametric
                  ? "Modo paramétrico SignMaster: margens 7/7/7/7 mm, gap 3 mm, marcas L (topo) + T (base). Folhas soltas."
                  : `Margens ${config.marginTop}/${config.marginBottom}/${config.marginLeft}/${config.marginRight}mm · gap efetivo ${effectiveGap}mm`
              }
            >
              ⚙ {isParametric ? "SignMaster paramétrico · 7/7/7/7 · gap 3" : `${config.hardwareProfileId === "signmaster_param" ? "SignMaster" : config.hardwareProfileId === "teneth_a3" ? "Teneth A3" : config.hardwareProfileId} · ${config.marginTop}/${config.marginBottom}/${config.marginLeft}/${config.marginRight} · gap ${effectiveGap}`}
            </Badge>
          </div>

          <SheetPreview
            sheetW={config.sheetW}
            sheetH={config.sheetH}
            marginTop={config.marginTop}
            marginBottom={config.marginBottom}
            marginLeft={config.marginLeft}
            marginRight={config.marginRight}
            gap={effectiveGap}
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
            paramLayout={paramLayout}
          />

          {/* Slider de ajuste das marcas inferiores — começa no meio da folha, desce até a borda */}
          {!isParametric && (() => {
            const sliderMax = Math.max(0, config.sheetH / 2 - config.marginBottom);
            const clamped = Math.min(Math.max(marksOffsetY, 0), sliderMax);
            return (
              <div className="space-y-1.5 pt-2 border-t">
                <Label className="text-xs flex items-center gap-1.5">
                  <Crosshair className="h-3.5 w-3.5 text-primary" />
                  Ajuste vertical das marcas inferiores:{" "}
                  <strong>{(clamped / 10).toFixed(2)} cm</strong> do meio
                </Label>
                <Slider
                  value={[clamped]}
                  onValueChange={([v]) => setMarksOffsetY(v)}
                  min={0}
                  max={sliderMax || 1}
                  step={0.5}
                />
                <p className="text-[10px] text-muted-foreground">
                  Marcas começam no meio da folha. Arraste para descer até o rodapé (passo 0,5 mm).
                </p>
              </div>
            );
          })()}
        </Card>

        {/* Aviso: quase cabe +1 coluna (ajuste de gap) */}
        {nearMissColumn && (
          <Alert className="border-blue-400/50 bg-blue-50 dark:bg-blue-950/20">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-sm">Quase cabe mais uma coluna</AlertTitle>
            <AlertDescription className="text-xs space-y-2">
              <p>
                Sobram <strong>{nearMissColumn.slackMm}mm</strong> nas laterais — faltam só{" "}
                <strong>{nearMissColumn.missingMm}mm</strong> pra caber{" "}
                <strong>+1 coluna</strong> ({nearMissColumn.extraPerSheet} etiquetas a mais por folha).
              </p>
              <p className="text-muted-foreground">
                Reduzindo o gap de <strong>{nearMissColumn.currentGap}mm</strong> para{" "}
                <strong>{nearMissColumn.suggestedGap}mm</strong> a coluna extra entra.
              </p>
              <Button size="sm" variant="outline" onClick={applyNearMissGap} className="h-7 text-xs">
                <ArrowRight className="h-3 w-3 mr-1" />
                Reduzir gap para {nearMissColumn.suggestedGap}mm
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Otimizador */}
        {shrink && (
          <Alert className="border-amber-400/50 bg-amber-50 dark:bg-amber-950/20">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-sm">Dica de aproveitamento</AlertTitle>
            <AlertDescription className="text-xs space-y-2">
              {(() => {
                const isSquareNew = shrink.newLabelW === shrink.newLabelH;
                const sizeLabel = isSquareNew
                  ? `${shrink.newLabelW}mm`
                  : `${shrink.newLabelW}×${shrink.newLabelH}mm`;
                let deltaText = "";
                if (shrink.shrinkW > 0 && shrink.shrinkH > 0 && shrink.shrinkW === shrink.shrinkH) {
                  deltaText = `−${shrink.shrinkW}mm em cada lado`;
                } else if (shrink.shrinkW > 0 && shrink.shrinkH > 0) {
                  deltaText = `−${shrink.shrinkW}mm de largura e −${shrink.shrinkH}mm de altura`;
                } else if (shrink.shrinkW > 0) {
                  deltaText = `−${shrink.shrinkW}mm de largura`;
                } else if (shrink.shrinkH > 0) {
                  deltaText = `−${shrink.shrinkH}mm de altura`;
                }
                return (
                  <>
                    <p>
                      Se diminuir a etiqueta para <strong>{sizeLabel}</strong>
                      {deltaText && <> ({deltaText})</>}, cabem{" "}
                      <strong>{shrink.delta} etiquetas a mais por folha</strong>{" "}
                      (de {perSheet} para <strong>{shrink.newPerSheet}</strong>).
                    </p>
                    {pricing.sheetsNeeded > 0 && shrink.extraUnitsForSameSheets > 0 && (
                      <p>
                        Usando as mesmas {pricing.sheetsNeeded}{" "}
                        {pricing.sheetsNeeded === 1 ? "folha" : "folhas"} (mesmo custo de produção),
                        o cliente leva <strong>{shrink.extraUnitsForSameSheets} etiquetas a mais</strong>.
                      </p>
                    )}
                  </>
                );
              })()}
              <Button size="sm" variant="outline" onClick={applyShrink} className="h-7 text-xs">
                <ArrowRight className="h-3 w-3 mr-1" />
                Aplicar sugestão
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Pricing principal — SEMPRE VISÍVEL */}
        <Card className="p-4 space-y-3 border-primary/40 bg-primary/5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Cálculo do orçamento</h3>
            <a
              href="/preco-impressao"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
            >
              Editar tabelas <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Composição do preço da folha */}
          <div className="space-y-2 rounded-md border border-border bg-background/60 p-2.5">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Impressão (Tabela de Preços)</Label>
              {folhaPricing.printingOptions.length > 0 ? (
                <Select
                  value={folhaPricing.selectedPrinting?.id ?? ""}
                  onValueChange={folhaPricing.setPrintingId}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {folhaPricing.printingOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  ⚠ Sem item de impressão cadastrado para <strong>{sheetSizeKey}</strong>.{" "}
                  <a href="/preco-impressao" target="_blank" rel="noopener noreferrer" className="underline">
                    Cadastrar agora →
                  </a>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Acabamento (Recorte / outros)</Label>
              <Select
                value={folhaPricing.selectedFinishing.id ?? "__none__"}
                onValueChange={(v) => folhaPricing.setFinishingId(v as string)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {folhaPricing.finishingOptions.map((f) => (
                    <SelectItem key={f.id ?? "__none__"} value={f.id ?? "__none__"} className="text-xs">
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <a
                href="/acabamentos"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary hover:underline"
              >
                Editar acabamentos →
              </a>
            </div>

            <div className="flex items-center justify-between pt-1.5 border-t text-xs">
              <span className="text-muted-foreground">Total por folha:</span>
              <strong className="tabular-nums">{formatBRL(pricePerSheet)}</strong>
            </div>
          </div>

          {/* Resultado */}
          {pricePerSheet > 0 && qty > 0 && perSheet > 0 ? (
            <>
              <div className="text-sm">
                <span className="text-muted-foreground">{qty} un ÷ {perSheet}/folha = </span>
                <strong>{pricing.sheetsNeeded} {pricing.sheetsNeeded === 1 ? "folha" : "folhas"}</strong>
                <span className="text-muted-foreground"> × {formatBRL(pricePerSheet)} = </span>
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold text-primary">
                  {formatBRL(pricing.totalPrice)}
                </p>
                <p className="text-xs text-muted-foreground">
                  custo unitário <strong>{formatBRL(pricing.unitPrice)}</strong>
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {perSheet <= 0
                ? "Nenhuma etiqueta cabe na folha — ajuste medidas/margens."
                : qty <= 0
                ? "Informe a quantidade desejada para calcular o total."
                : "Selecione impressão e acabamento para ver o preço."}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyWhats}
              disabled={!whatsappText}
              title={!whatsappText ? "Faltam dados de preço/quantidade" : undefined}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copiar WhatsApp
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenWhats}
              disabled={!whatsappText}
              title={!whatsappText ? "Faltam dados de preço/quantidade" : undefined}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Abrir WhatsApp
            </Button>
          </div>

          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={handleGeneratePDF}
            disabled={generatingPdf || perSheet <= 0}
            title="Gera PDF 1:1 com página de impressão (K100) + página de faca CutContour (M100, 0.25pt)"
          >
            <FileDown className="h-3.5 w-3.5 mr-1.5" />
            {generatingPdf ? "Gerando…" : "Gerar PDF de produção (Impressão + Faca)"}
          </Button>

          {isParametric && perSheet > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={handleExportPlt}
              title="Exporta a faca de corte (1016 DPI, polígono 72 segmentos, marcas de registro inclusas)"
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5" />
              Baixar faca .plt (SignMaster)
            </Button>
          )}

          {onApply && pricing.sheetsNeeded > 0 && (
            <Button
              size="sm"
              className="w-full"
              onClick={() => onApply(pricing.sheetsNeeded)}
            >
              Usar {pricing.sheetsNeeded} {pricing.sheetsNeeded === 1 ? "folha" : "folhas"} no orçamento
            </Button>
          )}
        </Card>

        {/* Ancoragem */}
        {ladder.length > 0 && (
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-sm font-semibold">Sugestões de venda</h3>
            </div>
            {pricePerSheet <= 0 && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Cadastre o preço da folha em{" "}
                <a href="/preco-impressao" target="_blank" rel="noopener noreferrer" className="underline">
                  Preço Impressão
                </a>{" "}
                para ver os valores.
              </p>
            )}
            <div className="space-y-1.5 text-xs">
              {ladder.map((tier) => {
                const isBase = tier.label === "solicitada";
                const hasPrice = pricePerSheet > 0;
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
                      {tier.sheets} {tier.sheets === 1 ? "folha" : "folhas"}
                      {hasPrice && <> · {formatBRL(tier.unit)}/un</>}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      {hasPrice && (
                        <span className="font-semibold tabular-nums">{formatBRL(tier.total)}</span>
                      )}
                      {hasPrice && !isBase && tier.unitDeltaPct < 0 && (
                        <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 border-green-500/30 text-[10px]">
                          {formatPct(tier.unitDeltaPct, 0)}
                        </Badge>
                      )}
                      {hasPrice && !isBase && tier.unitDeltaPct === 0 && (
                        <Badge variant="outline" className="text-[10px]">0%</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {pricePerSheet > 0
                ? "Argumento de venda: o custo unitário cai conforme a quantidade aumenta, porque o custo fixo por folha é diluído."
                : "Referência de quantidades para upsell. Os valores aparecem assim que o preço da folha for cadastrado."}
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
  paramLayout: ReturnType<typeof computeSignmasterLayout> | null;
}

function SheetPreview({
  sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight,
  gap, labelW, labelH, cols, rows,
  shape, imageDataUrl, imageNaturalW, imageNaturalH,
  reservedSlots, rowOffsets, cellsPerRow, marksOffsetY, paramLayout,
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

  // Posições efetivas (apenas etiquetas vendáveis)
  const labels: Array<{ x: number; y: number }> = [];
  if (paramLayout) {
    for (const p of paramLayout.positions) {
      labels.push({ x: p.x * scale, y: p.y * scale });
    }
  } else {
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
  }

  const paramMarks = paramLayout
    ? computeSignmasterMarks({ sheetW, sheetH, gridBottom: paramLayout.gridBottom })
    : null;
  const bottomOffsetReal = marksOffsetY - (sheetH / 2 - marginBottom);
  const marks = buildCornerMarks(sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight, 0, MARK_ARM_MM, bottomOffsetReal);
  const totalSellable = paramLayout ? paramLayout.total : cellsPerRow.reduce((a, b) => a + b, 0);

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

        {/* Marcas de registro */}
        {paramMarks ? (
          // Modo paramétrico: L topo + T base, espessura 2 mm conforme spec
          <g stroke="black" strokeWidth={Math.max(0.6, 2 * scale)} strokeLinecap="butt" fill="none">
            {paramMarks.all.map((s, i) => (
              <line
                key={`pm-${i}`}
                x1={s.x1 * scale}
                y1={s.y1 * scale}
                x2={s.x2 * scale}
                y2={s.y2 * scale}
              />
            ))}
          </g>
        ) : (
          // Modo legado: marcas ARMS (L superiores + tick inferior)
          marks.marks.map((m, i) => {
            const segs = markSegments(m);
            const cap = (m.kind === "tick" || m.kind === "cross") ? "butt" : "round";
            const sw = m.kind === "tick" ? 0.8 : m.kind === "cross" ? 0.9 : 1;
            return (
              <g key={`mark-${i}`} stroke="black" strokeWidth={sw} strokeLinecap={cap} fill="none">
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
          })
        )}
      </svg>
    </div>
  );
}
