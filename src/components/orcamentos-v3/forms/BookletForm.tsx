// Apostila V3 — versão simplificada com paridade de cálculo de miolo ao Print.
// Encadernação (Kit Espiral/Wire-O/Grampo) é tratada como acabamento agregado
// (mão-de-obra avulsa) — pode ser adicionada via aba "Mão-de-obra" enquanto a
// integração total com spiral-selector é portada em fase posterior.
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Plus, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import PrintingItemSearch, {
  type PrintingCatalogItem,
} from "@/components/orcamentos-v3/shared/PrintingItemSearch";
import { useV3Catalog, pricePerSheet } from "../shared/useV3Catalog";
import { roundUp10, fmtBRL } from "../shared/pricing";
import { TierFaixasPanel } from "../shared/TierFaixasPanel";
import { FinishingProgressive, type FinishingDef } from "../shared/FinishingProgressive";
import { listFinishings, type FinishingItem } from "@/lib/finishings/catalog";
import { pickFinishingTier } from "@/lib/labels/finishing-pricing";
import { useV3HourlyRate } from "../shared/useV3HourlyRate";
import { getIdealSpiral } from "@/lib/quotes/spiral-selector";
import { genId, type V3BookletItem, type V3Item, type V3LaborItem } from "../types";
import {
  SideChoiceToggle,
  filterItemsBySideChoice,
  shouldClearOnSideChange,
  type SideChoice,
} from "../shared/SideChoiceToggle";
import { ProductKitPanel } from "./ProductKitPanel";
import { BookletKitPanel, type BookletKitApplyMeta } from "./BookletKitPanel";
import { buildBookletBundleLabel } from "../shared/buildBookletBundleLabel";

interface Props {
  onAdd: (item: V3BookletItem) => void;
  /** Quando definido, "Adicionar apostila + Kit" empurra todos os itens de uma vez. */
  onAddMany?: (items: V3Item[]) => void;
  onAddTiers?: (items: V3BookletItem[]) => void;
  defaultMarginPct?: number;
  descricao?: string;
  onDescricaoChange?: (v: string) => void;
  /** Papel padrão (nome + gramatura + lado) para auto-selecionar um item do catálogo. */
  defaultPaperHint?: { name: string; grammage?: string | null; side?: string | null } | null;
  /** Ids de acabamentos para pré-marcar (uma vez) ao carregar. */
  preselectedFinishings?: string[];
}

