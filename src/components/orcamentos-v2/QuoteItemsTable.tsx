import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, X, Printer, Wrench, Package, Truck, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import PrintingItemSearch, {
  type PrintingCatalogItem, type MarkupTier,
} from "@/components/orcamentos/PrintingItemSearch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { STEP_TYPES } from "./StepTypeBadge";
import type { PricingMaterial } from "@/lib/quotes-v2/pricing";
import type { SubformLabor, SubformMaterial } from "./LaborAndSupplySubform";

type ThirdParty = { id: string; description: string; supplier: string; cost: number };

interface Props {
  // dados de catálogo
  printingCatalog: PrintingCatalogItem[];
  markupTiers: MarkupTier[];
  globalSettings: { invoice_pct: number; collection_pct: number; waste_pct: number; default_margin_pct: number };
  hourlyRate: number;

  // estado atual (já existente no form pai)
  printingItems: PricingMaterial[];                 // materials com baseCost & sem pai
  standaloneLabor: SubformLabor[];                  // labor sem pai
  standaloneManualMaterials: SubformMaterial[];     // materials sem baseCost & sem pai
  thirdParty: ThirdParty[];

  // handlers
  onAddPrinting: (item: PrintingCatalogItem) => void;
  onUpdatePrinting: (id: string, patch: Partial<PricingMaterial>) => void;
  onRemovePrinting: (id: string) => void;

  onChangeStandaloneLabor: (next: SubformLabor[]) => void;
  onChangeStandaloneMaterials: (next: SubformMaterial[]) => void;
  onChangeThirdParty: (next: ThirdParty[]) => void;
}

const fmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

  // Monta lista linear (ordem visual idêntica ao Tiny)
  const rows: Row[] = [
    ...printingItems.map((m) => ({ kind: "print", ref: m } as Row)),
    ...standaloneLabor.map((l) => ({ kind: "labor", ref: l } as Row)),
    ...standaloneManualMaterials.map((m) => ({ kind: "material", ref: m } as Row)),
    ...thirdParty.map((t) => ({ kind: "service", ref: t } as Row)),
  ];

  // ---------- Add helpers ----------
  const addLabor = () => onChangeStandaloneLabor([
    ...standaloneLabor,
    { id: `lab-${Date.now()}`, description: "", timeMinutes: 0, stepType: "outro", parentItemId: null },
  ]);
  const addMaterial = () => onChangeStandaloneMaterials([
    ...standaloneManualMaterials,
    { id: `mat-${Date.now()}`, description: "", quantity: 1, unitPrice: 0, parentItemId: null },
  ]);
  const addService = () => onChangeThirdParty([
    ...thirdParty,
    { id: `svc-${Date.now()}`, description: "", supplier: "", cost: 0 },
  ]);

  // ---------- Row renderers ----------
  const renderPrint = (m: PricingMaterial, idx: number) => {
    const total = (m.quantity || 0) * (m.unitPrice || 0);
    return (
      <div key={m.id} className="grid grid-cols-[32px_110px_1fr_90px_60px_110px_110px_36px] items-center gap-2 px-2 py-1.5 border-b text-sm hover:bg-muted/30">
        <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
        <KindBadge kind="print" />
        <Input
          value={m.description}
          onChange={(e) => onUpdatePrinting(m.id, { description: e.target.value })}
          className="h-8 text-sm"
        />
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
      <div key={l.id} className="grid grid-cols-[32px_110px_1fr_90px_60px_110px_110px_36px] items-center gap-2 px-2 py-1.5 border-b text-sm hover:bg-muted/30">
        <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
        <KindBadge kind="labor" />
        <div className="flex gap-1.5">
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
            placeholder="Descrição do acabamento"
            className="h-8 text-sm flex-1"
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
      <div key={m.id} className="grid grid-cols-[32px_110px_1fr_90px_60px_110px_110px_36px] items-center gap-2 px-2 py-1.5 border-b text-sm hover:bg-muted/30">
        <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
        <KindBadge kind="material" />
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
    <div key={t.id} className="grid grid-cols-[32px_110px_1fr_90px_60px_110px_110px_36px] items-center gap-2 px-2 py-1.5 border-b text-sm hover:bg-muted/30">
      <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
      <KindBadge kind="service" />
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
      <div className="grid grid-cols-[32px_110px_1fr_90px_60px_110px_110px_36px] items-center gap-2 px-2 py-2 border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
      <div className="flex items-center gap-4 px-3 py-2.5 text-sm">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="text-primary hover:underline inline-flex items-center gap-1.5 font-medium">
              <Plus className="h-4 w-4" /> adicionar item
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setSearchOpen(true)}>
              <Printer className="h-4 w-4 mr-2" /> Impressão (buscar catálogo)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={addLabor}>
              <Wrench className="h-4 w-4 mr-2" /> Acabamento (mão de obra)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={addMaterial}>
              <Package className="h-4 w-4 mr-2" /> Material / Insumo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={addService}>
              <Truck className="h-4 w-4 mr-2" /> Serviço terceirizado
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogTrigger asChild>
            <button className="text-primary hover:underline inline-flex items-center gap-1.5">
              <Search className="h-4 w-4" /> busca avançada de itens
            </button>
          </DialogTrigger>
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
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: "print" | "labor" | "material" | "service" }) {
  const map = {
    print:    { Icon: Printer, label: "Impressão", cls: "bg-primary/10 text-primary" },
    labor:    { Icon: Wrench,  label: "Acabamento", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    material: { Icon: Package, label: "Material",  cls: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
    service:  { Icon: Truck,   label: "Serviço",   cls: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  } as const;
  const { Icon, label, cls } = map[kind];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}
