// Sub-formulário: Cartão de Visita (built-in).
// - Quantidade em unidades de cartão; calcula folhas automaticamente.
// - Papel: Couchê 300g em SRA3 (auto-detectado no catálogo, com toggle F/V).
// - Layout (folha, margens, gap, cartão) editável.
// - Chips opcionais Corte e Laminação (filtrados do cadastro de acabamentos).
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, FileText, Files, Plus, Printer, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FinishingProgressive, type FinishingDef } from "../shared/FinishingProgressive";
import { useV3Catalog, pricePerSheet } from "../shared/useV3Catalog";
import { fmtBRL } from "../shared/pricing";
import { genId, type V3PrintItem } from "../types";
import { useProductKitProcesses } from "../shared/useProductKitProcesses";
import { useHourRate } from "@/hooks/useHourRate";
import {
  calcCardsPerSheet,
  sheetsNeeded,
} from "@/lib/orcamentos-v3/business-card-yield";
import type { PrintingCatalogItem } from "@/components/orcamentos/PrintingItemSearch";

interface Props {
  onAdd: (item: V3PrintItem) => void;
  descricao?: string;
  onDescricaoChange?: (v: string) => void;
}

const DEFAULTS = {
  sheetW: 328, // mm
  sheetH: 478,
  marginMm: 7,
  gapMm: 6,
  cardW: 90,
  cardH: 50,
};

// SRA3 (32,8 × 47,8 cm). Aceita também rótulo "A3" (comum em gráficas BR que
// usam folha SRA3 cadastrada como "A3").
const isSRA3Size = (size: string | null | undefined) =>
  /sra3|32[.,]?8.*47[.,]?8|47[.,]?8.*32[.,]?8|^\s*a3\s*$/i.test(size || "");

const isCouche300 = (paperType: string | null | undefined, gram: string | null | undefined) =>
  /couch/i.test(paperType || "") && /300/.test(gram || "");

