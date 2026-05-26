// Sub-formulário: Certificado (built-in).
// - Papel: Couchê 210g A4 (auto-detectado no catálogo).
// - 1 certificado = 1 folha. Quantidade em unidades.
// - Face: Frente color (padrão), F/V color, F color + V PB (mix), F/V PB.
// - Acabamentos do Kit de Produto "certificado" (padrão CV).
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, FileText, Files, FileMinus, Plus, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FinishingProgressive,
  type FinishingDef,
  type FinishingSubItem,
} from "../shared/FinishingProgressive";
import { supabase } from "@/integrations/supabase/client";
import { useV3Catalog, pricePerSheet } from "../shared/useV3Catalog";
import { fmtBRL } from "../shared/pricing";
import { genId, type V3PrintItem } from "../types";
import { useProductKitProcesses } from "../shared/useProductKitProcesses";
import { useHourRate } from "@/hooks/useHourRate";
import type { PrintingCatalogItem } from "@/components/orcamentos-v3/shared/PrintingItemSearch";

interface Props {
  onAdd: (item: V3PrintItem) => void;
  descricao?: string;
  onDescricaoChange?: (v: string) => void;
}

type FaceKey = "frente" | "fv" | "mix" | "fv_pb";

const isA4 = (size: string | null | undefined) =>
  /^\s*a4\s*$|21[.,]?0?.*29[.,]?7|29[.,]?7.*21[.,]?0?/i.test(size || "");

const isCouche210 = (
  paperType: string | null | undefined,
  gram: string | null | undefined,
) => /couch/i.test(paperType || "") && /210/.test(gram || "");

/** Devolve uma cópia do item com o `side` desejado para o engine aplicar o multiplicador. */
const withSide = (it: PrintingCatalogItem, side: "Frente" | "F/V"): PrintingCatalogItem => {
  const cur = (it.side || "").toUpperCase();
  if (side === "F/V" && cur !== "F/V") return { ...it, side: "F/V" };
  if (side === "Frente" && cur === "F/V") return { ...it, side: "Frente" };
  return it;
};

