import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, X, Printer, Wrench, ChevronDown, Tag, Layers, Loader2,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import PrintingItemSearch, {
  type PrintingCatalogItem, type MarkupTier,
} from "@/components/orcamentos/PrintingItemSearch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { STEP_TYPES, StepTypeBadge } from "./StepTypeBadge";
import { Badge } from "@/components/ui/badge";
import {
  PRODUCT_KIND_OPTIONS, productKindLabel, buildDynamicTitle,
} from "@/lib/quotes-v2/item-title";
import { supabase } from "@/integrations/supabase/client";
import type { PricingMaterial } from "@/lib/quotes-v2/pricing";
import type { SubformLabor, SubformMaterial } from "./LaborAndSupplySubform";

type ThirdParty = { id: string; description: string; supplier: string; cost: number };

interface ProductionStep {
  id: string;
  description: string;
  time_minutes: number;
  step_type: string;
}
interface StepGroup {
  id: string;
  name: string;
  items: ProductionStep[];
}

interface Props {
  printingCatalog: PrintingCatalogItem[];
  markupTiers: MarkupTier[];
  globalSettings: { invoice_pct: number; collection_pct: number; waste_pct: number; default_margin_pct: number };
  hourlyRate: number;

  printingItems: PricingMaterial[];
  standaloneLabor: SubformLabor[];
  standaloneManualMaterials: SubformMaterial[];
  thirdParty: ThirdParty[];

  onAddPrinting: (item: PrintingCatalogItem) => void;
  onUpdatePrinting: (id: string, patch: Partial<PricingMaterial>) => void;
  onRemovePrinting: (id: string) => void;