const normalizeText = (s: string | null | undefined) =>
  (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();

export function BookletForm({
  onAdd,
  onAddMany,
  onAddTiers,
  defaultMarginPct = 20,
  descricao: descricaoProp,
  onDescricaoChange,
  defaultPaperHint,
  preselectedFinishings,
}: Props) {
  const { hourlyRate } = useV3HourlyRate();
  const { loading, items, tiers } = useV3Catalog();
  const [catalog, setCatalog] = useState<PrintingCatalogItem | null>(null);
  const [descricaoLocal, setDescricaoLocal] = useState("");
  const descricao = descricaoProp ?? descricaoLocal;
  const setDescricao = onDescricaoChange ?? setDescricaoLocal;
  const controlledDescricao = onDescricaoChange !== undefined;
  const [bookletPages, setBookletPages] = useState<number>(0);
  const [bookletUnits, setBookletUnits] = useState<number>(0);
  const [sideChoice, setSideChoice] = useState<"Frente" | "F/V">(
    defaultPaperHint?.side === "F/V" ? "F/V" : "F/V",
  );
  const duplex = sideChoice === "F/V";
  const [pulse, setPulse] = useState(false);
  const [extraTiers, setExtraTiers] = useState<number[]>([]);
  const [finEnabled, setFinEnabled] = useState<Record<string, boolean>>({});

  // Aplica filtro do catálogo de acordo com o lado escolhido (com suporte a exceção F/V).
  const filteredItems = useMemo(
    () => filterItemsBySideChoice(items, sideChoice),
    [items, sideChoice],
  );

  const changeSide = (next: SideChoice) => {
    setSideChoice(next);
    if (shouldClearOnSideChange(catalog, next)) {
      setCatalog(null);
    }
  };


  const [printFinishings, setPrintFinishings] = useState<FinishingItem[]>([]);
  useEffect(() => {
    listFinishings("impressao")
      .then(setPrintFinishings)
      .catch(() => setPrintFinishings([]));
  }, []);

  // Auto-pick do papel padrão (uma vez) quando o preset define defaultPaperHint.
  const didAutoPickPaper = useRef(false);
  useEffect(() => {
    if (didAutoPickPaper.current) return;
    if (!defaultPaperHint?.name) return;
    if (!items || items.length === 0) return;
    const wantName = normalizeText(defaultPaperHint.name);
    const wantGram = normalizeText(defaultPaperHint.grammage);
    const wantSide = (defaultPaperHint.side || "").toLowerCase();
    const candidates = items.filter((it) => {
      const okName = wantName ? normalizeText(it.paper_type).includes(wantName) : true;
      const okGram = wantGram ? normalizeText(it.grammage).includes(wantGram) : true;
      return okName && okGram;
    });
    if (candidates.length === 0) return;
    const exactSide = wantSide
      ? candidates.find((c) => (c.side || "").toLowerCase() === wantSide)
      : undefined;
    setCatalog(exactSide ?? candidates[0]);
    if (wantSide === "f/v") setSideChoice("F/V");
    else if (wantSide === "frente") setSideChoice("Frente");
    didAutoPickPaper.current = true;
  }, [items, defaultPaperHint]);

  // Pré-marcação dos acabamentos sugeridos do preset (uma única vez).
  const didPreselectFinishings = useRef(false);
  useEffect(() => {
    if (didPreselectFinishings.current) return;
    if (!preselectedFinishings || preselectedFinishings.length === 0) return;
    if (!printFinishings || printFinishings.length === 0) return;
    const wanted = new Set(preselectedFinishings.map((s) => s.toLowerCase()));
    const next: Record<string, boolean> = {};
    for (const f of printFinishings) {
      if (wanted.has(f.id) || wanted.has(f.name.toLowerCase())) {
        next[f.id] = true;
      }
    }
    if (Object.keys(next).length === 0) return;
    setFinEnabled((m) => ({ ...m, ...next }));
    didPreselectFinishings.current = true;
  }, [printFinishings, preselectedFinishings]);

  // Folhas físicas = páginas-folha por apostila × nº apostilas.
  // (Se F/V, cada folha = 2 lados; o miolo é cobrado por folha física impressa.)
  const physicalSheets = Math.max(
    0,
    Math.floor(bookletPages || 0) * Math.floor(bookletUnits || 0),
  );

  const pricing = useMemo(
    () => (catalog ? pricePerSheet(catalog, tiers, physicalSheets || 1) : null),
    [catalog, tiers, physicalSheets],
  );

  // Custo total do miolo: aplica multiplicador F/V quando o catálogo é "Só frente".
  const sideMult = !catalog
    ? 1
    : catalog.side === "F/V"
      ? 1
      : duplex
        ? 2
        : 1;

  const totalMioloPreco = pricing ? pricing.sellingPrice * physicalSheets * (sideMult === 2 && catalog?.side !== "F/V" ? 2 : 1) : 0;

  const spiralDiameter = bookletPages > 0 ? getIdealSpiral(bookletPages) : null;

  const canAdd = !!catalog && bookletPages > 0 && bookletUnits > 0 && totalMioloPreco > 0;

  const buildBookletItem = (
    unitsOverride?: number,
    tierGroupId?: string,
  ): V3BookletItem | null => {
    if (!canAdd || !catalog) return null;
    const units = Math.floor(unitsOverride ?? bookletUnits);
    if (units <= 0) return null;
    const sheets = Math.max(1, Math.floor(bookletPages) * units);
    const pr = pricePerSheet(catalog, tiers, sheets);
    const label = descricao.trim();
    return {
      id: genId(),
      kind: "booklet",
      descricao: label,
      tier_group_id: tierGroupId ?? null,
      catalog_item_id: catalog.id,
      paper_type: catalog.paper_type,
      grammage: catalog.grammage,
      size: catalog.size,
      side: catalog.side,
      printer_category_id: catalog.printer_category_id,
      markup_group_id: catalog.markup_group_id,
      valor_unitario: pr.sellingPrice,
      custo_unitario: pr.baseCost,
      bookletPages: Math.floor(bookletPages),
      bookletUnits: units,
      bookletDuplex: duplex,
    };
  };

  // Hints dos acabamentos (mesmo padrão do PrintForm)
  const finishes = useMemo<FinishingDef[]>(
    () =>
      printFinishings.map((f) => {
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
          const tier = pickFinishingTier(f.tiers ?? [], physicalSheets || 1);
          const effective = tier ? tier.price_per_sheet : f.price_per_sheet;
          hint = `${fmtBRL(effective)}/folha`;
          if (f.production_step) hint += ` · +${f.production_step.time_minutes} min`;
        }
        return { id: f.id, label: f.name, hint };
      }),
    [printFinishings, hourlyRate, physicalSheets],
  );

  useEffect(() => {
    setFinEnabled((m) => {
      const allowed = new Set(finishes.map((f) => f.id));
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(m)) if (allowed.has(k) && m[k]) next[k] = true;
      return next;
    });
  }, [finishes]);

  const buildLinkedLaborItems = (bundleId: string): V3LaborItem[] =>
    printFinishings
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
          margem_pct: defaultMarginPct,
          bundle_id: bundleId,
        };
      });

  const submit = () => {
    const item = buildBookletItem();
    if (!item) return;
    const cleanExtras = [...new Set(extraTiers)]
      .filter((q) => q > 0 && q !== bookletUnits)
      .sort((a, b) => a - b);

    const bundleId = `bnd_${genId()}`;
    const laborItems = buildLinkedLaborItems(bundleId);
    const hasLabor = laborItems.length > 0;

    if (cleanExtras.length > 0 && onAddTiers) {
      const tg = `tg_${genId()}`;
      const primary = {
        ...item,
        tier_group_id: tg,
        tier_primary: true,
        ...(hasLabor ? { bundle_id: bundleId, bundle_label: item.descricao || "Apostila" } : {}),
      } as V3BookletItem;
      const siblings = cleanExtras
        .map((q) => {
          const s = buildBookletItem(q, tg);
          return s ? ({ ...s, tier_primary: false } as V3BookletItem) : null;
        })
        .filter((x): x is V3BookletItem => !!x);
      onAddTiers([primary, ...siblings]);
      if (hasLabor && onAddMany) onAddMany(laborItems);
    } else if (hasLabor && onAddMany) {
      const bookletWithBundle = {
        ...item,
        bundle_id: bundleId,
        bundle_label: item.descricao || "Apostila",
      } as V3BookletItem;
      onAddMany([bookletWithBundle, ...laborItems]);
    } else {
      onAdd(item);
    }
    setDescricao("");
    setExtraTiers([]);
    setFinEnabled({});
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  const applyKitItems = (kitItems: V3Item[], meta?: BookletKitApplyMeta) => {
    if (!onAddMany) return;
    const miolo = buildBookletItem();
    if (!miolo) {
      onAddMany(kitItems);
      return;
    }
    const bundleId = `bdl_${genId()}`;
    const bundleLabel = meta
      ? buildBookletBundleLabel({
          miolo,
          kitItems,
          coverMode: meta.coverMode,
          backCoverMode: meta.backCoverMode,
          customCoverDescr: meta.customCoverDescr,
          customBackCoverDescr: meta.customBackCoverDescr,
          spiralDiameter: meta.spiralDiameter,
        })
      : miolo.descricao;
    const leader: V3Item = { ...miolo, bundle_id: bundleId, bundle_label: bundleLabel };
    const tagged: V3Item[] = kitItems.map((it) => ({ ...it, bundle_id: bundleId } as V3Item));
    onAddMany([leader, ...tagged]);
    setDescricao("");
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5 flex-1 flex flex-col">
      {!controlledDescricao && (
        <Field label="Descrição (opcional)">
          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={
              catalog
                ? `Padrão: Apostila ${bookletUnits}× ${bookletPages}fl ${catalog.paper_type}`
                : "Selecione o miolo primeiro"
            }
            className="h-9"
          />
        </Field>
      )}


      {!catalog && (
        <Field label="Miolo (papel do catálogo)">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Lado de impressão
            </span>
            <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setSideChoice("Frente")}
                className={cn(
                  "px-2.5 py-1 rounded-sm font-medium transition-colors",
                  sideChoice === "Frente"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Imprimir só na frente"
              >
                Frente
              </button>
              <button
                type="button"
                onClick={() => setSideChoice("F/V")}
                className={cn(
                  "px-2.5 py-1 rounded-sm font-medium transition-colors",
                  sideChoice === "F/V"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                title="Frente e verso (custo ~2x)"
              >
                F/V
              </button>
            </div>
          </div>
          <PrintingItemSearch
            items={sideChoice === "Frente" ? items.filter((it) => it.side !== "F/V") : items}
            markupTiers={tiers}
            globalSettings={{
              invoice_pct: 0,
              collection_pct: 0,
              waste_pct: 0,
              default_margin_pct: 20,
            }}
            onSelect={(it) => setCatalog(it)}
          />

          {loading && (
            <p className="text-[11px] text-muted-foreground mt-1">Carregando catálogo…</p>
          )}
        </Field>
      )}

      {catalog && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 flex items-center gap-3 flex-wrap">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {catalog.paper_type}
              {catalog.grammage ? ` ${catalog.grammage}` : ""} — {catalog.size}{" "}
              {catalog.side === "F/V" ? "F/V" : sideChoice}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-muted-foreground">
                {catalog.category_name}
              </span>
              {pricing?.tierLabel && (
                <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                  {pricing.tierLabel}
                </Badge>
              )}
            </div>
          </div>
          <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                if (catalog.side === "F/V") {
                  setCatalog(null);
                  setSideChoice("Frente");
                } else {
                  setSideChoice("Frente");
                }
              }}
              className={cn(
                "px-2.5 py-1 rounded-sm font-medium transition-colors",
                (catalog.side === "F/V" ? "F/V" : sideChoice) === "Frente"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Imprimir só na frente"
            >
              Frente
            </button>
            <button
              type="button"
              onClick={() => setSideChoice("F/V")}
              className={cn(
                "px-2.5 py-1 rounded-sm font-medium transition-colors",
                (catalog.side === "F/V" ? "F/V" : sideChoice) === "F/V"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Frente e verso (custo ~2x)"
            >
              F/V
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setCatalog(null);
              setSideChoice("F/V");
            }}
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Trocar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Folhas por apostila">
          <Input
            type="number"
            min={1}
            value={bookletPages || ""}
            placeholder="Ex: 20 folhas"
            onChange={(e) => setBookletPages(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
        <Field label="Qtde de apostilas">
          <Input
            type="number"
            min={1}
            value={bookletUnits || ""}
            placeholder="Ex: 10 apostilas"
            onChange={(e) => setBookletUnits(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
      </div>


      {physicalSheets > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10.5px] text-foreground/80">
            📄 {physicalSheets} folhas físicas
          </span>
          {spiralDiameter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10.5px] text-foreground/80">
              🌀 Espiral sugerida: {spiralDiameter}
            </span>
          )}
          {(duplex || catalog?.side === "F/V") && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10.5px] text-foreground/80">
              F/V ativo
            </span>
          )}
        </div>
      )}

      {onAddMany && canAdd && bookletPages > 0 && bookletUnits > 0 && (
        <>
          <BookletKitPanel
            bookletPages={Math.floor(bookletPages)}
            bookletUnits={Math.floor(bookletUnits)}
            defaultMarginPct={defaultMarginPct}
            onApply={applyKitItems}
          />
          <ProductKitPanel
            productKind="apostila"
            units={Math.floor(bookletUnits)}
            sheets={Math.floor(bookletPages)}
            defaultMarginPct={defaultMarginPct}
            onApply={applyKitItems}
          />
        </>
      )}

      {onAddTiers && canAdd && (
        <TierFaixasPanel
          currentQty={bookletUnits}
          disabled={!catalog || bookletPages <= 0}
          onExtrasChange={setExtraTiers}
          compute={(units) => {
            const sheets = Math.max(0, Math.floor(bookletPages) * Math.floor(units));
            if (!catalog || sheets <= 0) return { custo_total: 0, preco_total: 0 };
            const pr = pricePerSheet(catalog, tiers, sheets);
            const mult = catalog.side === "F/V" ? 1 : duplex ? 2 : 1;
            return {
              custo_total: pr.baseCost * sheets * mult,
              preco_total: roundUp10(pr.sellingPrice * sheets * mult),
            };
          }}
        />
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
              Adicionar apostila + {extraTiers.length} faixa{extraTiers.length === 1 ? "" : "s"}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" /> Adicionar apostila
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
