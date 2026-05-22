import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Check, Plus, Printer, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import PrintingItemSearch, {
  type PrintingCatalogItem,
} from "@/components/orcamentos/PrintingItemSearch";
import { FinishingProgressive, type FinishingDef } from "../shared/FinishingProgressive";
import { useV3Catalog, pricePerSheet } from "../shared/useV3Catalog";
import { fmtBRL } from "../shared/pricing";
import { BASTOES_CM, sugerirBastao } from "../shared/bastaoSuggester";
import { TierFaixasPanel } from "../shared/TierFaixasPanel";
import { genId, type V3PrintItem } from "../types";
import { listFinishings, sumFinishingsPerSheet, type FinishingItem } from "@/lib/finishings/catalog";
import { resolveFinishingPricePerSheet, pickFinishingTier } from "@/lib/labels/finishing-pricing";

interface Props {
  onAdd: (item: V3PrintItem) => void;
  onAddTiers?: (items: V3PrintItem[]) => void;
  onSelectionChange?: (sel: {
    paper_type: string | null;
    size: string | null;
    grammage: string | null;
    finishings: string[];
  }) => void;
  descricao?: string;
  onDescricaoChange?: (v: string) => void;
}


const FINISHES_LONA: FinishingDef[] = [
  { id: "ilhos", label: "Ilhós", hint: "Reforço metálico nos cantos" },
  { id: "bainha", label: "Bainha / costura", hint: "Reforço da borda" },
  { id: "corte_especial", label: "Corte especial" },
  { id: "laminacao", label: "Laminação" },
];

const FINISHES_BANNER: FinishingDef[] = [
  { id: "bastao", label: "Bastão", hint: "Suporte superior/inferior" },
  { id: "ilhos", label: "Ilhós" },
  { id: "bainha", label: "Bainha / costura" },
  { id: "ponteiras", label: "Ponteiras" },
  { id: "reforco_borda", label: "Reforço de borda" },
];