  onChangeStandaloneLabor: (next: SubformLabor[]) => void;
  onChangeStandaloneMaterials: (next: SubformMaterial[]) => void;
  onChangeThirdParty: (next: ThirdParty[]) => void;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const GRID = "grid grid-cols-[32px_110px_1fr_90px_60px_110px_110px_36px] items-center gap-2";

type Row =
  | { kind: "print"; ref: PricingMaterial }
  | { kind: "labor"; ref: SubformLabor }
  | { kind: "material"; ref: SubformMaterial }
  | { kind: "service"; ref: ThirdParty };

export function QuoteItemsTable(props: Props) {
  const {
    printingCatalog, markupTiers, globalSettings, hourlyRate,
    printingItems, standaloneLabor, standaloneManualMaterials, thirdParty,
    onAddPrinting, onUpdatePrinting, onRemovePrinting,
    onChangeStandaloneLabor, onChangeStandaloneMaterials, onChangeThirdParty,
  } = props;

  const [searchOpen, setSearchOpen] = useState(false);
  const [stepPickerOpen, setStepPickerOpen] = useState<false | "step" | "group">(false);

  const rows: Row[] = [
    ...printingItems.map((m) => ({ kind: "print", ref: m } as Row)),
    ...standaloneLabor.map((l) => ({ kind: "labor", ref: l } as Row)),
    // legados (não oferecemos mais como criação, mas mantém edição se já existir)
    ...standaloneManualMaterials.map((m) => ({ kind: "material", ref: m } as Row)),
    ...thirdParty.map((t) => ({ kind: "service", ref: t } as Row)),
  ];

  // ---------- Add helpers ----------
  const addEmptyLabor = () => onChangeStandaloneLabor([
    ...standaloneLabor,
    { id: `lab-${Date.now()}`, description: "", timeMinutes: 0, stepType: "outro", parentItemId: null },
  ]);

  const addLaborFromStep = (s: ProductionStep) => {
    onChangeStandaloneLabor([
      ...standaloneLabor,
      {
        id: `lab-${Date.now()}-${s.id}`,
        description: s.description,
        timeMinutes: s.time_minutes,
        stepType: s.step_type || "outro",
        parentItemId: null,
      },
    ]);
    setStepPickerOpen(false);
  };

  const addLaborFromGroup = (g: StepGroup) => {
    const stamp = Date.now();
    onChangeStandaloneLabor([
      ...standaloneLabor,
      ...g.items.map((s, i) => ({
        id: `lab-${stamp}-${i}`,
        description: s.description,
        timeMinutes: s.time_minutes,
        stepType: s.step_type || "outro",
        parentItemId: null,
      })),
    ]);
    setStepPickerOpen(false);
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
    return (
      <div key={m.id} className={`${GRID} px-2 py-1.5 border-b text-sm hover:bg-muted/30`}>
        <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
        <KindBadge kind="print" />
        <div className="min-w-0 flex items-center gap-1.5">
          <ProductKindButton item={m} onChange={(p) => onUpdatePrinting(m.id, p)} />
          <div className="min-w-0 flex-1">
            <div className="font-medium truncate">
              {dynamicTitle || <span className="text-muted-foreground italic">Defina o tipo de produto…</span>}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">{m.description}</div>
          </div>
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
    );
  };

  const renderLabor = (l: SubformLabor, idx: number) => {
    const unit = (l.timeMinutes / 60) * hourlyRate;
    return (
      <div key={l.id} className={`${GRID} px-2 py-1.5 border-b text-sm hover:bg-muted/30`}>
        <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
        <KindBadge kind="labor" />
        <div className="flex gap-1.5 min-w-0">
          <Select value={l.stepType} onValueChange={(v) =>
            onChangeStandaloneLabor(standaloneLabor.map((x) => x.id === l.id ? { ...x, stepType: v } : x))
          }>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STEP_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            value={l.description}
            onChange={(e) =>
              onChangeStandaloneLabor(standaloneLabor.map((x) => x.id === l.id ? { ...x, description: e.target.value } : x))
            }
            placeholder="Descrição do processo"
            className="h-8 text-sm flex-1 min-w-0"
          />
        </div>
        <Input
          type="number"
          value={l.timeMinutes || ""}
          onChange={(e) =>
            onChangeStandaloneLabor(standaloneLabor.map((x) => x.id === l.id ? { ...x, timeMinutes: parseFloat(e.target.value) || 0 } : x))
          }
          className="h-8 text-sm text-right tabular-nums"
          placeholder="0"
        />
        <span className="text-xs text-muted-foreground text-center">min</span>
        <span className="text-right tabular-nums text-muted-foreground">{fmt(unit)}</span>
        <span className="text-right tabular-nums font-medium">{fmt(unit)}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => onChangeStandaloneLabor(standaloneLabor.filter((x) => x.id !== l.id))}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  const renderMaterial = (m: SubformMaterial, idx: number) => {
    const total = (m.quantity || 0) * (m.unitPrice || 0);
    return (
      <div key={m.id} className={`${GRID} px-2 py-1.5 border-b text-sm hover:bg-muted/30`}>
        <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">Material</span>
        <Input
          value={m.description}
          onChange={(e) =>
            onChangeStandaloneMaterials(standaloneManualMaterials.map((x) => x.id === m.id ? { ...x, description: e.target.value } : x))
          }
          placeholder="Material/insumo"
          className="h-8 text-sm"
        />
        <Input
          type="number"
          value={m.quantity || ""}
          onChange={(e) =>
            onChangeStandaloneMaterials(standaloneManualMaterials.map((x) => x.id === m.id ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x))
          }
          className="h-8 text-sm text-right tabular-nums"
        />
        <span className="text-xs text-muted-foreground text-center">un</span>
        <Input
          type="number" step="0.01"
          value={m.unitPrice || ""}
          onChange={(e) =>
            onChangeStandaloneMaterials(standaloneManualMaterials.map((x) => x.id === m.id ? { ...x, unitPrice: parseFloat(e.target.value) || 0 } : x))
          }
          className="h-8 text-sm text-right tabular-nums"
        />
        <span className="text-right tabular-nums font-medium">{fmt(total)}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7"
          onClick={() => onChangeStandaloneMaterials(standaloneManualMaterials.filter((x) => x.id !== m.id))}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  };

  const renderService = (t: ThirdParty, idx: number) => (
    <div key={t.id} className={`${GRID} px-2 py-1.5 border-b text-sm hover:bg-muted/30`}>
      <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">Serviço</span>
      <div className="flex gap-1.5">
        <Input
          value={t.description}
          onChange={(e) =>
            onChangeThirdParty(thirdParty.map((x) => x.id === t.id ? { ...x, description: e.target.value } : x))
          }
          placeholder="Serviço terceirizado"
          className="h-8 text-sm flex-1"
        />
        <Input
          value={t.supplier}
          onChange={(e) =>
            onChangeThirdParty(thirdParty.map((x) => x.id === t.id ? { ...x, supplier: e.target.value } : x))
          }
          placeholder="Fornecedor"
          className="h-8 text-sm w-32"
        />
      </div>
      <span className="text-right tabular-nums text-muted-foreground">1</span>
      <span className="text-xs text-muted-foreground text-center">un</span>
      <Input
        type="number" step="0.01"
        value={t.cost || ""}
        onChange={(e) =>
          onChangeThirdParty(thirdParty.map((x) => x.id === t.id ? { ...x, cost: parseFloat(e.target.value) || 0 } : x))
        }
        className="h-8 text-sm text-right tabular-nums"
      />
      <span className="text-right tabular-nums font-medium">{fmt(t.cost || 0)}</span>
      <Button variant="ghost" size="icon" className="h-7 w-7"
        onClick={() => onChangeThirdParty(thirdParty.filter((x) => x.id !== t.id))}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  return (
    <div className="rounded-lg border bg-card">
      {/* Header */}
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

      {/* Rows */}
      {rows.length === 0 && (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground italic">
          Nenhum item adicionado. Use os botões abaixo para começar.
        </div>
      )}
      {rows.map((r, idx) => {
        if (r.kind === "print") return renderPrint(r.ref, idx);
        if (r.kind === "labor") return renderLabor(r.ref, idx);
        if (r.kind === "material") return renderMaterial(r.ref, idx);
        return renderService(r.ref, idx);
      })}

      {/* Add row */}
      <div className="flex items-center gap-4 px-3 py-2.5 text-sm flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-primary hover:underline inline-flex items-center gap-1.5 font-medium">
              <Plus className="h-4 w-4" /> adicionar item
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setSearchOpen(true)}>
              <Printer className="h-4 w-4 mr-2" /> Impressão
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Wrench className="h-4 w-4 mr-2" /> Acabamento / Processo
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => setStepPickerOpen("step")}>
                  <Wrench className="h-4 w-4 mr-2" /> Etapa individual
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStepPickerOpen("group")}>
                  <Layers className="h-4 w-4 mr-2" /> Grupo de etapas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={addEmptyLabor}>
                  <Plus className="h-4 w-4 mr-2" /> Linha em branco
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={() => setSearchOpen(true)}
          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
        >
          <Search className="h-4 w-4" /> buscar impressão
        </button>
        <button
          onClick={() => setStepPickerOpen("step")}
          className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5"
        >
          <Search className="h-4 w-4" /> buscar etapa/grupo
        </button>

        {/* Print catalog dialog */}
        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] flex flex-col overflow-visible">
            <DialogHeader>
              <DialogTitle>Buscar item de impressão</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-[60vh] overflow-visible">
              <PrintingItemSearch
                items={printingCatalog}
                markupTiers={markupTiers}
                globalSettings={globalSettings}
                onSelect={(it) => { onAddPrinting(it); setSearchOpen(false); }}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Step / Group picker dialog */}
        <StepGroupPickerDialog
          mode={stepPickerOpen}
          onClose={() => setStepPickerOpen(false)}
          onPickStep={addLaborFromStep}
          onPickGroup={addLaborFromGroup}
        />
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: "print" | "labor" }) {
  const map = {
    print: { Icon: Printer, label: "Impressão", cls: "bg-primary/10 text-primary" },
    labor: { Icon: Wrench, label: "Acabamento", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
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

function StepGroupPickerDialog({
  mode, onClose, onPickStep, onPickGroup,
}: {
  mode: false | "step" | "group";
  onClose: () => void;
  onPickStep: (s: ProductionStep) => void;
  onPickGroup: (g: StepGroup) => void;
}) {
  const [tab, setTab] = useState<"step" | "group">("step");
  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [groups, setGroups] = useState<StepGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!mode) return;
    setTab(mode);
    setLoading(true);
    (async () => {
      const [stepsRes, groupsRes, itemsRes] = await Promise.all([
        supabase.from("production_steps").select("id, description, time_minutes, step_type").order("description"),
        supabase.from("step_groups").select("id, name").order("name"),
        supabase.from("step_group_items").select("id, description, time_minutes, step_type, step_group_id").order("sort_order"),
      ]);
      setSteps((stepsRes.data || []) as ProductionStep[]);
      const itemsByGroup = new Map<string, ProductionStep[]>();
      (itemsRes.data || []).forEach((it: any) => {
        const arr = itemsByGroup.get(it.step_group_id) || [];
        arr.push({ id: it.id, description: it.description, time_minutes: it.time_minutes, step_type: it.step_type });
        itemsByGroup.set(it.step_group_id, arr);
      });
      setGroups((groupsRes.data || []).map((g: any) => ({
        id: g.id, name: g.name, items: itemsByGroup.get(g.id) || [],
      })));
      setLoading(false);
    })();
  }, [mode]);

  const filteredSteps = steps.filter((s) => s.description.toLowerCase().includes(q.toLowerCase()));
  const filteredGroups = groups.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Buscar etapa ou grupo</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 border-b -mt-2">
          {(["step", "group"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                tab === k ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
              }`}
            >
              {k === "step" ? "Etapas individuais" : "Grupos de etapas"}
            </button>
          ))}
        </div>

        <Input
          placeholder="Filtrar por nome…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mt-2"
        />

        <div className="flex-1 overflow-auto rounded-md border mt-2">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : tab === "step" ? (
            filteredSteps.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma etapa cadastrada. Cadastre em <strong>Processos de Produção</strong>.
              </div>
            ) : (
              <div className="divide-y">
                {filteredSteps.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onPickStep(s)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                  >
                    <StepTypeBadge type={s.step_type} />
                    <span className="flex-1 truncate text-sm">{s.description}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{s.time_minutes} min</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            filteredGroups.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum grupo cadastrado. Cadastre em <strong>Processos de Produção → Grupos</strong>.
              </div>
            ) : (
              <div className="divide-y">
                {filteredGroups.map((g) => {
                  const totalMin = g.items.reduce((s, x) => s + x.time_minutes, 0);
                  return (
                    <button
                      key={g.id}
                      onClick={() => onPickGroup(g)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                    >
                      <Layers className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{g.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {g.items.length} etapa(s): {g.items.map((i) => i.description).join(", ")}
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">{totalMin} min</Badge>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
