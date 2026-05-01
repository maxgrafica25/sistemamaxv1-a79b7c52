import { useEffect, useMemo, useState } from "react";
import {
  computeLabelLayout,
  computeSheetPricing,
  buildAnchoringLadder,
  findShrinkOpportunity,
  CUT_DEFAULTS,
  CUT_LABELS,
  SHEET_PRESETS,
  type CutType,
  type LayoutInput,
} from "@/lib/labels/layout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { Lightbulb, RotateCw, ArrowRight, Sparkles } from "lucide-react";

const STORAGE_KEY_PRICE = "labelCalc:lastPricePerSheet";
const CUSTOM_SHEET_ID = "__custom__";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatPct = (n: number, digits = 1) =>
  `${n >= 0 ? "" : ""}${n.toFixed(digits)}%`;

interface NumInputProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  step?: number;
  className?: string;
  id?: string;
}
function NumInput({ value, onChange, min = 0, step = 1, className, id }: NumInputProps) {
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
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
  // ---- Folha ----
  const initialPreset = useMemo(() => {
    if (defaultSheet) {
      const match = SHEET_PRESETS.find(
        (p) => p.width === defaultSheet.width && p.height === defaultSheet.height,
      );
      return match?.id ?? CUSTOM_SHEET_ID;
    }
    return "A4";
  }, [defaultSheet]);
  const [sheetPresetId, setSheetPresetId] = useState<string>(initialPreset);
  const [sheetW, setSheetW] = useState<number>(defaultSheet?.width ?? 210);
  const [sheetH, setSheetH] = useState<number>(defaultSheet?.height ?? 297);

  useEffect(() => {
    if (sheetPresetId === CUSTOM_SHEET_ID) return;
    const preset = SHEET_PRESETS.find((p) => p.id === sheetPresetId);
    if (preset) {
      setSheetW(preset.width);
      setSheetH(preset.height);
    }
  }, [sheetPresetId]);

  // ---- Tipo de corte + margens direcionais + gap ----
  const [cutType, setCutType] = useState<CutType>("corte_reto");
  const [marginTop, setMarginTop] = useState(CUT_DEFAULTS.corte_reto.marginTop);
  const [marginBottom, setMarginBottom] = useState(CUT_DEFAULTS.corte_reto.marginBottom);
  const [marginLeft, setMarginLeft] = useState(CUT_DEFAULTS.corte_reto.marginLeft);
  const [marginRight, setMarginRight] = useState(CUT_DEFAULTS.corte_reto.marginRight);
  const [gap, setGap] = useState(CUT_DEFAULTS.corte_reto.gap);

  const applyCutDefaults = (type: CutType) => {
    const d = CUT_DEFAULTS[type];
    setMarginTop(d.marginTop);
    setMarginBottom(d.marginBottom);
    setMarginLeft(d.marginLeft);
    setMarginRight(d.marginRight);
    setGap(d.gap);
  };

  const handleCutChange = (next: string) => {
    if (!next) return;
    const t = next as CutType;
    setCutType(t);
    applyCutDefaults(t);
  };

  // ---- Etiqueta + qty ----
  const [labelW, setLabelW] = useState(defaultLabelW);
  const [labelH, setLabelH] = useState(defaultLabelH);
  const [qty, setQty] = useState(defaultQty);

  // ---- Preço por folha (persistido) ----
  const [pricePerSheet, setPricePerSheet] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const v = parseFloat(localStorage.getItem(STORAGE_KEY_PRICE) ?? "0");
    return Number.isFinite(v) ? v : 0;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pricePerSheet > 0) {
      localStorage.setItem(STORAGE_KEY_PRICE, String(pricePerSheet));
    }
  }, [pricePerSheet]);

  // ---- Cálculos ----
  const layoutInput: LayoutInput = {
    sheetW, sheetH, labelW, labelH,
    marginTop, marginBottom, marginLeft, marginRight, gap,
  };
  const layout = computeLabelLayout(layoutInput);
  const perSheet = layout.best.total;
  const pricing = computeSheetPricing({ pricePerSheet, qtyRequested: qty, perSheet });
  const ladder = buildAnchoringLadder(qty, perSheet, pricePerSheet);
  const shrink = perSheet > 0
    ? findShrinkOpportunity(layoutInput, perSheet, pricing.sheetsNeeded || 1)
    : null;

  const applyShrink = () => {
    if (!shrink) return;
    setLabelW(shrink.newLabelW);
    setLabelH(shrink.newLabelH);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* ============================== CONTROLES ============================== */}
      <div className="space-y-5">
        {/* Folha */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Folha de impressão</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1.5">
              <Label className="text-xs">Tamanho</Label>
              <Select value={sheetPresetId} onValueChange={setSheetPresetId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHEET_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_SHEET_ID}>Personalizado…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Largura (mm)</Label>
              <NumInput
                value={sheetW}
                onChange={(v) => { setSheetW(v); setSheetPresetId(CUSTOM_SHEET_ID); }}
                className="w-24"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Altura (mm)</Label>
              <NumInput
                value={sheetH}
                onChange={(v) => { setSheetH(v); setSheetPresetId(CUSTOM_SHEET_ID); }}
                className="w-24"
              />
            </div>
          </div>
        </Card>

        {/* Tipo de corte + margens */}
        <Card className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Tipo de corte e margens</h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => applyCutDefaults(cutType)}
              title="Restaurar margens padrão deste tipo de corte"
            >
              <RotateCw className="h-3 w-3 mr-1" /> Restaurar padrões
            </Button>
          </div>

          <ToggleGroup
            type="single"
            value={cutType}
            onValueChange={handleCutChange}
            className="grid grid-cols-3 gap-2"
          >
            {(Object.keys(CUT_LABELS) as CutType[]).map((t) => (
              <ToggleGroupItem
                key={t}
                value={t}
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border h-auto py-2 text-xs"
              >
                {CUT_LABELS[t]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Margens direcionais (mm)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Topo</Label>
                <NumInput value={marginTop} onChange={setMarginTop} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Base</Label>
                <NumInput value={marginBottom} onChange={setMarginBottom} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Esquerda</Label>
                <NumInput value={marginLeft} onChange={setMarginLeft} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Direita</Label>
                <NumInput value={marginRight} onChange={setMarginRight} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A marca de registro normalmente exige margem maior no topo e na base.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Espaçamento entre etiquetas — gap (mm)</Label>
            <NumInput value={gap} onChange={setGap} className="w-32" />
          </div>
        </Card>

        {/* Etiqueta + qty + preço */}
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-semibold">Etiqueta e pedido</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Largura da etiqueta (mm)</Label>
              <NumInput value={labelW} onChange={setLabelW} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Altura da etiqueta (mm)</Label>
              <NumInput value={labelH} onChange={setLabelH} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantidade desejada</Label>
              <NumInput value={qty} onChange={setQty} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Preço da folha de produção (R$)</Label>
              <NumInput value={pricePerSheet} onChange={setPricePerSheet} step={0.1} />
            </div>
          </div>
        </Card>
      </div>

      {/* ============================== RESULTADOS ============================== */}
      <div className="space-y-4">
        {/* Card aproveitamento */}
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
            <span className="text-muted-foreground">
              área útil {layout.usableW}×{layout.usableH}mm
            </span>
          </div>

          {/* Preview SVG */}
          <SheetPreview
            sheetW={sheetW}
            sheetH={sheetH}
            marginTop={marginTop}
            marginBottom={marginBottom}
            marginLeft={marginLeft}
            marginRight={marginRight}
            gap={gap}
            labelW={layout.best.rotated ? labelH : labelW}
            labelH={layout.best.rotated ? labelW : labelH}
            cols={layout.best.cols}
            rows={layout.best.rows}
          />
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
        {pricePerSheet > 0 && qty > 0 && perSheet > 0 && (
          <Card className="p-4 space-y-3 border-primary/40 bg-primary/5">
            <h3 className="text-sm font-semibold">Cálculo do orçamento</h3>
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
    </div>
  );
}

// =============================================================================
// Preview SVG da folha + grade de etiquetas
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
}

function SheetPreview({
  sheetW, sheetH, marginTop, marginBottom, marginLeft, marginRight,
  gap, labelW, labelH, cols, rows,
}: SheetPreviewProps) {
  const MAX = 320;
  const scale = Math.min(MAX / sheetW, MAX / sheetH);
  const w = sheetW * scale;
  const h = sheetH * scale;

  const labels: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      labels.push({
        x: (marginLeft + c * (labelW + gap)) * scale,
        y: (marginTop + r * (labelH + gap)) * scale,
        w: labelW * scale,
        h: labelH * scale,
      });
    }
  }

  return (
    <div className="flex justify-center bg-muted/30 rounded-md p-3">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="border border-border bg-background shadow-sm"
        role="img"
        aria-label={`Preview de ${cols * rows} etiquetas na folha`}
      >
        {/* Margens hachuradas */}
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.15" strokeWidth="2" />
          </pattern>
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
        {/* Etiquetas */}
        {labels.map((l, i) => (
          <rect
            key={i}
            x={l.x}
            y={l.y}
            width={l.w}
            height={l.h}
            fill="hsl(var(--primary) / 0.18)"
            stroke="hsl(var(--primary))"
            strokeWidth="0.8"
            rx="1"
          />
        ))}
      </svg>
    </div>
  );
}
