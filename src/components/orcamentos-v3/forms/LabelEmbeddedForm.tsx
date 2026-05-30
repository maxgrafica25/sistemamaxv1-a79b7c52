// Formulário embutido de Etiquetas para a V3.
// Modo plotter (SignMaster) — margens 7mm + gap 3mm + regras ARMS.
// Redondas: usa engine paramétrica SignMaster + sugestões de aproveitamento.
// Quadradas/Personalizadas: usa computeLabelLayout com margens 7/7/7/7.
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Check, Plus, Tag, ExternalLink, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  computeLabelLayout,
  computeSheetPricing,
  findShrinkOpportunity,
  findGrowOpportunity,
  SHEET_PRESETS,
  type LabelShape,
} from "@/lib/labels/layout";
import {
  computeSignmasterLayout,
  findSignmasterShrinkOpportunity,
  findSignmasterGrowOpportunity,
  SM_REG_MARK_MARGIN,
} from "@/lib/labels/signmaster-spec";
import { useFolhaPricing } from "@/lib/labels/sheet-pricing";
import { loadConfig, SEED_LABEL_PRESETS, type LabelPreset } from "@/lib/labels/config-storage";
import { fmtBRL } from "../shared/pricing";
import { TierFaixasPanel } from "../shared/TierFaixasPanel";
import { FinishingProgressive, type FinishingDef } from "../shared/FinishingProgressive";
import { listFinishings, type FinishingItem } from "@/lib/finishings/catalog";
import { pickFinishingTier } from "@/lib/labels/finishing-pricing";
import { useV3HourlyRate } from "../shared/useV3HourlyRate";

import { genId, type V3LabelItem, type V3LaborItem, type V3Item } from "../types";

interface Props {
  onAdd: (item: V3LabelItem) => void;
  onAddMany?: (items: V3Item[]) => void;
  onAddTiers?: (items: V3LabelItem[]) => void;
  descricao?: string;
  onDescricaoChange?: (v: string) => void;
}

// Margens plotter (SignMaster) — folha solta com marcas ARMS.
const M = 7;
const GAP = 3;

