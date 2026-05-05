import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, X, Printer, Wrench, Tag, Search, Check,
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
import { Badge } from "@/components/ui/badge";
import {
  PRODUCT_KIND_OPTIONS, productKindLabel, buildDynamicTitle,
} from "@/lib/quotes-v2/item-title";
import type { PricingMaterial } from "@/lib/quotes-v2/pricing";
import type { SubformLabor, SubformMaterial } from "./LaborAndSupplySubform";

type ThirdParty = { id: string; description: string; supplier: string; cost: number };
type FinishingItem = { id: string; name: string; category: string; size: string; price_per_sheet: number };

type DraftMode = "" | "impressao" | "acabamento" | "impressao_acabamento";
interface DraftRow {
  id: string;
  mode: DraftMode;
}

interface Props {
  printingCatalog: PrintingCatalogItem[];
  finishingCatalog: FinishingItem[];
  markupTiers: MarkupTier[];
  globalSettings: { invoice_pct: number; collection_pct: number; waste_pct: number; default_margin_pct: number };
  hourlyRate: number;

  printingItems: PricingMaterial[];
  childMaterials: PricingMaterial[]; // acabamentos vinculados
  standaloneLabor: SubformLabor[];
  standaloneManualMaterials: SubformMaterial[];
  thirdParty: ThirdParty[];

  onAddPrinting: (item: PrintingCatalogItem, opts?: { draftId?: string }) => void;
  onAddFinishing: (parentId: string, fin: FinishingItem) => void;
  onUpdatePrinting: (id: string, patch: Partial<PricingMaterial>) => void;
  onUpdateChildMaterial: (id: string, patch: Partial<PricingMaterial>) => void;
  onRemovePrinting: (id: string) => void;
  onRemoveChildMaterial: (id: string) => void;

