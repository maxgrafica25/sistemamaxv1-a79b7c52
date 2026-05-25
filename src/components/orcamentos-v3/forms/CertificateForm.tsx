// Sub-formulário: Certificado (built-in).
// - Papel pré-selecionado: Couchê 210g A4 (auto-detectado no catálogo).
// - 1 certificado = 1 folha. Quantidade em unidades.
// - Face: Frente / Frente e Verso (color).
// - Acabamentos vindos do Kit de Produto "certificado" (mesmo padrão do CV).
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, FileText, Files, Plus, Printer } from "lucide-react";
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

const isA4 = (size: string | null | undefined) =>
  /^\s*a4\s*$|21[.,]?0?.*29[.,]?7|29[.,]?7.*21[.,]?0?/i.test(size || "");

const isCouche210 = (
  paperType: string | null | undefined,
  gram: string | null | undefined,
) => /couch/i.test(paperType || "") && /210/.test(gram || "");

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
  const [face, setFace] = useState<"frente" | "fv">("frente");
  const [finEnabled, setFinEnabled] = useState<Record<string, boolean>>({});
  const [pulse, setPulse] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);

  const { steps } = useProductKitProcesses("certificado");
  const { hourRate } = useHourRate();

  type CProc = {
    key: string;
    kind: "step";
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
        kind: "step" as const,
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

  // Candidatos a Couchê 210g A4
  const couche210A4 = useMemo(
    () =>
      items.filter(
        (it) => isCouche210(it.paper_type, it.grammage) && isA4(it.size),
      ),
    [items],
  );

  const catalog: PrintingCatalogItem | null = useMemo(() => {
    if (couche210A4.length === 0) return null;
    if (selectedCatalogId) {
      const sel = couche210A4.find((c) => c.id === selectedCatalogId);
      if (sel) return sel;
    }
    const wantSide = face === "fv" ? "F/V" : "Frente";
    const exact = couche210A4.find(
      (c) => (c.side || "").toLowerCase() === wantSide.toLowerCase(),
    );
    return exact ?? couche210A4[0];
  }, [couche210A4, selectedCatalogId, face]);

  const sheets = qtd; // 1 certificado = 1 folha A4

  const effectiveItem: PrintingCatalogItem | null = useMemo(() => {
    if (!catalog) return null;
    const isCatalogFV = (catalog.side || "").toUpperCase() === "F/V";
    if (face === "fv" && !isCatalogFV) return { ...catalog, side: "F/V" };
    if (face === "frente" && isCatalogFV) return { ...catalog, side: "Frente" };
    return catalog;
  }, [catalog, face]);

  const pricing = useMemo(
    () => (effectiveItem && sheets > 0 ? pricePerSheet(effectiveItem, tiers, sheets) : null),
    [effectiveItem, tiers, sheets],
  );

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
  const totalGeral = pricing ? (pricing.sellingPrice + finishingExtraPerSheet) * sheets : 0;
  const precoPorUnidade = qtd > 0 ? totalGeral / qtd : 0;

  const canAdd =
    !!effectiveItem && qtd > 0 && sheets > 0 && (pricing?.sellingPrice ?? 0) > 0;

  const submit = async () => {
    if (!canAdd || !effectiveItem || !pricing) return;

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
    const faceLabel = face === "fv" ? "Frente e Verso" : "Frente";
    const defaultDesc = `Certificado A4 — Couchê 210g ${faceLabel} (${qtd} un)`;
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
      finishings: flatLabels,
      finishing_selections: sel,
    };
    onAdd(item);
    setDescricao("");
    setFinEnabled({});
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5 flex-1 flex flex-col">
      {couche210A4.length === 0 && !loading && (
        <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground">
            Nenhum item de impressão <strong>Couchê 210g</strong> em <strong>A4</strong> cadastrado.
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
          {couche210A4.length > 1 && (
            <select
              value={selectedCatalogId ?? catalog.id}
              onChange={(e) => setSelectedCatalogId(e.target.value)}
              className="h-7 text-xs rounded-md border border-border bg-background px-2"
              title="Mais de um Couchê 210g A4 cadastrado"
            >
              {couche210A4.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.category_name} · {c.side}
                </option>
              ))}
            </select>
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

      <Field label="Face de impressão">
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: "frente", icon: FileText, title: "Frente", hint: "1 face colorida" },
            { key: "fv", icon: Files, title: "Frente e Verso", hint: "2 faces coloridas · custo ~2x" },
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