export function PrintForm({ onAdd, onAddTiers, onSelectionChange, descricao: descricaoProp, onDescricaoChange }: Props) {
  const { loading, items, tiers, settings } = useV3Catalog();
  const [catalog, setCatalog] = useState<PrintingCatalogItem | null>(null);
  const [descricaoLocal, setDescricaoLocal] = useState("");
  const descricao = descricaoProp ?? descricaoLocal;
  const setDescricao = onDescricaoChange ?? setDescricaoLocal;
  const controlledDescricao = onDescricaoChange !== undefined;
  const [quantidade, setQuantidade] = useState(100);
  const [finEnabled, setFinEnabled] = useState<Record<string, boolean>>({});
  const [pulse, setPulse] = useState(false);

  // Catálogo de acabamentos de impressão (cadastro unificado)
  const [printFinishings, setPrintFinishings] = useState<FinishingItem[]>([]);
  useEffect(() => {
    listFinishings("impressao")
      .then(setPrintFinishings)
      .catch(() => setPrintFinishings([]));
  }, []);

  // Lona / banner
  const isLona = useMemo(
    () => /lona|banner|vinil/i.test(catalog?.paper_type || ""),
    [catalog],
  );
  const [isBanner, setIsBanner] = useState(false);
  const [bannerLarguraCm, setBannerLarguraCm] = useState<number>(0);
  const [bannerAlturaCm, setBannerAlturaCm] = useState<number>(0);
  const [bastaoOverride, setBastaoOverride] = useState<number | null>(null);

  // Auto-marcar "É banner?" quando o nome já indicar banner
  useEffect(() => {
    if (!catalog) {
      setIsBanner(false);
      setBannerLarguraCm(0);
      setBannerAlturaCm(0);
      setBastaoOverride(null);
      return;
    }
    if (isLona) {
      setIsBanner(/banner/i.test(catalog.paper_type));
    } else {
      setIsBanner(false);
    }
  }, [catalog, isLona]);

  // Conjunto padrão derivado do catálogo unificado.
  // O hint reflete o preço efetivo da quantidade atual (tier aplicada quando há).
  const FINISHES_PADRAO = useMemo<FinishingDef[]>(
    () =>
      printFinishings.map((f) => {
        let hint: string;
        if (f.pricing_model === "per_unit") {
          hint = `${fmtBRL(f.price_per_sheet)}/${f.unit_label ?? "un"}`;
        } else {
          const tier = pickFinishingTier(f.tiers ?? [], quantidade);
          const effective = tier ? tier.price_per_sheet : f.price_per_sheet;
          hint = tier
            ? `${fmtBRL(effective)}/folha (faixa ${tier.label || `${tier.min_qty}${tier.max_qty ? `-${tier.max_qty}` : "+"}`})`
            : `${fmtBRL(effective)}/folha`;
        }
        return { id: f.id, label: f.name, hint };
      }),
    [printFinishings, quantidade],
  );

  // Seleciona conjunto de acabamentos
  const finishes = useMemo<FinishingDef[]>(() => {
    if (isLona && isBanner) return FINISHES_BANNER;
    if (isLona) return FINISHES_LONA;
    return FINISHES_PADRAO;
  }, [isLona, isBanner, FINISHES_PADRAO]);

  // Limpa chips que não pertencem ao conjunto atual
  useEffect(() => {
    setFinEnabled((m) => {
      const allowed = new Set(finishes.map((f) => f.id));
      const next: Record<string, boolean> = {};
      for (const k of Object.keys(m)) if (allowed.has(k) && m[k]) next[k] = true;
      return next;
    });
  }, [finishes]);

  // Sugestão de bastão
  const bastaoSugestao = useMemo(
    () => (isLona && isBanner ? sugerirBastao(bannerLarguraCm) : null),
    [isLona, isBanner, bannerLarguraCm],
  );
  const bastaoEscolhido = bastaoOverride ?? bastaoSugestao?.bastao ?? null;
  const bastaoInvalido =
    bastaoEscolhido != null &&
    bannerLarguraCm > 0 &&
    bastaoEscolhido < bannerLarguraCm + 2;

  // Injeta painel "advanced" no chip Bastão quando estiver em modo banner
  const finishesComBastao = useMemo<FinishingDef[]>(() => {
    if (!(isLona && isBanner)) return finishes;
    return finishes.map((f) => {
      if (f.id !== "bastao") return f;
      return {
        ...f,
        advanced: (
          <BastaoPanel
            larguraCm={bannerLarguraCm}
            sugestao={bastaoSugestao}
            escolhido={bastaoEscolhido}
            invalido={bastaoInvalido}
            onChange={(v) => setBastaoOverride(v)}
          />
        ),
      };
    });
  }, [finishes, isLona, isBanner, bannerLarguraCm, bastaoSugestao, bastaoEscolhido, bastaoInvalido]);

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

  const pricing = useMemo(
    () => (catalog ? pricePerSheet(catalog, tiers, quantidade) : null),
    [catalog, tiers, quantidade],
  );

  const canAdd = !!catalog && quantidade > 0 && (pricing?.sellingPrice ?? 0) > 0;

  const buildLabel = () => {
    if (!catalog) return "";
    let label =
      descricao.trim() ||
      `${catalog.paper_type}${catalog.grammage ? ` ${catalog.grammage}` : ""} — ${catalog.size} ${catalog.side}`;
    if (isLona && isBanner) {
      if (bannerLarguraCm > 0 && bannerAlturaCm > 0) {
        label += ` — Banner ${bannerLarguraCm}x${bannerAlturaCm}cm`;
      }
      if (finEnabled.bastao && bastaoEscolhido && bastaoSugestao) {
        label += ` — Bastão ${bastaoEscolhido}cm × ${bastaoSugestao.quantidade}`;
        if (bastaoSugestao.emenda) label += " (c/ emenda)";
      }
    }
    return label;
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
    if (!catalog) return null;
    const pr = pricePerSheet(catalog, tiers, qty);
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
      side: catalog.side,
      printer_category_id: catalog.printer_category_id,
      markup_group_id: catalog.markup_group_id,
      valor_unitario: pr.sellingPrice + extra,
      custo_unitario: pr.baseCost + extra,
      formato: null,
      cores: null,
      face: catalog.side === "F/V" ? "fv" : "frente",
      finishings: enabledLabels,
      finishing_selections: sel,
    };
  };

  const submit = () => {
    if (!canAdd) return;
    const item = buildItem(quantidade);
    if (!item) return;
    onAdd(item);
    setDescricao("");
    setFinEnabled({});
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  const submitAsTiers = (qtys: number[], primaryQty: number) => {
    if (!onAddTiers || !catalog) return;
    const tg = `tg_${genId()}`;
    const items = qtys
      .map((q) => {
        const it = buildItem(q, tg);
        return it ? ({ ...it, tier_primary: q === primaryQty } as V3PrintItem) : null;
      })
      .filter((x): x is V3PrintItem => !!x);
    if (items.length === 0) return;
    onAddTiers(items);
    setDescricao("");
    setFinEnabled({});
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
            placeholder={
              catalog
                ? `Padrão: ${catalog.paper_type}${catalog.grammage ? ` ${catalog.grammage}` : ""} — ${catalog.size} ${catalog.side}`
                : "Selecione o item primeiro"
            }
            className="h-9"
          />
        </Field>
      )}


      {!catalog && (
        <Field label="Item do catálogo">
          <PrintingItemSearch
            items={items}
            markupTiers={tiers}
            globalSettings={settings}
            onSelect={(it) => setCatalog(it)}
          />
          {loading && (
            <p className="text-[11px] text-muted-foreground mt-1">Carregando catálogo…</p>
          )}
        </Field>
      )}

      {catalog && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 flex items-center gap-3">
          <Printer className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {catalog.paper_type}
              {catalog.grammage ? ` ${catalog.grammage}` : ""} — {catalog.size} {catalog.side}
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
          {isLona && (
            <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
              É banner?
              <Switch checked={isBanner} onCheckedChange={(v) => setIsBanner(!!v)} />
            </label>
          )}
          <button
            type="button"
            onClick={() => setCatalog(null)}
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Trocar
          </button>
        </div>
      )}

      {isLona && isBanner && (
        <div className="grid grid-cols-2 gap-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-3">
          <Field label="Largura do banner (cm)">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={bannerLarguraCm || ""}
              onChange={(e) => {
                setBannerLarguraCm(Math.max(0, Number(e.target.value) || 0));
                setBastaoOverride(null);
              }}
              placeholder="ex.: 120"
              className="h-9"
            />
          </Field>
          <Field label="Altura do banner (cm)">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={bannerAlturaCm || ""}
              onChange={(e) => setBannerAlturaCm(Math.max(0, Number(e.target.value) || 0))}
              placeholder="ex.: 90"
              className="h-9"
            />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Quantidade (folhas)">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={quantidade}
              onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
              className="h-9 flex-1"
            />
            <TierSimulator
              currentQty={quantidade}
              disabled={!catalog || !pricing}
              onPickQty={(q) => setQuantidade(q)}
              onCloneAsTiers={onAddTiers ? submitAsTiers : undefined}
              compute={(q) => {
                const p = catalog ? pricePerSheet(catalog, tiers, q) : null;
                return {
                  custo_total: (p?.baseCost ?? 0) * q,
                  preco_total: (p?.sellingPrice ?? 0) * q,
                };
              }}
            />
          </div>
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



      <Field label="Acabamentos">
        <FinishingProgressive
          items={finishesComBastao}
          enabled={finEnabled}
          onToggle={(id, on) => setFinEnabled((m) => ({ ...m, [id]: on }))}
        />
      </Field>

      <div className="flex items-center justify-between pt-2">
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

function BastaoPanel({
  larguraCm,
  sugestao,
  escolhido,
  invalido,
  onChange,
}: {
  larguraCm: number;
  sugestao: ReturnType<typeof sugerirBastao>;
  escolhido: number | null;
  invalido: boolean;
  onChange: (v: number | null) => void;
}) {
  if (!larguraCm) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Informe a largura do banner para calcular o bastão.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {sugestao && (
        <p className="text-[11px] text-foreground">
          Sugestão:{" "}
          <strong className="text-primary">
            bastão de {sugestao.bastao} cm × {sugestao.quantidade}
          </strong>{" "}
          <span className="text-muted-foreground">
            (largura {larguraCm}cm + 2cm de sobra = {sugestao.necessarioCm}cm úteis)
          </span>
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {BASTOES_CM.map((b) => {
          const active = escolhido === b;
          const invalidThis = b < larguraCm + 2;
          return (
            <button
              key={b}
              type="button"
              onClick={() => onChange(b === sugestao?.bastao ? null : b)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
                invalidThis && !active && "opacity-50",
              )}
              title={invalidThis ? "Não cabe na largura + 2cm de sobra" : undefined}
            >
              {b} cm
            </button>
          );
        })}
      </div>
      {sugestao?.emenda && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          Necessária emenda — {sugestao.quantidade} bastões de {sugestao.bastao}cm.
        </p>
      )}
      {invalido && (
        <p className="flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3" />
          Bastão escolhido menor que a largura + 2cm de sobra.
        </p>
      )}
    </div>
  );
}
