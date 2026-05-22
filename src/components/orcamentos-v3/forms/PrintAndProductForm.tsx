// Wrapper da aba "Impressão + Acabamentos".
// Toggle Personalizado | Produto. Em modo Produto, mostra chips de presets
// que roteiam para o sub-formulário certo (PrintForm/BookletForm/LabelForm).
// Em modo Personalizado, mostra sugestão inteligente quando a combinação
// de papel + acabamentos casa com um produto conhecido (ex: lona + ilhós).
import { useCallback, useEffect, useState } from "react";
import { Wand2, Pencil, Sparkles, X } from "lucide-react";
import { ModeButton } from "../shared/ModeButton";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrintForm } from "./PrintForm";
import { BookletForm } from "./BookletForm";
import { LabelEmbeddedForm } from "./LabelEmbeddedForm";
import { useQuotePresets, type QuotePreset } from "../shared/useQuotePresets";
import { iconFor } from "../shared/presetIcons";
import {
  PRESET_BY_ID,
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
  const { presets } = useQuotePresets("impressao");
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState("");
  const [suggestion, setSuggestion] = useState<SuggestResult | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string>("");

  // Seleciona o primeiro preset assim que carregam
  useEffect(() => {
    if (!selectedPresetId && presets.length > 0) {
      setSelectedPresetId(presets[0].id);
    }
  }, [presets, selectedPresetId]);

  const selectedPreset: QuotePreset | undefined =
    presets.find((p) => p.id === selectedPresetId) ?? presets[0];
  const formTipo: "print" | "booklet" | "label" = selectedPreset?.form_tipo ?? "print";

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
    const label = PRESET_BY_ID[suggestion.productId]?.label?.toLowerCase();
    const match = label
      ? presets.find((p) => p.nome.toLowerCase().includes(label) || label.includes(p.nome.toLowerCase()))
      : undefined;
    if (match) setSelectedPresetId(match.id);
    setSuggestion(null);
  };

  return (
    <div className="space-y-5">
      {/* Descrição (opcional) — acima do toggle */}
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Descrição (opcional)
        </Label>
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Opcional — ex: nome do produto ou observação"
          className="h-9"
        />
      </div>

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
      {mode === "product" && presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => {
            const Icon = iconFor(p.icone);
            const active = p.id === selectedPresetId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPresetId(p.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {p.nome}
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
              Parece um <strong>{PRESET_BY_ID[suggestion.productId]?.label}</strong> —
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
        {mode === "product" && formTipo === "print" && (
          <PrintForm onAdd={onAdd} onAddTiers={onAddTiers} />
        )}
        {mode === "product" && formTipo === "booklet" && (
          <BookletForm
            onAdd={onAdd}
            onAddMany={onAddMany}
            onAddTiers={onAddTiers}
            defaultMarginPct={defaultMarginPct}
          />
        )}
        {mode === "product" && formTipo === "label" && (
          <LabelEmbeddedForm onAdd={onAdd} onAddTiers={onAddTiers} />
        )}
      </div>
    </div>
  );
}

