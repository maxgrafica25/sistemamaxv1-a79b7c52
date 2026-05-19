// Wrapper da aba "Impressão + Acabamentos".
// Toggle Personalizado | Produto. Em modo Produto, mostra chips de presets
// que roteiam para o sub-formulário certo (PrintForm/BookletForm/LabelForm).
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Wand2, Pencil } from "lucide-react";
import { PrintForm } from "./PrintForm";
import { BookletForm } from "./BookletForm";
import { LabelEmbeddedForm } from "./LabelEmbeddedForm";
import { PRODUCT_PRESETS, type ProductPresetId } from "../shared/productPresets";
import type { V3Item } from "../types";

interface Props {
  onAdd: (item: V3Item) => void;
}

type Mode = "custom" | "product";

export function PrintAndProductForm({ onAdd }: Props) {
  const [mode, setMode] = useState<Mode>("custom");
  const [product, setProduct] = useState<ProductPresetId>("folheto");

  const preset = PRODUCT_PRESETS.find((p) => p.id === product) ?? PRODUCT_PRESETS[0];

  return (
    <div className="space-y-5">
      {/* Toggle Personalizado / Produto */}
      <div className="inline-flex rounded-md border border-border bg-muted/40 p-1">
        <ModeButton
          active={mode === "custom"}
          onClick={() => setMode("custom")}
          icon={Pencil}
          label="Personalizado"
        />
        <ModeButton
          active={mode === "product"}
          onClick={() => setMode("product")}
          icon={Wand2}
          label="Produto"
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

      {/* Sub-formulário */}
      <div>
        {mode === "custom" && <PrintForm onAdd={onAdd} />}
        {mode === "product" && preset.form === "print" && <PrintForm onAdd={onAdd} />}
        {mode === "product" && preset.form === "booklet" && <BookletForm onAdd={onAdd} />}
        {mode === "product" && preset.form === "label" && <LabelEmbeddedForm onAdd={onAdd} />}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Wand2;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