export function LabelEmbeddedForm({ onAdd, onAddMany, onAddTiers, descricao: descricaoProp, onDescricaoChange }: Props) {
  const { hourlyRate } = useV3HourlyRate();
  const [descricaoLocal, setDescricaoLocal] = useState("");
  const descricao = descricaoProp ?? descricaoLocal;
  const setDescricao = onDescricaoChange ?? setDescricaoLocal;
  const controlledDescricao = onDescricaoChange !== undefined;
  const [labelW, setLabelW] = useState<number | "">("");
  const [labelH, setLabelH] = useState<number | "">("");
  const [shape, setShape] = useState<LabelShape>("redondo");
  const [diameter, setDiameter] = useState<number | "">("");
  const [quantidade, setQuantidade] = useState<number | "">("");
  const [extraTiers, setExtraTiers] = useState<number[]>([]);
  const [sheetId, setSheetId] = useState<string>("SRA3");
  const [pulse, setPulse] = useState(false);
  const [finEnabled, setFinEnabled] = useState<Record<string, boolean>>({});

  // Catálogo unificado de acabamentos (contexto: etiqueta)
  const [labelFinishings, setLabelFinishings] = useState<FinishingItem[]>([]);
  useEffect(() => {
    listFinishings("etiqueta")
      .then(setLabelFinishings)
      .catch(() => setLabelFinishings([]));
  }, []);

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
    setShape(p.shape);
    if (p.shape === "redondo") {
      setDiameter(p.width);
    } else {
      setLabelW(p.width);
      setLabelH(p.height);
    }
    if (p.sheetId && p.sheetId !== sheetId) {
      setSheetId(p.sheetId);
    }
    // Força papel adesivo — o hook auto-seleciona o acabamento de recorte adesivo.
    if (folha.availableKinds.includes("adesivo") && folha.paperKind !== "adesivo") {
      folha.setPaperKind("adesivo");
    }
    setActivePresetId(p.id);
  };

  const handleSheetChange = (v: string) => {
    if (!v || v === sheetId) return;
    setSheetId(v);
    setActivePresetId(null);
  };

  const visiblePresets = useMemo(
    () => labelPresets.filter((p) => !p.sheetId || p.sheetId === sheetId),
    [labelPresets, sheetId],
  );


  const sheet = SHEET_PRESETS.find((s) => s.id === sheetId) ?? SHEET_PRESETS[1];
  const folha = useFolhaPricing(sheetId);

  const isRound = shape === "redondo";

  // Aproveitamento: SignMaster para redondas, computeLabelLayout p/ retangulares.
  const smLayout = useMemo(
    () => computeSignmasterLayout({ sheetW: sheet.width, sheetH: sheet.height, labelDiameter: Number(diameter) || 0 }),
    [sheet, diameter],
  );
  const rectLayout = useMemo(
    () =>
      computeLabelLayout({
        sheetW: sheet.width,
        sheetH: sheet.height,
        labelW: Number(labelW) || 0,
        labelH: Number(labelH) || 0,
        marginTop: M,
        marginBottom: M,
        marginLeft: M,
        marginRight: M,
        gap: GAP,
        shape,
      }),
    [sheet, labelW, labelH, shape],
  );

  const perSheet = isRound ? smLayout.total : rectLayout.effectivePerSheet;
  const usableW = sheet.width - 2 * (isRound ? SM_REG_MARK_MARGIN : M);
  const usableH = sheet.height - 2 * (isRound ? SM_REG_MARK_MARGIN : M);

  const pricing = useMemo(
    () =>
      computeSheetPricing({
        pricePerSheet: folha.total,
        qtyRequested: Number(quantidade) || 0,
        perSheet,
      }),
    [folha.total, quantidade, perSheet],
  );

  const sheetCost = folha.selectedPrinting
    ? folha.selectedPrinting.paper_cost + folha.selectedPrinting.printing_cost
    : 0;

  // Sugestões de aproveitamento (estilo V2)
  const shrink = perSheet > 0
    ? (isRound
        ? findSignmasterShrinkOpportunity(
            { sheetW: sheet.width, sheetH: sheet.height, labelDiameter: Number(diameter) || 0 },
            perSheet,
            pricing.sheetsNeeded || 1,
          )
        : findShrinkOpportunity(
            {
              sheetW: sheet.width,
              sheetH: sheet.height,
              labelW: Number(labelW) || 0,
              labelH: Number(labelH) || 0,
              marginTop: M,
              marginBottom: M,
              marginLeft: M,
              marginRight: M,
              gap: GAP,
              shape,
            },
            perSheet,
            pricing.sheetsNeeded || 1,
          ))
    : null;
  const grow = perSheet > 0
    ? (isRound
        ? findSignmasterGrowOpportunity(
            { sheetW: sheet.width, sheetH: sheet.height, labelDiameter: Number(diameter) || 0 },
            perSheet,
          )
        : findGrowOpportunity(
            {
              sheetW: sheet.width,
              sheetH: sheet.height,
              labelW: Number(labelW) || 0,
              labelH: Number(labelH) || 0,
              marginTop: M,
              marginBottom: M,
              marginLeft: M,
              marginRight: M,
              gap: GAP,
              shape,
            },
            perSheet,
          ))
    : null;

  const applyShrink = () => {
    if (!shrink) return;
    if (isRound) setDiameter(shrink.newLabelW);
    else {
      setLabelW(shrink.newLabelW);
      setLabelH(shrink.newLabelH);
    }
  };
  const applyGrow = () => {
    if (!grow) return;
    if (isRound) setDiameter(grow.newLabelW);
    else {
      setLabelW(grow.newLabelW);
      setLabelH(grow.newLabelH);
    }
  };

  useEffect(() => {
    setPulse(false);
  }, [shape, labelW, labelH, diameter, sheetId, quantidade]);

  const canAdd =
    !!folha.selectedPrinting && (Number(quantidade) || 0) > 0 && perSheet > 0 && pricing.totalPrice > 0;

  // Hints dos acabamentos (mesmo padrão do PrintForm)
  const finishes = useMemo<FinishingDef[]>(
    () =>
      labelFinishings.map((f) => {
        let hint: string;
        const isLaborOnly =
          f.pricing_model === "per_unit" &&
          (f.price_per_sheet || 0) === 0 &&
          !!f.production_step &&
          (f.production_step.time_minutes || 0) > 0;
        if (isLaborOnly) {
          const min = f.production_step!.time_minutes;
          const cost = (min / 60) * (hourlyRate || 0);
          hint = `${fmtBRL(cost)}/${f.unit_label ?? "un"} · +${min} min`;
        } else if (f.pricing_model === "per_unit") {
          hint = `${fmtBRL(f.price_per_sheet)}/${f.unit_label ?? "un"}`;
          if (f.production_step) hint += ` · +${f.production_step.time_minutes} min`;
        } else {
          const tier = pickFinishingTier(f.tiers ?? [], pricing.sheetsNeeded || 1);
          const effective = tier ? tier.price_per_sheet : f.price_per_sheet;
          hint = `${fmtBRL(effective)}/folha`;
          if (f.production_step) hint += ` · +${f.production_step.time_minutes} min`;
        }
        return { id: f.id, label: f.name, hint };
      }),
    [labelFinishings, hourlyRate, pricing.sheetsNeeded],
  );

  // Limpa toggles cujo acabamento não está mais disponível
  useEffect(() => {
    setFinEnabled((m) => {
      const allowed = new Set(finishes.map((f) => f.id));
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(m)) if (allowed.has(k) && m[k]) next[k] = true;
      return next;
    });
  }, [finishes]);

  const buildItem = (q: number, tierGroupId?: string): V3LabelItem | null => {
    if (!folha.selectedPrinting) return null;
    const pr = computeSheetPricing({
      pricePerSheet: folha.total,
      qtyRequested: q,
      perSheet,
    });
    if (pr.totalPrice <= 0) return null;
    const fin = folha.selectedFinishing;
    const w = Number(isRound ? diameter : labelW) || 0;
    const h = Number(isRound ? diameter : labelH) || 0;
    return {
      id: genId(),
      kind: "label",
      descricao: descricao.trim(),
      tier_group_id: tierGroupId ?? null,
      labelW_mm: w,
      labelH_mm: h,
      shape,
      label_diameter_mm: isRound ? (Number(diameter) || 0) : undefined,
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

  // Gera V3LaborItem por acabamento ligado que tenha etapa vinculada.
  // Tempo fixo por etapa, mesmo critério do PrintForm.
  const buildLinkedLaborItems = (bundleId: string): V3LaborItem[] =>
    labelFinishings
      .filter((f) => finEnabled[f.id] && f.production_step)
      .map((f) => {
        const step = f.production_step!;
        const allowed: V3LaborItem["step_type"][] = ["impressao", "acabamento", "corte", "outro"];
        const st = (step.step_type ?? "acabamento") as V3LaborItem["step_type"];
        return {
          id: genId(),
          kind: "labor" as const,
          descricao: `${step.description} (de ${f.name})`,
          time_minutes: step.time_minutes,
          step_type: allowed.includes(st) ? st : "acabamento",
          hourly_rate: hourlyRate,
          margem_pct: 20,
          bundle_id: bundleId,
        };
      });

  const submit = () => {
    if (!canAdd) return;
    const it = buildItem(quantidade);
    if (!it) return;
    const cleanExtras = [...new Set(extraTiers)]
      .filter((q) => q > 0 && q !== quantidade)
      .sort((a, b) => a - b);

    const bundleId = `bnd_${genId()}`;
    const laborItems = buildLinkedLaborItems(bundleId);
    const hasLabor = laborItems.length > 0;

    if (cleanExtras.length > 0 && onAddTiers) {
      const tg = `tg_${genId()}`;
      const primary = {
        ...it,
        tier_group_id: tg,
        tier_primary: true,
        ...(hasLabor ? { bundle_id: bundleId, bundle_label: it.descricao || "Etiquetas" } : {}),
      } as V3LabelItem;
      const siblings = cleanExtras
        .map((q) => {
          const s = buildItem(q, tg);
          return s ? ({ ...s, tier_primary: false } as V3LabelItem) : null;
        })
        .filter((x): x is V3LabelItem => !!x);
      onAddTiers([primary, ...siblings]);
      if (hasLabor && onAddMany) onAddMany(laborItems);
    } else if (hasLabor && onAddMany) {
      const labelWithBundle = {
        ...it,
        bundle_id: bundleId,
        bundle_label: it.descricao || "Etiquetas",
      } as V3LabelItem;
      onAddMany([labelWithBundle, ...laborItems]);
    } else {
      onAdd(it);
    }
    setDescricao("");
    setExtraTiers([]);
    setFinEnabled({});
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  const sizeLabel = isRound ? `Ø${(diameter / 10).toLocaleString("pt-BR")}cm` : `${(labelW / 10).toLocaleString("pt-BR")}×${(labelH / 10).toLocaleString("pt-BR")}cm`;

  return (
    <div className="space-y-5 flex-1 flex flex-col">
      {!controlledDescricao && (
        <Field label="Descrição (opcional)">
          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={`Padrão: Etiqueta ${sizeLabel} — ${quantidade} un`}
            className="h-9"
          />
        </Field>
      )}


      <Field label="Folha">
        <ToggleGroup
          type="single"
          value={sheetId}
          onValueChange={handleSheetChange}
          className="justify-start"
        >
          {SHEET_PRESETS.map((s) => (
            <ToggleGroupItem
              key={s.id}
              value={s.id}
              className="h-9 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
            >
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      {/* Aviso quando não há papel cadastrado para a folha selecionada */}
      {!folha.isLoading && folha.printingOptions.length === 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          Nenhum papel adesivo cadastrado para <strong>{sheet.label}</strong>.{" "}
          <Link to="/preco-impressao" target="_blank" className="underline font-medium">
            Cadastre em Preço de Impressão
          </Link>{" "}
          para habilitar o cálculo.
        </div>
      )}

      {/* Chips de presets favoritos — filtrados pela folha ativa */}
      {visiblePresets.length > 0 && (
        <Field label="Tamanhos rápidos">
          <div className="flex flex-wrap gap-2">
            {visiblePresets.map((p) => {
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
        </Field>
      )}

      <Field label="Forma">
        <ToggleGroup
          type="single"
          value={shape}
          onValueChange={(v) => v && setShape(v as LabelShape)}
          className="justify-start"
        >
          <ToggleGroupItem value="redondo" className="h-9 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary">◯ Redonda</ToggleGroupItem>
          <ToggleGroupItem value="quadrado" className="h-9 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary">▢ Quadrada</ToggleGroupItem>
          <ToggleGroupItem value="personalizado" className="h-9 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary">⬡ Personalizada</ToggleGroupItem>
        </ToggleGroup>
      </Field>

      {isRound ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Diâmetro (cm)">
            <Input
              type="number"
              min={0.5}
              step={0.1}
              value={(diameter / 10).toString()}
              onChange={(e) => {
                const cm = Number(e.target.value) || 0;
                setDiameter(Math.max(1, Math.round(cm * 10)));
              }}
              className="h-9"
            />
          </Field>
          <Field label="Quantidade">
            <Input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 0))}
              className="h-9"
            />
          </Field>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Largura (cm)">
              <Input
                type="number"
                min={0.5}
                step={0.1}
                value={(labelW / 10).toString()}
                onChange={(e) => {
                  const cm = Number(e.target.value) || 0;
                  setLabelW(Math.max(1, Math.round(cm * 10)));
                }}
                className="h-9"
              />
            </Field>
            <Field label="Altura (cm)">
              <Input
                type="number"
                min={0.5}
                step={0.1}
                value={(labelH / 10).toString()}
                onChange={(e) => {
                  const cm = Number(e.target.value) || 0;
                  setLabelH(Math.max(1, Math.round(cm * 10)));
                }}
                className="h-9"
              />
            </Field>
          </div>

          <Field label="Quantidade de etiquetas">
            <Input
              type="number"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 0))}
              className="h-9"
            />
          </Field>
        </>
      )}


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
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
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
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {folha.finishingOptions.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.label ?? f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {perSheet > 0 && (
        <div className="rounded-md border border-border/60 bg-background px-3 py-2.5 space-y-1">
          <Row
            label="Área útil da folha"
            value={`${(usableW / 10).toLocaleString("pt-BR")}×${(usableH / 10).toLocaleString("pt-BR")}cm (folha ${(sheet.width / 10).toLocaleString("pt-BR")}×${(sheet.height / 10).toLocaleString("pt-BR")}cm)`}
            muted
          />
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

      {/* Sugestões de aproveitamento (estilo V2) */}
      {(shrink || grow) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {shrink && (
            <button
              type="button"
              onClick={applyShrink}
              className="text-left rounded-md border border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 transition-colors px-3 py-2 space-y-1"
            >
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                <TrendingDown className="h-3.5 w-3.5" />
                Reduzir para caber mais
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {isRound
                  ? `Diminuir Ø em ${(shrink.shrinkW / 10).toLocaleString("pt-BR")}cm → Ø${(shrink.newLabelW / 10).toLocaleString("pt-BR")}cm`
                  : `Reduzir ${(shrink.shrinkW / 10).toLocaleString("pt-BR")}×${(shrink.shrinkH / 10).toLocaleString("pt-BR")}cm → ${(shrink.newLabelW / 10).toLocaleString("pt-BR")}×${(shrink.newLabelH / 10).toLocaleString("pt-BR")}cm`}

                {" "}rende <strong>{shrink.newPerSheet}</strong>/folha (+{shrink.delta}).
              </p>
            </button>
          )}
          {grow && (
            <button
              type="button"
              onClick={applyGrow}
              className="text-left rounded-md border border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors px-3 py-2 space-y-1"
            >
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                <TrendingUp className="h-3.5 w-3.5" />
                Upgrade — etiqueta maior
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {isRound
                  ? `Aumentar Ø em ${(grow.growW / 10).toLocaleString("pt-BR")}cm → Ø${(grow.newLabelW / 10).toLocaleString("pt-BR")}cm`
                  : `Aumentar ${(grow.growW / 10).toLocaleString("pt-BR")}×${(grow.growH / 10).toLocaleString("pt-BR")}cm → ${(grow.newLabelW / 10).toLocaleString("pt-BR")}×${(grow.newLabelH / 10).toLocaleString("pt-BR")}cm`}

                {" "}mantendo <strong>{grow.newPerSheet}</strong>/folha (+{grow.areaIncreasePct.toFixed(0)}% de área).
              </p>
            </button>
          )}
        </div>
      )}

      {finishes.length > 0 && (
        <Field label="Acabamentos">
          <FinishingProgressive
            items={finishes}
            enabled={finEnabled}
            onToggle={(id, on) => setFinEnabled((m) => ({ ...m, [id]: on }))}
          />
        </Field>
      )}



      <div className="sticky bottom-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 mt-auto -mb-5 lg:-mb-0 bg-background border-t border-border shadow-[0_-8px_16px_-8px_hsl(var(--background))] flex items-center justify-end gap-3">
        <Button
          onClick={submit}
          disabled={!canAdd}
          title={
            !canAdd && !folha.selectedPrinting
              ? `Cadastre um papel para ${sheet.label} em Preço de Impressão`
              : undefined
          }
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
