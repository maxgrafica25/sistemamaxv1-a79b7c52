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
import { Check, Plus, BookOpen, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import PrintingItemSearch, {
  type PrintingCatalogItem,
} from "@/components/orcamentos/PrintingItemSearch";
import { useV3Catalog, pricePerSheet } from "../shared/useV3Catalog";
import { fmtBRL, roundUp10 } from "../shared/pricing";
import { TierSimulator } from "../shared/TierSimulator";
import { getIdealSpiral } from "@/lib/quotes-v2/spiral-selector";
import { genId, type V3BookletItem, type V3Item } from "../types";
import { ProductKitPanel } from "./ProductKitPanel";

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
  const totalMioloCusto = pricing ? pricing.baseCost * physicalSheets * (sideMult === 2 && catalog?.side !== "F/V" ? 2 : 1) : 0;

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

  const applyKitItems = (kitItems: V3Item[]) => {
    if (!onAddMany) return;
    const miolo = buildBookletItem();
    const list: V3Item[] = miolo ? [miolo, ...kitItems] : [...kitItems];
    onAddMany(list);
    if (miolo) setDescricao("");
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
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              value={bookletUnits || ""}
              onChange={(e) => setBookletUnits(Math.max(0, Number(e.target.value) || 0))}
              className="h-9"
            />
            <TierSimulator
              currentQty={bookletUnits}
              disabled={!catalog || bookletPages <= 0}
              compute={(units) => {
                const sheets = Math.max(0, Math.floor(bookletPages) * Math.floor(units));
                if (!catalog || sheets <= 0) return { custo_total: 0, preco_total: 0 };
                const pr = pricePerSheet(catalog, tiers, sheets);
                const mult = catalog.side === "F/V" ? 1 : duplex ? 2 : 1;
                return {
                  custo_total: pr.baseCost * sheets * mult,
                  preco_total: roundUp10(pr.sellingPrice * sheets * mult),
                };
              }}
              onPickQty={(q) => setBookletUnits(q)}
              onCloneAsTiers={
                onAddTiers
                  ? (qtys) => {
                      const tg = `tg_${genId()}`;
                      const items = qtys
                        .map((q) => buildBookletItem(q, tg))
                        .filter((x): x is V3BookletItem => !!x);
                      if (items.length === 0) return;
                      onAddTiers(items);
                      setDescricao("");
                      setPulse(true);
                      setTimeout(() => setPulse(false), 600);
                    }
                  : undefined
              }
            />
          </div>
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
        <div className="rounded-md border border-border/60 bg-background px-3 py-2.5 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Folhas físicas (miolo)</span>
            <span className="font-medium tabular-nums">{physicalSheets}</span>
          </div>
          {spiralDiameter && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" /> Espiral sugerida ({bookletPages} folhas)
              </span>
              <span className="font-medium tabular-nums">{spiralDiameter}</span>
            </div>
          )}
          {pricing && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Custo do miolo</span>
                <span className="tabular-nums text-muted-foreground">
                  {fmtBRL(totalMioloCusto)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Total miolo</span>
                <span className="font-semibold text-primary tabular-nums">
                  {fmtBRL(totalMioloPreco)}
                </span>
              </div>
            </>
          )}
          <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/40 mt-1">
            Este valor cobre apenas o <strong>miolo impresso</strong>. Use o Kit Encadernação abaixo para adicionar capas, espiral e mão-de-obra automaticamente.
          </p>
        </div>
      )}

      {onAddMany && canAdd && bookletPages > 0 && bookletUnits > 0 && (
        <ProductKitPanel
          productKind="apostila"
          units={Math.floor(bookletUnits)}
          sheets={Math.floor(bookletPages)}
          defaultMarginPct={defaultMarginPct}
          onApply={applyKitItems}
        />
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
