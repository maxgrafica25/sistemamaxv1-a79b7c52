import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, X, Printer, Wrench, Tag, Search, Clock, Layers, Wand2, RefreshCw, Copy, CheckCircle2, Lock,
} from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { PrintingItemEditor } from "./PrintingItemEditor";

type ThirdParty = { id: string; description: string; supplier: string; cost: number };
export type ProcessStep = { id: string; description: string; time_minutes: number; step_type: string };
export type ProcessGroupItem = { description: string; time_minutes: number; step_type: string };
export type ProcessGroup = { id: string; name: string; items: ProcessGroupItem[] };

interface DraftRow {
  id: string;
}

interface Props {
  printingCatalog: PrintingCatalogItem[];
  processSteps: ProcessStep[];
  processGroups: ProcessGroup[];
  markupTiers: MarkupTier[];
  categoryDefaultGroupId: Record<string, string | null>;
  globalSettings: { invoice_pct: number; collection_pct: number; waste_pct: number; default_margin_pct: number };
  hourlyRate: number;

  printingItems: PricingMaterial[];
  childMaterials: PricingMaterial[];
  childLabor: SubformLabor[];
  standaloneLabor: SubformLabor[];
  standaloneManualMaterials: SubformMaterial[];
  thirdParty: ThirdParty[];

  onAddPrinting: (item: PrintingCatalogItem) => void;
  onAddEmptyPrinting: () => void;
  onPickPaperForPrinting: (id: string, item: PrintingCatalogItem) => void;
  onSwapPrinting: (id: string, item: PrintingCatalogItem) => void;
  onAddProcess: (parentId: string | null, step: ProcessStep) => void;
  onExpandStepGroup: (parentId: string | null, group: ProcessGroup) => void;
  onAddCustomFinish: (parentId: string | null, name: string, minutes: number) => void;
  onUpdatePrinting: (id: string, patch: Partial<PricingMaterial>) => void;
  onUpdateChildMaterial: (id: string, patch: Partial<PricingMaterial>) => void;
  onSetChildLaborForItem: (parentId: string, next: SubformLabor[]) => void;
  onSetChildMaterialsForItem: (parentId: string, next: SubformMaterial[]) => void;
  onRemovePrinting: (id: string) => void;
  onDuplicateItem: (id: string) => void;
  onRemoveChildMaterial: (id: string) => void;
  onRemoveLabor: (id: string) => void;

  onChangeStandaloneLabor: (next: SubformLabor[]) => void;
  onChangeStandaloneMaterials: (next: SubformMaterial[]) => void;
  onChangeThirdParty: (next: ThirdParty[]) => void;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const GRID = "grid grid-cols-[32px_140px_1fr_90px_60px_110px_110px_72px] items-center gap-2";

export function QuoteItemsTable(props: Props) {
  const {
    printingCatalog, processSteps, processGroups, hourlyRate,
    markupTiers, categoryDefaultGroupId,
    printingItems, childMaterials, childLabor,
    standaloneLabor, standaloneManualMaterials, thirdParty,
    onAddPrinting, onAddEmptyPrinting, onPickPaperForPrinting,
    onSwapPrinting, onAddProcess, onExpandStepGroup, onAddCustomFinish,
    onUpdatePrinting, onUpdateChildMaterial,
    onSetChildLaborForItem, onSetChildMaterialsForItem,
    onRemovePrinting, onRemoveChildMaterial, onRemoveLabor, onDuplicateItem,
    onChangeStandaloneLabor, onChangeStandaloneMaterials, onChangeThirdParty,
  } = props;

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerFlash = (id: string) => {
    setFlashId(id);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashId(null), 700);
  };

  const addEmptyDraft = () =>
    setDrafts((p) => [...p, { id: `draft-${Date.now()}` }]);
  const removeDraft = (id: string) =>
    setDrafts((p) => p.filter((d) => d.id !== id));

