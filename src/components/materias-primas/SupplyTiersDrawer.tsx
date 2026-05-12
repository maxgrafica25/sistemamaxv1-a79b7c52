// SupplyTiersDrawer — editor de faixas manuais por quantidade para suprimentos
// usados em apostilas (modo soma direta). O preço cadastrado é o **valor final
// ao cliente**: impostos e taxa de cartão já estão embutidos. Substitui a
// margem percentual quando a faixa bate na quantidade do filho.

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
import { toast } from "sonner";
import { handleError } from "@/lib/handleError";

interface Tier {
  id?: string;
  label: string;
  min_qty: number;
  max_qty: number | null;
  manual_price: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplyId: string | null;
  supplyName: string;
  baseUnitPrice: number;
  marginPct: number;
  onSaved?: () => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const autoLabel = (i: number) => `TP${i + 1}`;
const isAutoLabel = (s: string) => /^TP\d+$/.test(s);

export function SupplyTiersDrawer({
  open,
  onOpenChange,
  supplyId,
  supplyName,
  baseUnitPrice,
  marginPct,
  onSaved,
}: Props) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !supplyId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("supply_pricing_tiers")
        .select("*")
        .eq("supply_id", supplyId)
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
            manual_price: Number(t.manual_price),
          })),
        );
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, supplyId]);

  const suggestPrice = baseUnitPrice * (1 + (marginPct || 0) / 100);

  const addTier = () => {
    const lastMax = tiers.reduce(
      (acc, t) => Math.max(acc, t.max_qty ?? t.min_qty),
      0,
    );
    setTiers([
      ...tiers,
      {
        label: autoLabel(tiers.length),
        min_qty: lastMax + 1,
        max_qty: null,
        manual_price: Number(suggestPrice.toFixed(2)) || 0,
      },
    ]);
  };

  const updateTier = (idx: number, patch: Partial<Tier>) => {
    setTiers((prev) => {
      const next = prev.map((t, i) => {
        if (i !== idx) return t;
        const merged = { ...t, ...patch };
        if (
          (patch.min_qty != null || patch.max_qty !== undefined) &&
          isAutoLabel(t.label)
        ) {
          merged.label = autoLabel(idx);
        }
        return merged;
      });
      if (patch.max_qty !== undefined && idx < next.length - 1) {
        const oldMax = prev[idx].max_qty;
        const newMax = next[idx].max_qty;
        const wasChained = oldMax != null && next[idx + 1].min_qty === oldMax + 1;
        if (newMax != null && wasChained) {
          next[idx + 1] = { ...next[idx + 1], min_qty: newMax + 1 };
        }
      }
      return next;
    });
  };

  const removeTier = (idx: number) =>
    setTiers(tiers.filter((_, i) => i !== idx));

  const validate = (): string | null => {
    if (tiers.length === 0) return null;
    const sorted = [...tiers].sort((a, b) => a.min_qty - b.min_qty);
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i];
      if (t.min_qty < 1) return `Faixa "${t.label}": mínimo deve ser ≥ 1`;
      if (t.max_qty != null && t.max_qty < t.min_qty)
        return `Faixa "${t.label}": máximo deve ser ≥ mínimo`;
      if (t.manual_price < 0) return `Faixa "${t.label}": preço inválido`;
      if (i > 0) {
        const prev = sorted[i - 1];
        const prevMax = prev.max_qty ?? Number.POSITIVE_INFINITY;
        if (t.min_qty <= prevMax)
          return `Faixas "${prev.label}" e "${t.label}" se sobrepõem`;
      }
    }
    return null;
  };

  const save = async () => {
    if (!supplyId) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const del = await (supabase as any)
      .from("supply_pricing_tiers")
      .delete()
      .eq("supply_id", supplyId);
    if (del.error) {
      handleError(del.error, "salvar faixas");
      setSaving(false);
      return;
    }
    if (tiers.length > 0) {
      const payload = tiers.map((t, i) => ({
        supply_id: supplyId,
        label: t.label.trim() || autoLabel(i),
        min_qty: t.min_qty,
        max_qty: t.max_qty,
        manual_price: t.manual_price,
        sort_order: i,
      }));
      const ins = await (supabase as any)
        .from("supply_pricing_tiers")
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
        ? "Faixas removidas — voltando a usar margem"
        : `${tiers.length} faixa(s) salva(s)`,
    );
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Faixas de preço · {supplyName}</SheetTitle>
          <SheetDescription>
            Custo {fmt(baseUnitPrice)} · margem atual {marginPct.toFixed(0)}%
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2 text-xs leading-relaxed">
            <p>
              <strong>Preço final ao cliente</strong> por quantidade — impostos e taxa
              de cartão <strong>já estão embutidos</strong>. Quando a quantidade do filho
              bate em uma faixa, ela <strong>substitui</strong> o cálculo por margem.
            </p>
            <p className="text-muted-foreground">
              Use para espelhar tabelas externas (ex.: Tiny ERP) sem precisar
              recalcular impostos manualmente.
            </p>
            <div className="text-[11px] text-muted-foreground">
              <div className="font-medium mb-1">Exemplo:</div>
              <div className="font-mono space-y-0.5">
                <div>TP1 · 1–5 un → R$ 7,50/un</div>
                <div>TP2 · 6–20 un → R$ 6,80/un</div>
                <div>TP3 · 21+ (Máx vazio = ∞) → R$ 6,00/un</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              ⚠️ As faixas <strong>não podem se sobrepor</strong>.
            </p>
          </div>

          <div className="border rounded-md overflow-hidden">
            <div className="grid grid-cols-[1fr_70px_70px_120px_36px] gap-1.5 bg-muted/40 px-2 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              <div>Rótulo</div>
              <div className="text-center">Mín</div>
              <div className="text-center">Máx</div>
              <div className="text-right">R$ final/un</div>
              <div></div>
            </div>

            {loading ? (
              <p className="text-xs text-center py-6 text-muted-foreground">
                Carregando…
              </p>
            ) : tiers.length === 0 ? (
              <p className="text-xs text-center py-6 text-muted-foreground italic">
                Nenhuma faixa — usando margem percentual.
              </p>
            ) : (
              tiers.map((t, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_70px_70px_120px_36px] gap-1.5 px-2 py-1.5 border-t items-center"
                >
                  <Input
                    value={t.label}
                    onChange={(e) => updateTier(idx, { label: e.target.value })}
                    className="h-8 text-xs"
                    placeholder={`TP${idx + 1}`}
                  />
                  <Input
                    type="number"
                    min={1}
                    value={t.min_qty}
                    onChange={(e) =>
                      updateTier(idx, {
                        min_qty: parseInt(e.target.value, 10) || 1,
                      })
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
                        max_qty:
                          e.target.value === ""
                            ? null
                            : parseInt(e.target.value, 10),
                      })
                    }
                    className="h-8 text-xs text-center"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={t.manual_price}
                    onChange={(e) =>
                      updateTier(idx, {
                        manual_price: parseFloat(e.target.value) || 0,
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

          <Button
            variant="outline"
            size="sm"
            onClick={addTier}
            className="w-full"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar faixa
          </Button>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
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
