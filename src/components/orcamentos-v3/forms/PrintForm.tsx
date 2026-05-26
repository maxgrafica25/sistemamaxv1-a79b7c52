import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, FileText, Plus, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PrintingItemSearch, {
  type PrintingCatalogItem,
} from "@/components/orcamentos-v3/shared/PrintingItemSearch";
import { FinishingProgressive, type FinishingDef } from "../shared/FinishingProgressive";
import { useV3Catalog, pricePerSheet } from "../shared/useV3Catalog";
import { fmtBRL } from "../shared/pricing";
import { TierFaixasPanel } from "../shared/TierFaixasPanel";
import { genId, type V3PrintItem, type V3LaborItem, type V3Item } from "../types";
import { listFinishings, sumFinishingsPerSheet, type FinishingItem } from "@/lib/finishings/catalog";
import { resolveFinishingPricePerSheet, pickFinishingTier } from "@/lib/labels/finishing-pricing";
import { useV3HourlyRate } from "../shared/useV3HourlyRate";
import {
  SideChoiceToggle,
  filterItemsBySideChoice,
  shouldClearOnSideChange,
  type SideChoice,
} from "../shared/SideChoiceToggle";

interface Props {
  onAdd: (item: V3PrintItem) => void;
  onAddMany?: (items: V3Item[]) => void;
  onAddTiers?: (items: V3PrintItem[]) => void;
  onSelectionChange?: (sel: {
    paper_type: string | null;
    size: string | null;
    grammage: string | null;
    finishings: string[];
  }) => void;
  descricao?: string;
  onDescricaoChange?: (v: string) => void;
  /** Quando true, começa com todos os campos vazios (modo Personalizado). */
  emptyDefaults?: boolean;
  defaultMarginPct?: number;
  /** Rótulo do seletor de substrato (default "Papel"; em Crachá vira "Cartão PVC"). */
  substrateLabel?: string;
  /** Quando true, oculta acabamentos cujo nome começa com "Arte" (a arte já foi resolvida globalmente). */
  hideArtFinishings?: boolean;
  /** Quando true, pré-liga todos os acabamentos disponíveis como sugestão (modo Personalizado). */
  suggestAllFinishings?: boolean;
  /** Lista de papéis (nomes) sugeridos pelo produto favorito ativo; usado para pré-selecionar o chip de categoria. */
  suggestedPapers?: string[];
  /** Papel padrão (nome + gramatura + lado) para auto-selecionar um item do catálogo. */
  defaultPaperHint?: { name: string; grammage?: string | null; side?: string | null } | null;
  /** Ids de acabamentos para pré-marcar (uma vez) ao carregar. */
  preselectedFinishings?: string[];
}

