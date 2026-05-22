// Formulário embutido de Etiquetas para a V3.
// Usa o mesmo motor de cálculo da Calculadora de Etiquetas standalone
// (libs labels/*), mas em um layout enxuto, focado em "adicionar ao orçamento".
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Check, Plus, Tag, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  computeLabelLayout,
  computeSheetPricing,
  SHEET_PRESETS,
  type LabelShape,
} from "@/lib/labels/layout";
import { useFolhaPricing } from "@/lib/labels/sheet-pricing";
import { loadConfig, SEED_LABEL_PRESETS, type LabelPreset } from "@/lib/labels/config-storage";
import { fmtBRL } from "../shared/pricing";
import { TierFaixasPanel } from "../shared/TierFaixasPanel";

import { genId, type V3LabelItem } from "../types";

interface Props {
  onAdd: (item: V3LabelItem) => void;
  onAddTiers?: (items: V3LabelItem[]) => void;
  descricao?: string;
  onDescricaoChange?: (v: string) => void;
}

const DEFAULT_MARGINS = { top: 10, right: 10, bottom: 10, left: 10, gap: 3 };

export function LabelEmbeddedForm({ onAdd, onAddTiers, descricao: descricaoProp, onDescricaoChange }: Props) {

  const [descricaoLocal, setDescricaoLocal] = useState("");
  const descricao = descricaoProp ?? descricaoLocal;
  const setDescricao = onDescricaoChange ?? setDescricaoLocal;
  const controlledDescricao = onDescricaoChange !== undefined;
  const [labelW, setLabelW] = useState(50);
  const [labelH, setLabelH] = useState(30);
  const [shape, setShape] = useState<LabelShape>("quadrado");
  const [quantidade, setQuantidade] = useState(500);
  const [extraTiers, setExtraTiers] = useState<number[]>([]);
  const [sheetId, setSheetId] = useState<string>("SRA3");
  const [pulse, setPulse] = useState(false);

  const labelPresets = useMemo<LabelPreset[]>(() => {
    try {
      const cfg = loadConfig();
      return cfg.labelPresets?.length ? cfg.labelPresets : SEED_LABEL_PRESETS;
    } catch {
      return SEED_LABEL_PRESETS;
    }
  }, []);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  const applyPreset = (p: LabelPreset) => {
    setLabelW(p.width);
    setLabelH(p.height);
    setShape(p.shape);
    setActivePresetId(p.id);
  };


  const sheet = SHEET_PRESETS.find((s) => s.id === sheetId) ?? SHEET_PRESETS[1];
  const folha = useFolhaPricing(sheetId);

  const layout = useMemo(
    () =>
      computeLabelLayout({
        sheetW: sheet.width,
        sheetH: sheet.height,
        labelW,
        labelH,
        marginTop: DEFAULT_MARGINS.top,
        marginBottom: DEFAULT_MARGINS.bottom,
        marginLeft: DEFAULT_MARGINS.left,
        marginRight: DEFAULT_MARGINS.right,
        gap: DEFAULT_MARGINS.gap,
        shape,
      }),
    [sheet, labelW, labelH, shape],
  );

  const perSheet = layout.effectivePerSheet;
  const pricing = useMemo(
    () =>
      computeSheetPricing({
        pricePerSheet: folha.total,
        qtyRequested: quantidade,
        perSheet,
      }),
    [folha.total, quantidade, perSheet],
  );

  // Custo bruto (sem markup) ≈ printing_cost + paper_cost por folha × folhas.
  const sheetCost = folha.selectedPrinting
    ? folha.selectedPrinting.paper_cost + folha.selectedPrinting.printing_cost
    : 0;
  const custoTotal = sheetCost * pricing.sheetsNeeded;

  // Reset descrição quando troca shape (placeholder vai mudar).
  useEffect(() => {
    setPulse(false);
  }, [shape, labelW, labelH, sheetId, quantidade]);

  const canAdd =
    !!folha.selectedPrinting && quantidade > 0 && perSheet > 0 && pricing.totalPrice > 0;

  const buildItem = (q: number, tierGroupId?: string): V3LabelItem | null => {
    if (!folha.selectedPrinting) return null;
    const pr = computeSheetPricing({
      pricePerSheet: folha.total,
      qtyRequested: q,
      perSheet,
    });
    if (pr.totalPrice <= 0) return null;
    const label = descricao.trim();
    const fin = folha.selectedFinishing;
    return {
      id: genId(),
      kind: "label",
      descricao: label,
      tier_group_id: tierGroupId ?? null,
      labelW_mm: labelW,
      labelH_mm: labelH,
      shape,
      quantidade: q,
      sheet_size: sheetId,
      printing_item_id: folha.selectedPrinting.id,
      paper_type: folha.selectedPrinting.paper_type,
      grammage: folha.selectedPrinting.grammage,
      side: folha.selectedPrinting.side,
      finishing_id: fin && fin.id !== "__none__" ? fin.id : null,
      finishing_nome: fin && fin.id !== "__none__" ? fin.name : null,
      per_sheet: perSheet,
      sheets_needed: pr.sheetsNeeded,
      price_per_sheet: folha.total,
      preco_total: pr.totalPrice,
      custo_total: sheetCost * pr.sheetsNeeded,
    };
  };

  const submit = () => {
    if (!canAdd) return;
    const it = buildItem(quantidade);
    if (!it) return;
    const cleanExtras = [...new Set(extraTiers)]
      .filter((q) => q > 0 && q !== quantidade)
      .sort((a, b) => a - b);
    if (cleanExtras.length > 0 && onAddTiers) {
      const tg = `tg_${genId()}`;
      const primary = { ...it, tier_group_id: tg, tier_primary: true } as V3LabelItem;
      const siblings = cleanExtras
        .map((q) => {
          const s = buildItem(q, tg);
          return s ? ({ ...s, tier_primary: false } as V3LabelItem) : null;
        })
        .filter((x): x is V3LabelItem => !!x);
      onAddTiers([primary, ...siblings]);
    } else {
      onAdd(it);
    }
    setDescricao("");
    setExtraTiers([]);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5">
      {!controlledDescricao && (
        <Field label="Descrição (opcional)">
          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={`Padrão: Etiqueta ${labelW}×${labelH}mm — ${quantidade} un`}
            className="h-9"
          />
        </Field>
      )}


      {/* Chips de presets favoritos */}
      {labelPresets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {labelPresets.map((p) => {
            const active = p.id === activePresetId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}
              >
                <Tag className="h-3.5 w-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>
      )}



      <div className="flex items-start justify-between gap-3">
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 flex items-center gap-2 flex-1">
          <Tag className="h-4 w-4 text-primary" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-primary/80 font-semibold">
              Modo Etiqueta
            </p>
            <p className="text-[11px] text-muted-foreground">
              Cálculo de aproveitamento + folhas necessárias com a mesma engine da calculadora.
            </p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm" className="shrink-0">
          <Link to="/etiquetas" target="_blank">
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Calc. completa
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Largura (mm)">
          <Input
            type="number"
            min={5}
            value={labelW}
            onChange={(e) => setLabelW(Math.max(1, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
        <Field label="Altura (mm)">
          <Input
            type="number"
            min={5}
            value={labelH}
            onChange={(e) => setLabelH(Math.max(1, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
        <Field label="Forma">
          <ToggleGroup
            type="single"
            value={shape}
            onValueChange={(v) => v && setShape(v as LabelShape)}
            className="justify-start"
          >
            <ToggleGroupItem value="quadrado" className="h-9 px-3 text-xs">
              ▢
            </ToggleGroupItem>
            <ToggleGroupItem value="redondo" className="h-9 px-3 text-xs">
              ◯
            </ToggleGroupItem>
            <ToggleGroupItem value="personalizado" className="h-9 px-3 text-xs">
              ⬡
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantidade de etiquetas">
          <Input
            type="number"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
        <Field label="Folha">
          <Select value={sheetId} onValueChange={setSheetId}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHEET_PRESETS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {onAddTiers && (
        <TierFaixasPanel
          currentQty={quantidade}
          disabled={!folha.selectedPrinting || perSheet <= 0}
          onExtrasChange={setExtraTiers}
          compute={(q) => {
            const pr = computeSheetPricing({
              pricePerSheet: folha.total,
              qtyRequested: q,
              perSheet,
            });
            return {
              custo_total: sheetCost * pr.sheetsNeeded,
              preco_total: pr.totalPrice,
            };
          }}
        />
      )}

      <Field label="Papel / Impressão">
        {folha.isLoading ? (
          <p className="text-[11px] text-muted-foreground">Carregando opções de impressão…</p>
        ) : folha.printingOptions.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Nenhum papel cadastrado para folha {sheetId}. Cadastre em Preço de Impressão.
          </p>
        ) : (
          <Select
            value={folha.selectedPrinting?.id ?? ""}
            onValueChange={(v) => folha.setPrintingId(v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione o papel" />
            </SelectTrigger>
            <SelectContent>
              {folha.printingOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <Field label="Acabamento">
        <Select
          value={folha.selectedFinishing.id}
          onValueChange={(v) => folha.setFinishingId(v as string)}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {folha.finishingOptions.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.label ?? f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {perSheet > 0 && (
        <div className="rounded-md border border-border/60 bg-background px-3 py-2.5 space-y-1">
          <Row label="Aproveitamento por folha" value={`${perSheet} etiquetas`} />
          <Row label="Folhas necessárias" value={`${pricing.sheetsNeeded}`} />
          <Row
            label="Preço por folha (impressão + acabamento)"
            value={fmtBRL(folha.total)}
            muted
          />
          <div className="flex items-center justify-between pt-1 border-t border-border/40 mt-1">
            <span className="text-sm font-medium">Total</span>
            <span className="text-base font-semibold text-primary tabular-nums">
              {fmtBRL(pricing.totalPrice)}
            </span>
          </div>
          {pricing.unitPrice > 0 && (
            <p className="text-[10px] text-muted-foreground text-right">
              Unitário: {fmtBRL(pricing.unitPrice)} / etiqueta
            </p>
          )}
        </div>
      )}


      <div className="sticky bottom-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 mt-2 bg-background/95 backdrop-blur border-t border-border flex items-center justify-end gap-3">
        <Button
          onClick={submit}
          disabled={!canAdd}
          className={cn(
            "min-w-[220px] transition-colors",
            pulse && "bg-emerald-600 hover:bg-emerald-600",
          )}
        >
          {pulse ? (
            <>
              <Check className="h-4 w-4 mr-2" /> Adicionado!
            </>
          ) : extraTiers.length > 0 ? (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar etiqueta + {extraTiers.length} faixa{extraTiers.length === 1 ? "" : "s"}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" /> Adicionar etiqueta
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className={cn("text-muted-foreground", muted && "opacity-80")}>{label}</span>
      <span className={cn("tabular-nums", muted ? "text-muted-foreground" : "font-medium")}>
        {value}
      </span>
    </div>
  );
}
