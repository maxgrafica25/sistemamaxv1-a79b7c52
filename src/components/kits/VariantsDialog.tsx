import { useEffect, useState } from "react";
import { Plus, Trash2, Info, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SupplySearch from "@/components/orcamentos-v3/listing/SupplySearch";
import { SPIRAL_VARIANT_PRESET } from "@/components/orcamentos-v3/shared/productKit";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface VariantRow {
  tmp_id: string;
  min_value: number;
  max_value: number | null;
  supply_id: string | null;
  supply_label: string;
  label: string;
}

const tmp = () => `tmp_${Math.random().toString(36).slice(2, 9)}`;

interface KitOption {
  kit_id: string;
  kit_name: string;
  item_id: string;
  variants: Array<{
    min_value: number;
    max_value: number | null;
    supply_id: string | null;
    supply_label: string;
    label: string | null;
  }>;
}

export default function VariantsDialog({
  open,
  onOpenChange,
  variants,
  onChange,
  itemLabel,
  currentItemId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  variants: VariantRow[];
  onChange: (next: VariantRow[]) => void;
  itemLabel?: string;
  currentItemId?: string;
}) {
  const [copyOpen, setCopyOpen] = useState(false);
  const [kitOptions, setKitOptions] = useState<KitOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const loadCopyOptions = async () => {
    setLoadingOptions(true);
    try {
      const { data: itemRows } = await supabase
        .from("product_kit_items")
        .select("id, kit_id, product_kits!inner(name)")
        .eq("quantity_formula", "variant_by_sheets");
      const itemIds = (itemRows || []).map((r: any) => r.id);
      if (itemIds.length === 0) {
        setKitOptions([]);
        return;
      }
      const [{ data: vars }, { data: sups }] = await Promise.all([
        supabase
          .from("product_kit_item_variants")
          .select("item_id, min_value, max_value, supply_id, label, position")
          .in("item_id", itemIds)
          .order("position"),
        supabase.from("supplies").select("id, produto"),
      ]);
      const supMap = new Map<string, string>((sups || []).map((s: any) => [s.id, s.produto]));
      const byItem = new Map<string, KitOption["variants"]>();
      for (const v of (vars || []) as any[]) {
        const arr = byItem.get(v.item_id) || [];
        arr.push({
          min_value: v.min_value,
          max_value: v.max_value,
          supply_id: v.supply_id,
          supply_label: v.supply_id ? supMap.get(v.supply_id) ?? "" : "",
          label: v.label,
        });
        byItem.set(v.item_id, arr);
      }
      const opts: KitOption[] = (itemRows || [])
        .map((r: any) => ({
          kit_id: r.kit_id,
          kit_name: r.product_kits?.name ?? "Kit",
          item_id: r.id,
          variants: byItem.get(r.id) || [],
        }))
        .filter(
          (o) =>
            o.item_id !== currentItemId &&
            o.variants.some((v) => !!v.supply_id),
        );
      setKitOptions(opts);
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    if (copyOpen) loadCopyOptions();
  }, [copyOpen]);

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

  const applyCopy = (opt: KitOption) => {
    onChange(
      opt.variants.map((v) => ({
        tmp_id: tmp(),
        min_value: v.min_value,
        max_value: v.max_value,
        supply_id: v.supply_id,
        supply_label: v.supply_label,
        label: v.label ?? "",
      })),
    );
    setCopyOpen(false);
    toast.success(`Mapeamento copiado de "${opt.kit_name}"`);
  };

  const resetToPreset = () => {
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

  const mapped = variants.filter((v) => !!v.supply_id).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Faixas por nº de folhas {itemLabel ? `— ${itemLabel}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-muted-foreground leading-relaxed">
            No orçamento, o sistema escolhe automaticamente o suprimento certo
            conforme o nº de folhas do trabalho. Configure uma vez aqui — depois
            é só reutilizar nos próximos kits com o botão{" "}
            <strong>Copiar de outro kit</strong>.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {mapped} de {variants.length} faixas mapeadas
          </span>
          <div className="flex gap-1">
            <Popover open={copyOpen} onOpenChange={setCopyOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline">
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar de outro kit
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="px-3 py-2 border-b">
                  <p className="text-xs font-semibold">Escolha um kit já configurado</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {loadingOptions ? (
                    <p className="text-xs text-muted-foreground p-3 text-center">
                      Carregando...
                    </p>
                  ) : kitOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic p-3 text-center">
                      Nenhum outro kit com faixas mapeadas ainda.
                    </p>
                  ) : (
                    kitOptions.map((opt) => {
                      const m = opt.variants.filter((v) => !!v.supply_id).length;
                      return (
                        <button
                          key={opt.item_id}
                          type="button"
                          onClick={() => applyCopy(opt)}
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b last:border-b-0 flex items-center justify-between gap-2"
                        >
                          <span className="text-sm truncate">{opt.kit_name}</span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 shrink-0 flex items-center gap-0.5">
                            <Check className="h-3 w-3" /> {m}/{opt.variants.length}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <Button size="sm" variant="ghost" onClick={resetToPreset} title="Restaurar 12 faixas padrão">
              Resetar
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
