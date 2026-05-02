// =============================================================================
// FinishingTiersDrawer — editor de faixas de preço por quantidade de folhas
// =============================================================================
// Permite cadastrar tiers como [1-10 → R$ 1,80], [11-50 → R$ 1,40], [51+ → R$ 1,00].
// Validação: min ≥ 1, max ≥ min OU vazio (∞), sem sobreposição entre faixas.
// O backend (trigger PostgreSQL) também valida — UI dá feedback antecipado.
// =============================================================================

import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";

interface Tier {
  id?: string;
  label: string;
  min_qty: number;
  max_qty: number | null;
  price_per_sheet: number;
  sort_order: number;
  _isNew?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  finishingId: string | null;
  finishingName: string;
  basePrice: number;
  onSaved?: () => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const autoLabel = (index: number) => `TP${index + 1}`;
const isAutoLabel = (s: string) => /^TP\d+$/.test(s) || /^\d+(-\d+|\+)$/.test(s);

export function FinishingTiersDrawer({
  open,
  onOpenChange,
  finishingId,
  finishingName,
  basePrice,
  onSaved,
}: Props) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !finishingId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("finishing_price_tiers")
        .select("*")
        .eq("finishing_id", finishingId)
        .order("min_qty");
      if (!active) return;
      if (error) {
        toast.error("Falha ao carregar faixas");
        setTiers([]);
      } else {
        setTiers(
          (data ?? []).map((t: any) => ({
            id: t.id,
            label: t.label,
            min_qty: Number(t.min_qty),
            max_qty: t.max_qty == null ? null : Number(t.max_qty),
            price_per_sheet: Number(t.price_per_sheet),
            sort_order: Number(t.sort_order ?? 0),
          })),
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, finishingId]);

  const addTier = () => {
    const lastMax = tiers.reduce(
      (acc, t) => Math.max(acc, t.max_qty ?? t.min_qty),
      0,
    );
    const min = lastMax + 1;
    setTiers([
      ...tiers,
      {
        label: autoLabel(min, null),
        min_qty: min,
        max_qty: null,
        price_per_sheet: basePrice,
        sort_order: tiers.length,
        _isNew: true,
      },
    ]);
  };

  const updateTier = (idx: number, patch: Partial<Tier>) => {
    const next = tiers.map((t, i) => {
      if (i !== idx) return t;
      const merged = { ...t, ...patch };
      // Auto-atualiza label se min/max mudou e label parecia padrão
      if ((patch.min_qty != null || patch.max_qty !== undefined) && /^\d+(-\d+|\+)$/.test(t.label)) {
        merged.label = autoLabel(merged.min_qty, merged.max_qty);
      }
      return merged;
    });
    setTiers(next);
  };

  const removeTier = (idx: number) => {
    setTiers(tiers.filter((_, i) => i !== idx));
  };

  const validate = (): string | null => {
    if (tiers.length === 0) return null; // vazio é ok = usa preço base
    const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      if (t.min_qty < 1) return `Faixa "${t.label}": mínimo deve ser ≥ 1`;
      if (t.max_qty != null && t.max_qty < t.min_qty)
        return `Faixa "${t.label}": máximo deve ser ≥ mínimo`;
      if (t.price_per_sheet < 0) return `Faixa "${t.label}": preço inválido`;
      if (i > 0) {
        const prev = sorted[i - 1];
        const prevMax = prev.max_qty ?? Number.POSITIVE_INFINITY;
        if (t.min_qty <= prevMax) {
          return `Faixas "${prev.label}" e "${t.label}" se sobrepõem`;
        }
      }
    }
    return null;
  };

  const save = async () => {
    if (!finishingId) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    // Estratégia simples: deleta tudo e reinsere. Volume é pequeno (3-5 tiers).
    const del = await (supabase as any)
      .from("finishing_price_tiers")
      .delete()
      .eq("finishing_id", finishingId);
    if (del.error) {
      handleError(del.error, "salvar faixas");
      setSaving(false);
      return;
    }
    if (tiers.length > 0) {
      const payload = tiers.map((t, i) => ({
        finishing_id: finishingId,
        label: t.label.trim() || autoLabel(t.min_qty, t.max_qty),
        min_qty: t.min_qty,
        max_qty: t.max_qty,
        price_per_sheet: t.price_per_sheet,
        sort_order: i,
      }));
      const ins = await (supabase as any)
        .from("finishing_price_tiers")
        .insert(payload);
      if (ins.error) {
        handleError(ins.error, "salvar faixas");
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast.success(
      tiers.length === 0
        ? "Faixas removidas — usando preço base"
        : `${tiers.length} faixa${tiers.length > 1 ? "s" : ""} salva${tiers.length > 1 ? "s" : ""}`,
    );
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Faixas por quantidade</SheetTitle>
          <SheetDescription>
            <strong>{finishingName}</strong> · preço base {fmt(basePrice)}/folha
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
            <p className="text-xs leading-relaxed">
              <strong>Como funciona:</strong> cadastre faixas pelo número de{" "}
              <strong>folhas</strong> da tiragem. A calculadora escolhe automaticamente
              a faixa correspondente ao volume calculado. Sem faixas, usa o preço base
              ({fmt(basePrice)}/folha).
            </p>
            <div className="text-[11px] text-muted-foreground">
              <div className="font-medium mb-1">Exemplo:</div>
              <div className="font-mono space-y-0.5">
                <div>1–10 folhas → R$ 1,80/folha (pequeno volume)</div>
                <div>11–50 folhas → R$ 1,40/folha (médio)</div>
                <div>51+ folhas (deixe Máx vazio = ∞) → R$ 1,00/folha (atacado)</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              ⚠️ As faixas <strong>não podem se sobrepor</strong>. Encadeie sempre:
              a próxima Mín deve ser maior que a Máx anterior.
            </p>
          </div>

          <div className="border rounded-md overflow-hidden">
            <div className="grid grid-cols-[1fr_70px_70px_110px_36px] gap-1.5 bg-muted/40 px-2 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <div>Rótulo</div>
              <div className="text-center">Mín</div>
              <div className="text-center">Máx</div>
              <div className="text-right">R$/folha</div>
              <div></div>
            </div>

            {loading ? (
              <p className="text-xs text-center py-6 text-muted-foreground">Carregando…</p>
            ) : tiers.length === 0 ? (
              <p className="text-xs text-center py-6 text-muted-foreground italic">
                Nenhuma faixa — usando preço base.
              </p>
            ) : (
              tiers.map((t, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_70px_70px_110px_36px] gap-1.5 px-2 py-1.5 border-t items-center"
                >
                  <Input
                    value={t.label}
                    onChange={(e) => updateTier(idx, { label: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="ex.: 11-50"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={t.min_qty}
                    onChange={(e) =>
                      updateTier(idx, { min_qty: parseInt(e.target.value, 10) || 1 })
                    }
                    className="h-8 text-xs text-center"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={t.max_qty ?? ""}
                    placeholder="∞"
                    onChange={(e) =>
                      updateTier(idx, {
                        max_qty: e.target.value === "" ? null : parseInt(e.target.value, 10),
                      })
                    }
                    className="h-8 text-xs text-center"
                  />
                  <Input
                    type="number"
                    step="0.10"
                    min={0}
                    value={t.price_per_sheet}
                    onChange={(e) =>
                      updateTier(idx, {
                        price_per_sheet: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-8 text-xs text-right tabular-nums"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeTier(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <Button variant="outline" size="sm" onClick={addTier} className="w-full">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar faixa
          </Button>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              {saving ? "Salvando…" : "Salvar faixas"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