  // Auto-open one empty draft when the table is completely empty on mount.
  const autoDraftedRef = useRef(false);
  useEffect(() => {
    if (autoDraftedRef.current) return;
    const isEmpty =
      printingItems.length === 0 &&
      standaloneLabor.length === 0 &&
      standaloneManualMaterials.length === 0 &&
      thirdParty.length === 0 &&
      drafts.length === 0;
    if (isEmpty) {
      autoDraftedRef.current = true;
      addEmptyDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printingItems.length, standaloneLabor.length, standaloneManualMaterials.length, thirdParty.length]);

  // Tier-aware unit price helper (mirrors pricing engine).
  const computeTierUnitPrice = (m: PricingMaterial, qty: number): number => {
    if (!m.baseCost || !m.printerCategoryId) return m.unitPrice || 0;
    const groupId = m.markupGroupId || categoryDefaultGroupId[m.printerCategoryId] || null;
    const groupTiers = groupId
      ? markupTiers.filter((t) => t.markup_group_id === groupId)
      : markupTiers.filter((t) => t.printer_category_id === m.printerCategoryId);
    const tier =
      groupTiers.find((t) => qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty)) ||
      groupTiers[0] ||
      null;
    if (!tier) return m.baseCost;
    // Embed child costs (labor + materials) per unit, like recalculateForQuantity.
    const childMatTotal = childMaterials
      .filter((c) => c.parentItemId === m.id)
      .reduce((s, c) => s + (c.quantity || 0) * (c.unitPrice || 0), 0);
    const childLaborTotal = childLabor
      .filter((l) => l.parentItemId === m.id)
      .reduce((s, l) => s + ((l.timeMinutes || 0) / 60) * (hourlyRate || 0), 0);
    const childPerUnit = qty > 0 ? (childMatTotal + childLaborTotal) / qty : 0;
    const baseEffective = (m.baseCost || 0) + childPerUnit;
    const soma = (tier.fixed_cost_pct + tier.variable_cost_pct + tier.margin_pct) / 100;
    const divisor = 1 - soma;
    if (divisor <= 0) return 0;
    return Math.round((baseEffective / divisor) * 10) / 10;
  };

