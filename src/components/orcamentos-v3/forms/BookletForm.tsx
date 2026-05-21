// Apostila V3 — versão simplificada com paridade de cálculo de miolo ao Print.
// Encadernação (Kit Espiral/Wire-O/Grampo) é tratada como acabamento agregado
// (mão-de-obra avulsa) — pode ser adicionada via aba "Mão-de-obra" enquanto a
// integração total com spiral-selector é portada em fase posterior.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, Plus, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import PrintingItemSearch, {
  type PrintingCatalogItem,
} from "@/components/orcamentos/PrintingItemSearch";
import { useV3Catalog, pricePerSheet } from "../shared/useV3Catalog";
import { roundUp10 } from "../shared/pricing";
import { TierFaixasPanel } from "../shared/TierFaixasPanel";
import { getIdealSpiral } from "@/lib/quotes-v2/spiral-selector";
import { genId, type V3BookletItem, type V3Item } from "../types";
import { ProductKitPanel } from "./ProductKitPanel";
import { BookletKitPanel, type BookletKitApplyMeta } from "./BookletKitPanel";
import { buildBookletBundleLabel } from "../shared/buildBookletBundleLabel";

interface Props {
  onAdd: (item: V3BookletItem) => void;
  /** Quando definido, "Adicionar apostila + Kit" empurra todos os itens de uma vez. */
  onAddMany?: (items: V3Item[]) => void;
  onAddTiers?: (items: V3BookletItem[]) => void;
  defaultMarginPct?: number;
}