export function BusinessCardForm({ onAdd, descricao: descricaoProp, onDescricaoChange }: Props) {
  const { loading, items, tiers } = useV3Catalog();

  const [descricaoLocal, setDescricaoLocal] = useState("");
  const descricao = descricaoProp ?? descricaoLocal;
  const setDescricao = onDescricaoChange ?? setDescricaoLocal;

  const [qtdCartoes, setQtdCartoes] = useState(0);
  const [face, setFace] = useState<"frente" | "fv">("frente");
  const [layout, setLayout] = useState(DEFAULTS);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [finEnabled, setFinEnabled] = useState<Record<string, boolean>>({});
  const [pulse, setPulse] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);

  // Acabamentos do Cartão de Visita: vêm do Kit de Produto ativo cadastrado
  // em Insumos → Kits de Produto (product_kind = "cartao_visita").
  const { steps } = useProductKitProcesses("cartao_visita");
  const { hourRate } = useHourRate();

  type CVProc = {
    key: string;
    kind: "step";
    name: string;
    minutes: number;
    link_type: "fixed" | "optional";
    default_on: boolean;
  };
  const cvProcs = useMemo<CVProc[]>(
    () =>
      steps.map((s) => ({
        key: `step:${s.id}`,
        kind: "step" as const,
        name: s.description,
        minutes: Number.isFinite(s.time_minutes) ? s.time_minutes : 0,
        link_type: s.link_type,
        default_on: s.default_on,
      })),
    [steps],
  );

  const fixedProcs = useMemo(() => cvProcs.filter((p) => p.link_type === "fixed"), [cvProcs]);
  const optionalProcs = useMemo(() => cvProcs.filter((p) => p.link_type === "optional"), [cvProcs]);



  // Candidatos a Couchê 300g SRA3
  const couche300Sra3 = useMemo(
    () =>
      items.filter(
        (it) => isCouche300(it.paper_type, it.grammage) && isSRA3Size(it.size),
      ),
    [items],
  );

  // Tenta achar variante exata por face; senão usa qualquer um e o engine multiplica F/V.
  const catalog: PrintingCatalogItem | null = useMemo(() => {
    if (couche300Sra3.length === 0) return null;
    if (selectedCatalogId) {
      const sel = couche300Sra3.find((c) => c.id === selectedCatalogId);
      if (sel) return sel;
    }
    const wantSide = face === "fv" ? "F/V" : "Frente";
    const exact = couche300Sra3.find((c) => (c.side || "").toLowerCase() === wantSide.toLowerCase());
    return exact ?? couche300Sra3[0];
  }, [couche300Sra3, selectedCatalogId, face]);

  // Aproveitamento
  const yieldRes = useMemo(() => calcCardsPerSheet(layout), [layout]);
  const sheets = useMemo(
    () => sheetsNeeded(qtdCartoes, yieldRes.perSheet),
    [qtdCartoes, yieldRes.perSheet],
  );
  const sobra = Math.max(0, sheets * yieldRes.perSheet - qtdCartoes);

  // Precificação por folha (com side mult quando o item escolhido não for F/V mas usuário pediu F/V).
  const effectiveItem: PrintingCatalogItem | null = useMemo(() => {
    if (!catalog) return null;
    const isCatalogFV = (catalog.side || "").toUpperCase() === "F/V";
    if (face === "fv" && !isCatalogFV) {
      return { ...catalog, side: "F/V" };
    }
    if (face === "frente" && isCatalogFV) {
      return { ...catalog, side: "Frente" };
    }
    return catalog;
  }, [catalog, face]);

  const pricing = useMemo(
    () => (effectiveItem && sheets > 0 ? pricePerSheet(effectiveItem, tiers, sheets) : null),
    [effectiveItem, tiers, sheets],
  );

  // Custo de cada processo: minutos/60 * hourRate
  const procCost = (minutes: number) => {
    const m = Number.isFinite(minutes) ? minutes : 0;
    return (m / 60) * (hourRate || 0);
  };


  const toFinishingDef = (p: CVProc): FinishingDef => ({
    id: p.key,
    label: `⚙ ${p.name}`,
    hint: `${p.minutes} min · ${fmtBRL(procCost(p.minutes))}`,
  });
  const fixedFinishes = useMemo<FinishingDef[]>(
    () => fixedProcs.map(toFinishingDef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fixedProcs, hourRate],
  );
  const optionalFinishes = useMemo<FinishingDef[]>(
    () => optionalProcs.map(toFinishingDef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optionalProcs, hourRate],
  );

  // Pré-marca fixos e opcionais com default_on; mantém escolhas do usuário; limpa órfãos.
  useEffect(() => {
    setFinEnabled((m) => {
      const next: Record<string, boolean> = {};
      for (const p of cvProcs) {
        if (p.link_type === "fixed") next[p.key] = true;
        else if (m[p.key] !== undefined) next[p.key] = m[p.key];
        else if (p.default_on) next[p.key] = true;
      }
      return next;
    });
  }, [cvProcs]);

  const selectedProcs = useMemo(
    () => cvProcs.filter((p) => finEnabled[p.key]),
    [cvProcs, finEnabled],
  );

  const enabledLabels = useMemo(
    () => selectedProcs.map((p) => p.name),
    [selectedProcs],
  );

  const finishingTotal = useMemo(
    () => selectedProcs.reduce((s, p) => s + procCost(p.minutes), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedProcs, hourRate],
  );

  const finishingExtraPerSheet = sheets > 0 ? finishingTotal / sheets : 0;

  const totalGeral = pricing ? (pricing.sellingPrice + finishingExtraPerSheet) * sheets : 0;
  const precoPorCartao = qtdCartoes > 0 ? totalGeral / qtdCartoes : 0;

  const canAdd =
    !!effectiveItem && qtdCartoes > 0 && sheets > 0 && (pricing?.sellingPrice ?? 0) > 0;

  const submit = () => {
    if (!canAdd || !effectiveItem || !pricing) return;
    const sel = selectedProcs.map((p) => {
      const cost = procCost(p.minutes);
      return {
        id: p.key,
        name: p.name,
        pricing_model: "per_unit" as const,
        unit_label: "min",
        price: cost,
        cost,
      };
    });
    const extra = finishingExtraPerSheet;
    const faceLabel = face === "fv" ? "Frente e Verso" : "Frente";
    const defaultDesc = `Cartão de visita ${layout.cardW / 10}×${layout.cardH / 10}cm — Couchê 300g ${faceLabel} (${qtdCartoes} un)`;
    const item: V3PrintItem = {
      id: genId(),
      kind: "print",
      descricao: descricao.trim() || defaultDesc,
      quantidade: sheets,
      tier_group_id: null,
      catalog_item_id: effectiveItem.id,
      paper_type: effectiveItem.paper_type,
      grammage: effectiveItem.grammage,
      size: effectiveItem.size,
      side: face === "fv" ? "F/V" : "Frente",
      printer_category_id: effectiveItem.printer_category_id,
      markup_group_id: effectiveItem.markup_group_id,
      valor_unitario: pricing.sellingPrice + extra,
      custo_unitario: pricing.baseCost + extra,
      formato: null,
      cores: null,
      face: face === "fv" ? "fv" : "frente",
      finishings: enabledLabels,
      finishing_selections: sel,
    };
    onAdd(item);
    setDescricao("");
    setFinEnabled({});
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5">
      {/* Catálogo selecionado / vazio */}
      {couche300Sra3.length === 0 && !loading && (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Nenhum item de impressão <strong>Couchê 300g</strong> em <strong>SRA3 (32,8×47,8)</strong> cadastrado.
          </p>
          <a
            href="/preco-impressao"
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-1 text-xs font-medium text-primary hover:underline"
          >
            Cadastrar agora →
          </a>
        </div>
      )}

      {catalog && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 flex items-center gap-3">
          <Printer className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {catalog.paper_type}
              {catalog.grammage ? ` ${catalog.grammage}` : ""} — {catalog.size}
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
          {couche300Sra3.length > 1 && (
            <select
              value={selectedCatalogId ?? catalog.id}
              onChange={(e) => setSelectedCatalogId(e.target.value)}
              className="h-7 text-xs rounded-md border border-border bg-background px-2"
              title="Mais de um Couchê 300g SRA3 cadastrado"
            >
              {couche300Sra3.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.category_name} · {c.side}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Quantidade */}
      <Field label="Quantidade (cartões)">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          value={qtdCartoes === 0 ? "" : qtdCartoes}
          placeholder="Ex: 1000"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              setQtdCartoes(0);
              return;
            }
            setQtdCartoes(Math.max(1, Number(raw) || 1));
          }}
          className="h-9"
        />
      </Field>

      {/* Face — cards selecionáveis */}
      <Field label="Face de impressão">
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: "frente", icon: FileText, title: "Frente", hint: "1 face de impressão" },
            { key: "fv", icon: Files, title: "Frente e Verso", hint: "2 faces · custo ~2x" },
          ] as const).map((opt) => {
            const Icon = opt.icon;
            const selected = face === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFace(opt.key)}
                className={cn(
                  "relative rounded-lg border-2 p-3 text-left transition-all",
                  selected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon
                    className={cn(
                      "h-5 w-5 mt-0.5 shrink-0",
                      selected ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{opt.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{opt.hint}</p>
                  </div>
                  {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </div>
              </button>
            );
          })}
        </div>
      </Field>

      {/* Resumo de aproveitamento */}
      <div className="rounded-md border border-border bg-background px-3 py-2.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <span className="font-semibold tabular-nums text-foreground">
              {yieldRes.perSheet}
            </span>{" "}
            cartões/folha
            <span className="text-muted-foreground"> · </span>
            <span className="font-semibold tabular-nums text-foreground">
              {sheets}
            </span>{" "}
            folha{sheets === 1 ? "" : "s"}
            {sobra > 0 && (
              <>
                <span className="text-muted-foreground"> · sobra </span>
                <span className="tabular-nums">{sobra}</span>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Orientação: <span className="text-foreground">{yieldRes.orientation === "vertical" ? "vertical" : "horizontal"}</span>{" "}
            ({yieldRes.cols}×{yieldRes.rows})
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
          <span>
            Folha: {layout.sheetW / 10}×{layout.sheetH / 10} cm
          </span>
          <span>
            Cartão: {layout.cardW / 10}×{layout.cardH / 10} cm
          </span>
          <span>Margem: {layout.marginMm} mm</span>
          <span>Gap: {layout.gapMm} mm</span>
        </div>
      </div>

      {/* Preço */}
      <div className="grid grid-cols-2 gap-4">
        <Field label="Preço por folha">
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
        <Field label="Preço por cartão">
          <div className="h-9 px-3 rounded-md border border-border bg-muted/40 flex items-center">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {precoPorCartao > 0 ? fmtBRL(precoPorCartao) : "—"}
            </span>
          </div>
        </Field>
      </div>

      {/* Layout editável (colapsado) */}
      <div className="rounded-md border border-border">
        <button
          type="button"
          onClick={() => setLayoutOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="inline-flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Ajustar layout da folha
          </span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", layoutOpen && "rotate-180")}
          />
        </button>
        {layoutOpen && (
          <div className="px-3 pb-3 pt-1 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-border">
            {([
              ["sheetW", "Folha L (mm)"],
              ["sheetH", "Folha A (mm)"],
              ["marginMm", "Margem (mm)"],
              ["gapMm", "Gap (mm)"],
              ["cardW", "Cartão L (mm)"],
              ["cardH", "Cartão A (mm)"],
            ] as const).map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.1}
                  value={layout[key]}
                  onChange={(e) =>
                    setLayout((l) => ({ ...l, [key]: Math.max(0, Number(e.target.value) || 0) }))
                  }
                  className="h-9"
                />
              </Field>
            ))}
            <div className="col-span-2 sm:col-span-3">
              <button
                type="button"
                onClick={() => setLayout(DEFAULTS)}
                className="text-[11px] text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
              >
                Restaurar padrão (SRA3 · 7mm · 6mm · 9×5)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Acabamentos fixos (pré-marcados) */}
      <Field label="Acabamentos">
        {fixedFinishes.length > 0 ? (
          <FinishingProgressive
            items={fixedFinishes}
            enabled={finEnabled}
            onToggle={(id, on) => setFinEnabled((m) => ({ ...m, [id]: on }))}
          />
        ) : (
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              Nenhum Kit de Produto ativo para <strong>cartao_visita</strong>. Cadastre em{" "}
              <a
                href="/insumos?tab=kits"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Insumos → Kits de Produto
              </a>
              {" "}marcando as etapas como obrigatórias ou opcionais.
            </p>
          </div>
        )}
      </Field>

      {/* Sugestões opcionais (desmarcadas) */}
      {optionalFinishes.length > 0 && (
        <details className="rounded-md border border-border bg-background group" open={optionalProcs.some((p) => finEnabled[p.key])}>
          <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Sugestões opcionais
              <span className="text-[10px] text-muted-foreground/70">({optionalFinishes.length})</span>
            </span>
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border p-2">
            <FinishingProgressive
              items={optionalFinishes}
              enabled={finEnabled}
              onToggle={(id, on) => setFinEnabled((m) => ({ ...m, [id]: on }))}
            />
          </div>
        </details>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 mt-2 bg-background/95 backdrop-blur border-t border-border flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {pricing && (
            <span>
              Total:{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {fmtBRL(totalGeral)}
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