export function PrintForm({ onAdd, onAddMany, onAddTiers, onSelectionChange, descricao: descricaoProp, onDescricaoChange, emptyDefaults, defaultMarginPct = 20, substrateLabel = "Papel", hideArtFinishings = false, suggestAllFinishings = false, suggestedPapers, defaultPaperHint, preselectedFinishings }: Props) {


  const { hourlyRate } = useV3HourlyRate();
  const { loading, items, tiers, settings } = useV3Catalog();
  const [catalog, setCatalog] = useState<PrintingCatalogItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sideChoice, setSideChoice] = useState<"Frente" | "F/V">(
    defaultPaperHint?.side === "F/V" ? "F/V" : "Frente",
  );
  const [descricaoLocal, setDescricaoLocal] = useState("");
  const descricao = descricaoProp ?? descricaoLocal;
  const setDescricao = onDescricaoChange ?? setDescricaoLocal;
  const controlledDescricao = onDescricaoChange !== undefined;
  const [quantidade, setQuantidade] = useState(0);
  const [extraTiers, setExtraTiers] = useState<number[]>([]);
  const [finEnabled, setFinEnabled] = useState<Record<string, boolean>>({});
  const [pulse, setPulse] = useState(false);

  // Catálogo de acabamentos de impressão (cadastro unificado)
  const [printFinishings, setPrintFinishings] = useState<FinishingItem[]>([]);
  useEffect(() => {
    listFinishings("impressao")
      .then((all) =>
        setPrintFinishings(
          hideArtFinishings
            ? all.filter((f) => !/^arte\b/i.test(f.name.trim()))
            : all,
        ),
      )
      .catch(() => setPrintFinishings([]));
  }, [hideArtFinishings]);

  // Em modo Personalizado, pré-liga todos os acabamentos como sugestão (uma vez).
  const didSuggestRef = useRef(false);
  useEffect(() => {
    if (!suggestAllFinishings) return;
    if (didSuggestRef.current) return;
    if (printFinishings.length === 0) return;
    didSuggestRef.current = true;
    setFinEnabled((m) => {
      const next = { ...m };
      for (const f of printFinishings) next[f.id] = true;
      return next;
    });
  }, [suggestAllFinishings, printFinishings]);

  // Pré-seleciona um item do catálogo a partir do hint do preset (papel + gramatura + lado).
  const didPickDefaultRef = useRef(false);
  useEffect(() => {
    if (didPickDefaultRef.current) return;
    if (catalog) return;
    if (!defaultPaperHint?.name) return;
    if (!items.length) return;
    const norm = (s: string | null | undefined) =>
      (s ?? "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const wantName = norm(defaultPaperHint.name);
    const wantGram = defaultPaperHint.grammage ? norm(defaultPaperHint.grammage) : "";
    const wantSide = defaultPaperHint.side ? norm(defaultPaperHint.side) : "";
    const matches = items.filter((it) => {
      const n = norm(it.paper_type);
      if (!n.includes(wantName) && !wantName.includes(n)) return false;
      if (wantGram && norm(it.grammage).replace(/[^0-9]/g, "") !== wantGram.replace(/[^0-9]/g, "")) return false;
      return true;
    });
    if (!matches.length) return;
    const withSide = wantSide ? matches.find((it) => norm(it.side) === wantSide) : null;
    const picked = withSide ?? matches[0];
    didPickDefaultRef.current = true;
    setCatalog(picked);
    // Respeita o lado pedido pelo preset mesmo quando não há variante exata no catálogo.
    if (defaultPaperHint.side === "F/V" || defaultPaperHint.side === "Frente") {
      setSideChoice(defaultPaperHint.side);
    }
  }, [defaultPaperHint, items, catalog]);

  // Pré-marca acabamentos sugeridos pelo preset (uma vez).
  const didPreselectFinRef = useRef(false);
  useEffect(() => {
    if (didPreselectFinRef.current) return;
    if (!preselectedFinishings?.length) return;
    if (printFinishings.length === 0) return;
    const wanted = new Set(preselectedFinishings.map((s) => s.trim().toLowerCase()));
    const toEnable = printFinishings
      .filter((f) => wanted.has(f.id.toLowerCase()) || wanted.has(f.name.trim().toLowerCase()))
      .map((f) => f.id);
    if (!toEnable.length) return;
    didPreselectFinRef.current = true;
    setFinEnabled((m) => {
      const next = { ...m };
      for (const id of toEnable) next[id] = true;
      return next;
    });
  }, [preselectedFinishings, printFinishings]);



  // Lona / banner
  // Conjunto de acabamentos derivado do catálogo unificado.
  // O hint reflete o preço efetivo da quantidade atual (tier aplicada quando há).
  const finishes = useMemo<FinishingDef[]>(
    () =>
      printFinishings.map((f) => {
        let hint: string;
        // Caso especial: per_unit com preço 0 + etapa vinculada → cobra só pela etapa.
        // Mostra o custo real (min × R$/hora) no hint para não parecer "grátis".
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
          const tier = pickFinishingTier(f.tiers ?? [], quantidade);
          const effective = tier ? tier.price_per_sheet : f.price_per_sheet;
          hint = tier
            ? `${fmtBRL(effective)}/folha (faixa ${tier.label || `${tier.min_qty}${tier.max_qty ? `-${tier.max_qty}` : "+"}`})`
            : `${fmtBRL(effective)}/folha`;
          if (f.production_step) hint += ` · +${f.production_step.time_minutes} min`;
        }
        return { id: f.id, label: f.name, hint };
      }),
    [printFinishings, quantidade, hourlyRate],
  );

  // Limpa chips que não pertencem ao conjunto atual
  useEffect(() => {
    setFinEnabled((m) => {
      const allowed = new Set(finishes.map((f) => f.id));
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(m)) if (allowed.has(k) && m[k]) next[k] = true;
      return next;
    });
  }, [finishes]);

  // Labels dos acabamentos atualmente ligados (usado para descrição/sugestão)
  const enabledLabels = useMemo(
    () =>
      finishes
        .filter((f) => finEnabled[f.id])
        .map((f) => f.label),
    [finishes, finEnabled],
  );

  // Expõe a seleção atual para o wrapper poder sugerir produto.
  useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange({
      paper_type: catalog?.paper_type ?? null,
      size: catalog?.size ?? null,
      grammage: catalog?.grammage ?? null,
      finishings: enabledLabels,
    });
  }, [catalog, enabledLabels, onSelectionChange]);

  // Catálogo "efetivo" — aplica o lado escolhido pelo usuário (Frente/F/V) mesmo
  // quando o catálogo cadastrado tem só uma variante. F/V dobra o custo de
  // impressão e do papel (paridade com PrintingItemSearch).
  const effectiveCatalog = useMemo(() => {
    if (!catalog) return null;
    if (sideChoice === catalog.side) return catalog;
    return { ...catalog, side: sideChoice } as PrintingCatalogItem;
  }, [catalog, sideChoice]);

  const pricing = useMemo(
    () => (effectiveCatalog ? pricePerSheet(effectiveCatalog, tiers, quantidade) : null),
    [effectiveCatalog, tiers, quantidade],
  );

  // Ao trocar de lado, tenta achar uma variante equivalente no catálogo (mesmo
  // papel + gramatura + tamanho) com o lado escolhido. Se não existir, mantém
  // o item atual — effectiveCatalog aplica o override de lado e pricePerSheet
  // ajusta o custo (F/V dobra; Frente usa base).
  useEffect(() => {
    if (!catalog) return;
    if (catalog.side === sideChoice) return;
    const sibling = items.find(
      (it) =>
        it.paper_type === catalog.paper_type &&
        (it.grammage || "") === (catalog.grammage || "") &&
        it.size === catalog.size &&
        it.side === sideChoice,
    );
    if (sibling) setCatalog(sibling);
  }, [sideChoice, catalog, items]);

  // Filtra catálogo conforme o lado escolhido.
  // - "Frente": esconde itens cadastrados como F/V.
  // - "F/V":    mostra apenas itens F/V, mais os marcados como exceção F/V (ex.: Sulfite 75g A4).
  const filteredItems = useMemo(
    () => filterItemsBySideChoice(items, sideChoice),
    [items, sideChoice],
  );

  // Trocar o lado: se o papel atual deixar de ser compatível, limpa a seleção.
  const changeSide = (next: SideChoice) => {
    setSideChoice(next);
    if (shouldClearOnSideChange(catalog, next)) {
      setCatalog(null);
    }
  };

  const canAdd = !!catalog && quantidade > 0 && (pricing?.sellingPrice ?? 0) > 0;

  const buildLabel = () => {
    if (!catalog) return "";
    // Mantém apenas o que o usuário digitou. O cart cuida do fallback
    // ("Impresso personalizado" / pluralização) e a linha 2 já mostra os specs.
    return descricao.trim();
  };

  // Snapshot das seleções de acabamentos resolvendo tiers por quantidade.
  // per_sheet  → preço efetivo na faixa (cai no base se não houver tier).
  // per_unit   → mantém preço base (faixas são por folhas, não por unidade).
  const buildSelections = (qty: number) =>
    printFinishings
      .filter((f) => finEnabled[f.id])
      .map((f) => {
        const effective =
          f.pricing_model === "per_sheet"
            ? resolveFinishingPricePerSheet(f.price_per_sheet, f.tiers ?? [], qty)
            : f.price_per_sheet;
        return {
          id: f.id,
          name: f.name,
          pricing_model: f.pricing_model,
          unit_label: f.unit_label,
          price: effective,
          cost: effective,
        };
      });

  const selections = useMemo(
    () => buildSelections(quantidade),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [printFinishings, finEnabled, quantidade],
  );

  const finishingExtraPerSheet = useMemo(() => {
    const { perSheet, perUnitTotal } = sumFinishingsPerSheet(selections, quantidade);
    return perSheet + (quantidade > 0 ? perUnitTotal / quantidade : 0);
  }, [selections, quantidade]);

  const buildItem = (qty: number, tierGroupId?: string): V3PrintItem | null => {
    if (!catalog || !effectiveCatalog) return null;
    const pr = pricePerSheet(effectiveCatalog, tiers, qty);
    const sel = buildSelections(qty);
    const { perSheet, perUnitTotal } = sumFinishingsPerSheet(sel, qty);
    const extra = perSheet + (qty > 0 ? perUnitTotal / qty : 0);
    return {
      id: genId(),
      kind: "print",
      descricao: buildLabel(),
      quantidade: qty,
      tier_group_id: tierGroupId ?? null,
      catalog_item_id: catalog.id,
      paper_type: catalog.paper_type,
      grammage: catalog.grammage,
      size: catalog.size,
      side: effectiveCatalog.side,
      printer_category_id: catalog.printer_category_id,
      markup_group_id: catalog.markup_group_id,
      valor_unitario: pr.sellingPrice + extra,
      custo_unitario: pr.baseCost + extra,
      formato: null,
      cores: null,
      face: effectiveCatalog.side === "F/V" ? "fv" : "frente",
      finishings: enabledLabels,
      finishing_selections: sel,
    };
  };

  // Gera 1 V3LaborItem por acabamento ligado que tenha etapa de produção vinculada.
  // O tempo é fixo por etapa (não escala com a tiragem) — mesmo critério do
  // catálogo Etapas. Bundled com o item de impressão para visualização agrupada.
  const buildLinkedLaborItems = (bundleId: string): V3LaborItem[] => {
    return printFinishings
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
  };

  const submit = () => {
    if (!canAdd) return;
    const item = buildItem(quantidade);
    if (!item) return;
    const cleanExtras = [...new Set(extraTiers)]
      .filter((q) => q > 0 && q !== quantidade)
      .sort((a, b) => a - b);

    const bundleId = `bnd_${genId()}`;
    const laborItems = buildLinkedLaborItems(bundleId);
    const hasLabor = laborItems.length > 0;

    if (cleanExtras.length > 0 && onAddTiers && catalog) {
      const tg = `tg_${genId()}`;
      const primary = {
        ...item,
        tier_group_id: tg,
        tier_primary: true,
        ...(hasLabor ? { bundle_id: bundleId, bundle_label: item.descricao || "Impressão" } : {}),
      } as V3PrintItem;
      const siblings = cleanExtras
        .map((q) => {
          const it = buildItem(q, tg);
          return it ? ({ ...it, tier_primary: false } as V3PrintItem) : null;
        })
        .filter((x): x is V3PrintItem => !!x);
      onAddTiers([primary, ...siblings]);
      if (hasLabor && onAddMany) onAddMany(laborItems);
    } else if (hasLabor && onAddMany) {
      const printWithBundle = {
        ...item,
        bundle_id: bundleId,
        bundle_label: item.descricao || "Impressão",
      } as V3PrintItem;
      onAddMany([printWithBundle, ...laborItems]);
    } else {
      onAdd(item);
    }
    setDescricao("");
    setFinEnabled({});
    setExtraTiers([]);
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
                ? `Padrão: ${catalog.paper_type}${catalog.grammage ? ` ${catalog.grammage}` : ""} — ${catalog.size} ${catalog.side}`
                : `Selecione o ${substrateLabel.toLowerCase()} primeiro`
            }

            className="h-9"
          />
        </Field>
      )}


      {/* Lado de impressão — sempre visível antes do papel */}
      <SideChoiceToggle value={sideChoice} onChange={changeSide} />

      {/* Cabeçalho do papel — altura constante; abre modal para escolher/trocar */}
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 flex items-center gap-3 flex-nowrap">
        {catalog && effectiveCatalog ? (
          <>
            <Printer className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {catalog.paper_type}
                {catalog.grammage ? ` ${catalog.grammage}` : ""} — {catalog.size} {effectiveCatalog.side}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground truncate">
                  {catalog.category_name}
                </span>
                {pricing?.tierLabel && (
                  <Badge variant="secondary" className="h-4 text-[10px] px-1.5 whitespace-nowrap shrink-0">
                    {pricing.tierLabel}
                  </Badge>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <span className={substrateLabel !== "Papel" ? "text-primary shrink-0" : "text-muted-foreground shrink-0"}>
              {substrateLabel === "Papel" ? <FileText className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                Selecionar {substrateLabel.toLowerCase()}
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                Escolha um item do catálogo para calcular o preço
              </p>
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="ml-auto shrink-0 inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          {catalog ? "Trocar" : "Escolher"}
        </button>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-1.5">
              <span className={substrateLabel !== "Papel" ? "text-primary" : "text-muted-foreground"}>
                {substrateLabel === "Papel" ? <FileText className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              </span>
              Selecionar {substrateLabel.toLowerCase()}
            </DialogTitle>
          </DialogHeader>

          <div className="text-[11px] text-muted-foreground -mt-1">
            Filtrando por lado: <span className="font-medium text-foreground">{sideChoice}</span>
          </div>


          <PrintingItemSearch
            items={filteredItems}
            markupTiers={tiers}
            globalSettings={settings}
            onSelect={(it) => {
              setCatalog(it);
              setPickerOpen(false);
            }}
            placeholder={`Buscar ${substrateLabel.toLowerCase()} (nome, tamanho, impressora)...`}
            defaultCategory={(() => {
              if (!suggestedPapers?.length) return null;
              const wanted = new Set(suggestedPapers.map((s) => s.trim().toLowerCase()));
              const cats = new Set<string>();
              for (const it of items) {
                if (!it.paper_category) continue;
                if (wanted.has((it.paper_type || "").trim().toLowerCase())) cats.add(it.paper_category);
              }
              if (cats.size === 1) {
                const only = [...cats][0];
                if (only === "comum" || only === "especial" || only === "adesivo") return only;
              }
              return null;
            })()}
          />

          {loading && (
            <p className="text-[11px] text-muted-foreground mt-1">Carregando catálogo…</p>
          )}
        </DialogContent>
      </Dialog>


      <div className="grid grid-cols-2 gap-4">
        <Field label="Quantidade (folhas)">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={quantidade === 0 ? "" : quantidade}
            placeholder="Ex: 1000"
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setQuantidade(0);
                return;
              }
              setQuantidade(Math.max(1, Number(raw) || 1));
            }}
            className="h-9"
          />
        </Field>
        <Field label="Preço unitário">
          <div className="h-9 px-3 rounded-md border border-border bg-muted/40 flex items-center justify-between">
            <span className="text-sm font-semibold text-primary tabular-nums">
              {pricing ? fmtBRL(pricing.sellingPrice + finishingExtraPerSheet) : "—"}
            </span>
            {pricing && finishingExtraPerSheet > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                + {fmtBRL(finishingExtraPerSheet)} acab.
              </span>
            )}
          </div>
        </Field>
      </div>

      {onAddTiers && (
        <TierFaixasPanel
          currentQty={quantidade}
          disabled={!catalog || !pricing}
          onExtrasChange={setExtraTiers}
          compute={(q) => {
            const p = effectiveCatalog ? pricePerSheet(effectiveCatalog, tiers, q) : null;
            return {
              custo_total: (p?.baseCost ?? 0) * q,
              preco_total: (p?.sellingPrice ?? 0) * q,
            };
          }}
        />
      )}



      <Field label="Acabamentos">
        <FinishingProgressive
          items={finishes}
          enabled={finEnabled}
          onToggle={(id, on) => setFinEnabled((m) => ({ ...m, [id]: on }))}
        />
      </Field>

      <div className="sticky bottom-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 mt-auto -mb-5 lg:-mb-0 bg-background border-t border-border shadow-[0_-8px_16px_-8px_hsl(var(--background))] flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {pricing && (
            <span>
              Total:{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {fmtBRL((pricing.sellingPrice + finishingExtraPerSheet) * quantidade)}
              </span>
            </span>
          )}
        </div>
        <Button
          onClick={submit}
          disabled={!canAdd}
          className={cn(
            "min-w-[200px] transition-colors",
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
              Adicionar + {extraTiers.length} faixa{extraTiers.length === 1 ? "" : "s"}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" /> Adicionar ao orçamento
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children, icon, highlight, className }: { label: string; children: React.ReactNode; icon?: React.ReactNode; highlight?: boolean; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className={cn(
        "text-xs uppercase tracking-wide inline-flex items-center gap-1.5",
        highlight ? "text-primary font-semibold" : "text-muted-foreground",
      )}>
        {icon && <span className={highlight ? "text-primary" : "text-primary/70"}>{icon}</span>}
        {label}
      </Label>
      {children}
    </div>
  );
}