  onChangeStandaloneLabor: (next: SubformLabor[]) => void;
  onChangeStandaloneMaterials: (next: SubformMaterial[]) => void;
  onChangeThirdParty: (next: ThirdParty[]) => void;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const GRID = "grid grid-cols-[32px_140px_1fr_90px_60px_110px_110px_36px] items-center gap-2";

export function QuoteItemsTable(props: Props) {
  const {
    printingCatalog, finishingCatalog, printingItems, childMaterials,
    standaloneLabor, standaloneManualMaterials, thirdParty,
    onAddPrinting, onAddFinishing, onUpdatePrinting, onUpdateChildMaterial,
    onRemovePrinting, onRemoveChildMaterial,
    onChangeStandaloneLabor, onChangeStandaloneMaterials, onChangeThirdParty,
  } = props;

  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  const addEmptyDraft = () =>
    setDrafts((p) => [...p, { id: `draft-${Date.now()}`, mode: "" }]);
  const removeDraft = (id: string) =>
    setDrafts((p) => p.filter((d) => d.id !== id));
  const setDraftMode = (id: string, mode: DraftMode) =>
    setDrafts((p) => p.map((d) => (d.id === id ? { ...d, mode } : d)));

  const handleDraftSelectPrinting = (draftId: string, item: PrintingCatalogItem, mode: DraftMode) => {
    onAddPrinting(item);
    if (mode !== "impressao_acabamento") removeDraft(draftId);
    else {
      // Mantém draft com o pai recém-criado para escolher acabamentos
      // O pai recém-criado é o último de printingItems após o re-render — mas o
      // popover de acabamentos abre direto na linha do pai já criada.
      removeDraft(draftId);
    }
  };

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
    const finishesForThis = childMaterials.filter((c) => c.parentItemId === m.id);
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
            <FinishingPicker
              catalog={finishingCatalog}
              alreadyAdded={finishesForThis.map((c) => c.catalogItemId).filter(Boolean) as string[]}
              onPick={(fin) => onAddFinishing(m.id, fin)}
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
        {finishesForThis.map((c) => (
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

  const renderLegacyLabor = (l: SubformLabor, idx: number) => (
    <div key={l.id} className={`${GRID} px-2 py-1.5 border-b text-sm hover:bg-muted/30`}>
      <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">Legado</span>
      <span className="text-sm text-muted-foreground truncate">{l.description} ({l.timeMinutes} min)</span>
      <span></span><span></span><span></span><span></span>
      <Button variant="ghost" size="icon" className="h-7 w-7"
        onClick={() => onChangeStandaloneLabor(standaloneLabor.filter((x) => x.id !== l.id))}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

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

      {printingItems.length === 0 && drafts.length === 0 && standaloneLabor.length === 0 && standaloneManualMaterials.length === 0 && thirdParty.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground italic">
          Nenhum item adicionado. Clique em <strong>+ adicionar item</strong> abaixo.
        </div>
      )}

      {printingItems.map((m, idx) => renderPrint(m, idx))}
      {standaloneManualMaterials.map((m, idx) => renderLegacyMaterial(m, printingItems.length + idx))}
      {standaloneLabor.map((l, idx) => renderLegacyLabor(l, printingItems.length + standaloneManualMaterials.length + idx))}
      {thirdParty.map((t, idx) => renderLegacyService(t, printingItems.length + standaloneManualMaterials.length + standaloneLabor.length + idx))}

      {/* Drafts */}
      {drafts.map((d, idx) => (
        <DraftRowEditor
          key={d.id}
          row={d}
          rowNumber={printingItems.length + standaloneManualMaterials.length + standaloneLabor.length + thirdParty.length + idx + 1}
          printingCatalog={printingCatalog}
          finishingCatalog={finishingCatalog}
          onSetMode={(m) => setDraftMode(d.id, m)}
          onPickPrinting={(it) => handleDraftSelectPrinting(d.id, it, d.mode)}
          onPickFinishingStandalone={(fin) => {
            // Acabamento avulso: precisa de pai. Se não há nenhum item de impressão, avisamos.
            if (printingItems.length === 0) return;
            // Vincula ao último item de impressão
            const lastPrint = printingItems[printingItems.length - 1];
            onAddFinishing(lastPrint.id, fin);
            removeDraft(d.id);
          }}
          onCancel={() => removeDraft(d.id)}
          hasPrintingForFinishing={printingItems.length > 0}
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
  row, rowNumber, printingCatalog, finishingCatalog,
  onSetMode, onPickPrinting, onPickFinishingStandalone, onCancel,
  hasPrintingForFinishing,
}: {
  row: DraftRow;
  rowNumber: number;
  printingCatalog: PrintingCatalogItem[];
  finishingCatalog: FinishingItem[];
  onSetMode: (m: DraftMode) => void;
  onPickPrinting: (it: PrintingCatalogItem) => void;
  onPickFinishingStandalone: (fin: FinishingItem) => void;
  onCancel: () => void;
  hasPrintingForFinishing: boolean;
}) {
  return (
    <div className={`${GRID} px-2 py-1.5 border-b text-sm bg-primary/5`}>
      <span className="text-xs text-muted-foreground tabular-nums">{rowNumber}</span>
      <Select value={row.mode} onValueChange={(v) => onSetMode(v as DraftMode)}>
        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo…" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="impressao">Impressão</SelectItem>
          <SelectItem value="acabamento">Acabamento</SelectItem>
          <SelectItem value="impressao_acabamento">Impressão + Acabamento</SelectItem>
        </SelectContent>
      </Select>
      <div className="min-w-0">
        {row.mode === "" && (
          <span className="text-xs text-muted-foreground italic">Escolha o tipo →</span>
        )}
        {(row.mode === "impressao" || row.mode === "impressao_acabamento") && (
          <InlineCatalogCombobox
            placeholder="Buscar impressão no catálogo…"
            items={printingCatalog.map((p) => ({
              id: p.id,
              label: `${p.paper_type}${p.grammage ? ` ${p.grammage}` : ""} — ${p.size} ${p.side}`,
              hint: p.equipment_name || p.category_name,
              raw: p,
            }))}
            onPick={(opt) => onPickPrinting(opt.raw as PrintingCatalogItem)}
          />
        )}
        {row.mode === "acabamento" && (
          <div className="space-y-1">
            <InlineCatalogCombobox
              placeholder="Buscar acabamento no catálogo…"
              items={finishingCatalog.map((f) => ({
                id: f.id,
                label: f.name,
                hint: `${f.category} · ${f.size}`,
                raw: f,
              }))}
              onPick={(opt) => onPickFinishingStandalone(opt.raw as FinishingItem)}
            />
            {!hasPrintingForFinishing && (
              <p className="text-[10px] text-amber-600">
                Acabamento precisa estar vinculado a uma impressão. Adicione uma impressão primeiro.
              </p>
            )}
          </div>
        )}
      </div>
      <span></span><span></span><span></span><span></span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface ComboOption { id: string; label: string; hint?: string; raw: unknown }

function InlineCatalogCombobox({
  placeholder, items, onPick,
}: {
  placeholder: string;
  items: ComboOption[];
  onPick: (opt: ComboOption) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return items.filter((i) => i.label.toLowerCase().includes(s) || (i.hint || "").toLowerCase().includes(s)).slice(0, 30);
  }, [q, items]);
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
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-popover shadow-lg">
          {filtered.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onPick(opt); }}
              className="w-full px-3 py-2 text-left hover:bg-accent text-sm flex items-center justify-between gap-2"
            >
              <span className="truncate">{opt.label}</span>
              {opt.hint && <span className="text-[10px] text-muted-foreground shrink-0">{opt.hint}</span>}
            </button>
          ))}
        </div>
      )}
      {open && q && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg p-3 text-xs text-muted-foreground">
          Nenhum item encontrado no catálogo.
        </div>
      )}
    </div>
  );
}

function FinishingPicker({
  catalog, alreadyAdded, onPick,
}: {
  catalog: FinishingItem[];
  alreadyAdded: string[];
  onPick: (fin: FinishingItem) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return catalog.filter((f) => f.name.toLowerCase().includes(s)).slice(0, 50);
  }, [q, catalog]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-dashed text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground shrink-0"
          title="Adicionar acabamento vinculado"
        >
          <Plus className="h-3 w-3" /> acabamento
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <Input
          autoFocus
          placeholder="Buscar acabamento…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 text-sm mb-2"
        />
        <div className="max-h-64 overflow-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Nenhum acabamento.</p>
          ) : (
            filtered.map((f) => {
              const added = alreadyAdded.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={added}
                  onClick={() => onPick(f)}
                  className="w-full px-2 py-1.5 text-left hover:bg-accent text-sm flex items-center justify-between gap-2 rounded disabled:opacity-50"
                >
                  <span className="truncate">{f.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0 inline-flex items-center gap-1">
                    {added && <Check className="h-3 w-3" />}
                    <Badge variant="outline" className="text-[9px] h-4 px-1">{f.category}</Badge>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
