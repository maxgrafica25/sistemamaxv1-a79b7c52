// Wrapper da aba "Impressão + Acabamentos".
// Toggle Personalizado | Produto. Em modo Produto, mostra chips de presets
// que roteiam para o sub-formulário certo (PrintForm/BookletForm/LabelForm).
// Em modo Personalizado, mostra sugestão inteligente quando a combinação
// de papel + acabamentos casa com um produto conhecido (ex: lona + ilhós).
import { useCallback, useState } from "react";
import { Wand2, Pencil, Sparkles, X } from "lucide-react";
import { ModeButton } from "../shared/ModeButton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PrintForm } from "./PrintForm";
import { BookletForm } from "./BookletForm";
import { LabelEmbeddedForm } from "./LabelEmbeddedForm";
import {
  PRODUCT_PRESETS,
  PRESET_BY_ID,
  type ProductPresetId,
} from "../shared/productPresets";
import { suggestProduct, type SuggestResult } from "../shared/productSuggester";
import type { V3Item } from "../types";

interface Props {
  onAdd: (item: V3Item) => void;
  onAddMany?: (items: V3Item[]) => void;
  onAddTiers?: (items: V3Item[]) => void;
  defaultMarginPct?: number;
}

type Mode = "custom" | "product";

export function PrintAndProductForm({ onAdd, onAddMany, onAddTiers, defaultMarginPct = 20 }: Props) {
  const [mode, setMode] = useState<Mode>("product");
  const [product, setProduct] = useState<ProductPresetId>("folheto");
  const [suggestion, setSuggestion] = useState<SuggestResult | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string>("");

  const preset = PRESET_BY_ID[product] ?? PRODUCT_PRESETS[0];

  const handleSelectionChange = useCallback(
    (sel: {
      paper_type: string | null;
      size: string | null;
      grammage: string | null;
      finishings: string[];
    }) => {
      const s = suggestProduct(sel);
      if (!s) {
        setSuggestion(null);
        return;
      }
      const key = `${s.productId}|${sel.paper_type}|${sel.finishings.join(",")}`;
      if (key === dismissedKey) {
        setSuggestion(null);
        return;
      }
      setSuggestion(s);
    },
    [dismissedKey],
  );

  const applySuggestion = () => {
    if (!suggestion) return;
    setMode("product");
    setProduct(suggestion.productId);
    setSuggestion(null);
  };

  return (
    <div className="space-y-5">
      {/* Toggle Produtos / Personalizado */}
      <div className="inline-flex rounded-md border border-border bg-muted/40 p-1">
        <ModeButton
          active={mode === "product"}
          onClick={() => setMode("product")}
          icon={Wand2}
          label="Produtos"
        />
        <ModeButton
          active={mode === "custom"}
          onClick={() => setMode("custom")}
          icon={Pencil}
          label="Personalizado"
        />
      </div>


      {/* Chips de produto */}
      {mode === "product" && (
        <div className="flex flex-wrap gap-2">
          {PRODUCT_PRESETS.map((p) => {
            const Icon = p.icon;
            const active = p.id === product;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setProduct(p.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Faixa de sugestão (apenas em Personalizado) */}
      {mode === "custom" && suggestion && (
        <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-medium text-foreground">
              Parece um <strong>{PRESET_BY_ID[suggestion.productId].label}</strong> —
              aplicar preset?
            </p>
            <p className="text-muted-foreground">{suggestion.reason}</p>
          </div>
          <Button size="sm" variant="default" className="h-7 text-xs" onClick={applySuggestion}>
            Aplicar
          </Button>
          <button
            type="button"
            aria-label="Dispensar sugestão"
            onClick={() => {
              setDismissedKey(`${suggestion.productId}|||`);
              setSuggestion(null);
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sub-formulário */}
      <div>
        {mode === "custom" && (
          <PrintForm onAdd={onAdd} onAddTiers={onAddTiers} onSelectionChange={handleSelectionChange} />
        )}
        {mode === "product" && preset.form === "print" && (
          <PrintForm onAdd={onAdd} onAddTiers={onAddTiers} />
        )}
        {mode === "product" && preset.form === "booklet" && (
          <BookletForm
            onAdd={onAdd}
            onAddMany={onAddMany}
            onAddTiers={onAddTiers}
            defaultMarginPct={defaultMarginPct}
          />
        )}
        {mode === "product" && preset.form === "label" && (
          <LabelEmbeddedForm onAdd={onAdd} onAddTiers={onAddTiers} />
        )}
      </div>
    </div>
  );
}

