import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, X, Printer, Wrench, Tag, Search, Clock, Layers, Wand2,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  type PrintingCatalogItem, type MarkupTier,
} from "@/components/orcamentos/PrintingItemSearch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PRODUCT_KIND_OPTIONS, productKindLabel, buildDynamicTitle,
} from "@/lib/quotes-v2/item-title";
import type { PricingMaterial } from "@/lib/quotes-v2/pricing";
import type { SubformLabor, SubformMaterial } from "./LaborAndSupplySubform";

type ThirdParty = { id: string; description: string; supplier: string; cost: number };
export type ProcessStep = { id: string; description: string; time_minutes: number; step_type: string };
export type ProcessGroupItem = { description: string; time_minutes: number; step_type: string };
export type ProcessGroup = { id: string; name: string; items: ProcessGroupItem[] };

type DraftMode = "" | "impressao" | "processo" | "impressao_processo";
interface DraftRow {
  id: string;
  mode: DraftMode;
}

interface Props {
  printingCatalog: PrintingCatalogItem[];
  processSteps: ProcessStep[];
  processGroups: ProcessGroup[];
  markupTiers: MarkupTier[];
  globalSettings: { invoice_pct: number; collection_pct: number; waste_pct: number; default_margin_pct: number };
  hourlyRate: number;

  printingItems: PricingMaterial[];
  childMaterials: PricingMaterial[];
  childLabor: SubformLabor[];
  standaloneLabor: SubformLabor[];
  standaloneManualMaterials: SubformMaterial[];
  thirdParty: ThirdParty[];

  onAddPrinting: (item: PrintingCatalogItem) => void;
  onAddProcess: (parentId: string | null, step: ProcessStep) => void;
  onExpandStepGroup: (parentId: string | null, group: ProcessGroup) => void;
  onUpdatePrinting: (id: string, patch: Partial<PricingMaterial>) => void;
  onUpdateChildMaterial: (id: string, patch: Partial<PricingMaterial>) => void;
  onRemovePrinting: (id: string) => void;
  onRemoveChildMaterial: (id: string) => void;
  onRemoveLabor: (id: string) => void;