export function BookletForm({ onAdd, onAddMany, onAddTiers, defaultMarginPct = 20 }: Props) {
  const { loading, items, tiers } = useV3Catalog();
  const [catalog, setCatalog] = useState<PrintingCatalogItem | null>(null);
  const [descricao, setDescricao] = useState("");
  const [bookletPages, setBookletPages] = useState<number>(20);
  const [bookletUnits, setBookletUnits] = useState<number>(10);
  const [duplex, setDuplex] = useState<boolean>(true);
  const [pulse, setPulse] = useState(false);

  // Folhas físicas = páginas-folha por apostila × nº apostilas.
  // (Se F/V, cada folha = 2 lados; o miolo é cobrado por folha física impressa.)
  const physicalSheets = Math.max(
    0,
    Math.floor(bookletPages || 0) * Math.floor(bookletUnits || 0),
  );

  const pricing = useMemo(
    () => (catalog ? pricePerSheet(catalog, tiers, physicalSheets || 1) : null),
    [catalog, tiers, physicalSheets],
  );

  // Custo total do miolo: aplica multiplicador F/V quando o catálogo é "Só frente".
  const sideMult = !catalog
    ? 1
    : catalog.side === "F/V"
      ? 1
      : duplex
        ? 2
        : 1;

  const totalMioloPreco = pricing ? pricing.sellingPrice * physicalSheets * (sideMult === 2 && catalog?.side !== "F/V" ? 2 : 1) : 0;

  const spiralDiameter = bookletPages > 0 ? getIdealSpiral(bookletPages) : null;

  const canAdd = !!catalog && bookletPages > 0 && bookletUnits > 0 && totalMioloPreco > 0;

  const buildBookletItem = (
    unitsOverride?: number,
    tierGroupId?: string,
  ): V3BookletItem | null => {
    if (!canAdd || !catalog) return null;
    const units = Math.floor(unitsOverride ?? bookletUnits);
    if (units <= 0) return null;
    const sheets = Math.max(1, Math.floor(bookletPages) * units);
    const pr = pricePerSheet(catalog, tiers, sheets);
    const label =
      descricao.trim() ||
      `Apostila ${units}× ${bookletPages}fl ${catalog.paper_type}${catalog.grammage ? ` ${catalog.grammage}` : ""}`;
    return {
      id: genId(),
      kind: "booklet",
      descricao: label,
      tier_group_id: tierGroupId ?? null,
      catalog_item_id: catalog.id,
      paper_type: catalog.paper_type,
      grammage: catalog.grammage,
      size: catalog.size,
      side: catalog.side,
      printer_category_id: catalog.printer_category_id,
      markup_group_id: catalog.markup_group_id,
      valor_unitario: pr.sellingPrice,
      custo_unitario: pr.baseCost,
      bookletPages: Math.floor(bookletPages),
      bookletUnits: units,
      bookletDuplex: duplex,
    };
  };

  const submit = () => {
    const item = buildBookletItem();
    if (!item) return;
    onAdd(item);
    setDescricao("");
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  const applyKitItems = (kitItems: V3Item[], meta?: BookletKitApplyMeta) => {
    if (!onAddMany) return;
    const miolo = buildBookletItem();
    if (!miolo) {
      onAddMany(kitItems);
      return;
    }
    const bundleId = `bdl_${genId()}`;
    const bundleLabel = meta
      ? buildBookletBundleLabel({
          miolo,
          kitItems,
          coverMode: meta.coverMode,
          backCoverMode: meta.backCoverMode,
          customCoverDescr: meta.customCoverDescr,
          customBackCoverDescr: meta.customBackCoverDescr,
          spiralDiameter: meta.spiralDiameter,
        })
      : miolo.descricao;
    const leader: V3Item = { ...miolo, bundle_id: bundleId, bundle_label: bundleLabel };
    const tagged: V3Item[] = kitItems.map((it) => ({ ...it, bundle_id: bundleId } as V3Item));
    onAddMany([leader, ...tagged]);
    setDescricao("");
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5">
      <Field label="Miolo (papel do catálogo)">
        <PrintingItemSearch
          items={items}
          markupTiers={tiers}
          globalSettings={{
            invoice_pct: 0,
            collection_pct: 0,
            waste_pct: 0,
            default_margin_pct: 20,
          }}
          onSelect={(it) => setCatalog(it)}
        />

        {loading && (
          <p className="text-[11px] text-muted-foreground mt-1">Carregando catálogo…</p>
        )}
      </Field>

      {catalog && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 flex items-center gap-3">
          <BookOpen className="h-4 w-4 text-primary shrink-0" />
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
          <button
            type="button"
            onClick={() => setCatalog(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            trocar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Folhas por apostila">
          <Input
            type="number"
            min={1}
            value={bookletPages || ""}
            onChange={(e) => setBookletPages(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
        <Field label="Qtde de apostilas">
          <Input
            type="number"
            min={1}
            value={bookletUnits || ""}
            onChange={(e) => setBookletUnits(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Impressão Frente/Verso
          </Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {duplex
              ? "Cada folha conta como 2 impressões."
              : "Cada folha conta como 1 impressão."}
          </p>
        </div>
        <Switch
          checked={duplex}
          onCheckedChange={(v) => setDuplex(!!v)}
          disabled={catalog?.side === "F/V"}
        />
      </div>

      {physicalSheets > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10.5px] text-foreground/80">
            📄 {physicalSheets} folhas físicas
          </span>
          {spiralDiameter && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10.5px] text-foreground/80">
              🌀 Espiral sugerida: {spiralDiameter}
            </span>
          )}
          {(duplex || catalog?.side === "F/V") && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10.5px] text-foreground/80">
              F/V ativo
            </span>
          )}
        </div>
      )}

      {onAddMany && canAdd && bookletPages > 0 && bookletUnits > 0 && (
        <>
          <BookletKitPanel
            bookletPages={Math.floor(bookletPages)}
            bookletUnits={Math.floor(bookletUnits)}
            defaultMarginPct={defaultMarginPct}
            onApply={applyKitItems}
          />
          <ProductKitPanel
            productKind="apostila"
            units={Math.floor(bookletUnits)}
            sheets={Math.floor(bookletPages)}
            defaultMarginPct={defaultMarginPct}
            onApply={applyKitItems}
          />
        </>
      )}

      <Field label="Descrição (opcional)">
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={
            catalog
              ? `Padrão: Apostila ${bookletUnits}× ${bookletPages}fl ${catalog.paper_type}`
              : "Selecione o miolo primeiro"
          }
          className="h-9"
        />
      </Field>

      <div className="flex items-center justify-end pt-2">
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
              <Plus className="h-4 w-4 mr-2" /> Adicionar apostila
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
