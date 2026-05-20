import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SupplySearch from "@/components/orcamentos-v2/SupplySearch";
import { SPIRAL_VARIANT_PRESET } from "@/components/orcamentos-v3/shared/productKit";

export interface VariantRow {
  tmp_id: string;
  min_value: number;
  max_value: number | null;
  supply_id: string | null;
  supply_label: string;
  label: string;
}

const tmp = () => `tmp_${Math.random().toString(36).slice(2, 9)}`;

export default function VariantsDialog({
  open,
  onOpenChange,
  variants,
  onChange,
  itemLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  variants: VariantRow[];
  onChange: (next: VariantRow[]) => void;
  itemLabel?: string;
}) {
  const addRow = () => {
    const last = variants[variants.length - 1];
    const nextMin = last
      ? last.max_value == null
        ? (last.min_value || 0) + 1
        : last.max_value + 1
      : 1;
    onChange([
      ...variants,
      {
        tmp_id: tmp(),
        min_value: nextMin,
        max_value: null,
        supply_id: null,
        supply_label: "",
        label: "",
      },
    ]);
  };
  const update = (id: string, patch: Partial<VariantRow>) =>
    onChange(variants.map((v) => (v.tmp_id === id ? { ...v, ...patch } : v)));
  const remove = (id: string) => onChange(variants.filter((v) => v.tmp_id !== id));
  const loadSpiralPreset = () => {
    onChange(
      SPIRAL_VARIANT_PRESET.map((p) => ({
        tmp_id: tmp(),
        min_value: p.min,
        max_value: p.max,
        supply_id: null,
        supply_label: "",
        label: p.label,
      })),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Faixas por nº de folhas {itemLabel ? `— ${itemLabel}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Defina qual suprimento usar para cada faixa de quantidade de folhas.
          </p>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={loadSpiralPreset}>
              Preset espirais
            </Button>
            <Button size="sm" variant="outline" onClick={addRow}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Faixa
            </Button>
          </div>
        </div>

        {variants.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-6 text-center">
            Adicione faixas (ex.: 1–25 folhas → Espiral 7mm).
          </p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[70px_70px_1fr_90px_28px] gap-1.5 text-[10px] uppercase text-muted-foreground tracking-wide px-1">
              <span>Min</span>
              <span>Max</span>
              <span>Suprimento</span>
              <span>Rótulo</span>
              <span />
            </div>
            {variants.map((v) => (
              <div
                key={v.tmp_id}
                className="grid grid-cols-[70px_70px_1fr_90px_28px] gap-1.5 items-center"
              >
                <Input
                  type="number"
                  min={0}
                  className="h-8 text-xs"
                  value={v.min_value}
                  onChange={(e) =>
                    update(v.tmp_id, { min_value: Number(e.target.value) || 0 })
                  }
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="∞"
                  className="h-8 text-xs"
                  value={v.max_value ?? ""}
                  onChange={(e) =>
                    update(v.tmp_id, {
                      max_value: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
                <SupplySearch
                  initialLabel={v.supply_label}
                  onSelect={(s) =>
                    update(v.tmp_id, { supply_id: s.id, supply_label: s.produto })
                  }
                />
                <Input
                  className="h-8 text-xs"
                  value={v.label}
                  placeholder="ex.: 7mm"
                  onChange={(e) => update(v.tmp_id, { label: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => remove(v.tmp_id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