  // Reactively re-sync each printing item's unit price with its current tier.
  useEffect(() => {
    for (const m of printingItems) {
      const fresh = computeTierUnitPrice(m, m.quantity || 1);
      if (fresh > 0 && Math.abs(fresh - (m.unitPrice || 0)) > 0.001) {
        onUpdatePrinting(m.id, { unitPrice: fresh });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(printingItems.map((m) => [m.id, m.quantity, m.baseCost, m.printerCategoryId, m.markupGroupId])),
    JSON.stringify(childMaterials.map((c) => [c.id, c.parentItemId, c.quantity, c.unitPrice])),
    JSON.stringify(childLabor.map((l) => [l.id, l.parentItemId, l.timeMinutes])),
    JSON.stringify(markupTiers.map((t) => t.id)),
    hourlyRate,
  ]);

  // ---------- Renderers ----------
  const renderPrint = (m: PricingMaterial, idx: number) => {
    const total = (m.quantity || 0) * (m.unitPrice || 0);
    const isApproved = m.status === "aprovado";
    const childMatsForThis = childMaterials.filter((c) => c.parentItemId === m.id);
    const childLaborForThis = childLabor.filter((l) => l.parentItemId === m.id);
    const ringCls = isApproved
      ? ""
      : flashId === m.id
        ? "ring-2 ring-primary/40"
        : "";
    return (
      <div key={m.id} className={`px-2 py-2 border-b ${ringCls}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground tabular-nums w-6 shrink-0">{idx + 1}</span>
          <KindBadge kind="print" />
          {isApproved && <ApprovedBadge approvedAt={m.approvedAt} approvedValue={m.approvedValue} />}
          <span className="ml-auto text-sm font-semibold text-primary">{fmt(total)}</span>
          {!isApproved && (
            <ProcessPicker
              steps={processSteps}
              groups={processGroups}
              hourlyRate={hourlyRate}
              onPickStep={(s) => onAddProcess(m.id, s)}
              onPickGroup={(g) => onExpandStepGroup(m.id, g)}
              onPickCustom={(name, minutes) => onAddCustomFinish(m.id, name, minutes)}
            />
          )}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDuplicateItem(m.id)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[220px]">
                Duplicar Item Completo
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <PrintingItemEditor
          item={m}
          childLabor={childLaborForThis}
          childMaterials={childMatsForThis}
          hourlyRate={hourlyRate}
          printingCatalog={printingCatalog}
          onItemChange={(patch) => onUpdatePrinting(m.id, patch)}
          onRemove={() => onRemovePrinting(m.id)}
          onChildLaborChange={(next) => onSetChildLaborForItem(m.id, next)}
          onChildMaterialChange={(next) => onSetChildMaterialsForItem(m.id, next)}
          onPickPaper={(it) => {
            onPickPaperForPrinting(m.id, it);
            triggerFlash(m.id);
          }}
        />
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
    const isApproved = m.status === "aprovado";
    const rowBg = isApproved ? "bg-green-50/60 dark:bg-green-950/20" : "hover:bg-muted/30";
    return (
      <div key={m.id} className={`${GRID} px-2 py-1.5 border-b text-sm ${rowBg}`}>
        <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">Legado</span>
          {isApproved && <ApprovedBadge approvedAt={m.approvedAt} approvedValue={m.approvedValue} />}
        </div>
        <span className="text-sm text-muted-foreground truncate" title={m.description}>{m.description}</span>
        <Input type="number" value={m.quantity || ""} disabled className="h-8 text-sm text-right tabular-nums" />
        <span className="text-xs text-muted-foreground text-center">un</span>
        <Input type="number" step="0.01" value={m.unitPrice || ""} disabled className="h-8 text-sm text-right tabular-nums" />
        <span className="text-right tabular-nums font-medium">{fmt(total)}</span>
        {!isApproved ? (
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => onChangeStandaloneMaterials(standaloneManualMaterials.filter((x) => x.id !== m.id))}>
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : <span />}
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

  const approvedCount =
    printingItems.filter((m) => m.status === "aprovado").length +
    standaloneManualMaterials.filter((m) => m.status === "aprovado").length;
  const totalCount = printingItems.length + standaloneManualMaterials.length;

  // Reordenação visual: aprovados (travados) ficam no topo, editáveis embaixo
  // próximos ao botão "+ adicionar item". Não persiste no banco.
  const sortByApproved = <T extends { status?: string | null }>(arr: T[]): T[] =>
    [...arr].sort((a, b) => {
      const ap = a.status === "aprovado" ? 0 : 1;
      const bp = b.status === "aprovado" ? 0 : 1;
      return ap - bp;
    });
  const printingOrdered = sortByApproved(printingItems);
  const manualOrdered = sortByApproved(standaloneManualMaterials);

  return (
    <div className="rounded-lg border bg-card">
      {approvedCount > 0 && (
        <div className="px-3 py-2 border-b bg-green-50/50 dark:bg-green-950/20 text-xs flex items-center gap-2 text-green-800 dark:text-green-300">
          <Lock className="h-3.5 w-3.5" />
          <span>
            <strong>{approvedCount} de {totalCount}</strong> {approvedCount === 1 ? "item aprovado" : "itens aprovados"} pelo cliente — travados nesta versão. Crie uma <strong>Nova versão</strong> para alterar.
          </span>
        </div>
      )}
      {(standaloneLabor.length > 0 || manualOrdered.length > 0 || thirdParty.length > 0) && (
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
      )}

      {isEmpty && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground italic">
          Nenhum item adicionado. Clique em <strong>+ adicionar item</strong> abaixo.
        </div>
      )}

      {printingOrdered.map((m, idx) => renderPrint(m, idx))}
      {standaloneLabor.map((l) => renderLaborRow(l, false))}
      {manualOrdered.map((m, idx) => renderLegacyMaterial(m, printingOrdered.length + idx))}
      {thirdParty.map((t, idx) => renderLegacyService(t, printingOrdered.length + manualOrdered.length + idx))}

      {/* Drafts */}
      {drafts.map((d, idx) => (
        <DraftRowEditor
          key={d.id}
          row={d}
          rowNumber={printingItems.length + standaloneManualMaterials.length + standaloneLabor.length + thirdParty.length + idx + 1}
          printingCatalog={printingCatalog}
          processSteps={processSteps}
          processGroups={processGroups}
          hourlyRate={hourlyRate}
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
          onPickCustomFinish={(name, minutes) => {
            onAddCustomFinish(null, name, minutes);
            removeDraft(d.id);
          }}
          onCancel={() => removeDraft(d.id)}
        />
      ))}

      {/* Add row trigger */}
      <div className="flex items-center gap-3 px-3 py-2.5 text-sm flex-wrap">
        <button
          onClick={() => onAddEmptyPrinting()}
          className="text-primary hover:underline inline-flex items-center gap-1.5 font-medium"
        >
          <Plus className="h-4 w-4" /> adicionar impressão
        </button>
        <span className="text-muted-foreground">·</span>
        <button
          onClick={addEmptyDraft}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> processo / acabamento avulso
        </button>
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

function ApprovedBadge({ approvedAt, approvedValue }: { approvedAt?: string | null; approvedValue?: number | null }) {
  const when = approvedAt ? new Date(approvedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;
  const val = approvedValue != null ? fmt(Number(approvedValue)) : null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/30">
            <CheckCircle2 className="h-3 w-3" /> Aprovado <Lock className="h-2.5 w-2.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[260px]">
          <div className="font-medium">Item aprovado pelo cliente</div>
          {when && <div>Em: {when}</div>}
          {val && <div>Valor aprovado: {val}</div>}
          <div className="mt-1 text-muted-foreground">Travado nesta versão. Crie uma nova versão para alterar.</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  row, rowNumber, printingCatalog, processSteps, processGroups, hourlyRate,
  onPickPrinting, onPickProcessStep, onPickProcessGroup, onPickCustomFinish, onCancel,
}: {
  row: DraftRow;
  rowNumber: number;
  printingCatalog: PrintingCatalogItem[];
  processSteps: ProcessStep[];
  processGroups: ProcessGroup[];
  hourlyRate: number;
  onPickPrinting: (it: PrintingCatalogItem) => void;
  onPickProcessStep: (s: ProcessStep) => void;
  onPickProcessGroup: (g: ProcessGroup) => void;
  onPickCustomFinish: (name: string, minutes: number) => void;
  onCancel: () => void;
}) {
  return (
    <div className="px-2 py-2 border-b text-sm bg-primary/5">
      <div className="flex items-start gap-2">
        <span className="text-xs text-muted-foreground tabular-nums w-6 pt-2 shrink-0">{rowNumber}</span>
        <div className="flex-1 min-w-0">
          <InlineCatalogCombobox
            placeholder="Busque a impressão pelo nome (papel, gramatura, formato)…"
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
          <p className="mt-1 text-[11px] text-muted-foreground">
            Defina primeiro a impressão. Acabamentos podem ser adicionados depois →
          </p>
        </div>
        <ProcessPicker
          steps={processSteps}
          groups={processGroups}
          hourlyRate={hourlyRate}
          onPickStep={onPickProcessStep}
          onPickGroup={onPickProcessGroup}
          onPickCustom={onPickCustomFinish}
          label="acabamento"
        />
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
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

interface ExtraTopAction {
  label: string;
  icon?: React.ReactNode;
  renderForm: (close: () => void) => React.ReactNode;
}

function InlineCatalogCombobox({
  placeholder, sections, extraTop,
}: {
  placeholder: string;
  sections: ComboSection[];
  extraTop?: ExtraTopAction;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
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
  const showDropdown = open && (totalCount > 0 || extraTop || (q && totalCount === 0));
  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          autoFocus
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onBlur={() => { if (!showForm) setTimeout(() => setOpen(false), 150); }}
          placeholder={placeholder}
          className="h-8 pl-7 text-sm"
        />
      </div>
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full max-h-80 overflow-auto rounded-md border bg-popover shadow-lg p-1">
          {extraTop && !showForm && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); setShowForm(true); }}
              className="flex w-full items-center gap-2 rounded-sm border border-dashed border-primary/40 bg-primary/5 px-2 py-1.5 text-left text-sm text-primary hover:bg-primary/10 mb-1"
            >
              {extraTop.icon}
              <span className="font-medium">{extraTop.label}</span>
            </button>
          )}
          {extraTop && showForm && (
            <div onMouseDown={(e) => e.stopPropagation()} className="p-2">
              {extraTop.renderForm(() => { setShowForm(false); setOpen(false); })}
            </div>
          )}
          {!showForm && filteredSections.map((sec) => (
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
          {!showForm && q && totalCount === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum item no catálogo. Use o botão acima para acabamento avulso.</p>
          )}
        </div>
      )}
    </div>
  );
}

function CustomFinishForm({
  hourlyRate, onSubmit, onCancel,
}: {
  hourlyRate: number;
  onSubmit: (name: string, minutes: number) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState("");
  const mins = parseFloat(minutes) || 0;
  const valid = name.trim() && mins > 0;
  const cost = (mins / 60) * (hourlyRate || 0);
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-foreground flex items-center gap-1.5">
        <Wand2 className="h-3.5 w-3.5 text-primary" /> Acabamento avulso
      </div>
      <Input autoFocus placeholder="Nome (ex: Corte especial)" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
      <Input type="number" inputMode="decimal" step="1" min="0" placeholder="Tempo (min)" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="h-8 text-sm" />
      <p className="text-[10px] text-muted-foreground">
        ≈ {fmt(cost)} <span className="opacity-70">(custo/hora {fmt(hourlyRate || 0)}/h)</span>
      </p>
      <p className="text-[10px] text-muted-foreground">Válido apenas neste orçamento. Não será salvo no cadastro.</p>
      <div className="flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" className="h-7 text-xs" disabled={!valid}
          onClick={() => onSubmit(name.trim(), mins)}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function ProcessPicker({
  steps, groups, hourlyRate, onPickStep, onPickGroup, onPickCustom, label = "processo",
}: {
  steps: ProcessStep[];
  groups: ProcessGroup[];
  hourlyRate: number;
  onPickStep: (s: ProcessStep) => void;
  onPickGroup: (g: ProcessGroup) => void;
  onPickCustom: (name: string, minutes: number) => void;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const reset = () => { setCustomMode(false); setQ(""); };
  const fSteps = useMemo(() => {
    const s = q.toLowerCase();
    return steps.filter((x) => x.description.toLowerCase().includes(s)).slice(0, 30);
  }, [q, steps]);
  const fGroups = useMemo(() => {
    const s = q.toLowerCase();
    return groups.filter((x) => x.name.toLowerCase().includes(s)).slice(0, 30);
  }, [q, groups]);
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-dashed text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground shrink-0"
          title="Adicionar acabamento / processo"
        >
          <Plus className="h-3 w-3" /> {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        {customMode ? (
          <CustomFinishForm
            hourlyRate={hourlyRate}
            onSubmit={(name, minutes) => { onPickCustom(name, minutes); setOpen(false); reset(); }}
            onCancel={reset}
          />
        ) : (
          <>
            <Input
              autoFocus
              placeholder="Buscar processo ou grupo…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-8 text-sm mb-2"
            />
            <button
              type="button"
              onClick={() => setCustomMode(true)}
              className="flex w-full items-center gap-2 rounded-sm border border-dashed border-primary/40 bg-primary/5 px-2 py-1.5 text-left text-sm text-primary hover:bg-primary/10 mb-2"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span className="font-medium">Adicionar acabamento avulso</span>
            </button>
            <div className="max-h-64 overflow-auto">
              {fSteps.length === 0 && fGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Nenhum processo cadastrado encontrado. Use "Acabamento avulso" acima.</p>
              ) : (
                <>
                  {fSteps.length > 0 && (
                    <>
                      <div className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Processos individuais</div>
                      {fSteps.map((s) => (
                        <button key={s.id} type="button"
                          onClick={() => { onPickStep(s); setOpen(false); reset(); }}
                          className="w-full px-2 py-1.5 text-left hover:bg-accent text-sm flex items-center justify-between gap-2 rounded">
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
                        <button key={g.id} type="button"
                          onClick={() => { onPickGroup(g); setOpen(false); reset(); }}
                          className="w-full px-2 py-1.5 text-left hover:bg-accent text-sm flex items-center justify-between gap-2 rounded">
                          <span className="truncate inline-flex items-center gap-1.5"><Layers className="h-3 w-3" />{g.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{g.items.length} etapas</span>
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function SwapPrintingButton({
  catalog, onPick,
}: {
  catalog: PrintingCatalogItem[];
  onPick: (it: PrintingCatalogItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return catalog
      .filter((p) =>
        `${p.paper_type} ${p.grammage ?? ""} ${p.size} ${p.side} ${p.equipment_name ?? ""} ${p.category_name}`
          .toLowerCase()
          .includes(s),
      )
      .slice(0, 30);
  }, [q, catalog]);

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center h-6 w-6 rounded border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground shrink-0"
                aria-label="Trocar material"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Trocar material</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="start" className="w-80 p-2">
        <Input
          autoFocus
          placeholder="Buscar nova impressão…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 text-sm mb-2"
        />
        <div className="max-h-64 overflow-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Nenhuma impressão encontrada.</p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onPick(p); setOpen(false); setQ(""); }}
                className="w-full px-2 py-1.5 text-left hover:bg-accent text-sm rounded flex items-center justify-between gap-2"
              >
                <span className="truncate">
                  {p.paper_type}{p.grammage ? ` ${p.grammage}` : ""} — {p.size} {p.side}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {p.equipment_name || p.category_name}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
