// Suprimento avulso V3 — usa SupplySearch (mesmo catálogo do V2).
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Check, Plus, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import SupplySearch, {
  type SupplyOption,
} from "@/components/orcamentos-v3/listing/SupplySearch";
import { fmtBRL, roundUp10 } from "../shared/pricing";
import { TierFaixasPanel } from "../shared/TierFaixasPanel";
import { genId, type V3SupplyItem } from "../types";

interface Props {
  defaultMarginPct: number;
  onAdd: (item: V3SupplyItem) => void;
  onAddTiers?: (items: V3SupplyItem[]) => void;
}

export function SupplyForm({ defaultMarginPct, onAdd, onAddTiers }: Props) {
  const [supply, setSupply] = useState<SupplyOption | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [extraTiers, setExtraTiers] = useState<number[]>([]);
  const [margem, setMargem] = useState<number>(defaultMarginPct || 20);
  const [descricao, setDescricao] = useState("");
  const [pulse, setPulse] = useState(false);

  const custoUnit = supply?.valor_unitario ?? 0;
  const totalCusto = custoUnit * qty;
  const totalPreco = totalCusto * (1 + margem / 100);
  const canAdd = !!supply && qty > 0;

  const buildItem = (q: number, tierGroupId?: string): V3SupplyItem | null => {
    if (!supply) return null;
    return {
      id: genId(),
      kind: "supply",
      descricao: descricao.trim() || supply.produto,
      tier_group_id: tierGroupId ?? null,
      supply_id: supply.id,
      supply_nome: supply.produto,
      fornecedor: supply.fornecedor || null,
      custo_unitario: custoUnit,
      margem_pct: margem,
      quantidade: q,
    };
  };

  const submit = () => {
    if (!supply || !canAdd) return;
    const it = buildItem(qty);
    if (!it) return;
    const cleanExtras = [...new Set(extraTiers)]
      .filter((q) => q > 0 && q !== qty)
      .sort((a, b) => a - b);
    if (cleanExtras.length > 0 && onAddTiers) {
      const tg = `tg_${genId()}`;
      const primary = { ...it, tier_group_id: tg, tier_primary: true } as V3SupplyItem;
      const siblings = cleanExtras
        .map((q) => {
          const s = buildItem(q, tg);
          return s ? ({ ...s, tier_primary: false } as V3SupplyItem) : null;
        })
        .filter((x): x is V3SupplyItem => !!x);
      onAddTiers([primary, ...siblings]);
    } else {
      onAdd(it);
    }
    setDescricao("");
    setSupply(null);
    setQty(1);
    setExtraTiers([]);
    setPulse(true);
    setTimeout(() => setPulse(false), 600);
  };

  return (
    <div className="space-y-5 flex-1 flex flex-col">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Suprimento do catálogo
        </Label>
        <SupplySearch
          onSelect={(s) => {
            setSupply(s);
            if (s.margem_pct != null) setMargem(Number(s.margem_pct));
          }}
        />
      </div>

      {supply && (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 flex items-center gap-3">
          <Package className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{supply.produto}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {supply.fornecedor || "Sem fornecedor"} · {fmtBRL(custoUnit)} /un
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSupply(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            trocar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Quantidade
          </Label>
          <Input
            type="number"
            min={1}
            value={qty || ""}
            onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Margem ({margem.toFixed(0)}%)
          </Label>
          <Slider
            min={0}
            max={300}
            step={1}
            value={[margem]}
            onValueChange={(v) => setMargem(v[0] ?? 0)}
          />
        </div>
      </div>

      {onAddTiers && (
        <TierFaixasPanel
          currentQty={qty}
          disabled={!supply}
          onExtrasChange={setExtraTiers}
          compute={(q) => {
            const c = q * custoUnit;
            return { custo_total: c, preco_total: roundUp10(c * (1 + margem / 100)) };
          }}
        />
      )}

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
          Descrição (opcional)
        </Label>
        <Input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={supply ? `Padrão: ${supply.produto}` : "Selecione o suprimento primeiro"}
          className="h-9"
        />
      </div>

      {supply && (
        <div className="rounded-md border border-border/60 bg-background px-3 py-2.5 flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            Custo {fmtBRL(totalCusto)} · {qty} un
          </span>
          <span className="font-semibold text-primary tabular-nums">
            {fmtBRL(totalPreco)}
          </span>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 mt-auto -mb-5 lg:-mb-0 bg-background border-t border-border shadow-[0_-8px_16px_-8px_hsl(var(--background))] flex items-center justify-end gap-3">
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
          ) : extraTiers.length > 0 ? (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar suprimento + {extraTiers.length} faixa{extraTiers.length === 1 ? "" : "s"}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" /> Adicionar suprimento
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