  onChangeStandaloneLabor: (next: SubformLabor[]) => void;
  onChangeStandaloneMaterials: (next: SubformMaterial[]) => void;
  onChangeThirdParty: (next: ThirdParty[]) => void;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const GRID = "grid grid-cols-[32px_140px_1fr_90px_60px_110px_110px_36px] items-center gap-2";

export function QuoteItemsTable(props: Props) {
  const {
    printingCatalog, processSteps, processGroups, hourlyRate,
    printingItems, childMaterials, childLabor,
    standaloneLabor, standaloneManualMaterials, thirdParty,
    onAddPrinting, onAddProcess, onExpandStepGroup,
    onUpdatePrinting, onUpdateChildMaterial,
    onRemovePrinting, onRemoveChildMaterial, onRemoveLabor,
    onChangeStandaloneLabor, onChangeStandaloneMaterials, onChangeThirdParty,
  } = props;

  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  const addEmptyDraft = () =>
    setDrafts((p) => [...p, { id: `draft-${Date.now()}`, mode: "" }]);
  const removeDraft = (id: string) =>
    setDrafts((p) => p.filter((d) => d.id !== id));
  const setDraftMode = (id: string, mode: DraftMode) =>
    setDrafts((p) => p.map((d) => (d.id === id ? { ...d, mode } : d)));

  // ---------- Renderers ----------
  const renderPrint = (m: PricingMaterial, idx: number) => {
    const total = (m.quantity || 0) * (m.unitPrice || 0);
    const dynamicTitle = buildDynamicTitle({
      productKind: m.productKind,
      customName: m.customName,
      paperType: m.paperType,
      grammage: m.grammage,
      size: m.size,
      side: m.side,
    });
    const childMatsForThis = childMaterials.filter((c) => c.parentItemId === m.id);
    const childLaborForThis = childLabor.filter((l) => l.parentItemId === m.id);
    return (
      <div key={m.id}>
        <div className={`${GRID} px-2 py-1.5 border-b text-sm hover:bg-muted/30`}>
          <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
          <KindBadge kind="print" />
          <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
            <ProductKindButton item={m} onChange={(p) => onUpdatePrinting(m.id, p)} />
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">
                {dynamicTitle || <span className="text-muted-foreground italic">Defina o tipo de produto…</span>}
              </div>
              <div className="text-[11px] text-muted-foreground truncate">{m.description}</div>
            </div>
            <ProcessPicker
              steps={processSteps}
              groups={processGroups}
              onPickStep={(s) => onAddProcess(m.id, s)}
              onPickGroup={(g) => onExpandStepGroup(m.id, g)}
            />
          </div>
          <Input
            type="number" min={1}
            value={m.quantity || ""}
            onChange={(e) => onUpdatePrinting(m.id, { quantity: parseFloat(e.target.value) || 0 })}
            className="h-8 text-sm text-right tabular-nums"
          />
          <span className="text-xs text-muted-foreground text-center">un</span>
          <Input
            type="number" step="0.01"
            value={m.unitPrice || ""}
            onChange={(e) => onUpdatePrinting(m.id, { unitPrice: parseFloat(e.target.value) || 0 })}
            className="h-8 text-sm text-right tabular-nums"
          />
          <span className="text-right tabular-nums font-medium">{fmt(total)}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemovePrinting(m.id)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        {childMatsForThis.map((c) => (
          <div key={c.id} className={`${GRID} px-2 py-1.5 border-b text-sm bg-muted/10`}>
            <span></span>
            <KindBadge kind="finish" />
            <div className="min-w-0 pl-4 flex items-center gap-1.5 text-muted-foreground">
              <span className="text-xs">↳</span>
              <span className="truncate">{c.description}</span>
            </div>
            <Input
              type="number" min={1}
              value={c.quantity || ""}
              onChange={(e) => onUpdateChildMaterial(c.id, { quantity: parseFloat(e.target.value) || 0 })}
              className="h-8 text-sm text-right tabular-nums"
            />
            <span className="text-xs text-muted-foreground text-center">un</span>
            <Input
              type="number" step="0.01"
              value={c.unitPrice || ""}
              onChange={(e) => onUpdateChildMaterial(c.id, { unitPrice: parseFloat(e.target.value) || 0 })}
              className="h-8 text-sm text-right tabular-nums"
            />
            <span className="text-right tabular-nums">{fmt((c.quantity || 0) * (c.unitPrice || 0))}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveChildMaterial(c.id)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {childLaborForThis.map((l) => renderLaborRow(l, true))}
      </div>
    );
  };

  const renderLaborRow = (l: SubformLabor, isChild: boolean) => {
    const cost = ((l.timeMinutes || 0) / 60) * (hourlyRate || 0);
    return (
      <div key={l.id} className={`${GRID} px-2 py-1.5 border-b text-sm ${isChild ? "bg-muted/10" : "hover:bg-muted/30"}`}>
        <span></span>
        <KindBadge kind="labor" />
        <div className={`min-w-0 ${isChild ? "pl-4" : ""} flex items-center gap-1.5 text-muted-foreground`}>
          {isChild && <span className="text-xs">↳</span>}
          <span className="truncate">{l.description}</span>
          <span className="text-[10px] inline-flex items-center gap-0.5 text-muted-foreground">
            <Clock className="h-3 w-3" /> {l.timeMinutes} min
          </span>
        </div>
        <span></span><span></span><span></span>
        <span className="text-right tabular-nums text-muted-foreground text-xs">~{fmt(cost)}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemoveLabor(l.id)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  const renderLegacyMaterial = (m: SubformMaterial, idx: number) => {
    const total = (m.quantity || 0) * (m.unitPrice || 0);
    return (
      <div key={m.id} className={`${GRID} px-2 py-1.5 border-b text-sm hover:bg-muted/30`}>
        <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">Legado</span>
        <span className="text-sm text-muted-foreground truncate" title={m.description}>{m.description}</span>
        <Input type="number" value={m.quantity || ""} disabled className="h-8 text-sm text-right tabular-nums" />
        <span className="text-xs text-muted-foreground text-center">un</span>
        <Input type="number" step="0.01" value={m.unitPrice || ""} disabled className="h-8 text-sm text-right tabular-nums" />
        <span className="text-right tabular-nums font-medium">{fmt(total)}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => onChangeStandaloneMaterials(standaloneManualMaterials.filter((x) => x.id !== m.id))}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  const renderLegacyService = (t: ThirdParty, idx: number) => (
    <div key={t.id} className={`${GRID} px-2 py-1.5 border-b text-sm hover:bg-muted/30`}>
      <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">Legado</span>
      <span className="text-sm text-muted-foreground truncate">{t.description} {t.supplier ? `(${t.supplier})` : ""}</span>
      <span className="text-right tabular-nums text-muted-foreground">1</span>
      <span className="text-xs text-muted-foreground text-center">un</span>
      <Input type="number" step="0.01" value={t.cost || ""} disabled className="h-8 text-sm text-right tabular-nums" />
      <span className="text-right tabular-nums font-medium">{fmt(t.cost || 0)}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7"
        onClick={() => onChangeThirdParty(thirdParty.filter((x) => x.id !== t.id))}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  const isEmpty =
    printingItems.length === 0 && drafts.length === 0 &&
    standaloneLabor.length === 0 && standaloneManualMaterials.length === 0 &&
    thirdParty.length === 0;

  return (
    <div className="rounded-lg border bg-card">
      <div className={`${GRID} px-2 py-2 border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground`}>
        <span>Nº</span>
        <span>Tipo</span>
        <span>Item</span>
        <span className="text-right">Qtde</span>
        <span className="text-center">UN</span>
        <span className="text-right">Preço un.</span>
        <span className="text-right">Total</span>
        <span></span>
      </div>

      {isEmpty && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground italic">
          Nenhum item adicionado. Clique em <strong>+ adicionar item</strong> abaixo.
        </div>
      )}

      {printingItems.map((m, idx) => renderPrint(m, idx))}
      {standaloneLabor.map((l) => renderLaborRow(l, false))}
      {standaloneManualMaterials.map((m, idx) => renderLegacyMaterial(m, printingItems.length + idx))}
      {thirdParty.map((t, idx) => renderLegacyService(t, printingItems.length + standaloneManualMaterials.length + idx))}

      {/* Drafts */}
      {drafts.map((d, idx) => (
        <DraftRowEditor
          key={d.id}
          row={d}
          rowNumber={printingItems.length + standaloneManualMaterials.length + standaloneLabor.length + thirdParty.length + idx + 1}
          printingCatalog={printingCatalog}
          processSteps={processSteps}
          processGroups={processGroups}
          onSetMode={(m) => setDraftMode(d.id, m)}
          onPickPrinting={(it) => {
            onAddPrinting(it);
            removeDraft(d.id);
          }}
          onPickProcessStep={(s) => {
            onAddProcess(null, s);
            removeDraft(d.id);
          }}
          onPickProcessGroup={(g) => {
            onExpandStepGroup(null, g);
            removeDraft(d.id);
          }}
          onCancel={() => removeDraft(d.id)}
        />
      ))}

      {/* Add row trigger */}
      <div className="flex items-center gap-3 px-3 py-2.5 text-sm">
        <button
          onClick={addEmptyDraft}
          className="text-primary hover:underline inline-flex items-center gap-1.5 font-medium"
        >
          <Plus className="h-4 w-4" /> adicionar item
        </button>
        <span className="text-xs text-muted-foreground">
          Escolha o tipo e busque pelo nome — todos os itens vêm de catálogos cadastrados.
        </span>
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: "print" | "finish" | "labor" }) {
  const map = {
    print: { Icon: Printer, label: "Impressão", cls: "bg-primary/10 text-primary" },
    finish: { Icon: Wrench, label: "Acabamento", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    labor: { Icon: Wrench, label: "Processo", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  } as const;
  const { Icon, label, cls } = map[kind];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

function ProductKindButton({
  item, onChange,
}: {
  item: PricingMaterial;
  onChange: (patch: Partial<PricingMaterial>) => void;
}) {
  const label = item.productKind === "outro"
    ? (item.customName || "Outro")
    : (productKindLabel(item.productKind) || "Tipo");
  const empty = !item.productKind;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-xs whitespace-nowrap shrink-0 ${
            empty
              ? "border-dashed text-muted-foreground hover:text-foreground hover:border-foreground"
              : "border-primary/30 bg-primary/5 text-primary"
          }`}
          title="Tipo de produto (nome padronizado)"
        >
          <Tag className="h-3 w-3" />
          <span className="max-w-[100px] truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Tipo de produto</p>
        <Select
          value={item.productKind ?? ""}
          onValueChange={(v) => onChange({ productKind: v as PricingMaterial["productKind"] })}
        >
          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {PRODUCT_KIND_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {item.productKind === "outro" && (
          <Input
            placeholder="Nome customizado"
            value={item.customName ?? ""}
            onChange={(e) => onChange({ customName: e.target.value })}
            className="h-8 text-sm"
          />
        )}
        <p className="text-[10px] text-muted-foreground">
          Define como o item aparece no PDF do cliente.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function DraftRowEditor({
  row, rowNumber, printingCatalog, processSteps, processGroups,
  onSetMode, onPickPrinting, onPickProcessStep, onPickProcessGroup, onCancel,
}: {
  row: DraftRow;
  rowNumber: number;
  printingCatalog: PrintingCatalogItem[];
  processSteps: ProcessStep[];
  processGroups: ProcessGroup[];
  onSetMode: (m: DraftMode) => void;
  onPickPrinting: (it: PrintingCatalogItem) => void;
  onPickProcessStep: (s: ProcessStep) => void;
  onPickProcessGroup: (g: ProcessGroup) => void;
  onCancel: () => void;
}) {
  return (
    <div className={`${GRID} px-2 py-1.5 border-b text-sm bg-primary/5`}>
      <span className="text-xs text-muted-foreground tabular-nums">{rowNumber}</span>
      <Select value={row.mode} onValueChange={(v) => onSetMode(v as DraftMode)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo…" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="impressao">Impressão</SelectItem>
          <SelectItem value="processo">Acabamento / Processo</SelectItem>
          <SelectItem value="impressao_processo">Impressão + Processo</SelectItem>
        </SelectContent>
      </Select>
      <div className="min-w-0">
        {row.mode === "" && (
          <span className="text-xs text-muted-foreground italic">Escolha o tipo →</span>
        )}
        {(row.mode === "impressao" || row.mode === "impressao_processo") && (
          <InlineCatalogCombobox
            placeholder="Buscar impressão no catálogo…"
            sections={[{
              heading: "Impressões",
              options: printingCatalog.map((p) => ({
                id: p.id,
                label: `${p.paper_type}${p.grammage ? ` ${p.grammage}` : ""} — ${p.size} ${p.side}`,
                hint: p.equipment_name || p.category_name,
                onPick: () => onPickPrinting(p),
              })),
            }]}
          />
        )}
        {row.mode === "processo" && (
          <InlineCatalogCombobox
            placeholder="Buscar processo ou grupo…"
            sections={[
              {
                heading: "Processos individuais",
                options: processSteps.map((s) => ({
                  id: `s-${s.id}`,
                  label: s.description,
                  hint: `${s.time_minutes} min`,
                  onPick: () => onPickProcessStep(s),
                })),
              },
              {
                heading: "Grupos de processos",
                options: processGroups.map((g) => ({
                  id: `g-${g.id}`,
                  label: g.name,
                  hint: `${g.items.length} etapa${g.items.length === 1 ? "" : "s"}`,
                  icon: <Layers className="h-3 w-3" />,
                  onPick: () => onPickProcessGroup(g),
                })),
              },
            ]}
          />
        )}
      </div>
      <span></span><span></span><span></span><span></span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface ComboOption {
  id: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  onPick: () => void;
}
interface ComboSection { heading: string; options: ComboOption[] }

function InlineCatalogCombobox({
  placeholder, sections,
}: {
  placeholder: string;
  sections: ComboSection[];
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filteredSections = useMemo(() => {
    const s = q.toLowerCase();
    return sections
      .map((sec) => ({
        ...sec,
        options: sec.options
          .filter((o) => o.label.toLowerCase().includes(s) || (o.hint || "").toLowerCase().includes(s))
          .slice(0, 30),
      }))
      .filter((sec) => sec.options.length > 0);
  }, [q, sections]);
  const totalCount = filteredSections.reduce((n, s) => n + s.options.length, 0);
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="h-8 pl-7 text-sm"
        />
      </div>
      {open && totalCount > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-auto rounded-md border bg-popover shadow-lg">
          {filteredSections.map((sec) => (
            <div key={sec.heading}>
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/30">
                {sec.heading}
              </div>
              {sec.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); opt.onPick(); }}
                  className="w-full px-3 py-2 text-left hover:bg-accent text-sm flex items-center justify-between gap-2"
                >
                  <span className="truncate inline-flex items-center gap-1.5">{opt.icon}{opt.label}</span>
                  {opt.hint && <span className="text-[10px] text-muted-foreground shrink-0">{opt.hint}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      {open && q && totalCount === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg p-3 text-xs text-muted-foreground">
          Nenhum item encontrado no catálogo.
        </div>
      )}
    </div>
  );
}

function ProcessPicker({
  steps, groups, onPickStep, onPickGroup,
}: {
  steps: ProcessStep[];
  groups: ProcessGroup[];
  onPickStep: (s: ProcessStep) => void;
  onPickGroup: (g: ProcessGroup) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const fSteps = useMemo(() => {
    const s = q.toLowerCase();
    return steps.filter((x) => x.description.toLowerCase().includes(s)).slice(0, 30);
  }, [q, steps]);
  const fGroups = useMemo(() => {
    const s = q.toLowerCase();
    return groups.filter((x) => x.name.toLowerCase().includes(s)).slice(0, 30);
  }, [q, groups]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-dashed text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground shrink-0"
          title="Adicionar processo vinculado"
        >
          <Plus className="h-3 w-3" /> processo
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <Input
          autoFocus
          placeholder="Buscar processo ou grupo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 text-sm mb-2"
        />
        <div className="max-h-64 overflow-auto">
          {fSteps.length === 0 && fGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Nenhum item.</p>
          ) : (
            <>
              {fSteps.length > 0 && (
                <>
                  <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Processos individuais</div>
                  {fSteps.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { onPickStep(s); setOpen(false); }}
                      className="w-full px-2 py-1.5 text-left hover:bg-accent text-sm flex items-center justify-between gap-2 rounded"
                    >
                      <span className="truncate">{s.description}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 inline-flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />{s.time_minutes} min
                      </span>
                    </button>
                  ))}
                </>
              )}
              {fGroups.length > 0 && (
                <>
                  <div className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Grupos de processos</div>
                  {fGroups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { onPickGroup(g); setOpen(false); }}
                      className="w-full px-2 py-1.5 text-left hover:bg-accent text-sm flex items-center justify-between gap-2 rounded"
                    >
                      <span className="truncate inline-flex items-center gap-1.5"><Layers className="h-3 w-3" />{g.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{g.items.length} etapas</span>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