export function CertificateForm({
  onAdd,
  descricao: descricaoProp,
  onDescricaoChange,
}: Props) {
  const { loading, items, tiers } = useV3Catalog();

  const [descricaoLocal, setDescricaoLocal] = useState("");
  const descricao = descricaoProp ?? descricaoLocal;
  const setDescricao = onDescricaoChange ?? setDescricaoLocal;

  const [qtd, setQtd] = useState(0);
  const [face, setFace] = useState<FaceKey>("frente");
  const [finEnabled, setFinEnabled] = useState<Record<string, boolean>>({});
  const [pulse, setPulse] = useState(false);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [selectedPbId, setSelectedPbId] = useState<string | null>(null);

  const { steps } = useProductKitProcesses("certificado");
  const { hourRate } = useHourRate();

  type CProc = {
    key: string;
    name: string;
    minutes: number;
    link_type: "fixed" | "optional";
    default_on: boolean;
    step_group_id: string | null;
  };
  const procs = useMemo<CProc[]>(
    () =>
      steps.map((s) => ({
        key: `step:${s.id}`,
        name: s.description,
        minutes: Number.isFinite(s.time_minutes) ? s.time_minutes : 0,
        link_type: s.link_type,
        default_on: s.default_on,
        step_group_id: s.step_group_id,
      })),
    [steps],
  );

  const fixedProcs = useMemo(() => procs.filter((p) => p.link_type === "fixed"), [procs]);
  const optionalProcs = useMemo(() => procs.filter((p) => p.link_type === "optional"), [procs]);

  // Candidatos — separados por modo
  const colorItems = useMemo(
    () =>
      items.filter(
        (it) =>
          isCouche210(it.paper_type, it.grammage) &&
          isA4(it.size) &&
          (it.equipment_mode || "color") === "color",
      ),
    [items],
  );
  const pbItems = useMemo(
    () =>
      items.filter(
        (it) =>
          isCouche210(it.paper_type, it.grammage) &&
          isA4(it.size) &&
          (it.equipment_mode || "color") === "pb",
      ),
    [items],
  );

  const hasPb = pbItems.length > 0;

  const colorBase: PrintingCatalogItem | null = useMemo(() => {
    if (colorItems.length === 0) return null;
    if (selectedColorId) {
      const s = colorItems.find((c) => c.id === selectedColorId);
      if (s) return s;
    }
    return colorItems[0];
  }, [colorItems, selectedColorId]);

  const pbBase: PrintingCatalogItem | null = useMemo(() => {
    if (pbItems.length === 0) return null;
    if (selectedPbId) {
      const s = pbItems.find((c) => c.id === selectedPbId);
      if (s) return s;
    }
    return pbItems[0];
  }, [pbItems, selectedPbId]);

  // Item efetivo principal por face (usado para gravar catalog_item_id, printer_cat, etc.)
  const primaryItem: PrintingCatalogItem | null = useMemo(() => {
    if (face === "fv_pb") return pbBase ? withSide(pbBase, "F/V") : null;
    if (!colorBase) return null;
    if (face === "fv") return withSide(colorBase, "F/V");
    // frente e mix usam o color como item principal (verso PB entra como custo extra)
    return withSide(colorBase, "Frente");
  }, [face, colorBase, pbBase]);

  const sheets = qtd; // 1 cert = 1 folha A4

  // Pricing principal
  const pricingPrimary = useMemo(
    () =>
      primaryItem && sheets > 0
        ? pricePerSheet(primaryItem, tiers, sheets)
        : null,
    [primaryItem, tiers, sheets],
  );

  // Pricing do verso PB para o mix (Frente PB, soma ao principal color Frente)
  const pricingMixPb = useMemo(() => {
    if (face !== "mix" || !pbBase || sheets <= 0) return null;
    return pricePerSheet(withSide(pbBase, "Frente"), tiers, sheets);
  }, [face, pbBase, tiers, sheets]);

  const baseSellingPerSheet = useMemo(() => {
    const a = pricingPrimary?.sellingPrice ?? 0;
    const b = pricingMixPb?.sellingPrice ?? 0;
    return a + b;
  }, [pricingPrimary, pricingMixPb]);

  const baseCostPerSheet = useMemo(() => {
    const a = pricingPrimary?.baseCost ?? 0;
    const b = pricingMixPb?.baseCost ?? 0;
    return a + b;
  }, [pricingPrimary, pricingMixPb]);

  const procCost = (minutes: number) => {
    const m = Number.isFinite(minutes) ? minutes : 0;
    return (m / 60) * (hourRate || 0);
  };

  // Sub-itens (grupos)
  const [subItemsCache, setSubItemsCache] = useState<Record<string, FinishingSubItem[]>>({});
  const [loadingGroups, setLoadingGroups] = useState<Set<string>>(new Set());

  const loadSubItems = async (groupId: string) => {
    if (subItemsCache[groupId] || loadingGroups.has(groupId)) return;
    setLoadingGroups((s) => new Set(s).add(groupId));
    const { data } = await supabase
      .from("step_group_items")
      .select("production_step:production_steps(description, time_minutes)")
      .eq("step_group_id", groupId)
      .order("sort_order");
    setSubItemsCache((m) => ({
      ...m,
      [groupId]: (data || [])
        .map((r: any) => r.production_step)
        .filter(Boolean)
        .map((ps: any) => ({
          description: ps.description,
          time_minutes: Number(ps.time_minutes) || 0,
        })),
    }));
    setLoadingGroups((s) => {
      const n = new Set(s);
      n.delete(groupId);
      return n;
    });
  };

  const toFinishingDef = (p: CProc): FinishingDef => {
    const gid = p.step_group_id;
    const cached = gid ? subItemsCache[gid] : undefined;
    return {
      id: p.key,
      label: `⚙ ${p.name}`,
      hint: `${p.minutes} min · ${fmtBRL(procCost(p.minutes))}`,
      hasGroup: !!gid,
      subItems: cached,
      loadingSubItems: gid ? loadingGroups.has(gid) : false,
      onExpand: gid ? () => loadSubItems(gid) : undefined,
    };
  };
  const fixedFinishes = useMemo<FinishingDef[]>(
    () => fixedProcs.map(toFinishingDef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fixedProcs, hourRate, subItemsCache, loadingGroups],
  );
  const optionalFinishes = useMemo<FinishingDef[]>(
    () => optionalProcs.map(toFinishingDef),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optionalProcs, hourRate, subItemsCache, loadingGroups],
  );

  useEffect(() => {
    setFinEnabled((m) => {
      const next: Record<string, boolean> = {};
      for (const p of procs) {
        if (p.link_type === "fixed") next[p.key] = true;
        else if (m[p.key] !== undefined) next[p.key] = m[p.key];
      }
      return next;
    });
  }, [procs]);

  // Se usuário escolher face PB mas não houver item PB, força fallback para frente
  useEffect(() => {
    if ((face === "fv_pb" || face === "mix") && !hasPb) {
      setFace("frente");
    }
  }, [face, hasPb]);

  const selectedProcs = useMemo(
    () => procs.filter((p) => finEnabled[p.key]),
    [procs, finEnabled],
  );

  const finishingTotal = useMemo(
    () => selectedProcs.reduce((s, p) => s + procCost(p.minutes), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedProcs, hourRate],
  );
  const finishingExtraPerSheet = sheets > 0 ? finishingTotal / sheets : 0;
  const totalGeral = sheets > 0 ? (baseSellingPerSheet + finishingExtraPerSheet) * sheets : 0;
  const precoPorUnidade = qtd > 0 ? totalGeral / qtd : 0;

  const canAdd =
    !!primaryItem && qtd > 0 && sheets > 0 && baseSellingPerSheet > 0 &&
    (face !== "mix" || !!pbBase);

  const faceLabelMap: Record<FaceKey, string> = {
    frente: "Frente",
    fv: "Frente e Verso",
    mix: "Frente color + Verso PB",
    fv_pb: "Frente e Verso PB",
  };

  const submit = async () => {
    if (!canAdd || !primaryItem) return;

    const groupIds = Array.from(
      new Set(selectedProcs.map((p) => p.step_group_id).filter((g): g is string => !!g)),
    );
    await Promise.all(groupIds.map((g) => loadSubItems(g)));

    let snapshot: Record<string, FinishingSubItem[]> = subItemsCache;
    setSubItemsCache((m) => {
      snapshot = m;
      return m;
    });

    const expandNames = (p: typeof selectedProcs[number]): string[] => {
      const subs = p.step_group_id ? snapshot[p.step_group_id] : undefined;
      if (subs && subs.length > 0) return subs.map((s) => s.description).filter(Boolean);
      return [p.name];
    };

    const sel = selectedProcs.map((p) => {
      const cost = procCost(p.minutes);
      return {
        id: p.key,
        name: expandNames(p).join(", "),
        pricing_model: "per_unit" as const,
        unit_label: "min",
        price: cost,
        cost,
      };
    });
    const flatLabels = selectedProcs.flatMap(expandNames);
    const extra = finishingExtraPerSheet;
    const faceLabel = faceLabelMap[face];
    const defaultDesc = `Certificado A4 — Couchê 210g · ${faceLabel} (${qtd} un)`;
    const sideField: "Frente" | "F/V" = face === "frente" ? "Frente" : "F/V";
    const item: V3PrintItem = {
      id: genId(),
      kind: "print",
      descricao: descricao.trim() || defaultDesc,
      quantidade: sheets,
      tier_group_id: null,
      catalog_item_id: primaryItem.id,
      paper_type: primaryItem.paper_type,
      grammage: primaryItem.grammage,
      size: primaryItem.size,
      side: sideField,
      printer_category_id: primaryItem.printer_category_id,
      markup_group_id: primaryItem.markup_group_id,
      valor_unitario: baseSellingPerSheet + extra,
      custo_unitario: baseCostPerSheet + extra,
      formato: null,
      cores: null,
      face,
      finishings: flatLabels,
      finishing_selections: sel,
    };
    onAdd(item);
    setDescricao("");
    setFinEnabled({});
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  const faceOptions: {
    key: FaceKey;
    icon: typeof FileText;
    title: string;
    hint: string;
    requiresPb?: boolean;
  }[] = [
    { key: "frente", icon: FileText, title: "Frente", hint: "1 face colorida" },
    { key: "fv", icon: Files, title: "Frente e Verso", hint: "2 faces coloridas · custo ~2x" },
    {
      key: "mix",
      icon: FileText,
      title: "F color + V P&B",
      hint: "Frente colorida, verso em preto e branco",
      requiresPb: true,
    },
    {
      key: "fv_pb",
      icon: FileMinus,
      title: "Frente e Verso (P&B)",
      hint: "2 faces preto e branco · custo ~2x",
      requiresPb: true,
    },
  ];

  return (
    <div className="space-y-5 flex-1 flex flex-col">
      {colorItems.length === 0 && !loading && (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Nenhum item de impressão <strong>Couchê 210g</strong> em <strong>A4</strong> (color) cadastrado.
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

      <Field label="Face de impressão">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-md border border-border bg-muted/30 p-0.5">
          {faceOptions.map((opt) => {
            const Icon = opt.icon;
            const selected = face === opt.key;
            const disabled = !!opt.requiresPb && !hasPb;
            return (
              <button
                key={opt.key}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setFace(opt.key)}
                aria-pressed={selected}
                title={
                  disabled
                    ? "Cadastre um item Couchê 210g A4 PB para liberar esta opção"
                    : `${opt.title} — ${opt.hint}`
                }
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-sm text-xs font-medium transition-all",
                  disabled && "opacity-50 cursor-not-allowed text-muted-foreground",
                  !disabled && selected && "bg-background text-foreground shadow-sm ring-1 ring-border",
                  !disabled && !selected && "text-muted-foreground hover:text-foreground hover:bg-background/60",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 shrink-0", !disabled && selected && "text-primary")} />
                <span className="truncate">{opt.title}</span>
              </button>
            );
          })}
        </div>
      </Field>

      {/* Header — uma ou duas linhas (color + PB no mix) */}
      {primaryItem && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-3">
            <Printer className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {primaryItem.paper_type}
                {primaryItem.grammage ? ` ${primaryItem.grammage}` : ""} — {primaryItem.size}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-muted-foreground">
                  {primaryItem.category_name}
                  {(primaryItem.equipment_mode || "color") === "pb" ? " (PB)" : ""}
                </span>
                {pricingPrimary?.tierLabel && (
                  <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                    {pricingPrimary.tierLabel}
                  </Badge>
                )}
              </div>
            </div>
            {face !== "fv_pb" && colorItems.length > 1 && (
              <select
                value={selectedColorId ?? colorBase?.id ?? ""}
                onChange={(e) => setSelectedColorId(e.target.value)}
                className="h-7 text-xs rounded-md border border-border bg-background px-2"
                title="Mais de um Couchê 210g A4 color cadastrado"
              >
                {colorItems.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name} · {c.side}
                  </option>
                ))}
              </select>
            )}
            {face === "fv_pb" && pbItems.length > 1 && (
              <select
                value={selectedPbId ?? pbBase?.id ?? ""}
                onChange={(e) => setSelectedPbId(e.target.value)}
                className="h-7 text-xs rounded-md border border-border bg-background px-2"
                title="Mais de um Couchê 210g A4 PB cadastrado"
              >
                {pbItems.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.category_name} · {c.side}
                  </option>
                ))}
              </select>
            )}
          </div>
          {face === "mix" && pbBase && (
            <div className="flex items-center gap-3 pl-7">
              <span className="text-[11px] text-muted-foreground">
                + verso PB: <span className="text-foreground">{pbBase.category_name}</span>
                {pricingMixPb?.tierLabel ? ` · ${pricingMixPb.tierLabel}` : ""}
              </span>
              {pbItems.length > 1 && (
                <select
                  value={selectedPbId ?? pbBase.id}
                  onChange={(e) => setSelectedPbId(e.target.value)}
                  className="h-6 text-[11px] rounded-md border border-border bg-background px-1.5 ml-auto"
                >
                  {pbItems.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.category_name} · {c.side}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      <Field label="Quantidade (certificados)">
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          value={qtd === 0 ? "" : qtd}
          placeholder="Ex: 50"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              setQtd(0);
              return;
            }
            setQtd(Math.max(1, Number(raw) || 1));
          }}
          className="h-9"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Preço por folha">
          <div className="h-9 px-3 rounded-md border border-border bg-muted/40 flex items-center justify-between">
            <span className="text-sm font-semibold text-primary tabular-nums">
              {baseSellingPerSheet > 0 ? fmtBRL(baseSellingPerSheet + finishingExtraPerSheet) : "—"}
            </span>
            {baseSellingPerSheet > 0 && finishingExtraPerSheet > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                + {fmtBRL(finishingExtraPerSheet)} acab.
              </span>
            )}
          </div>
        </Field>
        <Field label="Preço por certificado">
          <div className="h-9 px-3 rounded-md border border-border bg-muted/40 flex items-center">
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {precoPorUnidade > 0 ? fmtBRL(precoPorUnidade) : "—"}
            </span>
          </div>
        </Field>
      </div>

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
              Nenhum Kit de Produto ativo para <strong>certificado</strong>. Cadastre em{" "}
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

      {optionalFinishes.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Acabamentos opcionais
            </Label>
            <span className="text-[10.5px] text-muted-foreground/80">
              Marque para incluir no orçamento
            </span>
          </div>
          <FinishingProgressive
            items={optionalFinishes}
            enabled={finEnabled}
            onToggle={(id, on) => setFinEnabled((m) => ({ ...m, [id]: on }))}
          />
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 mt-auto -mb-5 lg:-mb-0 bg-background border-t border-border shadow-[0_-8px_16px_-8px_hsl(var(--background))] flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">
          {baseSellingPerSheet > 0 && (
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
