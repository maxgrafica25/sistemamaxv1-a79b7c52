import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Plus, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import PrintingItemSearch, {
  type PrintingCatalogItem,
} from "@/components/orcamentos/PrintingItemSearch";
import { FinishingProgressive, type FinishingDef } from "../shared/FinishingProgressive";
import { useV3Catalog, pricePerSheet } from "../shared/useV3Catalog";
import { fmtBRL } from "../shared/pricing";
import { genId, type V3PrintItem } from "../types";

interface Props {
  onAdd: (item: V3PrintItem) => void;
}

const FINISHES: FinishingDef[] = [
  { id: "laminacao", label: "Laminação", hint: "BOPP brilho ou fosco" },
  { id: "verniz", label: "Verniz UV", hint: "Localizado ou total" },
  { id: "vinco", label: "Vinco" },
  { id: "corte_especial", label: "Corte especial" },
  { id: "wire_o", label: "Wire-O / Espiral" },
];

export function PrintForm({ onAdd }: Props) {
  const { loading, items, tiers, settings } = useV3Catalog();
  const [catalog, setCatalog] = useState<PrintingCatalogItem | null>(null);
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState(100);
  const [finEnabled, setFinEnabled] = useState<Record<string, boolean>>({});
  const [pulse, setPulse] = useState(false);

  const pricing = useMemo(
    () => (catalog ? pricePerSheet(catalog, tiers, quantidade) : null),
    [catalog, tiers, quantidade],
  );

  const canAdd = !!catalog && quantidade > 0 && (pricing?.sellingPrice ?? 0) > 0;

  const submit = () => {
    if (!canAdd || !catalog || !pricing) return;
    const label =
      descricao.trim() ||
      `${catalog.paper_type}${catalog.grammage ? ` ${catalog.grammage}` : ""} — ${catalog.size} ${catalog.side}`;
    onAdd({
      id: genId(),
      kind: "print",
      descricao: label,
      quantidade,
      catalog_item_id: catalog.id,
      paper_type: catalog.paper_type,
      grammage: catalog.grammage,
      size: catalog.size,
      side: catalog.side,
      printer_category_id: catalog.printer_category_id,
      markup_group_id: catalog.markup_group_id,
      valor_unitario: pricing.sellingPrice,
      custo_unitario: pricing.baseCost,
      formato: null,
      cores: null,
      face: catalog.side === "F/V" ? "fv" : "frente",
      finishings: Object.keys(finEnabled).filter((k) => finEnabled[k]),
    });
    setDescricao("");
    setFinEnabled({});
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5">
      <Field label="Item do catálogo">
        <PrintingItemSearch
          items={items}
          markupTiers={tiers}
          globalSettings={settings}
          onSelect={(it) => setCatalog(it)}
        />
        {loading && (
          <p className="text-[11px] text-muted-foreground mt-1">Carregando catálogo…</p>
        )}
      </Field>

      {catalog && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 flex items-center gap-3">
          <Printer className="h-4 w-4 text-primary shrink-0" />
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
        <Field label="Quantidade (folhas)">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))}
            className="h-9"
          />
        </Field>
        <Field label="Preço unitário">
          <div className="h-9 px-3 rounded-md border border-border bg-muted/40 flex items-center justify-between">
            <span className="text-sm font-semibold text-primary tabular-nums">
              {pricing ? fmtBRL(pricing.sellingPrice) : "—"}
            </span>
            {pricing && pricing.sellingPrice !== pricing.baseCost && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                custo {fmtBRL(pricing.baseCost)}
              </span>
            )}
          </div>
        </Field>
      </div>

      <Field label="Descrição (opcional)">
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={
            catalog
              ? `Padrão: ${catalog.paper_type}${catalog.grammage ? ` ${catalog.grammage}` : ""} — ${catalog.size} ${catalog.side}`
              : "Selecione o item primeiro"
          }
          className="h-9"
        />
      </Field>

      <Field label="Acabamentos">
        <FinishingProgressive
          items={FINISHES}
          enabled={finEnabled}
          onToggle={(id, on) => setFinEnabled((m) => ({ ...m, [id]: on }))}
        />
      </Field>

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-muted-foreground">
          {pricing && (
            <span>
              Total:{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {fmtBRL(pricing.sellingPrice * quantidade)}
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
